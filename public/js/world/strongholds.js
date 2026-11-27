// The far wilds' strongholds (data/sites.mjs): Monster Towers and Monster Camps, built when you come near.
//
// A tower is a square stone keep 20 m a side, `floors` storeys of 7 m each and an open roof with a
// parapet. One door on the south side. On every floor a stair runs up along a wall to the floor
// above (north wall on even floors, south wall on odd ones), so the way up zig-zags to the roof,
// where the Warden waits beside the treasure. Floors and stairs are real: you (and the monsters)
// stand on them (floorAt), and the walls are solid.
// A camp is a ring of hide tents round a big fire, behind a broken stake fence.
import * as THREE from 'three';
import { stoneWallMat, stoneBox } from './city.js';
import { mergeStill } from './merge.js';
import { GlowLight } from './lightpool.js';
import { heightAt } from '../data/world-layout.mjs';
import { FLOOR_H, siteGround } from '../data/sites.mjs';

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const MATS = new Map();
const cached = (k, make) => { if (!MATS.has(k)) MATS.set(k, make()); return MATS.get(k); };
const plain = (color, r = 0.85, m = 0) => cached(`p${color}${r}${m}`, () => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m }));
const glowing = (color, k = 1.6) => cached(`g${color}${k}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.5 }));

// meshes, solids, floors and stairs, all placed from the site's middle (cx, F, cz)
function maker(cx, F, cz) {
  const g = new THREE.Group();
  const solids = [], floors = [], ramps = [], lights = [];
  const add = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const B = {
    g, solids, floors, ramps, lights,
    box(mat, x, y, z, w, h, d, ry = 0) {
      const stone = !!mat.map;
      const m = new THREE.Mesh(stone ? stoneBox(w, h, d) : UNIT, mat);
      if (!stone) m.scale.set(w, h, d);
      m.position.set(x, y + h / 2, z); m.rotation.y = ry;
      return add(m);
    },
    mesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return add(m); },
    cyl(mat, x, y, z, r, h, seg = 12, rTop = r) { return B.mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat, x, y + h / 2, z); },
    cone(mat, x, y, z, r, h, seg = 12) { return B.mesh(new THREE.ConeGeometry(r, h, seg), mat, x, y + h / 2, z); },
    solidLine(x0, z0, x1, z1, y, h, r) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / Math.max(0.5, r * 1.1)));
      for (let i = 0; i <= n; i++) { const t = i / n; solids.push({ x: cx + x0 + (x1 - x0) * t, z: cz + z0 + (z1 - z0) * t, r, kind: 'wall', built: true, y: F + y, height: h }); }
    },
    solid(x, z, r, y, h) { solids.push({ x: cx + x, z: cz + z, r, kind: 'wall', built: true, y: F + y, height: h }); },
    floor(x0, x1, z0, z1, y) { floors.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y }); },
    // a stair from a0 (height y0) to a1 (height y1) along x, z0..z1 wide, drawn as steps
    stair(mat, z0, z1, a0, a1, y0, y1) {
      const r = { x0: Math.min(a0, a1), x1: Math.max(a0, a1), z0, z1, a0, a1, y0, y1 };
      ramps.push(r);
      const n = Math.ceil((y1 - y0) / 0.5);
      for (let i = 0; i < n; i++) {
        const s0 = a0 + ((a1 - a0) * i) / n, s1 = a0 + ((a1 - a0) * (i + 1)) / n;
        const top = y0 + ((y1 - y0) * (i + 1)) / n;
        B.box(mat, (s0 + s1) / 2, top - 0.5, (z0 + z1) / 2, Math.abs(s1 - s0), 0.5, z1 - z0);
      }
    },
    light(x, y, z, color, power = 40, dist = 30) { const l = new GlowLight(color, power, dist, 1.5); l.position.set(x, y, z); lights.push(l); },
  };
  return B;
}
// the highest floor or stair at (x, z) no higher than `reach` (world y), or -Infinity
function floorFinder(cx, F, cz, edge, floors, ramps) {
  return (x, z, reach) => {
    const lx = x - cx, lz = z - cz;
    if (lx < -edge || lx > edge || lz < -edge || lz > edge) return -Infinity;
    const lim = reach - F;
    let best = -Infinity;
    for (const f of floors) if (lx >= f.x0 && lx <= f.x1 && lz >= f.z0 && lz <= f.z1 && f.y <= lim && f.y > best) best = f.y;
    for (const r of ramps) {
      if (lx < r.x0 || lx > r.x1 || lz < r.z0 || lz > r.z1) continue;
      const y = r.y0 + (r.y1 - r.y0) * Math.min(1, Math.max(0, (lx - r.a0) / (r.a1 - r.a0)));
      if (y <= lim && y > best) best = y;
    }
    return best === -Infinity ? best : F + best;
  };
}

// ---------- the tower ----------
export const TOWER_S = 10; // half its width
const WALL_T = 1.2, STAIR_W = 3, STAIR_A = 7.5; // a stair runs from x = -7.5 to x = +7.5
// where a floor's stair runs (z0..z1): along the north wall on even floors, the south on odd ones
const stairZ = (f) => {
  const inner = TOWER_S - WALL_T;
  return f % 2 === 0 ? [-inner, -inner + STAIR_W] : [inner - STAIR_W, inner];
};

export function buildTower(site) {
  const T = site.theme, N = site.floors, S = TOWER_S, H = FLOOR_H;
  const ground = siteGround(site, S + 2);
  const F = ground.top + 0.3;
  const cx = site.x, cz = site.z;
  const B = maker(cx, F, cz);
  const wallM = stoneWallMat(T.wall), wall2M = stoneWallMat(T.wall2), trimM = plain(T.trim, 0.8), roofM = plain(T.roof, 0.75);
  const floorM = stoneWallMat(T.wall2), dark = plain('#141010', 1), glowM = glowing(T.glow, 1.4);
  const inner = S - WALL_T, top = N * H;

  // the plinth it stands on (down into the slope), and steps from the ground up to the door
  const plinthLow = Math.min(-1, ground.low - F - 1);
  B.box(wall2M, 0, plinthLow, 0, 2 * S + 2, -plinthLow, 2 * S + 2);
  B.floor(-S - 1, S + 1, -S - 1, S + 1, 0);
  let outside = heightAt(cx, cz + S + 6) - F;
  if (outside < -0.3) {
    // (measured again where the steps end, so their foot meets the ground there)
    const len = Math.max(3, -outside * 1.6);
    outside = Math.min(-0.3, heightAt(cx, cz + S + 1 + len) - F);
    const n = Math.ceil(-outside / 0.4);
    for (let i = 0; i < n; i++) {
      const y = outside + ((i + 1) * -outside) / n;
      B.box(wall2M, 0, outside - 1, S + 1 + len - ((i + 0.5) * len) / n, 5, y - outside + 1, len / n);
    }
    // (a stair along z, from the door down to the ground: see floorAt below)
    B.ramps.push({ x0: -2.5, x1: 2.5, z0: S + 1, z1: S + 1 + len, zRamp: true, a0: S + 1, a1: S + 1 + len, y0: 0, y1: outside });
  }

  // the four walls, from the plinth to above the roof (the parapet); the door in the south wall
  const wallH = top + 1.4;
  const DOOR = 2.2, DOOR_H = 4;
  const wallX = (z) => { B.box(wallM, 0, 0, z, 2 * S, wallH, WALL_T); };
  wallX(-S + WALL_T / 2);
  B.box(wallM, -(S + DOOR) / 2, 0, S - WALL_T / 2, S - DOOR, wallH, WALL_T);
  B.box(wallM, (S + DOOR) / 2, 0, S - WALL_T / 2, S - DOOR, wallH, WALL_T);
  B.box(wallM, 0, DOOR_H, S - WALL_T / 2, 2 * DOOR, wallH - DOOR_H, WALL_T);
  for (const sx of [-1, 1]) B.box(wallM, sx * (S - WALL_T / 2), 0, 0, WALL_T, wallH, 2 * S - 2 * WALL_T);
  const r = 0.75;
  B.solidLine(-S + r, -S + r, S - r, -S + r, 0, wallH, r);
  B.solidLine(-S + r, S - r, -DOOR - r, S - r, 0, wallH, r);
  B.solidLine(DOOR + r, S - r, S - r, S - r, 0, wallH, r);
  B.solidLine(-S + r, -S + r, -S + r, S - r, 0, wallH, r);
  B.solidLine(S - r, -S + r, S - r, S - r, 0, wallH, r);
  // the door's frame, dark trim bands at every floor, and glowing slit windows
  for (const sx of [-1, 1]) B.box(trimM, sx * (DOOR + 0.35), 0, S + 0.1, 0.7, DOOR_H + 0.4, 0.6);
  B.box(trimM, 0, DOOR_H, S + 0.1, 2 * DOOR + 1.4, 0.7, 0.6);
  for (let f = 1; f <= N; f++) {
    B.box(trimM, 0, f * H - 0.35, -S - 0.05, 2 * S + 0.6, 0.5, 0.4);
    B.box(trimM, 0, f * H - 0.35, S + 0.05, 2 * S + 0.6, 0.5, 0.4);
    for (const sx of [-1, 1]) B.box(trimM, sx * (S + 0.05), f * H - 0.35, 0, 0.4, 0.5, 2 * S + 0.6);
  }
  for (let f = 0; f < N; f++) {
    for (const wx of [-5, 5]) for (const sz of [-1, 1]) { if (f === 0 && sz === 1) continue; B.box(glowM, wx, f * H + 3, sz * (S + 0.02), 0.6, 1.8, 0.1); }
    for (const sx of [-1, 1]) for (const wz of [-4, 4]) B.box(glowM, sx * (S + 0.02), f * H + 3, wz, 0.1, 1.8, 0.6);
  }

  // the floors (each with a hole over the stair coming up from below) and the stairs
  for (let f = 0; f <= N; f++) {
    const y = f * H;
    if (f > 0) {
      const [h0, h1] = stairZ(f - 1);
      // the slab, in three pieces round the hole: the rest of the floor, and either end of the stair
      const rest = h0 < 0 ? [h1, inner] : [-inner, h0];
      B.box(floorM, 0, y - 0.5, (rest[0] + rest[1]) / 2, 2 * inner, 0.5, rest[1] - rest[0]);
      B.floor(-inner, inner, rest[0], rest[1], y);
      for (const [a, b] of [[-inner, -STAIR_A], [STAIR_A, inner]]) { B.box(floorM, (a + b) / 2, y - 0.5, (h0 + h1) / 2, b - a, 0.5, h1 - h0); B.floor(a, b, h0, h1, y); }
      // a low rail round the hole, so you don't walk off the edge by chance
      const railZ = h0 < 0 ? h1 + 0.15 : h0 - 0.15;
      B.box(trimM, 0, y, railZ, 2 * STAIR_A - 3, 1, 0.25);
      B.solidLine(-STAIR_A + 1.5, railZ, STAIR_A - 1.5, railZ, y, 1, 0.3);
    }
    if (f < N) {
      // the stair up to the next floor: west to east on even floors, east to west on odd ones
      const [z0, z1] = stairZ(f);
      const [a0, a1] = f % 2 === 0 ? [-STAIR_A, STAIR_A] : [STAIR_A, -STAIR_A];
      B.stair(wall2M, z0, z1, a0, a1, y, y + H);
      // (you can't walk in under the stair's high end)
      const under = f % 2 === 0 ? [1, STAIR_A] : [-STAIR_A, -1];
      B.solidLine(under[0], (z0 + z1) / 2 + (z0 < 0 ? 1.1 : -1.1), under[1], (z0 + z1) / 2 + (z0 < 0 ? 1.1 : -1.1), y, H * 0.45, 0.4);
      // a torch on the wall by each stair
      if (f % 2 === 0) B.box(glowM, 0, y + 4.5, z0 + 0.1, 0.3, 0.6, 0.2);
    }
  }
  B.light(0, H * 0.5, 0, T.glow, 30, 22);
  B.light(0, top + 3, 0, T.glow, 40, 30);

  // the roof: merlons round the parapet, a corner turret with a pointed roof at each corner,
  // the Warden's banner and the treasure chest
  for (let s = -S + 0.8; s < S; s += 2.4) {
    B.box(wallM, s, wallH, -S + 0.6, 1.2, 1.2, 1.2); B.box(wallM, s, wallH, S - 0.6, 1.2, 1.2, 1.2);
    B.box(wallM, -S + 0.6, wallH, s, 1.2, 1.2, 1.2); B.box(wallM, S - 0.6, wallH, s, 1.2, 1.2, 1.2);
  }
  for (const [tx, tz] of [[-S, -S], [S, -S], [-S, S], [S, S]]) {
    B.cyl(wallM, tx, 0, tz, 2.4, wallH + 4, 12);
    B.cone(roofM, tx, wallH + 4, tz, 3, 5, 12);
    B.solid(tx, tz, 2.4, 0, wallH + 4);
  }
  B.cyl(trimM, -5, top, -5, 0.15, 9, 6);
  B.box(plain(T.banner, 0.9), -4.1, top + 5.5, -5, 1.8, 3, 0.08);
  B.box(plain('#6a4a24', 0.8), 4, top, 3, 1.6, 1, 1);
  B.box(plain('#d8a030', 0.4, 0.6), 4, top + 1, 3, 1.7, 0.2, 1.1);
  B.solid(4, 3, 1, top, 1.2);
  // the land's own touch on top
  if (site.region === 'peaks') B.cyl(glowing('#ff5a18', 2), 0, top, -5, 1.2, 0.3, 12);
  if (site.region === 'fae' || site.region === 'frost') {
    const cry = new THREE.OctahedronGeometry(1.4, 0);
    B.mesh(cry, glowing(T.glow, 1.8), 0, top + 12, 0).scale.set(1, 2.4, 1);
    B.cyl(trimM, 0, top, 0, 0.5, 9, 8);
    B.solid(0, 0, 0.7, top, 9);
  }
  if (site.region === 'mire') for (let i = 0; i < 6; i++) B.box(plain('#3a5a2a', 1), -S + 2 + i * 3.4, 0, S + 0.6, 2.4, 2 + (i % 3), 0.3); // moss and weed up the walls

  mergeStill(B.g, { cell: 60 });
  for (const l of B.lights) B.g.add(l);
  B.g.position.set(cx, F, cz);

  // floors and stairs, and the steps up to the door (a stair along z)
  const zRamps = B.ramps.filter((q) => q.zRamp), xRamps = B.ramps.filter((q) => !q.zRamp);
  const inTower = floorFinder(cx, F, cz, S + 1 + 12, B.floors, xRamps);
  function floorAt(x, z, reach) {
    let best = inTower(x, z, reach);
    const lx = x - cx, lz = z - cz;
    for (const q of zRamps) {
      if (lx < q.x0 || lx > q.x1 || lz < q.z0 || lz > q.z1) continue;
      const y = F + q.y0 + (q.y1 - q.y0) * Math.min(1, Math.max(0, (lz - q.a0) / (q.a1 - q.a0)));
      if (y <= reach && y > best) best = y;
    }
    return best;
  }
  // where the monsters stand on each floor (world x, y, z), the Warden's place and the chest
  const spots = [];
  for (let f = 0; f < N; f++) {
    const [z0] = stairZ(f), side = z0 < 0 ? 1 : -1; // (keep off the stair)
    spots.push([[cx - 4, F + f * H, cz + side * 3], [cx + 4, F + f * H, cz + side * 4], [cx, F + f * H, cz + side * 4.8]]);
  }
  const warden = [cx - 2, F + top, cz + 1];
  return { group: B.g, solid: B.solids, floorAt, spots, warden, chest: { x: cx + 4, y: F + top, z: cz + 3 }, top: F + top, ground: F, door: { x: cx, z: cz + S + 2 } };
}

// ---------- the camp ----------
export function buildCamp(site) {
  const T = site.theme;
  const ground = siteGround(site, 14);
  const cx = site.x, cz = site.z;
  const F = heightAt(cx, cz);
  const g = new THREE.Group();
  const solids = [], lights = [];
  const at = (x, z) => heightAt(cx + x, cz + z) - F;
  const add = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const tentM = plain(T.tent, 0.95), poleM = plain('#4a3420', 0.9), stoneM = plain('#5a5550', 1);
  // the tents, in a ring
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4, d = 10;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const t = add(new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.6, 7), tentM));
    t.position.set(x, at(x, z) + 1.7, z);
    const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 5), poleM));
    pole.position.set(x, at(x, z) + 4, z);
    solids.push({ x: cx + x, z: cz + z, r: 2.4, kind: 'wall', height: 4 });
  }
  // the fire, in a ring of stones, with a spit over it
  const fire = add(new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 8), glowing(T.fire, 2.4)));
  fire.position.set(0, at(0, 0) + 1, 0);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const s = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), stoneM)); s.position.set(Math.cos(a) * 1.5, at(0, 0) + 0.2, Math.sin(a) * 1.5); }
  for (const s of [-1, 1]) { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5), poleM)); p.position.set(s * 1.7, at(0, 0) + 1.1, 0); }
  const bar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 5), poleM)); bar.rotation.z = Math.PI / 2; bar.position.set(0, at(0, 0) + 2.1, 0);
  solids.push({ x: cx, z: cz, r: 1.6, kind: 'wall', height: 1.5 });
  const l = new GlowLight(T.fire, 50, 30, 1.5); l.position.set(0, at(0, 0) + 2.5, 0); lights.push(l);
  // a broken fence of sharpened stakes round it, with gaps
  for (let i = 0; i < 40; i++) {
    if (i % 10 >= 8) continue; // (the gaps)
    const a = (i / 40) * Math.PI * 2, d = 17;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const s = add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.6, 5), poleM));
    s.position.set(x, at(x, z) + 1.1, z); s.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
    solids.push({ x: cx + x, z: cz + z, r: 0.45, kind: 'wall', height: 2.4 });
  }
  // the chief's banner and chest
  const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 6), poleM)); pole.position.set(-3, at(-3, -4) + 3, -4);
  const flag = add(new THREE.Mesh(UNIT, plain(T.fire, 0.9))); flag.scale.set(1.6, 1.1, 0.06); flag.position.set(-2.2, at(-3, -4) + 5.2, -4);
  const chest = add(new THREE.Mesh(UNIT, plain('#6a4a24', 0.8))); chest.scale.set(1.4, 0.9, 0.9); chest.position.set(3, at(3, -4) + 0.45, -4);
  mergeStill(g, { cell: 40 });
  for (const q of lights) g.add(q);
  g.position.set(cx, F, cz);
  const spot = (a, d) => [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
  return { group: g, solid: solids, spots: [0, 1, 2, 3, 4, 5].map((i) => spot((i / 6) * Math.PI * 2 + 0.9, 5 + (i % 2) * 2.5)), chief: spot(-1.6, 3), ground: ground.top };
}

// The Monster Kings' castles: palaces the size of half a city, each built in its King's own style.
//
// Every castle has the same bones (so the court always knows where to stand):
//   - a curtain wall 200 m a side, 18 m high, with towers, a great gate on the south side and a
//     walk along the top of the wall (stairs up to it either side of the gate, inside)
//   - a courtyard with an avenue of statues and braziers from the gate to the keep, the King's own
//     wonders either side (lava pools, glowing trees, gel pools...) and two great halls
//   - the keep: a Throne Hall 38 m wide, 94 m long and 30 m high (the throne on a dais at the far
//     end, sized for the King), and a wing either side with three big rooms on the ground floor,
//     a gallery above (with balconies looking down into the Throne Hall) and a roof terrace.
//     Every stair goes somewhere: ground floor -> gallery -> roof terrace, and courtyard -> wall top.
// Everything that never moves is merged into a few meshes (see merge.js), so a castle costs a
// handful of draw calls; its walls are lines of small solid circles (like every other wall).
import * as THREE from 'three';
import { stoneWallMat, stoneBox } from './city.js';
import { mergeStill } from './merge.js';
import { GlowLight } from './lightpool.js';
import { textTexture } from './spawn.js';

// The look of each King's castle
export const CASTLE_THEMES = {
  dragonewt: {
    wall: '#5a4a46', wall2: '#6e5a52', trim: '#9a2e1c', roof: '#7a1c12', floor: '#4a3c38', pave: '#6a5a50',
    carpet: '#8a1a12', banner: '#9a1a10', mark: '#f0b040', gold: '#d8a030', glow: '#ff6a18', light: '#ff7a2a',
    window: '#ff9a40', roofStyle: 'horn', statue: 'dragon', special: 'lava', kingH: 3.6,
  },
  goblin: {
    wall: '#6a5a48', wall2: '#5a4a3a', trim: '#4a3624', roof: '#4e3a26', floor: '#3e342a', pave: '#5e5040',
    carpet: '#3d5a22', banner: '#4a7a24', mark: '#e8e0c0', gold: '#b08a40', glow: '#ff9a30', light: '#ffa040',
    window: '#ffb050', roofStyle: 'spike', statue: 'skull', special: 'bonfire', kingH: 2.8,
  },
  slime: {
    wall: '#4a8aa8', wall2: '#3a7a98', trim: '#bdeaf8', roof: '#2a90b8', floor: '#2c5a6c', pave: '#5a8a9a',
    carpet: '#1f6f8a', banner: '#38a8d0', mark: '#f0fcff', gold: '#c8f0ff', glow: '#5fe8ff', light: '#60e0ff',
    window: '#90f0ff', roofStyle: 'dome', statue: 'gel', special: 'gel', kingH: 3.2,
  },
  fairy: {
    wall: '#e4e0ee', wall2: '#d4cee4', trim: '#a898d8', roof: '#5e4ca8', floor: '#cfc8e0', pave: '#bdb6d0',
    carpet: '#6a3a9a', banner: '#8a5ad0', mark: '#fff0b0', gold: '#e8d8a0', glow: '#d8b0ff', light: '#c890ff',
    window: '#e0c8ff', roofStyle: 'spire', statue: 'crystal', special: 'glowtrees', kingH: 4.5,
  },
  lizardman: {
    wall: '#5a6644', wall2: '#4a5638', trim: '#6b4a2b', roof: '#7a6a36', floor: '#3a4030', pave: '#555a44',
    carpet: '#2f5a3a', banner: '#3a7a4a', mark: '#e8dca0', gold: '#b8a050', glow: '#c8ff6a', light: '#d0ff80',
    window: '#d8ff90', roofStyle: 'thatch', statue: 'totem', special: 'marsh', kingH: 3.7,
  },
  naga: {
    wall: '#3a7a78', wall2: '#2e6a68', trim: '#d8b450', roof: '#1f6070', floor: '#24484c', pave: '#4a7a78',
    carpet: '#1a6a7a', banner: '#1f8a8a', mark: '#f4d488', gold: '#e4bc48', glow: '#40e8d0', light: '#50f0e0',
    window: '#80fff0', roofStyle: 'dome', statue: 'serpent', special: 'pools', kingH: 3.6,
  },
};

// The plan (metres from the castle's middle; +z is south, towards the gate)
export const CASTLE = {
  R: 100,            // the curtain wall's line (it runs round a square 200 m a side)
  WALL_H: 18, WALL_T: 5,
  GATE: 10,          // half the gate's width
  KEEP: { x: 46, n: -88, s: 8 }, // the keep's outer walls
  HALL: 20,          // the Throne Hall's side walls (x = ±20)
  HALL_H: 30,
  GALLERY: 12, TERRACE: 24, // the wings' upper floor and roof terrace
  THRONE_Z: -81, KING_Z: -76, DAIS: { x: 14, z0: -87, z1: -68, y: 0.7 },
};
const C = CASTLE;

// Spots for the court (local x, z): the King, the Overlords along the carpet, the guards
export function courtSpots(n) {
  const overlords = [];
  for (let i = 0; i < n; i++) overlords.push([(i % 2 ? 1 : -1) * 6, -62 + Math.floor(i / 2) * 9]);
  return {
    king: [0, C.KING_Z],
    overlords,
    guards: [[-6, C.R + 9], [6, C.R + 9], [-5, 74], [5, 74], [-5, 38], [5, 38], [-7, 3], [7, 3]],
  };
}

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const MATS = new Map();
const cached = (k, make) => { if (!MATS.has(k)) MATS.set(k, make()); return MATS.get(k); };
const plain = (color, r = 0.85, m = 0) => cached(`p${color}${r}${m}`, () => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m }));
const glowing = (color, k = 1.6) => cached(`g${color}${k}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.5 }));
const water = (color) => cached(`w${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0.3, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0.85 }));

// ---------- the builder: meshes, solids and floors ----------
function maker(cx, F, cz) {
  const g = new THREE.Group();
  const solids = [], floors = [], ramps = [], lights = [];
  const add = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const B = {
    g, solids, floors, ramps, lights,
    // a box of size (w, h, d) whose bottom middle is at (x, y, z); stone boxes show laid blocks
    box(mat, x, y, z, w, h, d, ry = 0) {
      const stone = !!mat.map;
      const m = new THREE.Mesh(stone ? stoneBox(w, h, d) : UNIT, mat);
      if (!stone) m.scale.set(w, h, d);
      m.position.set(x, y + h / 2, z);
      m.rotation.y = ry;
      return add(m);
    },
    mesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      return add(m);
    },
    cyl(mat, x, y, z, r, h, seg = 16, rTop = r) { return B.mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat, x, y + h / 2, z); },
    cone(mat, x, y, z, r, h, seg = 16) { return B.mesh(new THREE.ConeGeometry(r, h, seg), mat, x, y + h / 2, z); },
    ball(mat, x, y, z, r, seg = 14) { return B.mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), mat, x, y, z); },
    // something solid: circles of radius r along a line (local coords), standing from y up h metres
    solidLine(x0, z0, x1, z1, y, h, r, yAt = null) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const step = Math.max(0.5, r * 1.1);
      const n = Math.max(1, Math.ceil(len / step));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        solids.push({ x: cx + x, z: cz + z, r, kind: 'wall', built: true, y: F + (yAt ? yAt(x, z) : y), height: h });
      }
    },
    // a solid round thing (a tower, a pillar). Big ones are a ring of circles (the collision grid
    // only looks one 8 m square around you, so one huge circle could be missed)
    solidDisc(x, z, R, y, h) {
      if (R <= 5) { solids.push({ x: cx + x, z: cz + z, r: R, kind: 'wall', built: true, y: F + y, height: h }); return; }
      const n = Math.ceil((Math.PI * 2 * (R - 1.6)) / 2.2);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; solids.push({ x: cx + x + Math.cos(a) * (R - 1.6), z: cz + z + Math.sin(a) * (R - 1.6), r: 1.6, kind: 'wall', built: true, y: F + y, height: h }); }
    },
    floor(x0, x1, z0, z1, y) { floors.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y }); },
    // a stair you walk up: from a0 (height y0) to a1 (height y1) along `axis`, drawn as steps
    stair(mat, x0, x1, z0, z1, axis, a0, a1, y0, y1, base = y0) {
      const r = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), axis, a0, a1, y0, y1 };
      ramps.push(r);
      const n = Math.ceil(Math.abs(y1 - y0) / 0.5);
      for (let i = 0; i < n; i++) {
        const s0 = a0 + ((a1 - a0) * i) / n, s1 = a0 + ((a1 - a0) * (i + 1)) / n;
        const top = y0 + ((y1 - y0) * (i + 0.5)) / n + (y1 - y0) / n / 2;
        const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
        if (axis === 'x') B.box(mat, (lo + hi) / 2, base, (r.z0 + r.z1) / 2, hi - lo, top - base, r.z1 - r.z0);
        else B.box(mat, (r.x0 + r.x1) / 2, base, (lo + hi) / 2, r.x1 - r.x0, top - base, hi - lo);
      }
      return r;
    },
    // a roof ridge: a long three-sided prism `w` wide at its foot, `h` high, `len` long along z (or x)
    prism(mat, x, y, z, w, h, len, alongX = false) {
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]), { depth: len, bevelEnabled: false });
      geo.translate(0, 0, -len / 2);
      return B.mesh(geo, mat, x, y, z, 0, alongX ? Math.PI / 2 : 0, 0);
    },
    light(x, y, z, color, power = 40, dist = 30) { const l = new GlowLight(color, power, dist, 1.5); l.position.set(x, y, z); lights.push(l); },
  };
  return B;
}

// A straight wall along x (z fixed) or along z (x fixed), from `a` to `b`, from y0 up h metres,
// t thick. gaps: [[from, to, top]] openings along it, `top` metres high (a lintel above them).
function wall(B, mat, axis, at, a, b, y0, h, t, gaps = [], { solid = true } = {}) {
  const parts = [];
  let s = Math.min(a, b);
  const e = Math.max(a, b);
  for (const [g0, g1, top] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > s) parts.push([s, g0]);
    if (top < h) parts.push([g0, g1, top]); // the lintel over the opening
    s = Math.max(s, g1);
  }
  if (s < e) parts.push([s, e]);
  for (const [p0, p1, top] of parts) {
    const lo = top === undefined ? 0 : top;
    const mid = (p0 + p1) / 2, len = p1 - p0;
    if (axis === 'x') B.box(mat, mid, y0 + lo, at, len, h - lo, t);
    else B.box(mat, at, y0 + lo, mid, t, h - lo, len);
    if (solid && top === undefined) {
      const r = Math.max(0.6, t / 2);
      if (axis === 'x') B.solidLine(p0 + r * 0.5, at, p1 - r * 0.5, at, y0, h, r);
      else B.solidLine(at, p0 + r * 0.5, at, p1 - r * 0.5, y0, h, r);
    }
  }
}

// merlons along the top of a wall
function merlons(B, mat, axis, at, a, b, y, t = 1, size = 1.4, gap = 1.4) {
  for (let s = Math.min(a, b) + size / 2; s < Math.max(a, b); s += size + gap) {
    if (axis === 'x') B.box(mat, s, y, at, size, size * 1.1, t);
    else B.box(mat, at, y, s, t, size * 1.1, size);
  }
}

// ---------- the King's own touches ----------
function towerRoof(B, T, x, y, z, r) {
  const roof = plain(T.roof, 0.7), gold = plain(T.gold, 0.35, 0.6);
  switch (T.roofStyle) {
    case 'horn': { // a dark red spire with two great horns sweeping out of it
      B.cone(roof, x, y, z, r * 1.08, r * 2.6, 12);
      const bone = plain('#e8dcc0', 0.6);
      for (const s of [-1, 1]) {
        const horn = new THREE.ConeGeometry(r * 0.32, r * 2.2, 8);
        B.mesh(horn, bone, x + s * r * 0.75, y + r * 1.4, z, 0, 0, -s * 0.75);
      }
      B.ball(glowing(T.glow, 2.2), x, y + r * 2.7, z, r * 0.18, 10);
      break;
    }
    case 'spike': { // a squat roof bristling with iron spikes and a bone on top
      B.cone(roof, x, y, z, r * 1.15, r * 1.3, 8);
      const iron = plain('#3a3430', 0.5, 0.6);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; B.mesh(new THREE.ConeGeometry(0.35, r * 0.9, 6), iron, x + Math.cos(a) * r * 1.05, y + r * 0.35, z + Math.sin(a) * r * 1.05, Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); }
      B.box(plain('#e0d6b8', 0.7), x, y + r * 1.3, z, 0.6, r * 1.1, 0.6);
      break;
    }
    case 'dome': { // an onion dome with a golden point
      B.mesh(new THREE.SphereGeometry(r * 1.02, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), roof, x, y, z);
      B.cone(gold, x, y + r * 0.95, z, r * 0.25, r * 1.1, 10);
      B.ball(gold, x, y + r * 2.1, z, r * 0.12, 8);
      break;
    }
    case 'spire': { // a needle of a spire with a glowing star on it
      B.cone(roof, x, y, z, r * 1.05, r * 4.2, 12);
      B.ball(glowing(T.glow, 2.4), x, y + r * 4.4, z, r * 0.3, 12);
      break;
    }
    case 'thatch': { // a wide reed roof with a carved pole
      B.cone(roof, x, y, z, r * 1.35, r * 1.2, 12);
      B.box(plain(T.trim), x, y + r * 0.9, z, 0.5, r * 1.1, 0.5);
      B.ball(glowing(T.glow, 1.5), x, y + r * 2.1, z, 0.6, 8);
      break;
    }
  }
}

// A great statue on a plinth, facing `ry` (0 = facing south, out towards the gate)
function statue(B, T, x, z, s = 1, ry = 0) {
  const stone = stoneWallMat(T.wall2), dark = plain(T.trim, 0.8), gold = plain(T.gold, 0.35, 0.6), eye = glowing(T.glow, 2);
  B.box(stone, x, 0, z, 5 * s, 2 * s, 5 * s);
  const y = 2 * s;
  const at = (dx, dz) => [x + Math.cos(ry) * dx + Math.sin(ry) * dz, z - Math.sin(ry) * dx + Math.cos(ry) * dz];
  switch (T.statue) {
    case 'dragon': { // a dragon sitting up, wings half spread, looking down the avenue
      const body = plain('#2a2424', 0.6, 0.2);
      const [bx, bz] = at(0, -0.6 * s);
      B.mesh(new THREE.SphereGeometry(1.7 * s, 12, 10), body, bx, y + 2.2 * s, bz).scale.set(1, 1.35, 1.1);
      const [nx, nz] = at(0, 0.6 * s);
      B.mesh(new THREE.CylinderGeometry(0.6 * s, 0.9 * s, 3.6 * s, 10), body, nx, y + 5 * s, nz, 0.45 * Math.cos(ry), 0, -0.45 * Math.sin(ry));
      const [hx, hz] = at(0, 1.9 * s);
      B.box(body, hx, y + 6.2 * s, hz, 1.3 * s, 1.1 * s, 2.4 * s, ry);
      const [jx, jz] = at(0, 2.3 * s);
      B.box(body, jx, y + 5.8 * s, jz, 1 * s, 0.4 * s, 1.8 * s, ry);
      for (const k of [-1, 1]) {
        const [ex, ez] = at(k * 0.5 * s, 2.6 * s); B.ball(eye, ex, y + 6.6 * s, ez, 0.16 * s, 6);
        const [hx2, hz2] = at(k * 0.5 * s, 1.2 * s); B.mesh(new THREE.ConeGeometry(0.22 * s, 1.8 * s, 6), plain('#e8dcc0', 0.6), hx2, y + 7.2 * s, hz2, -0.6, ry, 0);
        // the wings: thin fans of stone
        const wing = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(5.5 * s, 3.2 * s), new THREE.Vector2(6.4 * s, -0.6 * s), new THREE.Vector2(4.4 * s, -1.4 * s), new THREE.Vector2(3 * s, -2.6 * s), new THREE.Vector2(1.2 * s, -2.4 * s)]);
        const geo = new THREE.ExtrudeGeometry(wing, { depth: 0.25 * s, bevelEnabled: false });
        const [wx, wz] = at(k * 1.2 * s, -1 * s);
        const w = B.mesh(geo, plain(T.roof, 0.7), wx, y + 3.6 * s, wz);
        w.rotation.set(0, ry + (k < 0 ? Math.PI : 0) - 0.5, 0);
        // forelegs and claws
        const [lx, lz] = at(k * 0.9 * s, 0.6 * s); B.cyl(body, lx, y, lz, 0.45 * s, 2.4 * s, 8, 0.38 * s);
      }
      const [tx, tz] = at(0, -3.2 * s); B.box(body, tx, y, tz, 1 * s, 1 * s, 4.5 * s, ry);
      break;
    }
    case 'skull': { // a war totem: a pole of skulls and a great horned skull on top
      B.cyl(dark, x, y, z, 0.4 * s, 9 * s, 8);
      const bone = plain('#e4dabc', 0.7);
      for (let i = 0; i < 3; i++) B.ball(bone, x, y + (2 + i * 1.6) * s, z, 0.55 * s, 8);
      B.mesh(new THREE.SphereGeometry(1.5 * s, 12, 10), bone, x, y + 9.5 * s, z).scale.set(1, 0.9, 1.1);
      const [jx, jz] = at(0, 0.7 * s); B.box(bone, jx, y + 8.2 * s, jz, 1.6 * s, 0.6 * s, 1.2 * s, ry);
      for (const k of [-1, 1]) {
        const [ex, ez] = at(k * 0.55 * s, 1.3 * s); B.ball(eye, ex, y + 9.7 * s, ez, 0.28 * s, 6);
        B.mesh(new THREE.ConeGeometry(0.35 * s, 2.6 * s, 6), bone, x + Math.cos(ry) * k * 1.6 * s, y + 10.4 * s, z - Math.sin(ry) * k * 1.6 * s, 0, 0, -k * 0.9);
      }
      break;
    }
    case 'gel': { // a towering drop of living gel with a heart of light
      B.mesh(new THREE.SphereGeometry(2.2 * s, 16, 12), water(T.glow), x, y + 2.6 * s, z).scale.set(1, 1.3, 1);
      B.mesh(new THREE.ConeGeometry(1.6 * s, 4 * s, 16), water(T.glow), x, y + 6.4 * s, z);
      B.ball(glowing('#ffffff', 2.5), x, y + 2.8 * s, z, 0.6 * s, 10);
      break;
    }
    case 'crystal': { // a great floating crystal over a ring of stone
      B.cyl(stone, x, y, z, 1.6 * s, 1.2 * s, 12, 1.2 * s);
      const geo = new THREE.OctahedronGeometry(1.8 * s, 0);
      B.mesh(geo, glowing(T.glow, 1.4), x, y + 5 * s, z).scale.set(0.8, 2, 0.8);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; B.mesh(new THREE.OctahedronGeometry(0.5 * s, 0), glowing('#fff0c0', 1.8), x + Math.cos(a) * 2.4 * s, y + 4 * s, z + Math.sin(a) * 2.4 * s).scale.set(0.7, 1.6, 0.7); }
      break;
    }
    case 'totem': { // a carved lizard totem: stacked faces with bared teeth
      const wood = plain(T.trim, 0.85);
      for (let i = 0; i < 4; i++) {
        B.box(i % 2 ? wood : stone, x, y + i * 2.1 * s, z, 2.2 * s, 2 * s, 2.2 * s, ry);
        const [ex, ez] = at(0, 1.15 * s);
        B.box(plain('#e8e0c8', 0.7), ex, y + (i * 2.1 + 0.4) * s, ez, 1.6 * s, 0.3 * s, 0.2 * s, ry);
        for (const k of [-1, 1]) { const [qx, qz] = at(k * 0.5 * s, 1.12 * s); B.ball(eye, qx, y + (i * 2.1 + 1.4) * s, qz, 0.2 * s, 6); }
      }
      const [fx, fz] = at(0, 0); B.cone(plain(T.roof, 0.8), fx, y + 8.4 * s, fz, 1.8 * s, 2.4 * s, 4);
      break;
    }
    case 'serpent': { // a great serpent coiled on itself, its hooded head raised
      const scales = plain('#2e7a70', 0.4, 0.3);
      for (let i = 0; i < 4; i++) B.mesh(new THREE.TorusGeometry((2 - i * 0.35) * s, 0.55 * s, 8, 18), scales, x, y + (0.5 + i * 0.9) * s, z, Math.PI / 2, 0, 0);
      B.cyl(scales, x, y + 3.4 * s, z, 0.55 * s, 4.5 * s, 10, 0.5 * s);
      const [hx, hz] = at(0, 0.5 * s);
      B.mesh(new THREE.SphereGeometry(1.5 * s, 12, 8), plain(T.gold, 0.35, 0.6), hx, y + 8.2 * s, hz).scale.set(1.2, 1.1, 0.35);
      B.box(scales, hx, y + 7.8 * s, hz, 0.9 * s, 0.8 * s, 1.8 * s, ry);
      for (const k of [-1, 1]) { const [ex, ez] = at(k * 0.3 * s, 1.4 * s); B.ball(eye, ex, y + 8.3 * s, ez, 0.14 * s, 6); }
      break;
    }
  }
}

// A brazier: a stone bowl of fire with its light
function brazier(B, T, x, y, z, s = 1, lit = true) {
  B.cyl(stoneWallMat(T.wall2), x, y, z, 0.5 * s, 2.2 * s, 10, 0.4 * s);
  B.cyl(plain(T.gold, 0.4, 0.6), x, y + 2.2 * s, z, 0.5 * s, 0.6 * s, 12, 1.1 * s);
  B.cone(glowing(T.glow, 2.4), x, y + 2.7 * s, z, 0.85 * s, 1.4 * s, 10);
  if (lit) B.light(x, y + 3.6 * s, z, T.light, 60 * s, 28 * s);
}

// A banner hanging down a wall face: `face` is the direction it hangs out towards
function banner(B, T, x, y, z, w, h, faceX, faceZ) {
  const cloth = plain(T.banner, 0.95), mark = plain(T.mark, 0.6, 0.3);
  const ry = Math.atan2(faceX, faceZ);
  B.box(cloth, x + faceX * 0.15, y - h, z + faceZ * 0.15, w, h, 0.12, ry);
  // the mark: a diamond and a crown bar
  const d = B.box(mark, x + faceX * 0.25, y - h * 0.55, z + faceZ * 0.25, w * 0.42, w * 0.42, 0.06, ry);
  d.rotation.z = Math.PI / 4;
  B.box(mark, x + faceX * 0.25, y - h * 0.2, z + faceZ * 0.25, w * 0.7, h * 0.05, 0.06, ry);
  B.box(plain(T.gold, 0.4, 0.6), x + faceX * 0.2, y - 0.2, z + faceZ * 0.2, w + 0.4, 0.3, 0.3, ry);
}

// The throne, made for a King `H` metres tall (facing south, its seat's front at z)
function throne(B, T, x, y, z, H) {
  const gold = plain(T.gold, 0.3, 0.7), cloth = plain(T.carpet, 0.9), stone = stoneWallMat(T.wall2);
  const seat = H * 0.48, w = H * 1.1, d = H * 0.75;
  B.box(stone, x, y, z - d / 2, w + 1.2, 0.6, d + 1);
  B.box(gold, x, y + 0.6, z - d / 2, w, seat - 0.6, d);
  B.box(cloth, x, y + seat, z - d / 2 + 0.1, w - 0.4, 0.3, d - 0.4);
  B.box(gold, x, y + 0.6, z - d - 0.3, w, H * 2.6, 0.8); // the back, more than twice the King's height
  B.box(cloth, x, y + seat + 0.4, z - d + 0.15, w - 1, H * 1.6, 0.2);
  for (const s of [-1, 1]) {
    B.box(gold, x + s * (w / 2 + 0.3), y + 0.6, z - d / 2, 0.6, seat + H * 0.3, d + 0.4); // the arms
    B.ball(glowing(T.glow, 2), x + s * (w / 2 + 0.3), y + seat + H * 0.3 + 0.95, z - 0.2, 0.35, 10);
  }
  const top = y + 0.6 + H * 2.6;
  switch (T.statue) {
    case 'dragon': // two great horns and a pair of spread wings rising from the back
      for (const s of [-1, 1]) {
        B.mesh(new THREE.ConeGeometry(0.5, H * 1.4, 8), plain('#e8dcc0', 0.6), x + s * w * 0.42, top + H * 0.4, z - d - 0.3, 0, 0, -s * 0.45);
        const wing = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(H * 1.9, H * 1.5), new THREE.Vector2(H * 2.2, -H * 0.2), new THREE.Vector2(H * 1.3, -H * 0.7), new THREE.Vector2(H * 0.6, -H * 1.3)]);
        B.mesh(new THREE.ExtrudeGeometry(wing, { depth: 0.25, bevelEnabled: false }), plain(T.roof, 0.6), x + s * (w / 2 - 0.2), top - H * 0.8, z - d - 0.9 + (s < 0 ? 0.25 : 0), 0, s < 0 ? Math.PI : 0, 0);
      }
      break;
    case 'skull':
      B.mesh(new THREE.SphereGeometry(H * 0.55, 12, 10), plain('#e4dabc', 0.7), x, top + H * 0.3, z - d - 0.3).scale.set(1.2, 1, 0.8);
      break;
    case 'crystal': case 'gel':
      B.mesh(new THREE.OctahedronGeometry(H * 0.4, 0), glowing(T.glow, 1.6), x, top + H * 0.6, z - d - 0.3).scale.set(0.7, 1.8, 0.7);
      break;
    case 'serpent':
      B.mesh(new THREE.SphereGeometry(H * 0.9, 14, 8), gold, x, top - H * 0.2, z - d - 0.4).scale.set(1.3, 1.1, 0.25);
      break;
    default:
      B.cone(gold, x, top, z - d - 0.3, w * 0.5, H * 0.9, 4);
  }
}

// The King's wonders either side of the courtyard (local x, z: the middle of one)
function wonder(B, T, x, z) {
  const stone = stoneWallMat(T.wall2);
  switch (T.special) {
    case 'lava': { // a pool of lava in a ring of black rock, and the bones of a great dragon beside it
      B.cyl(plain('#1e1a1a', 0.95), x, 0, z, 13, 0.9, 20);
      B.cyl(glowing('#ff5a10', 2.2), x, 0.05, z, 11, 0.95, 20);
      for (let i = 0; i < 9; i++) { const a = i * 0.7; B.mesh(new THREE.DodecahedronGeometry(1.4 + (i % 3) * 0.5, 0), plain('#2a2222', 0.95), x + Math.cos(a) * 12.5, 0.6, z + Math.sin(a) * 12.5); }
      B.light(x, 4, z, '#ff6a18', 90, 40);
      const bone = plain('#e6dcc4', 0.7);
      const rx = x + Math.sign(x) * 26;
      for (let i = 0; i < 8; i++) B.mesh(new THREE.TorusGeometry(4.6 - Math.abs(i - 3.5) * 0.45, 0.35, 6, 14, Math.PI), bone, rx, 0, z - 14 + i * 3.4);
      B.mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 8), bone, rx, 4.4, z - 2, Math.PI / 2, 0, 0);
      B.mesh(new THREE.SphereGeometry(2.4, 10, 8), bone, rx, 2.2, z + 16.5).scale.set(1, 0.7, 1.6);
      break;
    }
    case 'bonfire': { // a great bonfire in a ring of standing stones, with drums and spikes
      B.cyl(plain('#2a2420', 0.95), x, 0, z, 6, 0.5, 14);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; B.mesh(new THREE.ConeGeometry(0.5, 7, 6), plain(T.trim, 0.9), x + Math.cos(a) * 3, 2.8, z + Math.sin(a) * 3, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
      B.cone(glowing('#ff8a20', 2.6), x, 0.5, z, 2.6, 6, 10);
      B.light(x, 5, z, '#ff9030', 90, 38);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; B.box(stone, x + Math.cos(a) * 13, 0, z + Math.sin(a) * 13, 1.6, 5 + (i % 3), 1.2, -a); }
      for (const s of [-1, 1]) { B.cyl(plain('#7a5030', 0.8), x + s * 8, 0, z + 8, 1.6, 2.4, 14); B.cyl(plain('#d8c8a0', 0.9), x + s * 8, 2.4, z + 8, 1.65, 0.15, 14); }
      break;
    }
    case 'gel': { // pools of glowing gel with crystals rising out of them
      for (const [dx, dz, r] of [[0, 0, 9], [10, 12, 5], [-9, -12, 6]]) {
        B.cyl(stone, x + dx, 0, z + dz, r + 1, 0.6, 18);
        B.cyl(water(T.glow), x + dx, 0.1, z + dz, r, 0.6, 18);
      }
      for (let i = 0; i < 7; i++) { const a = i * 0.9; B.mesh(new THREE.OctahedronGeometry(1.2 + (i % 3) * 0.6, 0), glowing('#9af4ff', 1.5), x + Math.cos(a) * 5, 2 + (i % 3), z + Math.sin(a) * 5).scale.set(0.6, 2.4, 0.6); }
      B.light(x, 4, z, T.light, 70, 36);
      break;
    }
    case 'glowtrees': { // a grove of glowing trees round a moon pool
      B.cyl(stone, x, 0, z, 8, 0.6, 20);
      B.cyl(water('#a8c8ff'), x, 0.1, z, 7, 0.6, 20);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, tx = x + Math.cos(a) * 14, tz = z + Math.sin(a) * 14;
        B.cyl(plain('#d8d0e8', 0.7), tx, 0, tz, 0.9, 9, 8, 0.5);
        B.mesh(new THREE.IcosahedronGeometry(4.2, 1), glowing(i % 2 ? T.glow : '#b8f0ff', 0.9), tx, 11, tz).scale.set(1, 0.8, 1);
      }
      B.ball(glowing('#f4f0ff', 2.4), x, 9, z, 1.4, 14);
      B.light(x, 8, z, T.light, 70, 40);
      break;
    }
    case 'marsh': { // a still pool of the marsh with reeds, logs and bone totems
      B.cyl(plain('#3a3a28', 0.95), x, 0, z, 13, 0.3, 18);
      B.cyl(water('#3a5a3a'), x, 0.05, z, 11.5, 0.35, 18);
      for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 8 + (i % 4); B.cyl(plain('#7a8a40', 0.9), x + Math.cos(a) * r, 0, z + Math.sin(a) * r, 0.08, 2.5 + (i % 3) * 0.6, 4); }
      for (const s of [-1, 1]) { B.cyl(plain(T.trim), x + s * 15, 0, z, 0.5, 8, 8); B.mesh(new THREE.SphereGeometry(1.2, 10, 8), plain('#e4dabc', 0.7), x + s * 15, 8.6, z).scale.set(1, 0.8, 1.4); B.ball(glowing(T.glow, 2), x + s * 15, 6, z, 0.4, 8); }
      B.light(x, 3, z, T.light, 50, 30);
      break;
    }
    case 'pools': { // long reflecting pools with serpent fountains
      B.box(stone, x, 0, z, 16, 0.6, 34);
      B.box(water('#2aa8a0'), x, 0.1, z, 14, 0.6, 32);
      for (const dz of [-12, 0, 12]) {
        B.cyl(plain(T.gold, 0.35, 0.6), x, 0.6, z + dz, 0.4, 3, 8);
        B.ball(glowing(T.glow, 2), x, 3.8, z + dz, 0.5, 10);
      }
      B.light(x, 4, z, T.light, 60, 36);
      break;
    }
  }
}

// ---------- the castle ----------
// `c` is a castle from data/kings.mjs. Gives back { group, solid, floorAt, spots, local }
export function buildKingCastle(c) {
  const T = CASTLE_THEMES[c.race] || CASTLE_THEMES.dragonewt;
  const F = c.flat, cx = c.x, cz = c.z;
  const B = maker(cx, F, cz);
  const wallM = stoneWallMat(T.wall), wall2M = stoneWallMat(T.wall2), floorM = stoneWallMat(T.floor), paveM = stoneWallMat(T.pave);
  const trimM = plain(T.trim, 0.8), goldM = plain(T.gold, 0.35, 0.6), winM = glowing(T.window, 0.9);
  const R = C.R, WT = C.WALL_T, WH = C.WALL_H;

  // the courtyard's paving (and the apron outside the gate)
  B.box(paveM, 0, -0.6, 0, 2 * R, 0.7, 2 * R);
  B.box(paveM, 0, -0.6, R + 10, 30, 0.7, 20);
  B.floor(-R, R, -R, R + 20, 0.1);
  B.box(plain(T.carpet, 0.95), 0, 0.1, 54, 10, 0.06, 92); // a long runner of the King's colour from the gate to the keep

  // ---- the curtain wall, its towers and the walk along its top ----
  const gate = [[-C.GATE, C.GATE, 14]];
  wall(B, wallM, 'x', R, -R, R, 0, WH, WT, gate);    // south, with the great gate
  wall(B, wallM, 'x', -R, -R, R, 0, WH, WT);          // north
  wall(B, wallM, 'z', R, -R, R, 0, WH, WT);           // east
  wall(B, wallM, 'z', -R, -R, R, 0, WH, WT);          // west
  // the towers along the wall (the King's spire stands where a north tower would)
  const TR = 8;
  const towers = [[-R, -R], [R, -R], [-R, R], [R, R], [-R, 0], [R, 0], [-22, R], [22, R], [-R / 2, -R], [R / 2, -R], [-R, -R / 2], [R, -R / 2], [-R, R / 2], [R, R / 2]];
  const RAMP = { x0: 36, x1: 72 }; // the stairs up the inside of the south wall, either side of the gate
  // pieces of a side's length [a, b] left between its towers (and, on the south side's inner edge, the stairs' landings)
  const between = (axis, at, cuts = []) => {
    const stops = towers.filter(([tx, tz]) => (axis === 'x' ? tz === at : tx === at)).map(([tx, tz]) => (axis === 'x' ? tx : tz));
    const holes = [...stops.map((v) => [v - TR + 0.6, v + TR - 0.6]), ...cuts].sort((p, q) => p[0] - q[0]);
    const out = [];
    let from = -R;
    for (const [h0, h1] of holes) { if (h0 > from) out.push([from, h0]); from = Math.max(from, h1); }
    if (from < R) out.push([from, R]);
    return out;
  };
  const top = WH, o = WT / 2 - 0.5;
  for (const [axis, at, sgn] of [['x', R, 1], ['x', -R, -1], ['z', R, 1], ['z', -R, -1]]) {
    const outer = at + sgn * (WT / 2 - 0.4), inner = at - sgn * (WT / 2 - 0.4);
    const landings = axis === 'x' && sgn > 0 ? [[-RAMP.x1 - 4, -RAMP.x1 + 6], [RAMP.x1 - 6, RAMP.x1 + 4]] : [];
    // a dark band of trim outside; the walk along the top; merlons on its outer edge and a low wall on
    // its inner edge, which (with the towers' merlons) stop you falling, except where the stairs come up
    if (axis === 'x') { B.box(trimM, 0, top - 1.2, at + sgn * (WT / 2 + 0.1), 2 * R, 0.8, 0.3); B.floor(-R, R, at - WT / 2, at + WT / 2, top); }
    else { B.box(trimM, at + sgn * (WT / 2 + 0.1), top - 1.2, 0, 0.3, 0.8, 2 * R); B.floor(at - WT / 2, at + WT / 2, -R, R, top); }
    for (const [p0, p1] of between(axis, at)) {
      if (axis === 'x') { merlons(B, wall2M, 'x', at + sgn * o, p0, p1, top); B.solidLine(p0, outer, p1, outer, top, 1.6, 0.5); }
      else { merlons(B, wall2M, 'z', at + sgn * o, p0, p1, top); B.solidLine(outer, p0, outer, p1, top, 1.6, 0.5); }
    }
    for (const [p0, p1] of between(axis, at, landings)) {
      if (axis === 'x') { B.box(wall2M, (p0 + p1) / 2, top, at - sgn * o, p1 - p0, 1.1, 1); B.solidLine(p0, inner, p1, inner, top, 1.2, 0.5); }
      else { B.box(wall2M, at - sgn * o, top, (p0 + p1) / 2, 1, 1.1, p1 - p0); B.solidLine(inner, p0, inner, p1, top, 1.2, 0.5); }
    }
  }
  // the gate: a portcullis drawn up, its arch picked out in trim, and the castle's name above
  B.box(trimM, 0, 14, R + WT / 2 + 0.2, 2 * C.GATE + 2, 1.2, 0.5);
  for (let i = -4; i <= 4; i++) B.box(plain('#2e2c2a', 0.5, 0.7), i * 2.2, 11.5, R, 0.25, 2.6, 0.25);
  const name = new THREE.Mesh(new THREE.PlaneGeometry(24, 4.5), new THREE.MeshBasicMaterial({ map: textTexture(c.castle), transparent: true }));
  name.position.set(0, 15.6, R + WT / 2 + 0.45);
  name.userData.moves = true; // (kept apart from the merged stone, with its own texture)
  B.g.add(name);
  // the stairs up to the walk: one each side of the gate, against the inside of the south wall
  for (const s of [-1, 1]) {
    const z0 = R - WT / 2 - 6.5, z1 = R - WT / 2;
    const x2 = RAMP.x1 - 5; // (a landing at the top, level with the walk, to step across onto it)
    B.stair(wall2M, s * RAMP.x0, s * x2, z0, z1, 'x', s * RAMP.x0, s * x2, 0.1, WH, 0);
    B.box(wall2M, s * (x2 + RAMP.x1) / 2, 0, (z0 + z1) / 2, RAMP.x1 - x2, WH, z1 - z0);
    B.floor(s * x2, s * RAMP.x1, z0, z1, WH);
    // a low wall along its open side
    B.solidLine(s * RAMP.x0, z0 + 0.3, s * x2, z0 + 0.3, 0, 1.2, 0.35, (x) => (Math.abs(x) - RAMP.x0) / (x2 - RAMP.x0) * WH);
    B.solidLine(s * x2, z0 + 0.3, s * RAMP.x1, z0 + 0.3, WH, 1.2, 0.35);
    B.solidLine(s * (RAMP.x1 + 0.3), z0 + 0.3, s * (RAMP.x1 + 0.3), z1 - 0.5, WH, 1.2, 0.35);
    B.box(goldM, s * (x2 + RAMP.x1) / 2, WH, z0 + 0.3, RAMP.x1 - x2, 1.1, 0.3);
  }
  // the towers: round drums as high as the wall, a ring of merlons round their tops (open where the
  // walk comes in), and a turret rising from each with the King's own roof
  for (const [tx, tz] of towers) {
    B.cyl(wallM, tx, 0, tz, TR, WH + 0.2, 20, TR - 0.4);
    B.solidDisc(tx, tz, TR, 0, WH);
    B.floor(tx - TR, tx + TR, tz - TR, tz + TR, top);
    // which ways the walk goes on from it
    const ways = [];
    if (Math.abs(tz) === R && tx < R) ways.push(0);
    if (Math.abs(tz) === R && tx > -R) ways.push(Math.PI);
    if (Math.abs(tx) === R && tz < R) ways.push(Math.PI / 2);
    if (Math.abs(tx) === R && tz > -R) ways.push(-Math.PI / 2);
    // (a point on the ring is where the walk comes in if it lies within the walk's width of a wall line)
    const RR = TR - 0.6, band = WT / 2 - 0.4;
    const open = (a) => ways.some((w) => Math.cos(a - w) > 0 && Math.abs(Math.sin(a - w)) * RR < band + 0.1);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      if (ways.some((w) => Math.cos(a - w) > 0 && Math.abs(Math.sin(a - w)) * RR < band + 0.8)) continue;
      B.box(wall2M, tx + Math.cos(a) * RR, top, tz + Math.sin(a) * RR, 1.3, 1.6, 0.9, -a + Math.PI / 2);
    }
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      if (!open(a)) B.solids.push({ x: cx + tx + Math.cos(a) * RR, z: cz + tz + Math.sin(a) * RR, r: 0.5, kind: 'wall', built: true, y: F + top, height: 1.6 });
    }
    // the turret in the middle (you walk round it)
    const TT = 3.6, TH = 14;
    B.cyl(wall2M, tx, top, tz, TT, TH, 14);
    B.solidDisc(tx, tz, TT, top, TH + 6);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; B.box(winM, tx + Math.cos(a) * (TT + 0.02), top + 8, tz + Math.sin(a) * (TT + 0.02), 0.7, 2.4, 0.2, -a + Math.PI / 2); }
    B.cyl(trimM, tx, top + TH, tz, TT + 0.6, 0.8, 14);
    towerRoof(B, T, tx, top + TH + 0.8, tz, TT + 0.4);
  }
  // banners down the outside of the walls, either side of the gate and along each side
  for (const bx of [-14.5, 14.5]) banner(B, T, bx, WH - 1, R + WT / 2, 4, 10, 0, 1);
  for (const s of [-60, -36, 36, 60]) banner(B, T, s, WH - 1, R + WT / 2, 4, 9, 0, 1);
  for (const s of [-70, -30, 30, 70]) { banner(B, T, R + WT / 2, WH - 1, s, 4, 9, 1, 0); banner(B, T, -R - WT / 2, WH - 1, s, 4, 9, -1, 0); }
  // statues and braziers at the gate, outside
  statue(B, T, -24, R + 16, 1.6, 0); statue(B, T, 24, R + 16, 1.6, 0);
  B.solidDisc(-24, R + 16, 4, 0, 12); B.solidDisc(24, R + 16, 4, 0, 12);
  brazier(B, T, -12, 0, R + 6, 1.2); brazier(B, T, 12, 0, R + 6, 1.2);

  // ---- the courtyard: an avenue of statues and braziers, the wonders, and two great halls ----
  for (const z of [80, 56, 32]) {
    for (const s of [-1, 1]) { statue(B, T, s * 14, z, 1, s * Math.PI / 2); B.solidDisc(s * 14, z, 3.2, 0, 10); }
  }
  for (const z of [92, 68, 44, 20]) for (const s of [-1, 1]) { brazier(B, T, s * 9, 0, z, 1, z === 92 || z === 20); B.solidDisc(s * 9, z, 0.6, 0, 3); }
  wonder(B, T, -40, 50); wonder(B, T, 40, 50);
  for (const s of [-1, 1]) {
    // a great hall along each side wall (barracks and armoury): solid, with tall windows and a roof
    const hx = s * 80, hw = 26, hd = 62, hz = 40, hh = 14;
    wall(B, wall2M, 'z', hx - s * hw / 2, hz - hd / 2, hz + hd / 2, 0, hh, 1.4);
    wall(B, wall2M, 'x', hz - hd / 2, hx - hw / 2, hx + hw / 2, 0, hh, 1.4);
    wall(B, wall2M, 'x', hz + hd / 2, hx - hw / 2, hx + hw / 2, 0, hh, 1.4);
    B.box(trimM, hx, hh, hz, hw + 1, 0.8, hd + 1);
    B.prism(plain(T.roof, 0.7), hx, hh + 0.8, hz, hw + 3, 10, hd + 3);
    for (let z = hz - hd / 2 + 6; z < hz + hd / 2 - 3; z += 8) B.box(winM, hx - s * (hw / 2 + 0.75), 4, z, 0.2, 6, 2);
    banner(B, T, hx - s * (hw / 2 + 0.7), hh - 0.5, hz, 3.5, 7, -s, 0);
  }

  // ---- the keep ----
  const K = C.KEEP, H = C.HALL, HH = C.HALL_H, GL = C.GALLERY, TE = C.TERRACE;
  const KH = TE + 1.6; // the wings' outer walls rise to the terrace's parapet
  // the Throne Hall's front, with the great doors; the wings' fronts each with a door of their own
  wall(B, wallM, 'x', K.s, -H, H, 0, HH, 2.4, [[-8, 8, 18]]);
  for (const s of [-1, 1]) {
    const lo = Math.min(s * H, s * K.x), hi = Math.max(s * H, s * K.x);
    wall(B, wallM, 'x', K.s, lo, hi, 0, KH, 2, [[s > 0 ? 29 : -37, s > 0 ? 37 : -29, 9]]);
    wall(B, wallM, 'x', K.n, lo, hi, 0, KH, 2);
    wall(B, wallM, 'z', s * K.x, K.n, K.s, 0, KH, 2);
  }
  wall(B, wallM, 'x', K.n, -H, H, 0, HH, 2.4);
  // the Throne Hall's side walls: doors into the wings below, balconies from the galleries above
  for (const s of [-1, 1]) {
    wall(B, wallM, 'z', s * H, K.n, K.s, 0, GL, 2, [[-16, -6, 10], [-76, -64, 10]]);
    wall(B, wallM, 'z', s * H, K.n, K.s, GL, TE - GL - 1, 2, [[-84, -64, 9], [-22, -4, 9]]);
    wall(B, wallM, 'z', s * H, K.n, K.s, TE - 1, HH - TE + 1, 2);
    for (const [a, b2] of [[-84, -64], [-22, -4]]) {
      // the balcony: a ledge out over the hall with a golden rail
      B.box(trimM, s * (H - 0.7), GL - 0.6, (a + b2) / 2, 3.4, 0.6, b2 - a);
      B.floor(s * (H - 2.4), s * (H + 1), a, b2, GL);
      B.box(goldM, s * (H - 2.2), GL, (a + b2) / 2, 0.3, 1.2, b2 - a);
      B.solidLine(s * (H - 2.2), a, s * (H - 2.2), b2, GL, 1.2, 0.4);
    }
  }
  // the keep's floors: the Throne Hall and the wings' ground floor are the courtyard's level
  B.box(floorM, 0, -0.6, (K.n + K.s) / 2, 2 * K.x, 0.75, K.s - K.n);
  B.floor(-K.x, K.x, K.n, K.s, 0.15);
  // windows down the outside of the keep
  for (const s of [-1, 1]) {
    for (let z = K.n + 8; z < K.s - 4; z += 10) { B.box(winM, s * (K.x + 1.05), 3.5, z, 0.2, 5, 2); B.box(winM, s * (K.x + 1.05), 15, z, 0.2, 5, 2); }
    for (const x of [s * 25, s * 41]) { B.box(winM, x, 15, K.s + 1.05, 2, 5, 0.2); B.box(winM, x, 15, K.n - 1.05, 2, 5, 0.2); }
  }
  // the Throne Hall's high clerestory windows and its great roof
  for (let z = K.n + 6; z < K.s - 4; z += 9) for (const s of [-1, 1]) B.box(winM, s * (H + 1.05), TE + 1, z, 0.2, 3.6, 2.4);
  B.box(wall2M, 0, HH, (K.n + K.s) / 2, 2 * H + 3, 1, K.s - K.n + 3);
  B.prism(plain(T.roof, 0.7), 0, HH + 1, (K.n + K.s) / 2, 2 * H + 5, 15, K.s - K.n + 4);
  // the King's spire behind the Throne Hall, and towers at the keep's four corners
  B.cyl(wall2M, 0, 0, K.n - 2, 6, 52, 18);
  B.solidDisc(0, K.n - 2, 6, 0, 52);
  B.cyl(trimM, 0, 52, K.n - 2, 6.6, 1, 18);
  towerRoof(B, T, 0, 53, K.n - 2, 6.2);
  for (const [tx, tz] of [[-K.x, K.s], [K.x, K.s], [-K.x, K.n], [K.x, K.n]]) {
    B.cyl(wallM, tx, 0, tz, 5.5, 38, 16);
    B.solidDisc(tx, tz, 5.5, 0, 38);
    for (const y of [12, 22, 31]) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; B.box(winM, tx + Math.cos(a) * 5.52, y, tz + Math.sin(a) * 5.52, 0.9, 2.6, 0.2, -a + Math.PI / 2); }
    B.cyl(trimM, tx, 38, tz, 6.1, 0.9, 16);
    towerRoof(B, T, tx, 38.9, tz, 5.8);
  }
  // the front: the great doors standing open, banners and braziers
  for (const s of [-1, 1]) {
    const leaf = B.box(plain(T.trim, 0.7, 0.2), s * 11.5, 0, K.s + 3.6, 7.6, 17.5, 0.6);
    leaf.rotation.y = s * 1.2;
    B.box(goldM, s * 8.6, 0, K.s + 1.3, 0.8, 18, 0.8);
    banner(B, T, s * 13.5, HH - 2, K.s + 1.2, 4.5, 12, 0, 1);
    brazier(B, T, s * 12, 0, K.s + 8, 1.3);
  }
  B.box(goldM, 0, 18, K.s + 1.3, 18, 1.2, 0.8);

  // ---- inside the Throne Hall ----
  // the long carpet, the pillars, the banners between them, braziers and the King's wonders
  B.box(plain(T.carpet, 0.95), 0, 0.15, (C.DAIS.z1 + K.s) / 2, 9, 0.06, K.s - C.DAIS.z1);
  B.box(goldM, -4.7, 0.15, (C.DAIS.z1 + K.s) / 2, 0.4, 0.07, K.s - C.DAIS.z1);
  B.box(goldM, 4.7, 0.15, (C.DAIS.z1 + K.s) / 2, 0.4, 0.07, K.s - C.DAIS.z1);
  for (let z = -78; z <= 0; z += 12) {
    for (const s of [-1, 1]) {
      B.cyl(wall2M, s * 11.5, 0, z, 1.7, 1.4, 12, 2.2);
      B.cyl(wallM, s * 11.5, 1.4, z, 1.5, HH - 3.4, 14);
      B.cyl(goldM, s * 11.5, HH - 2, z, 2.4, 2, 14, 1.5);
      B.cyl(goldM, s * 11.5, 6, z, 1.55, 0.4, 14);
      B.solidDisc(s * 11.5, z, 1.7, 0, HH);
      if (z > -78) banner(B, T, s * (H - 1.05), GL - 1.5, z + 6, 3, 8, -s, 0);
    }
  }
  if (T.special === 'lava') {
    // channels of lava down both sides of the hall, under grates
    for (const s of [-1, 1]) { B.box(plain('#1a1414', 0.95), s * 16, 0.1, -36, 3.2, 0.2, 80); B.box(glowing('#ff5a10', 2.2), s * 16, 0.12, -36, 2.2, 0.2, 78); }
  } else if (T.special === 'pools' || T.special === 'gel' || T.special === 'glowtrees') {
    for (const s of [-1, 1]) { B.box(wall2M, s * 16, 0.1, -36, 4, 0.3, 70); B.box(water(T.special === 'gel' ? T.glow : '#2aa8a0'), s * 16, 0.15, -36, 3.2, 0.3, 68); }
  }
  for (const z of [-57.5, -36, -14]) for (const s of [-1, 1]) brazier(B, T, s * 8.5, 0.15, z, 1.1, z !== -36);
  // great rings of fire hanging from the roof on chains
  for (const z of [-62, -38, -14]) {
    B.box(plain('#2e2c2a', 0.5, 0.7), 0, 19, z, 0.25, HH - 19, 0.25);
    B.mesh(new THREE.TorusGeometry(3.4, 0.25, 6, 20), goldM, 0, 19, z, Math.PI / 2, 0, 0);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; B.cone(glowing(T.glow, 2.4), Math.cos(a) * 3.4, 19.1, z + Math.sin(a) * 3.4, 0.3, 0.8, 6); }
    B.light(0, 18, z, T.light, 160, 55);
  }
  // the dais and the throne, made for the King
  const D = C.DAIS;
  B.box(wall2M, 0, 0, (D.z0 + D.z1) / 2, 2 * D.x, D.y, D.z1 - D.z0);
  B.box(goldM, 0, D.y - 0.1, D.z1 + 0.05, 2 * D.x, 0.12, 0.3);
  B.box(plain(T.carpet, 0.95), 0, D.y, (D.z0 + D.z1) / 2 + 2, 9, 0.06, D.z1 - D.z0 - 4);
  B.floor(-D.x, D.x, D.z0, D.z1, D.y);
  throne(B, T, 0, D.y, C.THRONE_Z + 3, T.kingH);
  for (const s of [-1, 1]) { brazier(B, T, s * 10, 0.15, D.z1 + 3.5, 1.5); statue(B, T, s * 10, D.z0 + 5, 1.2, 0); }
  B.solidDisc(0, C.THRONE_Z, 2, D.y, 4);
  // the King's great banner on the wall behind the throne
  banner(B, T, 0, HH - 3, K.n + 1.25, 12, 20, 0, 1);

  // ---- the wings: three big rooms below, a gallery above, a roof terrace on top ----
  for (const s of [-1, 1]) {
    const X = (v) => s * v;
    // ground-floor rooms (to the south, the middle with the stair, the north) with wide doorways
    for (const zw of [-56, -26]) wall(B, wall2M, 'x', zw, X(H + 1), X(K.x - 1), 0, GL - 0.6, 1.2, [[Math.min(X(29), X(37)), Math.max(X(29), X(37)), 9]]);
    // the gallery's floor and the terrace above, each with an open stairwell
    const slab = (y, x0, x1, z0, z1) => { B.box(floorM, X((x0 + x1) / 2), y - 0.6, (z0 + z1) / 2, Math.abs(x1 - x0), 0.6, Math.abs(z1 - z0)); B.floor(X(x0), X(x1), z0, z1, y); };
    // gallery (y 12): the stairwell from below is at |x| 39..45, z -55..-30
    slab(GL, H + 1, 39, K.n + 1, K.s - 1);
    slab(GL, 39, K.x - 1, K.n + 1, -55);
    slab(GL, 39, K.x - 1, -30, K.s - 1);
    // terrace (y 24): the stairwell from the gallery is at |x| 21..27, z -55..-29
    slab(TE, 27, K.x - 1, K.n + 1, K.s - 1);
    slab(TE, H + 1, 27, K.n + 1, -55);
    slab(TE, H + 1, 27, -29, K.s - 1);
    // the stairs: ground -> gallery along the outer wall, gallery -> terrace along the hall wall
    B.stair(wall2M, X(39.2), X(44.8), -31, -55, 'z', -31, -55, 0.15, GL, 0);
    B.stair(wall2M, X(21.2), X(26.8), -31, -55, 'z', -31, -55, GL, TE, GL);
    // rails round the stairwells (so you don't walk off the edge above them)
    B.solidLine(X(38.8), -55, X(38.8), -30, GL, 1.2, 0.35); B.box(goldM, X(38.8), GL, -42.5, 0.3, 1.1, 25);
    B.solidLine(X(39), -30, X(45), -30, GL, 1.2, 0.35); B.box(goldM, X(42), GL, -30, 6, 1.1, 0.3);
    B.solidLine(X(27.2), -55, X(27.2), -29, TE, 1.2, 0.35); B.box(goldM, X(27.2), TE, -42, 0.3, 1.1, 26);
    B.solidLine(X(21), -29, X(27), -29, TE, 1.2, 0.35); B.box(goldM, X(24), TE, -29, 6, 1.1, 0.3);
    // a low wall along each stair's open side
    B.solidLine(X(38.9), -31, X(38.9), -55, 0, 1.2, 0.3, (x, z) => (Math.abs(z) - 31) / 24 * GL);
    B.solidLine(X(27.1), -31, X(27.1), -55, GL, 1.2, 0.3, (x, z) => GL + (Math.abs(z) - 31) / 24 * (TE - GL));
    // the terrace's parapet (the outer walls rise past it) and merlons on top
    merlons(B, wall2M, 'z', X(K.x), K.n, K.s, KH, 2);
    merlons(B, wall2M, 'x', K.s, X(H), X(K.x), KH, 2);
    merlons(B, wall2M, 'x', K.n, X(H), X(K.x), KH, 2);
    // things in the rooms: long tables, chests and racks (the court's hall, the treasury, the armoury)
    const wood = plain(T.trim, 0.8);
    for (const z of [-14, -1]) { B.box(wood, X(41), 0.15, z - 4, 3.6, 1.3, 10); B.solidLine(X(41), z - 8, X(41), z, 0.15, 1.4, 1.8); }
    for (let i = 0; i < 6; i++) { B.box(goldM, X(24 + (i % 3) * 5), 0.15, -84 + Math.floor(i / 3) * 4, 2.4, 1.6, 1.6); B.solids.push({ x: cx + X(24 + (i % 3) * 5), z: cz - 84 + Math.floor(i / 3) * 4, r: 1.2, kind: 'wall', built: true, y: F, height: 1.7 }); }
    for (let z = -80; z <= -62; z += 6) B.box(wood, X(43.5), 0.15, z, 1, 5, 4);
    brazier(B, T, X(33), 0.15, -40, 0.9, false); brazier(B, T, X(33), 0.15, -70, 0.9);
    brazier(B, T, X(33), GL, -10, 1, true); brazier(B, T, X(33), GL, -76, 1, false);
    // the gallery's banners and long rugs
    B.box(plain(T.carpet, 0.95), X(31), GL, -40, 6, 0.05, 70);
  }

  // ---- merge it, and gather the lights ----
  mergeStill(B.g, { cell: 120 });
  for (const l of B.lights) B.g.add(l);
  B.g.position.set(cx, F, cz);

  // the highest floor at (x, z) you could step up onto, if it is no higher than `reach` (world y)
  const floors = B.floors, ramps = B.ramps, edge = R + 22;
  function floorAt(x, z, reach) {
    const lx = x - cx, lz = z - cz;
    if (lx < -edge || lx > edge || lz < -edge || lz > edge) return -Infinity;
    const lim = reach - F;
    let best = -Infinity;
    for (const f of floors) if (lx >= f.x0 && lx <= f.x1 && lz >= f.z0 && lz <= f.z1 && f.y <= lim && f.y > best) best = f.y;
    for (const r of ramps) {
      if (lx < r.x0 || lx > r.x1 || lz < r.z0 || lz > r.z1) continue;
      const t = Math.min(1, Math.max(0, ((r.axis === 'x' ? lx : lz) - r.a0) / (r.a1 - r.a0)));
      const y = r.y0 + (r.y1 - r.y0) * t;
      if (y <= lim && y > best) best = y;
    }
    return best === -Infinity ? best : F + best;
  }
  const spots = courtSpots(5);
  return { group: B.g, solid: B.solids, floorAt, spots, local: (x, z) => [cx + x, cz + z], theme: T };
}

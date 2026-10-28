// The insides of the town buildings you can walk into. Each is built far off the map (like the
// caves, see depths.js) and answers for the ground while you're in it. What's inside depends on
// the building: the Main Guild Hall has a counter, tables and chairs, and stairs up to meeting
// rooms; a smithy has its anvil and forge; the potion shop its shelves of bottles; and so on.
import * as THREE from 'three';
import { DEPTHS_X } from '../data/world-layout.mjs';
import { MEETING_ROOMS } from '../data/interiors.mjs';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { textTexture } from './spawn.js';

// where the insides are laid out: past the caves, one at a time
const OX = DEPTHS_X + 150000, OZ = 0;
const UP = 4.5; // the Guild Hall's upper floor
const SEAT_H = 0.48;

// [width, depth, ceiling] of each kind of room (the Guild Hall's ground floor)
const SIZES = { guild: [24, 20, 9], tavern: [16, 13, 5], potions: [11, 9, 4.5], smith: [13, 11, 5], armoury: [13, 10, 5], tailor: [11, 9, 4.5], food: [15, 11, 4.5] };
export const kindOf = (shopId) => ({ guild: 'guild', tavern: 'tavern', city_potions: 'potions', city_smith: 'smith', city_armoury: 'armoury', city_tailor: 'tailor', city_food: 'food' }[shopId] || 'tavern');

export function buildInterior(shop) {
  const kind = kindOf(shop.id);
  const [W, D, H] = SIZES[kind];
  const g = new THREE.Group();
  g.position.set(OX, 0, OZ);
  const solid = [];
  const seats = [];
  const lights = [];
  const people = [];
  const rooms = [];
  const mats = [];
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }); mats.push(m); return m; };
  const box = (w, h, d, m, x, y, z, ry = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y + h / 2, z); o.rotation.y = ry;
    o.castShadow = true; o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const cyl = (r1, r2, h, m, x, y, z, n = 16) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, n), m);
    o.position.set(x, y + h / 2, z);
    o.castShadow = true; o.receiveShadow = true;
    g.add(o);
    return o;
  };
  // something solid at a spot inside (local coordinates)
  const block = (x, z, r, y = 0, height = 3) => solid.push({ x: OX + x, z: OZ + z, r, y, kind: 'wall', height });

  const wood = mat('#6b4a2e'), darkWood = mat('#3f2a1a'), plaster = mat(kind === 'smith' ? '#7a7068' : '#d8ccb0'), floorMat = mat(kind === 'smith' ? '#5a5652' : '#8a6440');
  const stone = mat('#8f8676'), cloth = mat('#7a2a24'), brass = mat('#c8a040', { metalness: 0.8, roughness: 0.35 });

  // a wall from (x0, z0) to (x1, z1) at floor y, with gaps [from, to, floor of the gap] measured along it
  function wall(x0, z0, x1, z1, y, h, gaps = []) {
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len;
    const cuts = [[0, 0], ...gaps.sort((a, b) => a[0] - b[0]), [len, len]];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i][1], b = cuts[i + 1][0];
      if (b - a < 0.05) continue;
      const m = (a + b) / 2;
      box(b - a, h, 0.3, plaster, x0 + ux * m, y, z0 + uz * m, Math.atan2(-uz, ux));
      for (let s = a + 0.3; s < b; s += 0.8) block(x0 + ux * s, z0 + uz * s, 0.45, y, h);
    }
    // a lintel over each gap
    for (const [a, b, base = 0] of gaps) {
      const top = base + 2.6;
      if (h - top > 0.2) box(b - a, h - top, 0.3, plaster, x0 + ux * (a + b) / 2, y + top, z0 + uz * (a + b) / 2, Math.atan2(-uz, ux));
      if (base > 0) box(b - a, base, 0.3, plaster, x0 + ux * (a + b) / 2, y, z0 + uz * (a + b) / 2, Math.atan2(-uz, ux));
    }
  }
  function floor(x0, x1, z0, z1, y, m = floorMat) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
    f.rotation.x = -Math.PI / 2;
    f.position.set((x0 + x1) / 2, y + 0.01, (z0 + z1) / 2);
    f.receiveShadow = true;
    g.add(f);
  }
  function ceiling(x0, x1, z0, z1, y) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat('#4a3a2a'));
    c.rotation.x = Math.PI / 2;
    c.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    g.add(c);
    for (let x = x0 + 2; x < x1; x += 3) box(0.3, 0.35, z1 - z0, darkWood, x, y - 0.35, (z0 + z1) / 2);
  }
  function lamp(x, y, z, power = 18) {
    const l = new THREE.PointLight('#ffc878', power, 18, 1.4);
    l.position.set(x, y, z);
    g.add(l);
    lights.push(l);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat('#ffe0a0', { emissive: '#ffb050', emissiveIntensity: 2 }));
    glow.position.set(x, y, z);
    g.add(glow);
  }
  // a chandelier of candles hanging from the beams
  function chandelier(x, y, z) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 24), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, z);
    g.add(ring);
    box(0.04, 1.2, 0.04, brass, x, y, z);
    lamp(x, y - 0.2, z, 28);
  }
  function table(x, z, y = 0, r = 0.8, chairs = 4) {
    cyl(r, r, 0.08, wood, x, y + 0.72, z, 20);
    cyl(0.1, 0.18, 0.72, darkWood, x, y, z, 8);
    block(x, z, r * 0.8, y, 1);
    for (let i = 0; i < chairs; i++) {
      const a = (i / chairs) * Math.PI * 2 + Math.PI / 4;
      chair(x + Math.sin(a) * (r + 0.55), z + Math.cos(a) * (r + 0.55), y, a + Math.PI);
    }
  }
  function chair(x, z, y, facing) {
    const c = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), wood);
    seat.position.y = SEAT_H;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), wood);
    back.position.set(0, SEAT_H + 0.3, -0.24);
    c.add(seat, back);
    for (const [lx, lz] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, SEAT_H, 0.05), darkWood);
      leg.position.set(lx, SEAT_H / 2, lz);
      c.add(leg);
    }
    c.position.set(x, y, z);
    c.rotation.y = facing;
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(c);
    seats.push({ x: OX + x, z: OZ + z, y, heading: facing });
  }
  // the counter where the keeper stands, and the keeper
  let counter = null;
  function counterAt(x, z, w, label) {
    box(w, 1.05, 0.9, wood, x, 0, z);
    box(w + 0.2, 0.08, 1.05, darkWood, x, 1.05, z);
    for (let s = -w / 2 + 0.4; s <= w / 2; s += 0.8) block(x + s, z, 0.5, 0, 1.2);
    const races = ['dwarf', 'elf', 'hobbit', 'beastkin'];
    const keeper = buildCharacter({ race: races[(shop.name || '').length % races.length], form: 'humanoid', look: {} });
    keeper.position.set(x, 0, z + 1.1);
    keeper.rotation.y = Math.PI;
    g.add(keeper);
    people.push(keeper);
    // the sign on the wall behind
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W - 2, 7), 1), new THREE.MeshBasicMaterial({ map: textTexture(label), transparent: true }));
    sign.position.set(x, 3.1, D - 0.2);
    sign.rotation.y = Math.PI;
    g.add(sign);
    counter = { x: OX + x, z: OZ + z - 0.9, y: 0 };
  }
  function shelf(x, z, ry, colors) {
    const s = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.5), darkWood);
    frame.position.y = 1.3;
    s.add(frame);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 7; i++) {
        const c = colors[(i + row) % colors.length];
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.28, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.3 }));
        b.position.set(-1 + i * 0.33, 0.55 + row * 0.8, 0.3);
        s.add(b);
      }
    }
    s.position.set(x, 0, z);
    s.rotation.y = ry;
    g.add(s);
    block(x, z, 1.1, 0, 2.6);
  }
  function stand(x, z, color, metal) {
    cyl(0.25, 0.3, 0.1, darkWood, x, 0, z, 10);
    cyl(0.05, 0.05, 1.3, darkWood, x, 0.1, z, 6);
    const torso = box(0.6, 0.75, 0.35, mat(color, metal ? { metalness: 0.8, roughness: 0.35 } : {}), x, 1.1, z);
    torso.rotation.y = Math.PI;
    box(0.3, 0.3, 0.3, mat(color, metal ? { metalness: 0.8, roughness: 0.35 } : {}), x, 1.9, z);
    block(x, z, 0.45, 0, 2);
  }
  function rack(x, z, colors) {
    box(2.2, 0.05, 0.05, brass, x, 1.7, z);
    for (const sx of [-1.05, 1.05]) box(0.05, 1.75, 0.05, brass, x + sx, 0, z);
    colors.forEach((c, i) => box(0.5, 0.9, 0.12, mat(c), x - 0.8 + i * 0.53, 0.75, z));
    block(x - 0.6, z, 0.45, 0, 2); block(x + 0.6, z, 0.45, 0, 2);
  }
  function barrel(x, z) { cyl(0.42, 0.42, 1, wood, x, 0, z, 14); block(x, z, 0.45, 0, 1); }
  function hearth(x, z) {
    box(2.4, 1.6, 0.9, stone, x, 0, z);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 8), mat('#ff8a2a', { emissive: '#ff6a10', emissiveIntensity: 2.5 }));
    fire.position.set(x, 0.55, z - 0.35);
    g.add(fire);
    const l = new THREE.PointLight('#ff8a40', 14, 10, 1.6);
    l.position.set(x, 1, z - 1);
    g.add(l);
    lights.push(l);
    block(x - 0.8, z, 0.7, 0, 1.6); block(x + 0.8, z, 0.7, 0, 1.6);
  }

  // ---------- the ground floor: walls, floor, ceiling and the door you came in by ----------
  floor(-W / 2, W / 2, 0, D, 0);
  wall(-W / 2, 0, W / 2, 0, 0, H, [[W / 2 - 1, W / 2 + 1]]); // front, with the door
  wall(-W / 2, 0, -W / 2, D, 0, H);
  wall(W / 2, 0, W / 2, D, 0, H);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.6), new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: '#ffe6a8', emissiveIntensity: 1.2 }));
  door.position.set(0, 1.3, 0.05);
  g.add(door);
  const exit = { x: OX, z: OZ + 0.4 };
  const start = { x: OX, z: OZ + 3.6, heading: 0 };

  let ramp = null;
  if (kind === 'guild') {
    // back wall with an opening at the top of the stairs (right side)
    wall(-W / 2, D, W / 2, D, 0, H, [[W - 3.6, W - 0.4, UP]]);
    ceiling(-W / 2, W / 2, 0, D, H);
    // the counter at the back, the guild board beside it
    counterAt(-3, D - 3, 7, 'Main Guild Hall');
    const board = box(3.2, 2, 0.12, mat('#7a5a34'), -9, 1, D - 0.3);
    for (let i = 0; i < 6; i++) box(0.6, 0.45, 0.02, mat('#efe2c0'), -10.2 + (i % 3) * 1.1, 1.5 + Math.floor(i / 2) * 0, D - 0.38);
    board.receiveShadow = true;
    // tables with chairs round them
    for (const [x, z] of [[-7, 5], [-7, 10.5], [0, 7.5], [5, 4.5]]) table(x, z);
    // the stairs up along the right wall: from z = 7 at the floor to z = D at the upper floor
    ramp = { x0: W / 2 - 3.6, x1: W / 2 - 0.4, z0: 7, z1: D };
    const steps = 15;
    for (let i = 0; i < steps; i++) {
      const z = ramp.z0 + ((ramp.z1 - ramp.z0) * (i + 0.5)) / steps;
      box(ramp.x1 - ramp.x0, ((i + 1) / steps) * UP, (ramp.z1 - ramp.z0) / steps, wood, (ramp.x0 + ramp.x1) / 2, 0, z);
    }
    // a rail on the open side of the stairs
    for (let z = ramp.z0 + 0.6; z < ramp.z1; z += 0.8) block(ramp.x0 - 0.25, z, 0.4, 0, 6);
    box(0.08, 1, ramp.z1 - ramp.z0, darkWood, ramp.x0 - 0.1, UP * 0.5, (ramp.z0 + ramp.z1) / 2);

    // ---------- upstairs: a hallway along the front and four meeting rooms behind ----------
    const Z0 = D, Z1 = D + 3.5, Z2 = D + 12;
    floor(-W / 2, W / 2, Z0, Z2, UP);
    wall(-W / 2, Z0, -W / 2, Z2, UP, 4);
    wall(W / 2, Z0, W / 2, Z2, UP, 4);
    wall(-W / 2, Z2, W / 2, Z2, UP, 4);
    ceiling(-W / 2, W / 2, Z0, Z2, UP + 4);
    const n = MEETING_ROOMS.length, rw = W / n;
    // the wall between the hallway and the rooms, with a door to each
    wall(-W / 2, Z1, W / 2, Z1, UP, 4, MEETING_ROOMS.map((_, i) => [i * rw + rw / 2 - 0.7, i * rw + rw / 2 + 0.7]));
    MEETING_ROOMS.forEach((room, i) => {
      const x0 = -W / 2 + i * rw, x1 = x0 + rw, cx = (x0 + x1) / 2, cz = (Z1 + Z2) / 2;
      if (i) wall(x0, Z1, x0, Z2, UP, 4);
      table(cx, cz, UP, 0.95, 6);
      lamp(cx, UP + 3.2, cz, 14);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: textTexture(room.name), transparent: true }));
      plate.position.set(cx, UP + 3.1, Z1 - 0.2);
      plate.rotation.y = Math.PI;
      g.add(plate);
      rooms.push({ ...room, x0: OX + x0, x1: OX + x1, z0: OZ + Z1, z1: OZ + Z2, door: { x: OX + cx, z: OZ + Z1 - 1.2 } });
    });
    lamp(0, UP + 3.2, D + 1.7, 14);
    chandelier(-5, H - 1.4, 7);
    chandelier(4, H - 1.4, 9);
    // banners on the side walls
    for (const z of [5, 12]) for (const s of [-1, 1]) box(0.05, 3, 1.4, cloth, s * (W / 2 - 0.2), 3.5, z);
  } else {
    wall(-W / 2, D, W / 2, D, 0, H);
    ceiling(-W / 2, W / 2, 0, D, H);
    counterAt(0, D - 2.6, Math.min(6, W - 4), shop.name);
    if (kind === 'tavern') {
      for (const [x, z] of [[-4.5, 4.5], [3.5, 4], [-4, 8.5]]) table(x, z);
      barrel(W / 2 - 1, D - 1); barrel(W / 2 - 2, D - 1); barrel(-W / 2 + 1, D - 1);
      hearth(W / 2 - 0.8, 7.5);
      chandelier(0, H - 1, 6);
    } else if (kind === 'food') {
      for (const [x, z] of [[-4.5, 4], [4.5, 4], [-4.5, 7.5]]) table(x, z);
      const pot = cyl(0.6, 0.5, 0.7, mat('#2e2a26', { metalness: 0.6, roughness: 0.4 }), W / 2 - 1.5, 0, D - 1.5);
      pot.castShadow = true;
      block(W / 2 - 1.5, D - 1.5, 0.7, 0, 1);
      chandelier(0, H - 1, 5.5);
    } else if (kind === 'potions') {
      shelf(-W / 2 + 0.5, 4, Math.PI / 2, ['#e0262a', '#2a7aff', '#3ae0ff', '#5ad04a']);
      shelf(W / 2 - 0.5, 4, -Math.PI / 2, ['#c84ae0', '#e0262a', '#ffd040']);
      cyl(0.5, 0.45, 0.8, mat('#3a5a3a'), -2.5, 0, D - 1.5, 14);
      block(-2.5, D - 1.5, 0.55, 0, 1);
      lamp(0, H - 0.8, D / 2);
    } else if (kind === 'smith') {
      // anvil and forge
      box(0.5, 0.5, 0.5, darkWood, -3, 0, 5);
      box(0.9, 0.3, 0.4, mat('#3a3a3e', { metalness: 0.8, roughness: 0.4 }), -3, 0.5, 5);
      block(-3, 5, 0.6, 0, 1);
      hearth(-W / 2 + 1, 7.5);
      for (let i = 0; i < 4; i++) box(0.08, 1.4, 0.08, mat('#9aa0a8', { metalness: 0.9, roughness: 0.3 }), W / 2 - 0.5, 0.4, 3 + i * 0.6);
      box(0.1, 0.1, 2.8, darkWood, W / 2 - 0.4, 1.5, 3.9);
      lamp(2, H - 0.8, 4);
    } else if (kind === 'armoury') {
      stand(-4, 3.5, '#9aa0a8', true); stand(-4, 6.5, '#6a6e74', true); stand(4, 3.5, '#5a3a24', false); stand(4, 6.5, '#b8b8c0', true);
      lamp(0, H - 0.8, D / 2);
    } else if (kind === 'tailor') {
      rack(-3.2, 3.5, ['#7a2a5a', '#2a5a7a', '#e0d4c0', '#3a6a3a']);
      rack(3.2, 3.5, ['#d8b060', '#5a3a7a', '#a02a2a', '#f0f0e8']);
      box(1.2, 2, 0.08, mat('#bcd0e0', { metalness: 0.9, roughness: 0.05 }), -W / 2 + 0.3, 0, 6.5, Math.PI / 2);
      lamp(0, H - 0.8, D / 2);
    }
  }

  // ---------- the ground: floors, the stairs, and the upper floor ----------
  function sampleAt(x, z, out = {}) {
    const lx = x - OX, lz = z - OZ;
    let h = 0;
    if (ramp && lx >= ramp.x0 && lx <= ramp.x1 && lz >= ramp.z0 && lz <= ramp.z1) h = ((lz - ramp.z0) / (ramp.z1 - ramp.z0)) * UP;
    else if (kind === 'guild' && lz > D) h = UP;
    out.h = h; out.water = -1e6; out.region = 'indoors'; out.forest = 0; out.wet = 0; out.lake = 0; out.coast = 0;
    return out;
  }
  const tmp = {};
  return {
    kind, group: g, solid, seats, rooms, counter, exit, start,
    sample: sampleAt,
    floorAt: (x, z) => sampleAt(x, z, tmp).h,
    roofAt: (x, z) => (kind === 'guild' && z - OZ > D ? UP + 4 : H) - 0.3,
    // keep the camera inside the walls of the floor you're on
    clampCam(v, upstairs) {
      const lo = upstairs ? D + 0.4 : 0.4, hi = upstairs ? D + 12 - 0.4 : D - 0.4;
      v.x = OX + Math.max(-W / 2 + 0.4, Math.min(W / 2 - 0.4, v.x - OX));
      v.z = OZ + Math.max(lo, Math.min(hi, v.z - OZ));
      return v;
    },
    clampPos(v) {
      v.x = OX + Math.max(-W / 2 + 0.4, Math.min(W / 2 - 0.4, v.x - OX));
      v.z = OZ + Math.max(0.4, Math.min((kind === 'guild' ? D + 12 : D) - 0.4, v.z - OZ));
      return v;
    },
    upstairs: (p) => kind === 'guild' && p.z - OZ > D,
    update(t) { for (const p of people) animateCharacter(p, t, 0); },
    dispose() { g.traverse((o) => { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); }); for (const m of mats) m.dispose(); },
  };
}

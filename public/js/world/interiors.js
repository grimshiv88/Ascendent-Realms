// The insides of the town buildings you can walk into. Each is built far off the map (like the
// caves, see depths.js) and answers for the ground while you're in it. What's inside depends on
// the building: the Main Guild Hall has a counter, tables and chairs, and stairs up to meeting
// rooms; a smithy has its anvil and forge; the potion shop its shelves of bottles; and so on.
import * as THREE from 'three';
import { GlowLight } from './lightpool.js';
import { DEPTHS_X } from '../data/world-layout.mjs';
import { MEETING_ROOMS, CASTLE_ROOMS } from '../data/interiors.mjs';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { textTexture } from './spawn.js';
import { buildWork, WORKER_Z } from './work.js';

// where the insides are laid out: past the caves, one at a time
const OX = DEPTHS_X + 150000, OZ = 0;
const UP = 4.5; // the Guild Hall's upper floor
const CASTLE_UP = 5; // the castle's gallery over the reception
const TAVERN_UP = 8.6; // how deep the tavern's upstairs (landing and bedrooms) is
const SEAT_H = 0.48;
const STEPS = 15; // steps on a staircase

// [width, depth, ceiling] of each kind of room (the Guild Hall's ground floor)
const SIZES = { castle: [30, 34, 12], guild: [24, 20, 9], tavern: [16, 14, 7], potions: [11, 9, 4.5], smith: [13, 11, 5], armoury: [13, 10, 5], tailor: [11, 9, 4.5], food: [15, 11, 4.5], academy: [15, 13, 5.5] };
export const kindOf = (shopId) => (String(shopId).startsWith('academy_') ? 'academy' : { castle: 'castle', guild: 'guild', tavern: 'tavern', city_potions: 'potions', city_smith: 'smith', city_armoury: 'armoury', city_tailor: 'tailor', city_food: 'food', furniture_dump: 'tailor', furniture_common: 'tailor', furniture_noble: 'tailor', real_estate: 'tailor', bank: 'tailor' }[shopId] || 'tavern');
// an Academy's training floor: a mat on the left, with the teacher beside it (local x, z)
const MAT = { x: -3.6, z: 5.6, r: 2.6 };

export function buildInterior(shop) {
  const kind = kindOf(shop.id);
  const [W, D, H] = SIZES[kind];
  const g = new THREE.Group();
  g.position.set(OX, 0, OZ);
  const solid = [];
  const seats = [];
  const lights = [];
  const people = [];
  const workers = []; // { station, body }: people doing their jobs
  const rooms = [];
  const nooks = []; // small rooms and hallways the camera stays inside (not rented)
  const bedrooms = []; // the tavern's rooms for the night
  // the tavern's orders, waiter and guests (see tavernLife)
  const orders = []; // { to, done }
  let waiter = null, cup = null, serving = null, making = 0, waiterHome = null, waiterWait = 0, nextGuestOrder = 20;
  const patrons = [];
  let lastLife = null;
  const spots = []; // things to use with E: { x, z, y, event, r }
  let training = null; // an Academy's training floor (world x, z, r)
  let practice = null; // an Academy's practice monster (see practice.js)
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
  // a single wooden door in a doorway along x, hinged on its left, swinging in (towards +z) while
  // someone stands near it
  const swings = [];
  function swingDoor(x, y, z, w) {
    const hinge = new THREE.Group();
    hinge.position.set(x - w / 2, y, z);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, 0.07), wood);
    leaf.position.set(w / 2, 1.25, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), brass);
    knob.position.set(w - 0.15, 1.1, -0.06);
    for (const by of [0.45, 2.05]) { const band = new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, 0.06, 0.09), darkWood); band.position.set(w / 2, by, 0); hinge.add(band); }
    hinge.add(leaf, knob);
    g.add(hinge);
    swings.push({ hinge, x: x, y, z, open: 0 });
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
    const l = new GlowLight('#ffc878', power, 18, 1.4);
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
    // a wooden chair: turned legs, a seat with a cloth cushion, and a back of two posts and three slats
    const c = new THREE.Group();
    const part = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); c.add(o); return o; };
    part(new THREE.BoxGeometry(0.48, 0.05, 0.46), wood, 0, SEAT_H, 0);
    part(new THREE.BoxGeometry(0.4, 0.05, 0.38), cloth, 0, SEAT_H + 0.05, 0.01);
    for (const [lx, lz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) part(new THREE.CylinderGeometry(0.025, 0.03, SEAT_H, 6), darkWood, lx, SEAT_H / 2, lz);
    for (const lx of [-0.2, 0.2]) part(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), darkWood, lx, SEAT_H + 0.31, -0.2);
    for (const k of [0.18, 0.36, 0.54]) part(new THREE.BoxGeometry(0.4, 0.06, 0.03), wood, 0, SEAT_H + k, -0.2);
    part(new THREE.BoxGeometry(0.4, 0.03, 0.03), darkWood, 0, 0.14, 0.19); // a stretcher between the front legs
    c.position.set(x, y, z);
    c.rotation.y = facing;
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(c);
    seats.push({ x: OX + x, z: OZ + z, y, heading: facing });
    block(x, z, 0.28, y, 1); // solid: you walk round it (E to sit)
  }
  // the counter where the keeper stands, and the keeper
  let counter = null;
  function counterAt(x, z, w, label) {
    box(w, 1.05, 0.9, wood, x, 0, z);
    box(w + 0.2, 0.08, 1.05, darkWood, x, 1.05, z);
    for (let s = -w / 2 + 0.4; s <= w / 2; s += 0.8) block(x + s, z, 0.5, 0, 1.2);
    // keepers who work at the counter are tall enough to be seen over it
    const job = { tavern: 'juice', potions: 'brew', food: 'cook', tailor: 'sew', armoury: 'polish' }[kind];
    const races = job ? ['elf', 'beastkin'] : ['dwarf', 'elf', 'hobbit', 'beastkin'];
    const keeper = buildCharacter({ race: races[(shop.name || '').length % races.length], form: 'humanoid', look: {} });
    keeper.position.set(x, 0, z + 1.1);
    keeper.rotation.y = Math.PI;
    g.add(keeper);
    people.push(keeper);
    // the keeper works at the counter: juices in the tavern, potions, food, sewing, polishing
    if (job) {
      const station = buildWork(job, { top: 1.13 });
      station.group.position.set(x, 0, z + 1.1 - WORKER_Z); // the keeper keeps their place behind the counter
      g.add(station.group);
      station.group.add(keeper);
      people.pop();
      workers.push({ station, body: keeper });
    }
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
    const l = new GlowLight('#ff8a40', 14, 10, 1.6);
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
  // the way out: a wooden door frame with two doors that swing open as you come to them, and the
  // daylight beyond
  const light = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.6), new THREE.MeshStandardMaterial({ color: '#d8c8a0', emissive: '#e8d4a0', emissiveIntensity: 0.55 }));
  light.position.set(0, 1.3, -0.12);
  g.add(light);
  box(0.18, 2.75, 0.36, darkWood, -1.09, 0, 0); box(0.18, 2.75, 0.36, darkWood, 1.09, 0, 0); box(2.36, 0.2, 0.36, darkWood, 0, 2.6, 0);
  const leaves = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    hinge.position.set(side * 1, 0, 0.05);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1, 2.55, 0.08), wood);
    leaf.position.set(-side * 0.5, 1.28, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), brass);
    ring.position.set(-side * 0.85, 1.2, 0.06);
    for (const y of [0.5, 1.3, 2.1]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.1), darkWood); band.position.set(-side * 0.5, y, 0); hinge.add(band); }
    hinge.add(leaf, ring);
    g.add(hinge);
    return { hinge, side, open: 0 };
  });
  const exit = { x: OX, z: OZ + 0.4 };
  const start = { x: OX, z: OZ + (kind === 'castle' ? 2.2 : 3.6), heading: 0 }; // (in the castle, just short of the grand staircase)

  let ramp = null;
  if (kind === 'guild') {
    // back wall with an opening at the top of the stairs (right side)
    wall(-W / 2, D, W / 2, D, 0, H, [[W - 3.6, W - 0.4, UP]]);
    ceiling(-W / 2, W / 2, 0, D, H);
    // the counter at the back, the guild board beside it
    counterAt(-1, D - 3, 7, 'Main Guild Hall');
    // the Bounty Board on the front wall, left of the door
    const board = box(3.2, 2, 0.12, mat('#7a5a34'), -8, 1, 0.3);
    for (let i = 0; i < 6; i++) box(0.6, 0.45, 0.02, mat('#efe2c0'), -9.2 + (i % 3) * 1.1, 1.3 + Math.floor(i / 3) * 0.7, 0.38);
    board.receiveShadow = true;
    spots.push({ x: OX - 8, z: OZ + 1.4, y: 0, event: 'guild', r: 2 });
    // the Assessment Room in the back left: a hallway from the hall, a door off it into the room, a
    // crystal board to lay your hand on, and the assessor watching from behind a glass wall
    wall(-W / 2, 8, -6, 8, 0, H);                         // the wing's front
    wall(-6, 8, -6, D, 0, H, [[0.4, 2.0]]);               // hall to hallway
    wall(-8, 8, -8, D, 0, H, [[5.0, 6.6]]);               // hallway to the room
    const glassMat = mat('#bfe4ff', { transparent: true, opacity: 0.22, metalness: 0.4, roughness: 0.05 });
    const glass = box(4, 2.6, 0.06, glassMat, -10, 0, 16.5);
    glass.castShadow = false;
    box(4, 0.9, 0.3, plaster, -10, 0, 16.5);              // the sill under the glass
    box(4, H - 2.6, 0.3, plaster, -10, 2.6, 16.5);        // and the wall over it
    for (let x = -11.7; x <= -8.2; x += 0.8) block(x, 16.5, 0.45, 0, H);
    // the crystal board: a slab of crystal on a stone stand, glowing where the hand goes
    cyl(0.3, 0.4, 1.0, stone, -10, 0, 15.2, 10);
    const slab = box(1.1, 0.08, 0.8, mat('#8fd8ff', { emissive: '#3fb0ff', emissiveIntensity: 1.4, transparent: true, opacity: 0.9 }), -10, 1.0, 15.2);
    slab.rotation.x = -0.35;
    const hand = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), mat('#ffffff', { emissive: '#bfe8ff', emissiveIntensity: 2 }));
    hand.rotation.x = -Math.PI / 2 - 0.35; hand.position.set(-10, 1.1, 15.15);
    g.add(hand);
    block(-10, 15.2, 0.5, 0, 1.2);
    const glow = new GlowLight('#7fd0ff', 8, 6, 1.6);
    glow.position.set(-10, 1.8, 15);
    g.add(glow); lights.push(glow);
    spots.push({ x: OX - 10, z: OZ + 15.2, y: 0, event: 'assess', r: 1.7, spin: null });
    // the assessor at a desk behind the glass, reading what the crystal shows
    box(2.4, 0.8, 0.7, darkWood, -10, 0, 17.6);
    const assessor = buildCharacter({ race: 'elf', form: 'humanoid', look: {} });
    assessor.position.set(-10, 0, 18.5);
    assessor.rotation.y = Math.PI;
    g.add(assessor);
    people.push(assessor);
    lamp(-10, H - 0.8, 13);
    lamp(-7, H - 0.8, 14, 10);
    const sign = (text, x, z) => { const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshBasicMaterial({ map: textTexture(text), transparent: true })); pl.position.set(x, 2.85, z); pl.rotation.y = Math.PI / 2; g.add(pl); };
    sign('Assessment Room', -5.83, 9.2);   // over the way into the hallway, seen from the hall
    sign('Assessment Room', -7.83, 13.8);  // over the room's door, seen from the hallway
    nooks.push({ x0: OX - 8, x1: OX - 6, z0: OZ + 8, z1: OZ + D }, { x0: OX - W / 2, x1: OX - 8, z0: OZ + 8, z1: OZ + D });
    // tables with chairs round them
    for (const [x, z] of [[-7.5, 4.5], [-2.5, 11.5], [0, 6.5], [5, 4.5]]) table(x, z);
    // the stairs up along the right wall: from z = 7 at the floor to z = D at the upper floor
    ramp = { x0: W / 2 - 3.6, x1: W / 2 - 0.4, z0: 7, z1: D };
    const steps = STEPS;
    for (let i = 0; i < steps; i++) {
      const z = ramp.z0 + ((ramp.z1 - ramp.z0) * (i + 0.5)) / steps;
      box(ramp.x1 - ramp.x0, ((i + 1) / steps) * UP, (ramp.z1 - ramp.z0) / steps, wood, (ramp.x0 + ramp.x1) / 2, 0, z);
    }
    // a rail on the open side of the stairs
    for (let z = ramp.z0 + 0.6; z < ramp.z1; z += 0.8) block(ramp.x0 - 0.25, z, 0.4, 0, 6);
    // the handrail: a sloped rail along the stairs on posts, a metre above each step
    {
      const run = ramp.z1 - ramp.z0, L = Math.hypot(run, UP);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, L), darkWood);
      rail.position.set(ramp.x0 - 0.1, UP / 2 + 1, (ramp.z0 + ramp.z1) / 2);
      rail.rotation.x = -Math.atan2(UP, run);
      rail.castShadow = true;
      g.add(rail);
      for (let z = ramp.z0 + 0.3; z <= ramp.z1; z += 0.9) box(0.06, 1, 0.06, darkWood, ramp.x0 - 0.1, (UP * (z - ramp.z0)) / run, z);
    }

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
      swingDoor(cx, UP, Z1, 1.4);
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
  } else if (kind === 'castle') {
    // ---------- the Emperors' Castle ----------
    // In through the great door: the reception, red carpet wall to wall, a chandelier, and a grand
    // staircase in the middle up to a gallery. Under the gallery, a wide doorway into the great hall
    // with the council table and the throne, and the chambers behind.
    const R = 12; // the reception is the first 12 m; the great hall is behind it
    const n = CASTLE_ROOMS.length, rw = W / n, Z2 = D + 10;
    wall(-W / 2, D, W / 2, D, 0, H, CASTLE_ROOMS.map((_, i) => [i * rw + rw / 2 - 0.8, i * rw + rw / 2 + 0.8]));
    ceiling(-W / 2, W / 2, 0, D, H);
    floor(-W / 2, W / 2, D, Z2, 0, mat('#5a3a2a'));
    wall(-W / 2, D, -W / 2, Z2, 0, 6); wall(W / 2, D, W / 2, Z2, 0, 6); wall(-W / 2, Z2, W / 2, Z2, 0, 6);
    ceiling(-W / 2, W / 2, D, Z2, 6);
    // the reception
    const red = mat('#8a1a1a'), gold = mat('#c8a040', { metalness: 0.8, roughness: 0.3 });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, R - 0.4), red);
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.02, R / 2); g.add(rug);
    const trimRug = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, R + 0.2), gold);
    trimRug.rotation.x = -Math.PI / 2; trimRug.position.set(0, 0.015, R / 2); g.add(trimRug);
    counterAt(W / 2 - 5, 3.5, 3, "The Emperors' Castle"); // the steward's desk: E for the chambers and today's rule
    chandelier(0, H - 2, 4.5);
    // the grand staircase, in the middle, up to the gallery along the back of the reception
    ramp = { x0: -2.6, x1: 2.6, z0: 3.2, z1: R - 3.2, top: CASTLE_UP, gallery: { z0: R - 3.2, z1: R } };
    const cSteps = 16;
    for (let i = 0; i < cSteps; i++) {
      const z = ramp.z0 + ((ramp.z1 - ramp.z0) * (i + 0.5)) / cSteps, top = ((i + 1) / cSteps) * CASTLE_UP;
      box(ramp.x1 - ramp.x0, top, (ramp.z1 - ramp.z0) / cSteps, stone, 0, 0, z);
      box(ramp.x1 - ramp.x0 - 0.8, 0.02, (ramp.z1 - ramp.z0) / cSteps, red, 0, top, z); // the carpet runs up the stairs
    }
    for (const sx of [-1, 1]) {
      const run = ramp.z1 - ramp.z0, L = Math.hypot(run, CASTLE_UP);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, L), gold);
      rail.position.set(sx * (ramp.x1 + 0.1), CASTLE_UP / 2 + 1, (ramp.z0 + ramp.z1) / 2);
      rail.rotation.x = -Math.atan2(CASTLE_UP, run); g.add(rail);
      for (let z = ramp.z0 + 0.3; z <= ramp.z1; z += 1) box(0.07, 1, 0.07, gold, sx * (ramp.x1 + 0.1), (CASTLE_UP * (z - ramp.z0)) / run, z);
      for (let z = ramp.z0 + 0.5; z < ramp.z1; z += 0.8) block(sx * (ramp.x1 + 0.3), z, 0.35, 0, 6);
    }
    // the gallery: a floor along the back at the top of the stairs, a gold railing at its edge
    box(W, 0.3, R - ramp.gallery.z0, stone, 0, CASTLE_UP - 0.3, (ramp.gallery.z0 + R) / 2);
    box(W, 0.02, R - ramp.gallery.z0, red, 0, CASTLE_UP, (ramp.gallery.z0 + R) / 2);
    for (const [a, b] of [[-W / 2, ramp.x0], [ramp.x1, W / 2]]) {
      box(b - a, 0.08, 0.08, gold, (a + b) / 2, CASTLE_UP + 1, ramp.gallery.z0);
      for (let x = a + 0.4; x < b; x += 0.9) { box(0.06, 1, 0.06, gold, x, CASTLE_UP, ramp.gallery.z0); block(x, ramp.gallery.z0, 0.4, CASTLE_UP, 1.2); }
    }
    for (const sx of [-1, 1]) { cyl(0.5, 0.6, CASTLE_UP - 0.3, stone, sx * 11.5, 0, ramp.gallery.z0 + 0.4, 12); block(sx * 11.5, ramp.gallery.z0 + 0.4, 0.6, 0, CASTLE_UP - 0.3); }
    // the wall between the reception and the great hall, with a wide doorway each side of the stairs
    wall(-W / 2, R, W / 2, R, 0, H, [[W / 2 - 9, W / 2 - 5], [W / 2 + 5, W / 2 + 9]]);
    for (const sx of [-1, 1]) box(0.05, 3, 1.4, cloth, sx * (W / 2 - 0.2), 1.6, 6);
    // the great hall: a red carpet up the middle to the council table and the empty throne
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3, D - R - 6), red);
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.02, R + (D - R - 6) / 2); g.add(carpet);
    // the long council table, chairs down both sides and one at each end
    box(2.2, 0.1, 11, wood, 0, 0.75, R + 11);
    for (const [lx, lz] of [[-0.9, 6], [0.9, 6], [-0.9, 16], [0.9, 16]]) box(0.15, 0.75, 0.15, darkWood, lx, 0, R + lz);
    for (let z = 6.5; z <= 15.5; z += 1.5) block(0, R + z, 1.1, 0, 1);
    for (let z = 6.5; z <= 15.5; z += 1.8) { chair(-1.6, R + z, 0, Math.PI / 2); chair(1.6, R + z, 0, -Math.PI / 2); }
    chair(0, R + 4.6, 0, 0);
    // the throne on its dais
    const TZ = D - 3.6; // at the head of the table, in front of the middle chamber's door, with room to walk round
    box(5, 0.4, 3, stone, 0, 0, TZ);
    box(1.4, 0.6, 1.2, gold, 0, 0.4, TZ + 0.4);
    box(1.4, 2.4, 0.25, gold, 0, 0.4, TZ + 0.95);
    for (const sx of [-1.6, 0, 1.6]) block(sx, TZ, 1, 0, 2);
    // pillars and banners
    for (const z of [4, 10, 16]) for (const sx of [-1, 1]) { cyl(0.6, 0.7, H, stone, sx * (W / 2 - 4), 0, R + z, 12); block(sx * (W / 2 - 4), R + z, 0.8, 0, H); }
    for (const z of [6, 13]) for (const sx of [-1, 1]) box(0.05, 4, 1.6, cloth, sx * (W / 2 - 0.2), 4, R + z);
    chandelier(0, H - 2, R + 7); chandelier(0, H - 2, R + 15);
    lamp(-9, 5, R + 3); lamp(9, 5, R + 19);
    // the chambers behind, each with a table
    CASTLE_ROOMS.forEach((room, i) => {
      const x0 = -W / 2 + i * rw, x1 = x0 + rw, cx = (x0 + x1) / 2, cz = (D + Z2) / 2;
      if (i) wall(x0, D, x0, Z2, 0, 6);
      table(cx, cz, 0, 1.1, 8);
      swingDoor(cx, 0, D, 1.6);
      lamp(cx, 5, cz, 14);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: textTexture(room.name), transparent: true }));
      plate.position.set(cx, 3.2, D - 0.2);
      plate.rotation.y = Math.PI;
      g.add(plate);
      rooms.push({ ...room, x0: OX + x0, x1: OX + x1, z0: OZ + D, z1: OZ + Z2, door: { x: OX + cx, z: OZ + D - 1.2 } });
    });
  } else {
    // (the tavern's back wall has an opening at the top of its stairs)
    wall(-W / 2, D, W / 2, D, 0, H, kind === 'tavern' ? [[0.4, 3.6, UP]] : []);
    ceiling(-W / 2, W / 2, 0, D, H);
    counterAt(0, D - 2.6, Math.min(6, W - 4), shop.name);
    if (kind === 'tavern') {
      for (const [x, z] of [[-4.5, 4.5], [3.5, 4], [3, 8.4]]) table(x, z);
      barrel(W / 2 - 1, D - 1); barrel(W / 2 - 2, D - 1); barrel(W / 2 - 3, D - 1);
      hearth(W / 2 - 0.8, 7.5);
      chandelier(0, H - 1, 6);
      // stairs up the left wall to the rooms for the night
      ramp = { x0: -W / 2 + 0.4, x1: -W / 2 + 3.6, z0: 6, z1: D };
      for (let i = 0; i < STEPS; i++) {
        const z = ramp.z0 + ((ramp.z1 - ramp.z0) * (i + 0.5)) / STEPS;
        box(ramp.x1 - ramp.x0, ((i + 1) / STEPS) * UP, (ramp.z1 - ramp.z0) / STEPS, wood, (ramp.x0 + ramp.x1) / 2, 0, z);
      }
      {
        const run = ramp.z1 - ramp.z0, L = Math.hypot(run, UP);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, L), darkWood);
        rail.position.set(ramp.x1 + 0.1, UP / 2 + 1, (ramp.z0 + ramp.z1) / 2);
        rail.rotation.x = -Math.atan2(UP, run);
        g.add(rail);
        for (let z = ramp.z0 + 0.3; z <= ramp.z1; z += 0.9) box(0.06, 1, 0.06, darkWood, ramp.x1 + 0.1, (UP * (z - ramp.z0)) / run, z);
        for (let z = ramp.z0 + 0.6; z < ramp.z1; z += 0.8) block(ramp.x1 + 0.25, z, 0.4, 0, 6);
      }
      // upstairs: a landing along the front, and three bedrooms behind, each with a bed and a lamp
      const Z0 = D, Z1 = D + 2.6, Z2 = D + TAVERN_UP;
      floor(-W / 2, W / 2, Z0, Z2, UP);
      wall(-W / 2, Z0, -W / 2, Z2, UP, 3.6); wall(W / 2, Z0, W / 2, Z2, UP, 3.6); wall(-W / 2, Z2, W / 2, Z2, UP, 3.6);
      ceiling(-W / 2, W / 2, Z0, Z2, UP + 3.6);
      const rw = W / 3;
      wall(-W / 2, Z1, W / 2, Z1, UP, 3.6, [0, 1, 2].map((i) => [i * rw + rw / 2 - 0.6, i * rw + rw / 2 + 0.6]));
      const blankets = ['#3a5a8a', '#7a3a3a', '#3a6a4a'];
      for (let i = 0; i < 3; i++) {
        const x0 = -W / 2 + i * rw, x1 = x0 + rw, cx = (x0 + x1) / 2;
        if (i) wall(x0, Z1, x0, Z2, UP, 3.6);
        swingDoor(cx, UP, Z1, 1.2);
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.4), new THREE.MeshBasicMaterial({ map: textTexture(`Room ${i + 1}`), transparent: true }));
        plate.position.set(cx, UP + 2.9, Z1 - 0.17); plate.rotation.y = Math.PI; g.add(plate);
        // the bed against the back wall: a frame, a blanket and a pillow
        const bx = cx - 0.6, bz = Z2 - 1.3;
        box(1.2, 0.45, 2.2, darkWood, bx, UP, bz);
        box(1.1, 0.12, 1.5, mat(blankets[i]), bx, UP + 0.45, bz - 0.3);
        box(0.8, 0.14, 0.4, mat('#efe6d0'), bx, UP + 0.45, bz + 0.75);
        box(1.2, 0.9, 0.1, darkWood, bx, UP, Z2 - 0.25);
        block(bx, bz, 0.7, UP, 0.5);
        box(0.5, 0.6, 0.5, wood, cx + 1.3, UP, Z2 - 0.6);
        lamp(cx + 1.3, UP + 1, Z2 - 0.6, 6);
        bedrooms.push({ n: i + 1, x0: OX + x0, x1: OX + x1, z0: OZ + Z1, z1: OZ + Z2, bed: { x: OX + bx, z: OZ + bz, y: UP + 0.5 }, door: { x: OX + cx, z: OZ + Z1 - 1.1 } });
        nooks.push({ x0: OX + x0, x1: OX + x1, z0: OZ + Z1, z1: OZ + Z2 });
      }
      lamp(0, UP + 2.8, D + 1.3, 10);
      tavernLife();
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
      // the smith at the forge, anvil and mould along the left wall, merging pieces all day
      const station = buildWork('smith', {});
      station.group.position.set(-W / 2 + 1.5, 0, 4.6);
      station.group.rotation.y = Math.PI / 2;
      g.add(station.group);
      const smith = buildCharacter({ race: 'dwarf', form: 'humanoid', look: {} });
      station.group.add(smith);
      workers.push({ station, body: smith });
      for (const lz of [-1.7, 0, 1.7]) block(-W / 2 + 1.1, 4.6 + lz, 0.7, 0, 1.5);
      for (let i = 0; i < 4; i++) box(0.08, 1.4, 0.08, mat('#9aa0a8', { metalness: 0.9, roughness: 0.3 }), W / 2 - 0.5, 0.4, 3 + i * 0.6);
      box(0.1, 0.1, 2.8, darkWood, W / 2 - 0.4, 1.5, 3.9);
      lamp(2, H - 0.8, 4);
    } else if (kind === 'armoury') {
      stand(-4, 3.5, '#9aa0a8', true); stand(-4, 6.5, '#6a6e74', true); stand(4, 3.5, '#5a3a24', false); stand(4, 6.5, '#b8b8c0', true);
      lamp(0, H - 0.8, D / 2);
    } else if (kind === 'academy') {
      academyHall(shop.school);
    } else if (kind === 'tailor') {
      rack(-3.2, 3.5, ['#7a2a5a', '#2a5a7a', '#e0d4c0', '#3a6a3a']);
      rack(3.2, 3.5, ['#d8b060', '#5a3a7a', '#a02a2a', '#f0f0e8']);
      box(1.2, 2, 0.08, mat('#bcd0e0', { metalness: 0.9, roughness: 0.05 }), -W / 2 + 0.3, 0, 6.5, Math.PI / 2);
      lamp(0, H - 0.8, D / 2);
    }
  }

  // ---------- an Academy: the registrar at the counter, and the training floor ----------
  // The mat on the left is where children of the Academy train, beside their teacher; on the right,
  // the tools of the class it teaches.
  function academyHall(school) {
    const straw = mat('#c9a85a'), iron = mat('#9aa0a8', { metalness: 0.8, roughness: 0.35 }), soil = mat('#4a3424'), leaf = mat('#4a8a3a');
    box(5.2, 0.04, 5.2, mat('#7a2a24'), MAT.x, 0, MAT.z);
    box(4.6, 0.045, 4.6, mat('#a8463a'), MAT.x, 0, MAT.z);
    training = { x: OX + MAT.x, z: OZ + MAT.z, r: MAT.r };
    const teacher = buildCharacter({ race: ['dwarf', 'elf', 'beastkin', 'hobbit'][school.length % 4], form: 'humanoid', look: {} });
    teacher.position.set(MAT.x - 2.9, 0, MAT.z);
    teacher.rotation.y = Math.PI / 2;
    g.add(teacher); people.push(teacher);
    block(MAT.x - 2.9, MAT.z, 0.35, 0, 2);
    const dummy = (x, z) => {
      cyl(0.08, 0.08, 1.8, wood, x, 0, z, 8);
      cyl(0.3, 0.34, 1, straw, x, 0.75, z, 10);
      box(1.2, 0.1, 0.1, wood, x, 1.45, z);
      block(x, z, 0.4, 0, 1.8);
    };
    const R = W / 2 - 1.6; // the right-hand side, along the wall
    if (school === 'swordsman' || school === 'tank' || school === 'assassin') {
      dummy(MAT.x + 1.2, MAT.z + 1.4);
      if (school === 'tank') for (const z of [3.2, 5.2, 7.2]) { const sh = cyl(0.55, 0.55, 0.1, iron, R + 1.2, 1.6, z, 18); sh.rotation.z = Math.PI / 2; }
      else if (school === 'assassin') for (const z of [3.5, 6.5]) {
        cyl(0.06, 0.06, 1.5, wood, R, 0, z, 6);
        const t = cyl(0.45, 0.45, 0.06, mat('#e8e0c8'), R, 1.5, z, 18); t.rotation.z = Math.PI / 2;
        const b = cyl(0.2, 0.2, 0.07, mat('#a02a24'), R - 0.02, 1.5, z, 14); b.rotation.z = Math.PI / 2;
        block(R, z, 0.4, 0, 2);
      }
      else { box(0.3, 1.8, 3, darkWood, R + 1, 0, 5); for (let i = 0; i < 5; i++) box(0.05, 1.2, 0.05, iron, R + 0.8, 0.5, 3.9 + i * 0.55); block(R + 1, 4.2, 0.6, 0, 2); block(R + 1, 5.8, 0.6, 0, 2); }
    } else if (school === 'healer') {
      for (const z of [3.2, 6.6]) { box(1, 0.5, 2.1, darkWood, R, 0, z); box(0.95, 0.12, 1.9, mat('#efe6d0'), R, 0.5, z); block(R, z, 0.8, 0, 0.6); }
      shelf(MAT.x + 1.5, D - 0.6, Math.PI, ['#5ad04a', '#e0262a', '#efe6d0']);
    } else if (school === 'blacksmith') {
      box(1.6, 1.1, 1.4, mat('#4a4642'), R + 0.4, 0, 3.5);
      box(1.1, 0.1, 0.9, mat('#ff7a2a', { emissive: '#ff5a1a', emissiveIntensity: 1.2 }), R + 0.4, 1.1, 3.5);
      box(0.9, 0.5, 0.4, iron, R - 0.4, 0.55, 6.2); box(0.4, 0.55, 0.3, darkWood, R - 0.4, 0, 6.2);
      block(R + 0.4, 3.5, 0.9, 0, 1.2); block(R - 0.4, 6.2, 0.55, 0, 1);
    } else if (school === 'businessman') {
      for (const z of [3.4, 6.6]) {
        table(R - 0.6, z, 0, 0.7, 2);
        for (let i = 0; i < 3; i++) cyl(0.12, 0.12, 0.05 * (i + 2), mat('#e8c040', { metalness: 0.8, roughness: 0.3 }), R - 0.8 + i * 0.25, 0.78, z, 12);
      }
    } else if (school === 'builder') {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) box(0.5, 0.25, 0.25, mat('#9a5a3a'), R - 0.3 + j * 0.52 - i * 0.26 + i * 0.52, i * 0.25, 4);
      for (let i = 0; i < 4; i++) box(0.2, 0.2, 2.6, wood, R + 0.6, i * 0.2, 6.5);
      block(R + 0.4, 4, 1.1, 0, 1); block(R + 0.6, 6.5, 1.1, 0, 0.8);
    } else if (school === 'potion_maker') {
      const pot = cyl(0.55, 0.45, 0.75, mat('#2e2a26', { metalness: 0.6, roughness: 0.4 }), R, 0, 3.4);
      pot.castShadow = true; block(R, 3.4, 0.65, 0, 1);
      shelf(R + 0.9, 6.4, -Math.PI / 2, ['#c84ae0', '#3ae0ff', '#5ad04a']);
    } else if (school === 'farmer') {
      for (const z of [3.2, 5.4]) {
        box(2.6, 0.25, 1.4, soil, R, 0, z);
        for (let i = 0; i < 5; i++) cyl(0.05, 0.12, 0.4, leaf, R - 1 + i * 0.5, 0.25, z, 6);
        block(R - 0.6, z, 0.7, 0, 0.4); block(R + 0.6, z, 0.7, 0, 0.4);
      }
      box(1.2, 0.8, 0.8, straw, R + 0.4, 0, 7.6); block(R + 0.4, 7.6, 0.7, 0, 0.8);
    }
    lamp(MAT.x, H - 0.8, MAT.z, 16);
    lamp(3, H - 0.8, D / 2, 12);
    // the practice monster, beside the mat: a tame goblin (a slime for the Mages and Herbalists),
    // with a little straw on its back so nobody takes it for a wild one (see practice.js)
    const slime = school === 'mage' || school === 'potion_maker';
    const pm = buildCharacter({ race: slime ? 'slime' : 'goblin', form: 'monster', look: {} });
    const px = MAT.x + 3.9, pz = MAT.z - 1.2;
    pm.position.set(px, 0, pz);
    pm.rotation.y = -Math.PI / 2;
    const tag = cyl(0.18, 0.22, 0.12, straw, 0, (pm.userData.height || 1.2) + 0.05, 0, 8);
    g.remove(tag); pm.add(tag); tag.position.set(0, (pm.userData.height || 1.2) + 0.05, 0);
    g.add(pm); people.push(pm);
    block(px, pz, 0.45, 0, 1.6);
    practice = { body: pm, ox: OX, oz: OZ, school };
  }

  // ---------- the tavern's life: orders, the keeper pressing juice, and the waiter ----------
  // Nothing is made until someone orders and pays: a guest at a table (now and then) or you, at the
  // counter. The keeper presses the drink, then the waiter carries it to whoever ordered it.
  function tavernLife() {
    waiterHome = { x: 3.2, z: D - 4.2 };
    waiter = buildCharacter({ race: 'hobbit', form: 'humanoid', look: { accent: '#f0ead8' } });
    waiter.position.set(waiterHome.x, 0, waiterHome.z);
    waiter.rotation.y = Math.PI;
    g.add(waiter);
    cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 10), mat('#f0a030', { emissive: '#a05010', emissiveIntensity: 0.3 }));
    cup.visible = false;
    g.add(cup);
    // two guests already sitting at the tables (their chairs are taken)
    for (const k of [1, 6]) {
      const seat = seats[k];
      if (!seat) continue;
      const b = buildCharacter({ race: ['elf', 'dwarf'][patrons.length % 2], form: 'humanoid', look: {} });
      b.position.set(seat.x - OX, seat.y + 0.5 - b.userData.height * 0.27, seat.z - OZ);
      b.rotation.y = seat.heading;
      g.add(b);
      patrons.push({ body: b, at: { x: seat.x - OX, z: seat.z - OZ } });
    }
    for (const p of patrons) seats.splice(seats.findIndex((q) => q.x - OX === p.at.x && q.z - OZ === p.at.z), 1);
  }
  // `where` says where whoever ordered is now (they may have sat down meanwhile)
  function order(where, done) { orders.push({ to: () => { const p = where(); return { x: p.x - OX, z: p.z - OZ }; }, done }); }
  function lifeUpdate(t) {
    const dt = lastLife === null ? 0 : Math.min(0.1, t - lastLife);
    lastLife = t;
    for (const p of patrons) {
      const rig = p.body.userData.rig;
      animateCharacter(p.body, t, 0);
      if (rig.legs) for (const leg of rig.legs) { leg.hip.rotation.x = -1.45; leg.knee.rotation.x = 1.45; }
    }
    // the guests order now and then
    if (patrons.length && t > nextGuestOrder) { nextGuestOrder = t + 35 + Math.random() * 30; const p = patrons[Math.floor(Math.random() * patrons.length)]; orders.push({ to: p.at, done: null }); }
    // the keeper presses a drink for the next order, then hands it to the waiter
    if (!serving && orders.length && !making) making = t + 4;
    if (making && t > making) { making = 0; serving = orders.shift(); cup.visible = true; }
    let speed = 0;
    if (waiterWait > 0) waiterWait -= dt;
    else {
      let goal = serving ? (typeof serving.to === 'function' ? serving.to() : serving.to) : waiterHome;
      if (serving) goal = { x: Math.max(-W / 2 + 4, Math.min(W / 2 - 1, goal.x)), z: Math.max(1, Math.min(D - 3.6, goal.z)) }; // (the waiter keeps to the ground floor)
      const dx = goal.x - waiter.position.x, dz = goal.z - waiter.position.z, d = Math.hypot(dx, dz);
      const stop = serving ? 0.9 : 0.05; // stand at the guest's side, not on top of them
      if (d > stop) {
        speed = 1.5;
        const step = Math.min(d - stop, speed * dt);
        waiter.position.x += (dx / d) * step; waiter.position.z += (dz / d) * step;
        waiter.rotation.y = Math.atan2(dx, dz);
      } else if (serving) {
        // handed over
        serving.done?.();
        serving = null; cup.visible = false; waiterWait = 1.2;
      }
    }
    animateCharacter(waiter, t, speed ? 1 : 0);
    if (cup.visible) { cup.position.set(waiter.position.x + Math.sin(waiter.rotation.y) * 0.35, 1.05, waiter.position.z + Math.cos(waiter.rotation.y) * 0.35); }
  }

  // ---------- the ground: floors, the stairs, and the upper floor ----------
  function sampleAt(x, z, out = {}) {
    const lx = x - OX, lz = z - OZ;
    let h = 0;
    // on the stairs you stand on the step under you (not a slope through them)
    if (ramp && lx >= ramp.x0 && lx <= ramp.x1 && lz >= ramp.z0 && lz <= ramp.z1) { const n = ramp.top ? 16 : STEPS; h = (Math.min(n, Math.floor(((lz - ramp.z0) / (ramp.z1 - ramp.z0)) * n) + 1) / n) * (ramp.top || UP); }
    else if ((kind === 'guild' || kind === 'tavern') && lz > D) h = UP;
    out.h = h; out.water = -1e6; out.region = 'indoors'; out.forest = 0; out.wet = 0; out.lake = 0; out.coast = 0; out.ice = 0;
    return out;
  }
  const tmp = {};
  // where you stand, knowing how high you are now: on the castle's gallery only if you're up there
  // (underneath it is the ground floor)
  const standAt = (x, z, fromY) => {
    const lz = z - OZ;
    if (ramp?.gallery && lz > ramp.gallery.z0 - 0.05 && lz < ramp.gallery.z1 && fromY > ramp.top - 0.9) return ramp.top;
    return sampleAt(x, z, tmp).h;
  };
  return {
    standAt,
    kind, group: g, solid, seats, rooms, nooks, spots, counter, exit, start, training, practice,
    sample: sampleAt,
    floorAt: (x, z) => sampleAt(x, z, tmp).h,
    roofAt: (x, z) => (z - OZ > D ? (kind === 'guild' ? UP + 4 : kind === 'tavern' ? UP + 3.6 : 6) : H) - 0.3,
    // keep the camera inside the walls of the floor you're on
    clampCam(v, upstairs) {
      const lo = upstairs ? D + 0.4 : 0.4, hi = upstairs ? D + (kind === 'tavern' ? TAVERN_UP : 12) - 0.4 : (kind === 'castle' ? D + 10 : D) - 0.4;
      v.x = OX + Math.max(-W / 2 + 0.4, Math.min(W / 2 - 0.4, v.x - OX));
      v.z = OZ + Math.max(lo, Math.min(hi, v.z - OZ));
      return v;
    },
    clampPos(v) {
      v.x = OX + Math.max(-W / 2 + 0.4, Math.min(W / 2 - 0.4, v.x - OX));
      v.z = OZ + Math.max(0.4, Math.min((kind === 'guild' ? D + 12 : kind === 'tavern' ? D + TAVERN_UP : kind === 'castle' ? D + 10 : D) - 0.4, v.z - OZ));
      return v;
    },
    upstairs: (p) => (kind === 'guild' || kind === 'tavern') && p.z - OZ > D,
    bedrooms,
    order,
    update(t, you) {
      // the front doors open while someone is near them
      const near = you && Math.hypot(you.x - OX, you.z - OZ) < 3;
      for (const l of leaves) { l.open += ((near ? 1.4 : 0) - l.open) * 0.12; l.hinge.rotation.y = l.side * l.open; }
      for (const d of swings) {
        const by = you && Math.hypot(you.x - OX - d.x, you.z - OZ - d.z) < 2.2 && Math.abs(you.y - d.y) < 1.5;
        d.open += ((by ? 1.45 : 0) - d.open) * 0.12;
        d.hinge.rotation.y = -d.open;
      }
      for (const p of people) animateCharacter(p, t, 0);
      // (in the tavern the keeper only works while there's an order to make)
      for (const w of workers) { if (kind === 'tavern' && !making) animateCharacter(w.body, t, 0); else w.station.play(w.body, t); }
      if (waiter) lifeUpdate(t);
      for (const sp of spots) if (sp.spin) { sp.spin.rotation.y = t * 0.8; sp.spin.position.y = 1.3 + Math.sin(t * 2) * 0.05; }
    },
    // leaving with an order not yet brought: the waiter hands it over at the door
    flushOrders() { if (serving) { serving.done?.(); serving = null; } for (const o of orders.splice(0)) o.done?.(); },
    dispose() { for (const w of workers) w.station.dispose(); g.traverse((o) => { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); }); for (const m of mats) m.dispose(); },
  };
}

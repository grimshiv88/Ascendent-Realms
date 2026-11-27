// The Colosseum of the Central City (see data/arena.mjs for its size and the rules of the fights).
// A round sand floor inside a stone wall, twelve rows of stone seats rising behind it, and a great
// outer wall of three tiers of arches. Four gates lead in to the floor at ground level; two stairways
// climb the outside of the great wall to the top row. Townsfolk sit in the stands and cheer.
// Everything is built in the Colosseum's own turn: angle 0 faces the middle of the city.
import * as THREE from 'three';
import {
  FLOOR_R, PODIUM_R, ROWS, ROW_D, ROW0_Y, ROW_RISE, TOP_Y, WALL_R0, WALL_R1, WALL_H, GATE_HALF, GATE_H, GATES,
  RAMP_R0, RAMP_R1, RAMP_A0, RAMP_A1, LANDING_A1,
} from '../data/arena.mjs';

const PARAPET_H = ROW0_Y + 1; // the wall round the floor: a parapet in front of the front row
const rowR = (k) => PODIUM_R + k * ROW_D;              // where row k begins
const rowY = (k) => ROW0_Y + k * ROW_RISE;             // and how high it stands
const DOOR_A = (RAMP_A1 + LANDING_A1) / 2, DOOR_HALF = (LANDING_A1 - RAMP_A1) / 2; // the doors at the top of the stairways
const rampY = (a) => TOP_Y * Math.min(1, Math.max(0, (Math.abs(a) - RAMP_A0) / (RAMP_A1 - RAMP_A0)));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// is (r, a) in the tunnel of a gate? (the tunnels have straight sides, `pad` wider each side)
function inGate(r, a, pad = 0) {
  for (const g of GATES) {
    const d = wrap(a - g);
    if (Math.abs(d) < Math.PI / 2 && Math.abs(r * Math.sin(d)) < GATE_HALF + pad) return true;
  }
  return false;
}
const inDoor = (a) => Math.abs(Math.abs(a) - DOOR_A) < DOOR_HALF;

// A solid piece of a ring: from radius r0 to r1, angle a0 to a1, from height y0 up to top (a number,
// or a function of the angle for a slope). Flat-shaded, closed at both ends.
function arcSolid(r0, r1, a0, a1, top, y0 = 0, step = 1.6) {
  const n = Math.max(1, Math.ceil(((a1 - a0) * r1) / step));
  const h = typeof top === 'function' ? top : () => top;
  const P = [];
  const v = (r, a, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
  const quad = (p, q, s, t) => P.push(...p, ...q, ...s, ...p, ...s, ...t);
  for (let i = 0; i < n; i++) {
    const ta = a0 + ((a1 - a0) * i) / n, tb = a0 + ((a1 - a0) * (i + 1)) / n;
    const ha = h(ta), hb = h(tb);
    quad(v(r0, ta, ha), v(r1, ta, ha), v(r1, tb, hb), v(r0, tb, hb));     // top
    quad(v(r1, ta, y0), v(r1, tb, y0), v(r1, tb, hb), v(r1, ta, ha));     // outer face
    quad(v(r0, tb, y0), v(r0, ta, y0), v(r0, ta, ha), v(r0, tb, hb));     // inner face
  }
  quad(v(r0, a0, y0), v(r1, a0, y0), v(r1, a0, h(a0)), v(r0, a0, h(a0))); // the ends
  quad(v(r1, a1, y0), v(r0, a1, y0), v(r0, a1, h(a1)), v(r1, a1, h(a1)));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.computeVertexNormals();
  return geo;
}
// the stretches of a ring at radius r between the gate tunnels (`pad` metres clear of each side)
function between(r, pad = 0.3, skip = []) {
  const half = (GATE_HALF + pad) / r;
  const cuts = [...GATES.map((g) => [wrap(g) - half, wrap(g) + half]), ...skip].map(([a, b]) => [a, b]);
  // walk round from -PI to PI, leaving out the cuts
  const marks = [];
  for (const [a, b] of cuts) { if (a < -Math.PI) { marks.push([a + Math.PI * 2, Math.PI]); marks.push([-Math.PI, b]); } else if (b > Math.PI) { marks.push([a, Math.PI]); marks.push([-Math.PI, b - Math.PI * 2]); } else marks.push([a, b]); }
  marks.sort((p, q) => p[0] - q[0]);
  const out = [];
  let at = -Math.PI;
  for (const [a, b] of marks) { if (a > at + 0.01) out.push([at, a]); at = Math.max(at, b); }
  if (at < Math.PI - 0.01) out.push([at, Math.PI]);
  return out;
}

// `fixed` is merged with the city's still parts; `g` holds the live ones (the crowd).
// (lx, lz) is the middle in the city's own frame, `turn` the Colosseum's turn, `y` its floor's height
// in the city's frame, and (cx, cityY, cz) the city's middle in the world (for the solid parts).
export function buildColosseum({ fixed, g, lx, lz, turn, y, cx, cz, cityY, solid, matOf, textTexture, lazyCharacter, buildCharacter, bodyHeight, races }) {
  const col = new THREE.Group();
  col.position.set(lx, y, lz);
  col.rotation.y = turn;
  fixed.add(col);
  const live = new THREE.Group();
  live.position.copy(col.position); live.rotation.y = turn;
  g.add(live);
  const stone = matOf('#c9b48e', 0.95), dark = matOf('#a89270', 0.95), deep = matOf('#3a2e24', 1), sand = matOf('#d9c28c', 1);
  const cap = matOf('#b8a27c', 0.9), cloth = matOf('#8a1f1a', 0.8, { side: THREE.DoubleSide }), gold = matOf('#c8a040', 0.5, { metalness: 0.4 });
  const mesh = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; col.add(o); return o; };
  const footY = cityY + y; // the floor in the world
  const c = Math.cos(turn), s = Math.sin(turn);
  // the Colosseum's own (r, angle) to the world
  const world = (r, a) => { const x = Math.sin(a) * r, z = Math.cos(a) * r; return { x: cx + lx + x * c + z * s, z: cz + lz - x * s + z * c }; };
  const put = (r, a, rad, height, y0 = 0) => { const w = world(r, a); solid.push({ x: w.x, z: w.z, r: rad, kind: 'wall', height, y: footY + y0 }); };

  // ---------- the sand floor and the wall round it ----------
  const floor = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R + 0.3, 64), matOf('#d9c28c', 1, { polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -32 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.05; floor.receiveShadow = true;
  col.add(floor);
  // sand all the way out under the gates' tunnels too
  for (const ga of GATES) {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(GATE_HALF * 2, WALL_R1 + 2 - FLOOR_R), matOf('#d9c28c', 1, { polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -32 }));
    lane.rotation.x = -Math.PI / 2; lane.rotation.z = ga;
    const mid = (FLOOR_R + WALL_R1 + 2) / 2;
    lane.position.set(Math.sin(ga) * mid, 0.05, Math.cos(ga) * mid); lane.receiveShadow = true;
    col.add(lane);
  }
  for (const [a0, a1] of between(FLOOR_R + 0.5)) {
    mesh(arcSolid(FLOOR_R, PODIUM_R, a0, a1, PARAPET_H), dark);
    mesh(arcSolid(FLOOR_R - 0.05, PODIUM_R + 0.05, a0, a1, PARAPET_H + 0.18, PARAPET_H), cap);
    // the wall stops fighters on the floor and spectators in the front row alike
    for (let a = a0 + 0.04; a < a1; a += 0.9 / FLOOR_R) put((FLOOR_R + PODIUM_R) / 2, a, 0.6, PARAPET_H + 0.2);
  }

  // ---------- the stands: twelve rows of stone seats ----------
  for (let k = 0; k < ROWS; k++) {
    const r0 = rowR(k), r1 = k === ROWS - 1 ? WALL_R0 : rowR(k + 1);
    for (const [a0, a1] of between((r0 + r1) / 2)) mesh(arcSolid(r0, r1, a0, a1, rowY(k)), k % 2 ? stone : dark);
  }
  // the sides of each gate's cut through the stands: solid all the way up, for those below and above
  for (const ga of GATES) {
    for (const side of [-1, 1]) {
      for (let r = PODIUM_R - 0.6; r < WALL_R1; r += 0.8) {
        const lat = side * (GATE_HALF + 0.45);
        put(Math.hypot(r, lat), ga + Math.atan2(lat, r), 0.42, TOP_Y + 1.4);
      }
    }
  }

  // ---------- the great outer wall: three tiers of arches ----------
  const doorCuts = [[DOOR_A - DOOR_HALF, DOOR_A + DOOR_HALF], [-DOOR_A - DOOR_HALF, -DOOR_A + DOOR_HALF]];
  for (const [a0, a1] of between(WALL_R1, 0, doorCuts)) {
    mesh(arcSolid(WALL_R0, WALL_R1, a0, a1, WALL_H), stone);
    mesh(arcSolid(WALL_R0 - 0.2, WALL_R1 + 0.25, a0, a1, WALL_H + 0.7, WALL_H), cap);
    for (let a = a0 + 0.02; a < a1; a += 1.1 / WALL_R1) put((WALL_R0 + WALL_R1) / 2, a, 1.15, WALL_H);
  }
  // over each gate: the wall goes on above the tunnel, with the gate's name board on the city side
  for (const ga of GATES) {
    const half = GATE_HALF / WALL_R1;
    mesh(arcSolid(WALL_R0, WALL_R1, ga - half - 0.01, ga + half + 0.01, WALL_H, GATE_H), stone);
    mesh(arcSolid(WALL_R0 - 0.2, WALL_R1 + 0.25, ga - half - 0.01, ga + half + 0.01, WALL_H + 0.7, WALL_H), cap);
    for (let a = ga - half; a <= ga + half + 0.001; a += 0.8 / WALL_R1) put((WALL_R0 + WALL_R1) / 2, a, 1.1, WALL_H - GATE_H, GATE_H);
    // the arch round the gate
    for (const sd of [-1, 1]) mesh(arcSolid(WALL_R1, WALL_R1 + 0.5, ga + sd * half - 0.04, ga + sd * half + 0.04, GATE_H + 0.6), cap);
    mesh(arcSolid(WALL_R1, WALL_R1 + 0.5, ga - half - 0.04, ga + half + 0.04, GATE_H + 1.2, GATE_H), cap);
  }
  // over and under the doors at the top of the stairways
  for (const sd of [-1, 1]) {
    const a0 = sd * DOOR_A - DOOR_HALF, a1 = sd * DOOR_A + DOOR_HALF;
    mesh(arcSolid(WALL_R0, WALL_R1, a0, a1, TOP_Y), stone);
    mesh(arcSolid(WALL_R0, WALL_R1, a0, a1, WALL_H, TOP_Y + 3.2), stone);
    mesh(arcSolid(WALL_R0 - 0.2, WALL_R1 + 0.25, a0, a1, WALL_H + 0.7, WALL_H), cap);
    for (let a = a0; a <= a1 + 0.001; a += 0.9 / WALL_R1) { put((WALL_R0 + WALL_R1) / 2, a, 1.1, TOP_Y); put((WALL_R0 + WALL_R1) / 2, a, 1.1, WALL_H - TOP_Y - 3.2, TOP_Y + 3.2); }
  }
  // the arches: dark openings between pillars, three tiers, all the way round (not over the gates,
  // the doors or behind the stairways)
  const BAYS = 40, tiers = [[1.2, 3.6], [6, 3.2], [10.4, 3]];
  const archGeo = new THREE.BoxGeometry(2.4, 1, 0.3), pillarGeo = new THREE.BoxGeometry(0.7, 1, 0.5);
  for (let i = 0; i < BAYS; i++) {
    const a = -Math.PI + ((i + 0.5) / BAYS) * Math.PI * 2;
    const pa = -Math.PI + (i / BAYS) * Math.PI * 2;
    if (inGate(WALL_R1, a, 1.6) || Math.abs(Math.abs(a) - DOOR_A) < DOOR_HALF + 0.08) continue;
    const behindStairs = Math.abs(a) > RAMP_A0 - 0.05 && Math.abs(a) < LANDING_A1 + 0.05;
    for (const [t, [y0, h]] of tiers.entries()) {
      if (behindStairs && y0 < TOP_Y + 1) continue;
      const o = new THREE.Mesh(archGeo, deep);
      o.scale.y = h; o.position.set(Math.sin(a) * (WALL_R1 + 0.02), y0 + h / 2, Math.cos(a) * (WALL_R1 + 0.02)); o.rotation.y = a;
      col.add(o);
      const p = new THREE.Mesh(pillarGeo, t === 1 ? cap : dark);
      p.scale.y = h + 0.8; p.position.set(Math.sin(pa) * (WALL_R1 + 0.15), y0 + h / 2 + 0.1, Math.cos(pa) * (WALL_R1 + 0.15)); p.rotation.y = pa;
      p.castShadow = true; col.add(p);
    }
  }
  // tall masts round the top with red banners
  for (let i = 0; i < 16; i++) {
    const a = ((i + 0.5) / 16) * Math.PI * 2;
    if (inGate(WALL_R0, a, 2)) continue;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5, 6), deep);
    m.position.set(Math.sin(a) * ((WALL_R0 + WALL_R1) / 2), WALL_H + 0.7 + 2.5, Math.cos(a) * ((WALL_R0 + WALL_R1) / 2));
    col.add(m);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), cloth);
    b.position.set(m.position.x + Math.cos(a) * 0.5, WALL_H + 0.7 + 3.6, m.position.z - Math.sin(a) * 0.5); b.rotation.y = a + Math.PI / 2;
    col.add(b);
  }
  // the name over the city gate, and gold shields over the others
  {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), new THREE.MeshBasicMaterial({ map: textTexture('The Colosseum'), transparent: true }));
    sign.position.set(0, GATE_H + 2.2, WALL_R1 + 0.55);
    col.add(sign);
    for (const ga of GATES.slice(1)) {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 16), gold);
      sh.rotation.order = 'YXZ'; sh.rotation.set(Math.PI / 2, ga, 0);
      sh.position.set(Math.sin(ga) * (WALL_R1 + 0.6), GATE_H + 2, Math.cos(ga) * (WALL_R1 + 0.6));
      col.add(sh);
    }
  }

  // ---------- the two stairways up the outside, and their landings ----------
  for (const sd of [-1, 1]) {
    const a0 = sd > 0 ? RAMP_A0 : -RAMP_A1, a1 = sd > 0 ? RAMP_A1 : -RAMP_A0;
    mesh(arcSolid(RAMP_R0, RAMP_R1, a0, a1, (a) => rampY(a) + 0.02, 0, 0.8), dark);
    const l0 = sd > 0 ? RAMP_A1 : -LANDING_A1, l1 = sd > 0 ? LANDING_A1 : -RAMP_A1;
    mesh(arcSolid(WALL_R1 - 0.05, RAMP_R1, l0, l1, TOP_Y + 0.02), dark);
    // a stone rail along the outer edge, and across the far end of the landing
    mesh(arcSolid(RAMP_R1, RAMP_R1 + 0.3, a0, l1 > a1 ? l1 : a1, (a) => (Math.abs(a) > RAMP_A1 ? TOP_Y : rampY(a)) + 1.05, 0, 0.8), cap);
    if (sd < 0) mesh(arcSolid(RAMP_R1, RAMP_R1 + 0.3, l0, a0, TOP_Y + 1.05), cap);
    const end = sd * (LANDING_A1 + 0.01);
    mesh(arcSolid(WALL_R1, RAMP_R1 + 0.3, end - 0.012, end + 0.012, TOP_Y + 1.05), cap);
    // solid underneath (for those walking past at the bottom), and the rails for those on top
    for (let a = RAMP_A0; a <= LANDING_A1; a += 0.9 / RAMP_R1) {
      const h = a > RAMP_A1 ? TOP_Y : rampY(a);
      put((RAMP_R0 + RAMP_R1) / 2, sd * a, 1.35, Math.max(0.05, h - 0.05));
      put(RAMP_R1 + 0.2, sd * a, 0.3, h + 1.2);
    }
    for (let r = WALL_R1; r <= RAMP_R1 + 0.2; r += 0.6) put(r, end, 0.3, TOP_Y + 1.2);
  }

  // ---------- the crowd: townsfolk sitting in the stands ----------
  const crowd = [];
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const seatAt = (k, a) => ({ r: rowR(k) + 0.35, a, y: rowY(k) });
  for (let i = 0; i < 64; i++) {
    const k = Math.floor(rnd() * ROWS), a = -Math.PI + rnd() * Math.PI * 2;
    const st = seatAt(k, a);
    if (inGate(st.r, a, 1)) continue;
    const race = races[i % races.length];
    const h = bodyHeight(race, 'humanoid');
    const body = lazyCharacter(() => {
      const b = buildCharacter({ race, form: 'humanoid', look: {} });
      for (const leg of b.userData.rig?.legs || []) { leg.hip.rotation.x = -1.45; leg.knee.rotation.x = 1.45; }
      return b;
    }, h);
    body.position.set(Math.sin(a) * st.r, st.y - h * 0.27, Math.cos(a) * st.r);
    body.rotation.y = a + Math.PI; // facing the floor
    live.add(body);
    crowd.push({ body, phase: rnd() * 6.28, loud: rnd() });
  }

  // ---------- standing on it ----------
  // the height of what you stand on at (x, z) in the world, or undefined for the plain ground
  const local = (x, z) => {
    const dx = x - (cx + lx), dz = z - (cz + lz);
    const ux = dx * c - dz * s, uz = dx * s + dz * c;
    return { r: Math.hypot(ux, uz), a: Math.atan2(ux, uz) };
  };
  function topAt(x, z) {
    const { r, a } = local(x, z);
    if (r < PODIUM_R || r > RAMP_R1 + 0.4) return undefined;
    if (r < WALL_R0) {
      if (inGate(r, a, 0.3)) return undefined;
      return footY + rowY(Math.min(ROWS - 1, Math.floor((r - PODIUM_R) / ROW_D)));
    }
    const aa = Math.abs(a);
    if (aa >= RAMP_A1 && aa <= LANDING_A1 + 0.02) return footY + TOP_Y; // the landing and its door
    if (r >= RAMP_R0 - 0.1 && aa >= RAMP_A0 && aa < RAMP_A1) return footY + rampY(a);
    return undefined;
  }
  // the seat in front of you, if you're standing in a row: sit on its front edge, facing the floor
  function seatNear(x, z, y) {
    const { r, a } = local(x, z);
    if (r < PODIUM_R || r >= WALL_R0 || inGate(r, a, 0.3)) return null;
    const k = Math.min(ROWS - 1, Math.floor((r - PODIUM_R) / ROW_D));
    if (Math.abs(y - (footY + rowY(k))) > 1) return null;
    const w = world(rowR(k) + 0.35, a);
    const mid = world(0, 0);
    return { x: w.x, y: footY + rowY(k) - 0.5, z: w.z, heading: Math.atan2(mid.x - w.x, mid.z - w.z) };
  }
  let roar = 0;
  return {
    topAt, seatNear,
    centre: { ...world(0, 0), y: footY },
    // the notice board outside the city gate (challenges, the fights on now, the championship)
    board: world(WALL_R1 + 5, 0.16),
    // `cheer`: a fight is on, the crowd is on its feet
    cheer(on) { roar = on ? 1 : 0; },
    update(t) {
      for (const p of crowd) {
        const rig = p.body.userData.rig;
        if (!rig?.arms) continue;
        const up = roar && Math.sin(t * (2 + p.loud * 2) + p.phase) > 0.2 - p.loud * 0.6;
        for (const arm of rig.arms) arm.shoulder.rotation.x = up ? -2.6 + Math.sin(t * 9 + p.phase) * 0.25 : -0.35;
      }
    },
  };
}

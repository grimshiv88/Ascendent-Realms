// A farmstead (see data/farms.mjs): a fenced vegetable field in rows (carrots, cabbages, wheat,
// lettuce, potatoes, onions, pumpkins, turnips), a pen of farm animals and a chicken yard, a red
// barn with hay bales, the farmer's Farm Stand, the Halal Butcher's shed and a cooking fire.
// The animals themselves are spawned by world.js (creatures), penned in by `pens`.
import * as THREE from 'three';
import { LAYOUT, farmToWorld, farmBox } from '../data/farms.mjs';
import { textTexture } from './spawn.js';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { wearGear } from '../characters/gear.js';
import { ITEMS } from '../data/items.mjs';
import { VISITOR_BEDS, BED_W, BED_D } from '../data/crops.mjs';

const mats = new Map();
const mat = (color, rough = 0.9, extra = {}) => {
  const k = `${color}|${rough}|${JSON.stringify(extra)}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));
  return mats.get(k);
};
function box(w, h, d, m, parent, x, y, z, ry = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true;
  parent.add(o);
  return o;
}

// one kind of crop: many plants drawn at once (leaves, and the vegetable if it shows)
const CROPS = {
  carrot: { leaf: '#4a8a2a', leafGeo: () => new THREE.ConeGeometry(0.12, 0.35, 5), leafY: 0.18, veg: '#e07020', vegGeo: () => new THREE.ConeGeometry(0.035, 0.08, 6), vegY: 0.02, vegRx: Math.PI },
  cabbage: { leaf: '#6aa04a', leafGeo: () => new THREE.SphereGeometry(0.2, 8, 6), leafY: 0.16, leafScale: [1, 0.75, 1] },
  wheat: { leaf: '#d8b85a', leafGeo: () => new THREE.CylinderGeometry(0.08, 0.04, 0.95, 5), leafY: 0.47, gap: 0.3 },
  lettuce: { leaf: '#8ac85a', leafGeo: () => new THREE.SphereGeometry(0.15, 7, 5), leafY: 0.1, leafScale: [1, 0.6, 1] },
  potato: { leaf: '#3a6a2a', leafGeo: () => new THREE.DodecahedronGeometry(0.2, 0), leafY: 0.2 },
  onion: { leaf: '#5a9a3a', leafGeo: () => new THREE.ConeGeometry(0.06, 0.4, 4), leafY: 0.2, veg: '#e8dcb0', vegGeo: () => new THREE.SphereGeometry(0.06, 6, 5), vegY: 0.03 },
  pumpkin: { leaf: '#3a7a2a', leafGeo: () => new THREE.SphereGeometry(0.28, 7, 4), leafY: 0.05, leafScale: [1, 0.3, 1], veg: '#e0801a', vegGeo: () => new THREE.SphereGeometry(0.24, 10, 8), vegY: 0.18, vegScale: [1, 0.75, 1], every: 3, gap: 1 },
  turnip: { leaf: '#4a8a3a', leafGeo: () => new THREE.ConeGeometry(0.13, 0.3, 5), leafY: 0.2, veg: '#c890b8', vegGeo: () => new THREE.SphereGeometry(0.08, 7, 6), vegY: 0.05 },
};
const ROWS = ['carrot', 'carrot', 'cabbage', 'wheat', 'wheat', 'wheat', 'lettuce', 'potato', 'onion', 'pumpkin', 'turnip', 'cabbage', 'carrot', 'wheat'];

// One bed of a crop you planted (see world/crops.js): `k` is how far it has grown (0 to 1). The
// plants grow from little shoots; the vegetables show once it is ripe. Stands on the bed's top.
export function bedPlants(id, k) {
  const c = CROPS[id];
  const g = new THREE.Group();
  if (!c) return g;
  const few = id === 'pumpkin';
  const spots = few ? [[-0.45, -0.5], [0.45, 0.5]] : [];
  if (!few) for (const x of [-0.5, 0.5]) for (const z of [-0.75, -0.25, 0.25, 0.75]) spots.push([x, z]);
  const s = 0.2 + 0.8 * Math.min(1, k);
  const leafM = mat(k < 0.25 ? '#7ab84a' : c.leaf, 0.85);
  for (const [x, z] of spots) {
    const leaf = new THREE.Mesh(c.leafGeo(), leafM);
    leaf.scale.set(...(c.leafScale || [1, 1, 1])).multiplyScalar(s);
    leaf.position.set(x, c.leafY * s, z);
    leaf.rotation.y = (x * 7 + z * 13) % 6.28;
    leaf.castShadow = true;
    g.add(leaf);
    if (c.veg && k >= 1) {
      const v = new THREE.Mesh(c.vegGeo(), mat(c.veg, 0.7));
      v.scale.set(...(c.vegScale || [1, 1, 1]));
      v.position.set(x, c.vegY + 0.03, z);
      v.rotation.x = c.vegRx || 0;
      g.add(v);
    }
  }
  // ripe wheat turns gold and heavy at the top
  if (id === 'wheat' && k >= 1) g.traverse((o) => { if (o.isMesh) o.material = mat('#e8c860', 0.8); });
  return g;
}
// a bed of tilled earth with a low wooden edge (its top is at y = 0.16)
export function bedSoil(w = BED_W, d = BED_D) {
  const g = new THREE.Group();
  const soil = box(w - 0.15, 0.14, d - 0.15, mat('#4a3220', 1), g, 0, 0.08, 0); soil.castShadow = false;
  for (const z of [-0.6, -0.2, 0.2, 0.6]) box(w - 0.3, 0.04, 0.12, mat('#5a3e26', 1), g, 0, 0.16, z * (d / 2)).castShadow = false;
  const edge = mat('#7a5a3a');
  for (const s of [-1, 1]) { box(w, 0.2, 0.08, edge, g, 0, 0.1, s * d / 2); box(0.08, 0.2, d, edge, g, s * w / 2, 0.1, 0); }
  return g;
}

function fieldOf(g, solid, f, toW) {
  const F = LAYOUT.field;
  // tilled earth in ridges
  box(F.hx * 2, 0.06, F.hz * 2, mat('#5a3e26', 1), g, F.x, 0.03, F.z).castShadow = false;
  const rowGap = (F.hx * 2 - 1) / ROWS.length;
  const per = {};
  ROWS.forEach((id, r) => {
    const x = F.x - F.hx + 0.8 + r * rowGap;
    box(0.55, 0.12, F.hz * 2 - 1.2, mat('#4a3220', 1), g, x, 0.08, F.z).castShadow = false;
    const c = CROPS[id], gap = c.gap || 0.55;
    for (let z = F.z - F.hz + 1; z <= F.z + F.hz - 1; z += gap) (per[id] ||= []).push([x + (Math.random() - 0.5) * 0.08, z + (Math.random() - 0.5) * 0.1]);
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [id, spots] of Object.entries(per)) {
    const c = CROPS[id];
    const leaves = new THREE.InstancedMesh(c.leafGeo(), mat(c.leaf, 0.85), spots.length);
    const veg = c.veg ? new THREE.InstancedMesh(c.vegGeo(), mat(c.veg, 0.7), spots.length) : null;
    spots.forEach(([x, z], i) => {
      const k = 0.8 + Math.random() * 0.4;
      e.set((Math.random() - 0.5) * 0.15, Math.random() * 6.28, (Math.random() - 0.5) * 0.15);
      q.setFromEuler(e);
      sc.set(...(c.leafScale || [1, 1, 1])).multiplyScalar(k);
      leaves.setMatrixAt(i, m4.compose(p.set(x, 0.14 + c.leafY * k, z), q, sc));
      if (veg) {
        e.set(c.vegRx || 0, Math.random() * 6.28, 0); q.setFromEuler(e);
        sc.set(...(c.vegScale || [1, 1, 1])).multiplyScalar(k);
        const show = !c.every || i % c.every === 0;
        veg.setMatrixAt(i, m4.compose(p.set(x, show ? 0.14 + c.vegY * k : -5, z), q, sc));
      }
    });
    leaves.castShadow = true; g.add(leaves);
    if (veg) { veg.castShadow = true; g.add(veg); }
  }
  fence(g, solid, toW, F.x, F.z, F.hx + 0.6, F.hz + 0.6, 'front');
  // a scarecrow keeps watch
  const sc2 = new THREE.Group(); sc2.position.set(F.x + 1.5, 0, F.z - 2); g.add(sc2);
  box(0.12, 2.3, 0.12, mat('#6a4a2a'), sc2, 0, 1.15, 0);
  box(1.6, 0.1, 0.1, mat('#6a4a2a'), sc2, 0, 1.7, 0);
  box(0.6, 0.7, 0.3, mat('#8a6a3a'), sc2, 0, 1.55, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat('#d8c08a')); head.position.y = 2.15; sc2.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.35, 8), mat('#5a4a2a')); hat.position.y = 2.42; sc2.add(hat);
}

// a wooden fence round a box (half sizes hx, hz), with a gate gap on one side; solid all round
function fence(g, solid, toW, cx, cz, hx, hz, gateSide = 'front') {
  const post = mat('#6a4a2c'), rail = mat('#8a6a44');
  const parts = (g.userData.parts ||= []);
  const sides = [
    ['front', [cx - hx, cz + hz], [cx + hx, cz + hz]], ['back', [cx - hx, cz - hz], [cx + hx, cz - hz]],
    ['left', [cx - hx, cz - hz], [cx - hx, cz + hz]], ['right', [cx + hx, cz - hz], [cx + hx, cz + hz]],
  ];
  for (const [name, [x0, z0], [x1, z1]] of sides) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(x1 - x0, z1 - z0);
    const at = (k) => [x0 + ((x1 - x0) * k) / len, z0 + ((z1 - z0) * k) / len];
    // the fence runs in one piece, or in two either side of the gate: each run has its own posts
    // (a stout gatepost at each side of the opening) and rails right up to them, and is solid
    // exactly where it stands, so there is no unseen wall and no gap without a rail
    const runs = name === gateSide ? [[0, len / 2 - 1.3], [len / 2 + 1.3, len]] : [[0, len]];
    for (const [r0, r1] of runs) {
      const rl = r1 - r0, segs = Math.max(1, Math.ceil(rl / 2.2));
      // each stretch between two posts is one part: an animal running into it hard enough knocks it
      // down (see world.js onCrash); it is put back up after a while
      const segOf = [];
      for (let i = 0; i < segs; i++) { const part = { name: 'fence', hp: 120, maxHp: 120, meshes: [], solid: [], broken: false }; segOf.push(part); parts.push(part); }
      for (let i = 0; i <= segs; i++) {
        const k = r0 + (i / segs) * rl;
        const [x, z] = at(k);
        const gatepost = runs.length > 1 && ((i === 0 && r0 > 0) || (i === segs && r1 < len));
        const p = gatepost ? box(0.2, 1.45, 0.2, post, g, x, 0.72, z) : box(0.14, 1.25, 0.14, post, g, x, 0.62, z);
        if (i > 0) segOf[i - 1].meshes.push(p);
        if (i < segs) {
          const [mx, mz] = at(k + rl / segs / 2);
          for (const y of [0.45, 0.95]) segOf[i].meshes.push(box(0.06, 0.1, rl / segs, rail, g, mx, y, mz, ry));
        }
      }
      for (let k = r0; k <= r1 + 0.01; k += Math.min(0.45, rl)) {
        const [lx, lz] = at(Math.min(k, r1));
        const w = toW(lx, lz);
        const e = { x: w.x, z: w.z, r: 0.25, kind: 'wall', height: 1.25 };
        e.part = segOf[Math.min(segs - 1, Math.floor(((k - r0) / rl) * segs))];
        e.part.solid.push(e);
        solid.push(e);
      }
    }
  }
}

// The stable: a red barn you can walk into. Its big double doors swing open as you come up to
// them. Inside, on a straw floor, are three stalls along the back wall, each with a manger of hay
// and a water bucket: the farm's horses and donkey sleep here at night, safe from the monsters
// (see husbandry.js), and go back out to the pen in the morning.
const DOOR_W = 3.2, DOOR_H = 3.3, WALL_T = 0.2;
function barn(g, solid, toW) {
  const B = LAYOUT.barn, W = B.w, D = B.d, H = 4.2;
  const b = new THREE.Group(); b.position.set(B.x, 0, B.z); g.add(b);
  const red = mat('#8a2a1e', 0.85), inner = mat('#6e3a26', 0.9), white = mat('#ece4d4', 0.8), roof = mat('#4a3a30', 0.9);
  const plank = mat('#7a5a3a'), dark = mat('#5a3e26');
  // the walls (hollow now): back, two sides, and the front either side of the doorway and over it
  box(W, H, WALL_T, red, b, 0, H / 2, -D / 2 + WALL_T / 2);
  for (const s of [-1, 1]) box(WALL_T, H, D, red, b, s * (W / 2 - WALL_T / 2), H / 2, 0);
  const side = (W - DOOR_W) / 2;
  for (const s of [-1, 1]) box(side, H, WALL_T, red, b, s * (DOOR_W / 2 + side / 2), H / 2, D / 2 - WALL_T / 2);
  box(DOOR_W, H - DOOR_H, WALL_T, red, b, 0, DOOR_H + (H - DOOR_H) / 2, D / 2 - WALL_T / 2);
  // a darker inside skin, so the walls read from within, and a ceiling of boards at the eaves
  box(W - WALL_T * 2 - 0.02, H - 0.02, 0.02, inner, b, 0, H / 2, -D / 2 + WALL_T + 0.01).castShadow = false;
  const ceil = box(W - WALL_T * 2, 0.08, D - WALL_T * 2, dark, b, 0, H - 0.04, 0); ceil.castShadow = false;
  // gable ends and a roof of two slopes
  const rise = D * 0.32, slope = Math.hypot(D / 2, rise) + 0.35, tilt = Math.atan2(rise, D / 2);
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rise)]);
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#8a2a1e', roughness: 0.85, side: THREE.DoubleSide }));
    gable.rotation.y = Math.PI / 2; gable.position.set(s * W / 2, H, 0); b.add(gable);
    const r = box(W + 0.6, 0.22, slope, roof, b, 0, H + rise / 2 + 0.05, s * D / 4);
    r.rotation.x = s * tilt;
  }
  // white trim round the doorway
  for (const s of [-1, 1]) box(0.16, DOOR_H + 0.1, 0.12, white, b, s * (DOOR_W / 2 + 0.08), DOOR_H / 2, D / 2 + 0.02);
  box(DOOR_W + 0.32, 0.16, 0.12, white, b, 0, DOOR_H + 0.05, D / 2 + 0.02);
  // the two door leaves, each hung on its own hinge at the side of the doorway, with white braces
  const doors = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(s * DOOR_W / 2, 0, D / 2 + 0.06); b.add(hinge);
    const leaf = DOOR_W / 2 - 0.02, mid = -s * leaf / 2;
    box(leaf, DOOR_H - 0.05, 0.1, mat('#6a1a14'), hinge, mid, DOOR_H / 2, 0);
    const brace = Math.hypot(leaf - 0.2, DOOR_H - 0.4);
    box(0.13, brace, 0.04, white, hinge, mid, DOOR_H / 2, 0.07).rotation.z = s * Math.atan2(leaf - 0.2, DOOR_H - 0.4);
    for (const y of [0.25, DOOR_H - 0.3]) box(leaf - 0.05, 0.13, 0.04, white, hinge, mid, y, 0.07);
    doors.push({ hinge, s, open: 0 });
  }
  // straw on the floor
  box(W - WALL_T * 2, 0.04, D - WALL_T * 2, mat('#b89a58', 1), b, 0, 0.02, 0).castShadow = false;
  // three stalls along the back wall: low plank walls between them, a manger of hay and a bucket
  const STALL_D = 3.2, n = 3, sw = (W - WALL_T * 2) / n;
  const stalls = [];
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + WALL_T + sw * (i + 0.5);
    if (i > 0) {
      const px = x - sw / 2;
      box(0.1, 1.4, STALL_D, plank, b, px, 0.7, -D / 2 + WALL_T + STALL_D / 2);
      box(0.16, 1.7, 0.16, dark, b, px, 0.85, -D / 2 + WALL_T + STALL_D);
    }
    // the manger against the back wall, heaped with hay
    box(sw - 0.6, 0.5, 0.5, dark, b, x, 0.75, -D / 2 + WALL_T + 0.3);
    const hay = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.75, 0.25, 0.4), mat('#d8b860', 1)); hay.position.set(x, 1.05, -D / 2 + WALL_T + 0.3); b.add(hay);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.35, 10), mat('#6a5a4a', 0.7)); bucket.position.set(x + sw / 2 - 0.4, 0.18, -D / 2 + WALL_T + 0.35); b.add(bucket);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.18, 10), mat('#4a7a9a', 0.2)); water.rotation.x = -Math.PI / 2; water.position.set(bucket.position.x, 0.34, bucket.position.z); b.add(water);
    stalls.push({ lx: B.x + x, lz: B.z - D / 2 + WALL_T + STALL_D / 2 + 0.2, hw: sw / 2 - 0.55, hd: STALL_D / 2 - 0.6 });
  }
  // hay bales stacked inside by the door, and a couple outside
  for (const [x, z, y] of [[W / 2 - 1, D / 2 - 1.2, 0.4], [W / 2 - 1, D / 2 - 2.3, 0.4], [W / 2 - 1, D / 2 - 1.75, 1.15], [-W / 2 - 0.9, D / 2 + 0.2, 0.4]]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 12), mat('#d8b860', 1));
    h.rotation.z = Math.PI / 2; h.position.set(x, y, z); h.castShadow = true; b.add(h);
  }
  // a lantern hanging from the ceiling, lit at night (see update)
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), new THREE.MeshStandardMaterial({ color: '#ffd890', emissive: '#ffb040', emissiveIntensity: 0 }));
  lamp.position.set(0, H - 0.6, 0); b.add(lamp);
  const glow = new THREE.PointLight('#ffc070', 0, 12, 1.6); glow.position.set(0, H - 0.9, 0); b.add(glow);
  // solid: the walls (not the doorway), the stall walls and the mangers
  const w = (lx, lz) => toW(B.x + lx, B.z + lz);
  const put = (lx, lz, r = 0.3, h = H) => { const p = w(lx, lz); solid.push({ x: p.x, z: p.z, r, kind: 'wall', height: h }); };
  for (let x = -W / 2 + 0.15; x <= W / 2 - 0.15; x += 0.45) {
    put(x, -D / 2 + 0.15);
    if (Math.abs(x) > DOOR_W / 2 + 0.1) put(x, D / 2 - 0.15);
  }
  for (let z = -D / 2 + 0.15; z <= D / 2 - 0.15; z += 0.45) for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) put(x, z);
  for (let i = 1; i < n; i++) for (let z = 0; z <= STALL_D; z += 0.4) put(-W / 2 + WALL_T + sw * i, -D / 2 + WALL_T + z, 0.18, 1.4);
  for (let i = 0; i < n; i++) for (const dx of [-0.6, 0, 0.6]) put(-W / 2 + WALL_T + sw * (i + 0.5) + dx, -D / 2 + WALL_T + 0.3, 0.3, 1);
  put(W / 2 - 1, D / 2 - 1.75, 0.6, 1.6);
  return { doors, stalls, lamp, glow, door: w(0, D / 2 + 0.3) };
}

function pen(g, solid, toW, P, coop = false) {
  fence(g, solid, toW, P.x, P.z, P.hx, P.hz, coop ? 'left' : 'front');
  // straw on the ground, a water trough
  box(P.hx * 2 - 0.4, 0.03, P.hz * 2 - 0.4, mat(coop ? '#a8884a' : '#7a6a3a', 1), g, P.x, 0.02, P.z).castShadow = false;
  if (coop) {
    const c = new THREE.Group(); c.position.set(P.x + P.hx - 1.4, 0, P.z - P.hz + 1.2); g.add(c);
    box(2.2, 1.3, 1.6, mat('#9a7a4a'), c, 0, 0.9, 0);
    for (const k of [-0.6, -0.3, 0, 0.3, 0.6]) box(0.08, 0.6, 0.08, mat('#6a4a2c'), c, k * 1.4, 0.3, k > 0 ? 0.7 : -0.7);
    const r = box(2.5, 0.12, 1.1, mat('#5a3a2a'), c, 0, 1.8, 0.35); r.rotation.x = 0.5;
    const r2 = box(2.5, 0.12, 1.1, mat('#5a3a2a'), c, 0, 1.8, -0.35); r2.rotation.x = -0.5;
    const p = toW(c.position.x, c.position.z); solid.push({ x: p.x, z: p.z, r: 1.1, kind: 'wall', height: 2 });
  } else {
    const t = new THREE.Group(); t.position.set(P.x - P.hx + 1.2, 0, P.z); g.add(t);
    box(0.7, 0.55, 3, mat('#6a4a2c'), t, 0, 0.3, 0);
    box(0.5, 0.05, 2.8, mat('#4a7a9a', 0.2, { metalness: 0.1 }), t, 0, 0.52, 0);
    const p = toW(t.position.x, t.position.z); for (const dz of [-1, 0, 1]) { const q = toW(t.position.x, t.position.z + dz); solid.push({ x: q.x, z: q.z, r: 0.45, kind: 'wall', height: 0.6, step: true }); }
    // a hay rack
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 12), mat('#d8b860', 1));
    h.rotation.x = Math.PI / 2; h.position.set(P.x + P.hx - 1.2, 0.6, P.z + 2); h.castShadow = true; g.add(h);
    void p;
  }
}

// a market stall: counter, posts, striped awning, crates of goods, and a sign
// A sign board with the words on both faces, each the right way round (a single two-sided face
// shows the words mirrored from behind)
function twoFacedSign(text, w, h) {
  const tex = textTexture(text, { board: true });
  const g = new THREE.Group();
  for (const side of [1, -1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    face.position.z = side * 0.03;
    if (side < 0) face.rotation.y = Math.PI;
    g.add(face);
  }
  return g;
}

// The awning slopes down to the front: it rests on the tops of the back posts and is tied to the
// front posts, which go on up to hold the sign board well clear above it (nothing covers the words).
const STALL = { front: 1.0, back: -1.4, yFront: 2.5, yBack: 2.9, half: 1.7 };
const awningY = (z) => STALL.yFront + ((STALL.front - z) * (STALL.yBack - STALL.yFront)) / (STALL.front - STALL.back);
// A market stall, built facing +z (its front, where you stand to buy) in its own group: returns
// { group, solid: [[x, z, r, height]] } in the stall's own space. Used at the farms and in the
// cities' markets (city.js).
export function marketStall(label, colors, goods) {
  const s = new THREE.Group();
  const out = [];
  const wood = mat('#7a5a3a'), dark = mat('#5a3e26');
  const { front, back, half } = STALL;
  box(3.4, 1, 0.9, wood, s, 0, 0.5, 0.6);
  // back posts stop right under the cloth; front posts run up past it to carry the sign
  const signY = 3.2, signH = 0.62, postTop = signY + signH / 2 + 0.08;
  for (const x of [-half, half]) {
    box(0.12, awningY(back), 0.12, wood, s, x, awningY(back) / 2, back);
    box(0.12, postTop, 0.12, wood, s, x, postTop / 2, front);
  }
  // the beams the cloth lies on, along the front and the back, and one down each side
  box(half * 2 + 0.12, 0.1, 0.12, dark, s, 0, awningY(front) - 0.08, front);
  box(half * 2 + 0.12, 0.1, 0.12, dark, s, 0, awningY(back) - 0.08, back);
  const run = front - back, tilt = Math.atan2(STALL.yBack - STALL.yFront, run);
  for (const x of [-half, half]) box(0.1, 0.1, Math.hypot(run, STALL.yBack - STALL.yFront), dark, s, x, (awningY(front) + awningY(back)) / 2 - 0.08, (front + back) / 2).rotation.x = tilt;
  // the striped cloth, a little past the posts all round
  const zc = (front + back) / 2 - 0.05, depth = Math.hypot(run + 0.7, (STALL.yBack - STALL.yFront) * (run + 0.7) / run);
  for (let i = 0; i < 6; i++) box(3.7 / 6, 0.05, depth, mat(colors[i % 2], 0.8), s, -3.7 / 2 + 3.7 / 12 + i * (3.7 / 6), awningY(zc) + 0.03, zc).rotation.x = tilt;
  goods.forEach((c, i) => {
    box(0.55, 0.3, 0.45, mat('#9a7a4a'), s, -1.2 + i * 0.6, 1.15, 0.6);
    for (let k = 0; k < 4; k++) { const v = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), mat(c, 0.6)); v.position.set(-1.35 + i * 0.6 + (k % 2) * 0.16, 1.33, 0.5 + Math.floor(k / 2) * 0.16); s.add(v); }
  });
  // the sign between the front posts, on a wooden board with a top rail
  box(half * 2 - 0.1, signH + 0.06, 0.05, dark, s, 0, signY, front);
  const sign = twoFacedSign(label, half * 2 - 0.16, signH);
  sign.position.set(0, signY, front); s.add(sign);
  box(half * 2 + 0.2, 0.1, 0.14, dark, s, 0, postTop + 0.05, front);
  for (const x of [-1.2, 0, 1.2]) out.push([x, 0.6, 0.6, 1]);
  for (const x of [-half, half]) out.push([x, back, 0.15, 2.9]);
  return { group: s, solid: out };
}
function stall(g, solid, toW, S, label, colors, goods) {
  const { group: s, solid: parts } = marketStall(label, colors, goods);
  s.position.set(S.x, 0, S.z); g.add(s);
  for (const [x, z, r, height] of parts) { const p = toW(S.x + x, S.z + z); solid.push({ x: p.x, z: p.z, r, kind: 'wall', height }); }
  return s;
}

function butcherShed(g, solid, toW) {
  const S = LAYOUT.butcher;
  const s = stall(g, solid, toW, S, 'Halal Butcher', ['#f0ece4', '#2a6a3a'], ['#a83a2a', '#b8483a', '#c8a070']);
  // a back wall, a chopping block and the cooling room door
  box(3.4, awningY(-1.5), 0.15, mat('#d8d0c0', 0.8), s, 0, awningY(-1.5) / 2, -1.5);
  box(0.6, 0.8, 0.6, mat('#8a6a4a'), s, 1, 0.4, -0.6);
  box(0.9, 1.9, 0.08, mat('#5a4a3a'), s, -0.9, 0.95, -1.38);
  for (let z = -1.4; z <= 0.6; z += 0.5) for (const x of [-1.8, 1.8]) { const p = toW(S.x + x, S.z + z); solid.push({ x: p.x, z: p.z, r: 0.3, kind: 'wall', height: 2.6 }); }
  for (let x = -1.8; x <= 1.8; x += 0.5) { const p = toW(S.x + x, S.z - 1.45); solid.push({ x: p.x, z: p.z, r: 0.3, kind: 'wall', height: 2.6 }); }
}

// a cooking fire in a ring of stones, with a spit
function fire(g, toW) {
  const F = LAYOUT.fire;
  const f = new THREE.Group(); f.position.set(F.x, 0, F.z); g.add(f);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), mat('#5a5650')); r.position.set(Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7); f.add(r); }
  for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1, 6), mat('#4a3020')); l.rotation.set(Math.PI / 2 - 0.5, (i / 4) * Math.PI * 2, 0); l.position.y = 0.22; f.add(l); }
  for (const x of [-0.85, 0.85]) box(0.06, 1.1, 0.06, mat('#3a2a1a'), f, x, 0.55, 0);
  box(1.9, 0.04, 0.04, mat('#3a2a1a'), f, 0, 1.05, 0);
  const flames = [];
  const fm = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff7a1a', emissiveIntensity: 3, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 3; i++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.05, 0.8 - i * 0.15, 8), fm); fl.position.set((i - 1) * 0.1, 0.5, (i % 2) * 0.08); f.add(fl); flames.push(fl); }
  const light = new THREE.PointLight('#ff9a3c', 14, 14, 1.8); light.position.y = 0.9; f.add(light);
  return { flames, light, at: toW(F.x, F.z) };
}

function person(kind) {
  const body = buildCharacter({ race: kind === 'butcher' ? 'dwarf' : 'elf', form: 'humanoid', look: { hair: kind === 'butcher' ? '#3a2a1a' : '#8a5a2a' } });
  const shirt = kind === 'butcher' ? '#f2f0ea' : '#6a7a3a';
  wearGear(body, { body: { ...ITEMS.linen_shirt, look: { color: shirt } }, legs: { ...ITEMS.wide_trousers, look: { color: '#4a3a2a' } }, head: kind === 'butcher' ? null : { ...ITEMS.felt_hat, look: { color: '#c8a85a', hat: true } } });
  return body;
}

// Build a farm in the world. Returns { group, solid, pens: { pen, yard } (world boxes), npcs, fire, update }
export function buildFarm(f) {
  const g = new THREE.Group();
  g.position.set(f.x, f.flat, f.z);
  g.rotation.y = f.rot;
  g.name = f.id;
  const solid = [];
  const toW = (lx, lz) => farmToWorld(f, lx, lz);
  // grass-free yard round the buildings
  box(40, 0.04, 12, mat('#7a6a4a', 1), g, 0, 0.02, 14).castShadow = false;
  fieldOf(g, solid, f, toW);
  pen(g, solid, toW, LAYOUT.pen);
  pen(g, solid, toW, LAYOUT.yard, true);
  const stable = barn(g, solid, toW);
  stall(g, solid, toW, LAYOUT.stand, 'Farm Stand', ['#e8d8a8', '#5a8a3a'], ['#e07020', '#6aa04a', '#e0801a', '#c83a2a']);
  butcherShed(g, solid, toW);
  const fx = fire(g, toW);
  // the visitors' beds, lent to anyone who wants to grow their own, with a sign
  for (const b of VISITOR_BEDS) { const bed = bedSoil(); bed.position.set(b.x, 0, b.z); g.add(bed); }
  const sign = new THREE.Group(); sign.position.set(-14.4, 0, 10.6); g.add(sign);
  box(0.1, 1.3, 0.1, mat('#6a4a2c'), sign, -0.9, 0.65, 0); box(0.1, 1.3, 0.1, mat('#6a4a2c'), sign, 0.9, 0.65, 0);
  const board = twoFacedSign("Visitors' beds", 2.1, 0.4);
  board.position.set(0, 1.15, 0); sign.add(board);
  for (const s of solid) s.y = f.flat; // (everything stands on the farm's level ground)
  // the farmer behind the stand, the butcher behind the counter, facing the town
  const npcs = [];
  for (const [kind, S, name] of [['farmer', LAYOUT.stand, 'Farmer'], ['butcher', LAYOUT.butcher, 'Halal Butcher']]) {
    const body = person(kind);
    body.position.set(S.x, 0, S.z - 0.4);
    g.add(body);
    const at = toW(S.x, S.z + 1.6); // where you stand to talk (in front of the counter)
    npcs.push({ kind, name, body, x: at.x, z: at.z });
  }
  const P = LAYOUT.pen, Y = LAYOUT.yard;
  return {
    farm: f, group: g, solid, npcs,
    pens: { pen: farmBox(f, P.x, P.z, P.hx - 0.8, P.hz - 0.8), yard: farmBox(f, Y.x, Y.z, Y.hx - 0.6, Y.hz - 0.6) },
    fire: fx.at,
    beds: VISITOR_BEDS.map((b, i) => ({ k: `${f.id}:${i}`, ...toW(b.x, b.z), y: f.flat, farm: f.id })),
    trough: toW(P.x - P.hx + 1.2, P.z),
    // the stalls in the stable, as boxes in the world, for the horses at night
    stalls: stable.stalls.map((q) => farmBox(f, q.lx, q.lz, q.hw, q.hd)),
    update(t, you = null, night = false) {
      // the stable doors swing open while you are near them, and shut behind you
      if (you) {
        const near = Math.hypot(you.x - stable.door.x, you.z - stable.door.z) < 4.2;
        for (const d of stable.doors) {
          const want = near ? 1.45 : 0;
          d.open += (want - d.open) * 0.12;
          d.hinge.rotation.y = d.s * d.open;
        }
      }
      stable.lamp.material.emissiveIntensity = night ? 2.5 : 0;
      stable.glow.intensity = night ? 6 : 0;
      for (const n of npcs) animateCharacter(n.body, t, 0);
      // a fence that was rammed shudders for a moment
      for (const part of g.userData.parts || []) {
        if (!(part.shake > 0) || part.broken) continue;
        part.shake = Math.max(0, part.shake - 0.016);
        const k = Math.sin(t * 60) * part.shake * 0.12;
        for (const o of part.meshes) { o.userData.rz0 ??= o.rotation.z; o.rotation.z = o.userData.rz0 + k; }
      }
      fx.flames.forEach((fl, i) => { fl.scale.y = 0.85 + Math.sin(t * 9 + i * 2) * 0.15; });
      fx.light.intensity = 13 + Math.sin(t * 13) * 2;
    },
  };
}

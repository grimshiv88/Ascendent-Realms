// Trees, rocks, reeds and grass for each terrain tile, chosen by region. Every model is one
// merged mesh with its colours baked in, drawn many times at once (instancing).
import * as THREE from 'three';
import { sample, placesWithPositions, isPrepared, surfaceAt } from '../data/world-layout.mjs';
import { allPortals } from '../data/portals.mjs';

// ---------- building the models ----------

// Merge simple shapes into one geometry with a colour per vertex. `color` may be a function of
// the vertex position, for snow on top of branches and the like.
function merge(parts) {
  const pos = [], nor = [], col = [];
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (const { geo, color, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.scale(...scale);
    g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]);
    g.translate(...at);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      pos.push(v.x, v.y, v.z);
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (typeof color === 'function') color(v, c); else c.set(color);
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// Wobble a shape's vertices so trees and rocks look less perfect.
function roughen(geo, amount, seed = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed) * Math.sin(y * 2.3);
    p.setXYZ(i, x + x * n * amount, y + n * amount * 0.5, z + z * n * amount);
  }
  g.computeVertexNormals();
  return g;
}

const BARK = '#4a3524';
function pineGeo(snowy) {
  const needles = (v, c) => {
    c.set('#2c4628').lerp(new THREE.Color('#3c5a2e'), Math.min(1, Math.max(0, (v.y - 4) / 12)));
    if (snowy && v.y > 0) {
      const top = (v.y % 3.6) / 3.6;
      if (top > 0.45) c.lerp(new THREE.Color('#eef2f6'), 0.85);
    }
  };
  const parts = [{ geo: new THREE.CylinderGeometry(0.2, 0.42, 7, 7), color: BARK, at: [0, 3.5, 0] }];
  for (let k = 0; k < 5; k++) {
    parts.push({ geo: roughen(new THREE.ConeGeometry(3.6 - k * 0.65, 5.2 - k * 0.5, 10, 2), 0.08, k), color: needles, at: [0, 4.2 + k * 2.7, 0] });
  }
  return merge(parts);
}
function oakGeo() {
  const leaf = (v, c) => c.set('#3f5e26').lerp(new THREE.Color('#5d7d34'), Math.min(1, Math.max(0, (v.y - 5) / 5)));
  const parts = [{ geo: new THREE.CylinderGeometry(0.35, 0.65, 6, 8), color: BARK, at: [0, 3, 0] }];
  for (const [x, z, a] of [[1.4, 0.4, 0.7], [-1.2, -0.3, -0.8], [0.2, -1.3, 0.5]]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.12, 0.22, 3, 6), color: BARK, at: [x * 0.6, 5.6, z * 0.6], rot: [z * 0.4, 0, -a] });
  }
  for (const [x, y, z, s] of [[0, 8, 0, 1.3], [2, 7, 0.7, 1], [-1.9, 7.2, -0.6, 1], [0.4, 6.8, -2, 0.95], [-0.6, 9.4, 0.8, 0.85], [1, 8.6, 1.6, 0.8]]) {
    parts.push({ geo: roughen(new THREE.IcosahedronGeometry(2.4, 1), 0.12, x + z), color: leaf, at: [x, y, z], scale: [s, s * 0.85, s] });
  }
  return merge(parts);
}
function deadTreeGeo() {
  const wood = '#6e665c';
  const parts = [{ geo: new THREE.CylinderGeometry(0.12, 0.35, 5, 6), color: wood, at: [0, 2.5, 0], rot: [0.05, 0, 0.08] }];
  for (const [y, a, r] of [[3, 0.9, 0], [3.8, -0.8, 1.5], [4.4, 0.7, 3]]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.05, 0.12, 2.2, 5), color: wood, at: [Math.cos(r) * 0.6, y + 0.6, Math.sin(r) * 0.6], rot: [Math.sin(r) * a, 0, Math.cos(r) * -a] });
  }
  return merge(parts);
}
function swampTreeGeo() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.45, 1.0, 6, 8), color: '#3e3a2a', at: [0, 3, 0] }];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.25, 2.2, 5), color: '#3e3a2a', at: [Math.cos(a) * 0.9, 0.5, Math.sin(a) * 0.9], rot: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9] });
  }
  parts.push({ geo: roughen(new THREE.IcosahedronGeometry(4, 1), 0.15, 3), color: '#4a5a2a', at: [0, 7.4, 0], scale: [1.2, 0.5, 1.2] });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    parts.push({ geo: new THREE.ConeGeometry(0.25, 2.6, 4), color: '#6a7040', at: [Math.cos(a) * 3.6, 5.6, Math.sin(a) * 3.6], rot: [Math.PI, 0, 0] });
  }
  return merge(parts);
}
function glowTreeGeo() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.2, 0.4, 7, 7), color: '#d8d2c0', at: [0, 3.5, 0], rot: [0, 0, 0.06] }];
  for (const [x, y, z, s] of [[0, 8.5, 0, 1.2], [1.5, 7.4, 0.6, 0.9], [-1.4, 7.6, -0.5, 0.9], [0.2, 9.8, 0.4, 0.7]]) {
    parts.push({ geo: roughen(new THREE.IcosahedronGeometry(2.2, 1), 0.1, x), color: (v, c) => c.set('#5fbfa0').lerp(new THREE.Color('#bff0d8'), Math.min(1, Math.max(0, (v.y - 7) / 4))), at: [x, y, z], scale: [s, s, s] });
  }
  return merge(parts);
}
function cactusGeo() {
  const g = '#5a7a3a';
  return merge([
    { geo: new THREE.CylinderGeometry(0.32, 0.38, 4, 10), color: g, at: [0, 2, 0] },
    { geo: new THREE.SphereGeometry(0.32, 10, 6), color: g, at: [0, 4, 0] },
    { geo: new THREE.CylinderGeometry(0.2, 0.22, 1.6, 8), color: g, at: [0.75, 2.6, 0] },
    { geo: new THREE.CylinderGeometry(0.2, 0.2, 0.8, 8), color: g, at: [0.45, 1.9, 0], rot: [0, 0, Math.PI / 2] },
    { geo: new THREE.CylinderGeometry(0.2, 0.22, 1.2, 8), color: g, at: [-0.7, 2.2, 0] },
    { geo: new THREE.CylinderGeometry(0.2, 0.2, 0.7, 8), color: g, at: [-0.4, 1.7, 0], rot: [0, 0, Math.PI / 2] },
  ]);
}
function reedsGeo() {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 0.25 + (i % 3) * 0.2;
    parts.push({ geo: new THREE.ConeGeometry(0.035, 1.6 + (i % 4) * 0.35, 3), color: i % 2 ? '#7a8a4a' : '#6a7a3a', at: [Math.cos(a) * r, 0.9, Math.sin(a) * r], rot: [Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15] });
  }
  parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6), color: '#5a3a22', at: [0.3, 2.05, 0] });
  return merge(parts);
}
function youngTreeGeo() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.07, 0.12, 2, 6), color: BARK, at: [0, 1, 0] }];
  for (let k = 0; k < 3; k++) {
    parts.push({ geo: roughen(new THREE.ConeGeometry(1.1 - k * 0.28, 1.6 - k * 0.2, 8), 0.06, k), color: k % 2 ? '#3f6030' : '#4a6e34', at: [0, 1.4 + k * 0.8, 0] });
  }
  return merge(parts);
}
function bushGeo() {
  const parts = [];
  for (const [x, y, z, s] of [[0, 0.55, 0, 0.7], [0.45, 0.45, 0.2, 0.5], [-0.4, 0.45, -0.15, 0.55], [0.1, 0.45, -0.45, 0.45]]) {
    parts.push({ geo: roughen(new THREE.IcosahedronGeometry(1, 1), 0.12, x), color: '#3e5e2a', at: [x, y, z], scale: [s, s * 0.8, s] });
  }
  for (let i = 0; i < 10; i++) {
    const a = i * 2.39, r = 0.35 + (i % 3) * 0.15;
    parts.push({ geo: new THREE.SphereGeometry(0.06, 6, 4), color: '#3a2a8a', at: [Math.cos(a) * r, 0.5 + (i % 4) * 0.12, Math.sin(a) * r] });
  }
  return merge(parts);
}
// A great tree: an ancient giant of the forest, 35–45 metres tall
function greatTreeGeo() {
  const bark = (v, c) => c.set('#4a3a2a').lerp(new THREE.Color('#5e4a36'), (Math.sin(v.y * 1.3 + v.x * 2) + 1) / 2);
  const parts = [{ geo: roughen(new THREE.CylinderGeometry(1.6, 3.2, 24, 14, 6), 0.12, 2), color: bark, at: [0, 12, 0] }];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push({ geo: new THREE.CylinderGeometry(0.3, 1.1, 6, 7), color: bark, at: [Math.cos(a) * 3, 1.2, Math.sin(a) * 3], rot: [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0] });
    parts.push({ geo: new THREE.CylinderGeometry(0.35, 0.9, 11, 7), color: bark, at: [Math.cos(a) * 4.5, 24, Math.sin(a) * 4.5], rot: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9] });
  }
  const leaf = (v, c) => c.set('#2f4a22').lerp(new THREE.Color('#58782f'), Math.min(1, Math.max(0, (v.y - 24) / 16)));
  for (const [x, y, z, s] of [[0, 34, 0, 9], [8, 29, 3, 6.5], [-7.5, 30, -2, 7], [2, 29, -8, 6.5], [-2, 30, 8, 6.5], [5, 37, -4, 5], [-4, 38, 3, 5]]) {
    parts.push({ geo: roughen(new THREE.IcosahedronGeometry(1, 2), 0.12, x + y), color: leaf, at: [x, y, z], scale: [s, s * 0.7, s] });
  }
  return merge(parts);
}
// Plain stand-ins for trees further away: the same shape and colours with far fewer faces
function lowGeos() {
  const leaf = '#4a6a2c';
  const pine = (snowy) => merge([
    { geo: new THREE.CylinderGeometry(0.2, 0.42, 7, 5), color: BARK, at: [0, 3.5, 0] },
    { geo: new THREE.ConeGeometry(3.4, 8, 6), color: snowy ? '#c8d0d4' : '#2f4a2a', at: [0, 7, 0] },
    { geo: new THREE.ConeGeometry(2.2, 6, 6), color: snowy ? '#e6ebef' : '#38552c', at: [0, 12.5, 0] },
  ]);
  const blobs = (trunk, list, color) => merge([trunk, ...list.map(([x, y, z, r]) => ({ geo: new THREE.IcosahedronGeometry(r, 0), color, at: [x, y, z], scale: [1, 0.85, 1] }))]);
  return {
    pine: pine(false), snowpine: pine(true),
    oak: blobs({ geo: new THREE.CylinderGeometry(0.35, 0.65, 6, 5), color: BARK, at: [0, 3, 0] }, [[0, 8, 0, 3.4], [1.9, 7, 0.6, 2.5], [-1.8, 7.2, -0.6, 2.5]], leaf),
    swamp: blobs({ geo: new THREE.CylinderGeometry(0.45, 1.0, 6, 5), color: '#3e3a2a', at: [0, 3, 0] }, [[0, 7.4, 0, 4.4]], '#4a5a2a'),
    glow: blobs({ geo: new THREE.CylinderGeometry(0.2, 0.4, 7, 5), color: '#d8d2c0', at: [0, 3.5, 0] }, [[0, 8.5, 0, 2.8], [1.4, 7.4, 0.5, 2]], '#7fd0b0'),
    great: blobs({ geo: new THREE.CylinderGeometry(1.6, 3.2, 26, 7), color: '#4a3a2a', at: [0, 13, 0] }, [[0, 34, 0, 9], [7, 29, 2, 7], [-6.5, 30, -2, 7], [1, 30, 7, 6.5]], '#3e5e28'),
    young: merge([{ geo: new THREE.CylinderGeometry(0.07, 0.12, 2, 4), color: BARK, at: [0, 1, 0] }, { geo: new THREE.ConeGeometry(1.1, 3, 5), color: '#456a32', at: [0, 2.6, 0] }]),
    bush: merge([{ geo: new THREE.IcosahedronGeometry(0.75, 0), color: '#3e5e2a', at: [0, 0.5, 0], scale: [1.1, 0.8, 1.1] }]),
    cactus: merge([{ geo: new THREE.CylinderGeometry(0.32, 0.38, 4.3, 5), color: '#5a7a3a', at: [0, 2.15, 0] }, { geo: new THREE.CylinderGeometry(0.2, 0.22, 1.6, 4), color: '#5a7a3a', at: [0.75, 2.6, 0] }]),
  };
}

function rockGeo() {
  return merge([{ geo: roughen(new THREE.IcosahedronGeometry(1, 1), 0.22, 5), color: '#ffffff' }]);
}
function grassGeo() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    parts.push({ geo: new THREE.ConeGeometry(0.03, 0.45 + (i % 3) * 0.12, 3, 1, true), color: (v, c) => c.set('#4a6a28').lerp(new THREE.Color('#9ab85a'), Math.min(1, v.y / 0.5)), at: [Math.cos(a) * 0.1, 0.22, Math.sin(a) * 0.1], rot: [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3] });
  }
  return merge(parts);
}

// ---------- what grows where ----------

// For each region: [kind, chance per cell when the forest value is 1, chance with no forest]
const FLORA = {
  heart: [['great', 0.004, 0], ['pine', 0.42, 0.004], ['oak', 0.36, 0.01], ['young', 0.12, 0.025], ['bush', 0.05, 0.02], ['rock', 0.03, 0.02]],
  peaks: [['pine', 0.5, 0], ['young', 0.12, 0.004], ['rock', 0.06, 0.08]],
  warrens: [['dead', 0, 0.012], ['rock', 0, 0.05]],
  fae: [['great', 0.005, 0], ['glow', 0.45, 0.01], ['pine', 0.12, 0], ['young', 0.08, 0.02], ['bush', 0.05, 0.02], ['rock', 0.02, 0.02]],
  mire: [['swamp', 0.4, 0.02], ['reeds', 0, 0.1], ['bush', 0.05, 0.02], ['rock', 0, 0.01]],
  frost: [['snowpine', 0.6, 0.003], ['young', 0.1, 0.004], ['rock', 0.04, 0.05]],
  sun: [['cactus', 0, 0.012], ['rock', 0, 0.025]],
  // the Heartland's own kinds of land (sections)
  darkwood: [['great', 0.02, 0], ['pine', 0.45, 0.01], ['oak', 0.3, 0.01], ['dead', 0.06, 0.02], ['bush', 0.02, 0.01], ['rock', 0.04, 0.02]],
  jungle: [['great', 0.012, 0], ['oak', 0.5, 0.02], ['young', 0.18, 0.03], ['bush', 0.12, 0.04], ['swamp', 0.06, 0], ['rock', 0.02, 0.01]],
  plains: [['oak', 0.3, 0.003], ['young', 0.1, 0.004], ['bush', 0.05, 0.01], ['rock', 0.02, 0.006]],
  highland: [['pine', 0.4, 0.004], ['young', 0.08, 0.006], ['bush', 0.02, 0.006], ['rock', 0.06, 0.05]],
};
// Small things you can break with your hands (or a weapon): hit points, and what they drop
// What can be broken, and what it takes. Big trees need an axe (`chop`: a Hand Axe is 3, a War Axe 4)
// and enough Strength, or a great deal of Strength to fell them with whatever you hold (`bare`).
export const BREAKABLE = {
  young: { hp: 3, drops: [['log', 2, 3]], label: 'Young tree' },
  bush: { hp: 1, drops: [['berries', 2, 4]], label: 'Berry bush' },
  dead: { hp: 2, drops: [['log', 1, 2]], label: 'Dead tree' },
  cactus: { hp: 2, drops: [['cactus_flesh', 1, 2]], label: 'Cactus' },
  reeds: { hp: 1, drops: [['reed', 2, 4]], label: 'Reeds' },
  pine: { hp: 6, drops: [['log', 4, 6]], label: 'Pine', needs: { chop: 3, str: 15, bare: 40 } },
  snowpine: { hp: 6, drops: [['log', 4, 6]], label: 'Snow pine', needs: { chop: 3, str: 18, bare: 45 } },
  oak: { hp: 8, drops: [['log', 5, 8]], label: 'Oak', needs: { chop: 3, str: 22, bare: 50 } },
  swamp: { hp: 9, drops: [['log', 5, 8], ['reed', 1, 2]], label: 'Swamp tree', needs: { chop: 3, str: 28, bare: 60 } },
  glow: { hp: 8, drops: [['log', 3, 5], ['fae_dust', 1, 2]], label: 'Glowing fae tree', needs: { chop: 3, str: 32, bare: 70 } },
  great: { hp: 24, drops: [['log', 15, 25]], label: 'Great tree', needs: { chop: 4, str: 60, bare: 150 } },
};
// "Needs an axe and 22 STR (or 50 STR without one)"
export function breakNeeds(kind) {
  const n = BREAKABLE[kind]?.needs;
  if (!n) return '';
  return `Needs ${n.chop >= 4 ? 'a War Axe' : 'an axe'} and ${n.str} STR (or ${n.bare} STR without one)`;
}
const ROCK_TINT = { heart: '#86817a', peaks: '#4a4440', warrens: '#a87a52', fae: '#8a9a90', mire: '#5e5a4a', frost: '#9aa0a8', sun: '#c09a68' };
let NEAR_TREES = 110; // metres: trees closer than this are drawn in full and cast shadows
let grassDensity = 1;
// how far full trees reach and how thick the grass is (from the graphics quality)
export function setSceneryQuality(q) { NEAR_TREES = q.nearTrees; grassDensity = q.grassDensity; }
const SOLID = { pine: 0.45, snowpine: 0.45, oak: 0.7, dead: 0.3, swamp: 0.9, glow: 0.4, cactus: 0.4, young: 0.15, great: 3.2, bush: 0.4 };

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const spotKey = (kind, x, z) => `${kind}:${Math.round(x * 10)},${Math.round(z * 10)}`;

// Hide one instance (a broken bush or tree)
export function hideInstance(mesh, index) {
  const m = new THREE.Matrix4().makeScale(0, 0, 0);
  mesh.setMatrixAt(index, m);
  mesh.instanceMatrix.needsUpdate = true;
}

// Keep the shrines and their clearings free of trees and rocks: villages out to their walls, and the
// portal halls
let clearings = null;
function nearPlace(x, z) {
  clearings ??= [...placesWithPositions().map((p) => ({ x: p.x, z: p.z, r: p.village ? 54 : 32 })), ...allPortals().map((p) => ({ x: p.x, z: p.z, r: 20 }))];
  for (const c of clearings) if (Math.abs(x - c.x) < c.r && Math.abs(z - c.z) < c.r) return true;
  return false;
}

export function scenery() {
  const geos = {
    pine: pineGeo(false), snowpine: pineGeo(true), oak: oakGeo(), dead: deadTreeGeo(), swamp: swampTreeGeo(),
    glow: glowTreeGeo(), cactus: cactusGeo(), reeds: reedsGeo(), rock: rockGeo(),
    young: youngTreeGeo(), bush: bushGeo(), great: greatTreeGeo(),
  };
  const low = lowGeos();
  const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const mats = {
    glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#2fa080', emissiveIntensity: 0.35 }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
  };
  const grass = grassGeo();
  const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const s = {};

  // `isBroken(key)` says whether something here was already broken, so it stays gone
  function forTile(cx, cz, size, isBroken = () => false) {
    const rand = rng(cx * 73856093 ^ cz * 19349663);
    const cell = 9;
    const per = size / cell;
    const spots = {};
    const solid = [];
    for (let j = 0; j < per; j++) {
      for (let i = 0; i < per; i++) {
        const x = cx * size + (i + rand()) * cell;
        const z = cz * size + (j + rand()) * cell;
        const r = rand();
        if (nearPlace(x, z) || isPrepared(x, z)) continue;
        sample(x, z, s);
        const flora = (s.region === 'heart' && FLORA[s.biome]) || FLORA[s.region];
        if (!flora) continue;
        let acc = 0;
        for (const [kind, inForest, open] of flora) {
          const chance = open + (inForest - open) * s.forest;
          acc += chance;
          if (r >= acc) continue;
          if (kind === 'reeds') { if (s.h < -0.6 || s.h > 1.6) break; } else if (s.h < 0.6) break;
          if (kind !== 'rock' && s.region === 'peaks' && s.h > 900) break;
          if (s.h < s.water + 0.6 && kind !== 'reeds') break;
          if (kind === 'great' && s.forest < 0.5) break;
          if (BREAKABLE[kind] && isBroken(spotKey(kind, x, z))) break;
          (spots[`${kind}|${(i >= per / 2 ? 1 : 0) + (j >= per / 2 ? 2 : 0)}`] ||= []).push({ x, z, y: surfaceAt(x, z), region: s.region, dark: s.dark || 0 }); // on the land as drawn, not floating over it
          break;
        }
      }
    }
    const group = new THREE.Group();
    const meshes = [];
    const pairs = []; // [full detail, plain stand-in] for each kind
    // each kind is drawn per quarter of the tile, so the full-detail trees reach only so far
    for (const [spot, list] of Object.entries(spots)) {
      const [kind, q] = spot.split('|');
      const box = { x0: cx * size + (q & 1) * size / 2, z0: cz * size + (q >> 1) * size / 2, s: size / 2 };
      const mesh = new THREE.InstancedMesh(geos[kind], mats[kind] || plain, list.length);
      list.forEach((p, i) => {
        const sc = kind === 'rock' ? 0.3 + rand() * rand() * 3 : 0.7 + rand() * 0.6;
        dummy.position.set(p.x, p.y - (kind === 'rock' ? sc * 0.3 : 0.1), p.z);
        dummy.rotation.set(kind === 'rock' ? rand() * 3 : 0, rand() * Math.PI * 2, kind === 'rock' ? rand() * 3 : 0);
        dummy.scale.set(sc * (kind === 'rock' ? 0.8 + rand() * 0.6 : 1), sc * (kind === 'rock' ? 0.6 : 0.85 + rand() * 0.3), sc);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (kind === 'rock') tint.set(ROCK_TINT[p.region] || '#888').multiplyScalar(0.85 + rand() * 0.3);
        else tint.setHSL(0, 0, (0.85 + rand() * 0.3) * (1 - p.dark * 0.5)); // the Dark Forests are gloomier
        mesh.setColorAt(i, tint);
        const entry = SOLID[kind] ? { x: p.x, z: p.z, r: SOLID[kind] * sc } : kind === 'rock' && sc > 0.3 ? { x: p.x, z: p.z, r: sc * 0.8, y: p.y, step: true } : null; // every rock but pebbles is solid, and you can climb on it
        if (BREAKABLE[kind]) {
          // things you can break keep a link to their instance so they can be removed
          const e = entry || { x: p.x, z: p.z, r: 0 };
          Object.assign(e, { kind, mesh, index: i, y: p.y, hp: BREAKABLE[kind].hp, key: spotKey(kind, p.x, p.z), height: kind === 'young' ? 3.5 * sc : BREAKABLE[kind].needs ? 5 * sc : 1.2 * sc });
          solid.push(e);
        } else if (entry) {
          entry.kind = kind;
          entry.height = kind === 'rock' ? sc * 0.55 : 10 * sc;
          solid.push(entry);
        }
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
      meshes.push(mesh);
      // the stand-in shares the trees' places and colours, so a broken tree is gone from both
      const lo = low[kind] && new THREE.InstancedMesh(low[kind], mats[kind] || plain, list.length);
      if (lo) {
        lo.instanceMatrix = mesh.instanceMatrix;
        lo.instanceColor = mesh.instanceColor;
        lo.boundingSphere = mesh.boundingSphere;
        lo.visible = false;
        group.add(lo);
        meshes.push(lo);
      }
      pairs.push([mesh, lo, box]);
    }
    return {
      group, solid,
      // trees near (x, z) show every leaf and cast shadows; further ones show the stand-ins
      view(x, z) {
        for (const [hi, lo, b] of pairs) {
          const dx = Math.max(b.x0 - x, 0, x - b.x0 - b.s), dz = Math.max(b.z0 - z, 0, z - b.z0 - b.s);
          const near = dx * dx + dz * dz < NEAR_TREES * NEAR_TREES;
          if (hi.castShadow === near && (!lo || lo.visible !== near)) continue;
          hi.castShadow = near;
          if (lo) { hi.visible = near; lo.visible = !near; }
        }
      },
      dispose() { for (const m of meshes) m.dispose(); },
    };
  }

  // Grass only near the player: a few thousand tufts per tile where grass grows.
  function grassForTile(cx, cz, size) {
    const rand = rng((cx * 92837111) ^ (cz * 689287499) ^ 7);
    const list = [];
    for (let n = 0; n < 2600 * grassDensity; n++) {
      const x = cx * size + rand() * size, z = cz * size + rand() * size;
      if (isPrepared(x, z)) continue; // cleared land has no grass
      sample(x, z, s);
      if (s.h < s.water + 0.4) continue;
      if (s.region !== 'heart' && s.region !== 'fae' && s.region !== 'mire') continue;
      if (rand() > 0.85 - s.forest * 0.5) continue;
      list.push([x, surfaceAt(x, z) - 0.05, z, s.biome === 'plains' ? 1 : s.dark > 0.4 ? 2 : 0]); // (the drawn land, so tufts never hover on ridges)
    }
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(grass, grassMat, list.length);
    list.forEach(([x, y, z, look], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set((rand() - 0.5) * 0.3, rand() * 3, (rand() - 0.5) * 0.3);
      dummy.scale.setScalar(0.7 + rand() * 0.9);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (look === 1) tint.setHSL(0.14 + rand() * 0.04, 0.45, 0.5 + rand() * 0.12); // golden plains grass
      else tint.setHSL(0.22 + rand() * 0.06, 0.4, (0.42 + rand() * 0.14) * (look === 2 ? 0.55 : 1));
      mesh.setColorAt(i, tint);
    });
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    return mesh;
  }

  return { forTile, grassForTile };
}

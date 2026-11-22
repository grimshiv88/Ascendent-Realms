// Trees, rocks, reeds and grass for each terrain tile, chosen by region. Every model is one
// merged mesh with its colours baked in, drawn many times at once (instancing).
import * as THREE from 'three';
import { sample, placesWithPositions, isPrepared, surfaceAt } from '../data/world-layout.mjs';
import { allPortals } from '../data/portals.mjs';
import { oakTree, pineTree, youngTree, greatTree, swampTree, glowTree, deadTree, berryBush, treeMaterials, windy, setLeafDetail, getLeafDetail, grownLite } from './trees.js';

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

// Let a simple shape bend in the wind: the higher a vertex, the further it moves (amount: metres
// per metre of height in a full gust)
function withSway(g, amount) {
  const p = g.attributes.position, sway = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) sway[i] = Math.max(0, p.getY(i)) * amount;
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  g.setAttribute('aFlutter', new THREE.BufferAttribute(new Float32Array(p.count), 1));
  return g;
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
export function setSceneryQuality(q) {
  NEAR_TREES = q.nearTrees; grassDensity = q.grassDensity;
  setLeafDetail(q.nearTrees <= 60 ? 0.45 : q.nearTrees <= 110 ? 0.75 : 1); // (fewer, bigger leaves on low graphics)
}
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
    cactus: cactusGeo(), reeds: withSway(reedsGeo(), 0.12), rock: rockGeo(),
  };
  // the trees are grown branch by branch with real leaves (trees.js), once for each leaf detail the
  // graphics ask for (tiles drawn after a change of quality use the new ones)
  const grown = {};
  const growAll = () => ({
    pine: pineTree(false), snowpine: pineTree(true), oak: oakTree(), dead: deadTree(), swamp: swampTree(),
    glow: glowTree(), young: youngTree(), bush: berryBush(), great: greatTree(),
  });
  const treeGeos = () => (grown[getLeafDetail()] ||= growAll());
  // the same trees built lighter, for the middle distance (the full ones are only drawn close by)
  const midGeos = () => (grown['mid' + getLeafDetail()] ||= grownLite(growAll));
  const TREES = new Set(['pine', 'snowpine', 'oak', 'dead', 'swamp', 'glow', 'young', 'bush', 'great']);
  const tree = treeMaterials(), glowTreeMat = treeMaterials({ emissive: '#2fa080', emissiveIntensity: 0.45, emissiveMap: null });
  const low = lowGeos();
  const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const mats = {
    pine: tree.mat, snowpine: tree.mat, oak: tree.mat, dead: tree.mat, swamp: tree.mat, young: tree.mat, bush: tree.mat, great: tree.mat,
    glow: glowTreeMat.mat,
    reeds: windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
  };
  const grass = withSway(grassGeo(), 0.18);
  const grassMat = windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
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
    const pairs = []; // the meshes of each kind in each quarter
    // each kind is drawn per quarter of the tile, so the full-detail trees reach only so far
    for (const [spot, list] of Object.entries(spots)) {
      const [kind, q] = spot.split('|');
      const box = { x0: cx * size + (q & 1) * size / 2, z0: cz * size + (q >> 1) * size / 2, s: size / 2 };
      const mesh = new THREE.InstancedMesh(geos[kind] || treeGeos()[kind], mats[kind] || plain, list.length);
      list.forEach((p, i) => {
        const sc = kind === 'rock' ? 0.3 + rand() * rand() * 3 : 0.7 + rand() * 0.6;
        dummy.position.set(p.x, p.y - (kind === 'rock' ? sc * 0.3 : 0.1), p.z);
        dummy.rotation.set(kind === 'rock' ? rand() * 3 : 0, rand() * Math.PI * 2, kind === 'rock' ? rand() * 3 : 0);
        dummy.scale.set(sc * (kind === 'rock' ? 0.8 + rand() * 0.6 : 1), sc * (kind === 'rock' ? 0.6 : 0.85 + rand() * 0.3), sc);
        // a great tree's roots are solid too: high up near the trunk they stop you, and further out,
        // where they dip into the ground, you can climb over them
        const roots = [];
        if (kind === 'great') {
          const ry = dummy.rotation.y, c = Math.cos(ry), sn = Math.sin(ry), sy = dummy.scale.y;
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * Math.PI * 2;
            for (const r of [3.5, 4.2, 4.9]) {
              const lx = Math.cos(a) * r, lz = Math.sin(a) * r;
              const top = (1.2 - (r - 3) * 0.64 + 0.45 + (5.5 - r) * 0.12) * sy - 0.1;
              roots.push({ x: p.x + (lx * c + lz * sn) * sc, z: p.z + (-lx * sn + lz * c) * sc, r: 0.45 * sc, y: p.y, height: top, step: true, kind: 'root' });
            }
          }
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (kind === 'rock') tint.set(ROCK_TINT[p.region] || '#888').multiplyScalar(0.85 + rand() * 0.3);
        else tint.setHSL(0, 0, (0.85 + rand() * 0.3) * (1 - p.dark * 0.5)); // the Dark Forests are gloomier
        mesh.setColorAt(i, tint);
        const entry = SOLID[kind] ? { x: p.x, z: p.z, r: SOLID[kind] * sc } : kind === 'rock' && sc > 0.3 ? { x: p.x, z: p.z, r: sc * 0.8, y: p.y, step: true } : null; // every rock but pebbles is solid, and you can climb on it
        if (BREAKABLE[kind]) {
          // things you can break keep a link to their instance so they can be removed
          const e = entry || { x: p.x, z: p.z, r: 0 };
          solid.push(...roots); // (felled, the tree takes its roots with it)
          Object.assign(e, { roots, kind, mesh, index: i, y: p.y, hp: BREAKABLE[kind].hp, key: spotKey(kind, p.x, p.z), height: kind === 'young' ? 3.5 * sc : BREAKABLE[kind].needs ? 5 * sc : 1.2 * sc });
          solid.push(e);
        } else if (entry) {
          entry.kind = kind;
          entry.height = kind === 'rock' ? sc * 0.55 : 10 * sc;
          solid.push(entry);
        }
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (TREES.has(kind)) mesh.customDepthMaterial = (kind === 'glow' ? glowTreeMat : tree).depth; // (shadows of the leaves, not of squares, swaying with them)
      mesh.computeBoundingSphere();
      group.add(mesh);
      meshes.push(mesh);
      // the stand-in shares the trees' places and colours, so a broken tree is gone from both
      // a tree kind is drawn by two more meshes that share out its trees by distance: the ones close
      // by in full, the rest in the lighter build (`mesh` keeps every tree's place, so felling one works)
      let hi = null, mid = null;
      if (TREES.has(kind)) {
        mesh.visible = false;
        const copy = (geo) => {
          const m = new THREE.InstancedMesh(geo, mats[kind], list.length);
          m.count = 0;
          m.boundingSphere = mesh.boundingSphere;
          m.receiveShadow = true;
          m.customDepthMaterial = mesh.customDepthMaterial;
          m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
          m.visible = false;
          group.add(m);
          meshes.push(m);
          return m;
        };
        hi = copy(treeGeos()[kind]);
        mid = copy(midGeos()[kind]);
      }
      const lo = low[kind] && new THREE.InstancedMesh(low[kind], mats[kind] || plain, list.length);
      if (lo) {
        lo.instanceMatrix = mesh.instanceMatrix;
        lo.instanceColor = mesh.instanceColor;
        lo.boundingSphere = mesh.boundingSphere;
        lo.visible = false;
        group.add(lo);
        meshes.push(lo);
      }
      pairs.push({ mesh, hi, mid, lo, box, list, at: null });
    }
    // put each tree within `full` metres of (x, z) into the full mesh and the rest into the lighter one
    function shareOut(P, x, z, full) {
      const src = P.mesh.instanceMatrix.array, col = P.mesh.instanceColor.array;
      let nh = 0, nm = 0;
      P.list.forEach((p, i) => {
        const near = (p.x - x) ** 2 + (p.z - z) ** 2 < full * full, m = near ? P.hi : P.mid, j = near ? nh++ : nm++;
        m.instanceMatrix.array.set(src.subarray(i * 16, i * 16 + 16), j * 16);
        m.instanceColor.array.set(col.subarray(i * 3, i * 3 + 3), j * 3);
      });
      for (const [m, n] of [[P.hi, nh], [P.mid, nm]]) { m.count = n; m.visible = n > 0; m.castShadow = true; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
      P.at = { x, z, full, v: P.mesh.instanceMatrix.version };
    }
    return {
      group, solid,
      // trees near (x, z) show every leaf, a little further the lighter build, and far off the plain
      // stand-ins; all but the stand-ins cast shadows
      view(x, z) {
        const full = NEAR_TREES * 0.4;
        for (const P of pairs) {
          const b = P.box;
          const dx = Math.max(b.x0 - x, 0, x - b.x0 - b.s), dz = Math.max(b.z0 - z, 0, z - b.z0 - b.s);
          const near = dx * dx + dz * dz < NEAR_TREES * NEAR_TREES;
          if (!P.hi) {
            if (P.mesh.castShadow === near && (!P.lo || P.lo.visible !== near)) continue;
            P.mesh.castShadow = near;
            if (P.lo) { P.mesh.visible = near; P.lo.visible = !near; }
            continue;
          }
          if (near || !P.lo) {
            const f = near ? full : 0, a = P.at;
            if (!a || a.full !== f || a.v !== P.mesh.instanceMatrix.version || (f && (a.x - x) ** 2 + (a.z - z) ** 2 > 16)) shareOut(P, x, z, f);
            if (P.lo) P.lo.visible = false;
          } else if (P.at) {
            P.at = null;
            P.hi.visible = P.mid.visible = false;
            P.lo.visible = true;
          } else P.lo.visible = true;
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

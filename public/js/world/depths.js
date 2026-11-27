// A cave's depths: chambers going ever deeper, joined by tunnels, pitch dark without a torch.
// Ore veins to mine, monster nests, a boss in the last chamber guarding a chest, and the way out.
// False routes (see data/depths.mjs) look the same as the true way and end in rock. Hard caves add
// chasms to jump, traps in the floor and secret rooms behind cracked walls.
import * as THREE from 'three';
import { GlowLight } from './lightpool.js';
import { caveLayout, THEMES, pickOre, pickVein, caveOres, strongCave, ORICHALCUM_CHANCE, CHASM_DEPTH, TRAPS } from '../data/depths.mjs';
import { ITEMS } from '../data/items.mjs';

const STEP = 0.9;         // metres between points of the cave mesh
const CEILING = 6.5;      // how high the roof is above the floor
const ORE_COLOR = {
  copper_ore: '#d9782e', iron_ore: '#8a8f99', silver_ore: '#e6eef5', gold_ore: '#ffd04a', crystal_shard: '#7fd8ff',
  emerald: '#3aff7a', sapphire: '#3a6aff', ruby: '#ff2a4a', moonstone: '#e8e0ff', dragonite: '#ff5a1a',
  diamond: '#f4fbff', orichalcum: '#ff8a3a',
};

const bump = (x, z) => Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.18 + Math.sin(x * 0.23 + z * 0.31) * 0.25;
const wobble = (x, z) => (Math.sin(x * 0.5 + z * 0.2) + Math.cos(z * 0.45 - x * 0.15)) * 0.45;

export function buildDepths(cave) {
  const L = caveLayout(cave);
  const T = THEMES[cave.theme];

  // How far (x, z) is from open floor (negative inside), and the floor height there.
  // In a tunnel the floor slopes evenly from one chamber's floor to the next.
  // `pit` is true over a chasm, whose floor is CHASM_DEPTH below `floor`
  function shape(x, z) {
    let d = Infinity, floor = 0, pit = false;
    for (const c of L.all) {
      const k = Math.hypot(x - c.x, z - c.z) - c.r;
      if (k < d) { d = k; floor = c.y; }
    }
    for (const t of L.tunnels) {
      const ax = t.b.x - t.a.x, az = t.b.z - t.a.z, len = Math.hypot(ax, az);
      const k = Math.max(0, Math.min(1, ((x - t.a.x) * ax + (z - t.a.z) * az) / (len * len)));
      const dd = Math.hypot(x - (t.a.x + ax * k), z - (t.a.z + az * k)) - t.w / 2;
      if (dd < d) {
        d = dd;
        const walk = Math.max(1, len - t.a.r - t.b.r);
        const s = Math.max(0, Math.min(1, (k * len - t.a.r) / walk));
        floor = t.a.y + (t.b.y - t.a.y) * s;
        pit = !!t.chasm && Math.abs((s - t.chasm.at) * walk) < t.chasm.w / 2;
      }
    }
    return { d: d + wobble(x, z) * 0.6, floor, pit };
  }

  // The ground for everything that walks down here: open floor, or rock walls nothing can enter
  function sampleAt(x, z, out = {}) {
    const s = shape(x, z);
    const inside = s.d < 0;
    out.h = inside ? s.floor + bump(x, z) - (s.pit ? CHASM_DEPTH : 0) : s.floor + Math.min(9, 0.5 + s.d * 2.5);
    out.water = inside ? -1e6 : out.h + 1; // walls count as deep water, so monsters turn back
    out.region = 'depths'; out.forest = 0; out.wet = 0; out.lake = 0; out.coast = 0; out.ice = 0;
    return out;
  }

  const g = new THREE.Group();
  // ---------- the rock: floor and walls in one sheet, and the roof above ----------
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of L.all) { minX = Math.min(minX, c.x - c.r); maxX = Math.max(maxX, c.x + c.r); minZ = Math.min(minZ, c.z - c.r); maxZ = Math.max(maxZ, c.z + c.r); }
  minX -= 8; maxX += 8; minZ -= 8; maxZ += 8;
  const nx = Math.ceil((maxX - minX) / STEP) + 1, nz = Math.ceil((maxZ - minZ) / STEP) + 1;
  const floorPos = new Float32Array(nx * nz * 3), roofPos = new Float32Array(nx * nz * 3), cols = new Float32Array(nx * nz * 3);
  const near = new Uint8Array(nx * nz);
  const base = new THREE.Color(T.rock), dark = new THREE.Color(T.rock).multiplyScalar(0.55), col = new THREE.Color();
  const tmp = {};
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = minX + i * STEP, z = minZ + j * STEP, v = j * nx + i;
      const s = shape(x, z);
      sampleAt(x, z, tmp);
      floorPos.set([x, tmp.h, z], v * 3);
      roofPos.set([x, s.floor + CEILING + wobble(x * 1.7, z * 1.3) * 0.8 - Math.max(0, -s.d - 6) * 0.15, z], v * 3);
      col.copy(dark).lerp(base, Math.min(1, Math.max(0, s.d + 1.5) / 3) * 0.7 + (bump(x * 3, z * 3) + 0.4) * 0.3);
      if (s.pit && s.d < 0) col.multiplyScalar(0.35); // (a chasm's depths are dark)
      cols.set([col.r, col.g, col.b], v * 3);
      near[v] = s.d < 5 ? 1 : 0;
    }
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (!(near[a] || near[b] || near[c] || near[d])) continue;
      idx.push(a, c, b, b, c, d);
    }
  }
  const sheet = (positions, side) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side }));
    m.receiveShadow = true;
    return m;
  };
  g.add(sheet(floorPos, THREE.FrontSide), sheet(roofPos, THREE.BackSide));

  // ---------- glowing crystals here and there, so the dark has shape ----------
  const crystalMat = new THREE.MeshStandardMaterial({ color: T.glow, emissive: T.glow, emissiveIntensity: 1.4, roughness: 0.3 });
  const crystal = new THREE.OctahedronGeometry(0.35, 0);
  const rnd = L.rnd;
  for (const c of L.all) {
    for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
      const a = rnd() * Math.PI * 2, r = c.r - 0.6;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const m = new THREE.Mesh(crystal, crystalMat);
      m.position.set(x, sampleAt(x, z, tmp).h + 0.3, z);
      m.scale.set(1, 2 + rnd() * 2, 1);
      m.rotation.set((rnd() - 0.5) * 0.8, rnd() * 3, (rnd() - 0.5) * 0.8);
      g.add(m);
    }
  }

  // ---------- the way out: a shaft of daylight in the first chamber ----------
  const exit = { x: L.entry.x, z: L.entry.z };
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, CEILING, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: '#fff2c8', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  shaft.position.set(exit.x, L.entry.y + CEILING / 2, exit.z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.3, 24), new THREE.MeshBasicMaterial({ color: '#ffe6a0', transparent: true, opacity: 0.6 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(exit.x, L.entry.y + 0.08, exit.z);
  const daylight = new GlowLight('#ffe8b0', 6, 10, 1.6);
  daylight.position.set(exit.x, L.entry.y + 4, exit.z);
  g.add(shaft, ring, daylight);
  // you arrive a few steps from the shaft, facing into the cave
  const toNext = L.chambers[1] ? Math.atan2(L.chambers[1].x - exit.x, L.chambers[1].z - exit.z) : 0;
  const start = { x: exit.x + Math.sin(toNext) * 5, z: exit.z + Math.cos(toNext) * 5, heading: toNext };

  // ---------- ore veins in the walls ----------
  const solid = [];
  const rock = new THREE.DodecahedronGeometry(0.75, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: T.rock, roughness: 0.95, flatShading: true });
  const veins = [];
  L.all.forEach((c, ci) => {
    // a false route's chambers now and then hold a poor vein, so they look worth the walk
    const n = c.false ? (rnd() < 0.3 ? 1 : 0) : 2 + Math.floor(rnd() * 3) + (c.boss ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = c.r - 1.1;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (shape(x, z).d > -0.5) continue;
      // deeper chambers hold rarer ore (and only strong caves hold the rare ones at all)
      const deep = c.false ? 0 : ci / L.chambers.length;
      // the deepest chambers of a strong cave now and then hold orichalcum
      const ore = strongCave(cave) && deep >= 0.6 && Math.random() < ORICHALCUM_CHANCE ? 'orichalcum' : pickOre(caveOres(cave, deep), Math.random, deep);
      const size = pickVein(ore, Math.random, deep);
      const v = new THREE.Group();
      const body = new THREE.Mesh(rock, rockMat);
      body.scale.set(1.2, 0.9, 1.1);
      v.add(body);
      const speckMat = new THREE.MeshStandardMaterial({ color: ORE_COLOR[ore] || '#fff', emissive: ORE_COLOR[ore] || '#fff', emissiveIntensity: 0.9, roughness: 0.3 });
      for (let k = 0; k < 6; k++) {
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), speckMat);
        const u = rnd() * Math.PI * 2, w = rnd() * 1.2 - 0.2;
        s.position.set(Math.cos(u) * 0.75 * Math.cos(w), Math.sin(w) * 0.6 + 0.1, Math.sin(u) * 0.75 * Math.cos(w));
        v.add(s);
      }
      v.scale.setScalar(size.scale);
      v.position.set(x, sampleAt(x, z, tmp).h + 0.4 * size.scale, z);
      v.rotation.y = rnd() * 6;
      g.add(v);
      const e = { x, z, r: 0.85 * size.scale, kind: 'vein', ore, size, hits: size.hits, mesh: v, height: 1.5 * size.scale };
      veins.push(e); solid.push(e);
    }
  });

  // ---------- nests: monsters keep coming from them until they're broken ----------
  const nests = [];
  const nestMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 1, flatShading: true });
  const eggMat = new THREE.MeshStandardMaterial({ color: '#d8c8a0', emissive: T.glow, emissiveIntensity: 0.25, roughness: 0.6 });
  L.chambers.forEach((c, ci) => {
    if (ci === 0 || c.boss || ci % 2 === 0) return;
    const a = rnd() * Math.PI * 2;
    const x = c.x + Math.cos(a) * c.r * 0.45, z = c.z + Math.sin(a) * c.r * 0.45;
    const n = new THREE.Group();
    const mound = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.45, 6, 12), nestMat);
    mound.rotation.x = -Math.PI / 2;
    n.add(mound);
    for (let k = 0; k < 4; k++) {
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), eggMat);
      egg.scale.y = 1.3;
      egg.position.set(Math.cos(k * 1.6) * 0.35, 0.3, Math.sin(k * 1.6) * 0.35);
      n.add(egg);
    }
    n.position.set(x, sampleAt(x, z, tmp).h + 0.1, z);
    g.add(n);
    const e = { x, z, r: 1.2, kind: 'nest', hp: 0, maxHp: 0, mesh: n, timer: 6, height: 1, chamber: c };
    nests.push(e); solid.push(e);
  });

  // ---------- chests: the boss's, at the back of the last chamber, and one in each secret room ----------
  const wood = new THREE.MeshStandardMaterial({ color: '#6a4424', roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: '#c9a64a', metalness: 0.8, roughness: 0.35 });
  function makeChest(x, z, facing) {
    const chestG = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.8), wood);
    box.position.y = 0.35;
    const lid = new THREE.Group();
    const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.3, 12, 1, false, 0, Math.PI), wood);
    lidMesh.rotation.z = Math.PI / 2;
    lid.add(lidMesh);
    lid.position.set(0, 0.7, 0);
    for (const s of [-0.5, 0.5]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 0.84), iron); band.position.set(s, 0.36, 0); chestG.add(band); }
    const glow = new GlowLight('#ffd76a', 0, 6, 1.5);
    glow.position.y = 1.2;
    chestG.add(box, lid, glow);
    chestG.position.set(x, sampleAt(x, z, tmp).h, z);
    chestG.rotation.y = facing;
    g.add(chestG);
    return { x, z, r: 0.9, kind: 'chest', open: false, unlocked: false, lid, glow, height: 1.2 };
  }
  const last = L.chambers[L.chambers.length - 1];
  const prev = L.chambers[L.chambers.length - 2] || L.entry;
  const back = Math.atan2(last.x - prev.x, last.z - prev.z);
  const chest = makeChest(last.x + Math.sin(back) * (last.r - 3), last.z + Math.cos(back) * (last.r - 3), back + Math.PI);
  const lockGlow = chest.glow, lid = chest.lid;
  solid.push(chest);
  const secretChests = L.secrets.map((c) => {
    const e = makeChest(c.x, c.z, Math.atan2(c.from.x - c.x, c.from.z - c.z));
    Object.assign(e, { secret: true, unlocked: true });
    e.glow.intensity = 1.5;
    solid.push(e);
    return e;
  });

  // ---------- cracked walls: the secret rooms are walled off where their tunnel leaves the chamber ----------
  const cracks = [];
  const crackMat = new THREE.MeshStandardMaterial({ color: T.rock, roughness: 1, flatShading: true });
  const seamMat = new THREE.MeshBasicMaterial({ color: '#0a0806' });
  for (const t of L.tunnels) {
    if (!t.secret) continue;
    const dx = t.b.x - t.a.x, dz = t.b.z - t.a.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const x = t.a.x + ux * (t.a.r + 1.2), z = t.a.z + uz * (t.a.r + 1.2), y = sampleAt(x, z, tmp).h;
    const wall = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), crackMat);
    slab.scale.set(1.2, 3.8, 3);
    wall.add(slab);
    // the cracks that give it away, if you look closely
    for (let k = 0; k < 5; k++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9 + rnd() * 1.2, 0.05), seamMat);
      seam.position.set(-1.08, 1.2 + rnd() * 2.2 - 1, (rnd() - 0.5) * 2.4);
      seam.rotation.x = (rnd() - 0.5) * 1.4;
      wall.add(seam);
    }
    wall.position.set(x, y + 1.6, z);
    wall.rotation.y = Math.atan2(-uz, ux); // (its cracked face toward the chamber)
    g.add(wall);
    const crack = { hits: 6, parts: [], mesh: wall, hinted: false, x, z, ux, uz };
    for (const side of [-1.4, 0, 1.4]) {
      const e = { x: x - uz * side, z: z + ux * side, r: 1.15, kind: 'crack', crack, mesh: wall, height: 9 };
      crack.parts.push(e); solid.push(e);
    }
    cracks.push(crack);
  }

  // ---------- traps: a plate in the floor (look closely, or jump it) sets off spikes, darts or rocks ----------
  const traps = [];
  const plateMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(T.rock).multiplyScalar(1.25), roughness: 0.9, flatShading: true });
  const steel = new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 0.7, roughness: 0.4 });
  const boulderGeo = new THREE.DodecahedronGeometry(0.7, 0);
  for (const tr of L.traps) {
    let x = tr.x, z = tr.z, across = 0;
    if (tr.tunnel) {
      const t = tr.tunnel, dx = t.b.x - t.a.x, dz = t.b.z - t.a.z, l = Math.hypot(dx, dz);
      const u = t.a.r + (l - t.a.r - t.b.r) * tr.s;
      x = t.a.x + (dx / l) * u; z = t.a.z + (dz / l) * u; across = Math.atan2(dx, dz);
    }
    if (shape(x, z).d > -1) continue;
    const y = sampleAt(x, z, tmp).h;
    const trap = new THREE.Group();
    trap.position.set(x, y, z);
    trap.rotation.y = across;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.6), plateMat);
    plate.position.y = 0.02;
    trap.add(plate);
    const moving = new THREE.Group();
    trap.add(moving);
    if (tr.kind === 'spikes') {
      for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 5), steel); sp.position.set((i % 3 - 1) * 0.45, 0.45, (Math.floor(i / 3) - 1) * 0.45); moving.add(sp); }
      moving.position.y = -1.2;
    } else if (tr.kind === 'rocks') {
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(boulderGeo, crackMat); b.position.set((i - 1) * 0.6, 0, (i % 2) * 0.4 - 0.2); b.scale.setScalar(0.7 + i * 0.15); moving.add(b); }
      moving.visible = false;
    } else {
      for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 4), steel); d.rotation.z = Math.PI / 2; d.position.set(0, 0.8 + (i % 2) * 0.5, (i - 1.5) * 0.35); moving.add(d); }
      moving.visible = false;
    }
    g.add(trap);
    traps.push({ x, z, r: 0.85, kind: tr.kind, ...TRAPS[tr.kind], moving, fired: -99, y });
  }

  return {
    cave, layout: L, theme: T, group: g, solid, veins, nests, chest, exit, start,
    shape, sample: sampleAt,
    bossChamber: last,
    floorAt: (x, z) => sampleAt(x, z, tmp).h,
    roofAt: (x, z) => shape(x, z).floor + CEILING,
    // take a mined-out vein or broken nest away
    removeSolid(e) { g.remove(e.mesh); const i = solid.indexOf(e); if (i >= 0) solid.splice(i, 1); },
    unlockChest() { chest.unlocked = true; lockGlow.intensity = 4; },
    openChest() { chest.open = true; lockGlow.intensity = 0; lid.rotation.x = -1.9; },
    traps, cracks, secretChests,
    // a trap whose plate (x, z) stands on, now set off (or null); each resets after a few seconds
    trapAt(x, z, t) {
      for (const tr of traps) {
        if (t - tr.fired < 5 || Math.hypot(x - tr.x, z - tr.z) > tr.r) continue;
        tr.fired = t;
        return tr;
      }
      return null;
    },
    inPit: (x, z) => { const s = shape(x, z); return s.pit && s.d < 0; },
    // a cracked wall you're close to that hasn't given itself away yet
    crackNear(x, z) { return cracks.find((c) => !c.hinted && c.hits > 0 && Math.hypot(x - c.x, z - c.z) < 6) || null; },
    // hit a cracked wall; true when it gives way
    hitCrack(c, n = 1) {
      c.hits -= n;
      if (c.hits > 0) { c.mesh.position.x += (Math.random() - 0.5) * 0.06; return false; }
      g.remove(c.mesh);
      for (const e of c.parts) { const i = solid.indexOf(e); if (i >= 0) solid.splice(i, 1); }
      return true;
    },
    openSecret(e) { e.open = true; e.glow.intensity = 0; e.lid.rotation.x = -1.9; },
    update(t) {
      shaft.material.opacity = 0.09 + Math.sin(t * 1.3) * 0.03;
      for (const tr of traps) {
        const k = t - tr.fired;
        if (tr.kind === 'spikes') tr.moving.position.y = k < 0.15 ? -1.2 + k / 0.15 * 1.2 : k < 1.5 ? 0 : k < 2.5 ? -(k - 1.5) * 1.2 : -1.2;
        else if (tr.kind === 'rocks') { tr.moving.visible = k < 2.5; tr.moving.position.y = Math.max(0.5, CEILING - 0.8 - k * k * 30); }
        else { tr.moving.visible = k < 0.5; tr.moving.position.x = -2 + k * 8; }
      }
      for (const c of secretChests) if (!c.open) c.glow.intensity = 1.2 + Math.sin(t * 3) * 0.5;
      if (chest.unlocked && !chest.open) lockGlow.intensity = 3 + Math.sin(t * 4) * 1.2;
    },
    dispose() {
      g.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.userData?.shared) o.material.dispose?.(); });
    },
  };
}

export const oreName = (id) => ITEMS[id]?.name || id;

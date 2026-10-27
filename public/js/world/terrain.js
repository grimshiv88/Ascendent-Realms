// The central forest around the spawn point: ground, trees, rocks and grass, at real scale.
import * as THREE from 'three';

export const WORLD_SIZE = 800;        // metres across
export const CLEARING_RADIUS = 24;    // open ground around the spawn circle

// ---------- noise ----------

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  let total = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < 5; i++) {
    total += smooth(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return total / norm;
}

// The path from the spawn circle runs north (−z), gently winding
function pathCentre(z) {
  return Math.sin(z * 0.018) * 14 + Math.sin(z * 0.05) * 3;
}
export function onPath(x, z) {
  if (z > -CLEARING_RADIUS + 4) return 0;
  const d = Math.abs(x - pathCentre(z));
  return d < 3.2 ? 1 - d / 3.2 : 0;
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.006 + 10, z * 0.006 + 10) - 0.5) * 38;          // rolling hills
  h += (fbm(x * 0.03, z * 0.03) - 0.5) * 3;                         // small bumps
  const edge = Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - WORLD_SIZE * 0.38) / (WORLD_SIZE * 0.12));
  h += edge * edge * 45;                                            // hills ring the map edge
  const flat = THREE.MathUtils.smoothstep(r, CLEARING_RADIUS * 0.8, CLEARING_RADIUS * 2.2);
  const base = (fbm(10, 10) - 0.5) * 38;                            // height at the centre
  h = base + (h - base) * flat;                                     // flatten the clearing
  h -= onPath(x, z) * 0.15;
  return h;
}

// ---------- ground ----------

export function buildGround() {
  const seg = 256;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color('#4f6b2f'), grassB = new THREE.Color('#6d8a3a'), moss = new THREE.Color('#3b5228');
  const dirt = new THREE.Color('#7a6446'), rock = new THREE.Color('#6f6a60');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const n = fbm(x * 0.05, z * 0.05);
    c.copy(grassA).lerp(grassB, n).lerp(moss, Math.max(0, fbm(x * 0.012 + 5, z * 0.012) - 0.55) * 2);
    const slope = Math.abs(heightAt(x + 1, z) - y) + Math.abs(heightAt(x, z + 1) - y);
    if (slope > 0.9) c.lerp(rock, Math.min(1, (slope - 0.9) * 1.5));
    c.lerp(dirt, onPath(x, z) * 0.9);
    const r = Math.hypot(x, z);
    if (r < CLEARING_RADIUS * 0.5) c.lerp(dirt, 0.25 * (1 - r / (CLEARING_RADIUS * 0.5)));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  return ground;
}

// ---------- trees, rocks, grass ----------

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function buildForest() {
  const group = new THREE.Group();
  const rand = seeded(42);
  const trees = [];            // { x, z, r } for collisions

  const spots = [];
  for (let i = 0; i < 2600; i++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.96;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.96;
    const r = Math.hypot(x, z);
    if (r < CLEARING_RADIUS + 4 + rand() * 10) continue;
    if (onPath(x, z) > 0 || Math.abs(x - pathCentre(z)) < 5 && z < 0) continue;
    // clumps: thin out where the noise is low
    if (fbm(x * 0.02 + 3, z * 0.02 + 7) < 0.38) continue;
    spots.push({ x, z, kind: rand() < 0.55 ? 'pine' : 'oak', s: 0.75 + rand() * 0.6, rot: rand() * Math.PI * 2 });
  }

  const dummy = new THREE.Object3D();
  const barkMat = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.95 });
  const pineMat = new THREE.MeshStandardMaterial({ color: '#2f4a2a', roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4d6b2e', roughness: 0.85 });

  const pines = spots.filter((t) => t.kind === 'pine');
  const oaks = spots.filter((t) => t.kind === 'oak');

  // Pines: trunk + three stacked cones, about 14–22 m tall
  const pineTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.38, 6, 7), barkMat, pines.length);
  const pineTiers = [0, 1, 2].map((k) => new THREE.InstancedMesh(new THREE.ConeGeometry(3.4 - k * 0.9, 6.5 - k * 1.2, 9), pineMat, pines.length));
  pines.forEach((t, i) => {
    const y = heightAt(t.x, t.z);
    dummy.position.set(t.x, y + 3 * t.s, t.z);
    dummy.rotation.set(0, t.rot, 0);
    dummy.scale.setScalar(t.s);
    dummy.updateMatrix();
    pineTrunk.setMatrixAt(i, dummy.matrix);
    pineTiers.forEach((tier, k) => {
      dummy.position.set(t.x, y + (5 + k * 3.6) * t.s, t.z);
      dummy.updateMatrix();
      tier.setMatrixAt(i, dummy.matrix);
    });
    trees.push({ x: t.x, z: t.z, r: 0.45 * t.s });
  });
  for (const m of [pineTrunk, ...pineTiers]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }

  // Oaks (broadleaf): thicker trunk + a cluster of leafy blobs, about 10–15 m tall
  const oakTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.6, 5.5, 8), barkMat, oaks.length);
  const blobGeo = new THREE.IcosahedronGeometry(2.6, 1);
  const blobOffsets = [[0, 7.2, 0, 1.15], [1.9, 6.4, 0.6, 0.85], [-1.7, 6.6, -0.5, 0.9], [0.4, 6.2, -1.9, 0.8], [-0.5, 8.6, 0.7, 0.75]];
  const oakBlobs = new THREE.InstancedMesh(blobGeo, leafMat, oaks.length * blobOffsets.length);
  const tint = new THREE.Color();
  oaks.forEach((t, i) => {
    const y = heightAt(t.x, t.z);
    dummy.position.set(t.x, y + 2.75 * t.s, t.z);
    dummy.rotation.set(0, t.rot, 0);
    dummy.scale.setScalar(t.s);
    dummy.updateMatrix();
    oakTrunk.setMatrixAt(i, dummy.matrix);
    blobOffsets.forEach(([ox, oy, oz, sc], k) => {
      const cos = Math.cos(t.rot), sin = Math.sin(t.rot);
      dummy.position.set(t.x + (ox * cos - oz * sin) * t.s, y + oy * t.s, t.z + (ox * sin + oz * cos) * t.s);
      dummy.scale.setScalar(t.s * sc);
      dummy.updateMatrix();
      oakBlobs.setMatrixAt(i * blobOffsets.length + k, dummy.matrix);
      tint.setHSL(0.24 + (hash(t.x, t.z + k) - 0.5) * 0.05, 0.42, 0.26 + hash(t.z, t.x) * 0.08);
      oakBlobs.setColorAt(i * blobOffsets.length + k, tint);
    });
    trees.push({ x: t.x, z: t.z, r: 0.65 * t.s });
  });
  for (const m of [oakTrunk, oakBlobs]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }

  // Rocks
  const rockCount = 260;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#7d786e', roughness: 0.95, flatShading: true }), rockCount);
  for (let i = 0; i < rockCount; i++) {
    let x, z;
    do { x = (rand() - 0.5) * WORLD_SIZE * 0.9; z = (rand() - 0.5) * WORLD_SIZE * 0.9; } while (Math.hypot(x, z) < CLEARING_RADIUS || onPath(x, z) > 0);
    const s = 0.3 + rand() * rand() * 2.2;
    dummy.position.set(x, heightAt(x, z) + s * 0.25, z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(s * (0.8 + rand() * 0.6), s * 0.7, s);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    if (s > 0.8) trees.push({ x, z, r: s * 0.9 });
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  // Grass tufts and ferns near the spawn
  const tuftCount = 9000;
  const tuftGeo = new THREE.ConeGeometry(0.08, 0.45, 3);
  tuftGeo.translate(0, 0.22, 0);
  const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ color: '#7a9a44', roughness: 1 }), tuftCount);
  let placed = 0;
  for (let n = 0; n < tuftCount; n++) {
    const a = rand() * Math.PI * 2;
    const r = 9 + Math.sqrt(rand()) * 160;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (onPath(x, z) > 0.2) continue;
    const i = placed++;
    dummy.position.set(x, heightAt(x, z), z);
    dummy.rotation.set((rand() - 0.5) * 0.4, rand() * 3, (rand() - 0.5) * 0.4);
    dummy.scale.setScalar(0.6 + rand() * 0.9);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.22 + rand() * 0.06, 0.45, 0.32 + rand() * 0.12);
    tufts.setColorAt(i, tint);
  }
  tufts.count = placed;
  tufts.receiveShadow = true;
  group.add(tufts);

  return { group, trees };
}

// A coarse grid so collision checks only look at nearby trees and rocks
export function makeColliders(list) {
  const cell = 8;
  const grid = new Map();
  const key = (cx, cz) => `${cx},${cz}`;
  for (const t of list) {
    const k = key(Math.floor(t.x / cell), Math.floor(t.z / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(t);
  }
  return {
    push(pos, radius) {
      const cx = Math.floor(pos.x / cell), cz = Math.floor(pos.z / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const t of grid.get(key(cx + dx, cz + dz)) || []) {
            const ox = pos.x - t.x, oz = pos.z - t.z;
            const d = Math.hypot(ox, oz);
            const min = t.r + radius;
            if (d < min && d > 1e-4) {
              pos.x = t.x + (ox / d) * min;
              pos.z = t.z + (oz / d) * min;
            }
          }
        }
      }
    },
  };
}

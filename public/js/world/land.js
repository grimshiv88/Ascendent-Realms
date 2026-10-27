// The whole world as 3D land, streamed in around the player at real scale (1 unit = 1 metre).
// Near the player the ground is detailed and has trees, rocks and grass; further away it gets
// coarser; a low-detail "horizon" covers everything out to about 24 km so mountains show far off.
import * as THREE from 'three';
import { sample, vnoise, SEA_LEVEL, lakesWithLevels } from '../data/world-layout.mjs';
import { scenery, hideInstance, BREAKABLE } from './scenery.js';

export const CHUNK = 256;                 // metres per terrain tile
const LODS = [[1, 64], [3, 32], [6, 16], [11, 8]]; // [tile distance up to, grid segments]
const VEG_RANGE = 3;                      // tiles with trees and rocks
const GRASS_RANGE = 1;                    // tiles with grass
const UV_SCALE = 7;                       // metres per repeat of the ground detail texture
const UV_WRAP = UV_SCALE * 1024;          // keeps texture coordinates small far from the centre
const FAR_SIZE = 48000;                  // the horizon (distant forests are drawn into its colours)
const FAR_SEGS = 240;
const FAR_RECENTRE = 4000;

// ---------- ground colours ----------

const C = (hex) => new THREE.Color(hex);
const PAL = {
  grass: C('#5a7a32'), grass2: C('#71903c'), forestFloor: C('#3c5426'), canopy: C('#2c4420'),
  dirt: C('#6e5a3e'), rock: C('#6c675e'), darkRock: C('#3d3833'), ash: C('#4a4440'),
  snow: C('#e9eef3'), sand: C('#cdb88a'), seabed: C('#6a6450'), deep: C('#3c4a48'),
  clay: C('#a8764a'), clay2: C('#c69a68'), fae: C('#4f9a68'), fae2: C('#6fb08a'),
  mud: C('#4a4630'), moss: C('#566a32'), dune: C('#d8b678'), dune2: C('#c49a5e'),
  tundra: C('#9aa08a'),
};
const tmpC = new THREE.Color();

function groundColor(s, ny, wx, wz, far, out) {
  const h = s.h;
  const n = vnoise(wx / 37, wz / 37);
  if (h < -0.4) {
    out.copy(PAL.seabed).lerp(PAL.deep, Math.min(1, -h / 30));
    return out;
  }
  switch (s.region) {
    case 'heart':
      out.copy(PAL.grass).lerp(PAL.grass2, n);
      out.lerp(far ? PAL.canopy : PAL.forestFloor, Math.min(1, s.forest * (far ? 1.3 : 1.1)));
      if (h > 260) out.lerp(PAL.rock, Math.min(1, (h - 260) / 300));
      break;
    case 'peaks':
      out.copy(PAL.darkRock).lerp(PAL.ash, n);
      if (h < 300) out.lerp(PAL.grass, (1 - h / 300) * 0.7);
      if (h > 1100) out.lerp(PAL.snow, Math.min(1, (h - 1100) / 250));
      break;
    case 'warrens':
      out.copy(PAL.clay).lerp(PAL.clay2, 0.5 + Math.sin(h / 6) * 0.5);
      out.lerp(PAL.dirt, n * 0.3);
      break;
    case 'fae':
      out.copy(PAL.fae).lerp(PAL.fae2, n);
      out.lerp(PAL.canopy, s.forest * (far ? 0.8 : 0.4));
      break;
    case 'mire':
      out.copy(PAL.mud).lerp(PAL.moss, n * 0.8 + s.forest * 0.4);
      break;
    case 'frost':
      out.copy(PAL.snow).lerp(PAL.tundra, Math.max(0, n - 0.55) * 1.5);
      break;
    case 'sun':
      out.copy(PAL.dune).lerp(PAL.dune2, n);
      break;
    default:
      out.copy(PAL.sand);
  }
  // steep slopes are bare rock
  if (ny < 0.82 && s.region !== 'frost') out.lerp(s.region === 'warrens' ? PAL.clay : PAL.rock, Math.min(1, (0.82 - ny) * 4));
  if (ny < 0.75 && s.region === 'frost') out.lerp(PAL.rock, Math.min(1, (0.75 - ny) * 4));
  // beaches and river banks
  if (h < 2.6 && s.region !== 'mire') out.lerp(PAL.sand, Math.min(1, (2.6 - h) / 2));
  return out;
}

// ---------- textures made in code ----------

// Tileable noise, so the ground has fine detail up close without any downloaded images.
function tileNoise(size, period, seed) {
  const g = (ix, iy) => {
    const x = ((ix % period) + period) % period, y = ((iy % period) + period) % period;
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * period, fy = (y / size) * period;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const u = fx - ix, v = fy - iy;
      const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      const a = g(ix, iy), b = g(ix + 1, iy), c = g(ix, iy + 1), d = g(ix + 1, iy + 1);
      out[y * size + x] = a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
    }
  }
  return out;
}

function detailTextures() {
  const size = 512;
  const layers = [[4, 0.35], [16, 0.3], [64, 0.22], [128, 0.13]].map(([p, w], i) => [tileNoise(size, p, i + 1), w]);
  const height = new Float32Array(size * size);
  for (const [l, w] of layers) for (let i = 0; i < height.length; i++) height[i] += l[i] * w;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < height.length; i++) {
    const v = Math.round(255 * (0.74 + height[i] * 0.3));
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = Math.round(v * 0.97); img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return { map, height, size };
}

// A tileable normal map for rippling water.
function waterNormals() {
  const size = 256;
  const a = tileNoise(size, 8, 11), b = tileNoise(size, 24, 12);
  const h = (x, y) => {
    const i = ((y + size) % size) * size + ((x + size) % size);
    return a[i] * 0.6 + b[i] * 0.4;
  };
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 6, dy = (h(x, y + 1) - h(x, y - 1)) * 6;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------- one terrain tile ----------

const S = {};
function buildTileGeometry(cx, cz, segs) {
  const step = CHUNK / segs;
  const ox = cx * CHUNK, oz = cz * CHUNK;
  const n = segs + 1;
  const b = n + 2; // with a border of one sample for smooth normals across tiles
  const hs = new Float32Array(b * b);
  const info = new Array(n * n);
  for (let j = -1; j <= n; j++) {
    for (let i = -1; i <= n; i++) {
      const wx = ox + i * step, wz = oz + j * step;
      const inner = i >= 0 && j >= 0 && i < n && j < n;
      const s = sample(wx, wz, inner ? {} : S);
      hs[(j + 1) * b + (i + 1)] = s.h;
      if (inner) info[j * n + i] = s;
    }
  }
  const skirtN = 4 * segs;
  const vCount = n * n + skirtN;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const uo = (((ox % UV_WRAP) + UV_WRAP) % UV_WRAP) / UV_SCALE;
  const vo = (((oz % UV_WRAP) + UV_WRAP) % UV_WRAP) / UV_SCALE;
  const far = segs <= 16;
  const nv = new THREE.Vector3();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const H = (di, dj) => hs[(j + 1 + dj) * b + (i + 1 + di)];
      nv.set(H(-1, 0) - H(1, 0), 2 * step, H(0, -1) - H(0, 1)).normalize();
      pos[k * 3] = i * step; pos[k * 3 + 1] = H(0, 0); pos[k * 3 + 2] = j * step;
      nor[k * 3] = nv.x; nor[k * 3 + 1] = nv.y; nor[k * 3 + 2] = nv.z;
      groundColor(info[k], nv.y, ox + i * step, oz + j * step, far, tmpC);
      col[k * 3] = tmpC.r; col[k * 3 + 1] = tmpC.g; col[k * 3 + 2] = tmpC.b;
      uv[k * 2] = uo + (i * step) / UV_SCALE; uv[k * 2 + 1] = vo + (j * step) / UV_SCALE;
    }
  }
  const idx = [];
  for (let j = 0; j < segs; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * n + i, b2 = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b2, b2, c, d);
    }
  }
  // Skirts: a strip hanging down around the edge hides cracks between tiles of different detail
  const ring = [];
  for (let i = 0; i < segs; i++) ring.push(i);
  for (let j = 0; j < segs; j++) ring.push(j * n + segs);
  for (let i = segs; i > 0; i--) ring.push(segs * n + i);
  for (let j = segs; j > 0; j--) ring.push(j * n);
  const drop = step * 1.5 + 6;
  ring.forEach((src, r) => {
    const k = n * n + r;
    pos[k * 3] = pos[src * 3]; pos[k * 3 + 1] = pos[src * 3 + 1] - drop; pos[k * 3 + 2] = pos[src * 3 + 2];
    for (let q = 0; q < 3; q++) { nor[k * 3 + q] = nor[src * 3 + q]; col[k * 3 + q] = col[src * 3 + q]; }
    uv[k * 2] = uv[src * 2]; uv[k * 2 + 1] = uv[src * 2 + 1];
  });
  for (let r = 0; r < ring.length; r++) {
    const a = ring[r], b2 = ring[(r + 1) % ring.length];
    const a2 = n * n + r, b3 = n * n + ((r + 1) % ring.length);
    idx.push(a, b2, a2, b2, b3, a2, a, a2, b2, b2, a2, b3); // both sides
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return { geo, info, n, step };
}

// ---------- the horizon ----------

function buildFarGeometry(centreX, centreZ) {
  const n = FAR_SEGS + 1;
  const step = FAR_SIZE / FAR_SEGS;
  const hs = new Float32Array(n * n);
  const infos = new Array(n * n);
  const x0 = centreX - FAR_SIZE / 2, z0 = centreZ - FAR_SIZE / 2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const s = sample(x0 + i * step, z0 + j * step, {}); hs[j * n + i] = s.h; infos[j * n + i] = s; }
  const pos = new Float32Array(n * n * 3);
  const nor = new Float32Array(n * n * 3);
  const col = new Float32Array(n * n * 3);
  const nv = new THREE.Vector3();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const H = (di, dj) => hs[Math.min(n - 1, Math.max(0, j + dj)) * n + Math.min(n - 1, Math.max(0, i + di))];
      nv.set(H(-1, 0) - H(1, 0), 2 * step, H(0, -1) - H(0, 1)).normalize();
      // sit a little lower than the detailed tiles, so it never pokes through them
      pos[k * 3] = x0 + i * step - centreX; pos[k * 3 + 1] = hs[k] - 18; pos[k * 3 + 2] = z0 + j * step - centreZ;
      nor[k * 3] = nv.x; nor[k * 3 + 1] = nv.y; nor[k * 3 + 2] = nv.z;
      groundColor(infos[k], nv.y, x0 + i * step, z0 + j * step, true, tmpC);
      col[k * 3] = tmpC.r; col[k * 3 + 1] = tmpC.g; col[k * 3 + 2] = tmpC.b;
    }
  }
  const idx = [];
  for (let j = 0; j < FAR_SEGS; j++) for (let i = 0; i < FAR_SEGS; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// ---------- collisions with trees and rocks ----------

export function makeColliderGrid() {
  const cell = 8;
  const grid = new Map();
  const key = (cx, cz) => cx * 100003 + cz;
  return {
    add(list) {
      for (const t of list) {
        const k = key(Math.floor(t.x / cell), Math.floor(t.z / cell));
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(t);
      }
    },
    remove(list) {
      for (const t of list) {
        const arr = grid.get(key(Math.floor(t.x / cell), Math.floor(t.z / cell)));
        if (!arr) continue;
        const i = arr.indexOf(t);
        if (i >= 0) arr.splice(i, 1);
      }
    },
    // everything whose centre is within `r` of (x, z)
    near(x, z, r) {
      const out = [];
      const c0x = Math.floor((x - r) / cell), c1x = Math.floor((x + r) / cell);
      const c0z = Math.floor((z - r) / cell), c1z = Math.floor((z + r) / cell);
      for (let cx = c0x; cx <= c1x; cx++) {
        for (let cz = c0z; cz <= c1z; cz++) {
          for (const t of grid.get(key(cx, cz)) || []) if (Math.hypot(t.x - x, t.z - z) <= r + t.r) out.push(t);
        }
      }
      return out;
    },
    push(pos, radius) {
      const cx = Math.floor(pos.x / cell), cz = Math.floor(pos.z / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const t of grid.get(key(cx + dx, cz + dz)) || []) {
            const ox = pos.x - t.x, oz = pos.z - t.z;
            const d = Math.hypot(ox, oz);
            const min = t.r + radius;
            if (t.r > 0 && d < min && d > 1e-4) {
              pos.x = t.x + (ox / d) * min;
              pos.z = t.z + (oz / d) * min;
            }
          }
        }
      }
    },
  };
}

// ---------- the streaming world ----------

export function createLand(scene) {
  const detail = detailTextures();
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail.map, roughness: 0.95, metalness: 0 });
  const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const colliders = makeColliderGrid();
  const veg = scenery();

  const tiles = new Map(); // key -> { mesh, segs, veg, cx, cz }
  const broken = new Set(); // small trees and bushes already broken this session
  const root = new THREE.Group();
  scene.add(root);

  // the sea, lakes and rivers all sit at sea level
  const normals = waterNormals();
  normals.repeat.set((FAR_SIZE * 1.4) / 14, (FAR_SIZE * 1.4) / 14);
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#1f4f62', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.86,
    normalMap: normals, normalScale: new THREE.Vector2(0.35, 0.35),
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(FAR_SIZE * 1.4, FAR_SIZE * 1.4), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = SEA_LEVEL;
  water.receiveShadow = true;
  scene.add(water);

  // inland lakes, each with its own water surface
  for (const L of lakesWithLevels()) {
    const n = normals.clone();
    n.repeat.set((L.r * 2.6) / 14, (L.r * 2.6) / 14);
    const lakeMat = waterMat.clone();
    lakeMat.normalMap = n;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(L.r * 1.3, 64), lakeMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(L.x, L.level, L.z);
    disc.receiveShadow = true;
    scene.add(disc);
  }

  let far = null;
  let farCentre = null;
  function placeFar(x, z) {
    const cx = Math.round(x / 1000) * 1000, cz = Math.round(z / 1000) * 1000;
    const geo = buildFarGeometry(cx, cz);
    if (far) { far.geometry.dispose(); far.geometry = geo; } else {
      far = new THREE.Mesh(geo, farMat);
      far.receiveShadow = false;
      scene.add(far);
    }
    far.position.set(cx, 0, cz);
    farCentre = { x: cx, z: cz };
  }

  const tkey = (cx, cz) => `${cx},${cz}`;
  const lodFor = (d) => { for (const [r, s] of LODS) if (d <= r) return s; return 0; };
  const maxR = LODS[LODS.length - 1][0];

  function buildTile(cx, cz, segs, d) {
    const { geo, info, n, step } = buildTileGeometry(cx, cz, segs);
    const mesh = new THREE.Mesh(geo, groundMat);
    mesh.position.set(cx * CHUNK, 0, cz * CHUNK);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    const k = tkey(cx, cz);
    const old = tiles.get(k);
    if (old) { root.remove(old.mesh); old.mesh.geometry.dispose(); }
    root.add(mesh);
    const t = { mesh, segs, cx, cz, veg: old?.veg || null, grass: old?.grass || null };
    tiles.set(k, t);
    return t;
  }

  function setVeg(t, want, wantGrass) {
    if (want && !t.veg) {
      t.veg = veg.forTile(t.cx, t.cz, CHUNK, (k) => broken.has(k));
      root.add(t.veg.group);
      colliders.add(t.veg.solid);
    } else if (!want && t.veg) {
      root.remove(t.veg.group);
      colliders.remove(t.veg.solid);
      t.veg.dispose();
      t.veg = null;
    }
    if (wantGrass && !t.grass) {
      t.grass = veg.grassForTile(t.cx, t.cz, CHUNK);
      if (t.grass) root.add(t.grass);
    } else if (!wantGrass && t.grass) {
      root.remove(t.grass);
      t.grass.dispose();
      t.grass = null;
    }
  }

  // Bring the land around (x, z) up to date. `budgetMs` limits the work per frame;
  // pass Infinity to build everything at once (used while the loading clouds are up).
  function update(x, z, budgetMs = 6) {
    if (!farCentre || Math.hypot(x - farCentre.x, z - farCentre.z) > FAR_RECENTRE) placeFar(x, z);
    // snap the water to whole ripple repeats so the ripples don't jump when it moves
    water.position.set(Math.round(x / 1400) * 1400, SEA_LEVEL, Math.round(z / 1400) * 1400);

    const pcx = Math.floor(x / CHUNK), pcz = Math.floor(z / CHUNK);
    const jobs = [];
    const keep = new Set();
    for (let dz = -maxR; dz <= maxR; dz++) {
      for (let dx = -maxR; dx <= maxR; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dz));
        const segs = lodFor(d);
        const cx = pcx + dx, cz = pcz + dz;
        const k = tkey(cx, cz);
        keep.add(k);
        const t = tiles.get(k);
        if (!t || t.segs !== segs) jobs.push({ cx, cz, segs, d, kind: 'tile' });
        const wantVeg = d <= VEG_RANGE, wantGrass = d <= GRASS_RANGE;
        if (t && (!!t.veg !== wantVeg || !!t.grass !== wantGrass)) jobs.push({ cx, cz, d, kind: 'veg', wantVeg, wantGrass });
      }
    }
    for (const [k, t] of tiles) {
      if (keep.has(k)) continue;
      setVeg(t, false, false);
      root.remove(t.mesh);
      t.mesh.geometry.dispose();
      tiles.delete(k);
    }
    jobs.sort((a, b) => a.d - b.d);
    const start = performance.now();
    for (const j of jobs) {
      if (performance.now() - start > budgetMs) break;
      if (j.kind === 'tile') {
        const t = buildTile(j.cx, j.cz, j.segs, j.d);
        setVeg(t, j.d <= VEG_RANGE, j.d <= GRASS_RANGE);
      } else {
        const t = tiles.get(tkey(j.cx, j.cz));
        if (t) setVeg(t, j.wantVeg, j.wantGrass);
      }
    }
    return jobs.length;
  }

  // Break a bush or small tree: hide it, stop it blocking, and remember it
  function breakThing(entry) {
    hideInstance(entry.mesh, entry.index);
    colliders.remove([entry]);
    broken.add(entry.key);
    return BREAKABLE[entry.kind];
  }

  return {
    update,
    colliders,
    breakThing,
    animate(t) {
      normals.offset.x += 0.00002;
      normals.offset.y += 0.000013;
      veg.animate?.(t);
    },
    dispose() {
      for (const t of tiles.values()) { setVeg(t, false, false); t.mesh.geometry.dispose(); }
      tiles.clear();
      far?.geometry.dispose();
    },
  };
}

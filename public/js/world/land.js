// The whole world as 3D land, streamed in around the player at real scale (1 unit = 1 metre).
// Near the player the ground is detailed and has trees, rocks and grass; further away it gets
// coarser; a low-detail "horizon" covers everything out to about 24 km so mountains show far off.
import * as THREE from 'three';
import { sample, rememberHeight, forgetHeights, vnoise, SEA_LEVEL, lakesWithLevels, isFrozen, LAKE_DRAWN, VOLCANOES, toWorld, cityFloorAt } from '../data/world-layout.mjs';
import { scenery, hideInstance, BREAKABLE, setSceneryQuality } from './scenery.js';

export const CHUNK = 256;                 // metres per terrain tile
// (these change with the graphics quality; see quality.js)
let LODS = [[2, 64], [4, 32], [7, 16], [11, 8]]; // [tile distance up to, grid segments]
let VEG_RANGE = 3;                      // tiles with trees and rocks
let GRASS_RANGE = 1;                    // tiles with grass
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
  ice: C('#a9c9d8'), ice2: C('#d6e6ee'),
  tundra: C('#9aa08a'), darkFloor: C('#1f2a17'), gold: C('#a39a48'), gold2: C('#b8a457'),
  jungle: C('#3f8a2c'), heath: C('#7a7a52'), cinder: C('#2a2220'), lavaRock: C('#6a2412'),
};
// the volcanoes' black cinder cones, with no snow on them (they are too hot), and red rock round the craters
const VOLCANO_AT = VOLCANOES.map(([px, py]) => toWorld(px, py));
const tmpC = new THREE.Color();

function groundColor(s, ny, wx, wz, far, out) {
  const h = s.h;
  const n = vnoise(wx / 37, wz / 37);
  // a frozen lake: pale blue ice, with whiter patches of snow blown over it
  if (s.ice) return out.copy(PAL.ice).lerp(PAL.ice2, Math.max(0, n - 0.35) * 1.4);
  if (h < -0.4) {
    out.copy(PAL.seabed).lerp(PAL.deep, Math.min(1, -h / 30));
    return out;
  }
  switch (s.region) {
    case 'heart':
      if (s.biome === 'plains') out.copy(PAL.gold).lerp(PAL.gold2, n).lerp(PAL.grass2, 0.25);
      else if (s.biome === 'jungle') out.copy(PAL.jungle).lerp(PAL.grass2, n * 0.6);
      else if (s.biome === 'highland') out.copy(PAL.grass).lerp(PAL.heath, 0.4 + n * 0.4);
      else out.copy(PAL.grass).lerp(PAL.grass2, n);
      out.lerp(far ? PAL.canopy : PAL.forestFloor, Math.min(1, s.forest * (far ? 1.3 : 1.1)));
      if (s.dark) out.lerp(PAL.darkFloor, Math.min(1, s.dark * 0.8));
      if (h > 260) out.lerp(PAL.rock, Math.min(1, (h - 260) / 300));
      break;
    case 'peaks': {
      out.copy(PAL.darkRock).lerp(PAL.ash, n);
      if (h < 300) out.lerp(PAL.grass, (1 - h / 300) * 0.7);
      let vd = Infinity;
      for (const v of VOLCANO_AT) vd = Math.min(vd, Math.hypot(wx - v.x, wz - v.z));
      const hot = vd < 9000 ? 1 - vd / 9000 : 0;
      if (h > 1100) out.lerp(PAL.snow, Math.min(1, (h - 1100) / 250) * (1 - Math.min(1, hot * 2.5)));
      if (hot > 0) out.lerp(PAL.cinder, Math.min(0.85, hot * 1.6));
      if (vd < 480) out.lerp(PAL.lavaRock, Math.min(1, (480 - vd) / 200) * (0.5 + n * 0.4));
      break;
    }
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
// (a generator: it hands back control every few rows, so a tile can be built over several frames;
// see buildTile)
function* tileGeometrySteps(cx, cz, segs) {
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
      rememberHeight(wx, wz, s.h); // (for surfaceAt: the trees, grass and you stand on these points)
      // inside a great city's inner wall the land sinks out of sight: the city draws its own floors
      const city = cityFloorAt(wx, wz, 0.3);
      hs[(j + 1) * b + (i + 1)] = city ? city.flat - 2.5 : s.h;
      if (inner) info[j * n + i] = s;
    }
    if (j % 6 === 5) yield;
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

// Built a few rows at a time (a generator: each step is a row), so moving the horizon along as you
// travel never stalls a frame: it used to work out all 58,000 of its points in one go every 4 km
let FAR_INDEX = null; // (the triangles are the same every time)
function* farGeometrySteps(centreX, centreZ) {
  const n = FAR_SEGS + 1;
  const step = FAR_SIZE / FAR_SEGS;
  const hs = new Float32Array(n * n);
  const infos = new Array(n * n);
  const x0 = centreX - FAR_SIZE / 2, z0 = centreZ - FAR_SIZE / 2;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) { const s = sample(x0 + i * step, z0 + j * step, {}); hs[j * n + i] = s.h; infos[j * n + i] = s; }
    yield;
  }
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
    if (j % 8 === 7) yield;
  }
  if (!FAR_INDEX) {
    FAR_INDEX = new Uint32Array(FAR_SEGS * FAR_SEGS * 6);
    let q = 0;
    for (let j = 0; j < FAR_SEGS; j++) for (let i = 0; i < FAR_SEGS; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      FAR_INDEX.set([a, c, b, b, c, d], q); q += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(FAR_INDEX, 1));
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
    // `groundOf(x, z)` (while flying): things that stand on the ground only stop you below their top
    push(pos, radius, groundOf = null) {
      const cx = Math.floor(pos.x / cell), cz = Math.floor(pos.z / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const t of grid.get(key(cx + dx, cz + dz)) || []) {
            if (t.camOnly) continue; // (an awning or roof you walk under: it only stops the camera)
            const ox = pos.x - t.x, oz = pos.z - t.z;
            const d = Math.hypot(ox, oz);
            const min = t.r + radius;
            // something built on an upper storey only stops you on that storey (you walk under or over it)
            if (t.y !== undefined && pos.y !== undefined && (pos.y >= t.y + (t.height || 8) - 0.4 || pos.y + 1.7 < t.y)) continue;
            if (groundOf && t.y === undefined && pos.y >= groundOf(t.x, t.z) + (t.height || 8) - 0.4) continue;
            // low things you can climb onto (a log, a step) don't stop you: you walk up onto them
            if (t.step && pos.y !== undefined && t.y + t.height <= pos.y + 0.8) continue;
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
  // The horizon is coarse (a point every 200 m), so in a narrow valley it can rise above the real
  // ground. Wherever the detailed land is already drawn, the horizon is not drawn at all.
  const nearBox = { value: new THREE.Vector4(1, 1, -1, -1) }; // minX, minZ, maxX, maxZ (empty to start)
  farMat.onBeforeCompile = (sh) => {
    sh.uniforms.uNearBox = nearBox;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFarW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFarW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFarW;\nuniform vec4 uNearBox;')
      .replace('void main() {', 'void main() {\n  if (vFarW.x > uNearBox.x && vFarW.y > uNearBox.y && vFarW.x < uNearBox.z && vFarW.y < uNearBox.w) discard;');
  };
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
  const lakeMats = [], lakeDiscs = [];
  for (const L of lakesWithLevels()) {
    if (isFrozen(L)) continue; // (ice: the land itself is drawn flat and pale blue there)
    const n = normals.clone();
    n.repeat.set((L.r * 2.6) / 14, (L.r * 2.6) / 14);
    const lakeMat = waterMat.clone();
    lakeMat.normalMap = n;
    lakeMats.push(lakeMat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(L.r * LAKE_DRAWN, 64), lakeMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(L.x, L.level, L.z);
    disc.receiveShadow = true;
    disc.userData.reach = L.r * LAKE_DRAWN + 30000; // far lakes are hidden (the fog covers them anyway)
    lakeDiscs.push(disc);
    scene.add(disc);
  }

  let far = null;
  let farCentre = null;
  let farJob = null; // the next horizon, being built a few rows a frame (the old one stays till it's done)
  function placeFar(x, z, budgetMs) {
    const cx = Math.round(x / 1000) * 1000, cz = Math.round(z / 1000) * 1000;
    if (farJob?.cx !== cx || farJob?.cz !== cz) farJob = { it: farGeometrySteps(cx, cz), cx, cz };
    const t0 = performance.now();
    let r;
    do r = farJob.it.next(); while (!r.done && performance.now() - t0 < budgetMs);
    if (!r.done) return;
    const geo = r.value;
    if (far) { far.geometry.dispose(); far.geometry = geo; } else {
      far = new THREE.Mesh(geo, farMat);
      far.receiveShadow = false;
      scene.add(far);
    }
    far.position.set(cx, 0, cz);
    farCentre = { x: cx, z: cz };
    farJob = null;
  }

  const tkey = (cx, cz) => `${cx},${cz}`;
  const lodFor = (d) => { for (const [r, s] of LODS) if (d <= r) return s; return 0; };

  // A tile being built a few rows a frame: key -> { segs, it }. Building a whole detailed tile
  // (4,500 points of the land) in one frame was the biggest stutter while walking.
  const building = new Map();
  // work on tile (cx, cz) for up to budgetMs; the finished tile, or null if it isn't done yet
  function buildTile(cx, cz, segs, d, budgetMs = Infinity) {
    const k0 = tkey(cx, cz);
    let b = building.get(k0);
    if (!b || b.segs !== segs) building.set(k0, (b = { segs, it: tileGeometrySteps(cx, cz, segs) }));
    const t0 = performance.now();
    let r;
    do r = b.it.next(); while (!r.done && performance.now() - t0 < budgetMs);
    if (!r.done) return null;
    building.delete(k0);
    const { geo } = r.value;
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

  // (oneStep: build the trees or the grass, not both, so each costs a frame of its own)
  function setVeg(t, want, wantGrass, oneStep = false) {
    if (want && !t.veg) {
      t.veg = veg.forTile(t.cx, t.cz, CHUNK, (k) => broken.has(k));
      t.veg.view(lastX, lastZ);
      root.add(t.veg.group);
      colliders.add(t.veg.solid);
      if (oneStep && wantGrass && !t.grass) return;
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
  let lastX = 0, lastZ = 0;
  function update(x, z, budgetMs = 6) {
    lastX = x; lastZ = z;
    for (const t of tiles.values()) t.veg?.view(x, z);
    for (const d of lakeDiscs) d.visible = Math.hypot(x - d.position.x, z - d.position.z) < d.userData.reach;
    if (!farCentre) placeFar(x, z, Infinity);
    else if (farJob || Math.hypot(x - farCentre.x, z - farCentre.z) > FAR_RECENTRE) placeFar(farJob && budgetMs !== Infinity ? farJob.cx : x, farJob && budgetMs !== Infinity ? farJob.cz : z, Math.min(budgetMs, 3));
    // snap the water to whole ripple repeats so the ripples don't jump when it moves
    water.position.set(Math.round(x / 1400) * 1400, SEA_LEVEL, Math.round(z / 1400) * 1400);

    const pcx = Math.floor(x / CHUNK), pcz = Math.floor(z / CHUNK);
    const maxR = LODS[LODS.length - 1][0];
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
    for (const k of building.keys()) if (!keep.has(k)) building.delete(k);
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
        const t = buildTile(j.cx, j.cz, j.segs, j.d, budgetMs === Infinity ? Infinity : Math.max(2, budgetMs - (performance.now() - start)));
        if (!t) break; // (carries on next frame)
        // its trees and grass come on a later frame (a 'veg' job), so one frame never pays for both
        // (when everything is built at once, behind the loading clouds, they come now)
        if (budgetMs === Infinity) setVeg(t, j.d <= VEG_RANGE, j.d <= GRASS_RANGE);
      } else {
        const t = tiles.get(tkey(j.cx, j.cz));
        if (t) setVeg(t, j.wantVeg, j.wantGrass, budgetMs !== Infinity);
      }
    }
    // the square around you where every detailed tile is built: the horizon is hidden inside it
    let r = maxR;
    for (const j of jobs) if (j.kind === 'tile' && j.d <= r && !tiles.has(tkey(j.cx, j.cz))) r = j.d - 1;
    if (r >= 0) nearBox.value.set((pcx - r) * CHUNK, (pcz - r) * CHUNK, (pcx + r + 1) * CHUNK, (pcz + r + 1) * CHUNK);
    else nearBox.value.set(1, 1, -1, -1);
    return jobs.length;
  }

  // Break a bush or small tree: hide it, stop it blocking, and remember it
  function breakThing(entry) {
    hideInstance(entry.mesh, entry.index);
    colliders.remove([entry, ...(entry.roots || [])]);
    broken.add(entry.key);
    return BREAKABLE[entry.kind];
  }

  // The ground changed around (x, z) (a plot was levelled): drop those tiles so they are rebuilt
  function refreshAt(x, z, r = 30) {
    building.clear(); forgetHeights(); // (half-built tiles and remembered heights are of the old ground)
    for (const [k, t] of tiles) {
      const x0 = t.cx * CHUNK, z0 = t.cz * CHUNK;
      if (x + r < x0 || x - r > x0 + CHUNK || z + r < z0 || z - r > z0 + CHUNK) continue;
      setVeg(t, false, false);
      root.remove(t.mesh);
      t.mesh.geometry.dispose();
      tiles.delete(k);
    }
  }

  // graphics quality: how far the land, trees and grass reach (tiles catch up on the next updates)
  function setQuality(q) {
    LODS = q.lods; VEG_RANGE = q.veg; GRASS_RANGE = q.grass;
    setSceneryQuality(q);
    for (const t of tiles.values()) if (t.grass) { root.remove(t.grass); t.grass.dispose(); t.grass = null; } // regrown at the new thickness
  }

  return {
    update,
    refreshAt,
    setQuality,
    colliders,
    breakThing,
    animate(t) {
      // the ripples drift and swell, so the water looks like it moves (each repeat is 14 m)
      normals.offset.set(t * 0.03, t * 0.019);
      waterMat.normalScale.setScalar(0.3 + Math.sin(t * 0.7) * 0.08);
      for (const L of lakeMats) { L.normalMap.offset.set(t * 0.024, -t * 0.016); L.normalScale.copy(waterMat.normalScale); }
      veg.animate?.(t);
    },
    dispose() {
      for (const t of tiles.values()) { setVeg(t, false, false); t.mesh.geometry.dispose(); }
      tiles.clear();
      far?.geometry.dispose();
    },
  };
}

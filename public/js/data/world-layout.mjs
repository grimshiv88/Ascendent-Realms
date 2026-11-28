import { CITY_R, INNER_R, cityGround } from './citylevels.mjs';
const CITY_FLATS = []; // each walled city's middle and the level of its foot (filled in below)
// The world's layout, shared by the 3D terrain, the in-game map and the map draft page.
// Map coordinates are pixels on the 1600 × 1000 map, where 1 pixel = 400 metres (the world is
// 640 km × 400 km; the Heartland alone is about 300 km across).
// World coordinates are metres, with the spawn point in the Central Forest at (0, 0).
// North is up on the map and −z in the world.

export const METRES_PER_PX = 400;
export const MAP_W = 1600;
export const MAP_H = 1000;
export const ORIGIN_PX = { x: 800, y: 520 };

export const toWorld = (px, py) => ({ x: (px - ORIGIN_PX.x) * METRES_PER_PX, z: (py - ORIGIN_PX.y) * METRES_PER_PX });
export const toMap = (x, z) => ({ x: ORIGIN_PX.x + x / METRES_PER_PX, y: ORIGIN_PX.y + z / METRES_PER_PX });
export const WORLD_BOUNDS = {
  minX: -ORIGIN_PX.x * METRES_PER_PX, maxX: (MAP_W - ORIGIN_PX.x) * METRES_PER_PX,
  minZ: -ORIGIN_PX.y * METRES_PER_PX, maxZ: (MAP_H - ORIGIN_PX.y) * METRES_PER_PX,
};

export const REGIONS = [
  { id: 'heart', name: 'The Verdant Heartland', who: 'All player races', land: { x: 800, y: 520, r: 260, seed: 3, stretch: [1.1, 0.9] },
    text: 'The central continent. Everyone playing a Player race starts here, in the Central City. Land here is bought with coins and can grow into countries.', size: 'About 300 km across' },
  { id: 'peaks', name: 'Dragon Peaks', who: 'Dragonewts', land: { x: 790, y: 115, r: 175, seed: 11, stretch: [1.55, 0.48] },
    text: 'Volcanic mountains in the far north. Dragonewts hatch in nests high on the cliffs. The hardest homeland to survive in.', size: 'About 200 km wide' },
  { id: 'warrens', name: 'Ashen Wastes', who: 'Goblins and Slimes', land: { x: 230, y: 470, r: 175, seed: 7, stretch: [0.85, 1.35] },
    text: 'Dry badlands in the west. Goblins live in the Goblin Warrens, a maze of tunnels. Slimes start in the Slime Caves under the Gloomhollow cliffs.', size: 'About 140 km across' },
  { id: 'fae', name: 'The Fae Isles', who: 'Fairies', islands: [[1395, 300, 70, 21], [1475, 410, 52, 22], [1365, 470, 46, 23], [1500, 220, 40, 24], [1450, 540, 34, 25]],
    text: 'An archipelago of glowing islands in the east. The Fairy Glade sits on the largest island, hidden by mist.', size: 'Islands of 25 to 70 km' },
  { id: 'mire', name: 'Mirefall', who: 'Lizardmen and Nagas', land: { x: 1130, y: 905, r: 150, seed: 5, stretch: [1.7, 0.45] },
    text: 'A southern land of swamps around a great lake. Lizardmen live in the Lizardman Marsh. The Naga Lake Temple rises from the middle of the lake.', size: 'About 250 km wide' },
  { id: 'frost', name: 'Frostreach', who: 'Unclaimed (future)', land: { x: 240, y: 110, r: 120, seed: 13, stretch: [1.3, 0.6] },
    text: 'Frozen land in the north-west, saved for a future expansion.', size: 'About 120 km wide' },
  { id: 'sun', name: 'Sunscar Desert', who: 'Unclaimed (future)', land: { x: 330, y: 880, r: 140, seed: 17, stretch: [1.4, 0.55] },
    text: 'A desert in the south-west, saved for a future expansion.', size: 'About 160 km wide' },
];

// Named sections inside each continent, each with its own kind of land (biome). Inspired by the
// real world's wild places, with names of their own. [region, name, map x, map y, radius (map px), biome]
export const SECTIONS = [
  ['heart', 'Greenwood', 800, 520, 70, 'forest'],
  ['heart', 'The Dark Forests', 600, 630, 40, 'darkwood'],
  ['heart', 'Amberfields', 690, 420, 70, 'plains'],
  ['heart', 'Jadewild', 930, 660, 80, 'jungle'],
  ['heart', 'Stonecrown Highlands', 1010, 440, 80, 'highland'],
  ['heart', 'Silvermere Vale', 640, 540, 50, 'lakeland'],
  ['heart', 'Northmarch', 830, 330, 70, 'hills'],
  ['peaks', 'Ashen Spires', 790, 100, 70, 'volcanic'],
  ['peaks', 'Cinder Steppe', 600, 140, 70, 'steppe'],
  ['peaks', 'Emberwild', 990, 120, 60, 'volcanic'],
  ['warrens', 'Redsand Mesas', 240, 420, 80, 'badlands'],
  ['warrens', 'Gloomhollow', 200, 610, 60, 'badlands'],
  ['fae', 'The Glimmering Isles', 1430, 380, 200, 'fae'],
  ['mire', 'Drowned Fen', 960, 905, 90, 'swamp'],
  ['mire', 'Reedmere', 1300, 905, 90, 'swamp'],
  ['frost', 'Whiteveil Icefield', 240, 110, 120, 'icefield'],
  ['sun', 'Sunscar Dunes', 290, 880, 90, 'desert'],
  ['sun', 'Palmwater Oasis', 400, 890, 35, 'oasis'],
].map(([region, name, px, py, r, biome]) => ({ region, name, px, py, r, biome }));
// How each kind of land is shaped: how thick the trees grow, how hilly, how mountainous (sharp
// peaks), how much is flat-topped mesa, and how dark the woods are
export const BIOMES = {
  forest: { forest: 0.75, hills: 0.35, peaks: 0, mesa: 0, dark: 0 },
  darkwood: { forest: 0.97, hills: 0.45, peaks: 0, mesa: 0, dark: 1 },
  plains: { forest: 0.06, hills: 0.12, peaks: 0, mesa: 0, dark: 0 },
  jungle: { forest: 0.95, hills: 0.7, peaks: 0.1, mesa: 0, dark: 0 },
  highland: { forest: 0.15, hills: 0.8, peaks: 1, mesa: 1, dark: 0 },
  lakeland: { forest: 0.4, hills: 0.2, peaks: 0, mesa: 0, dark: 0 },
  hills: { forest: 0.45, hills: 1, peaks: 0.25, mesa: 0, dark: 0 },
};
const SECTIONS_OF = {};
for (const sc of SECTIONS) (SECTIONS_OF[sc.region] ||= []).push(sc);
// the section a map point is in (the nearest, measured against each one's size)
export function sectionAt(px, py, region) {
  let best = null, bd = Infinity;
  for (const sc of SECTIONS_OF[region] || []) { const d = Math.hypot(px - sc.px, py - sc.py) / sc.r; if (d < bd) { bd = d; best = sc; } }
  return best;
}
// a soft blend of the sections' land shapes around a map point, so one kind of land fades into the next
const _mix = { forest: 0, hills: 0, peaks: 0, mesa: 0, dark: 0 };
function biomeMix(px, py, region) {
  let tw = 0;
  for (const k in _mix) _mix[k] = 0;
  for (const sc of SECTIONS_OF[region] || []) {
    const b = BIOMES[sc.biome];
    if (!b) continue;
    const d = Math.hypot(px - sc.px, py - sc.py) / sc.r;
    const w = Math.exp(-d * d * 1.6) + 1e-6;
    tw += w;
    for (const k in _mix) _mix[k] += b[k] * w;
  }
  if (!tw) return null;
  for (const k in _mix) _mix[k] /= tw;
  return _mix;
}

// Named places on the map. `home` places are where monster races start.
export const PLACES = [
  { id: 'central', name: 'Central City', px: 800, py: 520, region: 'heart', spawn: true, city: true },
  { id: 'crossroads', name: 'Old Crossroads', px: 776, py: 506, region: 'heart', village: true },
  { id: 'riverhold', name: 'Riverhold', px: 838, py: 538, region: 'heart', village: true },
  { id: 'hills', name: 'Eastern Hills', px: 852, py: 486, region: 'heart', village: true },
  { id: 'nests', name: 'Dragon Nests', px: 800, py: 150, region: 'peaks', home: 'Dragon Peaks' },
  { id: 'warrens', name: 'Goblin Warrens', px: 250, py: 420, region: 'warrens', home: 'Goblin Warrens' },
  { id: 'slimecaves', name: 'Slime Caves (Gloomhollow)', px: 200, py: 610, region: 'warrens', home: 'Slime Caves' },
  { id: 'glade', name: 'Fairy Glade', px: 1395, py: 300, region: 'fae', home: 'Fairy Glade' },
  { id: 'temple', name: 'Naga Lake Temple', px: 1130, py: 905, region: 'mire', home: 'Naga Lake Temple' },
  { id: 'marsh', name: 'Lizardman Marsh', px: 930, py: 900, region: 'mire', home: 'Lizardman Marsh' },
  // the Monster Cities: one in the middle of each monster continent, owned by no one, each built in its land's own style
  { id: 'emberfall', name: 'Emberfall', px: 854, py: 100, region: 'peaks', city: true, monster: true, style: 'peaks' },
  { id: 'ashgrave', name: 'Ashgrave', px: 202, py: 478, region: 'warrens', city: true, monster: true, style: 'wastes' },
  { id: 'lumenhollow', name: 'Lumenhollow', px: 1359, py: 288, region: 'fae', city: true, monster: true, style: 'fae' },
  { id: 'mirehaven', name: 'Mirehaven', px: 1290, py: 900, region: 'mire', city: true, monster: true, style: 'mire' },
];

// Rivers of the Heartland as cubic curves in map pixels: [start, control 1, control 2, end].
export const RIVERS = [
  [[680, 370], [740, 460], [790, 480], [840, 510]],
  [[840, 510], [960, 580], [960, 680], [1100, 750]],
  [[1000, 380], [1050, 420], [1100, 470], [1160, 520]],
  [[880, 620], [900, 700], [960, 740], [1000, 800]],
  [[940, 600], [990, 620], [1040, 660], [1090, 690]],
  [[700, 600], [650, 650], [600, 700], [560, 760]],
  [[770, 330], [700, 300], [640, 280], [570, 250]],
  [[600, 520], [560, 500], [520, 470], [470, 440]],
  [[880, 300], [900, 260], [930, 240], [960, 220]],
  // the long river through the Sunscar desert, green along its banks
  [[220, 840], [280, 870], [350, 885], [430, 905]],
];
// the regions whose rivers cut through the land
const RIVER_LANDS = new Set(['heart', 'sun']);
export const LAKE = { x: 1130, y: 905, r: 48, seed: 42, stretch: [1.5, 0.7], wobble: 0.18 };

// Smaller lakes [map x, map y, radius in map pixels]. Each sits a little below the land around it.
export const LAKES = [
  [740, 560, 6], [860, 440, 5], [700, 610, 7], [905, 525, 4], [615, 525, 8], [780, 405, 5],
  [1005, 470, 6], [645, 430, 4], [880, 645, 5], [1395, 322, 4], [1478, 412, 3], [220, 122, 5],
  [300, 98, 4], [262, 472, 3], [1000, 885, 4],
];

// Caves [map x, map y, the way the entrance faces (radians)]. Monsters lurk inside.
export const CAVES = [
  [262, 432, 0.4], [236, 410, 2.2], [276, 404, 4.1], [206, 598, 1.5], [188, 622, 3.2],
  [722, 500, 0.6], [880, 562, 2.5], [992, 420, 4], [760, 172, 1], [250, 98, 2], [1420, 300, 3.6],
  // small caves dotted through the Heartland's forest and hills, the nearest a short walk from the spawn
  [811, 529, 3.9], [787, 512, 0.9], [806, 503, 5.2], [779, 538, 1.8], [826, 517, 4.6], [770, 495, 0.2],
  [842, 548, 3.1], [748, 530, 1.2], [818, 480, 5.8], [856, 498, 4.4], [735, 470, 0.7], [795, 575, 2.9],
  [870, 600, 3.6], [700, 540, 1.4], [905, 470, 4.9], [660, 450, 0.4],
].map((c, i) => (i < 11 ? c : [800 + (c[0] - 800) / 4, 520 + (c[1] - 520) / 4, c[2]])); // (the small ones stay near the spawn)
export const VOLCANOES = [[700, 110], [905, 95], [800, 150]];

// Where a race starts: its homeland place, or the Central Forest.
export function homePlace(homeName) {
  return PLACES.find((p) => p.home === homeName) || PLACES[0];
}

// ---------- noise ----------

export function noise1(a, seed) {
  return Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 7 + seed * 2.1) * 0.25 + Math.sin(a * 13 + seed * 3.7) * 0.12 + Math.sin(a * 23 + seed * 1.3) * 0.06;
}

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oct = 5) {
  let total = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    total += vnoise(x * freq + i * 17.3, z * freq - i * 9.1) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return total / norm;
}
// Sharp mountain ridges
function ridged(x, z, oct = 5) {
  let total = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(vnoise(x * freq + i * 5.7, z * freq + i * 3.3) * 2 - 1);
    total += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return total / norm;
}
const smoothstep = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- land shapes ----------

const BLOBS = [];
for (const reg of REGIONS) {
  if (reg.islands) {
    for (const [x, y, r, seed] of reg.islands) BLOBS.push({ region: reg.id, x, y, r, seed, stretch: [1.2, 0.9], wobble: 0.28 });
  } else {
    BLOBS.push({ region: reg.id, ...reg.land, wobble: 0.22 });
  }
}

// How far inside a blob shape a map point is, in map pixels (negative = outside).
function insideBlob(b, px, py) {
  const u = (px - b.x) / b.stretch[0];
  const v = (py - b.y) / b.stretch[1];
  const d = Math.hypot(u, v);
  if (d > b.r * 1.6) return -(d - b.r * 1.6) - b.r * 0.3;
  const edge = b.r * (1 + noise1(Math.atan2(v, u), b.seed) * b.wobble);
  return (edge - d) * Math.min(b.stretch[0], b.stretch[1]);
}

// The river curves sampled into polylines (in metres).
const RIVER_LINES = RIVERS.map((c) => {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, s = 1 - t;
    const px = s * s * s * c[0][0] + 3 * s * s * t * c[1][0] + 3 * s * t * t * c[2][0] + t * t * t * c[3][0];
    const py = s * s * s * c[0][1] + 3 * s * s * t * c[1][1] + 3 * s * t * t * c[2][1] + t * t * t * c[3][1];
    pts.push(toWorld(px, py));
  }
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  return { pts, box: [Math.min(...xs) - 600, Math.max(...xs) + 600, Math.min(...zs) - 600, Math.max(...zs) + 600] };
});

export function riverDistance(x, z) {
  let best = Infinity;
  for (const r of RIVER_LINES) {
    if (x < r.box[0] || x > r.box[1] || z < r.box[2] || z > r.box[3]) continue;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
      if (d < best) best = d;
    }
  }
  // a little wander so the banks are not perfectly smooth
  return best + (vnoise(x * 0.01, z * 0.01) - 0.5) * 30;
}

// The places and lakes, and a grid over them (1 km squares) so a point only checks those near it.
// Filled once the generated villages, caves and lakes are known (see the end of this file).
const PLACE_POS = [];
const LAKE_POS = [];
const GRID = 1000;
const placeGrid = new Map(), lakeGrid = new Map();
let flattenOn = true;
function gridAdd(map, x, z, r, item) {
  for (let i = Math.floor((x - r) / GRID); i <= Math.floor((x + r) / GRID); i++) {
    for (let j = Math.floor((z - r) / GRID); j <= Math.floor((z + r) / GRID); j++) {
      const k = i * 100003 + j;
      let list = map.get(k);
      if (!list) map.set(k, (list = []));
      list.push(item);
    }
  }
}
const NONE = [];
const gridAt = (map, x, z) => map.get(Math.floor(x / GRID) * 100003 + Math.floor(z / GRID)) || NONE;

// How big each lake's water surface is drawn (a disc this many times its radius, see land.js)
export const LAKE_DRAWN = 1.3;
// The lakes of Frostreach are frozen over: ice you walk on, drawn as land, with no water surface
export function isFrozen(L) {
  return (L.frozen ??= sample(L.x, L.z, {}, false).region === 'frost');
}
export const frozenLake = (i) => !!LAKE_POS[i] && isFrozen(LAKE_POS[i]); // (by its place in LAKES)

// A lake's water level: just below the lowest land around its shore
function lakeLevel(L) {
  L.level = 0;
  let low = Infinity;
  const tmp = {};
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    low = Math.min(low, sample(L.x + Math.cos(a) * L.r * 1.3, L.z + Math.sin(a) * L.r * 1.3, tmp, false).h);
  }
  return Math.max(SEA_LEVEL + 0.5, low - 1.5);
}

// ---------- the terrain ----------

export const SEA_LEVEL = 0;

// Everything about one point of the world: ground height, which region, and what grows there.
// `out` is reused to avoid creating objects in hot loops.
// The caves underground are laid out far past the map's edge (see depths.mjs); while one is loaded,
// it answers for the ground out there
export const DEPTHS_X = 1000000;
let underground = null;
export function setUnderground(fn) { underground = fn; }

export function sample(x, z, out = {}, withLakes = true) {
  if (x > DEPTHS_X) {
    if (underground) return underground(x, z, out);
    out.h = -1e5; out.water = -1e4; out.region = null; out.forest = 0; out.wet = 0; out.lake = 0; out.coast = 0; out.ice = 0;
    return out;
  }
  const px = ORIGIN_PX.x + x / METRES_PER_PX;
  const py = ORIGIN_PX.y + z / METRES_PER_PX;

  // which land is this, and how far from its coast (metres)
  let best = -Infinity, region = null;
  for (const b of BLOBS) {
    const d = insideBlob(b, px, py);
    if (d > best) { best = d; region = b.region; }
  }
  let coast = best * METRES_PER_PX;
  coast += (fbm(x / 2400, z / 2400, 4) - 0.5) * 2200 + (fbm(x / 300, z / 300, 3) - 0.5) * 260;

  let h;
  let forest = 0;     // 0–1 how thickly trees grow
  let wet = 0;        // marsh
  let lake = 0;
  let dark = 0;       // how gloomy the woods are (the Dark Forests)
  if (coast < 0) {
    h = Math.max(-80, coast * 0.04) - 1.5;
    region = coast > -1500 ? region : null;
  } else {
    let base;
    const roll = fbm(x / 1800, z / 1800);
    const bumps = fbm(x / 160, z / 160, 3) - 0.5;
    switch (region) {
      case 'heart': {
        // the Heartland's sections blend into each other: forest, plains, jungle, lakes, hills and
        // the rocky highlands with their sharp peaks and flat-topped mesas (gentle by the spawn)
        const mix = biomeMix(px, py, 'heart');
        const away = smoothstep(Math.hypot(x, z), 350, 1500);
        base = 30 + (roll - 0.5) * 60 + bumps * 6;
        const knolls = Math.pow(smoothstep(fbm(x / 650 + 11, z / 650 - 3, 3), 0.48, 0.78), 1.6) * 70;
        const crags = Math.pow(ridged(x / 1100 + 2, z / 1100 + 9, 4), 2.2) * 230 * smoothstep(fbm(x / 2600 - 6, z / 2600 + 1, 3), 0.5, 0.64);
        base += (knolls + crags) * away * (0.35 + mix.hills * 1.1);
        // rolling hill country
        base += Math.pow(fbm(x / 3000 + 5, z / 3000 - 8, 4), 2) * 280 * mix.hills * away;
        // sharp, rocky peaks
        base += Math.pow(ridged(x / 2600 + 7, z / 2600, 5), 1.7) * 1400 * smoothstep(mix.peaks, 0.12, 0.6);
        // mesas: flat-topped mountains with cliff sides (villages sit on some of them)
        const mesa = smoothstep(mix.mesa, 0.2, 0.7) * away;
        if (mesa > 0) base += mesaTop(x, z) * mesa;
        forest = mix.forest * (0.55 + fbm(x / 700 + 9, z / 700, 3) * 0.75);
        forest *= 1 - smoothstep(crags * away, 70, 160); // bare rock on the crag tops
        forest *= 1 - smoothstep(base, 520, 820);        // and above the tree line
        dark = mix.dark;
        break;
      }
      case 'peaks': {
        const inland = smoothstep(coast, 300, 6000);
        base = 30 + Math.pow(ridged(x / 5200, z / 5200), 1.6) * 1900 * inland + roll * 80;
        for (const [vx, vy] of VOLCANOES) {
          const d = Math.hypot(px - vx, py - vy) * METRES_PER_PX;
          if (d < 9000) {
            const cone = Math.pow(1 - d / 9000, 1.6) * 1700;
            const crater = d < 380 ? (1 - d / 380) * 260 : 0;
            base = Math.max(base, cone - crater + 40);
          }
        }
        forest = smoothstep(500 - base, 0, 300) * 0.35 * fbm(x / 600, z / 600, 2);
        break;
      }
      case 'warrens': {
        // badlands: stepped mesas, taller and cliffier at Gloomhollow in the south
        const south = smoothstep(py, 520, 640);
        const n = fbm(x / 2600, z / 2600, 4) * (140 + south * 260);
        const step = 22 + south * 18;
        const fl = Math.floor(n / step);
        const fr = n / step - fl;
        base = 8 + fl * step + smoothstep(fr, 0.72, 0.95) * step + bumps * 4;
        // a jagged range along the north of the wastes
        base += Math.pow(ridged(x / 3000, z / 3000 + 4), 1.5) * 800 * smoothstep(400, 330, py) * smoothstep(coast, 300, 3000);
        forest = 0.05;
        break;
      }
      case 'fae':
        base = 6 + roll * 120 + bumps * 8;
        forest = 0.35 + fbm(x / 500, z / 500, 3) * 0.6;
        break;
      case 'mire': {
        const marsh = fbm(x / 600, z / 600, 4);
        base = 2.2 + (marsh - 0.5) * 7 + bumps * 1.5;
        wet = 1;
        forest = smoothstep(marsh, 0.45, 0.65) * 0.55;
        // the great lake with the temple island in the middle
        const u = (px - LAKE.x) / LAKE.stretch[0], v = (py - LAKE.y) / LAKE.stretch[1];
        const ld = Math.hypot(u, v);
        const edge = LAKE.r * (1 + noise1(Math.atan2(v, u), LAKE.seed) * LAKE.wobble);
        lake = smoothstep(edge - ld, -4, 6);
        base = lerp(base, -14, lake);
        const island = Math.hypot(px - LAKE.x, py - LAKE.y) * METRES_PER_PX;
        if (island < 700) base = Math.max(base, lerp(6, -14, smoothstep(island, 380, 700)));
        forest *= 1 - lake;
        break;
      }
      case 'frost':
        base = 20 + Math.pow(ridged(x / 3500, z / 3500), 1.4) * 700 * smoothstep(coast, 200, 4000) + roll * 60;
        forest = smoothstep(fbm(x / 900, z / 900, 3), 0.45, 0.6) * 0.45;
        break;
      case 'sun': {
        const dunes = Math.abs(Math.sin((x * 0.8 + z * 0.35) / 140 + fbm(x / 900, z / 900, 3) * 7));
        base = 10 + dunes * 18 + roll * 70;
        forest = 0.02;
        break;
      }
      default:
        base = 5 + roll * 20;
    }
    // beaches: the land rises gently from the sea
    const shore = smoothstep(coast, 0, 900);
    h = lerp(0.8 + coast * 0.002, base, shore);

    // rivers cut down to sea level
    if (RIVER_LANDS.has(region)) {
      const rd = riverDistance(x, z);
      if (rd < 400) {
        const t = smoothstep(rd, 22, 400);
        h = lerp(-2.2, h, Math.pow(t, 0.8));
        forest *= smoothstep(rd, 40, 120);
      }
    }
  }

  // lakes
  let water = SEA_LEVEL;
  let ice = 0; // on a frozen lake (in Frostreach the lakes are ice you walk on)
  if (withLakes) {
    for (const L of gridAt(lakeGrid, x, z)) {
      const dx = x - L.x, dz = z - L.z;
      if (Math.abs(dx) > L.r * 1.8 || Math.abs(dz) > L.r * 1.8) continue;
      const dn = Math.hypot(dx, dz) / (L.r * (1 + noise1(Math.atan2(dz, dx), L.seed) * 0.22));
      if (dn >= 1.8) continue;
      const level = L.level ?? (L.level = lakeLevel(L));
      if (isFrozen(L)) {
        // a sheet of ice, flat at the water's height, that you walk on (no water to sink into);
        // it fills the low ground round the shore too, where open water would lie
        if (dn >= 1) h = lerp(level + 0.4, h, smoothstep(dn, 1, 1.8));
        if (dn < 1 || (h < level && Math.hypot(dx, dz) < L.r * LAKE_DRAWN)) { h = level; ice = 1; }
        forest *= smoothstep(dn, 1.05, 1.35);
        continue;
      }
      if (dn < 1) h = level - L.depth * (1 - dn * dn);
      else h = lerp(level + 0.4, h, smoothstep(dn, 1, 1.8));
      forest *= smoothstep(dn, 1.05, 1.35);
      // the water: the lake itself, and any low ground round its shore that the lake's surface
      // (a disc 1.3 times its size, see land.js) is drawn over. Standing there used to look like
      // sinking into the ground, as you were under the drawn water but not in it.
      if (dn < 1.1 || (h < level && Math.hypot(dx, dz) < L.r * LAKE_DRAWN)) water = Math.max(water, level);
    }
  }

  // flatten the ground around each named place, so camps and the spawn sit level
  if (flattenOn) for (const p of gridAt(placeGrid, x, z)) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < 180) {
      const flatH = p.y ?? (p.y = placeBaseHeight(p));
      const t = smoothstep(d, 45, 180);
      h = lerp(flatH, h, t);
      forest *= smoothstep(d, 30, 60);
    }
  }

  // land that players have bought and prepared is level, with a short slope around its edge
  if (PREPARED.size) {
    let best = Infinity, flat = 0;
    for (let ix = Math.floor((x - PLOT_RAMP_MAX) / PLOT); ix <= Math.floor((x + PLOT_RAMP_MAX) / PLOT); ix++) {
      for (let iz = Math.floor((z - PLOT_RAMP_MAX) / PLOT); iz <= Math.floor((z + PLOT_RAMP_MAX) / PLOT); iz++) {
        const f = PREPARED.get(`${ix},${iz}`);
        if (f === undefined) continue;
        const dx = Math.max(ix * PLOT - x, 0, x - (ix + 1) * PLOT);
        const dz = Math.max(iz * PLOT - z, 0, z - (iz + 1) * PLOT);
        const d = Math.hypot(dx, dz);
        if (d < best) { best = d; flat = f; }
      }
    }
    // the slope down (or up) to the natural ground is long enough to walk, never a sudden drop
    const ramp = Math.min(PLOT_RAMP_MAX, Math.max(PLOT_RAMP, Math.abs(h - flat) * 2));
    if (best < ramp) {
      h = lerp(flat, h, smoothstep(best, 0, ramp));
      if (best === 0) forest = 0;
    }
  }

  // the walled cities rise in rings to the castle on top (see citylevels.mjs)
  for (const c of CITY_FLATS) {
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < INNER_R * INNER_R) { h = c.flat + cityGround(dx, dz); forest = 0; break; }
  }

  out.h = h;
  out.water = water;
  out.region = region;
  out.forest = Math.max(0, Math.min(1, forest));
  out.wet = wet;
  out.lake = lake;
  out.coast = coast;
  out.dark = dark;
  out.ice = ice;
  out.biome = region ? sectionAt(px, py, region)?.biome || region : null;
  return out;
}
// The flat top of a mesa at (x, z), or 0 off it: tall, with steep cliff sides
export function mesaTop(x, z) {
  const m = fbm(x / 2200 - 3, z / 2200 + 17, 4);
  return smoothstep(m, 0.56, 0.6) * (260 + fbm(x / 5000, z / 5000, 2) * 260);
}

// Each place sits at the average height of the land around it (computed once, without flattening).
function placeBaseHeight(p) {
  p.y = 0; // guard against recursion while sampling
  flattenOn = false; // sample without any flattening
  let sum = 0;
  const tmp = {};
  for (const [dx, dz] of [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60]]) sum += sample(p.x + dx, p.z + dz, tmp, false).h;
  flattenOn = true;
  return Math.max(sum / 5, 2.5);
}

// ---------- land plots ----------
// The land is divided into square plots that players can buy. Prepared plots are cleared and levelled.
export const PLOT = 20;
const PLOT_RAMP = 8;      // the shortest slope around a levelled plot
const PLOT_RAMP_MAX = 20; // the longest (for a plot set far above or below its surroundings)
const PREPARED = new Map(); // "ix,iz" -> level height
export const plotOf = (x, z) => ({ ix: Math.floor(x / PLOT), iz: Math.floor(z / PLOT) });
const CLEARED = new Set(); // plots cleared of trees, rocks and grass but keeping their shape
const FIXED = new Map(); // ground levelled for good (under the Monster Kings' castles)
// Returns the plots whose ground changed (levelled, or no longer levelled): [{ ix, iz }]
export function setPreparedPlots(plots) {
  const before = new Map(PREPARED);
  PREPARED.clear();
  CLEARED.clear();
  for (const [k, f] of FIXED) PREPARED.set(k, f);
  for (const p of plots) {
    if (Number.isFinite(p.flat)) PREPARED.set(`${p.ix},${p.iz}`, p.flat);
    if (p.cleared) CLEARED.add(`${p.ix},${p.iz}`);
  }
  // only the remembered heights on and around the plots that changed are out of date (forgetting
  // every one of them made the whole land around you be worked out again from the noise)
  const changed = [];
  for (const [k, f] of PREPARED) if (before.get(k) !== f) changed.push(k);
  for (const k of before.keys()) if (!PREPARED.has(k)) changed.push(k);
  if (changed.length > 400) hCache.clear();
  else for (const k of changed) { const [ix, iz] = k.split(',').map(Number); forgetPlotHeights(ix, iz); }
  return changed.map((k) => { const [ix, iz] = k.split(',').map(Number); return { ix, iz }; });
}
export function addFixedFlats(plots) {
  hCache.clear();
  for (const p of plots) { FIXED.set(`${p.ix},${p.iz}`, p.flat); PREPARED.set(`${p.ix},${p.iz}`, p.flat); }
}
// the level a plot was set to, if it was levelled
export const plotLevel = (ix, iz) => PREPARED.get(`${ix},${iz}`);
// cleared of trees and rocks (levelled plots are cleared too)
export const isPrepared = (x, z) => { const k = `${Math.floor(x / PLOT)},${Math.floor(z / PLOT)}`; return PREPARED.has(k) || CLEARED.has(k); };

export function heightAt(x, z) {
  return sample(x, z, _tmp).h;
}
// The height of the ground as it is drawn up close: the land is drawn as triangles between points
// every SURFACE_STEP metres, so walking on this (not the exact height between those points) keeps
// feet on the ground you see, without floating or sinking.
export const SURFACE_STEP = 4;
// Inside a great city's inner wall the rings are drawn by the city itself (exact flat floors and
// stone terrace walls, see world/city.js), not by the land: this is that city ({ x, z, flat }), or null
export function cityFloorAt(x, z, margin = 0) {
  for (const c of CITY_FLATS) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (INNER_R - margin) ** 2) return c; }
  return null;
}
export function surfaceAt(x, z) {
  // in a great city you stand on its rings exactly (the land's coarse triangles used to slope out
  // past each terrace wall as patches of grass over the street below)
  const c = cityFloorAt(x, z);
  if (c) return c.flat + cityGround(x - c.x, z - c.z);
  const S = SURFACE_STEP;
  const gx = Math.floor(x / S), gz = Math.floor(z / S);
  const fx = x / S - gx, fz = z / S - gz;
  const h = (i, j) => gridHeight(gx + i, gz + j);
  // each square is split along the same diagonal as the drawn land
  if (fx + fz <= 1) { const h00 = h(0, 0); return h00 + (h(1, 0) - h00) * fx + (h(0, 1) - h00) * fz; }
  const h11 = h(1, 1);
  return h11 + (h(0, 1) - h11) * (1 - fx) + (h(1, 0) - h11) * (1 - fz);
}
const _tmp = {};
// The ground's height at the corners of the SURFACE_STEP grid, remembered: surfaceAt is asked about
// the same corners again and again (you, the camera, every tree, tuft of grass and monster), and
// working one out from the noise is the slowest thing the game does while you walk. Land tiles
// fill it in as they are built (rememberHeight). Forgotten when plots are levelled.
const H_KEEP = 250000; // corners kept (about a 2 km square), then it starts afresh
const hCache = new Map();
const hKey = (gx, gz) => (gx + 200000) * 400000 + (gz + 200000);
function gridHeight(gx, gz) {
  const x = gx * SURFACE_STEP, z = gz * SURFACE_STEP;
  if (x > DEPTHS_X || x < -DEPTHS_X) return sample(x, z, _tmp).h; // (the caves underground change)
  const k = hKey(gx, gz);
  let h = hCache.get(k);
  if (h === undefined) {
    h = sample(x, z, _tmp).h;
    if (hCache.size >= H_KEEP) hCache.clear();
    hCache.set(k, h);
  }
  return h;
}
// a land tile worked out the height at (x, z): keep it, if it is a corner of the grid
export function rememberHeight(x, z, h) {
  const gx = x / SURFACE_STEP, gz = z / SURFACE_STEP;
  if (!Number.isInteger(gx) || !Number.isInteger(gz) || Math.abs(x) > DEPTHS_X) return;
  if (hCache.size >= H_KEEP) hCache.clear();
  hCache.set(hKey(gx, gz), h);
}
export const forgetHeights = () => hCache.clear();
// forget the remembered heights inside a box (x0..x1, z0..z1)
export function forgetHeightsIn(x0, z0, x1, z1) {
  for (let gx = Math.floor(x0 / SURFACE_STEP); gx <= Math.ceil(x1 / SURFACE_STEP); gx++) {
    for (let gz = Math.floor(z0 / SURFACE_STEP); gz <= Math.ceil(z1 / SURFACE_STEP); gz++) hCache.delete(hKey(gx, gz));
  }
}
// the ground a levelled plot reaches: the plot itself and the slope round it
export const plotReach = (ix, iz) => ({ x0: ix * PLOT - PLOT_RAMP_MAX, z0: iz * PLOT - PLOT_RAMP_MAX, x1: (ix + 1) * PLOT + PLOT_RAMP_MAX, z1: (iz + 1) * PLOT + PLOT_RAMP_MAX });
function forgetPlotHeights(ix, iz) { const b = plotReach(ix, iz); forgetHeightsIn(b.x0, b.z0, b.x1, b.z1); }

export function placesWithPositions() {
  for (const p of PLACE_POS) if (p.y === undefined) p.y = placeBaseHeight(p);
  return PLACE_POS;
}

// Safe zones: the ground around every waystone, where players spawn and monsters can't go
export const SAFE_R = 60;
// The Central City: owned by no one, walled, on levelled ground, and safe all the way to its walls
export { CITY_R };
export const safeRadius = (p) => (p.city ? CITY_R + 8 : SAFE_R);
export function safeZoneAt(x, z) {
  for (const p of placesWithPositions()) if (!p.cave && (p.x - x) ** 2 + (p.z - z) ** 2 < safeRadius(p) ** 2) return p;
  return null;
}

export function lakesWithLevels() {
  for (const L of LAKE_POS) if (L.level === undefined) L.level = lakeLevel(L);
  return LAKE_POS;
}

// The height of the water surface at a point (the sea, or a lake)
export function waterLevelAt(x, z) {
  return sample(x, z, _tmp).water;
}

export function regionName(id) {
  return REGIONS.find((r) => r.id === id)?.name || 'The Open Sea';
}

// ---------- moving saved characters into the bigger world ----------
// The world grew 4 times bigger (a map pixel went from 100 m to 400 m), so a character saved before
// then is carried to the same spot on the new map: their position, tent and torches move with them,
// and their monster villages are found anew.
export const WORLD_VERSION = 2;
export function moveToNewWorld(c) {
  if (!c || (c.worldV || 1) >= WORLD_VERSION) return false;
  const k = 4;
  const far = (v) => Number.isFinite(v) && Math.abs(v) < DEPTHS_X;
  if (c.location && far(c.location.x)) { c.location.x *= k; c.location.z *= k; c.location.y = 0; }
  if (c.tent && far(c.tent.x)) { c.tent.x *= k; c.tent.z *= k; }
  if (Array.isArray(c.torches)) for (const t of c.torches) if (far(t.x)) { t.x *= k; t.z *= k; }
  c.villages = { list: [], due: [] };
  c.worldV = WORLD_VERSION;
  return true;
}

// ---------- the generated world ----------
// More lakes, villages and caves, scattered by a fixed seed so every player's world is the same.
// Villages are towns of the Heartland (some on mesa tops in the highlands); caves are everywhere,
// and those high in the mountains are dungeons (see depths.mjs).
function seededRnd(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// how far inside its own land a map point is (map px), or -1 when it is another land or the sea
function inlandOf(px, py, region) {
  let best = -Infinity, reg = null;
  for (const b of BLOBS) { const d = insideBlob(b, px, py); if (d > best) { best = d; reg = b.region; } }
  return reg === region ? best : -1;
}
function regionBox(region) {
  const bs = BLOBS.filter((b) => b.region === region);
  return { x0: Math.min(...bs.map((b) => b.x - b.r * b.stretch[0] * 1.3)), x1: Math.max(...bs.map((b) => b.x + b.r * b.stretch[0] * 1.3)),
    y0: Math.min(...bs.map((b) => b.y - b.r * b.stretch[1] * 1.3)), y1: Math.max(...bs.map((b) => b.y + b.r * b.stretch[1] * 1.3)) };
}
const VILLAGE_A = ['Ash', 'Bram', 'Cedar', 'Dun', 'Elm', 'Fern', 'Glen', 'Haw', 'Iron', 'Lark', 'Mill', 'Oak', 'Pine', 'Rush', 'Stone', 'Thorn', 'Willow', 'Wolf', 'Yew', 'Amber', 'Briar', 'Copper', 'Dove', 'Ember', 'Fox', 'Golden', 'Heron', 'Ivy', 'Jade', 'Moss', 'Raven', 'Silver'];
const VILLAGE_B = ['ford', 'brook', 'wick', 'stead', 'field', 'hollow', 'haven', 'dale', 'moor', 'well', 'bury', 'ton', 'cross', 'mere', 'wood', 'vale'];
const SUMMIT_B = ['crest', 'peak', 'top', 'spire', 'height'];
(function generate() {
  const rnd = seededRnd(20261029);
  const raw = {};
  const rawAt = (px, py) => sample((px - ORIGIN_PX.x) * METRES_PER_PX, (py - ORIGIN_PX.y) * METRES_PER_PX, raw, false);
  const slopeAt = (px, py) => {
    const x = (px - ORIGIN_PX.x) * METRES_PER_PX, z = (py - ORIGIN_PX.y) * METRES_PER_PX;
    const h = sample(x, z, raw, false).h;
    return Math.max(Math.abs(sample(x + 30, z, raw, false).h - h), Math.abs(sample(x, z + 30, raw, false).h - h)) / 30;
  };
  const far = (list, px, py, d) => list.every((q) => Math.hypot(q[0] - px, q[1] - py) >= d);
  // lakes: [region, how many, smallest and largest radius (map px)]
  const lakeSpots = LAKES.map(([x, y, r]) => [x, y, r]);
  const placeSpots = () => PLACES.map((p) => [p.px, p.py]);
  const addLakes = (region, n, r0, r1, within = null) => {
    const box = within ? { x0: within.px - within.r, x1: within.px + within.r, y0: within.py - within.r, y1: within.py + within.r } : regionBox(region);
    for (let tries = 0, made = 0; made < n && tries < n * 60; tries++) {
      const px = box.x0 + rnd() * (box.x1 - box.x0), py = box.y0 + rnd() * (box.y1 - box.y0), r = r0 + rnd() * (r1 - r0);
      if (within && Math.hypot(px - within.px, py - within.py) > within.r) continue;
      if (inlandOf(px, py, region) < r * 1.6 + 6) continue;
      if (!far(placeSpots(), px, py, r + 8) || !lakeSpots.every((q) => Math.hypot(q[0] - px, q[1] - py) >= q[2] + r + 5)) continue;
      const x = (px - ORIGIN_PX.x) * METRES_PER_PX, z = (py - ORIGIN_PX.y) * METRES_PER_PX;
      if (riverDistance(x, z) < r * METRES_PER_PX + 500) continue;
      if (rawAt(px, py).h > 700) continue; // no lakes on the high peaks
      lakeSpots.push([px, py, r]); LAKES.push([Math.round(px), Math.round(py), Math.round(r * 10) / 10]); made++;
    }
  };
  addLakes('heart', 40, 1.2, 5);
  addLakes('heart', 18, 1, 3.5, SECTIONS.find((q) => q.name === 'Silvermere Vale'));
  addLakes('peaks', 6, 1, 3); addLakes('warrens', 4, 1, 2.5); addLakes('mire', 10, 1.5, 4);
  addLakes('frost', 10, 1, 4); addLakes('sun', 4, 0.8, 1.6, SECTIONS.find((q) => q.name === 'Palmwater Oasis'));
  // villages of the Heartland: how many in each section; in the highlands they sit on the mesa tops
  const PER_SECTION = { Greenwood: 3, Amberfields: 4, Jadewild: 3, 'Stonecrown Highlands': 4, 'Silvermere Vale': 3, Northmarch: 3 };
  const names = new Set(PLACES.map((p) => p.name));
  const nameOne = (summit) => {
    for (let i = 0; i < 50; i++) {
      const n = VILLAGE_A[Math.floor(rnd() * VILLAGE_A.length)] + (summit ? SUMMIT_B : VILLAGE_B)[Math.floor(rnd() * (summit ? SUMMIT_B : VILLAGE_B).length)];
      if (!names.has(n)) { names.add(n); return n; }
    }
    return `Village ${names.size}`;
  };
  let vi = 0;
  for (const sc of SECTIONS.filter((q) => PER_SECTION[q.name])) {
    const summit = sc.biome === 'highland';
    for (let tries = 0, made = 0; made < PER_SECTION[sc.name] && tries < (summit ? 3000 : 400); tries++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * sc.r;
      const px = sc.px + Math.cos(a) * d, py = sc.py + Math.sin(a) * d;
      if (inlandOf(px, py, 'heart') < 14 || !far(placeSpots(), px, py, 28)) continue;
      const s0 = rawAt(px, py);
      if (s0.h < 4 || s0.lake > 0.01 || !lakeSpots.every((q) => Math.hypot(q[0] - px, q[1] - py) >= q[2] + 3)) continue;
      const x = (px - ORIGIN_PX.x) * METRES_PER_PX, z = (py - ORIGIN_PX.y) * METRES_PER_PX;
      if (riverDistance(x, z) < 500) continue;
      if (summit ? mesaTop(x, z) < 200 || slopeAt(px, py) > 0.16 : slopeAt(px, py) > 0.25) continue;
      PLACES.push({ id: `gv${vi++}`, name: nameOne(summit), px: Math.round(px * 10) / 10, py: Math.round(py * 10) / 10, region: 'heart', village: true, summit, section: sc.name });
      made++;
    }
  }
  // caves: [region, how many]; the highlands and peaks hold the most (and the dungeons)
  const caveSpots = CAVES.map(([x, y]) => [x, y]);
  const addCaves = (region, n, within = null) => {
    const box = within ? { x0: within.px - within.r, x1: within.px + within.r, y0: within.py - within.r, y1: within.py + within.r } : regionBox(region);
    for (let tries = 0, made = 0; made < n && tries < n * 60; tries++) {
      const px = box.x0 + rnd() * (box.x1 - box.x0), py = box.y0 + rnd() * (box.y1 - box.y0);
      if (inlandOf(px, py, region) < 4 || !far(placeSpots(), px, py, 6) || !far(caveSpots, px, py, 5)) continue;
      const s0 = rawAt(px, py);
      if (s0.h < 3 || s0.lake > 0.01 || s0.h < s0.water + 1.5) continue;
      caveSpots.push([px, py]); CAVES.push([Math.round(px * 10) / 10, Math.round(py * 10) / 10, Math.round(rnd() * 628) / 100]); made++;
    }
  };
  addCaves('heart', 45); addCaves('heart', 25, SECTIONS.find((q) => q.biome === 'highland'));
  addCaves('peaks', 16); addCaves('warrens', 12); addCaves('mire', 10); addCaves('frost', 8); addCaves('sun', 8); addCaves('fae', 4);
})();

// ---------- the far wilds ----------
// The caves above crowd round the middle of the Heartland, so more are scattered out towards the
// edges of every land, with the most furthest from Central City. Out there also stand places of a
// new kind: Ruined Dungeons (old stone gates over a way down, always a dungeon wherever they are),
// Monster Towers (floor upon floor of strong monsters, a Warden on the roof) and Monster Camps
// (a warband round its fire, with a chief). These are added after the caves above, with dice of
// their own, so every cave that was already there keeps its number (and its owner).
// [kind, map x, map y, region]
export const WILD_SITES = [];
// how far from Central City a map point is, as a share of the way to the edge of the world (0-1)
export const farOut = (px, py) => Math.min(1, Math.hypot(px - ORIGIN_PX.x, (py - ORIGIN_PX.y) * 1.25) / 620);
(function spreadOut() {
  const rnd = seededRnd(20261127);
  const raw = {};
  const rawAt = (px, py) => sample((px - ORIGIN_PX.x) * METRES_PER_PX, (py - ORIGIN_PX.y) * METRES_PER_PX, raw, false);
  const far = (list, px, py, d) => list.every((q) => Math.hypot(q[0] - px, q[1] - py) >= d);
  const placeSpots = PLACES.map((p) => [p.px, p.py]);
  const caveSpots = CAVES.map(([x, y]) => [x, y]);
  const siteSpots = [];
  // `minOut`: how far from Central City (map px) it must be; further out is likelier (`pull`)
  const add = (what, region, n, { minOut = 0, pull = 1.5, gap = 6 } = {}) => {
    const box = regionBox(region);
    for (let tries = 0, made = 0; made < n && tries < n * 400; tries++) {
      const px = box.x0 + rnd() * (box.x1 - box.x0), py = box.y0 + rnd() * (box.y1 - box.y0);
      if (Math.hypot(px - ORIGIN_PX.x, py - ORIGIN_PX.y) < minOut) continue;
      if (region === 'heart' && rnd() > farOut(px, py) ** pull * 2.2) continue; // (the edges of the Heartland get the most)
      if (inlandOf(px, py, region) < 4 || !far(placeSpots, px, py, what === 'cave' || what === 'ruin' ? 6 : 9)) continue;
      if (!far(caveSpots, px, py, what === 'cave' || what === 'ruin' ? 5 : 3) || !far(siteSpots, px, py, gap)) continue;
      const s0 = rawAt(px, py);
      if (s0.h < 3 || s0.lake > 0.01 || s0.h < s0.water + 1.5) continue;
      const x = Math.round(px * 10) / 10, y = Math.round(py * 10) / 10;
      if (what === 'cave' || what === 'ruin') {
        caveSpots.push([px, py]);
        CAVES.push(what === 'ruin' ? [x, y, Math.round(rnd() * 628) / 100, 'ruin'] : [x, y, Math.round(rnd() * 628) / 100]);
      } else { siteSpots.push([px, py]); WILD_SITES.push([what, x, y, region]); }
      made++;
    }
  };
  // more caves, out towards the edges
  add('cave', 'heart', 36, { minOut: 75 });
  add('cave', 'peaks', 12); add('cave', 'warrens', 10); add('cave', 'mire', 10); add('cave', 'frost', 10); add('cave', 'sun', 10); add('cave', 'fae', 4);
  // Ruined Dungeons
  add('ruin', 'heart', 10, { minOut: 90, pull: 2 });
  add('ruin', 'peaks', 4); add('ruin', 'warrens', 4); add('ruin', 'mire', 4); add('ruin', 'frost', 3); add('ruin', 'sun', 3); add('ruin', 'fae', 2);
  // Monster Towers, well away from the towns, never in sight of Central City
  add('tower', 'heart', 14, { minOut: 70, pull: 2, gap: 30 });
  add('tower', 'peaks', 5, { gap: 30 }); add('tower', 'warrens', 4, { gap: 30 }); add('tower', 'mire', 4, { gap: 30 }); add('tower', 'frost', 3, { gap: 30 }); add('tower', 'sun', 3, { gap: 30 }); add('tower', 'fae', 3, { gap: 20 });
  // Monster Camps, the most common of the three
  add('camp', 'heart', 22, { minOut: 30, gap: 14 });
  add('camp', 'peaks', 6, { gap: 14 }); add('camp', 'warrens', 6, { gap: 14 }); add('camp', 'mire', 6, { gap: 14 }); add('camp', 'frost', 5, { gap: 14 }); add('camp', 'sun', 5, { gap: 14 }); add('camp', 'fae', 3, { gap: 12 });
})();
for (const p of PLACES) PLACE_POS.push({ ...p, ...toWorld(p.px, p.py) });
CAVES.forEach(([px, py, facing, ruin], i) => PLACE_POS.push({ id: `cave${i}`, name: ruin ? 'Ruined Dungeon' : 'Cave', cave: true, ...(ruin ? { ruin: true } : {}), px, py, facing, ...toWorld(px, py) }));
LAKES.forEach(([px, py, r], i) => LAKE_POS.push({ ...toWorld(px, py), r: r * METRES_PER_PX, seed: 50 + i, depth: 3 + r * 0.8 }));
for (const p of PLACE_POS) gridAdd(placeGrid, p.x, p.z, 185, p);
for (const L of LAKE_POS) gridAdd(lakeGrid, L.x, L.z, L.r * 1.8, L);

// Level the ground under the cities for good (it also keeps trees and rocks out); inside the inner
// wall the rings rise from there (CITY_FLATS)
for (const city of PLACES.filter((p) => p.city)) {
  const { x, z } = toWorld(city.px, city.py);
  const flat = Math.round(heightAt(x, z) * 10) / 10;
  CITY_FLATS.push({ x, z, flat });
  const flats = [];
  const n = Math.ceil((CITY_R + 12) / PLOT);
  for (let ix = Math.floor(x / PLOT) - n; ix <= Math.floor(x / PLOT) + n; ix++) {
    for (let iz = Math.floor(z / PLOT) - n; iz <= Math.floor(z / PLOT) + n; iz++) {
      const dx = Math.max(ix * PLOT - x, 0, x - (ix + 1) * PLOT), dz = Math.max(iz * PLOT - z, 0, z - (iz + 1) * PLOT);
      if (Math.hypot(dx, dz) < CITY_R + 12) flats.push({ ix, iz, flat });
    }
  }
  addFixedFlats(flats);
}

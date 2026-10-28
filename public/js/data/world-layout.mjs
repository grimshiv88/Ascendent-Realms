// The world's layout, shared by the 3D terrain, the in-game map and the map draft page.
// Map coordinates are pixels on the 1600 × 1000 map, where 1 pixel = 100 metres.
// World coordinates are metres, with the spawn point in the Central Forest at (0, 0).
// North is up on the map and −z in the world.

export const METRES_PER_PX = 100;
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
  { id: 'heart', name: 'The Verdant Heartland', who: 'All player races', land: { x: 800, y: 520, r: 300, seed: 3, stretch: [1.25, 0.95] },
    text: 'The central continent. Everyone playing a Player race starts here, in the Central Forest. Land here is bought with coins and can grow into countries.', size: 'About 75 km across' },
  { id: 'peaks', name: 'Dragon Peaks', who: 'Dragonewts', land: { x: 790, y: 120, r: 190, seed: 11, stretch: [1.5, 0.55] },
    text: 'Volcanic mountains in the far north. Dragonewts hatch in nests high on the cliffs. The hardest homeland to survive in.', size: 'About 55 km wide' },
  { id: 'warrens', name: 'Ashen Wastes', who: 'Goblins and Slimes', land: { x: 230, y: 470, r: 190, seed: 7, stretch: [0.85, 1.35] },
    text: 'Dry badlands in the west. Goblins live in the Goblin Warrens, a maze of tunnels. Slimes start in the Slime Caves under the Gloomhollow cliffs.', size: 'About 35 km across' },
  { id: 'fae', name: 'The Fae Isles', who: 'Fairies', islands: [[1395, 300, 70, 21], [1475, 410, 52, 22], [1365, 470, 46, 23], [1500, 220, 40, 24], [1450, 540, 34, 25]],
    text: 'An archipelago of glowing islands in the east. The Fairy Glade sits on the largest island, hidden by mist.', size: 'Islands of 6 to 17 km' },
  { id: 'mire', name: 'Mirefall', who: 'Lizardmen and Nagas', land: { x: 1130, y: 860, r: 210, seed: 5, stretch: [1.55, 0.6] },
    text: 'A southern land of swamps around a great lake. Lizardmen live in the Lizardman Marsh. The Naga Lake Temple rises from the middle of the lake.', size: 'About 65 km wide' },
  { id: 'frost', name: 'Frostreach', who: 'Unclaimed (future)', land: { x: 240, y: 110, r: 120, seed: 13, stretch: [1.3, 0.6] },
    text: 'Frozen land in the north-west, saved for a future expansion.', size: 'About 30 km wide' },
  { id: 'sun', name: 'Sunscar Desert', who: 'Unclaimed (future)', land: { x: 330, y: 880, r: 140, seed: 17, stretch: [1.4, 0.55] },
    text: 'A desert in the south-west, saved for a future expansion.', size: 'About 40 km wide' },
];

// Named places on the map. `home` places are where monster races start.
export const PLACES = [
  { id: 'central', name: 'Central Forest', px: 800, py: 520, region: 'heart', spawn: true },
  { id: 'crossroads', name: 'Old Crossroads', px: 690, py: 470, region: 'heart' },
  { id: 'riverhold', name: 'Riverhold', px: 950, py: 606, region: 'heart' },
  { id: 'hills', name: 'Eastern Hills', px: 980, py: 380, region: 'heart' },
  { id: 'nests', name: 'Dragon Nests', px: 800, py: 150, region: 'peaks', home: 'Dragon Peaks' },
  { id: 'warrens', name: 'Goblin Warrens', px: 250, py: 420, region: 'warrens', home: 'Goblin Warrens' },
  { id: 'slimecaves', name: 'Slime Caves (Gloomhollow)', px: 200, py: 610, region: 'warrens', home: 'Slime Caves' },
  { id: 'glade', name: 'Fairy Glade', px: 1395, py: 300, region: 'fae', home: 'Fairy Glade' },
  { id: 'temple', name: 'Naga Lake Temple', px: 1130, py: 860, region: 'mire', home: 'Naga Lake Temple' },
  { id: 'marsh', name: 'Lizardman Marsh', px: 960, py: 840, region: 'mire', home: 'Lizardman Marsh' },
];

// Rivers of the Heartland as cubic curves in map pixels: [start, control 1, control 2, end].
export const RIVERS = [
  [[680, 370], [740, 460], [790, 480], [840, 510]],
  [[840, 510], [960, 580], [960, 680], [1100, 750]],
];
export const LAKE = { x: 1130, y: 860, r: 70, seed: 42, stretch: [1.5, 0.75], wobble: 0.18 };

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
];
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

const PLACE_POS = [
  ...PLACES.map((p) => ({ ...p, ...toWorld(p.px, p.py) })),
  ...CAVES.map(([px, py, facing], i) => ({ id: `cave${i}`, name: 'Cave', cave: true, px, py, facing, ...toWorld(px, py) })),
];
const LAKE_POS = LAKES.map(([px, py, r], i) => ({ ...toWorld(px, py), r: r * METRES_PER_PX, seed: 50 + i, depth: 3 + r * 0.8 }));

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
export const DEPTHS_X = 300000;
let underground = null;
export function setUnderground(fn) { underground = fn; }

export function sample(x, z, out = {}, withLakes = true) {
  if (x > DEPTHS_X) {
    if (underground) return underground(x, z, out);
    out.h = -1e5; out.water = -1e4; out.region = null; out.forest = 0; out.wet = 0; out.lake = 0; out.coast = 0;
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
  if (coast < 0) {
    h = Math.max(-80, coast * 0.04) - 1.5;
    region = coast > -1500 ? region : null;
  } else {
    let base;
    const roll = fbm(x / 1800, z / 1800);
    const bumps = fbm(x / 160, z / 160, 3) - 0.5;
    switch (region) {
      case 'heart': {
        base = 30 + (roll - 0.5) * 60 + bumps * 6;
        const east = smoothstep(px, 940, 1060);
        base += Math.pow(ridged(x / 4000, z / 4000), 1.4) * 520 * east;
        // knolls and small rocky crags all through the forest (gentle right by the spawn)
        const away = smoothstep(Math.hypot(x, z), 350, 1500);
        const knolls = Math.pow(smoothstep(fbm(x / 650 + 11, z / 650 - 3, 3), 0.48, 0.78), 1.6) * 70;
        const crags = Math.pow(ridged(x / 1100 + 2, z / 1100 + 9, 4), 2.2) * 230 * smoothstep(fbm(x / 2600 - 6, z / 2600 + 1, 3), 0.5, 0.64);
        base += (knolls + crags) * away;
        // scattered mountain groups, kept away from the spawn
        const group = smoothstep(fbm(x / 9000 + 30, z / 9000 - 12, 3), 0.6, 0.72) * smoothstep(Math.hypot(x, z), 5000, 9000);
        base += Math.pow(ridged(x / 2600 + 7, z / 2600, 5), 1.5) * 750 * group;
        // the Central Forest: a great ellipse of woodland around the spawn
        const f = Math.hypot((px - 800) / 1.3, py - 520) / 190;
        forest = smoothstep(1.05 - f, 0, 0.25) * (0.35 + fbm(x / 700 + 9, z / 700, 3) * 0.9);
        forest = Math.max(forest, smoothstep(fbm(x / 1500 + 4, z / 1500 + 4, 3), 0.55, 0.7) * 0.6);
        forest *= 1 - smoothstep(crags * away, 70, 160); // bare rock on the crag tops
        break;
      }
      case 'peaks': {
        const inland = smoothstep(coast, 300, 6000);
        base = 30 + Math.pow(ridged(x / 5200, z / 5200), 1.6) * 1900 * inland + roll * 80;
        for (const [vx, vy] of VOLCANOES) {
          const d = Math.hypot(px - vx, py - vy) * METRES_PER_PX;
          if (d < 4500) {
            const cone = Math.pow(1 - d / 4500, 1.6) * 1500;
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
    if (region === 'heart') {
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
  if (withLakes) {
    for (const L of LAKE_POS) {
      const dx = x - L.x, dz = z - L.z;
      if (Math.abs(dx) > L.r * 1.8 || Math.abs(dz) > L.r * 1.8) continue;
      const dn = Math.hypot(dx, dz) / (L.r * (1 + noise1(Math.atan2(dz, dx), L.seed) * 0.22));
      if (dn >= 1.8) continue;
      const level = L.level ?? (L.level = lakeLevel(L));
      if (dn < 1) h = level - L.depth * (1 - dn * dn);
      else h = lerp(level + 0.4, h, smoothstep(dn, 1, 1.8));
      forest *= smoothstep(dn, 1.05, 1.35);
      if (dn < 1.1) water = Math.max(water, level);
    }
  }

  // flatten the ground around each named place, so camps and the spawn sit level
  for (const p of PLACE_POS) {
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

  out.h = h;
  out.water = water;
  out.region = region;
  out.forest = Math.max(0, Math.min(1, forest));
  out.wet = wet;
  out.lake = lake;
  out.coast = coast;
  return out;
}

// Each place sits at the average height of the land around it (computed once, without flattening).
function placeBaseHeight(p) {
  p.y = 0; // guard against recursion while sampling
  const saved = PLACE_POS.splice(0); // sample without any flattening
  let sum = 0;
  const tmp = {};
  for (const [dx, dz] of [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60]]) sum += sample(p.x + dx, p.z + dz, tmp, false).h;
  PLACE_POS.push(...saved);
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
export function setPreparedPlots(plots) {
  PREPARED.clear();
  CLEARED.clear();
  for (const [k, f] of FIXED) PREPARED.set(k, f);
  for (const p of plots) {
    if (Number.isFinite(p.flat)) PREPARED.set(`${p.ix},${p.iz}`, p.flat);
    if (p.cleared) CLEARED.add(`${p.ix},${p.iz}`);
  }
}
export function addFixedFlats(plots) {
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
export function surfaceAt(x, z) {
  const S = SURFACE_STEP;
  const gx = Math.floor(x / S), gz = Math.floor(z / S);
  const fx = x / S - gx, fz = z / S - gz;
  const h = (i, j) => sample((gx + i) * S, (gz + j) * S, _tmp).h;
  // each square is split along the same diagonal as the drawn land
  if (fx + fz <= 1) { const h00 = h(0, 0); return h00 + (h(1, 0) - h00) * fx + (h(0, 1) - h00) * fz; }
  const h11 = h(1, 1);
  return h11 + (h(0, 1) - h11) * (1 - fx) + (h(1, 0) - h11) * (1 - fz);
}
const _tmp = {};

export function placesWithPositions() {
  for (const p of PLACE_POS) if (p.y === undefined) p.y = placeBaseHeight(p);
  return PLACE_POS;
}

// Safe zones: the ground around every waystone, where players spawn and monsters can't go
export const SAFE_R = 60;
export function safeZoneAt(x, z) {
  for (const p of placesWithPositions()) if (!p.cave && (p.x - x) ** 2 + (p.z - z) ** 2 < SAFE_R * SAFE_R) return p;
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

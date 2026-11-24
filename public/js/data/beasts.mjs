// The great beasts of the wilds: dragons and wyverns on the high mountains and the volcanoes, and the
// Spirit King in the great lake. Each lives at its own lair (worked out from the land, so every
// player's world has them in the same places) and comes back 10 minutes after it is slain.
//   - Fire Dragons circle the three volcanoes of the Dragon Peaks; Fire Wyverns nest on the peaks
//   - the Frost Dragon keeps the highest ice mountain of Frostreach; Frost Wyverns the ice ridges
//   - the Storm Dragon rules the highest peak of the Stonecrown Highlands; Peak Wyverns the others
//   - the Spirit King rests in the great lake of Mirefall, and leaves you alone unless you strike first
import { sample, toWorld, SECTIONS, VOLCANOES, LAKE } from './world-layout.mjs';

// shape: what its body is built as (world/beasts.js). breath: what it breathes. len: nose to tail (m)
export const BEASTS = {
  fire_dragon: {
    name: 'Fire Dragon', shape: 'dragon', len: 18, levels: [470, 499], boss: true, breath: 'fire',
    colors: { scales: '#7a1c12', belly: '#d8902a', wing: '#5a140e', horn: '#2a1a14', eye: '#ffd040', spine: '#3a0c08' },
    fly: 24, cruise: 70, circle: 320, notice: 110, range: 420,
    drops: [['dragon_scale', 1, 3, 6], ['dragon_heart', 0.25, 1, 1], ['dragonite', 0.6, 1, 3], ['big_potion', 0.8, 1, 3]],
  },
  storm_dragon: {
    name: 'Storm Dragon', shape: 'dragon', len: 17, levels: [440, 480], boss: true, breath: 'storm',
    colors: { scales: '#2c3e5a', belly: '#9ab0c8', wing: '#1e2a40', horn: '#d8d8e0', eye: '#9ae8ff', spine: '#141c2c' },
    fly: 26, cruise: 75, circle: 300, notice: 110, range: 420,
    drops: [['dragon_scale', 1, 3, 6], ['dragon_heart', 0.25, 1, 1], ['moonstone', 0.6, 1, 3], ['big_potion', 0.8, 1, 3]],
  },
  frost_dragon: {
    name: 'Frost Dragon', shape: 'dragon', len: 17, levels: [460, 490], boss: true, breath: 'frost',
    colors: { scales: '#cfe6f4', belly: '#f4fbff', wing: '#8ab8d8', horn: '#5a7a9a', eye: '#40c8ff', spine: '#7aa8c8' },
    fly: 22, cruise: 65, circle: 300, notice: 110, range: 420,
    drops: [['dragon_scale', 1, 3, 6], ['dragon_heart', 0.25, 1, 1], ['frost_core', 1, 3, 6], ['big_potion', 0.8, 1, 3]],
  },
  fire_wyvern: {
    name: 'Fire Wyvern', shape: 'wyvern', len: 9, levels: [260, 380], breath: 'fire', hpMul: 2.5,
    colors: { scales: '#8a3a18', belly: '#d8a050', wing: '#6a2010', horn: '#3a2418', eye: '#ffb030', spine: '#4a1a0a' },
    fly: 20, cruise: 45, circle: 180, notice: 80, range: 300,
    drops: [['wyvern_fang', 0.9, 1, 2], ['dragon_scale', 0.4, 1, 2], ['big_potion', 0.4, 1, 1]],
  },
  frost_wyvern: {
    name: 'Frost Wyvern', shape: 'wyvern', len: 8.5, levels: [240, 360], breath: 'frost', hpMul: 2.5,
    colors: { scales: '#a8c8dc', belly: '#eef6fa', wing: '#6a98b8', horn: '#4a6a88', eye: '#60d8ff', spine: '#5a88a8' },
    fly: 19, cruise: 40, circle: 170, notice: 80, range: 300,
    drops: [['wyvern_fang', 0.9, 1, 2], ['frost_core', 0.8, 1, 3], ['big_potion', 0.4, 1, 1]],
  },
  peak_wyvern: {
    name: 'Peak Wyvern', shape: 'wyvern', len: 8, levels: [200, 320], hpMul: 2.5,
    colors: { scales: '#5a5248', belly: '#a89a86', wing: '#3e362e', horn: '#e0d8c8', eye: '#e8e040', spine: '#2e2822' },
    fly: 21, cruise: 40, circle: 170, notice: 80, range: 300,
    drops: [['wyvern_fang', 0.9, 1, 2], ['gold_ore', 0.4, 1, 2], ['big_potion', 0.4, 1, 1]],
  },
  spirit_king: {
    name: 'Spirit King', shape: 'spirit', len: 3, height: 14, levels: [499, 499], boss: true, breath: 'water', peaceful: true,
    colors: { body: '#5ad0e8', glow: '#a8f4ff', crown: '#f0e0a0', pearl: '#ffffff' },
    fly: 6, notice: 70, range: 260,
    drops: [['spirit_pearl', 1, 1, 1], ['moonstone', 1, 2, 4], ['big_potion', 1, 2, 4]],
  },
};
export const BEAST_RETURNS = 10 * 60; // seconds until a slain beast's lair has a new one

// ---------- the lairs ----------
// Each group is found when you first come near its land (a quick look over the heights there).
const tmp = {};
const h = (x, z) => sample(x, z, tmp).h;
// the highest points of a section, at least `apart` metres from each other (and from `avoid`)
function peaks(sectionName, n, apart, { minH = 0, avoid = [] } = {}) {
  const sec = SECTIONS.find((s) => s.name === sectionName);
  const c = toWorld(sec.px, sec.py), R = sec.r * 400, step = 1500;
  const all = [];
  for (let x = c.x - R; x <= c.x + R; x += step) {
    for (let z = c.z - R; z <= c.z + R; z += step) {
      const s = sample(x, z, tmp);
      if (s.region === sec.region && s.h > minH && s.h > s.water + 5) all.push([s.h, x, z]);
    }
  }
  all.sort((a, b) => b[0] - a[0]);
  const out = [];
  for (const [, x0, z0] of all) {
    if (out.length >= n) break;
    // climb to the very top nearby
    let x = x0, z = z0, best = h(x, z);
    for (const d of [600, 300, 150, 60, 25]) {
      for (let moved = true, k = 0; moved && k < 8; k++) {
        moved = false;
        for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const v = h(x + dx, z + dz); if (v > best) { best = v; x += dx; z += dz; moved = true; } }
      }
    }
    if ([...out, ...avoid].some((p) => Math.hypot(p.x - x, p.z - z) < apart)) continue;
    out.push({ x, z, top: best });
  }
  return out.sort((a, b) => b.top - a.top); // (the very highest first)
}

// the great lake's still water near its eastern shore, where the Spirit King rests
function lakeSpot() {
  const c = toWorld(LAKE.x, LAKE.y);
  let x = c.x;
  // (past the temple's island in the middle, out to where the water grows shallow)
  for (let d = 2000; d < 40000; d += 50) { const v = h(c.x + d, c.z); if (v > -1.6) break; x = c.x + d; }
  return { x, z: c.z };
}

const GROUPS = [
  // (`at`: the map circle, in map pixels, that holds all of a group's lairs)
  { at: { px: 800, py: 120, r: 130 }, make: () => VOLCANOES.map(([px, py], i) => ({ id: `volcano${i}`, kind: 'fire_dragon', ...toWorld(px, py) })) },
  {
    at: { px: 800, py: 120, r: 290 },
    make: () => {
      // (well away from the volcanoes, which are the dragons')
      const avoid = VOLCANOES.map(([px, py]) => toWorld(px, py));
      const far = (p) => avoid.every((v) => Math.hypot(v.x - p.x, v.z - p.z) > 7000);
      return [...peaks('Ashen Spires', 4, 9000, { minH: 900 }), ...peaks('Emberwild', 3, 9000, { minH: 900 }), ...peaks('Cinder Steppe', 2, 9000, { minH: 900 })]
        .filter(far).map((p, i) => ({ id: `firepeak${i}`, kind: 'fire_wyvern', x: p.x, z: p.z }));
    },
  },
  {
    at: { px: 240, py: 110, r: 150 },
    make: () => peaks('Whiteveil Icefield', 5, 10000, { minH: 300 }).map((p, i) => ({ id: `ice${i}`, kind: i === 0 ? 'frost_dragon' : 'frost_wyvern', x: p.x, z: p.z })),
  },
  {
    at: { px: 1010, py: 440, r: 110 },
    make: () => peaks('Stonecrown Highlands', 6, 9000, { minH: 1000 }).map((p, i) => ({ id: `stone${i}`, kind: i === 0 ? 'storm_dragon' : 'peak_wyvern', x: p.x, z: p.z })),
  },
  { at: { px: LAKE.x, py: LAKE.y, r: LAKE.r * 1.6 }, make: () => [{ id: 'spiritlake', kind: 'spirit_king', ...lakeSpot() }] },
];
const found = new Map(); // group index -> its lairs

// The lairs within `r` metres of (x, z)
export function lairsNear(x, z, r) {
  const out = [];
  GROUPS.forEach((g, i) => {
    const c = toWorld(g.at.px, g.at.py);
    if (Math.hypot(c.x - x, c.z - z) > g.at.r * 400 + r + 2000) return;
    if (!found.has(i)) found.set(i, g.make());
    for (const L of found.get(i)) if (Math.hypot(L.x - x, L.z - z) < r) out.push(L);
  });
  return out;
}
// every lair (worked out now if not yet), for the map and for testing
export function allLairs() {
  GROUPS.forEach((g, i) => { if (!found.has(i)) found.set(i, g.make()); });
  return [...found.values()].flat();
}

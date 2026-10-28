// How strong the wild monsters are: weak near the towns, villages and waystones (and near land
// that players have settled), stronger the deeper into the wilds you go. Out in the wilds they top
// out just below level 500; anything stronger lives only in the castles.
import { PLACES, toWorld, PLOT } from './world-layout.mjs';

export const WILD_MAX = 499;
// level at `d` metres from the nearest settled place: about 5 at 1 km, 28 at 5 km, 70 at 10 km,
// 200 at 20 km, 390 at 30 km, and 499 from about 34 km
export const wildLevel = (d) => { const k = Math.max(0, d) / 1000; return Math.max(1, Math.min(WILD_MAX, Math.round(1 + 4 * k + 0.3 * k * k))); };

const TOWNS = PLACES.map((p) => toWorld(p.px, p.py));
// settled land (players' plots), grouped into 1 km squares so the search stays quick
const CELL = 1000;
let settled = [];
export function setSettledLand(plots) {
  const cells = new Map();
  for (const p of plots || []) {
    const x = (p.ix + 0.5) * PLOT, z = (p.iz + 0.5) * PLOT;
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    const c = cells.get(k) || { x: 0, z: 0, n: 0 };
    c.x += x; c.z += z; c.n += 1;
    cells.set(k, c);
  }
  // a lone plot counts for little; a town of them (or a nation) clears the wilds around it
  settled = [...cells.values()].filter((c) => c.n >= 5).map((c) => ({ x: c.x / c.n, z: c.z / c.n }));
}
// metres to the nearest settled place
export function settledDistance(x, z) {
  let d = Infinity;
  for (const t of TOWNS) d = Math.min(d, Math.hypot(x - t.x, z - t.z));
  for (const t of settled) d = Math.min(d, Math.hypot(x - t.x, z - t.z));
  return d;
}
export const wildLevelAt = (x, z) => wildLevel(settledDistance(x, z));
// the evolution stage a monster of this level has reached (the same levels as players evolve at)
export const stageForLevel = (level) => [20, 50, 100, 200, 500].filter((l) => level >= l).length;

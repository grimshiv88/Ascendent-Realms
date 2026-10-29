// How strong the wild monsters are: weak near the towns, villages and waystones (and near land
// that players have settled), stronger the deeper into the wilds you go. Out in the wilds they top
// out just below level 500; anything stronger lives only in the castles.
import { PLACES, SECTIONS, toWorld, toMap, PLOT } from './world-layout.mjs';
import { COUNTRY_PLOTS } from './building.mjs';

export const WILD_MAX = 499;
// level at `d` metres from the nearest settled place: about 5 at 2.5 km, 28 at 12 km, 70 at 25 km,
// 200 at 50 km, 390 at 75 km, and 499 from about 85 km (stretched for the bigger world)
export const wildLevel = (d) => { const k = Math.max(0, d) / 2500; return Math.max(1, Math.min(WILD_MAX, Math.round(1 + 4 * k + 0.3 * k * k))); };

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
  warded = wardedPlots(plots || []);
}

// Land monsters can't walk onto: any plot with something built on it, and the whole of a nation
// (an owner's joined-up land of 100 plots or more). Empty property, owned but unused, stays open.
let warded = new Set();
export function wardedPlots(plots) {
  const out = new Set();
  const byOwner = new Map();
  for (const p of plots) {
    const k = `${p.ix},${p.iz}`;
    if (p.pieces?.length) out.add(k);
    const owner = p.owner ?? (p.mine ? '\u0000me' : null);
    if (owner == null) continue;
    if (!byOwner.has(owner)) byOwner.set(owner, new Set());
    byOwner.get(owner).add(k);
  }
  for (const left of byOwner.values()) {
    if (left.size < COUNTRY_PLOTS) continue;
    for (const start of [...left]) {
      if (!left.has(start)) continue;
      left.delete(start);
      const part = [start], todo = [start];
      while (todo.length) {
        const [ix, iz] = todo.pop().split(',').map(Number);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = `${ix + dx},${iz + dz}`;
          if (left.has(nk)) { left.delete(nk); todo.push(nk); part.push(nk); }
        }
      }
      if (part.length >= COUNTRY_PLOTS) for (const k of part) out.add(k);
    }
  }
  return out;
}
export const wardedAt = (x, z) => warded.size > 0 && warded.has(`${Math.floor(x / PLOT)},${Math.floor(z / PLOT)}`);
// metres to the nearest settled place
export function settledDistance(x, z) {
  let d = Infinity;
  for (const t of TOWNS) d = Math.min(d, Math.hypot(x - t.x, z - t.z));
  for (const t of settled) d = Math.min(d, Math.hypot(x - t.x, z - t.z));
  return d;
}
// The Dark Forests are far stronger than their distance says: from about level 120 at the edge to
// near the top of the wilds in the middle
const DARK = SECTIONS.filter((sc) => sc.biome === 'darkwood');
export function darkLevelAt(x, z) {
  const p = toMap(x, z);
  let best = 0;
  for (const sc of DARK) best = Math.max(best, 1 - Math.hypot(p.x - sc.px, p.y - sc.py) / sc.r);
  return best > 0 ? Math.round(120 + 360 * best) : 0;
}
export const wildLevelAt = (x, z) => Math.min(WILD_MAX, Math.max(wildLevel(settledDistance(x, z)), darkLevelAt(x, z)));
// the evolution stage a monster of this level has reached (the same levels as players evolve at)
export const stageForLevel = (level) => [20, 50, 100, 200, 500].filter((l) => level >= l).length;

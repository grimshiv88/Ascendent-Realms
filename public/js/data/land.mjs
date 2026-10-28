// Land you can buy: square plots of the Heartland (the central forest continent).
// Shared by the game and the server, so both agree on what can be bought and what it costs.
import { PLOT, sample, placesWithPositions, riverDistance } from './world-layout.mjs';

export { PLOT };
export const PURPOSE_FEE = 50; // to change what a plot is for
export const REACH = 500;      // you can buy land up to this far from where you stand: a 1 km × 1 km square
export const MAX_AT_ONCE = 100; // plots in one purchase

export const PURPOSES = {
  house: { name: 'House', color: '#d9a441', text: 'A home of your own. Build rooms, store your things and rest to heal faster.' },
  shop: { name: 'Shop', color: '#3d9bff', text: 'Sell your goods to other players, even while you are away.' },
  guild: { name: 'Guild Hall', color: '#b04ad9', text: 'Found a guild. Members can meet here and share storage.' },
  farm: { name: 'Farm', color: '#5fbf3a', text: 'Grow crops and food. Farmers harvest more.' },
  workshop: { name: 'Workshop', color: '#e0662a', text: 'A forge and workbench for crafting and upgrading. Blacksmiths work faster here.' },
  property: { name: 'Property', color: '#9aa4b0', text: 'Keep the land as an investment, or decide what to build later.' },
};

const tmp = {};
// Heights at the corners and middle of a plot (ignoring any levelling already done)
function plotHeights(ix, iz) {
  const out = [];
  for (const [fx, fz] of [[0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95], [0.5, 0.5]]) {
    sample((ix + fx) * PLOT, (iz + fz) * PLOT, tmp);
    out.push({ h: tmp.h, water: tmp.water, region: tmp.region });
  }
  return out;
}

// A plot in a river (not a lake or the sea): it can be bought, but only beside land you own
export function isRiver(ix, iz) {
  const cx = (ix + 0.5) * PLOT, cz = (iz + 0.5) * PLOT;
  sample(cx, cz, tmp);
  return tmp.region === 'heart' && !(tmp.lake > 0.02) && riverDistance(cx, cz) < 160;
}
const RIVER_ALONE = 'River land can only be bought beside land you own (or land you are buying with it).';

// Why a plot can't be bought, or null if it can. `besideMine(ix, iz)` says whether a plot next to it
// is yours (river plots need one).
export function whyNot(ix, iz, besideMine = null) {
  const hs = plotHeights(ix, iz);
  if (hs.some((p) => p.region !== 'heart')) return 'Only land in the Heartland can be bought for now.';
  if (hs.some((p) => p.h < p.water + 0.5)) {
    if (!isRiver(ix, iz)) return 'This plot is under water.';
    return besideMine?.(ix, iz) ? null : RIVER_ALONE;
  }
  const cx = (ix + 0.5) * PLOT, cz = (iz + 0.5) * PLOT;
  if (placesWithPositions().some((p) => Math.hypot(p.x - cx, p.z - cz) < (p.cave ? 40 : 90))) return 'This land belongs to everyone: it is too close to a landmark.';
  const spread = Math.max(...hs.map((p) => p.h)) - Math.min(...hs.map((p) => p.h));
  if (spread > 12) return 'Too steep to build on.';
  return null;
}

export const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const inReach = (ix, iz, x, z) => Math.abs((ix + 0.5) * PLOT - x) <= REACH && Math.abs((iz + 0.5) * PLOT - z) <= REACH;

// Check a purchase of several plots at once. `owned` is a Set of "ix,iz" for every plot anyone owns,
// `mine` the ones that are yours, `at` where you stand. River plots must touch your land, or land
// bought with them (a river plot touching another river plot that does, counts too).
// Returns { total } or { error }.
export function checkPurchase(list, { owned, mine, at }) {
  if (!Array.isArray(list) || !list.length) return { error: 'Choose some land first.' };
  if (list.length > MAX_AT_ONCE) return { error: `You can buy up to ${MAX_AT_ONCE} plots at once.` };
  const key = (p) => `${p.ix},${p.iz}`;
  const keys = new Set(list.map(key));
  if (keys.size !== list.length) return { error: 'The same plot is chosen twice.' };
  const rivers = [];
  const anchored = new Set(mine);
  let total = 0;
  for (const p of list) {
    if (owned.has(key(p))) return { error: `Plot ${key(p)} already belongs to someone.` };
    if (!at || !inReach(p.ix, p.iz, at.x, at.z)) return { error: `Plot ${key(p)} is too far away. You can buy land up to ${REACH} m from where you stand.` };
    const why = whyNot(p.ix, p.iz, () => true);
    if (why) return { error: `Plot ${key(p)}: ${why}` };
    if (isRiver(p.ix, p.iz) && plotHeights(p.ix, p.iz).some((h) => h.h < h.water + 0.5)) rivers.push(p); else anchored.add(key(p));
    total += plotPrice(p.ix, p.iz);
  }
  // river plots join on, one after another, while they touch something already anchored
  let left = rivers;
  for (let grew = true; grew && left.length;) {
    grew = false;
    left = left.filter((p) => {
      if (!NEIGHBOURS.some(([dx, dz]) => anchored.has(`${p.ix + dx},${p.iz + dz}`))) return true;
      anchored.add(key(p)); grew = true; return false;
    });
  }
  if (left.length) return { error: `Plot ${key(left[0])}: ${RIVER_ALONE}` };
  return { total };
}

// Land near the towns of the Heartland costs more
export function plotPrice(ix, iz) {
  const cx = (ix + 0.5) * PLOT, cz = (iz + 0.5) * PLOT;
  let d = Infinity;
  for (const p of placesWithPositions()) if (!p.cave && p.region === 'heart') d = Math.min(d, Math.hypot(p.x - cx, p.z - cz));
  return Math.round((60 + 440 * Math.exp(-d / 2500)) / 10) * 10;
}

// Clearing and levelling costs more on steep ground; Builders pay half
export function prepareCost(ix, iz, cls) {
  const hs = plotHeights(ix, iz);
  const spread = Math.max(...hs.map((p) => p.h)) - Math.min(...hs.map((p) => p.h));
  const cost = Math.round((40 + spread * 12) / 5) * 5;
  return cls === 'builder' ? Math.round(cost / 2) : cost;
}

// The level a prepared plot is set to: the average of its ground
// (a river plot is filled in to just above the water)
export function levelHeight(ix, iz) {
  const hs = plotHeights(ix, iz);
  const avg = hs.reduce((a, p) => a + p.h, 0) / hs.length;
  return Math.round(Math.max(avg, Math.max(...hs.map((p) => p.water)) + 0.6) * 100) / 100;
}

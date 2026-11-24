// Growing your own crops. Buy seeds (and a hoe) at a Farm Stand, then plant them:
//   - in the visitors' beds every farmstead lends you (in front of its field, see VISITOR_BEDS), or
//   - in beds you dig with a hoe on your own land, once the plot's use is set to Farm.
// A bed takes one packet of seeds and grows in real time, even while you are away. Water it with a
// Watering Can (filled at a river, lake, well or trough) and it grows half as fast again.
// Farmers grow a quarter faster and pick two more at harvest.

export const CROPS = {
  lettuce: { name: 'Lettuce', seed: 'seed_lettuce', gives: 'lettuce', n: [3, 5], mins: 6 },
  carrot: { name: 'Carrots', seed: 'seed_carrot', gives: 'carrot', n: [3, 5], mins: 8 },
  turnip: { name: 'Turnips', seed: 'seed_turnip', gives: 'turnip', n: [3, 4], mins: 10 },
  onion: { name: 'Onions', seed: 'seed_onion', gives: 'onion', n: [3, 5], mins: 12 },
  potato: { name: 'Potatoes', seed: 'seed_potato', gives: 'potato', n: [4, 6], mins: 15 },
  cabbage: { name: 'Cabbages', seed: 'seed_cabbage', gives: 'cabbage', n: [2, 4], mins: 15 },
  wheat: { name: 'Wheat', seed: 'seed_wheat', gives: 'grain', n: [3, 5], mins: 20, hay: 1 },
  pumpkin: { name: 'Pumpkins', seed: 'seed_pumpkin', gives: 'pumpkin', n: [1, 2], mins: 30 },
};
export const SEEDS = Object.fromEntries(Object.entries(CROPS).map(([id, c]) => [c.seed, id]));

export const BED_W = 2, BED_D = 2.4;   // a bed's size in metres
export const BED_GRID = 2.8;           // beds you dig on your own land snap to this grid
export const MAX_BEDS = 80;            // beds one person can have growing (in all places)
export const WATER_BOOST = 1.5;        // a watered bed grows this much faster
export const FARMER_BOOST = 1.25;
export const SEED_BACK = 0.5;          // the chance of a packet of seeds back at harvest

// The visitors' beds of every farmstead, in the farm's own layout (see data/farms.mjs LAYOUT):
// three each side of the path from the field's gate to the town
export const VISITOR_BEDS = [-17, -14.4, -11.8, -4.2, -1.6, 1].map((x) => ({ x, z: 8.6 }));

// How far a bed has grown, 0 (just planted) to 1 (ripe). `b` is { at, w } (planted, watered: ms)
export function growth(b, now = Date.now(), farmer = false) {
  const c = CROPS[b.crop];
  if (!c || !b.at) return 0;
  let ms = Math.max(0, now - b.at);
  if (b.w) ms += (WATER_BOOST - 1) * Math.max(0, now - Math.max(b.at, b.w));
  return Math.min(1, (ms * (farmer ? FARMER_BOOST : 1)) / (c.mins * 60000));
}
// minutes left until ripe
export function minsLeft(b, now = Date.now(), farmer = false) {
  const g = growth(b, now, farmer);
  if (g >= 1) return 0;
  const rate = (farmer ? FARMER_BOOST : 1) * (b.w ? WATER_BOOST : 1);
  return Math.max(1, Math.ceil(((1 - g) * CROPS[b.crop].mins) / rate));
}
export function stageWord(g) {
  return g >= 1 ? 'Ripe' : g < 0.15 ? 'Just planted' : g < 0.5 ? 'Sprouting' : 'Growing';
}

// Clean up a saved list of beds (the server keeps it too)
export function cleanBeds(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const b of list.slice(0, MAX_BEDS)) {
    if (!b || typeof b.k !== 'string' || b.k.length > 60) continue;
    const x = Number(b.x), z = Number(b.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const crop = CROPS[b.crop] ? b.crop : null;
    out.push({ k: b.k, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, crop, at: crop ? Number(b.at) || 0 : 0, w: crop ? Number(b.w) || 0 : 0 });
  }
  return out;
}

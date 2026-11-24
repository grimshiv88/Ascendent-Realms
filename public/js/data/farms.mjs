// The farms: one farmstead just outside every village and great city of the free peoples, on
// ground levelled for good (2 x 2 land plots, 40 m square). Each has a vegetable field, a pen of
// farm animals, a chicken yard, a barn, a Farm Stand and a Halal Butcher. A farm's front (its
// local +z, where the stand and the butcher are) faces the town.
import { placesWithPositions, sample, PLOT, addFixedFlats, safeRadius, riverDistance } from './world-layout.mjs';

export const FARM_HALF = PLOT; // 20 m either side of the middle
const ANGLES = [Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4]; // never in front of the gates (north and south)
const tmp = {};

let farms = null;
function findSpot(p, others) {
  for (const extra of [32, 60, 95]) {
    const d = safeRadius(p) + extra;
    for (const a of ANGLES) {
      const ix = Math.round((p.x + Math.sin(a) * d) / PLOT) - 1, iz = Math.round((p.z + Math.cos(a) * d) / PLOT) - 1;
      const x = (ix + 1) * PLOT, z = (iz + 1) * PLOT;
      const hs = [];
      let ok = true;
      for (let i = -1; i <= 1 && ok; i += 0.5) for (let j = -1; j <= 1 && ok; j += 0.5) {
        const s = sample(x + i * 22, z + j * 22, tmp);
        if (s.h < s.water + 1.2 || s.region !== p.region) ok = false;
        hs.push(s.h);
      }
      if (!ok || Math.max(...hs) - Math.min(...hs) > 7) continue;
      if (riverDistance(x, z) < 40) continue;
      // clear of every town, cave and other farm
      if (placesWithPositions().some((q) => Math.hypot(q.x - x, q.z - z) < (q.cave ? 90 : safeRadius(q) + 30))) continue;
      if (others.some((f) => Math.hypot(f.x - x, f.z - z) < 80)) continue;
      const flat = Math.round((hs.reduce((s, h) => s + h, 0) / hs.length) * 10) / 10;
      // turned in quarter turns so its front faces the town
      const rot = Math.round(Math.atan2(p.x - x, p.z - z) / (Math.PI / 2)) * (Math.PI / 2);
      return { ix, iz, x, z, flat, rot };
    }
  }
  return null;
}

// Every farm: { id, place (the town's id), name, x, z, flat, rot }
export function allFarms() {
  if (farms) return farms;
  farms = [];
  const flats = [];
  for (const p of placesWithPositions()) {
    if (p.cave || p.monster || !(p.village || p.city)) continue;
    const at = findSpot(p, farms);
    if (!at) continue;
    farms.push({ id: `farm-${p.id}`, place: p.id, name: `${p.name} Farm`, ...at });
    for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) flats.push({ ix: at.ix + dx, iz: at.iz + dz, flat: at.flat });
  }
  addFixedFlats(flats);
  return farms;
}

// From a farm's own layout (lx, lz) to the world
export function farmToWorld(f, lx, lz) {
  const c = Math.cos(f.rot), s = Math.sin(f.rot);
  return { x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c };
}
// a box of the layout (middle lx, lz, half sizes hx, hz) as a box in the world (quarter turns only)
export function farmBox(f, lx, lz, hx, hz) {
  const m = farmToWorld(f, lx, lz);
  const odd = Math.round(f.rot / (Math.PI / 2)) % 2 !== 0;
  return { x: m.x, z: m.z, hw: odd ? hz : hx, hd: odd ? hx : hz };
}

// The layout, in metres from the farm's middle (front = +z, towards the town)
export const LAYOUT = {
  field: { x: -8, z: -6, hx: 10.5, hz: 11 },      // the vegetable field
  pen: { x: 11, z: -9, hx: 7, hz: 8.5 },          // horses, cows, sheep, goats, a donkey
  yard: { x: 12.5, z: 6, hx: 5.5, hz: 4 },        // chickens and turkeys
  barn: { x: 14, z: 15, w: 10.5, d: 8 },          // the stable: a red barn with stalls, doors to the front
  stand: { x: -6, z: 14 },                        // the Farm Stand, with the farmer behind it
  butcher: { x: 4, z: 15 },                       // the Halal Butcher's shed, with the butcher
  fire: { x: -15, z: 14 },                        // a cooking fire anyone may use
};

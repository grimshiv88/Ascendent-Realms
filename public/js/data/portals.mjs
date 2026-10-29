// Portal stones: each continent has a ring of them, and any portal can send you to another on the
// same continent for a fee. No portal reaches across the sea to another continent.
// Shared by the game and the server, so both agree where portals stand and what a trip costs.
import { REGIONS, PLACES, toWorld, sample } from './world-layout.mjs';

// how close you need to stand to use one (metres)
export const PORTAL_REACH = 5;

const COMPASS = ['East', 'South-East', 'South', 'South-West', 'West', 'North-West', 'North', 'North-East'];
const SHORT = { heart: 'Heartland', peaks: 'Peaks', warrens: 'Wastes', fae: 'Isle', mire: 'Mire', frost: 'Frost', sun: 'Sunscar' };

// dry, fairly flat ground of this region near (x, z), searching outwards a little
function solidGround(x, z, region) {
  const s = {};
  for (let r = 0; r <= 600; r += 60) {
    for (let i = 0; i < (r ? 8 : 1); i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      sample(px, pz, s);
      if (s.region !== region || s.h < s.water + 1.5 || s.lake > 0.05) continue;
      const slope = Math.abs(sample(px + 4, pz, {}).h - s.h) + Math.abs(sample(px, pz + 4, {}).h - s.h);
      if (slope < 2.5) return { x: Math.round(px), z: Math.round(pz) };
    }
  }
  return null;
}

let cache = null;
// Every portal: { id, name, region, x, z }
export function allPortals() {
  if (cache) return cache;
  const list = [];
  const add = (region, name, x, z) => {
    const g = solidGround(x, z, region);
    // skip one that would stand right beside another
    if (g && !list.some((p) => Math.hypot(p.x - g.x, p.z - g.z) < 2500)) list.push({ id: `portal${list.length}`, name, region, ...g });
  };
  // one beside every named place (a little off to the side, so it never sits on the spawn)
  for (const p of PLACES) { const w = toWorld(p.px, p.py); add(p.region, `${p.name} Portal`, w.x + 40, w.z + 25); }
  // and a ring around each continent; each Fae island gets one in its middle
  for (const reg of REGIONS) {
    if (reg.islands) {
      reg.islands.forEach(([px, py], i) => { const w = toWorld(px, py); add(reg.id, `${['Glade', 'Moonpetal', 'Dewdrop', 'Starfall', 'Mistveil'][i] || 'Isle'} Portal`, w.x, w.z); });
      continue;
    }
    const { x: cx, y: cy, r, stretch } = reg.land;
    const ring = r > 200 ? [0.35, 0.68] : [0.6];
    for (const f of ring) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const w = toWorld(cx + Math.cos(a) * r * f * stretch[0], cy + Math.sin(a) * r * f * stretch[1]);
        add(reg.id, `${f < 0.5 ? 'Inner ' : ''}${COMPASS[i]} ${SHORT[reg.id]} Portal`, w.x, w.z);
      }
    }
    const c = toWorld(cx, cy);
    add(reg.id, `${SHORT[reg.id]} Heart Portal`, c.x, c.z);
  }
  cache = list;
  return list;
}
export const portalById = (id) => allPortals().find((p) => p.id === id) || null;
// the portals you can reach from this one: the others on the same continent
export const portalsFrom = (from) => allPortals().filter((p) => p.region === from.region && p.id !== from.id);
export const nearestPortal = (x, z, reach = PORTAL_REACH) => allPortals().find((p) => Math.hypot(p.x - x, p.z - z) <= reach) || null;

// The fee grows with how far you go: 10 Copper plus 4 Copper a kilometre
export function portalFee(from, to) {
  const km = Math.hypot(from.x - to.x, from.z - to.z) / 1000;
  return Math.round(10 + km * 4);
}
export const portalKm = (from, to) => Math.hypot(from.x - to.x, from.z - to.z) / 1000;

// Portal stones: each continent has a ring of them, and any portal can send you to another on the
// same continent for a fee. No portal reaches across the sea to another continent.
// Shared by the game and the server, so both agree where portals stand and what a trip costs.
import { REGIONS, PLACES, toWorld, sample } from './world-layout.mjs';
import { wildLevelAt } from './wilds.mjs';
import { CITY_R } from './citylevels.mjs';
import { mayEnterCastle } from './interiors.mjs';

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

// where the Central City's public portal stands, from the city's middle (metres; +z is south)
export const GATE_PORTAL = { x: 40, z: CITY_R + 70 };

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
  // (a village's stands just outside its wooden wall; a city's in its Civic Quarter, north-east)
  // (the Central City's, on Castle Hill beside the castle, is the castle's private portal: see
  // mayUsePrivate below; the city's public one stands outside its south gate, added last)
  for (const p of PLACES) {
    const w = toWorld(p.px, p.py); const [ox, oz] = p.village ? [76, 0] : p.city ? [56, -52] : [40, 25];
    if (p.spawn) {
      const g = { x: Math.round(w.x + ox), z: Math.round(w.z + oz) }; // the city's ground is levelled
      list.push({ id: `portal${list.length}`, name: `${p.name} Castle Portal`, region: p.region, ...g, private: true });
    } else add(p.region, `${p.name} Portal`, w.x + ox, w.z + oz);
  }
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
  // The Central City's public portal, outside the walls just east of the south road, a short walk
  // from the south gate (added last so every other portal keeps its id; it may stand near others)
  for (const p of PLACES) {
    if (!p.spawn) continue;
    const w = toWorld(p.px, p.py);
    const g = solidGround(w.x + GATE_PORTAL.x, w.z + GATE_PORTAL.z, p.region) || { x: Math.round(w.x + GATE_PORTAL.x), z: Math.round(w.z + GATE_PORTAL.z) };
    list.push({ id: `portal${list.length}`, name: `${p.name} Gate Portal`, region: p.region, ...g });
  }
  cache = list;
  return list;
}
// A private portal (the Central City's Castle Portal) only serves the castle's own people: whoever
// may walk into the Emperors' Castle today (Emperors; Guild Masters on council days; an Emperor's
// invited guests on trade days) and admins. Nobody else can use it or travel to it. For them it
// is free. `access`: { emperor, guildMaster, guest, admin }
export const mayUsePrivate = (access = {}, ms = Date.now()) => !!access.admin || mayEnterCastle(access, ms);
export const portalShut = (p, access, ms) => !!p.private && !mayUsePrivate(access, ms);
export const portalById = (id) => allPortals().find((p) => p.id === id) || null;
// the portals on the same continent as this one (each still needs your level: see portalOpen)
export const portalsFrom = (from) => allPortals().filter((p) => p.region === from.region && p.id !== from.id);

// How strong the monsters round a portal are: the strongest wild monster level at its stone or
// anywhere within 150 m of it (where you step out). A portal only takes you where the monsters are your level or lower,
// so nobody is sent somewhere they can't survive. (Players' settled land calms the wilds, so a
// portal can open to lower levels as the land round it is built on.)
export const PORTAL_AREA = 150;
export function portalLevel(p) {
  let lv = wildLevelAt(p.x, p.z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    lv = Math.max(lv, wildLevelAt(p.x + Math.cos(a) * PORTAL_AREA, p.z + Math.sin(a) * PORTAL_AREA));
  }
  return lv;
}
export const portalOpen = (p, level) => portalLevel(p) <= level;
export const nearestPortal = (x, z, reach = PORTAL_REACH) => allPortals().find((p) => Math.hypot(p.x - x, p.z - z) <= reach) || null;

// The fee grows with how far you go: 10 Copper plus 1.5 Copper a kilometre
export function portalFee(from, to) {
  if (from.private || to.private) return 0; // the castle's own portal costs its people nothing
  const km = Math.hypot(from.x - to.x, from.z - to.z) / 1000;
  return Math.round(10 + km * 1.5); // (the world is big: long trips stay affordable)
}
export const portalKm = (from, to) => Math.hypot(from.x - to.x, from.z - to.z) / 1000;

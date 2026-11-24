// The plan of a great walled city, ring by ring (see citylevels.mjs for the heights). The same in
// the game and on the server. Positions are metres from the city's middle (x east, z south); an
// angle a points along x = sin a, z = cos a (0 is south, PI/2 east).
//   - Castle Hill, on top: the round plaza with the shrine, the Emperors' Castle to the north
//     (the Central City only), the Main Guild Hall and the city's portal
//   - the Noble Quarter: manors with gardens, either side of a ring road, and the fine furniture shop
//   - the Common Quarter: the market street (the city's shops, the tavern, the Real Estate office,
//     a furniture shop and lots for Businessmen's shops), the Academies, a playground, and three
//     rows of town houses on two ring roads
//   - the Dump, against the inner wall: shacks of planks and patched roofs along a dirt track,
//     junk piled between them, and a junk dealer
// Some houses on every ring stand empty, for sale at the Real Estate office; the rest are homes of
// the townsfolk (and of every child born in the city).
import { TIERS, ROAD_ANGLES, ROAD_HALF, RAMP_WALL } from './citylevels.mjs';

// a little seeded random, so the plan is always the same
function seeded(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const tier = (id) => TIERS.find((t) => t.id === id);

// ---------- Castle Hill ----------
export const PLAZA_R = 34;                       // the plaza round the shrine (paved a little wider)
export const CASTLE_SPOT = { x: 0, z: -63 };     // the keep's middle; it faces the plaza
export const GUILD_SPOT = { x: -50, z: -40, w: 18, d: 12, h: 9 };
export const PORTAL_CLEAR = { x: 56, z: -52, r: 14 }; // the city's portal stands here (data/portals.mjs)

// ---------- the ring roads ----------
// [radius of the middle, width]; the Dump's is a dirt track
export const RING_ROADS = [
  { tier: 'noble', r: 113, w: 7 },
  { tier: 'common', r: 153, w: 6 },
  { tier: 'common', r: 179.5, w: 5 },
  { tier: 'dump', r: 208, w: 4, dirt: true },
  { tier: 'dump', r: 243, w: 4, dirt: true },  // the outer Dump (added when the Dump grew, 2026-11-24)
];

// ---------- the markets ----------
// Open-air stalls lining the main roads, either side, their fronts to the road: the Common
// Quarter's market on the south and west roads (between its two ring roads), the Dump's on the
// south road (between its two dirt tracks), near where everyone comes in from the south gate.
// [tier, road, from, to, stall ids]
const MARKET_RUNS = [
  ['common', 'south', 158, 176, ['stall_bread', 'stall_greens', 'stall_grill', 'stall_drinks', 'stall_cloth', 'stall_tools', 'stall_herbs', 'stall_greens']],
  ['common', 'west', 158, 176, ['stall_grill', 'stall_bread', 'stall_drinks', 'stall_greens', 'stall_herbs', 'stall_cloth', 'stall_bread', 'stall_tools']],
  ['dump', 'south', 212, 239, ['stall_soup', 'stall_scrap', 'stall_greens', 'stall_bread', 'stall_drinks', 'stall_scrap', 'stall_tools', 'stall_soup', 'stall_greens', 'stall_cloth']],
];
export const STALL_LAT = ROAD_HALF + 2.1; // a stall's middle, this far from the road's middle
// The spot where you rise again after a death in a great city: a waystone checkpoint in the Dump
// beside the south road, just inside the inner south gate, far below the castle
export const CHECKPOINT = { along: 252, lat: -(ROAD_HALF + 3), road: 'south' };

// ---------- the shops on the market street (the inner row of the Common Quarter) ----------
// [id, width, depth, height]; they stand in this order south from the east road
const MARKET_ROW = [
  ['city_potions', 9, 7, 5], ['city_tailor', 9, 7, 5], ['city_food', 10, 8, 5], ['tavern', 12, 9, 7],
  ['city_smith', 9, 8, 5], ['city_armoury', 9, 8, 5.5], ['furniture_common', 11, 8, 6],
];
export const ESTATE_ID = 'real_estate';
// the house prices at the Real Estate office, by ring (in Copper)
export const HOUSE_PRICE = { dump: 1500, common: 8000, noble: 60000 };
export const ACADEMY_W = 10, ACADEMY_D = 9;
// How big a home (its storeys and door) is for the folk who live in it: hobbits, fairies and
// goblins build small, giants and dragonewts build tall. Houses for sale are built for anyone (1).
export const RACE_HOME = { human: 1, elf: 1.06, dwarf: 0.86, hobbit: 0.76, giant: 1.3, beastkin: 1.1,
  dragonewt: 1.2, goblin: 0.8, slime: 0.85, fairy: 0.74, lizardman: 1.05, naga: 1.1 };
// small folk build narrower too (their homes stand back a little from their neighbours)
export const homeFootprint = (size) => (size < 1 ? 0.7 + 0.3 * size : 1);

// Is a building at radius r, angle a, w wide and d deep, clear of the main roads (and their ramp walls)?
const CLEAR = ROAD_HALF + RAMP_WALL + 1;
function clearOfRoads(r, a, w, d) {
  for (const ra of Object.values(ROAD_ANGLES)) {
    const da = Math.atan2(Math.sin(a - ra), Math.cos(a - ra));
    if (Math.abs(da) > Math.PI / 2) continue;
    if (Math.min(Math.abs((r - d / 2) * Math.sin(da)), Math.abs((r + d / 2) * Math.sin(da))) - w / 2 < CLEAR) return false;
  }
  return true;
}
// a building standing on a ring at radius r and angle a, its door facing out (+1) or in (-1)
function onRing(r, a, w, d, face, extra) {
  const x = Math.sin(a) * r, z = Math.cos(a) * r;
  const fx = Math.sin(a) * face, fz = Math.cos(a) * face;
  const rot = Math.atan2(fx, fz);
  const doorX = extra.doorX ?? 0;
  return { x, z, a, r, rot, fx, fz, w, d, doorX, door: { x: doorX * Math.cos(rot), z: -doorX * Math.sin(rot) }, ...extra };
}

let PLAN = null;
// The whole plan, worked out once
export function cityPlan() {
  if (PLAN) return PLAN;
  const homes = [], shops = [], academies = [], lots = [], junk = [];
  let playground = null;
  const used = []; // [r0, r1, a0, a1] spans already taken on the market row
  const free = (r, a, w) => !used.some(([r0, a0, a1]) => r0 === r && a + w / 2 / r > a0 && a - w / 2 / r < a1);
  const take = (r, a, w) => used.push([r, a - w / 2 / r, a + w / 2 / r]);
  const forSale = (rnd) => rnd() < 1 / 6;
  const addHome = (b, rnd) => homes.push({ ...b, sale: forSale(rnd) });

  // the market street: the inner row of the Common Quarter, doors out onto the first ring road
  const MR = 145, east = ROAD_ANGLES.east;
  let a = east - (CLEAR + 6) / MR;
  for (const [id, w, d, h] of MARKET_ROW) {
    a -= w / 2 / MR;
    shops.push(onRing(MR, a, w, d, 1, { id, h, tier: 'common' }));
    take(MR, a, w);
    a -= (w / 2 + 2.5) / MR;
  }
  // the Real Estate office stands by the south road, where everyone comes in from the south gate
  {
    const w = 12, d = 9, ea = ROAD_ANGLES.south + (CLEAR + 7) / MR;
    shops.push(onRing(MR, ea, w, d, 1, { id: ESTATE_ID, h: 6.5, tier: 'common' }));
    take(MR, ea, w);
  }
  // lots for the shops of Businessmen, after the city's own shops
  for (let k = 0; k < 4; k++) {
    a -= 7 / MR;
    lots.push({ x: Math.sin(a) * MR, z: Math.cos(a) * MR, a, size: 12, tier: 'common' });
    take(MR, a, 13);
    a -= 8.5 / MR;
  }
  // the Academies, north from the east road
  a = east + (CLEAR + 6) / MR;
  for (let k = 0; k < 9; k++) {
    a += ACADEMY_W / 2 / MR;
    academies.push(onRing(MR, a, ACADEMY_W, ACADEMY_D, 1, { k, tier: 'common' }));
    take(MR, a, ACADEMY_W);
    a += (ACADEMY_W / 2 + 3) / MR;
  }
  // the playground, by the west road
  {
    const pa = ROAD_ANGLES.west - (CLEAR + 10) / MR;
    playground = { x: Math.sin(pa) * MR, z: Math.cos(pa) * MR, a: pa, w: 16, d: 10, tier: 'common' };
    take(MR, pa, 17);
  }

  // town houses: the rest of the market row, and the two rows either side of the second road
  const rows = [[MR, 1], [161, -1], [171, 1]];
  rows.forEach(([r, face], ri) => {
    const rnd = seeded(`common${ri}`);
    let t = -Math.PI;
    while (t < Math.PI) {
      const w = Math.round((7 + rnd() * 2.6) * 10) / 10;
      const mid = t + w / 2 / r;
      if (!clearOfRoads(r, mid, w, 8) || !free(r, mid, w + 1)) { t += 1 / r; continue; }
      const floors = rnd() < 0.3 ? 3 : 2;
      const doorX = w >= 8.4 && rnd() < 0.4 ? 0 : (rnd() < 0.5 ? -1 : 1) * Math.round((w / 2 - 1.5) * 10) / 10;
      addHome(onRing(r, mid, w, 8, face, { floors, doorX, tier: 'common', style: 'house' }), rnd);
      t += (w + 0.25) / r; // side by side, a hand's width apart
    }
  });

  // manors in the Noble Quarter, with a garden between each, either side of the ring road
  [[102, 1], [123, -1]].forEach(([r, face], ri) => {
    const rnd = seeded(`noble${ri}`);
    let t = -Math.PI;
    while (t < Math.PI) {
      const w = Math.round((14 + rnd() * 3) * 10) / 10;
      const mid = t + w / 2 / r;
      if (!clearOfRoads(r, mid, w + 4, 12)) { t += 1 / r; continue; }
      addHome(onRing(r, mid, w, 12, face, { floors: 3, doorX: 0, tier: 'noble', style: 'manor' }), rnd);
      t += (w + 7 + rnd() * 3) / r; // a garden between
    }
  });
  // the fine furniture shop, on the Noble Quarter's ring road by the east road
  {
    const r = 123, fa = ROAD_ANGLES.east - (CLEAR + 9) / r;
    const i = homes.findIndex((h) => h.tier === 'noble' && h.r === r && Math.abs(Math.atan2(Math.sin(h.a - fa), Math.cos(h.a - fa))) < 14 / r);
    if (i >= 0) homes.splice(i, 1);
    shops.push(onRing(r, fa, 13, 10, -1, { id: 'furniture_noble', h: 7, tier: 'noble' }));
  }

  // shacks in the Dump, crooked and uneven, along the dirt track; junk piled in the gaps
  [[201, 1], [215, -1]].forEach(([r, face], ri) => {
    const rnd = seeded(`dump${ri}`);
    let t = -Math.PI;
    while (t < Math.PI) {
      const w = Math.round((4 + rnd() * 2.2) * 10) / 10, d = Math.round((4 + rnd() * 1.4) * 10) / 10;
      const mid = t + w / 2 / r;
      if (!clearOfRoads(r, mid, w, d)) { t += 1 / r; continue; }
      const jr = r + (rnd() - 0.5) * 1.6;
      addHome(onRing(jr, mid, w, d, face, { floors: 1, doorX: (rnd() - 0.5) * (w - 2), tier: 'dump', style: 'shack', tilt: (rnd() - 0.5) * 0.16 }), rnd);
      const gap = 2 + rnd() * 5;
      if (gap > 4.5) junk.push({ x: Math.sin(mid + (w / 2 + gap / 2) / r) * r, z: Math.cos(mid + (w / 2 + gap / 2) / r) * r, size: 0.8 + rnd(), seed: junk.length });
      t += (w + gap) / r;
    }
  });
  // the outer Dump (it grew outwards): two more rows of shacks on a second dirt track. They come
  // after all the older homes, so the townsfolk's old homes keep their numbers.
  const outerRows = [[236, 1], [250, -1]];
  const dumpRows = (rows, tag) => rows.forEach(([r, face], ri) => {
    const rnd = seeded(`${tag}${ri}`);
    let t = -Math.PI;
    while (t < Math.PI) {
      const w = Math.round((4 + rnd() * 2.2) * 10) / 10, d = Math.round((4 + rnd() * 1.4) * 10) / 10;
      const mid = t + w / 2 / r;
      if (!clearOfRoads(r, mid, w, d)) { t += 1 / r; continue; }
      const jr = r + (rnd() - 0.5) * 1.6;
      extra.push(onRing(jr, mid, w, d, face, { floors: 1, doorX: (rnd() - 0.5) * (w - 2), tier: 'dump', style: 'shack', tilt: (rnd() - 0.5) * 0.16 }));
      const gap = 2 + rnd() * 5;
      if (gap > 4.5) junk.push({ x: Math.sin(mid + (w / 2 + gap / 2) / r) * r, z: Math.cos(mid + (w / 2 + gap / 2) / r) * r, size: 0.8 + rnd(), seed: junk.length });
      t += (w + gap) / r;
    }
  });
  const extra = [];
  dumpRows(outerRows, 'dumpout');
  // life in the Dump's back lots (between the old shacks and the new, and along the inner wall):
  // children playing in the dirt, and folk lying or sitting on the ground on old blankets
  const yards = [], idlers = [];
  {
    const rnd = seeded('dumplife');
    for (const r of [226, 259]) {
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2 + rnd() * 0.08;
        if (!clearOfRoads(r, a, 8, 6)) continue;
        if (k % 3 === 0) yards.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, a, r, tier: 'dump', kids: 3 + Math.floor(rnd() * 3), seed: yards.length });
        else idlers.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, a, r, tier: 'dump', pose: rnd() < 0.55 ? 'lying' : 'sitting', seed: idlers.length });
      }
    }
  }
  // the market stalls
  const stalls = [];
  for (const [tierId, road, from, to, ids] of MARKET_RUNS) {
    const ra = ROAD_ANGLES[road], per = ids.length / 2, step = (to - from) / per;
    ids.forEach((id, i) => {
      const side = i % 2 ? 1 : -1, along = from + step * (Math.floor(i / 2) + 0.5);
      const lat = side * STALL_LAT;
      const x = Math.sin(ra) * along + Math.cos(ra) * lat, z = Math.cos(ra) * along - Math.sin(ra) * lat;
      // its front (+z of the stall) faces the road's middle
      const fx = -Math.cos(ra) * side, fz = Math.sin(ra) * side;
      stalls.push({ id, x, z, rot: Math.atan2(fx, fz), fx, fz, tier: tierId, road, along, lat });
    });
  }
  // the checkpoint where you rise again
  const cp = (() => { const ra = ROAD_ANGLES[CHECKPOINT.road], { along, lat } = CHECKPOINT; const sd = -Math.sign(lat), fx = Math.cos(ra) * sd, fz = -Math.sin(ra) * sd; return { x: Math.sin(ra) * along + Math.cos(ra) * lat, z: Math.cos(ra) * along - Math.sin(ra) * lat, a: ra, fx, fz, rot: Math.atan2(fx, fz), tier: 'dump' }; })();

  // the junk dealer, by the south road
  {
    const r = 201, ja = ROAD_ANGLES.south - (CLEAR + 6) / r;
    const i = homes.findIndex((h) => h.tier === 'dump' && Math.abs(h.r - r) < 2 && Math.abs(Math.atan2(Math.sin(h.a - ja), Math.cos(h.a - ja))) < 8 / r);
    if (i >= 0) homes.splice(i, 1);
    shops.push(onRing(r, ja, 8, 6, 1, { id: 'furniture_dump', h: 3.5, tier: 'dump' }));
  }

  // number them: the townsfolk's homes, then the houses for sale (each with its price)
  // (the outer Dump's shacks come last, so every older home keeps its number)
  { const rnd = seeded('dumpout-sale'); for (const b of extra) addHome(b, rnd); }
  const family = homes.filter((h) => !h.sale).map((h, i) => ({ ...h, i, h: h.floors * 3.1 }));
  const sale = homes.filter((h) => h.sale).map((h, i) => ({ ...h, i, h: h.floors * 3.1, id: `${h.tier}${i}`, price: HOUSE_PRICE[h.tier] }));
  PLAN = { family, sale, shops, academies, lots, junk, playground, stalls, yards, idlers, checkpoint: cp };
  return PLAN;
}
// the height of a ring above the city's foot
export const tierY = (id) => tier(id)?.y ?? 0;

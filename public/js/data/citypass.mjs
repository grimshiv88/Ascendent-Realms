// The gates between the rings of a great city, and the City Pass on everyone's ID that says how far
// in they may go. Shared by the game and the server.
//
// Every walled city rises in rings (see citylevels.mjs): the Dump by the walls, the Common Quarter,
// the Noble Quarter and Castle Hill on top. Where a main road climbs a ramp from one ring to the
// next there is a gate with two guards. Going in (up) they read your ID; going out (down) anyone
// may pass. Your pass is the highest of:
//   - where you were born (a family in the Dump, the Common Quarter or the Noble Quarter),
//   - your level (PASS_LEVEL),
//   - a house you own in the city (a house on a ring lets you in to that ring),
//   - a crown or an empire (Kings and Emperors may go anywhere).
// Children may always go up to the Common Quarter (that is where the Academies are), and when their
// Ceremony is due they are let up to the shrine on Castle Hill.
// Anyone stopped at a gate can buy a day pass for that ring (DAY_PASS, for one day of the realm).
import { cityHouses } from './birth.mjs';
import { DAY_MS } from './clock.mjs';

export const PASS_ORDER = ['dump', 'common', 'noble', 'castle'];
export const PASS_NAME = { dump: 'The Dump', common: 'Common Quarter', noble: 'Noble Quarter', castle: 'Castle Hill' };
// the level that opens each ring to anyone
export const PASS_LEVEL = { common: 20, noble: 100, castle: 250 };
// a day pass at the gate, in Copper, good for one day of the realm (one real hour)
export const DAY_PASS = { common: 20, noble: 300, castle: 1500 };
export const DAY_PASS_MS = DAY_MS;

// Birth luck: which ring of the city a newborn's family lives in. Most are born in the Common
// Quarter, many in the Dump, and a lucky few to a noble house.
export const BIRTH_LUCK = { noble: 0.1, common: 0.55, dump: 0.35 };
export function rollBirthTier(rnd = Math.random) {
  const r = rnd();
  if (r < BIRTH_LUCK.noble) return 'noble';
  if (r < BIRTH_LUCK.noble + BIRTH_LUCK.common) return 'common';
  return 'dump';
}
// the family houses on that ring (numbers into cityHouses)
export const housesOnTier = (city, tier) => cityHouses(city).filter((h) => h.tier === tier).map((h) => h.i);

const rankOf = (tier) => Math.max(0, PASS_ORDER.indexOf(tier));
// the ring a character was born on (their family's house), or null for characters from before
export function bornTier(c) {
  const fam = c?.child?.family || c?.family;
  if (!fam || !Number.isInteger(fam.house)) return null;
  return cityHouses(fam.city)[fam.house]?.tier || null;
}

// The pass written on the ID: { tier, why }. `perks`: { homes: ['noble', ...] (rings of houses you
// own), crowned: true for a King or an Emperor }
export function cityPass(c, perks = {}) {
  const born = bornTier(c) || 'common'; // (characters from before birth luck count as Common)
  let tier = born, why = born === 'dump' ? 'Born in the Dump' : born === 'noble' ? 'Born to a noble house' : 'Born in the Common Quarter';
  const up = (t, w) => { if (rankOf(t) > rankOf(tier)) { tier = t; why = w; } };
  for (const t of ['common', 'noble', 'castle']) if ((c?.level || 1) >= PASS_LEVEL[t]) up(t, `Level ${PASS_LEVEL[t]}`);
  for (const t of perks.homes || []) up(t, 'Owns a house there');
  if (perks.crowned) up('castle', perks.crowned === true ? 'Crowned' : perks.crowned);
  return { tier, why, name: PASS_NAME[tier] };
}

// May `c` go up into ring `tier` of `city`? { ok, how } where how is 'pass', 'day', 'school',
// 'ceremony' or, when not, 'no'
export function mayEnter(c, tier, { perks = {}, city = null, ceremony = false, now = Date.now() } = {}) {
  if (rankOf(cityPass(c, perks).tier) >= rankOf(tier)) return { ok: true, how: 'pass' };
  const d = c?.dayPass;
  if (d && d.until > now && rankOf(d.tier) >= rankOf(tier) && (!city || !d.city || d.city === city)) return { ok: true, how: 'day' };
  if (c?.child && tier === 'common') return { ok: true, how: 'school' };
  if (c?.child && ceremony) return { ok: true, how: 'ceremony' };
  return { ok: false, how: 'no' };
}

// Being born. Nobody chooses who they are: a new character is born at random into a family of
// townsfolk (players shown as NPCs) in one of the walled birth cities, as a child of 4. Their
// parents are of the same race (that is how the race comes about) and have jobs, and the jobs tilt
// which class the child grows into. From 4 to 7 time runs fast for a child: they see their stats and
// their Unique Skill from the start, and choose a school to train at, which raises the odds of that
// class (but never makes it certain). At 7 the Ceremony of Revealing tells them their class.
// Shared by the game and the server.
import { RACES, CLASSES, STARTER_CLASSES, APPEARANCE, newCharacter } from './game-data.mjs';
import { PLACES, toWorld } from './world-layout.mjs';

export const BORN_AGE = 4;
export const CEREMONY_AGE = 7;
export const CEREMONY_SHOW_MS = 15 * 60 * 1000; // a new card hangs in the sky over the shrine this long
export const YEAR_MS = 30 * 60 * 1000;          // a childhood year passes in 30 minutes of play
export const TRAIN_FULL_MS = 40 * 60 * 1000;     // 40 minutes at a school trains you fully in it
export const CHILD_CLASS = 'child';              // a child's class until the Ceremony

// The city each race is born in: player races in the Central City, monsters in their continent's
// Monster City. When its houses are full, the next city on the list.
export const BIRTH_CITY = { elf: 'central', dwarf: 'central', hobbit: 'central', giant: 'central', beastkin: 'central',
  dragonewt: 'emberfall', goblin: 'ashgrave', slime: 'ashgrave', fairy: 'lumenhollow', lizardman: 'mirehaven', naga: 'mirehaven' };
export const BIRTH_CITIES = ['central', 'emberfall', 'ashgrave', 'lumenhollow', 'mirehaven'];
export const KIDS_PER_HOUSE = 4;

// ---------- the plan of a city (the same in the game and on the server) ----------
// Every walled city is laid out in quarters around its round plaza, with a main avenue from the
// north gate to the south gate and a road east and west:
//   - the east road leads to the Royal Quarter: the Emperors' Castle and its grounds
//   - north-east, the Civic Quarter: the Main Guild Hall, the Academy and its training grounds, the portal
//   - south-east, the Market Quarter: the city's shops and tavern along the avenue and the east
//     road, and behind them lots kept for the shops of Businessmen
//   - the whole west half is the Neighbourhood: streets of family houses standing side by side,
//     with a playground for the children
// (x is east, z is south; positions are from the city's middle)
export const CASTLE_SPOT = { x: 105, z: 0 };
// The Neighbourhood, laid out like the old towns: streets (lanes) running north-south. Along each
// street, houses stand side by side facing it; behind each row stands another row back to back
// with it (a narrow alley between their back walls), facing the next street, and so on outward.
// The first row faces the main avenue; the last row backs onto the inner wall. Streets running
// east-west (the west road and two cross streets each side) cut through the rows.
export const HOUSE_D = 8;                        // how deep every house is
export const LANE_W = 6;                         // a street's width
const FRONT = 1.2;                               // the pavement and steps between a street and the doors
const ALLEY = 2;                                 // the gap between back walls
const AVENUE_EDGE = -3.5;                        // the west edge of the main avenue
const PITCH = LANE_W + 2 * (FRONT + HOUSE_D) + ALLEY;
const FIRST_LANE = AVENUE_EDGE - FRONT - 2 * HOUSE_D - ALLEY - FRONT - LANE_W / 2;
export const LANES = [0, 1, 2, 3, 4].map((i) => Math.round((FIRST_LANE - i * PITCH) * 10) / 10); // x of each street's middle
export const CROSS_STREETS = [-104, -58, 58, 104]; // z of the east-west streets (and the west road at 0)
export const PLAYGROUND = { x0: -102, x1: -84, z0: 18, z1: 50 };
const CITY_INNER = 138;                          // houses stay this far in (the inner wall is beyond)
const PLAZA_CLEAR = 40;                          // and this far from the middle (the plaza)
// the rows: [x of the row's middle, the way its doors face (fx)]
const ROWS = [[AVENUE_EDGE - FRONT - HOUSE_D / 2, 1]];
for (const lane of LANES) ROWS.push([lane + LANE_W / 2 + FRONT + HOUSE_D / 2, -1], [lane - LANE_W / 2 - FRONT - HOUSE_D / 2, 1]);
// The family houses. Each: { i, x, z, rot (facing), fx, fz (the way the door faces), w (its front),
// d, floors, doorX (the door's place along the front), door: { x, z } (the door's offset from the middle) }
let HOUSES = null;
export function cityHouses(placeId) {
  if (HOUSES) return HOUSES;
  const out = [];
  const blocked = (x0, x1, z0, z1) => {
    for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) {
      if (Math.hypot(x, z) > CITY_INNER || Math.hypot(x, z) < PLAZA_CLEAR) return true;
    }
    if (z1 > -3.5 - 1.5 && z0 < 3.5 + 1.5) return true; // the west road
    for (const c of CROSS_STREETS) if (z1 > c - 2.5 - 1 && z0 < c + 2.5 + 1) return true;
    const P = PLAYGROUND;
    if (x1 > P.x0 && x0 < P.x1 && z1 > P.z0 - 1 && z0 < P.z1 + 1) return true;
    return false;
  };
  ROWS.forEach(([x, fx], r) => {
    const rnd = seeded(`row${r}`);
    const x0 = x - HOUSE_D / 2, x1 = x + HOUSE_D / 2;
    let z = -CITY_INNER;
    while (z < CITY_INNER) {
      const w = Math.round((7 + rnd() * 2.6) * 10) / 10;
      if (blocked(x0, x1, z, z + w)) { z += 1; continue; }
      const k = out.length;
      const rot = Math.atan2(fx, 0);
      const floors = rnd() < 0.3 ? 3 : 2;
      const doorX = w >= 8.4 && rnd() < 0.4 ? 0 : (rnd() < 0.5 ? -1 : 1) * Math.round((w / 2 - 1.5) * 10) / 10;
      out.push({ i: k, x, z: z + w / 2, rot, fx, fz: 0, w, d: HOUSE_D, h: floors * 3.1, floors, doorX,
        door: { x: doorX * Math.cos(rot), z: -doorX * Math.sin(rot) } });
      z += w + 0.25; // side by side, with only a hand's width between
    }
  });
  HOUSES = out;
  return out;
}
export const houseCount = (placeId) => cityHouses(placeId).length;

// ---------- families ----------
// A small seeded random, so a house's family is always the same
export function seeded(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Parents' jobs, and the class each one leans towards
export const PARENT_JOBS = {
  guard: { name: 'Town Guard', cls: 'swordsman' },
  shieldbearer: { name: 'Shieldbearer', cls: 'tank' },
  hunter: { name: 'Hunter', cls: 'assassin' },
  healer: { name: 'Healer', cls: 'healer' },
  smith: { name: 'Smith', cls: 'blacksmith' },
  merchant: { name: 'Merchant', cls: 'businessman' },
  builder: { name: 'Builder', cls: 'builder' },
  herbalist: { name: 'Herbalist', cls: 'potion_maker' },
  farmer: { name: 'Farmer', cls: 'farmer' },
};
// Names for townsfolk: nobody is a man or a woman in this world, so every name suits anyone
const SYL = {
  player: [['Ar', 'Bel', 'Cor', 'Da', 'El', 'Fen', 'Gal', 'Har', 'Ith', 'Jor', 'Kel', 'Lor', 'Mer', 'Nor', 'Or', 'Per', 'Quin', 'Ros', 'Sel', 'Tam', 'Ul', 'Vel', 'Wyn'], ['an', 'ric', 'wen', 'del', 'is', 'mar', 'tor', 'ra', 'en', 'lin', 'dor', 'ith', 'ys', 'ell']],
  monster: [['Gru', 'Zak', 'Vorr', 'Skel', 'Nag', 'Ssa', 'Kro', 'Ix', 'Thra', 'Ulg', 'Mok', 'Yss', 'Grim', 'Rak'], ['nak', 'zul', 'gash', 'ith', 'rok', 'sha', 'ug', 'ix', 'arr', 'esh', 'og', 'yll']],
};
export function townName(side, rnd) {
  const [a, b] = SYL[side] || SYL.player;
  return a[Math.floor(rnd() * a.length)] + b[Math.floor(rnd() * b.length)];
}
// The family in house `house` of `city`, for a child of `race`: two parents of that race with jobs
export function familyOf(city, house, race) {
  const rnd = seeded(`${city}:${house}:${race}`);
  const side = RACES[race]?.side || 'player';
  const jobs = Object.keys(PARENT_JOBS);
  const parents = [0, 1].map(() => ({ name: townName(side, rnd), job: jobs[Math.floor(rnd() * jobs.length)] }));
  return { city, house, race, parents };
}

// ---------- parents ----------
// Your parents are real people of the city: each has a class (from their job) and a level, and you
// can see their cards. Once you are grown you must visit them (talk to them at their door) at least
// once every VISIT_EVERY_MS of play, or you are marked a sinner for the rest of this life. Parents
// grow old: each dies of old age at their race's age (see LIFESPAN), the same for that family every
// time. They were between about a third and a half of their lifespan when you were born.
export const VISIT_EVERY_MS = 3 * 3600 * 1000;   // 3 hours of play (three days of the realm)
export const ADULT_YEAR_MS = 4 * 60 * 60 * 1000; // after the Ceremony a year passes every 4 hours of play
// how many years each race lives (each person a little more or less)
export const LIFESPAN = {
  elf: 700, dwarf: 250, hobbit: 120, giant: 300, beastkin: 90,
  goblin: 70, slime: 500, fairy: 600, lizardman: 150, naga: 400, dragonewt: 900,
};
// play time from your birth until you are `years` older than when you were born
const playForYears = (years) => (years <= CEREMONY_AGE - BORN_AGE ? years * YEAR_MS : (CEREMONY_AGE - BORN_AGE) * YEAR_MS + (years - (CEREMONY_AGE - BORN_AGE)) * ADULT_YEAR_MS);
export const familyOfChar = (c) => c?.child?.family || c?.family || null;
export function parentInfo(fam, j) {
  const p = fam?.parents?.[j];
  if (!p) return null;
  const rnd = seeded(`${fam.city}:${fam.house}:${p.name}:${j}:life`);
  const level = 12 + Math.floor(rnd() * 70);
  const span = LIFESPAN[fam.race] || 90;
  const ageThen = span * (0.3 + rnd() * 0.2), diesAge = span * (0.85 + rnd() * 0.25);
  const diesAt = Math.round(playForYears(Math.max(1, diesAge - ageThen)));
  return { ...p, race: fam.race, cls: PARENT_JOBS[p.job]?.cls, jobName: PARENT_JOBS[p.job]?.name || p.job, level, diesAt };
}
// a child's parents are always alive; after that, until their time comes
export const parentAlive = (c, j) => { const f = familyOfChar(c), p = parentInfo(f, j); return !!p && (!!c.child || (c.playMs || 0) < p.diesAt); };
export const parentsAlive = (c) => [0, 1].filter((j) => parentAlive(c, j));
// how long until you must visit again (ms of play; 0 or less: overdue), or null when there is nobody to visit
export function visitDue(c) {
  if (c?.child || !familyOfChar(c) || !parentsAlive(c).length) return null;
  return Math.max(c.visitPlay || 0, c.grownPlay || 0) + VISIT_EVERY_MS - (c.playMs || 0);
}

// ---------- growing up ----------
// How old a child is now (play time since birth; a grown character has no age shown)
export const ageOf = (c) => (c?.child ? Math.min(CEREMONY_AGE, BORN_AGE + Math.max(0, (c.playMs || 0) - (c.child.bornPlay || 0)) / YEAR_MS) : null);
export const isChild = (c) => !!c?.child;
export const ceremonyDue = (c) => isChild(c) && ageOf(c) >= CEREMONY_AGE;
// A child's strength grows from a bit over half at 4 to almost full at 7
export const childStatShare = (age) => Math.min(1, 0.55 + 0.13 * (Math.max(BORN_AGE, age) - BORN_AGE));
// and their body from about half size at 4 to about two thirds at 7 (full size after the Ceremony)
export const childSize = (age) => 0.5 + 0.06 * (Math.max(BORN_AGE, Math.min(CEREMONY_AGE, age)) - BORN_AGE);

// ---------- schools ----------
// One school for each class a child can grow into (the Mage is the Dark Side's alone)
export const SCHOOLS = {
  swordsman: { name: 'School of the Sword', academy: 'Academy of the Sword', roof: '#2a4a7a', icon: '⚔️', text: 'Footwork, guard and the cut.' },
  tank: { name: 'School of the Shield', academy: 'Academy of the Shield', roof: '#5a5a66', icon: '🛡️', text: 'Stand firm and take the blow for others.' },
  assassin: { name: 'Scouts\' School', academy: 'Scouts\' Academy', roof: '#2a2a3a', icon: '🗡️', text: 'Move unseen and strike where it counts.' },
  healer: { name: 'Temple School of Healing', academy: 'Academy of Healing', roof: '#e8e2d0', icon: '✚', text: 'Bind wounds and keep others standing.' },
  blacksmith: { name: 'Smithing School', academy: 'Smiths\' Academy', roof: '#3a3632', icon: '⚒️', text: 'Fire, iron and the hammer.' },
  businessman: { name: 'Merchants\' School', academy: 'Merchants\' Academy', roof: '#8a6a1a', icon: '💰', text: 'Numbers, trade and the art of the deal.' },
  builder: { name: 'Builders\' School', academy: 'Builders\' Academy', roof: '#8a3a2a', icon: '🏗️', text: 'Stone, timber and how a house stands.' },
  potion_maker: { name: 'Herbalists\' School', academy: 'Herbalists\' Academy', roof: '#5a3a8a', icon: '⚗️', text: 'Herbs, brews and what each plant can do.' },
  farmer: { name: 'Farming School', academy: 'Farmers\' Academy', roof: '#3a6a2a', icon: '🌾', text: 'Soil, seed and the care of animals.' },
};
export const ACADEMY_NAME = 'The Academies';
// Every city has an Academy for each class, side by side along Academy Street in the Civic Quarter.
// A child registers at the counter of the Academy of the class they want, then trains inside, on
// its training floor beside the teacher. Training raises their level (up to CHILD_MAX_LEVEL before
// the Ceremony) and teaches the school's two techniques, at a quarter and at 60% of full training.
// Techniques are kept for life.
export const CHILD_MAX_LEVEL = 10;
export const TRAIN_EXP = 0.2;                  // of a level's EXP, per minute of training
export const TECHNIQUE_AT = [0.25, 0.6];
export const SCHOOL_TECHNIQUES = {
  swordsman: ['power_strike', 'charge'], tank: ['shield_bash', 'iron_skin'], assassin: ['backstab', 'shadow_step'],
  healer: ['mend', 'blessing'], blacksmith: ['hammer_blow', 'ground_slam'], businessman: ['coin_toss', 'haggle'],
  builder: ['quick_wall', 'ground_slam'], potion_maker: ['second_wind', 'blessing'], farmer: ['harvest_swing', 'hearty_meal'],
};
// Academy Street: east from the avenue, north of the Guild Hall. Five Academies stand on its north
// side and four on its south side, their doors on the street (x, z from the city's middle).
export const ACADEMY_STREET = { z: -104, x0: 3.5, x1: 70, w: 6 };
export const ACADEMY_W = 10, ACADEMY_D = 9;
export const ACADEMIES = Object.keys(SCHOOLS).map((school, i) => {
  const north = i < 5, col = north ? i : i - 5;
  const z = ACADEMY_STREET.z + (north ? -1 : 1) * (ACADEMY_STREET.w / 2 + 1.2 + ACADEMY_D / 2);
  return { school, x: 11 + col * 13, z, fx: 0, fz: north ? 1 : -1 };
});
// How much each thing weighs on the class a child grows into: every class has a little, each
// parent's job adds to theirs, and training at a school adds most to its own (up to 10 when fully
// trained). So a fully trained child usually gets their school's class, but never surely.
const BASE_W = 1, PARENT_W = 2, SCHOOL_W = 10;
// The odds of a child's class at its Ceremony when its parents planned it (a player's own child,
// see data/family.mjs): a quarter for each parent's class, and the other half spread over all
export function plannedClassOdds(plan) {
  const w = Object.fromEntries(STARTER_CLASSES.map((id) => [id, 0.5 / STARTER_CLASSES.length]));
  for (const k of [plan?.a, plan?.b]) if (k in w) w[k] += 0.25;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / total]));
}
export function classOdds(c) {
  if (c?.child?.plan) return plannedClassOdds(c.child.plan);
  const w = Object.fromEntries(STARTER_CLASSES.map((id) => [id, BASE_W]));
  for (const p of c?.child?.family?.parents || []) { const k = PARENT_JOBS[p.job]?.cls; if (k in w) w[k] += PARENT_W; }
  for (const [k, ms] of Object.entries(c?.child?.train || {})) if (k in w) w[k] += SCHOOL_W * Math.min(1, ms / TRAIN_FULL_MS);
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / total]));
}
export function rollClass(c, rnd = Math.random) {
  const odds = classOdds(c);
  let r = rnd();
  for (const [k, p] of Object.entries(odds)) { r -= p; if (r <= 0) return k; }
  return Object.keys(odds)[0];
}
export const schoolName = (cls) => SCHOOLS[cls]?.name || '';
export const className = (cls) => (cls === CHILD_CLASS ? 'Child' : CLASSES[cls]?.name || cls);

// ---------- being born ----------
// Who you are born as: any race at all (`side` narrows it to Players or Monsters, if given), with a
// look of your race chosen at random
export function rollBirth(side = null, rnd = Math.random, forceRace = null) {
  const races = Object.keys(RACES).filter((r) => !side || RACES[r].side === side);
  const race = RACES[forceRace] ? forceRace : races[Math.floor(rnd() * races.length)];
  const pal = APPEARANCE[race];
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  return { race, side: RACES[race].side, form: RACES[race].side === 'monster' ? 'monster' : 'humanoid',
    look: { skin: pick(pal.skin), accent: pick(pal.accent), eyes: pick(pal.eyes), size: Math.round((0.92 + rnd() * 0.16) * 100) / 100 } };
}
// Where the front door of house `house` in `city` is, in the world
export function houseDoor(city, house) {
  const place = PLACES.find((p) => p.id === city);
  const h = cityHouses(city)[house];
  if (!place || !h) return null;
  const c = toWorld(place.px, place.py);
  const out = h.d / 2 + 2; // just in front of the door, on the street
  return { x: c.x + h.x + (h.door?.x || 0) + h.fx * out, z: c.z + h.z + (h.door?.z || 0) + h.fz * out, heading: h.rot, area: place.name };
}
// A newborn: a Child of 4 in their family's house. `home` is { city, house } (the server finds a
// house with room); the rest as newCharacter. Returns { character } or { error }.
export function bornCharacter(name, birth, home, opts = {}) {
  const r = newCharacter(name, { side: birth.side, race: birth.race, cls: CHILD_CLASS, form: birth.form, look: birth.look }, opts);
  if (r.error) return r;
  const c = r.character;
  const door = houseDoor(home.city, home.house);
  if (door) c.location = { area: door.area, x: door.x, y: 0, z: door.z, heading: door.heading };
  c.child = { born: new Date().toISOString(), bornPlay: 0, family: familyOf(home.city, home.house, birth.race), school: null, train: {} };
  // a child carries no starting kit of a class yet: just food from home
  c.inventory = [['bread', 3], ['water_flask', 3], ['herbal_tea', 2]].map(([id, n]) => ({ id, n }));
  return r;
}

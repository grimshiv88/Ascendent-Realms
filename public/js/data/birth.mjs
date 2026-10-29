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
//   - the whole west half is the Neighbourhood: rows of family houses along three lanes, with a
//     playground for the children
// (x is east, z is south; positions are from the city's middle)
export const CASTLE_SPOT = { x: 105, z: 0 };
export const LANES = [-56, -88, -120];          // the Neighbourhood's lanes (x), running north-south
export const PLAYGROUND = { x0: -100, x1: -76, z0: 16, z1: 50 };
const CITY_INNER = 138;                          // houses stay this far in (the inner wall is beyond)
// The family houses: on both sides of each lane, doors facing it, leaving the west road and the
// playground clear. Each: { i, x, z, rot (facing), fx, fz (the way the door faces), w, d, h }
export function cityHouses(placeId) {
  const out = [];
  for (const lane of LANES) {
    for (const side of [1, -1]) {
      const x = lane + side * 8;
      const zMax = Math.sqrt(Math.max(0, CITY_INNER ** 2 - (Math.abs(x) + 4) ** 2)) - 4;
      for (let z = -Math.floor(zMax / 10) * 10; z <= zMax; z += 10) {
        if (Math.abs(z) < 12) continue; // the west road
        if (x > PLAYGROUND.x0 - 4 && x < PLAYGROUND.x1 + 4 && z > PLAYGROUND.z0 - 6 && z < PLAYGROUND.z1 + 6) continue;
        const k = out.length;
        const fx = -side, fz = 0; // facing the lane
        out.push({ i: k, x, z, rot: Math.atan2(fx, fz), fx, fz, w: 6 + (k % 3) * 0.6, d: 5 + (k % 2) * 0.6, h: 3.6 + (k % 3) * 0.5 });
      }
    }
  }
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
// grow old: each dies at a set point in your life (between PARENT_LIFE hours of play), the same for
// that family every time.
export const VISIT_EVERY_MS = 3 * 3600 * 1000;   // 3 hours of play (three days of the realm)
export const PARENT_LIFE = [15, 45];             // hours of your play time
export const familyOfChar = (c) => c?.child?.family || c?.family || null;
export function parentInfo(fam, j) {
  const p = fam?.parents?.[j];
  if (!p) return null;
  const rnd = seeded(`${fam.city}:${fam.house}:${p.name}:${j}:life`);
  const level = 12 + Math.floor(rnd() * 70);
  const diesAt = Math.round((PARENT_LIFE[0] + rnd() * (PARENT_LIFE[1] - PARENT_LIFE[0])) * 3600 * 1000);
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
  swordsman: { name: 'School of the Sword', icon: '⚔️', text: 'Footwork, guard and the cut.' },
  tank: { name: 'School of the Shield', icon: '🛡️', text: 'Stand firm and take the blow for others.' },
  assassin: { name: 'Scouts\' School', icon: '🗡️', text: 'Move unseen and strike where it counts.' },
  healer: { name: 'Temple School of Healing', icon: '✚', text: 'Bind wounds and keep others standing.' },
  blacksmith: { name: 'Smithing School', icon: '⚒️', text: 'Fire, iron and the hammer.' },
  businessman: { name: 'Merchants\' School', icon: '💰', text: 'Numbers, trade and the art of the deal.' },
  builder: { name: 'Builders\' School', icon: '🏗️', text: 'Stone, timber and how a house stands.' },
  potion_maker: { name: 'Herbalists\' School', icon: '⚗️', text: 'Herbs, brews and what each plant can do.' },
  farmer: { name: 'Farming School', icon: '🌾', text: 'Soil, seed and the care of animals.' },
};
export const ACADEMY_NAME = 'The Academy';
// Children train on the Academy's Training Grounds, at their school's station with its teacher.
// Training raises their level (up to CHILD_MAX_LEVEL before the Ceremony) and teaches the school's
// two techniques, at a quarter and at 60% of full training. Techniques are kept for life.
export const CHILD_MAX_LEVEL = 10;
export const TRAIN_EXP = 0.12;                 // of a level's EXP, per minute of training
export const TECHNIQUE_AT = [0.25, 0.6];
export const SCHOOL_TECHNIQUES = {
  swordsman: ['power_strike', 'charge'], tank: ['shield_bash', 'iron_skin'], assassin: ['backstab', 'shadow_step'],
  healer: ['mend', 'blessing'], blacksmith: ['hammer_blow', 'ground_slam'], businessman: ['coin_toss', 'haggle'],
  builder: ['quick_wall', 'ground_slam'], potion_maker: ['second_wind', 'blessing'], farmer: ['harvest_swing', 'hearty_meal'],
};
// the stations on the Training Grounds, one per school (x, z from the city's middle)
export const TRAINING_GROUND = { x0: 24, x1: 58, z0: -112, z1: -82 };
export const TRAINING_STATIONS = Object.keys(SCHOOLS).map((school, i) => ({ school, x: 30 + (i % 3) * 11, z: -106 + Math.floor(i / 3) * 9 }));
// How much each thing weighs on the class a child grows into: every class has a little, each
// parent's job adds to theirs, and training at a school adds most to its own (up to 10 when fully
// trained). So a fully trained child usually gets their school's class, but never surely.
const BASE_W = 1, PARENT_W = 2, SCHOOL_W = 10;
export function classOdds(c) {
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
export function rollBirth(side = null, rnd = Math.random) {
  const races = Object.keys(RACES).filter((r) => !side || RACES[r].side === side);
  const race = races[Math.floor(rnd() * races.length)];
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
  const out = h.d / 2 + 2; // just in front of the door, on the lane
  return { x: c.x + h.x + h.fx * out, z: c.z + h.z + h.fz * out, heading: h.rot, area: place.name };
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

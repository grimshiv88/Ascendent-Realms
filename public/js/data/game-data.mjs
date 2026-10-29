// Game rules shared by the browser and the server. Numbers come from the rulebook.
import { homePlace, toWorld, PLACES } from './world-layout.mjs';
import { STARTER_ITEMS } from './items.mjs';
import { pickUnique, uniqueByName, uniqueSlot } from './unique.mjs';

export const MAIN_STATS = ['str', 'agi', 'dex', 'sta', 'int'];
export const STAT_NAMES = { str: 'Strength', agi: 'Agility', dex: 'Dexterity', sta: 'Stamina', int: 'Intelligence' };

// Every race totals 50 base points.
// skillGift (Elves): skills are ready 20% sooner and cost 15% less SP (magic belongs to the Dark Side)
export const RACES = {
  // Player races
  elf:       { side: 'player',  name: 'Elf',       stats: { str: 7,  agi: 13, dex: 14, sta: 8,  int: 8  }, element: 'Wind',      expMult: 1.0, skillGift: true,
               home: 'Central forest', blurb: 'Tall and graceful forest folk with long ears and bark-patterned skin. Quick, precise and gifted with skills: theirs are ready 20% sooner and cost 15% less SP.' },
  dwarf:     { side: 'player',  name: 'Dwarf',     stats: { str: 14, agi: 6,  dex: 10, sta: 13, int: 7  }, element: 'Earth',     expMult: 1.0,
               home: 'Central forest', blurb: 'Short, broad and stone-skinned, with heavy braided beards. Strong and hard to knock down.' },
  hobbit:    { side: 'player',  name: 'Hobbit',    stats: { str: 6,  agi: 13, dex: 13, sta: 8,  int: 10 }, element: 'Nature',    expMult: 1.0,
               home: 'Central forest', blurb: 'Small, nimble folk with large furred feet and sharp eyes. Hard to catch and hard to miss with.' },
  giant:     { side: 'player',  name: 'Giant',     stats: { str: 16, agi: 5,  dex: 6,  sta: 16, int: 7  }, element: 'Earth',     expMult: 1.0,
               home: 'Central forest', blurb: 'Four metres of muscle with tusks and craggy skin. Slow, but nearly impossible to stop.' },
  beastkin:  { side: 'player',  name: 'Beastkin',  stats: { str: 11, agi: 15, dex: 9,  sta: 10, int: 5  }, element: 'Lightning', expMult: 1.0,
               home: 'Central forest', blurb: 'Wolf-headed hunters covered in fur, with a tail and powerful legs. The fastest race of all.' },
  // Monster races
  goblin:    { side: 'monster', name: 'Goblin',    stats: { str: 10, agi: 12, dex: 10, sta: 10, int: 8  }, element: 'Dark',      expMult: 1.0,
               home: 'Goblin Warrens', blurb: 'Small, cunning and green, with huge ears. The easiest monster race to grow.' },
  slime:     { side: 'monster', name: 'Slime',     stats: { str: 8,  agi: 8,  dex: 8,  sta: 14, int: 12 }, element: 'Water',     expMult: 1.15,
               home: 'Slime Caves', blurb: 'A living blob of gel that can take a person-like shape. Absorbs what it defeats.' },
  fairy:     { side: 'monster', name: 'Fairy',     stats: { str: 4,  agi: 14, dex: 11, sta: 6,  int: 15 }, element: 'Light',     expMult: 1.2,
               home: 'Fairy Glade', blurb: 'A tiny glowing sprite with insect wings. Fragile, fast and full of magic.' },
  lizardman: { side: 'monster', name: 'Lizardman', stats: { str: 12, agi: 9,  dex: 9,  sta: 13, int: 7  }, element: 'Water',     expMult: 1.25,
               home: 'Lizardman Marsh', blurb: 'Scaled marsh warriors with a heavy tail. Tough, patient and dangerous in water.' },
  naga:      { side: 'monster', name: 'Naga',      stats: { str: 9,  agi: 10, dex: 11, sta: 8,  int: 12 }, element: 'Water',     expMult: 1.35,
               home: 'Naga Lake Temple', blurb: 'Serpent-bodied priests of the deep lake. Clever, venomous and precise.' },
  dragonewt: { side: 'monster', name: 'Dragonewt', stats: { str: 13, agi: 10, dex: 8,  sta: 10, int: 9  }, element: 'Fire',      expMult: 1.6,
               home: 'Dragon Peaks', blurb: 'Young dragon-kin with horns, wings and fire in their blood. The hardest monster race to raise.' },
};

export const CLASSES = {
  // only for those who join the Dark Side (see becomeMage): never a starting class
  mage:        { name: 'Mage',        bonus: { int: 6, dex: 4 },         main: 'int', blurb: 'Spells cost 10% less SP.', dark: true },
  swordsman:   { name: 'Swordsman',   bonus: { str: 5, dex: 3, agi: 2 }, main: 'str', blurb: '+10% ATK with swords.' },
  tank:        { name: 'Tank',        bonus: { sta: 7, str: 3 },         main: 'sta', blurb: 'Taunts enemies. +15% DEF with shields.' },
  assassin:    { name: 'Assassin',    bonus: { agi: 6, dex: 4 },         main: 'agi', blurb: 'Stealth. +20% critical damage from behind.' },
  healer:      { name: 'Healer',      bonus: { int: 6, sta: 4 },         main: 'int', blurb: 'Healing skills are 20% stronger.' },
  blacksmith:  { name: 'Blacksmith',  bonus: { str: 4, sta: 4, dex: 2 }, main: 'str', blurb: 'Crafts and upgrades items 25% cheaper, and can open a shop.' },
  businessman: { name: 'Businessman', bonus: { int: 7, agi: 3 },         main: 'int', blurb: 'Can own trading buildings. Shops pay a Businessman far more for what they sell (70% of the price, not 40%).' },
  builder:     { name: 'Builder',     bonus: { str: 4, sta: 4, int: 2 }, main: 'sta', blurb: 'Builds 30% faster with 20% less material.' },
  potion_maker: { name: 'Potion Maker', bonus: { int: 5, dex: 3, sta: 2 }, main: 'int', blurb: 'Brews potions and elixirs from herbs for far less than the shop asks. The only class with a Potion-Maker\'s kit.' },
  farmer:      { name: 'Farmer',      bonus: { sta: 6, str: 4 },         main: 'sta', blurb: 'Grows crops and raises animals. Food made removes 50% more Fatigue.' },
  // every character is a Child from birth (age 4) until the Ceremony of Revealing at 7 (see birth.mjs)
  child:       { name: 'Child',       bonus: {},                         main: 'int', blurb: 'Your class is revealed at the Ceremony, at the age of 7.', hidden: true },
};

// The classes a new character can start with (the Mage is the Dark Side's alone)
export const STARTER_CLASSES = Object.keys(CLASSES).filter((id) => !CLASSES[id].dark && !CLASSES[id].hidden);
// Someone who joined the Dark Side may become a Mage: their old class's bonus points go and the
// Mage's come in their place (a stat never drops below 1). For good.
export function becomeMage(c) {
  if (c.cls === 'mage' || !CLASSES[c.cls]) return false;
  for (const [k, v] of Object.entries(CLASSES[c.cls].bonus)) c.stats[k] = Math.max(1, (c.stats[k] || 0) - v);
  for (const [k, v] of Object.entries(CLASSES.mage.bonus)) c.stats[k] = (c.stats[k] || 0) + v;
  c.cls = 'mage';
  return true;
}

// What each class can do and what to aim for: shown when you pick a class, and in Status.
export const CLASS_GUIDE = {
  child: { can: ['See your stats and your Unique Skill', 'Train at a school in the Academy: it raises the odds of that class', 'Explore your city (children may not leave it)'],
    goals: ['Choose the school that suits you and your Unique Skill', 'Grow up: at 7 the Ceremony of Revealing tells you your class'] },
  mage: { can: ['Cast spells in your elements with a staff (attack from a distance)', 'Spells cost 10% less SP', 'Learn new skills as you level'],
    goals: ['Clear caves other classes can\'t reach', 'Protect farmers and builders from monsters', 'Rise through the six Mage ranks and become the Mage King'] },
  swordsman: { can: ['Hit harder with swords (+10% ATK)', 'Fight at the front, up close', 'Merge and evolve your sword with a Blacksmith'],
    goals: ['Hunt the strongest monsters and their bosses', 'Take on quests and guild work for coins', 'Rise through the six ranks and become the Swordsman King'] },
  tank: { can: ['Draw monsters onto yourself (taunt)', '+15% DEF with a shield', 'Take hits that would beat other classes'],
    goals: ['Lead groups into caves and boss fights', 'Guard spawn points, roads and towns', 'Rise through the six ranks and become the Tank King'] },
  assassin: { can: ['Move unseen (stealth)', '+20% critical damage from behind', 'Strike fast with daggers'],
    goals: ['Take down lone strong monsters and bounties', 'Scout caves and far lands for others', 'Rise through the six ranks and become the Assassin King'] },
  healer: { can: ['Heal yourself and others (20% stronger heals)', 'Keep a group alive through long fights', 'Fight from behind the front line with a staff'],
    goals: ['Be the one every cave group needs', 'Keep the front line standing in boss and King fights', 'Rise through the six ranks and become the Healer King'] },
  blacksmith: { can: ['Forge weapons and armour from ore and coins (Blacksmith window, N)', 'Merge two items into a stronger one, and coat weapons', 'Use better metal to make stronger pieces; unlock a new rank at levels 20, 50, 100, 200 and 500'],
    goals: ['Arm the fighters: they depend on your weapons and armour', 'Reach Epic, then Legendary forging', 'Open a shop and become the Blacksmith King'] },
  businessman: { can: ['Sell to shops for far more (70% of the price, not 40%)', 'Own trading buildings and shops', 'Buy caves and post quests for them'],
    goals: ['Build a trading empire across the continents', 'Hire others through quests and guild work', 'Become the Businessman King'] },
  builder: { can: ['Build houses, shops and roads 30% faster with 20% less material', 'Raise ready buildings for far less than others pay', 'Clear and level land cheaply'],
    goals: ['Build homes and shops for other players', 'Build towns, roads and one day a castle for a nation', 'Become the Builder King'] },
  potion_maker: { can: ['Brew potions and elixirs from herbs (Potion-Maker window)', 'Make elixirs no shop sells', 'Make coatings that poison, burn or freeze'],
    goals: ['Keep every fighter supplied with potions', 'Brew the rare elixirs only you can make', 'Become the Potion Maker King'] },
  farmer: { can: ['Grow crops and raise animals', 'Make food that removes 50% more Fatigue', 'Gather herbs and plants for Potion Makers'],
    goals: ['Feed the realm: every class needs food to heal and rest', 'Own a big farm with fields and animals', 'Become the Farmer King'] },
};

// Shown only in the designer gallery. Players never see the next form's name.
export const EVOLUTIONS = {
  goblin:    ['Goblin', 'Hobgoblin', 'Goblin Chieftain', 'Goblin Lord', 'Ogre Lord', 'Goblin Emperor'],
  slime:     ['Slime', 'Greater Slime', 'Elemental Slime', 'Slime Lord', 'Primordial Slime', 'Devourer Slime'],
  fairy:     ['Fairy', 'High Fairy', 'Fae Knight', 'Fae Noble', 'Fae Monarch', 'Spirit of the Wild'],
  lizardman: ['Lizardman', 'Lizard Warrior', 'Dragon Lizard', 'Lizard Lord', 'Wyrm Lord', 'Dragonborn Lord'],
  naga:      ['Naga', 'Serpent Naga', 'Naga Priest', 'Naga Lord', 'Abyss Naga', 'Leviathan'],
  dragonewt: ['Dragonewt', 'Drake Knight', 'Dragon Knight', 'Lesser Dragon', 'True Dragon', 'Ancient Dragon'],
};
export const EVOLUTION_LEVELS = [1, 20, 50, 100, 200, 500];

export const ADVANCEMENTS = {
  mage:        ['Mage', 'Battle Mage', 'Archmage', 'Sage', 'Grand Sage', 'Arcane Sovereign'],
  swordsman:   ['Swordsman', 'Knight', 'Sword Master', 'Blade Saint', 'Sword Emperor', 'Sword Sovereign'],
  tank:        ['Tank', 'Guardian', 'Iron Wall', 'Fortress', 'Bastion Lord', 'Unbreakable'],
  assassin:    ['Assassin', 'Shadow', 'Nightblade', 'Phantom', 'Reaper', "Death's Shadow"],
  healer:      ['Healer', 'Cleric', 'High Priest', 'Saint', 'Archsaint', 'Hand of Life'],
  blacksmith:  ['Blacksmith', 'Smith', 'Master Smith', 'Runesmith', 'Grand Artisan', 'Legendary Forger'],
  businessman: ['Businessman', 'Merchant', 'Trader', 'Guild Master', 'Tycoon', 'Merchant Sovereign'],
  builder:     ['Builder', 'Mason', 'Architect', 'Master Architect', 'City Builder', 'World Builder'],
  potion_maker: ['Potion Maker', 'Apothecary', 'Alchemist', 'Master Alchemist', 'Grand Alchemist', 'Elixir Sovereign'],
  farmer:      ['Farmer', 'Rancher', 'Harvest Master', 'Land Steward', 'Grand Steward', 'Lord of Harvest'],
  child:       ['Child', 'Child', 'Child', 'Child', 'Child', 'Child'],
};

export const CLASS_ELEMENT = { assassin: 'Dark', healer: 'Light', blacksmith: 'Fire', builder: 'Earth', farmer: 'Nature', potion_maker: 'Water' };
export const ELEMENTS = ['Fire', 'Water', 'Earth', 'Wind', 'Lightning', 'Nature', 'Light', 'Dark'];

// Unique Skills live in unique.mjs
export { UNIQUE_SKILLS } from './unique.mjs';

export const SECOND_ELEMENT_CHANCE = { default: 0.2, mage: 0.35 };

// Calculated stats (rulebook: Stats → Calculated stats)
// Stat Points can also go straight into a combat stat: each point gives this much
export const TRAINED = { atk: 3, def: 2, matk: 3, mdef: 2, hp: 6 };
export function derivedStats(s, level = 1, t = {}) {
  const d = {
    // grows with Stamina, Strength and level (death is final, so there's a good amount of it)
    hp: Math.round(50 + s.sta * 10 + s.str * 2 + level * 5),
    sp: Math.round(10 + s.int * 2 + level),
    atk: Math.round(s.str * 2 + s.dex * 0.5),
    matk: Math.round(s.int * 2 + s.dex * 0.5),
    def: Math.round(s.sta * 0.8 + s.str * 0.2),
    mdef: Math.round(s.int + s.sta * 0.5),
  };
  for (const k of Object.keys(TRAINED)) d[k] += (t[k] || 0) * TRAINED[k];
  return d;
}

// Resting (standing still, or sleeping) only heals you up to a share of your HP; past that you need
// food, drink, potions or a healing skill. Low levels rely on food most; the cap rises with level.
export const restCap = (level, sleeping = false) => Math.min(sleeping ? 0.9 : 0.7, 0.35 + (level || 1) * 0.0035 + (sleeping ? 0.2 : 0));

export function startingStats(raceId, classId) {
  const base = RACES[raceId].stats;
  const bonus = CLASSES[classId].bonus;
  const out = {};
  for (const k of MAIN_STATS) out[k] = base[k] + (bonus[k] || 0);
  return out;
}

export function rankFor(level) {
  const ranks = [[1001, 'Overlord'], [700, 'Sovereign'], [500, 'Mythic'], [300, 'Legend'], [200, 'Hero'],
    [150, 'Champion'], [100, 'Elite'], [50, 'Veteran'], [20, 'Adept'], [10, 'Apprentice'], [1, 'Wanderer']];
  return ranks.find(([min]) => level >= min)[1];
}

// EXP needed to go from `level` to `level + 1` (rulebook: Levelling → EXP formulas)
export const KEY_LEVELS = [20, 50, 100, 150, 200, 300, 400, 500, 700, 1000];
const roundNice = (x) => {
  const m = 10 ** Math.max(String(Math.floor(x)).length - 2, 0);
  return Math.round(x / m) * m;
};
function normalExp(level) {
  return level < 20 ? 30 + 18 * (level - 1) : roundNice(600 * (level / 20) ** 1.8);
}
export function expToNext(level, raceId) {
  let need = normalExp(level);
  if (KEY_LEVELS.includes(level + 1)) need = level < 20 ? 600 : roundNice(2.5 * need);
  return Math.round(need * (RACES[raceId]?.expMult || 1));
}
// EXP for beating a wild monster, on average (each kill gives between half and one and a half
// times this). Monsters give more every couple of levels (every 2 levels up to 20, every 3 after),
// so that about 15 monsters of your own level take you up a level at the start, rising slowly to
// about 40 by level 500. A level 1 monster gives 1 to 3. An evolved one gives a tenth more for
// each evolution.
export function killExp(level, stage = 0) {
  const band = level < 20 ? level - ((level - 1) % 2) : level - ((level - 20) % 3);
  return Math.max(2, normalExp(band) / (15 + band / 20)) * (1 + 0.1 * (stage || 0));
}
export const rollKillExp = (level, stage = 0, rnd = Math.random) => Math.max(1, Math.round(killExp(level, stage) * (0.5 + rnd())));
// Monsters far below you teach you little: from 5 levels under you, a tenth less for each level
// more, down to a fifth
export const killExpScale = (gap) => (gap <= 5 ? 1 : Math.max(0.2, 1 - (gap - 5) * 0.1));

// Appearance options offered at creation. Colours are hex strings.
export const APPEARANCE = {
  elf:       { skin: ['#c9b48a', '#9fb38a', '#b7a6c9', '#d9c7a8'], accent: ['#e8e2c8', '#3b2a1e', '#7fbf6a', '#c0c8d8'], eyes: ['#7fe0a8', '#8fc7ff', '#f2d16b', '#c58cff'] },
  dwarf:     { skin: ['#8e8a84', '#a08670', '#6f7a80', '#b09a7a'], accent: ['#b5562a', '#2b2622', '#d8d2c4', '#a77b3a'], eyes: ['#5fb0ff', '#ffb347', '#8fe07f', '#e0e0e0'] },
  hobbit:    { skin: ['#c99b6d', '#a7764f', '#d8b48a', '#8a6a4a'], accent: ['#6b3f1f', '#2f2018', '#c78a3a', '#9a5a2a'], eyes: ['#5a8f4a', '#4a6fa5', '#8a5a2a', '#3a3a3a'] },
  giant:     { skin: ['#8f8778', '#7d8a8f', '#9a7f6a', '#6f7a64'], accent: ['#e8e0cc', '#4a3a2a', '#9aa3a8', '#c9b98f'], eyes: ['#ffd36b', '#8fd3ff', '#ff8f6b', '#d0d0d0'] },
  beastkin:  { skin: ['#7a5a3a', '#9a9a9a', '#c08a4a', '#3a3530'], accent: ['#efe6d6', '#2a2522', '#d8b07a', '#6a6a6a'], eyes: ['#ffcf3f', '#7fd0ff', '#9fe07f', '#ff7f4f'] },
  goblin:    { skin: ['#5f7a36', '#5a7f3a', '#8aa35a', '#4f6f5a'], accent: ['#3a2a1e', '#8a3a2a', '#c9b98f', '#2a2a3a'], eyes: ['#ffd23f', '#ff5f3f', '#9fff7f', '#ffffff'] },
  slime:     { skin: ['#4fb3ff', '#5fe0a0', '#c07fff', '#ff7fae'], accent: ['#dff4ff', '#e6fff2', '#f2e6ff', '#ffe6f0'], eyes: ['#ffffff', '#1a1a2a', '#ffe14f', '#ff4f4f'] },
  fairy:     { skin: ['#f4dcc8', '#c8e8d8', '#dcd0f4', '#f4e8b8'], accent: ['#9fe8ff', '#ffb8f0', '#b8ffb0', '#ffe08a'], eyes: ['#5ff0ff', '#ff7fe0', '#7fff8f', '#ffd24f'] },
  lizardman: { skin: ['#4f7a4a', '#3f6a7a', '#8a7a3a', '#6a4a3a'], accent: ['#d8c88a', '#c8d8a8', '#e0b07a', '#a8c0c8'], eyes: ['#ffcf3f', '#ff6f3f', '#bfff5f', '#5fdfff'] },
  naga:      { skin: ['#2f6f6a', '#5a3f7a', '#7a6a2f', '#2f4f7a'], accent: ['#e8d8a8', '#c8a8e8', '#f0c060', '#a8e0e8'], eyes: ['#ffd700', '#7fff7f', '#ff5fbf', '#5fdfff'] },
  dragonewt: { skin: ['#9a2f2a', '#2f4f8a', '#3a3a3a', '#7a5a1a'], accent: ['#f0c060', '#c8d0e0', '#e05a2a', '#a0e0b0'], eyes: ['#ffb000', '#5fdfff', '#ff3f3f', '#e0ff5f'] },
};

// ---------- new characters (used by the server, and by the browser in preview mode) ----------

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function rollElements(raceId, classId) {
  const elements = [RACES[raceId].element];
  const classElement = CLASS_ELEMENT[classId];
  if (classElement && !elements.includes(classElement)) elements.push(classElement);
  const chance = SECOND_ELEMENT_CHANCE[classId] ?? SECOND_ELEMENT_CHANCE.default;
  if (Math.random() < chance) elements.push(pick(ELEMENTS.filter((e) => !elements.includes(e))));
  return elements;
}

export function cleanLook(raceId, look = {}) {
  const pal = APPEARANCE[raceId];
  const out = {};
  for (const key of ['skin', 'accent', 'eyes']) {
    const v = String(look[key] || '').toLowerCase();
    out[key] = pal[key].includes(v) ? v : pal[key][0];
  }
  const size = Number(look.size);
  out.size = Number.isFinite(size) ? Math.min(1.1, Math.max(0.9, Math.round(size * 100) / 100)) : 1;
  return out;
}

// Monster players can switch between their monster form and a humanoid form from level 100
export const FORM_SWITCH_LEVEL = 100;
export const mayChangeForm = (c) => c.side === 'monster' && (c.level || 1) >= FORM_SWITCH_LEVEL;

// Death is final. What a fallen character passes on: their Unique Skill (its power follows the new
// character's level, so it is held back again until they evolve), a count of the lives lived so far,
// and what their soul carries: one who served the Dark Side dies a sinner and starts the next life
// weaker; one sworn to the Light starts it stronger.
export const PAST_LIFE_STATS = 2; // taken from (sinner) or added to (blessed) every main stat
export const pastLifeOf = (c) => (c.pact === 'dark' ? 'sinner' : c.pact === 'holy' ? 'blessed' : null);
export const fallenKeep = (c) => ({ uniqueSkill: { name: c.uniqueSkill?.name, rank: c.uniqueSkill?.rank }, lives: (c.lives || 1) + 1, soul: pastLifeOf(c), fell: new Date().toISOString() });
export function rebornWith(character, keep) {
  const skill = uniqueByName(keep?.uniqueSkill?.name);
  // Appraisal is kept only while nobody else has been given it (the server checks)
  if (skill && !(skill.kind === 'appraise' && keep?.appraisalGone)) character.uniqueSkill = uniqueSlot({ ...skill, rank: keep.uniqueSkill.rank });
  character.lives = Math.max(2, Number(keep?.lives) || 2);
  const soul = keep?.soul === 'sinner' ? -1 : keep?.soul === 'blessed' ? 1 : 0;
  if (soul) {
    for (const k of MAIN_STATS) character.stats[k] = Math.max(1, character.stats[k] + soul * PAST_LIFE_STATS);
    character.soul = keep.soul;
  }
  return character;
}

// Returns { character } or { error }.
export function newCharacter(name, { side, race: raceId, cls: classId, form, look }, { takenUniques, held, appraisal } = {}) {
  const race = RACES[raceId];
  if (!race) return { error: 'Please choose a race.' };
  if (!CLASSES[classId]) return { error: 'Please choose a class.' };
  if (CLASSES[classId].dark || (CLASSES[classId].hidden && classId !== 'child')) return { error: 'That class can\'t be chosen.' };
  if (side && side !== race.side) return { error: 'That race is not on the side you chose.' };
  return {
    character: {
      name,
      side: race.side,
      race: raceId,
      cls: classId,
      form: race.side === 'monster' ? (form === 'humanoid' ? 'humanoid' : 'monster') : 'humanoid',
      look: cleanLook(raceId, look),
      level: 1,
      exp: 0,
      stage: 0,
      stats: startingStats(raceId, classId),
      unspentPoints: 0,
      uniquePoints: 0,
      fatigue: 0,
      coins: 100,
      titles: [],
      elements: rollElements(raceId, classId),
      // one nobody else holds, while there are any left (the server says which are taken)
      uniqueSkill: uniqueSlot(pickUnique(takenUniques, Math.random, { held, appraisal })),
      skills: [],
      // A new character starts at a random safe zone (waystone) on their home continent
      location: startLocation(race.home),
      hp: null, // current HP; null means full
      inventory: [...(STARTER_ITEMS[classId] || []), ['bread', 3], ['water_flask', 3], ['herbal_tea', 2]].map(([id, n]) => ({ id, n })),
      equipped: { weapon: null },
      createdAt: new Date().toISOString(),
    },
  };
}

// The Ceremony of Revealing: a child of 7 becomes `cls`. The class's bonus points are added, its
// element (and maybe another) joins the race's, and its starting kit is handed over.
export function growUp(c, cls) {
  if (c.cls !== 'child' || !CLASSES[cls] || CLASSES[cls].hidden) return false;
  for (const [k, v] of Object.entries(CLASSES[cls].bonus)) c.stats[k] = (c.stats[k] || 0) + v;
  c.cls = cls;
  for (const e of rollElements(c.race, cls)) if (!c.elements.includes(e)) c.elements.push(e);
  for (const [id, n] of STARTER_ITEMS[cls] || []) {
    const have = c.inventory.find((x) => x.id === id && !x.uid);
    if (have) have.n += n; else c.inventory.push({ id, n });
  }
  if (c.child?.family) c.family = c.child.family;
  c.grown = { cls, at: new Date().toISOString(), school: c.child?.school || null };
  delete c.child;
  return true;
}

export function startLocation(homeName) {
  // Player races start in the Central City; monster races at a spawn point in their homeland
  const home = homePlace(homeName);
  const choices = home.id === 'central' ? [home] : PLACES.filter((p) => p.region === home.region && !p.village && !p.city);
  const place = choices[Math.floor(Math.random() * choices.length)] || home;
  const { x, z } = toWorld(place.px, place.py);
  return { area: place.name, x, y: 0, z: z + 6, heading: Math.PI };
}

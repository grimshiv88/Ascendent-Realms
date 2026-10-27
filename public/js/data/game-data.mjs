// Game rules shared by the browser and the server. Numbers come from the rulebook.
import { homePlace, toWorld } from './world-layout.mjs';
import { STARTER_ITEMS } from './items.mjs';

export const MAIN_STATS = ['str', 'agi', 'dex', 'sta', 'int'];
export const STAT_NAMES = { str: 'Strength', agi: 'Agility', dex: 'Dexterity', sta: 'Stamina', int: 'Intelligence' };

// Every race totals 50 base points.
export const RACES = {
  // Player races
  elf:       { side: 'player',  name: 'Elf',       stats: { str: 7,  agi: 12, dex: 12, sta: 7,  int: 12 }, element: 'Wind',      expMult: 1.0,
               home: 'Central forest', blurb: 'Tall and graceful forest folk with long ears and bark-patterned skin. Quick, precise and gifted with magic.' },
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
  mage:        { name: 'Mage',        bonus: { int: 6, dex: 4 },         main: 'int', blurb: 'Spells cost 10% less SP.' },
  swordsman:   { name: 'Swordsman',   bonus: { str: 5, dex: 3, agi: 2 }, main: 'str', blurb: '+10% ATK with swords.' },
  tank:        { name: 'Tank',        bonus: { sta: 7, str: 3 },         main: 'sta', blurb: 'Taunts enemies. +15% DEF with shields.' },
  assassin:    { name: 'Assassin',    bonus: { agi: 6, dex: 4 },         main: 'agi', blurb: 'Stealth. +20% critical damage from behind.' },
  healer:      { name: 'Healer',      bonus: { int: 6, sta: 4 },         main: 'int', blurb: 'Healing spells are 20% stronger.' },
  blacksmith:  { name: 'Blacksmith',  bonus: { str: 4, sta: 4, dex: 2 }, main: 'str', blurb: 'Crafts and upgrades items 25% cheaper, and can open a shop.' },
  businessman: { name: 'Businessman', bonus: { int: 7, agi: 3 },         main: 'int', blurb: 'Can own trading buildings. +10% coins from sales and quests.' },
  builder:     { name: 'Builder',     bonus: { str: 4, sta: 4, int: 2 }, main: 'sta', blurb: 'Builds 30% faster with 20% less material.' },
  farmer:      { name: 'Farmer',      bonus: { sta: 6, str: 4 },         main: 'sta', blurb: 'Grows crops and raises animals. Food made removes 50% more Fatigue.' },
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
  farmer:      ['Farmer', 'Rancher', 'Harvest Master', 'Land Steward', 'Grand Steward', 'Lord of Harvest'],
};

export const CLASS_ELEMENT = { assassin: 'Dark', healer: 'Light', blacksmith: 'Fire', builder: 'Earth', farmer: 'Nature' };
export const ELEMENTS = ['Fire', 'Water', 'Earth', 'Wind', 'Lightning', 'Nature', 'Light', 'Dark'];

export const UNIQUE_SKILLS = [
  { name: 'Predator', text: 'Absorb a defeated monster to copy one of its skills.', sealed: 'Only monsters 10+ levels below you, once a day.' },
  { name: 'Shadow Legion', text: 'Raise defeated enemies as shadow soldiers.', sealed: '1 soldier, lasting 30 seconds.' },
  { name: 'Midas Touch', text: 'Anything you sell is worth more.', sealed: '+5% sale price.' },
  { name: 'Dragon Heart', text: 'When HP drops below 30%, all stats rise.', sealed: '+5% for 10 seconds, once an hour.' },
  { name: 'Time Step', text: 'Freeze time for everyone else.', sealed: '0.5 seconds, once a day.' },
  { name: 'Iron Will', text: 'Refuse to fall: survive a killing blow with 1 HP.', sealed: 'Once every 6 hours.' },
  { name: 'Storm Caller', text: 'Summon a storm of your strongest element.', sealed: 'A small cloud, 5 metres wide.' },
  { name: 'Mimic', text: 'Copy the look and voice of another character.', sealed: '10 seconds, cannot copy higher levels.' },
  { name: 'Golden Harvest', text: 'Everything you gather or grow yields far more.', sealed: '+10% yield.' },
  { name: 'Wild Bond', text: 'Speak with and command wild creatures.', sealed: 'One small creature at a time.' },
  { name: 'All-Seeing Eye', text: 'See hidden things: traps, stealth, weak points.', sealed: '10 metres, 5 seconds.' },
  { name: 'Blink', text: 'Teleport to any point you can see.', sealed: '5 metres, once a minute.' },
];

export const SECOND_ELEMENT_CHANCE = { default: 0.2, mage: 0.35 };

// Calculated stats (rulebook: Stats → Calculated stats)
export function derivedStats(s, level = 1) {
  return {
    hp: 50 + s.sta * 10 + s.str * 2 + level * 5,
    sp: 20 + s.int * 5 + level * 2,
    atk: Math.round(s.str * 2 + s.dex * 0.5),
    matk: Math.round(s.int * 2 + s.dex * 0.5),
    def: Math.round(s.sta * 1.5 + s.str * 0.5),
    mdef: Math.round(s.int + s.sta * 0.5),
  };
}

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
  return level < 20 ? 20 + 8 * (level - 1) : roundNice(400 * (level / 20) ** 1.8);
}
export function expToNext(level, raceId) {
  let need = normalExp(level);
  if (KEY_LEVELS.includes(level + 1)) need = level < 20 ? 400 : roundNice(2.5 * need);
  return Math.round(need * (RACES[raceId]?.expMult || 1));
}

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

function rollElements(raceId, classId) {
  const elements = [RACES[raceId].element];
  const classElement = CLASS_ELEMENT[classId];
  if (classElement && !elements.includes(classElement)) elements.push(classElement);
  const chance = SECOND_ELEMENT_CHANCE[classId] ?? SECOND_ELEMENT_CHANCE.default;
  if (Math.random() < chance) elements.push(pick(ELEMENTS.filter((e) => !elements.includes(e))));
  return elements;
}

function cleanLook(raceId, look = {}) {
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

// Returns { character } or { error }.
export function newCharacter(name, { side, race: raceId, cls: classId, form, look }) {
  const race = RACES[raceId];
  if (!race) return { error: 'Please choose a race.' };
  if (!CLASSES[classId]) return { error: 'Please choose a class.' };
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
      uniqueSkill: { ...pick(UNIQUE_SKILLS), sealsOpen: 0 },
      skills: [],
      // Player races start at the Central Forest spawn; monster races at their homeland's waystone.
      location: startLocation(race.home),
      hp: null, // current HP; null means full
      inventory: (STARTER_ITEMS[classId] || []).map(([id, n]) => ({ id, n })),
      equipped: { weapon: null },
      createdAt: new Date().toISOString(),
    },
  };
}

function startLocation(homeName) {
  const place = homePlace(homeName);
  const { x, z } = toWorld(place.px, place.py);
  return { area: place.name, x, y: 0, z: z + 6, heading: Math.PI };
}

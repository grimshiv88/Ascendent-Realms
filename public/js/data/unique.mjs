// Unique Skills, shared by the game and the server. Every character is born with one, given at
// random, and keeps it even when they die and start again. It is held back at first: each
// evolution lets a little more of it out, and at level 1000 it is Unbound, used to the full, far
// beyond any ordinary skill.
//
// A Unique Skill is one of a few kinds of power (a blow, a blast around you, a shot, a rush, a cure,
// a war cry, a ward, a freeze, a life-stealing bite), in an element. There are thousands of them
// (the handmade ones and every element word with every kind's name), and the server gives a new
// character one that nobody else holds while it can.

// What each kind of power does at each tier (0 = sealed, before the first evolution; 6 = Unbound at
// level 1000). It never costs SP; it rests (cd, seconds) between uses, less as it grows.
export const UNBOUND_LEVEL = 1000;
// the evolutions (game-data.mjs EVOLUTION_LEVELS, after the first at level 1)
const OPENS = [20, 50, 100, 200, 500];
export const TIERS = 7;
export const TIER_NAMES = ['Sealed', 'First Seal broken', 'Second Seal broken', 'Third Seal broken', 'Fourth Seal broken', 'Fifth Seal broken', 'Unbound'];
const CD = [150, 120, 100, 80, 60, 45, 12];
const KINDS = {
  strike: { type: 'strike', icon: '💥', mult: [1.6, 2.2, 3, 4, 5.5, 7, 30], what: (p) => `one blow for ${p.mult}× damage` },
  sweep: { type: 'sweep', icon: '🌀', mult: [1.1, 1.5, 2, 2.6, 3.4, 4.4, 18], radius: [3, 3.5, 4.5, 5.5, 7, 9, 25], what: (p) => `${p.mult}× damage to every foe within ${p.radius} m` },
  bolt: { type: 'bolt', icon: '☄️', mult: [1.4, 1.9, 2.6, 3.4, 4.6, 6, 26], reach: [12, 14, 17, 20, 24, 30, 60], what: (p) => `a shot for ${p.mult}× damage up to ${p.reach} m away` },
  dash: { type: 'dash', icon: '⚡', mult: [1.4, 1.9, 2.6, 3.4, 4.6, 6, 24], dist: [6, 7, 9, 11, 13, 16, 40], what: (p) => `rush ${p.dist} m and strike for ${p.mult}× damage` },
  heal: { type: 'heal', icon: '✚', pct: [20, 30, 40, 50, 65, 80, 100], what: (p) => `restore ${p.pct}% of your HP` },
  fury: { type: 'buff', stat: 'atk', icon: '🔥', pct: [15, 25, 35, 50, 70, 90, 400], secs: [8, 10, 12, 15, 18, 22, 60], what: (p) => `+${p.pct}% ATK for ${p.secs} s` },
  ward: { type: 'buff', stat: 'def', icon: '🛡️', pct: [25, 40, 55, 75, 100, 130, 600], secs: [8, 10, 12, 15, 18, 22, 60], what: (p) => `+${p.pct}% DEF for ${p.secs} s` },
  freeze: { type: 'sweep', icon: '❄️', mult: [0.6, 0.8, 1, 1.3, 1.7, 2.2, 10], radius: [3, 4, 5, 6, 8, 10, 30], hold: [2, 3, 4, 5, 6, 8, 20], what: (p) => `${p.mult}× damage within ${p.radius} m, and every foe hit is slowed for ${p.hold} s` },
  devour: { type: 'strike', icon: '🦷', mult: [1.3, 1.8, 2.4, 3.2, 4.2, 5.5, 24], drain: [0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 1], what: (p) => `one blow for ${p.mult}× damage that heals you by ${Math.round(p.drain * 100)}% of it` },
};
export const UNIQUE_KINDS = Object.keys(KINDS);

// The handmade ones
const MADE = [
  ['Predator', 'devour', 'Dark', 'Devour your prey and take its life for your own.'],
  ['Shadow Legion', 'sweep', 'Dark', 'Shadows rise around you and tear at every foe.'],
  ['Midas Touch', 'bolt', 'Light', 'A shard of living gold, thrown with a king\'s weight.'],
  ['Dragon Heart', 'fury', 'Fire', 'A dragon\'s heart beats in you and your strength soars.'],
  ['Time Step', 'freeze', 'Lightning', 'Time stutters for everyone but you.'],
  ['Iron Will', 'ward', 'Earth', 'You refuse to break.'],
  ['Storm Caller', 'sweep', 'Lightning', 'Call down a storm on everything around you.'],
  ['Mimic', 'strike', 'Wind', 'Strike back with the very blow your foe would have used.'],
  ['Golden Harvest', 'heal', 'Nature', 'The land itself gives you its strength.'],
  ['Wild Bond', 'dash', 'Nature', 'Run with the beasts and strike as they do.'],
  ['All-Seeing Eye', 'bolt', 'Light', 'See the weak point, and pierce it from afar.'],
  ['Blink', 'dash', 'Wind', 'Vanish, and strike from where nobody looked.'],
];

// The rest: every element word with every kind's name
const WORDS = {
  Fire: ['Ember', 'Inferno', 'Cinder', 'Phoenix', 'Blaze', 'Molten', 'Pyre', 'Scorch', 'Ashen', 'Solar Flame'],
  Water: ['Tidal', 'Abyssal', 'Rain', 'Frost', 'Glacier', 'Mist', 'Deluge', 'Coral', 'Riptide', 'Leviathan'],
  Earth: ['Stone', 'Granite', 'Quake', 'Iron', 'Obsidian', 'Mountain', 'Titan', 'Crystal', 'Bedrock', 'Golem'],
  Wind: ['Gale', 'Tempest', 'Zephyr', 'Cyclone', 'Sky', 'Falcon', 'Whisper', 'Squall', 'Feather', 'Vortex'],
  Lightning: ['Thunder', 'Storm', 'Volt', 'Spark', 'Arc', 'Static', 'Skyfire', 'Bolt', 'Plasma', 'Thunderbird'],
  Nature: ['Thorn', 'Verdant', 'Wildwood', 'Bloom', 'Elder Oak', 'Briar', 'Moss', 'Beast', 'Spore', 'Ivy'],
  Light: ['Radiant', 'Dawn', 'Halo', 'Sun', 'Seraph', 'Gleam', 'Prism', 'Star', 'Aurora', 'Holy'],
  Dark: ['Shadow', 'Night', 'Void', 'Eclipse', 'Grave', 'Umbral', 'Abyss', 'Raven', 'Dusk', 'Wraith'],
};
const NOUNS = {
  strike: ['Fist', 'Cleave', 'Edge', 'Hammer', 'Fang', 'Talon', 'Smite'],
  sweep: ['Tempest', 'Nova', 'Maelstrom', 'Cataclysm', 'Whirl', 'Eruption', 'Ring'],
  bolt: ['Lance', 'Spear', 'Arrow', 'Comet', 'Javelin', 'Ray', 'Shard'],
  dash: ['Step', 'Rush', 'Charge', 'Flash', 'Stride', 'Pounce', 'Leap'],
  heal: ['Renewal', 'Blessing', 'Mending', 'Rebirth', 'Spring', 'Grace', 'Bloom'],
  fury: ['Heart', 'Rage', 'Wrath', 'Roar', 'Frenzy', 'Fervor', 'Ascension'],
  ward: ['Aegis', 'Bulwark', 'Mantle', 'Carapace', 'Bastion', 'Veil', 'Fortress'],
  freeze: ['Stasis', 'Prison', 'Shackles', 'Stillness', 'Binding', 'Tomb', 'Chains'],
  devour: ['Maw', 'Hunger', 'Feast', 'Bite', 'Devourer', 'Thirst', 'Harvest'],
};
const KIND_TEXT = {
  strike: 'A single blow carrying', sweep: 'A blast of', bolt: 'A shot of', dash: 'A rush of', heal: 'A healing surge of',
  fury: 'A fury of', ward: 'A shell of', freeze: 'A binding of', devour: 'A hungry strike of',
};

export const UNIQUE_SKILLS = [];
const BY_NAME = new Map();
function add(name, kind, element, text) {
  const u = { name, kind, element, text };
  UNIQUE_SKILLS.push(u); BY_NAME.set(name.toLowerCase(), u);
}
for (const [name, kind, element, text] of MADE) add(name, kind, element, text);
for (const [element, words] of Object.entries(WORDS)) {
  for (const word of words) {
    for (const [kind, nouns] of Object.entries(NOUNS)) {
      for (const noun of nouns) {
        const name = `${word} ${noun}`;
        if (!BY_NAME.has(name.toLowerCase()) && word !== noun) add(name, kind, element, `${KIND_TEXT[kind]} ${element.toLowerCase()}.`);
      }
    }
  }
}
export const UNIQUE_COUNT = UNIQUE_SKILLS.length;
export const uniqueByName = (name) => BY_NAME.get(String(name || '').toLowerCase()) || null;

// Pick one at random, leaving out names already held (by anyone) while any are left
export function pickUnique(taken = new Set(), rnd = Math.random) {
  const lower = new Set([...taken].map((n) => String(n).toLowerCase()));
  const free = lower.size ? UNIQUE_SKILLS.filter((u) => !lower.has(u.name.toLowerCase())) : UNIQUE_SKILLS;
  const pool = free.length ? free : UNIQUE_SKILLS;
  return pool[Math.floor(rnd() * pool.length)];
}
// What a character keeps of it: its name (everything else comes from this file)
export const uniqueSlot = (u) => ({ name: u.name, kind: u.kind, element: u.element, text: u.text });

// How far it has been let out: one tier for each evolution (20, 50, 100, 200, 500), and the last,
// Unbound, at level 1000
export function uniqueTier(level = 1) {
  if (level >= UNBOUND_LEVEL) return TIERS - 1;
  return OPENS.filter((l) => level >= l).length;
}
export const nextTierLevel = (level = 1) => (level >= UNBOUND_LEVEL ? null : [...OPENS, UNBOUND_LEVEL].find((l) => l > level));

const ELEMENT_EFFECT = { Fire: 'burn', Dark: 'poison', Nature: 'poison', Water: 'frost' };
// The skill as the world uses it (the same shape as data/skills.mjs skills), at this character's tier
export function uniqueAbility(c) {
  const u = uniqueByName(c?.uniqueSkill?.name) || UNIQUE_SKILLS[0];
  const k = KINDS[u.kind];
  const t = uniqueTier(c?.level || 1);
  const at = (arr) => (Array.isArray(arr) ? arr[t] : arr);
  const sk = {
    id: 'unique', unique: true, name: u.name, kind: u.kind, element: u.element, icon: k.icon, type: k.type, sp: 0, cd: CD[t], tier: t,
    mult: at(k.mult), radius: at(k.radius), reach: at(k.reach), dist: at(k.dist), pct: at(k.pct), secs: at(k.secs), stat: k.stat,
    hold: at(k.hold), drain: at(k.drain), effect: ELEMENT_EFFECT[u.element] || null,
  };
  sk.text = `${u.text} Now: ${k.what(sk)}. Rests ${sk.cd} s.`;
  return sk;
}

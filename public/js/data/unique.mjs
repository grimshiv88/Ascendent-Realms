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
// each kind of power in plain words (for lists and filters)
export const UNIQUE_KIND_NAMES = { strike: 'Blow', sweep: 'Blast around you', bolt: 'Shot', dash: 'Rush', heal: 'Cure', fury: 'War cry (+ATK)', ward: 'Ward (+DEF)', freeze: 'Freeze', devour: 'Life-stealing bite', appraise: 'Appraisal' };

// ---------- ranks ----------
// Every Unique Skill is born with a rank, from F up to SSS (the same letters as skills and spells). The higher the rank, the stronger it hits
// and the sooner it is ready again, and the rarer it is: A comes to about 1 in 100, S to 1 in 1000,
// and only a handful of people in the whole world can ever hold SS or SSS at once.
export const UNIQUE_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
export const RANK_POWER = { F: 0.65, E: 0.72, D: 0.8, C: 0.9, B: 1, A: 1.2, S: 1.45, SS: 1.75, SSS: 2.1 };
// chance of each top rank (the rest share F, E, D, C and B), and how many may hold SS and SSS at once
const TOP_ODDS = [['SSS', 0.00002], ['SS', 0.0001], ['S', 0.001], ['A', 0.01]];
export const RANK_CAP = { SS: 10, SSS: 3 };
// `held` counts the ranks already held, e.g. { SS: 2, SSS: 0 }
export function rollRank(held = {}, rnd = Math.random) {
  let r = rnd();
  for (const [rank, p] of TOP_ODDS) {
    if (r < p && (RANK_CAP[rank] == null || (held[rank] || 0) < RANK_CAP[rank])) return rank;
    r -= p;
  }
  const low = rnd();
  return low < 0.12 ? 'F' : low < 0.3 ? 'E' : low < 0.55 ? 'D' : low < 0.8 ? 'C' : 'B';
}
export const rankOf = (u) => (UNIQUE_RANKS.includes(u?.rank) ? u.rank : 'C');

// ---------- raising the rank ----------
// A Unique Skill can climb at most two ranks above the one it was born with. Each climb needs one
// proof of growth, from any of these:
//   - breaking seals: the Second Seal, then the Fourth (one proof each)
//   - Rank Trials: guild requests finished at level 150 or above (every 3 is one proof)
//   - honest work: merging, forging, brewing, selling and finishing quests (every 1000 work is one proof)
// SS and SSS still have their world limits: if those are full, the climb waits for a free place.
export const RANK_UP_MAX = 2;
export const TRIAL_LEVEL = 150;
export const TRIALS_PER_PROOF = 3;
export const WORK_PER_PROOF = 1000;
export function rankProofs(c) {
  const t = uniqueTier(c?.level || 1);
  const g = c?.growth || {};
  const seals = (t >= 2 ? 1 : 0) + (t >= 4 ? 1 : 0);
  const trials = Math.floor((g.trials || 0) / TRIALS_PER_PROOF);
  const work = Math.floor((g.work || 0) / WORK_PER_PROOF);
  return { seals, trials, work, total: Math.min(RANK_UP_MAX, seals + trials + work) };
}
// the rank a skill reaches after `steps` climbs from the one it was born with
export const climbedRank = (born, steps) => UNIQUE_RANKS[Math.min(UNIQUE_RANKS.length - 1, UNIQUE_RANKS.indexOf(born) + steps)];

// The class each kind of power suits best (shown from birth, to help choose a school)
const KIND_FIT = { strike: 'swordsman', sweep: 'tank', bolt: 'mage', dash: 'assassin', heal: 'healer', fury: 'blacksmith', ward: 'tank', freeze: 'potion_maker', devour: 'assassin' };

// ---------- Appraisal ----------
// One of a kind: only one person in the world holds it. It sees the true worth of anything (items,
// weapons, buildings) and everything about a person, even whether they serve a cult or the Order of
// the Dawn. If its holder stays away for more than a month it leaves them for someone new, and they
// are given another Unique Skill instead.
export const APPRAISAL = { name: 'Appraisal', kind: 'appraise', element: 'Light', fit: 'businessman', rank: 'SSS',
  text: 'Eyes that see the truth of everything: the worth of any item, weapon or building, and all there is to know about a person, even the side they secretly serve.' };
export const APPRAISAL_CHANCE = 0.02;          // a newborn's chance of it while nobody holds it
export const APPRAISAL_AWAY_MS = 30 * 24 * 3600 * 1000;

// The handmade ones: [name, kind, element, text, the class it suits (else its kind's)]
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
  ['Master Forger', 'fury', 'Fire', 'The heat of the forge runs in your arms.', 'blacksmith'],
  ['Anvil Heart', 'ward', 'Earth', 'Struck a thousand times, never broken.', 'blacksmith'],
  ['Golden Tongue', 'ward', 'Light', 'Your words turn even blades aside.', 'businessman'],
  ['Merchant\'s Luck', 'dash', 'Wind', 'Always where the deal is, a step before anyone.', 'businessman'],
  ['Stonemason', 'ward', 'Earth', 'Stone obeys your hands, and shelters you.', 'builder'],
  ['Architect\'s Eye', 'bolt', 'Earth', 'You see where a thing will break, and strike there.', 'builder'],
  ['Alchemist\'s Breath', 'freeze', 'Water', 'A cloud of your own brew stops foes where they stand.', 'potion_maker'],
  ['Herb Whisperer', 'heal', 'Nature', 'Every leaf you touch gives up its cure.', 'potion_maker'],
  ['Green Thumb', 'heal', 'Nature', 'Life grows wherever you walk.', 'farmer'],
  ['Ox Strength', 'fury', 'Earth', 'The strength of a long day in the fields.', 'farmer'],
  ['Blade Saint', 'strike', 'Light', 'One cut, perfect and final.', 'swordsman'],
  ['Thousand Cuts', 'sweep', 'Wind', 'Your blade is everywhere at once.', 'swordsman'],
  ['Unbreakable Wall', 'ward', 'Earth', 'Nothing passes you.', 'tank'],
  ['Silent Death', 'dash', 'Dark', 'Nobody hears you come.', 'assassin'],
  ['Saint\'s Grace', 'heal', 'Light', 'A light that closes every wound.', 'healer'],
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
function add(name, kind, element, text, fit) {
  const u = { name, kind, element, text, fit: fit || KIND_FIT[kind] };
  UNIQUE_SKILLS.push(u); BY_NAME.set(name.toLowerCase(), u);
}
for (const [name, kind, element, text, fit] of MADE) add(name, kind, element, text, fit);
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
export const uniqueByName = (name) => (String(name || '').toLowerCase() === 'appraisal' ? APPRAISAL : BY_NAME.get(String(name || '').toLowerCase()) || null);

// Pick one at random, leaving out names already held (by anyone) while any are left.
// `opts.appraisal` says nobody holds Appraisal (so it may come up); `opts.held` counts the ranks held.
export function pickUnique(taken = new Set(), rnd = Math.random, opts = {}) {
  if (opts.appraisal && rnd() < APPRAISAL_CHANCE) return { ...APPRAISAL };
  const lower = new Set([...taken].map((n) => String(n).toLowerCase()));
  const free = lower.size ? UNIQUE_SKILLS.filter((u) => !lower.has(u.name.toLowerCase())) : UNIQUE_SKILLS;
  const pool = free.length ? free : UNIQUE_SKILLS;
  return { ...pool[Math.floor(rnd() * pool.length)], rank: rollRank(opts.held, rnd) };
}
// What a character keeps of it: its name and rank (everything else comes from this file)
export const uniqueSlot = (u) => ({ name: u.name, kind: u.kind, element: u.element, text: u.text, rank: u.kind === 'appraise' ? APPRAISAL.rank : rankOf(u), fit: u.fit });
export const isAppraisal = (c) => String(c?.uniqueSkill?.name || '').toLowerCase() === 'appraisal';

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
  const rank = u.kind === 'appraise' ? APPRAISAL.rank : rankOf(c?.uniqueSkill);
  const t = uniqueTier(c?.level || 1);
  // Appraisal isn't a blow: it opens the Appraisal window
  if (u.kind === 'appraise') {
    return { id: 'unique', unique: true, name: u.name, kind: u.kind, element: u.element, icon: '👁️', type: 'appraise', sp: 0, cd: 2, tier: t, rank, fit: u.fit,
      text: `${u.text} Use it to appraise what is around you, or anyone by name.` };
  }
  const k = KINDS[u.kind];
  const p = RANK_POWER[rank];
  const at = (arr) => (Array.isArray(arr) ? arr[t] : arr);
  const r1 = (v) => (v == null ? v : Math.round(v * 10) / 10);
  const sk = {
    id: 'unique', unique: true, name: u.name, kind: u.kind, element: u.element, icon: k.icon, type: k.type, sp: 0, cd: Math.round(CD[t] / Math.sqrt(p)), tier: t, rank, fit: u.fit,
    mult: r1(at(k.mult) && at(k.mult) * p), radius: at(k.radius), reach: at(k.reach), dist: at(k.dist), pct: at(k.pct) && Math.min(k.type === 'heal' ? 100 : Infinity, Math.round(at(k.pct) * p)), secs: at(k.secs), stat: k.stat,
    hold: at(k.hold), drain: at(k.drain), effect: ELEMENT_EFFECT[u.element] || null,
  };
  sk.text = `${u.text} Now: ${k.what(sk)}. Rests ${sk.cd} s.`;
  return sk;
}

// What Appraisal sees in a person: everything, even the secret side they serve (`side` is
// { cult, rank } / { order } / null, from the cults' records)
export const appraisalOf = (c, side = null) => ({
  name: c.name, race: c.race, side: c.side, cls: c.cls, level: c.level || 1, stage: c.stage || 0, stats: c.stats, elements: c.elements || [],
  coins: c.coins || 0, lives: c.lives || 1, child: c.child ? { family: c.child.family, school: c.child.school } : null,
  unique: { name: c.uniqueSkill?.name, rank: c.uniqueSkill?.kind === 'appraise' ? APPRAISAL.rank : rankOf(c.uniqueSkill) },
  allegiance: side,
});

// The kind of each Unique Skill power, in the same kinds as ordinary skills (data/skills.mjs
// SKILL_CATEGORIES, defence to attack)
export const UNIQUE_CATEGORY = { ward: 'defence', heal: 'healing', fury: 'support', appraise: 'support', freeze: 'control', dash: 'movement', strike: 'attack', sweep: 'attack', bolt: 'attack', devour: 'attack' };
// Sort Unique Skills from the highest rank to the weakest (SSS first, D last)
export const byRank = (a, b) => UNIQUE_RANKS.indexOf(rankOf(b)) - UNIQUE_RANKS.indexOf(rankOf(a));

// Skills learned at every 25th level (an upgrade), and from Skill Stones and schools. Each one costs SP and then needs a short rest (cooldown).
// type: strike (one foe in front), sweep (every foe around you), bolt (a foe further away, in front),
// dash (charge forward and hit what you reach), heal (restore part of your HP), buff (raise ATK or DEF
// for a while). mult multiplies your ATK (or MATK when magic).
// rank: how rare and strong a skill is, written as a band (basic, advanced, expert, master) that is
// turned into letter ranks F to SSS further down. Basic skills come easily; Advanced, Expert and Master skills
// are harder to get and only come once you have climbed far enough (see SKILL_RANKS).
// cls: the classes that are offered it first ('any' = a general skill everyone is offered often).
// The newer skills also carry: el (the element their effect is drawn in; 'Steel' for plain weapon
// work, 'Gold' for coin tricks), move (the body move, see world/skillmoves.js), effect (a chance of
// an EFFECTS id), stun (seconds a foe is pinned in place and can't strike; half as long on bosses),
// hold (seconds it is slowed to half speed), drain (the share of the damage healed back to you),
// and stat 'matk' for buffs to magic.
import { SKILL_DESC } from './descriptions.mjs';
import { EXTRA_SKILLS } from './skills-extra.mjs';
const EFFECT_WORDS = { burn: 'set it burning', poison: 'poison it', bleed: 'make it bleed', frost: 'slow it', drain: 'drain its life' };
const STAT_WORDS = { atk: 'ATK', def: 'DEF', matk: 'MATK' };
export const SKILLS = {
  power_strike: { name: 'Power Strike', icon: '💥', type: 'strike', mult: 2, sp: 8, cd: 4, text: 'One heavy blow: double damage.', rank: 'basic', cls: ['swordsman', 'blacksmith', 'businessman', 'any'] },
  whirlwind: { name: 'Whirlwind', icon: '🌀', type: 'sweep', mult: 1.3, radius: 3.5, sp: 14, cd: 8, text: 'Spin and hit every foe around you.', rank: 'advanced', cls: ['swordsman', 'assassin', 'any'] },
  charge: { name: 'Charge', icon: '🐗', type: 'dash', mult: 1.5, dist: 7, sp: 10, cd: 7, text: 'Rush forward and strike the first foe you meet.', rank: 'basic', cls: ['swordsman', 'tank', 'farmer', 'any'] },
  battle_cry: { name: 'Battle Cry', icon: '📯', type: 'buff', stat: 'atk', pct: 30, secs: 15, sp: 15, cd: 30, text: '+30% ATK for 15 seconds.', rank: 'basic', cls: ['swordsman', 'assassin', 'any'] },
  iron_skin: { name: 'Iron Skin', icon: '🛡️', type: 'buff', stat: 'def', pct: 50, secs: 15, sp: 15, cd: 30, text: '+50% DEF for 15 seconds.', rank: 'basic', cls: ['tank', 'blacksmith', 'builder', 'any'] },
  second_wind: { name: 'Second Wind', icon: '💨', type: 'heal', pct: 25, sp: 18, cd: 40, text: 'Catch your breath: restore 25% of your HP.', rank: 'basic', cls: ['healer', 'farmer', 'businessman', 'potion_maker', 'any'] },
  fire_bolt: { name: 'Fire Bolt', icon: '🔥', type: 'bolt', mult: 1.8, reach: 16, magic: true, sp: 10, cd: 3, text: 'Hurl fire at a foe up to 16 m away (MATK).', rank: 'basic', cls: ['mage', 'healer', 'potion_maker'] },
  frost_nova: { name: 'Frost Nova', icon: '❄️', type: 'sweep', mult: 1.4, radius: 5, magic: true, sp: 20, cd: 10, text: 'A burst of cold hits every foe within 5 m (MATK).', rank: 'advanced', cls: ['mage', 'potion_maker'] },
  arcane_lance: { name: 'Arcane Lance', icon: '🔮', type: 'bolt', mult: 2.6, reach: 22, magic: true, sp: 22, cd: 8, text: 'A spear of pure magic, up to 22 m (MATK).', rank: 'advanced', cls: ['mage'] },
  mend: { name: 'Mend', icon: '✚', type: 'heal', pct: 35, sp: 16, cd: 20, text: 'Restore 35% of your HP.', rank: 'basic', cls: ['mage', 'healer', 'potion_maker'] },
  blessing: { name: 'Blessing', icon: '✨', type: 'buff', stat: 'def', pct: 35, secs: 20, sp: 14, cd: 30, text: '+35% DEF for 20 seconds.', rank: 'basic', cls: ['healer'] },
  backstab: { name: 'Backstab', icon: '🗡️', type: 'strike', mult: 2.8, sp: 12, cd: 6, text: 'A precise strike for nearly triple damage.', rank: 'advanced', cls: ['assassin'] },
  shadow_step: { name: 'Shadow Step', icon: '🌑', type: 'dash', mult: 2, dist: 9, sp: 14, cd: 9, text: 'Vanish forward 9 m and strike.', rank: 'advanced', cls: ['assassin'] },
  shield_bash: { name: 'Shield Bash', icon: '🧱', type: 'strike', mult: 1.6, sp: 8, cd: 5, text: 'Slam a foe with your guard.', rank: 'basic', cls: ['tank'] },
  ground_slam: { name: 'Ground Slam', icon: '🪨', type: 'sweep', mult: 1.6, radius: 4, sp: 18, cd: 10, text: 'Pound the ground and hit everything within 4 m.', rank: 'advanced', cls: ['tank', 'blacksmith', 'builder'] },
  hammer_blow: { name: 'Hammer Blow', icon: '🔨', type: 'strike', mult: 2.3, sp: 10, cd: 5, text: 'A smith\'s crushing blow.', rank: 'basic', cls: ['blacksmith', 'builder'] },
  harvest_swing: { name: 'Harvest Swing', icon: '🌾', type: 'sweep', mult: 1.2, radius: 3, sp: 10, cd: 6, text: 'A wide scything sweep.', rank: 'basic', cls: ['farmer'] },
  hearty_meal: { name: 'Hearty Meal', icon: '🍖', type: 'heal', pct: 30, sp: 12, cd: 30, text: 'Eat well: restore 30% of your HP.', rank: 'basic', cls: ['farmer'] },
  coin_toss: { name: 'Gold Shot', icon: '🪙', type: 'bolt', mult: 1.5, reach: 14, sp: 8, cd: 4, text: 'Fling a weighted coin at a foe up to 14 m away.', rank: 'basic', cls: ['businessman'] },
  haggle: { name: 'Bribe the Odds', icon: '💰', type: 'buff', stat: 'atk', pct: 25, secs: 20, sp: 12, cd: 30, text: '+25% ATK for 20 seconds.', rank: 'basic', cls: ['businessman'] },
  quick_wall: { name: 'Quick Wall', icon: '🏗️', type: 'buff', stat: 'def', pct: 60, secs: 10, sp: 16, cd: 30, text: 'Throw up cover: +60% DEF for 10 seconds.', rank: 'basic', cls: ['builder'] },
};
// ---------- the wider book of skills ----------
// add(id, name, icon, rank, classes, el, move, numbers, about). The numbers line is written for you
// from the numbers (skillDetails), after the short `about`.
function add(id, name, icon, rank, cls, el, move, n, about) {
  SKILLS[id] = { name, icon, rank, cls, el, move, ...n, about };
}
// ATTACK: blows on one foe in front
add('quick_jab', 'Quick Jab', '👊', 'basic', ['any'], 'Steel', 'thrust', { type: 'strike', mult: 1.4, sp: 4, cd: 2 }, 'A fast, light hit.');
add('cleave', 'Cleave', '🪓', 'basic', ['swordsman', 'blacksmith'], 'Steel', 'overhead', { type: 'strike', mult: 1.7, sp: 7, cd: 4, effect: { id: 'bleed', chance: 0.3 } }, 'A deep downward cut.');
add('double_slash', 'Double Slash', '⚔️', 'basic', ['swordsman', 'assassin'], 'Steel', 'thrust', { type: 'strike', mult: 1.9, sp: 8, cd: 4 }, 'Two cuts so close they land as one.');
add('piercing_thrust', 'Piercing Thrust', '🔱', 'basic', ['swordsman', 'tank'], 'Steel', 'thrust', { type: 'strike', mult: 1.8, sp: 7, cd: 4, effect: { id: 'bleed', chance: 0.25 } }, 'Drive the point straight through a guard.');
add('heavy_smash', 'Heavy Smash', '🔨', 'basic', ['tank', 'blacksmith', 'builder'], 'Steel', 'hammer', { type: 'strike', mult: 2.1, sp: 10, cd: 6 }, 'Bring your whole weight down on one foe.');
add('venom_fang', 'Venom Fang', '🐍', 'basic', ['assassin', 'potion_maker'], 'Nature', 'thrust', { type: 'strike', mult: 1.6, sp: 7, cd: 4, effect: { id: 'poison', chance: 0.6 } }, 'A blade wet with venom.');
add('flame_blade', 'Flame Blade', '🔥', 'advanced', ['swordsman', 'mage'], 'Fire', 'overhead', { type: 'strike', mult: 2.4, sp: 14, cd: 6, effect: { id: 'burn', chance: 0.5 } }, 'Your weapon catches fire for one blow.');
add('frost_edge', 'Frost Edge', '🧊', 'advanced', ['swordsman', 'assassin'], 'Water', 'thrust', { type: 'strike', mult: 2.2, sp: 13, cd: 6, effect: { id: 'frost', chance: 0.6 } }, 'A cut so cold it numbs.');
add('thunder_strike', 'Thunder Strike', '⚡', 'advanced', ['swordsman', 'tank'], 'Lightning', 'overhead', { type: 'strike', mult: 2.6, sp: 15, cd: 7 }, 'Lightning follows your blade down.');
add('crushing_blow', 'Crushing Blow', '🪨', 'advanced', ['tank', 'blacksmith', 'builder'], 'Earth', 'hammer', { type: 'strike', mult: 2.7, sp: 16, cd: 7, effect: { id: 'frost', chance: 0.35 } }, 'A blow that cracks armour and leaves the foe reeling.');
add('assassinate', 'Assassinate', '🗡️', 'expert', ['assassin'], 'Dark', 'thrust', { type: 'strike', mult: 3.8, sp: 28, cd: 14, effect: { id: 'bleed', chance: 0.6 } }, 'One silent strike at a weak point.');
add('dragon_fang', 'Dragon Fang', '🐉', 'expert', ['swordsman'], 'Fire', 'overhead', { type: 'strike', mult: 3.5, sp: 26, cd: 12, effect: { id: 'burn', chance: 0.6 } }, 'A cut with a dragon\'s fire behind it.');
add('titan_smash', 'Titan Smash', '🗿', 'expert', ['tank', 'blacksmith', 'builder'], 'Earth', 'hammer', { type: 'strike', mult: 3.6, sp: 27, cd: 13 }, 'Strike with the strength of a giant.');
add('heaven_splitter', 'Heaven Splitter', '🌟', 'master', ['swordsman'], 'Light', 'overhead', { type: 'strike', mult: 5, sp: 48, cd: 25 }, 'A cut said to split the sky.');
add('death_mark', 'Death Mark', '💀', 'master', ['assassin'], 'Dark', 'thrust', { type: 'strike', mult: 4.6, sp: 45, cd: 24, drain: 0.2, effect: { id: 'poison', chance: 1 } }, 'Mark a foe for death and feed on its life.');
add('worldbreaker', 'Worldbreaker', '🌋', 'master', ['blacksmith', 'tank'], 'Earth', 'hammer', { type: 'strike', mult: 5.2, sp: 50, cd: 28 }, 'A hammer blow that shakes the world.');
// ATTACK: sweeps round you
add('wide_slash', 'Wide Slash', '〰️', 'basic', ['swordsman', 'any'], 'Steel', 'scythe', { type: 'sweep', mult: 1.1, radius: 3, sp: 8, cd: 6 }, 'A wide cut through everything in front and to the sides.');
add('stomp', 'Stomp', '🦶', 'basic', ['tank', 'builder', 'farmer'], 'Earth', 'stomp', { type: 'sweep', mult: 1.2, radius: 3, sp: 9, cd: 7, effect: { id: 'frost', chance: 0.3 } }, 'Stamp hard and shake the foes round you.');
add('blade_dance', 'Blade Dance', '💃', 'advanced', ['swordsman', 'assassin'], 'Steel', 'scythe', { type: 'sweep', mult: 1.8, radius: 3.5, sp: 18, cd: 9, effect: { id: 'bleed', chance: 0.4 } }, 'Cut and cut again at everything near.');
add('flame_ring', 'Flame Ring', '⭕', 'advanced', ['mage', 'potion_maker'], 'Fire', 'nova', { type: 'sweep', mult: 1.7, radius: 4.5, magic: true, sp: 18, cd: 10, effect: { id: 'burn', chance: 0.4 } }, 'A ring of fire bursts out from you.');
add('thunder_stomp', 'Thunder Stomp', '🌩️', 'advanced', ['tank', 'swordsman'], 'Lightning', 'stomp', { type: 'sweep', mult: 1.7, radius: 4, sp: 18, cd: 10 }, 'Your foot comes down like thunder.');
add('poison_cloud', 'Poison Cloud', '☁️', 'advanced', ['potion_maker', 'assassin'], 'Nature', 'throw', { type: 'sweep', mult: 1.2, radius: 5, magic: true, sp: 16, cd: 12, effect: { id: 'poison', chance: 0.9 } }, 'Break a flask of choking fumes at your feet.');
add('earthquake', 'Earthquake', '🌍', 'expert', ['tank', 'builder', 'blacksmith'], 'Earth', 'stomp', { type: 'sweep', mult: 2.6, radius: 6, sp: 30, cd: 16, effect: { id: 'frost', chance: 0.4 } }, 'The ground heaves under every foe near you.');
add('storm_of_blades', 'Storm of Blades', '🌪️', 'expert', ['swordsman', 'assassin'], 'Wind', 'scythe', { type: 'sweep', mult: 2.8, radius: 4.5, sp: 30, cd: 15, effect: { id: 'bleed', chance: 0.5 } }, 'Steel and wind tear at all around you.');
add('blizzard', 'Blizzard', '🌨️', 'expert', ['mage'], 'Water', 'nova', { type: 'sweep', mult: 2.4, radius: 7, magic: true, sp: 30, cd: 16, effect: { id: 'frost', chance: 0.7 } }, 'Call a howling storm of ice.');
add('reaping_storm', 'Reaping Storm', '🌾', 'master', ['farmer'], 'Nature', 'scythe', { type: 'sweep', mult: 3.6, radius: 6, sp: 44, cd: 24, drain: 0.15 }, 'Reap your foes like a field of wheat.');
add('sunburst', 'Sunburst', '☀️', 'master', ['healer', 'mage'], 'Light', 'nova', { type: 'sweep', mult: 3.8, radius: 8, magic: true, sp: 46, cd: 26, drain: 0.1 }, 'Blaze like the sun itself.');
add('cataclysm', 'Cataclysm', '☄️', 'master', ['mage', 'builder'], 'Fire', 'nova', { type: 'sweep', mult: 4.2, radius: 9, magic: true, sp: 50, cd: 30, effect: { id: 'burn', chance: 0.8 } }, 'Fire and stone rain down all round you.');
// ATTACK: shots at a foe further off
add('throwing_knife', 'Throwing Knife', '🔪', 'basic', ['assassin', 'any'], 'Steel', 'throw', { type: 'bolt', mult: 1.4, reach: 14, sp: 5, cd: 3, effect: { id: 'bleed', chance: 0.2 } }, 'Flick a knife at a foe.');
add('rock_throw', 'Rock Throw', '🪨', 'basic', ['builder', 'farmer', 'blacksmith'], 'Earth', 'throw', { type: 'bolt', mult: 1.5, reach: 12, sp: 6, cd: 4 }, 'Hurl a heavy stone.');
add('ice_shard', 'Ice Shard', '🔹', 'basic', ['mage', 'potion_maker'], 'Water', 'cast', { type: 'bolt', mult: 1.6, reach: 16, magic: true, sp: 7, cd: 3, effect: { id: 'frost', chance: 0.3 } }, 'A sharp splinter of ice.');
add('zap', 'Zap', '⚡', 'basic', ['mage'], 'Lightning', 'cast', { type: 'bolt', mult: 1.5, reach: 15, magic: true, sp: 6, cd: 2.5 }, 'A quick crack of lightning from your fingers.');
add('holy_light', 'Holy Light', '🔆', 'basic', ['healer'], 'Light', 'cast', { type: 'bolt', mult: 1.5, reach: 16, magic: true, sp: 7, cd: 3 }, 'A beam of pure light.');
add('acid_flask', 'Acid Flask', '🧪', 'basic', ['potion_maker'], 'Nature', 'throw', { type: 'bolt', mult: 1.5, reach: 12, sp: 7, cd: 4, effect: { id: 'poison', chance: 0.5 } }, 'Throw a flask of burning acid.');
add('spear_throw', 'Spear Throw', '🏹', 'advanced', ['swordsman', 'tank'], 'Steel', 'lance', { type: 'bolt', mult: 2.3, reach: 20, sp: 13, cd: 6, effect: { id: 'bleed', chance: 0.3 } }, 'Throw a spear with all your strength.');
add('lightning_lance', 'Lightning Lance', '🌩️', 'advanced', ['mage'], 'Lightning', 'lance', { type: 'bolt', mult: 2.5, reach: 22, magic: true, sp: 16, cd: 6 }, 'A spear of crackling lightning.');
add('shadow_needle', 'Shadow Needle', '🪡', 'advanced', ['assassin'], 'Dark', 'flick', { type: 'bolt', mult: 2.2, reach: 18, sp: 13, cd: 5, effect: { id: 'poison', chance: 0.5 } }, 'A needle of shadow nobody sees coming.');
add('golden_barrage', 'Golden Barrage', '💰', 'advanced', ['businessman'], 'Gold', 'flick', { type: 'bolt', mult: 2.2, reach: 16, sp: 13, cd: 5 }, 'A hail of weighted coins.');
add('dragon_breath', 'Dragon Breath', '🐲', 'expert', ['mage', 'swordsman'], 'Fire', 'roar', { type: 'bolt', mult: 3.4, reach: 18, magic: true, sp: 28, cd: 13, effect: { id: 'burn', chance: 0.7 } }, 'Breathe fire like a dragon.');
add('sniper_dagger', 'Sniper Dagger', '🎯', 'expert', ['assassin'], 'Dark', 'throw', { type: 'bolt', mult: 3.3, reach: 28, sp: 26, cd: 12, effect: { id: 'bleed', chance: 0.5 } }, 'A dagger thrown from far, far away.');
add('holy_spear', 'Holy Spear', '✝️', 'expert', ['healer'], 'Light', 'lance', { type: 'bolt', mult: 3.2, reach: 24, magic: true, sp: 26, cd: 12 }, 'A spear of light thrown from on high.');
add('fortune_shot', 'Fortune Shot', '🪙', 'expert', ['businessman'], 'Gold', 'flick', { type: 'bolt', mult: 3.2, reach: 20, sp: 26, cd: 12, drain: 0.15 }, 'A golden coin that always finds its mark.');
add('starfall', 'Starfall', '🌠', 'master', ['mage'], 'Light', 'cast', { type: 'bolt', mult: 5, reach: 30, magic: true, sp: 48, cd: 26 }, 'Pull a star down onto one foe.');
add('void_spear', 'Spear of the Void', '🕳️', 'master', ['assassin', 'mage'], 'Dark', 'lance', { type: 'bolt', mult: 4.8, reach: 26, magic: true, sp: 46, cd: 25, drain: 0.2 }, 'A spear of nothing that eats what it hits.');
// MOVEMENT: rushes and steps
add('lunge', 'Lunge', '🤺', 'basic', ['swordsman', 'any'], 'Steel', 'charge', { type: 'dash', mult: 1.3, dist: 5, sp: 6, cd: 5 }, 'Spring forward with a thrust.');
add('evasive_roll', 'Evasive Roll', '🔄', 'basic', ['any'], 'Wind', 'shadow', { type: 'dash', mult: 0.5, dist: 5, sp: 4, cd: 4 }, 'Roll clear of danger, nicking whatever is in the way.');
add('shoulder_tackle', 'Shoulder Tackle', '🏈', 'basic', ['tank', 'farmer'], 'Steel', 'charge', { type: 'dash', mult: 1.4, dist: 6, sp: 8, cd: 6, stun: 1 }, 'Barge into a foe and knock it off balance.');
add('bull_rush', 'Bull Rush', '🐂', 'advanced', ['tank', 'farmer'], 'Earth', 'charge', { type: 'dash', mult: 2, dist: 9, sp: 15, cd: 9, stun: 1.5 }, 'Run a foe down like a bull.');
add('lightning_step', 'Lightning Step', '⚡', 'advanced', ['assassin', 'swordsman'], 'Lightning', 'shadow', { type: 'dash', mult: 2.1, dist: 11, sp: 16, cd: 9 }, 'Move like a flash of lightning.');
add('wind_walk', 'Wind Walk', '🍃', 'advanced', ['any'], 'Wind', 'shadow', { type: 'dash', mult: 1.6, dist: 12, sp: 12, cd: 8 }, 'Ride the wind a long way at once.');
add('phantom_rush', 'Phantom Rush', '👻', 'expert', ['assassin'], 'Dark', 'shadow', { type: 'dash', mult: 3.2, dist: 13, sp: 26, cd: 13, drain: 0.1 }, 'Become a shadow and pass through a foe.');
add('meteor_dive', 'Meteor Dive', '☄️', 'expert', ['swordsman', 'tank'], 'Fire', 'charge', { type: 'dash', mult: 3.4, dist: 12, sp: 28, cd: 14, effect: { id: 'burn', chance: 0.5 } }, 'Crash into a foe like a falling star.');
add('flash_step', 'Flash Step', '✨', 'master', ['assassin', 'swordsman'], 'Light', 'shadow', { type: 'dash', mult: 4.5, dist: 16, sp: 44, cd: 22 }, 'Gone before the eye can follow.');
add('dragon_charge', 'Dragon Charge', '🐉', 'master', ['tank'], 'Fire', 'charge', { type: 'dash', mult: 4.4, dist: 15, sp: 46, cd: 24, stun: 2 }, 'Charge with the weight of a dragon.');
// HEALING
add('bandage', 'Bandage', '🩹', 'basic', ['any'], 'Steel', 'mend', { type: 'heal', pct: 15, sp: 6, cd: 20 }, 'Bind your wounds.');
add('first_aid', 'First Aid', '⛑️', 'basic', ['healer', 'tank'], 'Light', 'mend', { type: 'heal', pct: 20, sp: 8, cd: 18 }, 'Quick, careful care for your wounds.');
add('herbal_remedy', 'Herbal Remedy', '🌿', 'basic', ['potion_maker', 'farmer', 'healer'], 'Nature', 'eat', { type: 'heal', pct: 22, sp: 10, cd: 25 }, 'Chew healing herbs.');
add('meditate', 'Meditate', '🧘', 'basic', ['mage', 'any'], 'Wind', 'breathe', { type: 'heal', pct: 18, sp: 6, cd: 22 }, 'Still your mind and mend your body.');
add('greater_mend', 'Greater Mend', '💖', 'advanced', ['healer'], 'Light', 'pray', { type: 'heal', pct: 45, sp: 24, cd: 30 }, 'A strong healing prayer.');
add('regrowth', 'Regrowth', '🌱', 'advanced', ['farmer', 'potion_maker'], 'Nature', 'mend', { type: 'heal', pct: 40, sp: 22, cd: 30 }, 'Your wounds close like new leaves.');
add('feast', 'Feast', '🍲', 'advanced', ['farmer', 'businessman'], 'Gold', 'eat', { type: 'heal', pct: 38, sp: 20, cd: 30 }, 'A full, warm meal in the middle of a fight.');
add('troll_blood', 'Troll Blood', '🩸', 'advanced', ['tank'], 'Nature', 'breathe', { type: 'heal', pct: 35, sp: 18, cd: 25 }, 'Your blood knits your flesh back together.');
add('life_surge', 'Life Surge', '💗', 'expert', ['healer'], 'Light', 'pray', { type: 'heal', pct: 60, sp: 34, cd: 40 }, 'A flood of life fills you.');
add('elixir_of_life', 'Elixir of Life', '⚗️', 'expert', ['potion_maker'], 'Water', 'eat', { type: 'heal', pct: 55, sp: 30, cd: 40 }, 'Drink a draught that heals almost anything.');
add('divine_grace', 'Divine Grace', '😇', 'master', ['healer'], 'Light', 'pray', { type: 'heal', pct: 75, sp: 45, cd: 60 }, 'Heaven itself mends you.');
add('phoenix_rebirth', 'Phoenix Rebirth', '🐦‍🔥', 'master', ['healer', 'mage'], 'Fire', 'pray', { type: 'heal', pct: 90, sp: 50, cd: 90 }, 'Rise from the flames, nearly whole.');
// DEFENCE: guards that raise DEF
add('guard', 'Guard', '🛡️', 'basic', ['any'], 'Steel', 'brace', { type: 'buff', stat: 'def', pct: 30, secs: 10, sp: 8, cd: 20 }, 'Raise your guard.');
add('parry_stance', 'Parry Stance', '🤺', 'basic', ['swordsman'], 'Steel', 'brace', { type: 'buff', stat: 'def', pct: 35, secs: 8, sp: 8, cd: 18 }, 'Ready to turn any blow aside.');
add('stone_skin', 'Stone Skin', '🪨', 'basic', ['builder', 'tank', 'blacksmith'], 'Earth', 'brace', { type: 'buff', stat: 'def', pct: 40, secs: 12, sp: 12, cd: 25 }, 'Your skin turns hard as rock.');
add('shadow_veil', 'Shadow Veil', '🌫️', 'basic', ['assassin'], 'Dark', 'brace', { type: 'buff', stat: 'def', pct: 30, secs: 10, sp: 8, cd: 20 }, 'Wrap yourself in shadow, hard to hit.');
add('fortress', 'Fortress', '🏰', 'advanced', ['tank', 'builder'], 'Earth', 'raise', { type: 'buff', stat: 'def', pct: 70, secs: 12, sp: 22, cd: 40 }, 'Stand like a castle wall.');
add('holy_shield', 'Holy Shield', '🔰', 'advanced', ['healer'], 'Light', 'pray', { type: 'buff', stat: 'def', pct: 60, secs: 15, sp: 20, cd: 40 }, 'A shield of light surrounds you.');
add('frost_armour', 'Frost Armour', '❄️', 'advanced', ['mage'], 'Water', 'brace', { type: 'buff', stat: 'def', pct: 55, secs: 15, sp: 18, cd: 35 }, 'Armour of ice forms over you.');
add('bark_skin', 'Bark Skin', '🌳', 'advanced', ['farmer', 'potion_maker'], 'Nature', 'brace', { type: 'buff', stat: 'def', pct: 50, secs: 18, sp: 18, cd: 35 }, 'Your skin grows tough as old bark.');
add('unbreakable', 'Unbreakable', '💎', 'expert', ['tank'], 'Earth', 'brace', { type: 'buff', stat: 'def', pct: 100, secs: 10, sp: 32, cd: 60 }, 'Nothing can break you, for a while.');
add('aegis', 'Aegis', '🛡️', 'expert', ['healer', 'tank'], 'Light', 'raise', { type: 'buff', stat: 'def', pct: 90, secs: 15, sp: 32, cd: 60 }, 'The shield of the heavens.');
add('storm_ward', 'Storm Ward', '🌀', 'expert', ['mage'], 'Lightning', 'brace', { type: 'buff', stat: 'def', pct: 80, secs: 15, sp: 30, cd: 55 }, 'Lightning circles you and turns blows away.');
add('divine_bulwark', 'Divine Bulwark', '⛪', 'master', ['tank', 'healer'], 'Light', 'raise', { type: 'buff', stat: 'def', pct: 150, secs: 12, sp: 48, cd: 90 }, 'A wall that heaven itself holds up.');
add('dragon_scales', 'Dragon Scales', '🐲', 'master', ['any'], 'Fire', 'brace', { type: 'buff', stat: 'def', pct: 130, secs: 20, sp: 46, cd: 90 }, 'Grow the scales of a dragon.');
// SUPPORT: cries and focus that raise ATK or MATK
add('focus', 'Focus', '🎯', 'basic', ['any'], 'Steel', 'breathe', { type: 'buff', stat: 'atk', pct: 20, secs: 15, sp: 8, cd: 25 }, 'Breathe in and aim true.');
add('sharpen_blade', 'Sharpen Blade', '🔪', 'basic', ['blacksmith', 'swordsman'], 'Steel', 'coin', { type: 'buff', stat: 'atk', pct: 25, secs: 20, sp: 10, cd: 30 }, 'A quick stroke of the whetstone.');
add('adrenaline', 'Adrenaline', '💓', 'basic', ['assassin', 'farmer'], 'Fire', 'roar', { type: 'buff', stat: 'atk', pct: 25, secs: 10, sp: 8, cd: 25 }, 'Your heart pounds and your arms grow strong.');
add('arcane_focus', 'Arcane Focus', '🔮', 'basic', ['mage', 'healer', 'potion_maker'], 'Lightning', 'pray', { type: 'buff', stat: 'matk', pct: 30, secs: 15, sp: 10, cd: 30 }, 'Gather your magic.');
add('berserk', 'Berserk', '😤', 'advanced', ['swordsman', 'tank'], 'Fire', 'roar', { type: 'buff', stat: 'atk', pct: 50, secs: 12, sp: 20, cd: 40 }, 'Fight in a blind rage.');
add('commanders_call', 'Commander\'s Call', '📣', 'advanced', ['businessman', 'any'], 'Gold', 'roar', { type: 'buff', stat: 'atk', pct: 40, secs: 20, sp: 18, cd: 40 }, 'Shout orders that steel your arm.');
add('predators_focus', 'Predator\'s Focus', '🐆', 'advanced', ['assassin'], 'Dark', 'breathe', { type: 'buff', stat: 'atk', pct: 45, secs: 12, sp: 18, cd: 40 }, 'See only the prey.');
add('mana_surge', 'Mana Surge', '💫', 'advanced', ['mage', 'healer'], 'Lightning', 'pray', { type: 'buff', stat: 'matk', pct: 50, secs: 15, sp: 20, cd: 40 }, 'Magic floods through you.');
add('blood_rage', 'Blood Rage', '🩸', 'expert', ['swordsman', 'tank'], 'Fire', 'roar', { type: 'buff', stat: 'atk', pct: 80, secs: 12, sp: 30, cd: 50 }, 'The more you bleed, the harder you hit.');
add('golden_hour', 'Golden Hour', '🌅', 'expert', ['businessman'], 'Gold', 'coin', { type: 'buff', stat: 'atk', pct: 70, secs: 20, sp: 30, cd: 55 }, 'Fortune favours you for a while.');
add('archmage_focus', 'Archmage\'s Focus', '📘', 'expert', ['mage', 'healer'], 'Light', 'pray', { type: 'buff', stat: 'matk', pct: 85, secs: 15, sp: 32, cd: 55 }, 'Think as the great mages think.');
add('avatar_of_war', 'Avatar of War', '⚔️', 'master', ['swordsman'], 'Light', 'roar', { type: 'buff', stat: 'atk', pct: 130, secs: 15, sp: 50, cd: 90 }, 'Become war itself.');
add('arcane_ascension', 'Arcane Ascension', '🌌', 'master', ['mage'], 'Dark', 'pray', { type: 'buff', stat: 'matk', pct: 140, secs: 15, sp: 50, cd: 90 }, 'Rise above every mage alive, for a while.');
// CONTROL: pinning foes in place (stun) and slowing them (hold)
add('trip', 'Trip', '🦵', 'basic', ['any'], 'Steel', 'bash', { type: 'strike', mult: 1.1, sp: 6, cd: 8, stun: 1.5 }, 'Sweep a foe\'s legs out from under it.');
add('pommel_strike', 'Pommel Strike', '🗡️', 'basic', ['swordsman', 'tank'], 'Steel', 'bash', { type: 'strike', mult: 1.3, sp: 7, cd: 8, stun: 1.5 }, 'Knock a foe dizzy with the hilt.');
add('net_throw', 'Net Throw', '🕸️', 'basic', ['farmer', 'businessman'], 'Steel', 'throw', { type: 'bolt', mult: 0.8, reach: 12, sp: 7, cd: 10, stun: 2.5 }, 'Throw a weighted net over a foe.');
add('chilling_touch', 'Chilling Touch', '🥶', 'basic', ['mage', 'potion_maker'], 'Water', 'cast', { type: 'strike', mult: 1.2, magic: true, sp: 6, cd: 7, hold: 3 }, 'A touch of frost that slows a foe.');
add('intimidate', 'Intimidate', '😠', 'basic', ['tank'], 'Steel', 'roar', { type: 'sweep', mult: 0.6, radius: 5, sp: 8, cd: 12, stun: 1.5, cat: 'control' }, 'A roar that freezes foes in fear.');
add('binding_roots', 'Binding Roots', '🌿', 'advanced', ['farmer', 'potion_maker', 'healer'], 'Nature', 'nova', { type: 'sweep', mult: 1, radius: 5, magic: true, sp: 18, cd: 15, stun: 3 }, 'Roots burst up and hold every foe near you.');
add('frost_trap', 'Frost Trap', '🧊', 'advanced', ['potion_maker', 'assassin'], 'Water', 'stomp', { type: 'sweep', mult: 1.2, radius: 4, sp: 16, cd: 14, stun: 2, hold: 4 }, 'Ice spreads out and grips their feet.');
add('shockwave', 'Shockwave', '💢', 'advanced', ['tank', 'builder'], 'Earth', 'stomp', { type: 'sweep', mult: 1.4, radius: 5, sp: 18, cd: 15, stun: 2 }, 'A wave through the ground knocks foes flat.');
add('paralysing_dart', 'Paralysing Dart', '🎯', 'advanced', ['assassin'], 'Nature', 'flick', { type: 'bolt', mult: 1.5, reach: 18, sp: 15, cd: 14, stun: 3, effect: { id: 'poison', chance: 0.5 } }, 'A dart that locks a foe\'s muscles.');
add('chains_of_light', 'Chains of Light', '⛓️', 'expert', ['healer'], 'Light', 'pray', { type: 'sweep', mult: 1.6, radius: 6, magic: true, sp: 28, cd: 22, stun: 4 }, 'Chains of light bind every foe near you.');
add('gravity_well', 'Gravity Well', '🌑', 'expert', ['mage'], 'Dark', 'nova', { type: 'sweep', mult: 2, radius: 7, magic: true, sp: 30, cd: 22, stun: 4 }, 'Crushing weight pins foes to the ground.');
add('earth_prison', 'Earth Prison', '🏛️', 'expert', ['builder', 'tank'], 'Earth', 'raise', { type: 'bolt', mult: 2, reach: 18, sp: 26, cd: 20, stun: 5 }, 'Walls of stone rise round one foe.');
add('frozen_eternity', 'Frozen Eternity', '🧊', 'master', ['mage'], 'Water', 'nova', { type: 'sweep', mult: 2.6, radius: 9, magic: true, sp: 46, cd: 40, stun: 6, effect: { id: 'frost', chance: 1 } }, 'Everything near you freezes solid.');
add('abyssal_chains', 'Abyssal Chains', '⛓️', 'master', ['assassin', 'tank'], 'Dark', 'nova', { type: 'sweep', mult: 2.8, radius: 8, sp: 46, cd: 40, stun: 6, drain: 0.15 }, 'Chains from the abyss drag at every foe.');

// the third book (data/skills-extra.mjs): the blows in its Attack part stay Attack even when they
// also stun or slow a little; each brings its own description
{
  const firstMove = EXTRA_SKILLS.findIndex((x) => x[0] === 'sidestep');
  EXTRA_SKILLS.forEach(([id, name, icon, rank, cls, el, move, n, about, desc], i) => {
    if (SKILLS[id]) throw new Error(`skill ${id} twice`);
    add(id, name, icon, rank, cls, el, move, i < firstMove && (n.stun || n.hold) ? { ...n, cat: 'attack' } : n, about);
    SKILLS[id].desc0 = desc;
  });
}

for (const [id, s] of Object.entries(SKILLS)) {
  s.id = id;
  if (!s.text) s.text = `${s.about} ${skillDetails(s)}.`;
  // the longer description: what it looks like and when to use it (data/descriptions.mjs)
  s.desc = SKILL_DESC[id] || s.desc0 || s.about || '';
  delete s.desc0;
}

// ---------- ranks ----------
// Skills and spells are ranked like everything else in the realm, from F (the lowest) up to SSS.
// F skills come easily from the first upgrade; each higher rank is rarer and only comes once you
// reach its level (an admin can give any skill at any level).
export const LETTER_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
export const SKILL_RANKS = [
  { id: 'F', name: 'F-Rank', from: 1, weight: 6 },
  { id: 'E', name: 'E-Rank', from: 25, weight: 5 },
  { id: 'D', name: 'D-Rank', from: 100, weight: 3 },
  { id: 'C', name: 'C-Rank', from: 175, weight: 2.4 },
  { id: 'B', name: 'B-Rank', from: 250, weight: 1.4 },
  { id: 'A', name: 'A-Rank', from: 375, weight: 1 },
  { id: 'S', name: 'S-Rank', from: 500, weight: 0.5 },
  { id: 'SS', name: 'SS-Rank', from: 750, weight: 0.3 },
  { id: 'SSS', name: 'SSS-Rank', from: 1000, weight: 0.15 },
];
export const rankInfo = (id) => SKILL_RANKS.find((r) => r.id === id) || SKILL_RANKS[0];
export const rankIndex = (id) => Math.max(0, SKILL_RANKS.findIndex((r) => r.id === id));

// What a skill's numbers do, in words: "2.4× ATK to one foe in front, 50% chance to burn it"
export function skillDetails(s) {
  const pow = `${s.mult}× ${s.magic ? 'MATK' : 'ATK'}`;
  let t = { strike: `${pow} to one foe in front`, sweep: `${pow} to every foe within ${s.radius} m`, bolt: `${pow} to a foe up to ${s.reach} m away`,
    dash: `rush ${s.dist} m and strike for ${pow}`, heal: `restore ${s.pct}% of your HP`, buff: `+${s.pct}% ${STAT_WORDS[s.stat] || s.stat} for ${s.secs} s` }[s.type] || '';
  if (s.stun) t += `, pins it for ${s.stun} s`;
  if (s.hold) t += `, slows it for ${s.hold} s`;
  if (s.effect) t += `, ${s.effect.chance >= 1 ? 'always' : `${Math.round(s.effect.chance * 100)}% chance to`} ${EFFECT_WORDS[s.effect.id] || s.effect.id}`;
  if (s.drain) t += `, heals you ${Math.round(s.drain * 100)}% of the damage`;
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

// Skills each class is offered first; everyone is also offered the general ones ('any')
const BY_CLASS = {};
for (const s of Object.values(SKILLS)) for (const k of s.cls || []) (BY_CLASS[k] ||= []).push(s.id);
const GENERAL = BY_CLASS.any || [];
export const skillClasses = (s) => (s.cls || []).filter((k) => k !== 'any');


// Every 25th level is an upgrade: a little stronger, and a new skill, given at random
export const UPGRADE_EVERY = 25;
export const UPGRADE_STATS = 2; // added to every stat
export const SKILL_BAR = 6;     // skills you can have ready at once; the rest are kept in storage
export const DEFAULT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
// keys the game already uses, so a skill can't take them
export const RESERVED_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight',
  'KeyF', 'KeyU', 'KeyJ', 'KeyZ', 'KeyT', 'KeyC', 'KeyI', 'KeyB', 'KeyQ', 'KeyH', 'KeyM', 'KeyO', 'KeyL', 'KeyR', 'KeyK', 'KeyP', 'KeyG', 'KeyV', 'Escape', 'Tab', 'Enter'];
export const keyLabel = (code) => (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');

// A new skill, given at random (players don't choose). Only skills of a rank you have reached can
// come (Basic from the start, Advanced from level 100, Expert from 250, Master from 500). Basic
// skills turn up far more often than the higher ranks; your class's skills turn up most, the general
// ones next; and dearer skills (more SP) are a little rarer still.
export function randomSkill(c, rnd = Math.random) {
  const known = new Set(c.skills || []);
  const unknown = Object.keys(SKILLS).filter((id) => !known.has(id));
  if (!unknown.length) return null;
  let pool = unknown.filter((id) => rankInfo(SKILLS[id].rank).from <= (c.level || 1));
  if (!pool.length) { const low = Math.min(...unknown.map((id) => rankIndex(SKILLS[id].rank))); pool = unknown.filter((id) => rankIndex(SKILLS[id].rank) === low); }
  const weight = (id) => (BY_CLASS[c.cls]?.includes(id) ? 4 : GENERAL.includes(id) ? 2 : 1) * rankInfo(SKILLS[id].rank).weight * 10 / Math.max(8, SKILLS[id].sp);
  let r = rnd() * pool.reduce((a, id) => a + weight(id), 0);
  for (const id of pool) if ((r -= weight(id)) <= 0) return id;
  return pool[pool.length - 1];
}


// ---------- categories ----------
// Skills are sorted into kinds, from defence to attack: Defence (guards that raise DEF), Healing,
// Support (war cries that raise ATK), Control (slowing and holding foes), Movement (rushes and
// steps) and Attack (blows, sweeps and shots). Inside each kind the strongest come first.
export const SKILL_CATEGORIES = [
  { id: 'defence', name: 'Defence', icon: '🛡️' },
  { id: 'healing', name: 'Healing', icon: '✚' },
  { id: 'support', name: 'Support', icon: '📯' },
  { id: 'control', name: 'Control', icon: '❄️' },
  { id: 'movement', name: 'Movement', icon: '⚡' },
  { id: 'attack', name: 'Attack', icon: '⚔️' },
];
// the kind of a skill (a skill from this file, a Unique Skill as uniqueAbility gives it, or its `kind`)
export function skillCategory(s) {
  if (!s) return 'attack';
  if (s.cat) return s.cat;
  if (s.kind === 'freeze') return 'control';
  if (s.type === 'buff') return s.stat === 'def' ? 'defence' : 'support';
  if (s.type === 'heal') return 'healing';
  if (s.type === 'dash') return 'movement';
  if (s.type === 'appraise') return 'support';
  if (s.hold || s.stun) return 'control';
  return 'attack';
}
// how a skill reaches its foes, for the filters
export const SKILL_SHAPES = { strike: 'One foe in front', sweep: 'All round you', bolt: 'At range', dash: 'Rush', heal: 'On yourself', buff: 'On yourself' };
// how strong a skill is, to rank skills of one kind
export const skillPower = (s) => (s.mult || 0) * (s.radius ? 1.3 : 1) + (s.pct || 0) / 20 + (s.sp || 0) / 50 + (s.stun || 0) * 0.3 + (s.hold || 0) * 0.1;
// Each skill above is written in one of four bands; a band's skills are spread over its letter
// ranks by cost (the stronger ones cost more SP), so every rank from F to SSS has its own skills.
const BAND_LETTERS = { basic: ['F', 'E'], advanced: ['D', 'C'], expert: ['B', 'A'], master: ['S', 'SS', 'SSS'] };
for (const [band, letters] of Object.entries(BAND_LETTERS)) {
  const list = Object.values(SKILLS).filter((s) => s.rank === band).sort((a, b) => a.sp - b.sp || skillPower(a) - skillPower(b) || a.id.localeCompare(b.id));
  list.forEach((s, i) => { s.rank = letters[Math.min(letters.length - 1, Math.floor((i * letters.length) / list.length))]; });
}
// skill ids grouped by kind (defence first, attack last), strongest first in each:
// [{ id, name, icon, skills: [ids] }]
export function byCategory(ids) {
  const list = [...new Set(ids)].filter((id) => SKILLS[id]);
  return SKILL_CATEGORIES.map((k) => ({ ...k, skills: list.filter((id) => skillCategory(SKILLS[id]) === k.id).sort((a, b) => skillPower(SKILLS[b]) - skillPower(SKILLS[a])) }))
    .filter((k) => k.skills.length);
}

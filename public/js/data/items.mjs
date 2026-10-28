// Every item in the game: materials you gather, food, potions, weapons and armour, plus the shop list.

// kind: 'material' | 'food' | 'weapon' | 'armour'. price is what the shop charges; it buys things back for less.
// Armour: slot is where it is worn (head, body, legs, feet, shield); def and mdef add to defence;
// look is the colour and material it is drawn with.
// Weapons: type picks the 3D model and swing; power adds to damage; speed is seconds between swings;
// chop multiplies damage to trees and bushes; magic weapons use MATK instead of ATK.
export const ITEMS = {
  // gathered
  log: { name: 'Log', icon: '🪵', kind: 'material', price: 3, text: 'Wood from a young tree. Used for crafting and building.' },
  berries: { name: 'Wild Berries', icon: '🫐', kind: 'food', heal: 15, price: 3, text: 'Sweet berries from a bush. Restores 15 HP.' },
  reed: { name: 'Reed', icon: '🌾', kind: 'material', price: 2, text: 'A tough marsh reed.' },
  cactus_flesh: { name: 'Cactus Flesh', icon: '🌵', kind: 'food', heal: 20, price: 4, text: 'Watery and bitter. Restores 20 HP.' },
  // monster drops
  slime_gel: { name: 'Slime Gel', icon: '💧', kind: 'material', price: 4, text: 'Sticky gel left by a slime.' },
  goblin_ear: { name: 'Goblin Ear', icon: '👂', kind: 'material', price: 6, text: 'Proof of a goblin defeated.' },
  lizard_scale: { name: 'Lizard Scale', icon: '🟢', kind: 'material', price: 8, text: 'A hard green scale.' },
  serpent_fang: { name: 'Serpent Fang', icon: '🦷', kind: 'material', price: 14, text: 'Still slightly venomous.' },
  fae_dust: { name: 'Fae Dust', icon: '✨', kind: 'material', price: 12, text: 'Glittering dust from a wisp.' },
  drake_horn: { name: 'Drake Horn', icon: '🦴', kind: 'material', price: 40, text: 'A young drake\'s horn. Prized by smiths.' },
  frost_core: { name: 'Frost Core', icon: '❄️', kind: 'material', price: 25, text: 'A cold heart from a frost slime.' },
  // mined in the depths; rank shows how rare each one is
  copper_ore: { name: 'Copper Ore', icon: '🟠', kind: 'material', rank: 0, price: 8, text: 'Soft reddish ore, common in shallow caves.' },
  iron_ore: { name: 'Iron Ore', icon: '⚫', kind: 'material', rank: 0, price: 14, text: 'The smith\'s bread and butter.' },
  crystal_shard: { name: 'Crystal Shard', icon: '🔷', kind: 'material', rank: 1, price: 22, text: 'A shard of the glowing crystal that lights the caves.' },
  silver_ore: { name: 'Silver Ore', icon: '⚪', kind: 'material', rank: 1, price: 30, text: 'Bright ore that monsters seem to fear.' },
  gold_ore: { name: 'Gold Ore', icon: '🟡', kind: 'material', rank: 2, price: 60, text: 'Heavy, soft and valuable.' },
  emerald: { name: 'Emerald', icon: '💚', kind: 'material', rank: 2, price: 90, text: 'A green gem from the damp hollows of the Mire.' },
  sapphire: { name: 'Sapphire', icon: '💙', kind: 'material', rank: 2, price: 110, text: 'A deep blue gem, cold to the touch.' },
  ruby: { name: 'Ruby', icon: '❤️', kind: 'material', rank: 3, price: 180, text: 'A blood-red gem that glows faintly in the dark.' },
  moonstone: { name: 'Moonstone', icon: '🌙', kind: 'material', rank: 4, price: 450, text: 'Found only in the deepest places. Said to hold moonlight.' },
  dragonite: { name: 'Dragonite', icon: '🐲', kind: 'material', rank: 4, price: 600, text: 'Ore fused by dragon fire. Only drakes\' lairs hold it.' },
  // food and potions
  torch: { name: 'Torch', icon: '🔥', kind: 'material', price: 12, text: 'Stand it in the ground with T; press T beside it to pick it back up. In the dark caves, T lights it in your hand instead. Its light keeps monsters away at night, and lets you sleep (Z) beside it.' },
  tent: { name: 'Tent', icon: '⛺', kind: 'material', price: 60, text: 'Pitch it anywhere (P, or from your bag) and sleep inside it (Z) to clear your Fatigue. Monsters leave you alone near it. Pack it up again when you move on.' },
  water_flask: { name: 'Water Flask', icon: '🫗', kind: 'food', heal: 12, price: 2, text: 'A drink of clean water. Restores 12 HP.' },
  apple: { name: 'Apple', icon: '🍎', kind: 'food', heal: 18, price: 3, text: 'Crisp and sweet. Restores 18 HP.' },
  bread: { name: 'Bread', icon: '🍞', kind: 'food', heal: 25, price: 6, text: 'Restores 25 HP.' },
  roast_meat: { name: 'Roast Meat', icon: '🍖', kind: 'food', heal: 70, price: 20, text: 'A hearty meal. Restores 70 HP.' },
  stew: { name: 'Hunter\'s Stew', icon: '🍲', kind: 'food', heal: 180, price: 55, text: 'Thick and filling. Restores 180 HP.' },
  herb: { name: 'Healing Herb', icon: '🌿', kind: 'food', heal: 50, price: 15, text: 'Restores 50 HP.' },
  potion: { name: 'Health Potion', icon: '🧪', kind: 'food', heal: 150, price: 45, text: 'Restores 150 HP.' },
  big_potion: { name: 'Greater Health Potion', icon: '⚗️', kind: 'food', heal: 500, price: 160, text: 'Restores 500 HP.' },
  sp_potion: { name: 'SP Potion', icon: '🔵', kind: 'food', sp: 60, price: 30, text: 'Restores 60 SP.' },
  strength_potion: { name: 'Strength Potion', icon: '💪', kind: 'food', buff: { stat: 'atk', pct: 25, minutes: 2 }, price: 70, text: '+25% ATK for 2 minutes.' },
  stone_potion: { name: 'Stoneskin Potion', icon: '🪨', kind: 'food', buff: { stat: 'def', pct: 35, minutes: 2 }, price: 70, text: '+35% DEF for 2 minutes.' },
  swift_potion: { name: 'Swiftness Potion', icon: '🪽', kind: 'food', buff: { stat: 'speed', pct: 25, minutes: 2 }, price: 60, text: 'Run 25% faster for 2 minutes.' },
  calm_draught: { name: 'Calming Draught', icon: '🍵', kind: 'food', rest: 40, price: 50, text: 'Takes away 40 Fatigue.' },
  // coatings: a Blacksmith brushes these onto a weapon, and its next hits carry the effect
  poison_potion: { name: 'Poison Potion', icon: '☠️', kind: 'coating', coat: 'poison', hits: 15, price: 55, text: 'Too foul to drink. A Blacksmith can coat a weapon with it: the next 15 hits poison foes.' },
  fire_oil: { name: 'Fire Oil', icon: '🧯', kind: 'coating', coat: 'burn', hits: 15, price: 80, text: 'A Blacksmith can coat a weapon with it: the next 15 hits set foes burning.' },
  frost_oil: { name: 'Frost Oil', icon: '🧊', kind: 'coating', coat: 'frost', hits: 15, price: 80, text: 'A Blacksmith can coat a weapon with it: the next 15 hits slow foes with cold.' },
  // only a Potion-Maker can brew these
  elixir_might: { name: 'Elixir of Might', icon: '🏺', kind: 'food', buff: { stat: 'atk', pct: 50, minutes: 5 }, price: 400, brewOnly: true, text: '+50% ATK for 5 minutes. Only a Potion-Maker can brew it.' },
  elixir_life: { name: 'Elixir of Life', icon: '❤️‍🔥', kind: 'food', heal: 9999, sp: 9999, rest: 100, price: 600, brewOnly: true, text: 'Fills HP and SP and clears all Fatigue. Only a Potion-Maker can brew it.' },
  sp_booster: { name: 'SP Booster', icon: '💠', kind: 'food', sp: 9999, boost: { sp: 50, minutes: 10 }, price: 120, text: 'Fills your SP and raises max SP by 50 for 10 minutes.' },
  // armour
  leather_cap: { name: 'Leather Cap', icon: '🧢', kind: 'armour', slot: 'head', def: 2, price: 25, look: { color: '#6b4a2e' }, text: 'A simple leather cap.' },
  cloth_tunic: { name: 'Cloth Tunic', icon: '👕', kind: 'armour', slot: 'body', def: 3, price: 30, look: { color: '#5a6a8a' }, text: 'Better than nothing.' },
  leather_boots: { name: 'Leather Boots', icon: '🥾', kind: 'armour', slot: 'feet', def: 2, price: 25, look: { color: '#5a3a22' }, text: 'Sturdy walking boots.' },
  leather_pants: { name: 'Leather Trousers', icon: '👖', kind: 'armour', slot: 'legs', def: 3, price: 45, look: { color: '#5e4430' }, text: 'Tough leather trousers.' },
  wooden_shield: { name: 'Wooden Shield', icon: '🛡️', kind: 'armour', slot: 'shield', def: 4, price: 50, look: { color: '#7a5634' }, text: 'Planks bound with iron.' },
  leather_armor: { name: 'Leather Armour', icon: '🦺', kind: 'armour', slot: 'body', def: 6, price: 90, look: { color: '#6b4a2e' }, text: 'Hardened leather.' },
  mage_hat: { name: 'Mage Hat', icon: '🎩', kind: 'armour', slot: 'head', def: 1, mdef: 5, price: 80, look: { color: '#3a2a6a', hat: true }, text: 'A pointed hat that wards off spells.' },
  mage_robe: { name: 'Mage Robe', icon: '🥻', kind: 'armour', slot: 'body', def: 3, mdef: 10, price: 200, look: { color: '#3a2a6a', robe: true }, text: 'Woven with protective runes.' },
  iron_helm: { name: 'Iron Helm', icon: '⛑️', kind: 'armour', slot: 'head', def: 6, price: 140, look: { color: '#8f949c', metal: true }, text: 'A solid iron helmet.' },
  iron_boots: { name: 'Iron Boots', icon: '🥾', kind: 'armour', slot: 'feet', def: 5, price: 120, look: { color: '#8f949c', metal: true }, text: 'Heavy iron-shod boots.' },
  chainmail: { name: 'Chainmail', icon: '🦺', kind: 'armour', slot: 'body', def: 12, price: 320, look: { color: '#9aa0a8', metal: true }, text: 'Thousands of iron rings.' },
  chain_leggings: { name: 'Chain Leggings', icon: '👖', kind: 'armour', slot: 'legs', def: 8, price: 220, look: { color: '#9aa0a8', metal: true }, text: 'Chainmail for the legs.' },
  iron_shield: { name: 'Iron Shield', icon: '🛡️', kind: 'armour', slot: 'shield', def: 9, price: 260, look: { color: '#8f949c', metal: true }, text: 'A round iron shield.' },
  steel_helm: { name: 'Steel Helm', icon: '⛑️', kind: 'armour', slot: 'head', def: 12, price: 600, look: { color: '#c0c6ce', metal: true }, text: 'Polished steel.' },
  steel_plate: { name: 'Steel Plate', icon: '🦺', kind: 'armour', slot: 'body', def: 22, price: 1100, look: { color: '#c0c6ce', metal: true }, text: 'Full steel breastplate.' },
  steel_greaves: { name: 'Steel Greaves', icon: '👖', kind: 'armour', slot: 'legs', def: 15, price: 800, look: { color: '#c0c6ce', metal: true }, text: 'Steel leg plates.' },
  steel_boots: { name: 'Steel Boots', icon: '🥾', kind: 'armour', slot: 'feet', def: 9, price: 500, look: { color: '#c0c6ce', metal: true }, text: 'Steel sabatons.' },
  tower_shield: { name: 'Tower Shield', icon: '🛡️', kind: 'armour', slot: 'shield', def: 18, price: 1200, look: { color: '#b0b6be', metal: true }, text: 'A wall you can carry.' },
  knight_helm: { name: 'Knight\'s Helm', icon: '👑', kind: 'armour', slot: 'head', def: 20, mdef: 5, price: 1800, look: { color: '#d9c27a', metal: true }, text: 'Gold-trimmed and plumed.' },
  knight_plate: { name: 'Knight\'s Plate', icon: '🦺', kind: 'armour', slot: 'body', def: 34, mdef: 8, price: 3000, look: { color: '#d9c27a', metal: true }, text: 'Armour of the realm\'s knights.' },
  // weapons
  wooden_club: { name: 'Wooden Club', icon: '🏏', kind: 'weapon', type: 'club', power: 4, speed: 0.6, chop: 1.5, rank: 0, price: 20, text: 'A heavy stick. Better than fists.' },
  rusty_sword: { name: 'Rusty Sword', icon: '🗡️', kind: 'weapon', type: 'sword', power: 6, speed: 0.55, chop: 1, rank: 0, price: 40, text: 'Old, but still sharp enough.' },
  hand_axe: { name: 'Hand Axe', icon: '🪓', kind: 'weapon', type: 'axe', power: 8, speed: 0.65, chop: 3, rank: 0, price: 90, text: 'Chops young trees in one or two swings.' },
  iron_dagger: { name: 'Iron Dagger', icon: '🔪', kind: 'weapon', type: 'dagger', power: 7, speed: 0.35, chop: 0.7, rank: 1, price: 75, text: 'Quick, light strikes.' },
  oak_staff: { name: 'Oak Staff', icon: '🪄', kind: 'weapon', type: 'staff', power: 8, speed: 0.6, chop: 0.8, magic: true, rank: 1, price: 90, text: 'Channels magic: uses MATK.' },
  iron_sword: { name: 'Iron Sword', icon: '⚔️', kind: 'weapon', type: 'sword', power: 11, speed: 0.55, chop: 1, rank: 1, price: 160, text: 'A soldier\'s blade.' },
  iron_mace: { name: 'Iron Mace', icon: '🔨', kind: 'weapon', type: 'mace', power: 14, speed: 0.75, chop: 1.6, rank: 1, price: 260, text: 'Slow, crushing blows.' },
  steel_sword: { name: 'Steel Sword', icon: '⚔️', kind: 'weapon', type: 'sword', power: 19, speed: 0.5, chop: 1, rank: 2, effect: { id: 'bleed', chance: 0.2 }, price: 650, text: 'Well balanced steel.' },
  war_axe: { name: 'War Axe', icon: '🪓', kind: 'weapon', type: 'axe', power: 24, speed: 0.7, chop: 4, rank: 2, effect: { id: 'bleed', chance: 0.25 }, price: 950, text: 'Fells trees and foes alike.' },
  crystal_staff: { name: 'Crystal Staff', icon: '🔮', kind: 'weapon', type: 'staff', power: 26, speed: 0.6, chop: 0.8, magic: true, rank: 3, effect: { id: 'frost', chance: 0.3 }, price: 1800, text: 'A staff topped with a singing crystal.' },
  knight_blade: { name: 'Knight\'s Blade', icon: '⚔️', kind: 'weapon', type: 'sword', power: 32, speed: 0.5, chop: 1, rank: 3, effect: { id: 'drain', chance: 1 }, price: 2200, text: 'Forged for the realm\'s knights.' },
  iron_spear: { name: 'Iron Spear', icon: '🔱', kind: 'weapon', type: 'spear', power: 10, speed: 0.6, chop: 0.6, rank: 1, price: 140, text: 'A long ash shaft with an iron head. Keeps foes at a distance.' },
  steel_glaive: { name: 'Steel Glaive', icon: '🔱', kind: 'weapon', type: 'spear', power: 22, speed: 0.65, chop: 1, rank: 2, effect: { id: 'bleed', chance: 0.2 }, price: 1000, text: 'A curved blade on a long pole: the longest, widest reach in the shop.' },
  dragonbone_sword: { name: 'Dragonbone Sword', icon: '🐉', kind: 'weapon', type: 'sword', power: 60, speed: 0.5, chop: 1.2, rank: 4, effect: { id: 'burn', chance: 0.35 }, price: 15000, text: 'Carved from an ancient dragon\'s bone.' },
};
for (const [id, it] of Object.entries(ITEMS)) it.id = id;

// How far and how wide each kind of weapon hits. reach is metres beyond your body; arc is half the
// angle of the swing in radians (wider arcs catch foes to the side); hits is how many foes one swing
// can catch (the first takes full damage, the rest 70%); sharp multiplies damage (short blades hit harder).
const REACH = {
  fist: { reach: 0.9, arc: 0.8, hits: 1, sharp: 1 },
  dagger: { reach: 1.1, arc: 0.6, hits: 1, sharp: 1.3 },
  sword: { reach: 1.6, arc: 1.0, hits: 2, sharp: 1 },
  axe: { reach: 1.6, arc: 1.0, hits: 2, sharp: 1 },
  club: { reach: 1.5, arc: 1.1, hits: 2, sharp: 1 },
  mace: { reach: 1.5, arc: 1.15, hits: 2, sharp: 1 },
  staff: { reach: 2.0, arc: 1.1, hits: 2, sharp: 1 },
  spear: { reach: 2.5, arc: 1.1, hits: 2, sharp: 1 },
};
// some weapons are longer than others of their kind
const LONGER = { steel_sword: 0.15, knight_blade: 0.3, dragonbone_sword: 0.5, war_axe: 0.4, crystal_staff: 0.3, steel_glaive: 0.5 };
export function weaponReach(it) {
  const r = { ...(REACH[it?.type] || REACH.fist) };
  const extra = LONGER[it?.id] || 0;
  r.reach += extra;
  r.arc += extra * 0.4;
  if (extra >= 0.3) r.hits += 1;
  return r;
}
export function reachText(it) {
  const r = weaponReach(it);
  const width = r.arc >= 1.25 ? 'very wide' : r.arc >= 1.05 ? 'wide' : r.arc >= 0.9 ? 'medium' : 'narrow';
  return `Reach ${r.reach.toFixed(1)} m · ${width} swing${r.hits > 1 ? ` (up to ${r.hits} foes)` : ''}${r.sharp > 1 ? ` · sharp: +${Math.round((r.sharp - 1) * 100)}% damage` : ''}`;
}

// Weapon ranks, from plain to legendary. Merging evolves a weapon: every 3 upgrades it climbs a rank.
export const RANKS = [
  { name: 'Common', color: '#b9b9b9' }, { name: 'Uncommon', color: '#62c462' }, { name: 'Rare', color: '#4a9cff' },
  { name: 'Epic', color: '#b562ff' }, { name: 'Legendary', color: '#ffae2e' }, { name: 'Mythic', color: '#ff5050' },
];
const STAGE_NAMES = ['', 'Honed', 'Awakened', 'Ascended'];
export const evolveStage = (plus = 0) => (plus >= 9 ? 3 : plus >= 6 ? 2 : plus >= 3 ? 1 : 0);
export const rankOf = (it, plus = 0) => Math.min(RANKS.length - 1, (it.rank || 0) + (it.kind === 'weapon' ? evolveStage(plus) : 0));
export const evolvedName = (it, plus = 0) => (it.kind === 'weapon' && evolveStage(plus) ? `${STAGE_NAMES[evolveStage(plus)]} ${it.name}` : it.name);

// What a hit can do to a foe. Weapons of higher rank have one built in; coatings add one for a while.
// poison/burn/bleed hurt a foe each second; frost slows it; drain heals you by part of the damage.
export const EFFECTS = {
  poison: { name: 'Poison', icon: '☠️', dot: 0.12, secs: 6, text: 'poison the foe for 6 s' },
  burn: { name: 'Burn', icon: '🔥', dot: 0.2, secs: 4, text: 'set the foe burning for 4 s' },
  bleed: { name: 'Bleed', icon: '🩸', dot: 0.1, secs: 5, text: 'make the foe bleed for 5 s' },
  frost: { name: 'Frost', icon: '❄️', slow: 0.5, secs: 3, text: 'slow the foe to half speed for 3 s' },
  drain: { name: 'Life Drain', icon: '🩸', heal: 0.08, text: 'heal you by 8% of the damage', always: 'every hit heals you by 8% of the damage' },
};
// the effect a weapon gains when it first evolves, if it had none
const TYPE_EFFECT = { sword: 'bleed', axe: 'bleed', spear: 'bleed', dagger: 'poison', club: 'frost', mace: 'frost', staff: 'burn' };
// A weapon's own effect: built in, or gained by evolving. Each later stage makes it fire more often.
export function weaponEffect(it, plus = 0) {
  const stage = evolveStage(plus);
  const base = it.effect || (stage ? { id: TYPE_EFFECT[it.type] || 'bleed', chance: 0.15 } : null);
  if (!base) return null;
  const bonus = Math.max(0, stage - (it.effect ? 0 : 1)) * 0.1;
  return { id: base.id, chance: Math.min(1, base.chance + bonus), power: 1 + stage * 0.25 };
}
export function effectText(it, plus = 0) {
  const e = weaponEffect(it, plus);
  if (!e) return '';
  const fx = EFFECTS[e.id];
  return `${fx.icon} ${fx.name}: ${e.chance >= 1 ? fx.always || `${fx.text} on every hit` : `${Math.round(e.chance * 100)}% chance to ${fx.text}`}`;
}

// Merging gets dearer as a weapon climbs: coins and monster parts, more for each rank and upgrade
const MERGE_PARTS = [null, 'goblin_ear', 'lizard_scale', 'serpent_fang', 'frost_core', 'drake_horn'];
export function mergeCost(it, plus = 0) {
  const r = rankOf(it, plus);
  const coins = Math.round(25 * (r + 1) ** 2 * (plus + 1));
  const part = MERGE_PARTS[r];
  return { coins, needs: part ? [[part, Math.ceil((plus + 1) / 2) + r]] : [] };
}

// What the shop sells, and the level at which each item unlocks
export const SHOP = [
  // potions and food
  ['water_flask', 1], ['apple', 1], ['bread', 1], ['herb', 1], ['roast_meat', 4], ['stew', 12], ['torch', 1], ['tent', 1], ['sp_potion', 2], ['calm_draught', 2], ['poison_potion', 3], ['potion', 5], ['sp_booster', 5],
  ['swift_potion', 5], ['strength_potion', 6], ['stone_potion', 6], ['fire_oil', 8], ['frost_oil', 8], ['big_potion', 20],
  // weapons
  ['wooden_club', 1], ['rusty_sword', 1], ['hand_axe', 3], ['iron_dagger', 3], ['oak_staff', 3], ['iron_sword', 5],
  ['iron_spear', 6], ['iron_mace', 8], ['steel_sword', 12], ['war_axe', 15], ['steel_glaive', 16], ['crystal_staff', 20], ['knight_blade', 20], ['dragonbone_sword', 50],
  // armour
  ['leather_cap', 1], ['cloth_tunic', 1], ['leather_boots', 1], ['leather_pants', 2], ['wooden_shield', 2],
  ['leather_armor', 3], ['mage_hat', 3], ['mage_robe', 5], ['iron_helm', 6], ['iron_boots', 6], ['chainmail', 8],
  ['chain_leggings', 8], ['iron_shield', 8], ['steel_helm', 15], ['steel_plate', 15], ['steel_greaves', 15],
  ['steel_boots', 15], ['tower_shield', 18], ['knight_helm', 25], ['knight_plate', 25],
];

export const SLOTS = [['weapon', 'Weapon'], ['head', 'Head'], ['body', 'Body'], ['legs', 'Legs'], ['feet', 'Feet'], ['shield', 'Shield']];
export const isGear = (it) => it && (it.kind === 'weapon' || it.kind === 'armour');
export const slotOf = (it) => (it.kind === 'weapon' ? 'weapon' : it.slot);

// Sell price: the shop buys things back for 40% of what it sells them for, more for upgraded gear
// Shops buy at 40% of their price; a Businessman knows how to bargain and gets 70%
export const SELL_SHARE = 0.4, BUSINESS_SHARE = 0.7;
export const sellPrice = (it, plus = 0, cls = null) => Math.max(1, Math.floor(it.price * (cls === 'businessman' ? BUSINESS_SHARE : SELL_SHARE) * (1 + plus * 0.5)));

// Upgrades from merging: each + makes a weapon or armour 12% stronger
export const UPGRADE_STEP = 0.12;
export const MAX_PLUS = 10;
export const upgraded = (value, plus = 0) => Math.round(value * (1 + plus * UPGRADE_STEP));

// Blacksmith merging: two items of the same category (both weapons, or armour for the same slot)
// make the first one +1 stronger. If they are the same type too (a sword and a sword), the first
// also keeps the second's upgrades.
export function mergeResult(a, b) {
  const A = ITEMS[a.id], B = ITEMS[b.id];
  if (!isGear(A) || !isGear(B) || slotOf(A) !== slotOf(B)) return null;
  const sameType = A.kind === 'weapon' ? A.type === B.type : a.id === b.id;
  return Math.min(MAX_PLUS, (a.plus || 0) + 1 + (sameType ? b.plus || 0 : 0));
}

// What kind of thing an item is, for the shop and the Blacksmith: weapons merge with weapons (the
// same type, a sword with a sword, also carries the upgrades over), armour with armour for the same
// part of the body.
const TYPE_NAMES = { sword: 'Sword', axe: 'Axe', club: 'Club', dagger: 'Dagger', mace: 'Mace', spear: 'Spear', staff: 'Staff' };
const SLOT_NAMES = { head: 'Helmet', body: 'Chest armour', legs: 'Leg armour', feet: 'Boots', shield: 'Shield' };
export function categoryOf(it) {
  if (it.kind === 'weapon') return { cat: 'Weapon', sub: TYPE_NAMES[it.type] || 'Weapon' };
  if (it.kind === 'armour') return { cat: 'Armour', sub: SLOT_NAMES[it.slot] || 'Armour' };
  if (it.kind === 'coating') return { cat: 'Coating', sub: 'For weapons' };
  if (it.kind === 'food') return { cat: it.heal || it.sp ? 'Food & drink' : 'Potion', sub: null };
  if (it.kind === 'seed') return { cat: 'Seeds', sub: null };
  return { cat: 'Material', sub: it.rank != null ? 'Ore' : null };
}

// Forging: a Blacksmith makes weapons and armour from ore and coins. Better and higher-ranked
// pieces cost a lot more, and need rarer ore.
const FORGE_ORE = ['iron_ore', 'iron_ore', 'silver_ore', 'gold_ore', 'ruby', 'dragonite'];
export function forgeCost(it) {
  const r = it.rank || 0;
  return { coins: Math.round((it.price * 0.45 * (1 + r * 0.6)) / 5) * 5, needs: [[FORGE_ORE[r], 2 + r * 2], ...(r >= 2 ? [['iron_ore', 3]] : [])] };
}

// Things you can make from what you carry
export const RECIPES = [
  { makes: 'wooden_club', needs: [['log', 3]] },
  { makes: 'tent', needs: [['log', 8]] },
];

// The weapon each class starts with in the bag
export const STARTER_ITEMS = {
  swordsman: [['rusty_sword', 1]], assassin: [['iron_dagger', 1]], tank: [['wooden_club', 1]], mage: [['oak_staff', 1]],
  healer: [['oak_staff', 1]], blacksmith: [['hand_axe', 1]], builder: [['hand_axe', 1]], farmer: [['hand_axe', 1]],
  businessman: [['wooden_club', 1]], potion_maker: [['oak_staff', 1], ['herb', 5]],
};

// Brewing: only the Potion Maker class brews. Each potion needs herbs and a few coins (far less
// than the shop asks), and two elixirs can't be bought anywhere. (fee and minutes are no longer used.)
export const POTION_MAKER = { fee: 150, minutes: 30, queue: 5, share: 0.45 };
export const BREWS = ['potion', 'big_potion', 'sp_potion', 'calm_draught', 'strength_potion', 'stone_potion', 'swift_potion',
  'poison_potion', 'fire_oil', 'frost_oil', 'elixir_might', 'elixir_life'];
export const brewCost = (id) => Math.round(ITEMS[id].price * POTION_MAKER.share);
// herbs each brew needs (the Potion Maker's raw material)
export const brewHerbs = (id) => (ITEMS[id].brewOnly ? 6 : ITEMS[id].price >= 150 ? 4 : ITEMS[id].price >= 60 ? 2 : 1);
export const brewSeconds = (id) => (ITEMS[id].brewOnly ? 90 : 20);

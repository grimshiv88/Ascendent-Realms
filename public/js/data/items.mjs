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
  // food and potions
  torch: { name: 'Torch', icon: '🔥', kind: 'material', price: 12, text: 'Stand it in the ground with T. Its light keeps monsters away at night, and lets you sleep (Z) beside it.' },
  tent: { name: 'Tent', icon: '⛺', kind: 'material', price: 60, text: 'Pitch it anywhere (P, or from your bag) and sleep inside it (Z) to clear your Fatigue. Monsters leave you alone near it. Pack it up again when you move on.' },
  bread: { name: 'Bread', icon: '🍞', kind: 'food', heal: 25, price: 6, text: 'Restores 25 HP.' },
  herb: { name: 'Healing Herb', icon: '🌿', kind: 'food', heal: 50, price: 15, text: 'Restores 50 HP.' },
  potion: { name: 'Health Potion', icon: '🧪', kind: 'food', heal: 150, price: 45, text: 'Restores 150 HP.' },
  big_potion: { name: 'Greater Health Potion', icon: '⚗️', kind: 'food', heal: 500, price: 160, text: 'Restores 500 HP.' },
  sp_potion: { name: 'SP Potion', icon: '🔵', kind: 'food', sp: 60, price: 30, text: 'Restores 60 SP.' },
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
  wooden_club: { name: 'Wooden Club', icon: '🏏', kind: 'weapon', type: 'club', power: 4, speed: 0.6, chop: 1.5, price: 20, text: 'A heavy stick. Better than fists.' },
  rusty_sword: { name: 'Rusty Sword', icon: '🗡️', kind: 'weapon', type: 'sword', power: 6, speed: 0.55, chop: 1, price: 40, text: 'Old, but still sharp enough.' },
  hand_axe: { name: 'Hand Axe', icon: '🪓', kind: 'weapon', type: 'axe', power: 8, speed: 0.65, chop: 3, price: 90, text: 'Chops young trees in one or two swings.' },
  iron_dagger: { name: 'Iron Dagger', icon: '🔪', kind: 'weapon', type: 'dagger', power: 7, speed: 0.35, chop: 0.7, price: 75, text: 'Quick, light strikes.' },
  oak_staff: { name: 'Oak Staff', icon: '🪄', kind: 'weapon', type: 'staff', power: 8, speed: 0.6, chop: 0.8, magic: true, price: 90, text: 'Channels magic: uses MATK.' },
  iron_sword: { name: 'Iron Sword', icon: '⚔️', kind: 'weapon', type: 'sword', power: 11, speed: 0.55, chop: 1, price: 160, text: 'A soldier\'s blade.' },
  iron_mace: { name: 'Iron Mace', icon: '🔨', kind: 'weapon', type: 'mace', power: 14, speed: 0.75, chop: 1.6, price: 260, text: 'Slow, crushing blows.' },
  steel_sword: { name: 'Steel Sword', icon: '⚔️', kind: 'weapon', type: 'sword', power: 19, speed: 0.5, chop: 1, price: 650, text: 'Well balanced steel.' },
  war_axe: { name: 'War Axe', icon: '🪓', kind: 'weapon', type: 'axe', power: 24, speed: 0.7, chop: 4, price: 950, text: 'Fells trees and foes alike.' },
  crystal_staff: { name: 'Crystal Staff', icon: '🔮', kind: 'weapon', type: 'staff', power: 26, speed: 0.6, chop: 0.8, magic: true, price: 1800, text: 'A staff topped with a singing crystal.' },
  knight_blade: { name: 'Knight\'s Blade', icon: '⚔️', kind: 'weapon', type: 'sword', power: 32, speed: 0.5, chop: 1, price: 2200, text: 'Forged for the realm\'s knights.' },
  dragonbone_sword: { name: 'Dragonbone Sword', icon: '🐉', kind: 'weapon', type: 'sword', power: 60, speed: 0.5, chop: 1.2, price: 15000, text: 'Carved from an ancient dragon\'s bone.' },
};
for (const [id, it] of Object.entries(ITEMS)) it.id = id;

// What the shop sells, and the level at which each item unlocks
export const SHOP = [
  // potions and food
  ['bread', 1], ['herb', 1], ['torch', 1], ['tent', 1], ['sp_potion', 2], ['potion', 5], ['sp_booster', 5], ['big_potion', 20],
  // weapons
  ['wooden_club', 1], ['rusty_sword', 1], ['hand_axe', 3], ['iron_dagger', 3], ['oak_staff', 3], ['iron_sword', 5],
  ['iron_mace', 8], ['steel_sword', 12], ['war_axe', 15], ['crystal_staff', 20], ['knight_blade', 20], ['dragonbone_sword', 50],
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

// Things you can make from what you carry
export const RECIPES = [
  { makes: 'wooden_club', needs: [['log', 3]] },
  { makes: 'tent', needs: [['log', 8]] },
];

// The weapon each class starts with in the bag
export const STARTER_ITEMS = {
  swordsman: [['rusty_sword', 1]], assassin: [['iron_dagger', 1]], tank: [['wooden_club', 1]], mage: [['oak_staff', 1]],
  healer: [['oak_staff', 1]], blacksmith: [['hand_axe', 1]], builder: [['hand_axe', 1]], farmer: [['hand_axe', 1]],
  businessman: [['wooden_club', 1]],
};

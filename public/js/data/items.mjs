// Every item in the game: materials you gather, food, potions, weapons and armour, plus the shop list.

// kind: 'material' | 'food' | 'weapon' | 'armour'. price is what the shop charges; it buys things back for less.
// Armour: slot is where it is worn (head, body, legs, feet, shield); def and mdef add to defence;
// look is the colour and material it is drawn with.
// Weapons: type picks the 3D model and swing; power adds to damage; speed is seconds between swings;
// chop multiplies damage to trees and bushes; magic weapons use MATK instead of ATK.
import { SKILLS } from './skills.mjs';

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
  copper_ore: { name: 'Copper Ore', icon: '🟠', kind: 'material', rank: 1, price: 3, text: 'Soft reddish ore, common in shallow caves. Minted into Copper coins, or forged into cheap copper gear.' },
  iron_ore: { name: 'Iron Ore', icon: '⚫', kind: 'material', rank: 1, price: 14, text: 'The smith\'s bread and butter.' },
  crystal_shard: { name: 'Crystal Shard', icon: '🔷', kind: 'material', rank: 2, price: 22, text: 'A shard of the glowing crystal that lights the caves.' },
  silver_ore: { name: 'Silver Ore', icon: '🩶', kind: 'material', rank: 2, price: 30, text: 'Bright ore that monsters seem to fear. Four of them mint a Silver coin.' },
  gold_ore: { name: 'Gold Ore', icon: '🪙', kind: 'material', rank: 3, price: 120, text: 'Heavy, soft and valuable. Each one mints a Silver coin; a hundred of them, a Gold coin.' },
  emerald: { name: 'Emerald', icon: '💚', kind: 'material', rank: 3, price: 90, text: 'A green gem from the damp hollows of the Mire.' },
  sapphire: { name: 'Sapphire', icon: '💙', kind: 'material', rank: 3, price: 110, text: 'A deep blue gem, cold to the touch.' },
  ruby: { name: 'Ruby', icon: '❤️', kind: 'material', rank: 4, price: 180, text: 'A blood-red gem that glows faintly in the dark. Found only deep in high-level Dungeons.' },
  // the Order of the Dawn's gift to those who become Light: it can't be sold or traded
  dawn_book: { name: 'Book of the Dawn', icon: '📖', kind: 'material', price: 0, bound: true, text: 'A worn holy book. Kept in your bag, it stops Dark Side spells that hit you. Its level is your Intelligence: the whole hit when that reaches the spell\'s strength, part of it otherwise.' },
  moonstone: { name: 'Moonstone', icon: '🌙', kind: 'material', rank: 5, price: 450, text: 'Found only in the deepest chambers of high-level Dungeons. Said to hold moonlight.' },
  diamond: { name: 'Diamond', icon: '💎', kind: 'material', rank: 5, price: 800, text: 'The hardest stone there is. Set into an edge, it never dulls. Found only deep in high-level Dungeons: drake lairs, warrens and glimmer caves.' },
  orichalcum: { name: 'Orichalcum', icon: '🔶', kind: 'material', rank: 6, price: 1500, text: 'A legendary red-gold metal, lighter than steel and harder than diamond. Found only in the deepest chambers of high-level Dungeons.' },
  dragonite: { name: 'Dragonite', icon: '🐲', kind: 'material', rank: 5, price: 600, text: 'Ore fused by dragon fire. Only high-level drake Dungeons hold it.' },
  // food and potions
  torch: { name: 'Torch', icon: '🔥', kind: 'material', price: 12, text: 'Stand it in the ground with T; press T beside it to pick it back up. In the dark caves, T lights it in your hand instead. Its light keeps monsters away at night, and lets you sleep (Z) beside it.' },
  tent: { name: 'Tent', icon: '⛺', kind: 'material', price: 60, text: 'Pitch it anywhere (P, or from your bag) and sleep inside it (Z) to clear your Fatigue. Monsters leave you alone near it. Pack it up again when you move on.' },
  water_flask: { name: 'Water Flask', icon: '🫗', kind: 'food', heal: 12, price: 2, text: 'A drink of clean water. Restores 12 HP.' },
  apple: { name: 'Apple', icon: '🍎', kind: 'food', heal: 18, price: 3, text: 'Crisp and sweet. Restores 18 HP.' },
  bread: { name: 'Bread', icon: '🍞', kind: 'food', heal: 25, price: 6, text: 'Restores 25 HP.' },
  herbal_tea: { name: 'Herbal Tea', icon: '🍵', kind: 'food', sp: 15, price: 4, text: 'A warm cup that clears the head. Restores 15 SP.' },
  honey_cake: { name: 'Honey Cake', icon: '🍯', kind: 'food', sp: 35, heal: 10, price: 12, text: 'Sweet and filling. Restores 35 SP and 10 HP.' },
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
  leather_cap: { name: 'Leather Cap', icon: '🧢', kind: 'armour', rank: 0, slot: 'head', def: 2, price: 25, look: { color: '#6b4a2e' }, text: 'A simple leather cap.' },
  cloth_tunic: { name: 'Cloth Tunic', icon: '👕', kind: 'armour', rank: 0, slot: 'body', def: 3, price: 30, look: { color: '#5a6a8a' }, text: 'Better than nothing.' },
  leather_boots: { name: 'Leather Boots', icon: '🥾', kind: 'armour', rank: 0, slot: 'feet', def: 2, price: 25, look: { color: '#5a3a22' }, text: 'Sturdy walking boots.' },
  leather_pants: { name: 'Leather Trousers', icon: '👖', kind: 'armour', rank: 0, slot: 'legs', def: 3, price: 45, look: { color: '#5e4430' }, text: 'Tough leather trousers.' },
  wooden_shield: { name: 'Wooden Shield', icon: '🛡️', kind: 'armour', rank: 0, slot: 'shield', def: 4, price: 50, look: { color: '#7a5634' }, text: 'Planks bound with iron.' },
  leather_armor: { name: 'Leather Armour', icon: '🦺', kind: 'armour', rank: 1, slot: 'body', def: 6, price: 90, look: { color: '#6b4a2e' }, text: 'Hardened leather.' },
  mage_hat: { name: 'Mage Hat', icon: '🎩', kind: 'armour', rank: 1, slot: 'head', def: 1, mdef: 5, price: 80, look: { color: '#3a2a6a', hat: true }, text: 'A pointed hat that wards off spells.' },
  mage_robe: { name: 'Mage Robe', icon: '🥻', kind: 'armour', slot: 'body', rank: 2, def: 3, mdef: 10, price: 200, look: { color: '#3a2a6a', robe: true }, text: 'Woven with protective runes.' },
  iron_helm: { name: 'Iron Helm', icon: '⛑️', kind: 'armour', slot: 'head', rank: 2, def: 6, price: 140, look: { color: '#8f949c', metal: true }, text: 'A solid iron helmet.' },
  iron_boots: { name: 'Iron Boots', icon: '🥾', kind: 'armour', slot: 'feet', rank: 2, def: 5, price: 120, look: { color: '#8f949c', metal: true }, text: 'Heavy iron-shod boots.' },
  chainmail: { name: 'Chainmail', icon: '🦺', kind: 'armour', slot: 'body', rank: 2, def: 12, price: 320, look: { color: '#9aa0a8', metal: true }, text: 'Thousands of iron rings.' },
  chain_leggings: { name: 'Chain Leggings', icon: '👖', kind: 'armour', slot: 'legs', rank: 2, def: 8, price: 220, look: { color: '#9aa0a8', metal: true }, text: 'Chainmail for the legs.' },
  iron_shield: { name: 'Iron Shield', icon: '🛡️', kind: 'armour', slot: 'shield', rank: 2, def: 9, price: 260, look: { color: '#8f949c', metal: true }, text: 'A round iron shield.' },
  steel_helm: { name: 'Steel Helm', icon: '⛑️', kind: 'armour', slot: 'head', rank: 3, def: 12, price: 600, look: { color: '#c0c6ce', metal: true }, text: 'Polished steel.' },
  steel_plate: { name: 'Steel Plate', icon: '🦺', kind: 'armour', slot: 'body', rank: 3, def: 22, price: 1100, look: { color: '#c0c6ce', metal: true }, text: 'Full steel breastplate.' },
  steel_greaves: { name: 'Steel Greaves', icon: '👖', kind: 'armour', slot: 'legs', rank: 3, def: 15, price: 800, look: { color: '#c0c6ce', metal: true }, text: 'Steel leg plates.' },
  steel_boots: { name: 'Steel Boots', icon: '🥾', kind: 'armour', slot: 'feet', rank: 3, def: 9, price: 500, look: { color: '#c0c6ce', metal: true }, text: 'Steel sabatons.' },
  tower_shield: { name: 'Tower Shield', icon: '🛡️', kind: 'armour', slot: 'shield', rank: 3, def: 18, price: 1200, look: { color: '#b0b6be', metal: true }, text: 'A wall you can carry.' },
  knight_helm: { name: 'Knight\'s Helm', icon: '👑', kind: 'armour', slot: 'head', rank: 4, def: 20, mdef: 5, price: 1800, look: { color: '#d9c27a', metal: true }, text: 'Gold-trimmed and plumed.' },
  knight_plate: { name: 'Knight\'s Plate', icon: '🦺', kind: 'armour', slot: 'body', rank: 4, def: 34, mdef: 8, price: 3000, look: { color: '#d9c27a', metal: true }, text: 'Armour of the realm\'s knights.' },
  // Central City food hall and tavern: all halal. Meals heal and give a short buff.
  lentil_soup: { name: 'Lentil Soup', icon: '🥣', kind: 'food', heal: 60, rest: 10, price: 18, text: 'Warm and filling. Restores 60 HP and eases Fatigue a little.' },
  falafel_wrap: { name: 'Falafel Wrap', icon: '🌯', kind: 'food', heal: 90, buff: { stat: 'speed', pct: 10, minutes: 5 }, price: 30, text: 'Restores 90 HP and +10% speed for 5 minutes.' },
  lamb_kebab: { name: 'Lamb Kebab', icon: '🍢', kind: 'food', heal: 140, buff: { stat: 'atk', pct: 10, minutes: 5 }, price: 45, text: 'Grilled halal lamb. Restores 140 HP and +10% ATK for 5 minutes.' },
  chicken_rice: { name: 'Spiced Chicken and Rice', icon: '🍛', kind: 'food', heal: 220, buff: { stat: 'def', pct: 10, minutes: 5 }, price: 70, text: 'Halal chicken on saffron rice. Restores 220 HP and +10% DEF for 5 minutes.' },
  date_bowl: { name: 'Dates and Honey', icon: '🍯', kind: 'food', sp: 40, heal: 20, price: 22, text: 'Sweet and quick. Restores 40 SP and 20 HP.' },
  mint_tea: { name: 'Mint Tea', icon: '🫖', kind: 'food', sp: 25, rest: 15, price: 10, text: 'Fresh mint tea. Restores 25 SP and eases Fatigue.' },
  fruit_juice: { name: 'Fresh Fruit Juice', icon: '🧃', kind: 'food', sp: 30, heal: 30, price: 14, text: 'Pressed this morning. Restores 30 SP and 30 HP.' },
  ayran: { name: 'Ayran', icon: '🥛', kind: 'food', heal: 35, rest: 20, price: 9, text: 'A cool salted yogurt drink. Restores 35 HP and eases Fatigue.' },
  // clothes: worn for looks, not protection (a little DEF at most)
  linen_shirt: { name: 'Linen Shirt', icon: '👕', kind: 'armour', slot: 'body', rank: 0, def: 1, fashion: true, price: 35, look: { color: '#e8e0cc' }, text: 'Light, clean linen.' },
  embroidered_tunic: { name: 'Embroidered Tunic', icon: '👘', kind: 'armour', slot: 'body', rank: 1, def: 1, fashion: true, price: 120, look: { color: '#7a2a3a' }, text: 'Gold thread at the collar and cuffs.' },
  silk_robe: { name: 'Silk Robe', icon: '🥻', kind: 'armour', slot: 'body', rank: 2, def: 1, fashion: true, price: 380, look: { color: '#2a4a8a', robe: true }, text: 'Long, flowing and very fine.' },
  wide_trousers: { name: 'Wide Trousers', icon: '👖', kind: 'armour', slot: 'legs', rank: 0, def: 1, fashion: true, price: 30, look: { color: '#4a4038' }, text: 'Loose and comfortable.' },
  felt_hat: { name: 'Felt Hat', icon: '🎩', kind: 'armour', slot: 'head', rank: 0, def: 0, fashion: true, price: 25, look: { color: '#5a3a2a', hat: true }, text: 'A soft felt hat.' },
  turban: { name: 'Turban', icon: '👳', kind: 'armour', slot: 'head', rank: 1, def: 0, fashion: true, price: 60, look: { color: '#f0ece0' }, text: 'Neatly wound white cloth.' },
  sandals: { name: 'Sandals', icon: '🩴', kind: 'armour', slot: 'feet', rank: 0, def: 0, fashion: true, price: 15, look: { color: '#8a6a4a' }, text: 'For warm days in the city.' },
  riding_boots: { name: 'Riding Boots', icon: '👢', kind: 'armour', slot: 'feet', rank: 1, def: 1, fashion: true, price: 90, look: { color: '#2a1e16' }, text: 'Tall, polished leather.' },
  // weapons
  // forged only: blacksmiths make these, no shop sells them. `model` borrows another weapon's shape.
  copper_sword: { name: 'Copper Sword', icon: '🗡️', kind: 'weapon', type: 'sword', model: 'iron_sword', metal: 'copper', ore: 'copper_ore', power: 3, speed: 0.55, chop: 0.8, rank: 0, price: 18, forged: true, text: 'Soft copper, beaten into a blade. It bends, but it cuts.' },
  copper_dagger: { name: 'Copper Dagger', icon: '🔪', kind: 'weapon', type: 'dagger', model: 'iron_dagger', metal: 'copper', ore: 'copper_ore', power: 2, speed: 0.36, chop: 0.4, rank: 0, price: 14, forged: true, text: 'A little copper knife. Quick, if not deadly.' },
  copper_hatchet: { name: 'Copper Hatchet', icon: '🪓', kind: 'weapon', type: 'axe', model: 'hand_axe', metal: 'copper', ore: 'copper_ore', power: 3, speed: 0.65, chop: 2, rank: 0, price: 20, forged: true, text: 'A copper head on an ash handle. Good for firewood.' },
  copper_cap: { name: 'Copper Cap', icon: '⛑️', kind: 'armour', slot: 'head', rank: 0, def: 1, ore: 'copper_ore', price: 14, forged: true, look: { color: '#c0703a', metal: true }, text: 'A thin copper bowl with a leather lining.' },
  copper_buckler: { name: 'Copper Buckler', icon: '🛡️', kind: 'armour', slot: 'shield', rank: 0, def: 2, ore: 'copper_ore', price: 20, forged: true, look: { color: '#c0703a', metal: true }, text: 'A small round shield of hammered copper.' },
  crude_dagger: { name: 'Crude Dagger', icon: '🔪', kind: 'weapon', type: 'dagger', model: 'iron_dagger', power: 5, speed: 0.38, chop: 0.5, rank: 0, price: 30, forged: true, text: 'A sharpened iron spike with a leather grip.' },
  copper_spear: { name: 'Copper Spear', icon: '🔱', kind: 'weapon', type: 'spear', model: 'iron_spear', metal: 'copper', ore: 'copper_ore', power: 6, speed: 0.6, chop: 0.5, rank: 0, price: 45, forged: true, text: 'A copper point on a straight pole.' },
  willow_staff: { name: 'Willow Staff', icon: '🪄', kind: 'weapon', type: 'staff', power: 6, speed: 0.6, chop: 0.6, magic: true, rank: 0, price: 50, forged: true, text: 'A bent willow rod bound with copper wire.' },
  hide_vest: { name: 'Hide Vest', icon: '🦺', kind: 'armour', slot: 'body', rank: 0, def: 4, price: 40, forged: true, look: { color: '#7a5a3a' }, text: 'Tanned hide, stitched tight.' },
  bronze_sword: { name: 'Bronze Sword', icon: '🗡️', kind: 'weapon', type: 'sword', model: 'iron_sword', power: 8, speed: 0.55, chop: 1, rank: 1, price: 70, forged: true, text: 'A smith\'s first good blade.' },
  stone_maul: { name: 'Stone Maul', icon: '🔨', kind: 'weapon', type: 'mace', model: 'iron_mace', power: 10, speed: 0.8, chop: 1.4, rank: 1, price: 80, forged: true, text: 'An iron-bound stone on a thick haft.' },
  hunting_spear: { name: 'Hunting Spear', icon: '🔱', kind: 'weapon', type: 'spear', model: 'iron_spear', power: 8, speed: 0.6, chop: 0.6, rank: 1, price: 75, forged: true, text: 'Light, with a barbed iron head.' },
  bronze_helm: { name: 'Bronze Helm', icon: '⛑️', kind: 'armour', slot: 'head', rank: 1, def: 4, price: 70, forged: true, look: { color: '#b07a3a', metal: true }, text: 'Hammered bronze.' },
  bronze_cuirass: { name: 'Bronze Cuirass', icon: '🦺', kind: 'armour', slot: 'body', rank: 1, def: 8, price: 130, forged: true, look: { color: '#b07a3a', metal: true }, text: 'A bronze chest plate.' },
  tempered_sword: { name: 'Tempered Sword', icon: '🗡️', kind: 'weapon', type: 'sword', model: 'iron_sword', power: 14, speed: 0.52, chop: 1, rank: 2, price: 300, forged: true, text: 'Iron folded and quenched until it rings.' },
  iron_waraxe: { name: 'Iron War Axe', icon: '🪓', kind: 'weapon', type: 'axe', model: 'war_axe', power: 16, speed: 0.7, chop: 2.5, rank: 2, price: 340, forged: true, text: 'A broad iron head that bites deep.' },
  iron_cuirass: { name: 'Iron Cuirass', icon: '🦺', kind: 'armour', slot: 'body', rank: 2, def: 15, price: 420, forged: true, look: { color: '#7d838c', metal: true }, text: 'Riveted iron plates.' },
  runed_sword: { name: 'Runed Steel Sword', icon: '⚔️', kind: 'weapon', type: 'sword', model: 'steel_sword', power: 27, speed: 0.5, chop: 1, rank: 3, effect: { id: 'bleed', chance: 0.25 }, price: 1300, forged: true, text: 'Steel etched with sharpening runes.' },
  steel_warhammer: { name: 'Steel Warhammer', icon: '🔨', kind: 'weapon', type: 'mace', model: 'iron_mace', power: 31, speed: 0.8, chop: 1.8, rank: 3, effect: { id: 'frost', chance: 0.15 }, price: 1400, forged: true, text: 'Heavy enough to stagger a troll.' },
  runed_plate: { name: 'Runed Plate', icon: '🦺', kind: 'armour', slot: 'body', rank: 3, def: 28, mdef: 6, price: 1800, forged: true, look: { color: '#a9b4c4', metal: true }, text: 'Steel plate with warding runes.' },
  runeblade: { name: 'Runeblade', icon: '⚔️', kind: 'weapon', type: 'sword', model: 'knight_blade', power: 46, speed: 0.48, chop: 1.1, rank: 4, effect: { id: 'drain', chance: 1 }, price: 5200, forged: true, text: 'Its runes drink a little life with every cut.' },
  titan_axe: { name: 'Titan Axe', icon: '🪓', kind: 'weapon', type: 'axe', model: 'war_axe', power: 54, speed: 0.75, chop: 4, rank: 4, effect: { id: 'bleed', chance: 0.3 }, price: 6000, forged: true, text: 'Made for giants; a strong arm can swing it.' },
  runic_aegis: { name: 'Runic Aegis', icon: '🛡️', kind: 'armour', slot: 'shield', rank: 4, def: 30, mdef: 12, price: 5500, forged: true, look: { color: '#8fa8d8', metal: true }, text: 'A shield that hums when spells come near.' },
  diamond_edge: { name: 'Diamond Edge', icon: '⚔️', kind: 'weapon', type: 'sword', model: 'knight_blade', metal: 'diamond', ore: 'diamond', power: 50, speed: 0.47, chop: 1.2, rank: 4, effect: { id: 'bleed', chance: 0.35 }, price: 6500, forged: true, text: 'Steel with a cutting edge of set diamonds. It never dulls.' },
  orichalcum_blade: { name: 'Orichalcum Blade', icon: '⚔️', kind: 'weapon', type: 'sword', model: 'knight_blade', metal: 'orichalcum', ore: 'orichalcum', power: 84, speed: 0.45, chop: 1.3, rank: 5, effect: { id: 'burn', chance: 0.4 }, price: 26000, forged: true, text: 'Red-gold and feather-light. It glows like a coal when it bites.' },
  orichalcum_plate: { name: 'Orichalcum Plate', icon: '🦺', kind: 'armour', slot: 'body', rank: 5, def: 64, mdef: 24, ore: 'orichalcum', price: 27000, forged: true, look: { color: '#d9773a', metal: true }, text: 'Armour of the legendary red-gold metal: light as leather, harder than any steel.' },
  sunforged_glaive: { name: 'Sunforged Glaive', icon: '🔱', kind: 'weapon', type: 'spear', model: 'steel_glaive', power: 78, speed: 0.62, chop: 1.4, rank: 5, effect: { id: 'burn', chance: 0.4 }, price: 22000, forged: true, text: 'Forged in dragon fire; the blade never cools.' },
  dragonscale_plate: { name: 'Dragonscale Plate', icon: '🦺', kind: 'armour', slot: 'body', rank: 5, def: 60, mdef: 20, price: 24000, forged: true, look: { color: '#7a2a24', metal: true }, text: 'Scales of an elder dragon set in steel.' },
  dragonscale_helm: { name: 'Dragonscale Helm', icon: '⛑️', kind: 'armour', slot: 'head', rank: 5, def: 34, mdef: 12, price: 15000, forged: true, look: { color: '#7a2a24', metal: true }, text: 'Horned, and hot to the touch.' },
  wooden_club: { name: 'Wooden Club', icon: '🏏', kind: 'weapon', type: 'club', power: 4, speed: 0.6, chop: 1.5, rank: 0, price: 20, text: 'A heavy stick. Better than fists.' },
  rusty_sword: { name: 'Rusty Sword', icon: '🗡️', kind: 'weapon', type: 'sword', power: 6, speed: 0.55, chop: 1, rank: 0, price: 40, text: 'Old, but still sharp enough.' },
  hand_axe: { name: 'Hand Axe', icon: '🪓', kind: 'weapon', type: 'axe', power: 8, speed: 0.65, chop: 3, rank: 1, price: 90, text: 'Chops young trees in one or two swings.' },
  iron_dagger: { name: 'Iron Dagger', icon: '🔪', kind: 'weapon', type: 'dagger', power: 7, speed: 0.35, chop: 0.7, rank: 2, price: 75, text: 'Quick, light strikes.' },
  oak_staff: { name: 'Oak Staff', icon: '🪄', kind: 'weapon', type: 'staff', power: 8, speed: 0.6, chop: 0.8, magic: true, rank: 2, price: 90, text: 'Channels magic: uses MATK.' },
  iron_sword: { name: 'Iron Sword', icon: '⚔️', kind: 'weapon', type: 'sword', power: 11, speed: 0.55, chop: 1, rank: 2, price: 160, text: 'A soldier\'s blade.' },
  iron_mace: { name: 'Iron Mace', icon: '🔨', kind: 'weapon', type: 'mace', power: 14, speed: 0.75, chop: 1.6, rank: 2, price: 260, text: 'Slow, crushing blows.' },
  steel_sword: { name: 'Steel Sword', icon: '⚔️', kind: 'weapon', type: 'sword', power: 19, speed: 0.5, chop: 1, rank: 3, effect: { id: 'bleed', chance: 0.2 }, price: 650, text: 'Well balanced steel.' },
  war_axe: { name: 'War Axe', icon: '🪓', kind: 'weapon', type: 'axe', power: 24, speed: 0.7, chop: 4, rank: 3, effect: { id: 'bleed', chance: 0.25 }, price: 950, text: 'Fells trees and foes alike.' },
  crystal_staff: { name: 'Crystal Staff', icon: '🔮', kind: 'weapon', type: 'staff', power: 26, speed: 0.6, chop: 0.8, magic: true, rank: 4, effect: { id: 'frost', chance: 0.3 }, price: 1800, text: 'A staff topped with a singing crystal.' },
  knight_blade: { name: 'Knight\'s Blade', icon: '⚔️', kind: 'weapon', type: 'sword', power: 32, speed: 0.5, chop: 1, rank: 4, effect: { id: 'drain', chance: 1 }, price: 2200, text: 'Forged for the realm\'s knights.' },
  iron_spear: { name: 'Iron Spear', icon: '🔱', kind: 'weapon', type: 'spear', power: 10, speed: 0.6, chop: 0.6, rank: 2, price: 140, text: 'A long ash shaft with an iron head. Keeps foes at a distance.' },
  steel_glaive: { name: 'Steel Glaive', icon: '🔱', kind: 'weapon', type: 'spear', power: 22, speed: 0.65, chop: 1, rank: 3, effect: { id: 'bleed', chance: 0.2 }, price: 1000, text: 'A curved blade on a long pole: the longest, widest reach in the shop.' },
  dragonbone_sword: { name: 'Dragonbone Sword', icon: '🐉', kind: 'weapon', type: 'sword', power: 60, speed: 0.5, chop: 1.2, rank: 5, effect: { id: 'burn', chance: 0.35 }, price: 15000, text: 'Carved from an ancient dragon\'s bone.' },
  // Workshop pieces: only a Blacksmith at their own anvil can forge these (see FORGE_WORKSHOP), and
  // merging two pieces of the same sub-category can make them too (see merges.mjs).
  woodsman_hatchet: { name: 'Woodsman\'s Hatchet', icon: '🪓', kind: 'weapon', type: 'axe', model: 'hand_axe', power: 5, speed: 0.65, chop: 2.5, rank: 0, price: 35, workshop: true, text: 'A small axe for kindling and young trees.' },
  bearded_axe: { name: 'Bearded Axe', icon: '🪓', kind: 'weapon', type: 'axe', model: 'war_axe', power: 34, speed: 0.7, chop: 3.5, rank: 3, effect: { id: 'bleed', chance: 0.25 }, price: 1400, workshop: true, text: 'Its long lower edge hooks shields aside.' },
  dragonbite_axe: { name: 'Dragonbite Axe', icon: '🪓', kind: 'weapon', type: 'axe', model: 'war_axe', power: 82, speed: 0.75, chop: 4.5, rank: 5, effect: { id: 'burn', chance: 0.35 }, price: 22000, workshop: true, text: 'Its edge stays hot long after the forge.' },
  emberfang: { name: 'Emberfang', icon: '🗡️', kind: 'weapon', type: 'sword', model: 'dragonbone_sword', power: 70, speed: 0.5, chop: 1.2, rank: 5, effect: { id: 'burn', chance: 0.45 }, price: 20000, workshop: true, text: 'A blade quenched in dragon fire.' },
  winged_spear: { name: 'Winged Spear', icon: '🔱', kind: 'weapon', type: 'spear', model: 'steel_glaive', power: 44, speed: 0.62, chop: 1.2, rank: 4, effect: { id: 'bleed', chance: 0.3 }, price: 4500, workshop: true, text: 'Steel wings below the point stop a foe from closing in.' },
  bronze_dirk: { name: 'Bronze Dirk', icon: '🔪', kind: 'weapon', type: 'dagger', model: 'iron_dagger', power: 6, speed: 0.36, chop: 0.6, rank: 1, price: 50, workshop: true, text: 'A short bronze blade.' },
  steel_stiletto: { name: 'Steel Stiletto', icon: '🔪', kind: 'weapon', type: 'dagger', model: 'iron_dagger', power: 16, speed: 0.33, chop: 0.6, rank: 3, effect: { id: 'poison', chance: 0.25 }, price: 800, workshop: true, text: 'Thin enough to find any gap in armour.' },
  venom_fang: { name: 'Venom Fang', icon: '🔪', kind: 'weapon', type: 'dagger', model: 'iron_dagger', power: 30, speed: 0.32, chop: 0.6, rank: 4, effect: { id: 'poison', chance: 0.4 }, price: 3500, workshop: true, text: 'A hollow blade that carries poison.' },
  shadow_kris: { name: 'Shadow Kris', icon: '🔪', kind: 'weapon', type: 'dagger', model: 'iron_dagger', power: 52, speed: 0.3, chop: 0.6, rank: 5, effect: { id: 'drain', chance: 1 }, price: 16000, workshop: true, text: 'A wavy dark blade that drinks from every cut.' },
  knotted_club: { name: 'Knotted Club', icon: '🏏', kind: 'weapon', type: 'club', model: 'wooden_club', power: 7, speed: 0.62, chop: 1.5, rank: 1, price: 45, workshop: true, text: 'Hard oak with knots left on for weight.' },
  studded_club: { name: 'Studded Club', icon: '🏏', kind: 'weapon', type: 'club', model: 'wooden_club', power: 12, speed: 0.64, chop: 1.6, rank: 2, price: 200, workshop: true, text: 'Iron studs hammered into the head.' },
  spiked_cudgel: { name: 'Spiked Cudgel', icon: '🏏', kind: 'weapon', type: 'club', model: 'wooden_club', power: 22, speed: 0.66, chop: 1.7, rank: 3, effect: { id: 'frost', chance: 0.15 }, price: 800, workshop: true, text: 'Steel spikes through a heavy head.' },
  ogre_club: { name: 'Ogre Club', icon: '🏏', kind: 'weapon', type: 'club', model: 'wooden_club', power: 42, speed: 0.7, chop: 2, rank: 4, effect: { id: 'frost', chance: 0.25 }, price: 4000, workshop: true, text: 'Big enough for an ogre, bound in iron.' },
  earthshaker: { name: 'Earthshaker', icon: '🏏', kind: 'weapon', type: 'club', model: 'wooden_club', power: 68, speed: 0.72, chop: 2.2, rank: 5, effect: { id: 'frost', chance: 0.35 }, price: 18000, workshop: true, text: 'The ground shakes where it lands.' },
  flanged_mace: { name: 'Flanged Mace', icon: '🔨', kind: 'weapon', type: 'mace', model: 'iron_mace', power: 45, speed: 0.76, chop: 1.8, rank: 4, effect: { id: 'frost', chance: 0.2 }, price: 5000, workshop: true, text: 'Steel flanges that crack plate.' },
  dawn_hammer: { name: 'Dawn Hammer', icon: '🔨', kind: 'weapon', type: 'mace', model: 'iron_mace', power: 74, speed: 0.78, chop: 2, rank: 5, effect: { id: 'burn', chance: 0.35 }, price: 21000, workshop: true, text: 'Its head glows like the rising sun.' },
  ash_staff: { name: 'Ash Staff', icon: '🪄', kind: 'weapon', type: 'staff', model: 'oak_staff', power: 7, speed: 0.6, chop: 0.7, magic: true, rank: 1, price: 70, workshop: true, text: 'Straight ash wood. Channels magic: uses MATK.' },
  runed_staff: { name: 'Runed Staff', icon: '🪄', kind: 'weapon', type: 'staff', model: 'oak_staff', power: 16, speed: 0.6, chop: 0.8, magic: true, rank: 3, effect: { id: 'burn', chance: 0.2 }, price: 900, workshop: true, text: 'Runes burned down its length. Uses MATK.' },
  starwood_staff: { name: 'Starwood Staff', icon: '🔮', kind: 'weapon', type: 'staff', model: 'crystal_staff', power: 46, speed: 0.6, chop: 0.8, magic: true, rank: 5, effect: { id: 'drain', chance: 0.35 }, price: 20000, workshop: true, text: 'Wood from a tree struck by a falling star. Uses MATK.' },
  studded_leggings: { name: 'Studded Leggings', icon: '👖', kind: 'armour', slot: 'legs', rank: 1, def: 5, price: 110, workshop: true, look: { color: '#5e4430' }, text: 'Leather with iron studs.' },
  knight_greaves: { name: 'Knight\'s Greaves', icon: '👖', kind: 'armour', slot: 'legs', rank: 4, def: 24, mdef: 5, price: 2400, workshop: true, look: { color: '#d9c27a', metal: true }, text: 'Gold-trimmed leg plates.' },
  dragonscale_greaves: { name: 'Dragonscale Greaves', icon: '👖', kind: 'armour', slot: 'legs', rank: 5, def: 42, mdef: 14, price: 17000, workshop: true, look: { color: '#7a2a24', metal: true }, text: 'Dragon scales over steel.' },
  studded_boots: { name: 'Studded Boots', icon: '🥾', kind: 'armour', slot: 'feet', rank: 1, def: 3, price: 70, workshop: true, look: { color: '#4a3020' }, text: 'Boots with iron toe caps.' },
  knight_sabatons: { name: 'Knight\'s Sabatons', icon: '🥾', kind: 'armour', slot: 'feet', rank: 4, def: 14, mdef: 4, price: 1500, workshop: true, look: { color: '#d9c27a', metal: true }, text: 'Jointed steel shoes, trimmed in gold.' },
  dragonscale_boots: { name: 'Dragonscale Boots', icon: '🥾', kind: 'armour', slot: 'feet', rank: 5, def: 26, mdef: 10, price: 12000, workshop: true, look: { color: '#7a2a24', metal: true }, text: 'Light, and they never burn.' },
  buckler: { name: 'Buckler', icon: '🛡️', kind: 'armour', slot: 'shield', rank: 1, def: 6, price: 110, workshop: true, look: { color: '#8a6a4a' }, text: 'A small round shield for the fist.' },
  dragonscale_shield: { name: 'Dragonscale Shield', icon: '🛡️', kind: 'armour', slot: 'shield', rank: 5, def: 46, mdef: 16, price: 20000, workshop: true, look: { color: '#7a2a24', metal: true }, text: 'One great scale, rimmed in dragonite.' },
};
// Skill Stones: each holds one skill. Set into a Rare or better piece of gear, it lets whoever
// wears that piece use the skill. They drop from monsters at random and can be taken out again.
for (const [id, sk] of Object.entries(SKILLS)) {
  ITEMS[`stone_${id}`] = { name: `${sk.name} Stone`, icon: '💠', kind: 'stone', skill: id, price: 300 + sk.sp * 30, text: `Holds the skill ${sk.name}: ${sk.text} Set it into a Rare or better piece of gear (Bag) to use it while you wear that piece.` };
}
// Monster gear, sold only to monster players at the Dark Market: made for claws, tusks, tails and
// hides. It is cut to fit the monster form, and when its wearer takes humanoid form it reshapes to fit
// (`human` is what it becomes). It merges only with other monster gear.
Object.assign(ITEMS, {
  bone_club: { name: 'Bone Club', human: 'Bone-Studded Club', icon: '🦴', kind: 'weapon', type: 'club', model: 'wooden_club', power: 5, speed: 0.6, chop: 1.5, rank: 0, price: 20, beast: true, text: 'A thighbone as long as an arm.' },
  fang_knife: { name: 'Fang Knife', human: 'Fang Dirk', icon: '🦷', kind: 'weapon', type: 'dagger', model: 'iron_dagger', power: 6, speed: 0.35, chop: 0.6, rank: 0, price: 40, beast: true, text: 'A great fang bound to a grip.' },
  claw_hatchet: { name: 'Claw Hatchet', human: 'Hooked Hatchet', icon: '🪓', kind: 'weapon', type: 'axe', model: 'hand_axe', power: 8, speed: 0.65, chop: 3, rank: 1, price: 90, beast: true, text: 'A claw on a haft. It chops wood too.' },
  tusk_spear: { name: 'Tusk Spear', human: 'Tusk-Headed Spear', icon: '🔱', kind: 'weapon', type: 'spear', model: 'iron_spear', power: 10, speed: 0.6, chop: 0.6, rank: 2, price: 140, beast: true, text: 'A boar tusk on a long shaft.' },
  shaman_totem: { name: 'Shaman Totem', human: 'Carved Totem Staff', icon: '🪄', kind: 'weapon', type: 'staff', model: 'oak_staff', power: 8, speed: 0.6, chop: 0.8, magic: true, rank: 2, price: 90, beast: true, text: 'Feathers, bones and old magic. Uses MATK.' },
  crude_cleaver: { name: 'Crude Cleaver', human: 'Heavy Cleaver', icon: '🗡️', kind: 'weapon', type: 'sword', model: 'iron_sword', power: 11, speed: 0.55, chop: 1, rank: 2, price: 160, beast: true, text: 'More slab than sword, and it does the job.' },
  skull_maul: { name: 'Skull Maul', human: 'Skull-Headed Maul', icon: '💀', kind: 'weapon', type: 'mace', model: 'iron_mace', power: 14, speed: 0.75, chop: 1.6, rank: 2, price: 260, beast: true, text: 'A skull of something huge on a stout pole.' },
  serrated_fang: { name: 'Serrated Fang', human: 'Sawtooth Blade', icon: '⚔️', kind: 'weapon', type: 'sword', model: 'steel_sword', power: 19, speed: 0.5, chop: 1, rank: 3, effect: { id: 'bleed', chance: 0.25 }, price: 650, beast: true, text: 'Teeth along the whole edge.' },
  troll_cleaver: { name: 'Troll Cleaver', human: 'War Cleaver', icon: '🪓', kind: 'weapon', type: 'axe', model: 'war_axe', power: 24, speed: 0.7, chop: 4, rank: 3, effect: { id: 'bleed', chance: 0.25 }, price: 950, beast: true, text: 'Made for a troll\'s grip.' },
  wyrm_glaive: { name: 'Wyrmtooth Glaive', human: 'Wyrmtooth Glaive', icon: '🔱', kind: 'weapon', type: 'spear', model: 'steel_glaive', power: 22, speed: 0.65, chop: 1, rank: 3, effect: { id: 'poison', chance: 0.25 }, price: 1000, beast: true, text: 'A wyrm\'s tooth on a pole; the tip still weeps venom.' },
  spirit_totem: { name: 'Spirit Totem', human: 'Spirit Staff', icon: '🔮', kind: 'weapon', type: 'staff', model: 'crystal_staff', power: 26, speed: 0.6, chop: 0.8, magic: true, rank: 4, effect: { id: 'drain', chance: 0.3 }, price: 1800, beast: true, text: 'The spirits in it whisper back. Uses MATK.' },
  warlord_fang: { name: 'Warlord\'s Fang', human: 'Warlord\'s Blade', icon: '⚔️', kind: 'weapon', type: 'sword', model: 'knight_blade', power: 32, speed: 0.5, chop: 1, rank: 4, effect: { id: 'drain', chance: 1 }, price: 2200, beast: true, text: 'Carried by the warlords of the monster races.' },
  hide_cap: { name: 'Hide Hood', human: 'Hide Cap', icon: '🧢', kind: 'armour', rank: 0, slot: 'head', def: 2, price: 25, beast: true, look: { color: '#5a4a32' }, text: 'Rough hide, cut around horns and ears.' },
  hide_wrap: { name: 'Hide Wrap', human: 'Hide Jerkin', icon: '👕', kind: 'armour', rank: 0, slot: 'body', def: 3, price: 30, beast: true, look: { color: '#6a5236' }, text: 'Wrapped around a body of any shape.' },
  foot_wraps: { name: 'Foot Wraps', human: 'Hide Boots', icon: '🥾', kind: 'armour', rank: 0, slot: 'feet', def: 2, price: 25, beast: true, look: { color: '#4a3a26' }, text: 'For claws, hooves and paws.' },
  fur_leggings: { name: 'Fur Leggings', human: 'Fur Trousers', icon: '👖', kind: 'armour', rank: 0, slot: 'legs', def: 3, price: 45, beast: true, look: { color: '#5e4a34' }, text: 'Warm, with a gap for a tail.' },
  bone_shield: { name: 'Bone Shield', human: 'Bone Shield', icon: '🛡️', kind: 'armour', rank: 0, slot: 'shield', def: 4, price: 50, beast: true, look: { color: '#d8ccb0' }, text: 'Ribs lashed into a round.' },
  scale_harness: { name: 'Scale Harness', human: 'Scale Vest', icon: '🦺', kind: 'armour', rank: 1, slot: 'body', def: 6, price: 90, beast: true, look: { color: '#4a6a4a' }, text: 'Scales sewn to straps.' },
  bone_mask: { name: 'Bone Mask', human: 'Bone Helm', icon: '💀', kind: 'armour', rank: 2, slot: 'head', def: 6, price: 140, beast: true, look: { color: '#e0d6bc' }, text: 'A skull worn as a face.' },
  shaman_mantle: { name: 'Shaman Mantle', human: 'Shaman Robe', icon: '🥻', kind: 'armour', rank: 2, slot: 'body', def: 3, mdef: 10, price: 200, beast: true, look: { color: '#4a2a4a', robe: true }, text: 'Feathers and charms against magic.' },
  scale_mail: { name: 'Scale Mail', human: 'Scale Mail', icon: '🦺', kind: 'armour', rank: 2, slot: 'body', def: 12, price: 320, beast: true, look: { color: '#3e6a50', metal: true }, text: 'Overlapping scales over a hide coat.' },
  chitin_greaves: { name: 'Chitin Greaves', human: 'Chitin Greaves', icon: '👖', kind: 'armour', rank: 2, slot: 'legs', def: 8, price: 220, beast: true, look: { color: '#3a3a4a', metal: true }, text: 'Shell plates from a giant beetle.' },
  claw_boots: { name: 'Clawed Boots', human: 'Spiked Boots', icon: '🥾', kind: 'armour', rank: 2, slot: 'feet', def: 5, price: 120, beast: true, look: { color: '#3a3a3a', metal: true }, text: 'Iron caps for claws.' },
  tortoise_shield: { name: 'Tortoise Shield', human: 'Shell Shield', icon: '🛡️', kind: 'armour', rank: 2, slot: 'shield', def: 9, price: 260, beast: true, look: { color: '#5a6a3a' }, text: 'The shell of a great tortoise.' },
  horned_helm: { name: 'Horned Helm', human: 'Horned Helm', icon: '⛑️', kind: 'armour', rank: 3, slot: 'head', def: 12, price: 600, beast: true, look: { color: '#5a5048', metal: true }, text: 'Black iron, with room for horns.' },
  drake_plate: { name: 'Drakehide Plate', human: 'Drakehide Plate', icon: '🦺', kind: 'armour', rank: 3, slot: 'body', def: 22, price: 1100, beast: true, look: { color: '#6a2a24', metal: true }, text: 'Drake hide over iron plates.' },
  drake_greaves: { name: 'Drakehide Greaves', human: 'Drakehide Greaves', icon: '👖', kind: 'armour', rank: 3, slot: 'legs', def: 15, price: 800, beast: true, look: { color: '#6a2a24', metal: true }, text: 'They bend where a monster\'s legs bend.' },
  drake_boots: { name: 'Drakehide Boots', human: 'Drakehide Boots', icon: '🥾', kind: 'armour', rank: 3, slot: 'feet', def: 9, price: 500, beast: true, look: { color: '#6a2a24', metal: true }, text: 'Soft drake hide over iron soles.' },
  bulwark_shell: { name: 'Bulwark Shell', human: 'Bulwark Shield', icon: '🛡️', kind: 'armour', rank: 3, slot: 'shield', def: 18, price: 1200, beast: true, look: { color: '#4a4a3a', metal: true }, text: 'A wall of shell and iron.' },
  warlord_crown: { name: 'Warlord\'s Crown', human: 'Warlord\'s Helm', icon: '👑', kind: 'armour', rank: 4, slot: 'head', def: 20, mdef: 5, price: 1800, beast: true, look: { color: '#8a6a2a', metal: true }, text: 'Iron and gold, with a ring of fangs.' },
  warlord_harness: { name: 'Warlord\'s Harness', human: 'Warlord\'s Plate', icon: '🦺', kind: 'armour', rank: 4, slot: 'body', def: 34, mdef: 8, price: 3000, beast: true, look: { color: '#8a6a2a', metal: true }, text: 'Worn by the war chiefs of the monster races.' },
});
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
  { name: 'Basic', color: '#8a8a80' }, { name: 'Common', color: '#b9b9b9' }, { name: 'Uncommon', color: '#62c462' }, { name: 'Rare', color: '#4a9cff' },
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
const MERGE_PARTS = [null, null, 'goblin_ear', 'lizard_scale', 'serpent_fang', 'frost_core', 'drake_horn'];
export function mergeCost(it, plus = 0) {
  const r = rankOf(it, plus);
  const coins = Math.round(25 * Math.max(1, r) ** 2 * (plus + 1));
  const part = MERGE_PARTS[r];
  return { coins, needs: part ? [[part, Math.ceil((plus + 1) / 2) + r]] : [] };
}

// What the shop sells, and the level at which each item unlocks
export const SHOP = [
  // potions and food
  ['water_flask', 1], ['apple', 1], ['bread', 1], ['herbal_tea', 1], ['herb', 1], ['honey_cake', 3], ['roast_meat', 4], ['stew', 12], ['torch', 1], ['tent', 1], ['sp_potion', 2], ['calm_draught', 2], ['poison_potion', 3], ['potion', 5], ['sp_booster', 5],
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

// The Dark Market: the monster players' shop (food and potions as in the Shop, all halal; the gear is monster gear)
export const MONSTER_SHOP = [
  ...SHOP.filter(([id]) => !['weapon', 'armour'].includes(ITEMS[id].kind)),
  ['bone_club', 1], ['fang_knife', 1], ['claw_hatchet', 3], ['shaman_totem', 3], ['tusk_spear', 6], ['crude_cleaver', 5], ['skull_maul', 8],
  ['serrated_fang', 12], ['troll_cleaver', 15], ['wyrm_glaive', 16], ['spirit_totem', 20], ['warlord_fang', 20],
  ['hide_cap', 1], ['hide_wrap', 1], ['foot_wraps', 1], ['fur_leggings', 2], ['bone_shield', 2], ['scale_harness', 3], ['bone_mask', 6], ['shaman_mantle', 5],
  ['claw_boots', 6], ['scale_mail', 8], ['chitin_greaves', 8], ['tortoise_shield', 8], ['horned_helm', 15], ['drake_plate', 15], ['drake_greaves', 15],
  ['drake_boots', 15], ['bulwark_shell', 18], ['warlord_crown', 25], ['warlord_harness', 25],
];
// the shop a character buys from: monster players get the Dark Market
export const shopFor = (c) => (c?.side === 'monster' ? MONSTER_SHOP : SHOP);
// a piece of monster gear's name in its wearer's form
export const formName = (it, form) => (it.beast && form === 'humanoid' && it.human ? it.human : it.name);
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

// What kind of thing an item is, for the shop and the Blacksmith. Merging needs two pieces of the
// same sub-category (see merges.mjs): a sword with a sword, a helmet with a helmet.
const TYPE_NAMES = { sword: 'Sword', axe: 'Axe', club: 'Club', dagger: 'Dagger', mace: 'Mace', spear: 'Spear', staff: 'Staff' };
const SLOT_NAMES = { head: 'Helmet', body: 'Chest armour', legs: 'Leg armour', feet: 'Boots', shield: 'Shield' };
export function categoryOf(it) {
  if (it.kind === 'weapon') return { cat: 'Weapon', sub: TYPE_NAMES[it.type] || 'Weapon' };
  if (it.kind === 'armour') return { cat: 'Armour', sub: SLOT_NAMES[it.slot] || 'Armour' };
  if (it.kind === 'coating') return { cat: 'Coating', sub: 'For weapons' };
  if (it.kind === 'food') return { cat: it.heal || it.sp ? 'Food & drink' : 'Potion', sub: null };
  if (it.kind === 'seed') return { cat: 'Seeds', sub: null };
  if (it.kind === 'stone') return { cat: 'Skill Stone', sub: null };
  return { cat: 'Material', sub: it.rank != null ? 'Ore' : null };
}

// Forging: a Blacksmith makes weapons and armour from ore and coins. Better and higher-ranked
// pieces cost a lot more, and need rarer ore.
// Forging. A Blacksmith unlocks a rank of gear at each class advancement: Basic from the start,
// Common at level 20, Uncommon at 50, Rare at 100, Epic at 200, Legendary at 500. Mythic is never
// forged; only the Kings hold those. What a smith can make: everything in the shop plus the forge-only pieces.
export const FORGE_RANK_LEVEL = [1, 20, 50, 100, 200, 500, Infinity];
// metal for each rank (iron for Basic and Common up to dragonite for Legendary). Forging with a better metal
// than needed makes the piece stronger: +1 for each step up, at most +2 (diamond and orichalcum are
// the best there are). Pieces made of one metal of their own (copper gear, the diamond and
// orichalcum pieces) name it as `ore` and always use it.
export const FORGE_ORES = ['iron_ore', 'silver_ore', 'gold_ore', 'ruby', 'dragonite', 'diamond', 'orichalcum'];
export const FORGE_MAX_BONUS = 2;
const FORGE_ONLY_LEVEL = { copper_sword: 1, copper_dagger: 1, copper_hatchet: 1, copper_cap: 1, copper_buckler: 1, diamond_edge: 120, orichalcum_blade: 220, orichalcum_plate: 230, crude_dagger: 1, copper_spear: 3, willow_staff: 5, hide_vest: 4, bronze_sword: 4, stone_maul: 6, hunting_spear: 8, bronze_helm: 5, bronze_cuirass: 10, tempered_sword: 22, iron_waraxe: 25, iron_cuirass: 24,
  runed_sword: 55, steel_warhammer: 60, runed_plate: 58, runeblade: 100, titan_axe: 110, runic_aegis: 105, sunforged_glaive: 210, dragonscale_plate: 200, dragonscale_helm: 205 };
// [id, level a Blacksmith needs] for everything forgeable, lowest first
export const FORGE = [
  ...SHOP.filter(([id]) => isGear(ITEMS[id])).map(([id, lvl]) => [id, Math.max(lvl, FORGE_RANK_LEVEL[ITEMS[id].rank || 0])]),
  ...Object.entries(FORGE_ONLY_LEVEL).map(([id, lvl]) => [id, Math.max(lvl, FORGE_RANK_LEVEL[ITEMS[id].rank || 0])]),
].sort((a, b) => a[1] - b[1]);
export const forgeLevel = (id) => FORGE.find(([f]) => f === id)?.[1] ?? Infinity;
// At their own anvil (built on their land) a Blacksmith can forge more: the workshop pieces too.
// Each still opens at the level its rank needs, a few levels into that rank.
export const FORGE_WORKSHOP = Object.values(ITEMS).filter((it) => it.workshop)
  .map((it) => [it.id, FORGE_RANK_LEVEL[it.rank || 0] + Math.min(40, Math.round(it.price / 600))])
  .sort((a, b) => a[1] - b[1]);
export const workshopLevel = (id) => FORGE_WORKSHOP.find(([f]) => f === id)?.[1] ?? forgeLevel(id);
// the cost to forge `it` with `ore` (the rank's own metal when left out): coins, materials and the bonus
const oreTier = (it) => Math.min(Math.max(0, (it.rank || 0) - 1), 4);
export function forgeCost(it, ore = null) {
  const r = oreTier(it);
  if (it.ore) {
    if (ore && ore !== it.ore) return null;
    return { coins: Math.round((it.price * 0.45 * (1 + r * 0.6)) / 5) * 5 || 5, bonus: 0, ore: it.ore,
      needs: [[it.ore, it.ore === 'copper_ore' ? 4 : 2 + r], ...(r >= 2 ? [['iron_ore', 3]] : [])] };
  }
  const tier = ore ? FORGE_ORES.indexOf(ore) : r;
  if (tier < r) return null;
  const bonus = Math.min(FORGE_MAX_BONUS, tier - r);
  return { coins: Math.round((it.price * 0.45 * (1 + r * 0.6) * (1 + bonus * 0.25)) / 5) * 5, bonus, ore: FORGE_ORES[tier],
    needs: [[FORGE_ORES[tier], 2 + r * 2], ...(r >= 2 ? [['iron_ore', 3]] : [])] };
}
// the metals a piece can be forged with: its own, then up to two better ones
export const forgeOres = (it) => (it.ore ? [it.ore] : FORGE_ORES.slice(oreTier(it), oreTier(it) + 1 + FORGE_MAX_BONUS));

// The game's own markets, one beside each waystone (inside its safe zone). Each has a speciality:
// more of it, and its specialities unlock 5 levels before the ordinary shop sells them. They also
// stock things the ordinary shop doesn't (ore, wood, gems, more food).
export const MARKETS = {
  central: { name: 'Central Market', text: 'A bit of everything, and plenty of food.', kinds: ['food', 'weapon', 'armour', 'coating'], extra: ['log', 'iron_ore', 'roast_meat', 'stew', 'apple', 'water_flask'] },
  crossroads: { name: 'Crossroads Armoury', text: 'Weapons of every kind.', kinds: ['weapon', 'coating'], extra: ['iron_ore', 'silver_ore'] },
  riverhold: { name: 'Riverhold Apothecary', text: 'Potions, herbs and food.', kinds: ['food'], extra: ['herb', 'herbal_tea', 'honey_cake', 'stew', 'roast_meat', 'apple', 'water_flask', 'slime_gel', 'fae_dust'] },
  hills: { name: 'Hillfort Outfitters', text: 'Armour and shields.', kinds: ['armour'], extra: ['iron_ore', 'copper_ore', 'silver_ore', 'log'] },
  warrens: { name: 'Warren Trading Post', text: 'Goblin goods: crude weapons and food.', kinds: ['weapon', 'food'], extra: ['goblin_ear', 'iron_ore', 'roast_meat'] },
  slimecaves: { name: 'Gloomhollow Exchange', text: 'Ore, gel and potions.', kinds: ['food', 'coating'], extra: ['slime_gel', 'copper_ore', 'iron_ore', 'crystal_shard'] },
  glade: { name: 'Glade Bazaar', text: 'Magic: staves, robes and fae goods.', kinds: ['weapon', 'armour', 'food'], only: (it) => it.kind === 'food' || it.magic || /mage/.test(it.id || ''), extra: ['fae_dust', 'herb', 'crystal_shard'] },
  temple: { name: 'Temple Market', text: 'Potions and gems from the lake.', kinds: ['food', 'coating'], extra: ['sapphire', 'emerald', 'serpent_fang', 'herb'] },
  marsh: { name: 'Marsh Market', text: 'Scale armour and spears.', kinds: ['armour', 'weapon'], only: (it) => it.kind === 'armour' || it.type === 'spear', extra: ['lizard_scale', 'reed', 'herb'] },
  nests: { name: 'Peak Forge', text: 'The finest weapons and armour, for those who can afford them.', kinds: ['weapon', 'armour'], extra: ['drake_horn', 'gold_ore', 'iron_ore'] }, // (rare ores and gems are never sold: only strong Dungeons hold them)
};
// The Central City's shops are run by the city (bots), not players: everything costs more there
// and they buy for less. Every dish and drink is halal.
export const BOT_MARKUP = 1.4, BOT_BUY_SHARE = 0.7;
const basicGear = (kind) => SHOP.filter(([id]) => ITEMS[id].kind === kind && (ITEMS[id].rank || 0) <= 1 && !ITEMS[id].fashion).map(([id]) => id);
Object.assign(MARKETS, {
  city_potions: { bot: true, name: 'The Green Vial', text: 'Small potions and remedies, run by the city.', items: ['potion', 'sp_potion', 'calm_draught', 'herb', 'big_potion', 'strength_potion', 'stone_potion', 'swift_potion'] },
  city_smith: { bot: true, name: 'City Forge', text: 'Basic weapons and tools, run by the city.', items: [...basicGear('weapon'), 'poison_potion', 'fire_oil', 'frost_oil', 'torch', 'tent'] },
  city_armoury: { bot: true, name: 'City Armoury', text: 'Plain armour and shields, run by the city.', items: basicGear('armour') },
  city_tailor: { bot: true, name: 'The Silk Thread', text: 'Clothes to wear for looks, not for battle.', items: ['linen_shirt', 'wide_trousers', 'felt_hat', 'sandals', 'embroidered_tunic', 'turban', 'riding_boots', 'silk_robe'] },
  city_food: { bot: true, name: 'The Olive Tree', text: 'Halal meals that heal and give a short boost.', items: ['bread', 'apple', 'lentil_soup', 'falafel_wrap', 'lamb_kebab', 'chicken_rice', 'date_bowl', 'stew'] },
  tavern: { bot: true, name: 'Tavern', text: 'Halal food, fresh drinks and rooms to rent. No alcohol is served here.', items: ['mint_tea', 'fruit_juice', 'ayran', 'water_flask', 'herbal_tea', 'lentil_soup', 'bread'] },
});
// what a market charges for an item, and pays for one
export const marketPrice = (marketId, id) => Math.round(ITEMS[id].price * (MARKETS[marketId]?.bot ? BOT_MARKUP : 1));
// What a market sells to a character of `level`
export function marketStock(marketId, level) {
  const m = MARKETS[marketId];
  if (!m) return [];
  if (m.items) return m.items.filter((id) => ITEMS[id] && level >= (SHOP.find(([sid]) => sid === id)?.[1] ?? 1) - 5);
  const out = SHOP.filter(([id, lvl]) => m.kinds.includes(ITEMS[id].kind) && (!m.only || m.only({ ...ITEMS[id], id })) && level >= Math.max(1, lvl - 5)).map(([id]) => id);
  for (const id of m.extra) if (ITEMS[id] && !out.includes(id)) out.push(id);
  return out;
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

// ---------- skills on gear ----------
// Rare and Epic gear holds up to 3 skills (from Skill Stones), Legendary and Mythic up to 5
export const gearSkillSlots = (it, plus = 0) => { const r = rankOf(it, plus); return r >= 5 ? 5 : r >= 3 ? 3 : 0; };
export const STONES = Object.values(ITEMS).filter((it) => it.kind === 'stone').map((it) => it.id);
// the chance a slain monster drops a Skill Stone (a little more for stronger monsters), and which one
export const stoneChance = (level = 1) => Math.min(0.05, 0.012 + level * 0.0001);
export const randomStone = (rnd = Math.random) => STONES[Math.floor(rnd() * STONES.length)];

// Every Mythic weapon has a skill of its own, which nobody can take off it: used with the J key
// (or the red button on the skill bar) while it is in your hand.
const MYTHIC_ARTS = {
  sword: { type: 'sweep', mult: 6, radius: 7, names: ['Heaven-Splitting Arc', 'Crescent of Ruin', 'Last Light', 'Kingsbane'] },
  axe: { type: 'strike', mult: 9, names: ['World Cleaver', 'Mountain Splitter', 'Red Harvest', 'Executioner\'s Verdict'] },
  spear: { type: 'bolt', mult: 7, reach: 32, names: ['Skypiercer', 'Dragon Lance', 'Falling Star', 'Spear of Dawn'] },
  dagger: { type: 'dash', mult: 8, dist: 14, names: ['Thousand Cuts', 'Silent Death', 'Shadow Waltz', 'Viper\'s Kiss'] },
  club: { type: 'sweep', mult: 7, radius: 6, names: ['Earthbreaker', 'Titan\'s Fall', 'Quake Heart', 'Giant\'s Wrath'] },
  mace: { type: 'sweep', mult: 7, radius: 6, names: ['Judgement', 'Holy Hammerfall', 'Doom Bell', 'Sun Crusher'] },
  staff: { type: 'bolt', mult: 7, reach: 36, magic: true, names: ['Star Fall', 'Eye of the Storm', 'Arcane Cataclysm', 'Moon Collapse'] },
};
const EFFECT_ELEMENT = { burn: 'Fire', frost: 'Water', poison: 'Nature', drain: 'Dark', bleed: 'Light' };
export const isMythic = (it, plus = 0) => it?.kind === 'weapon' && rankOf(it, plus) >= 6;
export function mythicSkill(it, plus = 0) {
  if (!isMythic(it, plus)) return null;
  const art = MYTHIC_ARTS[it.type] || MYTHIC_ARTS.sword;
  const h = [...it.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const fx = weaponEffect(it, plus);
  return {
    id: 'mythic', unique: true, tier: 4, name: art.names[h % art.names.length], icon: '🌟', type: art.type, sp: 30, cd: 40,
    mult: art.mult, radius: art.radius, reach: art.reach, dist: art.dist, magic: !!art.magic,
    element: EFFECT_ELEMENT[fx?.id] || 'Light', effect: fx?.id && fx.id !== 'drain' ? fx.id : null, drain: fx?.id === 'drain' ? 0.3 : null,
    text: `${it.name}'s own skill: ${art.mult}× damage${art.radius ? ` to every foe within ${art.radius} m` : art.reach ? ` up to ${art.reach} m away` : art.dist ? ` after a ${art.dist} m rush` : ''}. 30 SP, rests 40 s.`,
  };
}

// Spells: cast with a staff in one of your elements. Mages learn them (one at once, then a new one
// every 10 levels, given at random from their elements, like skills). Those who join the Dark Side
// get a spell in each of their elements as well, and cast every spell in its dark form: the same
// spell, black with shadow and stronger (DARK_SPELL_POWER). See progress.js spellsDue. Spells are attached to
// a staff to be cast: 3 to a staff, 5 to a Legendary or Mythic one. The attack key casts the chosen
// spell; the Spell key (X) changes which one.
//
// kind: bolt (one foe at range), burst (a foe and those around it), nova (everything round you),
// beam (up to three foes in a line). power multiplies MATK; effect is a chance of an EFFECTS id.
import { SPELL_DESC } from './descriptions.mjs';
export const SPELLS = {
  fire_bolt: { name: 'Fire Bolt', element: 'Fire', level: 1, kind: 'bolt', power: 1.3, sp: 4, cd: 1.2, effect: { id: 'burn', chance: 0.2 } },
  flame_burst: { name: 'Flame Burst', element: 'Fire', level: 20, kind: 'burst', power: 1.5, sp: 10, cd: 4, effect: { id: 'burn', chance: 0.35 } },
  inferno: { name: 'Inferno', element: 'Fire', level: 60, kind: 'nova', power: 2.2, sp: 24, cd: 10, effect: { id: 'burn', chance: 0.6 } },
  meteor: { name: 'Meteor', element: 'Fire', level: 120, kind: 'burst', power: 4, sp: 45, cd: 18, effect: { id: 'burn', chance: 0.8 } },
  water_bolt: { name: 'Water Bolt', element: 'Water', level: 1, kind: 'bolt', power: 1.25, sp: 4, cd: 1.1 },
  frost_lance: { name: 'Frost Lance', element: 'Water', level: 20, kind: 'beam', power: 1.5, sp: 10, cd: 4, effect: { id: 'frost', chance: 0.5 } },
  tidal_wave: { name: 'Tidal Wave', element: 'Water', level: 60, kind: 'nova', power: 2, sp: 22, cd: 10, effect: { id: 'frost', chance: 0.4 } },
  maelstrom: { name: 'Maelstrom', element: 'Water', level: 120, kind: 'burst', power: 3.8, sp: 42, cd: 18, effect: { id: 'frost', chance: 0.7 } },
  stone_shot: { name: 'Stone Shot', element: 'Earth', level: 1, kind: 'bolt', power: 1.4, sp: 4, cd: 1.4 },
  quake: { name: 'Quake', element: 'Earth', level: 20, kind: 'nova', power: 1.4, sp: 11, cd: 5 },
  stone_spears: { name: 'Stone Spears', element: 'Earth', level: 60, kind: 'beam', power: 2.4, sp: 22, cd: 9, effect: { id: 'bleed', chance: 0.4 } },
  landslide: { name: 'Landslide', element: 'Earth', level: 120, kind: 'burst', power: 4.2, sp: 46, cd: 20 },
  wind_blade: { name: 'Wind Blade', element: 'Wind', level: 1, kind: 'bolt', power: 1.2, sp: 3, cd: 0.9, effect: { id: 'bleed', chance: 0.15 } },
  gale: { name: 'Gale', element: 'Wind', level: 20, kind: 'beam', power: 1.4, sp: 9, cd: 3.5 },
  cyclone: { name: 'Cyclone', element: 'Wind', level: 60, kind: 'nova', power: 2.1, sp: 22, cd: 9, effect: { id: 'bleed', chance: 0.4 } },
  tempest: { name: 'Tempest', element: 'Wind', level: 120, kind: 'burst', power: 3.8, sp: 42, cd: 17 },
  spark: { name: 'Spark', element: 'Lightning', level: 1, kind: 'bolt', power: 1.35, sp: 4, cd: 1.1 },
  chain_lightning: { name: 'Chain Lightning', element: 'Lightning', level: 20, kind: 'beam', power: 1.6, sp: 11, cd: 4.5 },
  thunderclap: { name: 'Thunderclap', element: 'Lightning', level: 60, kind: 'nova', power: 2.3, sp: 24, cd: 10, effect: { id: 'frost', chance: 0.3 } },
  storm_call: { name: 'Storm Call', element: 'Lightning', level: 120, kind: 'burst', power: 4.2, sp: 46, cd: 19 },
  thorn_shot: { name: 'Thorn Shot', element: 'Nature', level: 1, kind: 'bolt', power: 1.2, sp: 4, cd: 1.1, effect: { id: 'poison', chance: 0.25 } },
  entangle: { name: 'Entangle', element: 'Nature', level: 20, kind: 'burst', power: 1.2, sp: 9, cd: 4, effect: { id: 'frost', chance: 0.6 } },
  bramble_ring: { name: 'Bramble Ring', element: 'Nature', level: 60, kind: 'nova', power: 2, sp: 20, cd: 9, effect: { id: 'poison', chance: 0.6 } },
  wrath_of_the_wild: { name: 'Wrath of the Wild', element: 'Nature', level: 120, kind: 'burst', power: 3.7, sp: 42, cd: 18, effect: { id: 'poison', chance: 0.8 } },
  light_ray: { name: 'Light Ray', element: 'Light', level: 1, kind: 'beam', power: 1.15, sp: 4, cd: 1.2 },
  radiance: { name: 'Radiance', element: 'Light', level: 20, kind: 'nova', power: 1.3, sp: 10, cd: 5, effect: { id: 'drain', chance: 0.4 } },
  holy_lance: { name: 'Holy Lance', element: 'Light', level: 60, kind: 'beam', power: 2.6, sp: 22, cd: 9 },
  judgement: { name: 'Judgement', element: 'Light', level: 120, kind: 'burst', power: 4, sp: 44, cd: 18, effect: { id: 'drain', chance: 0.6 } },
  shadow_bolt: { name: 'Shadow Bolt', element: 'Dark', level: 1, kind: 'bolt', power: 1.3, sp: 4, cd: 1.2, effect: { id: 'drain', chance: 0.15 } },
  curse: { name: 'Curse', element: 'Dark', level: 20, kind: 'burst', power: 1.3, sp: 10, cd: 4, effect: { id: 'poison', chance: 0.6 } },
  void_nova: { name: 'Void Nova', element: 'Dark', level: 60, kind: 'nova', power: 2.2, sp: 23, cd: 10, effect: { id: 'drain', chance: 0.4 } },
  oblivion: { name: 'Oblivion', element: 'Dark', level: 120, kind: 'burst', power: 4.1, sp: 46, cd: 19, effect: { id: 'drain', chance: 0.6 } },
  // ---- the wider book of spells: more attacks, and spells that heal (heal), guard (ward: +DEF),
  // empower (+MATK) or pin foes in place (stun, seconds; half as long on bosses) ----
  flame_whip: { name: 'Flame Whip', element: 'Fire', level: 5, kind: 'beam', power: 1.3, sp: 5, cd: 1.6, effect: { id: 'burn', chance: 0.3 } },
  ember_shield: { name: 'Ember Shield', element: 'Fire', level: 10, kind: 'ward', pct: 30, secs: 15, sp: 8, cd: 25 },
  kindle_the_soul: { name: 'Kindle the Soul', element: 'Fire', level: 30, kind: 'empower', pct: 40, secs: 15, sp: 14, cd: 35 },
  wall_of_fire: { name: 'Wall of Fire', element: 'Fire', level: 40, kind: 'nova', power: 1.6, sp: 16, cd: 8, effect: { id: 'burn', chance: 0.5 } },
  phoenix_flame: { name: 'Phoenix Flame', element: 'Fire', level: 90, kind: 'heal', pct: 40, sp: 26, cd: 35 },
  sun_collapse: { name: 'Sun Collapse', element: 'Fire', level: 200, kind: 'burst', power: 6, sp: 70, cd: 30, effect: { id: 'burn', chance: 1 } },
  soothing_water: { name: 'Soothing Water', element: 'Water', level: 5, kind: 'heal', pct: 15, sp: 6, cd: 18 },
  ice_shield: { name: 'Ice Shield', element: 'Water', level: 10, kind: 'ward', pct: 35, secs: 15, sp: 8, cd: 25 },
  frozen_grasp: { name: 'Frozen Grasp', element: 'Water', level: 30, kind: 'burst', power: 1.2, sp: 13, cd: 10, stun: 2.5 },
  geyser: { name: 'Geyser', element: 'Water', level: 40, kind: 'bolt', power: 2, sp: 14, cd: 4 },
  glacier_tomb: { name: 'Glacier Tomb', element: 'Water', level: 90, kind: 'nova', power: 2.6, sp: 32, cd: 18, stun: 3 },
  absolute_zero: { name: 'Absolute Zero', element: 'Water', level: 200, kind: 'nova', power: 5.5, sp: 68, cd: 32, stun: 4, effect: { id: 'frost', chance: 1 } },
  stone_ward: { name: 'Stone Ward', element: 'Earth', level: 5, kind: 'ward', pct: 40, secs: 12, sp: 7, cd: 25 },
  mud_trap: { name: 'Mud Trap', element: 'Earth', level: 10, kind: 'burst', power: 1, sp: 7, cd: 8, stun: 1.5 },
  boulder: { name: 'Boulder', element: 'Earth', level: 30, kind: 'bolt', power: 2.2, sp: 13, cd: 4.5 },
  earthen_vigour: { name: 'Earthen Vigour', element: 'Earth', level: 40, kind: 'heal', pct: 25, sp: 14, cd: 25 },
  mountain_guard: { name: 'Mountain Guard', element: 'Earth', level: 90, kind: 'ward', pct: 90, secs: 15, sp: 28, cd: 50 },
  continental_crush: { name: 'Continental Crush', element: 'Earth', level: 200, kind: 'burst', power: 6.2, sp: 72, cd: 32 },
  tailwind: { name: 'Tailwind', element: 'Wind', level: 5, kind: 'empower', pct: 20, secs: 15, sp: 6, cd: 25 },
  air_cushion: { name: 'Air Cushion', element: 'Wind', level: 10, kind: 'ward', pct: 25, secs: 15, sp: 6, cd: 22 },
  vacuum_blade: { name: 'Vacuum Blade', element: 'Wind', level: 30, kind: 'beam', power: 2, sp: 13, cd: 4, effect: { id: 'bleed', chance: 0.4 } },
  downdraft: { name: 'Downdraft', element: 'Wind', level: 40, kind: 'nova', power: 1.5, sp: 15, cd: 10, stun: 2 },
  breath_of_life: { name: 'Breath of Life', element: 'Wind', level: 90, kind: 'heal', pct: 35, sp: 24, cd: 30 },
  heavens_gale: { name: 'Heaven\'s Gale', element: 'Wind', level: 200, kind: 'beam', power: 5.6, sp: 66, cd: 28, effect: { id: 'bleed', chance: 0.6 } },
  static_charge: { name: 'Static Charge', element: 'Lightning', level: 5, kind: 'empower', pct: 25, secs: 15, sp: 7, cd: 25 },
  shock_net: { name: 'Shock Net', element: 'Lightning', level: 10, kind: 'burst', power: 1, sp: 7, cd: 8, stun: 1.5 },
  thunder_spear: { name: 'Thunder Spear', element: 'Lightning', level: 30, kind: 'bolt', power: 2.4, sp: 14, cd: 4.5 },
  lightning_armour: { name: 'Lightning Armour', element: 'Lightning', level: 40, kind: 'ward', pct: 50, secs: 15, sp: 15, cd: 35 },
  plasma_storm: { name: 'Plasma Storm', element: 'Lightning', level: 90, kind: 'nova', power: 3.2, sp: 34, cd: 16 },
  wrath_of_heaven: { name: 'Wrath of Heaven', element: 'Lightning', level: 200, kind: 'burst', power: 6.4, sp: 72, cd: 32 },
  rejuvenate: { name: 'Rejuvenate', element: 'Nature', level: 5, kind: 'heal', pct: 18, sp: 6, cd: 18 },
  bark_ward: { name: 'Bark Ward', element: 'Nature', level: 10, kind: 'ward', pct: 30, secs: 18, sp: 7, cd: 25 },
  vine_lash: { name: 'Vine Lash', element: 'Nature', level: 30, kind: 'beam', power: 1.8, sp: 12, cd: 4, effect: { id: 'poison', chance: 0.5 } },
  root_prison: { name: 'Root Prison', element: 'Nature', level: 40, kind: 'burst', power: 1.2, sp: 15, cd: 12, stun: 3 },
  spore_bloom: { name: 'Spore Bloom', element: 'Nature', level: 90, kind: 'nova', power: 2.8, sp: 30, cd: 16, effect: { id: 'poison', chance: 0.8 } },
  world_tree_blessing: { name: 'Blessing of the World Tree', element: 'Nature', level: 200, kind: 'heal', pct: 80, sp: 60, cd: 60 },
  holy_light_spell: { name: 'Healing Light', element: 'Light', level: 5, kind: 'heal', pct: 20, sp: 7, cd: 18 },
  sanctuary: { name: 'Sanctuary', element: 'Light', level: 10, kind: 'ward', pct: 35, secs: 15, sp: 8, cd: 25 },
  blinding_flash: { name: 'Blinding Flash', element: 'Light', level: 30, kind: 'nova', power: 1.1, sp: 13, cd: 12, stun: 2.5 },
  divine_favour: { name: 'Divine Favour', element: 'Light', level: 40, kind: 'empower', pct: 45, secs: 15, sp: 16, cd: 35 },
  lay_on_hands: { name: 'Lay on Hands', element: 'Light', level: 90, kind: 'heal', pct: 55, sp: 30, cd: 40 },
  celestial_ray: { name: 'Celestial Ray', element: 'Light', level: 200, kind: 'beam', power: 6.2, sp: 70, cd: 30, effect: { id: 'drain', chance: 0.6 } },
  dark_pact: { name: 'Dark Pact', element: 'Dark', level: 5, kind: 'empower', pct: 30, secs: 15, sp: 7, cd: 25 },
  shadow_cloak: { name: 'Shadow Cloak', element: 'Dark', level: 10, kind: 'ward', pct: 30, secs: 15, sp: 7, cd: 25 },
  soul_leech: { name: 'Soul Leech', element: 'Dark', level: 30, kind: 'bolt', power: 1.8, sp: 12, cd: 3.5, effect: { id: 'drain', chance: 1 } },
  nightmare: { name: 'Nightmare', element: 'Dark', level: 40, kind: 'burst', power: 1.4, sp: 15, cd: 12, stun: 2.5 },
  blood_ritual: { name: 'Blood Ritual', element: 'Dark', level: 90, kind: 'heal', pct: 45, sp: 26, cd: 35 },
  the_abyss: { name: 'The Abyss', element: 'Dark', level: 200, kind: 'nova', power: 6, sp: 70, cd: 32, effect: { id: 'drain', chance: 0.8 } },
};
// desc: what it looks like and when to use it (data/descriptions.mjs)
for (const [id, s] of Object.entries(SPELLS)) { s.id = id; s.desc = SPELL_DESC[id] || ''; }

// the Dark Side casts the same spells, dark and stronger
export const DARK_SPELL_POWER = 1.35;
export const darkSpells = (c) => c?.pact === 'dark';
export const spellName = (sp, c) => (darkSpells(c) ? `Dark ${sp.name}` : sp.name);
export const spellPower = (sp, c) => sp.power * (darkSpells(c) ? DARK_SPELL_POWER : 1);

export const SPELL_EVERY = { mage: 10, other: 20 };
export const spellEvery = (cls) => (cls === 'mage' ? SPELL_EVERY.mage : SPELL_EVERY.other);
// how many spells a staff holds: 3, or 5 for a Legendary or Mythic staff (rank index 5 and 6)
export const staffSlots = (rank) => (rank >= 5 ? 5 : 3);
export const KIND_TEXT = { bolt: 'one foe at range', burst: 'a foe and those round it', nova: 'everything round you', beam: 'up to three foes in a line',
  heal: 'heals you', ward: 'guards you (+DEF)', empower: 'strengthens your magic (+MATK)' };
// the spells that work on yourself, not on a foe
export const SELF_KINDS = ['heal', 'ward', 'empower'];

// ---------- ranks and kinds, for the filters ----------
// A spell's rank, F to SSS, comes from the level it can first be learned at (see spellRank). Its kind (the same kinds as skills) comes from
// what it does: heal = Healing, ward = Defence, empower = Support, a pin = Control, else Attack.
// F below level 5, E from 5, D from 10, C from 20, B from 40, A from 60, S from 90, SS from 120, SSS at 200
const SPELL_RANK_FROM = [['SSS', 200], ['SS', 120], ['S', 90], ['A', 60], ['B', 40], ['C', 20], ['D', 10], ['E', 5]];
export const spellRank = (sp) => SPELL_RANK_FROM.find(([, lv]) => sp.level >= lv)?.[0] || 'F';
export function spellCategory(sp) {
  if (sp.kind === 'heal') return 'healing';
  if (sp.kind === 'ward') return 'defence';
  if (sp.kind === 'empower') return 'support';
  if (sp.stun) return 'control';
  return 'attack';
}
const EFFECT_WORDS = { burn: 'set foes burning', poison: 'poison foes', bleed: 'make foes bleed', frost: 'slow foes', drain: 'drain life' };
// what a spell does, in words
export function spellText(sp) {
  if (sp.kind === 'heal') return `Restore ${sp.pct}% of your HP`;
  if (sp.kind === 'ward') return `+${sp.pct}% DEF for ${sp.secs} s`;
  if (sp.kind === 'empower') return `+${sp.pct}% MATK for ${sp.secs} s`;
  let t = `${sp.power}× MATK to ${KIND_TEXT[sp.kind]}`;
  if (sp.stun) t += `, pins them for ${sp.stun} s`;
  if (sp.effect) t += `, ${sp.effect.chance >= 1 ? 'always' : `${Math.round(sp.effect.chance * 100)}% chance to`} ${EFFECT_WORDS[sp.effect.id] || sp.effect.id}`;
  return t;
}

// A spell you don't know yet, at random from your elements and level (null if none is left)
export function randomSpell(c, rnd = Math.random) {
  const els = c.elements || [];
  const known = new Set(c.spells || []);
  const open = Object.values(SPELLS).filter((s) => els.includes(s.element) && s.level <= c.level && !known.has(s.id));
  if (!open.length) return null;
  // newer, stronger spells are a little more likely once you reach them
  const weights = open.map((s) => 1 + s.level / 40);
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < open.length; i++) { r -= weights[i]; if (r <= 0) return open[i].id; }
  return open[open.length - 1].id;
}

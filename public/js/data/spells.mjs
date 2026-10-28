// Spells: cast with a staff in one of your elements. A Mage learns a new spell every 10 levels,
// anyone else every 20 (given at random from their elements, like skills). Spells are attached to
// a staff to be cast: 3 to a staff, 5 to a Legendary or Mythic one. The attack key casts the chosen
// spell; the Spell key (X) changes which one.
//
// kind: bolt (one foe at range), burst (a foe and those around it), nova (everything round you),
// beam (up to three foes in a line). power multiplies MATK; effect is a chance of an EFFECTS id.
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
};
for (const [id, s] of Object.entries(SPELLS)) s.id = id;

export const SPELL_EVERY = { mage: 10, other: 20 };
export const spellEvery = (cls) => (cls === 'mage' ? SPELL_EVERY.mage : SPELL_EVERY.other);
// how many spells a staff holds: 3, or 5 for a Legendary or Mythic staff (rank index 5 and 6)
export const staffSlots = (rank) => (rank >= 5 ? 5 : 3);
export const KIND_TEXT = { bolt: 'one foe at range', burst: 'a foe and those round it', nova: 'everything round you', beam: 'up to three foes in a line' };

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

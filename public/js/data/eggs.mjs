// Dragon and wyvern eggs (see world/hatchery.js). Every dragon's and wyvern's lair has a nest with
// eggs that look like the beast that laid them. Take one (the parent sees you and attacks), set it
// down somewhere that suits it, keep it warm (or cold, or out in the storms) and turn it now and
// then, and it hatches into a baby that follows you about. It grows up into a beast you can fly.
//   heat: what the egg needs round it to warm (see HEAT)
//   secs: seconds of warming (with you nearby) before it hatches
//   look: shell colour, markings colour, and how it is marked (veins that glow, spots, or ice crystals)
export const EGGS = {
  fire_dragon: { beast: 'Fire Dragon', heat: 'fire', secs: 540, size: 0.8, price: 15000,
    look: { shell: '#4a0e06', mark: '#ff6a10', marks: 'veins', glow: 2.2 },
    text: 'A heavy black-red egg, hot to the touch. Cracks of fire glow through the shell.' },
  storm_dragon: { beast: 'Storm Dragon', heat: 'storm', secs: 540, size: 0.78, price: 15000,
    look: { shell: '#1e2a40', mark: '#9ae8ff', marks: 'veins', glow: 2, flicker: true },
    text: 'A dark slate-blue egg. Little sparks of lightning crawl over it, and it hums before a storm.' },
  frost_dragon: { beast: 'Frost Dragon', heat: 'cold', secs: 540, size: 0.78, price: 15000,
    look: { shell: '#dcefff', mark: '#7ac8f0', marks: 'crystals', glow: 0.6 },
    text: 'A pale egg crusted with ice crystals. It never melts, and it frosts your hands.' },
  fire_wyvern: { beast: 'Fire Wyvern', heat: 'fire', secs: 300, size: 0.5, price: 6000,
    look: { shell: '#a8461a', mark: '#3a1608', marks: 'spots', glow: 0 },
    text: 'A rust-red egg speckled black, warm as a hearthstone.' },
  frost_wyvern: { beast: 'Frost Wyvern', heat: 'cold', secs: 300, size: 0.48, price: 6000,
    look: { shell: '#c4dcea', mark: '#4a7a98', marks: 'spots', glow: 0 },
    text: 'A cold blue-white egg with grey-blue speckles.' },
  peak_wyvern: { beast: 'Peak Wyvern', heat: 'fire', secs: 300, size: 0.46, price: 5000,
    look: { shell: '#8a8272', mark: '#3e362e', marks: 'spots', glow: 0 },
    text: 'A stone-grey egg with dark speckles. Easy to mistake for a rock.' },
};
// what each kind of egg needs round it while it warms
export const HEAT = {
  fire: 'a lit campfire beside it (within 4 m)',
  cold: 'snow and ice: Frostreach, or high on a snowy mountain (above 1,300 m)',
  storm: 'the storm winds high on a mountain (above 1,200 m)',
};
export const NEST_EGGS = 2;            // eggs in a full nest
export const EGG_RETURNS = 2 * 3600e3; // ms until the beast lays again in place of a taken egg (each egg on its own)
export const TURN_EVERY = 75;          // seconds of warming between turns (E beside it)
export const GROW_SECS = 45 * 60;      // seconds a hatchling spends with you before it is grown
export const EGG_NEAR = 150;           // an egg only warms while you are this close to it

// the items: an egg and a hatchling of each kind
export const EGG_ITEMS = {};
for (const [id, e] of Object.entries(EGGS)) {
  EGG_ITEMS[`egg_${id}`] = { name: `${e.beast} Egg`, icon: '🥚', kind: 'egg', egg: id, price: e.price, text: `${e.text} To hatch it, set it down with ${HEAT[e.heat]}, and turn it now and then.` };
  EGG_ITEMS[`hatchling_${id}`] = { name: `${e.beast} Hatchling`, icon: e.beast.includes('Dragon') ? '🐲' : '🐉', kind: 'pet', hatchling: id, price: e.price * 2, text: `A baby ${e.beast.toLowerCase()} that hatched in your care. It follows you everywhere, and after ${GROW_SECS / 60} minutes with you it is grown enough to fly you.` };
}

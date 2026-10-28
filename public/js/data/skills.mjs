// Skills learned at every 25th level (an upgrade). Each one costs SP and then needs a short rest (cooldown).
// type: strike (one foe in front), sweep (every foe around you), bolt (a foe further away, in front),
// dash (charge forward and hit what you reach), heal (restore part of your HP), buff (raise ATK or DEF
// for a while). mult multiplies your ATK (or MATK when magic).
export const SKILLS = {
  power_strike: { name: 'Power Strike', icon: '💥', type: 'strike', mult: 2, sp: 8, cd: 4, text: 'One heavy blow: double damage.' },
  whirlwind: { name: 'Whirlwind', icon: '🌀', type: 'sweep', mult: 1.3, radius: 3.5, sp: 14, cd: 8, text: 'Spin and hit every foe around you.' },
  charge: { name: 'Charge', icon: '🐗', type: 'dash', mult: 1.5, dist: 7, sp: 10, cd: 7, text: 'Rush forward and strike the first foe you meet.' },
  battle_cry: { name: 'Battle Cry', icon: '📯', type: 'buff', stat: 'atk', pct: 30, secs: 15, sp: 15, cd: 30, text: '+30% ATK for 15 seconds.' },
  iron_skin: { name: 'Iron Skin', icon: '🛡️', type: 'buff', stat: 'def', pct: 50, secs: 15, sp: 15, cd: 30, text: '+50% DEF for 15 seconds.' },
  second_wind: { name: 'Second Wind', icon: '💨', type: 'heal', pct: 25, sp: 18, cd: 40, text: 'Catch your breath: restore 25% of your HP.' },
  fire_bolt: { name: 'Fire Bolt', icon: '🔥', type: 'bolt', mult: 1.8, reach: 16, magic: true, sp: 10, cd: 3, text: 'Hurl fire at a foe up to 16 m away (MATK).' },
  frost_nova: { name: 'Frost Nova', icon: '❄️', type: 'sweep', mult: 1.4, radius: 5, magic: true, sp: 20, cd: 10, text: 'A burst of cold hits every foe within 5 m (MATK).' },
  arcane_lance: { name: 'Arcane Lance', icon: '🔮', type: 'bolt', mult: 2.6, reach: 22, magic: true, sp: 22, cd: 8, text: 'A spear of pure magic, up to 22 m (MATK).' },
  mend: { name: 'Mend', icon: '✚', type: 'heal', pct: 35, sp: 16, cd: 20, text: 'Restore 35% of your HP.' },
  blessing: { name: 'Blessing', icon: '✨', type: 'buff', stat: 'def', pct: 35, secs: 20, sp: 14, cd: 30, text: '+35% DEF for 20 seconds.' },
  backstab: { name: 'Backstab', icon: '🗡️', type: 'strike', mult: 2.8, sp: 12, cd: 6, text: 'A precise strike for nearly triple damage.' },
  shadow_step: { name: 'Shadow Step', icon: '🌑', type: 'dash', mult: 2, dist: 9, sp: 14, cd: 9, text: 'Vanish forward 9 m and strike.' },
  shield_bash: { name: 'Shield Bash', icon: '🧱', type: 'strike', mult: 1.6, sp: 8, cd: 5, text: 'Slam a foe with your guard.' },
  ground_slam: { name: 'Ground Slam', icon: '🪨', type: 'sweep', mult: 1.6, radius: 4, sp: 18, cd: 10, text: 'Pound the ground and hit everything within 4 m.' },
  hammer_blow: { name: 'Hammer Blow', icon: '🔨', type: 'strike', mult: 2.3, sp: 10, cd: 5, text: 'A smith\'s crushing blow.' },
  harvest_swing: { name: 'Harvest Swing', icon: '🌾', type: 'sweep', mult: 1.2, radius: 3, sp: 10, cd: 6, text: 'A wide scything sweep.' },
  hearty_meal: { name: 'Hearty Meal', icon: '🍖', type: 'heal', pct: 30, sp: 12, cd: 30, text: 'Eat well: restore 30% of your HP.' },
  coin_toss: { name: 'Gold Shot', icon: '🪙', type: 'bolt', mult: 1.5, reach: 14, sp: 8, cd: 4, text: 'Fling a weighted coin at a foe up to 14 m away.' },
  haggle: { name: 'Bribe the Odds', icon: '💰', type: 'buff', stat: 'atk', pct: 25, secs: 20, sp: 12, cd: 30, text: '+25% ATK for 20 seconds.' },
  quick_wall: { name: 'Quick Wall', icon: '🧱', type: 'buff', stat: 'def', pct: 60, secs: 10, sp: 16, cd: 30, text: 'Throw up cover: +60% DEF for 10 seconds.' },
};
for (const [id, s] of Object.entries(SKILLS)) s.id = id;

// Skills each class is offered first; everyone can also be offered the general ones
const BY_CLASS = {
  swordsman: ['power_strike', 'whirlwind', 'charge', 'battle_cry'],
  mage: ['fire_bolt', 'frost_nova', 'arcane_lance', 'mend'],
  healer: ['mend', 'blessing', 'second_wind', 'fire_bolt'],
  assassin: ['backstab', 'shadow_step', 'whirlwind', 'battle_cry'],
  tank: ['shield_bash', 'iron_skin', 'ground_slam', 'charge'],
  blacksmith: ['hammer_blow', 'ground_slam', 'iron_skin', 'power_strike'],
  farmer: ['harvest_swing', 'hearty_meal', 'charge', 'second_wind'],
  businessman: ['coin_toss', 'haggle', 'second_wind', 'power_strike'],
  builder: ['quick_wall', 'ground_slam', 'hammer_blow', 'iron_skin'],
  potion_maker: ['mend', 'frost_nova', 'second_wind', 'fire_bolt'],
};
const GENERAL = ['power_strike', 'second_wind', 'battle_cry', 'iron_skin', 'whirlwind', 'charge'];

// Every 25th level is an upgrade: a little stronger, and a new skill, given at random
export const UPGRADE_EVERY = 25;
export const UPGRADE_STATS = 2; // added to every stat
export const SKILL_BAR = 6;     // skills you can have ready at once; the rest are kept in storage
export const DEFAULT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
// keys the game already uses, so a skill can't take them
export const RESERVED_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight',
  'KeyF', 'KeyU', 'KeyZ', 'KeyT', 'KeyC', 'KeyI', 'KeyB', 'KeyQ', 'KeyH', 'KeyM', 'KeyO', 'KeyL', 'KeyR', 'KeyK', 'KeyP', 'KeyG', 'KeyV', 'Escape', 'Tab', 'Enter'];
export const keyLabel = (code) => (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');

// A new skill, given at random (players don't choose). Your class's skills turn up most often and
// the general ones next; stronger skills (the ones that cost more SP) are rarer.
export function randomSkill(c, rnd = Math.random) {
  const known = new Set(c.skills || []);
  const pool = Object.keys(SKILLS).filter((id) => !known.has(id));
  if (!pool.length) return null;
  const weight = (id) => (BY_CLASS[c.cls]?.includes(id) ? 4 : GENERAL.includes(id) ? 2 : 1) * 10 / Math.max(8, SKILLS[id].sp);
  let r = rnd() * pool.reduce((a, id) => a + weight(id), 0);
  for (const id of pool) if ((r -= weight(id)) <= 0) return id;
  return pool[pool.length - 1];
}


// Hunger: how full you are, from 100 (just eaten) down to 0 (starving). It falls slowly while you
// play (faster when you run or fight) and rises when you eat. Potions don't fill you; drinks a little.
//   below 30  Hungry: resting no longer heals you
//   at 0      Starving: you lose a little HP every few seconds (never below a tenth) and hit softer
export const HUNGER_MAX = 100;
export const HUNGER_DRAIN = 100 / (90 * 60); // a full belly lasts about 90 minutes of play
export const HUNGRY = 30;
export const STARVE_HIT = 0.02;              // share of max HP lost every 5 s while starving
export const STARVE_FLOOR = 0.1;             // ...down to this share, never lower
export const STARVE_ATK = 0.8;               // your blows while starving

const DRINKS = ['water_flask', 'herbal_tea', 'mint_tea', 'fruit_juice', 'ayran'];
// how much an item fills you (0 for potions, elixirs, oils)
export function fillOf(id, it) {
  if (!it || it.kind !== 'food') return 0;
  if (it.fill !== undefined) return it.fill;
  if (/potion|elixir|booster|draught|oil/.test(id)) return 0;
  if (DRINKS.includes(id)) return 6;
  return Math.min(60, Math.round((it.heal || 0) / 3 + (it.sp || 0) / 4) + 8);
}
export const hungerWord = (h) => (h <= 0 ? 'Starving' : h < HUNGRY ? 'Hungry' : h < 70 ? 'Peckish' : 'Full');

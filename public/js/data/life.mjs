// A life in the realm: how old you are, how long your race lives, and what happens when you die.
//   - Every character has 3 lives. Dying costs one, and you wake at the nearest shrine; when the
//     last is gone, death is final (only the Unique Skill passes on to the next life).
//   - From level 250 a character is hard to keep down: dying to monsters, a fall, or even old age
//     costs nothing and they rise again at a shrine (old age renews them at 25). But being killed by
//     another player (a monster player or a fight between players) costs a life as for anyone.
//   - Below level 250, dying of old age is the end of that life.
//   - After the Ceremony one year passes every 4 hours of play. Each race has its own lifespan.
import { ageOf, CEREMONY_AGE, seeded, LIFESPAN, ADULT_YEAR_MS } from './birth.mjs';
export { LIFESPAN, ADULT_YEAR_MS };

export const LIVES = 3;
export const UNDYING_LEVEL = 250;
export const MARRY_AGE = 25;
export const RENEW_AGE = 25; // the age an undying character is renewed at after dying of old age
const FIRST_AGE = 18; // characters made before ages were kept start at this age
export const lifespanOf = (c) => Math.round((LIFESPAN[c.race] || 90) * (0.9 + seeded(`life:${c.name}:${c.race}`)() * 0.2));

// How old a character is, in years
export function ageYears(c) {
  const child = ageOf(c);
  if (child != null) return child;
  const base = c.grownPlay != null ? CEREMONY_AGE : FIRST_AGE;
  return base + Math.max(0, (c.playMs || 0) - (c.grownPlay || 0)) / ADULT_YEAR_MS + (c.ageShift || 0);
}
// Play time left before turning `age` (0 if already that old)
export const msUntilAge = (c, age) => Math.max(0, (age - ageYears(c)) * ADULT_YEAR_MS);
export const canMarry = (c) => ageOf(c) == null && ageYears(c) >= MARRY_AGE;
export const livesLeft = (c) => (Number.isInteger(c.livesLeft) ? c.livesLeft : LIVES); // (c.lives counts which life this is)
export const diedOfAge = (c) => ageOf(c) == null && ageYears(c) >= lifespanOf(c);

// What a death means. `cause` is 'monster', 'fall', 'drown', 'age' or 'player'.
// Returns { rise: true, free, livesLeft } (wake at a shrine) or { rise: false } (death is final).
export function deathOutcome(c, cause) {
  if (c.level >= UNDYING_LEVEL && cause !== 'player') return { rise: true, free: true, livesLeft: livesLeft(c), renewed: cause === 'age' };
  if (cause === 'age') return { rise: false };
  const left = livesLeft(c) - 1;
  return left > 0 ? { rise: true, free: false, livesLeft: left } : { rise: false };
}
// Apply a death that you rise from: one life fewer (unless free), and renewed if it was old age
export function applyRise(c, out) {
  if (!out.free) c.livesLeft = out.livesLeft;
  if (out.renewed) c.ageShift = (c.ageShift || 0) - (ageYears(c) - RENEW_AGE);
}

// Marriage and children. From the age of 25 (see data/life.mjs) a character can marry another
// player or a townsperson of any race. A married couple can have children; anyone can also pay
// the Temple of the shrine to be given a child to raise. The parent picks each child's school.
// A child takes either parent's race (half and half), and at its Ceremony its class is one
// parent's (a quarter each) or anything at all (the other half).
// When a parent's death is final, they can be reborn as one of their children: a child of 4 in
// the family's house, of the child's race, already set on the school its parent chose.
import { RACES, STARTER_CLASSES } from './game-data.mjs';
import { seeded, townName, SCHOOLS, plannedClassOdds } from './birth.mjs';
export { plannedClassOdds };
import { SILVER, GOLD } from './money.mjs';

export const WEDDING_FEE = 50 * SILVER;      // the shrine's fee for a wedding
export const ADOPT_FEE = 2 * GOLD;            // to be given a child by the Temple
export const CHILD_EVERY_MS = 12 * 60 * 60 * 1000; // a married couple's next child: 12 hours of play later (3 years)
export const MAX_CHILDREN = 6;
export const SUITORS = 3;

// Townsfolk looking to marry, a fresh few each day of the realm: { name, race, cls, level }
export function suitorsFor(c, day) {
  const rnd = seeded(`suitors:${c.name}:${day}`);
  const races = Object.keys(RACES);
  const classes = STARTER_CLASSES;
  return Array.from({ length: SUITORS }, (_, i) => {
    const race = races[Math.floor(rnd() * races.length)];
    return { id: `s${day}_${i}`, name: townName(RACES[race].side, rnd), race, cls: classes[Math.floor(rnd() * classes.length)], level: 15 + Math.floor(rnd() * 120) };
  });
}

// A new child: its race from either parent, and the classes its parents hold for its Ceremony
export function newChild(c, school, rnd = Math.random) {
  const sp = c.spouse;
  const race = sp && rnd() < 0.5 ? sp.race : c.race;
  return { name: townName(RACES[race].side, rnd), race, plan: { a: c.cls, b: sp?.cls || null }, school: SCHOOLS[school] ? school : null, born: c.playMs || 0 };
}
export const nextChildIn = (c) => Math.max(0, (c.lastChildPlay ?? -Infinity) + CHILD_EVERY_MS - (c.playMs || 0));

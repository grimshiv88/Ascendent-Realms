// The Blacksmith's merge book: every pair of weapons or armour that can be merged, and what each
// pair makes. Two pieces merge only when they share a sub-category (a sword with a sword, a helmet
// with a helmet). The table is built once from the ladders below, so every new item joins it.
//
// Each sub-category is a ladder, weakest first. Merging two pieces:
//  - the same piece twice: that piece, one + stronger, keeping both pieces' upgrades (up to +10);
//  - two pieces of about the same strength (within one rank): the next piece up the ladder, a new
//    item, keeping half of their upgrades;
//  - a weak piece melted into a much stronger one: the stronger piece, one + stronger.
// Mythic pieces never come out of a merge: only the Kings hold those.
import { ITEMS, isGear, MAX_PLUS, categoryOf } from './items.mjs';

// which ladder an item is on: 'weapon:sword', 'armour:head', ... (monster gear has its own: 'weapon:sword:beast')
export const subOf = (it) => { const k = it?.kind === 'weapon' ? `weapon:${it.type}` : it?.kind === 'armour' ? `armour:${it.slot}` : null; return k && it.beast ? `${k}:beast` : k; };
const strength = (it) => (it.kind === 'weapon' ? it.power : (it.def || 0) + (it.mdef || 0));

export const LADDERS = {};
for (const it of Object.values(ITEMS)) {
  if (!isGear(it) || (it.rank || 0) >= 6) continue;
  (LADDERS[subOf(it)] ||= []).push(it.id);
}
for (const list of Object.values(LADDERS)) {
  list.sort((a, b) => (ITEMS[a].rank || 0) - (ITEMS[b].rank || 0) || strength(ITEMS[a]) - strength(ITEMS[b]) || a.localeCompare(b));
}
export const ladderName = (sub) => { const id = LADDERS[sub]?.[0]; return id ? categoryOf(ITEMS[id]) : null; };

// The book itself: 'idA|idB' (ids in alphabetical order) -> { makes, kind }
// kind: 'same' (one piece twice), 'new' (a new piece up the ladder), 'up' (the stronger piece, +1)
export const MERGES = new Map();
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
for (const list of Object.values(LADDERS)) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i; j < list.length; j++) {
      const lo = ITEMS[list[i]], hi = ITEMS[list[j]];
      let entry;
      if (i === j) entry = { makes: hi.id, kind: 'same' };
      else if ((hi.rank || 0) - (lo.rank || 0) <= 1 && j + 1 < list.length) entry = { makes: list[j + 1], kind: 'new' };
      else entry = { makes: hi.id, kind: 'up' };
      MERGES.set(pairKey(lo.id, hi.id), entry);
    }
  }
}
export const MERGE_COUNT = MERGES.size;
export const recipeFor = (aId, bId) => MERGES.get(pairKey(aId, bId)) || null;

// What merging two bag entries ({ id, plus }) makes: { id, plus, kind } or null if they don't merge.
export function mergeOutcome(a, b) {
  if (!a || !b) return null;
  const r = recipeFor(a.id, b.id);
  if (!r) return null;
  const pa = a.plus || 0, pb = b.plus || 0;
  if (r.kind === 'same') return { id: r.makes, plus: Math.min(MAX_PLUS, pa + pb + 1), kind: 'same' };
  if (r.kind === 'new') return { id: r.makes, plus: Math.min(MAX_PLUS, Math.floor((pa + pb) / 2)), kind: 'new' };
  const keep = a.id === r.makes ? pa : pb; // the stronger piece keeps its own upgrades
  return { id: r.makes, plus: Math.min(MAX_PLUS, keep + 1), kind: 'up' };
}

// Everything a piece can be merged with, and what each makes (for the merge book in the smithy)
export function mergesWith(id) {
  const sub = subOf(ITEMS[id]);
  return (LADDERS[sub] || []).map((other) => ({ with: other, ...recipeFor(id, other) }));
}

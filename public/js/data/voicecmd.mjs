// Voice commands: what the player said, turned into an order (see voicecmd.js for the listening).
// Nothing here touches the game; it only reads words.
//
// - "<pet's name> <order>": your dragon (or wyvern, or horse) does it. The name is the one you gave
//   it, or simply what it is ("dragon", "wyvern", "horse"). In a party the name must be said, so
//   talking to your friends never sets it off; alone, a bare order ("attack!", "come back") works too.
// - a skill's or a spell's name: it is used. Alone, the name can be anywhere in what you say
//   ("okay, Fireball!"). In a party the name must be all you say, or come after "cast" or "use".
import { cleanText } from './social.mjs';

export const PET_NAME_MAX = 16;

// the orders a pet knows, and the words that mean each (longest phrases are tried first)
export const ORDERS = {
  attack: ['go for', 'get', 'attack', 'kill', 'bite', 'sic', 'charge', 'fight', 'hit', 'strike', 'take down', 'destroy'],
  breathe: ['breathe fire', 'breathe', 'fire', 'burn', 'flame', 'blast', 'frost', 'freeze', 'shock', 'lightning', 'spit fire'],
  back: ['come back', 'come here', 'to me', 'come', 'back', 'return', 'here', 'heel', 'stop', 'leave it', 'enough', 'retreat'],
  stay: ['stay here', 'stay', 'wait', 'sit', 'hold', 'guard'],
  follow: ['follow me', 'follow', 'with me', 'lets go', "let's go"],
};
export const ORDER_HELP = {
  attack: 'goes for the foe you face (or the one you name: "attack the wolf")',
  breathe: 'breathes fire, frost or lightning at what you face',
  back: 'stops fighting and comes back to your side (a horse is called over)',
  stay: 'waits where it is until you say "follow"',
  follow: 'follows you again',
};
// the word for each kind of pet, which also works as its name
export const KIND_WORDS = ['dragon', 'wyvern', 'drake', 'horse', 'donkey', 'camel', 'hatchling', 'pet'];

const FILLER = new Set(['the', 'that', 'this', 'it', 'him', 'her', 'them', 'a', 'an', 'one', 'there', 'over', 'now', 'please', 'go', 'on', 'at', 'my', 'your', 'boy', 'girl']);

export function normal(text) {
  return String(text ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9À-ɏ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// a name for your pet: letters (and single spaces) only, short, and no bad words
export function cleanPetName(name) {
  const n = String(name ?? '').replace(/[^A-Za-zÀ-ɏ ]/g, '').replace(/\s+/g, ' ').trim().slice(0, PET_NAME_MAX);
  if (n.length < 2) return null;
  if (cleanText(n) !== n) return null; // (a bad word was hidden)
  return n;
}

// how far apart two words are (letters added, dropped or changed)
function edits(a, b) {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return row[b.length];
}
// a heard word close enough to the word we want (speech recognition spells names its own way)
const near = (heard, want) => heard === want || (want.length >= 5 && edits(heard, want) <= 1) || (want.length >= 9 && edits(heard, want) <= 2);

// where the words of `name` appear one after another in `words`: [start, end) or null
function findWords(words, name, from = 0) {
  const n = name.split(' ');
  for (let i = from; i + n.length <= words.length; i++) {
    if (n.every((w, k) => near(words[i + k], w))) return [i, i + n.length];
  }
  // the same name heard split or run together ("fire ball" for Fireball, "powerstrike")
  const want = n.join('');
  for (let i = from; i < words.length; i++) {
    let got = '';
    for (let k = i; k < Math.min(words.length, i + 4); k++) {
      got += words[k];
      if (k > i || n.length > 1) { if (near(got, want)) return [i, k + 1]; }
    }
  }
  return null;
}

function readOrder(words) {
  // the order is the first order word heard; longer phrases win at the same spot
  let best = null;
  for (const [order, phrases] of Object.entries(ORDERS)) {
    for (const p of phrases) {
      const at = findWords(words, normal(p));
      if (at && (!best || at[0] < best.at[0] || (at[0] === best.at[0] && at[1] > best.at[1]))) best = { order, at };
    }
  }
  if (!best) return null;
  // what to go for: the words after the order ("attack the big wolf" -> "big wolf"), or none
  const what = words.slice(best.at[1]).filter((w) => !FILLER.has(w)).join(' ') || null;
  return { order: best.order, what, start: best.at[0] };
}

// Turn what was heard into an order.
// opts: { petNames: ['Ignis', 'dragon'], skills: [{ id, name }], spells: [{ id, name }], party: bool }
// Returns { kind: 'pet', order, what, name } | { kind: 'skill', id, name } | { kind: 'spell', id, name } | null
export function parseCommand(text, opts = {}) {
  const words = normal(text).split(' ').filter(Boolean);
  if (!words.length) return null;
  const party = !!opts.party;
  // 1) a pet called by its name
  const names = [...new Set((opts.petNames || []).map(normal).filter(Boolean))];
  for (const name of names.sort((a, b) => b.length - a.length)) {
    const at = findWords(words, name);
    if (!at) continue;
    const o = readOrder(words.slice(at[1])) || readOrder(words.slice(0, at[0]));
    if (o) return { kind: 'pet', order: o.order, what: o.what, name };
    // just the name: it comes to you
    if (words.length === at[1] - at[0]) return { kind: 'pet', order: 'back', what: null, name };
  }
  // 2) a skill or a spell, by its name (the longest name heard wins: "Greater Fireball" over "Fireball")
  const all = [...(opts.skills || []).map((s) => ({ ...s, kind: 'skill' })), ...(opts.spells || []).map((s) => ({ ...s, kind: 'spell' }))]
    .map((s) => ({ ...s, n: normal(s.name) })).filter((s) => s.n).sort((a, b) => b.n.length - a.n.length);
  for (const s of all) {
    const at = findWords(words, s.n);
    if (!at) continue;
    if (party) {
      // with friends listening, only the name alone (or "cast X" / "use X") counts
      const before = words.slice(0, at[0]).filter((w) => !FILLER.has(w));
      const after = words.slice(at[1]).filter((w) => !FILLER.has(w));
      const lead = before.length === 0 || (before.length === 1 && ['cast', 'use', 'activate'].includes(before[0]));
      if (!lead || after.length) continue;
    }
    return { kind: s.kind, id: s.id, name: s.name };
  }
  // 3) alone, a bare order at the start of what you said goes to your pet
  if (!party) {
    const o = readOrder(words);
    if (o && o.start === 0) return { kind: 'pet', order: o.order, what: o.what, name: null };
  }
  return null;
}

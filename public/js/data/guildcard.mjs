// The Main Guild Hall's rules, shared by the game and the server: who may enter, the Hunter's Guild
// Card, and the Bounty Board.
//
// Guild Card: only players of GUILD_HALL_LEVEL or more may enter the Guild Hall. At the counter a
// player asks for a Hunter Card and pays the fee, then goes to the Assessment Room and lays a hand
// on the crystal, which reads their level and stats and gives the card its rank. Guild requests
// carry a rank too, and a hunter can take only those at or below their card's rank. Touching the
// crystal again later (free) brings the rank up to date.
//
// Bounties: any player can put a bounty on another player or monster player (any race). They name
// the prize and pay it to the guild with a small fee; the guild holds it and pays the hunter who
// brings the target down. Every day the guild picks 3 to 7 wanted names from the board and adds a
// prize of its own to each.
import { moneyWords } from './money.mjs';
export const GUILD_HALL_LEVEL = 20;
export const CARD_FEE = 200;
export const CARD_RANKS = [
  { id: 'F', level: 20, name: 'Iron' }, { id: 'E', level: 50, name: 'Bronze' }, { id: 'D', level: 100, name: 'Silver' },
  { id: 'C', level: 200, name: 'Gold' }, { id: 'B', level: 350, name: 'Platinum' }, { id: 'A', level: 500, name: 'Mithril' },
  { id: 'S', level: 750, name: 'Adamant' },
];
export const rankIndex = (id) => CARD_RANKS.findIndex((r) => r.id === id);
export const rankForLevel = (level) => { let i = 0; CARD_RANKS.forEach((r, k) => { if (level >= r.level) i = k; }); return CARD_RANKS[i]; };
// A new card read from the crystal: rank and a copy of what it read
export const assess = (c, now = Date.now()) => ({ rank: rankForLevel(c.level).id, level: c.level, stats: { ...c.stats }, issued: c.guildCard?.issued || now, assessed: now });
// how much harder a guild request of `rank` is than an ordinary guild request
export const rankHard = (rank) => 1.6 + Math.max(0, rankIndex(rank)) * 0.25;
export const mayTake = (card, rank) => !!card?.rank && rankIndex(card.rank) >= rankIndex(rank);

// ---------- bounties ----------
export const BOUNTY_MIN = 100, BOUNTY_MAX = 1000000;
export const bountyFee = (prize) => Math.max(20, Math.round(prize * 0.1));
export const FEATURED_MIN = 3, FEATURED_MAX = 7;
const dayOf = (ms) => Math.floor(ms / 86400000);
// a small seeded random, so every player sees the same picks on the same day
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// Today's wanted list: 3 to 7 names (fewer if fewer have bounties), with the guild's own prize added
export function featured(targets, ms = Date.now()) {
  const names = [...new Set(targets)].sort();
  const rnd = seeded(dayOf(ms) * 7919 + names.length);
  const n = Math.min(names.length, FEATURED_MIN + Math.floor(rnd() * (FEATURED_MAX - FEATURED_MIN + 1)));
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  return names.slice(0, n);
}
// the guild's own prize for a featured name: a fifth of what players put up, at least 250
export const guildGift = (total) => Math.max(250, Math.round(total * 0.2));
// Check a new bounty: { target, prize }. Returns { error } or the clean values.
export function checkBounty(body, me) {
  const target = String(body?.target || '').trim();
  const prize = Number(body?.prize);
  if (!target) return { error: 'Whose head is the bounty on?' };
  if (target.toLowerCase() === String(me).toLowerCase()) return { error: "You can't put a bounty on yourself." };
  if (!Number.isInteger(prize) || prize < BOUNTY_MIN || prize > BOUNTY_MAX) return { error: `The prize is ${moneyWords(BOUNTY_MIN)} to ${moneyWords(BOUNTY_MAX)}.` };
  return { target, prize, fee: bountyFee(prize) };
}
// The board as players see it: one line per wanted name with the total prize, featured first
export function boardView(bounties, ms = Date.now(), me = null) {
  const open = bounties.filter((b) => b.state === 'open');
  const byName = new Map();
  for (const b of open) {
    const key = b.target.toLowerCase();
    const e = byName.get(key) || { target: b.target, total: 0, count: 0, mine: 0 };
    e.total += b.prize; e.count += 1;
    if (me && b.by.toLowerCase() === String(me).toLowerCase()) e.mine += b.prize;
    byName.set(key, e);
  }
  const picks = new Set(featured([...byName.values()].map((e) => e.target), ms).map((n) => n.toLowerCase()));
  const list = [...byName.values()].map((e) => ({ ...e, featured: picks.has(e.target.toLowerCase()), gift: picks.has(e.target.toLowerCase()) ? guildGift(e.total) : 0 }));
  list.sort((a, b) => (b.featured - a.featured) || (b.total + b.gift) - (a.total + a.gift));
  return list;
}

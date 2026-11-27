// Trading between players: one player asks another who stands close by, both put items and coins
// on the table, and the trade happens only when both press Confirm on the same offers. Changing
// either side's offer takes both confirmations back, so nobody can swap an item at the last moment.
//
// The same rules run on the server (server/trade.js) and in the preview page (api.js). Each trade is
// a small record; nothing moves until both have confirmed. Then each player's game takes out what
// they gave and puts in what they got (and remembers the trade's id, so it never happens twice).

export const TRADE_NEAR = 10;          // metres: you trade with someone standing close to you
export const ASK_MS = 60 * 1000;       // an unanswered request to trade lapses after a minute
export const IDLE_MS = 10 * 60 * 1000; // a trade nobody touches for ten minutes is called off
export const KEEP_DONE_MS = 30 * 86400 * 1000; // a finished trade waits this long for a player who is away
export const MAX_ITEMS = 12;           // at most this many different things on each side
export const MAX_COINS = 1e12;
export const POLL_MS = 3000;           // how often the game asks about trades
export const POLL_OPEN_MS = 1200;      // ...and while a trade window is open

const low = (s) => String(s || '').trim().toLowerCase();
const same = (a, b) => low(a) === low(b);
const newId = (now) => `t${now.toString(36)}${Math.floor(Math.random() * 36 ** 4).toString(36)}`;
const emptyOffer = () => ({ items: [], coins: 0 });

export const emptyTrades = () => ({ list: [] });

// The other side of a trade
export const otherOf = (t, me) => (same(t.a, me) ? t.b : t.a);
const sideOf = (t, me) => (same(t.a, me) ? 'a' : same(t.b, me) ? 'b' : null);

// A player's trade that is still going on (asked, or open), if any
export const activeOf = (s, me) => s.list.find((t) => (t.state === 'asked' || t.state === 'open') && sideOf(t, me));

// Lapsed requests and forgotten trades go; finished ones stay until both have taken their side
export function sweep(s, now) {
  s.list = s.list.filter((t) => {
    if (t.state === 'asked') return now - t.at < ASK_MS;
    if (t.state === 'open') return now - t.t < IDLE_MS;
    if (t.state === 'done') return !(t.taken?.a && t.taken?.b) && now - t.t < KEEP_DONE_MS;
    return false;
  });
  return s;
}

// `me` asks `them` to trade
export function ask(s, me, them, now) {
  sweep(s, now);
  if (!them) return { error: 'There is no player with that name.' };
  if (same(me, them)) return { error: 'You can\'t trade with yourself.' };
  if (activeOf(s, me)) return { error: 'Finish or cancel the trade you have going first.' };
  if (activeOf(s, them)) return { error: `${them} is already trading with someone.` };
  const t = { id: newId(now), a: me, b: them, state: 'asked', at: now, t: now, v: 0, offers: { a: emptyOffer(), b: emptyOffer() }, ok: {}, taken: {} };
  s.list.push(t);
  return { ok: true, trade: t };
}

// `me` answers a request to trade
export function answer(s, me, id, accept, now) {
  sweep(s, now);
  const t = s.list.find((x) => x.id === id && x.state === 'asked' && same(x.b, me));
  if (!t) return { error: 'That request to trade has lapsed.' };
  if (!accept) { s.list.splice(s.list.indexOf(t), 1); return { ok: true }; }
  if (activeOf(s, me) && activeOf(s, me) !== t) return { error: 'Finish or cancel the trade you have going first.' };
  t.state = 'open'; t.t = now;
  // (any other requests to the same player lapse at once)
  s.list = s.list.filter((x) => x === t || !(x.state === 'asked' && (sideOf(x, t.a) || sideOf(x, t.b))));
  return { ok: true, trade: t };
}

// An offer as it is sent: up to MAX_ITEMS entries and a whole number of Copper.
// `cleanItem` checks one entry (the same check as saving the bag); a gear piece is one whole piece.
export function cleanOffer(o, cleanItem) {
  if (!o || typeof o !== 'object') return { error: 'Bad offer.' };
  const coins = Number(o.coins ?? 0);
  if (!Number.isInteger(coins) || coins < 0 || coins > MAX_COINS) return { error: 'Bad number of coins.' };
  if (!Array.isArray(o.items) || o.items.length > MAX_ITEMS) return { error: `At most ${MAX_ITEMS} different things on the table.` };
  const items = [];
  for (const raw of o.items) {
    const it = cleanItem(raw);
    if (!it) return { error: 'Bad item in the offer.' };
    if (it.uid) it.n = 1;
    if (items.some((x) => (it.uid ? x.uid === it.uid : !x.uid && x.id === it.id))) return { error: 'The same thing is on the table twice.' };
    items.push(it);
  }
  return { ok: true, offer: { items, coins } };
}

// Can `have` (a character) give `offer`? Gear by its own id, other things by how many
export function canGive(have, offer) {
  if ((have?.coins || 0) < offer.coins) return { error: 'You don\'t have that many coins.' };
  const inv = have?.inventory || [];
  const worn = new Set(Object.values(have?.equipped || {}).filter(Boolean));
  for (const it of offer.items) {
    if (it.uid) {
      if (!inv.some((e) => e.uid === it.uid && e.id === it.id)) return { error: 'You no longer have something you put on the table.' };
      if (worn.has(it.uid)) return { error: 'Take off gear before you trade it.' };
    } else if (inv.filter((e) => e.id === it.id && !e.uid).reduce((n, e) => n + e.n, 0) < it.n) return { error: 'You don\'t have that many of something you put on the table.' };
  }
  return { ok: true };
}

// After giving `give` and getting `get`, how many bag spaces would `have` use (worn gear takes none)
export function bagAfter(have, give, get) {
  const worn = new Set(Object.values(have?.equipped || {}).filter(Boolean));
  const inv = (have?.inventory || []).map((e) => ({ ...e }));
  for (const it of give.items) {
    const e = it.uid ? inv.find((x) => x.uid === it.uid) : inv.find((x) => !x.uid && x.id === it.id);
    if (!e) continue;
    e.n -= it.uid ? e.n : it.n;
    if (e.n <= 0) inv.splice(inv.indexOf(e), 1);
  }
  for (const it of get.items) {
    if (it.uid || !inv.some((x) => !x.uid && x.id === it.id)) inv.push({ ...it });
  }
  return inv.filter((e) => !(e.uid && worn.has(e.uid))).length;
}

// `me` puts a new offer on the table (both confirmations are taken back)
export function setOffer(s, me, id, offer, now) {
  sweep(s, now);
  const t = s.list.find((x) => x.id === id && x.state === 'open');
  const side = t && sideOf(t, me);
  if (!side) return { error: 'That trade is over.' };
  t.offers[side] = offer;
  t.ok = {};
  t.v += 1; t.t = now;
  return { ok: true, trade: t };
}

// `me` confirms the trade as it stands at version `v` (what they saw). Both confirmed: done.
export function confirm(s, me, id, v, now) {
  sweep(s, now);
  const t = s.list.find((x) => x.id === id && x.state === 'open');
  const side = t && sideOf(t, me);
  if (!side) return { error: 'That trade is over.' };
  if (Number(v) !== t.v) return { error: 'The offer just changed. Look again before you confirm.', changed: true };
  const o = t.offers;
  if (!o.a.items.length && !o.a.coins && !o.b.items.length && !o.b.coins) return { error: 'Nothing is on the table yet.' };
  t.ok[side] = true; t.t = now;
  if (t.ok.a && t.ok.b) { t.state = 'done'; t.doneAt = now; }
  return { ok: true, trade: t, done: t.state === 'done' };
}

// Either player calls the trade off before it is done
export function cancel(s, me, id, now) {
  sweep(s, now);
  const t = s.list.find((x) => x.id === id && (x.state === 'asked' || x.state === 'open') && sideOf(x, me));
  if (!t) return { error: 'That trade is already over.' };
  s.list.splice(s.list.indexOf(t), 1);
  return { ok: true };
}

// `me`'s game has taken its side of a finished trade into the bag
export function taken(s, me, id, now) {
  const t = s.list.find((x) => x.id === id && x.state === 'done');
  const side = t && sideOf(t, me);
  if (side) t.taken = { ...t.taken, [side]: true };
  sweep(s, now);
  return { ok: true };
}

// What `me` gives and gets in a trade
export function sides(t, me) {
  const side = sideOf(t, me);
  return { give: t.offers[side], get: t.offers[side === 'a' ? 'b' : 'a'] };
}

// What a player's game is shown: their trade going on, requests waiting for them, and finished
// trades whose goods they haven't taken yet
export function view(s, me, now) {
  sweep(s, now);
  const t = activeOf(s, me);
  let trade = null;
  if (t) {
    const side = sideOf(t, me), other = side === 'a' ? 'b' : 'a';
    trade = {
      id: t.id, with: otherOf(t, me), state: t.state, asker: same(t.a, me), v: t.v, since: t.at,
      mine: t.offers[side], theirs: t.offers[other], iConfirmed: !!t.ok[side], theyConfirmed: !!t.ok[other],
    };
  }
  return {
    trade,
    asks: s.list.filter((x) => x.state === 'asked' && same(x.b, me)).map((x) => ({ id: x.id, from: x.a, at: x.at })),
    finished: s.list.filter((x) => x.state === 'done' && sideOf(x, me) && !x.taken?.[sideOf(x, me)]).map((x) => ({ id: x.id, with: otherOf(x, me), ...sides(x, me) })),
  };
}

// Plain words for one side of a trade, for messages ("2 Iron Ore, a Steel Sword and 3 Silver")
export function offerWords(o, itemName, moneyWords) {
  const parts = o.items.map((it) => (it.n > 1 ? `${it.n} ${itemName(it.id)}` : `${/^[aeiou]/i.test(itemName(it.id)) ? 'an' : 'a'} ${itemName(it.id)}${it.plus ? ` +${it.plus}` : ''}`));
  if (o.coins) parts.push(moneyWords(o.coins));
  if (!parts.length) return 'nothing';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

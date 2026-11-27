// Trading between players (rules in public/js/data/trade.mjs). All trades are one small JSON value,
// changed one request at a time (the row is locked while a request changes it, so two players
// pressing Confirm at the same moment can't trip over each other).
//
// The server checks what it can against each player's latest save: that they really have what they
// put on the table, that it fits in the other's bag, and that the two stand close together. The
// game saves just before each of these requests, so the saves are fresh.
const db = require('./db');
const T = require('../public/js/data/trade.mjs');
const P = require('../public/js/data/presence.mjs');
const characters = require('./characters');

const KEY = 'trades';
const BAG_SLOTS = 30;

const account = (id) => db.get('SELECT id, username FROM accounts WHERE id = ?', id);
const byName = (name) => db.get('SELECT id, username FROM accounts WHERE lower(username) = lower(?)', String(name || '').trim());

async function load(t = db) {
  const r = await t.get('SELECT data FROM world_state WHERE key = ?', KEY);
  return r ? JSON.parse(r.data) : T.emptyTrades();
}
// change the trades inside a transaction, with the row locked
async function change(fn) {
  return db.tx(async (t) => {
    await t.run("INSERT INTO world_state (key, data) VALUES (?, ?) ON CONFLICT (key) DO NOTHING", KEY, JSON.stringify(T.emptyTrades()));
    const row = await t.get('SELECT data FROM world_state WHERE key = ? FOR UPDATE', KEY);
    const s = JSON.parse(row.data);
    const out = await fn(s);
    if (!out?.error) await t.run('UPDATE world_state SET data = ? WHERE key = ?', JSON.stringify(s), KEY);
    return out;
  });
}

// Are the two players in the world right now, in the same place and close together?
async function near(aId, bId, bName, now = Date.now()) {
  const rows = await db.all('SELECT account_id, x, z, place, at FROM presence WHERE account_id IN (?, ?) AND at > ?', aId, bId, now - P.GONE_MS);
  const a = rows.find((r) => r.account_id === aId), b = rows.find((r) => r.account_id === bId);
  if (!b) return { error: `${bName} is not in the world right now.` };
  if (!a || a.place !== b.place || Math.hypot(a.x - b.x, a.z - b.z) > T.TRADE_NEAR) return { error: `Stand next to ${bName} to trade (within ${T.TRADE_NEAR} m).` };
  return { ok: true };
}

async function list(me) {
  const acc = await account(me);
  if (!acc) return { error: 'Please sign in again.' };
  return { ok: true, ...T.view(await load(), acc.username, Date.now()) };
}

// body: { action: 'ask'|'answer'|'offer'|'confirm'|'cancel'|'taken', name, id, accept, offer, v }
async function act(me, body = {}) {
  const acc = await account(me);
  if (!acc) return { error: 'Please sign in again.' };
  const now = Date.now();
  const id = String(body.id || '');
  let r;
  switch (body.action) {
    case 'ask': {
      const them = await byName(body.name);
      if (!them) return { error: 'There is no player with that name.' };
      if (them.id !== me) {
        if (!(await characters.load(them.id))) return { error: `${them.username} has no character yet.` };
        const n = await near(me, them.id, them.username, now);
        if (n.error) return n;
      }
      r = await change((s) => T.ask(s, acc.username, them.username, now));
      break;
    }
    case 'answer': {
      if (body.accept === true) {
        const t = (await load()).list.find((x) => x.id === id);
        const them = t && await byName(t.a);
        if (them) { const n = await near(me, them.id, them.username, now); if (n.error) return n; }
      }
      r = await change((s) => T.answer(s, acc.username, id, body.accept === true, now));
      break;
    }
    case 'offer': {
      const clean = T.cleanOffer(body.offer, characters.cleanItem);
      if (clean.error) return clean;
      const c = await characters.load(me);
      const can = T.canGive(c, clean.offer);
      if (can.error) return can;
      r = await change((s) => T.setOffer(s, acc.username, id, clean.offer, now));
      break;
    }
    case 'confirm': {
      // what I give must still be mine, and what I get must fit in my bag (and theirs)
      const s0 = await load();
      const t = s0.list.find((x) => x.id === id && x.state === 'open');
      if (!t) return { error: 'That trade is over.' };
      if (t.v !== Number(body.v)) return { error: 'The offer just changed. Look again before you confirm.', changed: true };
      const them = await byName(T.otherOf(t, acc.username));
      if (!them) return { error: 'That player is gone.' };
      const n = await near(me, them.id, them.username, now);
      if (n.error) return n;
      const [mine, theirs] = [await characters.load(me), await characters.load(them.id)];
      const { give, get } = T.sides(t, acc.username);
      const can = T.canGive(mine, give);
      if (can.error) return can;
      if (T.bagAfter(mine, give, get) > BAG_SLOTS) return { error: 'Your bag has no room for all of that. Make some space first.' };
      if (T.bagAfter(theirs, get, give) > BAG_SLOTS) return { error: `${them.username}'s bag has no room for all of that.` };
      r = await change((s) => T.confirm(s, acc.username, id, body.v, now));
      break;
    }
    case 'cancel': r = await change((s) => T.cancel(s, acc.username, id, now)); break;
    case 'taken': r = await change((s) => T.taken(s, acc.username, id, now)); break;
    default: return { error: 'Do what?' };
  }
  if (r?.error) return r;
  return { ok: true, done: !!r?.done, ...T.view(await load(), acc.username, Date.now()) };
}

module.exports = { list, act };

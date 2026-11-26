// The economy on the server: each player's Bank account (kept with their character) and everyone's
// oil derricks (the oil_wells table). The rules live in the shared data/economy.mjs.
const db = require('./db');
const characters = require('./characters');
const E = require('../public/js/data/economy.mjs');

const rowToWell = (r) => ({ id: r.id, x: r.x, z: r.z, owner: r.owner, company: r.company, last: Number(r.last), tank: r.tank, out: r.out_barrels, accountId: r.account_id });
const allWells = async () => (await db.all('SELECT * FROM oil_wells')).map(rowToWell);
const wellView = (w, now) => ({ id: w.id, x: w.x, z: w.z, owner: w.owner, company: w.company, ...E.wellState(w, now) });

const view = (c, now) => ({ coins: c.coins, bank: E.bankView(c, now), oil: E.oilView(c) });

async function bank(accountId) {
  const c = await characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const now = Date.now();
  const out = view(c, now);
  await characters.store(accountId, c); // (a late loan may have been collected)
  return { ok: true, ...out };
}

async function bankAct(accountId, body) {
  const c = await characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const now = Date.now();
  const r = E.bankAct(c, body, now);
  if (r.error) return r;
  await characters.store(accountId, c);
  return { ...r, ...view(c, now) };
}

async function oil(accountId) {
  const c = await characters.load(accountId);
  const now = Date.now();
  return { ok: true, wells: (await allWells()).map((w) => ({ ...wellView(w, now), mine: w.accountId === accountId })), oil: c ? E.oilView(c) : null };
}

async function oilAct(accountId, body) {
  const c = await characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const now = Date.now();
  const wells = await allWells();
  const lands = new Map((await db.all('SELECT ix, iz, owner FROM lands')).map((p) => [`${p.ix},${p.iz}`, p.owner]));
  const r = E.oilAct(c, wells, body, { now, plotOwner: (ix, iz) => lands.get(`${ix},${iz}`) || null });
  if (r.error) return r;
  try {
    await db.tx(async (t) => {
      for (const w of r.changed || []) {
        await t.run(`INSERT INTO oil_wells (id, x, z, account_id, owner, company, last, tank, out_barrels) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET last = excluded.last, tank = excluded.tank, out_barrels = excluded.out_barrels
          WHERE oil_wells.account_id = excluded.account_id`, w.id, w.x, w.z, w.accountId ?? accountId, w.owner, w.company, w.last, w.tank, w.out);
      }
      for (const id of r.removed || []) await t.run('DELETE FROM oil_wells WHERE id = ? AND account_id = ?', id, accountId);
    });
  } catch (e) {
    if (e.code === '23505') return { error: 'Someone else just put up a derrick here.' };
    throw e;
  }
  await characters.store(accountId, c);
  const { changed, removed, ...rest } = r;
  return { ...rest, coins: c.coins, ...(await oil(accountId)) };
}

// A character who has lost their last life: their derricks come down
async function forget(accountId) {
  await db.run('DELETE FROM oil_wells WHERE account_id = ?', accountId);
}

module.exports = { bank, bankAct, oil, oilAct, forget };

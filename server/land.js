// Land plots: who owns which square of the Heartland, what it is for, and whether it has been levelled.
const db = require('./db');
const characters = require('./characters');
const { PURPOSES, MAX_PLOTS, PURPOSE_FEE, whyNot, plotPrice, prepareCost, levelHeight } = require('../public/js/data/land.mjs');
const { setPreparedPlots } = require('../public/js/data/world-layout.mjs');

db.exec(`
  CREATE TABLE IF NOT EXISTS lands (
    ix         INTEGER NOT NULL,
    iz         INTEGER NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    owner      TEXT NOT NULL,
    purpose    TEXT NOT NULL,
    flat       REAL,
    bought_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (ix, iz)
  );
`);

const all = () => db.prepare('SELECT ix, iz, owner, purpose, flat, account_id FROM lands').all()
  .map((r) => ({ ix: r.ix, iz: r.iz, owner: r.owner, purpose: r.purpose, flat: r.flat, accountId: r.account_id }));
// keep the server's copy of the levelled ground in step, so prices and checks see it too
const sync = () => setPreparedPlots(all());
sync();

function list(accountId) {
  return { plots: all().map(({ accountId: a, ...p }) => ({ ...p, mine: a === accountId })) };
}

const plotArgs = (body) => {
  const ix = Number(body.ix), iz = Number(body.iz);
  return Number.isInteger(ix) && Number.isInteger(iz) && Math.abs(ix) < 1e5 && Math.abs(iz) < 1e5 ? { ix, iz } : null;
};
const ownPlot = (accountId, ix, iz) => db.prepare('SELECT * FROM lands WHERE ix = ? AND iz = ? AND account_id = ?').get(ix, iz, accountId);

function spend(accountId, cost) {
  const c = characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  if (c.coins < cost) return { error: `You need ${cost} coins.` };
  c.coins -= cost;
  characters.store(accountId, c);
  return { coins: c.coins, character: c };
}

function buy(accountId, body) {
  const at = plotArgs(body);
  if (!at) return { error: 'Choose a plot.' };
  if (!PURPOSES[body.purpose]) return { error: 'Choose what the land is for.' };
  if (db.prepare('SELECT 1 FROM lands WHERE ix = ? AND iz = ?').get(at.ix, at.iz)) return { error: 'Someone already owns this plot.' };
  const why = whyNot(at.ix, at.iz);
  if (why) return { error: why };
  const count = db.prepare('SELECT COUNT(*) AS n FROM lands WHERE account_id = ?').get(accountId).n;
  if (count >= MAX_PLOTS) return { error: `You can own up to ${MAX_PLOTS} plots for now.` };
  const paid = spend(accountId, plotPrice(at.ix, at.iz));
  if (paid.error) return paid;
  db.prepare('INSERT INTO lands (ix, iz, account_id, owner, purpose) VALUES (?, ?, ?, ?, ?)').run(at.ix, at.iz, accountId, paid.character.name, body.purpose);
  return { ok: true, coins: paid.coins, ...list(accountId) };
}

function setPurpose(accountId, body) {
  const at = plotArgs(body);
  if (!at || !ownPlot(accountId, at.ix, at.iz)) return { error: 'That is not your plot.' };
  if (!PURPOSES[body.purpose]) return { error: 'Choose what the land is for.' };
  const paid = spend(accountId, PURPOSE_FEE);
  if (paid.error) return paid;
  db.prepare('UPDATE lands SET purpose = ? WHERE ix = ? AND iz = ?').run(body.purpose, at.ix, at.iz);
  return { ok: true, coins: paid.coins, ...list(accountId) };
}

function prepare(accountId, body) {
  const at = plotArgs(body);
  const plot = at && ownPlot(accountId, at.ix, at.iz);
  if (!plot) return { error: 'That is not your plot.' };
  if (plot.flat !== null) return { error: 'This plot is already cleared and level.' };
  const c = characters.load(accountId);
  const paid = spend(accountId, prepareCost(at.ix, at.iz, c?.cls));
  if (paid.error) return paid;
  db.prepare('UPDATE lands SET flat = ? WHERE ix = ? AND iz = ?').run(levelHeight(at.ix, at.iz), at.ix, at.iz);
  sync();
  return { ok: true, coins: paid.coins, ...list(accountId) };
}

module.exports = { list, buy, setPurpose, prepare };

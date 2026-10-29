// Land plots: who owns which square of the Heartland, what it is for, and whether it has been levelled.
const db = require('./db');
const characters = require('./characters');
const { PURPOSES, PURPOSE_FEE, checkPurchase, prepareCost, levelHeight, clearCost } = require('../public/js/data/land.mjs');
const { setPreparedPlots } = require('../public/js/data/world-layout.mjs');
const { caveById, cavePrice } = require('../public/js/data/depths.mjs');
const B = require('../public/js/data/building.mjs');
const { ITEMS, isGear } = require('../public/js/data/items.mjs');

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

// what's built on each plot (pieces, see building.mjs)
if (!db.prepare("SELECT 1 FROM pragma_table_info('lands') WHERE name = 'build'").get()) db.exec('ALTER TABLE lands ADD COLUMN build TEXT');
// cleared of trees, rocks and grass, keeping the ground's shape
if (!db.prepare("SELECT 1 FROM pragma_table_info('lands') WHERE name = 'cleared'").get()) db.exec('ALTER TABLE lands ADD COLUMN cleared INTEGER NOT NULL DEFAULT 0');

const all = () => db.prepare('SELECT ix, iz, owner, purpose, flat, cleared, account_id, build FROM lands').all()
  .map((r) => ({ ix: r.ix, iz: r.iz, owner: r.owner, purpose: r.purpose, flat: r.flat, cleared: !!r.cleared || r.flat !== null, accountId: r.account_id, pieces: r.build ? JSON.parse(r.build) : [] }));
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

// Buy one or more plots at once: { plots: [{ix, iz}], purpose }. Only near where you stand.
function buy(accountId, body) {
  const wanted = (Array.isArray(body.plots) ? body.plots : [body]).map(plotArgs);
  if (!wanted.length || wanted.some((p) => !p)) return { error: 'Choose a plot.' };
  if (!PURPOSES[body.purpose]) return { error: 'Choose what the land is for.' };
  const c = characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const everyone = all();
  const check = checkPurchase(wanted, {
    owned: new Set(everyone.map((p) => `${p.ix},${p.iz}`)),
    mine: new Set(everyone.filter((p) => p.accountId === accountId).map((p) => `${p.ix},${p.iz}`)),
    at: Number.isFinite(c.location?.x) ? c.location : null,
  });
  if (check.error) return check;
  const paid = spend(accountId, check.total);
  if (paid.error) return paid;
  const add = db.prepare('INSERT INTO lands (ix, iz, account_id, owner, purpose) VALUES (?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  for (const p of wanted) add.run(p.ix, p.iz, accountId, paid.character.name, body.purpose);
  db.exec('COMMIT');
  return { ok: true, coins: paid.coins, bought: wanted.length, ...list(accountId) };
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
  const c = characters.load(accountId);
  // 'clear' takes away trees, rocks and grass but keeps the ground's shape; 'flatten' also levels it
  if (body.how === 'clear') {
    if (plot.cleared || plot.flat !== null) return { error: 'This plot is already cleared.' };
    const paid = spend(accountId, clearCost(c?.cls));
    if (paid.error) return paid;
    db.prepare('UPDATE lands SET cleared = 1 WHERE ix = ? AND iz = ?').run(at.ix, at.iz);
    sync();
    return { ok: true, coins: paid.coins, ...list(accountId) };
  }
  if (plot.flat !== null) return { error: 'This plot is already cleared and level.' };
  const paid = spend(accountId, prepareCost(at.ix, at.iz, c?.cls));
  if (paid.error) return paid;
  db.prepare('UPDATE lands SET flat = ?, cleared = 1 WHERE ix = ? AND iz = ?').run(levelHeight(at.ix, at.iz), at.ix, at.iz);
  sync();
  return { ok: true, coins: paid.coins, ...list(accountId) };
}

// Building on your own levelled land: pieces one by one, or a ready-made building, put up yourself
// at once or by a hired builder (cheaper, but it takes a while). Removing pieces is free.
// The shared rules work out what it costs and whether everything still stands.
function build(accountId, body) {
  const c = characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const result = B.applyBuild(all().filter((p) => p.accountId === accountId), body, c.cls, Date.now());
  if (result.error) return result;
  const paid = spend(accountId, result.cost);
  if (paid.error) return paid;
  const save = db.prepare('UPDATE lands SET build = ? WHERE ix = ? AND iz = ? AND account_id = ?');
  db.exec('BEGIN');
  for (const [k, pieces] of result.byPlot) { const [ix, iz] = k.split(',').map(Number); save.run(JSON.stringify(pieces), ix, iz, accountId); }
  db.exec('COMMIT');
  return { ok: true, coins: paid.coins, cost: result.cost, ...list(accountId) };
}

// Caves: once you've beaten a cave's boss you can buy the cave itself. One owner per cave.
db.exec(`
  CREATE TABLE IF NOT EXISTS cave_owners (
    cave       TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    owner      TEXT NOT NULL,
    bought_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
function caves(accountId) {
  return { caves: db.prepare('SELECT cave, owner, account_id FROM cave_owners').all().map((r) => ({ cave: r.cave, owner: r.owner, mine: r.account_id === accountId })) };
}
function buyCave(accountId, body) {
  const cave = caveById(String(body.cave || ''));
  if (!cave) return { error: 'There is no such cave.' };
  if (db.prepare('SELECT 1 FROM cave_owners WHERE cave = ?').get(cave.id)) return { error: 'Someone already owns this cave.' };
  if (!characters.load(accountId)?.caves?.[cave.id]) return { error: 'Beat the boss in its depths first.' };
  const paid = spend(accountId, cavePrice(cave));
  if (paid.error) return paid;
  db.prepare('INSERT INTO cave_owners (cave, account_id, owner) VALUES (?, ?, ?)').run(cave.id, accountId, paid.character.name);
  return { ok: true, coins: paid.coins, ...caves(accountId) };
}

// A Blacksmith's display stand: put a weapon or piece of armour on it for everyone to see, or take
// it back off. The game moves it in and out of the bag.
function show(accountId, body) {
  const c = characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  let item = null;
  if (body.item) {
    if (c.cls !== 'blacksmith') return { error: 'Only a Blacksmith can show their work on a stand.' };
    item = characters.cleanItem(body.item);
    if (!item || !isGear(ITEMS[item.id])) return { error: 'Only weapons and armour go on a stand.' };
    item.n = 1;
  }
  const mine = all().filter((p) => p.accountId === accountId);
  const at = { x: body.x, z: body.z, l: body.l };
  const r = B.setStand(mine, at, item);
  if (r.error) return r;
  db.prepare('UPDATE lands SET build = ? WHERE ix = ? AND iz = ? AND account_id = ?').run(JSON.stringify(r.plot.pieces), r.plot.ix, r.plot.iz, accountId);
  return { ok: true, old: r.old, ...list(accountId) };
}

module.exports = { list, buy, setPurpose, prepare, caves, buyCave, build, show };

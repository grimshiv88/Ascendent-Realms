// Land plots: who owns which square of the Heartland, what it is for, and whether it has been levelled.
const db = require('./db');
const { moneyWords } = require('../public/js/data/money.mjs');
const characters = require('./characters');
const { PURPOSES, PURPOSE_FEE, checkPurchase, prepareCost, levelHeight, clearCost } = require('../public/js/data/land.mjs');
const { setPreparedPlots } = require('../public/js/data/world-layout.mjs');
const { caveById, cavePrice } = require('../public/js/data/depths.mjs');
const B = require('../public/js/data/building.mjs');
const { cityPlan } = require('../public/js/data/citylayout.mjs');
const { PLACES } = require('../public/js/data/world-layout.mjs');
const { ITEMS, isGear } = require('../public/js/data/items.mjs');

// Everyone's plots. Each time they are read, the server's copy of the levelled ground is brought
// in step too, so prices and checks see it (several servers may be running at once).
async function all() {
  const plots = (await db.all('SELECT ix, iz, owner, purpose, flat, cleared, account_id, build FROM lands'))
    .map((r) => ({ ix: r.ix, iz: r.iz, owner: r.owner, purpose: r.purpose, flat: r.flat, cleared: !!r.cleared || r.flat !== null, accountId: r.account_id, pieces: r.build ? JSON.parse(r.build) : [] }));
  setPreparedPlots(plots);
  return plots;
}
const sync = all;

async function list(accountId) {
  return { plots: (await all()).map(({ accountId: a, ...p }) => ({ ...p, mine: a === accountId })) };
}

const plotArgs = (body) => {
  const ix = Number(body.ix), iz = Number(body.iz);
  return Number.isInteger(ix) && Number.isInteger(iz) && Math.abs(ix) < 1e5 && Math.abs(iz) < 1e5 ? { ix, iz } : null;
};
const ownPlot = (accountId, ix, iz) => db.get('SELECT * FROM lands WHERE ix = ? AND iz = ? AND account_id = ?', ix, iz, accountId);

async function spend(accountId, cost) {
  const c = await characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  if (c.coins < cost) return { error: `You need ${moneyWords(cost)}.`, need: cost };
  c.coins -= cost;
  await characters.store(accountId, c);
  return { coins: c.coins, character: c };
}

// Buy one or more plots at once: { plots: [{ix, iz}], purpose }. Only near where you stand.
async function buy(accountId, body) {
  const wanted = (Array.isArray(body.plots) ? body.plots : [body]).map(plotArgs);
  if (!wanted.length || wanted.some((p) => !p)) return { error: 'Choose a plot.' };
  if (!PURPOSES[body.purpose]) return { error: 'Choose what the land is for.' };
  const c = await characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const everyone = await all();
  const check = checkPurchase(wanted, {
    owned: new Set(everyone.map((p) => `${p.ix},${p.iz}`)),
    mine: new Set(everyone.filter((p) => p.accountId === accountId).map((p) => `${p.ix},${p.iz}`)),
    at: Number.isFinite(c.location?.x) ? c.location : null,
  });
  if (check.error) return check;
  const paid = await spend(accountId, check.total);
  if (paid.error) return paid;
  try {
    await db.tx(async (t) => {
      for (const p of wanted) await t.run('INSERT INTO lands (ix, iz, account_id, owner, purpose) VALUES (?, ?, ?, ?, ?)', p.ix, p.iz, accountId, paid.character.name, body.purpose);
    });
  } catch (e) {
    if (e.code !== '23505') throw e;
    // someone bought one of them in the same moment: give the money back
    const back = await characters.load(accountId);
    if (back) { back.coins += check.total; await characters.store(accountId, back); }
    return { error: 'Someone else just bought one of those plots.' };
  }
  return { ok: true, coins: paid.coins, bought: wanted.length, ...(await list(accountId)) };
}

async function setPurpose(accountId, body) {
  const at = plotArgs(body);
  if (!at || !(await ownPlot(accountId, at.ix, at.iz))) return { error: 'That is not your plot.' };
  if (!PURPOSES[body.purpose]) return { error: 'Choose what the land is for.' };
  const paid = await spend(accountId, PURPOSE_FEE);
  if (paid.error) return paid;
  await db.run('UPDATE lands SET purpose = ? WHERE ix = ? AND iz = ?', body.purpose, at.ix, at.iz);
  return { ok: true, coins: paid.coins, ...(await list(accountId)) };
}

async function prepare(accountId, body) {
  const at = plotArgs(body);
  const plot = at && await ownPlot(accountId, at.ix, at.iz);
  if (!plot) return { error: 'That is not your plot.' };
  const c = await characters.load(accountId);
  await sync();
  // 'clear' takes away trees, rocks and grass but keeps the ground's shape; 'flatten' also levels it
  if (body.how === 'clear') {
    if (plot.cleared || plot.flat !== null) return { error: 'This plot is already cleared.' };
    const paid = await spend(accountId, clearCost(c?.cls));
    if (paid.error) return paid;
    await db.run('UPDATE lands SET cleared = 1 WHERE ix = ? AND iz = ?', at.ix, at.iz);
    return { ok: true, coins: paid.coins, ...(await list(accountId)) };
  }
  if (plot.flat !== null) return { error: 'This plot is already cleared and level.' };
  const paid = await spend(accountId, prepareCost(at.ix, at.iz, c?.cls));
  if (paid.error) return paid;
  await db.run('UPDATE lands SET flat = ?, cleared = 1 WHERE ix = ? AND iz = ?', levelHeight(at.ix, at.iz), at.ix, at.iz);
  return { ok: true, coins: paid.coins, ...(await list(accountId)) };
}

// Building on your own levelled land: pieces one by one, or a ready-made building, put up yourself
// at once or by a hired builder (cheaper, but it takes a while). Removing pieces is free.
// The shared rules work out what it costs and whether everything still stands.
async function build(accountId, body) {
  const c = await characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  const result = B.applyBuild((await all()).filter((p) => p.accountId === accountId), body, c.cls, Date.now());
  if (result.error) return result;
  const paid = await spend(accountId, result.cost);
  if (paid.error) return paid;
  await db.tx(async (t) => {
    for (const [k, pieces] of result.byPlot) { const [ix, iz] = k.split(',').map(Number); await t.run('UPDATE lands SET build = ? WHERE ix = ? AND iz = ? AND account_id = ?', JSON.stringify(pieces), ix, iz, accountId); }
  });
  return { ok: true, coins: paid.coins, cost: result.cost, ...(await list(accountId)) };
}

// Caves: once you've beaten a cave's boss you can buy the cave itself. One owner per cave.
async function caves(accountId) {
  return { caves: (await db.all('SELECT cave, owner, account_id FROM cave_owners')).map((r) => ({ cave: r.cave, owner: r.owner, mine: r.account_id === accountId })) };
}
async function buyCave(accountId, body) {
  const cave = caveById(String(body.cave || ''));
  if (!cave) return { error: 'There is no such cave.' };
  if (await db.get('SELECT 1 FROM cave_owners WHERE cave = ?', cave.id)) return { error: 'Someone already owns this cave.' };
  if (!(await characters.load(accountId))?.caves?.[cave.id]) return { error: 'Beat the boss in its depths first.' };
  const paid = await spend(accountId, cavePrice(cave));
  if (paid.error) return paid;
  await db.run('INSERT INTO cave_owners (cave, account_id, owner) VALUES (?, ?, ?)', cave.id, accountId, paid.character.name);
  return { ok: true, coins: paid.coins, ...(await caves(accountId)) };
}

// Houses for sale in the great cities, bought at the Real Estate office. One owner per house, and at
// most MAX_HOMES houses each.
const MAX_HOMES = 3;
async function homes(accountId) {
  return { homes: (await db.all('SELECT city, house, owner, account_id FROM city_homes')).map((r) => ({ city: r.city, house: r.house, owner: r.owner, mine: r.account_id === accountId })) };
}
async function buyHome(accountId, body) {
  const city = PLACES.find((p) => p.city && p.id === String(body.city || ''));
  if (!city) return { error: 'There is no such city.' };
  const house = cityPlan().sale.find((h) => h.id === String(body.house || ''));
  if (!house) return { error: 'That house is not for sale.' };
  if (await db.get('SELECT 1 FROM city_homes WHERE city = ? AND house = ?', city.id, house.id)) return { error: 'Someone already owns this house.' };
  if ((await db.get('SELECT COUNT(*)::int AS n FROM city_homes WHERE account_id = ?', accountId)).n >= MAX_HOMES) return { error: `You can own at most ${MAX_HOMES} houses.` };
  const paid = await spend(accountId, house.price);
  if (paid.error) return paid;
  await db.run('INSERT INTO city_homes (city, house, account_id, owner) VALUES (?, ?, ?, ?)', city.id, house.id, accountId, paid.character.name);
  return { ok: true, coins: paid.coins, ...(await homes(accountId)) };
}

// A Blacksmith's display stand: put a weapon or piece of armour on it for everyone to see, or take
// it back off. The game moves it in and out of the bag.
async function show(accountId, body) {
  const c = await characters.load(accountId);
  if (!c) return { error: 'No character yet.' };
  let item = null;
  if (body.item) {
    if (c.cls !== 'blacksmith') return { error: 'Only a Blacksmith can show their work on a stand.' };
    item = characters.cleanItem(body.item);
    if (!item || !isGear(ITEMS[item.id])) return { error: 'Only weapons and armour go on a stand.' };
    item.n = 1;
  }
  const mine = (await all()).filter((p) => p.accountId === accountId);
  const at = { x: body.x, z: body.z, l: body.l };
  const r = B.setStand(mine, at, item);
  if (r.error) return r;
  await db.run('UPDATE lands SET build = ? WHERE ix = ? AND iz = ? AND account_id = ?', JSON.stringify(r.plot.pieces), r.plot.ix, r.plot.iz, accountId);
  return { ok: true, old: r.old, ...(await list(accountId)) };
}

module.exports = { list, buy, setPurpose, prepare, caves, buyCave, homes, buyHome, MAX_HOMES, build, show };

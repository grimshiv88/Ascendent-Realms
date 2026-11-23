// The Bounty Board in the Main Guild Hall (see data/guildcard.mjs). The guild holds each prize
// until the target is brought down, then pays the hunter.
const db = require('./db');
const { moneyWords } = require('../public/js/data/money.mjs');
const characters = require('./characters');
const B = require('../public/js/data/guildcard.mjs');

const nameOf = async (id) => (await db.get('SELECT username FROM accounts WHERE id = ?', id))?.username;
const all = async () => (await db.all("SELECT * FROM bounties WHERE state = 'open'"))
  .map((b) => ({ id: b.id, target: b.target, by: b.by_name, prize: b.prize, at: b.placed_at, state: b.state }));
const list = async (me) => ({ board: B.boardView(await all(), Date.now(), await nameOf(me)) });

async function place(me, body) {
  const name = await nameOf(me);
  const check = B.checkBounty(body, name);
  if (check.error) return check;
  const target = (await db.get('SELECT username FROM accounts WHERE lower(username) = lower(?)', check.target))?.username;
  if (!target) return { error: `No player or monster is called ${check.target}.` };
  const c = await characters.load(me);
  if (!c) return { error: 'No character yet.' };
  if ((c.level || 1) < B.GUILD_HALL_LEVEL) return { error: `Only hunters of level ${B.GUILD_HALL_LEVEL} or more may use the Guild Hall.` };
  const cost = check.prize + check.fee;
  if (c.coins < cost) return { error: `You need ${moneyWords(cost)}: the ${moneyWords(check.prize)} prize and a ${moneyWords(check.fee)} fee.`, need: cost };
  c.coins -= cost;
  await characters.store(me, c);
  await db.run('INSERT INTO bounties (target, by_id, by_name, prize, placed_at) VALUES (?, ?, ?, ?, ?)', target, me, name, check.prize, Date.now());
  return { ok: true, coins: c.coins, ...(await list(me)) };
}

// A hunter brought the target down: they get every open prize on that name, and the guild's own
// prize if the name is on today's wanted list. Called when one player defeats another.
async function claim(hunterId, targetName) {
  const line = B.boardView(await all()).find((e) => e.target.toLowerCase() === String(targetName).toLowerCase());
  if (!line) return { paid: 0 };
  const paid = line.total + line.gift;
  const c = await characters.load(hunterId);
  if (!c) return { paid: 0 };
  c.coins += paid;
  await characters.store(hunterId, c);
  await db.run("UPDATE bounties SET state = 'claimed', claimed_by = ? WHERE state = 'open' AND lower(target) = lower(?)", await nameOf(hunterId), line.target);
  return { paid };
}

module.exports = { list, place, claim };

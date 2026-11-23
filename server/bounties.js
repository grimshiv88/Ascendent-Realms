// The Bounty Board in the Main Guild Hall (see data/guildcard.mjs). The guild holds each prize
// until the target is brought down, then pays the hunter.
const db = require('./db');
const { moneyWords } = require('../public/js/data/money.mjs');
const characters = require('./characters');
const B = require('../public/js/data/guildcard.mjs');

db.exec(`
  CREATE TABLE IF NOT EXISTS bounties (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    target     TEXT NOT NULL,
    by_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    by_name    TEXT NOT NULL,
    prize      INTEGER NOT NULL,
    placed_at  INTEGER NOT NULL,
    state      TEXT NOT NULL DEFAULT 'open',
    claimed_by TEXT
  );
`);

const nameOf = (id) => db.prepare('SELECT username FROM accounts WHERE id = ?').get(id)?.username;
const all = () => db.prepare("SELECT * FROM bounties WHERE state = 'open'").all()
  .map((b) => ({ id: b.id, target: b.target, by: b.by_name, prize: b.prize, at: b.placed_at, state: b.state }));
const list = (me) => ({ board: B.boardView(all(), Date.now(), nameOf(me)) });

function place(me, body) {
  const name = nameOf(me);
  const check = B.checkBounty(body, name);
  if (check.error) return check;
  const target = db.prepare('SELECT username FROM accounts WHERE username = ? COLLATE NOCASE').get(check.target)?.username;
  if (!target) return { error: `No player or monster is called ${check.target}.` };
  const c = characters.load(me);
  if (!c) return { error: 'No character yet.' };
  if ((c.level || 1) < B.GUILD_HALL_LEVEL) return { error: `Only hunters of level ${B.GUILD_HALL_LEVEL} or more may use the Guild Hall.` };
  const cost = check.prize + check.fee;
  if (c.coins < cost) return { error: `You need ${moneyWords(cost)}: the ${moneyWords(check.prize)} prize and a ${moneyWords(check.fee)} fee.`, need: cost };
  c.coins -= cost;
  characters.store(me, c);
  db.prepare('INSERT INTO bounties (target, by_id, by_name, prize, placed_at) VALUES (?, ?, ?, ?, ?)').run(target, me, name, check.prize, Date.now());
  return { ok: true, coins: c.coins, ...list(me) };
}

// A hunter brought the target down: they get every open prize on that name, and the guild's own
// prize if the name is on today's wanted list. Called when one player defeats another.
function claim(hunterId, targetName) {
  const line = B.boardView(all()).find((e) => e.target.toLowerCase() === String(targetName).toLowerCase());
  if (!line) return { paid: 0 };
  const paid = line.total + line.gift;
  const c = characters.load(hunterId);
  if (!c) return { paid: 0 };
  c.coins += paid;
  characters.store(hunterId, c);
  db.prepare("UPDATE bounties SET state = 'claimed', claimed_by = ? WHERE state = 'open' AND target = ? COLLATE NOCASE").run(nameOf(hunterId), line.target);
  return { paid };
}

module.exports = { list, place, claim };

// Meeting rooms in the Main Guild Hall, rented for coins (see data/interiors.mjs).
const db = require('./db');
const { moneyWords } = require('../public/js/data/money.mjs');
const characters = require('./characters');
const R = require('../public/js/data/interiors.mjs');
const groups = require('./groups');

db.exec(`
  CREATE TABLE IF NOT EXISTS rentals (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    room      TEXT NOT NULL,
    renter_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    renter    TEXT NOT NULL,
    guests    TEXT NOT NULL,
    until     INTEGER NOT NULL
  );
`);

const nameOf = (id) => db.prepare('SELECT username FROM accounts WHERE id = ?').get(id)?.username;
const active = (now = Date.now()) => db.prepare('SELECT * FROM rentals WHERE until > ?').all(now)
  .map((r) => ({ id: r.id, room: r.room, renterId: r.renter_id, renter: r.renter, guests: JSON.parse(r.guests), until: r.until }));
// what everyone sees: who has each room and until when; the guest list only if you're on it
function list(me) {
  const name = nameOf(me);
  return {
    rentals: active().map((r) => ({ id: r.id, room: r.room, renter: r.renter, until: r.until, mine: r.renterId === me, allowed: R.mayEnter(r, name), guests: R.mayEnter(r, name) ? r.guests : [] })),
  };
}
function rent(me, body) {
  const name = nameOf(me);
  const check = R.checkRent(body, active(), Date.now(), { emperor: !!groups.emperorTitle(name) });
  if (check.error) return check;
  const guests = check.guests.filter((g) => g.toLowerCase() !== name.toLowerCase());
  const missing = guests.filter((g) => !db.prepare('SELECT 1 FROM accounts WHERE username = ? COLLATE NOCASE').get(g));
  if (missing.length) return { error: `No player is called ${missing.join(', ')}.` };
  const c = characters.load(me);
  if (!c) return { error: 'No character yet.' };
  if (c.coins < check.cost) return { error: `You need ${moneyWords(check.cost)}.`, need: check.cost };
  c.coins -= check.cost;
  characters.store(me, c);
  db.prepare('INSERT INTO rentals (room, renter_id, renter, guests, until) VALUES (?, ?, ?, ?, ?)').run(check.room.id, me, name, JSON.stringify(guests), Date.now() + check.minutes * 60000);
  return { ok: true, coins: c.coins, ...list(me) };
}
// the renter changes who may come in
function setGuests(me, body) {
  const r = active().find((x) => x.id === Number(body.id) && x.renterId === me);
  if (!r) return { error: 'You are not renting that room.' };
  const guests = R.cleanGuests(body.guests);
  if (guests.error) return guests;
  db.prepare('UPDATE rentals SET guests = ? WHERE id = ?').run(JSON.stringify(guests), r.id);
  return { ok: true, ...list(me) };
}
// chat channels you may read and write: the rooms you are in right now
function channels(me) {
  const name = nameOf(me);
  return active().filter((r) => R.mayEnter(r, name)).map((r) => ({ channel: `room:${r.id}`, label: `${R.roomById(r.room)?.name || 'Room'} (private)` }));
}

module.exports = { list, rent, setGuests, channels, active };

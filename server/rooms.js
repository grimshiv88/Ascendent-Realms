// Meeting rooms in the Main Guild Hall, rented for coins (see data/interiors.mjs).
const db = require('./db');
const { moneyWords } = require('../public/js/data/money.mjs');
const characters = require('./characters');
const R = require('../public/js/data/interiors.mjs');
const groups = require('./groups');

const nameOf = async (id) => (await db.get('SELECT username FROM accounts WHERE id = ?', id))?.username;
const active = async (now = Date.now()) => (await db.all('SELECT * FROM rentals WHERE until > ?', now))
  .map((r) => ({ id: r.id, room: r.room, renterId: r.renter_id, renter: r.renter, guests: JSON.parse(r.guests), until: r.until }));
// what everyone sees: who has each room and until when; the guest list only if you're on it
async function list(me) {
  const name = await nameOf(me);
  return {
    rentals: (await active()).map((r) => ({ id: r.id, room: r.room, renter: r.renter, until: r.until, mine: r.renterId === me, allowed: R.mayEnter(r, name), guests: R.mayEnter(r, name) ? r.guests : [] })),
  };
}
async function rent(me, body) {
  const name = await nameOf(me);
  const check = R.checkRent(body, await active(), Date.now(), { emperor: !!(await groups.emperorTitle(name)) });
  if (check.error) return check;
  const guests = check.guests.filter((g) => g.toLowerCase() !== name.toLowerCase());
  const missing = [];
  for (const g of guests) if (!(await db.get('SELECT 1 FROM accounts WHERE lower(username) = lower(?)', g))) missing.push(g);
  if (missing.length) return { error: `No player is called ${missing.join(', ')}.` };
  const c = await characters.load(me);
  if (!c) return { error: 'No character yet.' };
  if (c.coins < check.cost) return { error: `You need ${moneyWords(check.cost)}.`, need: check.cost };
  c.coins -= check.cost;
  await characters.store(me, c);
  await db.run('INSERT INTO rentals (room, renter_id, renter, guests, until) VALUES (?, ?, ?, ?, ?)', check.room.id, me, name, JSON.stringify(guests), Date.now() + check.minutes * 60000);
  return { ok: true, coins: c.coins, ...(await list(me)) };
}
// the renter changes who may come in
async function setGuests(me, body) {
  const r = (await active()).find((x) => x.id === Number(body.id) && x.renterId === me);
  if (!r) return { error: 'You are not renting that room.' };
  const guests = R.cleanGuests(body.guests);
  if (guests.error) return guests;
  await db.run('UPDATE rentals SET guests = ? WHERE id = ?', JSON.stringify(guests), r.id);
  return { ok: true, ...(await list(me)) };
}
// chat channels you may read and write: the rooms you are in right now
async function channels(me) {
  const name = await nameOf(me);
  return (await active()).filter((r) => R.mayEnter(r, name)).map((r) => ({ channel: `room:${r.id}`, label: `${R.roomById(r.room)?.name || 'Room'} (private)` }));
}

module.exports = { list, rent, setGuests, channels, active };

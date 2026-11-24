// The economy: the Banks of the great cities, the currencies of each land with their changing
// values, halal loans, and oil under the ground that an Oil Company can pump and sell.
// Shared by the game (and its preview) and the server, so both follow the same rules.
//
// Everything here is halal, as Mohammed asked for every part of the game:
//   - the Bank keeps your coins safe and pays no interest on them (safekeeping, "wadi'ah");
//   - a loan is a goodwill loan ("qard hasan"): you pay back exactly what you borrowed, never more.
//     The only charge is one small, fixed service fee for the paperwork, the same for any amount
//     and any length of time, and a late loan never costs extra;
//   - changing money is hand to hand, at today's rate, on the spot.
import { sample, safeZoneAt, plotOf, CITY_R, placesWithPositions } from './world-layout.mjs';
import { moneyWords } from './money.mjs';

const HOUR = 3600 * 1000, DAY = 24 * HOUR;

// ---------- currencies ----------
// The Crown (Copper, Silver and Gold coins) is the coin of the Heartland and is taken everywhere;
// every price in the game is in it. Each other land has a coin of its own, worth so many Copper on
// an ordinary day ("par"), going up and down a little through the day.
export const CURRENCIES = {
  crown: { name: 'Crown', plural: 'Crown coins', icon: '🟤', region: 'heart', city: 'central', par: 1, text: 'Copper, Silver and Gold coins of the Heartland. Every shop takes them.' },
  ember: { name: 'Ember Scale', plural: 'Ember Scales', icon: '🔶', region: 'peaks', city: 'emberfall', par: 40, swing: 0.16, text: 'Red-gold scales struck in the forges of Emberfall, in the Dragon Peaks.' },
  ash: { name: 'Ash Mark', plural: 'Ash Marks', icon: '⚫', region: 'warrens', city: 'ashgrave', par: 6, swing: 0.22, text: 'Rough iron tokens of Ashgrave, in the Ashen Wastes.' },
  glimmer: { name: 'Glimmer', plural: 'Glimmers', icon: '✨', region: 'fae', city: 'lumenhollow', par: 15, swing: 0.12, text: 'Little glowing glass beads of Lumenhollow, on the Fae Isles.' },
  pearl: { name: 'Mire Pearl', plural: 'Mire Pearls', icon: '⚪', region: 'mire', city: 'mirehaven', par: 25, swing: 0.1, text: 'Lake pearls of Mirehaven, in Mirefall.' },
};
export const FOREIGN = Object.keys(CURRENCIES).filter((k) => k !== 'crown');
// which coin a land (region id) or a city pays in
export const currencyOfRegion = (region) => Object.keys(CURRENCIES).find((k) => CURRENCIES[k].region === region) || 'crown';
export const currencyOfCity = (city) => Object.keys(CURRENCIES).find((k) => CURRENCIES[k].city === city) || 'crown';

// a smooth wobble in -1..1 that changes slowly with time (the same for everyone, server and game)
function h01(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function wobble(t, period, seed) {
  const u = t / period, i = Math.floor(u), f = u - i, k = f * f * (3 - 2 * f);
  return (h01(i * 1.7 + seed) * (1 - k) + h01((i + 1) * 1.7 + seed) * k) * 2 - 1;
}
// What one coin of a currency is worth in Copper now
export function rate(cur, now = Date.now()) {
  const C = CURRENCIES[cur];
  if (!C || cur === 'crown') return 1;
  const seed = FOREIGN.indexOf(cur) * 13.37 + 1;
  const v = C.par * (1 + C.swing * (0.7 * wobble(now, 8 * HOUR, seed) + 0.3 * wobble(now, 2 * DAY, seed + 5)));
  return Math.round(v * 100) / 100;
}
// The Bank changes money with a small spread (its way of earning, instead of interest):
// it sells you a foreign coin for a little more than it is worth, and buys it for a little less.
export const SPREAD = 0.03;
export const buyRate = (cur, now) => Math.ceil(rate(cur, now) * (1 + SPREAD) * 100) / 100; // Copper you pay for 1 coin
export const sellRate = (cur, now) => Math.floor(rate(cur, now) * (1 - SPREAD) * 100) / 100; // Copper you get for 1 coin
export const coinsWords = (cur, n) => (cur === 'crown' ? moneyWords(n) : `${n.toLocaleString()} ${n === 1 ? CURRENCIES[cur].name : CURRENCIES[cur].plural}`);

// ---------- the Bank ----------
export const BANK_ID = 'bank';
export const BANK_NAME = 'Bank of the Realm';
export const LOAN_FEE = 25;              // the one fixed service fee for a loan, in Copper
export const LOAN_DAYS = 7;              // real days to pay a loan back
export const LOAN_MIN = 100;
// how much the Bank will lend you: more as you level up; half if you were ever late paying back
export function loanLimit(c) {
  const base = Math.min(50 * 10000, 500 + (c.level || 1) * 150);
  return Math.floor(base / ((c.bank?.late || 0) > 0 ? 2 : 1));
}
export function freshBank(c) {
  c.bank ||= {};
  const b = c.bank;
  b.deposit = Math.max(0, Math.floor(Number(b.deposit) || 0));
  b.wallet = Object.fromEntries(FOREIGN.map((k) => [k, Math.max(0, Math.floor(Number(b.wallet?.[k]) || 0))]));
  b.loan = b.loan && b.loan.owed > 0 ? b.loan : null;
  b.late = Math.max(0, Math.floor(Number(b.late) || 0));
  b.log = Array.isArray(b.log) ? b.log.slice(-12) : [];
  return b;
}
export const loanLate = (b, now) => !!b.loan && now > b.loan.due;
// A loan not paid back in time: the Bank takes what is owed from your safekeeping (no extra charge).
function collectLate(c, now) {
  const b = c.bank;
  if (!loanLate(b, now)) return;
  if (!b.loan.wasLate) { b.loan.wasLate = true; b.late += 1; }
  const take = Math.min(b.deposit, b.loan.owed);
  if (take > 0) { b.deposit -= take; b.loan.owed -= take; note(b, now, `Late loan: ${moneyWords(take)} taken from your safekeeping`); }
  if (b.loan.owed <= 0) b.loan = null;
}
function note(b, now, text) { b.log.push({ at: now, text }); b.log = b.log.slice(-12); }

// What a player sees of their Bank
export function bankView(c, now = Date.now()) {
  const b = freshBank(c);
  collectLate(c, now);
  return { deposit: b.deposit, wallet: { ...b.wallet }, loan: b.loan ? { ...b.loan } : null, late: b.late, limit: loanLimit(c), log: b.log.slice().reverse() };
}

const whole = (v) => (Number.isInteger(v) && v > 0 && v < 1e12 ? v : null);
const fail = (error, need) => ({ error, ...(need ? { need } : {}) });

// One thing done at the counter. `body` = { act, amount, cur, city }; `c` is changed in place.
// Returns { ok, message } or { error, need }.
export function bankAct(c, body, now = Date.now()) {
  const b = freshBank(c);
  collectLate(c, now);
  const n = whole(Number(body?.amount));
  const city = String(body?.city || 'central');
  switch (body?.act) {
    case 'deposit':
      if (!n) return fail('Enter how much to put in.');
      if (c.coins < n) return fail(`You only have ${moneyWords(c.coins)} with you.`, n);
      c.coins -= n; b.deposit += n; note(b, now, `Put in ${moneyWords(n)}`);
      return { ok: true, message: `${moneyWords(n)} is safe in the Bank. It is kept for you exactly as it is: no interest, no fee.` };
    case 'withdraw':
      if (!n) return fail('Enter how much to take out.');
      if (b.deposit < n) return fail(`You only have ${moneyWords(b.deposit)} in the Bank.`);
      b.deposit -= n; c.coins += n; note(b, now, `Took out ${moneyWords(n)}`);
      return { ok: true, message: `You take ${moneyWords(n)} out of the Bank.` };
    case 'borrow': {
      if (c.child) return fail('The Bank does not lend to children.');
      if (b.loan) return fail('Pay back the loan you have first.');
      if (!n || n < LOAN_MIN) return fail(`The smallest loan is ${moneyWords(LOAN_MIN)}.`);
      const lim = loanLimit(c);
      if (n > lim) return fail(`The Bank will lend you at most ${moneyWords(lim)} at your level.`);
      if (c.coins + n < LOAN_FEE) return fail(`The service fee is ${moneyWords(LOAN_FEE)}.`, LOAN_FEE);
      c.coins += n - LOAN_FEE;
      b.loan = { amount: n, owed: n, taken: now, due: now + LOAN_DAYS * DAY, fee: LOAN_FEE };
      note(b, now, `Borrowed ${moneyWords(n)} (fee ${moneyWords(LOAN_FEE)})`);
      return { ok: true, message: `You borrow ${moneyWords(n)}. You pay back exactly ${moneyWords(n)}, never more, within ${LOAN_DAYS} days. The ${moneyWords(LOAN_FEE)} service fee is paid now.` };
    }
    case 'repay': {
      if (!b.loan) return fail('You have no loan.');
      const pay = Math.min(n || b.loan.owed, b.loan.owed);
      const fromBank = body?.from === 'bank';
      if ((fromBank ? b.deposit : c.coins) < pay) return fail(`You need ${moneyWords(pay)}${fromBank ? ' in the Bank' : ' with you'}.`, fromBank ? null : pay);
      if (fromBank) b.deposit -= pay; else c.coins -= pay;
      b.loan.owed -= pay; note(b, now, `Paid back ${moneyWords(pay)}`);
      if (b.loan.owed <= 0) { b.loan = null; return { ok: true, message: 'Your loan is paid back in full. Thank you!' }; }
      return { ok: true, message: `Paid back ${moneyWords(pay)}. ${moneyWords(b.loan.owed)} left to pay.` };
    }
    case 'buy': { // Crown coins from your purse -> a foreign currency
      const cur = body?.cur;
      if (!FOREIGN.includes(cur)) return fail('Choose a currency.');
      if (!n) return fail('Enter how many coins to buy.');
      const cost = Math.ceil(n * buyRate(cur, now));
      if (c.coins < cost) return fail(`${coinsWords(cur, n)} cost ${moneyWords(cost)} today.`, cost);
      c.coins -= cost; b.wallet[cur] += n; note(b, now, `Bought ${coinsWords(cur, n)} for ${moneyWords(cost)}`);
      return { ok: true, message: `You buy ${coinsWords(cur, n)} for ${moneyWords(cost)}. They are kept in your Bank account.` };
    }
    case 'sell': { // a foreign currency -> Crown coins in your purse
      const cur = body?.cur;
      if (!FOREIGN.includes(cur)) return fail('Choose a currency.');
      if (!n) return fail('Enter how many coins to change.');
      if (b.wallet[cur] < n) return fail(`You only have ${coinsWords(cur, b.wallet[cur])}.`);
      const got = Math.floor(n * sellRate(cur, now));
      b.wallet[cur] -= n; c.coins += got; note(b, now, `Changed ${coinsWords(cur, n)} into ${moneyWords(got)}`);
      return { ok: true, message: `You change ${coinsWords(cur, n)} into ${moneyWords(got)}.` };
    }
    case 'sell_oil': { // your Oil Company's barrels, sold to this city's Bank in its own currency
      const o = freshOil(c);
      const k = Math.min(n || o.barrels, o.barrels);
      if (!k) return fail('Your company has no barrels to sell. Collect them at your oil wells first.');
      const cur = currencyOfCity(city);
      const each = oilPrice(cur, now);
      const got = Math.floor(k * each);
      o.barrels -= k; o.sold += k;
      if (cur === 'crown') c.coins += got; else b.wallet[cur] += got;
      note(b, now, `Sold ${k} barrel${k === 1 ? '' : 's'} of oil for ${coinsWords(cur, got)}`);
      return { ok: true, message: `You sell ${k} barrel${k === 1 ? '' : 's'} of oil for ${coinsWords(cur, got)}${cur === 'crown' ? '' : ' (kept in your Bank account)'}.` };
    }
    default: return fail('The clerk does not understand.');
  }
}

// ---------- oil ----------
// Oil lies in pools deep under the ground, here and there in every land (never in a city or by a
// waystone). Some show at the surface as a black, tarry seep; the rest are found only by digging.
export const OIL_CELL = 400;             // the land is split into squares this big; some hold a pool
const OIL_CHANCE = 0.12;
export const SEEP_SHARE = 0.3;           // pools that show at the surface
export const DIG_COOLDOWN = 12 * 1000;   // one test pit every 12 seconds
export const COMPANY_FEE = 5000;         // founding an Oil Company (50 Silver)
export const DERRICK_COST = 3000;        // putting up a derrick over a pool
export const BARREL_MS = 10 * 60 * 1000; // a derrick pumps a barrel every 10 minutes
export const TANK = 24;                  // and holds at most this many before they must be collected
export const OIL_PRICE = 40;             // what a barrel is worth in Copper on an ordinary day
export const maxDerricks = (c) => 3 + Math.floor((c.level || 1) / 50);

function hashCell(cx, cz, salt) { const s = Math.sin(cx * 91.17 + cz * 47.31 + salt * 13.1) * 43758.5453; return s - Math.floor(s); }
const _s = {};
const dry = (x, z) => { const s = sample(x, z, _s); return !s.region || s.h < s.water + 1.2 || s.lake > 0.2; };
const cityNear = (x, z) => placesWithPositions().some((p) => p.city && Math.hypot(p.x - x, p.z - z) < CITY_R + 120);
const cache = new Map();
// The pool in one square of land, or null
export function depositIn(cx, cz) {
  const key = `${cx}_${cz}`;
  if (cache.has(key)) return cache.get(key);
  let d = null;
  if (hashCell(cx, cz, 1) < OIL_CHANCE) {
    const x = (cx + 0.15 + 0.7 * hashCell(cx, cz, 2)) * OIL_CELL, z = (cz + 0.15 + 0.7 * hashCell(cx, cz, 3)) * OIL_CELL;
    if (!dry(x, z) && !safeZoneAt(x, z) && !cityNear(x, z)) {
      const r = 18 + Math.round(hashCell(cx, cz, 4) * 24);
      const s = sample(x, z, _s);
      d = { id: key, x: Math.round(x), z: Math.round(z), r, barrels: 300 + Math.round(hashCell(cx, cz, 5) ** 2 * 2700),
        depth: 40 + Math.round(hashCell(cx, cz, 6) * 260), seep: hashCell(cx, cz, 7) < SEEP_SHARE, region: s.region, cur: currencyOfRegion(s.region) };
    }
  }
  if (cache.size > 4000) cache.clear();
  cache.set(key, d);
  return d;
}
export const depositById = (id) => { const m = /^(-?\d+)_(-?\d+)$/.exec(String(id)); return m ? depositIn(Number(m[1]), Number(m[2])) : null; };
// every pool within `r` metres of (x, z)
export function depositsNear(x, z, r) {
  const out = [];
  const c0x = Math.floor((x - r) / OIL_CELL), c1x = Math.floor((x + r) / OIL_CELL), c0z = Math.floor((z - r) / OIL_CELL), c1z = Math.floor((z + r) / OIL_CELL);
  for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
    const d = depositIn(cx, cz);
    if (d && Math.hypot(d.x - x, d.z - z) < r + d.r) out.push(d);
  }
  return out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
}
export const depositAt = (x, z) => depositsNear(x, z, 0).find((d) => Math.hypot(d.x - x, d.z - z) <= d.r) || null;

// The price of a barrel at a city's Bank, in that city's own coin
export function oilPrice(cur, now = Date.now()) {
  const copper = OIL_PRICE * (1 + 0.2 * wobble(now, 12 * HOUR, 77));
  return Math.max(0.01, Math.round((copper / rate(cur, now)) * 100) / 100);
}

export function freshOil(c) {
  c.oil ||= {};
  const o = c.oil;
  o.company = typeof o.company === 'string' && o.company ? o.company.slice(0, 32) : null;
  o.found = Array.isArray(o.found) ? o.found.filter((id) => typeof id === 'string').slice(-60) : [];
  o.barrels = Math.max(0, Math.floor(Number(o.barrels) || 0));
  o.sold = Math.max(0, Math.floor(Number(o.sold) || 0));
  o.lastDig = Number(o.lastDig) || 0;
  o.digs = Math.max(0, Math.floor(Number(o.digs) || 0));
  return o;
}
export const oilView = (c) => { const o = freshOil(c); return { company: o.company, found: o.found.slice(), barrels: o.barrels, sold: o.sold, digs: o.digs }; };

// How full a derrick's tank is now, and how much is left in its pool
export function wellState(w, now = Date.now()) {
  const d = depositById(w.id);
  const total = d ? d.barrels : 0;
  const left = Math.max(0, total - (w.out || 0));
  const tank = Math.min(TANK, left, (w.tank || 0) + Math.max(0, Math.floor((now - w.last) / BARREL_MS)));
  return { tank, left, total, dry: left <= 0, full: tank >= Math.min(TANK, left) && left > 0 };
}

const SIDES = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
// (north is -z on the map)
const towards = (dx, dz) => SIDES[((Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) % 8) + 8) % 8];
const hasShovel = (c) => (c.inventory || []).some((s) => s.id === 'shovel');
const cleanName = (s) => String(s || '').replace(/[^\p{L}\p{N} '&.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 32);

// One thing done with oil. `wells` is everyone's derricks [{ id, x, z, owner, company, last, tank, out }]
// (changed in place; `changed` lists the ones to save). `plotOwner(ix, iz)` names who owns a plot of land.
// Returns { ok, message, ... } or { error, need }.
export function oilAct(c, wells, body, { now = Date.now(), plotOwner = () => null } = {}) {
  const o = freshOil(c);
  freshBank(c);
  const x = Number(body?.x), z = Number(body?.z);
  const at = Number.isFinite(x) && Number.isFinite(z);
  // you must be standing about there (as last saved)
  const near = (px, pz, r) => !Number.isFinite(c.location?.x) || Math.hypot(c.location.x - px, c.location.z - pz) < r;
  switch (body?.act) {
    case 'dig': {
      if (!at) return fail('Dig where?');
      if (!hasShovel(c)) return fail('You need a Shovel to dig (the City Forge and the Farm Stand sell them).');
      if (now - o.lastDig < DIG_COOLDOWN) return fail('You are still catching your breath from the last pit.');
      if (!near(x, z, 120)) return fail('Walk to the spot first.');
      if (safeZoneAt(x, z)) return fail('No digging here: this is a town or waystone ground.');
      o.lastDig = now; o.digs += 1;
      const d = depositAt(x, z);
      if (d) {
        if (!o.found.includes(d.id)) o.found.push(d.id);
        const w = wells.find((q) => q.id === d.id);
        return { ok: true, found: d.id, message: `Black oil seeps into the bottom of your pit! There is a pool of about ${d.barrels.toLocaleString()} barrels ${d.depth} m down.${w ? ` ${w.company} already pumps it.` : o.company ? ' Put up a derrick here to pump it.' : ' A Businessman with an Oil Company can put up a derrick here.'}` };
      }
      const n = depositsNear(x, z, 900)[0];
      if (!n) return { ok: true, message: 'Dry earth and stones. No sign of oil anywhere near here.' };
      const dist = Math.hypot(n.x - x, n.z - z) - n.r, way = towards(n.x - x, n.z - z);
      const hint = dist < 60 ? `The soil is black and greasy. Oil is very close, just to the ${way}.`
        : dist < 250 ? `A strong smell of oil comes up from the pit. Try further ${way}.`
          : dist < 500 ? `Specks of tar in the dirt. There may be oil somewhere to the ${way}.`
            : `The faintest smell of oil, far away to the ${way}.`;
      return { ok: true, message: hint };
    }
    case 'found': { // start an Oil Company (Businessmen only)
      if (c.cls !== 'businessman') return fail('Only a Businessman can start an Oil Company.');
      if (o.company) return fail(`You already run ${o.company}.`);
      const name = cleanName(body?.name);
      if (name.length < 3) return fail('Give your company a name (3 letters or more).');
      if (c.coins < COMPANY_FEE) return fail(`Starting a company costs ${moneyWords(COMPANY_FEE)}.`, COMPANY_FEE);
      c.coins -= COMPANY_FEE; o.company = name;
      return { ok: true, message: `${name} is founded! Find oil (look for black seeps, or dig with a Shovel), then put up a derrick over it.` };
    }
    case 'drill': {
      if (!o.company) return fail('You need an Oil Company first (Businessmen can start one at any Bank).');
      if (!at) return fail('Where?');
      const d = depositAt(x, z);
      if (!d) return fail('There is no oil under this spot.');
      if (!d.seep && !o.found.includes(d.id)) return fail('You haven\'t found oil here yet: dig a test pit first.');
      if (!near(d.x, d.z, 150)) return fail('Walk to the spot first.');
      if (wells.some((q) => q.id === d.id)) return fail('Someone already pumps this pool.');
      const { ix, iz } = plotOf(d.x, d.z);
      const owner = plotOwner(ix, iz);
      if (owner && owner !== c.name) return fail(`This is ${owner}'s land. Only the owner may drill here.`);
      const mine = wells.filter((q) => q.owner === c.name).length;
      if (mine >= maxDerricks(c)) return fail(`Your company can run ${maxDerricks(c)} derricks at your level.`);
      if (c.coins < DERRICK_COST) return fail(`A derrick costs ${moneyWords(DERRICK_COST)}.`, DERRICK_COST);
      c.coins -= DERRICK_COST;
      const w = { id: d.id, x: d.x, z: d.z, owner: c.name, company: o.company, last: now, tank: 0, out: 0 };
      wells.push(w);
      return { ok: true, changed: [w], message: `The derrick of ${o.company} rises over the pool. It pumps a barrel every ${BARREL_MS / 60000} minutes; come back and collect them.` };
    }
    case 'collect': {
      const w = wells.find((q) => q.id === body?.id);
      if (!w) return fail('There is no derrick here.');
      if (w.owner !== c.name) return fail(`This derrick belongs to ${w.company}.`);
      if (!near(w.x, w.z, 150)) return fail('Walk to your derrick first.');
      const s = wellState(w, now);
      if (!s.tank) return fail(s.dry ? 'This pool has run dry.' : 'The tank is empty. Come back later.');
      const spare = Math.max(0, (now - w.last) % BARREL_MS);
      w.out = (w.out || 0) + s.tank; w.tank = 0; w.last = now - spare;
      o.barrels += s.tank;
      return { ok: true, changed: [w], message: `You fill ${s.tank} barrel${s.tank === 1 ? '' : 's'} of oil. Sell them at any city's Bank.` };
    }
    case 'close': { // take down your derrick (the pool is free for anyone again)
      const i = wells.findIndex((q) => q.id === body?.id && q.owner === c.name);
      if (i < 0) return fail('That is not your derrick.');
      const [w] = wells.splice(i, 1);
      return { ok: true, removed: [w.id], message: 'You take down the derrick.' };
    }
    default: return fail('Nothing to do.');
  }
}

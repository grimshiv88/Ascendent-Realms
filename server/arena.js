// The Colosseum: duels between players and the Weekly Championship (rules in
// public/js/data/arena.mjs). The server keeps every fight's HP and works out every blow, so no
// game can make its player stronger than they are.
//
// Nothing runs on a timer here: whatever is due (a challenge that ran out, a fight whose time is
// up, a fighter who left, the championship's draw and its next round) is settled the next time
// anyone asks. The game asks every second or two while its player is in the world (with the
// "who is near" report), and Vercel calls /api/arena/tick on Fridays at the draw, so the
// championship emails go out even if nobody is playing then.
const db = require('./db');
const mail = require('./mail');
const characters = require('./characters');
const A = require('../public/js/data/arena.mjs');
const { setTuning } = require('../public/js/data/game-data.mjs');

const OPEN = "('asked', 'accepted', 'fighting')";
const ONLINE_MS = 15000;

// ---------- the players' Colosseum records and email choices ----------
async function record(id) {
  const r = await db.get('SELECT wins, losses, cup_wins, mail_duels, mail_cup FROM arena_players WHERE account_id = ?', id);
  return { wins: r?.wins || 0, losses: r?.losses || 0, cupWins: r?.cup_wins || 0, mailDuels: r ? !!r.mail_duels : true, mailCup: r ? !!r.mail_cup : true };
}
const bump = (id, col) => db.run(`INSERT INTO arena_players (account_id, ${col}) VALUES (?, 1) ON CONFLICT (account_id) DO UPDATE SET ${col} = arena_players.${col} + 1`, id);
async function setMail(acc, body) {
  const now = await record(acc.id);
  const duels = body.duels === undefined ? now.mailDuels : !!body.duels, cup = body.cup === undefined ? now.mailCup : !!body.cup;
  await db.run(`INSERT INTO arena_players (account_id, mail_duels, mail_cup) VALUES (?, ?, ?)
    ON CONFLICT (account_id) DO UPDATE SET mail_duels = EXCLUDED.mail_duels, mail_cup = EXCLUDED.mail_cup`, acc.id, duels, cup);
  return { ok: true, me: await record(acc.id) };
}

const online = async (id, now) => {
  const r = await db.get('SELECT at FROM presence WHERE account_id = ?', id);
  return !!r && now - r.at < ONLINE_MS;
};
// an email to a player about the Colosseum, if they have a confirmed email and want these
async function tell(id, kind, send) {
  const acc = await db.get('SELECT email, email_verified, username FROM accounts WHERE id = ?', id);
  if (!acc?.email || !acc.email_verified || !mail.ready()) return;
  const r = await record(id);
  if (kind === 'duel' && !r.mailDuels) return;
  if (kind === 'cup' && !r.mailCup) return;
  await send(acc.email, acc.username).catch(() => {});
}

// ---------- one fight ----------
// a duel as one of its fighters sees it
function view(d, me, now = Date.now()) {
  const side = d.a_id === me ? 'a' : 'b', foe = side === 'a' ? 'b' : 'a';
  const won = d.winner_id == null ? null : d.winner_id === me;
  return {
    id: d.id, kind: d.kind, state: d.state, side, round: d.cup_round,
    foe: { id: d[`${foe}_id`], name: d[`${foe}_name`] }, me: { id: me, name: d[`${side}_name`] },
    incoming: d.state === 'asked' && side === 'b', until: d.until_at,
    mineIn: !!d[`${side}_in`], foeIn: !!d[`${foe}_in`],
    startAt: d.start_at, endsAt: d.ends_at,
    hp: d.max_a ? { me: d[`hp_${side}`], meMax: d[`max_${side}`], foe: d[`hp_${foe}`], foeMax: d[`max_${foe}`] } : null,
    won, how: d.how, endedAt: d.ended_at, now,
  };
}
// a fight as anyone watching sees it
const watchView = (d) => ({ id: d.id, kind: d.kind, state: d.state, a: { id: d.a_id, name: d.a_name, hp: d.hp_a, max: d.max_a }, b: { id: d.b_id, name: d.b_name, hp: d.hp_b, max: d.max_b }, startAt: d.start_at, endsAt: d.ends_at, winner: d.winner_id === d.a_id ? d.a_name : d.winner_id === d.b_id ? d.b_name : null, how: d.how, round: d.cup_round });

// The fight is over: `side` ('a' or 'b') won, or nobody (a draw). Only the first to settle it counts.
async function finish(d, side, how, now) {
  const winner = side ? d[`${side}_id`] : null;
  const r = await db.run("UPDATE duels SET state = 'done', winner_id = ?, how = ?, ended_at = ? WHERE id = ? AND state = 'fighting' RETURNING id", winner, how, now, d.id);
  if (!r.rows?.length) return false;
  if (side) { await bump(winner, 'wins'); await bump(d[`${side === 'a' ? 'b' : 'a'}_id`], 'losses'); }
  Object.assign(d, { state: 'done', winner_id: winner, how, ended_at: now });
  return true;
}
// whatever is due for this duel: an answer or a fighter that never came, time up, a fighter gone
async function settle(d, now, seen) {
  if ((d.state === 'asked' || d.state === 'accepted') && now > d.until_at) {
    const r = await db.run(`UPDATE duels SET state = 'expired', ended_at = ? WHERE id = ? AND state = ? RETURNING id`, now, d.id, d.state);
    if (r.rows?.length) Object.assign(d, { state: 'expired', ended_at: now });
    return d;
  }
  if (d.state !== 'fighting') return d;
  if (now > d.ends_at) {
    const side = A.timeWinner(d) || (d.kind === 'cup' ? 'a' : null); // (a championship fight can't end even: the higher seed goes on)
    await finish(d, side, 'time', now);
    return d;
  }
  // a fighter who closed the game or lost their connection gives up the fight
  if (now > d.start_at + A.AWAY_MS) {
    const goneA = now - (seen.get(d.a_id) || 0) > A.AWAY_MS, goneB = now - (seen.get(d.b_id) || 0) > A.AWAY_MS;
    if (goneA !== goneB) await finish(d, goneA ? 'b' : 'a', 'left', now);
    else if (goneA && goneB) await finish(d, d.kind === 'cup' ? 'a' : null, 'left', now);
  }
  return d;
}
async function seenTimes(ids) {
  if (!ids.length) return new Map();
  const rows = await db.all(`SELECT account_id, at FROM presence WHERE account_id IN (${ids.map(() => '?').join(', ')})`, ...ids);
  return new Map(rows.map((r) => [r.account_id, r.at]));
}
async function settleAll(rows, now) {
  const seen = await seenTimes([...new Set(rows.filter((d) => d.state === 'fighting').flatMap((d) => [d.a_id, d.b_id]))]);
  for (const d of rows) await settle(d, now, seen);
  return rows;
}

// may this account fight? (a grown-up character, not banned)
async function fighter(acc) {
  const c = await characters.load(acc.id);
  if (!c) return { error: 'Make a character first.' };
  if (c.child) return { error: A.MIN_AGE_NOTE };
  return { c };
}
async function busy(id) {
  return db.get(`SELECT id FROM duels WHERE (a_id = ? OR b_id = ?) AND state IN ('accepted', 'fighting') LIMIT 1`, id, id);
}

// Challenge a player (by username) to a duel
async function challenge(acc, body, now = Date.now()) {
  const me = await fighter(acc);
  if (me.error) return me;
  const name = String(body.name || '').trim();
  const other = await db.get('SELECT id, username FROM accounts WHERE lower(username) = lower(?)', name);
  if (!other) return { error: 'There is no player with that username.' };
  if (other.id === acc.id) return { error: 'You can\'t challenge yourself.' };
  const oc = await characters.load(other.id);
  if (!oc) return { error: `${other.username} has no character yet.` };
  if (oc.child) return { error: `${other.username} is still a child. ${A.MIN_AGE_NOTE}` };
  if (await db.get(`SELECT id FROM duels WHERE kind = 'friendly' AND state IN ${OPEN} AND ((a_id = ? AND b_id = ?) OR (a_id = ? AND b_id = ?))`, acc.id, other.id, other.id, acc.id)) return { error: `You and ${other.username} already have a challenge open.` };
  const recent = await db.get("SELECT COUNT(*)::int AS n FROM duels WHERE a_id = ? AND kind = 'friendly' AND made_at > ?", acc.id, now - 3600 * 1000);
  if (recent.n >= 10) return { error: 'You have sent a lot of challenges this hour. Wait a while.' };
  const r = await db.run(`INSERT INTO duels (kind, a_id, b_id, a_name, b_name, state, made_at, until_at)
    VALUES ('friendly', ?, ?, ?, ?, 'asked', ?, ?) RETURNING id`, acc.id, other.id, acc.username, other.username, now, now + A.CHALLENGE_MS);
  // away from the game: an email (unless they turned those off)
  let emailed = false;
  if (!(await online(other.id, now))) {
    emailed = true;
    await tell(other.id, 'duel', (to, nm) => mail.duelChallenge(to, nm, acc.username));
  }
  return { ok: true, id: r.rows[0].id, emailed, ...(await status(acc, {}, now)) };
}
// Accept or turn down a challenge; or take back one you sent
async function answer(acc, body, now = Date.now()) {
  const d = await db.get('SELECT * FROM duels WHERE id = ?', Number(body.id) || 0);
  if (!d || d.kind !== 'friendly') return { error: 'That challenge is gone.' };
  await settleAll([d], now);
  if (d.state !== 'asked') return { error: 'That challenge is no longer waiting.' };
  if (body.cancel) {
    if (d.a_id !== acc.id) return { error: 'Only the one who sent it can take it back.' };
    await db.run("UPDATE duels SET state = 'cancelled', ended_at = ? WHERE id = ? AND state = 'asked'", now, d.id);
    return { ok: true, ...(await status(acc, {}, now)) };
  }
  if (d.b_id !== acc.id) return { error: 'That challenge isn\'t for you.' };
  if (!body.accept) {
    await db.run("UPDATE duels SET state = 'declined', ended_at = ? WHERE id = ? AND state = 'asked'", now, d.id);
    return { ok: true, ...(await status(acc, {}, now)) };
  }
  const me = await fighter(acc);
  if (me.error) return me;
  if (await busy(acc.id)) return { error: 'Finish the fight you are in first.' };
  if (await busy(d.a_id)) return { error: `${d.a_name} is in another fight. Try again in a few minutes.` };
  await db.run("UPDATE duels SET state = 'accepted', until_at = ? WHERE id = ? AND state = 'asked'", now + A.ACCEPTED_MS, d.id);
  if (!(await online(d.a_id, now))) await tell(d.a_id, 'duel', (to, nm) => mail.duelAccepted(to, nm, acc.username));
  return { ok: true, ...(await status(acc, {}, now)) };
}
// Come to the Colosseum for an accepted fight (or your championship fight). Once both are there,
// the fight starts after a short countdown, each fighter with their own full HP.
async function enter(acc, body, now = Date.now()) {
  const d = await db.get('SELECT * FROM duels WHERE id = ?', Number(body.id) || 0);
  if (!d || (d.a_id !== acc.id && d.b_id !== acc.id)) return { error: 'That fight is not yours.' };
  await settleAll([d], now);
  if (d.state !== 'accepted') return { error: d.state === 'expired' ? 'Too late: the time to come has run out.' : 'That fight is not waiting for you.' };
  const side = d.a_id === acc.id ? 'a' : 'b';
  const r = await db.run(`UPDATE duels SET ${side}_in = true WHERE id = ? AND state = 'accepted' RETURNING *`, d.id);
  const row = r.rows?.[0];
  if (row?.a_in && row?.b_in) {
    setTuning(await characters.tuning());
    const [ca, cb] = [await characters.load(row.a_id), await characters.load(row.b_id)];
    if (ca && cb) {
      const sa = A.duelStats(ca), sb = A.duelStats(cb), start = now + A.COUNTDOWN_MS;
      await db.run(`UPDATE duels SET state = 'fighting', start_at = ?, ends_at = ?, hp_a = ?, hp_b = ?, max_a = ?, max_b = ?, stats = ?
        WHERE id = ? AND state = 'accepted'`, start, start + A.FIGHT_MS, sa.hp, sb.hp, sa.hp, sb.hp, JSON.stringify({ a: sa, b: sb }), row.id);
    }
  }
  return { ok: true, ...(await status(acc, {}, now)) };
}
// One blow at the other fighter. `mult` is the skill's strength (1 for a plain blow) and `magic`
// whether it is a spell. The server checks the fight is on, the fighters are close enough and the
// blows are not coming too fast, and works out the damage itself.
async function hit(acc, body, now = Date.now()) {
  const d = await db.get("SELECT * FROM duels WHERE id = ? AND state = 'fighting'", Number(body.id) || 0);
  if (!d || (d.a_id !== acc.id && d.b_id !== acc.id)) return { error: 'No fight.' };
  if (now < d.start_at) return { error: 'Wait for the call to fight.', early: true };
  await settleAll([d], now);
  if (d.state !== 'fighting') return { ok: true, duel: view(d, acc.id, now) };
  const side = d.a_id === acc.id ? 'a' : 'b', foe = side === 'a' ? 'b' : 'a';
  if (now - d[`last_${side}`] < A.HIT_GAP_MS) return { ok: true, tooFast: true, duel: view(d, acc.id, now) };
  const magic = !!body.magic;
  const spots = await db.all('SELECT account_id, x, z FROM presence WHERE account_id IN (?, ?)', d.a_id, d.b_id);
  const at = new Map(spots.map((p) => [p.account_id, p]));
  const pa = at.get(d.a_id), pb = at.get(d.b_id);
  if (!pa || !pb) return { ok: true, miss: true, duel: view(d, acc.id, now) };
  if (Math.hypot(pa.x - pb.x, pa.z - pb.z) > (magic ? A.REACH.magic : A.REACH.melee)) return { ok: true, miss: true, duel: view(d, acc.id, now) };
  const stats = JSON.parse(d.stats || '{}');
  const { dmg, crit } = A.duelDamage(stats[side], stats[foe], body.mult, magic);
  const r = await db.run(`UPDATE duels SET hp_${foe} = GREATEST(0, hp_${foe} - ?), last_${side} = ?
    WHERE id = ? AND state = 'fighting' AND last_${side} <= ? RETURNING *`, dmg, now, d.id, now - A.HIT_GAP_MS);
  const row = r.rows?.[0];
  if (!row) return { ok: true, tooFast: true, duel: view(d, acc.id, now) };
  if (row[`hp_${foe}`] <= 0) await finish(row, side, 'ko', now);
  return { ok: true, dmg, crit, duel: view(row, acc.id, now) };
}

// ---------- the Weekly Championship ----------
const CUP_KEY = 'arena_cup', CHAMP_KEY = 'arena_champion';
async function loadState(key) {
  const r = await db.get('SELECT data FROM world_state WHERE key = ?', key);
  return r ? { text: r.data, data: JSON.parse(r.data) } : { text: null, data: null };
}
// save, unless someone else changed it since it was read (several servers may settle at once)
async function saveState(key, old, data) {
  const text = JSON.stringify(data);
  if (old === null) {
    const r = await db.run('INSERT INTO world_state (key, data) VALUES (?, ?) ON CONFLICT (key) DO NOTHING RETURNING key', key, text);
    return !!r.rows?.length;
  }
  const r = await db.run('UPDATE world_state SET data = ? WHERE key = ? AND data = ? RETURNING key', text, key, old);
  return !!r.rows?.length;
}
let champCache = { at: 0, champ: null };
async function champion(now = Date.now()) {
  if (now - champCache.at > 15000) champCache = { at: now, champ: (await loadState(CHAMP_KEY)).data };
  return champCache.champ;
}

// Everyone in this week's championship: every grown-up character whose account isn't banned
async function entrants(now) {
  const rows = await db.all(`SELECT a.id, a.username, (c.data::jsonb ->> 'level') AS level, jsonb_typeof(c.data::jsonb -> 'child') AS child
    FROM accounts a JOIN characters c ON c.account_id = a.id WHERE a.banned_until = 0 OR (a.banned_until > 0 AND a.banned_until < ?)`, now);
  return rows.filter((r) => r.child !== 'object').map((r) => ({ id: r.id, name: r.username, level: Number(r.level) || 1 }));
}
// The draw's emails: each player's first fight (or a bye), and when the rounds after it are
async function mailDraw(st) {
  if (!mail.ready()) return;
  const firstOf = new Map();
  for (const m of st.rounds[0]) {
    if (m.a) firstOf.set(m.a.id, { foe: m.b?.name || null });
    if (m.b) firstOf.set(m.b.id, { foe: m.a?.name || null });
  }
  const ids = [...firstOf.keys()];
  if (!ids.length) return;
  const rows = await db.all(`SELECT a.id, a.email, a.username, a.email_verified, p.mail_cup FROM accounts a LEFT JOIN arena_players p ON p.account_id = a.id
    WHERE a.id IN (${ids.map(() => '?').join(', ')})`, ...ids);
  const total = st.rounds[0].length * 2;
  const rounds = A.roundsFor(total);
  const list = rows.filter((r) => r.email && r.email_verified && r.mail_cup !== false).map((r) => {
    const f = firstOf.get(r.id);
    return mail.cupScheduleMessage(r.email, r.username, {
      first: f.foe ? A.roundAt(st.week, 0) : A.roundAt(st.week, 1), foe: f.foe, bye: !f.foe,
      times: Array.from({ length: rounds }, (_, i) => A.roundAt(st.week, i)), players: st.players,
    });
  });
  await mail.sendMany(list);
}
let cupAt = 0;
// Settle the championship: make the draw when it is due, start each round on time, and crown the
// champion. At most every few seconds per server unless `force`.
async function settleCup(now = Date.now(), force = false) {
  if (!force && now - cupAt < 8000) return null;
  cupAt = now;
  const week = A.cupStart(now), drawAt = week - A.CUP.drawBefore;
  let { text, data: st } = await loadState(CUP_KEY);
  if ((!st || st.week !== week) && now >= drawAt) {
    const players = await entrants(now);
    const fresh = { week, drawAt, players: players.length, rounds: players.length >= 2 ? [A.drawCup(players)] : [], done: players.length < 2, made: now };
    if (await saveState(CUP_KEY, text, fresh)) {
      await mailDraw(fresh).catch((e) => console.error('championship emails:', e));
      ({ text, data: st } = { text: JSON.stringify(fresh), data: fresh });
    } else ({ text, data: st } = await loadState(CUP_KEY));
  }
  if (!st || st.week !== week || st.done) return st;
  let changed = false;
  for (let r = 0; r < A.CUP.maxRounds; r++) {
    const t = A.roundAt(week, r);
    if (now < t) break;
    if (!st.rounds[r]) {
      const prev = st.rounds[r - 1];
      if (!prev || prev.some((m) => m.winner === undefined)) break; // the last round isn't over yet
      st.rounds[r] = A.nextRound(prev);
      changed = true;
    }
    const round = st.rounds[r];
    for (const [i, m] of round.entries()) {
      if (m.winner !== undefined) continue;
      if (!m.a || !m.b) { m.winner = m.a || m.b || null; m.how = 'bye'; changed = true; continue; }
      if (!m.duel) {
        const ins = await db.run(`INSERT INTO duels (kind, a_id, b_id, a_name, b_name, state, made_at, until_at, cup_week, cup_round, cup_match)
          VALUES ('cup', ?, ?, ?, ?, 'accepted', ?, ?, ?, ?, ?) RETURNING id`, m.a.id, m.b.id, m.a.name, m.b.name, now, Math.max(t, now) + A.CHECKIN_MS, week, r, i);
        m.duel = ins.rows[0].id;
        changed = true;
        continue;
      }
      const d = await db.get('SELECT * FROM duels WHERE id = ?', m.duel);
      if (!d) { m.winner = null; changed = true; continue; }
      await settleAll([d], now);
      if (d.state === 'done') { m.winner = d.winner_id === m.a.id ? m.a : d.winner_id === m.b.id ? m.b : m.a; m.how = d.how; changed = true; }
      else if (d.state === 'expired') { m.winner = d.a_in ? m.a : d.b_in ? m.b : null; m.how = d.a_in || d.b_in ? 'no-show' : 'nobody'; changed = true; }
    }
    // the final is over: the champion takes the No.1 medal
    if (round.length === 1 && round[0].winner !== undefined) {
      st.done = true; changed = true;
      const w = round[0].winner;
      st.champion = w ? { id: w.id, name: w.name } : null;
      if (w) {
        const old = await loadState(CHAMP_KEY);
        await db.run('INSERT INTO world_state (key, data) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data', CHAMP_KEY, JSON.stringify({ id: w.id, name: w.name, week, at: now }));
        if (old.data?.week !== week) await bump(w.id, 'cup_wins');
        champCache.at = 0;
        await tell(w.id, 'cup', (to, nm) => mail.cupChampion(to, nm));
      }
      break;
    }
  }
  if (changed && !(await saveState(CUP_KEY, text, st))) return (await loadState(CUP_KEY)).data; // someone else got there first
  return st;
}
// the championship as the board shows it (names only), and your own next fight
function cupView(st, me, now) {
  const week = A.cupStart(now);
  const base = { week, drawAt: week - A.CUP.drawBefore, roundMs: A.CUP.roundMs, checkinMs: A.CHECKIN_MS };
  if (!st || st.week !== week) return { ...base, drawn: false };
  const nm = (p) => p?.name || null;
  const rounds = st.rounds.map((round, r) => round.map((m) => ({ a: nm(m.a), b: nm(m.b), winner: m.winner === undefined ? undefined : nm(m.winner), how: m.how || null, duel: m.duel || null, round: r })));
  // where you stand: still in (and when your next fight is), or out
  let mine = null;
  for (const [r, round] of st.rounds.entries()) {
    const m = round.find((q) => q.a?.id === me || q.b?.id === me);
    if (!m) continue;
    const foe = m.a?.id === me ? m.b : m.a;
    if (m.winner === undefined) mine = { round: r, at: A.roundAt(week, r), foe: foe?.name || null, duel: m.duel || null, live: true };
    else if (m.winner?.id === me) mine = { round: r + 1, at: A.roundAt(week, r + 1), foe: null, won: true, live: !st.done };
    else mine = { round: r, out: true, how: m.how };
  }
  if (st.done && st.champion?.id === me) mine = { champion: true };
  return { ...base, drawn: true, players: st.players, rounds, done: !!st.done, champion: st.champion || null, mine, total: A.roundsFor(st.players || 2) };
}

// ---------- what the game hears ----------
// Your fights: challenges for you and from you, a fight you're called to or in, and the end of a
// fight a moment ago; a fight you're watching; and who holds the No.1 medal
async function status(acc, body = {}, now = Date.now()) {
  await settleCup(now).catch((e) => console.error('championship:', e));
  const rows = await db.all(`SELECT * FROM duels WHERE (a_id = ? OR b_id = ?) AND (state IN ${OPEN} OR ended_at > ?) ORDER BY id DESC LIMIT 12`, acc.id, acc.id, now - 20000);
  await settleAll(rows, now);
  let watching = null;
  const w = Number(body.watch) || 0;
  if (w) {
    const d = await db.get('SELECT * FROM duels WHERE id = ?', w);
    if (d) { await settleAll([d], now); watching = watchView(d); }
  }
  const champ = await champion(now);
  return { duels: rows.map((d) => view(d, acc.id, now)), watching, champion: champ ? { id: champ.id, name: champ.name } : null, now };
}
// The Colosseum's board: fights on now, the championship and your record
async function board(acc, now = Date.now()) {
  const st = await settleCup(now, true);
  const live = await db.all(`SELECT * FROM duels WHERE state IN ('accepted', 'fighting') ORDER BY (state = 'fighting') DESC, id DESC LIMIT 30`);
  await settleAll(live, now);
  return {
    ok: true, me: await record(acc.id), live: live.filter((d) => d.state === 'fighting' || d.state === 'accepted').map(watchView),
    cup: cupView(st, acc.id, now), champion: await champion(now), ...(await status(acc, {}, now)),
  };
}
async function act(acc, body = {}) {
  const now = Date.now();
  if (body.act === 'challenge') return challenge(acc, body, now);
  if (body.act === 'answer') return answer(acc, body, now);
  if (body.act === 'enter') return enter(acc, body, now);
  if (body.act === 'hit') return hit(acc, body, now);
  if (body.act === 'mail') return setMail(acc, body);
  return { error: 'Unknown action.' };
}
// Vercel's timer (Fridays at the draw): make the draw and send its emails
const tick = async () => ({ ok: true, cup: !!(await settleCup(Date.now(), true)) });

module.exports = { status, board, act, tick, champion, settleCup };

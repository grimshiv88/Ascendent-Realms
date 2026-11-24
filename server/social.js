// Friends, chat and who can see your Status.
// Players find each other by username, send friend requests, chat in the general chat and,
// once friends, in private. Every message is cleaned of bad words before it is kept.
const db = require('./db');
const characters = require('./characters');
const S = require('../public/js/data/social.mjs');
const rooms = require('./rooms');
const groups = require('./groups');
const cults = require('./cults');
const { isAppraisal, appraisalOf } = require('../public/js/data/unique.mjs');
// the private chats you're in besides friends: meeting rooms, your party and your guild
const extraChannels = async (me) => [...(await rooms.channels(me)), ...(await groups.channels(me))];

// when each player last asked for news (online) and last sent a message are kept with the account,
// because the game may run on several servers at once
const isOnline = (lastSeen) => Date.now() - (Number(lastSeen) || 0) < S.ONLINE_MS;

const byName = (name) => db.get('SELECT id, username, last_seen FROM accounts WHERE lower(username) = lower(?)', String(name || '').trim());
const nameOf = async (id) => (await db.get('SELECT username FROM accounts WHERE id = ?', id))?.username;
const pair = (x, y) => [Math.min(x, y), Math.max(x, y)];
const link = (x, y) => db.get('SELECT * FROM friends WHERE a = ? AND b = ?', ...pair(x, y));
// how `other` stands with `me`: 'self', 'friend', 'sent' (you asked them), 'received' (they asked you) or 'none'
async function relation(me, other) {
  if (me === other) return 'self';
  const l = await link(me, other);
  if (!l) return 'none';
  if (l.accepted) return 'friend';
  return l.requested_by === me ? 'sent' : 'received';
}

// Players whose username starts with `q`
async function search(me, q) {
  q = String(q || '').trim();
  if (q.length < 2) return { players: [] };
  const rows = await db.all("SELECT id, username, last_seen FROM accounts WHERE username ILIKE ? ESCAPE '\\' AND id != ? ORDER BY length(username), username LIMIT 8",
    `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, me);
  const players = [];
  for (const r of rows) players.push({ name: r.username, relation: await relation(me, r.id), online: isOnline(r.last_seen) });
  return { players };
}

// A player's card: their Status only if their privacy lets you see it
async function profile(me, name) {
  const row = await byName(name);
  if (!row) return { error: 'There is no player with that username.' };
  const rel = await relation(me, row.id);
  const c = await characters.load(row.id);
  const visible = !!c && S.canSeeStatus(c, { self: rel === 'self', friend: rel === 'friend' });
  return {
    player: {
      name: row.username, relation: rel, online: isOnline(row.last_seen), privacy: S.privacyOf(c),
      status: visible ? S.statusSummary(c) : null,
      // only a member of the same cult, of the same rank or higher, ever sees this
      cult: c ? await cults.seenBy(await nameOf(me), row.username) : null,
    },
  };
}

// Appraisal sees everything about a person, even the side they secretly serve
async function appraise(me, name) {
  const mine = await characters.load(me);
  if (!isAppraisal(mine)) return { error: 'Only the holder of Appraisal can do that.' };
  const row = await byName(name);
  const c = row && await characters.load(row.id);
  if (!c) return { error: 'There is no living player with that username.' };
  return { player: appraisalOf(c, await cults.allegiance(row.username)) };
}

async function request(me, body) {
  const row = await byName(body.name);
  if (!row) return { error: 'There is no player with that username.' };
  if (row.id === me) return { error: "You can't add yourself." };
  const rel = await relation(me, row.id);
  if (rel === 'friend') return { error: 'You are already friends.' };
  if (rel === 'sent') return { error: 'You already asked. Waiting for them to accept.' };
  if (rel === 'received') await db.run('UPDATE friends SET accepted = 1 WHERE a = ? AND b = ?', ...pair(me, row.id));
  else await db.run('INSERT INTO friends (a, b, requested_by) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', ...pair(me, row.id), me);
  return { ok: true, ...(await friends(me)) };
}

async function respond(me, body) {
  const row = await byName(body.name);
  if (!row || (await relation(me, row.id)) !== 'received') return { error: 'There is no friend request from that player.' };
  if (body.accept) await db.run('UPDATE friends SET accepted = 1 WHERE a = ? AND b = ?', ...pair(me, row.id));
  else await db.run('DELETE FROM friends WHERE a = ? AND b = ?', ...pair(me, row.id));
  return { ok: true, ...(await friends(me)) };
}

// Unfriend, or take back a request you sent
async function remove(me, body) {
  const row = await byName(body.name);
  if (!row) return { error: 'There is no player with that username.' };
  await db.run('DELETE FROM friends WHERE a = ? AND b = ?', ...pair(me, row.id));
  return { ok: true, ...(await friends(me)) };
}

// Your friends and requests
async function friends(me) {
  const rows = await db.all(`SELECT f.*, o.username AS other_name, o.last_seen AS other_seen FROM friends f
    JOIN accounts o ON o.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END WHERE f.a = ? OR f.b = ?`, me, me, me);
  const out = { friends: [], received: [], sent: [] };
  for (const r of rows) {
    const entry = { name: r.other_name, online: isOnline(r.other_seen) };
    if (r.accepted) out.friends.push(entry);
    else (r.requested_by === me ? out.sent : out.received).push(entry);
  }
  out.friends.sort((x, y) => Number(y.online) - Number(x.online) || x.name.localeCompare(y.name));
  return out;
}

// News since message `after`: the general chat, your private chats, and your friends
async function poll(me, after) {
  await db.run('UPDATE accounts SET last_seen = ? WHERE id = ?', Date.now(), me);
  after = Math.max(0, Number(after) || 0);
  // the rooms you're in have their own private chats
  const rc = await extraChannels(me);
  const roomLabel = new Map(rc.map((r) => [r.channel, r.label]));
  const inRooms = rc.length ? ` OR channel IN (${rc.map(() => '?').join(',')})` : '';
  const args = [`dm:${me}:%`, `dm:%:${me}`, ...rc.map((r) => r.channel)];
  // the first look shows the last few messages; after that, everything new
  const rows = after
    ? await db.all(`SELECT * FROM chat WHERE id > ? AND (channel = 'general' OR channel LIKE ? OR channel LIKE ?${inRooms}) ORDER BY id LIMIT 100`, after, ...args)
    : await db.all(`SELECT * FROM (SELECT * FROM chat WHERE channel = 'general' OR channel LIKE ? OR channel LIKE ?${inRooms} ORDER BY id DESC LIMIT 40) AS recent ORDER BY id`, ...args);
  const names = new Map();
  const messages = [];
  for (const r of rows) {
    let channel = 'general';
    if (r.channel.startsWith('dm:')) {
      const [, x, y] = r.channel.split(':').map(Number);
      const other = x === me ? y : x;
      if (!names.has(other)) names.set(other, await nameOf(other));
      channel = names.get(other) || '?';
    } else if (roomLabel.has(r.channel)) channel = roomLabel.get(r.channel);
    messages.push({ id: r.id, channel, from: r.from_name, mine: r.from_id === me, text: r.text, at: r.at });
  }
  const ann = await db.get("SELECT data FROM world_state WHERE key = 'announcement'");
  const a = ann ? JSON.parse(ann.data) : null;
  return { messages, rooms: rc.map((r) => r.label), announcement: a && a.until > Date.now() ? { text: a.text, at: a.at } : null, ...(await friends(me)) };
}

// Send to the general chat, or to a friend by username
async function send(me, body) {
  const said = S.cleanText(body.text);
  if (!said) return { error: 'Write something first.' };
  const muted = await db.get('SELECT muted_until FROM accounts WHERE id = ?', me);
  if (muted && muted.muted_until > Date.now()) return { error: `You can't chat right now (muted by the game's owner for ${Math.ceil((muted.muted_until - Date.now()) / 60000)} more minute(s)).` };
  // those who have had the cults' call can't speak of it
  const text = await cults.censor(me, said);
  const now = Date.now();
  let channel = 'general';
  const room = body.to && (await extraChannels(me)).find((r) => r.label === body.to);
  if (room) channel = room.channel;
  else if (body.to) {
    const row = await byName(body.to);
    if (!row || (await relation(me, row.id)) !== 'friend') return { error: 'You can only send private messages to friends.' };
    channel = S.dmChannel(me, row.id);
  }
  // not too fast: the time of the last message is taken in the same step, so two at once can't both pass
  const gate = await db.run('UPDATE accounts SET last_sent = ? WHERE id = ? AND last_sent <= ?', now, me, now - S.SEND_GAP_MS);
  if (!gate.changes) return { error: 'Slow down a little.' };
  // a cult member who gives the cult away in chat is stripped of its powers and money
  await cults.checkChat(me, said);
  await db.run('INSERT INTO chat (channel, from_id, from_name, text, at) VALUES (?, ?, ?, ?, ?)', channel, me, await nameOf(me), text, now);
  // the general chat only keeps its most recent messages
  if (channel === 'general') await db.run("DELETE FROM chat WHERE channel = 'general' AND id <= (SELECT id FROM chat WHERE channel = 'general' ORDER BY id DESC LIMIT 1 OFFSET ?)", S.KEEP_MESSAGES);
  return { ok: true, ...(await poll(me, Number(body.after) || 0)) };
}

async function setPrivacy(me, body) {
  if (!S.PRIVACY[body.privacy]) return { error: 'Choose Public, Friends only or Private.' };
  const c = await characters.load(me);
  if (!c) return { error: 'No character yet.' };
  c.privacy = body.privacy;
  await characters.store(me, c);
  return { ok: true, privacy: c.privacy };
}

module.exports = {
  appraise, search, profile, request, respond, remove, friends, poll, send, setPrivacy };

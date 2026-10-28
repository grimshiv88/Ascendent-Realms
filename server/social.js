// Friends, chat and who can see your Status.
// Players find each other by username, send friend requests, chat in the general chat and,
// once friends, in private. Every message is cleaned of bad words before it is kept.
const db = require('./db');
const characters = require('./characters');
const S = require('../public/js/data/social.mjs');
const rooms = require('./rooms');

db.exec(`
  CREATE TABLE IF NOT EXISTS friends (
    a            INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    b            INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL,
    accepted     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (a, b)
  );
  CREATE TABLE IF NOT EXISTS chat (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    channel   TEXT NOT NULL,
    from_id   INTEGER NOT NULL,
    from_name TEXT NOT NULL,
    text      TEXT NOT NULL,
    at        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS chat_channel ON chat (channel, id);
`);

const lastSeen = new Map(); // account id -> when they last asked for news
const lastSent = new Map(); // account id -> when they last sent a message
const online = (id) => Date.now() - (lastSeen.get(id) || 0) < S.ONLINE_MS;

const byName = (name) => db.prepare('SELECT id, username FROM accounts WHERE username = ? COLLATE NOCASE').get(String(name || '').trim());
const nameOf = (id) => db.prepare('SELECT username FROM accounts WHERE id = ?').get(id)?.username;
const pair = (x, y) => [Math.min(x, y), Math.max(x, y)];
const link = (x, y) => db.prepare('SELECT * FROM friends WHERE a = ? AND b = ?').get(...pair(x, y));
// how `other` stands with `me`: 'self', 'friend', 'sent' (you asked them), 'received' (they asked you) or 'none'
function relation(me, other) {
  if (me === other) return 'self';
  const l = link(me, other);
  if (!l) return 'none';
  if (l.accepted) return 'friend';
  return l.requested_by === me ? 'sent' : 'received';
}

// Players whose username starts with `q`
function search(me, q) {
  q = String(q || '').trim();
  if (q.length < 2) return { players: [] };
  const rows = db.prepare("SELECT id, username FROM accounts WHERE username LIKE ? ESCAPE '\\' COLLATE NOCASE AND id != ? ORDER BY length(username), username LIMIT 8")
    .all(`${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, me);
  return { players: rows.map((r) => ({ name: r.username, relation: relation(me, r.id), online: online(r.id) })) };
}

// A player's card: their Status only if their privacy lets you see it
function profile(me, name) {
  const row = byName(name);
  if (!row) return { error: 'There is no player with that username.' };
  const rel = relation(me, row.id);
  const c = characters.load(row.id);
  const visible = !!c && S.canSeeStatus(c, { self: rel === 'self', friend: rel === 'friend' });
  return {
    player: {
      name: row.username, relation: rel, online: online(row.id), privacy: S.privacyOf(c),
      status: visible ? S.statusSummary(c) : null,
    },
  };
}

function request(me, body) {
  const row = byName(body.name);
  if (!row) return { error: 'There is no player with that username.' };
  if (row.id === me) return { error: "You can't add yourself." };
  const rel = relation(me, row.id);
  if (rel === 'friend') return { error: 'You are already friends.' };
  if (rel === 'sent') return { error: 'You already asked. Waiting for them to accept.' };
  if (rel === 'received') db.prepare('UPDATE friends SET accepted = 1 WHERE a = ? AND b = ?').run(...pair(me, row.id));
  else db.prepare('INSERT INTO friends (a, b, requested_by) VALUES (?, ?, ?)').run(...pair(me, row.id), me);
  return { ok: true, ...friends(me) };
}

function respond(me, body) {
  const row = byName(body.name);
  if (!row || relation(me, row.id) !== 'received') return { error: 'There is no friend request from that player.' };
  if (body.accept) db.prepare('UPDATE friends SET accepted = 1 WHERE a = ? AND b = ?').run(...pair(me, row.id));
  else db.prepare('DELETE FROM friends WHERE a = ? AND b = ?').run(...pair(me, row.id));
  return { ok: true, ...friends(me) };
}

// Unfriend, or take back a request you sent
function remove(me, body) {
  const row = byName(body.name);
  if (!row) return { error: 'There is no player with that username.' };
  db.prepare('DELETE FROM friends WHERE a = ? AND b = ?').run(...pair(me, row.id));
  return { ok: true, ...friends(me) };
}

// Your friends and requests
function friends(me) {
  const rows = db.prepare('SELECT * FROM friends WHERE a = ? OR b = ?').all(me, me);
  const out = { friends: [], received: [], sent: [] };
  for (const r of rows) {
    const other = r.a === me ? r.b : r.a;
    const entry = { name: nameOf(other), online: online(other) };
    if (r.accepted) out.friends.push(entry);
    else (r.requested_by === me ? out.sent : out.received).push(entry);
  }
  out.friends.sort((x, y) => Number(y.online) - Number(x.online) || x.name.localeCompare(y.name));
  return out;
}

// News since message `after`: the general chat, your private chats, and your friends
function poll(me, after) {
  lastSeen.set(me, Date.now());
  after = Math.max(0, Number(after) || 0);
  // the rooms you're in have their own private chats
  const rc = rooms.channels(me);
  const roomLabel = new Map(rc.map((r) => [r.channel, r.label]));
  const inRooms = rc.length ? ` OR channel IN (${rc.map(() => '?').join(',')})` : '';
  const args = [`dm:${me}:%`, `dm:%:${me}`, ...rc.map((r) => r.channel)];
  // the first look shows the last few messages; after that, everything new
  const rows = after
    ? db.prepare(`SELECT * FROM chat WHERE id > ? AND (channel = 'general' OR channel LIKE ? OR channel LIKE ?${inRooms}) ORDER BY id LIMIT 100`).all(after, ...args)
    : db.prepare(`SELECT * FROM (SELECT * FROM chat WHERE channel = 'general' OR channel LIKE ? OR channel LIKE ?${inRooms} ORDER BY id DESC LIMIT 40) ORDER BY id`).all(...args);
  const messages = rows.map((r) => {
    let channel = 'general';
    if (r.channel.startsWith('dm:')) {
      const [, x, y] = r.channel.split(':').map(Number);
      channel = nameOf(x === me ? y : x) || '?';
    } else if (roomLabel.has(r.channel)) channel = roomLabel.get(r.channel);
    return { id: r.id, channel, from: r.from_name, mine: r.from_id === me, text: r.text, at: r.at };
  });
  return { messages, rooms: rc.map((r) => r.label), ...friends(me) };
}

// Send to the general chat, or to a friend by username
function send(me, body) {
  const text = S.cleanText(body.text);
  if (!text) return { error: 'Write something first.' };
  const now = Date.now();
  if (now - (lastSent.get(me) || 0) < S.SEND_GAP_MS) return { error: 'Slow down a little.' };
  let channel = 'general';
  const room = body.to && rooms.channels(me).find((r) => r.label === body.to);
  if (room) channel = room.channel;
  else if (body.to) {
    const row = byName(body.to);
    if (!row || relation(me, row.id) !== 'friend') return { error: 'You can only send private messages to friends.' };
    channel = S.dmChannel(me, row.id);
  }
  lastSent.set(me, now);
  db.prepare('INSERT INTO chat (channel, from_id, from_name, text, at) VALUES (?, ?, ?, ?, ?)').run(channel, me, nameOf(me), text, now);
  // the general chat only keeps its most recent messages
  if (channel === 'general') db.prepare("DELETE FROM chat WHERE channel = 'general' AND id <= (SELECT id FROM chat WHERE channel = 'general' ORDER BY id DESC LIMIT 1 OFFSET ?)").run(S.KEEP_MESSAGES);
  return { ok: true, ...poll(me, Number(body.after) || 0) };
}

function setPrivacy(me, body) {
  if (!S.PRIVACY[body.privacy]) return { error: 'Choose Public, Friends only or Private.' };
  const c = characters.load(me);
  if (!c) return { error: 'No character yet.' };
  c.privacy = body.privacy;
  characters.store(me, c);
  return { ok: true, privacy: c.privacy };
}

module.exports = { search, profile, request, respond, remove, friends, poll, send, setPrivacy };

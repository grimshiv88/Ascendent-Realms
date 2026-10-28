// Cults and the Order of the Dawn, shared by the game and the server.
//
// A strong monster player can found a cult for their race: one cult per race. Its members are
// ranked, from the Cult Leader down to the Initiates. Higher ranks hand missions down to lower ranks,
// and every member can also ask for missions of their own. Every mission is about causing chaos.
//
// Secrecy: nobody outside a cult can see who is in it. Inside, a member sees only those of their own
// rank and below, never who is above them. A member who gives the cult away (in chat) is stripped of
// the cult's powers and of every coin the cult gave them.
//
// Nobody asks to join, and members don't recruit. The call comes out of nowhere, to a chosen few:
// doing certain things in the world (slaying a monster village's chief, beating a cave boss by night,
// a Businessman's trade at a market stall in the dark, and so on) may bring it. Which deeds count is
// secret even from the code: the server picks a few from the pool below at random, keeps them in its
// own records and picks again every month, and even then a deed only brings the call now and then.
//
// The call offers both sides: join the Dark Side (dark powers and money), or reject it and become
// Light (holy powers and strength, sworn to the Order of the Dawn, which works against the cults).
// Or walk away from both. Whatever you choose, the call is a secret: anyone who has had it can't
// speak of it in chat (the words are blotted out), and a cult member who gives the cult away loses
// its powers and its coins. Neither side is ever given a mission that names a player.
//
// A cult can only hold as many as its strength allows: a few, plus more for a stronger leader and
// for every level its members hold between them (see capacity).
//
// State: { cults: [{ race, name, founded, members: [{ name, rank, joined, gained, favour, level }],
//   invites: [{ to, at }], missions: [...] }], order: [{ name, joined }],
//   choices: { name: 'joined'|'refused'|'order'|'silent' }, stripped: [{ name, coins, at }], keys: { deeds, until }, next }
import { cleanText } from './social.mjs';

export const CULT_FOUND_LEVEL = 200;
export const CULT_RANKS = ['Cult Leader', 'High Priest', 'Zealot', 'Acolyte', 'Initiate'];
export const INITIATE = CULT_RANKS.length - 1;
export const PROMOTE_AT = [Infinity, 15, 8, 3, 0]; // favour that lifts a member to each rank
export const ORDER_NAME = 'Order of the Dawn';
export const INVITE_MS = 3 * 24 * 3600 * 1000; // the call waits this long for an answer
export const JOIN_COINS = (level) => 1000 + level * 5; // the cult's welcome purse
export const HOLY_STR = 5;                    // Strength the refusal grants, for good
export const PACT_PCT = 15;                   // dark: +ATK; holy: +DEF (as a lasting boost)

// the two answers to the call, as the message words them
export const ACCEPT_TEXT = 'Accept and join the Dark Side';
export const REJECT_TEXT = 'Reject and fight the Evil, Become Light!';

// ---------- the hidden deeds that may bring the call ----------
// The pool. Only a few are live at a time (chosen at random by the server, kept secret), and a live
// deed brings the call only one time in DEED_CHANCE.
export const DEEDS = ['village_chief', 'village_chief_night', 'village_loot', 'cave_boss', 'cave_boss_night', 'royal_guard',
  'merge_awaken', 'merge_ascend', 'stone_set', 'big_sale', 'night_trade', 'midnight_kill'];
export const LIVE_DEEDS = 4;
export const DEED_CHANCE = 3;
export const KEYS_MS = 30 * 24 * 3600 * 1000;
function liveDeeds(s, now, rnd) {
  if (!s.keys || s.keys.until < now) {
    const pool = [...DEEDS];
    const deeds = [];
    while (deeds.length < LIVE_DEEDS && pool.length) deeds.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    s.keys = { deeds, until: now + KEYS_MS };
  }
  return s.keys.deeds;
}

// How many a cult can hold: 2, plus 1 for every 40 levels of its leader, plus 1 for every 500
// levels its other members hold between them (a level 200 leader alone: 7)
export function capacity(cult) {
  const leader = cult.members.find((m) => m.rank === 0);
  const others = cult.members.filter((m) => m !== leader).reduce((a, m) => a + (m.level || 1), 0);
  return 2 + Math.floor((leader?.level || 1) / 40) + Math.floor(others / 500);
}
export const hasRoom = (cult) => cult.members.length + cult.invites.length < capacity(cult);

export const emptyCults = () => ({ cults: [], order: [], choices: {}, stripped: [], next: 1 });
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export const cultOf = (s, name) => s.cults.find((c) => c.members.some((m) => same(m.name, name))) || null;
export const memberOf = (cult, name) => cult?.members.find((m) => same(m.name, name)) || null;
export const inOrder = (s, name) => s.order.some((m) => same(m.name, name));
const choiceOf = (s, name) => s.choices[String(name).toLowerCase()] || null;

// ---------- missions ----------
// Each kind is counted by the game: monsters slain near a town's gates, monsters slain at night, or
// a place visited at night. None of them ever names a player.
export const MISSIONS = {
  cult: [
    { kind: 'gates', need: 12, text: 'Bring terror to the gates: slay 12 monsters within 1.5 km of a town or village, so their bodies are found at dawn.' },
    { kind: 'night', need: 15, text: 'Feed the dark: slay 15 monsters by night.' },
    { kind: 'omen', need: 1, text: 'Leave an omen: stand at a village waystone at night.' },
    { kind: 'gates', need: 25, text: 'A night of fear: slay 25 monsters within 1.5 km of a town or village.' },
  ],
  order: [
    { kind: 'gates', need: 12, text: 'Keep the roads safe: slay 12 monsters within 1.5 km of a town or village.' },
    { kind: 'night', need: 15, text: 'Stand the night watch: slay 15 monsters by night.' },
    { kind: 'omen', need: 1, text: 'Hold the vigil: stand at a village waystone at night.' },
  ],
};
export const GATES_R = 1500;
export const missionReward = (level, need) => Math.round((40 + level * 2) * Math.max(1, need / 6));

// ---------- the cult itself ----------
export function checkCultName(s, raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 28) return { error: 'A cult name is 3 to 28 letters long.' };
  if (!/^[A-Za-z0-9 ']+$/.test(name)) return { error: 'Use only letters, numbers and spaces in the name.' };
  if (cleanText(name) !== name) return { error: 'Choose a cleaner name.' };
  if (s.cults.some((c) => same(c.name, name)) || same(name, ORDER_NAME)) return { error: 'That name is taken.' };
  return { name };
}
// `me` is { name, race, side, level }
export function found(s, me, rawName, now = Date.now()) {
  if (me.side !== 'monster') return { error: 'Only monsters can found a cult.' };
  if (me.level < CULT_FOUND_LEVEL) return { error: `You must be level ${CULT_FOUND_LEVEL} to found a cult.` };
  if (cultOf(s, me.name)) return { error: 'You already serve a cult.' };
  if (inOrder(s, me.name)) return { error: 'The Order of the Dawn would never let you.' };
  if (s.cults.some((c) => c.race === me.race)) return { error: 'Your race already has its cult. There can only be one.' };
  const check = checkCultName(s, rawName);
  if (check.error) return check;
  const cult = { id: s.next++, race: me.race, name: check.name, founded: now, members: [{ name: me.name, rank: 0, joined: now, gained: 0, favour: 0, level: me.level }], invites: [], missions: [] };
  s.cults.push(cult);
  s.choices[me.name.toLowerCase()] = 'joined';
  return { ok: true };
}
// Keep a member's level up to date (it decides how many the cult can hold)
export function touch(s, me) {
  const m = memberOf(cultOf(s, me.name), me.name);
  if (m && m.level !== me.level) { m.level = me.level; return true; }
  return false;
}

// Someone did something in the world. If it is one of the live deeds, the call may come to them:
// from their own race's cult (a monster) or from any cult with room (a player). Answers nothing
// either way, so a deed can't be found out by trying.
export function deed(s, me, id, now = Date.now(), rnd = Math.random) {
  if (!DEEDS.includes(id)) return { ok: true };
  const live = liveDeeds(s, now, rnd);
  if (!live.includes(id) || choiceOf(s, me.name) || cultOf(s, me.name) || inOrder(s, me.name)) return { ok: true };
  if (s.cults.some((c) => c.invites.some((i) => same(i.to, me.name) && now - i.at < INVITE_MS))) return { ok: true };
  if (rnd() * DEED_CHANCE >= 1) return { ok: true };
  for (const c of s.cults) c.invites = c.invites.filter((i) => now - i.at < INVITE_MS);
  const open = s.cults.filter((c) => hasRoom(c) && (me.side === 'monster' ? c.race === me.race : true));
  if (!open.length) return { ok: true };
  open[Math.floor(rnd() * open.length)].invites.push({ to: me.name, at: now });
  return { ok: true };
}
// The answer to the call: 'dark' joins the cult, 'light' joins the Order of the Dawn, 'none' walks
// away from both. Returns the reward to give: { pact: 'dark', coins } or { pact: 'holy', str }.
export function answer(s, me, choice, now = Date.now()) {
  const cult = s.cults.find((c) => c.invites.some((i) => same(i.to, me.name) && now - i.at < INVITE_MS));
  if (!cult) return { error: 'The voice is gone.' };
  cult.invites = cult.invites.filter((i) => !same(i.to, me.name));
  if (choice === 'dark') {
    if (cult.members.length >= capacity(cult)) { s.choices[me.name.toLowerCase()] = 'silent'; return { error: 'The voice falls silent. The dark has no room for you.' }; }
    const coins = JOIN_COINS(me.level);
    cult.members.push({ name: me.name, rank: INITIATE, joined: now, gained: coins, favour: 0, level: me.level });
    s.choices[me.name.toLowerCase()] = 'joined';
    return { ok: true, reward: { pact: 'dark', coins } };
  }
  if (choice === 'light') {
    s.order.push({ name: me.name, joined: now, gained: 0 });
    s.choices[me.name.toLowerCase()] = 'order';
    return { ok: true, reward: { pact: 'holy', str: HOLY_STR } };
  }
  s.choices[me.name.toLowerCase()] = 'silent';
  return { ok: true, reward: null };
}

// Giving the cult away: the member is thrown out and loses every coin the cult gave them
export function strip(s, name, now = Date.now()) {
  const cult = cultOf(s, name);
  const m = memberOf(cult, name);
  if (!m) return null;
  cult.members = cult.members.filter((x) => x !== m);
  cult.missions = cult.missions.filter((x) => !same(x.to, name));
  s.stripped.push({ name: m.name, coins: m.gained, at: now, cult: cult.name });
  // a cult whose leader is gone passes to the highest-ranked member left (or ends)
  if (m.rank === 0) {
    const next = [...cult.members].sort((a, b) => a.rank - b.rank || a.joined - b.joined)[0];
    if (next) next.rank = 0; else s.cults = s.cults.filter((c) => c !== cult);
  }
  return { coins: m.gained, cult: cult.name };
}
// Does this chat message give the cult away? (its name, or the word "cult")
export const givesAway = (cult, text) => !!cult && (/\bcults?\b/i.test(text) || String(text).toLowerCase().includes(cult.name.toLowerCase()));
// Anyone who has had the call (whatever they answered) can't speak of it: the words that would
// give it away are blotted out of their chat
const SECRET = [/\bcults?\b/gi, /\bcultists?\b/gi, /\bdark\s+side\b/gi, /\bbecome\s+light\b/gi, /\border\s+of\s+the\s+dawn\b/gi, /\bthe\s+order\b/gi, /\bhooded\s+(figure|voice|stranger)\b/gi, /\bthe\s+call\b/gi];
const blot = (w) => w.replace(/[^\s]/g, '#');
export function censor(s, name, text) {
  if (!choiceOf(s, name) && !cultOf(s, name) && !inOrder(s, name)) return text;
  let out = String(text);
  for (const re of SECRET) out = out.replace(re, blot);
  for (const c of s.cults) {
    const esc = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(esc, 'gi'), blot);
  }
  return out;
}

// ---------- missions ----------
function newMission(s, side, level, from, to, pick) {
  const list = MISSIONS[side];
  const t = list[pick ?? Math.floor(Math.random() * list.length)] || list[0];
  return { id: s.next++, side, kind: t.kind, need: t.need, text: t.text, reward: missionReward(level, t.need), to, from, at: Date.now(), done: false };
}
// Ask for a mission of your own (one at a time)
export function askMission(s, me) {
  const cult = cultOf(s, me.name);
  const side = cult ? 'cult' : inOrder(s, me.name) ? 'order' : null;
  if (!side) return { error: 'You serve neither a cult nor the Order.' };
  const holder = cult || s;
  holder.missions ||= [];
  if (holder.missions.some((x) => same(x.to, me.name) && !x.done && x.from === 'self')) return { error: 'Finish the mission you have first.' };
  holder.missions.push(newMission(s, side, me.level, 'self', me.name));
  return { ok: true };
}
// A higher rank hands a mission down to a lower rank (who sees only "from above")
// (`toLevel` is the receiver's level: the reward suits them, not the giver)
export function giveMission(s, me, toName, pick, toLevel = null) {
  const cult = cultOf(s, me.name);
  const m = memberOf(cult, me.name), t = memberOf(cult, toName);
  if (!m) return { error: 'You serve no cult.' };
  if (!t || t.rank <= m.rank) return { error: 'You can only give missions to those below you.' };
  if (cult.missions.filter((x) => same(x.to, t.name) && !x.done && x.from === 'above').length >= 2) return { error: 'They already have two missions from above.' };
  cult.missions.push(newMission(s, 'cult', toLevel || me.level, 'above', t.name, pick));
  return { ok: true };
}
// A mission is done: its reward, and favour (which raises a cult member's rank)
export function finishMission(s, me, id) {
  const cult = cultOf(s, me.name);
  const list = cult ? cult.missions : (s.missions ||= []);
  const x = list.find((q) => q.id === id && same(q.to, me.name) && !q.done);
  if (!x) return { error: 'No such mission.' };
  x.done = true;
  const m = memberOf(cult, me.name) || s.order.find((o) => same(o.name, me.name));
  if (m) m.gained = (m.gained || 0) + x.reward;
  if (cult && m) {
    m.favour = (m.favour || 0) + (x.from === 'above' ? 2 : 1);
    while (m.rank > 1 && m.favour >= PROMOTE_AT[m.rank - 1]) m.rank -= 1;
  }
  // old finished missions are forgotten
  const keep = (arr) => arr.filter((q) => !q.done || Date.now() - q.at < 3 * 24 * 3600 * 1000);
  if (cult) cult.missions = keep(cult.missions); else s.missions = keep(s.missions);
  return { ok: true, coins: x.reward };
}

// ---------- what each player may see ----------
// Your own view: your cult (members of your rank and below only), your missions, any invite, the Order
export function view(s, me, now = Date.now()) {
  const cult = cultOf(s, me.name);
  const m = memberOf(cult, me.name);
  const invited = s.cults.some((c) => c.invites.some((i) => same(i.to, me.name) && now - i.at < INVITE_MS));
  const order = inOrder(s, me.name);
  const raceCult = s.cults.find((c) => c.race === me.race);
  const stripped = s.stripped.filter((x) => same(x.name, me.name));
  const mine = (list) => (list || []).filter((x) => same(x.to, me.name) && !x.done).map(({ id, kind, need, text, reward, from }) => ({ id, kind, need, text, reward, from }));
  return {
    cult: m ? {
      name: cult.name, race: cult.race, rank: m.rank, rankName: CULT_RANKS[m.rank], favour: m.favour || 0, gained: m.gained || 0,
      // only your own rank and below
      members: cult.members.filter((x) => x.rank >= m.rank).map((x) => ({ name: x.name, rank: x.rank, rankName: CULT_RANKS[x.rank] })),
      missions: mine(cult.missions),
    } : null,
    order: order ? { name: ORDER_NAME, members: s.order.length, missions: mine(s.missions) } : null,
    invited,
    // whether you have had the call (the Cult / Order window shows only to those who have)
    called: !!choiceOf(s, me.name) || !!m || order,
    choice: choiceOf(s, me.name),
    // whether this monster could found their race's cult
    canFound: !m && !order && me.side === 'monster' && me.level >= CULT_FOUND_LEVEL && !raceCult,
    stripped: stripped.length ? stripped : null,
  };
}
// What a viewer may learn about another player's cult place: only a member of the same cult, of the
// same rank or higher, ever sees it
export function seenBy(s, viewer, target) {
  const cult = cultOf(s, target);
  if (!cult) return null;
  const v = memberOf(cult, viewer), t = memberOf(cult, target);
  if (!v || v.rank > t.rank) return null;
  return { name: cult.name, rank: t.rank, rankName: CULT_RANKS[t.rank] };
}
// The game has taken the coins back from a stripped member: forget the record
export function ackStrip(s, name) { s.stripped = s.stripped.filter((x) => !same(x.name, name)); return { ok: true }; }

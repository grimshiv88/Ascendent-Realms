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
// Being asked to join is a choice with a reward either way: join, and you get dark powers and money;
// refuse, and you get holy powers and strength, and the Order of the Dawn (which works against the
// cults) will take you. Neither side is ever given a mission that names a player, or says who is on
// the other side.
//
// State: { cults: [{ race, name, founded, members: [{ name, rank, joined, gained, favour }],
//   invites: [{ to, at }], missions: [...] }], order: [{ name, joined }], choices: { name: 'joined'|'refused' },
//   stripped: [{ name, coins, at }], next }
import { cleanText } from './social.mjs';

export const CULT_FOUND_LEVEL = 200;
export const CULT_RANKS = ['Cult Leader', 'High Priest', 'Zealot', 'Acolyte', 'Initiate'];
export const INITIATE = CULT_RANKS.length - 1;
export const RECRUIT_RANK = 3;               // Acolytes and above may bring in new members
export const PROMOTE_AT = [Infinity, 15, 8, 3, 0]; // favour that lifts a member to each rank
export const ORDER_NAME = 'Order of the Dawn';
export const INVITE_MS = 3 * 24 * 3600 * 1000;
export const JOIN_COINS = (level) => 1000 + level * 5; // the cult's welcome purse
export const HOLY_STR = 5;                    // Strength the refusal grants, for good
export const PACT_PCT = 15;                   // dark: +ATK; holy: +DEF (as a lasting boost)

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
  const cult = { id: s.next++, race: me.race, name: check.name, founded: now, members: [{ name: me.name, rank: 0, joined: now, gained: 0, favour: 0 }], invites: [], missions: [] };
  s.cults.push(cult);
  s.choices[me.name.toLowerCase()] = 'joined';
  return { ok: true };
}
// A member of Acolyte rank or higher asks a monster of their race to join. The one asked never
// learns who asked.
export function invite(s, me, target) {
  const cult = cultOf(s, me);
  const m = memberOf(cult, me);
  if (!m) return { error: 'You serve no cult.' };
  if (m.rank > RECRUIT_RANK) return { error: 'Initiates cannot bring in new members yet.' };
  if (!target) return { error: 'There is no one by that name.' };
  if (target.side !== 'monster' || target.race !== cult.race) return { error: 'Only monsters of your own race can be asked.' };
  if (cultOf(s, target.name) || inOrder(s, target.name) || choiceOf(s, target.name)) return { error: 'They cannot be asked.' };
  if (cult.invites.some((i) => same(i.to, target.name))) return { error: 'They have already been asked.' };
  cult.invites.push({ to: target.name, at: Date.now() });
  return { ok: true };
}
// The one asked answers. Returns the reward to give: { pact: 'dark', coins } or { pact: 'holy', str }.
export function answer(s, me, accept, now = Date.now()) {
  const cult = s.cults.find((c) => c.invites.some((i) => same(i.to, me.name) && now - i.at < INVITE_MS));
  if (!cult) return { error: 'Nobody has asked you anything.' };
  cult.invites = cult.invites.filter((i) => !same(i.to, me.name));
  if (accept) {
    const coins = JOIN_COINS(me.level);
    cult.members.push({ name: me.name, rank: INITIATE, joined: now, gained: coins, favour: 0 });
    s.choices[me.name.toLowerCase()] = 'joined';
    return { ok: true, reward: { pact: 'dark', coins } };
  }
  s.choices[me.name.toLowerCase()] = 'refused';
  return { ok: true, reward: { pact: 'holy', str: HOLY_STR } };
}
// The Order of the Dawn takes any player, and any monster who refused a cult
export function joinOrder(s, me, now = Date.now()) {
  if (cultOf(s, me.name)) return { error: 'The Order will not take you.' };
  if (inOrder(s, me.name)) return { error: 'You already serve the Order.' };
  if (me.side === 'monster' && choiceOf(s, me.name) !== 'refused') return { error: 'The Order takes only monsters who have refused the cults.' };
  s.order.push({ name: me.name, joined: now, gained: 0 });
  // a player who joins the Order gets its blessing (a monster already had it from refusing)
  const fresh = !choiceOf(s, me.name);
  if (fresh) s.choices[me.name.toLowerCase()] = 'order';
  return { ok: true, reward: fresh ? { pact: 'holy', str: HOLY_STR } : null };
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

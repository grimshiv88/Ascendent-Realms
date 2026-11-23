// Parties and guilds, shared by the game and the server so both follow the same rules.
// A party is a small group for adventuring together, led by the player who started it.
// A guild is a lasting company of players, founded at the Main Guild Hall for a fee and run by its
// Guild Master. Each has its own private chat. Everything here works on a plain state object
// { parties, guilds, invites, next } and changes it in place.
import { cleanText } from './social.mjs';
import { COUNTRY_PLOTS } from './building.mjs';

export const PARTY_MAX = 5;
export const GUILD_MAX = 30;
export const GUILD_FEE = 1000;
export const GUILD_LEVEL = 20;
export const INVITE_MS = 24 * 3600 * 1000; // invites expire after a day

export const emptyGroups = () => ({ parties: [], guilds: [], invites: [], nations: [], next: 1 });
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const has = (list, name) => list.some((m) => same(m, name));
export const partyOf = (s, name) => s.parties.find((p) => has(p.members, name)) || null;
export const guildOf = (s, name) => s.guilds.find((g) => has(g.members, name)) || null;

// A guild's (or nation's) name: 3 to 24 letters, numbers and spaces, no bad words, not taken
export function checkGuildName(s, raw, list = s.guilds, what = 'guild') {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 24) return { error: `A ${what} name is 3 to 24 letters long.` };
  if (!/^[A-Za-z0-9 ']+$/.test(name)) return { error: 'Use only letters, numbers and spaces in the name.' };
  if (cleanText(name) !== name) return { error: 'Choose a cleaner name.' };
  if (list.some((g) => same(g.name, name))) return { error: `There is already a ${what} with that name.` };
  return { name };
}

function tidy(s, now) {
  s.invites = s.invites.filter((i) => now - i.at < INVITE_MS && (i.kind === 'party' ? s.parties.some((p) => p.id === i.group) : s.guilds.some((g) => g.id === i.group)));
  s.parties = s.parties.filter((p) => p.members.length > 1 || s.invites.some((i) => i.kind === 'party' && i.group === p.id));
}

// Found a guild (the fee is taken by the caller once this succeeds)
// A monster's guild is a Dark Guild: it takes only monsters, as a player's guild takes only players
export function found(s, me, rawName, level, now = Date.now(), { dark = false } = {}) {
  if (guildOf(s, me)) return { error: 'Leave your guild before founding another.' };
  if (level < GUILD_LEVEL) return { error: `You must be level ${GUILD_LEVEL} to found a guild.` };
  const check = checkGuildName(s, rawName);
  if (check.error) return check;
  const g = { id: s.next++, name: check.name, master: me, members: [me], created: now, ...(dark ? { dark: true } : {}) };
  s.guilds.push(g);
  return { ok: true, guild: g };
}

// ---------- nations ----------
// A player whose land holds 100 or more plots, all joined up, can found a nation and name it,
// becoming its Emperor. `territory` is the size of their biggest joined-up piece of land.
export const nationOf = (s, name) => (s.nations || []).find((n) => same(n.emperor, name)) || null;
export function foundNation(s, me, rawName, territory, now = Date.now()) {
  s.nations ||= [];
  if (nationOf(s, me)) return { error: 'You already rule a nation.' };
  if (territory < COUNTRY_PLOTS) return { error: `A nation needs ${COUNTRY_PLOTS} plots of land, all joined up. Your biggest joined-up land is ${territory} plots.` };
  const check = checkGuildName(s, rawName, s.nations, 'nation');
  if (check.error) return check;
  const n = { id: s.next++, name: check.name, emperor: me, created: now };
  s.nations.push(n);
  return { ok: true, nation: n };
}
// rename your nation
export function renameNation(s, me, rawName) {
  const n = nationOf(s, me);
  if (!n) return { error: 'You do not rule a nation.' };
  const check = checkGuildName(s, rawName, s.nations.filter((x) => x !== n), 'nation');
  if (check.error) return check;
  n.name = check.name;
  return { ok: true };
}

// Invite a player (`to` is their exact username, already looked up) to your party or guild
// `toMonster` says whether the one invited is a monster (a Dark Guild takes only monsters)
export function invite(s, me, kind, to, now = Date.now(), toMonster = null) {
  tidy(s, now);
  if (!to) return { error: 'There is no player with that username.' };
  if (same(me, to)) return { error: "You can't invite yourself." };
  let group;
  if (kind === 'party') {
    group = partyOf(s, me);
    if (group && !same(group.leader, me)) return { error: 'Only the party leader can invite.' };
    if (partyOf(s, to)) return { error: `${to} is already in a party.` };
    if (group && group.members.length >= PARTY_MAX) return { error: `A party holds up to ${PARTY_MAX} players.` };
    if (!group) { group = { id: s.next++, leader: me, members: [me] }; s.parties.push(group); }
  } else if (kind === 'guild') {
    group = guildOf(s, me);
    if (!group) return { error: 'You are not in a guild.' };
    if (!same(group.master, me)) return { error: 'Only the Guild Master can invite.' };
    if (guildOf(s, to)) return { error: `${to} is already in a guild.` };
    if (toMonster !== null && !!group.dark !== !!toMonster) return { error: group.dark ? 'A Dark Guild takes only monsters.' : 'Monsters can only join a Dark Guild.' };
    if (group.members.length >= GUILD_MAX) return { error: `A guild holds up to ${GUILD_MAX} players.` };
  } else return { error: 'Invite to what?' };
  if (s.invites.some((i) => i.kind === kind && i.group === group.id && same(i.to, to))) return { error: `You already invited ${to}.` };
  s.invites.push({ id: s.next++, kind, group: group.id, from: me, to, at: now });
  return { ok: true };
}

export function respond(s, me, id, accept, now = Date.now()) {
  tidy(s, now);
  const inv = s.invites.find((i) => i.id === Number(id) && same(i.to, me));
  if (!inv) return { error: 'That invite has gone.' };
  s.invites = s.invites.filter((i) => i !== inv);
  if (!accept) { tidy(s, now); return { ok: true }; }
  if (inv.kind === 'party') {
    if (partyOf(s, me)) return { error: 'Leave your party first.' };
    const p = s.parties.find((x) => x.id === inv.group);
    if (!p) return { error: 'That party has broken up.' };
    if (p.members.length >= PARTY_MAX) return { error: 'That party is full.' };
    p.members.push(me);
  } else {
    if (guildOf(s, me)) return { error: 'Leave your guild first.' };
    const g = s.guilds.find((x) => x.id === inv.group);
    if (!g) return { error: 'That guild is gone.' };
    if (g.members.length >= GUILD_MAX) return { error: 'That guild is full.' };
    g.members.push(me);
  }
  return { ok: true };
}

export function leave(s, me, kind, now = Date.now()) {
  if (kind === 'party') {
    const p = partyOf(s, me);
    if (!p) return { error: 'You are not in a party.' };
    p.members = p.members.filter((m) => !same(m, me));
    if (same(p.leader, me)) p.leader = p.members[0] || null;
    if (p.members.length <= 1) { s.parties = s.parties.filter((x) => x !== p); s.invites = s.invites.filter((i) => !(i.kind === 'party' && i.group === p.id)); }
  } else {
    const g = guildOf(s, me);
    if (!g) return { error: 'You are not in a guild.' };
    if (same(g.master, me) && g.members.length > 1) return { error: 'Make someone else Guild Master first, or disband the guild.' };
    g.members = g.members.filter((m) => !same(m, me));
    if (!g.members.length) s.guilds = s.guilds.filter((x) => x !== g);
  }
  tidy(s, now);
  return { ok: true };
}

// The leader (or Guild Master) removes someone, hands over the lead, or (guilds) disbands
export function manage(s, me, kind, action, name, now = Date.now()) {
  const group = kind === 'party' ? partyOf(s, me) : guildOf(s, me);
  if (!group) return { error: `You are not in a ${kind}.` };
  const boss = kind === 'party' ? group.leader : group.master;
  if (!same(boss, me)) return { error: kind === 'party' ? 'Only the party leader can do that.' : 'Only the Guild Master can do that.' };
  if (action === 'disband') {
    if (kind === 'party') s.parties = s.parties.filter((x) => x !== group);
    else s.guilds = s.guilds.filter((x) => x !== group);
    s.invites = s.invites.filter((i) => !(i.kind === kind && i.group === group.id));
    return { ok: true };
  }
  const who = group.members.find((m) => same(m, name));
  if (!who || same(who, me)) return { error: 'Choose another member.' };
  if (action === 'remove') group.members = group.members.filter((m) => m !== who);
  else if (action === 'lead') { if (kind === 'party') group.leader = who; else group.master = who; }
  else return { error: 'Do what?' };
  if (kind === 'party' && group.members.length <= 1) s.parties = s.parties.filter((x) => x !== group);
  tidy(s, now);
  return { ok: true };
}

// What one player sees. `info(name)` adds { level, cls } for each member when it can.
export function view(s, me, info = () => null, now = Date.now()) {
  tidy(s, now);
  const p = partyOf(s, me), g = guildOf(s, me);
  const people = (list) => list.map((name) => ({ name, ...(info(name) || {}) }));
  const label = (i) => (i.kind === 'party' ? `${i.from}'s party` : s.guilds.find((x) => x.id === i.group)?.name || 'a guild');
  return {
    party: p ? { leader: p.leader, members: people(p.members), mine: same(p.leader, me), pending: s.invites.filter((i) => i.kind === 'party' && i.group === p.id).map((i) => i.to) } : null,
    guild: g ? { name: g.name, dark: !!g.dark, master: g.master, members: people(g.members), mine: same(g.master, me), pending: s.invites.filter((i) => i.kind === 'guild' && i.group === g.id).map((i) => i.to) } : null,
    invites: s.invites.filter((i) => same(i.to, me)).map((i) => ({ id: i.id, kind: i.kind, from: i.from, label: label(i) })),
    nation: nationOf(s, me) ? { name: nationOf(s, me).name } : null,
  };
}
// the private chats a player is in
export function groupChannels(s, me) {
  const out = [];
  const p = partyOf(s, me), g = guildOf(s, me);
  if (p) out.push({ channel: `party:${p.id}`, label: 'Party' });
  if (g) out.push({ channel: `guild:${g.id}`, label: `Guild: ${g.name}` });
  return out;
}
export const emperorTitle = (s, name) => { const n = nationOf(s, name); return n ? `Emperor of ${n.name}` : null; };
// is this player a Guild Master (for the castle)?
export const isGuildMaster = (s, name) => s.guilds.some((g) => same(g.master, name));

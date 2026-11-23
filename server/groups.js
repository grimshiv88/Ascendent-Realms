// Parties and guilds (rules in data/groups.mjs). The whole state is small, so it is kept as one
// JSON value and changed one request at a time.
const db = require('./db');
const { moneyWords } = require('../public/js/data/money.mjs');
const characters = require('./characters');
const G = require('../public/js/data/groups.mjs');
const { RACES } = require('../public/js/data/game-data.mjs');
const isMonster = async (id) => { const c = id && await characters.load(id); return c ? RACES[c.race]?.side === 'monster' : null; };
const { largestTerritory } = require('../public/js/data/building.mjs');
const territory = async (id) => largestTerritory(await db.all('SELECT ix, iz FROM lands WHERE account_id = ?', id));

const load = async () => { const r = await db.get("SELECT data FROM world_state WHERE key = 'groups'"); return r ? JSON.parse(r.data) : G.emptyGroups(); };
const save = (s) => db.run("INSERT INTO world_state (key, data) VALUES ('groups', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", JSON.stringify(s));

const account = (id) => db.get('SELECT id, username FROM accounts WHERE id = ?', id);
const byName = (name) => db.get('SELECT id, username FROM accounts WHERE lower(username) = lower(?)', String(name || '').trim());
// G.view asks about members as it goes: a first pass notes who it asks about, then they are looked up
async function infoFor(s, me) {
  const names = new Set();
  G.view(structuredClone(s), me, (n) => { names.add(String(n)); return null; });
  const out = new Map();
  for (const n of names) {
    const a = await byName(n);
    const c = a && await characters.load(a.id);
    out.set(n.toLowerCase(), c ? { level: c.level, cls: c.cls } : null);
  }
  return (name) => out.get(String(name || '').toLowerCase()) ?? null;
}
const view = async (s, me) => { const name = (await account(me)).username; return G.view(s, name, await infoFor(s, name)); };

async function list(me) { return { ...(await view(await load(), me)), territory: await territory(me) }; }
// body: { action: 'invite'|'respond'|'leave'|'remove'|'lead'|'disband'|'found', kind, name, id, accept }
async function act(me, body = {}) {
  const s = await load();
  const name = (await account(me))?.username;
  if (!name) return { error: 'Please sign in again.' };
  const kind = body.kind === 'guild' ? 'guild' : 'party';
  let r;
  let coins;
  switch (body.action) {
    case 'invite': { const t = await byName(body.name); r = G.invite(s, name, kind, t?.username || null, Date.now(), t ? await isMonster(t.id) : null); break; }
    case 'respond': r = G.respond(s, name, body.id, body.accept === true); break;
    case 'leave': r = G.leave(s, name, kind); break;
    case 'remove': case 'lead': case 'disband': r = G.manage(s, name, kind, body.action, body.name); break;
    case 'nation': r = G.foundNation(s, name, body.name, await territory(me)); break;
    case 'rename-nation': r = G.renameNation(s, name, body.name); break;
    case 'found': {
      const c = await characters.load(me);
      if (!c) return { error: 'No character yet.' };
      if (c.coins < G.GUILD_FEE) return { error: `You need ${moneyWords(G.GUILD_FEE)} to found a guild.`, need: G.GUILD_FEE };
      r = G.found(s, name, body.name, c.level || 1, Date.now(), { dark: RACES[c.race]?.side === 'monster' });
      if (r.ok) { c.coins -= G.GUILD_FEE; await characters.store(me, c); coins = c.coins; }
      break;
    }
    default: return { error: 'Do what?' };
  }
  if (r.error) return r;
  await save(s);
  return { ok: true, ...(coins !== undefined ? { coins } : {}), ...(await view(s, me)), territory: await territory(me) };
}
const channels = async (me) => G.groupChannels(await load(), (await account(me))?.username || '');
const guildMaster = async (name) => G.isGuildMaster(await load(), name);
const emperorTitle = async (name) => G.emperorTitle(await load(), name);

module.exports = { list, act, channels, guildMaster, emperorTitle, load };

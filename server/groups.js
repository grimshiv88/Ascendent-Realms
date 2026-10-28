// Parties and guilds (rules in data/groups.mjs). The whole state is small, so it is kept as one
// JSON value and changed one request at a time.
const db = require('./db');
const characters = require('./characters');
const G = require('../public/js/data/groups.mjs');
const { largestTerritory } = require('../public/js/data/building.mjs');
const territory = (id) => largestTerritory(db.prepare('SELECT ix, iz FROM lands WHERE account_id = ?').all(id));

db.exec('CREATE TABLE IF NOT EXISTS world_state (key TEXT PRIMARY KEY, data TEXT NOT NULL)');
const load = () => { const r = db.prepare("SELECT data FROM world_state WHERE key = 'groups'").get(); return r ? JSON.parse(r.data) : G.emptyGroups(); };
const save = (s) => db.prepare("INSERT INTO world_state (key, data) VALUES ('groups', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data").run(JSON.stringify(s));

const account = (id) => db.prepare('SELECT id, username FROM accounts WHERE id = ?').get(id);
const byName = (name) => db.prepare('SELECT id, username FROM accounts WHERE username = ? COLLATE NOCASE').get(String(name || '').trim());
function info(name) {
  const a = byName(name);
  const c = a && characters.load(a.id);
  return c ? { level: c.level, cls: c.cls } : null;
}
const view = (s, me) => G.view(s, account(me).username, info);

function list(me) { return { ...view(load(), me), territory: territory(me) }; }
// body: { action: 'invite'|'respond'|'leave'|'remove'|'lead'|'disband'|'found', kind, name, id, accept }
function act(me, body = {}) {
  const s = load();
  const name = account(me)?.username;
  if (!name) return { error: 'Please sign in again.' };
  const kind = body.kind === 'guild' ? 'guild' : 'party';
  let r;
  let coins;
  switch (body.action) {
    case 'invite': r = G.invite(s, name, kind, byName(body.name)?.username || null); break;
    case 'respond': r = G.respond(s, name, body.id, body.accept === true); break;
    case 'leave': r = G.leave(s, name, kind); break;
    case 'remove': case 'lead': case 'disband': r = G.manage(s, name, kind, body.action, body.name); break;
    case 'nation': r = G.foundNation(s, name, body.name, territory(me)); break;
    case 'rename-nation': r = G.renameNation(s, name, body.name); break;
    case 'found': {
      const c = characters.load(me);
      if (!c) return { error: 'No character yet.' };
      if (c.coins < G.GUILD_FEE) return { error: `Founding a guild costs ${G.GUILD_FEE} coins.` };
      r = G.found(s, name, body.name, c.level || 1);
      if (r.ok) { c.coins -= G.GUILD_FEE; characters.store(me, c); coins = c.coins; }
      break;
    }
    default: return { error: 'Do what?' };
  }
  if (r.error) return r;
  save(s);
  return { ok: true, ...(coins !== undefined ? { coins } : {}), ...view(s, me), territory: territory(me) };
}
const channels = (me) => G.groupChannels(load(), account(me)?.username || '');
const guildMaster = (name) => G.isGuildMaster(load(), name);
const emperorTitle = (name) => G.emperorTitle(load(), name);

module.exports = { list, act, channels, guildMaster, emperorTitle, load };

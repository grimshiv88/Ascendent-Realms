// Ascendant Realms game server: serves the game page and the account API.
const path = require('node:path');
const express = require('express');
const auth = require('./auth');
const characters = require('./characters');
const land = require('./land');
const kings = require('./kings');
const cults = require('./cults');
const admin = require('./admin');
const social = require('./social');
const rooms = require('./rooms');
const bounties = require('./bounties');
const groups = require('./groups');
const db = require('./db');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const bearer = (req) => (req.get('authorization') || '').replace(/^Bearer\s+/i, '');

app.get('/api/health', (req, res) => res.json({ ok: true, now: Date.now() }));

app.post('/api/signup', (req, res) => {
  const result = auth.signUp(req.body || {});
  res.status(result.error ? 400 : 201).json(result);
});

app.post('/api/signin', (req, res) => {
  const result = auth.signIn(req.body || {});
  res.status(result.error ? 401 : 200).json(result);
});

app.get('/api/me', (req, res) => {
  const account = auth.accountFromToken(bearer(req));
  if (!account) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ account });
});

// Requests below need a signed-in account
function requireAccount(req, res, next) {
  req.account = auth.accountRow(bearer(req));
  if (!req.account) return res.status(401).json({ error: 'Not signed in.' });
  next();
}

app.post('/api/character', requireAccount, (req, res) => {
  const result = characters.create(req.account.id, req.account.username, req.body || {});
  res.status(result.error ? 400 : 201).json(result);
});

// The bridges over the city moats (raised in war or when monsters attack; the admins set them)
const cityGates = () => { const r = db.prepare("SELECT data FROM world_state WHERE key = 'city_gates'").get(); return r ? JSON.parse(r.data) : {}; };
app.get('/api/cities', (req, res) => res.json({ raised: cityGates() }));

app.post('/api/character/ceremony', requireAccount, (req, res) => {
  const result = characters.ceremony(req.account.id);
  res.status(result.error ? 400 : 200).json(result);
});

app.post('/api/character/fall', requireAccount, (req, res) => {
  cults.forget(req.account.id);
  const result = characters.fall(req.account.id);
  res.status(result.error ? 400 : 200).json(result);
});

app.post('/api/character/location', requireAccount, (req, res) => {
  const result = characters.saveLocation(req.account.id, req.body || {});
  res.status(result.error ? 400 : 200).json(result);
});

app.post('/api/character/progress', requireAccount, (req, res) => {
  const result = characters.saveProgress(req.account.id, req.body || {});
  res.status(result.error ? 400 : 200).json(result);
});

// Land: everyone's plots, buying one, choosing its purpose, and clearing it
app.post('/api/password', requireAccount, (req, res) => {
  const result = auth.changePassword(req.account.id, req.body?.password, bearer(req));
  res.status(result.error ? 400 : 200).json(result);
});
app.get('/api/top', (req, res) => res.json({ players: characters.top() }));

app.get('/api/land', requireAccount, (req, res) => res.json(land.list(req.account.id)));
for (const [route, fn] of [['buy', land.buy], ['purpose', land.setPurpose], ['prepare', land.prepare], ['build', land.build]]) {
  app.post(`/api/land/${route}`, requireAccount, (req, res) => {
    const result = fn(req.account.id, req.body || {});
    res.status(result.error ? 400 : 200).json(result);
  });
}

app.get('/api/kings', requireAccount, (req, res) => res.json(kings.list()));
app.post('/api/kings/slain', requireAccount, (req, res) => {
  const result = kings.slain(req.account.id, req.body || {});
  res.status(result.error ? 400 : 200).json(result);
});
// cults and the Order of the Dawn
app.get('/api/cults', requireAccount, (req, res) => { const r = cults.list(req.account.id); res.status(r.error ? 400 : 200).json(r); });
app.post('/api/cults', requireAccount, (req, res) => { const r = cults.act(req.account.id, req.body || {}); res.status(r.error ? 400 : 200).json(r); });
// an Overlord as strong as the King challenges them; the King answers
for (const [route, fn] of [['challenge', kings.challenge], ['answer', kings.answer]]) {
  app.post(`/api/kings/${route}`, requireAccount, (req, res) => {
    const result = fn(req.account.id, req.body || {});
    res.status(result.error ? 400 : 200).json(result);
  });
}
app.get('/api/groups', requireAccount, (req, res) => res.json(groups.list(req.account.id)));
app.post('/api/groups', requireAccount, (req, res) => {
  const r = groups.act(req.account.id, req.body || {});
  res.status(r.error ? 400 : 200).json(r);
});
// The Bounty Board in the Guild Hall
app.get('/api/bounties', requireAccount, (req, res) => res.json(bounties.list(req.account.id)));
app.post('/api/bounties', requireAccount, (req, res) => {
  const r = bounties.place(req.account.id, req.body || {});
  res.status(r.error ? 400 : 200).json(r);
});
app.get('/api/rooms', requireAccount, (req, res) => res.json(rooms.list(req.account.id)));
app.post('/api/rooms/rent', requireAccount, (req, res) => {
  const r = rooms.rent(req.account.id, req.body || {});
  res.status(r.error ? 400 : 200).json(r);
});
app.post('/api/rooms/guests', requireAccount, (req, res) => {
  const r = rooms.setGuests(req.account.id, req.body || {});
  res.status(r.error ? 400 : 200).json(r);
});
app.get('/api/caves', requireAccount, (req, res) => res.json(land.caves(req.account.id)));
app.post('/api/caves/buy', requireAccount, (req, res) => {
  const result = land.buyCave(req.account.id, req.body || {});
  res.status(result.error ? 400 : 200).json(result);
});

// Friends, chat and Status privacy
app.get('/api/players', requireAccount, (req, res) => res.json(social.search(req.account.id, req.query.q)));
app.get('/api/appraise/:name', requireAccount, (req, res) => {
  const result = social.appraise(req.account.id, req.params.name);
  res.status(result.error ? 400 : 200).json(result);
});
app.get('/api/players/:name', requireAccount, (req, res) => {
  const result = social.profile(req.account.id, req.params.name);
  res.status(result.error ? 404 : 200).json(result);
});
app.get('/api/social', requireAccount, (req, res) => res.json(social.poll(req.account.id, req.query.after)));
for (const [route, fn] of [['friends/request', social.request], ['friends/respond', social.respond], ['friends/remove', social.remove], ['chat', social.send], ['privacy', social.setPrivacy]]) {
  app.post(`/api/${route}`, requireAccount, (req, res) => {
    const result = fn(req.account.id, req.body || {});
    res.status(result.error ? 400 : 200).json(result);
  });
}

// The admin board (admin.html): only for accounts listed in ADMIN_EMAILS
function requireAdmin(req, res, next) {
  req.account = auth.accountRow(bearer(req));
  if (!req.account) return res.status(401).json({ error: 'Please sign in.' });
  if (!admin.isAdmin(req.account)) return res.status(403).json({ error: 'This account is not an admin.' });
  next();
}
app.get('/api/admin/accounts', requireAdmin, (req, res) => res.json(admin.accounts()));
app.post('/api/admin/gates', requireAdmin, (req, res) => {
  const { city, raised } = req.body || {};
  if (!['central', 'emberfall', 'ashgrave', 'lumenhollow', 'mirehaven'].includes(city)) return res.status(400).json({ error: 'No such city.' });
  const all = cityGates();
  if (raised) all[city] = true; else delete all[city];
  db.prepare("INSERT INTO world_state (key, data) VALUES ('city_gates', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data").run(JSON.stringify(all));
  res.json({ ok: true, raised: all });
});
for (const [route, fn] of [['password', admin.setPassword], ['signout', admin.signOutEverywhere], ['delete', admin.remove]]) {
  app.post(`/api/admin/${route}`, requireAdmin, (req, res) => {
    const result = fn(req.body || {}, req.account);
    res.status(result.error ? 400 : 200).json(result);
  });
}

app.post('/api/signout', (req, res) => {
  auth.signOut(bearer(req));
  res.json({ ok: true });
});

const port = Number(process.env.PORT) || 3000;
// Appraisal leaves a holder who has been away more than a month (checked hourly)
characters.keepAppraisalHeld();
setInterval(() => characters.keepAppraisalHeld(), 3600 * 1000).unref();

app.listen(port, () => console.log(`Ascendant Realms running at http://localhost:${port}`));

// Ascendant Realms game server: serves the game page and the account API.
const path = require('node:path');
const express = require('express');
const auth = require('./auth');
const characters = require('./characters');
const land = require('./land');
const admin = require('./admin');

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

app.get('/api/caves', requireAccount, (req, res) => res.json(land.caves(req.account.id)));
app.post('/api/caves/buy', requireAccount, (req, res) => {
  const result = land.buyCave(req.account.id, req.body || {});
  res.status(result.error ? 400 : 200).json(result);
});

// The admin board (admin.html): only for accounts listed in ADMIN_EMAILS
function requireAdmin(req, res, next) {
  req.account = auth.accountRow(bearer(req));
  if (!req.account) return res.status(401).json({ error: 'Please sign in.' });
  if (!admin.isAdmin(req.account)) return res.status(403).json({ error: 'This account is not an admin.' });
  next();
}
app.get('/api/admin/accounts', requireAdmin, (req, res) => res.json(admin.accounts()));
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
app.listen(port, () => console.log(`Ascendant Realms running at http://localhost:${port}`));

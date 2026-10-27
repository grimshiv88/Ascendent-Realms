// Ascendent Realms game server: serves the game page and the account API.
const path = require('node:path');
const express = require('express');
const auth = require('./auth');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const bearer = (req) => (req.get('authorization') || '').replace(/^Bearer\s+/i, '');

app.get('/api/health', (req, res) => res.json({ ok: true }));

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

app.post('/api/signout', (req, res) => {
  auth.signOut(bearer(req));
  res.json({ ok: true });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Ascendent Realms running at http://localhost:${port}`));

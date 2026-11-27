// Ascendant Realms game server: serves the game page and the account API.
// The database is Postgres (Supabase online): see db.js and schema.js.
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
const mail = require('./mail');
const voice = require('./voice');
const economy = require('./economy');
const presence = require('./presence');
const arena = require('./arena');

const app = express();
// (a save can carry up to 80 planted beds, so 64 kB rather than 10)
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const bearer = (req) => (req.get('authorization') || '').replace(/^Bearer\s+/i, '');

// Every request below talks to the database, so it waits for it; a failure is answered with an error
// instead of leaving the game hanging. A failed request is reported in the server log only.
const ROUTE = ['get', 'post'];
for (const m of ROUTE) {
  const plain = app[m].bind(app);
  app[m] = (route, ...handlers) => plain(route, ...handlers.map((h) => (req, res, next) => {
    Promise.resolve(h(req, res, next)).catch((e) => {
      console.error(`${m.toUpperCase()} ${route}:`, e);
      if (!res.headersSent) res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
    });
  }));
}
// Appraisal leaves a holder who has been away more than a month (checked at most hourly)
let appraisalCheckedAt = 0;
function checkAppraisalNow() {
  if (Date.now() - appraisalCheckedAt < 3600 * 1000) return;
  appraisalCheckedAt = Date.now();
  characters.keepAppraisalHeld().catch((e) => console.error('appraisal check:', e));
}

app.get('/api/health', async (req, res) => res.json({ ok: true, now: Date.now(), mail: mail.ready(), voice: voice.ready(), live: !!presence.liveConfig() }));

app.post('/api/signup', async (req, res) => {
  const result = await auth.signUp(req.body || {});
  res.status(result.error ? 400 : 201).json(result);
});

app.post('/api/signin', async (req, res) => {
  const result = await auth.signIn(req.body || {});
  res.status(result.error ? 401 : 200).json(result);
});

// The second step of signing in (2-step sign-in), "Forgot password?" and the link in the email
const answer = (fn, bad = 400) => async (req, res) => {
  const result = await fn(req.body || {}, req.account);
  res.status(result.error ? bad : 200).json(result);
};
app.post('/api/signin/code', answer(auth.signInCode, 401));
app.post('/api/signin/by-email', answer(auth.signInByEmail));
app.post('/api/password/forgot', answer(auth.forgotPassword));
app.post('/api/password/reset', answer(auth.resetPassword));
app.post('/api/email/verify', async (req, res) => {
  const result = await auth.verifyEmail(req.body || {}, await auth.accountRow(bearer(req)));
  res.status(result.error ? 400 : 200).json(result);
});

app.get('/api/me', async (req, res) => {
  const account = await auth.accountFromToken(bearer(req));
  if (!account) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ account });
});

// Requests below need a signed-in account
// (an account that must still confirm its email may only use the account requests)
async function requireSession(req, res, next) {
  req.account = await auth.accountRow(bearer(req));
  if (!req.account) return res.status(401).json({ error: 'Not signed in.' });
  if (auth.banned(req.account)) return res.status(403).json({ error: auth.banned(req.account), banned: true });
  next();
}
async function requireAccount(req, res, next) {
  req.account = await auth.accountRow(bearer(req));
  if (!req.account) return res.status(401).json({ error: 'Not signed in.' });
  if (auth.banned(req.account)) return res.status(403).json({ error: auth.banned(req.account), banned: true });
  if (auth.mustVerify(req.account)) return res.status(403).json({ error: 'Please confirm your email first.', mustVerify: true });
  checkAppraisalNow();
  next();
}

// The account itself: its email, password and 2-step sign-in
app.post('/api/email/send', requireSession, async (req, res) => {
  const result = await auth.sendVerify(req.account);
  res.status(result.error ? 400 : 200).json(result);
});
app.post('/api/birthdate', requireSession, answer((body, acc) => auth.setBirthdate(acc, body)));
app.post('/api/keys', requireSession, answer((body, acc) => auth.setKeys(acc, body)));
app.post('/api/email/set', requireSession, answer((body, acc) => auth.setEmail(acc, body)));
app.post('/api/password', requireSession, async (req, res) => {
  const result = await auth.changePassword(req.account, req.body || {}, bearer(req));
  res.status(result.error ? 400 : 200).json(result);
});
app.post('/api/2fa/email', requireSession, answer((body, acc) => auth.twofaEmail(acc, body)));
app.post('/api/2fa/app/start', requireSession, answer((body, acc) => auth.twofaAppStart(acc, body)));
app.post('/api/2fa/app/confirm', requireSession, answer((body, acc) => auth.twofaAppConfirm(acc, body)));
app.post('/api/2fa/off', requireSession, answer((body, acc) => auth.twofaOff(acc, body)));

app.post('/api/character', requireAccount, async (req, res) => {
  const result = await characters.create(req.account.id, req.account.username, req.body || {});
  res.status(result.error ? 400 : 201).json(result);
});

// The bridges over the city moats (raised in war or when monsters attack; the admins set them)
const cityGates = async () => { const r = await db.get("SELECT data FROM world_state WHERE key = 'city_gates'"); return r ? JSON.parse(r.data) : {}; };
app.get('/api/cities', async (req, res) => res.json({ raised: await cityGates(), ceremonies: await characters.recentCeremonies() }));

app.post('/api/character/ceremony', requireAccount, async (req, res) => {
  const result = await characters.ceremony(req.account.id);
  res.status(result.error ? 400 : 200).json(result);
});

app.post('/api/character/fall', requireAccount, async (req, res) => {
  await cults.forget(req.account.id);
  const result = await characters.fall(req.account.id);
  if (result.ok) await economy.forget(req.account.id); // the derricks of a life that ended come down
  res.status(result.error ? 400 : 200).json(result);
});

app.post('/api/character/rankup', requireAccount, async (req, res) => {
  const r = await characters.rankUp(req.account.id);
  res.status(r.error ? 400 : 200).json(r);
});
app.post('/api/character/location', requireAccount, async (req, res) => {
  const result = await characters.saveLocation(req.account.id, req.body || {});
  res.status(result.reload ? 409 : result.error ? 400 : 200).json(result);
});

app.post('/api/character/progress', requireAccount, async (req, res) => {
  const result = await characters.saveProgress(req.account.id, req.body || {});
  res.status(result.reload ? 409 : result.error ? 400 : 200).json(result);
});

// Land: everyone's plots, buying one, choosing its purpose, and clearing it
app.get('/api/top', async (req, res) => res.json({ players: await characters.top() }));

app.get('/api/land', requireAccount, async (req, res) => res.json(await land.list(req.account.id)));
for (const [route, fn] of [['buy', land.buy], ['purpose', land.setPurpose], ['prepare', land.prepare], ['build', land.build], ['show', land.show]]) {
  app.post(`/api/land/${route}`, requireAccount, async (req, res) => {
    const result = await fn(req.account.id, req.body || {});
    res.status(result.error ? 400 : 200).json(result);
  });
}

app.get('/api/kings', requireAccount, async (req, res) => res.json(await kings.list()));
app.post('/api/kings/slain', requireAccount, async (req, res) => {
  const result = await kings.slain(req.account.id, req.body || {});
  res.status(result.error ? 400 : 200).json(result);
});
// cults and the Order of the Dawn
app.get('/api/cults', requireAccount, async (req, res) => { const r = await cults.list(req.account.id); res.status(r.error ? 400 : 200).json(r); });
app.post('/api/cults', requireAccount, async (req, res) => { const r = await cults.act(req.account.id, req.body || {}); res.status(r.error ? 400 : 200).json(r); });
// an Overlord as strong as the King challenges them; the King answers
for (const [route, fn] of [['challenge', kings.challenge], ['answer', kings.answer]]) {
  app.post(`/api/kings/${route}`, requireAccount, async (req, res) => {
    const result = await fn(req.account.id, req.body || {});
    res.status(result.error ? 400 : 200).json(result);
  });
}
// Marriage between players
const family = require('./family');
app.get('/api/family', requireAccount, async (req, res) => res.json(await family.list(req.account.id)));
app.post('/api/family', requireAccount, async (req, res) => { const r = await family.act(req.account.id, req.body || {}); res.status(r.error ? 400 : 200).json(r); });
app.get('/api/groups', requireAccount, async (req, res) => res.json(await groups.list(req.account.id)));
app.post('/api/groups', requireAccount, async (req, res) => {
  const r = await groups.act(req.account.id, req.body || {});
  res.status(r.error ? 400 : 200).json(r);
});
// The Bounty Board in the Guild Hall
app.get('/api/bounties', requireAccount, async (req, res) => res.json(await bounties.list(req.account.id)));
app.post('/api/bounties', requireAccount, async (req, res) => {
  const r = await bounties.place(req.account.id, req.body || {});
  res.status(r.error ? 400 : 200).json(r);
});
app.get('/api/rooms', requireAccount, async (req, res) => res.json(await rooms.list(req.account.id)));
app.post('/api/rooms/rent', requireAccount, async (req, res) => {
  const r = await rooms.rent(req.account.id, req.body || {});
  res.status(r.error ? 400 : 200).json(r);
});
app.post('/api/rooms/guests', requireAccount, async (req, res) => {
  const r = await rooms.setGuests(req.account.id, req.body || {});
  res.status(r.error ? 400 : 200).json(r);
});
app.get('/api/caves', requireAccount, async (req, res) => res.json(await land.caves(req.account.id)));
app.post('/api/caves/buy', requireAccount, async (req, res) => {
  const result = await land.buyCave(req.account.id, req.body || {});
  res.status(result.error ? 400 : 200).json(result);
});

app.get('/api/homes', requireAccount, async (req, res) => res.json(await land.homes(req.account.id)));
app.post('/api/homes/buy', requireAccount, async (req, res) => {
  const result = await land.buyHome(req.account.id, req.body || {});
  res.status(result.error ? 400 : 200).json(result);
});

// The Bank (safekeeping, halal loans, changing money, selling oil) and oil derricks
app.get('/api/bank', requireAccount, async (req, res) => { const r = await economy.bank(req.account.id); res.status(r.error ? 400 : 200).json(r); });
app.post('/api/bank', requireAccount, async (req, res) => { const r = await economy.bankAct(req.account.id, req.body || {}); res.status(r.error ? 400 : 200).json(r); });
app.get('/api/oil', requireAccount, async (req, res) => res.json(await economy.oil(req.account.id)));
app.post('/api/oil', requireAccount, async (req, res) => { const r = await economy.oilAct(req.account.id, req.body || {}); res.status(r.error ? 400 : 200).json(r); });

// Friends, chat and Status privacy
app.get('/api/players', requireAccount, async (req, res) => res.json(await social.search(req.account.id, req.query.q)));
app.get('/api/appraise/:name', requireAccount, async (req, res) => {
  const result = await social.appraise(req.account.id, req.params.name);
  res.status(result.error ? 400 : 200).json(result);
});
app.get('/api/players/:name', requireAccount, async (req, res) => {
  const result = await social.profile(req.account.id, req.params.name);
  res.status(result.error ? 404 : 200).json(result);
});
app.get('/api/social', requireAccount, async (req, res) => res.json(await social.poll(req.account.id, req.query.after)));
for (const [route, fn] of [['friends/request', social.request], ['friends/respond', social.respond], ['friends/remove', social.remove], ['chat', social.send], ['privacy', social.setPrivacy], ['party-invites', social.setPartyInvites]]) {
  app.post(`/api/${route}`, requireAccount, async (req, res) => {
    const result = await fn(req.account.id, req.body || {});
    res.status(result.error ? 400 : 200).json(result);
  });
}

// The admin board (admin.html): the owner (the accounts listed in ADMIN_EMAILS) can do everything;
// an account the owner gave admin access to can make only the requests its permissions allow
// (see public/js/data/staff.mjs). Checked here, on the server, for every request.
const staff = require('./staff');
const ST = require('../public/js/data/staff.mjs');
const adminGate = (method, route) => async (req, res, next) => {
  req.account = await auth.accountRow(bearer(req));
  if (!req.account) return res.status(401).json({ error: 'Please sign in.' });
  if (auth.banned(req.account)) return res.status(403).json({ error: auth.banned(req.account) });
  const a = staff.access(req.account);
  if (!staff.canBoard(a)) return res.status(403).json({ error: 'This account is not an admin.' });
  if (a.owner) return next();
  const key = `${method} ${route}`;
  const body = req.body || {};
  if (!ST.allowed(a.perms, key, body)) return res.status(403).json({ error: 'Only the owner can do that (or give you permission for it).' });
  // an admin the owner made can't use their powers on the owner, on another admin, or on themselves
  if (ST.ON_A_PLAYER.includes(key)) {
    const target = await db.get('SELECT id, email, email_verified, admin_perms FROM accounts WHERE id = ?', Number(body.id) || 0);
    if (target && (staff.isOwner(target) || staff.staffOf(target))) return res.status(403).json({ error: 'Only the owner can do that to an admin.' });
  }
  next();
};
app.get('/api/admin/accounts', adminGate('GET', 'accounts'), async (req, res) => res.json(await admin.accounts()));
// who is in the world right now, and where (see server/presence.js)
app.get('/api/admin/online', adminGate('GET', 'online'), async (req, res) => res.json(await presence.online()));
app.post('/api/admin/gates', adminGate('POST', 'gates'), async (req, res) => {
  const { city, raised } = req.body || {};
  if (!['central', 'emberfall', 'ashgrave', 'lumenhollow', 'mirehaven'].includes(city)) return res.status(400).json({ error: 'No such city.' });
  const all = await cityGates();
  if (raised) all[city] = true; else delete all[city];
  await db.run("INSERT INTO world_state (key, data) VALUES ('city_gates', ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data", JSON.stringify(all));
  await admin.log(req.account, raised ? 'raise bridges' : 'lower bridges', city);
  res.json({ ok: true, raised: all });
});
for (const [route, fn] of [['password', admin.setPassword], ['birthdate', admin.setBirthdate], ['signout', admin.signOutEverywhere], ['delete', admin.remove],
  ['edit', admin.edit], ['move', admin.move], ['ban', admin.ban], ['mute', admin.mute], ['chat/delete', admin.deleteMessage], ['reports/close', admin.closeReport],
  ['announce', admin.announce], ['take', admin.take], ['kings/reset', admin.resetKing], ['skip/childhood', admin.skipChildhood],
  ['life/edit', admin.editPastLife], ['life/restore', admin.restoreLife], ['sects', admin.appointLeader], ['tuning', admin.setTuning], ['staff', admin.setStaff]]) {
  app.post(`/api/admin/${route}`, adminGate('POST', route), async (req, res) => {
    const result = await fn(req.body || {}, req.account);
    res.status(result.error ? 400 : 200).json(result);
  });
}
for (const [route, fn] of [['stats', admin.stats], ['player', admin.player], ['catalogue', admin.catalogue], ['chat', admin.chat], ['reports', admin.reports], ['world', admin.world], ['log', admin.adminLog], ['tuning', admin.tuning], ['skills', admin.skillsBoard], ['sects', admin.leaders], ['me', admin.me], ['staff', admin.staffList]]) {
  app.get(`/api/admin/${route}`, adminGate('GET', route), async (req, res) => {
    const result = await fn(req.query || {}, req.account);
    res.status(result.error ? 400 : 200).json(result);
  });
}

// A player reports another player (the Report button on a player's card); the admins see it on the board
// Voice chat (16+): a short pass to join the voice room, or why not
app.post('/api/voice/pass', requireAccount, async (req, res) => {
  const r = await voice.pass(req.account);
  res.status(r.error ? (r.off ? 503 : 403) : 200).json(r);
});

// Seeing other players: report where you are, hear who is close by (see server/presence.js)
app.post('/api/presence', requireAccount, answer(async (body, acc) => {
  const r = await presence.report(acc, body, Date.now(), require('./staff').canBoard(require('./staff').access(acc)));
  // and the Colosseum: your fights and challenges, a fight you watch, and who holds the No.1 medal
  const fights = await arena.status(acc, body).catch((e) => { console.error('arena:', e); return null; });
  if (fights?.champion) for (const p of r.players) p.medal = p.id === fights.champion.id;
  return { ...r, arena: fights };
}));

// The Colosseum (see server/arena.js): the board, and challenging, answering, coming to fight, blows
app.get('/api/arena', requireAccount, answer((body, acc) => arena.board(acc)));
app.post('/api/arena', requireAccount, answer((body, acc) => arena.act(acc, body)));
// Vercel's timer calls this at the championship's draw (see vercel.json); with CRON_SECRET set, only it may
app.get('/api/arena/tick', async (req, res) => {
  if (process.env.CRON_SECRET && bearer(req) !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Not allowed.' });
  res.json(await arena.tick());
});
app.post('/api/presence/leave', requireAccount, answer((body, acc) => presence.leave(acc)));

app.post('/api/report', requireAccount, answer((body, acc) => admin.report(acc, body)));

app.post('/api/signout', async (req, res) => {
  await auth.signOut(bearer(req));
  res.json({ ok: true });
});

module.exports = app;

// Run directly (npm start) it listens on a port; on Vercel the same app is used by api/index.js.
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  db.ready()
    .then(() => app.listen(port, () => console.log(`Ascendant Realms running at http://localhost:${port}`)))
    .catch((e) => { console.error('Could not reach the database:', e.message); process.exit(1); });
}

// The admin board: the game owner can see every account and character, set a new password for a
// player who forgot theirs, sign an account out everywhere, or delete it.
// Admins are the accounts whose emails are listed in the ADMIN_EMAILS setting (comma-separated).
// Passwords are stored hashed, so nobody (admins included) can read them; they can only be replaced.
const db = require('./db');
const mail = require('./mail');
const { checkBirthdate, ageOf } = require('../public/js/data/birthdate.mjs');
const { hashPassword, shownEmail } = require('./auth');

const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
// (once emails can be sent, only after the admin has confirmed the email, so nobody else can sign up with it)
const isAdmin = (account) => !!account && adminEmails().includes(String(account.email).toLowerCase()) && (!!account.email_verified || !mail.ready());

async function accounts() {
  const rows = await db.all(`
    SELECT a.id, a.email, a.username, a.created_at, a.birthdate, c.data, c.updated_at,
      (SELECT COUNT(*)::int FROM sessions s WHERE s.account_id = a.id) AS sessions,
      (SELECT COUNT(*)::int FROM lands l WHERE l.account_id = a.id) AS plots
    FROM accounts a LEFT JOIN characters c ON c.account_id = a.id
    ORDER BY a.id DESC`);
  return {
    accounts: rows.map((r) => {
      const c = r.data ? JSON.parse(r.data) : null;
      return {
        id: r.id, email: shownEmail(r.email), username: r.username, birthdate: r.birthdate || null, age: ageOf(r.birthdate), createdAt: r.created_at, lastPlayed: r.updated_at,
        signedIn: r.sessions > 0, plots: r.plots, admin: adminEmails().includes(r.email.toLowerCase()),
        character: c && { name: c.name, race: c.race, cls: c.cls, form: c.form, level: c.level, coins: c.coins, exp: c.exp },
      };
    }),
  };
}

async function setPassword({ id, password }) {
  password = String(password || '');
  if (password.length < 8) return { error: 'The new password needs at least 8 characters.' };
  const row = await db.get('SELECT id FROM accounts WHERE id = ?', Number(id) || 0);
  if (!row) return { error: 'No such account.' };
  await db.run('UPDATE accounts SET password_hash = ? WHERE id = ?', hashPassword(password), row.id);
  await db.run('DELETE FROM sessions WHERE account_id = ?', row.id); // sign them out everywhere
  return { ok: true };
}

// a player's birth date was typed wrong: the admin can set it (players can't change it themselves)
async function setBirthdate({ id, birthdate }) {
  const born = checkBirthdate(birthdate);
  if (born.error) return born;
  const { changes } = await db.run('UPDATE accounts SET birthdate = ? WHERE id = ?', born.date, Number(id) || 0);
  return changes ? { ok: true } : { error: 'No such account.' };
}

async function signOutEverywhere({ id }) {
  await db.run('DELETE FROM sessions WHERE account_id = ?', Number(id) || 0);
  return { ok: true };
}

async function remove({ id }, me) {
  const row = await db.get('SELECT id, email FROM accounts WHERE id = ?', Number(id) || 0);
  if (!row) return { error: 'No such account.' };
  if (row.id === me.id) return { error: 'You can\'t delete your own admin account from here.' };
  // the account's sessions, character and land go with it
  // everything that belongs to the account is removed with it (ON DELETE CASCADE)
  await db.run('DELETE FROM accounts WHERE id = ?', row.id);
  return { ok: true };
}

module.exports = { isAdmin, accounts, setPassword, setBirthdate, signOutEverywhere, remove };

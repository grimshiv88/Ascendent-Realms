// Sign up, sign in and session lookup.
const crypto = require('node:crypto');
const db = require('./db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function checkPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

function newSession(accountId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, account_id) VALUES (?, ?)').run(token, accountId);
  return token;
}

function publicAccount(row) {
  const character = db.prepare('SELECT data FROM characters WHERE account_id = ?').get(row.id);
  return {
    username: row.username,
    email: row.email,
    character: character ? JSON.parse(character.data) : null,
  };
}

function signUp({ email, password, username }) {
  email = String(email || '').trim();
  username = String(username || '').trim();
  password = String(password || '');

  if (!EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.' };
  if (password.length < 8) return { error: 'Your password needs at least 8 characters.' };
  if (!USERNAME_RE.test(username)) {
    return { error: 'Usernames are 3 to 16 letters, numbers or underscores.' };
  }
  if (db.prepare('SELECT 1 FROM accounts WHERE email = ?').get(email)) {
    return { error: 'An account with this email already exists. Try signing in.' };
  }
  if (db.prepare('SELECT 1 FROM accounts WHERE username = ?').get(username)) {
    return { error: 'That username is taken. Please choose another.' };
  }

  const { lastInsertRowid } = db
    .prepare('INSERT INTO accounts (email, username, password_hash) VALUES (?, ?, ?)')
    .run(email, username, hashPassword(password));
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(lastInsertRowid);
  return { token: newSession(row.id), account: publicAccount(row), isNew: true };
}

function signIn({ email, password }) {
  const row = db.prepare('SELECT * FROM accounts WHERE email = ?').get(String(email || '').trim());
  if (!row || !checkPassword(String(password || ''), row.password_hash)) {
    return { error: 'That email and password don\'t match an account.' };
  }
  return { token: newSession(row.id), account: publicAccount(row), isNew: false };
}

function accountRow(token) {
  if (!token) return null;
  return db
    .prepare('SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ?')
    .get(token) || null;
}

function accountFromToken(token) {
  const row = accountRow(token);
  return row ? publicAccount(row) : null;
}

function signOut(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// For now a signed-in player can set a new password straight away.
// Later this should also ask for the old password or a code sent by email.
function changePassword(accountId, password, keepToken) {
  password = String(password || '');
  if (password.length < 8) return { error: 'Your new password needs at least 8 characters.' };
  db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hashPassword(password), accountId);
  db.prepare('DELETE FROM sessions WHERE account_id = ? AND token != ?').run(accountId, keepToken); // other devices sign in again
  return { ok: true };
}

module.exports = { signUp, signIn, signOut, accountFromToken, accountRow, hashPassword, changePassword };

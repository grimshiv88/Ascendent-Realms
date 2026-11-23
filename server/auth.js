// Sign up, sign in and session lookup.
const crypto = require('node:crypto');
const db = require('./db');
const { cleanCountry } = require('../public/js/data/countries.mjs');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
// Email is optional. An account made without one stores this stand-in, which is unique because
// the username is, and is shown as blank.
const NO_EMAIL = '@no-email.local';
const shownEmail = (email) => (email && email.endsWith(NO_EMAIL) ? '' : email);

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

async function newSession(accountId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.run('INSERT INTO sessions (token, account_id) VALUES (?, ?)', token, accountId);
  return token;
}

async function publicAccount(row) {
  const character = await db.get('SELECT data FROM characters WHERE account_id = ?', row.id);
  return {
    username: row.username,
    email: shownEmail(row.email),
    character: character ? JSON.parse(character.data) : null,
  };
}

async function signUp({ email, password, username, country }) {
  email = String(email || '').trim();
  username = String(username || '').trim();
  password = String(password || '');

  if (email && !EMAIL_RE.test(email)) return { error: 'Please enter a valid email address, or leave it blank.' };
  if (password.length < 8) return { error: 'Your password needs at least 8 characters.' };
  if (!USERNAME_RE.test(username)) {
    return { error: 'Usernames are 3 to 16 letters, numbers or underscores.' };
  }
  if (email && await db.get('SELECT 1 FROM accounts WHERE lower(email) = lower(?)', email)) {
    return { error: 'An account with this email already exists. Try signing in.' };
  }
  if (await db.get('SELECT 1 FROM accounts WHERE lower(username) = lower(?)', username)) {
    return { error: 'That username is taken. Please choose another.' };
  }
  if (!email) email = `${username.toLowerCase()}${NO_EMAIL}`;

  let row;
  try {
    ({ rows: [row] } = await db.run('INSERT INTO accounts (email, username, password_hash, country) VALUES (?, ?, ?, ?) RETURNING *', email, username, hashPassword(password), cleanCountry(country)));
  } catch (e) {
    // someone else took the name in the same moment
    if (e.code === '23505') return { error: 'That username or email was just taken. Please choose another.' };
    throw e;
  }
  return { token: await newSession(row.id), account: await publicAccount(row), isNew: true };
}

// `login` is a username or an email
async function signIn({ login, email, password }) {
  login = String(login || email || '').trim();
  const row = login && await db.get('SELECT * FROM accounts WHERE lower(email) = lower(?) OR lower(username) = lower(?)', login, login);
  if (!row || !checkPassword(String(password || ''), row.password_hash)) {
    return { error: 'That username or email and password don\'t match an account.' };
  }
  return { token: await newSession(row.id), account: await publicAccount(row), isNew: false };
}

async function accountRow(token) {
  if (!token) return null;
  return (await db.get('SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ?', token)) || null;
}

async function accountFromToken(token) {
  const row = await accountRow(token);
  return row ? publicAccount(row) : null;
}

async function signOut(token) {
  await db.run('DELETE FROM sessions WHERE token = ?', token);
}

// For now a signed-in player can set a new password straight away.
// Later this should also ask for the old password or a code sent by email.
async function changePassword(accountId, password, keepToken) {
  password = String(password || '');
  if (password.length < 8) return { error: 'Your new password needs at least 8 characters.' };
  await db.run('UPDATE accounts SET password_hash = ? WHERE id = ?', hashPassword(password), accountId);
  await db.run('DELETE FROM sessions WHERE account_id = ? AND token != ?', accountId, keepToken); // other devices sign in again
  return { ok: true };
}

module.exports = { shownEmail, signUp, signIn, signOut, accountFromToken, accountRow, hashPassword, changePassword };

// Accounts: sign up, sign in (with 2-step sign-in), confirming the email, resetting and changing
// the password. Emails go out through mail.js; when no email service is set up, nothing that needs
// an email is asked for (and no code is ever shown on screen on the live site).
const crypto = require('node:crypto');
const db = require('./db');
const mail = require('./mail');
const totp = require('./totp');
const { cleanCountry } = require('../public/js/data/countries.mjs');
const { checkBirthdate, ageOf } = require('../public/js/data/birthdate.mjs');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
// Accounts made before email was required keep this stand-in (unique because the username is) and
// are asked to add a real email on their next visit.
const NO_EMAIL = '@no-email.local';
const hasEmail = (email) => !!email && !email.endsWith(NO_EMAIL);
const shownEmail = (email) => (hasEmail(email) ? email : '');
// "mo****@gmail.com", to say where a code went without showing the whole address
const hideEmail = (email) => email.replace(/^(.{1,2})[^@]*(@.*)$/, (m, a, b) => `${a}****${b}`);

const MIN = 60 * 1000;
const TTL = { verify: 5 * MIN, reset: 15 * MIN, signin: 10 * MIN, totp: 15 * MIN };
const RESEND_AFTER = 45 * 1000; // a new code for the same thing at most this often
const MAX_TRIES = 5;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function checkPassword(password, stored) {
  const [saltHex, hashHex] = String(stored || '').split(':');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(String(password || ''), Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

// A banned account: what the player is told (null when not banned)
function banned(row) {
  const until = Number(row?.banned_until) || 0;
  if (!(until === -1 || until > Date.now())) return null;
  const when = until === -1 ? 'for good' : `until ${new Date(until).toUTCString().replace(/:\d\d GMT$/, ' UTC')}`;
  return `This account is banned ${when}. Reason: ${row.ban_reason || 'not given'}.`;
}

async function newSession(accountId) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.run('INSERT INTO sessions (token, account_id) VALUES (?, ?)', token, accountId);
  return token;
}

// An account that must still confirm its email before it may play (only while emails can be sent).
// One that confirmed an email once and then changed it keeps playing while the new one waits.
const mustVerify = (row) => mail.ready() && (!hasEmail(row.email) || (!row.email_verified && !row.welcomed));

async function publicAccount(row) {
  const character = await db.get('SELECT data FROM characters WHERE account_id = ?', row.id);
  return {
    username: row.username,
    email: shownEmail(row.email),
    emailVerified: !!row.email_verified,
    needsEmail: !hasEmail(row.email),
    mustVerify: mustVerify(row),
    twofa: row.twofa || null,
    birthdate: row.birthdate || null,
    age: ageOf(row.birthdate),
    needsBirthdate: !row.birthdate,
    mail: mail.ready(),
    // admin access: the powers in the game this account has (fly, can't die, ...), and whether it can open the Admin Board
    powers: require('./staff').powersOf(row),
    adminBoard: require('./staff').canBoard(require('./staff').access(row)),
    character: character ? await require('./characters').withTuning(JSON.parse(character.data)) : null,
  };
}

// ---------- codes ----------
const sixDigits = () => String(crypto.randomInt(0, 1e6)).padStart(6, '0');
const codeHash = (ticket, code) => crypto.createHash('sha256').update(`${ticket}:${code}`).digest('hex');

// A new code of `kind` for the account (the older one of that kind stops working)
async function makeCode(accountId, kind, data = null) {
  const last = await db.get('SELECT created FROM auth_codes WHERE account_id = ? AND kind = ? ORDER BY created DESC LIMIT 1', accountId, kind);
  if (last && Date.now() - last.created < RESEND_AFTER && kind !== 'totp') {
    return { error: `A code was just sent. Please wait ${Math.ceil((RESEND_AFTER - (Date.now() - last.created)) / 1000)} seconds before asking for another.` };
  }
  await db.run('DELETE FROM auth_codes WHERE account_id = ? AND kind = ?', accountId, kind);
  await db.run('DELETE FROM auth_codes WHERE expires < ?', Date.now());
  const ticket = crypto.randomBytes(18).toString('hex');
  const code = sixDigits();
  await db.run('INSERT INTO auth_codes (ticket, account_id, kind, code_hash, data, expires, created) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ticket, accountId, kind, codeHash(ticket, code), data, Date.now() + TTL[kind], Date.now());
  return { ticket, code };
}

// Check a code. `check` replaces the normal check (for authenticator apps). The code is used up when right.
async function useCode(row, code, check = null) {
  if (!row || row.expires < Date.now()) return { error: 'That code has run out. Please ask for a new one.' };
  if (row.tries >= MAX_TRIES) return { error: 'Too many wrong codes. Please ask for a new one.' };
  code = String(code || '').replace(/\D/g, '');
  const right = check ? check(code) : code.length === 6 && crypto.timingSafeEqual(Buffer.from(codeHash(row.ticket, code)), Buffer.from(row.code_hash));
  if (!right) {
    await db.run('UPDATE auth_codes SET tries = tries + 1 WHERE ticket = ?', row.ticket);
    return { error: row.tries + 1 >= MAX_TRIES ? 'Too many wrong codes. Please ask for a new one.' : 'That code isn\'t right. Check it and try again.' };
  }
  await db.run('DELETE FROM auth_codes WHERE ticket = ?', row.ticket);
  return { ok: true };
}
const ticketRow = (ticket, kind) => db.get('SELECT * FROM auth_codes WHERE ticket = ? AND kind = ?', String(ticket || ''), kind);

// ---------- sign up and sign in ----------
async function signUp({ email, password, username, country, birthdate }) {
  email = String(email || '').trim();
  username = String(username || '').trim();
  password = String(password || '');

  if (!email) return { error: 'Please enter your email. It is needed to confirm your account and to get it back if you forget your password.' };
  if (!EMAIL_RE.test(email) || email.toLowerCase().endsWith(NO_EMAIL)) return { error: 'Please enter a valid email address.' };
  if (password.length < 8) return { error: 'Your password needs at least 8 characters.' };
  if (!USERNAME_RE.test(username)) return { error: 'Usernames are 3 to 16 letters, numbers or underscores.' };
  const born = checkBirthdate(birthdate);
  if (born.error) return born;
  if (await db.get('SELECT 1 FROM accounts WHERE lower(email) = lower(?)', email)) {
    return { error: 'An account with this email already exists. Try signing in.' };
  }
  if (await db.get('SELECT 1 FROM accounts WHERE lower(username) = lower(?)', username)) {
    return { error: 'That username is taken. Please choose another.' };
  }

  let row;
  try {
    ({ rows: [row] } = await db.run('INSERT INTO accounts (email, username, password_hash, country, birthdate) VALUES (?, ?, ?, ?, ?) RETURNING *', email, username, hashPassword(password), cleanCountry(country), born.date));
  } catch (e) {
    // someone else took the name in the same moment
    if (e.code === '23505') return { error: 'That username or email was just taken. Please choose another.' };
    throw e;
  }
  if (mail.ready()) {
    const c = await makeCode(row.id, 'verify');
    if (c.code) await mail.verify(row.email, row.username, c.ticket, c.code);
  }
  return { token: await newSession(row.id), account: await publicAccount(row), isNew: true };
}

// `login` is a username or an email. With 2-step sign-in on, the answer is a ticket and the kind of
// code wanted ({ twofa: 'email' | 'app', ticket, sentTo }) instead of a sign-in.
async function signIn({ login, email, password }) {
  login = String(login || email || '').trim();
  const row = login && await db.get('SELECT * FROM accounts WHERE lower(email) = lower(?) OR lower(username) = lower(?)', login, login);
  if (!row || !checkPassword(password, row.password_hash)) {
    return { error: 'That username or email and password don\'t match an account.' };
  }
  if (banned(row)) return { error: banned(row), banned: true };
  const way = row.twofa === 'app' && row.totp_secret ? 'app' : row.twofa === 'email' && mail.ready() && hasEmail(row.email) ? 'email' : null;
  if (way) return askSignInCode(row, way);
  return { token: await newSession(row.id), account: await publicAccount(row), isNew: false };
}

async function askSignInCode(row, way) {
  // an app ticket has no code of its own (the app makes them), so it is never held back for being recent
  if (way === 'app') await db.run("DELETE FROM auth_codes WHERE account_id = ? AND kind = 'signin'", row.id);
  const c = await makeCode(row.id, 'signin', way);
  if (c.error) return c;
  if (way === 'email') await mail.signInCode(row.email, row.username, c.code);
  return { twofa: way, ticket: c.ticket, sentTo: way === 'email' ? hideEmail(row.email) : null, canEmail: mail.ready() && hasEmail(row.email) && !!row.email_verified };
}

// the second step: the code from the email or the app
async function signInCode({ ticket, code }) {
  const t = await ticketRow(ticket, 'signin');
  if (!t) return { error: 'This sign-in has run out. Please sign in again.' };
  const row = await db.get('SELECT * FROM accounts WHERE id = ?', t.account_id);
  const r = await useCode(t, code, t.data === 'app' ? (c) => totp.check(row.totp_secret, c) : null);
  if (r.error) return r;
  if (banned(row)) return { error: banned(row), banned: true };
  return { token: await newSession(row.id), account: await publicAccount(row), isNew: false };
}

// Lost the phone: send the sign-in code by email instead (only to a confirmed email)
async function signInByEmail({ ticket }) {
  const t = await ticketRow(ticket, 'signin');
  if (!t) return { error: 'This sign-in has run out. Please sign in again.' };
  const row = await db.get('SELECT * FROM accounts WHERE id = ?', t.account_id);
  if (!mail.ready() || !hasEmail(row.email) || !row.email_verified) return { error: 'This account has no confirmed email to send a code to.' };
  await db.run('UPDATE auth_codes SET created = 0 WHERE ticket = ?', t.ticket); // not held back by the app ticket
  return askSignInCode(row, 'email');
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

// ---------- the email ----------
// send (again) the email with the code that confirms the address
async function sendVerify(row) {
  if (!mail.ready()) return { error: 'Emails aren\'t switched on in the game yet.' };
  if (!hasEmail(row.email)) return { error: 'Please add your email first.' };
  if (row.email_verified) return { ok: true, already: true };
  const c = await makeCode(row.id, 'verify');
  if (c.error) return c;
  const sent = await mail.verify(row.email, row.username, c.ticket, c.code);
  if (!sent.sent) return { error: 'The email couldn\'t be sent just now. Please try again in a minute.' };
  return { ok: true, sentTo: hideEmail(row.email) };
}

// confirm the email: from the link in the email (ticket and code), or by typing the code while signed in
async function verifyEmail({ ticket, code }, row = null) {
  let t;
  if (ticket) t = await ticketRow(ticket, 'verify');
  else if (row) t = await db.get("SELECT * FROM auth_codes WHERE account_id = ? AND kind = 'verify' ORDER BY created DESC LIMIT 1", row.id);
  if (!t) {
    if (row?.email_verified) return { ok: true };
    return { error: 'That code has run out. Please ask for a new one.' };
  }
  const r = await useCode(t, code);
  if (r.error) return r;
  const { rows: [acc] } = await db.run('UPDATE accounts SET email_verified = true WHERE id = ? RETURNING *', t.account_id);
  if (!acc.welcomed) {
    await db.run('UPDATE accounts SET welcomed = true WHERE id = ?', acc.id);
    await mail.welcome(acc.email, acc.username);
  }
  return { ok: true, account: await publicAccount(acc) };
}

// add an email (accounts from before it was required) or change it. Changing a real email needs the password.
async function setEmail(row, { email, password }) {
  email = String(email || '').trim();
  if (!EMAIL_RE.test(email) || email.toLowerCase().endsWith(NO_EMAIL)) return { error: 'Please enter a valid email address.' };
  if (hasEmail(row.email) && !checkPassword(password, row.password_hash)) return { error: 'Your password isn\'t right.' };
  if (email.toLowerCase() === row.email.toLowerCase()) return { error: 'That is already your email.' };
  if (await db.get('SELECT 1 FROM accounts WHERE lower(email) = lower(?) AND id != ?', email, row.id)) return { error: 'Another account already uses this email.' };
  const old = row.email, wasReal = hasEmail(old) && row.email_verified;
  let acc;
  try {
    ({ rows: [acc] } = await db.run('UPDATE accounts SET email = ?, email_verified = false WHERE id = ? RETURNING *', email, row.id));
  } catch (e) {
    if (e.code === '23505') return { error: 'Another account already uses this email.' };
    throw e;
  }
  // 2-step sign-in by email can't go to an address that isn't confirmed yet
  if (acc.twofa === 'email') ({ rows: [acc] } = await db.run('UPDATE accounts SET twofa = NULL WHERE id = ? RETURNING *', acc.id));
  await db.run("DELETE FROM auth_codes WHERE account_id = ? AND kind = 'verify'", acc.id);
  if (wasReal) await mail.emailChanged(old, acc.username, email);
  const sent = mail.ready() ? await sendVerify(acc) : { ok: true };
  return { ok: true, sentTo: sent.sentTo || null, account: await publicAccount(acc) };
}

// the birth date, for accounts from before it was asked. Once saved, only an admin can change it.
async function setBirthdate(row, { birthdate }) {
  if (row.birthdate) return { error: 'Your birth date is already saved. If it is wrong, ask the game\'s owner.' };
  const born = checkBirthdate(birthdate);
  if (born.error) return born;
  const { rows: [acc] } = await db.run('UPDATE accounts SET birthdate = ? WHERE id = ? AND birthdate IS NULL RETURNING *', born.date, row.id);
  return { ok: true, account: await publicAccount(acc || row) };
}

// ---------- the password ----------
// a signed-in player changes it: the old password is needed
async function changePassword(row, { current, password }, keepToken) {
  password = String(password || '');
  if (!checkPassword(current, row.password_hash)) return { error: 'Your current password isn\'t right.' };
  if (password.length < 8) return { error: 'Your new password needs at least 8 characters.' };
  await db.run('UPDATE accounts SET password_hash = ? WHERE id = ?', hashPassword(password), row.id);
  await db.run('DELETE FROM sessions WHERE account_id = ? AND token != ?', row.id, keepToken); // other devices sign in again
  if (hasEmail(row.email)) await mail.passwordChanged(row.email, row.username);
  return { ok: true };
}

// "Forgot password?": a code by email. The answer is the same whether or not the account exists.
async function forgotPassword({ login }) {
  if (!mail.ready()) return { error: 'Password reset by email isn\'t switched on yet. Please ask the game\'s owner for help.' };
  login = String(login || '').trim();
  const row = login && await db.get('SELECT * FROM accounts WHERE lower(email) = lower(?) OR lower(username) = lower(?)', login, login);
  if (!row || !hasEmail(row.email)) return { ok: true, ticket: crypto.randomBytes(18).toString('hex') };
  const c = await makeCode(row.id, 'reset');
  if (c.error) return c;
  await mail.reset(row.email, row.username, c.ticket, c.code);
  return { ok: true, ticket: c.ticket };
}

async function resetPassword({ ticket, code, password }) {
  password = String(password || '');
  if (password.length < 8) return { error: 'Your new password needs at least 8 characters.' };
  const t = await ticketRow(ticket, 'reset');
  if (!t) return { error: 'That code isn\'t right, or it has run out. Please ask for a new one.' };
  const r = await useCode(t, code);
  if (r.error) return r;
  // the code came by email, so the email is confirmed too
  const { rows: [row] } = await db.run('UPDATE accounts SET password_hash = ?, email_verified = true WHERE id = ? RETURNING *', hashPassword(password), t.account_id);
  await db.run('DELETE FROM sessions WHERE account_id = ?', row.id); // every device signs in again
  await db.run('DELETE FROM auth_codes WHERE account_id = ?', row.id);
  await mail.passwordChanged(row.email, row.username);
  return { ok: true, username: row.username };
}

// ---------- 2-step sign-in ----------
async function twofaEmail(row, { password }) {
  if (!checkPassword(password, row.password_hash)) return { error: 'Your password isn\'t right.' };
  if (!mail.ready()) return { error: 'Emails aren\'t switched on in the game yet, so codes can\'t be sent.' };
  if (!hasEmail(row.email) || !row.email_verified) return { error: 'Please confirm your email first.' };
  const { rows: [acc] } = await db.run("UPDATE accounts SET twofa = 'email', totp_secret = NULL WHERE id = ? RETURNING *", row.id);
  await mail.twofaChanged(acc.email, acc.username, true);
  return { ok: true, account: await publicAccount(acc) };
}

// set up an authenticator app: a new secret, shown as a key and a QR code; confirmed by its first code
async function twofaAppStart(row, { password }) {
  if (!checkPassword(password, row.password_hash)) return { error: 'Your password isn\'t right.' };
  const secret = totp.newSecret();
  const c = await makeCode(row.id, 'totp', secret);
  return { ok: true, secret, uri: totp.uri(secret, row.username), ticket: c.ticket };
}

async function twofaAppConfirm(row, { code }) {
  const t = await db.get("SELECT * FROM auth_codes WHERE account_id = ? AND kind = 'totp' ORDER BY created DESC LIMIT 1", row.id);
  if (!t) return { error: 'Please start setting up the app again.' };
  const r = await useCode(t, code, (c) => totp.check(t.data, c));
  if (r.error) return r;
  const { rows: [acc] } = await db.run("UPDATE accounts SET twofa = 'app', totp_secret = ? WHERE id = ? RETURNING *", t.data, row.id);
  if (hasEmail(acc.email)) await mail.twofaChanged(acc.email, acc.username, true);
  return { ok: true, account: await publicAccount(acc) };
}

async function twofaOff(row, { password }) {
  if (!checkPassword(password, row.password_hash)) return { error: 'Your password isn\'t right.' };
  const { rows: [acc] } = await db.run('UPDATE accounts SET twofa = NULL, totp_secret = NULL WHERE id = ? RETURNING *', row.id);
  if (row.twofa && hasEmail(acc.email)) await mail.twofaChanged(acc.email, acc.username, false);
  return { ok: true, account: await publicAccount(acc) };
}

module.exports = {
  shownEmail, hasEmail, mustVerify, banned, hashPassword, signUp, signIn, signInCode, signInByEmail, signOut, accountFromToken, accountRow,
  sendVerify, verifyEmail, setEmail, setBirthdate, changePassword, forgotPassword, resetPassword, twofaEmail, twofaAppStart, twofaAppConfirm, twofaOff,
};

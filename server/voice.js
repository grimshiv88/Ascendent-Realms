// Voice chat (players 16 and over): nearby voices, and your party's voices at any distance.
// The voices go through LiveKit Cloud. The server only hands a
// player a short pass (a signed token) to join the voice room, after checking they may talk.
// It turns on by itself once the three LiveKit settings are added in Vercel:
//   LIVEKIT_URL (wss://….livekit.cloud), LIVEKIT_API_KEY, LIVEKIT_API_SECRET
// Without them the game says voice chat isn't switched on yet.
const crypto = require('node:crypto');
const { ageOf, VOICE_AGE } = require('../public/js/data/birthdate.mjs');

const ROOM = 'world'; // everyone joins one room; the game makes voices fade with distance
const PASS_SECONDS = 10 * 60; // a pass lasts 10 minutes; the game asks again before it runs out

const settings = () => ({
  url: (process.env.LIVEKIT_URL || '').trim(),
  key: (process.env.LIVEKIT_API_KEY || '').trim(),
  secret: (process.env.LIVEKIT_API_SECRET || '').trim(),
});
const ready = () => { const s = settings(); return !!(s.url && s.key && s.secret); };

// How the age is checked. 'birthdate' = the birth date given at sign-up. A real ID check
// (for example Yoti) can be added here later: it would set accounts.voice_verified.
const AGE_CHECK = (process.env.VOICE_AGE_CHECK || 'birthdate').trim();

function mayTalk(acc, now = Date.now()) {
  if (!ready()) return { error: 'Voice chat isn\'t switched on yet.', off: true };
  const age = ageOf(acc.birthdate);
  if (age == null) return { error: 'Add your birth date first (Settings) to use voice chat.' };
  if (age < VOICE_AGE) return { error: `Voice chat is for players ${VOICE_AGE} and over.`, young: true };
  if (AGE_CHECK === 'id' && !acc.voice_verified) return { error: 'Voice chat needs a one-time age check first.', needsCheck: true };
  if (acc.muted_until > now) return { error: `You can't talk right now (muted by the game's owner for ${Math.ceil((acc.muted_until - now) / 60000)} more minute(s)).` };
  return { ok: true };
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
// A LiveKit access token: a JWT signed with the API secret (HS256)
function passFor(identity, name, s = settings(), now = Math.floor(Date.now() / 1000), room = ROOM) {
  const head = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url({
    iss: s.key, sub: identity, name, nbf: now - 10, exp: now + PASS_SECONDS, jti: crypto.randomUUID(),
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: ['microphone'] },
  });
  const sig = crypto.createHmac('sha256', s.secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

// Your party (if it has someone besides you): its own voice room, heard at any distance
async function partyRoom(username) {
  const groups = require('./groups');
  const { partyOf } = require('../public/js/data/groups.mjs');
  const p = partyOf(await groups.load(), username);
  return p && p.members.length > 1 ? { room: `party-${p.id}`, members: p.members } : null;
}

async function pass(acc) {
  const ok = mayTalk(acc);
  if (ok.error) return ok;
  const s = settings();
  const out = { ok: true, url: s.url, token: passFor(acc.username, acc.username, s), room: ROOM, seconds: PASS_SECONDS, party: null };
  const p = await partyRoom(acc.username);
  if (p) out.party = { room: p.room, members: p.members, token: passFor(acc.username, acc.username, s, undefined, p.room) };
  return out;
}

module.exports = { ready, mayTalk, passFor, pass, ROOM };

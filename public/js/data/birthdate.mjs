// The player's real birth date, asked at sign-up (accounts from before are asked once). Only the
// player sees it. It is for age rules: for example voice chat, planned for players 16 and over.
// Once saved it can't be changed by the player (so an age can't be raised later to unlock things).

// "2010-03-12" -> { date } or { error }
export function checkBirthdate(text, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || '').trim());
  if (!m) return { error: 'Please enter your birth date.' };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return { error: 'That birth date isn\'t a real date.' };
  const age = ageOf(m[0], now);
  if (age < 0 || t > now) return { error: 'Your birth date can\'t be in the future.' };
  if (age < 4 || age > 120) return { error: 'Please check your birth date.' };
  return { date: m[0] };
}

// whole years old on `now`
export function ageOf(date, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return null;
  const y = now.getUTCFullYear(), mo = now.getUTCMonth() + 1, d = now.getUTCDate();
  return y - Number(m[1]) - ((mo < Number(m[2]) || (mo === Number(m[2]) && d < Number(m[3]))) ? 1 : 0);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const birthdateWords = (date) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '')); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ''; };
// the age that voice chat will need (not built yet)
export const VOICE_AGE = 16;

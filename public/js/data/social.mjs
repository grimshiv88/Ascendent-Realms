// Friends, chat and who can see your Status. Shared by the game and the server, so both agree on
// what a message looks like once cleaned and who may see what.

export const MAX_MESSAGE = 200;      // letters in one chat message
export const SEND_GAP_MS = 800;      // the shortest time between two messages from one player
export const KEEP_MESSAGES = 300;    // the general chat keeps this many
export const ONLINE_MS = 30000;      // seen this recently = online

// Who can see your Status when they look you up
export const PRIVACY = {
  public: { name: 'Public', text: 'Anyone who searches your username can see your Status.' },
  friends: { name: 'Friends only', text: 'Only your friends can see your Status.' },
  private: { name: 'Private', text: 'Nobody else can see your Status.' },
};
export const DEFAULT_PRIVACY = 'friends';
export const privacyOf = (c) => (PRIVACY[c?.privacy] ? c.privacy : DEFAULT_PRIVACY);
// Who can invite you to a party (chosen in the Status window)
export const PARTY_INVITES = {
  anyone: { name: 'Anyone', text: 'Any player can invite you to a party.' },
  friends: { name: 'Friends only', text: 'Only your friends can invite you to a party.' },
};
export const DEFAULT_PARTY_INVITES = 'anyone';
export const partyInvitesOf = (c) => (PARTY_INVITES[c?.partyInvites] ? c.partyInvites : DEFAULT_PARTY_INVITES);
export function canSeeStatus(c, { self = false, friend = false } = {}) {
  const p = privacyOf(c);
  return self || p === 'public' || (p === 'friends' && friend);
}
// What others see of a Status
export const statusSummary = (c) => ({
  name: c.name, race: c.race, cls: c.cls, side: c.side, level: c.level || 1, rank: c.rank || null,
  stats: c.stats || null, coins: undefined,
});

// ---------- the bad-word filter ----------
// Words are matched after undoing common tricks (numbers for letters, repeated letters, dots
// between letters), and the whole word is hidden with #. Short roots only match as whole words
// (with an ending like s, ed, er, ing), so ordinary words that contain them stay as they are.
const LONG = [
  'fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'bastard', 'asshole', 'arsehole', 'dickhead', 'motherfuck',
  'nigger', 'nigga', 'faggot', 'retard', 'wanker', 'bollock', 'pussy', 'penis', 'vagina', 'dildo', 'blowjob',
  'handjob', 'jerkoff', 'cocksuck', 'porn', 'rapist', 'tranny', 'spastic', 'twat', 'prick', 'boob', 'tits',
];
const SHORT = ['ass', 'arse', 'dick', 'cock', 'fag', 'damn', 'crap', 'piss', 'rape', 'sex', 'cum', 'hoe', 'kys', 'stfu', 'wtf', 'fk', 'fck', 'fuk', 'sht', 'btch', 'nazi', 'kike', 'spic', 'chink', 'coon'];
const ENDINGS = ['', 's', 'es', 'ed', 'er', 'ers', 'ing', 'y', 'ies'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'l', '+': 't' };

// the word in plain letters (numbers and symbols read as the letters they stand for, the rest
// dropped); `squash` also drops repeated letters (fuuuck -> fuck)
function normal(word, squash) {
  let s = '';
  for (const ch of word.toLowerCase()) {
    const c = LEET[ch] ?? ch;
    if (/[a-z]/.test(c) && !(squash && s[s.length - 1] === c)) s += c;
  }
  return s;
}
const hasDouble = (w) => /(.)\1/.test(w);
const short = new Set(SHORT.flatMap((w) => ENDINGS.map((e) => w + e)));
// roots without double letters can also be found once repeats are squashed
const shortSquashed = new Set(SHORT.filter((w) => !hasDouble(w)).flatMap((w) => ENDINGS.map((e) => w + e)).filter((w) => !hasDouble(w)));
const longSquashed = LONG.filter((w) => !hasDouble(w));
function isBad(word) {
  const n = normal(word, false), q = normal(word, true);
  if (!n) return false;
  if (short.has(n) || shortSquashed.has(q)) return true;
  return LONG.some((w) => n.includes(w)) || longSquashed.some((w) => q.includes(w));
}

// Clean a message: bad words become ####, and it's cut to the longest a message can be
export function cleanText(text) {
  const t = String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE);
  // words are what's between spaces (f.u.c.k is one word, and its dots are dropped when checking)
  const parts = t.split(/(\s+)/);
  const words = parts.map((w, i) => (i % 2 ? null : w));
  const hide = (i) => { parts[i] = '#'.repeat(parts[i].length); };
  words.forEach((w, i) => { if (w && isBad(w)) hide(i); });
  // letters spaced out one by one (f u c k) are read together
  for (let i = 0; i < words.length; i += 2) {
    let j = i;
    while (j < words.length && words[j]?.length === 1) j += 2;
    if (j - i >= 6 && isBad(words.slice(i, j).filter(Boolean).join(''))) for (let k = i; k < j; k += 2) hide(k);
    if (j > i) i = j - 2;
  }
  return parts.join('');
}

// ---------- chat channels ----------
// 'general' for everyone; a private chat between two players is 'dm:<smaller id>:<larger id>'
export const dmChannel = (a, b) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`;

// Where you are, on your friends' world maps (chosen in the Status window). Only friends can ever
// see it, and only while you are in the game; "Nobody" hides you from every map.
export const SHARE_LOCATION = {
  friends: { name: 'My friends', text: 'Your friends can see where you are on their world map while you play.' },
  off: { name: 'Nobody', text: 'Nobody can see where you are on the map.' },
};
export const DEFAULT_SHARE_LOCATION = 'friends';
export const shareLocationOf = (c) => (SHARE_LOCATION[c?.shareLocation] ? c.shareLocation : DEFAULT_SHARE_LOCATION);
export const FRIEND_SPOTS_MS = 6000; // how often the map asks where your friends are

// Your own marks on the world map: a spot and a short name. Only you ever see them.
export const MAX_MAP_MARKS = 50;
export const MARK_NAME = 30;
export const MARK_COLOURS = ['#ff6b5a', '#ffd23f', '#5ee07a', '#5ab4ff', '#c58cff', '#ffffff'];
export function cleanMarks(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const m of list.slice(0, MAX_MAP_MARKS)) {
    const x = Number(m?.x), z = Number(m?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 1e6 || Math.abs(z) > 1e6) continue;
    const id = typeof m.id === 'string' && /^[a-z0-9]{1,16}$/.test(m.id) ? m.id : Math.random().toString(36).slice(2, 10);
    const name = cleanText(String(m.name || '')).slice(0, MARK_NAME) || 'Marked place';
    const colour = MARK_COLOURS.includes(m.colour) ? m.colour : MARK_COLOURS[0];
    out.push({ id, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, name, colour });
  }
  return out;
}

// The world clock: one day in the realm lasts DAY_MINUTES real minutes. Everyone shares it, and it
// keeps running while you are away.
//
// To change the length of a day: set DAY_MINUTES, and add a line to ERAS with the moment the new
// length starts (a little in the future, in UTC) and the OLD length. The clock then carries on from
// the same day and hour instead of jumping.
export const DAY_MINUTES = 40;
export const DAY_MS = DAY_MINUTES * 60 * 1000;
export const DAY_TEXT = `${DAY_MINUTES} real minutes`; // for messages: "a day of the realm (40 real minutes)"
export const EPOCH = Date.UTC(2026, 9, 27); // Day 1 of the realm
// [until, day length before then]: each era runs from the end of the one before it
const ERAS = [
  [Date.UTC(2026, 10, 26, 19, 0), 60 * 60 * 1000], // until 2026-11-26 19:00 UTC a day was one real hour
];
export const NIGHT_START = 19.5; // 7:30 in the evening
export const NIGHT_END = 5.5;    // 5:30 in the morning

let offset = 0; // the server's clock minus this computer's, so all players agree
export const setServerNow = (serverMs) => { offset = serverMs - Date.now(); };
export const now = () => Date.now() + offset;

// how many days of the realm have passed since Day 1 began, at real time `ms`
export function realmDays(ms = now()) {
  let from = EPOCH, days = 0;
  for (const [until, len] of ERAS) {
    if (ms <= until) return days + (ms - from) / len;
    days += (until - from) / len;
    from = until;
  }
  return days + (ms - from) / DAY_MS;
}

export function gameTime(ms = now()) {
  const days = realmDays(ms);
  const hour = (((days % 1) + 1) % 1) * 24;
  const night = hour >= NIGHT_START || hour < NIGHT_END;
  // daylight: 0 at night, rising through dawn (5–7) and falling through dusk (18–20)
  const daylight = hour < 5 || hour >= 20 ? 0 : hour < 7 ? (hour - 5) / 2 : hour < 18 ? 1 : (20 - hour) / 2;
  return { day: Math.floor(days) + 1, hour, night, daylight };
}

export function clockText(t = gameTime()) {
  const h = Math.floor(t.hour), m = Math.floor((t.hour % 1) * 60);
  return `Day ${t.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Real minutes until night falls (or 0 if it is night now)
export function minutesToNight(t = gameTime()) {
  if (t.night) return 0;
  return Math.round(((NIGHT_START - t.hour) / 24) * DAY_MINUTES);
}

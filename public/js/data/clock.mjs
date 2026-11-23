// The world clock: one real hour is one day in the realm. Everyone shares it, and it keeps
// running while you are away.
export const DAY_MS = 60 * 60 * 1000;
export const EPOCH = Date.UTC(2026, 9, 27); // Day 1 of the realm
export const NIGHT_START = 19.5; // 7:30 in the evening
export const NIGHT_END = 5.5;    // 5:30 in the morning

let offset = 0; // the server's clock minus this computer's, so all players agree
export const setServerNow = (serverMs) => { offset = serverMs - Date.now(); };
export const now = () => Date.now() + offset;

export function gameTime(ms = now()) {
  const days = (ms - EPOCH) / DAY_MS;
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
  return Math.round(((NIGHT_START - t.hour) / 24) * 60);
}

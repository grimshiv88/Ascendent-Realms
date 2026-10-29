// Bodyguards: hunters you hire at the Main Guild Hall to walk with you and fight for you on a trip
// (for those who are not fighters, or want company in the wilds). They follow you, strike any
// monster that comes near you, and leave when the time you paid for runs out. Kills count as yours.
export const BODYGUARDS = {
  novice: { name: 'Novice Hunter', level: 20, per30: 300, blurb: 'Fine for the fields and forests near town.' },
  veteran: { name: 'Veteran Hunter', level: 80, per30: 1500, blurb: 'Seasoned in the wilds. Can handle most packs.' },
  elite: { name: 'Elite Hunter', level: 200, per30: 8000, blurb: 'A famed hunter. Strong enough for the Dark Forests.' },
};
export const HIRE_SPANS = [30, 60, 180]; // minutes (real time)
export const hireCost = (tier, mins) => Math.round(BODYGUARDS[tier].per30 * (mins / 30));
// how hard a bodyguard hits (about what a well-geared player of their level would)
export const guardHit = (tier) => Math.round(8 + BODYGUARDS[tier].level * 2.2);
export const guardActive = (c, now = Date.now()) => (c.guard && BODYGUARDS[c.guard.tier] && c.guard.until > now ? c.guard : null);

// Animals you can ride. Buy a horse or a donkey at any Farm Stand, or tame a wild horse or a camel
// by feeding it three times (it has to trust you). The mount's item stays in your bag: while you
// have it the animal is yours. Press H (or "Call it" in the bag) and it trots to you; E or H beside
// it gets you on, and H (or E) again gets you off. It stays where you leave it.
// Speeds are in metres per second (you walk 3.4 and run 8 on foot).
export const MOUNTS = {
  horse: { name: 'Horse', walk: 5.5, run: 15, jump: 5.2, about: 'walks 5.5 m/s, gallops 15 m/s' },
  wild_horse: { name: 'Wild Horse', walk: 6, run: 17, jump: 5.6, about: 'walks 6 m/s, gallops 17 m/s' },
  camel: { name: 'Camel', walk: 4.5, run: 11, jump: 3.6, sand: true, about: 'walks 4.5 m/s, runs 11 m/s, tireless on sand' },
  // dragons and wyverns: `fly` is their speed in the air (Space climbs, Shift dives)
  peak_wyvern: { name: 'Peak Wyvern', walk: 5, run: 11, jump: 0, fly: 34, beast: true, about: 'flies 34 m/s, walks 5 m/s' },
  frost_wyvern: { name: 'Frost Wyvern', walk: 5, run: 11, jump: 0, fly: 32, beast: true, about: 'flies 32 m/s, walks 5 m/s' },
  fire_wyvern: { name: 'Fire Wyvern', walk: 5, run: 11, jump: 0, fly: 36, beast: true, about: 'flies 36 m/s, walks 5 m/s' },
  storm_dragon: { name: 'Storm Dragon', walk: 6, run: 13, jump: 0, fly: 50, beast: true, about: 'flies 50 m/s, walks 6 m/s' },
  frost_dragon: { name: 'Frost Dragon', walk: 6, run: 13, jump: 0, fly: 44, beast: true, about: 'flies 44 m/s, walks 6 m/s' },
  fire_dragon: { name: 'Fire Dragon', walk: 6, run: 13, jump: 0, fly: 46, beast: true, about: 'flies 46 m/s, walks 6 m/s' },
  donkey: { name: 'Donkey', walk: 4, run: 8.5, jump: 3.6, about: 'walks 4 m/s, trots 8.5 m/s' },
};
// the item that makes each mount yours, best first (H calls the best one you have)
export const MOUNT_ITEMS = ['tamed_storm_dragon', 'tamed_fire_dragon', 'tamed_frost_dragon', 'tamed_fire_wyvern', 'tamed_frost_wyvern', 'tamed_peak_wyvern', 'tamed_horse', 'riding_horse', 'tamed_camel', 'riding_donkey'];
export const TAME_FEEDS = 3;     // feeds it takes to tame a wild horse or camel
export const TAMEABLE = { wild_horse: 'tamed_horse', camel: 'tamed_camel' };
export const RIDE_FATIGUE = 0.35; // riding tires you this much as walking does
// Dragons and wyverns: beat one until it lands worn out (below 15% of its health), then use a
// Dragon Bridle on it (E beside it). You must be at least half its level. Kings can't be tamed.
export const BEAST_TAME = { peak_wyvern: 0.6, frost_wyvern: 0.55, fire_wyvern: 0.55, storm_dragon: 0.3, frost_dragon: 0.3, fire_dragon: 0.3 };

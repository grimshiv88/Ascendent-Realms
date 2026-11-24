// Animals you can ride. Buy a horse or a donkey at any Farm Stand, or tame a wild horse or a camel
// by feeding it three times (it has to trust you). The mount's item stays in your bag: while you
// have it the animal is yours. Press H (or "Call it" in the bag) and it trots to you; E or H beside
// it gets you on, and H (or E) again gets you off. It stays where you leave it.
// Speeds are in metres per second (you walk 3.4 and run 8 on foot).
export const MOUNTS = {
  horse: { name: 'Horse', walk: 5.5, run: 15, jump: 5.2, about: 'walks 5.5 m/s, gallops 15 m/s' },
  wild_horse: { name: 'Wild Horse', walk: 6, run: 17, jump: 5.6, about: 'walks 6 m/s, gallops 17 m/s' },
  camel: { name: 'Camel', walk: 4.5, run: 11, jump: 3.6, sand: true, about: 'walks 4.5 m/s, runs 11 m/s, tireless on sand' },
  donkey: { name: 'Donkey', walk: 4, run: 8.5, jump: 3.6, about: 'walks 4 m/s, trots 8.5 m/s' },
};
// the item that makes each mount yours, best first (H calls the best one you have)
export const MOUNT_ITEMS = ['tamed_horse', 'riding_horse', 'tamed_camel', 'riding_donkey'];
export const TAME_FEEDS = 3;     // feeds it takes to tame a wild horse or camel
export const TAMEABLE = { wild_horse: 'tamed_horse', camel: 'tamed_camel' };
export const RIDE_FATIGUE = 0.35; // riding tires you this much as walking does

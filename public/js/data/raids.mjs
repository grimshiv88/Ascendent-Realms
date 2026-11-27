// Monster attacks on the towns, started by the realm's keepers from the Admin Board (World tab).
// While an attack lasts:
//   - a city's bridges are raised (they stand up and shut the inner gates)
//   - the monsters gather round the town and fight anyone they find there
//   - players close by get a warning across the screen
//   - players in the towns round about hear the news, and the townsfolk gather in the plaza to talk
// When it is over (its time runs out, or the keepers drive the monsters off), the news is still
// talked about for a while.

// The towns that can be attacked: the cities and the villages of the map (world-layout.mjs PLACES)
export const raidable = (p) => !!(p && (p.city || p.village));

// Who attacks: each band is a few kinds of wild monster (world/creatures.js KINDS), the last one the leader
export const RAIDERS = {
  goblins: { name: 'Goblins', kinds: ['goblin', 'hobgoblin', 'hobgoblin', 'chieftain'], leader: 'goblinlord' },
  ogres: { name: 'Ogre Lords', kinds: ['ogrelord', 'goblinlord'], leader: 'emperor' },
  slimes: { name: 'Slimes', kinds: ['slime', 'slime', 'frostslime'], leader: 'frostslime' },
  lizardmen: { name: 'Lizardmen', kinds: ['lizard', 'lizard', 'sandlizard'], leader: 'sandlizard' },
  naga: { name: 'Swamp Serpents', kinds: ['serpent'], leader: 'serpent' },
  drakes: { name: 'Young Drakes', kinds: ['drake'], leader: 'drake' },
  wisps: { name: 'Fae Wisps', kinds: ['wisp'], leader: 'wisp' },
};
export const RAID_COUNT = [3, 40];      // how many monsters, fewest and most
export const RAID_MINUTES = [5, 720];   // how long it lasts (real minutes)
export const RAID_LEVEL = [1, 1000];

export const RAID_NEAR = 1500;   // players this close (metres) get the warning and see the monsters
export const RAID_SEEN = 900;    // the monsters are there while you are this close
export const NEWS_FAR = 40000;   // towns this close hear the news (the villages are 10 to 25 km apart)
export const NEWS_MS = 2 * 60 * 60 * 1000; // the news is talked about for 2 hours after an attack ends
export const GATHER_NEWS_MS = 15 * 60 * 1000; // the townsfolk crowd the plaza for the first 15 minutes

export const raidActive = (r, now = Date.now()) => !!r && !r.endedAt && r.until > now;
export const raidOver = (r, now = Date.now()) => (r.endedAt || r.until);

// what the townsfolk say about it (`name`: the one speaking; picked by the raid's id and the speaker)
export function newsLine(r, speaker = 0, now = Date.now()) {
  const who = RAIDERS[r.raiders]?.name || 'Monsters';
  const at = r.placeName;
  const lines = raidActive(r, now) ? [
    `Did you hear? ${who} are attacking ${at}! They say the walls are surrounded.`,
    `${who} at ${at}! ${r.city ? 'They have raised the bridges there.' : 'The villagers are barring their doors.'}`,
    `A rider came in from ${at}: ${r.n} ${who.toLowerCase()} or more, led by a big one.`,
    `If you can fight, go to ${at}. They need every blade.`,
    `I have family in ${at}... I pray they are safe.`,
  ] : [
    `${at} held! The ${who.toLowerCase()} were driven off.`,
    `They say the ${who.toLowerCase()} at ${at} are gone. Thank goodness.`,
    `After what happened at ${at}, I keep my door locked at night.`,
  ];
  return lines[(Math.abs(Number(r.id) || 0) + speaker) % lines.length];
}

// The warning across the screen of the players close by
export const raidWarning = (r) => `⚔ ${RAIDERS[r.raiders]?.name || 'Monsters'} are attacking ${r.placeName}!${r.city ? ' The bridges are raised.' : ''} Defend the town or stay away.`;
export const raidEndText = (r) => `The ${(RAIDERS[r.raiders]?.name || 'monsters').toLowerCase()} attacking ${r.placeName} have been driven off.`;

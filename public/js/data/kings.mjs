// The Monster Kings: one per monster race, each on a throne in a castle in the race's homeland,
// with Overlords (levels 990-999) in the throne room and guards at the gate.
// Shared by the game and the server, so both agree where the castles are and who holds each crown.
import { PLACES, toWorld, sample, PLOT, addFixedFlats } from './world-layout.mjs';

export const KING_LEVEL = 1000;
export const OVERLORD_LEVELS = [990, 999];
export const NPC_OVERLORDS = 5;          // until more than this many real players reach that level
export const KING_RETURNS_MS = 24 * 3600 * 1000; // a slain NPC King's throne is filled again within a day

export const CASTLES = {
  goblin: {
    title: 'King of Goblins', race: 'goblin', home: 'warrens', castle: 'Gravelmaw Keep',
    king: 'Grukk the Undying', weapon: 'Maw of Gravelmaw (Mythic greataxe)',
    unique: 'Endless Horde: every goblin within sight fights harder while the King stands.',
    skills: ['War Cry', 'Cleave', 'Iron Hide', 'Call the Warrens'],
    names: ['Snag', 'Vrak', 'Murgle', 'Tazz', 'Krell', 'Bogroth', 'Nix', 'Grubb', 'Skarg', 'Ruttle'],
  },
  slime: {
    title: 'King of Slimes', race: 'slime', home: 'slimecaves', castle: 'The Gelid Throne',
    king: 'Oozeling the Vast', weapon: 'Heart of the Deep Gel (Mythic core)',
    unique: 'Devour: absorbs a slain foe and takes one of its skills for the fight.',
    skills: ['Acid Wave', 'Split', 'Engulf', 'Gel Armour'],
    names: ['Blorp', 'Quiv', 'Mire', 'Glimm', 'Sludge', 'Drip', 'Wob', 'Fizz', 'Gloam', 'Pudd'],
  },
  fairy: {
    title: 'King of the Fae', race: 'fairy', home: 'glade', castle: 'The Moonlit Spire',
    king: 'Oberyl of the Thousand Lights', weapon: 'Starthorn Wand (Mythic staff)',
    unique: 'Wild Court: turns the light of the glade into blinding, healing or binding magic at will.',
    skills: ['Starfall', 'Fae Ward', 'Charm', 'Blink'],
    names: ['Lumi', 'Thistle', 'Wren', 'Briar', 'Sorrel', 'Pip', 'Gossamer', 'Fen', 'Lark', 'Moth'],
  },
  lizardman: {
    title: 'King of Scales', race: 'lizardman', home: 'marsh', castle: 'Fenhold',
    king: 'Sskarath Mirefang', weapon: 'Tidebreaker (Legendary trident)',
    unique: 'Cold Blood: grows stronger with every hit it takes, until it strikes back.',
    skills: ['Tail Sweep', 'Venom Spit', 'Scale Wall', 'Ambush'],
    names: ['Ssiv', 'Krath', 'Ixel', 'Tharr', 'Zesk', 'Orrik', 'Vesh', 'Kaal', 'Ruuth', 'Sesk'],
  },
  naga: {
    title: 'King of Serpents', race: 'naga', home: 'temple', castle: 'The Drowned Palace',
    king: 'Nahsir the Coiled', weapon: 'Fang of the Deep (Mythic glaive)',
    unique: 'Hypnotic Gaze: holds a foe still for a heartbeat with a look.',
    skills: ['Water Lash', 'Constrict', 'Venom Mist', 'Tide Call'],
    names: ['Ssela', 'Ivash', 'Naru', 'Sythe', 'Kesh', 'Lysse', 'Vasha', 'Isra', 'Thessa', 'Oshra'],
  },
  dragonewt: {
    title: 'King of Dragons', race: 'dragonewt', home: 'nests', castle: 'Emberhorn Citadel',
    king: 'Vorthax Emberhorn', weapon: 'Cinderfall (Mythic greatsword)',
    unique: 'Dragon Heart: breathes fire that burns for as long as it keeps roaring.',
    skills: ['Flame Breath', 'Wing Gust', 'Scorch Claw', 'Molten Skin'],
    names: ['Rhazz', 'Ignar', 'Skorr', 'Valka', 'Tzar', 'Kharn', 'Embra', 'Drax', 'Sorix', 'Pyra'],
  },
};

// A place for a castle: a 2 × 2 block of plots of dry, fairly even land about 2.5 km from the homeland's
// waystone, so new monsters starting out there don't wander straight into it
function findSpot(race) {
  const C = CASTLES[race];
  const home = PLACES.find((p) => p.id === C.home);
  const w = toWorld(home.px, home.py);
  const s = {};
  const region = home.region;
  for (const d of [2500, 2000, 3000, 1600, 3600, 1200, 4500, 6000, 7500, 9000]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.3;
      const ix = Math.floor((w.x + Math.cos(a) * d) / PLOT), iz = Math.floor((w.z + Math.sin(a) * d) / PLOT);
      const hs = [];
      let ok = true;
      for (let gx = 0; gx <= 4 && ok; gx++) {
        for (let gz = 0; gz <= 4 && ok; gz++) {
          sample((ix + gx / 2) * PLOT, (iz + gz / 2) * PLOT, s, true);
          if (s.region !== region || s.h < s.water + 2 || s.lake > 0.02) ok = false;
          hs.push(s.h);
        }
      }
      if (!ok || Math.max(...hs) - Math.min(...hs) > 18) continue;
      return { ix, iz, flat: Math.round((hs.reduce((a, b) => a + b, 0) / hs.length) * 10) / 10 };
    }
  }
  return null;
}

let spots = null;
// Every castle: { race, ...CASTLES[race], ix, iz (its north-west plot), flat, x, z (its middle), cell: [x, z] }
export function allCastles() {
  if (spots) return spots;
  spots = [];
  const flats = [];
  for (const race of Object.keys(CASTLES)) {
    const at = findSpot(race);
    if (!at) continue;
    spots.push({ race, ...CASTLES[race], ...at, x: (at.ix + 1) * PLOT, z: (at.iz + 1) * PLOT, cell: [at.ix * (PLOT / 4), at.iz * (PLOT / 4)] });
    for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) flats.push({ ix: at.ix + dx, iz: at.iz + dz, flat: at.flat });
  }
  // the ground under each castle is levelled for good
  addFixedFlats(flats);
  return spots;
}
export const castleOf = (race) => allCastles().find((c) => c.race === race) || null;

// A new NPC Overlord for a castle, with a name nobody at court has yet
export function newOverlord(race, taken = [], seed = Math.random()) {
  const free = CASTLES[race].names.filter((n) => !taken.some((t) => t.endsWith(` ${n}`)));
  const names = free.length ? free : CASTLES[race].names;
  const name = names[Math.floor(seed * names.length) % names.length];
  const [lo, hi] = OVERLORD_LEVELS;
  return { name: `Overlord ${name}`, level: lo + Math.floor(((seed * 7919) % 1) * (hi - lo + 1)) };
}

// The crown of a castle at the start: the NPC King and five NPC Overlords
export function startingCourt(race) {
  return {
    race,
    king: { name: CASTLES[race].king, level: KING_LEVEL, npc: true },
    overlords: Array.from({ length: NPC_OVERLORDS }, (_, i) => ({ name: `Overlord ${CASTLES[race].names[i]}`, level: OVERLORD_LEVELS[1] - i * 2 })),
    slainAt: 0,
  };
}

// What happens when the King falls. `by` is { name, race, monster } for whoever struck the last blow.
// A monster of the King's own race takes the crown; anyone else only gets EXP and loot, and the
// strongest Overlord becomes King while a new Overlord is appointed.
export function afterKingSlain(court, by, now = Date.now()) {
  const next = { ...court, overlords: [...court.overlords], slainAt: now };
  if (by?.monster && by.race === court.race) {
    next.king = { name: by.name, level: by.level || KING_LEVEL, npc: false, crownedAt: now };
    return { court: next, crowned: true };
  }
  next.overlords.sort((a, b) => b.level - a.level);
  const heir = next.overlords.shift();
  if (heir) next.king = { name: `King ${heir.name.replace(/^Overlord /, '')}`, level: KING_LEVEL, npc: true };
  next.overlords.push(newOverlord(court.race, [next.king.name, ...next.overlords.map((o) => o.name)]));
  return { court: next, crowned: false };
}

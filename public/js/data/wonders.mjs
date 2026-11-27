// The wonders of the realm: one great sight in every land, something you find nowhere else.
// The Dragon Peaks have their dragons; every other land has a wonder of its own (and the Peaks get
// the bones of the first dragon too). Shared by the game and the map, so everyone sees them in the
// same places. Each one is drawn by world/wonders.js.
import { sample, toWorld } from './world-layout.mjs';

// map: where it is on the map (map pixels); look: how it is drawn; r: how far it reaches (m)
export const WONDERS = [
  { id: 'eldertree', region: 'heart', name: 'The Elder Tree', map: [740, 470], look: 'tree', r: 70,
    text: 'The oldest living thing in the Heartland: a tree 140 m tall whose leaves glow at night. Its roots are older than the Central City.' },
  { id: 'wyrmbones', region: 'peaks', name: 'The Wyrmbone Field', map: [610, 150], look: 'bones', r: 90,
    text: 'The bones of the first dragon, 150 m from nose to tail, half sunk in the ash of the Cinder Steppe. Dragons come here to die.' },
  { id: 'titanskull', region: 'warrens', name: "The Titan's Skull", map: [290, 380], look: 'skull', r: 60,
    text: 'A skull of rock 60 m high in the Redsand Mesas, with eyes that burn green at night. The goblins say a titan fell here.' },
  { id: 'moonwell', region: 'fae', name: 'The Moonwell Isle', map: [1470, 405], look: 'isle', r: 60,
    text: 'An island of rock floating above the sea, with a waterfall of light pouring from it. Only fairies have stood on it.' },
  { id: 'colossus', region: 'mire', name: 'The Sunken Colossus', map: [1010, 930], look: 'colossus', r: 70,
    text: 'The head and hand of a giant stone king rising from the swamp. Nobody knows who carved him, or what pulled him under.' },
  { id: 'frozenheart', region: 'frost', name: 'The Frozen Heart', map: [270, 130], look: 'ice', r: 60,
    text: 'A cluster of blue ice crystals as tall as towers, glowing from within. The cold never leaves it, even in summer.' },
  { id: 'sunpyramid', region: 'sun', name: 'The Sun Pyramid', map: [330, 875], look: 'pyramid', r: 90,
    text: 'A pyramid 90 m high, half buried in the Sunscar Dunes, its golden tip catching the sun. Its doors have never been opened.' },
];

// Where each wonder stands: near its map spot, on dry land of its own region (worked out once)
let spots = null;
export function allWonders() {
  if (spots) return spots;
  const s = {};
  spots = [];
  for (const w of WONDERS) {
    const c = toWorld(w.map[0], w.map[1]);
    let at = null;
    for (const d of [0, 800, 1600, 2400, 3600, 5000, 7000]) {
      for (let i = 0; i < (d ? 12 : 1) && !at; i++) {
        const a = (i / 12) * Math.PI * 2, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        sample(x, z, s, true);
        // (the floating isle hangs over the sea, so it can stand anywhere in its lands)
        if (s.region === w.region && (w.look === 'isle' || (s.h > s.water + 2 && s.lake < 0.02))) at = { x: Math.round(x), z: Math.round(z) };
      }
      if (at) break;
    }
    if (at) spots.push({ ...w, ...at });
  }
  return spots;
}

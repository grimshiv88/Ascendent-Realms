// Growing your own crops (see data/crops.mjs), out in the world:
//   - the visitors' beds at every farmstead, and beds you dig with a hoe on your own Farm land
//   - E by a bed: plant seeds (a pop asks which, if you carry more than one kind), water it, or
//     pick the harvest when it is ripe
//   - E by a river, lake or a farm's trough with an empty Watering Can fills it
// The beds you planted are kept on your character (c.crops), so they grow while you are away.
import * as THREE from 'three';
import { CROPS, SEEDS, BED_GRID, MAX_BEDS, SEED_BACK, growth, minsLeft, stageWord } from '../data/crops.mjs';
import { ITEMS } from '../data/items.mjs';
import { PLOT } from '../data/world-layout.mjs';
import { bedPlants, bedSoil } from './farms.js';

const SHOW_FAR = 140;  // beds further than this are not drawn
const REACH = 2.4;     // how close to a bed's middle you stand to use it

export function createCrops({ scene, game, say, floatText, onEvent, getPos, getHeading, groundAt, farmBeds, farmTroughs, myFarmPlots, nearWater }) {
  const drawn = new Map(); // bed key -> { group, plants, look }
  let chosenBed = null;    // the bed a "which seeds?" pop is open for
  let lastDraw = -1;
  const farmer = () => game.character.cls === 'farmer';
  const mine = () => game.character.crops || (game.character.crops = []);
  const saved = () => game.touch('bag');

  // every bed near here: { k, x, z, y, own, plot, entry (what is planted, if anything) }
  function bedsNear(x, z, r) {
    const out = [];
    const byKey = new Map(mine().map((b) => [b.k, b]));
    for (const b of farmBeds()) if (Math.abs(b.x - x) < r && Math.abs(b.z - z) < r) out.push({ ...b, own: false, entry: byKey.get(b.k) || null });
    for (const b of mine()) {
      if (!b.k.startsWith('own:') || Math.abs(b.x - x) > r || Math.abs(b.z - z) > r) continue;
      out.push({ k: b.k, x: b.x, z: b.z, y: null, own: true, entry: b });
    }
    return out;
  }
  const bedAt = (x, z) => {
    let best = null, bd = REACH;
    for (const b of bedsNear(x, z, 6)) { const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } }
    return best;
  };

  // ---------- drawing ----------
  function draw(force = false) {
    const p = getPos(), now = Date.now();
    const want = new Set();
    for (const b of bedsNear(p.x, p.z, SHOW_FAR)) {
      want.add(b.k);
      const e = b.entry;
      const g = e?.crop ? growth(e, now, farmer()) : 0;
      const look = e?.crop ? `${e.crop}|${g >= 1 ? 'ripe' : Math.floor(g * 8)}|${e.w ? 'w' : ''}` : 'empty';
      let d = drawn.get(b.k);
      if (!d) {
        const group = new THREE.Group();
        group.position.set(b.x, b.y ?? groundAt(b.x, b.z), b.z);
        if (b.own) { const soil = bedSoil(); group.add(soil); group.rotation.y = 0; }
        scene.add(group);
        d = { group, plants: null, look: null };
        drawn.set(b.k, d);
      }
      if (d.look === look && !force) continue;
      d.look = look;
      if (d.plants) { d.group.remove(d.plants); d.plants = null; }
      if (e?.crop) {
        d.plants = bedPlants(e.crop, g);
        d.plants.position.y = 0.16;
        // a watered bed is darker, wet earth
        if (e.w) {
          const wet = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.01, 2.2), new THREE.MeshStandardMaterial({ color: '#2e1e12', roughness: 0.4 }));
          wet.position.y = 0.005;
          d.plants.add(wet);
        }
        d.group.add(d.plants);
      }
    }
    for (const [k, d] of drawn) if (!want.has(k)) { scene.remove(d.group); drawn.delete(k); }
  }

  // ---------- using a bed ----------
  function seedsInBag() {
    const out = [];
    for (const e of game.character.inventory) if (SEEDS[e.id] && !out.includes(e.id)) out.push(e.id);
    return out;
  }
  function plant(bed, seedId) {
    const crop = SEEDS[seedId];
    if (!crop || !bed) return false;
    if (bed.entry?.crop) { say(`This bed already has ${CROPS[bed.entry.crop].name.toLowerCase()} in it`, 'note'); return false; }
    if (!bed.own && mine().length >= MAX_BEDS) { say(`You have ${MAX_BEDS} beds growing already. Harvest some first`, 'hurt'); return false; }
    if (!game.giveAway(seedId)) { say(`You have no ${ITEMS[seedId].name}`, 'hurt'); return false; }
    const now = Date.now();
    if (bed.entry) Object.assign(bed.entry, { crop, at: now, w: 0 });
    else mine().push({ k: bed.k, x: bed.x, z: bed.z, crop, at: now, w: 0 });
    saved();
    floatText('🌱', new THREE.Vector3(bed.x, (bed.y ?? groundAt(bed.x, bed.z)) + 0.8, bed.z), 'exp');
    say(`You plant ${CROPS[crop].name.toLowerCase()}. Ripe in about ${minsLeft({ crop, at: now }, now, farmer())} minutes${game.has('watering_can_full') ? '. Press E again to water it' : ' (water it to grow faster)'}`, 'exp');
    draw(true);
    return true;
  }
  function harvest(bed) {
    const e = bed.entry, c = CROPS[e.crop];
    const [lo, hi] = c.n;
    const n = lo + Math.floor(Math.random() * (hi - lo + 1)) + (farmer() ? 2 : 0);
    const got = [[c.gives, n]];
    if (c.hay) got.push(['hay', 1 + Math.floor(Math.random() * 2)]);
    if (Math.random() < SEED_BACK) got.push([c.seed, 1]);
    for (const [id, k] of got) game.addItem(id, k);
    if (bed.own) Object.assign(e, { crop: null, at: 0, w: 0 });
    else game.character.crops = mine().filter((b) => b !== e);
    saved();
    floatText(`+${n} ${ITEMS[c.gives].name}`, new THREE.Vector3(bed.x, (bed.y ?? groundAt(bed.x, bed.z)) + 1, bed.z), 'exp');
    say(`You harvest the ${c.name.toLowerCase()}: ${got.map(([id, k]) => `${k} ${ITEMS[id].name}`).join(', ')}${farmer() ? ' (a Farmer picks two more)' : ''}`, 'exp');
    draw(true);
  }
  function water(bed) {
    const e = bed.entry;
    if (!game.giveAway('watering_can_full')) return false;
    game.addItem('watering_can', 1);
    e.w = Date.now();
    saved();
    floatText('💧', new THREE.Vector3(bed.x, (bed.y ?? groundAt(bed.x, bed.z)) + 0.8, bed.z), 'note');
    say(`You water the ${CROPS[e.crop].name.toLowerCase()}. Ripe in about ${minsLeft(e, Date.now(), farmer())} minutes now`, 'exp');
    draw(true);
    return true;
  }
  function useBed(bed) {
    const e = bed.entry;
    if (!e?.crop) {
      const seeds = seedsInBag();
      if (!seeds.length) { say('An empty bed. Buy seeds at the Farm Stand, then press E here to plant them', 'note'); return; }
      if (seeds.length === 1) { plant(bed, seeds[0]); return; }
      chosenBed = bed;
      onEvent?.('plant', { seeds: seeds.map((id) => ({ id, name: ITEMS[id].name, crop: CROPS[SEEDS[id]].name, mins: CROPS[SEEDS[id]].mins })) });
      return;
    }
    const g = growth(e, Date.now(), farmer());
    if (g >= 1) { harvest(bed); return; }
    if (!e.w && game.has('watering_can_full')) { water(bed); return; }
    const left = minsLeft(e, Date.now(), farmer());
    say(`${CROPS[e.crop].name}: ${stageWord(g).toLowerCase()}, ripe in about ${left} minute${left === 1 ? '' : 's'}${e.w ? ' (watered)' : game.has('watering_can') ? '. Fill your watering can at water to make it grow faster' : ''}`, 'note');
  }

  // ---------- digging a bed on your own land ----------
  function plotUnder(x, z) {
    const ix = Math.floor(x / PLOT), iz = Math.floor(z / PLOT);
    return myFarmPlots().find((p) => p.ix === ix && p.iz === iz) || null;
  }
  function dig() {
    const p = getPos(), h = getHeading();
    const fx = p.x + Math.sin(h) * 1.6, fz = p.z + Math.cos(h) * 1.6;
    const plot = plotUnder(fx, fz);
    if (!plot) return false;
    if (!game.has('hoe')) { say('This is your Farm land. Buy a Hoe at a Farm Stand to dig beds here', 'note'); return true; }
    const cells = Math.floor(PLOT / BED_GRID), pad = (PLOT - cells * BED_GRID) / 2;
    const gx = Math.floor((fx - plot.ix * PLOT - pad) / BED_GRID), gz = Math.floor((fz - plot.iz * PLOT - pad) / BED_GRID);
    if (gx < 0 || gz < 0 || gx >= cells || gz >= cells) { say('Too close to the edge of your land for a bed', 'note'); return true; }
    const k = `own:${plot.ix},${plot.iz}:${gx},${gz}`;
    if (mine().some((b) => b.k === k)) return false;
    if (mine().length >= MAX_BEDS) { say(`You have ${MAX_BEDS} beds already`, 'hurt'); return true; }
    const x = plot.ix * PLOT + pad + (gx + 0.5) * BED_GRID, z = plot.iz * PLOT + pad + (gz + 0.5) * BED_GRID;
    mine().push({ k, x, z, crop: null, at: 0, w: 0 });
    saved();
    say(`You dig a new bed. ${seedsInBag().length ? 'Press E by it to plant your seeds' : 'Buy seeds at a Farm Stand to plant it'}`, 'exp');
    draw(true);
    return true;
  }

  // ---------- filling the watering can ----------
  function waterNear(x, z) {
    if (nearWater(x, z)) return true;
    return farmTroughs().some((t) => Math.hypot(t.x - x, t.z - z) < 2.6);
  }
  function fillCan() {
    if (!game.giveAway('watering_can')) return false;
    game.addItem('watering_can_full', 1);
    saved();
    say('You fill your watering can. Press E by a growing bed to water it', 'note');
    return true;
  }

  // ---------- E ----------
  // (before the animals and the farm folk: a bed beside you, or filling the can at water)
  function interactFirst() {
    const p = getPos();
    const bed = bedAt(p.x, p.z);
    if (bed) { useBed(bed); return true; }
    return game.has('watering_can') && waterNear(p.x, p.z) && fillCan();
  }
  // (last of all: dig a bed on your own Farm land)
  const interact = () => dig();
  function tapTargets(list) {
    const p = getPos();
    for (const b of bedsNear(p.x, p.z, 12)) list.push([b.x, (b.y ?? groundAt(b.x, b.z)) + 0.4, b.z, REACH + 0.6, () => useBed(b)]);
  }
  // from the bag, or the pop's buttons: plant these seeds in the bed beside you
  function plantSeed(seedId) {
    const p = getPos();
    const bed = chosenBed && Math.hypot(chosenBed.x - p.x, chosenBed.z - p.z) < REACH + 1 ? chosenBed : bedAt(p.x, p.z);
    chosenBed = null;
    if (!bed) { say("Stand by an empty bed (a farm's visitors' beds, or one you dug on your Farm land) to plant", 'note'); return 'none'; }
    return plant(bedAt(bed.x, bed.z) || bed, seedId) ? 'ok' : 'no';
  }

  function tick(t) {
    if (t - lastDraw > 2) { lastDraw = t; draw(); }
  }

  return {
    interact, interactFirst, tapTargets, plantSeed, tick, redraw: () => draw(true),
    clear() { for (const d of drawn.values()) scene.remove(d.group); drawn.clear(); },
    beds: () => mine().map((b) => ({ ...b, grown: b.crop ? growth(b, Date.now(), farmer()) : 0 })),
  };
}

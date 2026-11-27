// The playable world: the whole map as streamed 3D land, your character, monsters, and a third-person camera.
import * as THREE from 'three';
import { GlowLight, lightPool } from './lightpool.js';
import { createLand } from './land.js';
import { pickQuality, createSmoothness, isMobile } from './quality.js';
import { setLeanDetail } from './merge.js';
import { createSky, HORIZON } from './sky.js';
import { buildSpawn } from './spawn.js';
import { buildCity, buildVillage, setCityDetail } from './city.js';
import { GUILD_HALL_LEVEL } from '../data/guildcard.mjs';
import { buildInterior } from './interiors.js';
import { mayEnterCastle, castleDay } from '../data/interiors.mjs';
import { buildCave } from './caves.js';
import { createCreatures, KINDS, monsterHit, GOBLIN_LINE } from './creatures.js';
import { buildMobVillage } from './mobvillage.js';
import { startWalkBuild } from './buildwalk.js';
import { VILLAGES_AT_ONCE, VILLAGE_RETURNS_MS, VILLAGE_NEAR, VILLAGE_KIND, VILLAGE_SIZES, pickSize, newVillage, villageName, villageCleared, villageLoot } from '../data/mobvillages.mjs';
import { createSkillFx } from './skillfx.js';
import { moveFor } from './skillmoves.js';
import { tickWind } from './trees.js';
import { codeFor, actionFor, keyName, isHeld, mouseCode } from '../data/controls.mjs';
import { buildDepths } from './depths.js';
import { buildPortal } from './portal.js';
import { buildPieces, pieceColliders, storeyY } from './buildings.js';
import { allPortals, nearestPortal } from '../data/portals.mjs';
import { allCastles, KING_RETURNS_MS } from '../data/kings.mjs';
import { buildKingCastle } from './kingcastle.js';
import { allWonders } from '../data/wonders.mjs';
import { buildWonder } from './wonders.js';
import { CELL } from '../data/building.mjs';
import { caveById, THEMES, chestLoot, bossLevel, caveOres, pickOre, SIZES } from '../data/depths.mjs';
import { BREAKABLE, breakNeeds } from './scenery.js';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { createOthers } from './others.js';
import { updateCrowd, setCrowdFar } from '../characters/crowd.js';
import { wearGear } from '../characters/gear.js';
import { allLairs, BEASTS } from '../data/beasts.mjs';
import { heightAt, surfaceAt, safeZoneAt, sample, placesWithPositions, regionName, WORLD_BOUNDS, setPreparedPlots, PLOT, setUnderground, CITY_R } from '../data/world-layout.mjs';
import { createPlots } from './plots.js';
import { gameTime, now as realmNow } from '../data/clock.mjs';
import { RACES, restCap, killExpScale, EVOLUTIONS } from '../data/game-data.mjs';
import { SPELLS, spellPower, spellName, darkSpells, SELF_KINDS, DARK_SPELL_POWER } from '../data/spells.mjs';
import { skyCard } from './skycard.js';
import { BODYGUARDS, guardHit } from '../data/hire.mjs';
import { setSettledLand, wildLevelAt } from '../data/wilds.mjs';
import { ITEMS, weaponReach, weaponEffect, EFFECTS, MARKETS, stoneChance, randomStone } from '../data/items.mjs';
import { ageOf, isChild, parentAlive, ceremonyDue, CEREMONY_SHOW_MS } from '../data/birth.mjs';
import { mayEnter, cityPass, PASS_NAME } from '../data/citypass.mjs';
import { rampAt, RAMP_WALL, INNER_R, tierAt } from '../data/citylevels.mjs';
const GATHER_MS = 3 * 60 * 1000; // how long the townsfolk stay round the shrine after a new card goes up
import { money } from '../data/money.mjs';
import { howOf, canHarvest, harvest } from './deaths.js';
import { createHusbandry } from './husbandry.js';
import { createOil } from './oil.js';
import { createCrops } from './crops.js';
import { createRiding, poseRide } from './riding.js';
import { createHatchery } from './hatchery.js';
import { BEAST_TAME } from '../data/mounts.mjs';
import { RIDE_FATIGUE } from '../data/mounts.mjs';
import { allFarms } from '../data/farms.mjs';
import { HUNGER_DRAIN, HUNGRY, STARVE_HIT, STARVE_FLOOR } from '../data/hunger.mjs';
import { createPractice } from './practice.js';

const WALK = 3.4;   // metres per second, a brisk game walking pace
const RUN = 8;
const SWIM = 0.45;  // share of walking speed while swimming
const TURN = 9;     // how quickly you turn to face where you're going
const STEER = 1.2;  // radians a second you curve while walking forward and pressing left or right
const STEER_RUN = 0.9;

// `game` is the progress object (HP, bag, gear). `onEvent(type, data)` reports kills, pickups,
// defeat and level-ups to the page.
export function startWorld(canvas, character, { game, onSaveLocation, onKey, onArea, onEvent, onPlot, onMouseFreed, onView, windowOpen, view } = {}) {
  allCastles(); // levels the ground under the Monster Kings' castles before any land is built
  allFarms(); // ...and under the farms outside the towns
  let quality = pickQuality(view?.graphics);
  setLeanDetail(isMobile()); // phones skip the cities' smallest parts (see merge.js)
  // (smoothing the edges is chosen once, as the page starts: it can't change later)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.key !== 'low', logarithmicDepthBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // If the phone takes the graphics away (low on memory, or the app was in the background), wait
  // for them to come back instead of crashing; if they don't come back soon, reload the page.
  let glLost = null;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // (asks the browser to give the graphics back)
    onEvent?.('graphicsLost');
    clearTimeout(glLost);
    glLost = setTimeout(() => onEvent?.('graphicsGone'), 6000);
  });
  canvas.addEventListener('webglcontextrestored', () => { clearTimeout(glLost); glLost = null; onEvent?.('graphicsBack'); });

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(HORIZON, quality.fog);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.2, 40000);
  // the lamps, fires and glows near you share a few real lights (see lightpool.js)
  const glowLights = lightPool(scene, camera, quality.lights);

  // Light: warm afternoon sun, sky fill, and a sun shadow that follows the player
  const sunDir = new THREE.Vector3(60, 90, 40).normalize();
  const sky = createSky(scene, renderer, sunDir);
  const hemi = new THREE.HemisphereLight('#dfeaff', '#4a5a30', 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d0', 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  const land = createLand(scene);
  // Graphics quality (see quality.js): sharpness, shadows, how far you see, and a frame cap on phones
  // On Automatic the sharpness also follows how smoothly the game runs (see createSmoothness)
  const smooth = createSmoothness();
  const sharpness = () => Math.min(window.devicePixelRatio, quality.pixelRatio) * (quality.auto ? smooth.scale : 1);
  function applyQuality(q) {
    quality = q;
    smooth.reset();
    renderer.setPixelRatio(sharpness());
    setCrowdFar(q.crowdFar);
    setCityDetail(q.detailFar, q.cityFar);
    sun.castShadow = q.shadows;
    glowLights.setSize(q.lights);
    if (sun.shadow.mapSize.x !== q.shadowSize) { sun.shadow.mapSize.set(q.shadowSize, q.shadowSize); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    if (!depth && !inside) scene.fog.density = q.fog;
    land.setQuality(q);
  }
  const colliders = land.colliders;

  // Waystone shrines (the spawn and each homeland) and caves, built when you come near
  const sites = placesWithPositions().map((p) => ({ place: p, built: null }));
  // Portal stones, built when you come near
  const portals = allPortals().map((p) => ({ p, built: null }));
  let atPortal = null;
  function updatePortals(x, z) {
    for (const q of portals) {
      const d = Math.hypot(x - q.p.x, z - q.p.z);
      if (d < 900 && !q.built) { q.built = buildPortal(q.p); scene.add(q.built.group); colliders.add(q.built.solid); }
      else if (d > 1200 && q.built) { scene.remove(q.built.group); colliders.remove(q.built.solid); q.built = null; }
    }
  }
  // The Monster Kings' castles, built when you come near, with their courts inside
  const castles = allCastles().map((c) => ({ c, built: null, court: null }));
  let courts = [];
  function updateCastles(x, z) {
    for (const q of castles) {
      const d = Math.hypot(x - q.c.x, z - q.c.z);
      if (d < 1100 && !q.built) {
        // a palace the size of half a city, in the King's own style (see kingcastle.js)
        const k = buildKingCastle(q.c);
        scene.add(k.group); colliders.add(k.solid);
        q.built = { group: k.group, solid: k.solid, floorAt: k.floorAt, spots: k.spots };
        q.court = null;
        seatCourt(q);
      } else if (d > 1400 && q.built) {
        scene.remove(q.built.group); colliders.remove(q.built.solid);
        creatures?.removeWhere((m) => m.site === `castle-${q.c.race}`);
        q.built = null; q.court = null;
      }
    }
  }
  // The wonders of the realm (one in every land, see data/wonders.mjs), built when you come within sight
  const wonders = allWonders().map((w) => ({ w, built: null, seen: false }));
  function updateWonders(x, z) {
    for (const q of wonders) {
      const d = Math.hypot(x - q.w.x, z - q.w.z);
      if (d < 2500 && !q.built) { q.built = buildWonder(q.w); scene.add(q.built.group); colliders.add(q.built.solid); }
      else if (d > 3000 && q.built) { scene.remove(q.built.group); colliders.remove(q.built.solid); q.built = null; }
    }
  }
  // put the King, the Overlords and the guards in their places (once per visit)
  function seatCourt(q) {
    const court = courts.find((k) => k.race === q.c.race);
    if (!q.built || !court || !creatures || q.court) return;
    q.court = court;
    const { x, z, race, title } = q.c;
    const site = `castle-${race}`;
    const extra = (more) => ({ keep: true, site, angry: false, ...more });
    // guards outside the gate, along the avenue and at the Throne Hall's doors
    const S = q.built.spots;
    for (const [gx, gz] of S.guards) {
      creatures.spawnAt(`guard_${race}`, 400 + Math.round(Math.random() * 200), x + gx, z + gz, extra({ guard: { heading: 0 }, title: 'Royal Guard' }));
    }
    // the Overlords stand either side of the carpet before the throne
    court.overlords.forEach((o, i) => {
      const [ox, oz] = S.overlords[i] || [(i % 2 ? 1 : -1) * 6, -62 + Math.floor(i / 2) * 9];
      creatures.spawnAt(`overlord_${race}`, o.level, x + ox, z + oz, extra({ guard: { heading: 0 }, boss: true, title: o.name }));
    });
    // the King sits the throne, unless it is empty or a player wears the crown
    if (court.king?.npc && Date.now() - (court.slainAt || 0) >= KING_RETURNS_MS) {
      const lvl = court.king.level;
      const king = creatures.spawnAt(`king_${race}`, lvl, x + S.king[0], z + S.king[1], extra({ guard: { heading: 0 }, boss: true, title: `${court.king.name}, ${title}`, maxHp: Math.round((8 + lvl * 3.5) * 12), hp: Math.round((8 + lvl * 3.5) * 12) }));
      king.onDeath = () => onEvent?.('king-slain', { race, name: court.king.name, title });
    }
  }
  // your family's house (its parents stand at the door), and which cities have their bridges raised
  const homeOf = () => { const f = character.child?.family || character.family; return f ? { city: f.city, house: f.house, race: f.race, dead: [0, 1].filter((j) => !parentAlive(game?.character || character, j)) } : null; };
  let cityRaised = {};
  function setCityGates(raised = {}) {
    cityRaised = { ...raised };
    for (const s of sites) if (s.built?.setRaised) s.built.setRaised(!!cityRaised[s.place.id], colliders);
  }
  // who owns the houses for sale in each great city: { city: { house: owner } }
  let cityHomes = {};
  function setHomes(list = []) {
    cityHomes = {};
    for (const h of list) (cityHomes[h.city] ||= {})[h.house] = h.owner;
    for (const s of sites) if (s.place.city && s.built?.setOwners) s.built.setOwners(cityHomes[s.place.id] || {});
  }
  const builtCities = () => sites.filter((s) => s.place.city && s.built?.npcs);
  // the cards of new Ceremonies, hanging in the sky over each city's shrine (the latest one per city)
  const skyCards = new Map(); // city id -> { at, card, place }
  let gatherAt = -1;
  function setCeremonies(list = []) {
    const latest = {};
    for (const c of list) if (realmNow() - c.at < CEREMONY_SHOW_MS && (!latest[c.city] || latest[c.city].at < c.at)) latest[c.city] = c;
    for (const [city, k] of skyCards) if (!latest[city] || latest[city].at !== k.at) { scene.remove(k.card.group); k.card.dispose(); skyCards.delete(city); }
    for (const [city, c] of Object.entries(latest)) {
      if (skyCards.has(city)) continue;
      const place = placesWithPositions().find((p) => p.id === city);
      if (!place) continue;
      const card = skyCard(c);
      card.group.position.set(place.x, heightAt(place.x, place.z), place.z);
      scene.add(card.group);
      skyCards.set(city, { at: c.at, card, place });
    }
  }
  // whether you stand at the shrine in the middle of a city (where Ceremonies are held)
  const atShrine = () => !inside && !depth && builtCities().some((s) => Math.hypot(pos.x - s.place.x, pos.z - s.place.z) < 8);
  // clicking or tapping a townsperson (within 14 m) talks to them
  const talkV = new THREE.Vector3();
  function talkAt(sx, sy) {
    if (inside || depth || dead) return false;
    const r = canvas.getBoundingClientRect();
    let best = null, bd = 46;
    for (const s of builtCities()) for (const n of s.built.npcs) {
      if (Math.hypot(n.x - pos.x, n.z - pos.z) > 14) continue;
      talkV.set(n.x, groundAt(n.x, n.z, -Infinity) + 1.1, n.z).project(camera);
      if (talkV.z > 1) continue;
      const d = Math.hypot(r.left + (talkV.x + 1) / 2 * r.width - sx, r.top + (1 - talkV.y) / 2 * r.height - sy);
      if (d < bd) { bd = d; best = n; }
    }
    if (best) talkTo(best);
    return !!best;
  }
  // the house doors near (x, z) that open with a click, a tap or E (a shop's door takes you inside instead)
  function doorsNear(x, z, r) {
    const out = [];
    for (const s of sites) for (const d of s.built?.doors?.near(x, z, r) || []) {
      if ((s.built.shops || []).some((q) => Math.hypot(q.x - d.x, q.z - d.z) < 3.5)) continue;
      out.push({ d, keeper: s.built.doors });
    }
    return out;
  }
  const useDoor = ({ d, keeper }) => keeper.toggle(d, clock.elapsedTime);
  // a click on a house door (with the mouse): open it or shut it
  function clickDoor(sx, sy) {
    if (inside || depth) return false;
    const r = canvas.getBoundingClientRect();
    let best = null, bd = 60;
    for (const it of doorsNear(pos.x, pos.z, 14)) {
      tapV.set(it.d.x, it.d.y, it.d.z).project(camera);
      if (tapV.z > 1) continue;
      const dd = Math.hypot(r.left + (tapV.x + 1) / 2 * r.width - sx, r.top + (1 - tapV.y) / 2 * r.height - sy);
      if (dd < bd) { bd = dd; best = it; }
    }
    if (!best) return false;
    if (Math.hypot(best.d.x - pos.x, best.d.z - pos.z) > 6) { say('Walk a little closer to the door', 'note'); return true; }
    useDoor(best);
    return true;
  }
  // Phones and tablets: tap a door, a counter, a chair, a bed or a chest to use it (instead of E).
  // Each thing you can use is a point on screen; a tap close to one uses it if you are near enough.
  const tapV = new THREE.Vector3();
  function tapUse(sx, sy) {
    if (dead || !game) return false;
    const list = []; // [x, y, z, reach, use]
    const g = (x, z) => groundAt(x, z, pos.y);
    if (inside) {
      const b = inside.built;
      if (b.counter) list.push([b.counter.x, b.counter.y + 1.1, b.counter.z, 2.6, useIndoors]);
      for (const q of b.spots || []) list.push([q.x, q.y + 1, q.z, q.r, useIndoors]);
      for (const r of b.bedrooms || []) list.push([r.bed.x, r.bed.y + 0.3, r.bed.z, 1.9, useIndoors]);
      for (const r of b.rooms || []) list.push([r.door.x, pos.y + 1.2, r.door.z, 2, useIndoors]);
      for (const q of b.seats || []) if (Math.abs(q.y - pos.y) < 1) list.push([q.x, q.y + 0.5, q.z, 2.4, () => sitDown(q)]);
      list.push([b.exit.x, pos.y + 1.2, b.exit.z, 3, () => leaveBuilding()]);
    } else if (!depth) {
      for (const s of sites) for (const shop of s.built?.shops || []) {
        if (Math.abs(shop.x - pos.x) > 14 || Math.abs(shop.z - pos.z) > 14) continue;
        list.push([shop.x, g(shop.x, shop.z) + 1.4, shop.z, 4.5, () => (shop.building ? enterBuilding(shop) : onEvent?.(shop.id === 'guild' ? 'guild' : 'market', shop.id))]);
      }
      for (const it of doorsNear(pos.x, pos.z, 14)) list.push([it.d.x, it.d.y, it.d.z, 6, () => useDoor(it)]);
    }
    if (!inside) for (const m of creatures?.list || []) if (canHarvest(m) && !m.kind.animal && Math.hypot(m.x - pos.x, m.z - pos.z) < 12) list.push([m.x, m.y + 0.3, m.z, 2.6, () => harvestBody(m)]);
    if (!inside && !depth) { husbandry?.tapTargets(list); crops?.tapTargets(list); const mt = riding?.mount(); if (mt && !mt.riding) list.push([mt.x, g(mt.x, mt.z) + 1.3, mt.z, 3.2, () => riding.toggle(mt.item)]); hatchery?.tapTargets(list); const worn = creatures?.downedNear(pos.x, pos.z, 40); if (worn && !riding?.riding) list.push([worn.x, worn.y + 2, worn.z, worn.radius + 2, () => (Math.hypot(worn.x - pos.x, worn.z - pos.z) - worn.radius < 4 ? tameBeast(worn) : say('Walk up to it to tame it', 'note'))]); }
    for (const e of colliders.near(pos.x, pos.z, 12)) if (e.kind === 'chest') list.push([e.x, (e.y ?? g(e.x, e.z)) + 0.6, e.z, e.r + 1.6, () => openChest(e)]);
    const r = canvas.getBoundingClientRect();
    let best = null, bd = 70;
    for (const it of list) {
      tapV.set(it[0], it[1], it[2]).project(camera);
      if (tapV.z > 1) continue;
      const d = Math.hypot(r.left + (tapV.x + 1) / 2 * r.width - sx, r.top + (1 - tapV.y) / 2 * r.height - sy);
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) return false;
    if (Math.hypot(best[0] - pos.x, best[2] - pos.z) > best[3]) { say('Walk a little closer, then tap it', 'note'); return true; }
    if (sitting && best[4] !== useIndoors) standUp();
    best[4]();
    return true;
  }
  function talkTo(n) { n.talkUntil = clock.elapsedTime + 6; onEvent?.('npc', n); }
  let touched = null; // the townsperson you last walked into (they talk once, until you step away)
  // townsfolk close enough to talk to
  function npcNear(x, z, r = 2.4) {
    for (const s of builtCities()) for (const n of s.built.npcs) if (Math.hypot(n.x - x, n.z - z) < r) return n;
    return null;
  }
  // Something solid (a wall, a column, a post) in the way of a body of radius r at (x, z)
  // (things up on an upper storey and low steps don't count)
  // Gives back what is in the way (or null). With `y` (the feet's height) something standing on
  // raised ground, like a farm's fence on its levelled yard, counts when it is at that height.
  function blockedAt(x, z, r, y) {
    for (const e of colliders.near(x, z, r)) {
      if (e.r <= 0 || e.step || e.camOnly || e.kind === 'chest') continue;
      if (e.y !== undefined && (y === undefined || y >= e.y + (e.height || 8) - 0.4 || y + 1.2 < e.y)) continue;
      if (Math.hypot(e.x - x, e.z - z) < e.r + r) return e;
    }
    return null;
  }
  // A wooden part (a stretch of fence) knocked down: it falls over and stops being solid, and is
  // put back up after a few minutes
  const PART_MENDS = 5 * 60 * 1000;
  function breakPart(part) {
    part.broken = true;
    for (const e of part.solid) { e.r0 = e.r; e.r = 0; }
    for (const o of part.meshes) { o.userData.up ??= { rx: o.rotation.x, rz: o.rotation.z, y: o.position.y }; o.rotation.z += (Math.random() - 0.5) * 2.6; o.rotation.x += (Math.random() - 0.5) * 0.6; o.position.y = Math.min(o.position.y, 0.12); }
    setTimeout(() => {
      part.broken = false; part.hp = part.maxHp;
      for (const e of part.solid) e.r = e.r0 ?? e.r;
      for (const o of part.meshes) { const u = o.userData.up; if (u) { o.rotation.x = u.rx; o.rotation.z = u.rz; o.position.y = u.y; } }
    }, PART_MENDS);
  }
  // People are solid too: you can't walk through townsfolk, your helper, your bodyguard or a monster
  function pushOffFolk(p, r) {
    const off = (x, z, rr) => {
      const ox = p.x - x, oz = p.z - z, d = Math.hypot(ox, oz), min = r + rr;
      if (d < min && d > 1e-4) { p.x = x + (ox / d) * min; p.z = z + (oz / d) * min; }
    };
    if (!inside && !depth) for (const s of builtCities()) {
      if (Math.hypot(s.place.x - p.x, s.place.z - p.z) > 400) continue;
      for (const n of s.built.npcs) if (Math.abs(n.x - p.x) < 2 && Math.abs(n.z - p.z) < 2) off(n.x, n.z, n.small ? 0.22 : 0.32);
    }
    if (helper && helper.body.visible !== false) off(helper.x, helper.z, 0.32);
    if (guard && !inside && !depth) off(guard.x, guard.z, 0.34);
    for (const m of creatures?.list || []) if (!m.dead && m.hp > 0 && Math.abs(m.x - p.x) < 6 && Math.abs(m.z - p.z) < 6) off(m.x, m.z, m.radius * 0.8);
    // other players close by: you bump into them instead of walking through
    for (const b of others?.near(p.x, p.z, 2) || []) if (Math.abs(b.y - pos.y) < 1.6) off(b.x, b.z, 0.34);
  }
  // a helper or bodyguard: kept out of walls and out of you (tried in steps, so it slides along)
  function stepFollower(f, nx, nz) {
    const t = { x: nx, z: nz };
    colliders.push(t, 0.32);
    const ox = t.x - pos.x, oz = t.z - pos.z, d = Math.hypot(ox, oz), min = bodyR + 0.34;
    if (d < min && d > 1e-4) { t.x = pos.x + (ox / d) * min; t.z = pos.z + (oz / d) * min; }
    if (blockedAt(t.x, t.z, 0.25)) {
      if (!blockedAt(t.x, f.z, 0.25)) t.z = f.z;
      else if (!blockedAt(f.x, t.z, 0.25)) t.x = f.x;
      else return;
    }
    f.x = t.x; f.z = t.z;
  }
  // the school whose Academy's training floor you stand on (inside, by its teacher), or null
  function trainingAt() {
    const tr = inside?.built.training;
    if (tr && Math.hypot(tr.x - pos.x, tr.z - pos.z) < tr.r) return inside.shop.school;
    return null;
  }
  function updateSites(x, z) {
    updatePortals(x, z);
    updateCastles(x, z);
    updateWonders(x, z);
    for (const s of sites) {
      const d = Math.hypot(x - s.place.x, z - s.place.z);
      if (d < 1000 && !s.built) {
        s.built = s.place.cave ? buildCave(s.place) : s.place.city ? buildCity(s.place, { home: homeOf() }) : s.place.village ? buildVillage(s.place) : buildSpawn(s.place);
        s.built.group.name ||= s.place.id || 'place';
        scene.add(s.built.group);
        if (s.built.solid) colliders.add(s.built.solid);
        if (cityRaised[s.place.id]) s.built.setRaised?.(true, colliders);
        if (s.place.city) s.built.setOwners?.(cityHomes[s.place.id] || {});
        if (s.place.cave) postGuards(s);
      } else if (d > 1400 && s.built) {
        s.built.setRaised?.(false, colliders);
        scene.remove(s.built.group);
        if (s.built.solid) colliders.remove(s.built.solid);
        if (s.place.cave) creatures?.removeWhere((m) => m.site === s.place.id);
        s.built = null;
      }
    }
  }
  const insideCave = (x, z) => sites.some((s) => s.built?.inside?.(x, z));
  // Goblin dens keep guards at the door while their boss is home
  function postGuards(s) {
    const cave = caveById(s.place.id);
    const kind = cave && THEMES[cave.theme].guards;
    if (!kind || !creatures || !game?.bossHome(cave.id)) return;
    const lvl = game.character.level;
    s.built.guardSpots.forEach((g, i) => {
      if (i === 2 && Math.random() < 0.5) return;
      creatures.spawnAt(kind, lvl + Math.round(Math.random() * 2 - 1), g.x, g.z, { guard: { heading: g.heading }, keep: true, site: s.place.id, angry: true, title: `${KINDS[kind].name} Guard` });
    });
  }

  // Land plots: the buying grid and owned land
  const plots = createPlots(scene);
  let prepared = new Set();

  // Other players close by (the game reports where you are and hears who is near: see main.js)
  const others = createOthers(scene, {
    // another player's swing, skill or spell, acted out on their body
    pose(o, a) {
      const rig = o.body.userData.rig, h = o.body.userData.height || 1.8;
      if (!rig?.root) return;
      if (a.kind === 'swing') poseAttack(rig, Math.min(1, a.t / a.dur), a.armed, a.bow, a.blade, h);
      else poseSkill(rig, a, { bodyH: h, avatar: o.body, heading: o.body.rotation.y });
    },
  });

  // Your character, wearing your gear
  let avatar = buildCharacter({ race: character.race, form: character.form, stage: character.stage || 0, look: character.look, age: ageOf(character) });
  if (game) wearGear(avatar, game.worn());
  scene.add(avatar);
  const loc = character.location || {};
  const pos = new THREE.Vector3(loc.x ?? 0, 0, loc.z ?? 6);
  let heading = loc.heading ?? Math.PI;
  let velY = 0;
  let airborne = false;
  let fallFrom = 0; // the height a fall started from
  let depth = null; // { cave, built, back, leftExit } while you're underground
  let inside = null; // { built, back, shop, leftExit } while you're inside a building
  const FALL_SAFE = 4; // metres you can drop without getting hurt
  let creatures = null; // made below; caves built before then get their guards later
  let husbandry = null; // hunting, cooking and the farms (made below, with the creatures)
  let crops = null, riding = null, hatchery = null; // growing your own, and your horse (made with husbandry)
  let oil = null; // oil seeps, the Oil Companies' derricks and your test pits (see oil.js)
  let myFarmPlots = []; // your own plots set to Farm, where you can dig beds
  let runningNow = false; // (the run key held, for the animals to notice)
  applyQuality(quality);
  updateSites(pos.x, pos.z);
  land.update(pos.x, pos.z, Infinity); // build the land around you before the clouds part

  // The ground under a point, counting the shrine platforms
  const solidTops = new Map(); // "cellX,cellZ" -> heights of the foundations and floors built there
  function groundAt(x, z, fromY = pos?.y ?? -Infinity) {
    // underground, the cave floor is exact; up top, the ground as drawn (see surfaceAt)
    let g = inside?.built.standAt ? inside.built.standAt(x, z, fromY) : depth || inside ? heightAt(x, z) : surfaceAt(x, z);
    for (const s of sites) {
      if (!s.built || s.place.cave) continue;
      if (Math.hypot(x - s.place.x, z - s.place.z) < 7.4) g = Math.max(g, s.place.y + 0.45);
    }
    // built foundations and floors are solid: you stand on the highest one you can step up to
    if (!depth && !inside) {
      const tops = solidTops.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
      if (tops) {
        const reach = Math.max(g, fromY) + 0.8;
        for (const t of tops) if (t <= reach && t > g) g = t;
      }
      // low solid things you can climb onto (logs, steps), and platforms such as a city's bridges
      for (const e of colliders.near(x, z, 1)) {
        if (!e.step || Math.hypot(e.x - x, e.z - z) > e.r + 0.1) continue;
        const top = e.y + e.height;
        if (top > g && top <= Math.max(g, fromY) + 0.8) g = top;
      }
      for (const s of sites) { const top = s.built?.deckAt?.(x, z); if (top !== undefined && top > g && top <= Math.max(g, fromY) + 0.8) g = top; }
      // the floors, galleries, stairs and wall walks of the Monster Kings' castles
      for (const q of castles) { const top = q.built?.floorAt?.(x, z, Math.max(g, fromY) + 0.8); if (top > g) g = top; }
    }
    return g;
  }
  pos.y = groundAt(pos.x, pos.z);
  let area = '';
  let atCave = null; // the cave you're standing in up top
  let lastArea = -10;

  const agiSpeed = 1 + Math.min(character.stats.agi * 0.003, 0.6);
  let bodyH = avatar.userData.height;
  let bodyR = Math.max(0.25, Math.min(bodyH * 0.18, 0.9));
  // A monster player switching between monster and humanoid form: a new body in the same spot
  function rebuildAvatar() {
    const was = avatar;
    avatar = buildCharacter({ race: character.race, form: character.form, stage: character.stage || 0, look: character.look, age: ageOf(character) });
    if (game) { wearGear(avatar, game.worn()); showWeapon(); }
    avatar.position.copy(was.position);
    avatar.rotation.copy(was.rotation);
    scene.remove(was);
    scene.add(avatar);
    bodyH = avatar.userData.height;
    bodyR = Math.max(0.25, Math.min(bodyH * 0.18, 0.9));
  }

  // Camera orbit
  let yaw = heading + Math.PI;
  let pitch = view?.pitch ?? 0.32;
  let dist = view?.dist ?? THREE.MathUtils.clamp(bodyH * 2.6 + 2, 3, 16);
  let camDist = dist;
  // 'free': you turn the camera yourself and move relative to it. 'follow': it stays behind your body.
  let cameraMode = view?.camera === 'follow' ? 'follow' : 'free';
  // Free camera while the mouse isn't captured (Free Move mouse, or a touch screen): as you walk,
  // the camera swings round behind you on its own, unless the player turned that off in Settings
  let camFollow = view?.camFollow !== 'off';
  // Controls → Sensitivity: how fast the mouse, a finger and the keys turn the camera, upside-down
  // looking, how fast the wheel zooms, and how wide the camera sees (field of view, in degrees)
  const feel = { mouse: 1, touch: 1, invertY: false, zoom: 1, turn: 1, fov: 60 };
  function setFeel(f = {}) {
    const n = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
    feel.mouse = n(f.mouse, 0.1, 4, 1); feel.touch = n(f.touch, 0.1, 4, 1); feel.zoom = n(f.zoom, 0.2, 4, 1);
    feel.turn = n(f.turn, 0.3, 3, 1); feel.fov = n(f.fov, 45, 100, 60); feel.invertY = !!f.invertY;
    if (camera.fov !== feel.fov) { camera.fov = feel.fov; camera.updateProjectionMatrix(); }
  }
  setFeel(view?.feel);
  let lookEnded = -10; // when you last let go after dragging the camera round
  // 'third': the camera is behind you. 'first': you see through your character's eyes (head hidden,
  // arms and weapon still there). Scrolling all the way in goes to first person, scrolling out comes back.
  let viewMode = view?.view === 'first' ? 'first' : 'third';
  const firstNow = () => viewMode === 'first' && !dead && !sleeping;
  // (in third person you can tilt below level too: the camera drops to the ground behind you and
  // looks up, to see the sky or a dragon overhead)
  const pitchLo = () => (firstNow() ? -1.35 : -0.95), pitchHi = () => (firstNow() ? 1.35 : 1.2);
  function setView(mode, tell) {
    viewMode = mode === 'first' ? 'first' : 'third';
    if (viewMode === 'third') { pitch = THREE.MathUtils.clamp(pitch, pitchLo(), 1.2); dist = Math.max(dist, 3); camDist = Math.min(camDist, 1.2); }
    if (tell) onView?.(viewMode);
  }

  // ---------- floating text (damage numbers, pickups) ----------
  const floatLayer = document.createElement('div');
  floatLayer.className = 'floaters';
  canvas.parentElement.appendChild(floatLayer);
  const floaters = [];
  function floatText(text, at, kind = '') {
    const el = document.createElement('div');
    el.className = `floater ${kind}`;
    el.textContent = text;
    floatLayer.appendChild(el);
    floaters.push({ el, at: at.clone(), t: 0 });
  }
  const say = (text, kind = 'note') => floatText(text, pos.clone().add(new THREE.Vector3(0, bodyH + 0.4, 0)), kind);

  // ---------- day and night ----------
  // A day of the realm is DAY_MINUTES real minutes (data/clock.mjs). The sun crosses the sky; at night a dim moon lights the land.
  let night = false, daylight = 1;
  const SUN_COLOR = new THREE.Color('#fff0d0'), MOON_COLOR = new THREE.Color('#7f98d8');
  const lightDir = new THREE.Vector3();
  function applyTime() {
    const gt = gameTime();
    night = gt.night;
    daylight = gt.daylight;
    const a = ((gt.hour - 6) / 24) * Math.PI * 2; // sunrise at 6, noon overhead
    sunDir.set(Math.cos(a), Math.sin(a), 0.35).normalize();
    // the shadow-casting light is the sun by day and the moon (opposite the sun) by night
    lightDir.copy(sunDir.y > 0 ? sunDir : sunDir.clone().negate());
    lightDir.y = Math.max(lightDir.y, 0.25);
    lightDir.normalize();
    sun.color.copy(MOON_COLOR).lerp(SUN_COLOR, daylight);
    sun.intensity = 0.35 + daylight * 2.45;
    hemi.intensity = 0.18 + daylight * 0.62;
    renderer.toneMappingExposure = 0.6 + daylight * 0.4;
    scene.fog.color.copy(sky.setTime(daylight, sunDir));
    lantern.intensity = (1 - daylight) * 6;
    if (depth) applyDark();
    if (inside) applyIndoor();
  }
  // a soft glow around you at night, so you can still see your feet
  const lantern = new GlowLight('#ffcf8a', 0, 14, 1.6);
  scene.add(lantern);

  // Torches you place light the area and keep monsters away at night
  const torchGroup = new THREE.Group();
  scene.add(torchGroup);
  const torchWood = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.9 });
  const torchFlame = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8a1a', emissiveIntensity: 3 });
  const torchLights = [];
  function drawTorches() {
    for (const o of [...torchGroup.children]) torchGroup.remove(o);
    torchLights.length = 0;
    for (const tch of game?.character.torches || []) {
      const y = heightAt(tch.x, tch.z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6), torchWood);
      post.position.set(tch.x, y + 0.75, tch.z);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 8), torchFlame);
      flame.position.set(tch.x, y + 1.62, tch.z);
      torchGroup.add(post, flame);
      torchLights.push({ x: tch.x, z: tch.z, y: y + 1.7, flame });
    }
  }
  // only the nearest few torches get a real light, to keep the frame rate up
  const torchLamps = [0, 1, 2, 3].map(() => { const l = new GlowLight('#ff9a3a', 0, 16, 1.5); scene.add(l); return l; });
  function lightTorches(t) {
    const near = torchLights.map((tl) => ({ tl, d: Math.hypot(tl.x - pos.x, tl.z - pos.z) })).sort((a, b) => a.d - b.d);
    torchLamps.forEach((l, i) => {
      const n = near[i];
      if (!n || n.d > 120) { l.intensity = 0; return; }
      l.position.set(n.tl.x, n.tl.y, n.tl.z);
      l.intensity = (1.2 - daylight * 0.8) * (8 + Math.sin(t * 13 + i) * 1.2);
    });
    for (const tl of torchLights) tl.flame.scale.y = 1 + Math.sin(t * 11 + tl.x) * 0.15;
  }
  const TORCH_SAFE = 12;
  // Your tent: a canvas ridge tent on two poles
  const tentGroup = new THREE.Group();
  scene.add(tentGroup);
  const TENT_SAFE = 6, TENT_IN = 2.6;
  function drawTent() {
    for (const o of [...tentGroup.children]) { tentGroup.remove(o); o.geometry?.dispose(); }
    const tn = game?.character.tent;
    if (!tn) return;
    const y = heightAt(tn.x, tn.z);
    const cloth = new THREE.MeshStandardMaterial({ color: '#b89a6a', roughness: 0.95, side: THREE.DoubleSide });
    // a triangular prism: 2.6 m long, 2.2 m wide, 1.7 m high
    const shape = new THREE.Shape([new THREE.Vector2(-1.1, 0), new THREE.Vector2(1.1, 0), new THREE.Vector2(0, 1.7)]);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: false }), cloth);
    body.geometry.translate(0, 0, -1.3);
    const dark = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1.1)])),
      new THREE.MeshBasicMaterial({ color: '#1a120a' }));
    dark.position.z = 1.31; // the doorway
    const pole = new THREE.MeshStandardMaterial({ color: '#5a3a22' });
    const poles = [-1.35, 1.35].map((z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.9, 6), pole); m.position.set(0, 0.95, z); return m; });
    const g = new THREE.Group();
    g.add(body, dark, ...poles);
    g.position.set(tn.x, y, tn.z);
    g.rotation.y = tn.heading || 0;
    body.castShadow = true;
    tentGroup.add(g);
  }
  const nearTent = (x, z, r) => { const tn = game?.character.tent; return !!tn && Math.hypot(tn.x - x, tn.z - z) < r; };
  function pitchTent() {
    if (!game || dead) return;
    if (inside) { say('No room for a tent in here', 'note'); return; }
    const tn = game.character.tent;
    if (tn && nearTent(pos.x, pos.z, TENT_IN + 1)) {
      const r = game.packTent();
      say(r === 'ok' ? 'Tent packed into your bag' : 'Your bag is full', r === 'ok' ? 'note' : 'hurt');
    } else {
      const r = game.pitchTent(pos.x + Math.sin(heading) * 2.5, pos.z + Math.cos(heading) * 2.5, heading + Math.PI);
      say(r === 'ok' ? (tn ? 'Tent moved here. Sleep inside with Z' : 'Tent pitched. Sleep inside with Z') : 'You have no tent. Buy one in the shop, or craft one from 8 logs.', r === 'ok' ? 'note' : 'hurt');
    }
    drawTent();
  }
  drawTent();

  // Somewhere monsters won't come at night: beside a torch, your tent, or a waystone's campfire
  function isSafe(x, z) {
    if (inside) return true;
    if (nearTent(x, z, TENT_SAFE)) return true;
    if (torchLights.some((tl) => Math.hypot(tl.x - x, tl.z - z) < TORCH_SAFE)) return true;
    if (husbandry?.nearCampfire(x, z)) return true;
    return !!safeZoneAt(x, z);
  }

  // Sleeping (Z, only somewhere safe) and collapsing from exhaustion
  let inTent = false; // asleep inside your tent: hidden, and resting faster
  let starveAcc = 0;
  let sleeping = false, collapsed = 0, fatigueAcc = 0, warnedTired = false, lastTime = -1, lastCrowd = -1;
  const resting = () => sleeping || collapsed > 0;
  function toggleSleep() {
    if (!game || dead) return;
    if (sleeping) { sleeping = false; say('You wake up', 'note'); return; }
    if (!isSafe(pos.x, pos.z)) { say('Too dangerous to sleep here. Pitch a tent (P), find a fire, or place a torch (T)', 'hurt'); return; }
    sleeping = true;
    inTent = nearTent(pos.x, pos.z, TENT_IN + 1);
    if (inTent) { const tn = game.character.tent; pos.x = tn.x; pos.z = tn.z; }
    say(inTent ? 'You crawl into your tent to sleep… (move to wake)' : 'You lie down to sleep… (move to wake)', 'note');
  }
  function placeTorch() {
    if (!game || dead) return;
    // underground, T lights a torch in your hand (or puts it out)
    if (depth) { setHolding(!holding); return; }
    if (inside) { say('The lamps are lit in here', 'note'); return; }
    // standing by one of your torches, T picks it back up
    const took = game.takeTorch(pos.x, pos.z);
    if (took !== 'none') { say(took === 'ok' ? 'Torch picked up' : 'Your bag is full', took === 'ok' ? 'note' : 'hurt'); drawTorches(); return; }
    const r = game.placeTorch(pos.x + Math.sin(heading) * 1.2, pos.z + Math.cos(heading) * 1.2);
    say(r === 'ok' ? 'Torch placed' : r === 'none' ? 'You have no torches. The shop sells them.' : 'You can only keep 10 torches lit', r === 'ok' ? 'note' : 'hurt');
    if (r === 'ok') drawTorches();
  }
  drawTorches();

  // ---------- monsters ----------
  let dead = false;
  // the powers an admin turned on (see data/staff.mjs): { fly, nodeath, speed }
  let powers = {};
  let lastHurt = -99;
  let lastFoe = null, sicOn = null, dragonCd = 0; // (your tamed dragon: what attacked you, what you set it on)
  const skillFx = createSkillFx(scene);
  creatures = createCreatures(scene, {
    // other players close by, and what is sent to them about the monsters (see creatures.js)
    getOthers: () => others.spots(),
    onNet: (k, a) => share({ k, ...a }),
    getPlayer: () => ({ x: pos.x, z: pos.z, y: pos.y, heading, radius: bodyR, dead, safe: isSafe(pos.x, pos.z), level: game?.character.level || character.level || 1, stage: game?.character.stage || 0, moving: speedNow > 1, running: runningNow && speedNow > WALK, underground: !!depth || !!inside, flying: !!riding?.flying, grudges: game?.character.grudges || null, lure: speedNow < 0.3 && !riding?.riding && !!game?.character.inventory.some((e) => ITEMS[e.id]?.feed) }),
    isNight: () => night,
    groundAt: (x, z, fromY) => groundAt(x, z, fromY),
    onAmbush(n) { say('Ambush!', 'hurt'); onEvent?.('ambush', { n }); },
    // a beast drawn to your bait, caught in your snare (or tearing free of it)
    onSnare(m, what) {
      const name = m.kind.animal?.name || m.kind.name;
      if (what === 'caught') { say(`Your snare has caught a ${name}! It is held fast for 30 seconds`, 'exp'); floatText('Snared!', new THREE.Vector3(m.x, m.y + m.height + 0.5, m.z), 'crit'); }
      else say(`The ${name} tears free of the snare!`, 'hurt');
    },
    isInsideCave: insideCave,
    blockedAt: (x, z, r, y) => (!inside && !depth ? blockedAt(x, z, r, y) : null),
    // slide a creature out of anything solid it has ended up in (walls, fences, trees, rocks)
    pushOut: (p, r) => { if (!inside && !depth) colliders.push(p, r); },
    // an animal running into something solid at speed: wooden fences can break (see farms.js)
    onCrash(m, e, speed) {
      const top = new THREE.Vector3(m.x, m.y + m.height + 0.3, m.z);
      const part = e.part;
      if (part && !part.broken) {
        const hit = Math.round(m.kind.animal.len * speed * 3);
        part.hp -= hit;
        part.shake = 0.35;
        if (part.hp <= 0) { breakPart(part); floatText('Crash!', top, 'hurt'); if (Math.hypot(m.x - pos.x, m.z - pos.z) < 40) say(`A ${m.kind.animal.name.toLowerCase()} smashes through the ${part.name || 'fence'}!`, 'note'); }
        else floatText(`-${hit}`, new THREE.Vector3(e.x, (e.y ?? m.y) + 1, e.z), 'dmg');
      } else if (speed > 7) floatText('Thud!', top, 'note');
    },
    // the great beasts (see beasts.js): a dragon sees you, the Spirit King rises, one is slain
    onBeast(m, what) {
      const name = m.kind.name;
      if (what === 'grudge') say(`The ${name} knows you: you stole its egg! It will never forget, and it comes to kill you!`, 'hurt');
      else if (what === 'notice') say(`The ${name} has seen you! ${m.kind.beast.breath ? 'Keep out of its breath' : 'It dives at you'}`, 'hurt');
      else if (what === 'rise') say('The still water of the lake begins to glow…', 'note');
      else if (what === 'greet' && !m.kind.beast.king) say('The Spirit King rises from the lake: "Walk in peace, traveller. Raise your hand against me and the lake itself will answer."', 'note');
      else if (what === 'greet' && m.kind.beast.king) say(`${name}, ${m.kind.beast.title}, comes down from the stars to look at you: "Small one. I have watched your world turn since before your cities were stone. Go in peace, or strike, and learn what the sky can do."`, 'note');
      else if (what === 'land') say(`The ${name} lands with a crash and comes at you on foot! Watch its tail`, 'hurt');
      else if (what === 'downed') say(`The ${name} sinks to the ground, worn out! Use a Dragon Bridle on it now (E beside it) to tame it, or finish it off`, 'exp');
      else if (what === 'recover') say(`The ${name} gets its breath back and takes to the sky again!`, 'hurt');
      else if (what === 'shake') {} // (said in tameBeast)
      else if (what === 'wrath') say(`${name} roars, and the sky darkens: "So be it!"`, 'hurt');
      else if (what === 'starfall') say('Stars fall from the sky! Get out of the rings of light!', 'hurt');
      else if (what === 'nova') say(`${name} gathers the light of the stars… get far away before it bursts!`, 'hurt');
      if (what === 'slain' && m.lair && game?.character.grudges?.[m.lair.id]) { delete game.character.grudges[m.lair.id]; game.touch('bag'); }
      if (what === 'slain' && m.kind.beast.king) say(`${name}, ${m.kind.beast.title}, falls from the sky! His Star Throne will stand empty for a day.`, 'exp');
      else if (what === 'slain') say(m.kind.beast.shape === 'spirit' ? 'The Spirit King sinks back into the lake. One day he will rise again' : `The ${name} crashes to the ground!`, 'exp');
    },
    // `breath`: fire, frost, storm or water from a great beast (half again as strong as a bite)
    onHitPlayer(m, breath = null) {
      if (!game || dead) return;
      const s = game.stats();
      // (the King of the Wild Dragons: his breath of the void, falling stars, and the Supernova)
      const dmg = Math.round(monsterHit(m.atk, m.level, s.def * buffed('def')) * (breath ? ({ cosmic: 1.6, star: 1.2, nova: 2.5, tail: 1.3 }[breath] ?? 1.5) : 1));
      lastHurt = clock.elapsedTime;
      lastFoe = { m, at: clock.elapsedTime }; // (your dragon turns on whatever attacks you)
      floatText(breath ? `${{ fire: '🔥', frost: '❄️', storm: '⚡', water: '🌊', cosmic: '🌌', star: '☄️', nova: '💥', tail: '💢' }[breath] || ''} -${dmg}` : `-${dmg}`, pos.clone().add(new THREE.Vector3(0, bodyH, 0)), 'hurt');
      if (game.damage(dmg)) defeated(m);
    },
  });

  for (const s of sites) if (s.built && s.place.cave) postGuards(s); // caves built before the monsters existed

  // ---------- hunting, cooking and the farms (see husbandry.js) ----------
  husbandry = createHusbandry({
    scene, colliders, game, say, floatText, onEvent,
    // your free hand (the rope's end), or your waist if your body has no hands
    getHand: () => { const a = avatar.userData.rig?.arms; const hand = a?.[1]?.hand || a?.[0]?.hand; if (hand) { avatar.updateMatrixWorld(true); return hand.getWorldPosition(new THREE.Vector3()); } return new THREE.Vector3(pos.x, pos.y + bodyH * 0.5, pos.z); },
    onTame: (item, m) => riding?.adopt(item, m.x, m.z, m.heading),
    creatures: () => creatures,
    getPos: () => pos, getHeading: () => heading, isNight: () => night,
    groundAt: (x, z) => groundAt(x, z, pos.y),
    // the campfire beside each waystone (see spawn.js)
    siteFires: () => sites.filter((s) => s.built && !s.place.cave && Math.hypot(s.place.x - pos.x, s.place.z - pos.z) < 60).map((s) => ({ x: s.place.x + 9.5, z: s.place.z - 11 })),
  });
  oil = createOil({ scene, colliders, groundAt: (x, z) => groundAt(x, z, 1e4), getPos: () => pos });
  // ---------- growing your own and riding (see crops.js, riding.js) ----------
  if (game) {
    crops = createCrops({
      scene, game, say, floatText, onEvent,
      getPos: () => pos, getHeading: () => heading,
      groundAt: (x, z) => groundAt(x, z, pos.y),
      farmBeds: () => husbandry.built().flatMap((b) => b.beds),
      farmTroughs: () => husbandry.built().map((b) => b.trough),
      myFarmPlots: () => myFarmPlots,
      // a river, lake or the sea within a step or two
      nearWater: (x, z) => [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [1.5, 1.5], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5]].some(([dx, dz]) => { const s = sample(x + dx, z + dz, tmpS); return s.h < s.water + 0.05; }),
    });
    riding = createRiding({
      scene, game, say,
      getPos: () => pos, getHeading: () => heading,
      groundAt: (x, z) => groundAt(x, z, pos.y),
      riderHeight: () => bodyH,
      canRide: () => (inside ? 'Your mount waits outside' : depth ? 'Mounts can\'t go underground' : dead ? 'You can\'t ride now' : null),
    });
    riding.restore();
    // dragon eggs: the nests at the lairs, hatching, and the hatchling that follows you (see hatchery.js)
    hatchery = createHatchery({
      scene, game, say, onEvent,
      getPos: () => pos, getPlayer: () => ({ heading, flying: !!riding?.flying }),
      landAt: (x, z, full) => (full ? sample(x, z, {}) : groundAt(x, z, 1e4)),
      fireNear: (x, z, r) => husbandry.fireNear(x, z, r),
      angerParent: (lairId) => creatures.angerLair(lairId),
      canPlace: () => (inside ? 'Set it down outdoors' : depth ? 'Not down here: eggs need the open air' : riding?.flying ? 'Land first' : null),
      onGrown: (item, x, z, h) => riding?.adopt(item, x, z, h),
    });
  }
  husbandry.updateFarms(pos.x, pos.z);

  // ---------- monster villages out in the wilds (see data/mobvillages.mjs) ----------
  const mobVillages = new Map(); // village id -> { v, built, out: whether its folk are about }
  const tmpV = {};
  // somewhere a few kilometres out from a town (mostly the one nearest you), on dry land
  function planVillage() {
    const towns = placesWithPositions().filter((p) => !p.cave && !p.monster);
    const nearest = towns.reduce((a, b) => (Math.hypot(b.x - pos.x, b.z - pos.z) < Math.hypot(a.x - pos.x, a.z - pos.z) ? b : a));
    const B = WORLD_BOUNDS;
    for (let tries = 0; tries < 60; tries++) {
      const from = Math.random() < 0.6 ? nearest : towns[Math.floor(Math.random() * towns.length)];
      const a = Math.random() * Math.PI * 2, d = VILLAGE_NEAR[0] + Math.random() * (VILLAGE_NEAR[1] - VILLAGE_NEAR[0]);
      const x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d;
      if (x < B.minX + 300 || x > B.maxX - 300 || z < B.minZ + 300 || z > B.maxZ - 300) continue;
      const s = sample(x, z, tmpV);
      if (s.h < s.water + 1 || safeZoneAt(x, z)) continue;
      const region = s.region;
      // dry, open ground right across the camp (in the end, a clearing in a wood will do)
      const open = tries < 45 ? 0.25 : 1;
      if (s.forest > open) continue;
      const size = pickSize(), SZ = VILLAGE_SIZES[size], reach = SZ.fence + 3;
      if ([[reach, 0], [-reach, 0], [0, reach], [0, -reach]].some(([dx, dz]) => { const q = sample(x + dx, z + dz, tmpV); return q.h < q.water + 0.5 || q.forest > open; })) continue;
      // and fairly flat, so the huts stand on the ground instead of hanging off a hillside
      const hs = [[0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach], [reach * 0.7, reach * 0.7], [-reach * 0.7, -reach * 0.7]].map(([dx, dz]) => surfaceAt(x + dx, z + dz));
      if (Math.max(...hs) - Math.min(...hs) > reach * (tries < 45 ? 0.15 : 0.35)) continue;
      const lvl = wildLevelAt(x, z);
      if (lvl < SZ.levels[0] || lvl > SZ.levels[1]) continue;
      if (game.villages().some((v) => Math.hypot(v.x - x, v.z - z) < 1500)) continue;
      return newVillage(x, z, region, Math.random, size);
    }
    return null;
  }
  function spawnFolk(q, i, stage, level) {
    const { v } = q;
    let id = VILLAGE_KIND[v.race];
    const extra = { keep: true, site: v.id, village: v.id, folk: i, angry: true };
    if (v.race === 'goblin') id = GOBLIN_LINE[stage];
    else if (stage) { extra.stage = stage; extra.title = EVOLUTIONS[v.race][stage]; }
    if (i === v.folk.length - 1) { extra.title = `${EVOLUTIONS[v.race][stage]} (Chief)`; extra.chief = true; }
    const at = q.built.homes[i];
    creatures.spawnAt(id, level, at.x, at.z, extra);
  }
  function dropVillage(q) {
    scene.remove(q.built.group);
    colliders.remove(q.built.solid);
    creatures.removeWhere((m) => m.site === q.v.id);
    q.built.dispose();
    mobVillages.delete(q.v.id);
  }
  // keep enough villages in the world, build the ones near you and bring out their folk when you come close
  function tendVillages() {
    if (!game || depth || inside) return;
    const now = Date.now();
    let want = VILLAGES_AT_ONCE - game.villages().length - game.villagesDue().filter((t) => t > now).length;
    while (want-- > 0) { const v = planVillage(); if (!v) break; game.addVillage(v); }
    for (const v of game.villages()) {
      const d = Math.hypot(pos.x - v.x, pos.z - v.z);
      let q = mobVillages.get(v.id);
      if (d < 700 && !q) {
        q = { v, built: buildMobVillage(v), out: false };
        scene.add(q.built.group);
        colliders.add(q.built.solid);
        if (villageCleared(v)) q.built.unlock();
        mobVillages.set(v.id, q);
      } else if (d > 900 && q) { dropVillage(q); continue; }
      if (!q) continue;
      if (d < 170 && !q.out) {
        q.out = true;
        v.folk.forEach(([stage, level], i) => { if (!v.dead.includes(i)) spawnFolk(q, i, stage, level); });
      } else if (d > 260 && q.out) {
        q.out = false;
        creatures.removeWhere((m) => m.site === v.id);
      }
    }
  }
  function villageFallen(m) {
    const v = game.villageKill(m.village, m.folk);
    if (!v || !villageCleared(v)) return;
    mobVillages.get(v.id)?.built.unlock();
    say(`${villageName(v)} is beaten! Its chest is open to you`, 'exp');
  }
  function openVillageChest(e) {
    const q = mobVillages.get(e.village);
    if (!q || e.open) { say('The chest is empty', 'note'); return; }
    if (!e.unlocked) { say('Locked. Beat every monster in the village first', 'hurt'); return; }
    const loot = villageLoot(q.v);
    for (const [id, n] of loot.items) game.addItem(id, n);
    game.gainCoins(loot.coins);
    q.built.openChest();
    say(`+${money(loot.coins)} and treasure! The village is abandoned`, 'exp');
    onEvent?.('chest', { village: true, coins: loot.coins, items: loot.items.map(([id, n]) => `${n > 1 ? `${n} ` : ''}${ITEMS[id].name}`) });
    // the village is gone; another springs up somewhere else later
    game.lootVillage(q.v.id, VILLAGE_RETURNS_MS);
    setTimeout(() => dropVillage(q), 2500);
  }

  // A death: main.js decides whether you rise at a shrine or it is the end (see data/life.mjs)
  function defeated(m, cause = 'monster') {
    if (dead) return;
    // an admin who can't die: brought back to their feet instead
    if (powers.nodeath) { game?.heal(1); if (cause === 'drown' || cause === 'fall') say('Death passes you by.', 'note'); return; }
    dead = true;
    onEvent?.('defeated', { by: m.kind.name, cause });
  }
  // Rise again at the nearest shrine (a city's plaza, a village's waystone or a waypoint)
  function riseAtShrine() {
    if (inside) leaveBuilding();
    if (depth) leaveDepths();
    if (sleeping) toggleSleep();
    const spots = placesWithPositions().filter((p) => !p.cave && (p.city || p.village || p.spawn));
    const best = spots.reduce((a, b) => (Math.hypot(b.x - pos.x, b.z - pos.z) < Math.hypot(a.x - pos.x, a.z - pos.z) ? b : a));
    pos.set(best.x + 3, 0, best.z + 3);
    // in a great walled city you rise at its checkpoint in the Dump, by the south gate, far below the castle
    if (best.city) { updateSites(best.x, best.z); const c = builtCities().find((q) => q.place.id === best.id)?.built.checkpoint; if (c) pos.set(c.x, 0, c.z); }
    updateSites(pos.x, pos.z);
    // only the ground under your feet now; the rest of the land catches up while the death
    // screen is still up (see catchUpLand), so dying no longer freezes the game
    land.update(pos.x, pos.z, 25);
    pos.y = groundAt(pos.x, pos.z);
    velY = 0; fallFrom = pos.y; airborne = false;
    creatures.removeWhere((m) => Math.hypot(m.x - pos.x, m.z - pos.z) < 60 && !m.keep);
    snapCam = true; // (you stay down, still, until stand() as the death screen lifts)
    saveNow();
    return best.name;
  }
  // dying of old age (checked by main.js as play time passes)
  const oldAge = () => defeated({ kind: { name: 'old age' } }, 'age');

  // ---------- the depths below each cave ----------
  let holding = false; // a lit torch in your hand
  const skyEnv = scene.environment;
  const heldTorch = (() => {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 6), torchWood);
    stick.position.y = 0.15;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), torchFlame);
    flame.position.y = 0.52;
    // the light itself rides just above your shoulder, so it lights you as well as the way ahead
    const light = new GlowLight('#ffa040', 0, 24, 1.3);
    g.add(stick, flame);
    g.visible = false;
    return { g, flame, light };
  })();
  function attachTorch() {
    const hand = avatar.userData.rig.arms?.[1]?.hand;
    heldTorch.g.removeFromParent();
    if (hand) {
      // held in the left hand like a weapon, flame forward and up
      heldTorch.g.scale.setScalar(Math.max(0.6, bodyH / 1.8));
      heldTorch.g.rotation.set(Math.PI / 2 - 0.5, 0, 0);
      heldTorch.g.position.set(0, -bodyH * 0.04, 0);
      hand.add(heldTorch.g);
    } else {
      heldTorch.g.position.set(bodyR * 0.8, bodyH * 0.9, 0);
      avatar.add(heldTorch.g);
    }
  }
  attachTorch();
  heldTorch.light.position.set(0, bodyH * 1.5 + 0.4, bodyR * 2 + 0.6); // (far enough off that it lights you evenly, not in hard patches)
  avatar.add(heldTorch.light);
  function setHolding(v) {
    if (v && !game?.count('torch')) { say('You have no torch. The shop sells them.', 'hurt'); return; }
    holding = v;
    heldTorch.g.visible = v;
    heldTorch.light.intensity = v ? 22 : 0;
    say(v ? 'Torch lit' : 'Torch put out', 'note');
  }
  // the dark: no sun, no sky, black fog; only torches, crystals and a faint glow around you
  function applyDark() {
    sun.intensity = 0;
    hemi.intensity = 0.03;
    renderer.toneMappingExposure = 1.1;
    scene.fog.color.set('#000000');
    scene.fog.density = 0.05;
    scene.environment = null;
    scene.background = new THREE.Color('#000000');
    lantern.intensity = 0.35;
    sky.setVisible(false);
  }
  function enterDepths(site) {
    const cave = caveById(site.place.id);
    if (!cave || !game) return;
    const built = buildDepths(cave);
    setUnderground(built.sample);
    scene.add(built.group);
    colliders.add(built.solid);
    creatures.clear();
    others.clear(); // (the players in here are shown at the next report)
    depth = { cave, built, back: site.built.mouth, leftExit: false };
    safeAt = null; pitTime = 0;
    pos.set(built.start.x, built.floorAt(built.start.x, built.start.z), built.start.z);
    heading = built.start.heading; yaw = heading + Math.PI; velY = 0; speedNow = 0; snapCam = true;
    const lvl = game.character.level;
    const T = built.theme;
    for (const n of built.nests) { n.hp = n.maxHp = Math.round(30 + lvl * 8); }
    built.layout.chambers.forEach((c, i) => {
      if (i === 0) return;
      const spots = (k) => { const a = Math.random() * Math.PI * 2, r = c.r * (0.3 + Math.random() * 0.4); return [c.x + Math.cos(a) * r, c.z + Math.sin(a) * r]; };
      if (c.boss) {
        if (!game.bossHome(cave.id)) { built.openChest(); return; }
        const boss = creatures.spawnAt(T.boss, bossLevel(cave, lvl), c.x, c.z, { boss: true, keep: true, depth: true, angry: true, title: `${KINDS[T.boss].name} Boss` });
        boss.onDeath = () => {
          built.unlockChest();
          game.clearCave(cave.id);
          say('The boss is beaten! Its chest is open to you', 'exp');
          onEvent?.('cave-boss', { name: cave.name });
        };
        for (let k = 0; k < 2; k++) creatures.spawnAt(T.kinds[0], lvl, ...spots(k), { keep: true, depth: true });
        return;
      }
      const n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) creatures.spawnAt(T.kinds[Math.floor(Math.random() * T.kinds.length)], lvl + Math.round(Math.random() * 3 - 2), ...spots(k), { keep: true, depth: true });
    });
    // the false routes have a few monsters too, so they look like the way on
    for (const c of built.layout.branches) {
      if (Math.random() < 0.5) continue;
      const a = Math.random() * Math.PI * 2, r = c.r * 0.4;
      creatures.spawnAt(T.kinds[Math.floor(Math.random() * T.kinds.length)], lvl + Math.round(Math.random() * 2 - 2), c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, { keep: true, depth: true });
    }
    applyDark();
    say(holding ? `${cave.name}` : 'Pitch dark. Light a torch (T)', holding ? 'note' : 'hurt');
    onEvent?.('depths', { cave });
  }
  function leaveDepths() {
    const { built, back } = depth;
    creatures.removeWhere((m) => m.depth);
    colliders.remove(built.solid);
    scene.remove(built.group);
    built.dispose();
    setUnderground(null);
    depth = null;
    others.clear();
    pos.set(back.x, heightAt(back.x, back.z), back.z);
    heading = back.heading; yaw = heading + Math.PI; velY = 0; speedNow = 0; snapCam = true;
    scene.fog.density = quality.fog;
    scene.environment = skyEnv;
    scene.background = null;
    sky.setVisible(true);
    applyTime();
    say('Back in the daylight', 'note');
    onEvent?.('surface');
  }
  // ---------- inside a building ----------
  function applyIndoor() {
    sun.intensity = 0;
    hemi.intensity = 0.55;
    renderer.toneMappingExposure = 1;
    scene.fog.color.set('#1a120a');
    scene.fog.density = 0.004;
    scene.environment = null;
    scene.background = new THREE.Color('#1a120a');
    lantern.intensity = 0;
    sky.setVisible(false);
  }
  let castleAccess = {}; // { emperor, guildMaster, guest } from the game
  function enterBuilding(shop) {
    if (!game || inside || depth) return;
    if (shop.id === 'castle' && !mayEnterCastle(castleAccess)) {
      say(castleDay() === 'council' ? 'Guard: "Emperors and Guild Masters only today."' : 'Guard: "Emperors and their invited guests only today."', 'hurt');
      onEvent?.('castle-denied', { day: castleDay() });
      return;
    }
    if (shop.id === 'guild' && (game.character.level || 1) < GUILD_HALL_LEVEL) {
      say(`Guard: "Hunters of level ${GUILD_HALL_LEVEL} and above only."`, 'hurt');
      onEvent?.('guild-denied', { level: GUILD_HALL_LEVEL });
      return;
    }
    if (sleeping) toggleSleep();
    const built = buildInterior(shop);
    setUnderground(built.sample);
    scene.add(built.group);
    colliders.add(built.solid);
    creatures.clear();
    others.clear(); // (the players in here are shown at the next report)
    // back outside: a step out of the door, facing away from it
    const out = Math.atan2(pos.x - shop.x, pos.z - shop.z);
    inside = { built, shop, leftExit: false, back: { x: shop.x, z: shop.z, heading: heading + Math.PI } };
    pos.set(built.start.x, built.floorAt(built.start.x, built.start.z), built.start.z);
    heading = built.start.heading; yaw = heading + Math.PI; velY = 0; speedNow = 0; autoWalk = false; snapCam = true;
    void out;
    applyIndoor();
    say(shop.name, 'note');
    onEvent?.('indoors', { shop, kind: built.kind });
  }
  function leaveBuilding(toHall = false) {
    if (!inside) return;
    const { built, back } = inside;
    sitting = null;
    built.flushOrders?.(); // a drink still on its way is handed over at the door
    colliders.remove(built.solid);
    scene.remove(built.group);
    built.dispose();
    setUnderground(null);
    inside = null;
    others.clear();
    pos.set(back.x, heightAt(back.x, back.z), back.z);
    heading = back.heading; yaw = heading + Math.PI; velY = 0; speedNow = 0; snapCam = true;
    scene.fog.density = quality.fog;
    scene.environment = skyEnv;
    scene.background = null;
    sky.setVisible(true);
    applyTime();
    onEvent?.('outdoors');
    void toHall;
  }
  // E inside: the counter, a meeting room door, or a chair
  function useIndoors() {
    const b = inside.built;
    if (sitting) { standUp(); return; }
    if (b.counter && Math.hypot(pos.x - b.counter.x, pos.z - b.counter.z) < 2.6 && Math.abs(pos.y - b.counter.y) < 1) {
      if (inside.built.kind === 'academy') onEvent?.('academy', inside.shop.school);
      else onEvent?.(inside.shop.id === 'guild' ? 'guild' : inside.shop.id === 'castle' ? 'castle' : 'market', inside.shop.id);
      return;
    }
    const spot = (b.spots || []).find((q) => Math.hypot(pos.x - q.x, pos.z - q.z) < q.r && Math.abs(pos.y - q.y) < 1);
    if (spot) { onEvent?.(spot.event, inside.shop.id); return; }
    // the bed in your room at the tavern: lie down and wake fully rested
    const bed = (b.bedrooms || []).find((r) => Math.hypot(pos.x - r.bed.x, pos.z - r.bed.z) < 1.9 && pos.y > 2);
    if (bed) {
      if (game?.room()?.n !== bed.n) { say(`Room ${bed.n} isn't yours`, 'hurt'); return; }
      game.sleepInRoom();
      sleeping = true; inBed = bed.bed;
      say('You lie down in your bed and wake fully rested (move to get up)', 'exp');
      onEvent?.('slept-room');
      return;
    }
    const door = b.rooms.find((r) => Math.hypot(pos.x - r.door.x, pos.z - r.door.z) < 2);
    if (door) { onEvent?.('meeting-room', { id: door.id }); return; }
    const seat = b.seats.filter((q) => Math.abs(q.y - pos.y) < 1).sort((p, q) => Math.hypot(p.x - pos.x, p.z - pos.z) - Math.hypot(q.x - pos.x, q.z - pos.z))[0];
    if (seat && Math.hypot(seat.x - pos.x, seat.z - pos.z) < 1.6) { sitDown(seat); return; }
    say('Walk to the counter, a chair or a door and press ' + keyName(codeFor('interact')), 'note');
  }
  let sitting = null;
  function sitDown(seat) {
    sitting = seat;
    pos.set(seat.x, seat.y, seat.z);
    heading = seat.heading; velY = 0; speedNow = 0; autoWalk = false;
    say('You sit down', 'note');
  }
  function standUp() {
    if (!sitting) return;
    const s = sitting;
    sitting = null;
    pos.x = s.x + Math.sin(s.heading) * -0.6; pos.z = s.z + Math.cos(s.heading) * -0.6;
  }
  function poseSit(rig) {
    if (!rig.legs || !rig.arms) return;
    for (const leg of rig.legs) { leg.hip.rotation.x = -1.45; leg.knee.rotation.x = 1.45; }
    for (const arm of rig.arms) arm.shoulder.rotation.x = -0.35;
  }
  // meeting rooms you may be in: { room id -> until }, from the game
  let allowedRooms = {};
  // the tavern's bedrooms: only the one you rented lets you in
  function checkInn() {
    const b = inside.built;
    const room = (b.bedrooms || []).find((r) => pos.x > r.x0 && pos.x < r.x1 && pos.z > r.z0 && pos.z < r.z1);
    if (!room) return;
    const mine = game?.room();
    if (mine?.n === room.n) return;
    pos.set(room.door.x, b.floorAt(room.door.x, room.door.z), room.door.z);
    heading = Math.PI; yaw = heading + Math.PI; velY = 0; speedNow = 0; autoWalk = false;
    say(mine ? `That's not your room. Yours is Room ${mine.n}.` : `Room ${room.n} is locked. Rent a room at the counter downstairs.`, 'hurt');
  }
  let inBed = null; // the bed you're sleeping in
  function checkRooms() {
    const b = inside.built;
    if (!b.rooms.length) return;
    const room = b.rooms.find((r) => pos.x > r.x0 && pos.x < r.x1 && pos.z > r.z0 && pos.z < r.z1);
    if (!room || (allowedRooms[room.id] || 0) > Date.now()) return;
    // not yours (or your time is up): back out into the hallway
    const was = (allowedRooms[room.id] || 0) > 0;
    sitting = null;
    pos.set(room.door.x, b.floorAt(room.door.x, room.door.z), room.door.z);
    heading = Math.PI; yaw = heading + Math.PI; velY = 0; speedNow = 0; autoWalk = false;
    if (was) { delete allowedRooms[room.id]; say('Your time in the room is up', 'note'); onEvent?.('room-ended', { id: room.id }); } else { say(`The ${room.name} is locked`, 'hurt'); onEvent?.('meeting-room', { id: room.id }); }
  }

  // nests send out another monster now and then, while you're near and it still stands
  function tickNests(dt) {
    for (const n of depth.built.nests) {
      if (n.hp <= 0) continue;
      n.timer -= dt;
      if (n.timer > 0) continue;
      n.timer = 16;
      if (Math.hypot(pos.x - n.x, pos.z - n.z) > 35) continue;
      if (creatures.list.filter((m) => m.nest === n && !m.dead).length >= 3) continue;
      const m = creatures.spawnAt(depth.built.theme.nest, (game?.character.level || 1) - 1, n.x + 1.5, n.z + 1.5, { keep: true, depth: true, nest: n, angry: true });
      m.state = 'chase';
    }
  }
  function mineVein(e) {
    const w = game?.weapon();
    e.hits -= w?.type === 'axe' || w?.type === 'mace' ? 2 : 1; // heavy heads break rock faster
    floatText('⛏', new THREE.Vector3(e.x, e.mesh.position.y + 1, e.z), 'dmg');
    if (e.hits > 0) return;
    // bigger veins break into more ore
    const [lo, hi] = e.size?.ore || [1, 3];
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (!game.addItem(e.ore, n)) return;
    say(`+${n} ${ITEMS[e.ore].name}${e.size ? ` (${e.size.name.toLowerCase()} vein)` : ''}`, 'exp');
    colliders.remove([e]);
    depth.built.removeSolid(e);
  }
  function hitNest(e) {
    const s = game.stats();
    const dmg = Math.max(1, Math.round((game.weapon()?.magic ? s.matk * buffed('matk') : s.atk) * buffed('atk') * (0.9 + Math.random() * 0.2)));
    e.hp -= dmg;
    floatText(`${dmg}`, new THREE.Vector3(e.x, e.mesh.position.y + 1.2, e.z), 'dmg');
    if (e.hp > 0) return;
    const lvl = game.character.level;
    const exp = Math.round(5 + lvl * 2), coins = Math.round(15 + lvl * 4);
    game.gainExp(exp); game.gainCoins(coins);
    floatText(`+${exp} EXP`, new THREE.Vector3(e.x, e.mesh.position.y + 1.8, e.z), 'exp');
    say(`Nest destroyed! +${money(coins)}`, 'exp');
    colliders.remove([e]);
    depth.built.removeSolid(e);
  }
  // A hard cave's dangers: traps go off under your feet (jump a plate and it can't catch you), a
  // fall into a chasm hurts and you climb back out where you jumped from, and a cracked wall nearby
  // lets a cold draught through
  let safeAt = null, pitTime = 0;
  function tickDangers(dt, t) {
    const b = depth.built;
    if (dead) return;
    if (!airborne) {
      const tr = b.trapAt(pos.x, pos.z, t);
      if (tr) {
        const dmg = Math.max(1, Math.round(game.stats().hp * tr.hurt));
        floatText(`-${dmg}`, pos.clone().add(new THREE.Vector3(0, bodyH, 0)), 'hurt');
        say(tr.say, 'hurt');
        lastHurt = clock.elapsedTime;
        if (game.damage(dmg)) { defeated({ kind: { name: tr.name } }, 'trap'); return; }
      }
      if (b.inPit(pos.x, pos.z)) {
        pitTime += dt;
        if (pitTime > 1.5 && safeAt) {
          pos.set(safeAt.x, b.floorAt(safeAt.x, safeAt.z), safeAt.z);
          velY = 0; speedNow = 0; autoWalk = false; snapCam = true; pitTime = 0;
          say('You climb back out of the chasm', 'note');
        }
      } else { pitTime = 0; safeAt = { x: pos.x, z: pos.z }; }
    }
    const c = b.crackNear(pos.x, pos.z);
    if (c) { c.hinted = true; say('A cold draught seeps through a crack in the wall…', 'note'); }
  }
  // a cracked wall in a cave: heavy weapons break it faster; behind it is a secret room
  function hitCrack(c) {
    const w = game?.weapon();
    floatText('⛏', new THREE.Vector3(c.x, c.mesh.position.y + 1, c.z), 'dmg');
    if (!depth.built.hitCrack(c, w?.type === 'axe' || w?.type === 'mace' ? 2 : 1)) return;
    colliders.remove(c.parts);
    say('The wall gives way. A secret passage!', 'exp');
  }
  // a secret room's chest: coins, some of the cave's ore and a potion, for whoever finds it
  function openSecretChest(e) {
    if (e.open) { say('The chest is empty', 'note'); return; }
    const c = game.character, cave = depth.cave;
    const coins = Math.round((25 + c.level * 6) * SIZES[cave.size].chambers / 2);
    const items = [];
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) items.push([pickOre(caveOres(cave, 1), Math.random, 0.5), 1 + Math.floor(Math.random() * 2)]);
    items.push([c.level >= 20 ? 'big_potion' : 'potion', 1]);
    for (const [id, n] of items) game.addItem(id, n);
    game.gainCoins(coins);
    depth.built.openSecret(e);
    say(`A hidden treasure! +${money(coins)}`, 'exp');
    onEvent?.('chest', { coins, items: items.map(([id, n]) => `${n > 1 ? `${n} ` : ''}${ITEMS[id].name}`) });
  }
  function openChest(e) {
    if (e.village) { openVillageChest(e); return; }
    if (e.secret) { openSecretChest(e); return; }
    if (e.open) { say('The chest is empty', 'note'); return; }
    if (!e.unlocked) { say('Locked tight. Beat the boss to open it', 'hurt'); return; }
    const c = game.character;
    const loot = chestLoot(depth.cave, c.cls, c.level);
    for (const [id, n] of loot.items) game.addItem(id, n);
    game.gainCoins(loot.coins);
    depth.built.openChest();
    say(`+${money(loot.coins)} and treasure!`, 'exp');
    onEvent?.('chest', { coins: loot.coins, items: loot.items.map(([id, n]) => `${n > 1 ? `${n} ` : ''}${ITEMS[id].name}`) });
  }

  // The use key (E): open a chest, pick up a torch or pack up your tent, whichever is closest at hand
  let inZone = null, atStall = null;
  // the shop door or market stall you're standing at, if any
  function shopNear(x, z) {
    for (const s of sites) {
      const list = s.built?.shops || [...(s.built?.market ? [{ ...s.built.market, name: MARKETS[s.built.market.id].name }] : []), ...(s.built?.kiosk ? [s.built.kiosk] : [])];
      for (const shop of list) if (Math.hypot(shop.x - x, shop.z - z) < 4.5) return shop;
    }
    return null;
  }
  // a fallen monster's body you can cut up for bone and hide (E beside it), before it rots away
  const corpseNear = (x, z, r) => creatures?.list.filter((m) => canHarvest(m) && !m.kind.animal && Math.hypot(m.x - x, m.z - z) < r).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] || null;
  function harvestBody(m) {
    const got = harvest(m);
    if (!got) return;
    for (const [id, n] of got) game.addItem(id, n);
    say(`You cut up the body: ${got.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', ')}`, 'exp');
  }
  // Taming a worn-out dragon or wyvern with a Dragon Bridle (see creatures.js and data/mounts.mjs)
  function tameBeast(m) {
    const id = m.kind.beastId, name = m.kind.name.toLowerCase();
    const need = Math.ceil(m.level / 2);
    if (!game.has('dragon_bridle')) { say(`The ${name} is worn out. Use a Dragon Bridle on it now to tame it (the Shop or a Farm Stand sell them, from level 195)`, 'note'); return; }
    if (game.character.level < need) { say(`The ${name} is too strong for you to tame. You need to be level ${need} or more`, 'note'); return; }
    game.removeItem('dragon_bridle', 1);
    const ok = Math.random() < BEAST_TAME[id];
    if (creatures.tame(m, ok)) {
      const item = `tamed_${id}`;
      if (m.lair && game.character.grudges?.[m.lair.id]) delete game.character.grudges[m.lair.id];
      game.addItem(item, 1);
      riding?.adopt(item, m.x, m.z, m.heading);
      say(`You throw the bridle over the ${name}'s head and hold on… it bows its head to you. It is yours! Press H or E beside it to climb on`, 'exp');
      onEvent?.('tamed', { id });
    } else say(`The ${name} throws off the bridle and tears it apart! It takes to the sky again…`, 'hurt');
  }
  function interact() {
    if (!game || dead) return;
    const chest = colliders.near(pos.x, pos.z, 3).find((e) => e.kind === 'chest' && Math.hypot(e.x - pos.x, e.z - pos.z) - e.r < 1.6);
    if (chest) { openChest(chest); return; }
    if (inside) { useIndoors(); return; }
    if (!depth) {
      const took = game.takeTorch(pos.x, pos.z);
      if (took !== 'none') { say(took === 'ok' ? 'Torch picked up' : 'Your bag is full', took === 'ok' ? 'note' : 'hurt'); drawTorches(); return; }
      if (nearTent(pos.x, pos.z, TENT_IN + 1)) { pitchTent(); return; }
      const stand = standNear(pos.x, pos.z);
      if (stand) { onEvent?.('stand', stand); return; }
      if (myAnvilNear(pos.x, pos.z)) { onEvent?.('anvil'); return; }
      if (crops?.interactFirst()) return;
      if (husbandry.interact()) return;
      if (!riding?.riding && hatchery?.interact()) return;
      const worn = !riding?.riding && creatures.downedNear(pos.x, pos.z, 4);
      if (worn) { tameBeast(worn); return; }
      if (riding?.interact()) return;
      if (crops?.interact()) return;
      const body = corpseNear(pos.x, pos.z, 2.4);
      if (body) { harvestBody(body); return; }
      const well = oil?.near(pos.x, pos.z);
      if (well) { onEvent?.('derrick', well); return; }
      const seep = oil?.seepAt(pos.x, pos.z);
      if (seep) { onEvent?.('oil-spot', seep); return; }
      const npc = npcNear(pos.x, pos.z);
      if (npc) { talkTo(npc); return; }
      const shop = shopNear(pos.x, pos.z);
      if (shop?.building) { enterBuilding(shop); return; }
      if (shop?.id === 'bank_kiosk') { onEvent?.('kiosk', shop.place); return; }
      if (shop) { onEvent?.(shop.id === 'guild' ? 'guild' : 'market', shop.id); return; }
      const door = doorsNear(pos.x, pos.z, 4).sort((a, b) => Math.hypot(a.d.x - pos.x, a.d.z - pos.z) - Math.hypot(b.d.x - pos.x, b.d.z - pos.z))[0];
      if (door && Math.hypot(door.d.x - pos.x, door.d.z - pos.z) < 3.5) { useDoor(door); return; }
    }
    say('Nothing here to open or pick up', 'note');
  }

  // ---------- the Potion-Maker a Businessman hires: walks a few steps behind you ----------
  let helper = null;
  function refreshHelper() {
    const want = !!game?.makerHired();
    if (want === !!helper) return;
    if (helper) { scene.remove(helper.body); helper = null; return; }
    const body = buildCharacter({ race: 'elf', form: 'humanoid', look: { hair: '#c8c8c8' } });
    wearGear(body, { body: { ...ITEMS.mage_robe, look: { color: '#3d6b3a', robe: true } }, head: { ...ITEMS.mage_hat, look: { color: '#2e4f2c', hat: true } } });
    helper = { body, x: pos.x - Math.sin(heading) * 2.5, z: pos.z - Math.cos(heading) * 2.5, heading };
    scene.add(body);
  }
  function moveHelper(dt, t) {
    if (!helper) return;
    // keep about 2.5 m behind and to one side
    const tx = pos.x - Math.sin(heading) * 2.2 + Math.cos(heading) * 1.2, tz = pos.z - Math.cos(heading) * 2.2 - Math.sin(heading) * 1.2;
    const dx = tx - helper.x, dz = tz - helper.z, d = Math.hypot(dx, dz);
    let speed = 0;
    if (d > 40) { helper.x = tx; helper.z = tz; }
    else if (d > 0.4) {
      speed = Math.min(d * 2.5, RUN * 1.2);
      stepFollower(helper, helper.x + (dx / d) * speed * dt, helper.z + (dz / d) * speed * dt);
      helper.heading = Math.atan2(dx, dz);
    } else helper.heading = heading;
    helper.body.position.set(helper.x, heightAt(helper.x, helper.z), helper.z);
    helper.body.rotation.y = helper.heading;
    animateCharacter(helper.body, t, speed / WALK * 1.6);
  }

  // ---------- a bodyguard hired at the guild: follows you and fights what comes near ----------
  let guard = null;
  const GUARD_GEAR = {
    novice: { weapon: 'iron_sword', body: 'leather_armor', head: 'leather_cap' },
    veteran: { weapon: 'steel_sword', body: 'chainmail', head: 'iron_helm' },
    elite: { weapon: 'steel_sword', body: 'knight_plate', head: 'knight_helm' },
  };
  function refreshGuard() {
    const g = game?.guard();
    if (guard && (!g || g.tier !== guard.tier)) { scene.remove(guard.body); guard = null; }
    if (!g || guard) return;
    const race = ['dwarf', 'elf', 'beastkin', 'giant'][Math.floor(Math.random() * 4)];
    const body = buildCharacter({ race, form: 'humanoid' });
    wearGear(body, Object.fromEntries(Object.entries(GUARD_GEAR[g.tier]).map(([k, id]) => [k, ITEMS[id]])));
    guard = { tier: g.tier, body, x: pos.x - Math.sin(heading) * 2.5, z: pos.z - Math.cos(heading) * 2.5, heading, swing: 0, target: null };
    scene.add(body);
    say(`Your ${BODYGUARDS[g.tier].name} falls in beside you`, 'note');
  }
  function moveGuard(dt, t) {
    if (!guard) { if (game?.guard() && !dead) refreshGuard(); return; }
    if (!game?.guard()) { refreshGuard(); say('Your bodyguard\'s time is up. They head back to the guild', 'note'); return; }
    guard.body.visible = !inside && !depth;
    if (inside || depth) return;
    guard.swing = Math.max(0, guard.swing - dt);
    // the nearest monster that is close to you (or already its target)
    if (guard.target && (guard.target.dead || guard.target.hp <= 0 || Math.hypot(guard.target.x - pos.x, guard.target.z - pos.z) > 25)) guard.target = null;
    if (!guard.target) guard.target = creatures.list.filter((m) => !m.dead && m.hp > 0 && (!m.kind.animal || m.kind.aggressive) && Math.hypot(m.x - pos.x, m.z - pos.z) < 12).sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z))[0] || null;
    const m = guard.target;
    let tx, tz, reach = 0.4;
    if (m) { tx = m.x; tz = m.z; reach = m.radius + 1.1; } else { tx = pos.x - Math.sin(heading) * 2.2 - Math.cos(heading) * 1.2; tz = pos.z - Math.cos(heading) * 2.2 + Math.sin(heading) * 1.2; }
    const dx = tx - guard.x, dz = tz - guard.z, d = Math.hypot(dx, dz);
    let speed = 0;
    if (d > 60) { guard.x = pos.x; guard.z = pos.z; }
    else if (d > reach) {
      speed = Math.min(d * 2.5, RUN * 1.25);
      stepFollower(guard, guard.x + (dx / d) * speed * dt, guard.z + (dz / d) * speed * dt);
      guard.heading = Math.atan2(dx, dz);
    } else if (m) {
      guard.heading = Math.atan2(dx, dz);
      if (guard.swing === 0) {
        guard.swing = 1.1;
        const dmg = Math.round(guardHit(guard.tier) * (0.85 + Math.random() * 0.3));
        floatText(`-${dmg}`, new THREE.Vector3(m.x, (m.y ?? heightAt(m.x, m.z)) + m.height, m.z), 'hit');
        finishHit(m, creatures.hit(m, dmg, 'slash'));
      }
    } else guard.heading = heading;
    guard.body.position.set(guard.x, groundAt(guard.x, guard.z, -Infinity), guard.z);
    guard.body.rotation.y = guard.heading;
    animateCharacter(guard.body, t, speed / WALK * 1.6);
    // a swing of the sword arm
    const arm = guard.body.userData.rig?.arms?.[0];
    if (arm) { const k = guard.swing > 0.6 ? (1.1 - guard.swing) / 0.5 : 0; arm.shoulder.rotation.x = k > 0 ? -2.6 + k * 2.4 : READY[0]; arm.elbow.rotation.x = READY[1]; }
  }

  // ---------- attacking ----------
  let attackT = -1;      // time since the swing started, or -1
  let swingDone = false;
  let cooldown = 0;
  const FIST = { speed: 0.45, chop: 1 };
  // Inside a city's walls weapons stay put away: no drawing them, no fighting
  let sheathed = false;
  let sheathSaidAt = -10;
  const sayPutAway = () => { if (clock.elapsedTime - sheathSaidAt > 3) { sheathSaidAt = clock.elapsedTime; say('Weapons stay put away inside the city walls', 'note'); } };
  function showWeapon() { avatar.traverse((o) => { if (o.userData.weapon) o.visible = !sheathed; }); }
  function checkSheathed() {
    const now = !depth && builtCities().some((c) => Math.hypot(pos.x - c.place.x, pos.z - c.place.z) < CITY_R);
    if (now === sheathed) return;
    sheathed = now;
    showWeapon();
    if (sheathed && game?.weapon()) say('You put your weapon away: no weapons are drawn inside the city', 'note');
  }
  // ---------- your tamed dragon or wyvern, fighting beside you (see riding.js) ----------
  // It goes for the foe you set it on (the dragon key), or else whatever has hit you in the last
  // little while, and breathes on it (or bites, for a Peak Wyvern, which has no breath).
  const BREATH_HOW = { fire: 'fire', frost: 'frost', storm: 'shock' };
  function dragonHit(foe, c, mult = 1) {
    const b = BEASTS[c.id];
    const lvl = b.levels[0];
    let dmg = (10 + lvl * 1.1) * (b.boss ? 2 : 1.4) * (0.85 + Math.random() * 0.3) * mult - foe.def * 0.3;
    dmg = Math.max(1, Math.round(dmg));
    floatText(`${c.breath ? { fire: '🔥', frost: '❄️', storm: '⚡' }[c.breath] : '🦷'} ${dmg}`, new THREE.Vector3(foe.x, foe.y + foe.height + 0.2, foe.z), 'dmg');
    finishHit(foe, creatures.hit(foe, dmg, c.breath ? BREATH_HOW[c.breath] : 'pierce'));
  }
  const alive = (m) => m && !m.dead && m.hp > 0 && creatures.list.includes(m);
  function dragonFight(dt) {
    dragonCd -= dt;
    const c = riding?.companion();
    if (!c || c.riding) { if (c) riding.setGoal(null); return; }
    if (sicOn && (!alive(sicOn) || Math.hypot(sicOn.x - pos.x, sicOn.z - pos.z) > 120)) sicOn = null;
    if (lastFoe && (!alive(lastFoe.m) || clock.elapsedTime - lastFoe.at > 25 || Math.hypot(lastFoe.m.x - pos.x, lastFoe.m.z - pos.z) > 60)) lastFoe = null;
    const foe = sicOn || lastFoe?.m || null;
    // told to stay (by voice): it waits on that spot unless it is set on a foe
    if (!foe || dead) { riding.setGoal(petStay ? { x: petStay.x, z: petStay.z, r: 2, air: 0 } : null); return; }
    const reach = c.breath ? Math.max(9, c.len * 0.7) : c.reach + (foe.radius || 1);
    const foeAir = foe.air || 0;
    riding.setGoal({ x: foe.x, z: foe.z, r: reach - 1, air: foeAir > 4 ? foeAir : undefined });
    const d = Math.hypot(foe.x - c.x, foe.z - c.z);
    if (d < reach + 2 && Math.abs((foe.y + foe.height * 0.5) - (c.y + 2)) < 25 && dragonCd <= 0) {
      dragonCd = c.breath ? 2.2 : 1.4;
      riding.breathe(() => ({ x: foe.x, y: foe.y + foe.height * 0.5, z: foe.z }), 1.2);
      dragonHit(foe, c);
    }
  }
  // the dragon key: set your dragon on the foe in front of you, or call it back to your side;
  // on its back, it breathes ahead of you
  function commandDragon() {
    if (!game || dead) return;
    if (riding?.flyer()) { riderBreath(); return; }
    const c = riding?.companion();
    if (!c) { say('You have no dragon with you. Tame one (a Dragon Bridle on a worn-out one) or hatch an egg', 'note'); return; }
    const foe = creatures.target(pos.x, pos.z, heading, 40, 0.6);
    const name = BEASTS[c.id].name.toLowerCase();
    if (foe && foe !== sicOn) { sicOn = foe; say(`You point at the ${foe.kind.name}. Your ${name} goes for it!`, 'note'); }
    else { sicOn = null; lastFoe = null; say(`Your ${name} comes back to your side`, 'note'); }
  }
  // ---------- orders spoken aloud (see voicecmd.js and data/voicecmd.mjs) ----------
  // attack: the foe you face, or the nearest one whose name you said ("attack the wolf");
  // breathe: a burst of breath at what you face; back: stop and come to you (a horse is called);
  // stay: wait on this spot; follow: come along again. Returns what happened, as a line to show.
  let petStay = null;
  function petOrder(order, what = null) {
    if (!game || dead) return null;
    const c = riding?.companion();
    const m = riding?.mount();
    if (!c) {
      // no dragon: a horse, donkey or camel can still be called over
      if (m && (order === 'back' || order === 'follow')) { riding.toggle(m.item); return null; }
      if (m) return `Your ${ITEMS[m.item]?.name?.toLowerCase() || 'mount'} only knows "come"`;
      return 'You have no dragon with you to command. Tame one (a Dragon Bridle on a worn-out one) or hatch an egg';
    }
    const name = BEASTS[c.id].name.toLowerCase();
    if (order === 'attack') {
      if (what && /\bplayers?\b/.test(what)) return `Your ${name} won't attack other players outside the Colosseum`;
      let foe = null;
      if (what) {
        const words = what.split(' ').filter((w) => w.length > 2);
        const named = creatures.list.filter((o) => !o.dead && o.hp > 0 && !o.farm && Math.hypot(o.x - pos.x, o.z - pos.z) < 60 && words.some((w) => (o.title || o.kind?.name || '').toLowerCase().includes(w.replace(/s$/, ''))));
        foe = named.sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z))[0] || null;
      }
      foe ||= creatures.target(pos.x, pos.z, heading, 40, 0.6) || lastFoe?.m || null;
      if (!foe || !alive(foe)) return `Your ${name} looks about, but sees nothing to attack. Face a foe and say it again`;
      if (c.riding) { riderBreath(); return null; }
      sicOn = foe; petStay = null;
      return `Your ${name} goes for the ${foe.title || foe.kind.name}!`;
    }
    if (order === 'breathe') {
      if (c.riding) { riderBreath(); return null; }
      const foe = creatures.target(pos.x, pos.z, heading, 40, 0.6) || sicOn || lastFoe?.m || null;
      if (foe && alive(foe)) { sicOn = foe; petStay = null; dragonCd = 0; return `Your ${name} turns on the ${foe.title || foe.kind.name} and breathes!`; }
      if (dragonCd > 0) return null;
      dragonCd = 1.5;
      const far = 14;
      riding.breathe(() => ({ x: pos.x + Math.sin(heading) * far, y: pos.y + 1, z: pos.z + Math.cos(heading) * far }), 1.1);
      return null;
    }
    if (order === 'stay') {
      if (c.riding) return `You are on your ${name}'s back`;
      sicOn = null; lastFoe = null; petStay = { x: c.x, z: c.z };
      return `Your ${name} stays where it is. Say "follow" to call it along`;
    }
    // back / follow
    sicOn = null; lastFoe = null; petStay = null;
    return `Your ${name} comes back to your side`;
  }
  // a spell said aloud: any spell on the staff in your hand, not only the chosen one
  function castSpellNamed(id) {
    if (!game || dead || resting()) return 'busy';
    if (sheathed) { sayPutAway(); return 'busy'; }
    const st = game.staff();
    if (!st) return 'staff';
    if (!st.spells.includes(id)) return game.character.spells.includes(id) ? 'off' : 'unknown';
    const sp = SPELLS[id];
    if (clock.elapsedTime < (spellReady[id] || 0)) return 'cooling';
    const cost = Math.max(1, Math.round(sp.sp * (game.character.cls === 'mage' ? 0.9 : 1)));
    if (game.character.sp < cost) return 'sp';
    castSpell(sp);
    cooldown = Math.max(cooldown, (game.weapon() || FIST).speed);
    return 'ok';
  }
  // breath from your dragon's jaws while you ride it: it burns what is ahead of you
  function riderBreath() {
    const c = riding?.companion();
    if (!c || dragonCd > 0) return;
    dragonCd = c.breath ? 1.6 : 1;
    const far = c.len * 1.2 + 10;
    riding.breathe(() => ({ x: pos.x + Math.sin(heading) * far, y: pos.y - (riding.flying ? 4 : 0), z: pos.z + Math.cos(heading) * far }), 1.1);
    const foes = creatures.targets(pos.x, pos.z, heading, far, 0.45).filter((m) => Math.abs(m.y + m.height * 0.5 - pos.y) < 20).slice(0, c.breath ? 5 : 1);
    for (const m of foes) dragonHit(m, c, c.breath ? 1 : 0.8);
  }
  function attack() {
    if (dead || cooldown > 0) return;
    if (riding?.flyer()) { riderBreath(); return; } // (on a dragon's back, it breathes for you)
    if (sheathed) { sayPutAway(); return; }
    const w = game?.weapon();
    // a bow needs an arrow for every shot
    if (w?.type === 'bow' && !game.has('arrow')) { cooldown = 0.6; say('No arrows. Buy a Bundle of 10 Arrows at a shop or market', 'hurt'); return; }
    cooldown = (w || FIST).speed;
    attackT = 0;
    swingDone = false;
    // (a bow's shot is shared as the arrow; see shootArrow)
    if (w?.type !== 'bow') share({ k: 'swing', armed: !!w, blade: bladeHeld(), d: Math.round(Math.max(0.25, (w || FIST).speed * 0.8) * 100) / 100 });
  }

  // ---------- arrows ----------
  // A bow shoots at the foe you face (a little either side counts, so you needn't aim exactly):
  // the arrow flies in a shallow arc and hits when it gets there, if the foe is still in its path.
  // One that misses sticks in the ground for a while.
  const arrows = [];
  const ARROW_SPEED = 45;
  const arrowMats = { shaft: new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.8 }), head: new THREE.MeshStandardMaterial({ color: '#9ea4ac', metalness: 1, roughness: 0.35 }), fletch: new THREE.MeshStandardMaterial({ color: '#e8e2d4', roughness: 0.9, side: THREE.DoubleSide }) };
  function arrowMesh() {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.75, 5), arrowMats.shaft);
    shaft.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 5), arrowMats.head);
    head.rotation.x = Math.PI / 2; head.position.z = 0.4;
    g.add(shaft, head);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.1), arrowMats.fletch);
      f.position.z = -0.32; f.rotation.set(0, Math.PI / 2, (i / 3) * Math.PI * 2);
      f.rotateY(0); g.add(f);
    }
    g.traverse((o) => { o.castShadow = true; });
    return g;
  }
  function shootArrow(w) {
    if (!game.giveAway('arrow')) { say('No arrows left', 'hurt'); return; }
    const r = weaponReach(w);
    const from = new THREE.Vector3(pos.x + Math.sin(heading) * 0.5, pos.y + bodyH * 0.78, pos.z + Math.cos(heading) * 0.5);
    const m = creatures.target(pos.x, pos.z, heading, r.range, r.aim);
    let to;
    if (m) to = new THREE.Vector3(m.x, m.y + m.height * 0.55, m.z);
    else to = new THREE.Vector3(pos.x + Math.sin(heading) * r.range, 0, pos.z + Math.cos(heading) * r.range);
    if (!m) to.y = from.y - 0.5;
    const dist = from.distanceTo(to);
    const obj = arrowMesh();
    obj.position.copy(from);
    scene.add(obj);
    arrows.push({ obj, from, to, m, t: 0, dur: Math.max(0.08, dist / ARROW_SPEED), lift: dist * 0.04, stuck: 0, sharp: r.sharp, w });
    share({ k: 'arrow', f: vec(from), t: vec(to), d: Math.round(Math.max(0.25, w.speed * 0.8) * 100) / 100 });
    if (!game.has('arrow')) say('That was your last arrow', 'note');
  }
  const arrowPrev = new THREE.Vector3();
  function tickArrows(dt) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      if (a.stuck) {
        a.stuck -= dt;
        if (a.stuck <= 0) { scene.remove(a.obj); arrows.splice(i, 1); }
        continue;
      }
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      arrowPrev.copy(a.obj.position);
      a.obj.position.lerpVectors(a.from, a.to, k);
      a.obj.position.y += Math.sin(k * Math.PI) * a.lift;
      if (k < 1 || !a.m) a.obj.lookAt(a.obj.position.clone().multiplyScalar(2).sub(arrowPrev));
      // into the ground (or out of range): it sticks where it lands
      const g = groundAt(a.obj.position.x, a.obj.position.z, a.obj.position.y + 2);
      if (k >= 1 || a.obj.position.y < g) {
        const m = a.m;
        if (m && !m.dead && k >= 1 && Math.hypot(m.x - a.to.x, m.z - a.to.z) < m.radius + 0.8) {
          // a hit: it stays in the foe for a moment
          damageMonster(m, a.sharp, null, 'pierce', a.w);
          scene.remove(a.obj); arrows.splice(i, 1);
          continue;
        }
        if (!m && k < 1) { a.obj.position.y = g + 0.15; }
        else if (k >= 1 && a.obj.position.y > g + 0.05) {
          // missed (the foe moved): keep flying on and down until it lands
          const dir = a.to.clone().sub(a.from).setY(0).normalize();
          a.from = a.obj.position.clone(); a.to = a.from.clone().addScaledVector(dir, 6); a.to.y = g - 0.5; a.m = null; a.t = 0; a.dur = 0.15; a.lift = 0;
          continue;
        }
        a.obj.position.y = Math.max(a.obj.position.y, g + 0.12);
        a.stuck = 20;
      }
    }
  }
  // Skills that raise ATK or DEF for a while
  const buffs = { atk: { pct: 0, until: 0 }, def: { pct: 0, until: 0 } };
  // skill buffs and potion buffs add together
  const buffed = (stat) => 1 + ((buffs[stat] && clock.elapsedTime < buffs[stat].until ? buffs[stat].pct : 0) + (game?.boostPct(stat) || 0)) / 100;

  // Hit a monster with your weapon (or fists); `mult` and `magic` come from skills
  function damageMonster(m, mult = 1, magic = null, how = null, shotWith = null) {
    const w = shotWith || game?.weapon();
    const s = game.stats();
    const useMagic = magic ?? !!w?.magic;
    let dmg = (w || magic !== null ? (useMagic ? s.matk * buffed('matk') : s.atk) : s.base.atk * 0.6 + 2) * mult * buffed('atk');
    dmg = dmg * (0.9 + Math.random() * 0.2) - m.def * 0.5;
    const crit = Math.random() < 0.1 + Math.min(character.stats.dex * 0.002, 0.25);
    if (crit) dmg *= 1.6;
    dmg = Math.max(1, Math.round(dmg));
    floatText(`${dmg}${crit ? '!' : ''}`, new THREE.Vector3(m.x, m.y + m.height + 0.2, m.z), crit ? 'crit' : 'dmg');
    // the weapon's own effect, and a coating's, if it has one
    if (w && !magic) {
      const own = weaponEffect(w, w.plus);
      if (own && Math.random() < own.chance) applyEffect(m, own.id, dmg, own.power);
      if (w.coat) { applyEffect(m, w.coat.id, dmg, 1); game.useCoat(); }
    }
    finishHit(m, creatures.hit(m, dmg, how || howOf({ weapon: w }), crit));
    return dmg;
  }
  // Poison, burn and bleed hurt each second; frost slows; drain heals you
  // pin a foe in place: it can't move or strike for a while (bosses shake it off in half the time)
  function pinFoe(m, secs) {
    m.stun = Math.max(m.stun || 0, m.boss || m.chief ? secs / 2 : secs);
  }
  function applyEffect(m, id, dmg, power) {
    const fx = EFFECTS[id];
    if (fx.heal) { game.heal(Math.max(1, Math.round(dmg * fx.heal * power))); return; }
    if (fx.slow) { m.slow = fx.secs * power; return; }
    m.dots ||= {};
    m.dots[id] = { dps: Math.max(1, Math.round(dmg * fx.dot * power)), left: fx.secs, tick: 1 };
  }
  function tickEffects(dt) {
    for (const m of creatures.list) {
      if (m.dead || !m.dots) continue;
      for (const [id, d] of Object.entries(m.dots)) {
        d.tick -= dt; d.left -= dt;
        if (d.tick <= 0) {
          d.tick += 1;
          floatText(`${d.dps}`, new THREE.Vector3(m.x, m.y + m.height + 0.2, m.z), id === 'poison' ? 'exp' : 'hurt');
          finishHit(m, creatures.hit(m, d.dps, howOf({ dot: id })));
          if (m.dead || m.hp <= 0) break;
        }
        if (d.left <= 0) delete m.dots[id];
      }
    }
  }
  function finishHit(m, reward) {
    // a hunter says Allah's name over the animal as they strike (halal hunting)
    if (m.kind.animal?.meat && !m.named) { m.named = true; floatText('Bismillah, Allahu Akbar', new THREE.Vector3(m.x, m.y + m.height + 0.9, m.z), 'note'); }
    if (reward?.animal) {
      reward.exp = Math.max(1, Math.round(reward.exp * killExpScale(game.character.level - m.level)));
      floatText(`+${reward.exp} EXP`, new THREE.Vector3(m.x, m.y + m.height + 0.5, m.z), 'exp');
      game.gainExp(reward.exp);
      say(`${reward.name} down. E beside it: drag it to a Butcher, or cut it up`, 'note');
      onEvent?.('hunt', reward);
      return;
    }
    if (reward?.maimed) { floatText('Hand cut off!', new THREE.Vector3(m.x, m.y + m.height + 0.6, m.z), 'crit'); return; }
    if (reward) {
      m.onDeath?.();
      if (m.village) villageFallen(m);
      // what kind of foe it was (a village chief, a cave boss, a royal guard), for whoever is watching
      Object.assign(reward, { chief: !!m.chief, boss: !!m.boss, depth: !!m.depth, royal: !!m.kind.royal });
      // monsters far below your level teach you little
      reward.exp = Math.max(1, Math.round(reward.exp * killExpScale(game.character.level - m.level)));
      floatText(`+${reward.exp} EXP`, new THREE.Vector3(m.x, m.y + m.height + 0.7, m.z), 'exp');
      game.gainExp(reward.exp);
      game.gainCoins(reward.coins);
      // now and then a Skill Stone, with a skill chosen at random
      if (Math.random() < stoneChance(m.level)) {
        const st = randomStone();
        reward.drops.push([st, 1]);
        floatText(ITEMS[st].name, new THREE.Vector3(m.x, m.y + m.height + 1.2, m.z), 'crit');
      }
      for (const [id, n] of reward.drops) game.addItem(id, n);
      onEvent?.('kill', reward);
    }
  }

  // ---------- what you do, shown to players close by (see live.js), and what they do, shown here ----------
  const rd = (v) => Math.round(v * 100) / 100;
  const vec = (v) => [rd(v.x), rd(v.y), rd(v.z)];
  const toVec = (a) => (Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) ? new THREE.Vector3(a[0], a[1], a[2]) : null);
  const share = (a) => onEvent?.('act', a);
  // the parts of a skill its look and move need (a Unique Skill is your own, so it is sent whole)
  function slimSkill(sk) {
    const out = {};
    for (const [k, v] of Object.entries(sk)) if (['string', 'number', 'boolean'].includes(typeof v) && k.length < 24 && String(v).length < 60) out[k] = v;
    return out;
  }
  function actOther(m) {
    // their monsters, and their blows on yours
    if (m.k === 'mobs') { if (!inside) creatures.netApply(m.i, m.l); return; }
    if (m.k === 'mobhit') { creatures.netHit(m.n, Number(m.d), m.how); return; }
    const o = others.entry(m.i);
    if (!o || !o.body.visible) return;
    const b = o.body, p = b.position.clone(), h = b.userData.height || 1.8, hd = b.rotation.y;
    if (Math.hypot(p.x - pos.x, p.z - pos.z) > 150) return;
    const pose = (move, dur) => others.act(m.i, { move, t: 0, dur });
    if (m.k === 'swing') others.act(m.i, { kind: 'swing', t: 0, dur: Math.min(2, Math.max(0.2, Number(m.d) || 0.4)), armed: !!m.armed, blade: !!m.blade, bow: false });
    else if (m.k === 'arrow') {
      const from = toVec(m.f), to = toVec(m.t);
      others.act(m.i, { kind: 'swing', t: 0, dur: Math.min(2, Math.max(0.2, Number(m.d) || 0.6)), armed: true, bow: true, blade: false });
      if (from && to && from.distanceTo(to) < 200) {
        const obj = arrowMesh();
        obj.position.copy(from);
        scene.add(obj);
        const dist = from.distanceTo(to);
        // (only for show: it hurts nothing here; the shooter's own game deals the damage)
        arrows.push({ obj, from, to, m: null, t: 0, dur: Math.max(0.08, dist / ARROW_SPEED), lift: dist * 0.04, stuck: 0, sharp: 0, w: null });
      }
    } else if (m.k === 'skill' && m.sk && typeof m.sk === 'object') {
      const sk = { ...m.sk };
      const mv = moveFor(sk);
      pose(mv, mv.dur);
      const to = m.to && [m.to.x, m.to.y, m.to.z].every(Number.isFinite) ? m.to : null;
      const look = { p, h, heading: hd, to, path: Array.isArray(m.path) ? m.path.slice(0, 20).map(toVec).filter(Boolean) : [] };
      const go = () => { try { skillFx.play(sk, look); } catch { /* a skill this game doesn't know */ } };
      if (mv.hit > 0) setTimeout(go, mv.dur * mv.hit * 1000); else go();
    } else if (m.k === 'self') {
      skillFx.play({ id: 'self', unique: true, element: String(m.el || 'Light'), tier: 1, type: m.heal ? 'heal' : 'buff' }, { p, h, heading: hd });
      pose(moveFor(m.heal ? { type: 'heal' } : { type: 'buff', stat: 'def' }), 0.8);
    } else if (m.k === 'spell') {
      const from = toVec(m.f), to = toVec(m.t), el = String(m.el || 'Light');
      if (!m.plain) pose(moveFor({ type: 'bolt' }), 0.6);
      if (from && to && from.distanceTo(to) < 100) skillFx.spell(el, from, to);
      else if (from && !m.t) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; skillFx.spell(el, from, new THREE.Vector3(p.x + Math.sin(a) * 6, p.y + 0.4, p.z + Math.cos(a) * 6)); }
    }
  }

  // Use a skill (see data/skills.mjs). Returns 'ok', 'sp' (not enough SP), 'none' (nothing to hit) or 'busy'.
  function useSkill(sk) {
    if (!game || dead || resting()) return 'busy';
    if (sheathed && sk.type !== 'appraise') { sayPutAway(); return 'busy'; }
    // Appraisal: look at whatever is in front of you (a monster, if one is near) and open the window
    if (sk.type === 'appraise') {
      const m = creatures.target(pos.x, pos.z, heading, 30);
      onEvent?.('appraise', { monster: m ? { name: m.title || m.kind?.name || 'Monster', level: m.level, hp: Math.round(m.hp), maxHp: m.maxHp, atk: m.atk, def: m.def, boss: !!m.boss, chief: !!m.chief } : null });
      return 'ok';
    }
    const c = game.character;
    if (c.sp < sk.sp) return 'sp';
    const reachNear = bodyR + Math.max(1.8, weaponReach(game.weapon()).reach) * Math.max(0.8, bodyH / 1.8);
    const look = { p: pos.clone(), h: bodyH, heading };
    // a Unique Skill hits with whichever is stronger, ATK or MATK, and carries its element's effect
    // (a freeze slows every foe it hits; a devouring blow heals you)
    const skHow = howOf({ skill: sk, weapon: game.weapon() });
    let hitFoe = (m, mult, magic) => damageMonster(m, mult, magic, skHow);
    if (!sk.unique && (sk.effect || sk.hold || sk.stun || sk.drain)) {
      // the wider book of skills (data/skills.mjs): burns and poisons, slows, pins, and life drain
      hitFoe = (m, mult, magic) => {
        const hp = m.hp;
        const dmg = damageMonster(m, mult, magic, skHow);
        if (sk.drain) game.heal(Math.max(1, Math.round(dmg * sk.drain)));
        if (m.dead || m.hp <= 0) return;
        if (sk.hold) m.slow = Math.max(m.slow || 0, sk.hold);
        if (sk.stun) pinFoe(m, sk.stun);
        if (sk.effect && Math.random() < sk.effect.chance) applyEffect(m, sk.effect.id, Math.max(1, hp - m.hp), 1);
      };
    }
    if (sk.unique) {
      const st = game.stats();
      hitFoe = (m, mult) => {
        const hp = m.hp;
        const dmg = damageMonster(m, mult, st.matk > st.atk, skHow);
        if (sk.drain) game.heal(Math.max(1, Math.round(dmg * sk.drain)));
        if (m.dead || m.hp <= 0) return;
        if (sk.hold) m.slow = Math.max(m.slow || 0, sk.hold);
        if (sk.effect) applyEffect(m, sk.effect, Math.max(1, hp - m.hp), 1 + sk.tier * 0.3);
      };
    }
    if (sk.type === 'strike' || sk.type === 'bolt') {
      // with nobody in reach the skill still goes off, into the air in front of you
      const m = creatures.target(pos.x, pos.z, heading, sk.type === 'bolt' ? sk.reach : reachNear + 0.4);
      if (m) {
        look.to = { x: m.x, y: m.y, z: m.z, h: m.height };
        hitFoe(m, sk.mult, sk.magic || null);
      } else {
        const d = sk.type === 'bolt' ? sk.reach : reachNear;
        const x = pos.x + Math.sin(heading) * d, z = pos.z + Math.cos(heading) * d;
        look.to = { x, y: sk.type === 'bolt' ? heightAt(x, z) : pos.y, z, h: bodyH };
      }
    } else if (sk.type === 'sweep') {
      const near = creatures.list.filter((m) => !m.dead && !m.farm && Math.hypot(m.x - pos.x, m.z - pos.z) - m.radius < sk.radius);
      for (const m of near) hitFoe(m, sk.mult, sk.magic || null);
    } else if (sk.type === 'dash') {
      // rush forward, stopping at the first foe in the way
      look.path = [];
      for (let d = 0; d < sk.dist; d += 0.4) {
        pos.x += Math.sin(heading) * 0.4; pos.z += Math.cos(heading) * 0.4;
        colliders.push(pos, bodyR);
        look.path.push(new THREE.Vector3(pos.x, heightAt(pos.x, pos.z) + bodyH * 0.5, pos.z));
        const m = creatures.target(pos.x, pos.z, heading, reachNear);
        if (m) { hitFoe(m, sk.mult, null); break; }
      }
      pos.y = Math.max(pos.y, heightAt(pos.x, pos.z));
    } else if (sk.type === 'heal') {
      game.heal(game.stats().hp * sk.pct / 100);
      floatText(`+${Math.round(game.stats().hp * sk.pct / 100)} HP`, pos.clone().add(new THREE.Vector3(0, bodyH, 0)), 'exp');
    } else if (sk.type === 'buff') {
      buffs[sk.stat] = { pct: sk.pct, until: clock.elapsedTime + sk.secs };
    }
    c.sp = Math.max(0, c.sp - sk.sp);
    game.touch('sp');
    // the body acts it out with the skill's own move (skillmoves.js), and its effect shows the
    // moment the blow lands: the dust flies as the stamping foot comes down
    const mv = moveFor(sk);
    attackT = -1;
    skillPose = { move: mv, t: 0, dur: mv.dur };
    share({ k: 'skill', sk: slimSkill(sk), to: look.to ? { x: rd(look.to.x), y: rd(look.to.y), z: rd(look.to.z), h: rd(look.to.h || 1.6) } : null,
      path: look.path ? look.path.filter((q, i, a) => i % Math.ceil(a.length / 16) === 0 || i === a.length - 1).map(vec) : null });
    if (mv.hit > 0) setTimeout(() => skillFx.play(sk, look), mv.dur * mv.hit * 1000);
    else skillFx.play(sk, look);
    say(sk.name, 'exp');
    return 'ok';
  }

  // With a staff in hand the attack key casts a spell instead of swinging: the spell chosen on the
  // staff (see data/spells.mjs), or, with none attached or while it rests, a plain bolt of your element
  let spellTurn = 0;
  const SPELL_REACH = 14;
  const spellReady = {}; // spell id -> clock time it can be cast again
  function castSpell(pick = null) {
    const c = game.character;
    const els = c.elements?.length ? c.elements : [RACES[c.race].element];
    const from = new THREE.Vector3(pos.x + Math.sin(heading) * 0.5, pos.y + bodyH * 0.7, pos.z + Math.cos(heading) * 0.5);
    const ahead = (d) => new THREE.Vector3(pos.x + Math.sin(heading) * d, pos.y + bodyH * 0.6, pos.z + Math.cos(heading) * d);
    const at = (m) => new THREE.Vector3(m.x, m.y + m.height * 0.6, m.z);
    const sp = pick || game.chosenSpell();
    const cost = sp ? Math.max(1, Math.round(sp.sp * (c.cls === 'mage' ? 0.9 : 1))) : 0;
    if (sp && SELF_KINDS.includes(sp.kind) && clock.elapsedTime >= (spellReady[sp.id] || 0) && c.sp >= cost) {
      // a spell on yourself: heal, guard (+DEF) or empower (+MATK); the Dark Side's are stronger too
      const boost = darkSpells(c) ? DARK_SPELL_POWER : 1;
      const pct = Math.round(sp.pct * boost);
      if (sp.kind === 'heal') {
        const amt = Math.round(game.stats().hp * pct / 100);
        game.heal(amt);
        floatText(`+${amt} HP`, pos.clone().add(new THREE.Vector3(0, bodyH, 0)), 'exp');
      } else buffs[sp.kind === 'ward' ? 'def' : 'matk'] = { pct, until: clock.elapsedTime + sp.secs };
      const look = darkSpells(c) ? 'Dark' : sp.element;
      skillFx.play({ id: sp.id, unique: true, element: look, tier: 1, type: sp.kind === 'heal' ? 'heal' : 'buff' }, { p: pos.clone(), h: bodyH, heading });
      share({ k: 'self', el: look, heal: sp.kind === 'heal' });
      c.sp = Math.max(0, c.sp - cost);
      game.touch('sp');
      spellReady[sp.id] = clock.elapsedTime + sp.cd;
      skillPose = { move: moveFor(sp.kind === 'heal' ? { type: 'heal' } : { type: 'buff', stat: 'def' }), t: 0, dur: 0.8 };
      say(spellName(sp, c), 'exp');
      return;
    }
    if (sp && !SELF_KINDS.includes(sp.kind) && clock.elapsedTime >= (spellReady[sp.id] || 0) && c.sp >= cost) {
      let foes = [], to;
      if (sp.kind === 'bolt' || sp.kind === 'burst') {
        const m = creatures.target(pos.x, pos.z, heading, SPELL_REACH);
        if (m) {
          foes = [m];
          if (sp.kind === 'burst') foes.push(...creatures.list.filter((o) => o !== m && !o.dead && !o.farm && Math.hypot(o.x - m.x, o.z - m.z) - o.radius < 3.5));
          to = at(m);
        } else to = ahead(SPELL_REACH);
      } else if (sp.kind === 'nova') {
        foes = creatures.targets(pos.x, pos.z, heading, 6, Math.PI);
        to = null;
      } else {
        foes = creatures.targets(pos.x, pos.z, heading, SPELL_REACH, 0.25).slice(0, 3);
        to = foes.length ? at(foes[foes.length - 1]) : ahead(SPELL_REACH);
      }
      for (const m of foes) {
        const hp = m.hp;
        damageMonster(m, spellPower(sp, c), true, howOf({ spell: sp }));
        if (sp.effect && !m.dead && m.hp > 0 && Math.random() < sp.effect.chance) applyEffect(m, sp.effect.id, Math.max(1, hp - m.hp), 1);
        if (sp.stun && !m.dead && m.hp > 0) pinFoe(m, sp.stun);
      }
      // the Dark Side's spells come out black with shadow (the Dark element's look)
      const look = darkSpells(c) ? 'Dark' : sp.element;
      if (to) skillFx.spell(look, from, to);
      else for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; skillFx.spell(look, from, new THREE.Vector3(pos.x + Math.sin(a) * 6, pos.y + 0.4, pos.z + Math.cos(a) * 6)); }
      share({ k: 'spell', el: look, f: vec(from), t: to ? vec(to) : null });
      c.sp = Math.max(0, c.sp - cost);
      game.touch('sp');
      spellReady[sp.id] = clock.elapsedTime + sp.cd;
      skillPose = { move: moveFor({ type: 'bolt' }), t: 0, dur: 0.6 };
      say(spellName(sp, c), 'exp');
      return;
    }
    if (sp && c.sp < cost && !castSpell.warned) { castSpell.warned = true; say(`Not enough SP for ${sp.name}`, 'hurt'); setTimeout(() => { castSpell.warned = false; }, 3000); }
    const element = els[spellTurn++ % els.length];
    const m = creatures.target(pos.x, pos.z, heading, SPELL_REACH);
    let to;
    if (m) { to = at(m); damageMonster(m, 1, true, howOf({ element })); }
    else to = ahead(SPELL_REACH);
    skillFx.spell(element, from, to);
    share({ k: 'spell', el: element, f: vec(from), t: vec(to), plain: true });
  }
  // ---------- the city gates: the guards check your ID on the way in ----------
  // Walking in from outside stops you at the gate until you show your ID; once let in you can come
  // and go freely until you wander far off. Arriving by waystone or portal needs no check.
  const gate = { cleared: null, prev: null, asked: 0, out: false, leaving: false };
  function checkGates(t) {
    // the nearest city (the Central City, or a Monster City)
    const city = sites.filter((s) => s.place.city && s.built?.gates).sort((a, b) => Math.hypot(pos.x - a.place.x, pos.z - a.place.z) - Math.hypot(pos.x - b.place.x, pos.z - b.place.z))[0];
    if (!city) { gate.prev = null; return; }
    const { x: cx, z: cz } = city.built.centre;
    const d = Math.hypot(pos.x - cx, pos.z - cz);
    if (gate.cleared === null) gate.cleared = d < CITY_R; // starting inside the city
    if (d > CITY_R + 40) gate.cleared = false;
    if (d < CITY_R - 30) gate.out = false; // back in town: leaving again means showing your ID again
    const prev = gate.prev;
    gate.prev = d;
    // going out through the outer gate: the guards check your ID, and children may not leave at all
    if (prev !== null && gate.cleared && !gate.out && prev < CITY_R - 1 && d >= CITY_R - 1 && d - prev < 3) {
      const k = (CITY_R - 1.8) / d;
      pos.x = cx + (pos.x - cx) * k; pos.z = cz + (pos.z - cz) * k;
      gate.prev = CITY_R - 1.8;
      autoWalk = false;
      if (t - gate.asked > 4) {
        gate.asked = t;
        gate.city = city.place;
        if (isChild(character)) { say('Guard: "Children stay inside the walls until their Ceremony."', 'hurt'); return; }
        gate.leaving = true;
        say('Guard: "Show your ID before you leave."', 'hurt');
        onEvent?.('gate', { barred: false, monster: RACES[character.race].side === 'monster', city: city.place.name, leaving: true });
      }
      return;
    }
    if (gate.cleared || prev === null || prev < CITY_R + 1 || d >= CITY_R + 1 || prev - d > 3) {
      if (prev !== null && prev - d > 3 && d < CITY_R) gate.cleared = true; // came in by magic
      return;
    }
    // stopped at the gate: back a step, and the guard asks for your ID
    const k = (CITY_R + 1.6) / d;
    pos.x = cx + (pos.x - cx) * k; pos.z = cz + (pos.z - cz) * k;
    gate.prev = CITY_R + 1.6;
    autoWalk = false;
    if (t - gate.asked > 4) {
      gate.asked = t;
      // monsters may not enter the Central City, and players may not enter a Monster City
      const monster = RACES[character.race].side === 'monster';
      const barred = monster !== !!city.place.monster;
      gate.city = city.place;
      gate.leaving = false;
      say(barred ? (monster ? 'Guard: "Halt, monster! You may not enter."' : 'Guard: "Halt, outsider! This city is for monsters."') : 'Guard: "Halt! Show your ID."', 'hurt');
      onEvent?.('gate', { barred, monster, city: city.place.name });
    }
  }
  // ---------- the gates between a city's rings: the guards read your City Pass going in ----------
  // (see data/citypass.mjs) Going down and out is free. Going up past a gate's line without the
  // pass (or a day pass) stops you there and the guard asks to see your ID.
  const inner = { prev: null, asked: 0, nodded: null };
  let passPerks = { homes: [], crowned: false };
  function checkInnerGates(t) {
    const city = builtCities().find((s) => s.built.innerGates && Math.hypot(pos.x - s.place.x, pos.z - s.place.z) < INNER_R);
    if (!city) { inner.prev = null; return; }
    const { x: cx, z: cz } = city.built.centre;
    const on = rampAt(pos.x - cx, pos.z - cz, RAMP_WALL);
    const G = on && city.built.innerGates.find((q) => q.k === on.ramp.k && q.a === on.ramp.a);
    if (!G) { inner.prev = null; return; }
    const prev = inner.prev?.G === G ? inner.prev.along : null;
    inner.prev = { G, along: on.along };
    if (prev === null || prev < G.line || on.along >= G.line || prev - on.along > 3) return;
    // going in past the gate: is the pass good for the ring above?
    const homes = passPerks.homes.filter((h) => h.city === city.place.id).map((h) => h.tier);
    const may = mayEnter(character, G.tier, { perks: { homes, crowned: passPerks.crowned }, city: city.place.id, ceremony: ceremonyDue(character) });
    if (may.ok) {
      if (inner.nodded !== G || t - inner.asked > 20) {
        inner.nodded = G; inner.asked = t;
        say({ pass: `Guard: "${PASS_NAME[cityPass(character, { homes, crowned: passPerks.crowned }).tier]} pass. Go ahead."`, day: 'Guard: "Your day pass is good. Go ahead."', school: 'Guard: "Off to school? Up you go."', ceremony: 'Guard: "Your Ceremony is today? Go up to the shrine, young one."' }[may.how], 'exp');
      }
      return;
    }
    // stopped: back a step, and the guard asks for your ID
    const back = G.line + 0.6;
    pos.x = cx + Math.sin(G.a) * back + Math.cos(G.a) * on.lat;
    pos.z = cz + Math.cos(G.a) * back - Math.sin(G.a) * on.lat;
    inner.prev = { G, along: back };
    autoWalk = false;
    speedNow = 0;
    if (t - inner.asked > 4 || inner.nodded !== G) {
      inner.asked = t; inner.nodded = null;
      say(`Guard: "Halt! The ${G.name} is not for everyone. Your ID."`, 'hurt');
      onEvent?.('citygate', { tier: G.tier, name: G.name, city: city.place.name, cityId: city.place.id });
    }
  }
  // Beyond the gates: nobody stands on a ring their pass doesn't open, however they got there
  // (flying over a terrace wall, slipping past a gate in a slow frame, a portal or a load that sets
  // them down on Castle Hill). Flying up to a ring you may not enter stops you at its edge; finding
  // yourself inside one, the guards walk you down to the checkpoint by the south gate. An admin
  // with any of their powers switched on may go anywhere.
  const ring = { ok: null, okAt: 0, last: null, warned: -99 };
  function keepToPass(t) {
    const city = builtCities().find((s) => s.built.innerGates && Math.hypot(pos.x - s.place.x, pos.z - s.place.z) < INNER_R);
    if (!city || dead) { ring.last = null; return; }
    const { x: cx, z: cz } = city.built.centre;
    const T = tierAt(Math.hypot(pos.x - cx, pos.z - cz)).id;
    if (Object.values(powers).some(Boolean) || T === 'dump') { ring.last = { x: pos.x, z: pos.z, city }; return; }
    if (ring.ok?.T !== T || ring.ok.city !== city || t - ring.okAt > 2) {
      const homes = passPerks.homes.filter((h) => h.city === city.place.id).map((h) => h.tier);
      ring.ok = { T, city, may: mayEnter(character, T, { perks: { homes, crowned: passPerks.crowned }, city: city.place.id, ceremony: ceremonyDue(character) }).ok };
      ring.okAt = t;
    }
    if (ring.ok.may) { ring.last = { x: pos.x, z: pos.z, city }; return; }
    const name = PASS_NAME[T];
    if (ring.last?.city === city && Math.hypot(ring.last.x - pos.x, ring.last.z - pos.z) < 30) {
      // stopped at the edge, where you were a moment ago
      pos.x = ring.last.x; pos.z = ring.last.z;
      speedNow = 0; autoWalk = false;
      if (t - ring.warned > 4) { ring.warned = t; say(`A guard shouts from the wall: "Halt! The ${name} is not for you without a pass. Come up through the gate."`, 'hurt'); }
      return;
    }
    // already inside a ring you may not be on: walked down to the checkpoint in the Dump
    const c = city.built.checkpoint;
    if (c) { pos.set(c.x, groundAt(c.x, c.z, Infinity), c.z); velY = 0; speedNow = 0; autoWalk = false; snapCam = true; }
    ring.last = null;
    if (t - ring.warned > 4) { ring.warned = t; say(`Guards found you in the ${name} without a pass and walked you down to the gate checkpoint`, 'hurt'); }
  }
  function passGate() {
    if (gate.leaving) {
      gate.leaving = false;
      if (isChild(character)) return false;
      gate.out = true;
      say(`Guard: "All in order. Safe travels."`, 'exp');
      return true;
    }
    const monster = RACES[character.race].side === 'monster';
    if (monster !== !!gate.city?.monster) return false;
    gate.cleared = true;
    say(`Guard: "All in order. Welcome to ${gate.city?.name || 'Central City'}."`, 'exp');
    return true;
  }

  // the spell the Spell key (X) moves on to
  function nextSpell() {
    const sp = game?.nextSpell();
    say(sp ? `Spell: ${sp.name}` : game?.staff() ? 'No spells on this staff yet: attach some in Skills (K)' : 'Hold a staff to cast spells', sp ? 'exp' : 'note');
  }
  // the practice monster of the Academy you are in (made the first time it is needed)
  function practiceHere() {
    const p = inside?.built.practice;
    if (!p) return null;
    return (inside.practiceCtl ??= createPractice(p, {
      say, float: floatText, tip: (text) => onEvent?.('practice-tip', text),
      won() {
        // beaten the way the school teaches: a good bit of EXP for a child of this Academy
        if (game?.character.child?.school === p.school) {
          let exp = 0;
          for (let i = 0; i < 5; i++) exp += game.trainHit() || 0;
          if (exp) floatText(`+${exp} EXP`, pos.clone().add(new THREE.Vector3(0, bodyH + 0.3, 0)), 'exp');
        }
        say('You beat the practice monster the way your Academy teaches!', 'exp');
        onEvent?.('practice-win', { school: p.school });
      },
    }));
  }
  function resolveSwing() {
    const w = game?.weapon();
    // the practice monster in an Academy takes the blow if it is aimed at it
    if (practiceHere()?.swing(pos, heading, speedNow)) {
      if (game?.character.child && trainingAt() === game.character.child.school) { const exp = game.trainHit(); if (exp) floatText(`+${exp} EXP`, pos.clone().add(new THREE.Vector3(0, bodyH + 0.3, 0)), 'exp'); }
      return;
    }
    // practice on your Academy's mat: every swing earns a little EXP
    if (game?.character.child && trainingAt() === game.character.child.school) {
      const exp = game.trainHit();
      if (exp) floatText(`+${exp} EXP`, pos.clone().add(new THREE.Vector3(0, bodyH + 0.3, 0)), 'exp');
      return;
    }
    if (w?.type === 'staff' || (w?.magic && character.cls === 'mage')) { castSpell(); return; }
    if (w?.type === 'bow') { shootArrow(w); return; }
    const r = weaponReach(w);
    const reach = bodyR + r.reach * Math.max(0.8, bodyH / 1.8);
    // monsters first: a long or wide weapon can catch more than one
    const foes = creatures.targets(pos.x, pos.z, heading, reach, r.arc).slice(0, r.hits);
    if (foes.length) { foes.forEach((m, i) => damageMonster(m, r.sharp * (i ? 0.7 : 1))); return; }
    // then bushes and small trees in front of you
    const fx = pos.x + Math.sin(heading) * reach * 0.6, fz = pos.z + Math.cos(heading) * reach * 0.6;
    let best = null, bestD = Infinity;
    for (const e of colliders.near(fx, fz, reach * 0.8)) {
      if (e.camOnly) continue;
      const d = Math.hypot(e.x - pos.x, e.z - pos.z) - e.r;
      if (d < bestD && d < reach) { best = e; bestD = d; }
    }
    if (!best) return;
    if (best.kind === 'vein') { mineVein(best); return; }
    if (best.kind === 'nest') { hitNest(best); return; }
    if (best.kind === 'crack') { hitCrack(best.crack); return; }
    // with a keyboard a chest opens with the use key; on a touch screen a tap of the attack button does it
    if (best.kind === 'chest') { if (matchMedia('(pointer: coarse)').matches) openChest(best); else say(`Press ${keyName(codeFor('interact'))} to open the chest`, 'note'); return; }
    const info = BREAKABLE[best.kind];
    if (!info) {
      say(best.built ? 'Change buildings in the Builder View (V)' : best.kind === 'rock' ? 'Too hard to break' : best.kind === 'wall' ? 'Solid rock' : 'Too big to break by hand');
      return;
    }
    // big trees need an axe and strength (or huge strength); tell the player what it takes
    const need = info.needs;
    const str = game.character.stats.str;
    const chop = w ? w.chop : FIST.chop;
    if (need && !((chop >= need.chop && str >= need.str) || str >= need.bare)) {
      say(`${info.label}: ${breakNeeds(best.kind)}`, 'hurt');
      return;
    }
    best.hp -= chop * (1 + str / 100); // stronger arms chop faster
    floatText(best.hp > 0 ? 'Crack!' : '', new THREE.Vector3(best.x, best.y + best.height * 0.6, best.z), 'dmg');
    if (best.hp <= 0) {
      land.breakThing(best);
      for (const [id, min, max] of info.drops) {
        const n = min + Math.floor(Math.random() * (max - min + 1));
        if (game.addItem(id, n)) onEvent?.('pickup', { id, n });
      }
    }
  }

  // ---------- input ----------
  const keys = new Set();
  // Auto-walk: tap forward (W or ↑) twice quickly and you keep walking on your own; tap forward
  // or back again to stop
  let autoWalk = false, lastForward = 0;
  const down = (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    keys.add(e.code);
    const act = actionFor(e.code);
    // a key the game uses doesn't also do what the browser would (F5 reloading, Tab, Space scrolling...)
    if (act && act !== 'chat' && !windowOpen?.() && !e.ctrlKey && !e.metaKey) e.preventDefault();
    if (act === 'autowalk' && !e.repeat) { autoWalk = !autoWalk; lastForward = 0; say(autoWalk ? 'Auto-walk on' : 'Auto-walk off', 'note'); }
    if (!e.repeat && act === 'forward') {
      const now = performance.now();
      if (autoWalk) { autoWalk = false; lastForward = 0; say('Auto-walk off', 'note'); }
      else if (now - lastForward < 320) { autoWalk = true; lastForward = 0; say('Auto-walk on: tap forward or back to stop', 'note'); }
      else lastForward = now;
    }
    if (!e.repeat && autoWalk && act === 'back') { autoWalk = false; say('Auto-walk off', 'note'); }
    if (act === 'attack') attack();
    if (act === 'sleep') toggleSleep();
    if (act === 'torch') placeTorch();
    if (act === 'tent') pitchTent();
    if (act === 'interact') interact();
    if (act === 'mount' && !e.repeat && game) riding?.toggle();
    if (act === 'dragon' && !e.repeat) commandDragon();
    if (act === 'spell' && !e.repeat) nextSpell();
    if ((act === 'zoomin' || act === 'zoomout') && !windowOpen?.()) zoomBy(act === 'zoomin' ? -150 : 150);
    if (act === 'mouse' && !e.repeat) { if (locked()) { letGo = true; document.exitPointerLock(); } else lockMouse(); }
    onKey?.(e);
  };
  const up = (e) => keys.delete(e.code);
  const held = (action) => isHeld(keys, action);
  // the middle and side mouse buttons can be keys too (Settings → Controls)
  const fakeKey = (code, repeat = false) => ({ code, key: code, repeat, target: document.body, shiftKey: false, preventDefault() {} });
  window.addEventListener('mousedown', (e) => {
    const code = mouseCode(e.button);
    if (!code || (e.target.closest && e.target.closest('input, textarea, #overlay'))) return;
    if (e.button === 1 || actionFor(code)) e.preventDefault(); // (no scroll wheel autoscroll, no browser back)
    down(fakeKey(code, keys.has(code)));
  });
  window.addEventListener('mouseup', (e) => { const code = mouseCode(e.button); if (code) { keys.delete(code); if (actionFor(code)) e.preventDefault(); } });
  // Fly down has no key until the player picks one: until then Run (Shift) dives, as it always did
  const flyDownHeld = () => (codeFor('flydown') ? held('flydown') : held('run'));
  let jumpQueued = false; // the jump button on touch screens
  let climbFor = 0, flyDown = false; // (flying on a dragon or wyvern)
  // Let go of every key and the touch stick when the game stops hearing the keyboard (another window
  // or tab): a key let go meanwhile never sends its keyup, and you'd keep walking. Opening a window
  // in the game doesn't: keep holding a movement key and you keep moving, let go and you stop.
  const letGoKeys = () => {
    keys.clear();
    if (stick.id !== null || stick.x || stick.y) { stick.id = null; stick.x = 0; stick.y = 0; stickEl.classList.add('hidden'); }
  };
  const hidden = () => { if (document.hidden) letGoKeys(); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', letGoKeys);
  document.addEventListener('visibilitychange', hidden);

  // Mouse: drag to turn the camera, click to attack. Touch: a stick appears where your left thumb
  // lands and moves you in any direction; dragging on the right turns the camera.
  let look = null;
  const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
  const stickEl = document.createElement('div');
  stickEl.className = 'stick hidden';
  stickEl.innerHTML = '<span></span>';
  canvas.parentElement.appendChild(stickEl);
  const STICK_R = 55;
  // Desktop mouse: the first click captures the mouse, then moving it turns your view (and the way
  // you walk) and clicking swings your weapon. Esc lets the mouse go again.
  const locked = () => document.pointerLockElement === canvas;
  let letGo = false; // the game released the mouse itself (a window opened), not the player's Esc
  let noLock = false; // some pages can't capture the mouse: then you drag to look, as before
  let freeMouse = view?.mouse === 'free'; // Settings: the mouse stays free (drag to look) instead of being captured
  const fingers = new Map(); // fingers on the screen (not the walking stick), for pinch-to-zoom
  let pinch = null;
  document.addEventListener('pointerlockerror', () => { noLock = true; });
  document.addEventListener('pointerlockchange', () => {
    if (!locked() && !letGo) onMouseFreed?.();
    letGo = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked() || windowOpen?.()) return;
    yaw -= e.movementX * 0.0025 * feel.mouse;
    pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.0018 * feel.mouse * (feel.invertY ? -1 : 1), pitchLo(), pitchHi());
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && locked()) { if (e.button === 0 && !talkAt(window.innerWidth / 2, window.innerHeight / 2)) attack(); return; }
    if (e.pointerType === 'mouse' && e.button === 0 && !plots.on && !noLock && !freeMouse && !windowOpen?.() && canvas.requestPointerLock) {
      try { const r = canvas.requestPointerLock(); r?.catch?.(() => { noLock = true; }); } catch { noLock = true; }
      if (!noLock) return;
    }
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45) {
      stick.id = e.pointerId; stick.x0 = e.clientX; stick.y0 = e.clientY; stick.x = 0; stick.y = 0;
      stickEl.style.left = `${e.clientX}px`;
      stickEl.style.top = `${e.clientY}px`;
      stickEl.classList.remove('hidden');
      stickEl.firstChild.style.transform = 'translate(-50%, -50%)';
    } else {
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), mouse: e.pointerType === 'mouse' };
      if (e.pointerType === 'touch') {
        // two fingers on the screen: pinch them together or apart to zoom out or in
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.size === 2) { const [a, b] = [...fingers.values()]; pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, dist0: dist }; look = null; }
      }
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.id) {
      let dx = e.clientX - stick.x0, dy = e.clientY - stick.y0;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
      stick.x = dx / STICK_R;
      stick.y = dy / STICK_R;
      stickEl.firstChild.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (fingers.has(e.pointerId) && pinch) {
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...fingers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      if (viewMode === 'first') { if (d < pinch.d0 * 0.7) { setView('third', true); pinch = { d0: d, dist0: dist }; } }
      else {
        const want = pinch.dist0 * pinch.d0 / d;
        if (want < 1.6) { setView('first', true); pinch = { d0: d, dist0: 2 }; } else dist = THREE.MathUtils.clamp(want, 2, 30);
      }
    } else if (look && e.pointerId === look.id) {
      // a finger turns the camera more gently than a mouse, so small swipes are small turns
      const k = look.mouse ? feel.mouse : 0.55 * feel.touch;
      yaw -= (e.clientX - look.x) * 0.006 * k;
      pitch = THREE.MathUtils.clamp(pitch + (e.clientY - look.y) * 0.004 * k * (feel.invertY ? -1 : 1), pitchLo(), pitchHi());
      look.x = e.clientX; look.y = e.clientY;
    }
  });
  const release = (e) => {
    if (fingers.delete(e.pointerId) && fingers.size < 2) pinch = null;
    if (e.pointerId === stick.id) { stick.id = null; stick.x = 0; stick.y = 0; stickEl.classList.add('hidden'); }
    if (look && e.pointerId === look.id) {
      // a quick click without dragging is an attack, or picks a plot while the land grid is showing
      const tap = e.type === 'pointerup' && Math.hypot(e.clientX - look.sx, e.clientY - look.sy) < 8 && performance.now() - look.t < 350;
      if (tap && plots.on) {
        const r = canvas.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        const at = plots.pick(ray.ray);
        if (at) onPlot?.(plots.select(at));
      } else if (tap && e.pointerType !== 'mouse' && tapUse(e.clientX, e.clientY)) { /* tapped a door, counter, chair, bed or chest */
      } else if (tap && talkAt(e.clientX, e.clientY)) { /* clicked a townsperson: they talk */
      } else if (tap && look.mouse && clickDoor(e.clientX, e.clientY)) { /* clicked a house door: it swings open or shut */
      } else if (tap && look.mouse) attack();
      if (!tap) lookEnded = clock.elapsedTime;
      look = null;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.style.touchAction = 'none'; // the game handles pinches itself (the page doesn't zoom)
  canvas.addEventListener('pointercancel', release);
  // the mouse wheel (or the Camera closer / further keys) zooms
  function zoomBy(deltaY) {
    if (viewMode === 'first') { if (deltaY > 0) setView('third', true); }
    else if (dist <= 2 && deltaY < 0) setView('first', true);
    else dist = THREE.MathUtils.clamp(dist + deltaY * 0.01 * feel.zoom, 2, 30);
  }
  canvas.addEventListener('wheel', (e) => { zoomBy(e.deltaY); e.preventDefault(); }, { passive: false });
  // catch the mouse for the camera again (after the chat, or the Free the mouse key); a key press
  // counts as the player asking, so the browser allows it
  function lockMouse() {
    if (locked() || noLock || freeMouse || windowOpen?.() || !canvas.requestPointerLock) return;
    try { const r = canvas.requestPointerLock(); r?.catch?.(() => {}); } catch { /* not allowed now */ }
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const move = new THREE.Vector3();
  let speedNow = 0;
  // Pressing back turns you round to face behind you (the camera swings round too); keep holding it
  // and you walk on in the new direction
  let moatAt = -10; // when you last fell in a moat
  let camOverride = null; // (testing) a fixed camera: [[x, y, z], [look x, y, z]]
  let snapCam = true; // the camera jumps straight to its place (after a door, a portal, a fall in the moat)
  let backWas = false, aboutFace = false, turnLeft = 0, backYaw = 0, backHeading = 0;
  let lastSave = 0;
  let regenAcc = 0;
  // healing by rest stops at a cap: eat, drink or use a potion or skill for the rest
  let toldCap = false, toldHungry = false;
  function restHeal(n, asleep) {
    const max = game.stats().hp, c = game.character;
    if ((c.hunger ?? 100) < HUNGRY) {
      if (!toldHungry && c.hp < max) { toldHungry = true; say('Too hungry to heal by resting. Eat something', 'note'); }
      return;
    }
    toldHungry = false;
    const cap = Math.floor(max * restCap(c.level, asleep));
    if (c.hp >= cap) {
      if (!toldCap && c.hp < max) { toldCap = true; say(`Rest only heals you to ${Math.round(restCap(c.level, asleep) * 100)}%. Eat or drink to heal more.`, 'note'); }
      return;
    }
    toldCap = false;
    game.heal(Math.min(n, cap - c.hp));
  }
  const B = WORLD_BOUNDS;
  // does this solid stand in the camera's way at (px, py, pz)? An awning or roof (camOnly) only
  // blocks between its underside and its top; everything else from the ground up to its height
  const camBlocks = (px, py, pz) => (e) => {
    if (!(e.r > 0)) return false;
    const base = (e.y ?? groundAt(e.x, e.z)) + (e.lift || 0);
    if (py - base >= (e.height || 8)) return false;
    if (e.camOnly) return py > base - 0.2 && Math.hypot(px - e.x, pz - e.z) < e.r;
    return Math.hypot(px - e.x, pz - e.z) < Math.min(e.r * (e.kind === 'wall' ? 1.2 : 4), 3.5);
  };
  let swimming = false;
  const tmpS = {};
  const v3 = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // The arm swing: punch straight ahead, or a downward slash with a weapon
  let mobsSent = 0; // (see the world loop: your monsters shared with players close by)
  let skillPose = null; // { kind, t, dur } while a skill is being acted out
  // (`who` is another player's body: see others.js; your own by default)
  function poseSkill(rig, p, who = { bodyH, avatar, heading }) {
    const k = Math.min(1, p.t / p.dur);
    if (rig.arms || rig.legs) {
      rig.restPose ??= { head: rig.head?.rotation.x || 0, y: rig.root.position.y };
      p.move.pose({ arms: rig.arms, legs: rig.legs, spine: rig.spine, head: rig.head, headBase: rig.restPose.head, root: rig.root, baseY: rig.restPose.y, bodyH: who.bodyH, avatar: who.avatar, heading: who.heading }, k);
      if (k >= 1) { // (back to standing, nothing left bent)
        rig.root.position.y = rig.restPose.y;
        if (rig.head) rig.head.rotation.x = rig.restPose.head;
        if (rig.spine) rig.spine.rotation.x = 0;
        for (const l of rig.legs || []) l.hip.rotation.z = 0;
        for (const a of rig.arms || []) a.elbow.rotation.x = 0;
      }
    } else rig.root.position.z = Math.sin(k * Math.PI) * who.bodyH * 0.2; // (bodies without arms lunge instead)
  }
  // the weapon arm's ready pose [shoulder, elbow] with a blade (see gear.js: the blade then points ahead)
  const READY = [-0.35, -0.85];
  const bladeHeld = () => { const w = game?.weapon(); return !sheathed && !!w && w.type !== 'spear' && w.type !== 'staff' && w.type !== 'bow'; };
  // (`bow` and `blade` for another player's swing: see others.js)
  function poseAttack(rig, k, armed, bow = game?.weapon()?.type === 'bow', blade = bladeHeld(), h = bodyH) {
    const arm = rig.arms?.[0];
    if (arm) {
      if (armed && bow) {
        // a shot: the bow arm comes up straight ahead, the other hand draws the string back to the
        // cheek, lets go, then both come down
        const L = THREE.MathUtils.lerp, pull = rig.arms[1];
        const up = k < 0.3 ? k / 0.3 : k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
        const ease = up * up * (3 - 2 * up);
        arm.shoulder.rotation.x = L(0, -1.55, ease); arm.elbow.rotation.x = L(0, -0.05, ease);
        if (pull) {
          const draw = k < 0.45 ? Math.min(1, k / 0.4) : Math.max(0, 1 - (k - 0.45) / 0.1) * 0.35 + (k < 0.8 ? 0.65 : 0.65 * (1 - (k - 0.8) / 0.2));
          pull.shoulder.rotation.x = L(0, -1.45, ease); pull.elbow.rotation.x = L(0, -2.1, draw * ease);
        }
        if (rig.spine) { rig.spine.rotation.y = -0.45 * ease; rig.spine.rotation.x = 0; }
        return;
      }
      if (armed) {
        // an overhead slash: up from the ready pose until the blade points at the sky, down hard
        // until it points ahead and low, then back to ready
        const L = THREE.MathUtils.lerp, from = blade ? READY : [0, -0.3];
        if (k < 0.35) { const q = k / 0.35; arm.shoulder.rotation.x = L(from[0], -2.6, q); arm.elbow.rotation.x = L(from[1], -0.3, q); }
        else if (k < 0.75) { const q = (k - 0.35) / 0.4; arm.shoulder.rotation.x = L(-2.6, -0.5, q * q); arm.elbow.rotation.x = -0.3; }
        else { const q = (k - 0.75) / 0.25; arm.shoulder.rotation.x = L(-0.5, from[0], q); arm.elbow.rotation.x = L(-0.3, from[1], q); }
        if (rig.spine) rig.spine.rotation.x = 0.18 * Math.sin(Math.min(1, k / 0.75) * Math.PI); // lean into it
      } else {
        const p = Math.sin(Math.min(1, k) * Math.PI);
        arm.shoulder.rotation.x = -1.5 * p;
        arm.elbow.rotation.x = -1.2 * (1 - p);
      }
      if (rig.spine) rig.spine.rotation.y = -0.35 * Math.sin(k * Math.PI);
    } else {
      // bodies without arms lunge forward instead
      rig.root.position.z = Math.sin(Math.min(1, k) * Math.PI) * h * 0.25;
    }
  }

  let walkBuild = null; // building from your character (see buildwalk.js)
  let paused = false; // the Builder View covers the world, so it stops drawing meanwhile
  let lastFrame = 0;
  renderer.setAnimationLoop((now) => {
    if (paused) { clock.getDelta(); return; }
    // a frame cap (phones): fewer frames keep the device cooler and save battery
    if (quality.fps && now - lastFrame < 1000 / quality.fps - 2) return;
    lastFrame = now;
    if (quality.auto) {
      const want = quality.fps || 60;
      if (smooth.frame(now, want * 0.9) !== null) renderer.setPixelRatio(sharpness());
    }
    const dt = Math.min(clock.getDelta(), 0.1); // a slow frame still moves you the full distance
    const t = clock.elapsedTime;
    tickWind(t); // (the trees and grass sway)
    // a window or the chat is open: the mouse is always free to use it, even while you keep walking
    if (locked() && windowOpen?.()) { letGo = true; document.exitPointerLock(); }

    // Movement relative to the camera, in any direction
    let fx = 0, fz = 0;
    if (dead || sleeping) autoWalk = false;
    if (!dead && !resting()) {
      if (held('forward') || autoWalk) fz += 1;
      if (held('back')) fz -= 1;
      if (held('left')) fx -= 1;
      if (held('right')) fx += 1;
      fx += stick.x; fz -= stick.y;
    }
    // sitting: any move gets you up; until then you stay in the chair
    if (sitting) {
      if (Math.abs(fx) > 0.3 || Math.abs(fz) > 0.3) standUp();
      else { fx = 0; fz = 0; pos.set(sitting.x, sitting.y, sitting.z); heading = sitting.heading; }
    }
    const fp = firstNow();
    // Follow camera: back turns you round. Free camera: you turn and walk towards the camera, which
    // stays where it is. First person: back is a step back.
    const backNow = cameraMode === 'follow' && !fp && fz < -0.4 && Math.abs(fx) < 0.6;
    if (backNow && !backWas && !look) { aboutFace = true; turnLeft = Math.PI; backYaw = yaw + Math.PI; backHeading = heading + Math.PI; }
    if (fz > -0.1) aboutFace = false;
    backWas = backNow;
    if (turnLeft > 0) {
      const step = Math.min(turnLeft, dt * Math.PI / 0.35); // half a turn in about a third of a second
      turnLeft -= step;
      if (cameraMode === 'follow') heading += step; else yaw += step;
    }
    else { backYaw = yaw; backHeading = heading; } // once round, carry on from wherever you face
    if (aboutFace) fz = -fz;
    const running = held('run') || Math.hypot(stick.x, stick.y) > 0.9;
    runningNow = running;
    const amount = Math.min(1, Math.hypot(fx, fz));
    let target = 0;
    if (cameraMode === 'follow' && !fp) {
      // Follow camera: left and right turn your body, forward and back walk the way you face,
      // and the camera swings round behind you
      heading -= fx * dt * (running ? STEER_RUN : STEER) * feel.turn;
      if (Math.abs(fz) > 0.05) {
        const h = aboutFace ? backHeading : heading; // turning round: walk the new way straight away
        move.set(Math.sin(h) * Math.sign(fz), 0, Math.cos(h) * Math.sign(fz));
        target = (running && fz > 0 ? RUN : WALK) * (fz < 0 ? 0.6 : 1) * agiSpeed * (1 + (game?.boostPct('speed') || 0) / 100) * Math.min(1, Math.abs(fz)) * Math.max(0.85, Math.sqrt(bodyH / 1.8)) * (swimming ? SWIM : 1) * (game?.injurySpeed() ?? 1) * (husbandry?.dragSlow() ?? 1) * (riding?.pace(running, WALK, RUN) ?? 1) * (powers.speed ? 3 : 1);
      }
      if (!look) {
        const back = Math.atan2(Math.sin(heading + Math.PI - yaw), Math.cos(heading + Math.PI - yaw));
        yaw += back * Math.min(1, dt * 4);
      }
    } else if (amount > 0.05) {
      // Steering: while you go forward (walking or sprinting), left and right turn you gently,
      // as much as you press, and the camera turns with you. Only sideways on its own steps sideways.
      const steering = fz > 0.1 && !look && !fp; // in first person, left and right step sideways
      if (steering) { const turn = fx * dt * (running ? STEER_RUN : STEER) * feel.turn; yaw -= turn; backYaw -= turn; }
      const ya = aboutFace ? backYaw : yaw; // turning round: walk the new way while the camera catches up
      const camFwd = v3.set(-Math.sin(ya), 0, -Math.cos(ya));
      const side = steering ? fx * 0.25 : fx; // a slight lean into the turn instead of a sharp angle
      move.set(camFwd.x * fz - camFwd.z * side, 0, camFwd.z * fz + camFwd.x * side).normalize();
      const want = Math.atan2(move.x, move.z);
      let diff = want - heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (!fp) heading += diff * Math.min(1, dt * TURN);
      // the mouse is free (not captured): the camera comes round behind you while you walk, so it
      // looks where you go. Never while you drag it, nor for a moment after; never while you walk
      // towards the camera (it would spin round and round)
      if (camFollow && !fp && !locked() && !look && t - lookEnded > 0.8 && turnLeft <= 0) {
        const back = Math.atan2(Math.sin(heading + Math.PI - yaw), Math.cos(heading + Math.PI - yaw));
        if (Math.abs(back) < 2) { const turn = back * Math.min(1, dt * 2.2) * Math.min(1, amount); yaw += turn; backYaw += turn; }
      }
      // move the way you want to go, even while still turning to face it
      target = (running && fz > -0.1 ? RUN : WALK) * (fp && fz < -0.1 ? 0.6 : 1) * agiSpeed * (1 + (game?.boostPct('speed') || 0) / 100) * amount * Math.max(0.85, Math.sqrt(bodyH / 1.8)) * (swimming ? SWIM : 1) * (game?.injurySpeed() ?? 1) * (husbandry?.dragSlow() ?? 1) * (riding?.pace(running, WALK, RUN) ?? 1) * (powers.speed ? 3 : 1);
    }
    speedNow += (target - speedNow) * Math.min(1, dt * 8);
    if (speedNow > 0.01) {
      const px = pos.x, pz = pos.z;
      pos.x += move.x * speedNow * dt;
      pos.z += move.z * speedNow * dt;
      // (flying a dragon or wyvern: over the trees, rocks and roofs, not through them)
      const aloft = riding?.flying;
      if (!aloft) pushOffFolk(pos, bodyR);
      colliders.push(pos, bodyR, aloft ? (x, z) => sample(x, z, tmpS).h : null);
      if (depth) {
        // the cave walls: slide along them instead of walking in
        const open = (x, z) => depth.built.shape(x, z).d < -bodyR * 0.6;
        if (!open(pos.x, pos.z)) {
          if (open(pos.x, pz)) pos.z = pz;
          else if (open(px, pos.z)) pos.x = px;
          else { pos.x = px; pos.z = pz; }
        }
      } else if (inside) {
        // never out through the walls, whatever the colliders miss
        inside.built.clampPos(pos);
      } else {
        pos.x = THREE.MathUtils.clamp(pos.x, B.minX + 50, B.maxX - 50);
        pos.z = THREE.MathUtils.clamp(pos.z, B.minZ + 50, B.maxZ - 50);
      }
    }

    // The city moats are deep: those who live in the city are hauled out by the watch, and anyone
    // who doesn't belong there (a monster in a players' city, a player in a Monster City) drowns
    if (!inside && !depth && !dead && !airborne && t - moatAt > 1) {
      const city = sites.find((s) => s.place.city && s.built?.inMoat?.(pos.x, pos.z));
      if (city) {
        moatAt = t;
        const monster = RACES[character.race].side === 'monster';
        if (monster !== !!city.place.monster) { say('You sink into the moat and drown…', 'hurt'); defeated({ kind: { name: 'the moat' } }, 'drown'); }
        else {
          const back = city.built.rescue(pos.x, pos.z);
          pos.set(back.x, pos.y, back.z); pos.y = groundAt(pos.x, pos.z); speedNow = 0; autoWalk = false;
          snapCam = true;
          say('Splash! The city watch hauls you out of the moat.', 'note');
        }
      }
    }
    // Ground, jumping, the shrine platforms, and swimming in deep water
    let ground = groundAt(pos.x, pos.z);
    const water = sample(pos.x, pos.z, tmpS).water;
    const floatAt = water - bodyH * 0.7;
    swimming = ground < floatAt;
    if (swimming) ground = floatAt;
    // an admin's Fly power (outdoors, on foot): Jump goes up, Fly down goes down, and you hang in the air
    const flying = powers.fly && !dead && !inside && !depth && !riding?.riding;
    if (riding?.flyer()) {
      // on a dragon or wyvern: Space climbs (and takes off), Shift dives, and it lands on the ground
      // (over water it hovers just above the waves instead)
      if (jumpQueued) climbFor = 0.7; // (a tap of the jump button on a phone climbs for a moment)
      climbFor = Math.max(0, climbFor - dt);
      const land0 = groundAt(pos.x, pos.z), g0 = Math.max(land0, water + 2.5);
      pos.y = riding.fly(dt, held('flyup') || climbFor > 0, (flyDownHeld() || flyDown) && g0 === land0, g0, pos.y); // (no landing on water)
      if (riding.flying) swimming = false;
      ground = pos.y; velY = 0; airborne = false; fallFrom = pos.y;
    }
    else if (flying) {
      const climb = (running ? 18 : 7) * dt;
      if (held('flyup') || jumpQueued) pos.y += climb;
      if (flyDownHeld() || flyDown) pos.y -= climb;
      pos.y = Math.min(Math.max(pos.y, ground), ground + 600);
      velY = 0; airborne = pos.y > ground + 0.05; fallFrom = pos.y;
    }
    else if ((held('jump') || jumpQueued) && !airborne && !swimming && !dead) { velY = riding?.jump() ?? (game?.injurySpeed() < 1 ? 1.6 : 4.2); airborne = true; fallFrom = pos.y; }
    jumpQueued = false;
    // walking down a slope keeps your feet on it; only a real drop (a cliff, a ledge) is a fall
    const drop = pos.y - ground;
    // stepping up (a stair, a log, a bridge) lifts you over a moment instead of in one jump
    if (flying) { /* held in the air above */ } else if (!airborne && drop < 0.35 + speedNow * dt * 2.2) { pos.y = drop < -0.05 && drop > -0.85 ? pos.y + Math.min(-drop, dt * 5) : ground; velY = 0; } else {
      if (!airborne && drop > 0) { airborne = true; fallFrom = pos.y; }
      velY -= 9.81 * dt;
      pos.y += velY * dt;
      if (pos.y <= ground) {
        // landing hard hurts: past a 4 m drop, more the further you fell (water breaks the fall)
        const fell = fallFrom - ground;
        pos.y = ground; velY = 0; airborne = false;
        // (how much a fall hurts, and whether a bone breaks: see game.fall)
        const hit = fell > FALL_SAFE && !swimming && game && !dead ? game.fall(fell, bodyH) : null;
        if (hit?.dmg > 0) {
          floatText(`-${hit.dmg}`, pos.clone().add(new THREE.Vector3(0, bodyH, 0)), 'hurt');
          say(hit.broke ? `You broke your ${hit.broke === 'ribs' ? 'ribs' : hit.broke}! Get it treated at The Green Vial.` : fell > 12 ? 'A hard landing!' : 'Ouch!', 'hurt');
          lastHurt = clock.elapsedTime;
          if (hit.broke) onEvent?.('injury', { part: hit.broke });
          // nobody can be killed inside a city's walls: a fall there leaves you at 1 HP at worst
          const inCity = builtCities().some((c) => Math.hypot(pos.x - c.place.x, pos.z - c.place.z) < CITY_R);
          if (game.damage(inCity ? Math.min(hit.dmg, Math.max(0, Math.ceil(game.character.hp) - 1)) : hit.dmg)) defeated({ kind: { name: 'long fall' } }, 'fall');
        }
        fallFrom = pos.y;
      }
    }
    if (!airborne) fallFrom = pos.y;

    const eyes = firstNow();
    if (eyes && !sitting) heading = yaw - Math.PI; // in first person your body faces where you look
    avatar.position.copy(pos);
    avatar.rotation.y = heading;
    if (!sleeping) inBed = null;
    if (inBed) { avatar.position.set(inBed.x, inBed.y, inBed.z); avatar.rotation.y = 0; } // lying in the bed
    avatar.rotation.z = dead || resting() ? Math.min(Math.PI / 2, (avatar.rotation.z || 0) + dt * 3) : 0;
    avatar.visible = !(sleeping && inTent); // hidden inside the tent
    const rig = avatar.userData.rig;
    if (rig.head) rig.head.visible = !eyes; // so your own head (and helmet) doesn't fill the view
    rig.root.position.z = 0;
    // in the saddle you get off to go in, sit, sleep, or when you are knocked down
    if (riding?.riding && (inside || depth || sitting || sleeping || dead || collapsed > 0)) riding.dismount(true);
    const onHorse = !!riding?.riding;
    animateCharacter(avatar, t, onHorse ? 0 : airborne ? 0.3 : speedNow / WALK * 1.6);
    if (onHorse) {
      poseRide(rig);
      // sit on the saddle: your hips on its seat, a little in front of the middle of its back
      avatar.position.x += Math.sin(heading) * riding.seatZ(); avatar.position.z += Math.cos(heading) * riding.seatZ();
      avatar.updateMatrixWorld(true);
      const hipY = rig.legs?.[0]?.hip ? rig.legs[0].hip.getWorldPosition(v3).y - pos.y : bodyH * 0.5;
      avatar.position.y = pos.y + riding.saddle() - hipY + bodyH * 0.01;
    }
    if (sitting) { poseSit(rig); avatar.position.y = sitting.y + 0.5 - bodyH * 0.27; }
    // a blade (sword, axe, club...) is held ready: the hand in front at the waist, the blade pointing ahead
    else if (bladeHeld() && !sleeping && !dead && rig.arms) { rig.arms[0].shoulder.rotation.x = READY[0]; rig.arms[0].elbow.rotation.x = READY[1]; }
    moveHelper(dt, t);
    moveGuard(dt, t);
    others.tick(dt, t);
    // your monsters, for players close by to see (4 times a second)
    mobsSent -= dt;
    if (mobsSent <= 0 && others.count() > 0) { mobsSent = 0.25; share({ k: 'mobs', l: creatures.netState(pos) }); }

    if (skillPose) { skillPose.t += dt; poseSkill(rig, skillPose); if (skillPose.t >= skillPose.dur) skillPose = null; }
    // Attacks
    cooldown = Math.max(0, cooldown - dt);
    if (attackT >= 0) {
      const dur = Math.max(0.25, (game?.weapon() || FIST).speed * 0.8);
      attackT += dt;
      const k = attackT / dur;
      poseAttack(rig, Math.min(1, k), !!game?.weapon());
      if (!swingDone && k > 0.45) { swingDone = true; resolveSwing(); }
      if (k >= 1) attackT = -1;
    }
    checkSheathed();
    if (held('attack') && cooldown <= 0 && attackT < 0) attack();

    // Fatigue: it builds while you're awake (faster when running) and falls while you sleep.
    // At 100 you collapse where you stand, and monsters may find you.
    if (game && !dead) {
      const c = game.character;
      fatigueAcc += dt;
      if (fatigueAcc > 1) {
        const step = fatigueAcc;
        fatigueAcc = 0;
        if (sleeping) {
          c.fatigue = Math.max(0, c.fatigue - step * (inTent ? 3 : 1.6));
          restHeal(game.stats().hp * 0.03 * step, true);
          if (c.fatigue <= 0) { sleeping = false; say('You wake up rested', 'exp'); }
        } else if (collapsed > 0) {
          collapsed -= step;
          c.fatigue = Math.max(0, c.fatigue - step * 0.6);
          if (collapsed <= 0) say('You get back on your feet', 'note');
        } else {
          c.fatigue = Math.min(100, c.fatigue + step * (100 / 5400) * (riding?.riding ? RIDE_FATIGUE : running && speedNow > WALK ? 2.5 : 1) * (night ? 1.3 : 1));
          if (c.fatigue >= 100) { collapsed = 25; say('Exhausted! You collapse', 'hurt'); onEvent?.('collapsed'); }
          else if (c.fatigue >= 85 && !warnedTired) { warnedTired = true; onEvent?.('tired'); }
          if (c.fatigue < 80) warnedTired = false;
        }
        // Hunger: you grow hungry as you play (faster running, slower asleep). Hungry, rest stops
        // healing; starving, you slowly lose health (never below a tenth)
        const was = c.hunger ?? 100;
        game.hungerBy(-step * HUNGER_DRAIN * (sleeping ? 0.5 : riding?.riding ? 1 : running && speedNow > WALK ? 1.8 : 1));
        if (was >= HUNGRY && c.hunger < HUNGRY) { say('You are hungry. Eat something soon', 'hurt'); onEvent?.('hungry'); }
        if (was > 0 && c.hunger <= 0) say('You are starving! Eat, or you will grow weak', 'hurt');
        if (c.hunger <= 0) {
          starveAcc += step;
          const max = game.stats().hp;
          if (starveAcc >= 5 && c.hp > max * STARVE_FLOOR) { starveAcc = 0; const n = Math.min(Math.ceil(max * STARVE_HIT), Math.floor(c.hp - max * STARVE_FLOOR)); if (n > 0) { c.hp -= n; floatText(`-${n}`, pos.clone().add(new THREE.Vector3(0, bodyH, 0)), 'hurt'); game.touch('hp'); } }
        } else starveAcc = 0;
        game.touch('fatigue');
      }
      if (sleeping && (held('forward') || held('back') || held('left') || held('right') || Math.hypot(stick.x, stick.y) > 0.3)) { sleeping = false; say('You wake up', 'note'); }
    }

    // Rest heals you when nothing has hit you for a while
    if (game && !dead) {
      regenAcc += dt;
      if (regenAcc > 1) {
        regenAcc = 0;
        const s = game.stats();
        const c = game.character;
        // SP always comes back slowly (faster at rest); HP only when nothing has hit you for a while
        // SP comes back by itself only up to the same cap as HP; drinks and potions do the rest
        const spCap = Math.floor(s.sp * restCap(c.level, sleeping));
        if (c.sp < spCap) { c.sp = Math.min(spCap, c.sp + s.sp * (t - lastHurt > 6 ? 0.03 : 0.012)); game.touch('sp'); }
        if (t - lastHurt > 6 && c.hp < s.hp) restHeal(s.hp * 0.015, false);
      }
    }

    // Stream the land, places and monsters
    if (!depth && !inside) {
      land.update(pos.x, pos.z);
      plots.update(pos.x, pos.z);
    }
    land.animate(t);
    for (const k of skyCards.values()) { k.card.group.visible = !inside && !depth && Math.hypot(pos.x - k.place.x, pos.z - k.place.z) < 1500; if (k.card.group.visible) k.card.update(t, 42); }
    creatures.update(dt, t);
    tickEffects(dt);
    tickArrows(dt);
    skillFx.update(dt);
    if (depth) {
      tickNests(dt);
      depth.built.update(t);
      tickDangers(dt, t);
      // the shaft of daylight in the first chamber takes you back up
      const d = Math.hypot(pos.x - depth.built.exit.x, pos.z - depth.built.exit.z);
      if (d > 4) depth.leftExit = true;
      else if (depth.leftExit && d < 1.4 && !dead) leaveDepths();
    } else {
      // the shaft at the back of a cave leads down
      for (const s of sites) {
        if (s.built?.hole && !dead && Math.hypot(pos.x - s.built.hole.x, pos.z - s.built.hole.z) < 1.6) { enterDepths(s); break; }
      }
    }
    if (!depth && !inside) {
      checkGates(t);
      checkInnerGates(t);
      keepToPass(t);
      // walk into a townsperson and they talk to you
      const n = npcNear(pos.x, pos.z, bodyR + 0.55);
      if (n && n !== touched) { touched = n; talkTo(n); }
      else if (touched && Math.hypot(touched.x - pos.x, touched.z - pos.z) > 2.5) touched = null;
    }
    if (inside) {
      inside.built.update(t, pos);
      // an Academy's practice monster: it turns to you, lunges now and then and knocks you back
      const pr = practiceHere();
      const knock = pr?.update(pos, speedNow);
      if (knock) { pos.x += knock.x; pos.z += knock.z; inside.built.clampPos(pos); }
      checkRooms();
      checkInn();
      const d = Math.hypot(pos.x - inside.built.exit.x, pos.z - inside.built.exit.z);
      if (d > 3) inside.leftExit = true;
      else if (inside.leftExit && d < 1.2 && !dead) leaveBuilding();
    }
    for (const q of portals) q.built?.update(t);
    if (!depth && !inside) oil?.animate(t);
    if (holding) heldTorch.light.intensity = 20 + Math.sin(t * 13) * 2 + Math.sin(t * 7.3) * 1.5;
    if (t - lastArea > 0.5) {
      lastArea = t;
      let here;
      if (depth) here = `${depth.cave.name} · ${Math.max(0, Math.round(-pos.y))} m down`;
      else if (inside) here = inside.shop.name;
      else {
        updateSites(pos.x, pos.z);
        husbandry.updateFarms(pos.x, pos.z);
        oil?.update(pos.x, pos.z);
        tendVillages();
        const near = sites.find((s) => !s.place.cave && Math.hypot(pos.x - s.place.x, pos.z - s.place.z) < 400);
        const caveHere = sites.find((s) => s.built?.inside?.(pos.x, pos.z));
        here = caveHere ? caveById(caveHere.place.id)?.name || 'A cave' : near ? `${regionName(near.place.region)} · ${near.place.name}` : regionName(sample(pos.x, pos.z, tmpS).region);
        // a King's castle, or one of the wonders of the realm
        const castle = castles.find((q) => Math.abs(pos.x - q.c.x) < 125 && Math.abs(pos.z - q.c.z) < 125);
        const wonder = wonders.find((q) => Math.hypot(pos.x - q.w.x, pos.z - q.w.z) < q.w.r + 150);
        if (castle) here = `${regionName(sample(pos.x, pos.z, tmpS).region)} · ${castle.c.castle}`;
        else if (wonder) {
          here = `${regionName(wonder.w.region)} · ${wonder.w.name}`;
          if (!wonder.seen) { wonder.seen = true; say(`You found ${wonder.w.name}`, 'note'); onEvent?.('wonder', wonder.w); }
        }
        const nowCave = caveHere?.place.id || null;
        if (nowCave !== atCave) { atCave = nowCave; onEvent?.('cave', atCave ? caveById(atCave) : null); }
        const nowPortal = nearestPortal(pos.x, pos.z);
        if (nowPortal !== atPortal) { atPortal = nowPortal; onEvent?.('portal', atPortal); }
        const zone = safeZoneAt(pos.x, pos.z);
        if ((zone?.id || null) !== inZone) { inZone = zone?.id || null; if (zone) say(`Safe zone: monsters can't come in here`, 'note'); }
        const shop = shopNear(pos.x, pos.z);
        if ((shop?.name || null) !== atStall) { atStall = shop?.name || null; if (shop) setTimeout(() => say(`Press ${keyName(codeFor('interact'))}: ${shop.name}`, 'note'), 1200); }
      }
      if (here !== area) { area = here; onArea?.(area, { x: pos.x, z: pos.z }); }
    }

    // Camera follows behind and above, pulled in so trees, walls, stall awnings and cave walls don't block the view
    const focus = new THREE.Vector3(pos.x, pos.y + bodyH * 0.8 + (riding?.saddle() || 0) * 0.85, pos.z);
    // (tilted below level in third person, the camera stays behind you at full distance and sinks
    // towards the ground instead, then looks up: see below)
    const up = eyes ? 0 : Math.max(0, -pitch);
    const pp = eyes ? pitch : Math.max(0, pitch);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pp), Math.sin(pp), Math.cos(yaw) * Math.cos(pp));
    let want = dist;
    // (indoors the walls keep the camera in instead: pulling it in for every chair and table made it shake)
    for (let d = 1; d < (inside ? 0 : dist); d += 0.75) {
      const px = focus.x + dir.x * d, py = focus.y + dir.y * d, pz = focus.z + dir.z * d;
      const hit = (depth && depth.built.shape(px, pz).d > -0.4) || colliders.near(px, pz, 0.6).some(camBlocks(px, py, pz));
      if (hit) { want = Math.max(1.2, d - 0.6); break; }
    }
    camDist += (want - camDist) * Math.min(1, dt * (want < camDist ? 14 : 3));
    if (snapCam) camDist = want;
    const cam = focus.clone().addScaledVector(dir, camDist);
    if (up > 0) cam.y -= (cam.y - heightAt(cam.x, cam.z) - 0.5) * Math.min(1, up / 0.45);
    cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.5, water + 0.3);
    // (the roof over the camera, or over you where the camera is in the rock: the rock's nearest
    // chamber can be a deeper one, whose roof would drag the camera far below you)
    if (depth) cam.y = Math.min(cam.y, Math.max(depth.built.roofAt(cam.x, cam.z), depth.built.roofAt(pos.x, pos.z)) - 0.5);
    if (!depth && !inside) { const cave = sites.find((s) => s.built?.clampCam && s.built.inside(pos.x, pos.z)); if (cave) cave.built.clampCam(cam); }
    if (inside) {
      inside.built.clampCam(cam, inside.built.upstairs(pos));
      // in a meeting room (or the Assessment Room and its hallway) the camera stays in the room
      const rm = [...inside.built.rooms, ...(inside.built.nooks || [])].find((r) => pos.x > r.x0 && pos.x < r.x1 && pos.z > r.z0 && pos.z < r.z1);
      if (rm) { cam.x = Math.max(rm.x0 + 0.4, Math.min(rm.x1 - 0.4, cam.x)); cam.z = Math.max(rm.z0 + 0.4, Math.min(rm.z1 - 0.4, cam.z)); }
      cam.y = Math.min(cam.y, inside.built.roofAt(cam.x, cam.z) - 0.2); }
    const near = eyes ? 0.08 : 0.2;
    if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
    if (eyes) {
      // First person: at the eyes, a little in front of the face, looking the way the camera faces
      if (rig.head) avatar.updateMatrixWorld(true);
      const eye = rig.head ? rig.head.getWorldPosition(v3) : v3.set(pos.x, pos.y + bodyH * 0.92, pos.z);
      eye.addScaledVector(dir, -(rig.headR || 0.12) * 0.9);
      camera.position.copy(eye);
      camera.lookAt(eye.x - dir.x, eye.y - dir.y, eye.z - dir.z);
      camDist = 0;
    } else {
      // after going through a door (or a portal), the camera jumps with you instead of flying across
      if (snapCam) camera.position.copy(cam); else camera.position.lerp(cam, Math.min(1, dt * 10));
      // looking up, the view aims above your head, so you sink to the bottom of the screen and the
      // sky fills the rest
      if (up > 0) {
        // tilt up by as much as you asked (all the way up, you sink out of the bottom of the screen and
        // see only sky, like a person looking straight up)
        const flat = Math.max(0.5, Math.hypot(focus.x - camera.position.x, focus.z - camera.position.z));
        const toHead = Math.atan2(focus.y + bodyH * 0.25 - camera.position.y, flat);
        const a = Math.max(up * 1.45, toHead);
        camera.lookAt(focus.x, camera.position.y + Math.tan(a) * flat, focus.z);
      } else camera.lookAt(focus);
    }
    snapCam = false;

    if (t - lastTime > 0.5) { lastTime = t; applyTime(); }
    lantern.position.set(pos.x, pos.y + bodyH + 1, pos.z);
    lightTorches(t);
    sun.position.copy(pos).addScaledVector(lightDir, 120);
    sun.target.position.copy(pos);
    for (const s of sites) s.built?.update?.(t, pos, blockedAt);
    // a Ceremony: the townsfolk gather round the shrine while you stand there for yours, and while
    // a new card (yours or anyone's) is fresh in the sky over it
    if (t - gatherAt > 1) {
      gatherAt = t;
      for (const s of builtCities()) {
        if (!s.built.gather) continue;
        const k = skyCards.get(s.place.id);
        if (!inside && !depth && game && ceremonyDue(game.character) && Math.hypot(pos.x - s.place.x, pos.z - s.place.z) < 12) s.ceremonyAt = t;
        // (yours: they stay a little while after, until your card shows in the sky)
        s.built.gather(t - (s.ceremonyAt ?? -1e9) < 30 || (!!k && realmNow() - k.at < GATHER_MS));
      }
    }
    for (const q of mobVillages.values()) q.built.update(t, pos, creatures.list);
    if (!depth && !inside) { husbandry.tick(dt, t); crops?.tick(t); riding?.tick(dt, t, speedNow, airborne); dragonFight(dt); hatchery?.tick(dt, t); }
    walkBuild?.update();
    sky.follow(camera);

    if (camOverride) { camera.position.set(...camOverride[0]); camera.lookAt(...camOverride[1]); avatar.visible = !!camOverride[2]; }
    if (t - lastCrowd > 0.25) { lastCrowd = t; updateCrowd(camera.position.x, camera.position.y, camera.position.z, scene); }
    renderer.render(scene, camera);

    // floating text rises and fades
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const f of [...floaters]) {
      f.t += dt;
      v3.copy(f.at).add(new THREE.Vector3(0, f.t * 0.8, 0)).project(camera);
      if (f.t > 1.4 || v3.z > 1) { f.el.remove(); floaters.splice(floaters.indexOf(f), 1); continue; }
      f.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * w}px, ${(-v3.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(Math.min(1, 2.2 - f.t * 1.6));
    }

    if (t - lastSave > 10 && onSaveLocation && !dead) {
      lastSave = t;
      onSaveLocation(here());
    }
  });

  // where you are, for saving: underground counts as the cave's mouth
  const here = () => (depth ? { x: depth.back.x, y: heightAt(depth.back.x, depth.back.z), z: depth.back.z, heading: depth.back.heading }
    : inside ? { x: inside.back.x, y: heightAt(inside.back.x, inside.back.z), z: inside.back.z, heading: inside.back.heading }
      : { x: pos.x, y: pos.y, z: pos.z, heading });
  const saveNow = () => onSaveLocation?.(here());
  window.addEventListener('pagehide', saveNow);

  // What everyone has built on their land; redrawn when it changes or a hired builder finishes
  const structures = new Map(); // "ix,iz" -> { group, solid, sig }
  let lastLands = [];
  // your own finished anvil close by, if any
  function myAnvilNear(x, z, r = 2.6) {
    const now = Date.now();
    for (const p of lastLands) {
      if (!p.mine || !Number.isFinite(p.flat)) continue;
      for (const q of p.pieces || []) {
        if (q.t !== 'anvil' || q.u > now) continue;
        if (Math.hypot((q.x + 0.5) * CELL - x, (q.z + 0.5) * CELL - z) < r) return q;
      }
    }
    return null;
  }
  // a finished display stand close by (anyone's): { piece, mine, owner }
  function standNear(x, z, r = 2.1) {
    const now = Date.now();
    let best = null, bd = r;
    for (const p of lastLands) {
      if (!Number.isFinite(p.flat)) continue;
      for (const q of p.pieces || []) {
        if (q.t !== 'stand' || q.u > now || Math.abs(storeyY(p.flat, q.l) - pos.y) > 2.5) continue;
        const d = Math.hypot((q.x + 0.5) * CELL - x, (q.z + 0.5) * CELL - z);
        if (d < bd) { bd = d; best = { piece: q, mine: !!p.mine, owner: p.owner }; }
      }
    }
    return best;
  }
  function showStructures(list) {
    lastLands = list;
    const now = Date.now();
    const seen = new Set();
    for (const p of list) {
      if (!p.pieces?.length || !Number.isFinite(p.flat)) continue;
      const k = `${p.ix},${p.iz}`;
      seen.add(k);
      // the drawing changes when the pieces do, or when scaffolding comes down
      const sig = JSON.stringify(p.pieces) + p.pieces.filter((q) => q.u && q.u > now).length;
      const old = structures.get(k);
      if (old?.sig === sig) continue;
      if (old) { scene.remove(old.group); colliders.remove(old.solid); }
      const group = buildPieces(p.pieces, () => p.flat, { now });
      const solid = pieceColliders(p.pieces, () => p.flat);
      scene.add(group); colliders.add(solid);
      structures.set(k, { group, solid, sig });
    }
    for (const [k, old] of structures) if (!seen.has(k)) { scene.remove(old.group); colliders.remove(old.solid); structures.delete(k); }
    // the tops of foundations and floors, cell by cell, to walk on
    solidTops.clear();
    for (const p of list) {
      if (!p.pieces?.length || !Number.isFinite(p.flat)) continue;
      for (const q of p.pieces) {
        if ((q.t !== 'foundation' && q.t !== 'floor') || (q.u && q.u > now)) continue;
        const k = `${q.x},${q.z}`;
        if (!solidTops.has(k)) solidTops.set(k, []);
        solidTops.get(k).push(storeyY(p.flat, q.l));
      }
    }
  }
  setInterval(() => { if (lastLands.length) showStructures(lastLands); }, 15000);

  // Step out of a portal somewhere else (a few metres in front of its stones)
  function teleport(x, z) {
    if (depth || dead) return false;
    if (sleeping) toggleSleep();
    pos.set(x, 0, z + 5);
    updateSites(pos.x, pos.z);
    land.update(pos.x, pos.z, Infinity);
    pos.y = groundAt(pos.x, pos.z);
    velY = 0;
    atPortal = nearestPortal(pos.x, pos.z, 6);
    snapCam = true;
    saveNow();
    return true;
  }

  // The tutorial's beam of light over the place it wants you to go (see tutorial.js): a tall soft
  // column you can see from across the city, and a gold arrow bobbing over the spot
  let guide = null;
  const guideMats = {
    beam: new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    arrow: new THREE.MeshBasicMaterial({ color: 0xffc23a, fog: false }),
  };
  function setGuide(at) {
    if (guide) { scene.remove(guide); guide = null; }
    if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.z)) return;
    guide = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 16, 1, true), guideMats.beam);
    beam.position.y = 30;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 4), guideMats.arrow);
    arrow.rotation.x = Math.PI; // pointing down at the spot
    arrow.position.y = 3.2;
    arrow.onBeforeRender = () => { const t = performance.now() / 1000; arrow.position.y = 3.2 + Math.sin(t * 2.4) * 0.35; arrow.rotation.y = t * 1.5; };
    guide.add(beam, arrow);
    guide.position.set(at.x, surfaceAt(at.x, at.z), at.z);
    scene.add(guide);
  }

  return {
    rebuildAvatar,
    setGuide,
    // for the tutorial's arrow: where you stand, which way the camera looks, and whether you are
    // indoors or down a cave (the arrow points outside the world then)
    guideView: () => ({ x: pos.x, z: pos.z, yaw, inside: !!inside, depth: !!depth }),
    jump() { jumpQueued = true; },
    // an admin's powers turned on or off; landing after flying never hurts
    setPowers(p) {
      if (powers.fly && !p.fly) fallFrom = -Infinity;
      powers = { ...p };
    },
    // on a flying mount: the phone's dive button (held) and whether you are in the air
    flyDown(on) { flyDown = !!on; },
    commandDragon: () => commandDragon(),
    petOrder, castSpellNamed,
    petNow: () => { const c = riding?.companion(), m = riding?.mount(); return c ? { kind: 'dragon', id: c.id, item: m?.item, name: BEASTS[c.id].name } : m ? { kind: 'mount', id: m.id, item: m.item, name: ITEMS[m.item]?.name } : null; },
    get hasDragon() { return !!riding?.companion(); },
    // an admin's Dragon radar: every dragon and wyvern lair and the Spirit King's lake, and where the
    // beast is now if it is near
    radar() {
      const out = [];
      for (const L of allLairs()) {
        const b = BEASTS[L.kind];
        const m = creatures.list.find((q) => q.lair === L && !q.dead);
        const x = m ? m.x : L.x, z = m ? m.z : L.z;
        out.push({ id: L.id, name: b.name, king: !!b.king, boss: !!b.boss, wyvern: b.shape === 'wyvern', spirit: b.shape === 'spirit', x, z, dist: Math.hypot(x - pos.x, z - pos.z),
          seen: !!m, air: m ? Math.round(m.air || 0) : 0, hp: m ? Math.round(100 * m.hp / m.maxHp) : null, backIn: creatures.slainIn(L.id) });
      }
      return { x: pos.x, z: pos.z, yaw, beasts: out.sort((a, b) => a.dist - b.dist) };
    },
    get flying() { return !!riding?.flying; },
    get flyer() { return !!riding?.flyer(); },
    position: () => ({ x: pos.x, z: pos.z, heading }),
    // for seeing each other: exactly where you are and what you are doing, and which place you are in
    presence() {
      const place = depth ? `cave:${String(depth.cave.id).replace(/[^\w-]/g, "_").slice(0, 40)}` : inside ? `in:${String(inside.shop.id || 'room').replace(/[^\w-]/g, '_').slice(0, 40)}:${Math.round(inside.shop.x)},${Math.round(inside.shop.z)}` : 'out';
      const pose = dead || sleeping || collapsed > 0 ? 'lie' : sitting ? 'sit' : riding?.flying ? 'fly' : riding?.riding ? 'ride' : '';
      // your dragon (ridden or beside you) or your hatchling, for everyone to see
      const c = riding?.companion(), h = hatchery?.petSpot();
      const pet = c ? { k: c.id, x: c.x, y: c.y, z: c.z, h: c.heading, air: c.air } : h ? { k: `h:${h.kind}`, x: h.x, y: h.y, z: h.z, h: h.heading, air: h.air, s: h.scale } : null;
      return { x: avatar.position.x, y: avatar.position.y, z: avatar.position.z, heading, speed: speedNow, place, pose, pet };
    },
    showOthers: (list) => others.show(list),
    moveOther: (m) => others.move(m),
    actOther: (m) => actOther(m),
    get othersNear() { return others.count(); },
    debugOthers: () => others.list(),
    debugMobs: () => creatures.list.filter((m) => m.nid || m.ghost).map((m) => ({ k: m.kindId, ghost: !!m.ghost, hp: m.hp, x: Math.round(m.x), z: Math.round(m.z), dead: !!m.dead })),
    // where you are out in the world (the door you came in by, while indoors)
    outdoors: () => (inside ? { x: inside.back.x, z: inside.back.z } : { x: pos.x, z: pos.z }),
    // for testing: where you and the camera are
    // Build from your character: a see-through piece in front of you, where the camera looks
    startWalkBuild(host, opts) {
      if (walkBuild) return walkBuild;
      walkBuild = startWalkBuild(scene, host, {
        ...opts,
        aim(d) {
          const dx = pos.x - camera.position.x, dz = pos.z - camera.position.z, l = Math.hypot(dx, dz) || 1;
          return { x: pos.x + (dx / l) * d, z: pos.z + (dz / l) * d };
        },
        onClose() { walkBuild = null; opts.onClose?.(); },
      });
      return walkBuild;
    },
    get walkBuilding() { return !!walkBuild; },
    debugSlayVillage(id) { for (const m of creatures.list.filter((q) => q.village === id && !q.dead)) finishHit(m, creatures.hit(m, m.hp)); },
    debugUse: () => interact(),
    // hunting (the choice shown for a body, a campfire from Firewood)
    dragCarcass: () => husbandry.drag(),
    cutCarcass: () => husbandry.cut(),
    baitCarcass: () => husbandry.bait(),
    stuffCarcass: (how) => husbandry.stuff(how),
    debugBaits: () => husbandry.debugBaits(),
    debugBaitNow: () => husbandry.debugBaitNow(),
    debugPullVisitor: (d) => husbandry.debugPullVisitor(d),
    lightCampfire: () => (!inside && !depth ? husbandry.lightCampfire() : 'inside'),
    // oil: everyone's derricks, and where you would dig a test pit (just in front of you), or why not
    setWells: (list) => oil?.setWells(list),
    digSpot() {
      if (inside || depth) return { error: 'You can only dig outside, in the open.' };
      if (riding?.riding) return { error: 'Get off your mount to dig.' };
      const x = pos.x + Math.sin(heading) * 1.2, z = pos.z + Math.cos(heading) * 1.2;
      const s = sample(x, z, tmpS);
      if (s.h < s.water + 0.1) return { error: 'You can\'t dig in water.' };
      return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
    },
    digPit: (x, z) => oil?.pit(x, z, heading),
    plantSeed: (id) => (!inside && !depth ? crops?.plantSeed(id) : 'inside'),
    callMount: (id) => riding?.toggle(id),
    placeEgg: (id) => hatchery?.placeEgg(id),
    debugHatchery: () => hatchery?.debug(),
    debugWarmEggs: (secs) => hatchery?.debugWarm(secs),
    debugGrowPet: (secs) => hatchery?.debugGrow(secs),
    riding: () => !!riding?.riding,
    debugCrops: () => crops?.beds(),
    // make every bed `mins` minutes older (for tests)
    debugAgeCrops(mins) { for (const b of game.character.crops) if (b.at) { b.at -= mins * 60000; if (b.w) b.w -= mins * 60000; } crops?.redraw(); },
    debugMount: () => riding?.mount(),
    debugBlocked: (x, z, r, y) => { const e = blockedAt(x, z, r, y); return e ? { x: e.x, z: e.z, y: e.y, r: e.r, kind: e.kind, part: !!e.part } : null; },
    debugAnimalYs: () => creatures.list.filter((m) => m.kind.animal).map((m) => ({ id: m.kind.animalId, x: m.x, y: m.y, z: m.z, r: m.radius })),
    debugCalmAnimals() { for (const m of creatures.list) if (m.kind.animal) { m.fedT = Math.min(m.fedT || 0, 20); m.fleeT = 0; } },
    debugSetFarmPlots(list) { myFarmPlots = list; crops?.redraw(); },
    debugFarms: () => husbandry.farms(),
    debugAnimals: () => creatures.list.filter((m) => m.kind.animal).map((m) => ({ id: m.kind.animalId, x: m.x, z: m.z, dead: !!m.dead, farm: m.farm || null, hp: m.hp, death: m.death ? { t: m.death.t, left: m.death.left } : null, vis: m.body.visible })),
    debugHitAnimal(id, dmg = 15) { const m = creatures.list.filter((q) => q.kind.animalId === id && !q.dead).sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z))[0]; if (!m) return null; finishHit(m, creatures.hit(m, dmg, 'slash')); return { hp: m.hp, dead: !!m.dead }; },
    debugBodies: () => creatures.list.filter((m) => m.death && !m.death.animal).map((m) => ({ t: m.death.t, left: Math.round(m.death.left), gone: m.death.gone || 0 })),
    debugAgeMonsterBodies(ms) { for (const m of creatures.list) if (m.death && !m.death.animal) m.death.at -= ms; },
    debugAgeBodies() { for (const m of creatures.list) if (m.death?.animal) m.death.t = Math.max(m.death.t, 2); },
    debugAt: () => ({ x: pos.x, z: pos.z, dragging: husbandry.dragging?.kind.animalId || null }),
    // the great beasts' lairs, and a jump to one of them (kind: fire_dragon, spirit_king, ...)
    debugLairs() { return allLairs().map((l) => ({ id: l.id, kind: l.kind, x: Math.round(l.x), z: Math.round(l.z) })); },
    debugGoLair(kind, back = 150) { const l = allLairs().find((q) => q.kind === kind || q.id === kind); if (!l) return null; const x = l.x + back, z = l.z; this.debugTeleport(x, z); return { x, z }; },
    debugBeast() { const m = creatures.list.find((q) => q.kind.beast); return m ? { name: m.kind.name, x: Math.round(m.x), z: Math.round(m.z), y: Math.round(m.y), air: Math.round(m.air || 0), mode: m.mode, hp: m.hp, maxHp: m.maxHp, risen: m.risen, dead: m.dead, dist: Math.round(Math.hypot(m.x - pos.x, m.z - pos.z)) } : null; },
    debugBeastClose(d = 25, air = 10) { const m = creatures.list.find((q) => q.kind.beast && !q.dead); if (!m) return null; m.x = pos.x + d; m.z = pos.z; m.air = air; m.heading = -Math.PI / 2; if (m.kind.beast.shape !== 'spirit') { m.mode = 'dive'; m.angry = true; } return true; },
    debugBeastMode(mode) { const m = creatures.list.find((q) => q.kind.beast && !q.dead); if (!m) return null; m.mode = mode; m.modeT = 0; m.angry = true; return true; },
    debugInteract() { interact(); },
    debugRide() { return { mount: riding?.mount(), flying: !!riding?.flying, flyer: !!riding?.flyer(), y: pos.y, ground: groundAt(pos.x, pos.z) }; },
    debugHitBeast(dmg) { const m = creatures.list.find((q) => q.kind.beast && !q.dead); if (!m) return null; const r = creatures.hit(m, dmg, 'slash'); finishHit(m, r); return r ? { exp: r.exp, drops: r.drops } : { hp: m.hp }; },
    debugDragon: () => ({ c: riding?.companion(), sic: sicOn ? sicOn.kind.name : null, foe: lastFoe ? lastFoe.m.kind.name : null, grudges: game?.character.grudges || null, cd: dragonCd }),
    debugSpawnAnimal(id, dx = 0, dz = 6) { return creatures.spawnAt(`a_${id}`, 1, pos.x + dx, pos.z + dz, { keep: true }); },
    debugFace(h) { heading = h; yaw = h + Math.PI; snapCam = true; },
    debugTeleport(x, z) { pos.set(x, groundAt(x, z, 1e4), z); snapCam = true; updateSites(x, z); husbandry.updateFarms(x, z); land.update(x, z, Infinity); },
    debugTalkParent() { for (const c of builtCities()) { const n = c.built.npcs.find((q) => q.kind === 'parent' && q.mine); if (n) { pos.set(n.x + 1, pos.y, n.z); talkTo(n); return true; } } return false; },
    // for testing: what a frame draws, grouped by what it is
    debugCensus() {
      const frus = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const out = {}; let calls = 0, tris = 0, shadowCalls = 0;
      scene.traverseVisible((o) => {
        if (!o.isMesh && !o.isPoints && !o.isLine) return;
        const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
        if (o.frustumCulled !== false && g.boundingSphere !== null && !frus.intersectsObject(o)) { if (o.castShadow) shadowCalls++; return; }
        let top = o; const chain = []; while (top.parent && top.parent !== scene) { if (top.name) chain.push(top.name); top = top.parent; }
        let k = (top.name || top.userData.kind || top.type) + '/' + (chain[chain.length - 1] || '') + '/' + g.type + (o.isInstancedMesh ? '[inst]' : '') + (o.isSkinnedMesh ? '[skin]' : '');
        const e = out[k] || (out[k] = { n: 0, tris: 0, shadow: 0 }); e.n++; e.tris += n; if (o.castShadow) { e.shadow++; shadowCalls++; }
        calls++; tris += n;
      });
      return { calls, tris: Math.round(tris), shadowCalls, top: Object.entries(out).sort((a, b) => b[1].n - a[1].n).slice(0, 25).map(([k, v]) => `${k}: ${v.n} draws ${Math.round(v.tris / 1000)}k tris ${v.shadow} shadow`) };
    },
    debugScene: () => scene,
    debugDepths() { const q = sites.find((c) => c.place.cave && c.built); if (q) enterDepths(q); return !!q; },
    debugTorch(v) { holding = !v; setHolding(v); },
    debugDangers() {
      if (!depth) return null;
      const b = depth.built, L = b.layout;
      const pits = L.tunnels.filter((t) => t.chasm).map((t) => { const dx = t.b.x - t.a.x, dz = t.b.z - t.a.z, l = Math.hypot(dx, dz), u = t.a.r + (l - t.a.r - t.b.r) * t.chasm.at; return { x: t.a.x + dx / l * u, z: t.a.z + dz / l * u, dir: Math.atan2(dx, dz) }; });
      return { pits, traps: b.traps.map((t) => ({ x: t.x, z: t.z, kind: t.kind })), cracks: b.cracks.map((c) => ({ x: c.x, z: c.z, ux: c.ux, uz: c.uz })), hp: game.character.hp };
    },
    debugCam(at, look, showSelf = false) { camOverride = at ? [at, look, showSelf] : null; if (!at) avatar.visible = true; },
    debugMove(x, z, h) { pos.set(x, groundAt(x, z), z); if (h !== undefined) { heading = h; yaw = h + Math.PI; } },
    debugMonsters: () => creatures.list.filter((m) => !m.dead).map((m) => ({ n: m.title || m.kind.name, x: m.x, y: m.y, z: m.z, g: surfaceAt(m.x, m.z), by: m.body.position.y })),
    debugRoofs: (r = 80) => colliders.near(pos.x, pos.z, r).filter((e) => e.camOnly).map((e) => [e.x, e.z]),
    debugState: () => ({ x: pos.x, y: pos.y, z: pos.z, heading, yaw, cam: camera.position.toArray(), inside: !!inside, sitting: !!sitting, monsters: creatures.list.filter((m) => !m.dead).map((m) => `${m.title || m.kind.name} ${m.level}`), villages: game?.villages().map((v) => ({ id: v.id, x: v.x, z: v.z, race: v.race, folk: v.folk.length, dead: v.dead.length, built: mobVillages.has(v.id) })) }),
    teleport,
    get atPortal() { return atPortal; },
    set paused(v) { paused = !!v; keys.clear(); },
    // the Monster Kings' courts, from the server
    setCourts(list) { courts = list || []; for (const q of castles) { if (q.court && q.built) continue; seatCourt(q); } },
    attack,
    useSkill,
    nextSpell,
    passGate,
    // what lifts your City Pass besides birth and level: houses you own ({ city, tier }) and a crown
    setPassPerks(p) { passPerks = { homes: p?.homes || [], crowned: p?.crowned || false }; },
    passPerks: () => passPerks,
    setCityGates,
    setHomes,
    setCeremonies,
    atShrine,
    riseAtShrine,
    // build a little more of the land around you (`ms` of work); returns how many pieces are left
    catchUpLand: (ms = 12) => (depth || inside ? 0 : land.update(pos.x, pos.z, ms)),
    // hold still while the death screen is up (no input, monsters leave you be)
    get dead() { return dead; },
    stand() { dead = false; },
    oldAge,
    trainingAt,
    // Redraw your gear after equipping or taking something off
    refreshGear() { if (game) { wearGear(avatar, game.worn()); showWeapon(); } },
    holdTorch() { setHolding(!holding); },
    get holding() { return holding; },
    get underground() { return !!depth || !!inside; },
    get indoors() { return inside ? { shop: inside.shop, kind: inside.built.kind } : null; },
    // the meeting rooms you may be in: { room id: until (ms) }
    setRooms(map) { allowedRooms = { ...map }; },
    setCastleAccess(a) { castleAccess = { ...a }; },
    leaveBuilding: () => leaveBuilding(),
    // where you are inside a building (in its own metres from the door), for the castle's map
    indoors: () => (inside ? { kind: inside.built.kind, x: pos.x - inside.built.exit.x, z: pos.z - inside.built.exit.z + 0.4, up: pos.y > 2 } : null),
    // for testing: go into a city building by its id
    // for testing: a goblin a few steps ahead, killed (or maimed) by a blow of this kind
    debugKill(how, { maim = false, strong = false, kind = 'goblin', d = 3, side = 0 } = {}) {
      const x = pos.x + Math.sin(heading) * d + Math.cos(heading) * side, z = pos.z + Math.cos(heading) * d - Math.sin(heading) * side;
      const m = creatures.spawnAt(kind, 5, x, z, { keep: true });
      m.heading = heading + Math.PI; m.body.rotation.y = m.heading; m.angry = false; m.state = 'lurk';
      if (maim) { for (let i = 0; i < 30 && !m.bits; i++) { m.hp = m.maxHp; creatures.hit(m, Math.ceil(m.maxHp / 5), "slash"); } m.hp = m.maxHp; return !!m.bits; }
      finishHit(m, creatures.hit(m, m.hp * (strong ? 3 : 1), how, strong));
      return { x: m.x, y: m.y, z: m.z };
    },
    debugDie(name = 'Goblin') { defeated({ kind: { name } }); },
    debugDeaths: () => creatures.list.filter((m) => m.death).map((m) => m.death.t),
    debugLeave() { if (inside) leaveBuilding(); },
    debugCounter() { const c = inside?.built?.counter; if (!c) return false; pos.set(c.x, c.y, c.z); useIndoors(); return true; },
    // for testing: the Academy's practice monster (where it is) and a swing
    debugPractice() { const p = inside?.built.practice; practiceHere(); return p ? { x: p.ox + p.body.position.x, z: p.oz + p.body.position.z, school: p.school, facing: p.body.rotation.y, lying: p.body.rotation.z } : null; },
    debugSwing: () => resolveSwing(),
    debugEnter(id) { for (const c of builtCities()) { const sh = c.built.shops.find((q) => q.id === id); if (sh) { pos.set(sh.x, pos.y, sh.z); enterBuilding(sh); return true; } } return false; },
    refreshHelper,
    refreshGuard,
    sleep: toggleSleep,
    placeTorch,
    pitchTent,
    get resting() { return sleeping ? 'sleeping' : collapsed > 0 ? 'collapsed' : null; },
    say,
    // Land: show or hide the buying grid, and take everyone's plots from the server
    setLandMode(v) { plots.setMode(v); },
    get landMode() { return plots.on; },
    selectPlot(p) { return plots.select(p); },
    choosePlots(list) { plots.setChosen(list); },
    // where you are, as saved
    here: () => here(),
    setLands(list) {
      const before = new Set(prepared);
      // a plot redraws when it is cleared or flattened
      prepared = new Set(list.filter((p) => Number.isFinite(p.flat) || p.cleared).map((p) => `${p.ix},${p.iz}${Number.isFinite(p.flat) ? `,${p.flat}` : ''}`));
      setPreparedPlots(list);
      for (const k of prepared) {
        if (before.has(k)) continue;
        const [ix, iz] = k.split(',').map(Number);
        land.refreshAt((ix + 0.5) * PLOT, (iz + 0.5) * PLOT, 30);
      }
      plots.setLands(list);
      myFarmPlots = list.filter((p) => p.mine && p.purpose === 'farm');
      crops?.redraw();
      setSettledLand(list); // settled land tames the wilds around it
      showStructures(list);
    },
    // let the mouse go (a window is opening)
    releaseMouse() { if (locked()) { letGo = true; document.exitPointerLock(); } },
    lockMouse,
    get mouseLocked() { return locked(); },
    setMouseMode(mode) { freeMouse = mode === 'free'; if (freeMouse && locked()) { letGo = true; document.exitPointerLock(); } },
    setGraphics(choice) { applyQuality(pickQuality(choice)); return quality.key; },
    get graphics() { return quality.key; },
    debug: { scene, renderer, camera }, // (tests: what is drawn, and how much)
    setCameraMode(mode) { cameraMode = mode === 'follow' ? 'follow' : 'free'; },
    setCameraFollow(on) { camFollow = on !== 'off' && on !== false; },
    setFeel,
    setView(mode) { setView(mode); },
    // order a drink in the tavern: `served` runs when the waiter brings it to you (wherever you are inside)
    tavernOrder(served) { if (inside?.built.order) inside.built.order(() => ({ x: pos.x, z: pos.z }), served); },
    toggleView() { setView(viewMode === 'first' ? 'third' : 'first', true); },
    stop() {
      saveNow();
      renderer.setAnimationLoop(null);
      creatures.clear();
      others.clear();
      skillFx.clear();
      land.dispose();
      sky.dispose();
      floatLayer.remove();
      plots.dispose();
      oil?.dispose();
      stickEl.remove();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', letGoKeys);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pagehide', saveNow);
      renderer.dispose();
    },
  };
}

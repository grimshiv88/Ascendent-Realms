// The playable world: the whole map as streamed 3D land, your character, monsters, and a third-person camera.
import * as THREE from 'three';
import { createLand } from './land.js';
import { pickQuality } from './quality.js';
import { createSky, HORIZON } from './sky.js';
import { buildSpawn } from './spawn.js';
import { buildCity, buildVillage } from './city.js';
import { GUILD_HALL_LEVEL } from '../data/guildcard.mjs';
import { buildInterior } from './interiors.js';
import { mayEnterCastle, castleDay } from '../data/interiors.mjs';
import { buildCave } from './caves.js';
import { createCreatures, KINDS, monsterHit, GOBLIN_LINE } from './creatures.js';
import { buildMobVillage } from './mobvillage.js';
import { startWalkBuild } from './buildwalk.js';
import { VILLAGES_AT_ONCE, VILLAGE_RETURNS_MS, VILLAGE_NEAR, VILLAGE_KIND, VILLAGE_SIZES, pickSize, newVillage, villageName, villageCleared, villageLoot } from '../data/mobvillages.mjs';
import { createSkillFx } from './skillfx.js';
import { codeFor, actionFor, keyName } from '../data/controls.mjs';
import { buildDepths } from './depths.js';
import { buildPortal } from './portal.js';
import { buildPieces, pieceColliders, storeyY } from './buildings.js';
import { allPortals, nearestPortal } from '../data/portals.mjs';
import { allCastles, KING_RETURNS_MS } from '../data/kings.mjs';
import { placeBuilding, CELL } from '../data/building.mjs';
import { caveById, THEMES, chestLoot } from '../data/depths.mjs';
import { BREAKABLE, breakNeeds } from './scenery.js';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { updateCrowd } from '../characters/crowd.js';
import { wearGear } from '../characters/gear.js';
import { heightAt, surfaceAt, safeZoneAt, sample, placesWithPositions, regionName, WORLD_BOUNDS, setPreparedPlots, PLOT, setUnderground, CITY_R } from '../data/world-layout.mjs';
import { createPlots } from './plots.js';
import { gameTime, now as realmNow } from '../data/clock.mjs';
import { RACES, restCap, killExpScale, EVOLUTIONS } from '../data/game-data.mjs';
import { skyCard } from './skycard.js';
import { BODYGUARDS, guardHit } from '../data/hire.mjs';
import { setSettledLand, wildLevelAt } from '../data/wilds.mjs';
import { ITEMS, weaponReach, weaponEffect, EFFECTS, MARKETS, stoneChance, randomStone } from '../data/items.mjs';
import { ageOf, isChild, ACADEMY_NAME, parentAlive, CEREMONY_SHOW_MS } from '../data/birth.mjs';
import { money } from '../data/money.mjs';

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
  let quality = pickQuality(view?.graphics);
  // (smoothing the edges is chosen once, as the page starts: it can't change later)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.key !== 'low', logarithmicDepthBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(HORIZON, quality.fog);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.2, 40000);

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
  function applyQuality(q) {
    quality = q;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    sun.castShadow = q.shadows;
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
        const pieces = placeBuilding('castle', q.c.cell[0], q.c.cell[1], 0);
        const group = buildPieces(pieces, () => q.c.flat, { stone: true });
        // the throne, in the middle of the keep
        const throne = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.2), new THREE.MeshStandardMaterial({ color: '#c9a03a', metalness: 0.6, roughness: 0.35 }));
        throne.position.set(q.c.x, q.c.flat + 0.3 + 1.3, q.c.z - 1.5);
        group.add(throne);
        const solid = pieceColliders(pieces, () => q.c.flat);
        scene.add(group); colliders.add(solid);
        q.built = { group, solid };
        q.court = null;
        seatCourt(q);
      } else if (d > 1400 && q.built) {
        scene.remove(q.built.group); colliders.remove(q.built.solid);
        creatures?.removeWhere((m) => m.site === `castle-${q.c.race}`);
        q.built = null; q.court = null;
      }
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
    // two guards outside the gate and four in the courtyard
    for (const [gx, gz] of [[-3, 21.5], [3, 21.5], [-10, 10], [10, 10], [-10, -10], [10, -10]]) {
      creatures.spawnAt(`guard_${race}`, 400 + Math.round(Math.random() * 200), x + gx, z + gz, extra({ guard: { heading: 0 }, title: 'Royal Guard' }));
    }
    // the Overlords stand around the throne room
    court.overlords.forEach((o, i) => {
      const a = Math.PI * (0.15 + (i / Math.max(1, court.overlords.length - 1)) * 0.7);
      creatures.spawnAt(`overlord_${race}`, o.level, x + Math.cos(a) * 5, z - 1.5 + Math.sin(a) * 4, extra({ guard: { heading: 0 }, boss: true, title: o.name }));
    });
    // the King sits the throne, unless it is empty or a player wears the crown
    if (court.king?.npc && Date.now() - (court.slainAt || 0) >= KING_RETURNS_MS) {
      const lvl = court.king.level;
      const king = creatures.spawnAt(`king_${race}`, lvl, x, z - 0.2, extra({ guard: { heading: 0 }, boss: true, title: `${court.king.name}, ${title}`, maxHp: Math.round((8 + lvl * 3.5) * 12), hp: Math.round((8 + lvl * 3.5) * 12) }));
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
  const builtCities = () => sites.filter((s) => s.place.city && s.built?.npcs);
  // the cards of new Ceremonies, hanging in the sky over each city's shrine (the latest one per city)
  const skyCards = new Map(); // city id -> { at, card, place }
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
  function talkTo(n) { n.talkUntil = clock.elapsedTime + 6; onEvent?.('npc', n); }
  let touched = null; // the townsperson you last walked into (they talk once, until you step away)
  // townsfolk close enough to talk to
  function npcNear(x, z, r = 2.4) {
    for (const s of builtCities()) for (const n of s.built.npcs) if (Math.hypot(n.x - x, n.z - z) < r) return n;
    return null;
  }
  // the school whose station on the Training Grounds you stand at (with its teacher), or null
  function trainingAt() {
    for (const s of builtCities()) for (const st of s.built.stations || []) if (Math.hypot(st.x - pos.x, st.z - pos.z) < 4.5) return st.school;
    return null;
  }
  function updateSites(x, z) {
    updatePortals(x, z);
    updateCastles(x, z);
    for (const s of sites) {
      const d = Math.hypot(x - s.place.x, z - s.place.z);
      if (d < 1000 && !s.built) {
        s.built = s.place.cave ? buildCave(s.place) : s.place.city ? buildCity(s.place, { home: homeOf() }) : s.place.village ? buildVillage(s.place) : buildSpawn(s.place);
        s.built.group.name ||= s.place.id || 'place';
        scene.add(s.built.group);
        if (s.built.solid) colliders.add(s.built.solid);
        if (cityRaised[s.place.id]) s.built.setRaised?.(true, colliders);
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
    if (game) wearGear(avatar, game.worn());
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
  // 'third': the camera is behind you. 'first': you see through your character's eyes (head hidden,
  // arms and weapon still there). Scrolling all the way in goes to first person, scrolling out comes back.
  let viewMode = view?.view === 'first' ? 'first' : 'third';
  const firstNow = () => viewMode === 'first' && !dead && !sleeping;
  const pitchLo = () => (firstNow() ? -1.35 : -0.15), pitchHi = () => (firstNow() ? 1.35 : 1.2);
  function setView(mode, tell) {
    viewMode = mode === 'first' ? 'first' : 'third';
    if (viewMode === 'third') { pitch = THREE.MathUtils.clamp(pitch, 0.1, 1.2); dist = Math.max(dist, 3); camDist = Math.min(camDist, 1.2); }
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
  // One real hour is a day. The sun crosses the sky; at night a dim moon lights the land.
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
  const lantern = new THREE.PointLight('#ffcf8a', 0, 14, 1.6);
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
  const torchLamps = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight('#ff9a3a', 0, 16, 1.5); scene.add(l); return l; });
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
    return !!safeZoneAt(x, z);
  }

  // Sleeping (Z, only somewhere safe) and collapsing from exhaustion
  let inTent = false; // asleep inside your tent: hidden, and resting faster
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
  let lastHurt = -99;
  const skillFx = createSkillFx(scene);
  creatures = createCreatures(scene, {
    getPlayer: () => ({ x: pos.x, z: pos.z, heading, radius: bodyR, dead, safe: isSafe(pos.x, pos.z), level: game?.character.level || character.level || 1, stage: game?.character.stage || 0, moving: speedNow > 1 }),
    isNight: () => night,
    groundAt: (x, z, fromY) => groundAt(x, z, fromY),
    onAmbush(n) { say('Ambush!', 'hurt'); onEvent?.('ambush', { n }); },
    isInsideCave: insideCave,
    onHitPlayer(m) {
      if (!game || dead) return;
      const s = game.stats();
      const dmg = monsterHit(m.atk, m.level, s.def * buffed('def'));
      lastHurt = clock.elapsedTime;
      floatText(`-${dmg}`, pos.clone().add(new THREE.Vector3(0, bodyH, 0)), 'hurt');
      if (game.damage(dmg)) defeated(m);
    },
  });

  for (const s of sites) if (s.built && s.place.cave) postGuards(s); // caves built before the monsters existed

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
    updateSites(pos.x, pos.z);
    land.update(pos.x, pos.z, Infinity);
    pos.y = groundAt(pos.x, pos.z);
    velY = 0; fallFrom = pos.y; airborne = false;
    creatures.removeWhere((m) => Math.hypot(m.x - pos.x, m.z - pos.z) < 60 && !m.keep);
    dead = false;
    snapCam = true;
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
    const light = new THREE.PointLight('#ffa040', 0, 24, 1.3);
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
  heldTorch.light.position.set(0, bodyH * 1.15, bodyR * 0.8);
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
    depth = { cave, built, back: site.built.mouth, leftExit: false };
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
        const boss = creatures.spawnAt(T.boss, lvl + 3, c.x, c.z, { boss: true, keep: true, depth: true, angry: true, title: `${KINDS[T.boss].name} Boss` });
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
      onEvent?.(inside.shop.id === 'guild' ? 'guild' : inside.shop.id === 'castle' ? 'castle' : 'market', inside.shop.id);
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
  function openChest(e) {
    if (e.village) { openVillageChest(e); return; }
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
      const list = s.built?.shops || (s.built?.market ? [{ ...s.built.market, name: MARKETS[s.built.market.id].name }] : []);
      for (const shop of list) if (Math.hypot(shop.x - x, shop.z - z) < 4.5) return shop;
    }
    return null;
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
      const npc = npcNear(pos.x, pos.z);
      if (npc) { talkTo(npc); return; }
      const shop = shopNear(pos.x, pos.z);
      if (shop?.id === 'academy') { onEvent?.('academy'); return; }
      if (shop?.building) { enterBuilding(shop); return; }
      if (shop) { onEvent?.(shop.id === 'guild' ? 'guild' : 'market', shop.id); return; }
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
      helper.x += (dx / d) * speed * dt; helper.z += (dz / d) * speed * dt;
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
    if (!guard.target) guard.target = creatures.list.filter((m) => !m.dead && m.hp > 0 && Math.hypot(m.x - pos.x, m.z - pos.z) < 12).sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z))[0] || null;
    const m = guard.target;
    let tx, tz, reach = 0.4;
    if (m) { tx = m.x; tz = m.z; reach = m.radius + 1.1; } else { tx = pos.x - Math.sin(heading) * 2.2 - Math.cos(heading) * 1.2; tz = pos.z - Math.cos(heading) * 2.2 + Math.sin(heading) * 1.2; }
    const dx = tx - guard.x, dz = tz - guard.z, d = Math.hypot(dx, dz);
    let speed = 0;
    if (d > 60) { guard.x = pos.x; guard.z = pos.z; }
    else if (d > reach) {
      speed = Math.min(d * 2.5, RUN * 1.25);
      guard.x += (dx / d) * speed * dt; guard.z += (dz / d) * speed * dt;
      guard.heading = Math.atan2(dx, dz);
    } else if (m) {
      guard.heading = Math.atan2(dx, dz);
      if (guard.swing === 0) {
        guard.swing = 1.1;
        const dmg = Math.round(guardHit(guard.tier) * (0.85 + Math.random() * 0.3));
        floatText(`-${dmg}`, new THREE.Vector3(m.x, (m.y ?? heightAt(m.x, m.z)) + m.height, m.z), 'hit');
        finishHit(m, creatures.hit(m, dmg));
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
  function attack() {
    if (dead || cooldown > 0) return;
    const w = game?.weapon();
    cooldown = (w || FIST).speed;
    attackT = 0;
    swingDone = false;
  }
  // Skills that raise ATK or DEF for a while
  const buffs = { atk: { pct: 0, until: 0 }, def: { pct: 0, until: 0 } };
  // skill buffs and potion buffs add together
  const buffed = (stat) => 1 + ((buffs[stat] && clock.elapsedTime < buffs[stat].until ? buffs[stat].pct : 0) + (game?.boostPct(stat) || 0)) / 100;

  // Hit a monster with your weapon (or fists); `mult` and `magic` come from skills
  function damageMonster(m, mult = 1, magic = null) {
    const w = game?.weapon();
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
    finishHit(m, creatures.hit(m, dmg));
    return dmg;
  }
  // Poison, burn and bleed hurt each second; frost slows; drain heals you
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
          finishHit(m, creatures.hit(m, d.dps));
          if (m.dead || m.hp <= 0) break;
        }
        if (d.left <= 0) delete m.dots[id];
      }
    }
  }
  function finishHit(m, reward) {
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

  // Use a skill (see data/skills.mjs). Returns 'ok', 'sp' (not enough SP), 'none' (nothing to hit) or 'busy'.
  function useSkill(sk) {
    if (!game || dead || resting()) return 'busy';
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
    let hitFoe = (m, mult, magic) => damageMonster(m, mult, magic);
    if (sk.unique) {
      const st = game.stats();
      hitFoe = (m, mult) => {
        const hp = m.hp;
        const dmg = damageMonster(m, mult, st.matk > st.atk);
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
      const near = creatures.list.filter((m) => !m.dead && Math.hypot(m.x - pos.x, m.z - pos.z) - m.radius < sk.radius);
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
    // the body acts it out: a swing for strikes, a spin for sweeps, hands forward to cast, arms up to heal or rally
    if (sk.type === 'strike') { attackT = 0; swingDone = true; } else skillPose = { kind: sk.type === 'bolt' ? 'cast' : sk.type, t: 0, dur: sk.type === 'sweep' ? 0.6 : sk.type === 'dash' ? 0.4 : 0.7 };
    skillFx.play(sk, look);
    say(sk.name, 'exp');
    return 'ok';
  }

  // With a staff in hand the attack key casts a spell instead of swinging: the spell chosen on the
  // staff (see data/spells.mjs), or, with none attached or while it rests, a plain bolt of your element
  let spellTurn = 0;
  const SPELL_REACH = 14;
  const spellReady = {}; // spell id -> clock time it can be cast again
  function castSpell() {
    const c = game.character;
    const els = c.elements?.length ? c.elements : [RACES[c.race].element];
    const from = new THREE.Vector3(pos.x + Math.sin(heading) * 0.5, pos.y + bodyH * 0.7, pos.z + Math.cos(heading) * 0.5);
    const ahead = (d) => new THREE.Vector3(pos.x + Math.sin(heading) * d, pos.y + bodyH * 0.6, pos.z + Math.cos(heading) * d);
    const at = (m) => new THREE.Vector3(m.x, m.y + m.height * 0.6, m.z);
    const sp = game.chosenSpell();
    const cost = sp ? Math.max(1, Math.round(sp.sp * (c.cls === 'mage' ? 0.9 : 1))) : 0;
    if (sp && clock.elapsedTime >= (spellReady[sp.id] || 0) && c.sp >= cost) {
      let foes = [], to;
      if (sp.kind === 'bolt' || sp.kind === 'burst') {
        const m = creatures.target(pos.x, pos.z, heading, SPELL_REACH);
        if (m) {
          foes = [m];
          if (sp.kind === 'burst') foes.push(...creatures.list.filter((o) => o !== m && !o.dead && Math.hypot(o.x - m.x, o.z - m.z) - o.radius < 3.5));
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
        damageMonster(m, sp.power, true);
        if (sp.effect && !m.dead && m.hp > 0 && Math.random() < sp.effect.chance) applyEffect(m, sp.effect.id, Math.max(1, hp - m.hp), 1);
      }
      if (to) skillFx.spell(sp.element, from, to);
      else for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; skillFx.spell(sp.element, from, new THREE.Vector3(pos.x + Math.sin(a) * 6, pos.y + 0.4, pos.z + Math.cos(a) * 6)); }
      c.sp = Math.max(0, c.sp - cost);
      game.touch('sp');
      spellReady[sp.id] = clock.elapsedTime + sp.cd;
      skillPose = { kind: 'cast', t: 0, dur: 0.6 };
      say(sp.name, 'exp');
      return;
    }
    if (sp && c.sp < cost && !castSpell.warned) { castSpell.warned = true; say(`Not enough SP for ${sp.name}`, 'hurt'); setTimeout(() => { castSpell.warned = false; }, 3000); }
    const element = els[spellTurn++ % els.length];
    const m = creatures.target(pos.x, pos.z, heading, SPELL_REACH);
    let to;
    if (m) { to = at(m); damageMonster(m, 1, true); }
    else to = ahead(SPELL_REACH);
    skillFx.spell(element, from, to);
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
  function resolveSwing() {
    const w = game?.weapon();
    if (w?.type === 'staff' || (w?.magic && character.cls === 'mage')) { castSpell(); return; }
    const r = weaponReach(w);
    const reach = bodyR + r.reach * Math.max(0.8, bodyH / 1.8);
    // monsters first: a long or wide weapon can catch more than one
    const foes = creatures.targets(pos.x, pos.z, heading, reach, r.arc).slice(0, r.hits);
    if (foes.length) { foes.forEach((m, i) => damageMonster(m, r.sharp * (i ? 0.7 : 1))); return; }
    // then bushes and small trees in front of you
    const fx = pos.x + Math.sin(heading) * reach * 0.6, fz = pos.z + Math.cos(heading) * reach * 0.6;
    let best = null, bestD = Infinity;
    for (const e of colliders.near(fx, fz, reach * 0.8)) {
      const d = Math.hypot(e.x - pos.x, e.z - pos.z) - e.r;
      if (d < bestD && d < reach) { best = e; bestD = d; }
    }
    if (!best) return;
    if (best.kind === 'vein') { mineVein(best); return; }
    if (best.kind === 'nest') { hitNest(best); return; }
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
    if (!e.repeat && (act === 'forward' || e.code === 'ArrowUp')) {
      const now = performance.now();
      if (autoWalk) { autoWalk = false; lastForward = 0; say('Auto-walk off', 'note'); }
      else if (now - lastForward < 320) { autoWalk = true; lastForward = 0; say('Auto-walk on: tap forward or back to stop', 'note'); }
      else lastForward = now;
    }
    if (!e.repeat && autoWalk && (act === 'back' || e.code === 'ArrowDown')) { autoWalk = false; say('Auto-walk off', 'note'); }
    if (act === 'attack') attack();
    if (act === 'sleep') toggleSleep();
    if (act === 'torch') placeTorch();
    if (act === 'tent') pitchTent();
    if (act === 'interact') interact();
    if (act === 'spell' && !e.repeat) nextSpell();
    onKey?.(e);
  };
  const up = (e) => keys.delete(e.code);
  const held = (action) => keys.has(codeFor(action));
  let jumpQueued = false; // the jump button on touch screens
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
    yaw -= e.movementX * 0.0025;
    pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.0018, pitchLo(), pitchHi());
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
      const k = look.mouse ? 1 : 0.55;
      yaw -= (e.clientX - look.x) * 0.006 * k;
      pitch = THREE.MathUtils.clamp(pitch + (e.clientY - look.y) * 0.004 * k, pitchLo(), pitchHi());
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
      } else if (tap && talkAt(e.clientX, e.clientY)) { /* clicked a townsperson: they talk */ } else if (tap && look.mouse) attack();
      look = null;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.style.touchAction = 'none'; // the game handles pinches itself (the page doesn't zoom)
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    if (viewMode === 'first') { if (e.deltaY > 0) setView('third', true); }
    else if (dist <= 2 && e.deltaY < 0) setView('first', true);
    else dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.01, 2, 30);
    e.preventDefault();
  }, { passive: false });

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
  let toldCap = false;
  function restHeal(n, asleep) {
    const max = game.stats().hp, c = game.character;
    const cap = Math.floor(max * restCap(c.level, asleep));
    if (c.hp >= cap) {
      if (!toldCap && c.hp < max) { toldCap = true; say(`Rest only heals you to ${Math.round(restCap(c.level, asleep) * 100)}%. Eat or drink to heal more.`, 'note'); }
      return;
    }
    toldCap = false;
    game.heal(Math.min(n, cap - c.hp));
  }
  const B = WORLD_BOUNDS;
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
  let skillPose = null; // { kind, t, dur } while a skill is being acted out
  function poseSkill(rig, p) {
    const k = Math.min(1, p.t / p.dur), up = Math.sin(k * Math.PI);
    const arms = rig.arms || [];
    if (p.kind === 'sweep') {
      // spin round once with the weapon arm held out
      avatar.rotation.y = heading + k * Math.PI * 2;
      for (const a of arms) { a.shoulder.rotation.z = a.side * 1.3 * up; a.shoulder.rotation.x = -0.4 * up; }
    } else if (p.kind === 'cast') {
      for (const a of arms) { a.shoulder.rotation.x = -1.45 * up; a.elbow.rotation.x = -0.2 * (1 - up); }
    } else if (p.kind === 'heal' || p.kind === 'buff') {
      for (const a of arms) { a.shoulder.rotation.x = -2.7 * up; a.shoulder.rotation.z = a.side * 0.35 * up; }
      if (rig.spine) rig.spine.rotation.x = -0.15 * up;
    } else if (p.kind === 'dash') {
      if (rig.spine) rig.spine.rotation.x = 0.45 * up;
      for (const a of arms) a.shoulder.rotation.x = 0.8 * up;
    }
    if (!arms.length) rig.root.position.z = up * bodyH * 0.2;
  }
  // the weapon arm's ready pose [shoulder, elbow] with a blade (see gear.js: the blade then points ahead)
  const READY = [-0.35, -0.85];
  const bladeHeld = () => { const w = game?.weapon(); return !!w && w.type !== 'spear' && w.type !== 'staff'; };
  function poseAttack(rig, k, armed) {
    const arm = rig.arms?.[0];
    if (arm) {
      if (armed) {
        // an overhead slash: up from the ready pose until the blade points at the sky, down hard
        // until it points ahead and low, then back to ready
        const L = THREE.MathUtils.lerp, from = bladeHeld() ? READY : [0, -0.3];
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
      rig.root.position.z = Math.sin(Math.min(1, k) * Math.PI) * bodyH * 0.25;
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
    const dt = Math.min(clock.getDelta(), 0.1); // a slow frame still moves you the full distance
    const t = clock.elapsedTime;
    // a window or the chat is open: the mouse is always free to use it, even while you keep walking
    if (locked() && windowOpen?.()) { letGo = true; document.exitPointerLock(); }

    // Movement relative to the camera, in any direction
    let fx = 0, fz = 0;
    if (dead || sleeping) autoWalk = false;
    if (!dead && !resting()) {
      if (held('forward') || keys.has('ArrowUp') || autoWalk) fz += 1;
      if (held('back') || keys.has('ArrowDown')) fz -= 1;
      if (held('left') || keys.has('ArrowLeft')) fx -= 1;
      if (held('right') || keys.has('ArrowRight')) fx += 1;
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
    const running = held('run') || (codeFor('run') === 'ShiftLeft' && keys.has('ShiftRight')) || Math.hypot(stick.x, stick.y) > 0.9;
    const amount = Math.min(1, Math.hypot(fx, fz));
    let target = 0;
    if (cameraMode === 'follow' && !fp) {
      // Follow camera: left and right turn your body, forward and back walk the way you face,
      // and the camera swings round behind you
      heading -= fx * dt * (running ? STEER_RUN : STEER);
      if (Math.abs(fz) > 0.05) {
        const h = aboutFace ? backHeading : heading; // turning round: walk the new way straight away
        move.set(Math.sin(h) * Math.sign(fz), 0, Math.cos(h) * Math.sign(fz));
        target = (running && fz > 0 ? RUN : WALK) * (fz < 0 ? 0.6 : 1) * agiSpeed * (1 + (game?.boostPct('speed') || 0) / 100) * Math.min(1, Math.abs(fz)) * Math.max(0.85, Math.sqrt(bodyH / 1.8)) * (swimming ? SWIM : 1) * (game?.injurySpeed() ?? 1);
      }
      if (!look) {
        const back = Math.atan2(Math.sin(heading + Math.PI - yaw), Math.cos(heading + Math.PI - yaw));
        yaw += back * Math.min(1, dt * 4);
      }
    } else if (amount > 0.05) {
      // Steering: while you go forward (walking or sprinting), left and right turn you gently,
      // as much as you press, and the camera turns with you. Only sideways on its own steps sideways.
      const steering = fz > 0.1 && !look && !fp; // in first person, left and right step sideways
      if (steering) { const turn = fx * dt * (running ? STEER_RUN : STEER); yaw -= turn; backYaw -= turn; }
      const ya = aboutFace ? backYaw : yaw; // turning round: walk the new way while the camera catches up
      const camFwd = v3.set(-Math.sin(ya), 0, -Math.cos(ya));
      const side = steering ? fx * 0.25 : fx; // a slight lean into the turn instead of a sharp angle
      move.set(camFwd.x * fz - camFwd.z * side, 0, camFwd.z * fz + camFwd.x * side).normalize();
      const want = Math.atan2(move.x, move.z);
      let diff = want - heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (!fp) heading += diff * Math.min(1, dt * TURN);
      // move the way you want to go, even while still turning to face it
      target = (running && fz > -0.1 ? RUN : WALK) * (fp && fz < -0.1 ? 0.6 : 1) * agiSpeed * (1 + (game?.boostPct('speed') || 0) / 100) * amount * Math.max(0.85, Math.sqrt(bodyH / 1.8)) * (swimming ? SWIM : 1) * (game?.injurySpeed() ?? 1);
    }
    speedNow += (target - speedNow) * Math.min(1, dt * 8);
    if (speedNow > 0.01) {
      const px = pos.x, pz = pos.z;
      pos.x += move.x * speedNow * dt;
      pos.z += move.z * speedNow * dt;
      colliders.push(pos, bodyR);
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
    if ((held('jump') || jumpQueued) && !airborne && !swimming && !dead) { velY = game?.injurySpeed() < 1 ? 1.6 : 4.2; airborne = true; fallFrom = pos.y; }
    jumpQueued = false;
    // walking down a slope keeps your feet on it; only a real drop (a cliff, a ledge) is a fall
    const drop = pos.y - ground;
    // stepping up (a stair, a log, a bridge) lifts you over a moment instead of in one jump
    if (!airborne && drop < 0.35 + speedNow * dt * 2.2) { pos.y = drop < -0.05 && drop > -0.85 ? pos.y + Math.min(-drop, dt * 5) : ground; velY = 0; } else {
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
    animateCharacter(avatar, t, airborne ? 0.3 : speedNow / WALK * 1.6);
    if (sitting) { poseSit(rig); avatar.position.y = sitting.y + 0.5 - bodyH * 0.27; }
    // a blade (sword, axe, club...) is held ready: the hand in front at the waist, the blade pointing ahead
    else if (bladeHeld() && !sleeping && !dead && rig.arms) { rig.arms[0].shoulder.rotation.x = READY[0]; rig.arms[0].elbow.rotation.x = READY[1]; }
    moveHelper(dt, t);
    moveGuard(dt, t);

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
          c.fatigue = Math.min(100, c.fatigue + step * (100 / 5400) * (running && speedNow > WALK ? 2.5 : 1) * (night ? 1.3 : 1));
          if (c.fatigue >= 100) { collapsed = 25; say('Exhausted! You collapse', 'hurt'); onEvent?.('collapsed'); }
          else if (c.fatigue >= 85 && !warnedTired) { warnedTired = true; onEvent?.('tired'); }
          if (c.fatigue < 80) warnedTired = false;
        }
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
    skillFx.update(dt);
    if (depth) {
      tickNests(dt);
      depth.built.update(t);
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
      // walk into a townsperson and they talk to you
      const n = npcNear(pos.x, pos.z, bodyR + 0.55);
      if (n && n !== touched) { touched = n; talkTo(n); }
      else if (touched && Math.hypot(touched.x - pos.x, touched.z - pos.z) > 2.5) touched = null;
    }
    if (inside) {
      inside.built.update(t, pos);
      checkRooms();
      checkInn();
      const d = Math.hypot(pos.x - inside.built.exit.x, pos.z - inside.built.exit.z);
      if (d > 3) inside.leftExit = true;
      else if (inside.leftExit && d < 1.2 && !dead) leaveBuilding();
    }
    for (const q of portals) q.built?.update(t);
    if (holding) heldTorch.light.intensity = 20 + Math.sin(t * 13) * 2 + Math.sin(t * 7.3) * 1.5;
    if (t - lastArea > 0.5) {
      lastArea = t;
      let here;
      if (depth) here = `${depth.cave.name} · ${Math.max(0, Math.round(-pos.y))} m down`;
      else if (inside) here = inside.shop.name;
      else {
        updateSites(pos.x, pos.z);
        tendVillages();
        const near = sites.find((s) => !s.place.cave && Math.hypot(pos.x - s.place.x, pos.z - s.place.z) < 400);
        const caveHere = sites.find((s) => s.built?.inside?.(pos.x, pos.z));
        here = caveHere ? caveById(caveHere.place.id)?.name || 'A cave' : near ? `${regionName(near.place.region)} · ${near.place.name}` : regionName(sample(pos.x, pos.z, tmpS).region);
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

    // Camera follows behind and above, pulled in so trees and cave walls don't block the view
    const focus = new THREE.Vector3(pos.x, pos.y + bodyH * 0.8, pos.z);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    let want = dist;
    // (indoors the walls keep the camera in instead: pulling it in for every chair and table made it shake)
    for (let d = 1; d < (inside ? 0 : dist); d += 0.75) {
      const px = focus.x + dir.x * d, py = focus.y + dir.y * d, pz = focus.z + dir.z * d;
      const hit = (depth && depth.built.shape(px, pz).d > -0.4) || colliders.near(px, pz, 0.6).some((e) => e.r > 0 && py - (e.y ?? groundAt(e.x, e.z)) < (e.height || 8) && Math.hypot(px - e.x, pz - e.z) < Math.min(e.r * (e.kind === 'wall' ? 1.2 : 4), 3.5));
      if (hit) { want = Math.max(1.2, d - 0.6); break; }
    }
    camDist += (want - camDist) * Math.min(1, dt * (want < camDist ? 14 : 3));
    if (snapCam) camDist = want;
    const cam = focus.clone().addScaledVector(dir, camDist);
    cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.5, water + 0.3);
    if (depth) cam.y = Math.min(cam.y, depth.built.roofAt(cam.x, cam.z) - 0.5);
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
      camera.lookAt(focus);
    }
    snapCam = false;

    if (t - lastTime > 0.5) { lastTime = t; applyTime(); }
    lantern.position.set(pos.x, pos.y + bodyH + 1, pos.z);
    lightTorches(t);
    sun.position.copy(pos).addScaledVector(lightDir, 120);
    sun.target.position.copy(pos);
    for (const s of sites) s.built?.update?.(t, pos);
    for (const q of mobVillages.values()) q.built.update(t);
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

  return {
    rebuildAvatar,
    jump() { jumpQueued = true; },
    position: () => ({ x: pos.x, z: pos.z, heading }),
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
    debugCam(at, look, showSelf = false) { camOverride = at ? [at, look, showSelf] : null; if (!at) avatar.visible = true; },
    debugMove(x, z, h) { pos.set(x, groundAt(x, z), z); if (h !== undefined) { heading = h; yaw = h + Math.PI; } },
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
    setCityGates,
    setCeremonies,
    atShrine,
    riseAtShrine,
    oldAge,
    trainingAt,
    // Redraw your gear after equipping or taking something off
    refreshGear() { if (game) wearGear(avatar, game.worn()); },
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
      setSettledLand(list); // settled land tames the wilds around it
      showStructures(list);
    },
    // let the mouse go (a window is opening)
    releaseMouse() { if (locked()) { letGo = true; document.exitPointerLock(); } },
    setMouseMode(mode) { freeMouse = mode === 'free'; if (freeMouse && locked()) { letGo = true; document.exitPointerLock(); } },
    setGraphics(choice) { applyQuality(pickQuality(choice)); return quality.key; },
    get graphics() { return quality.key; },
    setCameraMode(mode) { cameraMode = mode === 'follow' ? 'follow' : 'free'; },
    setView(mode) { setView(mode); },
    // order a drink in the tavern: `served` runs when the waiter brings it to you (wherever you are inside)
    tavernOrder(served) { if (inside?.built.order) inside.built.order(() => ({ x: pos.x, z: pos.z }), served); },
    toggleView() { setView(viewMode === 'first' ? 'third' : 'first', true); },
    stop() {
      saveNow();
      renderer.setAnimationLoop(null);
      creatures.clear();
      skillFx.clear();
      land.dispose();
      sky.dispose();
      floatLayer.remove();
      plots.dispose();
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

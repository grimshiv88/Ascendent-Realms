// The playable world: the whole map as streamed 3D land, your character, monsters, and a third-person camera.
import * as THREE from 'three';
import { createLand } from './land.js';
import { createSky, HORIZON } from './sky.js';
import { buildSpawn } from './spawn.js';
import { buildCave } from './caves.js';
import { createCreatures } from './creatures.js';
import { BREAKABLE, breakNeeds } from './scenery.js';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { wearGear } from '../characters/gear.js';
import { heightAt, sample, placesWithPositions, regionName, homePlace, WORLD_BOUNDS, setPreparedPlots, PLOT } from '../data/world-layout.mjs';
import { createPlots } from './plots.js';
import { gameTime } from '../data/clock.mjs';
import { RACES } from '../data/game-data.mjs';

const WALK = 3.4;   // metres per second, a brisk game walking pace
const RUN = 8;
const SWIM = 0.45;  // share of walking speed while swimming
const TURN = 9;     // how quickly you turn to face where you're going
const STEER = 1.2;  // radians a second you curve while walking forward and pressing left or right
const STEER_RUN = 0.9;

// `game` is the progress object (HP, bag, gear). `onEvent(type, data)` reports kills, pickups,
// defeat and level-ups to the page.
export function startWorld(canvas, character, { game, onSaveLocation, onKey, onArea, onEvent, onPlot, onMouseFreed, view } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // sharper costs a lot of speed on iPads
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(HORIZON, 0.00024);
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
  const colliders = land.colliders;

  // Waystone shrines (the spawn and each homeland) and caves, built when you come near
  const sites = placesWithPositions().map((p) => ({ place: p, built: null }));
  function updateSites(x, z) {
    for (const s of sites) {
      const d = Math.hypot(x - s.place.x, z - s.place.z);
      if (d < 1000 && !s.built) {
        s.built = s.place.cave ? buildCave(s.place) : buildSpawn(s.place);
        scene.add(s.built.group);
        if (s.built.solid) colliders.add(s.built.solid);
      } else if (d > 1400 && s.built) {
        scene.remove(s.built.group);
        if (s.built.solid) colliders.remove(s.built.solid);
        s.built = null;
      }
    }
  }
  const insideCave = (x, z) => sites.some((s) => s.built?.inside?.(x, z));

  // Land plots: the buying grid and owned land
  const plots = createPlots(scene);
  let prepared = new Set();

  // Your character, wearing your gear
  let avatar = buildCharacter({ race: character.race, form: character.form, stage: character.stage || 0, look: character.look });
  if (game) wearGear(avatar, game.worn());
  scene.add(avatar);
  const loc = character.location || {};
  const pos = new THREE.Vector3(loc.x ?? 0, 0, loc.z ?? 6);
  let heading = loc.heading ?? Math.PI;
  let velY = 0;
  let airborne = false;
  updateSites(pos.x, pos.z);
  land.update(pos.x, pos.z, Infinity); // build the land around you before the clouds part

  // The ground under a point, counting the shrine platforms
  function groundAt(x, z) {
    let g = heightAt(x, z);
    for (const s of sites) {
      if (!s.built || s.place.cave) continue;
      if (Math.hypot(x - s.place.x, z - s.place.z) < 7.4) g = Math.max(g, s.place.y + 0.45);
    }
    return g;
  }
  pos.y = groundAt(pos.x, pos.z);
  let area = '';
  let lastArea = -10;

  const speedBonus = 1 + Math.min(character.stats.agi * 0.003, 0.6);
  const bodyH = avatar.userData.height;
  const bodyR = Math.max(0.25, Math.min(bodyH * 0.18, 0.9));

  // Camera orbit
  let yaw = heading + Math.PI;
  let pitch = view?.pitch ?? 0.32;
  let dist = view?.dist ?? THREE.MathUtils.clamp(bodyH * 2.6 + 2, 3, 16);
  let camDist = dist;
  // 'free': you turn the camera yourself and move relative to it. 'follow': it stays behind your body.
  let cameraMode = view?.camera === 'follow' ? 'follow' : 'free';

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
  const TORCH_SAFE = 12, FIRE_SAFE = 35;
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
    if (nearTent(x, z, TENT_SAFE)) return true;
    if (torchLights.some((tl) => Math.hypot(tl.x - x, tl.z - z) < TORCH_SAFE)) return true;
    return placesWithPositions().some((p) => !p.cave && Math.hypot(p.x - x, p.z - z) < FIRE_SAFE);
  }

  // Sleeping (Z, only somewhere safe) and collapsing from exhaustion
  let inTent = false; // asleep inside your tent: hidden, and resting faster
  let sleeping = false, collapsed = 0, fatigueAcc = 0, warnedTired = false, lastTime = -1;
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
  const creatures = createCreatures(scene, {
    getPlayer: () => ({ x: pos.x, z: pos.z, heading, radius: bodyR, dead, safe: isSafe(pos.x, pos.z), level: game?.character.level || character.level || 1, moving: speedNow > 1 }),
    isNight: () => night,
    onAmbush(n) { say('Ambush!', 'hurt'); onEvent?.('ambush', { n }); },
    isInsideCave: insideCave,
    onHitPlayer(m) {
      if (!game || dead) return;
      const s = game.stats();
      const dmg = Math.max(1, Math.round(m.atk * (0.85 + Math.random() * 0.3) - s.def * buffed('def') * 0.4));
      lastHurt = clock.elapsedTime;
      floatText(`-${dmg}`, pos.clone().add(new THREE.Vector3(0, bodyH, 0)), 'hurt');
      if (game.damage(dmg)) defeated(m);
    },
  });

  function defeated(m) {
    dead = true;
    onEvent?.('defeated', { by: m.kind.name });
    setTimeout(() => {
      // wake up at your home waystone
      const home = homePlace(RACES[character.race].home);
      const hp = placesWithPositions().find((p) => p.id === home.id);
      pos.set(hp.x, 0, hp.z + 6);
      updateSites(pos.x, pos.z);
      land.update(pos.x, pos.z, Infinity);
      pos.y = groundAt(pos.x, pos.z);
      velY = 0;
      game.respawn();
      dead = false;
      onEvent?.('respawned');
    }, 3500);
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
  const buffed = (stat) => (clock.elapsedTime < buffs[stat].until ? 1 + buffs[stat].pct / 100 : 1);

  // Hit a monster with your weapon (or fists); `mult` and `magic` come from skills
  function damageMonster(m, mult = 1, magic = null) {
    const w = game?.weapon();
    const s = game.stats();
    const useMagic = magic ?? !!w?.magic;
    let dmg = (w || magic ? (useMagic ? s.matk : s.atk) : s.base.atk * 0.6 + 2) * mult * buffed('atk');
    dmg = dmg * (0.9 + Math.random() * 0.2) - m.def * 0.5;
    const crit = Math.random() < 0.1 + Math.min(character.stats.dex * 0.002, 0.25);
    if (crit) dmg *= 1.6;
    dmg = Math.max(1, Math.round(dmg));
    floatText(`${dmg}${crit ? '!' : ''}`, new THREE.Vector3(m.x, m.y + m.height + 0.2, m.z), crit ? 'crit' : 'dmg');
    const reward = creatures.hit(m, dmg);
    if (reward) {
      // monsters far below your level teach you little
      const gap = game.character.level - m.level;
      reward.exp = Math.max(1, Math.round(reward.exp * (gap <= 3 ? 1 : Math.max(0.1, 1 - (gap - 3) * 0.15))));
      floatText(`+${reward.exp} EXP`, new THREE.Vector3(m.x, m.y + m.height + 0.7, m.z), 'exp');
      game.gainExp(reward.exp);
      game.gainCoins(reward.coins);
      for (const [id, n] of reward.drops) game.addItem(id, n);
      onEvent?.('kill', reward);
    }
  }

  // Use a skill (see data/skills.mjs). Returns 'ok', 'sp' (not enough SP), 'none' (nothing to hit) or 'busy'.
  function useSkill(sk) {
    if (!game || dead || resting()) return 'busy';
    const c = game.character;
    if (c.sp < sk.sp) return 'sp';
    const reachNear = bodyR + 1.8 * Math.max(0.8, bodyH / 1.8);
    if (sk.type === 'strike' || sk.type === 'bolt') {
      const m = creatures.target(pos.x, pos.z, heading, sk.type === 'bolt' ? sk.reach : reachNear + 0.4);
      if (!m) return 'none';
      damageMonster(m, sk.mult, sk.magic || null);
    } else if (sk.type === 'sweep') {
      const near = creatures.list.filter((m) => !m.dead && Math.hypot(m.x - pos.x, m.z - pos.z) - m.radius < sk.radius);
      if (!near.length) return 'none';
      for (const m of near) damageMonster(m, sk.mult, sk.magic || null);
    } else if (sk.type === 'dash') {
      // rush forward, stopping at the first foe in the way
      for (let d = 0; d < sk.dist; d += 0.4) {
        pos.x += Math.sin(heading) * 0.4; pos.z += Math.cos(heading) * 0.4;
        colliders.push(pos, bodyR);
        const m = creatures.target(pos.x, pos.z, heading, reachNear);
        if (m) { damageMonster(m, sk.mult); break; }
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
    if (sk.type !== 'heal' && sk.type !== 'buff') { attackT = 0; swingDone = true; } // swing for show
    say(sk.name, 'exp');
    return 'ok';
  }

  function resolveSwing() {
    const w = game?.weapon();
    const reach = bodyR + (w ? (w.type === 'dagger' ? 1.1 : w.type === 'staff' ? 1.8 : 1.6) : 0.9) * Math.max(0.8, bodyH / 1.8);
    // monsters first
    const m = creatures.target(pos.x, pos.z, heading, reach);
    if (m) { damageMonster(m); return; }
    // then bushes and small trees in front of you
    const fx = pos.x + Math.sin(heading) * reach * 0.6, fz = pos.z + Math.cos(heading) * reach * 0.6;
    let best = null, bestD = Infinity;
    for (const e of colliders.near(fx, fz, reach * 0.8)) {
      const d = Math.hypot(e.x - pos.x, e.z - pos.z) - e.r;
      if (d < bestD && d < reach) { best = e; bestD = d; }
    }
    if (!best) return;
    const info = BREAKABLE[best.kind];
    if (!info) {
      say(best.kind === 'rock' ? 'Too hard to break' : best.kind === 'wall' ? 'Solid rock' : 'Too big to break by hand');
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
  const down = (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    keys.add(e.code);
    if (e.code === 'KeyF') attack();
    if (e.code === 'KeyZ') toggleSleep();
    if (e.code === 'KeyT') placeTorch();
    if (e.code === 'KeyP') pitchTent();
    onKey?.(e);
  };
  const up = (e) => keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

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
  document.addEventListener('pointerlockerror', () => { noLock = true; });
  document.addEventListener('pointerlockchange', () => {
    if (!locked() && !letGo) onMouseFreed?.();
    letGo = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked()) return;
    yaw -= e.movementX * 0.0025;
    pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.0018, -0.15, 1.2);
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && locked()) { if (e.button === 0) attack(); return; }
    if (e.pointerType === 'mouse' && e.button === 0 && !plots.on && !noLock && canvas.requestPointerLock) {
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
    } else if (look && e.pointerId === look.id) {
      // a finger turns the camera more gently than a mouse, so small swipes are small turns
      const k = look.mouse ? 1 : 0.55;
      yaw -= (e.clientX - look.x) * 0.006 * k;
      pitch = THREE.MathUtils.clamp(pitch + (e.clientY - look.y) * 0.004 * k, -0.15, 1.2);
      look.x = e.clientX; look.y = e.clientY;
    }
  });
  const release = (e) => {
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
      } else if (tap && look.mouse) attack();
      look = null;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.01, 2, 30);
    e.preventDefault();
  }, { passive: false });

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const move = new THREE.Vector3();
  let speedNow = 0;
  // Pressing back turns you round to face behind you (the camera swings round too); keep holding it
  // and you walk on in the new direction
  let backWas = false, aboutFace = false, turnLeft = 0, backYaw = 0, backHeading = 0;
  let lastSave = 0;
  let regenAcc = 0;
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
  function poseAttack(rig, k, armed) {
    const arm = rig.arms?.[0];
    if (arm) {
      if (armed) {
        const a = k < 0.35 ? THREE.MathUtils.lerp(0, -2.6, k / 0.35) : THREE.MathUtils.lerp(-2.6, -0.4, (k - 0.35) / 0.65);
        arm.shoulder.rotation.x = a;
        arm.elbow.rotation.x = -0.3;
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

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1); // a slow frame still moves you the full distance
    const t = clock.elapsedTime;

    // Movement relative to the camera, in any direction
    let fx = 0, fz = 0;
    if (!dead && !resting()) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
      fx += stick.x; fz -= stick.y;
    }
    const backNow = fz < -0.4 && Math.abs(fx) < 0.6;
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
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stick.x, stick.y) > 0.9;
    const amount = Math.min(1, Math.hypot(fx, fz));
    let target = 0;
    if (cameraMode === 'follow') {
      // Follow camera: left and right turn your body, forward and back walk the way you face,
      // and the camera swings round behind you
      heading -= fx * dt * (running ? STEER_RUN : STEER);
      if (Math.abs(fz) > 0.05) {
        const h = aboutFace ? backHeading : heading; // turning round: walk the new way straight away
        move.set(Math.sin(h) * Math.sign(fz), 0, Math.cos(h) * Math.sign(fz));
        target = (running && fz > 0 ? RUN : WALK) * (fz < 0 ? 0.6 : 1) * speedBonus * Math.min(1, Math.abs(fz)) * Math.max(0.85, Math.sqrt(bodyH / 1.8)) * (swimming ? SWIM : 1);
      }
      if (!look) {
        const back = Math.atan2(Math.sin(heading + Math.PI - yaw), Math.cos(heading + Math.PI - yaw));
        yaw += back * Math.min(1, dt * 4);
      }
    } else if (amount > 0.05) {
      // Steering: while you go forward (walking or sprinting), left and right turn you gently,
      // as much as you press, and the camera turns with you. Only sideways on its own steps sideways.
      const steering = fz > 0.1 && !look;
      if (steering) { const turn = fx * dt * (running ? STEER_RUN : STEER); yaw -= turn; backYaw -= turn; }
      const ya = aboutFace ? backYaw : yaw; // turning round: walk the new way while the camera catches up
      const camFwd = v3.set(-Math.sin(ya), 0, -Math.cos(ya));
      const side = steering ? fx * 0.25 : fx; // a slight lean into the turn instead of a sharp angle
      move.set(camFwd.x * fz - camFwd.z * side, 0, camFwd.z * fz + camFwd.x * side).normalize();
      const want = Math.atan2(move.x, move.z);
      let diff = want - heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      heading += diff * Math.min(1, dt * TURN);
      // move the way you want to go, even while still turning to face it
      target = (running ? RUN : WALK) * speedBonus * amount * Math.max(0.85, Math.sqrt(bodyH / 1.8)) * (swimming ? SWIM : 1);
    }
    speedNow += (target - speedNow) * Math.min(1, dt * 8);
    if (speedNow > 0.01) {
      pos.x += move.x * speedNow * dt;
      pos.z += move.z * speedNow * dt;
      colliders.push(pos, bodyR);
      pos.x = THREE.MathUtils.clamp(pos.x, B.minX + 50, B.maxX - 50);
      pos.z = THREE.MathUtils.clamp(pos.z, B.minZ + 50, B.maxZ - 50);
    }

    // Ground, jumping, the shrine platforms, and swimming in deep water
    let ground = groundAt(pos.x, pos.z);
    const water = sample(pos.x, pos.z, tmpS).water;
    const floatAt = water - bodyH * 0.7;
    swimming = ground < floatAt;
    if (swimming) ground = floatAt;
    if (keys.has('Space') && !airborne && !swimming && !dead) { velY = 4.2; airborne = true; }
    velY -= 9.81 * dt;
    pos.y += velY * dt;
    if (pos.y <= ground) { pos.y = ground; velY = 0; airborne = false; }

    avatar.position.copy(pos);
    avatar.rotation.y = heading;
    avatar.rotation.z = dead || resting() ? Math.min(Math.PI / 2, (avatar.rotation.z || 0) + dt * 3) : 0;
    avatar.visible = !(sleeping && inTent); // hidden inside the tent
    const rig = avatar.userData.rig;
    rig.root.position.z = 0;
    animateCharacter(avatar, t, airborne ? 0.3 : speedNow / WALK * 1.6);

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
    if (keys.has('KeyF') && cooldown <= 0 && attackT < 0) attack();

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
          game.heal(game.stats().hp * 0.03 * step);
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
      if (sleeping && (keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD') || Math.hypot(stick.x, stick.y) > 0.3)) { sleeping = false; say('You wake up', 'note'); }
    }

    // Rest heals you when nothing has hit you for a while
    if (game && !dead) {
      regenAcc += dt;
      if (regenAcc > 1) {
        regenAcc = 0;
        const s = game.stats();
        const c = game.character;
        // SP always comes back slowly (faster at rest); HP only when nothing has hit you for a while
        if (c.sp < s.sp) { c.sp = Math.min(s.sp, c.sp + s.sp * (t - lastHurt > 6 ? 0.03 : 0.012)); game.touch('sp'); }
        if (t - lastHurt > 6 && c.hp < s.hp) game.heal(s.hp * 0.015);
      }
    }

    // Stream the land, places and monsters
    land.update(pos.x, pos.z);
    plots.update(pos.x, pos.z);
    land.animate(t);
    creatures.update(dt, t);
    if (t - lastArea > 0.5) {
      lastArea = t;
      updateSites(pos.x, pos.z);
      const near = sites.find((s) => !s.place.cave && Math.hypot(pos.x - s.place.x, pos.z - s.place.z) < 400);
      const here = insideCave(pos.x, pos.z) ? 'A dark cave' : near ? `${regionName(near.place.region)} · ${near.place.name}` : regionName(sample(pos.x, pos.z, tmpS).region);
      if (here !== area) { area = here; onArea?.(area, { x: pos.x, z: pos.z }); }
    }

    // Camera follows behind and above, pulled in so trees and cave walls don't block the view
    const focus = new THREE.Vector3(pos.x, pos.y + bodyH * 0.8, pos.z);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    let want = dist;
    for (let d = 1; d < dist; d += 0.75) {
      const px = focus.x + dir.x * d, py = focus.y + dir.y * d, pz = focus.z + dir.z * d;
      const hit = colliders.near(px, pz, 0.6).some((e) => e.r > 0 && py - (e.y ?? groundAt(e.x, e.z)) < (e.height || 8) && Math.hypot(px - e.x, pz - e.z) < Math.min(e.r * (e.kind === 'wall' ? 1.2 : 4), 3.5));
      if (hit) { want = Math.max(1.2, d - 0.6); break; }
    }
    camDist += (want - camDist) * Math.min(1, dt * (want < camDist ? 14 : 3));
    const cam = focus.clone().addScaledVector(dir, camDist);
    cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.5, water + 0.3);
    camera.position.lerp(cam, Math.min(1, dt * 10));
    camera.lookAt(focus);

    if (t - lastTime > 0.5) { lastTime = t; applyTime(); }
    lantern.position.set(pos.x, pos.y + bodyH + 1, pos.z);
    lightTorches(t);
    sun.position.copy(pos).addScaledVector(lightDir, 120);
    sun.target.position.copy(pos);
    for (const s of sites) s.built?.update?.(t);
    sky.follow(camera);

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
      onSaveLocation({ x: pos.x, y: pos.y, z: pos.z, heading });
    }
  });

  const saveNow = () => onSaveLocation?.({ x: pos.x, y: pos.y, z: pos.z, heading });
  window.addEventListener('pagehide', saveNow);

  return {
    position: () => ({ x: pos.x, z: pos.z, heading }),
    attack,
    useSkill,
    // Redraw your gear after equipping or taking something off
    refreshGear() { if (game) wearGear(avatar, game.worn()); },
    sleep: toggleSleep,
    placeTorch,
    pitchTent,
    get resting() { return sleeping ? 'sleeping' : collapsed > 0 ? 'collapsed' : null; },
    say,
    // Land: show or hide the buying grid, and take everyone's plots from the server
    setLandMode(v) { plots.setMode(v); },
    get landMode() { return plots.on; },
    selectPlot(p) { return plots.select(p); },
    setLands(list) {
      const before = new Set(prepared);
      prepared = new Set(list.filter((p) => Number.isFinite(p.flat)).map((p) => `${p.ix},${p.iz}`));
      setPreparedPlots(list);
      for (const k of prepared) {
        if (before.has(k)) continue;
        const [ix, iz] = k.split(',').map(Number);
        land.refreshAt((ix + 0.5) * PLOT, (iz + 0.5) * PLOT);
      }
      plots.setLands(list);
    },
    // let the mouse go (a window is opening)
    releaseMouse() { if (locked()) { letGo = true; document.exitPointerLock(); } },
    setCameraMode(mode) { cameraMode = mode === 'follow' ? 'follow' : 'free'; },
    stop() {
      saveNow();
      renderer.setAnimationLoop(null);
      creatures.clear();
      land.dispose();
      sky.dispose();
      floatLayer.remove();
      plots.dispose();
      stickEl.remove();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pagehide', saveNow);
      renderer.dispose();
    },
  };
}

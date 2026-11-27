// Dragon eggs (see data/eggs.mjs): the nests at the dragons' and wyverns' lairs, taking an egg (the
// parent sees you and attacks), hatching it step by step, and the hatchling that follows you about
// until it is grown enough to fly you.
//   - a nest: a ring of scorched rocks round a bed of twigs, with up to 2 eggs (a taken egg is laid
//     again 30 minutes later)
//   - hatching: set the egg down (from the bag) somewhere that suits it (fire eggs by a lit campfire,
//     frost eggs on snow and ice, storm eggs high on a mountain). While you are near it warms; now
//     and then it rocks and must be turned (E beside it) before it warms any more. Fully warm, it
//     cracks open, and the hatchling is yours.
//   - the hatchling follows you (it flutters after you, and flies with you when you fly), puffs
//     little breaths, and grows; after 45 minutes with you it is a grown beast you can ride.
import * as THREE from 'three';
import { BEASTS, lairsNear } from '../data/beasts.mjs';
import { EGGS, HEAT, NEST_EGGS, EGG_RETURNS, TURN_EVERY, GROW_SECS, EGG_NEAR } from '../data/eggs.mjs';
import { ITEMS } from '../data/items.mjs';
import { buildBeast, animateBeast, makeBreath } from './beasts.js';

// ---------- an egg ----------
// standing on its base at y = 0, `size` metres tall; the markings are its kind's (veins of light,
// speckles, or ice crystals)
export function buildEgg(id) {
  const e = EGGS[id], L = e.look;
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const pts = [];
  const R = (a) => Math.sin(a) * 0.36 * (1 + 0.14 * Math.cos(a)); // (fuller at the bottom)
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; pts.push(new THREE.Vector2(Math.max(0.0001, R(a)), 0.5 - Math.cos(a) * 0.5)); }
  const shellM = new THREE.MeshStandardMaterial({ color: L.shell, roughness: L.marks === 'crystals' ? 0.25 : 0.55, metalness: 0.05 });
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), shellM);
  shell.castShadow = true; body.add(shell);
  // a point on the shell: `u` round (radians), `v` from the bottom (0) to the top (1)
  const on = (u, v, out = 1) => { const a = Math.acos(1 - 2 * v); const r = R(a) * out; return new THREE.Vector3(Math.cos(u) * r, 0.5 - Math.cos(a) * 0.5, Math.sin(u) * r); };
  const markM = L.glow
    ? new THREE.MeshStandardMaterial({ color: L.mark, emissive: L.mark, emissiveIntensity: L.glow, roughness: 0.4, transparent: L.marks === 'crystals', opacity: 0.85 })
    : new THREE.MeshStandardMaterial({ color: L.mark, roughness: 0.7 });
  let seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (L.marks === 'veins') {
    // cracks of light wandering up the shell
    for (let k = 0; k < 7; k++) {
      let u = rnd() * Math.PI * 2, v = 0.08 + rnd() * 0.15;
      const path = [];
      for (let i = 0; i < 8; i++) { path.push(on(u, Math.min(0.95, v), 1.012)); u += (rnd() - 0.5) * 0.7; v += 0.08 + rnd() * 0.06; }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 24, 0.009, 4), markM);
      body.add(tube);
    }
  } else if (L.marks === 'spots') {
    const spot = new THREE.SphereGeometry(1, 8, 6);
    for (let k = 0; k < 26; k++) {
      const p = on(rnd() * Math.PI * 2, 0.12 + rnd() * 0.8, 0.985);
      const m = new THREE.Mesh(spot, markM); m.position.copy(p); m.scale.setScalar(0.018 + rnd() * 0.03);
      body.add(m);
    }
  } else {
    // ice crystals growing out of the shell
    const cone = new THREE.ConeGeometry(0.025, 0.12, 5);
    for (let k = 0; k < 22; k++) {
      const p = on(rnd() * Math.PI * 2, 0.1 + rnd() * 0.85, 0.97);
      const m = new THREE.Mesh(cone, markM); m.position.copy(p);
      const n = new THREE.Vector3(p.x, p.y - 0.5, p.z).normalize();
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      m.scale.setScalar(0.6 + rnd() * 0.9);
      body.add(m);
    }
  }
  g.scale.setScalar(e.size);
  // a gentle glow; a rock as it wants turning; a shudder as it hatches
  g.userData.tick = (t, { rock = 0, crack = 0 } = {}) => {
    if (L.glow && L.marks !== 'crystals') markM.emissiveIntensity = L.glow * (L.flicker ? (Math.sin(t * 23) > 0.6 ? 1.8 : 0.6) : 0.8 + Math.sin(t * 2) * 0.25);
    const wob = rock * Math.sin(t * 9) * 0.18 + crack * Math.sin(t * 31) * 0.12;
    body.rotation.z = wob; body.rotation.x = wob * 0.4;
  };
  return g;
}

// a nest of scorched rocks round a bed of twigs; `slots` are where its eggs lie
function buildNest(kind) {
  const g = new THREE.Group();
  const rockM = new THREE.MeshStandardMaterial({ color: kind.startsWith('frost') ? '#8a9aa8' : kind.startsWith('fire') ? '#2a1c16' : '#4a4640', roughness: 0.95 });
  const twigM = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 1 });
  const bedM = new THREE.MeshStandardMaterial({ color: kind.startsWith('frost') ? '#dce8f0' : '#3a2a1c', roughness: 1 });
  const big = kind.endsWith('dragon');
  const r = big ? 2.4 : 1.6;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r * (0.2 + (i % 3) * 0.05), 0), rockM);
    m.position.set(Math.cos(a) * r, r * 0.08, Math.sin(a) * r); m.rotation.set(i, i * 2, 0); m.castShadow = true;
    g.add(m);
  }
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.7, r * 0.18, 20), bedM); bed.position.y = r * 0.04; g.add(bed);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, d = r * (0.6 + Math.random() * 0.35);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, r * 0.9, 4), twigM);
    m.position.set(Math.cos(a) * d, r * 0.16, Math.sin(a) * d); m.rotation.set(Math.PI / 2, 0, a + 1.3 + Math.random() * 0.5);
    g.add(m);
  }
  const slots = [new THREE.Vector3(-r * 0.25, r * 0.12, 0), new THREE.Vector3(r * 0.28, r * 0.12, r * 0.12), new THREE.Vector3(0, r * 0.12, -r * 0.3)];
  return { g, slots, r };
}

export function createHatchery({ scene, game, say, onEvent, getPos, getPlayer, groundAt, landAt, fireNear, angerParent, canPlace, onGrown }) {
  const c = () => game.character;
  const nests = new Map(); // lair id -> { L, kind, x, z, y, group, eggs: [{ mesh, slot }] }
  const placed = new Map(); // a placed egg (its record in the character) -> its mesh
  let scanT = 0, saveT = 0, sayT = -99;

  // ---------- the nests at the lairs ----------
  // (for the Fire Dragons, on the crater's rim, away from the lava)
  function nestSpot(L) {
    if (L.kind !== 'fire_dragon') return { x: L.x, z: L.z };
    let best = null;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      for (const d of [215, 240, 270]) { const x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d; const h = landAt(x, z); if (!best || h > best.h) best = { x, z, h }; }
    }
    return best;
  }
  const taken = (id) => ((c().nests ||= {})[id] ||= []).filter((at) => Date.now() - at < EGG_RETURNS);
  function scanNests(p) {
    for (const [id, n] of nests) if (Math.hypot(n.x - p.x, n.z - p.z) > 650) { scene.remove(n.group); nests.delete(id); }
    for (const L of lairsNear(p.x, p.z, 520)) {
      if (!EGGS[L.kind] || nests.has(L.id)) continue;
      const at = nestSpot(L), y = landAt(at.x, at.z);
      const { g, slots } = buildNest(L.kind);
      g.position.set(at.x, y, at.z);
      scene.add(g);
      nests.set(L.id, { L, kind: L.kind, x: at.x, z: at.z, y, group: g, slots, eggs: [] });
    }
    for (const n of nests.values()) {
      // as many eggs as the nest has now
      const want = Math.max(0, NEST_EGGS - taken(n.L.id).length);
      while (n.eggs.length > want) n.group.remove(n.eggs.pop());
      while (n.eggs.length < want) { const m = buildEgg(n.kind); m.position.copy(n.slots[n.eggs.length]); m.rotation.y = n.eggs.length * 2.1; n.group.add(m); n.eggs.push(m); }
    }
  }
  const nestNear = (x, z, r = 3.5) => [...nests.values()].find((n) => n.eggs.length && Math.hypot(n.x - x, n.z - z) < r) || null;
  function takeEgg(n) {
    if (game.addItem(`egg_${n.kind}`, 1) === false) { say('Your bag is full', 'hurt'); return; }
    taken(n.L.id);
    c().nests[n.L.id] = [...taken(n.L.id), Date.now()];
    game.touch('bag');
    scanNests(getPos());
    // if its parent is about, it sees you: from now on it hunts you down whenever it sees you
    const parent = angerParent(n.L.id);
    if (parent) { (c().grudges ||= {})[n.L.id] = true; game.touch('bag'); }
    const back = Math.round(EGG_RETURNS / 3600e3);
    say(parent ? `You take a ${EGGS[n.kind].beast} Egg… the ${parent.kind.name} sees you! It screams and dives at you. It will never forget you now` : `You take a ${EGGS[n.kind].beast} Egg from the nest. Set it down somewhere that suits it to hatch it (from your bag). It will be ${back} hours or so before the ${EGGS[n.kind].beast.toLowerCase()} lays another`, parent ? 'hurt' : 'exp');
    onEvent?.('egg-taken', { kind: n.kind });
  }

  // ---------- eggs set down to hatch ----------
  const eggs = () => (c().eggs ||= []);
  function heatOk(e) {
    const need = EGGS[e.kind].heat;
    if (need === 'fire') return !!fireNear(e.x, e.z, 4);
    const s = landAt(e.x, e.z, true);
    if (need === 'cold') return s.region === 'frost' || s.h > 1300;
    return s.h > 1200; // (storm)
  }
  function placeEgg(itemId) {
    const id = ITEMS[itemId]?.egg;
    if (!id || !game.has(itemId)) return false;
    const why = canPlace();
    if (why) { say(why, 'note'); return false; }
    const p = getPos(), h = getPlayer().heading;
    const x = p.x + Math.sin(h) * 1.4, z = p.z + Math.cos(h) * 1.4;
    game.removeItem(itemId, 1);
    const e = { kind: id, x, z, warm: 0, sinceTurn: 0, needTurn: false, crack: 0 };
    eggs().push(e);
    game.touch('bag');
    say(`You set the ${EGGS[id].beast} Egg down. To hatch it needs ${HEAT[EGGS[id].heat]}, and you nearby. Turn it when it rocks (E beside it)${heatOk(e) ? '. It is warming!' : '. It is not warming here yet.'}`, 'note');
    return true;
  }
  const eggNear = (x, z, r = 2.5) => eggs().find((e) => Math.hypot(e.x - x, e.z - z) < r) || null;
  let lastLook = null;
  function tendEgg(e) {
    const E = EGGS[e.kind], pct = Math.floor((e.warm / E.secs) * 100);
    if (e.needTurn) { e.needTurn = false; e.sinceTurn = 0; game.touch('bag'); say(`You turn the ${E.beast} Egg gently. ${pct}% warm`, 'exp'); return; }
    // pressed twice in a row: pick it back up (it cools down and must start again)
    if (lastLook?.e === e && performance.now() - lastLook.at < 3000) {
      if (game.addItem(`egg_${e.kind}`, 1) === false) { say('Your bag is full', 'hurt'); return; }
      eggs().splice(eggs().indexOf(e), 1); game.touch('bag');
      say(`You pick the ${E.beast} Egg back up. It cools down: it will have to warm from the start`, 'note');
      lastLook = null; return;
    }
    lastLook = { e, at: performance.now() };
    say(`${E.beast} Egg: ${pct}% warm. Needs ${HEAT[E.heat]}: ${heatOk(e) ? 'yes ✔' : 'not here ✘'}. (E again to pick it up)`, 'note');
  }
  function hatch(e) {
    eggs().splice(eggs().indexOf(e), 1);
    const item = `hatchling_${e.kind}`;
    game.addItem(item, 1);
    c().petGrow ||= {}; c().petGrow[e.kind] = c().petGrow[e.kind] || 0;
    game.touch('bag');
    say(`The egg cracks open… a baby ${EGGS[e.kind].beast.toLowerCase()} tumbles out, blinks at you, and squeaks! It will follow you everywhere`, 'exp');
    onEvent?.('hatched', { kind: e.kind });
    makePet(item, e.x, e.z);
  }
  function tickEggs(dt, t, p) {
    for (const e of [...eggs()]) {
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      let m = placed.get(e);
      if (d < 300 && !m) { m = buildEgg(e.kind); m.position.set(e.x, landAt(e.x, e.z), e.z); scene.add(m); placed.set(e, m); }
      if (d >= 300 && m) { scene.remove(m); placed.delete(e); m = null; }
      if (!m) continue;
      const E = EGGS[e.kind];
      if (e.warm >= E.secs) {
        // fully warm: it shudders and cracks
        e.crack += dt;
        if (e.crack > 5) { scene.remove(m); placed.delete(e); hatch(e); continue; }
      } else if (d < EGG_NEAR && !e.needTurn && heatOk(e)) {
        e.warm = Math.min(E.secs, e.warm + dt);
        e.sinceTurn += dt;
        if (e.warm >= E.secs) say(`The ${E.beast} Egg is cracking! It is about to hatch`, 'exp');
        else if (e.sinceTurn > TURN_EVERY) { e.needTurn = true; if (d < 60) say(`The ${E.beast} Egg rocks: turn it (E beside it), or it won't warm any more`, 'note'); }
      } else if (d < 12 && !e.needTurn && !heatOk(e) && t - sayT > 45) { sayT = t; say(`The ${E.beast} Egg is cold. It needs ${HEAT[E.heat]}`, 'note'); }
      m.userData.tick(t, { rock: e.needTurn ? 1 : 0, crack: e.warm >= E.secs ? 1 : 0 });
    }
  }

  // ---------- the hatchling that follows you ----------
  let pet = null; // { item, kind, root, x, z, air, heading, scale, puffT, breath }
  const petItem = () => Object.keys(EGGS).map((k) => `hatchling_${k}`).find((id) => game.has(id)) || null;
  function makePet(item, x, z) {
    if (pet) clearPet();
    const kind = ITEMS[item].hatchling, def = BEASTS[kind];
    const root = buildBeast(def);
    const base = (kind.endsWith('dragon') ? 2.2 : 1.5) / def.len;
    root.position.set(x, landAt(x, z), z);
    scene.add(root);
    pet = { item, kind, root, x, z, air: 0, heading: 0, base, puffT: 8 + Math.random() * 10, breath: null };
    sizePet();
  }
  function sizePet() {
    const k = Math.min(1, ((c().petGrow || {})[pet.kind] || 0) / GROW_SECS);
    pet.root.scale.setScalar(pet.base * (1 + k * 0.8)); // (it grows as it spends time with you)
  }
  function clearPet() {
    if (!pet) return;
    if (pet.breath) { scene.remove(pet.breath); pet.breath.userData.dispose(); }
    scene.remove(pet.root); pet = null;
  }
  function tickPet(dt, t, p) {
    const item = petItem();
    if (!item) { clearPet(); return; }
    if (!pet || pet.item !== item) { const h = getPlayer().heading; makePet(item, p.x - Math.sin(h) * 3, p.z - Math.cos(h) * 3); }
    const P = getPlayer();
    let dx = p.x - pet.x, dz = p.z - pet.z, d = Math.hypot(dx, dz);
    if (d > 160) { pet.x = p.x - Math.sin(P.heading) * 4; pet.z = p.z - Math.cos(P.heading) * 4; dx = p.x - pet.x; dz = p.z - pet.z; d = Math.hypot(dx, dz); }
    const ground = landAt(pet.x, pet.z);
    // it keeps close: it walks after you, and flutters to catch up (or to fly beside you)
    const pAir = P.flying ? Math.max(0, p.y - ground) : 0;
    let speed = 0;
    if (d > 3) { speed = Math.min(P.flying || d > 20 ? 70 : 9, (d - 2.5) * 1.6); pet.heading = Math.atan2(dx, dz); }
    else if (d > 0.5) pet.heading += Math.atan2(Math.sin(Math.atan2(dx, dz) - pet.heading), Math.cos(Math.atan2(dx, dz) - pet.heading)) * Math.min(1, dt * 2);
    pet.x += Math.sin(pet.heading) * speed * dt; pet.z += Math.cos(pet.heading) * speed * dt;
    const wantAir = P.flying ? pAir + 2 : d > 20 ? 2.5 : 0;
    pet.air += (wantAir - pet.air) * Math.min(1, dt * 3);
    pet.root.position.set(pet.x, landAt(pet.x, pet.z) + pet.air, pet.z);
    pet.root.rotation.y = pet.heading;
    // now and then a little puff of breath (fire, frost or sparks), just for show
    pet.puffT -= dt;
    if (pet.puffT <= 0 && !pet.breath && BEASTS[pet.kind].breath) {
      pet.puffT = 15 + Math.random() * 20;
      pet.breath = makeBreath(BEASTS[pet.kind].breath, 1.4, 0.25); pet.breathT = 0.9; scene.add(pet.breath);
    }
    if (pet.breath) {
      pet.breathT -= dt;
      pet.root.updateMatrixWorld(true);
      pet.root.userData.beast.mouth.getWorldPosition(pet.breath.position);
      pet.breath.rotation.set(0, pet.heading, 0);
      pet.breath.userData.tick(t);
      if (pet.breathT <= 0) { scene.remove(pet.breath); pet.breath.userData.dispose(); pet.breath = null; }
    }
    animateBeast(pet.root, t, { air: pet.air, speed: speed * 0.5, open: !!pet.breath });
    // growing up
    const g = (c().petGrow ||= {});
    g[pet.kind] = (g[pet.kind] || 0) + dt;
    if (Math.floor(g[pet.kind] / 10) !== Math.floor((g[pet.kind] - dt) / 10)) { sizePet(); game.touch('bag'); }
    if (g[pet.kind] >= GROW_SECS) {
      const kind = pet.kind, x = pet.x, z = pet.z, h = pet.heading;
      game.removeItem(pet.item, 1);
      delete g[kind];
      clearPet();
      game.addItem(`tamed_${kind}`, 1);
      game.touch('bag');
      onGrown?.(`tamed_${kind}`, x, z, h);
      say(`Your ${BEASTS[kind].name.toLowerCase()} is grown! It is big enough to fly you now: press H beside it to climb on`, 'exp');
    }
  }

  function tick(dt, t) {
    const p = getPos();
    scanT -= dt;
    if (scanT <= 0) { scanT = 2; scanNests(p); }
    for (const n of nests.values()) for (const m of n.eggs) m.userData.tick(t);
    tickEggs(dt, t, p);
    tickPet(dt, t, p);
    saveT -= dt;
    if (saveT <= 0) { saveT = 10; if (eggs().length) game.touch('bag'); }
  }

  // E: take an egg from a nest, or turn (look at, pick up) one you set down
  function interact() {
    const p = getPos();
    const e = eggNear(p.x, p.z);
    if (e) { tendEgg(e); return true; }
    const n = nestNear(p.x, p.z);
    if (n) { takeEgg(n); return true; }
    // an empty nest: the beast has not laid again yet
    const empty = [...nests.values()].find((q) => !q.eggs.length && Math.hypot(q.x - p.x, q.z - p.z) < 3.5);
    if (empty) {
      const next = Math.min(...taken(empty.L.id)) + EGG_RETURNS - Date.now();
      const mins = Math.max(1, Math.round(next / 60e3));
      say(`The nest is empty. The ${EGGS[empty.kind].beast.toLowerCase()} will lay another egg in ${mins >= 90 ? `about ${Math.round(mins / 60)} hours` : `${mins} minutes`}`, 'note');
      return true;
    }
    return false;
  }
  function tapTargets(list) {
    const p = getPos();
    for (const e of eggs()) if (Math.hypot(e.x - p.x, e.z - p.z) < 14) list.push([e.x, landAt(e.x, e.z) + 0.4, e.z, 1.2, () => (Math.hypot(e.x - getPos().x, e.z - getPos().z) < 2.5 ? tendEgg(e) : say('Walk up to the egg', 'note'))]);
    for (const n of nests.values()) if (n.eggs.length && Math.hypot(n.x - p.x, n.z - p.z) < 20) list.push([n.x, n.y + 0.6, n.z, 2.4, () => (Math.hypot(n.x - getPos().x, n.z - getPos().z) < 3.5 ? takeEgg(n) : say('Walk up to the nest', 'note'))]);
  }

  return {
    tick, interact, tapTargets, placeEgg,
    // where your hatchling is (for other players to see it)
    petSpot: () => (pet ? { kind: pet.kind, x: pet.x, y: pet.root.position.y, z: pet.z, heading: pet.heading, air: pet.air, scale: pet.root.scale.x } : null),
    clear() { for (const n of nests.values()) scene.remove(n.group); nests.clear(); for (const m of placed.values()) scene.remove(m); placed.clear(); clearPet(); },
    // (tests)
    debug: () => ({ nests: [...nests.values()].map((n) => ({ id: n.L.id, kind: n.kind, x: Math.round(n.x), z: Math.round(n.z), y: Math.round(n.y), eggs: n.eggs.length })), eggs: eggs().map((e) => ({ ...e, heat: heatOk(e) })), pet: pet ? { kind: pet.kind, x: Math.round(pet.x), z: Math.round(pet.z), air: Math.round(pet.air), grow: Math.round(c().petGrow?.[pet.kind] || 0) } : null }),
    debugWarm(secs) { for (const e of eggs()) { e.warm = Math.min(EGGS[e.kind].secs, e.warm + secs); e.needTurn = false; } },
    debugGrow(secs) { const g = (c().petGrow ||= {}); if (pet) g[pet.kind] = (g[pet.kind] || 0) + secs; },
    nestNear: (x, z, r) => nestNear(x, z, r),
  };
}

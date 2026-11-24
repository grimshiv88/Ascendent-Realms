// Hunting and the farms, out in the world:
//   - the farmsteads (world/farms.js), built when you come near, with their animals in the pens
//   - a hunted animal's body: drag it (it follows behind you, slowing you down) to a Halal Butcher,
//     who prepares it for a small fee, or cut it up yourself (a knife, or a sword, dagger or axe)
//   - cooking: E by a fire (a waystone's, a farm's, or a campfire you light from Firewood) cooks
//     all the raw meat you carry
//   - feeding (a vegetable, hay or grain from your bag) and petting the grazing animals
//   - bait: a hunted body with a Hunter's Snare Trap set under it draws a bigger meat-eater, and
//     the snare holds it fast for a while (creatures.js lureMove)
import * as THREE from 'three';
import { allFarms } from '../data/farms.mjs';
import { FARM_HERD, ANIMALS, baitDraws } from '../data/animals.mjs';
import { sample } from '../data/world-layout.mjs';
import { ITEMS } from '../data/items.mjs';
import { buildFarm } from './farms.js';
import { canHarvest } from './deaths.js';
import { TAMEABLE, TAME_FEEDS } from '../data/mounts.mjs';

const FARM_BUILD = 650, FARM_DROP = 850;
const CAMPFIRE_SECS = 6 * 60, CAMPFIRES_MAX = 3;
export const CAMPFIRE_SAFE = 9; // metres round a lit campfire where monsters won't find you at night
const BLADES = ['sword', 'dagger', 'axe'];
const BIRD_FOOD = ['grain', 'lettuce', 'cabbage', 'carrot'];
// bait: how long a body set as bait lasts, how long before the first beast comes (and between
// them), how many come to one bait, and how near you must stay for them to come
const BAIT_SECS = 6 * 60, BAIT_FIRST = [12, 30], BAIT_NEXT = [45, 90], BAIT_VISITS = 2, BAIT_NEAR = 160;
const rand = (a, b) => a + Math.random() * (b - a);

export function createHusbandry({ scene, colliders, creatures, game, say, floatText, onEvent, onTame, getPos, getHeading, groundAt, siteFires, getHand = null }) {
  // the rope you drag a body by: from your hand to its neck, sagging a little in the middle
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#a8824a', roughness: 0.95 });
  let rope = null;
  const ropeA = new THREE.Vector3(), ropeB = new THREE.Vector3(), ropeM = new THREE.Vector3();
  function drawRope(m) {
    if (rope) { scene.remove(rope); rope.geometry.dispose(); rope = null; }
    if (!m) return;
    const p = getPos();
    if (getHand) ropeA.copy(getHand()); else ropeA.set(p.x, p.y + 1, p.z);
    const neck = m.body.userData.beast?.neck;
    if (neck) { m.body.updateMatrixWorld(true); neck.getWorldPosition(ropeB); } else ropeB.set(m.x, m.y + 0.3, m.z);
    ropeM.addVectors(ropeA, ropeB).multiplyScalar(0.5);
    ropeM.y = Math.min(ropeA.y, ropeB.y) - 0.15 - ropeA.distanceTo(ropeB) * 0.06;
    const curve = new THREE.QuadraticBezierCurve3(ropeA.clone(), ropeM.clone(), ropeB.clone());
    rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.018, 5, false), ropeMat);
    rope.castShadow = true;
    scene.add(rope);
  }
  const farms = allFarms().map((f) => ({ f, built: null }));
  const fires = []; // campfires you lit: { x, z, group, flames, light, left }
  let dragging = null; // the body you are dragging
  let offered = null;  // the body whose choice (drag or cut) is showing
  let lastPet = new WeakMap();

  // ---------- the farms ----------
  function updateFarms(x, z) {
    for (const q of farms) {
      const d = Math.hypot(x - q.f.x, z - q.f.z);
      if (d < FARM_BUILD && !q.built) {
        q.built = buildFarm(q.f);
        scene.add(q.built.group);
        colliders.add(q.built.solid);
        const c = creatures();
        for (const [id, n] of FARM_HERD) {
          const bird = id === 'chicken' || id === 'turkey';
          const pen = bird ? q.built.pens.yard : q.built.pens.pen;
          for (let i = 0; i < n; i++) {
            const m = c.spawnAt(`a_${id}`, 1, pen.x + (Math.random() - 0.5) * pen.hw * 1.6, pen.z + (Math.random() - 0.5) * pen.hd * 1.6, { keep: true, farm: q.f.id, pen });
            m.heading = Math.random() * 6.28;
          }
        }
      } else if (d > FARM_DROP && q.built) {
        scene.remove(q.built.group);
        colliders.remove(q.built.solid);
        creatures().removeWhere((m) => m.farm === q.f.id);
        q.built = null;
      }
    }
  }
  const builtFarms = () => farms.filter((q) => q.built);
  function npcNear(x, z, r = 2.8) {
    for (const q of builtFarms()) for (const n of q.built.npcs) if (Math.hypot(n.x - x, n.z - z) < r) return n;
    return null;
  }

  // ---------- fires ----------
  function allFires() {
    const out = [...siteFires(), ...fires];
    for (const q of builtFarms()) out.push(q.built.fire);
    return out;
  }
  const fireNear = (x, z, r = 3.2) => allFires().find((f) => Math.hypot(f.x - x, f.z - z) < r) || null;
  function lightCampfire() {
    const p = getPos(), h = getHeading();
    if (!game.has('firewood')) { say('You need Firewood (from the shop, or make it from 2 logs)', 'hurt'); return 'none'; }
    if (fires.length >= CAMPFIRES_MAX) { const old = fires.shift(); scene.remove(old.group); }
    game.giveAway('firewood');
    const x = p.x + Math.sin(h) * 1.6, z = p.z + Math.cos(h) * 1.6;
    const group = new THREE.Group();
    group.position.set(x, groundAt(x, z), z);
    const stone = new THREE.MeshStandardMaterial({ color: '#5a5650', roughness: 1 }), log = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 1 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), stone); r.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55); group.add(r); }
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), log); l.rotation.set(Math.PI / 2 - 0.5, (i / 4) * Math.PI * 2, 0); l.position.y = 0.2; group.add(l); }
    const fm = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff7a1a', emissiveIntensity: 3, transparent: true, opacity: 0.9 });
    const flames = [0, 1, 2].map((i) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.2 - i * 0.04, 0.7 - i * 0.12, 8), fm); f.position.set((i - 1) * 0.09, 0.45, (i % 2) * 0.07); group.add(f); return f; });
    const light = new THREE.PointLight('#ff9a3c', 12, 13, 1.8); light.position.y = 0.8; group.add(light);
    scene.add(group);
    fires.push({ x, z, group, flames, light, left: CAMPFIRE_SECS });
    say('You light a campfire. Press E beside it to cook raw meat', 'note');
    return 'ok';
  }
  function cookHere() {
    const out = game.cookAll();
    if (!out.length) return false;
    say(`You cook over the fire: ${out.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', ')}`, 'exp');
    return true;
  }

  // ---------- bodies of hunted animals ----------
  const carcassNear = (x, z, r) => {
    let best = null, bd = r;
    for (const m of creatures().list) if (m.kind.animal && m !== dragging && canHarvest(m)) { const d = Math.hypot(m.x - x, m.z - z); if (d < bd) { bd = d; best = m; } }
    return best;
  };
  function hasBlade() {
    if (game.has('hunting_knife')) return true;
    const w = game.weapon();
    return !!w && BLADES.includes(w.type);
  }
  function offer(m) {
    offered = m;
    const a = m.kind.animal;
    onEvent?.('carcass', { name: a.name, meat: !!a.meat, blade: hasBlade(), size: a.len, snare: game.has('bait_trap'), baited: !!m.bait });
  }
  function drag(m = offered) {
    if (!m || !canHarvest(m)) return;
    if (dragging && dragging !== m) drop();
    dragging = m; m.dragged = true; offered = null;
    say(`You drag the ${m.kind.animal.name}. Take it to a Halal Butcher (E at the counter), or E to let go`, 'note');
  }
  function drop() {
    if (!dragging) return;
    dragging.dragged = false;
    say(`You let go of the ${dragging.kind.animal.name}`, 'note');
    dragging = null;
  }
  // what a body gives: [[item, n]]
  function partsOf(a, cooked) {
    const out = [];
    if (a.meat) out.push([cooked ? `cooked_${a.meat}` : `raw_${a.meat}`, a.cuts || 1]);
    if (a.hide) out.push(['animal_hide', a.hide]);
    if (a.fang) out.push(['animal_fang', a.fang]);
    if (a.shape === 'bird') out.push(['feather', 2]);
    return out;
  }
  function cut(m = offered) {
    if (!m || !canHarvest(m)) return;
    if (!hasBlade()) { say('You need a blade to cut it up: a Hunting Knife, or a sword, dagger or axe in your hand', 'hurt'); return; }
    const a = m.kind.animal;
    if (m === dragging) dragging = null;
    m.death.harvested = true; offered = null;
    const got = partsOf(a, false);
    for (const [id, n] of got) game.addItem(id, n);
    say(got.length ? `You cut up the ${a.name}: ${got.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', ')}${a.meat ? '. Cook the meat by a fire (E)' : ''}` : `There is nothing on the ${a.name} worth keeping`, 'exp');
    if (!a.meat) say(`${a.name} meat is not halal, so it is not eaten`, 'note');
  }
  function toButcher(n) {
    const m = dragging, a = m.kind.animal;
    const fee = a.meat ? 2 * (a.cuts || 1) : 0;
    if (fee && !game.pay(fee)) { say(`The butcher asks ${fee} Copper to prepare it`, 'hurt'); return; }
    dragging = null;
    m.death.harvested = true;
    const got = partsOf(a, true);
    for (const [id, k] of got) game.addItem(id, k);
    floatText(fee ? `-${fee} Copper` : 'Thank you', new THREE.Vector3(n.x, groundAt(n.x, n.z) + 2.2, n.z), 'note');
    say(a.meat
      ? `The butcher prepares your ${a.name} the halal way and cooks it: ${got.map(([id, k]) => `${k} ${ITEMS[id].name}`).join(', ')}`
      : `The butcher takes the ${a.name}'s hide${a.fang ? ' and fangs' : ''} for you. Its meat is not halal, so he buries the rest`, 'exp');
  }

  // ---------- bait and snares ----------
  const baits = []; // { m: the body, x, z, snare, wait, visits, visitor }
  const snareMat = new THREE.MeshStandardMaterial({ color: '#b08a52', roughness: 0.95 });
  const stakeMat = new THREE.MeshStandardMaterial({ color: '#5a3e24', roughness: 1 });
  function snareMesh(r) {
    const g = new THREE.Group();
    const loop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 5, 28), snareMat);
    loop.rotation.x = Math.PI / 2; loop.position.y = 0.04;
    g.add(loop);
    // a bent sapling stake, and the cord running from it to the noose
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.8, 6), stakeMat);
    stake.position.set(r + 0.45, 0.35, 0); stake.rotation.z = 0.25;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 4), snareMat);
    cord.position.set(r + 0.12, 0.35, 0); cord.rotation.z = 1.0;
    g.add(stake, cord);
    g.traverse((o) => { o.castShadow = true; });
    return g;
  }
  function setBait(m = offered) {
    if (!m || !canHarvest(m)) return;
    const a = m.kind.animal;
    if (m.bait) { say(`A snare is already set under the ${a.name}`, 'note'); return; }
    if (!game.has('bait_trap')) { say('You need a Hunter\'s Snare Trap to set it as bait (from a Halal Butcher, a market or the shop)', 'hurt'); return; }
    const draws = baitDraws(sample(m.x, m.z, {}).region, a.len);
    if (!draws.length) { say('Nothing in this land hunts by the smell of meat', 'note'); return; }
    if (m === dragging) { dragging.dragged = false; dragging = null; }
    game.giveAway('bait_trap');
    offered = null;
    m.bait = true;
    m.death.left = Math.max(m.death.left, BAIT_SECS); // (bait lasts longer than a body left lying)
    const snare = snareMesh(Math.max(0.45, a.len * 0.6));
    snare.position.set(m.x, groundAt(m.x, m.z), m.z);
    scene.add(snare);
    baits.push({ m, x: m.x, z: m.z, snare, draws, wait: rand(...BAIT_FIRST), visits: 0, visitor: null });
    say(`You set the snare under the ${a.name}. Now step well back (15 m or more) and wait: the smell will draw something bigger`, 'note');
  }
  function clearBait(b, why = null) {
    scene.remove(b.snare);
    if (b.visitor && !b.visitor.snared) b.visitor.lure = null;
    baits.splice(baits.indexOf(b), 1);
    if (why) say(why, 'note');
  }
  function tickBaits(dt) {
    const c = creatures(), p = getPos();
    for (const b of [...baits]) {
      const m = b.m;
      if (!c.list.includes(m) || m.death?.harvested || m.dragged) { clearBait(b); continue; }
      if (m.death.left <= 1) { clearBait(b, 'Your bait has rotted away'); continue; }
      const v = b.visitor;
      if (v && (v.dead || !c.list.includes(v) || (!v.lure && !(v.snared > 0)))) b.visitor = null;
      if (b.visitor || b.visits >= BAIT_VISITS) continue;
      if (Math.hypot(p.x - b.x, p.z - b.z) > BAIT_NEAR) continue;
      b.wait -= dt;
      if (b.wait > 0) continue;
      b.wait = rand(...BAIT_NEXT);
      const id = b.draws[Math.floor(Math.random() * b.draws.length)];
      const got = c.lureAnimal(id, b.x, b.z, true);
      if (!got) continue;
      b.visitor = got; b.visits += 1;
      say(`Something has caught the scent of your bait: a ${ANIMALS[id].name} is coming`, 'note');
    }
  }

  // ---------- grazing animals: feed and pet ----------
  function feedOrPet(m) {
    const a = m.kind.animal;
    const bird = a.shape === 'bird';
    const food = (bird ? BIRD_FOOD : Object.keys(ITEMS).filter((id) => ITEMS[id].feed && id !== 'grain')).find((id) => game.has(id));
    const top = new THREE.Vector3(m.x, m.y + m.height + 0.3, m.z);
    const tame = !m.farm && TAMEABLE[m.kind.animalId];
    if (food && !(m.fedT > (tame ? 110 : 30))) {
      game.giveAway(food);
      m.fedT = 120; m.fleeT = 0; m.petT = 2.5;
      floatText('♥', top, 'exp');
      // a wild horse or camel fed three times comes to trust you, and is yours to ride
      if (tame) {
        m.tamed = (m.tamed || 0) + 1;
        if (m.tamed >= TAME_FEEDS) {
          creatures().removeWhere((q) => q === m);
          game.addItem(tame, 1); game.touch('bag');
          onTame?.(tame, m);
          floatText('♥ Yours!', top, 'exp');
          say(`The ${a.name.toLowerCase()} trusts you now. It is yours: press H beside it to ride (it is in your bag as ${ITEMS[tame].name})`, 'exp');
          return;
        }
        say(`You feed the ${a.name.toLowerCase()} ${ITEMS[food].name.toLowerCase()}. It is starting to trust you (${m.tamed} of ${TAME_FEEDS})`, 'note');
        return;
      }
      say(`You feed the ${a.name} ${ITEMS[food].name.toLowerCase()}. ${m.farm ? 'It nuzzles your hand' : 'It trusts you now and follows you for a while'}`, 'note');
      return;
    }
    m.petT = 3; m.fleeT = 0;
    floatText('♥', top, 'exp');
    const last = lastPet.get(m) || 0;
    if (performance.now() - last > 60000) { lastPet.set(m, performance.now()); game.character.fatigue = Math.max(0, game.character.fatigue - 3); game.touch('fatigue'); }
    say(bird ? `You stroke the ${a.name}'s feathers. It clucks happily` : `You pet the ${a.name}. It leans into your hand${food ? '' : '. (Bring a vegetable, hay or grain to feed it)'}`, 'note');
  }

  // ---------- E ----------
  // Returns true if E did something here
  function interact() {
    const p = getPos();
    if (dragging) {
      const n = npcNear(p.x, p.z, 3.5);
      if (n?.kind === 'butcher') toButcher(n); else drop();
      return true;
    }
    const n = npcNear(p.x, p.z);
    if (n) { onEvent?.('market', n.kind === 'butcher' ? 'butcher' : 'farm_stand'); return true; }
    const body = carcassNear(p.x, p.z, 2.6);
    if (body) { offer(body); return true; }
    if (fireNear(p.x, p.z) && cookHere()) return true;
    const m = creatures().animalNear(p.x, p.z, 2.4);
    if (m) { feedOrPet(m); return true; }
    if (fireNear(p.x, p.z)) { say('Nothing raw to cook. Hunt an animal and cut it up first', 'note'); return true; }
    return false;
  }
  // Phones and tablets: the things here you can tap (see world.js tapUse)
  function tapTargets(list) {
    const p = getPos();
    for (const m of creatures().list) {
      if (!m.kind.animal || Math.abs(m.x - p.x) > 12 || Math.abs(m.z - p.z) > 12) continue;
      if (canHarvest(m) && m !== dragging) list.push([m.x, m.y + 0.3, m.z, 2.6, () => offer(m)]);
      else if (!m.dead && !m.kind.aggressive) list.push([m.x, m.y + m.height * 0.7, m.z, 2.4, () => feedOrPet(m)]);
    }
    for (const q of builtFarms()) for (const n of q.built.npcs) list.push([n.x, groundAt(n.x, n.z) + 1.4, n.z, 3.5, () => (dragging && n.kind === 'butcher' ? toButcher(n) : onEvent?.('market', n.kind === 'butcher' ? 'butcher' : 'farm_stand'))]);
    for (const f of allFires()) if (Math.abs(f.x - p.x) < 12 && Math.abs(f.z - p.z) < 12) list.push([f.x, groundAt(f.x, f.z) + 0.5, f.z, 3.2, () => { if (!cookHere()) say('Nothing raw to cook. Hunt an animal and cut it up first', 'note'); }]);
  }

  // ---------- every frame ----------
  function tick(dt, t) {
    for (const q of builtFarms()) q.built.update(t);
    tickBaits(dt);
    for (const f of [...fires]) {
      f.left -= dt;
      f.flames.forEach((fl, i) => { fl.scale.y = 0.85 + Math.sin(t * 9 + i * 2) * 0.15; });
      f.light.intensity = 11 + Math.sin(t * 13) * 2;
      if (f.left <= 0) { scene.remove(f.group); fires.splice(fires.indexOf(f), 1); say('Your campfire burns out', 'note'); }
    }
    // the body you drag slides along behind you
    if (dragging) {
      if (!canHarvest(dragging) && !dragging.dragged) { dragging = null; drawRope(null); return; }
      const p = getPos(), h = getHeading();
      const back = 0.7 + dragging.kind.animal.len * 0.55;
      const tx = p.x - Math.sin(h) * back, tz = p.z - Math.cos(h) * back;
      const k = Math.min(1, dt * 8);
      dragging.x += (tx - dragging.x) * k; dragging.z += (tz - dragging.z) * k;
      dragging.y = groundAt(dragging.x, dragging.z);
      dragging.body.position.set(dragging.x, dragging.y, dragging.z);
      dragging.body.rotation.y = h;
      drawRope(dragging);
    } else if (rope) drawRope(null);
  }

  return {
    updateFarms, tick, interact, tapTargets, lightCampfire, drag: () => drag(), cut: () => cut(), bait: () => setBait(), drop,
    debugBaits: () => baits.map((b) => ({ x: b.x, z: b.z, draws: b.draws, wait: b.wait, visits: b.visits, visitor: b.visitor ? { id: b.visitor.kind.animalId, x: b.visitor.x, z: b.visitor.z, snared: b.visitor.snared || 0, lure: !!b.visitor.lure } : null })),
    // a big animal is heavy: you walk slower while you drag it
    dragSlow: () => (dragging ? Math.max(0.45, 1 - dragging.kind.animal.len * 0.18) : 1),
    get dragging() { return dragging; },
    nearCampfire: (x, z) => fires.some((f) => Math.hypot(f.x - x, f.z - z) < CAMPFIRE_SAFE),
    farms: () => farms.map((q) => ({ ...q.f, built: !!q.built })),
    built: () => builtFarms().map((q) => q.built),
    clear() { dragging = null; offered = null; drawRope(null); for (const b of [...baits]) clearBait(b); },
  };
}

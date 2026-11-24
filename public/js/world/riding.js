// Riding (see data/mounts.mjs): your own horse, donkey or camel. Call it (H, or from the bag) and
// it trots over to you; H or E beside it and you are in the saddle. While you ride, you move at the
// mount's pace (run to gallop), jump higher, and tire much more slowly; H or E again and you get off,
// and it waits there for you (even after you log out). You get off by yourself to go indoors or
// underground, to sit, to sleep, or when you fall.
import * as THREE from 'three';
import { ANIMALS } from '../data/animals.mjs';
import { MOUNTS, MOUNT_ITEMS } from '../data/mounts.mjs';
import { ITEMS } from '../data/items.mjs';
import { buildAnimal, animateAnimal } from './animalbody.js';

const MOUNT_REACH = 3.2;  // how close you stand to get on
const COME_FROM = 22;     // a called mount appears this far behind you (out of sight) and trots over

export function createRiding({ scene, game, say, getPos, getHeading, groundAt, canRide, riderHeight = () => 1.8 }) {
  let horse = null;   // { item, id, a, m, root, x, z, heading, saddle, come }
  let riding = false;
  let checkT = 0;

  const ownedItem = (want) => (want && game.has(want) ? want : MOUNT_ITEMS.find((id) => game.has(id)) || null);
  function remember() {
    game.character.mount = horse ? { item: horse.item, x: horse.x, z: horse.z } : null;
    game.touch('bag');
  }
  function make(item, x, z, heading = 0) {
    if (horse) scene.remove(horse.root);
    const id = ITEMS[item].mount, a = ANIMALS[id];
    const root = buildAnimal(a);
    // a saddle and a blanket on its back (on the moving body, so they rise and fall with the gait)
    const p = root.userData.beast;
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(p.body);
    const by = p.body.position.y;
    const top = bb.max.y - by, W = (bb.max.x - bb.min.x) / 2, len = bb.max.z - bb.min.z;
    const sz = len * 0.04; // a little in front of the middle of the back
    const leather = new THREE.MeshStandardMaterial({ color: '#5a3018', roughness: 0.6 });
    const blanket = new THREE.MeshStandardMaterial({ color: id === 'camel' ? '#8a2a3a' : '#2a4a7a', roughness: 0.95 });
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.body.add(o); return o; };
    const cloth = add(new THREE.CylinderGeometry(W * 1.06, W * 1.06, len * 0.3, 18, 1, true, -Math.PI * 0.62, Math.PI * 1.24), blanket, 0, top - W * 1.06 + 0.02, sz);
    cloth.rotation.x = Math.PI / 2; cloth.material.side = THREE.DoubleSide;
    add(new THREE.BoxGeometry(W * 0.95, 0.09, len * 0.2), leather, 0, top + 0.05, sz);
    add(new THREE.BoxGeometry(W * 0.7, 0.14, 0.07), leather, 0, top + 0.1, sz + len * 0.1);  // the pommel
    add(new THREE.BoxGeometry(W * 0.8, 0.12, 0.07), leather, 0, top + 0.09, sz - len * 0.1); // the cantle
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.03, top * 0.55, 0.05), leather, s * W * 0.98, top * 0.7, sz);
      add(new THREE.TorusGeometry(0.06, 0.012, 6, 12), new THREE.MeshStandardMaterial({ color: '#9a9a9a', metalness: 0.8, roughness: 0.3 }), s * W * 1.02, top * 0.42, sz).rotation.y = Math.PI / 2;
    }
    const saddle = by + top + 0.1;
    // sized to its rider: a pony for a child, a great beast for a giant
    const k = Math.max(0.6, Math.min(2.4, riderHeight() / 1.8));
    root.scale.setScalar(k);
    root.position.set(x, groundAt(x, z), z);
    root.rotation.y = heading;
    scene.add(root);
    horse = { item, id, a, m: MOUNTS[id], root, x, z, heading, saddle: saddle * k, seatZ: sz * k, come: false };
    return horse;
  }

  // H: get on or off your mount, or call it
  function toggle(want = null) {
    if (riding) { dismount(); return 'off'; }
    const p = getPos();
    const item = ownedItem(want || horse?.item);
    if (!item) { say('You have no mount. Buy a horse or a donkey at a Farm Stand, or tame a wild horse (stand still with a carrot or an apple)', 'note'); return 'none'; }
    const why = canRide();
    if (why) { say(why, 'note'); return 'no'; }
    if (horse && horse.item === item && Math.hypot(horse.x - p.x, horse.z - p.z) < MOUNT_REACH) { mount(); return 'on'; }
    call(item);
    return 'called';
  }
  function call(item) {
    const p = getPos(), h = getHeading();
    if (!horse || horse.item !== item || Math.hypot(horse.x - p.x, horse.z - p.z) > 150) {
      const x = p.x - Math.sin(h) * COME_FROM, z = p.z - Math.cos(h) * COME_FROM;
      make(item, x, z, h);
    }
    horse.come = true;
    say(`You whistle. Your ${horse.a.name.toLowerCase()} trots over. Press H or E beside it to get on`, 'note');
  }
  function mount() {
    if (!horse) return;
    riding = true;
    horse.come = false;
    say(`You climb into the saddle. Run to ${horse.id === 'donkey' ? 'trot' : 'gallop'}; H gets you off`, 'exp');
  }
  function dismount(quiet = false) {
    if (!riding) return;
    riding = false;
    remember();
    if (!quiet) say(`You get off your ${horse.a.name.toLowerCase()}. It waits here for you`, 'note');
  }
  // E beside your mount gets you on
  function interact() {
    if (riding) { dismount(); return true; }
    const p = getPos();
    if (!horse || Math.hypot(horse.x - p.x, horse.z - p.z) > MOUNT_REACH || !game.has(horse.item)) return false;
    const why = canRide();
    if (why) { say(why, 'note'); return true; }
    mount();
    return true;
  }
  // a tamed animal becomes yours where it stands
  function adopt(item, x, z, heading) {
    if (riding) dismount(true);
    make(item, x, z, heading);
    remember();
  }

  // every frame; `speed` is how fast you are moving (m/s)
  function tick(dt, t, speed, airborne) {
    if (!horse) return;
    checkT -= dt;
    if (checkT <= 0) {
      checkT = 1;
      // sold it or gave it away: it is not yours any more
      if (!game.has(horse.item)) { if (riding) riding = false; scene.remove(horse.root); horse = null; remember(); return; }
    }
    if (riding) {
      const p = getPos();
      horse.x = p.x; horse.z = p.z; horse.heading = getHeading();
      horse.root.position.set(p.x, p.y, p.z);
      horse.root.rotation.y = horse.heading;
      animateAnimal(horse.root, t, airborne ? horse.m.walk : speed);
      return;
    }
    let s = 0;
    if (horse.come) {
      const p = getPos();
      const dx = p.x - horse.x, dz = p.z - horse.z, d = Math.hypot(dx, dz);
      if (d < 2.4) { horse.come = false; remember(); }
      else {
        horse.heading = Math.atan2(dx, dz);
        s = Math.min(d > 8 ? horse.m.run * 0.6 : horse.m.walk * 0.6, d);
        horse.x += Math.sin(horse.heading) * s * dt; horse.z += Math.cos(horse.heading) * s * dt;
      }
    }
    horse.root.position.set(horse.x, groundAt(horse.x, horse.z), horse.z);
    horse.root.rotation.y = horse.heading;
    animateAnimal(horse.root, t, s);
  }

  // bring back the mount you left out last time
  function restore() {
    const s = game.character.mount;
    if (s && game.has(s.item) && Number.isFinite(s.x)) make(s.item, s.x, s.z, 0);
  }

  return {
    toggle, interact, adopt, tick, restore, dismount,
    get riding() { return riding; },
    // how much faster than on foot: walking and running
    pace: (running, walk, run) => (riding ? (running ? horse.m.run / run : horse.m.walk / walk) : 1),
    jump: () => (riding ? horse.m.jump : null),
    saddle: () => (riding ? horse.saddle : 0),
    seatZ: () => (riding ? horse.seatZ : 0),
    // the mount's legs reach out further than yours
    radius: () => (riding ? 0.7 : 0),
    mount: () => (horse ? { item: horse.item, id: horse.id, x: horse.x, z: horse.z, riding, coming: horse.come } : null),
    clear() { if (horse) scene.remove(horse.root); horse = null; riding = false; },
  };
}

// The rider's pose: sitting astride, knees bent round the horse's sides, hands forward on the reins
export function poseRide(rig) {
  if (!rig.legs || !rig.arms) return;
  rig.legs.forEach((leg, i) => {
    leg.hip.rotation.x = -0.8;
    leg.hip.rotation.z = (i === 0 ? -1 : 1) * 0.38;
    leg.knee.rotation.x = 1.05;
  });
  for (const arm of rig.arms) { arm.shoulder.rotation.x = -0.35; arm.elbow.rotation.x = -0.95; }
}

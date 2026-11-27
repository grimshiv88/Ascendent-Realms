// Other players close by: drawn with their own body, colours and gear, walking smoothly between
// the spots their games report (see data/presence.mjs), with their username above their head.
// Their tamed dragon or wyvern (ridden, or at their side) and their hatchling show too.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { wearGear } from '../characters/gear.js';
import { ITEMS } from '../data/items.mjs';
import { bodySig, GONE_MS } from '../data/presence.mjs';
import { BEASTS } from '../data/beasts.mjs';
import { buildBeast, animateBeast } from './beasts.js';

const WALK = 3.4; // (the walking speed the leg swing is timed to, as in world.js)

function nameTag(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 48;
  const g = c.getContext('2d');
  g.font = 'bold 24px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(name, 128, 32);
  g.fillStyle = '#9fd8ff'; g.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.8, 0.34, 1);
  s.userData.nameTag = true;
  return s;
}

function makeBody(b, name) {
  const body = buildCharacter({ race: b.race, form: b.form, stage: b.stage || 0, look: b.look || {}, age: b.age });
  const worn = {};
  for (const [slot, g] of Object.entries(b.gear || {})) if (ITEMS[g.id]) worn[slot] = { ...ITEMS[g.id], plus: g.plus || 0 };
  wearGear(body, worn);
  const tag = nameTag(name);
  tag.position.y = (body.userData.height || 1.8) + 0.35;
  body.add(tag);
  return body;
}

// turn the shortest way round from a to b
const turn = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

// a player's dragon, wyvern or hatchling ('h:<kind>'), drawn like the real thing
function makePet(k) {
  const kind = k.replace(/^h:/, ''), def = BEASTS[kind];
  if (!def || def.king || def.shape === 'spirit') return null;
  const root = buildBeast(def);
  const hatch = k.startsWith('h:');
  return { k, root, hatch, base: hatch ? (kind.endsWith('dragon') ? 2.2 : 1.5) / def.len : 1 };
}

export function createOthers(scene) {
  const seen = new Map(); // account id -> { body, sig, name, x, y, z, heading, to: {...}, speed, pose, pet }

  function dropPet(o) { if (o.pet) { scene.remove(o.pet.root); o.pet = null; } }
  function drop(id) {
    const o = seen.get(id);
    if (!o) return;
    dropPet(o);
    scene.remove(o.body);
    o.body.traverse((m) => { if (m.userData.nameTag) { m.material.map.dispose(); m.material.dispose(); } });
    seen.delete(id);
  }

  return {
    // the latest list from the server
    show(list) {
      const now = new Set();
      for (const p of list || []) {
        if (!p.body?.race) continue;
        now.add(p.id);
        let o = seen.get(p.id);
        const sig = bodySig(p.body) + p.name;
        if (o && o.sig !== sig) { drop(p.id); o = null; }
        if (!o) {
          let body;
          try { body = makeBody(p.body, p.name); } catch (e) { console.warn('could not draw player', p.name, e); continue; } // a race this game doesn't know yet
          scene.add(body);
          o = { body, sig, name: p.name, x: p.x, y: p.y, z: p.z, heading: p.heading };
          seen.set(p.id, o);
        }
        // a big jump (a portal, a fast mount): there at once rather than sliding across the land
        if (Math.hypot(p.x - o.x, p.z - o.z) > 30) { o.x = p.x; o.y = p.y; o.z = p.z; }
        o.to = { x: p.x, y: p.y, z: p.z, heading: p.heading };
        o.speed = p.speed; o.pose = p.pose; o.heard = Date.now();
        // their pet
        const pt = p.pet;
        if (o.pet && o.pet.k !== pt?.k) dropPet(o);
        if (pt && !o.pet) {
          try { o.pet = makePet(pt.k); } catch (e) { console.warn('could not draw pet', pt.k, e); }
          if (o.pet) { scene.add(o.pet.root); Object.assign(o.pet, { x: pt.x, y: pt.y, z: pt.z, h: pt.h, air: pt.air || 0 }); }
        }
        if (o.pet) {
          if (Math.hypot(pt.x - o.pet.x, pt.z - o.pet.z) > 40) Object.assign(o.pet, { x: pt.x, y: pt.y, z: pt.z });
          o.pet.to = pt; o.pet.ridden = o.pose === 'ride' || o.pose === 'fly';
        }
      }
      for (const id of [...seen.keys()]) if (!now.has(id)) drop(id);
    },
    // every frame: glide towards the reported spot and move the legs
    tick(dt, t) {
      const k = Math.min(1, dt * 6);
      // nothing new about them for a while (your connection dropped): not left standing there frozen
      const stale = Date.now() - GONE_MS * 1.5;
      for (const [id, o] of seen) if (o.heard < stale) drop(id);
      for (const o of seen.values()) {
        if (o.to) {
          o.x += (o.to.x - o.x) * k; o.y += (o.to.y - o.y) * k; o.z += (o.to.z - o.z) * k;
          o.heading = turn(o.heading, o.to.heading, k);
        }
        o.body.position.set(o.x, o.y, o.z);
        o.body.rotation.y = o.heading;
        const lying = o.pose === 'lie';
        o.body.rotation.z = lying ? Math.PI / 2 : 0;
        animateCharacter(o.body, t, lying || o.pose === 'sit' || o.pose === 'ride' || o.pose === 'fly' ? 0 : o.speed / WALK * 1.6);
        const q = o.pet;
        if (q) {
          const was = { x: q.x, z: q.z };
          if (q.ridden) {
            // under its rider (they are drawn in the saddle)
            q.x = o.x; q.z = o.z; q.h = o.heading;
            q.y += ((q.to?.y ?? o.y) - q.y) * k;
          } else if (q.to) {
            q.x += (q.to.x - q.x) * k; q.y += (q.to.y - q.y) * k; q.z += (q.to.z - q.z) * k;
            q.h = turn(q.h, q.to.h, k);
          }
          q.air += ((q.to?.air || 0) - q.air) * k;
          if (q.hatch && q.to?.s) q.root.scale.setScalar(q.to.s);
          else if (q.hatch) q.root.scale.setScalar(q.base);
          q.root.position.set(q.x, q.y, q.z);
          q.root.rotation.y = q.h;
          const v = Math.hypot(q.x - was.x, q.z - was.z) / Math.max(dt, 1e-3);
          animateBeast(q.root, t, { air: q.ridden ? (o.pose === 'fly' ? 6 : 0) : q.air, speed: q.air > 0.8 ? 0 : v });
        }
      }
    },
    clear() { for (const id of [...seen.keys()]) drop(id); },
    count: () => seen.size,
    list: () => [...seen.values()].map((o) => ({ name: o.name, x: o.x, z: o.z })),
  };
}

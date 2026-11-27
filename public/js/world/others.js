// Other players close by: drawn with their own body, colours and gear, walking smoothly between
// the spots their games report (see data/presence.mjs), with their username above their head.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { wearGear } from '../characters/gear.js';
import { ITEMS } from '../data/items.mjs';
import { bodySig, GONE_MS } from '../data/presence.mjs';

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

export function createOthers(scene) {
  const seen = new Map(); // account id -> { body, sig, name, x, y, z, heading, to: {...}, speed, pose }

  function drop(id) {
    const o = seen.get(id);
    if (!o) return;
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
        const sig = bodySig(p.body) + p.name + (p.medal ? '#1' : '');
        if (o && o.sig !== sig) { drop(p.id); o = null; }
        if (!o) {
          let body;
          try { body = makeBody(p.body, p.medal ? `🥇 ${p.name}` : p.name); } catch (e) { console.warn('could not draw player', p.name, e); continue; } // a race this game doesn't know yet
          scene.add(body);
          o = { body, sig, name: p.name, x: p.x, y: p.y, z: p.z, heading: p.heading };
          seen.set(p.id, o);
        }
        // a big jump (a portal, a fast mount): there at once rather than sliding across the land
        if (Math.hypot(p.x - o.x, p.z - o.z) > 30) { o.x = p.x; o.y = p.y; o.z = p.z; }
        o.to = { x: p.x, y: p.y, z: p.z, heading: p.heading };
        o.speed = p.speed; o.pose = p.pose; o.heard = Date.now();
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
        animateCharacter(o.body, t, lying || o.pose === 'sit' || o.pose === 'ride' ? 0 : o.speed / WALK * 1.6);
        // a blow (seen in a Colosseum fight): the weapon arm comes down from over the shoulder
        if (o.pose === 'swing') { const arm = o.body.userData.rig?.arms?.[0]; if (arm) arm.shoulder.rotation.x = -2.4 + ((t * 5) % 1) * 2.6; }
      }
    },
    clear() { for (const id of [...seen.keys()]) drop(id); },
    // one player by their account id: where they stand now (for a duel in the Colosseum)
    get(id) { const o = seen.get(id); return o ? { x: o.x, y: o.y, z: o.z, height: o.body.userData.height || 1.8, name: o.name } : null; },
    count: () => seen.size,
    list: () => [...seen.values()].map((o) => ({ name: o.name, x: o.x, z: o.z })),
  };
}

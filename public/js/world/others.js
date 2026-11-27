// Other players close by: drawn with their own body, colours and gear, walking smoothly between
// the spots their games report (see data/presence.mjs), with their username above their head.
// Their tamed dragon or wyvern (ridden, or at their side) and their hatchling show too.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { poseSwim, endSwim } from '../characters/moves.js';
import { wearGear } from '../characters/gear.js';
import { ITEMS } from '../data/items.mjs';
import { bodySig, GONE_MS } from '../data/presence.mjs';
import { BEASTS } from '../data/beasts.mjs';
import { buildBeast, animateBeast } from './beasts.js';

// a player's dragon, wyvern or hatchling ('h:<kind>'), drawn like the real thing
function makePet(k) {
  const kind = k.replace(/^h:/, ''), def = BEASTS[kind];
  if (!def || def.king || def.shape === 'spirit') return null;
  const root = buildBeast(def);
  const hatch = k.startsWith('h:');
  return { k, root, hatch, base: hatch ? (kind.endsWith('dragon') ? 2.2 : 1.5) / def.len : 1 };
}
const turnTo = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

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

// the shortest way round from heading a to heading b, as a signed angle
const angleTo = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// Each player is drawn a moment in the past (DELAY), between the two updates either side of that
// moment, so they move smoothly even though updates come in steps. With live updates (10 a second)
// that moment is a tenth of a second ago; with only the slower server checks it has to be longer.
const DELAY_LIVE = 130, DELAY_SLOW = 1300; // milliseconds
const LIVE_FRESH = 1500; // live updates this recent mean the slower server spots are not needed
const KEEP = 24; // updates kept per player
const EXTRAPOLATE = 250; // past the newest update, carry on along their path for at most this long

// hooks.pose(o, act): bends their body for an attack or spell they did (world.js knows the moves)
export function createOthers(scene, hooks = {}) {
  // account id -> { body, sig, name, snaps: [{ t, x, y, z, h }], speed, pose, heard, live }
  const seen = new Map();
  const nowMs = () => performance.now();

  function dropPet(o) { if (o.pet) { scene.remove(o.pet.root); o.pet = null; } }
  function drop(id) {
    const o = seen.get(id);
    if (!o) return;
    dropPet(o);
    scene.remove(o.body);
    o.body.traverse((m) => { if (m.userData.nameTag) { m.material.map.dispose(); m.material.dispose(); } });
    seen.delete(id);
  }
  function addSnap(o, x, y, z, h, t = nowMs()) {
    const last = o.snaps[o.snaps.length - 1];
    // a big jump (a portal, a fast mount): there at once rather than sliding across the land
    if (last && Math.hypot(x - last.x, z - last.z) > 30) o.snaps.length = 0;
    o.snaps.push({ t, x, y, z, h });
    if (o.snaps.length > KEEP) o.snaps.shift();
  }

  return {
    // the latest list from the server: who is near, their body and name (and their spot, when no
    // live updates are coming from them)
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
          o = { body, sig, name: p.name, snaps: [], speed: 0, pose: '', live: 0 };
          seen.set(p.id, o);
        }
        o.heard = Date.now();
        if (nowMs() - o.live > LIVE_FRESH) { addSnap(o, p.x, p.y, p.z, p.heading); o.speed = p.speed; o.pose = p.pose; }
        // their pet
        const pt = p.pet;
        if (o.pet && o.pet.k !== pt?.k) dropPet(o);
        if (pt && !o.pet) {
          try { o.pet = makePet(pt.k); } catch (e) { console.warn('could not draw pet', pt.k, e); }
          if (o.pet) { scene.add(o.pet.root); Object.assign(o.pet, { x: pt.x, y: pt.y, z: pt.z, h: pt.h, air: pt.air || 0 }); }
        }
        if (o.pet) {
          if (Math.hypot(pt.x - o.pet.x, pt.z - o.pet.z) > 40) Object.assign(o.pet, { x: pt.x, y: pt.y, z: pt.z });
          o.pet.to = pt;
        }
      }
      for (const id of [...seen.keys()]) if (!now.has(id)) drop(id);
    },
    // a live update from a player close by (see live.js); players the server hasn't told us about are ignored
    move(m) {
      const o = seen.get(m.i);
      if (!o) return;
      const t = nowMs();
      o.live = t; o.heard = Date.now();
      addSnap(o, m.x, m.y, m.z, m.h, t);
      o.speed = m.s; o.pose = m.p || '';
    },
    // every frame: where each one was a moment ago, and their legs moving
    tick(dt, t) {
      // nothing new about them for a while (your connection dropped): not left standing there frozen
      const stale = Date.now() - GONE_MS * 1.5;
      for (const [id, o] of seen) if (o.heard < stale) drop(id);
      const now = nowMs();
      for (const o of seen.values()) {
        const s = o.snaps;
        if (!s.length) continue;
        const at = now - (now - o.live < LIVE_FRESH ? DELAY_LIVE : DELAY_SLOW);
        let x, y, z, h;
        if (at <= s[0].t) ({ x, y, z, h } = s[0]);
        else {
          let i = s.length - 1;
          while (i > 0 && s[i - 1].t > at) i--;
          const b = s[i], a = s[i - 1] || b;
          if (at <= b.t && a !== b) {
            const k = (at - a.t) / (b.t - a.t || 1);
            x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k; z = a.z + (b.z - a.z) * k; h = a.h + angleTo(a.h, b.h) * k;
          } else {
            // past the newest update: keep going the way they were for a moment
            const last = s[s.length - 1], prev = s[s.length - 2];
            const ahead = Math.min(at - last.t, EXTRAPOLATE);
            const span = prev ? last.t - prev.t : 0;
            const v = prev && span > 40 && span < 600 ? ahead / span : 0; // (two updates that came in together say nothing about speed)
            x = last.x + (prev ? (last.x - prev.x) * v : 0); y = last.y; z = last.z + (prev ? (last.z - prev.z) * v : 0); h = last.h;
          }
        }
        o.body.position.set(x, y, z);
        o.body.rotation.y = h;
        const lying = o.pose === 'lie';
        o.body.rotation.z = lying ? Math.PI / 2 : 0;
        animateCharacter(o.body, t, lying || o.pose === 'sit' || o.pose === 'ride' || o.pose === 'fly' ? 0 : o.speed / WALK * 1.6);
        // swimming: the same front crawl or treading water as your own body
        if (o.pose === 'swim') { poseSwim(o.body, x, y, z, h, t, o.speed / (WALK * 0.45)); o.swam = true; }
        else if (o.swam) { o.swam = false; endSwim(o.body); }
        // a blow (seen in a Colosseum fight): the weapon arm comes down from over the shoulder
        if (o.pose === 'swing') { const arm = o.body.userData.rig?.arms?.[0]; if (arm) arm.shoulder.rotation.x = -2.4 + ((t * 5) % 1) * 2.6; }
        // a swing or spell they did: their arms and body act it out over its own time
        if (o.act) {
          o.act.t += dt;
          try { hooks.pose?.(o, o.act); } catch { o.act = null; }
          if (o.act && o.act.t >= o.act.dur) o.act = null;
        }
        const q = o.pet;
        if (q) {
          const k = Math.min(1, dt * 3), was = { x: q.x, z: q.z };
          if (o.pose === 'ride' || o.pose === 'fly') {
            // under its rider (they are drawn in the saddle)
            q.x = x; q.z = z; q.h = h;
            q.y += ((q.to?.y ?? y) - q.y) * k;
          } else if (q.to) {
            q.x += (q.to.x - q.x) * k; q.y += (q.to.y - q.y) * k; q.z += (q.to.z - q.z) * k;
            q.h = turnTo(q.h, q.to.h, k);
          }
          q.air += ((q.to?.air || 0) - q.air) * k;
          if (q.hatch) q.root.scale.setScalar(q.to?.s || q.base);
          q.root.position.set(q.x, q.y, q.z);
          q.root.rotation.y = q.h;
          const v = Math.hypot(q.x - was.x, q.z - was.z) / Math.max(dt, 1e-3);
          animateBeast(q.root, t, { air: o.pose === 'fly' ? 6 : o.pose === 'ride' ? 0 : q.air, speed: q.air > 0.8 ? 0 : v });
        }
      }
    },
    // they attacked or cast: show the move on their body (a newer one replaces it)
    act(id, a) { const o = seen.get(id); if (o) o.act = { t: 0, dur: 0.6, ...a }; },
    entry: (id) => seen.get(id), // (their whole record: body, pose, act)
    // where the players standing within r metres of (x, z) are, to bump into (not ones lying down or riding)
    near(x, z, r) {
      const out = [];
      for (const o of seen.values()) {
        const b = o.body.position;
        if (o.pose === 'lie' || o.pose === 'ride' || o.pose === 'fly' || !o.snaps.length) continue;
        if (Math.abs(b.x - x) < r && Math.abs(b.z - z) < r) out.push(b);
      }
      return out;
    },
    // where every player close by is (monsters may go for them too: see creatures.js)
    spots: () => [...seen.values()].filter((o) => o.snaps.length).map((o) => ({ x: o.body.position.x, z: o.body.position.z, dead: o.pose === 'lie' })),
    clear() { for (const id of [...seen.keys()]) drop(id); },
    // one player by their account id: where they stand now (for a duel in the Colosseum)
    get(id) { const o = seen.get(id); return o ? { x: o.body.position.x, y: o.body.position.y, z: o.body.position.z, height: o.body.userData.height || 1.8, name: o.name } : null; },
    count: () => seen.size,
    has: (id) => seen.has(id),
    list: () => [...seen.values()].map((o) => ({ name: o.name, x: o.body.position.x, z: o.body.position.z, live: nowMs() - o.live < LIVE_FRESH, snaps: o.snaps.length, act: o.act ? o.act.kind || o.act.move?.name : '' })),
  };
}

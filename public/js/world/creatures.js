// Wild monsters that roam the land around you. Each region has its own kinds and levels.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { sample, toWorld, PLACES } from '../data/world-layout.mjs';

// [name, body to build, level range, aggressive?, speed m/s, drops [item, chance, min, max]]
export const KINDS = {
  slime: { name: 'Wild Slime', body: { race: 'slime', form: 'monster', look: { skin: '#6fb8e8' }, size: 0.6 }, levels: [1, 3], aggressive: false, speed: 1.2, drops: [['slime_gel', 0.8, 1, 2]] },
  // the goblin line, one kind per evolution, each stronger and found deeper in goblin land
  goblin: { name: 'Wild Goblin', body: { race: 'goblin', form: 'monster', stage: 0 }, levels: [1, 8], aggressive: true, speed: 2.4, pack: [1, 3], drops: [['goblin_ear', 0.6, 1, 1], ['bread', 0.15, 1, 1]] },
  hobgoblin: { name: 'Hobgoblin', body: { race: 'goblin', form: 'monster', stage: 1 }, levels: [8, 18], aggressive: true, speed: 2.8, pack: [2, 4], drops: [['goblin_ear', 0.8, 1, 2], ['herb', 0.2, 1, 1], ['rusty_sword', 0.05, 1, 1]] },
  chieftain: { name: 'Goblin Chieftain', body: { race: 'goblin', form: 'monster', stage: 2 }, levels: [18, 35], aggressive: true, speed: 3, pack: [1, 3], drops: [['goblin_ear', 1, 2, 3], ['potion', 0.2, 1, 1], ['hand_axe', 0.06, 1, 1], ['iron_dagger', 0.05, 1, 1]] },
  goblinlord: { name: 'Goblin Lord', body: { race: 'goblin', form: 'monster', stage: 3 }, levels: [35, 60], aggressive: true, speed: 3.2, pack: [1, 2], drops: [['goblin_ear', 1, 3, 4], ['potion', 0.35, 1, 2], ['iron_sword', 0.06, 1, 1], ['chainmail', 0.03, 1, 1]] },
  ogrelord: { name: 'Ogre Lord', body: { race: 'goblin', form: 'monster', stage: 4 }, levels: [60, 100], aggressive: true, speed: 3, pack: [1, 1], drops: [['goblin_ear', 1, 4, 6], ['big_potion', 0.3, 1, 1], ['war_axe', 0.06, 1, 1], ['iron_mace', 0.08, 1, 1]] },
  emperor: { name: 'Goblin Emperor', body: { race: 'goblin', form: 'monster', stage: 5 }, levels: [100, 150], aggressive: true, speed: 3.6, pack: [1, 1], drops: [['big_potion', 1, 1, 2], ['knight_blade', 0.1, 1, 1], ['steel_plate', 0.08, 1, 1]] },
  lizard: { name: 'Marsh Lizard', body: { race: 'lizardman', form: 'monster' }, levels: [6, 11], aggressive: true, speed: 2.6, drops: [['lizard_scale', 0.7, 1, 2]] },
  serpent: { name: 'Swamp Serpent', body: { race: 'naga', form: 'monster', size: 0.6 }, levels: [10, 15], aggressive: true, speed: 2.2, drops: [['serpent_fang', 0.6, 1, 1]] },
  wisp: { name: 'Fae Wisp', body: { race: 'fairy', form: 'monster', size: 1.6 }, levels: [4, 8], aggressive: false, speed: 2.5, drops: [['fae_dust', 0.7, 1, 2]] },
  drake: { name: 'Young Drake', body: { race: 'dragonewt', form: 'monster', size: 0.7 }, levels: [20, 30], aggressive: true, speed: 3.2, drops: [['drake_horn', 0.4, 1, 1], ['potion', 0.2, 1, 1]] },
  frostslime: { name: 'Frost Slime', body: { race: 'slime', form: 'monster', look: { skin: '#dff3ff' }, size: 0.9 }, levels: [14, 20], aggressive: true, speed: 1.5, drops: [['frost_core', 0.5, 1, 1], ['slime_gel', 0.6, 1, 2]] },
  sandlizard: { name: 'Sand Lizard', body: { race: 'lizardman', form: 'monster', look: { skin: '#c9a060' } }, levels: [12, 18], aggressive: true, speed: 3, drops: [['lizard_scale', 0.7, 1, 2], ['cactus_flesh', 0.3, 1, 1]] },
};
export const BY_REGION = {
  heart: ['slime', 'slime', 'goblin'], warrens: ['goblin', 'hobgoblin', 'hobgoblin', 'slime'], peaks: ['drake'],
  fae: ['wisp', 'wisp', 'slime'], mire: ['lizard', 'lizard', 'serpent'], frost: ['frostslime'], sun: ['sandlizard'],
};
export const GOBLIN_LINE = ['goblin', 'hobgoblin', 'chieftain', 'goblinlord', 'ogrelord', 'emperor'];

// Goblin land: the closer to the Goblin Warrens, the further evolved the goblins.
// The Ogre Lords keep to the Gloomhollow cliffs in the south of the Ashen Wastes.
const WARRENS = (() => { const p = PLACES.find((q) => q.id === 'warrens'); return toWorld(p.px, p.py); })();
const GLOOM_Z = toWorld(0, 560).z;
export function kindsAt(x, z, region) {
  const d = Math.hypot(x - WARRENS.x, z - WARRENS.z);
  if (region === 'warrens') {
    if (d < 1500) return ['emperor', 'goblinlord', 'goblinlord', 'chieftain'];
    if (d < 5000) return ['goblinlord', 'chieftain', 'chieftain', 'hobgoblin'];
    if (z > GLOOM_Z) return ['ogrelord', 'chieftain', 'hobgoblin', 'slime'];
    if (d < 12000) return ['chieftain', 'hobgoblin', 'hobgoblin', 'goblin'];
    return BY_REGION.warrens;
  }
  // the west of the Heartland, towards the Wastes, has hobgoblin raiders
  if (region === 'heart' && x < toWorld(640, 0).x) return ['slime', 'goblin', 'goblin', 'hobgoblin'];
  return BY_REGION[region];
}

const MAX_NEAR = 8;           // monsters around you at once
const SPAWN_MIN = 45, SPAWN_MAX = 110, DESPAWN = 190;
const NOTICE = 30;            // aggressive monsters notice you this far away by day (night: further)
const STALK = 55;             // ...and creep towards you from this far
const AMBUSH_EVERY = [70, 140]; // seconds between ambush attempts while you travel through goblin land

const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

function plate(name, level) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  sprite.scale.set(1.6, 0.4, 1);
  const draw = (hpFrac) => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 64);
    g.font = 'bold 22px Cinzel, Georgia, serif';
    g.textAlign = 'center';
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.8)';
    const label = `${name}  Lv ${level}`;
    g.strokeText(label, 128, 24);
    g.fillStyle = '#f5e6c0'; g.fillText(label, 128, 24);
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(28, 38, 200, 14);
    g.fillStyle = hpFrac > 0.5 ? '#c8382a' : '#e0662a'; g.fillRect(30, 40, 196 * Math.max(0, hpFrac), 10);
    tex.needsUpdate = true;
  };
  draw(1);
  return { sprite, draw };
}

export function createCreatures(scene, { getPlayer, onHitPlayer, isInsideCave, isNight = () => false, onAmbush }) {
  const list = [];
  const tmp = {};
  let spawnTimer = 0;

  // Monsters turn up close to your own level (bosses are the exception)
  function levelFor(kind, playerLevel) {
    return Math.max(1, playerLevel + Math.round(rand(-2, 2)));
  }

  // The kind to spawn here: whatever lives in this part of the land
  function kindFor(s, x, z) {
    const kinds = kindsAt(x, z, s.region);
    return kinds ? { id: pickOne(kinds) } : null;
  }

  function make(kindId, level, x, y, z, extra = {}) {
    const kind = KINDS[kindId];
    const body = buildCharacter({ race: kind.body.race, form: kind.body.form, stage: kind.body.stage || 0, look: { ...(kind.body.look || {}), size: kind.body.size || 1 } });
    body.position.set(x, y, z);
    const h = body.userData.height;
    const tag = plate(kind.name, level);
    tag.sprite.position.set(x, y + h + 0.5, z);
    scene.add(body, tag.sprite);
    // a normal monster has less HP than a player of its level; a boss has far more
    const maxHp = Math.round((10 + level * 7) * (extra.boss ? 6 : 1));
    const m = {
      kind, kindId, level, body, tag, x, z, y, heading: Math.random() * 6.28, hp: maxHp, maxHp,
      atk: 4 + level * 3, def: 1 + level, speed: kind.speed, radius: Math.max(0.4, h * 0.3), height: h,
      state: 'wander', timer: 0, attackCd: 0, angry: kind.aggressive, hurt: 0, dead: 0, ...extra,
    };
    list.push(m);
    return m;
  }

  // A place on dry land about `d` metres from (px, pz) in direction `a` (or a random one)
  function spot(px, pz, d, a = Math.random() * Math.PI * 2) {
    const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
    const s = sample(x, z, tmp);
    if (s.h < s.water + 0.4) return null;
    return { x, z, y: s.h, region: s.region, s: { ...s } };
  }

  function spawn(p) {
    for (let tries = 0; tries < 6; tries++) {
      const at = spot(p.x, p.z, SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN));
      if (!at) continue;
      const pick = kindFor(at.s, at.x, at.z);
      if (!pick) continue;
      const kind = KINDS[pick.id];
      // goblins roam in small packs
      const n = Math.round(rand(...(kind.pack || [1, 1])));
      for (let i = 0; i < n; i++) {
        const q = i ? spot(at.x, at.z, rand(2, 5)) : at;
        if (!q) continue;
        make(pick.id, levelFor(kind, p.level), q.x, q.y, q.z);
      }
      return;
    }
  }

  // An ambush: a pack crouches in hiding on the way ahead of you and springs out when you come close
  let ambushTimer = rand(...AMBUSH_EVERY);
  let packs = 0;
  function ambush(p) {
    const ahead = Math.atan2(Math.cos(p.heading), Math.sin(p.heading)); // your heading as an angle on the ground
    const at = spot(p.x, p.z, rand(28, 40), ahead + rand(-0.5, 0.5));
    if (!at) return;
    const kinds = (kindsAt(at.x, at.z, at.region) || []).filter((k) => GOBLIN_LINE.includes(k));
    if (!kinds.length) return;
    // the strongest goblins near you lead, with weaker ones around them
    const lead = kinds.reduce((a, b) => (KINDS[b].levels[0] > KINDS[a].levels[0] ? b : a));
    const pack = ++packs;
    const n = Math.round(rand(3, 5));
    for (let i = 0; i < n; i++) {
      const id = i === 0 ? lead : pickOne(kinds);
      const q = i ? spot(at.x, at.z, rand(3, 7), Math.random() * 6.28) : at;
      if (!q) continue;
      const m = make(id, levelFor(KINDS[id], p.level), q.x, q.y, q.z, { state: 'lurk', pack });
      m.heading = Math.atan2(p.x - q.x, p.z - q.z);
      m.tag.sprite.visible = false;
      m.body.scale.y = 0.72; // crouched low in the grass
    }
  }
  // the whole pack charges at once
  function spring(pack) {
    let n = 0;
    for (const m of list) {
      if (m.pack !== pack || m.state !== 'lurk') continue;
      m.state = 'chase'; m.hunting = true; m.angry = true;
      m.tag.sprite.visible = true;
      m.body.scale.y = 1;
      n++;
    }
    if (n) onAmbush?.(n);
  }

  function remove(m) {
    scene.remove(m.body, m.tag.sprite);
    m.tag.sprite.material.map.dispose();
    m.tag.sprite.material.dispose();
    list.splice(list.indexOf(m), 1);
  }

  function update(dt, t) {
    const p = getPlayer();
    spawnTimer -= dt;
    const alive = list.filter((m) => !m.dead);
    // night brings more monsters, and every one of them hunts
    const night = isNight();
    if (spawnTimer <= 0 && alive.length < (night ? MAX_NEAR + 4 : MAX_NEAR) && !p.dead) {
      spawnTimer = night ? 1 : 1.5;
      spawn(p);
    }
    // ambushes only catch you while you're on the move and away from shelter
    if (p.moving && !p.safe && !p.dead) {
      ambushTimer -= dt;
      if (ambushTimer <= 0) { ambushTimer = rand(...AMBUSH_EVERY); ambush(p); }
    }
    for (const m of [...list]) {
      const dx = p.x - m.x, dz = p.z - m.z;
      const dist = Math.hypot(dx, dz);
      if (dist > DESPAWN) { remove(m); continue; }
      if (m.dead) {
        // sink into the ground and fade away
        m.dead += dt;
        m.body.position.y -= dt * 0.6;
        m.body.scale.multiplyScalar(1 - dt * 0.5);
        m.tag.sprite.visible = false;
        if (m.dead > 2) remove(m);
        continue;
      }
      let speed = 0;
      const hidden = p.safe && !m.hurtBy; // a torch or a campfire keeps you hidden
      // lurkers wait without moving until you walk into them (or hit one)
      if (m.state === 'lurk') {
        if (!p.dead && (dist < 13 || m.hurtBy)) spring(m.pack);
        else { animateCharacter(m.body, t, 0); continue; }
      }
      // by day only angry monsters come for you; at night they all do. They notice you from afar
      // and creep closer before they charge; an ambusher that has sprung tracks you down.
      const sense = m.hunting ? 140 : m.state === 'chase' ? 40 : night ? NOTICE + 10 : NOTICE;
      const chase = (m.angry || night) && !p.dead && !hidden && dist < sense;
      const stalk = !chase && m.angry && !p.dead && !hidden && dist < STALK;
      if (stalk) {
        m.state = 'stalk';
        m.heading = Math.atan2(dx, dz);
        speed = m.speed * 0.5;
      } else if (chase) {
        m.state = 'chase';
        m.heading = Math.atan2(dx, dz);
        const reach = m.radius + p.radius + 0.6;
        if (dist > reach) speed = m.speed * 1.25;
        m.attackCd -= dt;
        if (dist <= reach + 0.3 && m.attackCd <= 0) {
          m.attackCd = 1.6;
          m.lunge = 0.3;
          onHitPlayer(m);
        }
      } else if (!stalk) {
        m.state = 'wander';
        m.timer -= dt;
        if (m.timer <= 0) { m.timer = 2 + Math.random() * 4; m.walking = Math.random() < 0.6; m.heading += (Math.random() - 0.5) * 2.5; }
        if (m.walking) speed = m.speed * 0.45;
      }
      if (speed > 0) {
        const nx = m.x + Math.sin(m.heading) * speed * dt;
        const nz = m.z + Math.cos(m.heading) * speed * dt;
        const s = sample(nx, nz, tmp);
        if (s.h > s.water + 0.2 && !(isInsideCave?.(nx, nz) && !isInsideCave?.(m.x, m.z))) { m.x = nx; m.z = nz; m.y = s.h; } else m.heading += Math.PI * 0.7;
      }
      m.hurt = Math.max(0, m.hurt - dt);
      m.lunge = Math.max(0, (m.lunge || 0) - dt);
      const lunge = m.lunge > 0 ? Math.sin((m.lunge / 0.3) * Math.PI) * 0.4 : 0;
      m.body.position.set(m.x + Math.sin(m.heading) * lunge, m.y + (m.hurt > 0 ? Math.sin(m.hurt * 30) * 0.05 : 0), m.z + Math.cos(m.heading) * lunge);
      m.body.rotation.y = m.heading;
      animateCharacter(m.body, t, speed / 1.6);
      m.tag.sprite.position.set(m.x, m.y + m.height + 0.45, m.z);
    }
  }

  // The living monster in front of (x, z) facing `heading`, within `reach` metres
  function target(x, z, heading, reach) {
    let best = null, bestD = Infinity;
    for (const m of list) {
      if (m.dead) continue;
      const dx = m.x - x, dz = m.z - z;
      const d = Math.hypot(dx, dz) - m.radius;
      if (d > reach) continue;
      let ang = Math.atan2(dx, dz) - heading;
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(ang) > 1.0 && d > 0.6) continue;
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  // Hit a monster. Returns its drops and rewards if it was defeated.
  function hit(m, dmg) {
    m.hp = Math.max(0, m.hp - dmg);
    m.hurt = 0.25;
    m.angry = true;
    m.hurtBy = true; // it fights back even near a fire
    if (m.state === 'lurk') spring(m.pack);
    m.tag.draw(m.hp / m.maxHp);
    if (m.hp > 0) return null;
    m.dead = 0.001;
    const drops = [];
    for (const [id, chance, min, max] of m.kind.drops) {
      if (Math.random() < chance) drops.push([id, min + Math.floor(Math.random() * (max - min + 1))]);
    }
    // a goblin is a small fraction of a level; tougher monsters are worth far more
    return { exp: Math.round(1 + 0.6 * m.level ** 1.35), coins: 2 + m.level * 2 + Math.floor(Math.random() * (m.level + 2)), drops, name: m.kind.name, kind: m.kindId };
  }

  return {
    update, target, hit,
    calm() { for (const m of list) { m.angry = false; m.state = 'wander'; m.timer = 4; } },
    clear() { for (const m of [...list]) remove(m); },
    get list() { return list; },
  };
}

// Wild monsters that roam the land around you. Each region has its own kinds and levels.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { sample } from '../data/world-layout.mjs';

// [name, body to build, level range, aggressive?, speed m/s, drops [item, chance, min, max]]
export const KINDS = {
  slime: { name: 'Wild Slime', body: { race: 'slime', form: 'monster', look: { skin: '#6fb8e8' }, size: 0.6 }, levels: [1, 3], aggressive: false, speed: 1.2, drops: [['slime_gel', 0.8, 1, 2]] },
  goblin: { name: 'Wild Goblin', body: { race: 'goblin', form: 'monster', stage: 0 }, levels: [2, 5], aggressive: true, speed: 2.4, drops: [['goblin_ear', 0.6, 1, 1], ['bread', 0.15, 1, 1]] },
  hobgoblin: { name: 'Hobgoblin', body: { race: 'goblin', form: 'monster', stage: 1 }, levels: [8, 14], aggressive: true, speed: 2.8, drops: [['goblin_ear', 0.8, 1, 2], ['herb', 0.2, 1, 1], ['rusty_sword', 0.05, 1, 1]] },
  lizard: { name: 'Marsh Lizard', body: { race: 'lizardman', form: 'monster' }, levels: [6, 11], aggressive: true, speed: 2.6, drops: [['lizard_scale', 0.7, 1, 2]] },
  serpent: { name: 'Swamp Serpent', body: { race: 'naga', form: 'monster', size: 0.6 }, levels: [10, 15], aggressive: true, speed: 2.2, drops: [['serpent_fang', 0.6, 1, 1]] },
  wisp: { name: 'Fae Wisp', body: { race: 'fairy', form: 'monster', size: 1.6 }, levels: [4, 8], aggressive: false, speed: 2.5, drops: [['fae_dust', 0.7, 1, 2]] },
  drake: { name: 'Young Drake', body: { race: 'dragonewt', form: 'monster', size: 0.7 }, levels: [20, 30], aggressive: true, speed: 3.2, drops: [['drake_horn', 0.4, 1, 1], ['potion', 0.2, 1, 1]] },
  frostslime: { name: 'Frost Slime', body: { race: 'slime', form: 'monster', look: { skin: '#dff3ff' }, size: 0.9 }, levels: [14, 20], aggressive: true, speed: 1.5, drops: [['frost_core', 0.5, 1, 1], ['slime_gel', 0.6, 1, 2]] },
  sandlizard: { name: 'Sand Lizard', body: { race: 'lizardman', form: 'monster', look: { skin: '#c9a060' } }, levels: [12, 18], aggressive: true, speed: 3, drops: [['lizard_scale', 0.7, 1, 2], ['cactus_flesh', 0.3, 1, 1]] },
};
export const BY_REGION = {
  heart: ['slime', 'slime', 'goblin'], warrens: ['goblin', 'goblin', 'hobgoblin', 'slime'], peaks: ['drake'],
  fae: ['wisp', 'wisp', 'slime'], mire: ['lizard', 'lizard', 'serpent'], frost: ['frostslime'], sun: ['sandlizard'],
};

const MAX_NEAR = 7;           // monsters around you at once
const SPAWN_MIN = 45, SPAWN_MAX = 110, DESPAWN = 190;

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

export function createCreatures(scene, { getPlayer, onHitPlayer, isInsideCave }) {
  const list = [];
  const tmp = {};
  let spawnTimer = 0;

  function spawn(px, pz) {
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      const s = sample(x, z, tmp);
      if (s.h < s.water + 0.4 || !BY_REGION[s.region]) continue;
      const kinds = BY_REGION[s.region];
      const kindId = kinds[Math.floor(Math.random() * kinds.length)];
      const kind = KINDS[kindId];
      const level = kind.levels[0] + Math.floor(Math.random() * (kind.levels[1] - kind.levels[0] + 1));
      const body = buildCharacter({ race: kind.body.race, form: kind.body.form, stage: kind.body.stage || 0, look: { ...(kind.body.look || {}), size: kind.body.size || 1 } });
      body.position.set(x, s.h, z);
      const h = body.userData.height;
      const tag = plate(kind.name, level);
      tag.sprite.position.set(x, s.h + h + 0.5, z);
      scene.add(body, tag.sprite);
      const maxHp = 18 + level * 14;
      list.push({
        kind, kindId, level, body, tag, x, z, y: s.h, heading: Math.random() * 6.28, hp: maxHp, maxHp,
        atk: 4 + level * 3, def: 1 + level, speed: kind.speed, radius: Math.max(0.4, h * 0.3), height: h,
        state: 'wander', timer: 0, attackCd: 0, angry: kind.aggressive, hurt: 0, dead: 0,
      });
      return;
    }
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
    if (spawnTimer <= 0 && alive.length < MAX_NEAR && !p.dead) {
      spawnTimer = 1.5;
      spawn(p.x, p.z);
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
      const chase = m.angry && !p.dead && dist < (m.state === 'chase' ? 30 : 16);
      if (chase) {
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
      } else {
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

// Wild monsters that roam the land around you. Each region has its own kinds and levels.
import * as THREE from 'three';
import { buildCharacter, animateCharacter } from '../characters/model.js';
import { joinCrowd, bakeCharacter } from '../characters/crowd.js';
import { addOrgans, maim, startDeath, tickDeath, clearDeath } from './deaths.js';
import { sample, toWorld, PLACES, safeZoneAt } from '../data/world-layout.mjs';
import { EVOLUTIONS, rollKillExp } from '../data/game-data.mjs';
import { wildLevelAt, stageForLevel, wardedAt } from '../data/wilds.mjs';
import { ANIMALS, wildAnimalsAt } from '../data/animals.mjs';
import { buildAnimal, animateAnimal, lieDown } from './animalbody.js';
import { CORPSE_SECS, animalWounds, tickAnimalBlood } from './deaths.js';
import { TAMEABLE, BEAST_TAME } from '../data/mounts.mjs';
import { BEASTS, BEAST_RETURNS, lairsNear } from '../data/beasts.mjs';
import { buildBeast, animateBeast, makeBreath, buildLavaLake, buildStarThrone, makeStarfall, makeNova } from './beasts.js';

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
  // the Colosseum's practice fighter (see world.js practice): no loot, it yields when beaten
  gladiator: { name: 'Gladiator', body: { race: 'beastkin', form: 'humanoid' }, levels: [1, 1], aggressive: true, speed: 3, drops: [] },
  sandlizard: { name: 'Sand Lizard', body: { race: 'lizardman', form: 'monster', look: { skin: '#c9a060' } }, levels: [12, 18], aggressive: true, speed: 3, drops: [['lizard_scale', 0.7, 1, 2], ['cactus_flesh', 0.3, 1, 1]] },
};
// The Monster Kings' courts: the King (in humanoid form, crowned), the Overlords and the castle guards.
// They leave you alone unless you strike first.
const ROYAL_RACES = { goblin: {}, slime: { look: { skin: '#6fb8e8' } }, fairy: { size: 1.4 }, lizardman: {}, naga: {}, dragonewt: {} };
for (const [race, b] of Object.entries(ROYAL_RACES)) {
  const loot = [['big_potion', 1, 2, 4], ['moonstone', 0.8, 1, 3], ['dragonite', 0.5, 1, 2]];
  KINDS[`king_${race}`] = { name: 'Monster King', body: { race, form: 'humanoid', stage: 5, ...b }, levels: [1000, 1000], aggressive: false, speed: 3.4, royal: true, drops: [...loot, ['knight_blade', 0.6, 1, 1], ['steel_plate', 0.5, 1, 1]] };
  KINDS[`overlord_${race}`] = { name: 'Overlord', body: { race, form: 'humanoid', stage: 4, ...b }, levels: [990, 999], aggressive: false, speed: 3.2, royal: true, drops: loot };
  KINDS[`guard_${race}`] = { name: 'Royal Guard', body: { race, form: 'monster', stage: 3, ...b }, levels: [400, 600], aggressive: false, speed: 3, royal: true, drops: [['big_potion', 0.6, 1, 2], ['gold_ore', 0.5, 1, 3]] };
}
export const BY_REGION = {
  heart: ['slime', 'slime', 'goblin'], warrens: ['goblin', 'hobgoblin', 'hobgoblin', 'slime'], peaks: ['drake'],
  fae: ['wisp', 'wisp', 'slime'], mire: ['lizard', 'lizard', 'serpent'], frost: ['frostslime'], sun: ['sandlizard'],
};
// The animals (data/animals.mjs) live among the monsters as kinds named `a_<id>`, so every blow,
// skill and spell works on them; they walk, flee, graze and fall in their own way below.
for (const [id, a] of Object.entries(ANIMALS)) {
  KINDS[`a_${id}`] = { name: a.name, animal: a, animalId: id, levels: [1, 1], aggressive: a.temper === 'fierce', speed: a.speed, drops: [] };
}
// The great beasts (data/beasts.mjs) live at their lairs as kinds named `b_<id>`
for (const [id, b] of Object.entries(BEASTS)) {
  KINDS[`b_${id}`] = { name: b.name, beast: b, beastId: id, levels: b.levels, aggressive: !b.peaceful, speed: b.fly, drops: b.drops };
}
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
const MAX_ANIMALS = 12;       // wild animals around you at once
const SHY_RANGE = 10, SHY_RUN = 20; // shy animals bolt when you come this close (further when you run)
const SPAWN_MIN = 45, SPAWN_MAX = 110, DESPAWN = 190;
const NOTICE = 30;            // aggressive monsters notice you this far away by day (night: further)
const STALK = 55;             // ...and creep towards you from this far
const AMBUSH_EVERY = [70, 140]; // seconds between ambush attempts while you travel through goblin land

const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

function plate(name, level, showLevel = true) {
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
    const label = showLevel ? `${name}  Lv ${level}` : name;
    g.strokeText(label, 128, 24);
    g.fillStyle = '#f5e6c0'; g.fillText(label, 128, 24);
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(28, 38, 200, 14);
    g.fillStyle = hpFrac > 0.5 ? '#c8382a' : '#e0662a'; g.fillRect(30, 40, 196 * Math.max(0, hpFrac), 10);
    tex.needsUpdate = true;
  };
  draw(1);
  return { sprite, draw };
}

// How much a monster's blow takes off you. Defence takes off a share of the hit (never all of it),
// measured against the monster's level, so armour stays useful at every level without making
// strong monsters harmless.
export function monsterHit(atk, level, def) {
  const k = 50 + 5 * level;
  return Math.max(1, Math.round(atk * (0.85 + Math.random() * 0.3) * k / (k + Math.max(0, def))));
}
// EXP for a kill: a small fraction of a level, more for higher levels and for evolved monsters
// (a Hobgoblin is worth more than a goblin of the same level)
export const monsterExp = (level, stage = 0) => rollKillExp(level, stage);

// `groundAt(x, z, fromY)` is where feet rest (the drawn ground, and built floors); monsters walk on it as players do
export function createCreatures(scene, { getPlayer, onHitPlayer, isInsideCave, isNight = () => false, onAmbush, groundAt = null, blockedAt = null, pushOut = null, onCrash = null, onBeast = null, onSnare = null }) {

  // Is something solid (a wall, fence, tree, rock) in the way of `m` stepping to (nx, nz)? Checks
  // its body and its nose, so long animals don't push their heads into walls. Gives back what it hit.
  function wallAhead(m, nx, nz) {
    if (!blockedAt) return null;
    const r = m.radius * 0.8;
    const hit = blockedAt(nx, nz, r, m.y);
    if (hit) return hit;
    const reach = m.kind.animal ? m.kind.animal.len * 0.45 : m.radius * 0.7;
    return blockedAt(nx + Math.sin(m.heading) * reach, nz + Math.cos(m.heading) * reach, Math.max(0.1, r * 0.5), m.y);
  }
  // after moving: slide out of anything it has ended up inside
  const tmpP = { x: 0, z: 0, y: 0 };
  function unstick(m) {
    if (!pushOut) return;
    tmpP.x = m.x; tmpP.z = m.z; tmpP.y = m.y;
    pushOut(tmpP, m.radius * 0.8);
    m.x = tmpP.x; m.z = tmpP.z;
  }  const list = [];
  const tmp = {};
  const feet = (x, z, fromY, h) => (groundAt ? groundAt(x, z, fromY) : h);
  let spawnTimer = 0, animalTimer = 1;
  const animate = (m, t, speed) => (m.kind.animal ? animateAnimal(m.body, t, speed) : animateCharacter(m.body, t, speed / 1.6));

  // A wild monster's level comes from where it is, not from you: weak near towns, villages and
  // settled land, stronger the further into the wilds (see data/wilds.mjs), give or take a tenth
  function levelFor(x, z) {
    const base = wildLevelAt(x, z);
    return Math.max(1, Math.min(499, Math.round(base * rand(0.9, 1.1))));
  }

  // The kind to spawn here: whatever lives in this part of the land
  function kindFor(s, x, z) {
    const kinds = kindsAt(x, z, s.region);
    return kinds ? { id: pickOne(kinds) } : null;
  }

  // Stronger monsters have evolved as far as a player of their level would have: a goblin becomes
  // the goblin of that stage (a Hobgoblin, a Chieftain…), and other monsters take their race's
  // evolved form and name. A few stay one stage behind.
  function evolveFor(kindId, level) {
    const want = Math.max(0, stageForLevel(level) - (Math.random() < 0.3 ? 1 : 0));
    const kind = KINDS[kindId];
    if (kind.royal || kindId.startsWith('king_') || kindId.startsWith('overlord_') || kindId.startsWith('guard_')) return { id: kindId };
    // the goblin of the monster's own stage, so a weak one near a town is a plain goblin
    if (GOBLIN_LINE.includes(kindId)) return { id: GOBLIN_LINE[Math.min(GOBLIN_LINE.length - 1, want)] };
    if (!want) return { id: kindId };
    if (want <= (kind.body.stage || 0)) return { id: kindId };
    const names = EVOLUTIONS[kind.body.race];
    return { id: kindId, stage: want, title: names?.[want] ? `Wild ${names[want]}` : kind.name };
  }

  function make(kindId, level, x, y, z, extra = {}) {
    const kind = KINDS[kindId];
    if (kind.animal) return makeAnimal(kindId, level, x, y, z, extra);
    if (kind.beast) return makeBeast(kindId, level, x, y, z, extra);
    const stage = extra.stage ?? kind.body.stage ?? 0;
    const body = buildCharacter({ race: kind.body.race, form: kind.body.form, stage, look: { ...(kind.body.look || {}), size: kind.body.size || 1 } });
    addOrgans(body.userData.rig); // (inside, for a deep cut to spill)
    joinCrowd(bakeCharacter(body));
    body.position.set(x, y, z);
    const h = body.userData.height;
    const tag = plate(extra.title || kind.name, level);
    tag.sprite.position.set(x, y + h + 0.5, z);
    scene.add(body, tag.sprite);
    // a normal monster has less HP than a player of its level and hits harder as it levels, but still
    // needs 5 or more hits to beat even the frailest unarmoured player of its level (see monsterHit);
    // a boss has far more HP and hits twice as hard
    const maxHp = Math.round((8 + level * 3.5) * (extra.boss ? 6 : 1));
    const atk = Math.round((7 + level * 0.75) * (extra.boss ? 2 : 1));
    const m = {
      kind, kindId, level, stage, body, tag, x, z, y, heading: Math.random() * 6.28, hp: maxHp, maxHp,
      atk, def: 1 + level, speed: kind.speed, radius: Math.max(0.4, h * 0.3), height: h,
      state: 'wander', timer: 0, attackCd: 0, angry: kind.aggressive, hurt: 0, dead: 0, ...extra,
    };
    list.push(m);
    return m;
  }

  // An animal: its own body, and health from its size. Hunters (wolves, bears) are as strong as
  // the monsters of the land they roam; the rest are just animals.
  function makeAnimal(kindId, level, x, y, z, extra = {}) {
    const kind = KINDS[kindId], a = kind.animal;
    const fierce = a.temper === 'fierce';
    const body = buildAnimal(a);
    body.position.set(x, y, z);
    const h = body.userData.height;
    const tag = plate(extra.title || a.name, level, fierce);
    tag.sprite.visible = fierce;
    scene.add(body, tag.sprite);
    const maxHp = Math.round(fierce ? (8 + level * 3.5) * (a.hp / 50) : a.hp);
    const m = {
      kind, kindId, level, stage: 0, body, tag, x, z, y, heading: Math.random() * 6.28, hp: maxHp, maxHp,
      atk: Math.round((7 + level * 0.75) * (a.atk || 1)), def: fierce ? 1 + level : 0, speed: a.speed,
      radius: Math.max(0.12, Math.min(a.len * 0.3, 0.9)), height: h, state: 'wander', timer: 0, attackCd: 0,
      angry: fierce, hurt: 0, dead: 0, fleeT: 0, ...extra,
    };
    list.push(m);
    return m;
  }
  // ---------- the great beasts: dragons, wyverns and the Spirit King (data/beasts.mjs) ----------
  const slain = new Map(); // lair id -> when a new beast comes to it
  let nowT = 0, beastTimer = 0;
  const groundH = (x, z) => { const s = sample(x, z, tmp); return Math.max(s.h, s.water); };
  function makeBeast(kindId, level, x, y, z, extra = {}) {
    const kind = KINDS[kindId], b = kind.beast;
    const body = buildBeast(b);
    const h = body.userData.height;
    const tag = plate(b.name, level);
    scene.add(body, tag.sprite);
    const spirit = b.shape === 'spirit';
    const maxHp = Math.round((8 + level * 3.5) * (b.king ? b.hpMul : b.boss ? 6 : b.hpMul || 1)); // (the King of the Wild Dragons is as strong as the Monster Kings)
    const m = {
      kind, kindId, level, stage: 5, body, tag, x, z, y, heading: Math.random() * 6.28, hp: maxHp, maxHp,
      atk: Math.round((7 + level * 0.75) * (b.boss ? 2 : 1.5)), def: 1 + level, speed: b.fly,
      radius: spirit ? b.height * 0.16 : b.len * 0.16, height: h, state: 'wander', timer: 0, attackCd: 0, angry: false, hurt: 0, dead: 0,
      keep: true, boss: !!b.boss, air: spirit ? 0 : b.cruise, mode: 'circle', modeT: 0, orbit: Math.random() * 6.28, breathCd: 3, ...extra,
    };
    if (spirit) body.visible = false; // (until he rises from the lake)
    body.position.set(x, y + m.air, z);
    list.push(m);
    return m;
  }
  // the lava lakes in the volcanoes' craters (drawn while you are near)
  const lavaLakes = new Map(); // lair id -> lake
  function updateLava(p) {
    for (const [id, g] of lavaLakes) if (Math.hypot(g.position.x - p.x, g.position.z - p.z) > 3000) { scene.remove(g); lavaLakes.delete(id); }
    for (const L of lairsNear(p.x, p.z, 2500)) {
      if (lavaLakes.has(L.id)) continue;
      let g;
      if (L.kind === 'fire_dragon') { g = buildLavaLake(170); g.position.set(L.x, sample(L.x + 170, L.z, tmp).h - 6, L.z); }
      else if (L.kind === 'dragon_king') { g = buildStarThrone(40); g.position.set(L.x, groundH(L.x, L.z), L.z); } // (the Star Throne)
      else continue;
      scene.add(g); lavaLakes.set(L.id, g);
    }
  }
  function spawnBeasts(p) {
    updateLava(p);
    for (const L of lairsNear(p.x, p.z, 700)) {
      if ((slain.get(L.id) || 0) > nowT || list.some((m) => m.lair === L)) continue;
      const kindId = `b_${L.kind}`, b = BEASTS[L.kind];
      const level = Math.round(rand(...b.levels));
      const a = Math.random() * 6.28, r = b.shape === 'spirit' ? 0 : b.circle;
      const x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r;
      const m = make(kindId, level, x, b.shape === 'spirit' ? sample(x, z, tmp).water : groundH(x, z), z, { lair: L, orbit: a });
      m.home = { x: L.x, z: L.z };
    }
  }
  // a breath of fire, frost, lightning or water, from its mouth (or the Spirit King's hand)
  function breathe(m, p, secs) {
    endBreath(m);
    const b = m.kind.beast;
    m.breath = makeBreath(b.breath, b.king ? 30 : b.shape === 'wyvern' ? 13 : b.shape === 'spirit' ? 30 : 19, b.king ? 5 : b.shape === 'spirit' ? 1.2 : 3);
    m.breathT = secs; m.breathHit = 0.4;
    scene.add(m.breath);
  }
  function endBreath(m) {
    if (!m.breath) return;
    scene.remove(m.breath); m.breath.userData.dispose(); m.breath = null; m.breathT = 0;
  }
  const mouthAt = new THREE.Vector3();
  function stepBreath(m, dt, t, p, dist) {
    if (!m.breath) return;
    m.breathT -= dt;
    if (m.breathT <= 0 || m.dead) { endBreath(m); return; }
    m.body.updateMatrixWorld(true);
    m.body.userData.beast.mouth.getWorldPosition(mouthAt);
    m.breath.position.copy(mouthAt);
    m.breath.lookAt(p.x, (p.y ?? m.y) + 1, p.z);
    m.breath.userData.tick(t);
    // it scorches (or freezes) you if you are still in its path
    if (m.breathHit > 0) {
      m.breathHit -= dt;
      const reach = m.kind.beast.king ? 33 : m.kind.beast.shape === 'spirit' ? 32 : m.kind.beast.shape === 'wyvern' ? 15 : 21;
      if (m.breathHit <= 0 && !p.dead && Math.hypot(p.x - mouthAt.x, p.z - mouthAt.z) < reach && Math.abs((p.y ?? mouthAt.y) + 1 - mouthAt.y) < reach * 0.7) onHitPlayer(m, m.kind.beast.breath);
    }
  }
  const turnTo = (m, want, rate, dt) => {
    const d = Math.atan2(Math.sin(want - m.heading), Math.cos(want - m.heading));
    m.heading += Math.max(-rate * dt, Math.min(rate * dt, d));
    return d;
  };

  function stepBeast(m, dt, t, p, dx, dz, dist) {
    const b = m.kind.beast;
    if (dist > 1200) { remove(m); return; }
    if (b.shape === 'spirit') { stepSpirit(m, dt, t, p, dx, dz, dist); return; }
    if (m.dead) {
      // it falls from the sky and lies where it lands
      m.dead += dt;
      m.air = Math.max(0, m.air - dt * (6 + m.dead * 14));
      m.y = groundH(m.x, m.z) + m.air;
      m.body.position.set(m.x, m.y, m.z);
      animateBeast(m.body, t, { dead: m.dead });
      if (m.dead > 150) remove(m);
      return;
    }
    const L = m.home;
    const fromLair = Math.hypot(p.x - L.x, p.z - L.z);
    const pAir = p.flying ? Math.max(0, (p.y ?? 0) - groundH(p.x, p.z)) : 0; // (how high you fly)
    // (one whose egg you stole hunts you down whenever it sees you, far from its lair too)
    const grudge = !!(m.lair && p.grudges?.[m.lair.id]);
    const sees = !p.dead && !p.underground && (fromLair < b.range || (grudge && (fromLair < b.range * 3 || dist < b.notice * 4)));
    // (the King of the Wild Dragons never strikes first: he only fights once you have struck him)
    const calmKing = b.king && !m.angry;
    if (calmKing) m.mode = 'circle';
    else if (!sees) { if (m.mode !== 'circle') { m.mode = 'circle'; m.angry = false; m.hover = null; endNova(m); } }
    else if (m.mode === 'circle' && (m.angry || grudge || dist < b.notice || fromLair < b.circle * 0.8)) { m.mode = 'dive'; m.modeT = 0; m.angry = true; onBeast?.(m, grudge ? 'grudge' : 'notice'); } // (close to it, or into the lair it circles)
    m.modeT += dt;
    m.attackCd -= dt; m.breathCd -= dt;
    let tx = p.x, tz = p.z, wantAir = b.cruise, speed = b.fly, rate = 1.4;
    if (calmKing && sees && fromLair < b.notice && !m.hover) {
      // he comes down from the sky to look at you, and hangs in the air a little way off
      const d = Math.max(1, dist);
      m.hover = { x: p.x - (dx / d) * 32, z: p.z - (dz / d) * 32 };
      if (!m.greeted) { m.greeted = true; onBeast?.(m, 'greet'); }
    }
    if (calmKing && (!sees || fromLair > b.notice * 1.5)) m.hover = null;
    if (m.nova) {
      // gathering the Supernova: he holds still in the air while the starlight swells round him
      tx = p.x; tz = p.z; speed = 0; wantAir = 14; rate = 2;
    } else if (calmKing && m.hover) {
      const hd = Math.hypot(m.hover.x - m.x, m.hover.z - m.z);
      if (hd > 5) { tx = m.hover.x; tz = m.hover.z; speed = Math.min(b.fly * 0.6, hd * 0.5 + 2); rate = 1.8; wantAir = hd > 70 ? 30 : 6; }
      else { speed = 0; rate = 1.2; wantAir = 6; } // (facing you)
    } else if (m.mode === 'circle') {
      m.orbit += (dt * b.fly * 0.45) / b.circle;
      tx = L.x + Math.cos(m.orbit) * b.circle; tz = L.z + Math.sin(m.orbit) * b.circle;
      speed = b.fly * 0.45;
    } else if (m.mode === 'dive') {
      // down at you: it breathes from a little way off, then claws and bites from just above
      const close = m.radius + p.radius + 2.5;
      wantAir = (dist > 45 ? Math.min(b.cruise, 14 + dist * 0.35) : dist > 18 ? 9 : 3.5) + pAir; // (up to you, if you are flying too)
      speed = dist > 25 ? b.fly : Math.max(0, Math.min(b.fly * 0.5, dist - close));
      rate = dist < 30 ? 3 : 1.6;
      const facing = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - m.heading), Math.cos(Math.atan2(dx, dz) - m.heading)));
      if (b.breath && dist > (b.king ? 10 : 6) && dist < (b.king ? 28 : b.shape === 'wyvern' ? 13 : 18) && m.breathCd <= 0 && facing < 0.5) { breathe(m, p, 1.6); m.breathCd = 6 + Math.random() * 3; }
      if (dist < close + 1.5 && Math.abs(m.y - (p.y ?? m.y)) < 7 && m.attackCd <= 0 && !p.dead) { m.attackCd = 2; m.lunge = 0.3; onHitPlayer(m); }
      // after a pass or two it may come down and fight you on the ground (not the King, and not if you fly)
      if (m.modeT > 14) { m.mode = !b.king && !p.flying && Math.random() < 0.55 ? 'land' : 'climb'; m.modeT = 0; }
    } else if (m.mode === 'land') {
      // down beside you, wings wide, then onto its feet
      const close = m.radius + p.radius + 4;
      wantAir = dist < 40 ? 0 : 8;
      speed = dist > close ? Math.min(b.fly * 0.5, dist - close + 2) : 0;
      rate = 2.2;
      if (m.air < 0.4) { m.mode = 'ground'; m.modeT = 0; onBeast?.(m, 'land'); }
      if (m.modeT > 12 || p.flying) { m.mode = 'climb'; m.modeT = 0; }
    } else if (m.mode === 'ground') {
      // on its feet: it stalks you, bites and claws, breathes, and sweeps its tail at anyone behind it
      const close = m.radius + p.radius + 1.5;
      wantAir = 0; rate = 2;
      speed = dist > close ? Math.min(b.fly * 0.22, dist - close) : 0;
      const facing = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - m.heading), Math.cos(Math.atan2(dx, dz) - m.heading)));
      m.tailCd = (m.tailCd || 0) - dt;
      if (facing > 2.2 && dist < b.len * 0.65 && m.tailCd <= 0 && !p.dead) { m.tailCd = 3.5; m.swipe = 0.6; onHitPlayer(m, 'tail'); }
      else if (b.breath && dist > 5 && dist < (b.shape === 'wyvern' ? 12 : 16) && m.breathCd <= 0 && facing < 0.5) { breathe(m, p, 1.4); m.breathCd = 6 + Math.random() * 3; }
      else if (dist < close + 1.8 && facing < 0.8 && m.attackCd <= 0 && !p.dead) { m.attackCd = 1.7; m.lunge = 0.3; onHitPlayer(m); }
      if (m.modeT > 16 + Math.random() * 6 || p.flying || dist > 80) { m.mode = 'climb'; m.modeT = 0; } // (back into the sky)
    } else if (m.mode === 'downed') {
      // worn out: it sinks to the ground and lies there panting (now it can be tamed)
      speed = 0; wantAir = 0; rate = 0.3;
      if (m.modeT > 45) { m.mode = 'climb'; m.modeT = 0; m.hp = Math.max(m.hp, Math.round(m.maxHp * 0.3)); onBeast?.(m, 'recover'); }
    } else {
      // up and away for a moment, then round for another pass
      tx = m.x + Math.sin(m.heading) * 50; tz = m.z + Math.cos(m.heading) * 50;
      wantAir = b.cruise * 0.7;
      if (m.modeT > 4) { m.mode = 'dive'; m.modeT = 0; }
    }
    if (b.king && m.angry && sees) kingPowers(m, dt, t, p, dist);
    const onFoot = m.mode === 'ground' || m.mode === 'downed' || (m.mode === 'land' && m.air < 3);
    const turn = turnTo(m, Math.atan2(tx - m.x, tz - m.z), rate, dt);
    m.x += Math.sin(m.heading) * speed * dt; m.z += Math.cos(m.heading) * speed * dt;
    const before = m.air;
    m.air += Math.max(-12 * dt, Math.min(9 * dt, wantAir - m.air));
    m.air = Math.max(onFoot ? 0 : 2.5, m.air);
    m.y = groundH(m.x, m.z) + m.air;
    m.hurt = Math.max(0, m.hurt - dt);
    m.lunge = Math.max(0, (m.lunge || 0) - dt);
    m.swipe = Math.max(0, (m.swipe || 0) - dt);
    const lunge = m.lunge > 0 ? Math.sin((m.lunge / 0.3) * Math.PI) * 1.2 : 0;
    m.body.position.set(m.x + Math.sin(m.heading) * lunge, m.y - lunge * 0.5, m.z + Math.cos(m.heading) * lunge);
    m.body.rotation.y = m.heading;
    animateBeast(m.body, t, { tired: m.mode === 'downed', swipe: m.swipe > 0 ? Math.sin((m.swipe / 0.6) * Math.PI) : 0, glow: m.nova ? Math.min(1, m.nova.k) : 0, air: m.air, speed, open: m.breathT > 0 || m.lunge > 0 || !!m.nova, pitch: Math.max(-0.4, Math.min(0.4, -(m.air - before) / dt * 0.04)), bank: Math.max(-0.5, Math.min(0.5, -turn * 0.6)) });
    stepBreath(m, dt, t, p, dist);
    m.tag.sprite.position.set(m.x, m.y + m.height + 1, m.z);
  }

  // The powers of the stars (the King of the Wild Dragons, once you have struck him):
  //   - Starfall: stars fall round you; a ring of light shows where each will strike
  //   - Supernova (below a third of his health): he gathers the light of the stars, then it bursts
  const falls = [];
  function kingPowers(m, dt, t, p, dist) {
    m.starCd = (m.starCd ?? 5) - dt; m.novaCd = (m.novaCd || 0) - dt;
    if (m.starCd <= 0 && dist < 140 && !m.nova) {
      m.starCd = 9 + Math.random() * 4;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * 6.28, r = i === 0 ? 0 : 5 + Math.random() * 10;
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        const g = makeStarfall(4.5); g.position.set(x, groundH(x, z), z); scene.add(g);
        falls.push({ g, x, z, m, t: -i * 0.25, T: 1.8 });
      }
      onBeast?.(m, 'starfall');
    }
    if (!m.nova && m.novaCd <= 0 && m.hp < m.maxHp * 0.35) {
      m.nova = { k: 0, g: makeNova(45) }; scene.add(m.nova.g);
      endBreath(m);
      onBeast?.(m, 'nova');
    }
    if (m.nova) {
      const was = m.nova.k;
      m.nova.k += dt / (m.nova.k < 1 ? 3.5 : 0.8);
      m.nova.g.position.set(m.x, m.y + m.height * 0.5, m.z);
      m.nova.g.userData.tick(m.nova.k, t);
      if (was < 1 && m.nova.k >= 1 && !p.dead && Math.hypot(p.x - m.x, p.z - m.z) < 45) onHitPlayer(m, 'nova');
      if (m.nova.k >= 2) endNova(m);
    }
  }
  function endNova(m) {
    if (!m.nova) return;
    scene.remove(m.nova.g); m.nova.g.userData.dispose(); m.nova = null; m.novaCd = 35;
  }
  function stepFalls(dt, t, p) {
    for (const f of [...falls]) {
      const was = f.t / f.T;
      f.t += dt;
      const k = f.t / f.T;
      f.g.visible = k > 0;
      if (k > 0) f.g.userData.tick(k, t);
      if (was < 1 && k >= 1 && !p.dead && Math.hypot(p.x - f.x, p.z - f.z) < 4.5) onHitPlayer(f.m, 'star');
      if (k > 1.4) { scene.remove(f.g); f.g.userData.dispose(); falls.splice(falls.indexOf(f), 1); }
    }
  }

  // The Spirit King rests under the lake; he rises when you come near, and only fights you if you
  // strike him first. He never leaves the water.
  function stepSpirit(m, dt, t, p, dx, dz, dist) {
    const b = m.kind.beast;
    const surf = sample(m.x, m.z, tmp).water;
    if (m.dead) {
      m.dead += dt;
      animateBeast(m.body, t, { dead: m.dead });
      m.tag.sprite.visible = false;
      if (m.dead > 6) remove(m);
      return;
    }
    if (!m.risen) {
      m.tag.sprite.visible = false;
      if (dist > 120 || p.dead) return;
      m.risen = true; m.riseT = 0; m.body.visible = true;
      onBeast?.(m, 'rise');
    }
    m.riseT += dt;
    const up = Math.min(1, m.riseT / 4);
    if (up >= 1 && !m.greeted) { m.greeted = true; onBeast?.(m, 'greet'); }
    m.tag.sprite.visible = up >= 1;
    m.attackCd -= dt;
    let speed = 0;
    if (m.angry && !p.dead && dist < b.range) {
      m.heading = Math.atan2(dx, dz);
      // he glides across the water towards you (never onto land), and hurls the lake at you
      if (dist > 14) {
        const nx = m.x + Math.sin(m.heading) * b.fly * dt, nz = m.z + Math.cos(m.heading) * b.fly * dt;
        const s = sample(nx, nz, tmp);
        if (s.h < s.water - 0.6) { m.x = nx; m.z = nz; speed = b.fly; }
      }
      if (dist < 32 && m.attackCd <= 0) { m.attackCd = 3.2; breathe(m, p, 1.1); }
    } else {
      if (m.angry && (p.dead || dist >= b.range)) m.angry = false;
      if (dist < 80) turnTo(m, Math.atan2(dx, dz), 1, dt);
      // drifting back to his resting place
      const hx = m.home.x - m.x, hz = m.home.z - m.z, hd = Math.hypot(hx, hz);
      if (hd > 3) { m.x += (hx / hd) * Math.min(hd, 2) * dt; m.z += (hz / hd) * Math.min(hd, 2) * dt; }
    }
    m.y = surf - (1 - up) * (b.height + 1);
    m.hurt = Math.max(0, m.hurt - dt);
    m.body.position.set(m.x, m.y, m.z);
    m.body.rotation.y = m.heading;
    animateBeast(m.body, t, { open: m.breathT > 0, speed });
    stepBreath(m, dt, t, p, dist);
    m.tag.sprite.position.set(m.x, m.y + m.height + 0.8, m.z);
  }

  // a few metres of open water near (x, z)? (ducks and geese keep to the shore)
  function nearWater(x, z) {
    for (const [dx, dz] of [[25, 0], [-25, 0], [0, 25], [0, -25], [18, 18], [-18, -18]]) { const q = sample(x + dx, z + dz, tmp); if (q.h < q.water) return true; }
    return false;
  }
  function spawnAnimals(p) {
    for (let tries = 0; tries < 6; tries++) {
      const at = spot(p.x, p.z, SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN));
      if (!at) continue;
      const kinds = wildAnimalsAt(at.region, at.s.forest || 0, nearWater(at.x, at.z));
      if (!kinds.length) continue;
      const id = pickOne(kinds), a = ANIMALS[id];
      const level = a.temper === 'fierce' ? levelFor(at.x, at.z) : 1;
      const n = Math.round(rand(...(a.herd || [1, 1])));
      for (let i = 0; i < n; i++) {
        const q = i ? spot(at.x, at.z, rand(2, 6)) : at;
        if (q) make(`a_${id}`, level, q.x, q.y, q.z, a.temper === 'fierce' ? { pack: `w${++packs}` } : {});
      }
      return;
    }
  }

  // A place on dry land about `d` metres from (px, pz) in direction `a` (or a random one)
  function spot(px, pz, d, a = Math.random() * Math.PI * 2) {
    const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
    const s = sample(x, z, tmp);
    if (s.h < s.water + 0.4 || safeZoneAt(x, z) || wardedAt(x, z)) return null; // never in the water, a safe zone or built land
    return { x, z, y: feet(x, z, s.h, s.h), region: s.region, s: { ...s } };
  }

  function spawn(p) {
    for (let tries = 0; tries < 6; tries++) {
      const at = spot(p.x, p.z, SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN));
      if (!at) continue;
      const found = kindFor(at.s, at.x, at.z);
      if (!found) continue;
      const level = levelFor(at.x, at.z);
      const pick = evolveFor(found.id, level);
      const kind = KINDS[pick.id];
      // goblins roam in small packs
      const n = Math.round(rand(...(kind.pack || [1, 1])));
      for (let i = 0; i < n; i++) {
        const q = i ? spot(at.x, at.z, rand(2, 5)) : at;
        if (!q) continue;
        make(pick.id, i ? levelFor(q.x, q.z) : level, q.x, q.y, q.z, pick.stage ? { stage: pick.stage, title: pick.title } : {});
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
      const level = levelFor(at.x, at.z);
      const id = evolveFor(i === 0 ? lead : pickOne(kinds), level).id;
      const q = i ? spot(at.x, at.z, rand(3, 7), Math.random() * 6.28) : at;
      if (!q) continue;
      const m = make(id, level, q.x, q.y, q.z, { state: 'lurk', pack });
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
    if (m.breath) endBreath(m);
    if (m.nova) endNova(m);
    clearDeath(m);
    scene.remove(m.body, m.tag.sprite);
    m.tag.sprite.material.map.dispose();
    m.tag.sprite.material.dispose();
    list.splice(list.indexOf(m), 1);
  }

  function update(dt, t) {
    const p = getPlayer();
    spawnTimer -= dt;
    nowT = t;
    const alive = list.filter((m) => !m.dead && !m.kind.animal && !m.kind.beast);
    // night brings more monsters, and every one of them hunts
    const night = isNight();
    if (spawnTimer <= 0 && alive.length < (night ? MAX_NEAR + 4 : MAX_NEAR) && !p.dead) {
      spawnTimer = night ? 1 : 1.5;
      spawn(p);
    }
    // the wild animals of the land: herds of deer, rabbits in the grass, wolves in the woods
    animalTimer -= dt;
    if (animalTimer <= 0 && !p.dead && !p.underground) {
      animalTimer = 2;
      if (list.filter((m) => m.kind.animal && !m.dead && !m.farm).length < MAX_ANIMALS) spawnAnimals(p);
    }
    // the dragons, wyverns and the Spirit King at their lairs near you
    beastTimer -= dt;
    if (beastTimer <= 0 && !p.underground) { beastTimer = 3; spawnBeasts(p); }
    for (const g of lavaLakes.values()) g.userData.tick(t);
    if (falls.length) stepFalls(dt, t, p);
    // ambushes only catch you while you're on the move and away from shelter
    if (p.moving && !p.safe && !p.dead) {
      ambushTimer -= dt;
      if (ambushTimer <= 0) { ambushTimer = rand(...AMBUSH_EVERY); ambush(p); }
    }
    // no more than 20 bodies lying about: the oldest rots away first
    const bodies = list.filter((m) => m.death && m.death.left > 0 && !m.death.harvested);
    if (bodies.length > 20) bodies.sort((a, b) => a.death.left - b.death.left)[0].death.left = 0;
    for (const m of [...list]) {
      const dx = p.x - m.x, dz = p.z - m.z;
      const dist = Math.hypot(dx, dz);
      if (m.kind.beast) { stepBeast(m, dt, t, p, dx, dz, dist); continue; }
      if (dist > DESPAWN && !m.keep) { remove(m); continue; }
      if (m.dead && m.kind.animal) {
        // a fallen animal rolls onto its side and lies there until it is cut up, taken to the
        // Butcher, or left to rot (a body being dragged doesn't rot)
        m.dead += dt;
        lieDown(m.body, m.dead / 0.7);
        if (!m.dragged) m.death.left -= dt;
        m.death.t += dt;
        tickAnimalBlood(m);
        if (m.death.left <= 0 || m.death.harvested) remove(m);
        continue;
      }
      if (m.dead) {
        // it dies the way the blow says (deaths.js): a body left lying, ash, a crack in the ground…
        m.dead += dt;
        if (!m.death) startDeath(m, 'blunt', scene);
        if (tickDeath(m, dt)) remove(m);
        continue;
      }
      // a cut-off hand falling to the ground
      if (m.bits) for (const p of m.bits) { if (p.done) continue; p.vy -= 9.8 * dt; p.obj.position.y += p.vy * dt; p.obj.rotation.x += dt * 4; if (p.obj.position.y < m.y + 0.08) { p.obj.position.y = m.y + 0.08; p.done = true; } }
      if (m.kind.animal && !m.kind.aggressive) { stepAnimal(m, dt, t, p, dx, dz, dist); continue; }
      let speed = 0;
      const hidden = p.safe && !m.hurtBy && !m.raid; // a torch or a campfire keeps you hidden (but not from monsters attacking a town)
      // lurkers wait without moving until you walk into them (or hit one)
      if (m.state === 'lurk') {
        if (!p.dead && (dist < 13 || m.hurtBy)) spring(m.pack);
        else { animate(m, t, 0); continue; }
      }
      // by day only angry monsters come for you; at night they all do. They notice you from afar
      // and creep closer before they charge; an ambusher that has sprung tracks you down.
      const sense = m.hunting ? 140 : m.raid ? 45 : m.state === 'chase' ? 40 : night ? NOTICE + 10 : NOTICE;
      const chase = (m.angry || night) && !p.dead && !hidden && dist < sense;
      const stalk = !chase && m.angry && !p.dead && !hidden && dist < STALK;
      const baited = m.kind.animal ? lureMove(m, dt, p, dist, dx, dz) : -1;
      if (baited >= 0) {
        m.state = 'wander';
        speed = baited;
      } else if (stalk) {
        m.state = 'stalk';
        m.heading = Math.atan2(dx, dz);
        speed = m.speed * 0.5;
      } else if (chase) {
        m.state = 'chase';
        m.heading = Math.atan2(dx, dz);
        const reach = m.radius + p.radius + 0.6;
        if (dist > reach) speed = m.speed * 1.25;
        m.attackCd -= dt;
        if (dist <= reach + 0.3 && m.attackCd <= 0 && !(m.stun > 0)) {
          m.attackCd = 1.6;
          m.lunge = 0.3;
          onHitPlayer(m);
        }
      } else if (!stalk && m.guard) {
        // guards hold their post, watching the way in
        m.state = 'wander';
        m.heading = m.guard.heading;
      } else if (!stalk && m.leash && Math.hypot(m.leash.x - m.x, m.leash.z - m.z) > m.leash.r) {
        // (monsters attacking a town keep close to it: back they go)
        m.state = 'wander';
        m.heading = Math.atan2(m.leash.x - m.x, m.leash.z - m.z);
        speed = m.speed * 0.6;
      } else if (!stalk) {
        m.state = 'wander';
        m.timer -= dt;
        if (m.timer <= 0) { m.timer = 2 + Math.random() * 4; m.walking = Math.random() < 0.6; m.heading += (Math.random() - 0.5) * 2.5; }
        if (m.walking) speed = m.speed * 0.45;
      }
      // frost slows a monster to half speed for a while
      if (m.slow > 0) { m.slow -= dt; speed *= 0.5; }
      // a pinned monster (a skill or spell that holds it) can't move or strike until it breaks free
      if (m.stun > 0) { m.stun -= dt; speed = 0; }
      if (speed > 0) {
        const nx = m.x + Math.sin(m.heading) * speed * dt;
        const nz = m.z + Math.cos(m.heading) * speed * dt;
        const s = sample(nx, nz, tmp);
        // monsters stay out of the water, caves they weren't in, the safe zones round the waystones,
        // and land with buildings on it or that belongs to a nation
        const blocked = s.h <= s.water + 0.2 || (isInsideCave?.(nx, nz) && !isInsideCave?.(m.x, m.z)) || (!m.kind.royal && safeZoneAt(nx, nz) && !safeZoneAt(m.x, m.z))
          || (!m.kind.royal && wardedAt(nx, nz) && !wardedAt(m.x, m.z))
          || wallAhead(m, nx, nz);
        if (!blocked) { m.x = nx; m.z = nz; m.y = feet(nx, nz, m.y, s.h); } else {
          // a charging wolf or bear crashes into what's in its way (and may break a fence)
          const wall = m.kind.animal && speed >= 5 && !(m.crashT > 0) && blocked !== true ? blocked : null;
          if (wall) { m.crashT = 0.8; onCrash?.(m, wall, speed); }
          m.heading += Math.PI * 0.7;
        }
      }
      unstick(m);
      if (m.crashT > 0) m.crashT -= dt;
      m.hurt = Math.max(0, m.hurt - dt);
      m.lunge = Math.max(0, (m.lunge || 0) - dt);
      const lunge = m.lunge > 0 ? Math.sin((m.lunge / 0.3) * Math.PI) * 0.4 : 0;
      m.body.position.set(m.x + Math.sin(m.heading) * lunge, m.y + (m.hurt > 0 ? Math.sin(m.hurt * 30) * 0.05 : 0), m.z + Math.cos(m.heading) * lunge);
      m.body.rotation.y = m.heading;
      animate(m, t, speed);
      m.tag.sprite.position.set(m.x, m.y + m.height + 0.45, m.z);
    }
  }

  // ---------- bait and snares (see husbandry.js) ----------
  // An animal drawn to a hunter's bait walks to it, unless it is hurt or you come too close (a
  // hunter waits back out of sight). At the bait the snare catches it: it can't get away for a
  // while (a wolf or bear still bites if you come within reach), then it tears free.
  const SNARE_HOLD = 30;
  function lureMove(m, dt, p, dist, dx, dz) {
    if (m.snared > 0) {
      m.snared -= dt;
      m.heading = Math.atan2(dx, dz) + Math.sin(nowT * 6 + m.x) * 0.5; // tugging at the snare
      if (Math.sin(nowT * 2.3 + m.z) > 0.7) m.hurt = Math.max(m.hurt, 0.12); // ...and jerking against it
      if (m.kind.aggressive && !p.dead) {
        const reach = m.radius + p.radius + 0.6;
        m.attackCd -= dt;
        if (dist <= reach + 0.3 && m.attackCd <= 0) { m.attackCd = 1.6; m.lunge = 0.3; onHitPlayer(m); }
      }
      if (m.snared <= 0) {
        m.snared = 0; m.lure = null;
        if (m.kind.aggressive) { m.angry = true; m.hunting = true; } else m.fleeT = 8;
        onSnare?.(m, 'free');
      }
      return 0;
    }
    if (!m.lure) return -1;
    if (m.hurtBy || (!p.dead && dist < (m.kind.aggressive ? 9 : SHY_RANGE))) { m.lure = null; return -1; }
    const lx = m.lure.x - m.x, lz = m.lure.z - m.z, ld = Math.hypot(lx, lz);
    if (ld < 1.2) {
      if (m.lure.snare) { m.snared = SNARE_HOLD; onSnare?.(m, 'caught'); } else m.lure = null;
      return 0;
    }
    m.heading = Math.atan2(lx, lz);
    return Math.min(m.speed * 0.55, ld);
  }

  // A grazing animal: wanders and grazes; a shy one bolts when you come close (or run at it),
  // any of them runs when hurt; one you have fed trots after you for a while; farm animals stay
  // in their pens.
  function stepAnimal(m, dt, t, p, dx, dz, dist) {
    const a = m.kind.animal;
    let speed = 0;
    if (m.fedT > 0) m.fedT -= dt;
    const friendly = m.fedT > 0 || m.farm;
    // a wild horse or camel is curious: stand still with food in your bag and it comes to you
    const lured = !friendly && p.lure && TAMEABLE[m.kind.animalId] && !p.dead && m.fleeT <= 0 && dist < 28;
    const baited = lureMove(m, dt, p, dist, dx, dz);
    if (baited < 0 && !friendly && !lured && !p.dead && a.temper === 'shy' && dist < (p.moving && p.running ? SHY_RUN : SHY_RANGE)) m.fleeT = Math.max(m.fleeT, 2.5);
    if (baited >= 0) {
      speed = baited;
    } else if (m.fleeT > 0) {
      m.fleeT -= dt;
      m.heading = Math.atan2(-dx, -dz) + Math.sin(t * 1.7 + m.x) * 0.3;
      speed = m.speed * (m.farm ? 0.5 : 1);
    } else if (lured && dist > 2.2) {
      m.heading = Math.atan2(dx, dz);
      speed = Math.min(1.1, dist - 2);
    } else if (m.fedT > 0 && !m.farm && dist > 3 && dist < 30) {
      // following the one who fed it
      m.heading = Math.atan2(dx, dz);
      speed = Math.min(m.speed * 0.5, dist - 2.5);
    } else {
      m.timer -= dt;
      if (m.timer <= 0) { m.timer = 3 + Math.random() * 6; m.walking = Math.random() < 0.4; m.heading += (Math.random() - 0.5) * 2.5; }
      if (m.walking) speed = Math.min(1.2, m.speed * 0.18);
      if (m.petT > 0) { m.petT -= dt; speed = 0; m.heading = Math.atan2(dx, dz); }
    }
    if (speed > 0) {
      const nx = m.x + Math.sin(m.heading) * speed * dt, nz = m.z + Math.cos(m.heading) * speed * dt;
      const s = sample(nx, nz, tmp);
      const out = m.pen && (Math.abs(nx - m.pen.x) > m.pen.hw || Math.abs(nz - m.pen.z) > m.pen.hd);
      const wall = !(s.h <= s.water + 0.1 || out) && wallAhead(m, nx, nz);
      const blocked = s.h <= s.water + 0.1 || out || (isInsideCave?.(nx, nz) && !isInsideCave?.(m.x, m.z)) || !!wall;
      if (!blocked) { m.x = nx; m.z = nz; m.y = feet(nx, nz, m.y, s.h); }
      else if (m.pen && out) { m.heading = Math.atan2(m.pen.x - m.x, m.pen.z - m.z) + (Math.random() - 0.5); m.walking = true; m.timer = 2; }
      else {
        // running flat out into it: a crash (it may break a fence), then it reels back and turns
        if (wall && speed >= 5 && !(m.crashT > 0)) { m.crashT = 0.8; onCrash?.(m, wall, speed); m.hurt = 0.3; }
        m.heading += Math.PI * (0.5 + Math.random() * 0.3);
      }
    }
    if (m.crashT > 0) m.crashT -= dt;
    unstick(m);
    m.hurt = Math.max(0, m.hurt - dt);
    m.body.position.set(m.x, m.y + (m.hurt > 0 ? Math.sin(m.hurt * 30) * 0.03 : 0), m.z);
    m.body.rotation.y = m.heading;
    animateAnimal(m.body, t, speed);
    m.tag.sprite.visible = m.hp < m.maxHp;
    m.tag.sprite.position.set(m.x, m.y + m.height + 0.35, m.z);
  }

  // The living monsters in front of (x, z) facing `heading`, within `reach` metres and `arc` radians
  // either side, nearest first
  function targets(x, z, heading, reach, arc = 1.0) {
    const out = [];
    for (const m of list) {
      if (m.dead || m.farm) continue; // (the farmer's animals are not for hunting)
      if (m.kind.beast && (m.air > 7 && reach < 12 || (m.kind.beast.shape === 'spirit' && !m.risen))) continue; // (out of reach up in the sky, or still under the lake)
      const dx = m.x - x, dz = m.z - z;
      const d = Math.hypot(dx, dz) - m.radius;
      if (d > reach) continue;
      let ang = Math.atan2(dx, dz) - heading;
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(ang) > arc && d > 0.6) continue;
      out.push([d, m]);
    }
    return out.sort((a, b) => a[0] - b[0]).map(([, m]) => m);
  }
  const target = (x, z, heading, reach, arc) => targets(x, z, heading, reach, arc)[0] || null;

  // Hit a monster. Returns its drops and rewards if it was defeated.
  // `how`: the kind of blow (deaths.js howOf), and whether it was a hard one (a crit, or a big share
  // of its health), for what it does to the body
  function hit(m, dmg, how = 'blunt', strong = false) {
    if (m.dead) return null;
    const before = m.hp;
    m.hp = Math.max(0, m.hp - dmg);
    m.hurt = 0.25;
    m.angry = true;
    m.hurtBy = true; // it fights back even near a fire
    if (m.state === 'lurk') spring(m.pack);
    m.tag.draw(m.hp / m.maxHp);
    if (m.kind.animal) {
      // a grazing animal runs from the hunter; a wolf or bear turns on them
      if (!m.kind.aggressive) { m.fleeT = 5; m.fedT = 0; }
      m.hitCount = (m.hitCount || 0) + 1;
      if (m.hp > 0) return null;
      m.dead = 0.001; m.dragged = false;
      m.tag.sprite.visible = false;
      m.death = { corpse: true, animal: true, t: 0, left: CORPSE_SECS, harvested: false };
      try { animalWounds(m, how, scene); } catch { /* the wounds are only for show */ }
      const a = m.kind.animal;
      return { exp: Math.max(1, Math.round(a.temper === 'fierce' ? monsterExp(m.level, 0) : a.hp / 12)), coins: 0, drops: [], name: a.name, kind: m.kindId, level: m.level, animal: m.kind.animalId };
    }
    if (m.kind.beast) {
      if (m.kind.beast.king && !m.angry) { m.angry = true; m.hover = null; onBeast?.(m, 'wrath'); }
      if (m.mode === 'circle') { m.mode = 'dive'; m.modeT = 0; }
      // a dragon or wyvern beaten below 15% of its health lands, worn out, and can be tamed
      if (m.hp > 0 && BEAST_TAME[m.kind.beastId] && !m.downedOnce && m.hp < m.maxHp * 0.15) { m.downedOnce = true; m.mode = 'downed'; m.modeT = 0; endBreath(m); onBeast?.(m, 'downed'); }
      if (m.hp > 0) return null;
      m.dead = 0.001;
      endBreath(m); endNova(m);
      if (m.lair) slain.set(m.lair.id, nowT + (m.kind.beast.returns || BEAST_RETURNS));
      const drops = [];
      for (const [id, chance, min, max] of m.kind.drops) if (Math.random() < chance) drops.push([id, min + Math.floor(Math.random() * (max - min + 1))]);
      onBeast?.(m, 'slain');
      const king = m.kind.beast.king;
      return { exp: monsterExp(m.level, 5) * (king ? 15 : m.boss ? 5 : 2), coins: (1 + m.level + Math.floor(Math.random() * (m.level / 2 + 2))) * (king ? 40 : m.boss ? 10 : 3), drops, name: m.kind.name, kind: m.kindId, level: m.level };
    }
    if (m.hp > 0) { const lost = maim(m, how, dmg, scene); return lost ? { maimed: lost } : null; }
    m.dead = 0.001;
    startDeath(m, how, scene, { strong: strong || dmg >= before * 1.5 || dmg >= m.maxHp * 0.5 });
    const drops = [];
    for (const [id, chance, min, max] of m.kind.drops) {
      if (Math.random() < chance) drops.push([id, min + Math.floor(Math.random() * (max - min + 1))]);
    }
    return { exp: monsterExp(m.level, m.stage), coins: 1 + m.level + Math.floor(Math.random() * (m.level / 2 + 2)), drops, name: m.title || m.kind.name, kind: m.kindId, level: m.level };
  }

  return {
    update, target, targets, hit,
    // how many seconds until a slain great beast's lair has a new one (0: it is there)
    slainIn: (lairId) => Math.max(0, (slain.get(lairId) || 0) - nowT),
    // the realm's keepers bring slain great beasts back: their empty lairs have them again at once
    revive(lairIds) { let n = 0; for (const id of lairIds) if ((slain.get(id) || 0) > nowT) { slain.delete(id); n++; } beastTimer = 0; return n; },
    calm() { for (const m of list) { m.angry = false; m.state = 'wander'; m.timer = 4; } },
    // the living grazing animal nearest (x, z) within r metres (to feed or pet)
    animalNear(x, z, r) {
      let best = null, bd = r;
      for (const m of list) { if (m.dead || !m.kind.animal || m.kind.aggressive) continue; const d = Math.hypot(m.x - x, m.z - z) - m.radius; if (d < bd) { bd = d; best = m; } }
      return best;
    },
    clear() { for (const m of [...list]) remove(m); for (const g of lavaLakes.values()) scene.remove(g); lavaLakes.clear(); for (const f of falls) scene.remove(f.g); falls.length = 0; },
    // put a monster somewhere on purpose (cave guards, cave dwellers, bosses)
    spawnAt(kindId, level, x, z, extra = {}) {
      const s = sample(x, z, tmp);
      const m = make(kindId, Math.max(1, level), x, feet(x, z, s.h, s.h), z, extra);
      if (extra.boss) { m.body.scale.multiplyScalar(1.45); m.height *= 1.45; m.radius *= 1.45; }
      return m;
    },
    // an animal drawn to bait at (x, z): it comes from 50 to 75 m away (`snare`: a trap waits there)
    lureAnimal(id, x, z, snare = true) {
      const a = ANIMALS[id];
      for (let i = 0; i < 10; i++) {
        const at = spot(x, z, rand(50, 75));
        if (!at || isInsideCave?.(at.x, at.z)) continue;
        return make(`a_${id}`, a.temper === 'fierce' ? levelFor(at.x, at.z) : 1, at.x, at.y, at.z, { lure: { x, z, snare } });
      }
      return null;
    },
    // where the great beasts are, and one put in front of you (for testing)
    // a worn-out dragon or wyvern lying within r metres (to tame), and taming it (see world.js)
    downedNear: (x, z, r) => list.find((m) => m.kind.beast && !m.dead && m.mode === 'downed' && m.air < 1 && Math.hypot(m.x - x, m.z - z) - m.radius < r) || null,
    tame(m, ok) {
      if (ok) { if (m.lair) slain.set(m.lair.id, nowT + BEAST_RETURNS); remove(m); return true; }
      m.mode = 'climb'; m.modeT = 0; m.angry = true; m.hp = Math.max(m.hp, Math.round(m.maxHp * 0.3)); onBeast?.(m, 'shake');
      return false;
    },
    // someone took an egg from this lair's nest: its beast (if it is about) comes for them
    angerLair(lairId) {
      const m = list.find((q) => q.kind.beast && !q.dead && q.lair?.id === lairId);
      if (!m) return null;
      m.angry = true; m.hover = null;
      if (m.mode === 'circle' || m.mode === 'downed') { m.mode = 'dive'; m.modeT = 0; }
      return m;
    },
    beastNear: (x, z, r) => list.find((m) => m.kind.beast && !m.dead && Math.hypot(m.x - x, m.z - z) < r) || null,
    removeWhere(fn) { for (const m of [...list]) if (fn(m)) remove(m); },
    get list() { return list; },
  };
}

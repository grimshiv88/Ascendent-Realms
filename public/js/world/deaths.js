// How a monster dies, and what is left of it. Its body doesn't simply vanish: what happens to it
// fits the blow or the skill that killed it. A blade leaves a cut body (or a head off, or the guts
// spilled), fire burns it to a heap of ash, a crack in the ground swallows it, a devouring skill
// eats it whole, frost freezes it solid till it shatters, and so on (DEATHS below). A body that is
// left lies where it fell till someone harvests it for materials (E) or it rots away.
// Lighter blows can take a hand or a forearm off without killing (maim).
import * as THREE from 'three';

export const CORPSE_SECS = 600; // a body left alone rots away after 10 minutes

// what each kind of blow does to the body, and whether a body is left to harvest
// (the kind of blow comes from howOf below)
export const DEATHS = {
  slash:  { body: true,  text: 'cut down' },          // a gash; a hard blow takes the head off or spills the guts
  blunt:  { body: true,  text: 'beaten down' },       // crumpled and knocked back
  pierce: { body: true,  text: 'run through' },       // a wound right through
  bleed:  { body: true,  text: 'bled out' },          // a wide pool of blood
  poison: { body: true,  text: 'poisoned' },          // sickly green, frothing
  fire:   { body: false, text: 'burnt to ash' },      // blackens, then crumbles into a heap of ash
  shock:  { body: true,  text: 'struck by lightning' }, // charred black and smoking
  frost:  { body: false, text: 'frozen and shattered' }, // frozen solid, then bursts into ice
  water:  { body: true,  text: 'drowned' },           // soaked and washed flat
  crack:  { body: false, text: 'swallowed by the ground' }, // a crack opens, it falls in, the crack closes
  bury:   { body: false, text: 'buried' },            // rocks pile up over it
  stone:  { body: true,  text: 'impaled' },           // a stone spear stays standing through it
  nature: { body: true,  text: 'overgrown' },         // vines wrap it and flowers bloom on it
  light:  { body: false, text: 'purified' },          // turns to light and rises away
  dark:   { body: true,  text: 'withered' },          // shrivels to a grey husk
  void:   { body: false, text: 'erased' },            // pulled into a point of darkness
  arcane: { body: false, text: 'unmade' },            // crumbles into glowing dust
  devour: { body: false, text: 'devoured' },          // a maw closes over it and it is gone
  gold:   { body: true,  text: 'knocked out cold' },  // coins scattered round it
  wind:   { body: true,  text: 'cut by the wind' },   // flung back, cut to ribbons
};

const SKILL_HOW = {
  power_strike: 'slash', whirlwind: 'slash', backstab: 'pierce', harvest_swing: 'slash', charge: 'blunt',
  shield_bash: 'blunt', hammer_blow: 'blunt', ground_slam: 'crack', fire_bolt: 'fire', frost_nova: 'frost',
  arcane_lance: 'arcane', coin_toss: 'gold', shadow_step: 'pierce',
};
const SPELL_HOW = {
  fire_bolt: 'fire', flame_burst: 'fire', inferno: 'fire', meteor: 'fire',
  water_bolt: 'water', frost_lance: 'frost', tidal_wave: 'water', maelstrom: 'frost',
  stone_shot: 'blunt', quake: 'crack', stone_spears: 'stone', landslide: 'bury',
  wind_blade: 'wind', gale: 'wind', cyclone: 'wind', tempest: 'wind',
  spark: 'shock', chain_lightning: 'shock', thunderclap: 'shock', storm_call: 'shock',
  thorn_shot: 'nature', entangle: 'nature', bramble_ring: 'nature', wrath_of_the_wild: 'nature',
  light_ray: 'light', radiance: 'light', holy_lance: 'light', judgement: 'light',
  shadow_bolt: 'dark', curse: 'dark', void_nova: 'void', oblivion: 'void',
};
const ELEMENT_HOW = { Fire: 'fire', Water: 'frost', Ice: 'frost', Earth: 'crack', Wind: 'wind', Lightning: 'shock', Nature: 'nature', Light: 'light', Dark: 'dark', Arcane: 'arcane' };
const UNIQUE_HOW = { devour: 'devour', freeze: 'frost', sweep: null, strike: null, bolt: null, dash: null };
const WEAPON_HOW = { sword: 'slash', dagger: 'pierce', axe: 'slash', hatchet: 'slash', spear: 'pierce', hammer: 'blunt', mace: 'blunt', staff: 'blunt', bow: 'pierce' };

// the kind of blow: from a skill, a spell, a Unique Skill (its kind, then its element), a weapon,
// or a lasting effect (burn, poison, bleed, frost)
export function howOf({ skill = null, spell = null, element = null, weapon = null, dot = null } = {}) {
  if (dot) return { burn: 'fire', poison: 'poison', bleed: 'bleed', frost: 'frost' }[dot] || 'bleed';
  if (spell) return SPELL_HOW[spell.id] || ELEMENT_HOW[spell.element] || 'arcane';
  if (skill?.unique) return UNIQUE_HOW[skill.kind] || ELEMENT_HOW[skill.element] || (weapon ? WEAPON_HOW[weapon.type] || 'slash' : 'blunt');
  if (skill && SKILL_HOW[skill.id]) return SKILL_HOW[skill.id];
  if (element) return ELEMENT_HOW[element] || 'arcane';
  if (weapon) return WEAPON_HOW[weapon.type] || 'slash';
  return 'blunt'; // bare fists
}

// ---------- little pieces left in the world ----------
const MATS = {};
const mat = (k, c, extra = {}) => (MATS[k] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...extra }));
const blood = () => mat('blood', '#3a0404', { roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 });
const flat = (r, m) => { const g = new THREE.CircleGeometry(r, 18); g.rotateX(-Math.PI / 2); return new THREE.Mesh(g, m); };

// The organs inside a humanoid monster's body (hidden in the torso, there to spill from a deep cut)
export function addOrgans(rig) {
  if (!rig?.spine || !rig.torsoLen || rig.organs) return;
  const H = rig.H || 1.6, tl = rig.torsoLen, g = new THREE.Group();
  const o = (rx, ry, rz, c, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat('organ' + c, c, { roughness: 0.35 })); m.scale.set(rx * H, ry * H, rz * H); m.position.set(x * H, y * tl, z * H); g.add(m); return m; };
  o(0.035, 0.07, 0.04, '#b0505a', -0.035, 0.72, 0); o(0.035, 0.07, 0.04, '#b0505a', 0.035, 0.72, 0); // lungs
  o(0.022, 0.026, 0.02, '#7a1018', -0.008, 0.68, 0.015);                                            // heart
  o(0.05, 0.025, 0.035, '#5a1a14', 0.02, 0.5, 0.01);                                                  // liver
  o(0.03, 0.022, 0.025, '#c08a7a', -0.025, 0.47, 0.01);                                               // stomach
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.018 * H, 0.008 * H, 6, 12), mat('gut', '#d08a8a', { roughness: 0.35 })); t.position.set(((i % 3) - 1) * 0.02 * H, (0.22 + (i % 2) * 0.08) * tl, 0.005 * H); t.rotation.set(1.2, i, 0.4); g.add(t); } // intestines
  g.visible = false; // inside the body; shown only when spilled
  rig.spine.add(g);
  rig.organs = g;
}

// clone a body's materials, so tinting this one (burning, freezing) leaves the others alone
function ownMaterials(body) {
  if (body.userData.ownMats) return;
  body.userData.ownMats = true;
  body.traverse((o) => { if (o.isMesh && o.material) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); });
}
function tint(body, color, k, emissive = null, ek = 0) {
  const c = new THREE.Color(color);
  body.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.userData.base ??= m.color?.clone();
      if (m.color && m.userData.base) m.color.copy(m.userData.base).lerp(c, k);
      if (emissive && m.emissive) { m.emissive.set(emissive); m.emissiveIntensity = ek; }
    }
  });
}
// a copy of part of a body, put into the world where it is now (a head, a hand)
function detach(part, scene) {
  part.updateWorldMatrix(true, true);
  const copy = part.clone(true);
  part.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
  scene.add(copy);
  part.visible = false;
  return copy;
}

// ---------- a blow that doesn't kill: a hand or forearm cut off ----------
// a solid cut (a blade, at least a sixth of its health) has a chance to take a hand off
export function maim(m, how, dmg, scene) {
  const rig = m.body.userData.rig;
  if (!rig?.arms || !['slash', 'wind'].includes(how) || dmg < m.maxHp / 6 || Math.random() > 0.3) return null;
  const arm = rig.arms.find((a) => !a.lost);
  if (!arm) return null;
  arm.lost = true;
  const piece = detach(arm.elbow, scene);
  const stump = new THREE.Mesh(new THREE.SphereGeometry(0.035 * (rig.H || 1.6), 8, 6), blood());
  arm.elbow.parent.add(stump);
  stump.position.copy(arm.elbow.position);
  const bits = m.bits ||= [];
  bits.push({ obj: piece, vy: 1.5, fall: true, y0: m.y });
  m.atk = Math.round(m.atk * 0.7); // it hits weaker with one hand
  return 'hand';
}

// ---------- the death itself ----------
export function startDeath(m, how, scene, { strong = false } = {}) {
  const style = DEATHS[how] ? how : 'blunt';
  const rig = m.body.userData.rig || {};
  const D = m.death = { style, t: 0, corpse: DEATHS[style].body, scene, extra: [], left: CORPSE_SECS, harvested: false };
  m.body.rotation.order = 'YXZ';
  const at = (obj, dx = 0, dz = 0, y = 0.02) => { obj.position.set(m.x + dx, m.y + y, m.z + dz); scene.add(obj); D.extra.push(obj); return obj; };
  const H = m.height || 1.6;
  if (['fire', 'frost', 'shock', 'poison', 'dark', 'water', 'light', 'arcane', 'nature'].includes(style)) ownMaterials(m.body);
  if (style === 'slash' || style === 'wind') {
    // a hard blow takes the head off, or opens the belly and spills the guts; otherwise a deep gash
    if (strong && rig.head && Math.random() < 0.5) {
      const head = detach(rig.head, scene);
      D.extra.push(head);
      D.head = { obj: head, vy: 2, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2 };
      const neck = new THREE.Mesh(new THREE.CircleGeometry(0.05 * H, 10), blood());
      neck.rotation.x = -Math.PI / 2; neck.position.copy(rig.head.position); rig.head.parent.add(neck);
    } else if (rig.organs && (strong || Math.random() < 0.4)) {
      rig.organs.visible = true;
      // the guts spill out onto the ground beside it
      for (let i = 0; i < 4; i++) {
        const gut = new THREE.Mesh(new THREE.TorusGeometry(0.05 * H, 0.02 * H, 6, 12, Math.PI * 1.4), mat('gut', '#d08a8a', { roughness: 0.35 }));
        gut.rotation.set(-Math.PI / 2, 0, i * 1.7);
        at(gut, Math.sin(m.heading) * (0.3 + i * 0.07) + (i - 1.5) * 0.06, Math.cos(m.heading) * (0.3 + i * 0.07), 0.04);
      }
    }
    if (rig.chest) {
      const gash = new THREE.Mesh(new THREE.BoxGeometry(0.22 * H, 0.025 * H, 0.02), blood());
      gash.rotation.z = 0.7; gash.position.set(0, (rig.torsoLen || 0.4) * 0.55, 0.1 * H * (rig.bulk || 1)); rig.spine?.add(gash);
    }
    D.pool = at(flat(0.05, blood()));
    D.poolR = 0.5 * H;
  } else if (style === 'pierce' || style === 'bleed') {
    D.pool = at(flat(0.05, blood()));
    D.poolR = (style === 'bleed' ? 0.75 : 0.45) * H;
  } else if (style === 'stone') {
    const spear = new THREE.Mesh(new THREE.ConeGeometry(0.12 * H, 1.6 * H, 6), mat('stone', '#7a7266'));
    spear.rotation.z = 0.35; at(spear, 0, 0, 0.6 * H);
    D.pool = at(flat(0.05, blood())); D.poolR = 0.4 * H;
  } else if (style === 'crack') {
    const crack = flat(0.05, mat('crack', '#0a0806', { polygonOffset: true, polygonOffsetFactor: -3 }));
    crack.scale.z = 0.35; D.crack = at(crack);
  } else if (style === 'bury') {
    for (let i = 0; i < 9; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry((0.18 + Math.random() * 0.2) * H), mat('rock', '#6a6258'));
      rock.userData.to = (0.1 + (i % 3) * 0.18) * H;
      at(rock, (Math.random() - 0.5) * H * 0.9, (Math.random() - 0.5) * H * 0.9, 3 + Math.random() * 2);
      (D.rocks ||= []).push(rock);
    }
  } else if (style === 'gold') {
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 10), mat('coin', '#e0b040', { metalness: 0.8, roughness: 0.3 })); at(c, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, 0.01); }
  } else if (style === 'devour' || style === 'void') {
    const maw = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: style === 'void' ? '#000000' : '#1a0420', transparent: true, opacity: 0.92 }));
    maw.scale.setScalar(0.01); D.maw = at(maw, 0, 0, H * 0.5);
  }
  return D;
}

// one step of a death; returns true once nothing is left of it
export function tickDeath(m, dt) {
  const D = m.death, b = m.body, H = m.height || 1.6;
  D.t += dt;
  const t = D.t, k = (a, d) => Math.min(1, Math.max(0, (t - a) / d));
  m.tag.sprite.visible = false;
  // pieces flying off (a head, a hand) come down and settle on the ground
  for (const p of [D.head, ...(m.bits || [])]) {
    if (!p || p.done) continue;
    p.vy -= 9.8 * dt;
    p.obj.position.x += (p.vx || 0) * dt; p.obj.position.z += (p.vz || 0) * dt; p.obj.position.y += p.vy * dt;
    p.obj.rotation.x += dt * 4;
    if (p.obj.position.y < m.y + 0.08) { p.obj.position.y = m.y + 0.08; p.done = true; }
  }
  if (D.pool) D.pool.scale.setScalar(Math.max(0.05, D.poolR * k(0.3, 2.5)) / 0.05);
  const fall = (dir = 1, dur = 0.7) => { const f = k(0, dur); b.rotation.x = -dir * (Math.PI / 2) * f * f; b.position.y = m.y + 0.1 * H * f; };
  switch (D.style) {
    case 'fire': {
      fall(1, 0.9);
      tint(b, '#100806', k(0, 1.6), '#ff5a10', 2 * (1 - k(1.2, 1.2)) * k(0, 0.4));
      if (t > 2.2 && !D.ash) {
        D.ash = new THREE.Mesh(new THREE.ConeGeometry(0.35 * H, 0.22 * H, 10), mat('ash', '#3a3632'));
        D.ash.position.set(m.x, m.y + 0.1 * H, m.z); D.scene.add(D.ash); D.extra.push(D.ash);
      }
      if (t > 2.2) b.scale.multiplyScalar(Math.max(0, 1 - dt * 3));
      if (t > 3) b.visible = false;
      return t > 45; // the ash heap stays a while, then blows away
    }
    case 'frost': {
      tint(b, '#a8dcff', k(0, 0.5), '#3a8aff', 0.4);
      if (t > 3 && !D.shards) {
        D.shards = [];
        for (let i = 0; i < 14; i++) {
          const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.1 * H), mat('ice', '#bfe6ff', { transparent: true, opacity: 0.85, roughness: 0.1 }));
          s.position.set(m.x, m.y + Math.random() * H, m.z); D.scene.add(s); D.extra.push(s);
          D.shards.push({ obj: s, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 4 });
        }
        b.visible = false;
      }
      for (const s of D.shards || []) { s.vy -= 9.8 * dt; s.obj.position.x += s.vx * dt; s.obj.position.z += s.vz * dt; s.obj.position.y = Math.max(m.y + 0.05, s.obj.position.y + s.vy * dt); if (s.obj.position.y <= m.y + 0.05) s.vx *= 0.9, s.vz *= 0.9; }
      return t > 20;
    }
    case 'crack': {
      const open = k(0, 0.4) * (1 - k(2, 0.5));
      D.crack.scale.set(Math.max(0.01, open * 0.9 * H / 0.05), 1, Math.max(0.01, open * 0.35 * H / 0.05));
      if (t > 0.3) { b.position.y = m.y - (t - 0.3) ** 2 * 6; b.rotation.z = (t - 0.3) * 0.8; }
      if (t > 1.8) b.visible = false;
      return t > 2.6;
    }
    case 'bury': {
      fall(1, 0.4);
      for (const r of D.rocks) r.position.y = Math.max(m.y + r.userData.to, r.position.y - dt * 9);
      if (t > 1) b.visible = false;
      return t > 60; // the rock pile stays a minute
    }
    case 'light': {
      tint(b, '#fff8d8', k(0, 0.8), '#fff0b0', 3 * k(0, 0.8));
      b.position.y = m.y + k(0.8, 2) * H * 1.5;
      b.scale.setScalar(Math.max(0.001, 1 - k(0.8, 2)));
      return t > 3;
    }
    case 'arcane': {
      tint(b, '#9a7aff', k(0, 0.6), '#7a4aff', 1.5);
      b.scale.set(1, Math.max(0.001, 1 - k(0.6, 1.4)), 1);
      return t > 2.2;
    }
    case 'devour': case 'void': {
      const s = (D.style === 'void' ? 0.9 : 1.2) * H * (k(0, 0.5) - k(1.4, 0.4));
      D.maw.scale.setScalar(Math.max(0.01, s));
      if (t > 0.7) b.visible = false;
      return t > 2;
    }
    case 'shock': fall(1, 0.4); tint(b, '#1a1410', k(0, 0.3), '#60a0ff', t < 0.5 ? 2 : 0); break;
    case 'poison': fall(-1, 1.2); tint(b, '#4a7a2a', 0.45 * k(0, 2)); break;
    case 'dark': fall(-1, 1.4); tint(b, '#4a4448', 0.8 * k(0, 2)); b.scale.set(1 - 0.25 * k(0, 2), 1, 1 - 0.25 * k(0, 2)); break;
    case 'water': fall(1, 0.5); tint(b, '#1a2a3a', 0.35 * k(0, 1)); break;
    case 'nature': {
      fall(1, 0.8); tint(b, '#3a6a2a', 0.5 * k(0.5, 3));
      if (t > 1 && !D.vines) { D.vines = true; for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat('flower' + (i % 3), ['#e05a8a', '#f0d040', '#ffffff'][i % 3])); f.position.set(m.x + (Math.random() - 0.5) * 0.8, m.y + 0.18 * H, m.z + (Math.random() - 0.5) * 0.8); D.scene.add(f); D.extra.push(f); } }
      break;
    }
    case 'wind': fall(1, 0.5); b.position.x = m.x + Math.sin(m.heading + Math.PI) * 1.5 * k(0, 0.5); b.position.z = m.z + Math.cos(m.heading + Math.PI) * 1.5 * k(0, 0.5); break;
    case 'blunt': case 'gold': fall(1, 0.5); break;
    case 'slime': break;
    default: fall(1, 0.7);
  }
  // a slime goes flat into a puddle of gel instead of falling over
  if (b.userData.rig?.core) { b.rotation.x = 0; b.scale.set(1 + k(0, 0.6) * 0.6, Math.max(0.15, 1 - k(0, 0.6) * 0.85), 1 + k(0, 0.6) * 0.6); b.position.y = m.y; }
  // a body that's left lies there till it is harvested or rots away (sinking into the ground)
  D.left -= dt;
  if (D.harvested || D.left < 0) {
    D.gone = (D.gone || 0) + dt;
    b.position.y -= dt * 0.4;
    for (const o of D.extra) o.position.y -= dt * 0.4;
    return D.gone > 3;
  }
  return false;
}

// a body that can still be harvested (E beside it)
export const canHarvest = (m) => !!(m.death && m.death.corpse && !m.death.harvested && m.death.t > 1 && m.body.visible);
// what you get from cutting up a body: bone and hide (a burnt or ruined one gives nothing)
export function harvest(m) {
  if (!canHarvest(m)) return null;
  m.death.harvested = true;
  const big = Math.max(1, Math.round((m.height || 1.5) / 1.2));
  const out = [['monster_bone', 1 + Math.floor(Math.random() * 2) * big], ['monster_hide', big]];
  if (m.body.userData.rig?.core) return [['slime_gel', 2 + big]];
  return out;
}

// take everything a death left in the world away again
export function clearDeath(m) {
  for (const o of m.death?.extra || []) o.parent?.remove(o);
  for (const p of m.bits || []) p.obj.parent?.remove(p.obj);
}

// What each skill looks like when it's used: Whirlwind spins a whirlwind around you, Fire Bolt
// throws a fireball, Frost Nova bursts into a ring of ice, heals rise in green light, and so on.
// Every effect is a few glowing shapes that grow, spin and fade, then are thrown away.
import * as THREE from 'three';

const glow = (color, opacity = 0.8) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});

export function createSkillFx(scene) {
  const live = []; // { obj, t, life, step(k, dt), done? }
  const geo = {
    ring: new THREE.RingGeometry(0.85, 1, 48),
    disc: new THREE.CircleGeometry(1, 40),
    funnel: new THREE.CylinderGeometry(1, 0.25, 1, 28, 6, true),
    ball: new THREE.IcosahedronGeometry(1, 2),
    spike: new THREE.ConeGeometry(0.12, 1, 5),
    shard: new THREE.OctahedronGeometry(1, 0),
    pillar: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
    coin: new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14),
    spark: new THREE.TetrahedronGeometry(0.12, 0),
    lance: new THREE.ConeGeometry(0.16, 2.2, 6),
  };
  // stripes for the whirlwind's spinning walls
  const windTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 5; i++) {
      const grad = g.createLinearGradient(0, 0, 64, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.save(); g.translate(0, i * 13 + 4); g.transform(1, 0, -0.9, 1, 0, 0); g.fillRect(0, 0, 90, 4); g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    return t;
  })();

  function add(obj, life, step) {
    scene.add(obj);
    live.push({ obj, t: 0, life, step });
    return obj;
  }
  const mesh = (g, color, opacity) => new THREE.Mesh(g, glow(color, opacity));
  const fade = (o, a) => o.traverse((m) => { if (m.material) m.material.opacity = a; });

  // a flat ring that spreads out over the ground
  function ring(at, color, from, to, life = 0.6, y = 0.12) {
    const m = mesh(geo.ring, color, 0.9);
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, at.y + y, at.z);
    add(m, life, (k) => { const r = from + (to - from) * (1 - (1 - k) ** 2); m.scale.setScalar(r); fade(m, 0.9 * (1 - k)); });
  }
  // little glowing bits flying out from a point
  function burst(at, color, n = 14, speed = 4, life = 0.7, up = 2) {
    const g = new THREE.Group();
    const bits = [];
    for (let i = 0; i < n; i++) {
      const b = mesh(geo.spark, color, 1);
      const a = Math.random() * Math.PI * 2, s = speed * (0.5 + Math.random() * 0.7);
      b.userData.v = new THREE.Vector3(Math.cos(a) * s, up * (0.4 + Math.random()), Math.sin(a) * s);
      g.add(b); bits.push(b);
    }
    g.position.copy(at);
    add(g, life, (k, dt) => {
      for (const b of bits) {
        b.position.addScaledVector(b.userData.v, dt);
        b.userData.v.y -= 6 * dt;
        b.rotation.x += dt * 8; b.rotation.y += dt * 6;
      }
      fade(g, 1 - k);
    });
  }
  // a quick bright flash where a blow lands
  function flash(at, color, size = 0.9) {
    const m = mesh(geo.ball, color, 0.9);
    m.position.copy(at);
    add(m, 0.25, (k) => { m.scale.setScalar(size * (0.4 + k * 1.2)); fade(m, 0.9 * (1 - k)); });
    const r = mesh(geo.ring, color, 0.9);
    r.position.copy(at);
    r.lookAt(at.x, at.y + 1, at.z);
    add(r, 0.35, (k) => { r.scale.setScalar(size * (0.3 + k * 1.8)); r.rotation.z += 0.2; fade(r, 0.9 * (1 - k)); });
  }
  // something thrown from `from` to `to`
  function shot(obj, from, to, speed, trail, onHit) {
    const dist = from.distanceTo(to), life = Math.max(0.12, dist / speed);
    obj.position.copy(from);
    obj.lookAt(to);
    let tick = 0;
    add(obj, life, (k, dt) => {
      obj.position.lerpVectors(from, to, k);
      obj.rotateZ(dt * 10);
      tick += dt;
      if (trail && tick > 0.03) { tick = 0; trail(obj.position.clone()); }
      if (k >= 1) onHit?.();
    });
  }
  // a little puff that hangs in the air and fades (trails, dust, smoke)
  function puff(at, color, size = 0.35, life = 0.45, rise = 0.6) {
    const m = mesh(geo.ball, color, 0.55);
    m.position.copy(at);
    add(m, life, (k, dt) => { m.position.y += rise * dt; m.scale.setScalar(size * (1 + k)); fade(m, 0.55 * (1 - k)); });
  }

  // ---------- each skill ----------
  const chest = (p, h) => new THREE.Vector3(p.x, p.y + h * 0.6, p.z);

  function whirlwind(p, h, radius, color = '#d8f0ff') {
    const g = new THREE.Group();
    const walls = [];
    for (const [r, hgt, op] of [[1, 1, 0.55], [0.75, 1.15, 0.4]]) {
      const mat = glow(color, op);
      mat.map = windTex.clone(); mat.map.needsUpdate = true;
      const w = new THREE.Mesh(geo.funnel, mat);
      w.scale.set(radius * r, h * 1.4 * hgt, radius * r);
      w.position.y = h * 0.7 * hgt;
      g.add(w); walls.push(w);
    }
    g.position.set(p.x, p.y, p.z);
    add(g, 0.9, (k, dt) => {
      walls.forEach((w, i) => { w.rotation.y += dt * (14 + i * 6); w.material.map.offset.x -= dt * 2; });
      g.scale.set(0.5 + k * 0.6, 0.6 + Math.sin(k * Math.PI) * 0.5, 0.5 + k * 0.6);
      fade(g, (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) * 0.6);
    });
    ring(p, color, radius * 0.4, radius * 1.1, 0.7);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      setTimeout(() => puff(new THREE.Vector3(p.x + Math.cos(a) * radius * 0.8, p.y + 0.3, p.z + Math.sin(a) * radius * 0.8), '#b9a98a', 0.4, 0.6, 1.2), i * 40);
    }
  }
  function frostNova(p, radius) {
    ring(p, '#bfe8ff', 0.5, radius, 0.7);
    ring(p, '#ffffff', 0.3, radius * 0.75, 0.5, 0.2);
    const g = new THREE.Group();
    const shards = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.2, r = radius * (0.45 + Math.random() * 0.5);
      const s = mesh(geo.shard, i % 3 ? '#9fd8ff' : '#ffffff', 0.85);
      s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      s.rotation.set(Math.random() * 0.6, a, Math.random() * 0.6);
      s.userData.h = 0.6 + Math.random() * 0.8;
      g.add(s); shards.push(s);
    }
    g.position.set(p.x, p.y, p.z);
    add(g, 1.1, (k) => {
      const up = Math.min(1, k * 5);
      for (const s of shards) s.scale.set(0.25 * up, s.userData.h * up, 0.25 * up);
      fade(g, k < 0.6 ? 0.85 : 0.85 * (1 - (k - 0.6) / 0.4));
    });
  }
  function slam(p, radius, color, dust) {
    ring(p, color, 0.4, radius, 0.55);
    ring(p, dust, 0.2, radius * 0.7, 0.8, 0.05);
    burst(new THREE.Vector3(p.x, p.y + 0.2, p.z), dust, 22, radius * 1.2, 0.8, 3);
  }
  function harvest(p, heading, radius) {
    // a golden crescent sweeping round in front of you
    const arc = new THREE.Mesh(new THREE.RingGeometry(radius * 0.55, radius, 40, 1, 0, Math.PI * 1.4), glow('#ffd862', 0.8));
    arc.rotation.x = -Math.PI / 2;
    arc.position.set(p.x, p.y + 0.9, p.z);
    add(arc, 0.4, (k) => { arc.rotation.z = heading - Math.PI * 0.2 + k * Math.PI * 1.2; fade(arc, 0.8 * (1 - k)); });
    arc.userData.disposeGeo = true;
  }
  function healRise(p, h, color = '#7dff9a') {
    const pil = mesh(geo.pillar, color, 0.35);
    pil.position.set(p.x, p.y + h * 0.75, p.z);
    add(pil, 1, (k) => { pil.scale.set(0.9 - k * 0.3, h * 1.5, 0.9 - k * 0.3); fade(pil, 0.35 * Math.sin(k * Math.PI)); });
    for (let i = 0; i < 3; i++) setTimeout(() => {
      const r = mesh(geo.ring, color, 0.9);
      r.rotation.x = -Math.PI / 2;
      add(r, 0.9, (k) => { r.position.set(p.x, p.y + 0.1 + k * h * 1.2, p.z); r.scale.setScalar(0.8 - k * 0.3); fade(r, 0.9 * (1 - k)); });
    }, i * 180);
    burst(new THREE.Vector3(p.x, p.y + h * 0.3, p.z), color, 12, 1, 1, 3);
  }
  function aura(p, h, color, shellColor) {
    ring(p, color, 0.3, 3.5, 0.6);
    const s = mesh(geo.ball, shellColor || color, 0.35);
    s.position.set(p.x, p.y + h * 0.5, p.z);
    add(s, 0.7, (k) => { s.scale.set(0.7 + k * 0.3, h * 0.65, 0.7 + k * 0.3); fade(s, 0.35 * (1 - k)); });
  }
  function battleCry(p, h) {
    for (let i = 0; i < 3; i++) setTimeout(() => ring(p, '#ff6a3a', 0.4, 5 + i, 0.6, 0.15 + i * 0.4), i * 120);
    aura(p, h, '#ff9050');
  }
  function coins(p, h, n = 12) {
    for (let i = 0; i < n; i++) {
      const c = mesh(geo.coin, '#ffd24a', 1);
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2;
      const v = new THREE.Vector3(Math.cos(a) * s, 4 + Math.random() * 2, Math.sin(a) * s);
      c.position.set(p.x, p.y + h * 0.8, p.z);
      add(c, 0.9, (k, dt) => { c.position.addScaledVector(v, dt); v.y -= 12 * dt; c.rotation.x += dt * 12; fade(c, 1 - k * k); });
    }
  }
  function dash(path, color, smoke) {
    path.forEach((q, i) => setTimeout(() => puff(q, color, smoke ? 0.5 : 0.35, smoke ? 0.7 : 0.5, smoke ? 0.4 : 0.8), i * 12));
  }

  // `p` your feet, `h` your height, `to` where the target stands (if any), `path` the dash's steps
  function play(sk, { p, h = 1.8, heading = 0, to = null, path = [] }) {
    const id = sk.id;
    const from = chest(p, h);
    const hit = to ? new THREE.Vector3(to.x, to.y + (to.h || 1.6) * 0.6, to.z) : null;
    if (id === 'whirlwind') return whirlwind(p, h, sk.radius || 3.5);
    if (id === 'frost_nova') return frostNova(p, sk.radius || 5);
    if (id === 'ground_slam') return slam(p, sk.radius || 4, '#ffb060', '#8a6a44');
    if (id === 'harvest_swing') return harvest(p, heading, sk.radius || 3);
    if (id === 'battle_cry') return battleCry(p, h);
    if (id === 'iron_skin') return aura(p, h, '#c8d0dc', '#9aa4b4');
    if (id === 'quick_wall') { aura(p, h, '#b89a6a', '#8a7454'); return burst(from, '#8a7454', 16, 2, 0.7, 2); }
    if (id === 'blessing') return healRise(p, h, '#ffe68a');
    if (id === 'haggle') { aura(p, h, '#ffd24a'); return coins(p, h); }
    if (sk.type === 'heal') return healRise(p, h, id === 'hearty_meal' ? '#ffc070' : '#7dff9a');
    if (sk.type === 'dash') return dash(path, id === 'shadow_step' ? '#4a2a6a' : '#b9a98a', id === 'shadow_step');
    if (id === 'fire_bolt' && hit) {
      const ball = mesh(geo.ball, '#ff7a1a', 1);
      ball.scale.setScalar(0.45);
      return shot(ball, from, hit, 30, (q) => puff(q, '#ff9a3a', 0.22, 0.35, 0.4), () => { flash(hit, '#ffb040', 1.1); burst(hit, '#ff6a1a', 14, 3); });
    }
    if (id === 'arcane_lance' && hit) {
      const lance = mesh(geo.lance, '#c38aff', 1);
      const g = new THREE.Group(); g.add(lance); lance.rotation.x = Math.PI / 2;
      return shot(g, from, hit, 45, (q) => puff(q, '#a070ff', 0.15, 0.3, 0), () => { flash(hit, '#d0a0ff', 1.3); ring(to, '#b080ff', 0.3, 2, 0.5, 0.2); });
    }
    if (id === 'coin_toss' && hit) {
      const c = mesh(geo.coin, '#ffd24a', 1);
      return shot(c, from, hit, 28, null, () => { flash(hit, '#ffe070', 0.7); coins(to, 0.5, 5); });
    }
    if (sk.type === 'strike' && hit) {
      const color = { power_strike: '#ffcf60', backstab: '#ff4a6a', shield_bash: '#a8c8ff', hammer_blow: '#ff9a40' }[id] || '#ffffff';
      flash(hit, color, id === 'hammer_blow' || id === 'power_strike' ? 1.3 : 1);
      burst(hit, color, 12, 3);
      if (id === 'hammer_blow') ring(to, '#ff9a40', 0.3, 2.2, 0.5);
      return;
    }
    if (hit) flash(hit, '#ffffff');
  }

  // A mage's spell in their own element, thrown from `from` to `to` (both Vector3)
  const ELEMENT_LOOK = {
    Fire: { core: '#ff7a1a', trail: '#ff9a3a', hit: '#ffb040' },
    Water: { core: '#3aa8ff', trail: '#8fd4ff', hit: '#bfe8ff' },
    Earth: { core: '#a07a4a', trail: '#7a5a3a', hit: '#c09a6a', rock: true },
    Wind: { core: '#d8f8e8', trail: '#e8fff4', hit: '#c8f0e0', swirl: true },
    Lightning: { core: '#fff27a', trail: '#ffffff', hit: '#fff8b0', zap: true },
    Nature: { core: '#6ad04a', trail: '#9aff7a', hit: '#c0ff9a' },
    Light: { core: '#fff2c0', trail: '#ffffff', hit: '#fff6d8' },
    Dark: { core: '#7a3aa8', trail: '#3a1a5a', hit: '#a060d0' },
  };
  function spell(element, from, to) {
    const L = ELEMENT_LOOK[element] || ELEMENT_LOOK.Light;
    if (L.zap) {
      // lightning: a jagged bolt that's there at once and flickers out
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const q = from.clone().lerp(to, i / 10);
        if (i > 0 && i < 10) q.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6));
        pts.push(q);
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: L.core, transparent: true, blending: THREE.AdditiveBlending }));
      line.userData.disposeGeo = true;
      add(line, 0.25, (k) => { line.material.opacity = (1 - k) * (Math.random() > 0.3 ? 1 : 0.3); });
      flash(to, L.hit, 0.9);
      burst(to, L.hit, 10, 3, 0.4);
      return;
    }
    const g = new THREE.Group();
    const core = mesh(L.rock ? geo.shard : geo.ball, L.core, 1);
    core.scale.setScalar(L.rock ? 0.3 : 0.28);
    g.add(core);
    if (L.swirl) { const r = mesh(geo.ring, L.core, 0.8); r.scale.setScalar(0.45); g.add(r); }
    else { const halo = mesh(geo.ball, L.trail, 0.35); halo.scale.setScalar(0.45); g.add(halo); }
    shot(g, from, to, L.rock ? 22 : 28, (q) => puff(q, L.trail, 0.18, 0.35, L.rock ? -0.5 : 0.3), () => {
      flash(to, L.hit, 1);
      burst(to, L.hit, 12, 3, 0.6);
      if (L.rock) burst(to, '#6a5a4a', 8, 2.5, 0.7, 3);
    });
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      e.t += dt;
      const k = Math.min(1, e.t / e.life);
      e.step(k, dt);
      if (k >= 1) {
        scene.remove(e.obj);
        e.obj.traverse((m) => { if (m.material) { m.material.map?.dispose?.(); m.material.dispose(); } if (m.userData.disposeGeo) m.geometry.dispose(); });
        live.splice(i, 1);
      }
    }
  }
  function clear() { for (const e of live) scene.remove(e.obj); live.length = 0; }

  return { play, spell, update, clear };
}

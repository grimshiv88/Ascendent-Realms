// The practice monster in every Academy: a tame goblin (a slime at the Mages' and Herbalists'
// Academies) kept beside the training mat. It does no harm, but now and then it lunges and knocks
// you back. It only gives way to blows struck in the way the Academy teaches, so each school beats
// it differently: face to face with quick feet (Sword), hitting back right after it strikes
// (Shield), from behind (Scouts), from afar with a spark of magic (Magic) or a thrown vial
// (Herbalists), with calm unhurried blows (Healing), on the beat like at the anvil (Smiths), on the
// move (Farmers), standing firm (Builders), or after studying it first (Merchants).
import * as THREE from 'three';

export const PRACTICE_HITS = 8;     // blows (struck the right way) to beat it
const LUNGE_EVERY = 4;              // seconds between lunges while you are close
const WINDUP = 0.7;                 // it crouches this long before it lunges
const LUNGE_REACH = 1.7;            // a lunge catches you this close
const BEAT = 1.2;                   // the Smiths' beat
const DOWN_FOR = 8;                 // seconds it lies beaten before it gets up again

// Each school's way: `how` is what the teacher tells you; `ok(h)` says whether a blow counts.
// h = { range, behind, moving, still, sinceSwing, sinceLunge, caught, onBeat, studied }
export const PRACTICE_WAYS = {
  swordsman: { how: 'Face it and cut, and keep your feet moving: if its lunge catches you, it gets its breath back.', ok: () => true, swordFeet: true },
  tank: { how: 'Stand your ground and let it strike first, then hit back straight away.', ok: (h) => h.caught && h.sinceLunge < 1.6 },
  assassin: { how: 'Get behind it before you strike. It turns to face you, so circle round it.', ok: (h) => h.behind },
  mage: { how: 'Stay back at least 4 m and strike: your spark of magic flies to it. Blows up close do nothing.', ok: (h) => h.range, ranged: 'spark' },
  potion_maker: { how: 'Stand back at least 4 m and strike to throw a practice vial at it. Up close it does nothing.', ok: (h) => h.range, ranged: 'vial' },
  healer: { how: 'Calm, steady blows: wait a breath (a second and a half) between strikes. Rushed blows do not count.', ok: (h) => h.sinceSwing >= 1.5 },
  blacksmith: { how: 'Strike on the beat, like at the anvil: hit as the gold ring under it flashes.', ok: (h) => h.onBeat, beat: true },
  farmer: { how: 'Keep moving as you swing, the way you work a field. Blows struck standing still do not count.', ok: (h) => h.moving },
  builder: { how: 'Stand firm and swing: plant your feet a moment before each blow.', ok: (h) => h.still },
  businessman: { how: 'Study it first: look at it from close by for 2 seconds without striking, then you have 3 good blows.', ok: (h) => h.studied },
};
export const practiceName = (school) => (school === 'mage' || school === 'potion_maker' ? 'Practice Slime' : 'Practice Goblin');

// `p` is the Academy's practice monster from interiors.js: { body, x, z (world), ox, oz (the
// interior's origin), school }. `fx` has say(text, kind) (short, over your head), tip(text) (a longer
// line at the top of the screen) and float(text, at, kind).
export function createPractice(p, fx) {
  const way = PRACTICE_WAYS[p.school] || PRACTICE_WAYS.swordsman;
  const now = () => performance.now() / 1000;
  const st = { hp: PRACTICE_HITS, downUntil: 0, nextLunge: now() + 2, windup: 0, lunging: 0, lastLunge: -99, caught: false,
    lastSwing: -99, stillSince: now(), faceSince: null, credit: 0, told: 0, wrongAt: 0, facing: p.body.rotation.y, beat0: now() };
  const home = { x: p.body.position.x, z: p.body.position.z };
  // the Smiths' beat: a gold ring at its feet that flashes on every beat
  let ring = null;
  if (way.beat) {
    ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 28), new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(home.x, 0.03, home.z);
    p.body.parent.add(ring);
  }
  const shots = []; // sparks and vials in the air
  const shotMat = way.ranged === 'vial' ? new THREE.MeshStandardMaterial({ color: '#5ad04a', emissive: '#2a8a2a', emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })
    : new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
  const at = () => ({ x: p.ox + p.body.position.x, z: p.oz + p.body.position.z });
  const where = (h = 1.2) => new THREE.Vector3(at().x, h, at().z);
  const beaten = () => now() < st.downUntil;

  function update(you, speed) {
    const t = now();
    const m = at();
    const dx = you.x - m.x, dz = you.z - m.z, d = Math.hypot(dx, dz);
    // feet still or moving (for the Builders and the Farmers)
    if (speed > 0.3) st.stillSince = t;
    if (beaten()) {
      p.body.rotation.z = Math.min(Math.PI / 2, p.body.rotation.z + 0.08);
      return null;
    }
    if (p.body.rotation.z > 0) { p.body.rotation.z = Math.max(0, p.body.rotation.z - 0.05); if (p.body.rotation.z === 0) st.hp = PRACTICE_HITS; }
    // the first time you come close, the teacher's word on how this Academy fights it
    if (d < 5 && t - st.told > 120) { st.told = t; fx.tip(`${practiceName(p.school)}: ${way.how}`); }
    // it turns to face you, slowly (so a Scout can get round behind it)
    const want = Math.atan2(dx, dz);
    let diff = Math.atan2(Math.sin(want - st.facing), Math.cos(want - st.facing));
    st.facing += Math.max(-0.025, Math.min(0.025, diff));
    p.body.rotation.y = st.facing;
    // the Merchants study it: close by and facing it, without striking
    if (way === PRACTICE_WAYS.businessman) {
      if (d < 6) { st.faceSince ??= t; if (t - st.faceSince >= 2 && st.credit === 0 && t - st.lastSwing > 2) { st.credit = 3; fx.say('You have its measure: 3 good blows', 'exp'); } }
      else st.faceSince = null;
    }
    // the Smiths' beat
    if (ring) { const ph = ((t - st.beat0) % BEAT) / BEAT; ring.material.opacity = ph < 0.18 || ph > 0.85 ? 0.95 : 0.2; }
    // lunges, while you are close: it crouches (and glows), springs, and comes back
    let knock = null;
    if (d < 3.2 && !st.windup && !st.lunging && t >= st.nextLunge) st.windup = t;
    if (st.windup) {
      const k = (t - st.windup) / WINDUP;
      p.body.position.y = -0.12 * Math.sin(Math.min(1, k) * Math.PI / 2);
      if (k >= 1) { st.windup = 0; st.lunging = t; st.lastLunge = t; st.caught = d < LUNGE_REACH;
        if (st.caught) {
          knock = { x: (dx / (d || 1)) * 0.9, z: (dz / (d || 1)) * 0.9 };
          if (way.swordFeet && st.hp < PRACTICE_HITS) { st.hp = Math.min(PRACTICE_HITS, st.hp + 2); fx.say('It caught you and got its breath back: keep your feet moving!', 'hurt'); }
          else if (p.school === 'tank') fx.say('It strikes! Hit back now!', 'note');
          else fx.say('It knocks you back!', 'note');
        }
      }
    }
    if (st.lunging) {
      const k = (t - st.lunging) / 0.45;
      const s = k < 0.4 ? k / 0.4 : Math.max(0, 1 - (k - 0.4) / 0.6);
      p.body.position.x = home.x + Math.sin(st.facing) * 0.6 * s;
      p.body.position.z = home.z + Math.cos(st.facing) * 0.6 * s;
      p.body.position.y = 0;
      if (k >= 1) { st.lunging = 0; st.nextLunge = t + LUNGE_EVERY; p.body.position.x = home.x; p.body.position.z = home.z; }
    } else if (!st.windup) p.body.position.y = 0.03 * Math.sin(t * 3);
    // sparks and vials fly
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const k = Math.min(1, (t - s.t0) / s.dur);
      s.mesh.position.lerpVectors(s.from, s.to, k);
      s.mesh.position.y += Math.sin(k * Math.PI) * (way.ranged === 'vial' ? 0.8 : 0.2);
      if (k >= 1) { s.mesh.parent?.remove(s.mesh); shots.splice(i, 1); s.land(); }
    }
    return knock;
  }

  // a blow (or a throw, for the ranged schools); returns true if it was aimed at the practice monster
  function swing(you, heading, speed) {
    const t = now();
    const m = at();
    const dx = m.x - you.x, dz = m.z - you.z, d = Math.hypot(dx, dz);
    const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - heading), Math.cos(Math.atan2(dx, dz) - heading)));
    const close = d < 1.9 && off < 1.1;
    const far = d >= 4 && d < 10 && off < 0.45;
    if (!close && !(way.ranged && far)) return false;
    if (beaten()) { fx.say('It is still catching its breath', 'note'); return true; }
    // was it struck from behind? (it faces st.facing; you are behind when you stand opposite)
    const fromIt = Math.atan2(-dx, -dz);
    const behind = Math.abs(Math.atan2(Math.sin(fromIt - st.facing), Math.cos(fromIt - st.facing))) > 1.9;
    const ph = ((t - st.beat0) % BEAT) / BEAT;
    const h = { range: !!way.ranged && far, behind, moving: speed > 0.6, still: t - st.stillSince > 0.8, sinceSwing: t - st.lastSwing,
      sinceLunge: t - st.lastLunge, caught: st.caught, onBeat: ph < 0.25 || ph > 0.85, studied: st.credit > 0 };
    st.lastSwing = t;
    st.faceSince = null;
    const good = way.ok(h);
    if (good && st.credit > 0) st.credit--;
    if (good && way.ranged) {
      // the spark or the vial flies, and the blow lands when it gets there
      const mesh = new THREE.Mesh(way.ranged === 'vial' ? new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8) : new THREE.SphereGeometry(0.12, 10, 8), shotMat);
      p.body.parent.add(mesh);
      const from = new THREE.Vector3(you.x - p.ox, 1, you.z - p.oz), to = new THREE.Vector3(p.body.position.x, 0.7, p.body.position.z);
      shots.push({ mesh, from, to, t0: t, dur: Math.max(0.2, d / 14), land: () => land() });
      return true;
    }
    if (good) { land(); return true; }
    if (t - st.wrongAt > 2.5) { st.wrongAt = t; fx.say('Not the way of this Academy', 'hurt'); fx.tip(`That blow doesn't count. ${way.how}`); }
    fx.float('Miss', where(1.5), '');
    return true;
  }
  function land() {
    if (beaten()) return;
    st.hp--;
    fx.float(st.hp > 0 ? `${PRACTICE_HITS - st.hp} / ${PRACTICE_HITS}` : 'Beaten!', where(1.6), 'dmg');
    if (st.hp <= 0) { st.downUntil = now() + DOWN_FOR; st.windup = 0; st.lunging = 0; p.body.position.set(home.x, 0, home.z); fx.won?.(); }
  }
  return { update, swing, get way() { return way; } };
}

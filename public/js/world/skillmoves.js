// How the body acts out each skill: its own move instead of one shared spin. Ground Slam lifts a
// leg high and stomps it into the ground, Hammer Blow brings both arms down overhead, Fire Bolt
// winds up and throws, Battle Cry flexes and roars, Hearty Meal eats, and so on.
// Each move has a length (seconds) and the moment its blow lands (hit, 0..1 of the length), when
// the skill's effect is shown, so the dust flies just as the foot comes down.
// pose(r, k) sets the joints for progress k (0..1). r: { arms, legs, spine, head, root, bodyH,
// avatar, heading }. arms[0] is the weapon arm. Joint angles in radians: shoulder.x negative raises
// the arm forward and up, shoulder.z (times side) lifts it out sideways, elbow.x negative bends it;
// hip.x negative lifts the leg forward, knee.x positive bends it; spine.x positive leans forward.

const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const L = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
// progress through one phase [a, b] of the move, eased
const ph = (k, a, b) => ease(clamp((k - a) / (b - a)));
// a value through keyframes [[k, v], ...]: holds the first before it and the last after it
function key(k, frames) {
  if (k <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [k1, v1] = frames[i], [k0, v0] = frames[i - 1];
    if (k <= k1) return L(v0, v1, ease((k - k0) / (k1 - k0)));
  }
  return frames[frames.length - 1][1];
}
function arm(a, sx, sz, ex) {
  if (!a) return;
  a.shoulder.rotation.x = sx;
  a.shoulder.rotation.z = a.side * sz;
  a.elbow.rotation.x = ex;
}
// bend both knees by angle `a` and lower the body so the feet stay on the ground
function crouch(r, a, only = null) {
  if (!r.legs) return;
  for (const [i, l] of r.legs.entries()) {
    if (only !== null && i !== only) continue;
    l.hip.rotation.x = -a;
    l.knee.rotation.x = 2 * a;
  }
  if (only === null) r.root.position.y = r.baseY - r.bodyH * 0.47 * (1 - Math.cos(a));
}
const lean = (r, x, y = 0) => { if (r.spine) { r.spine.rotation.x = x; r.spine.rotation.y = y; } };
const lunge = (r, d) => { r.root.position.z = d * r.bodyH; };

export const MOVES = {
  // lift one knee high, then stamp the foot into the ground with both fists coming down
  stomp: { dur: 0.85, hit: 0.52, pose(r, k) {
    const [A, B] = r.arms || [], leg = r.legs?.[0];
    const lift = ph(k, 0, 0.4), down = ph(k, 0.4, 0.52), back = ph(k, 0.72, 1);
    const fists = key(k, [[0, 0], [0.4, -2.5], [0.52, -0.5], [0.72, -0.5], [1, 0]]);
    arm(A, fists, 0.15, -0.5 * (1 - back)); arm(B, fists, 0.15, -0.5 * (1 - back));
    const sq = key(k, [[0, 0], [0.4, 0.12], [0.52, 0.45], [0.72, 0.4], [1, 0]]);
    crouch(r, sq);
    if (leg) {
      leg.hip.rotation.x = L(L(-sq, -1.55, lift), -sq * 0.6, down) * (1 - back) + -sq * back;
      leg.knee.rotation.x = L(L(2 * sq, 1.8, lift), sq * 1.2, down) * (1 - back) + 2 * sq * back;
    }
    lean(r, key(k, [[0, 0], [0.4, -0.18], [0.52, 0.4], [0.72, 0.35], [1, 0]]));
  } },
  // spin round once with the weapon held out (Whirlwind is the one skill that turns you)
  spin: { dur: 0.6, hit: 0, pose(r, k) {
    const up = Math.sin(k * Math.PI);
    r.avatar.rotation.y = r.heading + ease(k) * Math.PI * 2;
    for (const a of r.arms || []) arm(a, -0.4 * up, 1.35 * up, -0.1);
    crouch(r, 0.25 * up);
  } },
  // a wide low scything sweep across the front, from one side to the other
  scythe: { dur: 0.7, hit: 0.5, pose(r, k) {
    const [A, B] = r.arms || [];
    const tw = key(k, [[0, 0], [0.3, 0.9], [0.6, -0.9], [1, 0]]);
    arm(A, key(k, [[0, 0], [0.3, 0.2], [0.6, -1.4], [1, 0]]), key(k, [[0, 0], [0.3, 1.3], [0.6, 0.3], [1, 0]]), -0.2);
    arm(B, -0.5 * Math.sin(k * Math.PI), 0.2, -1.2 * Math.sin(k * Math.PI));
    crouch(r, 0.35 * Math.sin(k * Math.PI));
    lean(r, 0.2 * Math.sin(k * Math.PI), tw);
  } },
  // arms crossed tight over the chest, gathering cold, then flung out wide as the burst goes off
  nova: { dur: 0.8, hit: 0.5, pose(r, k) {
    const gather = ph(k, 0, 0.42), fling = ph(k, 0.42, 0.52), back = ph(k, 0.75, 1);
    for (const a of r.arms || []) {
      const sx = L(L(0, -1.35, gather), -0.25, fling) * (1 - back);
      const sz = L(L(0, -0.65, gather), 1.5, fling) * (1 - back);
      arm(a, sx, sz, L(L(0, -1.4, gather), 0, fling) * (1 - back));
    }
    crouch(r, key(k, [[0, 0], [0.42, 0.45], [0.52, 0.1], [1, 0]]));
    lean(r, key(k, [[0, 0], [0.42, 0.35], [0.52, -0.2], [0.75, -0.2], [1, 0]]));
  } },
  // a big overhead blow with a step into it
  overhead: { dur: 0.6, hit: 0.5, pose(r, k) {
    const [A, B] = r.arms || [];
    arm(A, key(k, [[0, -0.35], [0.35, -2.8], [0.5, -0.4], [0.75, -0.4], [1, -0.35]]), 0.1, key(k, [[0, -0.85], [0.35, -0.4], [0.5, -0.2], [1, -0.85]]));
    arm(B, -0.4 * Math.sin(k * Math.PI), 0.3, -1 * Math.sin(k * Math.PI));
    const st = key(k, [[0, 0], [0.35, 0.1], [0.5, 1], [0.75, 1], [1, 0]]);
    if (r.legs?.[1]) { r.legs[1].hip.rotation.x = -0.6 * st; r.legs[1].knee.rotation.x = 0.4 * st; }
    lean(r, key(k, [[0, 0], [0.35, -0.2], [0.5, 0.35], [0.75, 0.3], [1, 0]]));
    lunge(r, 0.12 * st);
  } },
  // both arms raised high together, then a crushing blow straight down into a crouch
  hammer: { dur: 0.75, hit: 0.55, pose(r, k) {
    const sx = key(k, [[0, 0], [0.4, -2.95], [0.55, -0.3], [0.78, -0.3], [1, 0]]);
    for (const a of r.arms || []) arm(a, sx, -0.15, key(k, [[0, -0.3], [0.4, -0.5], [0.55, 0], [1, -0.3]]));
    crouch(r, key(k, [[0, 0], [0.4, 0.08], [0.55, 0.45], [0.78, 0.4], [1, 0]]));
    lean(r, key(k, [[0, 0], [0.4, -0.25], [0.55, 0.55], [0.78, 0.5], [1, 0]]));
  } },
  // drop low, blade drawn back, then a quick upward thrust
  thrust: { dur: 0.5, hit: 0.55, pose(r, k) {
    const [A, B] = r.arms || [];
    arm(A, key(k, [[0, -0.35], [0.35, 0.55], [0.55, -1.45], [0.8, -1.3], [1, -0.35]]), 0.1, key(k, [[0, -0.85], [0.35, -1.8], [0.55, 0], [0.8, -0.1], [1, -0.85]]));
    arm(B, 0.4 * Math.sin(k * Math.PI), 0.4 * Math.sin(k * Math.PI), -0.6);
    crouch(r, key(k, [[0, 0], [0.35, 0.5], [0.55, 0.35], [1, 0]]));
    lean(r, key(k, [[0, 0], [0.35, 0.45], [0.55, 0.3], [1, 0]]));
    lunge(r, key(k, [[0, 0], [0.35, 0], [0.55, 0.2], [0.8, 0.15], [1, 0]]));
  } },
  // guard arm up in front, then a lunge that drives it into the foe
  bash: { dur: 0.55, hit: 0.5, pose(r, k) {
    const [A, B] = r.arms || [];
    arm(B, key(k, [[0, 0], [0.3, -1.3], [0.5, -1.6], [0.75, -1.5], [1, 0]]), -0.2, key(k, [[0, 0], [0.3, -1.5], [0.5, -0.3], [1, 0]]));
    arm(A, -0.3, 0.2, -1.2 * Math.sin(k * Math.PI));
    const st = key(k, [[0, 0], [0.3, 0], [0.5, 1], [0.75, 1], [1, 0]]);
    if (r.legs?.[1]) { r.legs[1].hip.rotation.x = -0.7 * st; r.legs[1].knee.rotation.x = 0.5 * st; }
    lean(r, 0.3 * st, -0.3 * st);
    lunge(r, 0.25 * st);
  } },
  // lunge in with both hands clawing and the head going forward to bite
  bite: { dur: 0.55, hit: 0.5, pose(r, k) {
    const st = key(k, [[0, 0], [0.3, -0.2], [0.5, 1], [0.75, 1], [1, 0]]);
    for (const a of r.arms || []) arm(a, -1.5 * clamp(st), 0.25, key(k, [[0, 0], [0.3, -0.2], [0.5, -0.7], [1, 0]]));
    if (r.head) r.head.rotation.x = r.headBase + 0.35 * clamp(st);
    lean(r, 0.45 * st);
    lunge(r, 0.25 * clamp(st));
  } },
  // wind the throwing arm back and hurl it forward with a step
  throw: { dur: 0.6, hit: 0.5, pose(r, k) {
    const [A, B] = r.arms || [];
    arm(A, key(k, [[0, 0], [0.35, 1.1], [0.5, -1.7], [0.7, -1.5], [1, 0]]), 0.25, key(k, [[0, 0], [0.35, -1.5], [0.5, 0], [1, 0]]));
    arm(B, key(k, [[0, 0], [0.35, -1.2], [0.5, 0.4], [1, 0]]), 0.2, -0.4);
    const st = key(k, [[0, 0], [0.35, 0], [0.5, 1], [0.75, 1], [1, 0]]);
    if (r.legs?.[1]) { r.legs[1].hip.rotation.x = -0.55 * st; r.legs[1].knee.rotation.x = 0.35 * st; }
    lean(r, key(k, [[0, 0], [0.35, -0.2], [0.5, 0.3], [1, 0]]), key(k, [[0, 0], [0.35, 0.6], [0.5, -0.3], [1, 0]]));
  } },
  // both hands drawn back to one side, charging, then thrust forward together
  lance: { dur: 0.75, hit: 0.55, pose(r, k) {
    const pull = ph(k, 0, 0.42), shove = ph(k, 0.42, 0.55), back = ph(k, 0.78, 1);
    for (const a of r.arms || []) arm(a, L(L(0, 0.6, pull), -1.55, shove) * (1 - back), L(L(0, -0.3, pull), 0, shove), L(L(0, -1.6, pull), 0, shove) * (1 - back));
    lean(r, key(k, [[0, 0], [0.42, -0.1], [0.55, 0.3], [0.78, 0.3], [1, 0]]), key(k, [[0, 0], [0.42, 0.5], [0.55, 0], [1, 0]]));
    crouch(r, key(k, [[0, 0], [0.42, 0.3], [0.55, 0.15], [1, 0]]));
    lunge(r, key(k, [[0, 0], [0.42, -0.05], [0.55, 0.12], [0.78, 0.1], [1, 0]]));
  } },
  // a sidearm flick, like skipping a stone (or a coin)
  flick: { dur: 0.5, hit: 0.45, pose(r, k) {
    const [A, B] = r.arms || [];
    arm(A, key(k, [[0, 0], [0.3, -0.2], [0.45, -1.3], [0.7, -1.2], [1, 0]]), key(k, [[0, 0], [0.3, 1.1], [0.45, 0.2], [1, 0]]), key(k, [[0, 0], [0.3, -1.6], [0.45, 0], [1, 0]]));
    arm(B, -0.2, 0.45 * Math.sin(k * Math.PI), -1.5 * Math.sin(k * Math.PI)); // (hand on the hip)
    lean(r, 0.1 * Math.sin(k * Math.PI), key(k, [[0, 0], [0.3, 0.5], [0.45, -0.3], [1, 0]]));
  } },
  // charge head down, a shoulder first, the legs driving
  charge: { dur: 0.5, hit: 0, pose(r, k) {
    const up = Math.sin(k * Math.PI);
    const [A, B] = r.arms || [];
    arm(A, 0.6 * up, 0.25 * up, -1.2 * up); arm(B, -0.7 * up, -0.2 * up, -1.5 * up);
    if (r.legs) r.legs.forEach((l, i) => { const s = Math.sin(k * Math.PI * 4 + i * Math.PI); l.hip.rotation.x = -0.6 * s * up; l.knee.rotation.x = 0.8 * Math.max(0, -s) * up; });
    lean(r, 0.55 * up, -0.25 * up);
  } },
  // a low, bent-over sprint with both arms swept back
  shadow: { dur: 0.5, hit: 0, pose(r, k) {
    const up = Math.sin(k * Math.PI);
    for (const a of r.arms || []) arm(a, 1.1 * up, 0.2 * up, -0.2);
    crouch(r, 0.55 * up);
    lean(r, 0.75 * up);
  } },
  // curl in, then throw the arms up and out, flexed, chest out, head back: a roar
  roar: { dur: 1, hit: 0.38, pose(r, k) {
    const curl = ph(k, 0, 0.28), burst = ph(k, 0.28, 0.4), back = ph(k, 0.8, 1);
    for (const a of r.arms || []) arm(a, L(L(0, -0.4, curl), -0.3, burst) * (1 - back), L(L(0, 0.1, curl), 1.55, burst) * (1 - back), L(L(0, -2, curl), -1.6, burst) * (1 - back));
    crouch(r, L(L(0, 0.3, curl), 0.12, burst) * (1 - back));
    lean(r, L(L(0, 0.3, curl), -0.3, burst) * (1 - back));
    if (r.head) r.head.rotation.x = r.headBase + L(L(0, 0.2, curl), -0.45, burst) * (1 - back);
  } },
  // plant the feet wide, sink, and flex every muscle to harden like iron
  brace: { dur: 0.9, hit: 0.45, pose(r, k) {
    const go = ph(k, 0, 0.4), back = ph(k, 0.75, 1), pulse = Math.sin(clamp((k - 0.4) / 0.35) * Math.PI) * 0.15;
    const a = go * (1 - back);
    for (const x of r.arms || []) arm(x, -0.55 * a, (0.45 + pulse) * a, (-2 - pulse) * a);
    crouch(r, 0.35 * a);
    if (r.legs) for (const l of r.legs) l.hip.rotation.z = l.side * 0.25 * a;
    lean(r, 0.12 * a);
  } },
  // crouch with the hands low, then rise and push both palms up and forward, raising the wall
  raise: { dur: 0.85, hit: 0.55, pose(r, k) {
    for (const a of r.arms || []) arm(a, key(k, [[0, 0], [0.4, -0.5], [0.55, -2.1], [0.8, -2], [1, 0]]), 0.15, key(k, [[0, 0], [0.4, -0.3], [0.55, 0], [1, 0]]));
    crouch(r, key(k, [[0, 0], [0.4, 0.5], [0.55, 0.05], [1, 0]]));
    lean(r, key(k, [[0, 0], [0.4, 0.45], [0.55, -0.1], [0.8, -0.1], [1, 0]]));
  } },
  // hands together in front, then lifted to the sky, face turned up
  pray: { dur: 1, hit: 0.55, pose(r, k) {
    const join = ph(k, 0, 0.3), lift = ph(k, 0.3, 0.55), back = ph(k, 0.8, 1);
    for (const a of r.arms || []) arm(a, L(L(0, -1, join), -2.9, lift) * (1 - back), L(L(0, -0.4, join), 0.3, lift) * (1 - back), L(L(0, -1.3, join), 0, lift) * (1 - back));
    lean(r, L(L(0, 0.15, join), -0.15, lift) * (1 - back));
    if (r.head) r.head.rotation.x = r.headBase + L(L(0, 0.25, join), -0.35, lift) * (1 - back);
  } },
  // both hands pressed to the chest, head bowed, then opened outward as the wound closes
  mend: { dur: 0.9, hit: 0.5, pose(r, k) {
    const press = ph(k, 0, 0.35), open = ph(k, 0.5, 0.7), back = ph(k, 0.8, 1);
    for (const a of r.arms || []) arm(a, L(L(0, -0.75, press), -0.5, open) * (1 - back), L(L(0, -0.55, press), 0.8, open) * (1 - back), L(L(0, -2, press), -0.4, open) * (1 - back));
    if (r.head) r.head.rotation.x = r.headBase + L(L(0, 0.35, press), -0.1, open) * (1 - back);
    lean(r, L(L(0, 0.15, press), 0, open) * (1 - back));
  } },
  // bent over, hands on the knees, panting, then straightening up with a deep breath
  breathe: { dur: 1, hit: 0.6, pose(r, k) {
    const bend = ph(k, 0, 0.3), up = ph(k, 0.55, 0.75), back = ph(k, 0.85, 1);
    const pant = Math.sin(k * Math.PI * 8) * 0.04 * (1 - up);
    for (const a of r.arms || []) arm(a, L(L(0, -0.55, bend), -0.15, up) * (1 - back), L(L(0, 0.1, bend), 0.65, up) * (1 - back), L(L(0, -0.1, bend), -0.3, up) * (1 - back));
    crouch(r, L(L(0, 0.3, bend), 0, up));
    lean(r, L(L(0, 0.65 + pant, bend), -0.2, up) * (1 - back));
    if (r.head) r.head.rotation.x = r.headBase + L(L(0, -0.3, bend), -0.25, up) * (1 - back);
  } },
  // a hand to the mouth twice, eating, the other on the belly
  eat: { dur: 1.1, hit: 0.6, pose(r, k) {
    const [A, B] = r.arms || [];
    const on = ph(k, 0, 0.15) * (1 - ph(k, 0.85, 1));
    const bites = 0.5 + 0.5 * Math.cos(clamp((k - 0.15) / 0.7) * Math.PI * 4);
    arm(A, L(-0.6, -1.15, bites) * on, -0.35 * on, L(-1.4, -2.35, bites) * on);
    arm(B, -0.45 * on, -0.45 * on, -1.5 * on);
    if (r.head) r.head.rotation.x = r.headBase + 0.12 * bites * on;
  } },
  // the weapon hand flicks a coin up into the air, the other hand on the hip
  coin: { dur: 0.8, hit: 0.45, pose(r, k) {
    const [A, B] = r.arms || [];
    arm(A, key(k, [[0, 0], [0.3, -0.6], [0.45, -1.7], [0.7, -1.4], [1, 0]]), 0.1, key(k, [[0, 0], [0.3, -1.7], [0.45, -0.3], [0.7, -0.6], [1, 0]]));
    arm(B, -0.2, 0.5 * Math.sin(k * Math.PI), -1.6 * Math.sin(k * Math.PI));
    if (r.head) r.head.rotation.x = r.headBase + key(k, [[0, 0], [0.45, 0], [0.65, -0.4], [1, 0]]);
  } },
  // a magic bolt from both hands pushed forward
  cast: { dur: 0.6, hit: 0.45, pose(r, k) {
    for (const a of r.arms || []) arm(a, key(k, [[0, 0], [0.3, -0.7], [0.45, -1.5], [0.75, -1.45], [1, 0]]), key(k, [[0, 0], [0.3, -0.2], [0.45, 0.05], [1, 0]]), key(k, [[0, 0], [0.3, -1.5], [0.45, -0.1], [1, 0]]));
    lean(r, key(k, [[0, 0], [0.3, -0.1], [0.45, 0.2], [1, 0]]));
  } },
};

// which move a skill uses: by its own name first, then (Unique Skills and anything new) by its kind
const BY_ID = {
  ground_slam: 'stomp', whirlwind: 'spin', frost_nova: 'nova', harvest_swing: 'scythe',
  power_strike: 'overhead', hammer_blow: 'hammer', backstab: 'thrust', shield_bash: 'bash',
  fire_bolt: 'throw', arcane_lance: 'lance', coin_toss: 'flick',
  charge: 'charge', shadow_step: 'shadow',
  battle_cry: 'roar', iron_skin: 'brace', quick_wall: 'raise', blessing: 'pray', haggle: 'coin',
  mend: 'mend', second_wind: 'breathe', hearty_meal: 'eat',
};
const BY_KIND = { strike: 'overhead', devour: 'bite', sweep: 'scythe', freeze: 'nova', bolt: 'lance', dash: 'charge', heal: 'mend', fury: 'roar', ward: 'brace' };
const BY_TYPE = { strike: 'overhead', sweep: 'scythe', bolt: 'cast', dash: 'charge', heal: 'mend', buff: 'roar' };
export function moveFor(sk) {
  const name = BY_ID[sk.id] || (sk.unique && BY_KIND[sk.kind]) || (sk.type === 'buff' && sk.stat === 'def' ? 'brace' : BY_TYPE[sk.type]) || 'cast';
  return { name, ...MOVES[name] };
}

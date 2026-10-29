// Sculpts a body plan (humanoid.js) into skinned mesh data: the plan's shapes are posed in the
// sculpting pose (arms out, fingers apart, so nothing melts together), meshed in four parts (the
// body, the head and each hand, the head and hands on a finer grid), and every point gets weights
// for the bones that move it. Plain numbers and arrays only (no three.js), so it can run in a worker.
import { fieldDist, shapeDist, shapeBox } from './sdf.js';
import { meshField } from './mesher.js';
import { growHair } from './hair.js';

// grid sizes (metres, at the plan's own size) for each quality
export const DETAIL = {
  high: { body: 0.0075, head: 0.003, hand: 0.0022 },
  low: { body: 0.016, head: 0.0065, hand: 0.005 },
};

// 3x3 matrices, row-major
const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mul3 = (a, b) => {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
};
const apply3 = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const T3 = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
// three.js Euler 'XYZ': R = Rx * Ry * Rz
export function eulerXYZ([x, y, z]) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx], Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy], Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mul3(mul3(Rx, Ry), Rz);
}

// Where every bone is in the sculpting pose: { name: { R, t } }
export function sculptPose(plan) {
  const out = {};
  const byName = Object.fromEntries(plan.bones.map((b) => [b.name, b]));
  for (const b of plan.bones) {
    const R = b.bind ? eulerXYZ(b.bind) : I3();
    if (!b.parent) { out[b.name] = { R, t: [...b.pos] }; continue; }
    const p = out[b.parent], pb = byName[b.parent];
    const local = [b.pos[0] - pb.pos[0], b.pos[1] - pb.pos[1], b.pos[2] - pb.pos[2]];
    const w = apply3(p.R, local);
    out[b.name] = { R: mul3(p.R, R), t: [w[0] + p.t[0], w[1] + p.t[1], w[2] + p.t[2]] };
  }
  return out;
}

// Move each shape with its bone from the rest pose into the sculpting pose
function poseShapes(plan, pose) {
  const rest = Object.fromEntries(plan.bones.map((b) => [b.name, b.pos]));
  const move = (bone, p) => {
    const { R, t } = pose[bone];
    const r = rest[bone];
    const v = apply3(R, [p[0] - r[0], p[1] - r[1], p[2] - r[2]]);
    return [v[0] + t[0], v[1] + t[1], v[2] + t[2]];
  };
  return plan.shapes.map((s) => {
    const R = pose[s.bone].R;
    if (s.kind === 'cone') return { ...s, a: move(s.bone, s.a), b: move(s.bone, s.b), _ba: undefined };
    return { ...s, c: move(s.bone, s.c), m: mul3(s.m || I3(), T3(R)) };
  });
}

// Sculpt the plan. Returns { bones, pose, parts: { body, head, leftHand, rightHand } }, each part
// { positions, normals, indices, skinIndex, skinWeight, tint } (tint: a colour hint per point).
export function sculpt(plan, quality = 'high', { hair = 'short', hairSeed = 1 } = {}) {
  const q = DETAIL[quality] || DETAIL.high;
  const pose = sculptPose(plan);
  const shapes = poseShapes(plan, pose);
  const boneIndex = Object.fromEntries(plan.bones.map((b, i) => [b.name, i]));
  shapes.forEach((s) => { s.bi = boneIndex[s.bone]; });

  // where the hands and the head are cut from the body
  const cuts = [];
  for (const L of ['left', 'right']) {
    const h = pose[`${L}Hand`];
    const u = apply3(h.R, [0, -1, 0]);
    cuts.push({ name: `${L}Hand`, p: h.t, n: u, centre: add(h.t, scale(u, 0.09)), r: 0.17 });
  }
  const head = pose.head;
  // a plane under the chin, rising to the back of the neck
  const hn = norm3([0, 0.92, 0.39]);
  cuts.push({ name: 'head', p: [0, head.t[1] - 0.055, head.t[2] + 0.075], n: hn, centre: add(head.t, [0, 0.09, 0]), r: 0.24 });
  const side = (c, p) => dot(sub(p, c.p), c.n);
  const inBall = (c, p) => dist(p, c.centre) < c.r;

  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const s of shapes) { const b = shapeBox(s); for (let i = 0; i < 3; i++) { bounds[i] = Math.min(bounds[i], b[i]); bounds[i + 3] = Math.max(bounds[i + 3], b[i + 3]); } }

  const parts = {};
  const OVER = 0.02; // how far the finer parts reach into the body, under its skin
  // the body stops at each cut, and just before it sinks a little under the finer part's skin, so
  // the finer part always shows where the two overlap
  const bodyClip = (x, y, z, d) => {
    const p = [x, y, z];
    for (const c of cuts) {
      if (!inBall(c, p)) continue;
      const k = side(c, p);
      if (k > -OVER) d = Math.max(d + 0.002 * smooth01((k + OVER) / (OVER * 0.8)), k + 0.001);
    }
    return d;
  };
  parts.body = meshPart(shapes, bounds, q.body, bodyClip);
  for (const c of cuts) {
    const box = partBox(shapes, c, OVER);
    const clip = (x, y, z, d) => Math.max(d, -(side(c, [x, y, z]) + OVER));
    parts[c.name] = meshPart(shapes, box, c.name === 'head' ? q.head : q.hand, clip);
  }
  for (const part of Object.values(parts)) skinPart(part, shapes, plan);
  const face = faceSheet(plan, shapes, boneIndex.head);
  const headShapes = shapes.filter((s) => s.bone === 'head' && !s.sub);
  const locks = growHair(hair, headShapes, plan, hairSeed);
  if (locks) {
    const n = locks.positions.length / 3;
    locks.skinIndex = new Uint16Array(n * 4); locks.skinWeight = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) { locks.skinIndex[v * 4] = boneIndex.head; locks.skinWeight[v * 4] = 1; }
  }
  return { bones: plan.bones, pose, parts, face, hair: locks };
}

// A thin sheet lying on the face, for the painted eyes, brows and mouth: a grid seen from the front,
// each point dropped onto the skin and lifted a hair off it
function faceSheet(plan, shapes, headBone) {
  const hd = plan.hd, o = plan.headO;
  const near = shapes.filter((s) => s.bone === 'head' || s.bone === 'neck');
  const x0 = -0.074 * hd, x1 = 0.074 * hd, y0 = plan.mouth - 0.03 * hd, y1 = plan.eyes.y + 0.048 * hd;
  const NX = 56, NY = 52;
  const positions = [], normals = [], uvs = [], idx = [];
  const at = new Int32Array((NX + 1) * (NY + 1)).fill(-1);
  const f = (x, y, z) => fieldDist(near, x, y, z);
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const x = x0 + (x1 - x0) * i / NX, y = y0 + (y1 - y0) * j / NY;
    let z = o[2] + 0.25 * hd, d = 1;
    for (let it = 0; it < 120 && d > 1e-5; it++) { d = f(x, y, z); z -= Math.max(d, 1e-5); if (z < o[2] - 0.02) break; }
    if (z < o[2] - 0.02) continue;
    const e = 0.0004;
    let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
    if (gz < 0.15) continue; // the sides of the head, turned away
    at[j * (NX + 1) + i] = positions.length / 3;
    const lift = 0.0005 * hd;
    positions.push(x + gx * lift, y + gy * lift, z + gz * lift);
    normals.push(gx, gy, gz);
    uvs.push(i / NX, j / NY);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = at[j * (NX + 1) + i], b = at[j * (NX + 1) + i + 1], c = at[(j + 1) * (NX + 1) + i + 1], d = at[(j + 1) * (NX + 1) + i];
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    idx.push(a, b, c, a, c, d);
  }
  const n = positions.length / 3;
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) { skinIndex[v * 4] = headBone; skinWeight[v * 4] = 1; }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint32Array(idx), skinIndex, skinWeight, area: { x0, x1, y0, y1, hd, eyeY: plan.eyes.y, eyeX: plan.eyes.x, mouthY: plan.mouth } };
}

function meshPart(shapes, box, cell, clip) {
  const near = shapes.filter((s) => { const b = shapeBox(s); return b[0] <= box[3] && b[3] >= box[0] && b[1] <= box[4] && b[4] >= box[1] && b[2] <= box[5] && b[5] >= box[2]; });
  const out = meshField(near, box, cell, clip);
  out.shapes = near;
  return out;
}

// the box around everything beyond a cut (and a little before it)
function partBox(shapes, c, over) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const s of shapes) {
    const pts = s.kind === 'cone' ? [s.a, s.b] : [s.c];
    const r = s.kind === 'cone' ? Math.max(s.ra, s.rb) : Math.max(...s.r);
    for (const p of pts) {
      if (dist(p, c.centre) > c.r + r || dot(sub(p, c.p), c.n) < -over - r) continue;
      for (let i = 0; i < 3; i++) { box[i] = Math.min(box[i], p[i] - r - 0.01); box[i + 3] = Math.max(box[i + 3], p[i] + r + 0.01); }
    }
  }
  return box;
}

// Bone weights for each point: every shape near the surface there pulls on its bone, the nearer the
// stronger, so joints bend smoothly where two bones' shapes meet
function skinPart(part, allShapes, plan) {
  const shapes = part.shapes.filter((s) => !s.sub);
  const n = part.positions.length / 3;
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4), tint = new Uint8Array(n);
  const PARTS = { lips: 1, nail: 2, claw: 3 };
  const d = new Float64Array(shapes.length);
  const acc = new Map();
  for (let v = 0; v < n; v++) {
    const x = part.positions[v * 3], y = part.positions[v * 3 + 1], z = part.positions[v * 3 + 2];
    let m = Infinity, mi = 0;
    for (let k = 0; k < shapes.length; k++) { d[k] = shapeDist(shapes[k], x, y, z) - (shapes[k].inflate || 0); if (d[k] < m) { m = d[k]; mi = k; } }
    acc.clear();
    for (let k = 0; k < shapes.length; k++) {
      const tau = Math.max(0.0025, shapes[k].blend * 0.45);
      const e = (d[k] - m) / tau;
      if (e > 7) continue;
      const w = Math.exp(-e);
      acc.set(shapes[k].bi, (acc.get(shapes[k].bi) || 0) + w);
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, [, w]) => a + w, 0);
    top.forEach(([bi, w], i) => { skinIndex[v * 4 + i] = bi; skinWeight[v * 4 + i] = w / sum; });
    tint[v] = PARTS[shapes[mi].part] || 0;
  }
  part.skinIndex = skinIndex; part.skinWeight = skinWeight; part.tint = tint;
  delete part.shapes;
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const norm3 = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

const smooth01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

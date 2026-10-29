// Sculpts a body plan (humanoid.js) into skinned mesh data: the plan's shapes are posed in the
// sculpting pose (arms out, fingers apart, so nothing melts together), meshed in four parts (the
// body, the head and each hand, the head and hands on a finer grid), and every point gets weights
// for the bones that move it. Plain numbers and arrays only (no three.js), so it can run in a worker.
import { fieldDist, shapeDist, shapeBox, cone } from './sdf.js';
import { meshField } from './mesher.js';
import { growHair } from './hair.js';
import { outfitPlan } from './clothes.js';

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
function poseShapes(plan, pose, list = plan.shapes) {
  const rest = Object.fromEntries(plan.bones.map((b) => [b.name, b.pos]));
  const move = (bone, p) => {
    const { R, t } = pose[bone];
    const r = rest[bone];
    const v = apply3(R, [p[0] - r[0], p[1] - r[1], p[2] - r[2]]);
    return [v[0] + t[0], v[1] + t[1], v[2] + t[2]];
  };
  return list.map((s) => {
    const R = pose[s.bone].R;
    if (s.kind === 'cone') return { ...s, a: move(s.bone, s.a), b: move(s.bone, s.b), _ba: undefined };
    if (s.kind === 'loft') { const d = move(s.bone, [0, 0, 0]); return { ...s, rings: s.rings.map(([y, rx, f, b, c]) => [y + d[1], rx, f, b, c + d[2]]), span: s.span?.map(([n, y]) => [n, y + d[1]]) }; }
    return { ...s, c: move(s.bone, s.c), m: mul3(s.m || I3(), T3(R)) };
  });
}

// Sculpt the plan. Returns { bones, pose, parts: { body, head, leftHand, rightHand } }, each part
// { positions, normals, indices, skinIndex, skinWeight, tint } (tint: a colour hint per point).
export function sculpt(plan, quality = 'high', { hair = 'short', hairSeed = 1, outfit = null } = {}) {
  const q = DETAIL[quality] || DETAIL.high;
  const pose = sculptPose(plan);
  const shapes = poseShapes(plan, pose);
  const boneIndex = Object.fromEntries(plan.bones.map((b, i) => [b.name, i]));
  shapes.forEach((s) => { s.bi = boneIndex[s.bone]; if (s.span) s.spanIdx = s.span.map(([n, y]) => [boneIndex[n], y]); });

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
  // clothes, each meshed on the body's grid, and the skin they hide taken away
  const clothes = {};
  if (outfit) {
    const pieces = outfitPlan(plan, outfit).map((pc) => posePiece(plan, pose, pc));
    for (const pc of pieces) {
      const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (const r of [...pc.region, ...pc.extra]) { const b = shapeBox(r); for (let i = 0; i < 3; i++) { box[i] = Math.min(box[i], b[i]); box[i + 3] = Math.max(box[i + 3], b[i + 3]); } }
      for (let i = 0; i < 3; i++) { box[i] = Math.max(box[i], bounds[i] - 0.03); box[i + 3] = Math.min(box[i + 3], bounds[i + 3] + 0.03); }
      const field = (x, y, z, d) => garmentDist(pc, x, y, z, d);
      const near = shapes.filter((s) => overlaps(shapeBox(s), box));
      pc.tubes = (pc.tubes || []).map(([A, B, ease]) => {
        const a = pose[A].t, b = pose[B].t;
        const own = shapes.filter((s) => s.bone === A && !s.sub);
        const limb = (x, y, z) => fieldDist(own, x, y, z);
        const a2 = add(a, scale(sub(b, a), 0.3)); // (starting past the shoulder or hip, so it never pads them)
        return cone(a2, b, girth(limb, a2, b, 0) + ease, girth(limb, b, a, 0.12) + ease * 0.7, { blend: 0.03 });
      });
      // a skirt (a tunic's lower part): one cone hanging round both legs, flaring out a little
      if (pc.skirt) {
        const [y0, y1, flare] = pc.skirt;
        const whole = (x, y, z) => fieldDist(near, x, y, z);
        const a = [0, y0, -0.01], b = [0, y1, -0.01];
        pc.tubes.push(cone(a, b, outline(whole, a) + 0.006, outline(whole, b) + 0.006 + flare, { blend: 0.04 }));
      }
      // the cloth lies over the body's main forms, not its small details, the head or a beard
      // (and bridges the hollows between them, like cloth stretched over the chest)
      const under = near.filter((s) => !s.detail && !s.part && s.bone !== 'head').map((s) => (s.sub ? s : { ...s, blend: Math.max(s.blend, 0.04) }));
      const m = meshField([...under, ...[...pc.extra, ...pc.tubes].map((e) => ({ ...e, ghost: true }))], box, q.body * 0.7, field, { clipNormals: true });
      m.shapes = near;
      dropInner(m, (x, y, z) => fieldDist(under, x, y, z));
      m.cloth = pc.cloth; m.colour = pc.colour; m.name = pc.name;
      clothes[pc.name] = m;
    }
    // (a beard over a shirt stays: only skin lying on the body under the cloth is hidden)
    const bare = shapes.filter((s) => !s.part && s.bone !== 'head' && !s.sub);
    hideCovered(parts.body, pieces, (x, y, z) => fieldDist(bare, x, y, z), pose.neck.t[1] - 0.3);
  }
  for (const part of [...Object.values(parts), ...Object.values(clothes)]) skinPart(part, shapes, plan);
  for (const L of ['left', 'right']) if (parts[`${L}Hand`]) handLines(parts[`${L}Hand`], pose, L);
  const face = faceSheet(plan, shapes, boneIndex.head);
  const headShapes = shapes.filter((s) => s.bone === 'head' && !s.sub && !s.part); // (hair grows round ears and beards)
  const locks = growHair(hair, headShapes, plan, hairSeed);
  if (locks) {
    const n = locks.positions.length / 3;
    locks.skinIndex = new Uint16Array(n * 4); locks.skinWeight = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) { locks.skinIndex[v * 4] = boneIndex.head; locks.skinWeight[v * 4] = 1; }
  }
  return { bones: plan.bones, pose, parts, clothes, face, hair: locks };
}

// a garment piece moved into the sculpting pose (its region, cuts and extras ride their bones)
function posePiece(plan, pose, pc) {
  const rest = Object.fromEntries(plan.bones.map((b) => [b.name, b.pos]));
  const cuts = pc.cuts.map((c) => {
    const { R, t } = pose[c.bone], r = rest[c.bone];
    const v = apply3(R, sub(c.p, r));
    return { p: add(v, t), n: norm3(apply3(R, c.n)), r: c.r || Infinity };
  });
  return { ...pc, region: poseShapes(plan, pose, pc.region), hole: poseShapes(plan, pose, pc.hole || []), extra: poseShapes(plan, pose, pc.extra || []), cuts };
}
// how far outside the parts of the body a piece covers (its region, inside its hems, not in a hole);
// the edges are rounded a little, as a sewn hem is
function coverDist(pc, x, y, z) {
  let r = Infinity;
  for (const s of pc.region) r = Math.min(r, shapeDist(s, x, y, z));
  for (const c of pc.cuts) {
    // a hem: everything past its plane is cut away (when the cut has a reach r, only within r of
    // the line through it along its normal: a sleeve's hem cuts the arm, not the body beside it)
    const dx = x - c.p[0], dy = y - c.p[1], dz = z - c.p[2];
    let h = dx * c.n[0] + dy * c.n[1] + dz * c.n[2];
    if (c.r < Infinity) h = Math.min(h, c.r - Math.hypot(dx - h * c.n[0], dy - h * c.n[1], dz - h * c.n[2]));
    r = smax(r, h, 0.008);
  }
  for (const h of pc.hole) r = smax(r, -shapeDist(h, x, y, z), 0.008);
  return r;
}
// the cloth: a shell from just under the skin to the cloth's thickness above it, where the piece
// covers the body; sleeves and trouser legs hang as smooth tubes over the muscles under them
function garmentDist(pc, x, y, z, d) {
  let base = d;
  for (const t of pc.tubes) base = smin(base, shapeDist(t, x, y, z), 0.03);
  let g = smax(base - pc.thick, coverDist(pc, x, y, z), 0.003);
  g = Math.max(g, -(d + 0.012)); // (deep enough that the grid never misses the shell)
  for (const e of pc.extra) g = smin(g, shapeDist(e, x, y, z), e.blend);
  return g;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
// how thick the body is around a point on a limb's axis (from a towards b, a little along): the
// furthest the skin is from the axis, all round
function girth(f, a, b, along) {
  const ax = norm3(sub(b, a));
  const c = add(a, scale(ax, along * Math.min(1, dist(a, b))));
  const s1 = norm3(Math.abs(ax[1]) < 0.9 ? [ax[2], 0, -ax[0]] : [1, 0, 0]);
  const s2 = [ax[1] * s1[2] - ax[2] * s1[1], ax[2] * s1[0] - ax[0] * s1[2], ax[0] * s1[1] - ax[1] * s1[0]];
  let r = 0;
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2, dir = add(scale(s1, Math.cos(t)), scale(s2, Math.sin(t)));
    let u = 0;
    for (let k = 0; k < 60; k++) { const d = f(...add(c, scale(dir, u))); if (d > -1e-4) break; u += Math.max(-d, 0.0008); }
    r = Math.max(r, u);
  }
  return r;
}
// how far out from a point the body reaches, all round it (in the level plane): its outline's radius
function outline(f, c) {
  let r = 0;
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2, dx = Math.cos(t), dz = Math.sin(t);
    for (let u = 0.4; u > r; u -= 0.003) if (f(c[0] + dx * u, c[1], c[2] + dz * u) < 0) { r = u; break; }
  }
  return r;
}
// the inside of a garment's shell lies under the skin, never seen: take it away
function dropInner(m, bodyAt) {
  const P = m.positions, n = P.length / 3, under = new Uint8Array(n);
  for (let v = 0; v < n; v++) under[v] = bodyAt(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]) < -0.007 ? 1 : 0;
  const I = m.indices, keep = [];
  for (let t = 0; t < I.length; t += 3) if (!(under[I[t]] && under[I[t + 1]] && under[I[t + 2]])) keep.push(I[t], I[t + 1], I[t + 2]);
  m.indices = new Uint32Array(keep);
}
// take away the body's triangles that lie well inside a piece of clothing
function hideCovered(part, pieces, bareAt, checkAbove) {
  const P = part.positions, n = P.length / 3;
  const hidden = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    for (const pc of pieces) if (coverDist(pc, x, y, z) < -0.014) { hidden[v] = 1; break; }
    // near the head, a point standing off the bare body (a beard) is not under the cloth
    if (hidden[v] && y > checkAbove && bareAt(x, y, z) > 0.006) hidden[v] = 0;
  }
  const I = part.indices, keep = [];
  for (let t = 0; t < I.length; t += 3) if (!(hidden[I[t]] && hidden[I[t + 1]] && hidden[I[t + 2]])) keep.push(I[t], I[t + 1], I[t + 2]);
  part.indices = new Uint32Array(keep);
}
const overlaps = (a, b) => a[0] <= b[3] && a[3] >= b[0] && a[1] <= b[4] && a[4] >= b[1] && a[2] <= b[5] && a[5] >= b[2];

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
    if (s.kind === 'loft') continue;
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
  const shapes = part.shapes.filter((s) => !s.sub && !s.ghost);
  // the skin without the added parts (a beard, tusks): a point standing out from it is on a part
  const plain = part.shapes.filter((s) => !s.part && !s.ghost);
  const hasParts = shapes.some((s) => s.part);
  const n = part.positions.length / 3;
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4), tint = new Uint8Array(n);
  const PARTS = { lips: 1, nail: 2, claw: 3, fur: 4, tusk: 5 };
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
      const sp = shapes[k].spanIdx;
      if (sp) {
        // a trunk: its pull is shared by the bones along it, by height
        for (let j = 0; j < sp.length; j++) {
          const [bi, yj] = sp[j];
          const ya = j ? sp[j - 1][1] : -Infinity, yb = j < sp.length - 1 ? sp[j + 1][1] : Infinity;
          let h = 0;
          if (y <= yj) h = ya === -Infinity ? 1 : Math.max(0, (y - ya) / (yj - ya));
          else h = yb === Infinity ? 1 : Math.max(0, (yb - y) / (yb - yj));
          if (h > 0) acc.set(bi, (acc.get(bi) || 0) + w * smooth01(h));
        }
      } else acc.set(shapes[k].bi, (acc.get(shapes[k].bi) || 0) + w);
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, [, w]) => a + w, 0);
    top.forEach(([bi, w], i) => { skinIndex[v * 4 + i] = bi; skinWeight[v * 4 + i] = w / sum; });
    let t = m < 0.0025 ? PARTS[shapes[mi].part] || 0 : 0;
    if (!t && hasParts && fieldDist(plain, x, y, z) > 0.0015) {
      let best = Infinity;
      for (let k = 0; k < shapes.length; k++) if (shapes[k].part && d[k] < best) { best = d[k]; t = PARTS[shapes[k].part]; }
    }
    tint[v] = t;
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
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const smooth01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// The lines of the skin of a hand, for the skin shader to draw (see build.js): the creases across
// each finger at its joints, the lines of the palm and the ridges of the fingertips. Two values
// per point, each four numbers:
//   lines: [x, palm, lat, pad]: x how far the point is from the nearest joint's crease along its
//     finger (metres near a crease, signed; 1 off the fingers); palm how much it faces the palm's way (-1 the
//     back of the hand .. 1 the palm); lat how far it is to the side of the finger's middle line;
//     pad how far along the fingertip from the middle of its pad (1 off the last segments)
//   lines2: [finger (1 on a finger or thumb, else 0), u, v, 0]: u how far from the wrist towards the
//     knuckles (0..1), v across the palm (-1 at the index's side .. 1 at the little finger's)
// (Each is smooth across the skin, so the shader can draw thin lines by where they cross zero.)
function handLines(part, pose, L) {
  const s = L === 'left' ? 1 : -1;
  const at = (n) => pose[`${L}${n}`].t;
  const palmN = norm3(apply3(pose[`${L}Hand`].R, [-s, 0, 0]));
  const segs = [];
  for (const F of ['Index', 'Middle', 'Ring', 'Little', 'Thumb']) {
    const names = F === 'Thumb' ? ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'] : ['Proximal', 'Intermediate', 'Distal'].map((g) => F + g);
    for (let i = 0; i < 3; i++) {
      const a = at(names[i]);
      const b = i < 2 ? at(names[i + 1]) : add(a, scale(sub(a, at(names[i - 1])), 0.92));
      segs.push({ a, b, thumb: F === 'Thumb', first: i === 0, last: i === 2, metacarpal: F === 'Thumb' && i === 0 });
    }
  }
  for (const g of segs) { g.len = dist(g.a, g.b); g.dir = scale(sub(g.b, g.a), 1 / g.len); g.across = norm3(cross3(g.dir, palmN)); }
  const wrist = at('Hand'), knuck = at('MiddleProximal');
  const up = sub(knuck, wrist), upLen = Math.hypot(...up), upDir = scale(up, 1 / upLen);
  const acrossPalm = sub(at('LittleProximal'), at('IndexProximal')), acrossLen = Math.hypot(...acrossPalm) / 2;
  const acrossDir = scale(acrossPalm, 1 / (acrossLen * 2));
  const mid = scale(add(at('LittleProximal'), at('IndexProximal')), 0.5);
  const P = part.positions, N = part.normals, n = P.length / 3;
  const lines = new Float32Array(n * 4), lines2 = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    const nn = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    const palm = dot(nn, palmN);
    const q = sub(p, wrist);
    const u = dot(q, upDir) / upLen, w = dot(sub(p, mid), acrossDir) / acrossLen;
    // the nearest finger bone (if the point is on a finger at all)
    let best = null, bd = 0.016, bs = 0;
    for (const g of segs) {
      const t = dot(sub(p, g.a), g.dir);
      const tc = Math.min(Math.max(t, g.first ? 0 : -0.004), g.len + (g.last ? 0.012 : 0.004));
      const dd = dist(p, add(g.a, scale(g.dir, tc)));
      if (dd < bd && !(g.first && !g.thumb && t < 0)) { bd = dd; best = g; bs = t; }
    }
    if (best && !best.metacarpal) {
      // the creases lie at the joints (the one at a finger's root a little out from the knuckle)
      const start = best.first && !best.thumb ? best.len * 0.3 : 0;
      // (a wave along the finger: 0 at each crease and growing like the distance from it near one,
      // changing sign from one bone to the next, so it runs smoothly along the whole finger)
      const Lb = best.len - start, k = best.first ? 0 : best.last ? 2 : 1;
      const x = (k % 2 ? -1 : 1) * (best.last ? (2 * Lb / Math.PI) * Math.sin((Math.PI / 2) * Math.min(1, (bs - start) / Lb)) : (Lb / Math.PI) * Math.sin(Math.PI * (bs - start) / Lb));
      const lat = dot(sub(p, best.a), best.across);
      const pad = best.last ? (bs - best.len * 0.62) / 1.35 : 1;
      lines.set([x, palm, lat, pad], v * 4);
      lines2.set([1, u, w, 0], v * 4);
    } else {
      lines.set([1, palm, 0, 1], v * 4);
      lines2.set([0, u, w, 0], v * 4);
    }
  }
  part.lines = lines; part.lines2 = lines2;
}

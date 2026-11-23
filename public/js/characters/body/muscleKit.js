// Shared tools for sculpting muscles (used by armMuscles.js and legMuscles.js): a muscle (a
// belly part and a tendon part), a belly from origin to insertion with its tendons, and a free
// tendon. Every point is given on the bone that carries it (rest, drawing units, the body's left
// side; s mirrors it) and carried into the pose. A muscle keeps its volume as it shortens or stretches.
import { sweep, shapeDist } from './sdf.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];

export // Catmull-Rom through points, then resampled evenly along its length: n+1 points and the length
function evenCurve(pts, n) {
  const fine = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 1; k <= 12; k++) {
      const t = k / 12, t2 = t * t, t3 = t2 * t;
      fine.push([0, 1, 2].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  const L = [0]; for (let i = 1; i < fine.length; i++) L.push(L[i - 1] + len(sub(fine[i], fine[i - 1])));
  const total = L[L.length - 1], out = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const want = (total * i) / n;
    while (j < L.length - 2 && L[j + 1] < want) j++;
    const f = (want - L[j]) / Math.max(1e-12, L[j + 1] - L[j]);
    out.push(lerp(fine[j], fine[j + 1], Math.min(1, Math.max(0, f))));
  }
  return { pts: out, length: total };
}

const STRIAE = 18; // fibre lines round a belly
// (the goblin is thickly muscled: bellies filled out so neighbours meet as in a real body)
const FILL_W = 1.5, FILL_D = 1.25;


// rig, rest: poseRig of the pose and of the rest stance; B: the bone field; s: the side (+1 left)
export function muscleKit(S, { rig, rest, B, s, parts }) {
  const k = S.scale, side = s > 0 ? 'left' : 'right';
  const X = (p) => [s * p[0], p[1], p[2]];
    const muscle = (name) => {
      const m = { name: side + name, joint: null, mat: 'muscle', cell: 0.00055 * k / 0.864, shapes: [] };
      const t = { name: side + name + 'Tendons', joint: null, mat: 'tendon', cell: 0.00045 * k / 0.864, shapes: [] };
      parts.push(m, t);
      return { m: m.shapes, t: t.shapes, sw: 1 };
    };
    const jn = (n) => (rig.J[n] ? n : side + n);
    // One belly. pts: [[bone, point], ...] from origin to insertion. w: half width, d: half depth
    // (outward), di: half depth (inward, toward the bone); out: [bone, the outward direction];
    // ta / tb: how much of the length is tendon at each end; tw / tt: the tendon's half width and
    // half thickness; peak: where along the belly it is fattest (0..1).
    const belly = (M, pts, o) => {
      let { w, d, di = d * 0.8, ta = 0.06, tb = 0.12, tw = w * 0.35, tt = Math.min(d, di) * 0.3, peak = 0.5, out, blend = 0.0024, tendonA = true, tendonB = true, fl = 1, lines = true, form = 'spindle' } = o;
      w *= FILL_W * (M.sw || 1); d *= FILL_D * Math.sqrt(M.sw || 1); di *= FILL_D;
      const P = pts.map(([b, p]) => rig.at(jn(b), X(p)));
      const R0 = pts.map(([b, p]) => rest.at(jn(b), X(p)));
      const N = 20, cp = evenCurve(P, N), cr = evenCurve(R0, N);
      // keep the volume: the belly's section grows as the muscle shortens
      const bulge = Math.min(1.35, Math.max(0.82, Math.sqrt(cr.length / cp.length)));
      const front = mv(rig.J[jn(out[0])].R, X(out[1]));
      const prof = (u) => {
        if (u <= ta || u >= 1 - tb) return 0;
        const v = (u - ta) / (1 - ta - tb), q = v < peak ? 0.5 * v / peak : 0.5 + 0.5 * (v - peak) / (1 - peak);
        return Math.pow(Math.sin(Math.PI * q), 0.4);
      };
      const ridges = lines ? Array.from({ length: STRIAE }, (_, i) => ({ a: -Math.PI + (i + 0.5) * 2 * Math.PI / STRIAE, w: 0.075 })) : [];
      const st = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, f = prof(u);
        if (f <= 0 && !(i > 0 && prof((i - 1) / N) > 0) && !(i < N && prof((i + 1) / N) > 0)) continue;
        const g = Math.max(f, 0.18);
        // the width: a spindle is widest at its belly; a fan widest at its origin, narrowing to its
        // tendon; a strap keeps its width
        const v = Math.min(1, Math.max(0, (u - ta) / (1 - ta - tb)));
        const gw = form === 'fan' ? Math.max(0.12, Math.pow(1 - v, 0.75)) * Math.min(1, 0.55 + v * 6) * (f > 0 ? 1 : 0.4) : form === 'strap' ? Math.max(g, f > 0 ? 0.85 : 0) : g;
        const rw = (tw + (w * fl - tw) * gw) * (f > 0 ? Math.pow(bulge, 0.35) : 1);
        const rd = (tt + (d - tt) * g) * (f > 0 ? bulge : 1), rdi = (tt + (di - tt) * g) * (f > 0 ? Math.pow(bulge, 0.6) : 1);
        const hh = 0.00022 * Math.min(1, f * 2.5);
        st.push({ p: B.push(cp.pts[i], rdi * k * 0.9), r: [rd * k, rw * k, rdi * k, rw * k], h: ridges.map((_, j) => (j % 2 ? -hh : hh * 0.6)) });
      }
      if (st.length > 1) M.m.push(sweep(st, { front, lat: [0, 1, 0], ridges, steps: 5, round: Math.min(tt, tw) * k, blend: blend * k }));
      // the tendons: from each end into the belly
      const tend = (i0, i1) => {
        const tst = [];
        for (let i = i0; i <= i1; i++) {
          const u = i / N, f = prof(u), sh = 1 - 0.55 * f;
          tst.push({ p: B.push(cp.pts[i], tt * sh * k * 1.05), r: [tt * sh * k, tw * sh * k, tt * sh * k, tw * sh * k] });
        }
        M.t.push(sweep(tst, { front, lat: [0, 1, 0], steps: 4, round: Math.min(tt, tw) * 0.9 * k, blend: 0.0008 * k }));
      };
      if (tendonA && ta > 0) tend(0, Math.min(N, Math.ceil(ta * N) + 2));
      if (tendonB && tb > 0) tend(Math.max(0, Math.floor((1 - tb) * N) - 2), N);
    };
    // a long tendon on its own (for the hand): through points, half width tw, half thickness tt
    const tendon = (M, pts, tw, tt, out) => {
      const P = pts.map(([b, p]) => rig.at(jn(b), X(p)));
      const cp = evenCurve(P, Math.max(6, pts.length * 4));
      const front = mv(rig.J[jn(out[0])].R, X(out[1]));
      M.t.push(sweep(cp.pts.map((p) => ({ p: B.push(p, tt * k * 1.05), r: [tt * k, tw * k, tt * k, tw * k] })), { front, lat: [0, 1, 0], steps: 3, round: Math.min(tw, tt) * 0.9 * k, blend: 0.0006 * k }));
    };
  return { muscle, belly, tendon, jn, X };
}

// Soft contact across a bending joint (jA above it, jB below): when it bends far, the muscles
// namesA (above) and namesB (below) press together. Real muscle does not pass through muscle:
// both sides flatten where they meet and bulge a little to the sides (keeping their volume),
// each giving way by half the overlap.
export function softContact(parts, rig, side, jA, jB, namesA, namesB, { from = 0.7, full = 1.3 } = {}) {
    {
      const ang = (A, Bm) => { const t = A[0] * Bm[0] + A[3] * Bm[3] + A[6] * Bm[6] + A[1] * Bm[1] + A[4] * Bm[4] + A[7] * Bm[7] + A[2] * Bm[2] + A[5] * Bm[5] + A[8] * Bm[8]; return Math.acos(Math.max(-1, Math.min(1, (t - 1) / 2))); };
      const bend = ang(rig.J[jA].R, rig.J[jB].R);
      const wgt = Math.min(1, Math.max(0, (bend - from) / (full - from))); // (no change until the joint is well bent)
      if (wgt > 0) {
        const grp = (names) => parts.filter((p) => p.mat === 'muscle' && names.some((n) => p.name === side + n)).flatMap((p) => p.shapes.filter((q) => q.kind === 'sweep'));
        const upper = grp(namesA);
        const fore = grp(namesB);
        const fieldOf = (list) => (p) => { let d = 1; for (const q of list) d = Math.min(d, shapeDist(q, p[0], p[1], p[2])); return d; };
        const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
        const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        // plan the moves for one group's stations against the other group (as they are now)
        const plan = (list, other) => {
          const D = fieldOf(other), e = 0.0003, moves = [];
          for (const sh of list) sh.stations.forEach((st, i, all) => {
            const near = D(st.p); const rmax = Math.max(...st.r);
            if (near > rmax) return;
            const g = nrm([D(add(st.p, [e, 0, 0])) - D(add(st.p, [-e, 0, 0])), D(add(st.p, [0, e, 0])) - D(add(st.p, [0, -e, 0])), D(add(st.p, [0, 0, e])) - D(add(st.p, [0, 0, -e]))]);
            const t = nrm(sub(all[Math.min(all.length - 1, i + 1)].p, all[Math.max(0, i - 1)].p));
            const fu = sh.front; const u = nrm(sub(fu, t.map((v) => v * dt(fu, t)))), w = crs(t, u);
            const cu = -dt(g, u), cw = -dt(g, w); // (which side of the section faces the other muscle)
            const j = Math.abs(cu) > Math.abs(cw) ? (cu > 0 ? 0 : 2) : (cw > 0 ? 1 : 3);
            const o = (st.r[j] - near) * wgt; // (how far this section's facing side reaches into the other)
            if (o > 0) moves.push([sh, st, j, o / 2, g]);
          });
          return moves;
        };
        for (let pass = 0; pass < 4; pass++) { // (a few passes, as each move changes the contact)
        const mv1 = plan(fore, upper), mv2 = plan(upper, fore);
        for (const [sh, st, j, o, g] of [...mv1, ...mv2]) {
          // flatten the facing side by half the share and move the centre back by the other half
          const r0 = st.r[j], r1 = Math.max(r0 * 0.35, r0 - o / 2);
          const side2 = j % 2 ? [0, 2] : [1, 3], f = Math.sqrt((r0 + st.r[(j + 2) % 4]) / (r1 + st.r[(j + 2) % 4]));
          st.r = st.r.slice(); st.r[j] = r1; for (const q of side2) st.r[q] *= f;
          st.p = add(st.p, g.map((v) => v * o / 2));
          delete sh._S; delete sh._ba;
        }
        }
      }
    }
}

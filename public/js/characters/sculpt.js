// Sculpted bodies made from 3D models (see tools/sculpt): one light mesh per race, coloured by
// region (skin, hair, clothes...) and skinned to a simple skeleton so it walks, swings and wears gear
// like the built-up bodies do. The mesh files are loaded once at startup; until then (or if one
// fails to load) the race falls back to its built-up body.
import * as THREE from 'three';

// What each vertex is, as stored in the file (the low four bits of its region byte)
export const REGIONS = {
  dwarf: ['skin', 'hair', 'sleeves', 'tunic', 'trousers', 'boots', 'belt', 'metal', 'leather', 'eyes'],
  dragon: ['scales', 'horn', 'belly', 'wing', 'cloth', 'claw', 'belt', 'metal', 'wingbone', 'eyes'],
};
// Which bones move it (the high four bits). 0 means work it out from where the vertex is.
const BODY = 1, WING = 2, TAIL = 3, ARM = 4;

// Where the joints sit, as fractions of the body's height (x out to the side, y up, z forward)
const JOINTS = {
  dwarf: {
    hips: [0, 0.31, -0.02], spine: [0, 0.37, -0.02], neck: [0, 0.745, -0.02], head: [0, 0.87, 0.04], headR: 0.135,
    shoulder: [0.25, 0.6, -0.03], elbow: [0.32, 0.43, 0], wrist: [0.33, 0.34, 0.02],
    hip: [0.11, 0.3, -0.03], knee: [0.12, 0.17, -0.03], ankle: [0.12, 0.05, -0.03],
    eyes: [0.045, 0.875, 0.152], armFrom: 0.215, armTo: 0.27, broaden: 0.035, chestR: 0.2, eyeR: 0.011,
  },
  // the True Dragon: wings and a tail of its own, with each part marked in the file
  dragon: {
    hips: [0, 0.4, 0.03], spine: [0, 0.46, 0.03], neck: [0, 0.72, 0.05], head: [0, 0.8, 0.07], headR: 0.07,
    shoulder: [0.11, 0.655, 0.03], elbow: [0.15, 0.5, 0.03], wrist: [0.17, 0.42, 0.05],
    hip: [0.06, 0.39, 0.03], knee: [0.09, 0.21, 0.06], ankle: [0.1, 0.06, 0.04],
    eyes: [0.032, 0.84, 0.12], wing: [0.07, 0.68, -0.06], tail: [0, 0.35, -0.05], tailEnd: [0, 0.08, -0.15],
    broaden: 0, chestR: 0.11, eyeR: 0.006,
  },
};

const loaded = {};
// Fetch every sculpt; resolves when done (failures are skipped, so the game still starts)
export function loadSculpts(base = 'models/') {
  return Promise.all(Object.keys(JOINTS).map(async (race) => {
    try {
      let res = await fetch(`${base}${race}.bin`);
      if (res.ok) { try { loaded[race] = parse(await res.arrayBuffer()); return; } catch { /* not a sculpt file */ } }
      // the preview can only host text, so it carries the same file as base64
      res = await fetch(`${base}${race}.b64.txt`);
      if (res.ok) loaded[race] = parse(Uint8Array.from(atob((await res.text()).trim()), (c) => c.charCodeAt(0)).buffer);
    } catch { /* stay with the built-up body */ }
  }));
}
export const hasSculpt = (race) => !!loaded[race];

function parse(buf) {
  const dv = new DataView(buf);
  if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== 'ARM1') throw new Error('not a sculpt');
  const nv = dv.getUint32(4, true), nf = dv.getUint32(8, true);
  let o = 12;
  const q = new Int16Array(buf, o, nv * 3); o += nv * 6;
  const qn = new Int8Array(buf, o, nv * 3); o += nv * 3;
  const tag = new Uint8Array(buf, o, nv); o += nv;
  const region = tag.map((b) => b & 15), group = tag.map((b) => b >> 4);
  const index = nv < 65536 ? new Uint16Array(buf, o, nf * 3) : new Uint32Array(buf, o, nf * 3);
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) { pos[i] = q[i] / 30000; nor[i] = qn[i] / 127; }
  return refine({ nv, pos, nor, region, group, index });
}

// Clean up a sculpt once when it loads, so it looks finished rather than rough:
//  - stray specks of the wrong region (bits of tunic inside the beard, skin in the hair) take the
//    region around them;
//  - the surface is smoothed (Taubin, so it doesn't shrink) and given fresh smooth normals;
//  - where one region meets another the colours blend over a vertex or two instead of stair-stepping;
//  - creases (under the beard, between fingers, at the belt) are shaded a little darker.
function refine(S) {
  const { nv, pos, index } = S;
  const R = 16;
  // neighbours of every vertex
  const deg = new Uint32Array(nv + 1);
  for (let f = 0; f < index.length; f++) deg[index[f] + 1] += 2;
  for (let i = 0; i < nv; i++) deg[i + 1] += deg[i];
  const nb = new Uint32Array(deg[nv]), fill = deg.slice(0, nv);
  for (let f = 0; f < index.length; f += 3) {
    const a = index[f], b = index[f + 1], c = index[f + 2];
    nb[fill[a]++] = b; nb[fill[a]++] = c; nb[fill[b]++] = a; nb[fill[b]++] = c; nb[fill[c]++] = a; nb[fill[c]++] = b;
  }
  // 1. specks: a vertex whose neighbours are mostly another region joins them (never the eyes)
  const region = S.region.slice(), count = new Uint16Array(R);
  const eyes = 9;
  for (let pass = 0; pass < 6; pass++) {
    const next = region.slice();
    for (let i = 0; i < nv; i++) {
      if (region[i] === eyes) continue;
      count.fill(0);
      for (let k = deg[i]; k < deg[i + 1]; k++) count[region[nb[k]]]++;
      let best = region[i], n = deg[i + 1] - deg[i];
      for (let r = 0; r < R; r++) if (count[r] > count[best]) best = r;
      if (best !== region[i] && best !== eyes && count[best] >= n * 0.6) next[i] = best;
    }
    region.set(next);
  }
  // 2. smoothing that keeps the volume (shrink, then grow back), sliding only within a body part
  const tmp = new Float32Array(nv * 3);
  const step = (lam) => {
    for (let i = 0; i < nv; i++) {
      let x = 0, y = 0, z = 0, n = 0;
      for (let k = deg[i]; k < deg[i + 1]; k++) { const j = nb[k]; if (S.group[j] !== S.group[i]) continue; x += pos[j * 3]; y += pos[j * 3 + 1]; z += pos[j * 3 + 2]; n++; }
      if (!n || region[i] === eyes) { tmp[i * 3] = pos[i * 3]; tmp[i * 3 + 1] = pos[i * 3 + 1]; tmp[i * 3 + 2] = pos[i * 3 + 2]; continue; }
      tmp[i * 3] = pos[i * 3] + lam * (x / n - pos[i * 3]);
      tmp[i * 3 + 1] = pos[i * 3 + 1] + lam * (y / n - pos[i * 3 + 1]);
      tmp[i * 3 + 2] = pos[i * 3 + 2] + lam * (z / n - pos[i * 3 + 2]);
    }
    pos.set(tmp);
  };
  for (let it = 0; it < 4; it++) { step(0.5); step(-0.53); }
  // fresh normals from the smoothed surface
  const nor = new Float32Array(nv * 3);
  for (let f = 0; f < index.length; f += 3) {
    const a = index[f] * 3, b = index[f + 1] * 3, c = index[f + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { nor[o] += nx; nor[o + 1] += ny; nor[o + 2] += nz; }
  }
  // keep the file's facing (the faces may wind either way)
  let agree = 0;
  for (let i = 0; i < nv; i++) agree += nor[i * 3] * S.nor[i * 3] + nor[i * 3 + 1] * S.nor[i * 3 + 1] + nor[i * 3 + 2] * S.nor[i * 3 + 2] > 0 ? 1 : -1;
  if (agree < 0) for (let i = 0; i < nv * 3; i++) nor[i] = -nor[i];
  for (let i = 0; i < nv; i++) {
    const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
    if (l > 1e-12) { nor[i * 3] /= l; nor[i * 3 + 1] /= l; nor[i * 3 + 2] /= l; }
    else { nor[i * 3] = S.nor[i * 3]; nor[i * 3 + 1] = S.nor[i * 3 + 1]; nor[i * 3 + 2] = S.nor[i * 3 + 2]; }
  }
  // 3. soft region edges: each vertex keeps a little of its neighbours' regions
  let soft = new Float32Array(nv * R);
  for (let i = 0; i < nv; i++) soft[i * R + region[i]] = 1;
  for (let pass = 0; pass < 1; pass++) {
    const out = new Float32Array(nv * R);
    for (let i = 0; i < nv; i++) {
      const n = deg[i + 1] - deg[i];
      for (let r = 0; r < R; r++) out[i * R + r] = soft[i * R + r] * 0.5;
      if (!n) { for (let r = 0; r < R; r++) out[i * R + r] *= 2; continue; }
      for (let k = deg[i]; k < deg[i + 1]; k++) { const j = nb[k]; for (let r = 0; r < R; r++) out[i * R + r] += soft[j * R + r] * 0.5 / n; }
    }
    soft = out;
  }
  // eyes stay crisp
  for (let i = 0; i < nv; i++) if (region[i] === eyes) { for (let r = 0; r < R; r++) soft[i * R + r] = 0; soft[i * R + eyes] = 1; }
  // 4. creases: how far the neighbours sit out along the normal, smoothed, as a darkening
  const shade = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    let d = 0, e = 0, n = 0;
    for (let k = deg[i]; k < deg[i + 1]; k++) {
      const j = nb[k];
      const dx = pos[j * 3] - pos[i * 3], dy = pos[j * 3 + 1] - pos[i * 3 + 1], dz = pos[j * 3 + 2] - pos[i * 3 + 2];
      d += dx * nor[i * 3] + dy * nor[i * 3 + 1] + dz * nor[i * 3 + 2]; e += Math.hypot(dx, dy, dz); n++;
    }
    shade[i] = n && e > 0 ? d / e : 0;
  }
  for (let pass = 0; pass < 3; pass++) {
    const out = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      let s = shade[i], n = 1;
      for (let k = deg[i]; k < deg[i + 1]; k++) { s += shade[nb[k]]; n++; }
      out[i] = s / n;
    }
    shade.set(out);
  }
  const ao = new Float32Array(nv);
  for (let i = 0; i < nv; i++) ao[i] = Math.min(1.04, Math.max(0.55, 1 - shade[i] * 2.2));
  return { ...S, pos, nor, region, soft, ao, R };
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The rig for a sculpted body `H` metres tall. `colors` maps region names to colours.
// Returns the same shape of rig as the built-up bodies (hips, spine, head, arms, legs...).
// Each evolution `stage` (0-5) makes the body broader below the head.
export function sculptedRig(race, H, colors, mats, stage = 0) {
  const S = loaded[race], J = JOINTS[race];
  const chinY = J.neck[1] + 0.045;
  const broad = (y) => (y < chinY ? 1 + stage * J.broaden : 1);
  const v3 = ([x, y, z], side = 1) => new THREE.Vector3(x * side * H * broad(y), y * H, z * H * broad(y));
  const bone = (parent, at, from) => { const b = new THREE.Bone(); b.position.copy(at).sub(from); parent.add(b); return b; };

  // the skeleton, in its resting pose
  const root = new THREE.Group();
  const origin = new THREE.Vector3();
  const hips = bone(root, v3(J.hips), origin);
  const spine = bone(hips, v3(J.spine), v3(J.hips));
  const neck = bone(spine, v3(J.neck), v3(J.spine));
  const head = bone(neck, v3(J.head), v3(J.neck));
  const bones = [hips, spine, neck, head];
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    // a fixed socket at the shoulder, with the turning bone inside it (gear hangs pads on the socket)
    const socket = bone(spine, v3(J.shoulder, side), v3(J.spine));
    const shoulder = bone(socket, v3(J.shoulder, side), v3(J.shoulder, side));
    bones.push(socket);
    const elbow = bone(shoulder, v3(J.elbow, side), v3(J.shoulder, side));
    const hand = bone(elbow, v3(J.wrist, side), v3(J.elbow, side));
    bones.push(shoulder, elbow, hand);
    arms.push({ shoulder, elbow, hand, side, len: v3(J.shoulder).distanceTo(v3(J.elbow)), foreLen: v3(J.elbow).distanceTo(v3(J.wrist)) });
    const hip = bone(hips, v3(J.hip, side), v3(J.hips));
    const knee = bone(hip, v3(J.knee, side), v3(J.hip, side));
    const ankle = bone(knee, v3(J.ankle, side), v3(J.knee, side));
    bones.push(hip, knee, ankle);
    legs.push({ hip, knee, ankle, side, thighLen: v3(J.hip).distanceTo(v3(J.knee)), shinLen: v3(J.knee).distanceTo(v3(J.ankle)) });
  }
  // wings fold from a root on the back; a tail in two pieces
  const wings = J.wing ? [-1, 1].map((side) => bone(spine, v3(J.wing, side), v3(J.spine))) : [];
  bones.push(...wings);
  const tails = [];
  if (J.tail) {
    tails.push(bone(hips, v3(J.tail), v3(J.hips)));
    tails.push(bone(tails[0], v3(J.tailEnd), v3(J.tail)));
    bones.push(...tails);
  }
  const B = (b) => bones.indexOf(b);

  // the mesh, coloured by region and weighted to the bones
  const pos = new Float32Array(S.nv * 3), col = new Float32Array(S.nv * 3);
  const skinIndex = new Uint16Array(S.nv * 4), skinWeight = new Float32Array(S.nv * 4);
  const palette = REGIONS[race].map((r) => new THREE.Color(colors[r] || '#808080'));
  const at = new THREE.Vector3(), wingAt = J.wing && new THREE.Vector3(...J.wing), tailAt = J.tail && new THREE.Vector3(...J.tail);
  const shoulderAt = new THREE.Vector3(...J.shoulder);
  for (let i = 0; i < S.nv; i++) {
    const x = S.pos[i * 3], y = S.pos[i * 3 + 1], z = S.pos[i * 3 + 2];
    const k = broad(y);
    pos[i * 3] = x * H * k; pos[i * 3 + 1] = y * H; pos[i * 3 + 2] = z * H * k;
    let cr = 0, cg = 0, cb = 0;
    for (let r = 0; r < palette.length; r++) {
      const wt = S.soft[i * S.R + r];
      if (wt > 0) { cr += palette[r].r * wt; cg += palette[r].g * wt; cb += palette[r].b * wt; }
    }
    const o = S.ao[i];
    col[i * 3] = cr * o; col[i * 3 + 1] = cg * o; col[i * 3 + 2] = cb * o;
    const side = x < 0 ? 0 : 1, ax = Math.abs(x);
    const w = [];
    const g = S.group[i];
    at.set(ax, y, z);
    if (g === WING) {
      // the membrane moves more the further it is from the root
      const out = smooth(0.03, 0.14, at.distanceTo(wingAt));
      w.push([B(wings[side]), out], [B(spine), 1 - out]);
    } else if (g === TAIL) {
      at.x = x;
      const d = at.distanceTo(tailAt), base = smooth(0, 0.08, d), end = smooth(0.12, 0.3, d);
      w.push([B(hips), 1 - base], [B(tails[0]), base * (1 - end)], [B(tails[1]), base * end]);
    }
    // arms hang beside the body; legs below the tunic; the rest is body and head
    let arm = g ? 0 : smooth(J.armFrom, J.armTo, ax) * (1 - smooth(J.shoulder[1] + 0.02, J.shoulder[1] + 0.08, y)) * smooth(J.hip[1] - 0.12, J.hip[1] - 0.06, y);
    if (g === ARM) arm = 1 - smooth(J.shoulder[1] - 0.02, J.shoulder[1] + 0.03, y);
    // the round of the shoulder goes with the arm, even where it was marked as body
    if (g === BODY) arm = (1 - smooth(0.03, 0.06, at.distanceTo(shoulderAt))) * 0.7;
    if (g === WING || g === TAIL) arm = 0;
    const leg = g === WING || g === TAIL ? 0 : (1 - arm) * (1 - smooth(J.hips[1] - 0.04, J.hips[1] + 0.02, y));
    const body = g === WING || g === TAIL ? 0 : 1 - arm - leg;
    if (arm > 0) {
      const fore = 1 - smooth(J.elbow[1] - 0.03, J.elbow[1] + 0.03, y);
      w.push([B(arms[side].shoulder), arm * (1 - fore)], [B(arms[side].elbow), arm * fore]);
    }
    if (leg > 0) {
      const shin = 1 - smooth(J.knee[1] - 0.03, J.knee[1] + 0.03, y);
      w.push([B(legs[side].hip), leg * (1 - shin)], [B(legs[side].knee), leg * shin]);
    }
    if (body > 0) {
      const up = smooth(J.spine[1], J.spine[1] + 0.1, y);
      const top = y > J.neck[1] + 0.03 && ax < 0.16 ? smooth(J.neck[1] + 0.03, J.neck[1] + 0.06, y) : 0;
      w.push([B(hips), body * (1 - up)], [B(spine), body * up * (1 - top)], [B(head), body * up * top]);
    }
    const best = w.filter((e) => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = best.reduce((a, e) => a + e[1], 0) || 1;
    best.forEach(([b, wt], k) => { skinIndex[i * 4 + k] = b; skinWeight[i * 4 + k] = wt / sum; });
  }
  // Where the sculpt has parts touching (a hand on a thigh, a tail against a leg) the surface joins
  // things that move apart. Those faces would stretch into long streaks, so they are left out.
  const diff = (a, b) => {
    let d = 0;
    for (let k = 0; k < 4; k++) {
      const bone = skinIndex[a * 4 + k], wa = skinWeight[a * 4 + k];
      let wb = 0;
      for (let j = 0; j < 4; j++) if (skinIndex[b * 4 + j] === bone) wb = skinWeight[b * 4 + j];
      d += Math.abs(wa - wb);
    }
    for (let j = 0; j < 4; j++) {
      const bone = skinIndex[b * 4 + j];
      let shared = false;
      for (let k = 0; k < 4; k++) if (skinIndex[a * 4 + k] === bone && skinWeight[a * 4 + k] > 0) shared = true;
      if (!shared) d += skinWeight[b * 4 + j];
    }
    return d;
  };
  let index = S.index;
  if (S.group.some((g) => g)) {
    const keep = [];
    for (let f = 0; f < index.length; f += 3) {
      const [a, b, c] = [index[f], index[f + 1], index[f + 2]];
      if (diff(a, b) < 1.6 && diff(b, c) < 1.6 && diff(c, a) < 1.6) keep.push(a, b, c);
    }
    index = new Uint16Array(keep);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(S.nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false; // the bones move it about; its resting bounds can be wrong
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  keepSharp(mesh);

  // eyes: a white with a coloured iris and a dark pupil looking ahead, glossy so they catch the light
  // (only evolved forms glow, through the shared eye material's glow)
  const irisCol = mats.eye.color.clone();
  const white = new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.15 });
  const iris = new THREE.MeshStandardMaterial({ color: irisCol, emissive: irisCol, emissiveIntensity: Math.max(0, mats.eye.emissiveIntensity - 0.6) * 0.6, roughness: 0.1 });
  const pupil = new THREE.MeshStandardMaterial({ color: '#080808', roughness: 0.05 });
  for (const side of [-1, 1]) {
    const r = H * J.eyeR;
    const eye = new THREE.Group();
    eye.position.copy(v3(J.eyes, side)).sub(v3(J.head));
    eye.add(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), white));
    const ir = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 14, 10), iris);
    ir.scale.z = 0.45; ir.position.z = r * 0.72;
    eye.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 10, 8), pupil);
    pu.scale.z = 0.4; pu.position.z = r * 0.92;
    eye.add(pu);
    eye.rotation.y = side * 0.12;
    head.add(eye);
  }

  // an invisible chest shape, for body armour to be fitted around
  const tl = (J.neck[1] - J.spine[1]) * H;
  const chestGeo = new THREE.CylinderGeometry(H * J.chestR * broad(0), H * J.chestR * 1.1 * broad(0), tl, 20);
  chestGeo.translate(0, tl / 2, 0);
  const chest = new THREE.Mesh(chestGeo, mats.skin);
  chest.scale.z = 0.75;
  chest.visible = false;
  spine.add(chest);

  root.userData.height = H;
  // the arms already rest a little out from the body (armRest), so the animation doesn't push them further
  const tail = tails.length ? { userData: { parts: tails } } : null;
  return { root, H, wingBones: wings, tail, bulk: 1.4, muscle: 0.5, muscleParts: [], hips, spine, neck, head, headR: J.headR * H, chest, arms, legs, torsoLen: tl, sculpt: mesh, sculpted: true, shirt: true, armRest: 0.12, backZ: H * 0.2, padScale: 1.7 };
}

// Inside buildings (and in caves) you are more than a thousand kilometres from the middle of the
// world. The graphics card works the body's bones out in plain floats, and that far out a float
// can only step about 12 cm at a time, so the skin tore into jagged spikes. Here each bone is
// worked out relative to the body on the computer first (in full precision), so the graphics card
// only ever sees small numbers.
const meshInv = new THREE.Matrix4(), boneRel = new THREE.Matrix4();
function keepSharp(mesh) {
  const sk = mesh.skeleton;
  sk.update = function () {
    meshInv.copy(mesh.matrixWorld).invert();
    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i];
      boneRel.multiplyMatrices(bone ? bone.matrixWorld : mesh.matrixWorld, this.boneInverses[i]).premultiply(meshInv);
      boneRel.toArray(this.boneMatrices, i * 16);
    }
    if (this.boneTexture) this.boneTexture.needsUpdate = true;
  };
  const update = mesh.updateMatrixWorld.bind(mesh);
  // (the bones are already relative to the body, so nothing more is taken off in the shader)
  mesh.updateMatrixWorld = (force) => { update(force); mesh.bindMatrixInverse.identity(); };
}

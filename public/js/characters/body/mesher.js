// Turns a distance field (see sdf.js) into a smooth triangle mesh: "surface nets" on a grid, only
// worked out near the surface (so a fine grid stays quick), with each point then pulled exactly
// onto the surface and given the field's own smooth normal.
// Plain numbers and arrays only (no three.js).
import { fieldDist, shapeBox } from './sdf.js';

const BLOCK = 8; // cells per side of a block that is checked for surface as a whole

// shapes: the list from sdf.js. box: [x0,y0,z0,x1,y1,z1] to mesh within. cell: grid size (metres).
// clip: optional (x, y, z, d) -> d, applied to the shapes' distance (to mesh only part of a body).
// clipNormals: shade with the clipped field's normal (a garment's hems) instead of the skin's.
// Returns { positions: Float32Array, normals: Float32Array, indices: Uint32Array }.
export function meshField(shapes, box, cell, clip = null, { clipNormals = false } = {}) {
  const [x0, y0, z0] = box;
  const nx = Math.ceil((box[3] - x0) / cell) + 2, ny = Math.ceil((box[4] - y0) / cell) + 2, nz = Math.ceil((box[5] - z0) / cell) + 2;
  const ox = x0 - cell, oy = y0 - cell, oz = z0 - cell;
  const bx = Math.ceil(nx / BLOCK), by = Math.ceil(ny / BLOCK), bz = Math.ceil(nz / BLOCK);
  const boxes = shapes.map(shapeBox);

  // samples at grid corners (nx+1 x ny+1 x nz+1); NaN = not worked out
  const sx = nx + 1, sy = ny + 1, sz = nz + 1;
  const val = new Float32Array(sx * sy * sz).fill(NaN);
  const at = (i, j, k) => i + sx * (j + sy * k);
  const active = [];
  const blockR = Math.sqrt(3) * BLOCK * cell * 0.5;
  const fills = [];
  for (let K = 0; K < bz; K++) for (let J = 0; J < by; J++) for (let I = 0; I < bx; I++) {
    const i0 = I * BLOCK, j0 = J * BLOCK, k0 = K * BLOCK;
    const i1 = Math.min(i0 + BLOCK, nx), j1 = Math.min(j0 + BLOCK, ny), k1 = Math.min(k0 + BLOCK, nz);
    const wx0 = ox + i0 * cell, wy0 = oy + j0 * cell, wz0 = oz + k0 * cell;
    const wx1 = ox + i1 * cell, wy1 = oy + j1 * cell, wz1 = oz + k1 * cell;
    const local = [];
    for (let s = 0; s < shapes.length; s++) {
      const b = boxes[s];
      if (b[0] <= wx1 && b[3] >= wx0 && b[1] <= wy1 && b[4] >= wy0 && b[2] <= wz1 && b[5] >= wz0) local.push(shapes[s]);
    }
    const blk = { i0, j0, k0, i1, j1, k1, local };
    if (!local.some((s) => !s.sub)) { fills.push([blk, 1]); continue; }
    const c = fieldDist(local, (wx0 + wx1) / 2, (wy0 + wy1) / 2, (wz0 + wz1) / 2, clip);
    if (Math.abs(c) > blockR + cell) { fills.push([blk, Math.sign(c)]); continue; }
    active.push(blk);
  }
  // blocks with no surface: every corner has the same sign as the block's middle
  for (const [b, sign] of fills) {
    for (let k = b.k0; k <= b.k1; k++) for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) {
      const n = at(i, j, k);
      if (Number.isNaN(val[n])) val[n] = sign * 1e3;
    }
  }
  for (const b of active) {
    for (let k = b.k0; k <= b.k1; k++) for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) {
      const n = at(i, j, k);
      if (Number.isNaN(val[n]) || Math.abs(val[n]) >= 999) val[n] = fieldDist(b.local, ox + i * cell, oy + j * cell, oz + k * cell, clip);
    }
  }

  // one point in each cell the surface passes through
  const cellIdx = (i, j, k) => i + nx * (j + ny * k);
  const vert = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const owner = []; // the block each point came from (for its shape list)
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const d = new Float64Array(8);
  for (const b of active) {
    for (let k = b.k0; k < b.k1; k++) for (let j = b.j0; j < b.j1; j++) for (let i = b.i0; i < b.i1; i++) {
      let mask = 0;
      for (let c = 0; c < 8; c++) {
        d[c] = val[at(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
        if (d[c] < 0) mask |= 1 << c;
      }
      if (mask === 0 || mask === 255) continue;
      let px = 0, py = 0, pz = 0, cnt = 0;
      for (const [a, e] of edges) {
        if ((d[a] < 0) === (d[e] < 0)) continue;
        const t = d[a] / (d[a] - d[e]);
        px += corners[a][0] + (corners[e][0] - corners[a][0]) * t;
        py += corners[a][1] + (corners[e][1] - corners[a][1]) * t;
        pz += corners[a][2] + (corners[e][2] - corners[a][2]) * t;
        cnt++;
      }
      vert[cellIdx(i, j, k)] = pos.length / 3;
      pos.push(ox + (i + px / cnt) * cell, oy + (j + py / cnt) * cell, oz + (k + pz / cnt) * cell);
      owner.push(b);
    }
  }

  // pull each point onto the surface and take the field's gradient as its normal
  const nVerts = pos.length / 3;
  const positions = new Float32Array(pos);
  const normals = new Float32Array(nVerts * 3);
  const h = cell * 0.25;
  for (let v = 0; v < nVerts; v++) {
    const list = owner[v].local;
    let x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    let gx = 0, gy = 0, gz = 0;
    const grad = (useClip) => {
      const c = useClip ? clip : null;
      gx = fieldDist(list, x + h, y, z, c) - fieldDist(list, x - h, y, z, c);
      gy = fieldDist(list, x, y + h, z, c) - fieldDist(list, x, y - h, z, c);
      gz = fieldDist(list, x, y, z + h, c) - fieldDist(list, x, y, z - h, c);
      const gl = Math.hypot(gx, gy, gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
    };
    for (let it = 0; it < 3; it++) {
      const f = fieldDist(list, x, y, z, clip);
      if (Math.abs(f) < cell * 0.01) break;
      grad(true);
      const step = Math.max(-cell * 0.6, Math.min(cell * 0.6, f));
      x -= gx * step; y -= gy * step; z -= gz * step;
    }
    // the normal is the skin's own (not a cut's), so a part's edge shades like the skin around it
    grad(clipNormals);
    positions[v * 3] = x; positions[v * 3 + 1] = y; positions[v * 3 + 2] = z;
    normals[v * 3] = gx; normals[v * 3 + 1] = gy; normals[v * 3 + 2] = gz;
  }

  // a quad across every grid edge the surface crosses
  const idx = [];
  const quad = (a, b, c, e, flip) => {
    if (a < 0 || b < 0 || c < 0 || e < 0) return;
    // split along the shorter diagonal
    const d1 = dist2(positions, a, c), d2 = dist2(positions, b, e);
    if (d1 < d2) { if (flip) idx.push(a, c, b, a, e, c); else idx.push(a, b, c, a, c, e); }
    else if (flip) idx.push(a, e, b, b, e, c); else idx.push(a, b, e, b, c, e);
  };
  for (const b of active) {
    for (let k = b.k0; k < b.k1; k++) for (let j = b.j0; j < b.j1; j++) for (let i = b.i0; i < b.i1; i++) {
      const v0 = val[at(i + 1, j + 1, k + 1)];
      // edge along x from corner (i+1, j+1, k+1)
      if (i + 2 <= nx && j > -1) {
        const v1 = val[at(i + 2, j + 1, k + 1)];
        if ((v0 < 0) !== (v1 < 0) && j + 1 < ny && k + 1 < nz) {
          quad(vert[cellIdx(i + 1, j, k)], vert[cellIdx(i + 1, j + 1, k)], vert[cellIdx(i + 1, j + 1, k + 1)], vert[cellIdx(i + 1, j, k + 1)], v0 >= 0);
        }
      }
      if (j + 2 <= ny) {
        const v1 = val[at(i + 1, j + 2, k + 1)];
        if ((v0 < 0) !== (v1 < 0) && i + 1 < nx && k + 1 < nz) {
          quad(vert[cellIdx(i, j + 1, k)], vert[cellIdx(i, j + 1, k + 1)], vert[cellIdx(i + 1, j + 1, k + 1)], vert[cellIdx(i + 1, j + 1, k)], v0 >= 0);
        }
      }
      if (k + 2 <= nz) {
        const v1 = val[at(i + 1, j + 1, k + 2)];
        if ((v0 < 0) !== (v1 < 0) && i + 1 < nx && j + 1 < ny) {
          quad(vert[cellIdx(i, j, k + 1)], vert[cellIdx(i + 1, j, k + 1)], vert[cellIdx(i + 1, j + 1, k + 1)], vert[cellIdx(i, j + 1, k + 1)], v0 >= 0);
        }
      }
    }
  }
  return { positions, normals, indices: new Uint32Array(idx) };
}
const dist2 = (p, a, b) => (p[a * 3] - p[b * 3]) ** 2 + (p[a * 3 + 1] - p[b * 3 + 1]) ** 2 + (p[a * 3 + 2] - p[b * 3 + 2]) ** 2;

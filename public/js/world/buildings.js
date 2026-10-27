// What players build on their land, drawn piece by piece (see data/building.mjs for the rules).
// Used both in the world and in the Builder View.
import * as THREE from 'three';
import { CELL, STOREY, SLAB, PIECES } from '../data/building.mjs';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
export const MATS = {
  stone: mat('#8d877b', { roughness: 0.95 }),
  plaster: mat('#e6dcc4'),
  timber: mat('#6b4a2b'),
  floor: mat('#9a7448'),
  roof: mat('#9c3f2b'),
  glass: new THREE.MeshStandardMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.45, roughness: 0.1 }),
  scaffold: mat('#c9a46a', { transparent: true, opacity: 0.55 }),
  // castles are stone through and through
  keep: mat('#9a958a', { roughness: 0.95 }),
  keepTrim: mat('#6f6a60', { roughness: 0.95 }),
  slate: mat('#4a4f5a'),
};
const STONE = { plaster: MATS.keep, timber: MATS.keepTrim, roof: MATS.slate, floor: MATS.keepTrim };
const unit = new THREE.BoxGeometry(1, 1, 1);
const cone = new THREE.ConeGeometry(CELL * 0.72, 1.3, 4, 1);
cone.rotateY(Math.PI / 4);

// a box of size (w, h, d) centred at (x, y, z)
function block(g, m, x, y, z, w, h, d) {
  const b = new THREE.Mesh(unit, m);
  b.position.set(x, y, z);
  b.scale.set(w, h, d);
  b.castShadow = true; b.receiveShadow = true;
  g.add(b);
  return b;
}

// One piece's meshes. `y0` is the height of its storey's floor; `look` swaps every material (ghosts)
function drawPiece(g, p, y0, look, stone) {
  const X = p.x * CELL, Z = p.z * CELL, H = STOREY, T = stone ? 0.6 : 0.3;
  const m = (k) => look || (stone && STONE[k]) || MATS[k];
  // a wall-like piece along its edge; `parts` are [from, to, bottom, top] in metres along and up the edge
  const along = (parts, k = 'plaster') => {
    for (const [a, b, lo, hi] of parts) {
      const mid = (a + b) / 2, len = b - a;
      if (p.e === 'n') block(g, m(k), X + mid, y0 + (lo + hi) / 2, Z, len, hi - lo, T);
      else block(g, m(k), X, y0 + (lo + hi) / 2, Z + mid, T, hi - lo, len);
    }
  };
  switch (p.t) {
    case 'foundation': block(g, m('stone'), X + CELL / 2, y0 - (SLAB + 0.8) / 2, Z + CELL / 2, CELL, SLAB + 0.8, CELL); break;
    case 'floor': block(g, m('floor'), X + CELL / 2, y0 - 0.1, Z + CELL / 2, CELL, 0.2, CELL); break;
    case 'wall':
      along([[0, CELL, 0, H]]);
      along([[0, 0.25, 0, H], [CELL - 0.25, CELL, 0, H]], 'timber');
      break;
    case 'door':
      along([[0, 1.4, 0, H], [CELL - 1.4, CELL, 0, H], [1.4, CELL - 1.4, 2.3, H]]);
      along([[1.3, 1.4, 0, 2.3], [CELL - 1.4, CELL - 1.3, 0, 2.3]], 'timber');
      break;
    case 'window':
      along([[0, CELL, 0, 1], [0, CELL, 2.2, H], [0, 1.3, 1, 2.2], [CELL - 1.3, CELL, 1, 2.2]]);
      if (!look) along([[1.3, CELL - 1.3, 1, 2.2]], 'glass');
      break;
    case 'pillar': block(g, m('timber'), X, y0 + H / 2, Z, 0.45, H, 0.45); break;
    case 'stairs': {
      // ten steps rising across the cell; r = 0 climbs toward the north
      const n = 10;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, rise = (i + 1) * (H / n);
        const local = [[0.5, 1 - t], [t, 0.5], [0.5, t], [1 - t, 0.5]][p.r || 0];
        const sx = (p.r || 0) % 2 ? CELL / n : CELL * 0.8, sz = (p.r || 0) % 2 ? CELL * 0.8 : CELL / n;
        block(g, m('timber'), X + local[0] * CELL, y0 + rise / 2, Z + local[1] * CELL, sx, rise, sz);
      }
      break;
    }
    case 'roof': {
      const top = y0 + H;
      block(g, m('roof'), X + CELL / 2, top + 0.12, Z + CELL / 2, CELL + 0.3, 0.24, CELL + 0.3);
      const c = new THREE.Mesh(cone, m('roof'));
      c.position.set(X + CELL / 2, top + 0.24 + 0.65, Z + CELL / 2);
      c.castShadow = true;
      g.add(c);
      break;
    }
    default:
  }
}

// The floor height of storey `l` on a plot whose levelled ground is at `flat`
export const storeyY = (flat, l) => flat + SLAB + l * STOREY;

// A group for a list of pieces. `flatOf(piece)` gives the levelled ground under it.
// Pieces a hired builder is still working on (u in the future) show as scaffolding.
export function buildPieces(pieces, flatOf, { look = null, now = Date.now(), stone = false } = {}) {
  const g = new THREE.Group();
  for (const p of pieces) {
    if (!PIECES[p.t]) continue;
    const working = !look && p.u && p.u > now;
    const from = g.children.length;
    drawPiece(g, p, storeyY(flatOf(p), p.l), look || (working ? MATS.scaffold : null), stone);
    for (let i = from; i < g.children.length; i++) g.children[i].userData.piece = p; // so the Builder View can pick it
  }
  return g;
}

// Solid spots for walking into: ground-floor walls and pillars, as small circles along each edge
export function pieceColliders(pieces, flatOf) {
  const out = [];
  for (const p of pieces) {
    if (p.l !== 0) continue;
    const y = storeyY(flatOf(p), 0);
    if (PIECES[p.t].on === 'edge') {
      const spots = p.t === 'door' ? [0.6, CELL - 0.6] : [0.6, CELL / 2, CELL - 0.6];
      for (const s of spots) out.push({ x: p.e === 'n' ? p.x * CELL + s : p.x * CELL, z: p.e === 'n' ? p.z * CELL : p.z * CELL + s, r: 0.75, kind: 'wall', built: true, height: STOREY, y });
    } else if (p.t === 'pillar') out.push({ x: p.x * CELL, z: p.z * CELL, r: 0.4, kind: 'wall', built: true, height: STOREY, y });
  }
  return out;
}

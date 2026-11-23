// What players build on their land, drawn piece by piece (see data/building.mjs for the rules).
// Used both in the world and in the Builder View.
import * as THREE from 'three';
import { CELL, STOREY, SLAB, PIECES } from '../data/building.mjs';
import { itemModel } from '../characters/icons.js';

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
  iron: mat('#3e4046', { metalness: 0.8, roughness: 0.4 }),
  cloth: mat('#7a2a2a', { roughness: 0.95 }),
  coals: new THREE.MeshStandardMaterial({ color: '#ff6a18', emissive: '#ff4a08', emissiveIntensity: 2 }),
  crystal: new THREE.MeshStandardMaterial({ color: '#7fd8ff', emissive: '#3fb0ff', emissiveIntensity: 1.2, roughness: 0.2, transparent: true, opacity: 0.9 }),
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
  const along = (parts, k = 'plaster', thick = T) => {
    for (const [a, b, lo0, hi] of parts) {
      // pieces that stand straight on the ground reach down into it (there is no foundation slab)
      const lo = lo0 === 0 && sunk ? -SLAB - 0.4 : lo0;
      const mid = (a + b) / 2, len = b - a;
      const mm = k === 'iron' ? look || MATS.iron : k === 'keep' ? look || MATS.keep : m(k);
      if (p.e === 'n') block(g, mm, X + mid, y0 + (lo + hi) / 2, Z, len, hi - lo, k === 'iron' ? 0.06 : thick);
      else block(g, mm, X, y0 + (lo + hi) / 2, Z + mid, k === 'iron' ? 0.06 : thick, hi - lo, len);
    }
  };
  const fort = (parts) => along(parts, 'keep', 0.9);
  const sunk = p.l === 0 && !!PIECES[p.t].ground;
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
    // fortress and castle pieces, in thick grey stone
    case 'stone_wall': fort([[0, CELL, 0, H]]); break;
    case 'slit_wall': fort([[0, 1.8, 0, H], [2.2, CELL, 0, H], [1.8, 2.2, 0, 1.1], [1.8, 2.2, 2.5, H]]); break;
    case 'battlement': fort([[0, CELL, 0, 0.9], [0, 0.8, 0.9, 1.7], [1.6, 2.4, 0.9, 1.7], [3.2, CELL, 0.9, 1.7]]); break;
    case 'gate':
      fort([[0, 0.5, 0, H], [CELL - 0.5, CELL, 0, H], [0.5, CELL - 0.5, 3, H]]);
      // an iron portcullis, raised
      if (!look) for (let i = 1; i < 7; i++) along([[0.5 + i * 0.43 - 0.03, 0.5 + i * 0.43 + 0.03, 2.4, 3]], 'iron');
      break;
    case 'wall_tower': {
      const c = new THREE.Mesh(turretGeo, look || MATS.keep);
      c.position.set(X, y0 + H / 2 - (sunk ? (SLAB + 0.4) / 2 : 0), Z);
      if (sunk) c.scale.y = (H + SLAB + 0.4) / H;
      c.castShadow = true; c.receiveShadow = true;
      g.add(c);
      break;
    }
    // fences
    case 'palisade':
      for (let i = 0; i < 10; i++) {
        const a = i * 0.4 + 0.2;
        along([[a - 0.17, a + 0.17, 0, 2.6 + (i % 2) * 0.25]], 'timber');
      }
      break;
    case 'fence':
      along([[0, 0.15, 0, 1.2], [CELL / 2 - 0.08, CELL / 2 + 0.08, 0, 1.2], [CELL - 0.15, CELL, 0, 1.2]], 'timber');
      along([[0, CELL, 0.45, 0.6], [0, CELL, 0.95, 1.1]], 'timber');
      break;
    case 'iron_fence':
      for (let i = 0; i <= 12; i++) along([[i * (CELL / 12) - 0.03, i * (CELL / 12) + 0.03, 0, 1.9]], 'iron');
      along([[0, CELL, 1.7, 1.8], [0, CELL, 0.15, 0.25]], 'iron');
      break;
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
    case 'spawn': {
      // a stone plinth with a glowing crystal floating over it: where you wake up when you fall
      const cx = X + CELL / 2, cz = Z + CELL / 2;
      block(g, m('stone'), cx, y0 + 0.2, cz, 1.6, 0.4, 1.6);
      block(g, m('stone'), cx, y0 + 0.75, cz, 0.7, 0.7, 0.7);
      const c = new THREE.Mesh(gem, look || MATS.crystal);
      c.position.set(cx, y0 + 1.75, cz);
      c.scale.set(0.35, 0.6, 0.35);
      g.add(c);
      break;
    }
    case 'anvil': {
      // a small stone forge with glowing coals, the anvil on its stump, and a mould on a block
      const cx = X + CELL / 2, cz = Z + CELL / 2;
      block(g, m('stone'), cx - 0.9, y0 + 0.45, cz - 0.5, 1.1, 0.9, 0.9);
      block(g, look || MATS.coals, cx - 0.9, y0 + 0.93, cz - 0.5, 0.75, 0.06, 0.55);
      block(g, m('stone'), cx - 0.9, y0 + 1.8, cz - 0.8, 0.9, 1.4, 0.4);
      block(g, m('timber'), cx + 0.2, y0 + 0.25, cz, 0.45, 0.5, 0.45);
      block(g, look || MATS.iron, cx + 0.2, y0 + 0.6, cz, 0.75, 0.2, 0.3);
      block(g, m('stone'), cx + 1.0, y0 + 0.35, cz - 0.5, 0.6, 0.7, 0.5);
      block(g, look || MATS.iron, cx + 1.0, y0 + 0.74, cz - 0.5, 0.5, 0.08, 0.3);
      break;
    }
    case 'stand': {
      // a low wooden table with a padded top and a rack behind; the piece shown sits on it
      const cx = X + CELL / 2, cz = Z + CELL / 2;
      for (const [dx, dz] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) block(g, look || MATS.timber, cx + dx, y0 + 0.4, cz + dz, 0.08, 0.8, 0.08);
      block(g, look || MATS.floor, cx, y0 + 0.83, cz, 1.4, 0.07, 0.9);
      block(g, look || MATS.cloth, cx, y0 + 0.88, cz, 1.25, 0.03, 0.75);
      block(g, look || MATS.timber, cx, y0 + 1.35, cz - 0.42, 1.4, 0.06, 0.06);
      for (const dx of [-0.66, 0.66]) block(g, look || MATS.timber, cx + dx, y0 + 1.1, cz - 0.42, 0.06, 0.55, 0.06);
      if (p.show && !look) {
        const m = itemModel(p.show.id, p.show.plus || 0);
        if (m) {
          // stand it up on the table, about as tall as a short sword, slowly turned to the street
          const holder = new THREE.Group();
          holder.add(m);
          const box = new THREE.Box3().setFromObject(holder);
          const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
          const k = 0.85 / Math.max(size.x, size.y, size.z, 0.01);
          holder.scale.setScalar(k);
          holder.position.set(cx - mid.x * k, y0 + 0.9 - box.min.y * k + 0.02, cz - mid.z * k);
          holder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
          g.add(holder);
        }
      }
      break;
    }
    default:
  }
}
const gem = new THREE.OctahedronGeometry(1, 0);
const turretGeo = new THREE.CylinderGeometry(1.1, 1.25, STOREY, 10);

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

// Solid spots for walking into: walls and pillars on every storey (each only stops you on its own
// storey), as small circles along each edge, and the things that stand on floors
export function pieceColliders(pieces, flatOf) {
  const out = [];
  for (const p of pieces) {
    const y = storeyY(flatOf(p), p.l || 0);
    if (PIECES[p.t].on === 'edge') {
      const spots = p.t === 'door' ? [0.6, CELL - 0.6] : p.t === 'gate' ? [0.25, CELL - 0.25] : [0.6, CELL / 2, CELL - 0.6];
      for (const s of spots) out.push({ x: p.e === 'n' ? p.x * CELL + s : p.x * CELL, z: p.e === 'n' ? p.z * CELL : p.z * CELL + s, r: 0.75, kind: 'wall', built: true, height: STOREY, y });
    } else if (p.t === 'pillar') out.push({ x: p.x * CELL, z: p.z * CELL, r: 0.4, kind: 'wall', built: true, height: STOREY, y });
    else if (p.t === 'wall_tower') out.push({ x: p.x * CELL, z: p.z * CELL, r: 1.2, kind: 'wall', built: true, height: STOREY, y });
    else if (p.t === 'anvil' || p.t === 'stand' || p.t === 'spawn') out.push({ x: (p.x + 0.5) * CELL, z: (p.z + 0.5) * CELL, r: p.t === 'stand' ? 0.6 : 0.9, kind: 'wall', built: true, height: 1.2, y });
  }
  return out;
}

// Oil out in the world (rules in data/economy.mjs):
//   - black, glossy seeps where a pool of oil shows at the surface
//   - the derricks of the Oil Companies: a timber tower with a pump, a shed and barrels.
//     E beside one opens it (collect the barrels if it is yours, or see whose it is)
//   - the test pits you dig with a Shovel: a hole with a heap of earth beside it (until you leave)
import * as THREE from 'three';
import { depositsNear } from '../data/economy.mjs';

const SEE = 450, DROP = 600;      // seeps and derricks are built this close, and taken down further away
const REACH = 5;                  // E this close to a derrick's foot

export function createOil({ scene, colliders, groundAt, getPos }) {
  const tar = new THREE.MeshStandardMaterial({ color: '#070605', roughness: 0.45, metalness: 0 });
  const tarEdge = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.9 });
  const timber = new THREE.MeshStandardMaterial({ color: '#6a4a2c', roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: '#3a3a3e', roughness: 0.6, metalness: 0.6 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: '#7a2a1e', roughness: 0.7, metalness: 0.2 });
  const earth = new THREE.MeshStandardMaterial({ color: '#5a4430', roughness: 1 });
  const hole = new THREE.MeshStandardMaterial({ color: '#1e150e', roughness: 1 });

  const seeps = new Map();   // deposit id -> group
  const derricks = new Map(); // well id -> { group, solid, well }
  let wells = [];
  const pits = [];

  function seepAt(d) {
    const g = new THREE.Group();
    g.name = 'oil-seep';
    const n = 4 + (d.r % 3);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4 + d.r, rr = i ? 1.2 + (i * 0.37 % 1) * 2.2 : 0;
      const x = d.x + Math.cos(a) * rr * 1.6, z = d.z + Math.sin(a) * rr * 1.6;
      const s = 1.4 + ((i * 7 + d.r) % 5) * 0.35;
      const edge = new THREE.Mesh(new THREE.CircleGeometry(s * 1.25, 14), tarEdge);
      edge.rotation.x = -Math.PI / 2; edge.position.set(x, groundAt(x, z) + 0.03, z);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(s, 14), tar);
      pool.rotation.x = -Math.PI / 2; pool.position.set(x, groundAt(x, z) + 0.05, z);
      g.add(edge, pool);
    }
    return g;
  }

  // a timber derrick over the pool: four legs leaning in, cross braces, a crown block on top,
  // a pump beam nodding beside it, a little shed and some barrels
  function derrickAt(w) {
    const g = new THREE.Group();
    g.name = 'oil-derrick';
    const y = groundAt(w.x, w.z);
    g.position.set(w.x, y, w.z);
    const H = 13, base = 2.6, top = 0.7;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, H + 0.4, 0.22), timber);
      leg.position.set(sx * (base + top) / 2, H / 2, sz * (base + top) / 2);
      leg.rotation.z = -sx * Math.atan((base - top) / H);
      leg.rotation.x = sz * Math.atan((base - top) / H);
      leg.castShadow = true;
      g.add(leg);
    }
    for (let k = 1; k <= 5; k++) {
      const h = (k / 6) * H, half = base - (base - top) * (h / H);
      for (const [rx, rz, ry] of [[0, -half, 0], [0, half, 0], [-half, 0, Math.PI / 2], [half, 0, Math.PI / 2]]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.12, 0.12), timber);
        brace.position.set(rx, h, rz); brace.rotation.y = ry;
        g.add(brace);
      }
    }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8), iron);
    crown.position.y = H + 0.3; g.add(crown);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, H, 8), iron);
    pipe.position.y = H / 2; g.add(pipe);
    // the pump: a post with a beam that nods up and down
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), iron);
    post.position.set(4.2, 1.1, 0); g.add(post);
    const beam = new THREE.Group(); beam.position.set(4.2, 2.3, 0);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 0.3), iron); beam.add(bar);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), iron); head.position.set(-2.1, -0.3, 0); beam.add(head);
    g.add(beam);
    g.userData.beam = beam;
    // the shed and barrels
    const shed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.2), timber);
    shed.position.set(-4, 1.1, 2.4); shed.castShadow = true; g.add(shed);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 2.6), iron);
    roof.position.set(-4, 2.3, 2.4); roof.rotation.x = 0.15; g.add(roof);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 10), barrelMat);
      b.position.set(-1.6 + (i % 3) * 0.7, 0.45 + Math.floor(i / 3) * 0.9, 3.8 - Math.floor(i / 3) * 0.3); g.add(b);
    }
    // a black pool round the foot
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 14), tar);
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.05; g.add(pool);
    // a sign with the company's name
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#2a1a0a'; x.font = 'bold 22px serif'; x.textAlign = 'center';
    x.fillText(String(w.company).slice(0, 22), 128, 28); x.font = '16px serif'; x.fillText(w.dry ? 'Run dry' : 'Oil well', 128, 52);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    sign.position.set(0, 1.6, -base - 0.3); g.add(sign);
    const solid = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ x: w.x + sx * base * 0.95, z: w.z + sz * base * 0.95, r: 0.35, kind: 'wall', height: 6 }))
      .concat([{ x: w.x - 4, z: w.z + 2.4, r: 1.4, kind: 'wall', height: 2.4 }, { x: w.x + 4.2, z: w.z, r: 0.5, kind: 'wall', height: 2.5 }]);
    return { group: g, solid };
  }

  function dropDerrick(id) {
    const d = derricks.get(id);
    if (!d) return;
    scene.remove(d.group);
    colliders.remove(d.solid);
    derricks.delete(id);
  }

  let lastAt = null;
  function update(x, z, force = false) {
    if (!force && lastAt && Math.hypot(lastAt.x - x, lastAt.z - z) < 40) return;
    lastAt = { x, z };
    const want = new Set(depositsNear(x, z, SEE).filter((d) => d.seep).map((d) => d.id));
    for (const [id, g] of seeps) if (Math.hypot(g.userData.d.x - x, g.userData.d.z - z) > DROP) { scene.remove(g); seeps.delete(id); }
    for (const d of depositsNear(x, z, SEE)) {
      if (!want.has(d.id) || seeps.has(d.id)) continue;
      const g = seepAt(d); g.userData.d = d; scene.add(g); seeps.set(d.id, g);
    }
    for (const [id, d] of derricks) if (Math.hypot(d.well.x - x, d.well.z - z) > DROP || !wells.some((w) => w.id === id)) dropDerrick(id);
    for (const w of wells) {
      const have = derricks.get(w.id);
      if (have && (have.well.company !== w.company || have.well.dry !== w.dry)) dropDerrick(w.id);
      if (derricks.has(w.id) || Math.hypot(w.x - x, w.z - z) > SEE) { if (derricks.has(w.id)) derricks.get(w.id).well = w; continue; }
      const built = derrickAt(w);
      scene.add(built.group);
      colliders.add(built.solid);
      derricks.set(w.id, { ...built, well: w });
    }
  }

  return {
    update,
    // everyone's derricks, from the server
    setWells(list) { wells = Array.isArray(list) ? list : []; const p = getPos(); update(p.x, p.z, true); },
    wells: () => wells,
    // the pump beams nod (only for derricks still pumping)
    animate(t) { for (const d of derricks.values()) if (!d.well.dry) d.group.userData.beam.rotation.z = Math.sin(t * 1.4 + d.well.x) * 0.22; },
    // E beside a derrick: the well, or null
    near(x, z) {
      let best = null, bd = Infinity;
      for (const d of derricks.values()) { const k = Math.hypot(d.well.x - x, d.well.z - z); if (k < REACH && k < bd) { bd = k; best = d.well; } }
      return best;
    },
    // standing in a seep: its pool, or null
    seepAt(x, z) {
      for (const g of seeps.values()) { const d = g.userData.d; if (Math.hypot(d.x - x, d.z - z) < Math.min(d.r, 9)) return d; }
      return null;
    },
    // a test pit dug here: a dark hole and a heap of earth beside it
    pit(x, z, heading = 0) {
      const g = new THREE.Group();
      const y = groundAt(x, z);
      const h = new THREE.Mesh(new THREE.CircleGeometry(0.75, 12), hole);
      h.rotation.x = -Math.PI / 2; h.position.set(x, y + 0.04, z); g.add(h);
      const mx = x + Math.cos(heading) * 1.4, mz = z - Math.sin(heading) * 1.4;
      const heap = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), earth);
      heap.scale.y = 0.55; heap.position.set(mx, groundAt(mx, mz), mz); g.add(heap);
      scene.add(g);
      pits.push(g);
      if (pits.length > 12) scene.remove(pits.shift());
    },
    dispose() {
      for (const g of seeps.values()) scene.remove(g);
      for (const id of [...derricks.keys()]) dropDerrick(id);
      for (const g of pits) scene.remove(g);
      seeps.clear(); pits.length = 0;
    },
  };
}

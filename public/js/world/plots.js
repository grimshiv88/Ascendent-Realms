// Land plots in the world: the buying grid (press L), the chosen plot, and corner posts on owned land.
import * as THREE from 'three';
import { PLOT, heightAt } from '../data/world-layout.mjs';
import { whyNot, isRiver, PURPOSES, NEIGHBOURS } from '../data/land.mjs';

const GRID_R = 7;       // plots shown in each direction around you
const STEP = 2.5;       // the grid lines follow the ground every few metres
const LIFT = 0.25;

const COLORS = {
  free: new THREE.Color('#5fe08a'), taken: new THREE.Color('#e0484a'), mine: new THREE.Color('#ffd76a'), no: new THREE.Color('#b8c2d0'),
  river: new THREE.Color('#4aa8ff'), chosen: new THREE.Color('#9fd4ff'),
};

export function createPlots(scene) {
  let lands = new Map(); // "ix,iz" -> plot
  let on = false;
  let centre = null;
  let selected = null;
  let chosen = new Set(); // "ix,iz" of the plots picked to buy together
  const canBuy = new Map(); // cache per plot: { why, river } as if it were beside your land

  const gridMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
  let grid = null;
  const pickMat = new THREE.MeshBasicMaterial({ color: '#9fd4ff', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  let pickMeshes = [];
  const posts = new THREE.Group();
  scene.add(posts);
  let postsCentre = null;

  const key = (ix, iz) => `${ix},${iz}`;
  const besideMine = (ix, iz) => NEIGHBOURS.some(([dx, dz]) => lands.get(key(ix + dx, iz + dz))?.mine || chosen.has(key(ix + dx, iz + dz)));
  function base(ix, iz) {
    const k = key(ix, iz);
    if (!canBuy.has(k)) { const why = whyNot(ix, iz, () => true); canBuy.set(k, { why, river: !why && whyNot(ix, iz) !== null && isRiver(ix, iz) }); }
    return canBuy.get(k);
  }
  function status(ix, iz) {
    const p = lands.get(key(ix, iz));
    if (p) return p.mine ? 'mine' : 'taken';
    if (chosen.has(key(ix, iz))) return 'chosen';
    const b = base(ix, iz);
    if (b.why) return 'no';
    return b.river && !besideMine(ix, iz) ? 'river' : 'free';
  }
  // why a plot can't be bought right now, or null
  const why = (ix, iz) => (base(ix, iz).why || (base(ix, iz).river ? whyNot(ix, iz, besideMine) : null));

  // Glowing strips along every plot edge near (cx, cz), coloured by who owns the plot
  function buildGrid(cx, cz) {
    if (grid) { scene.remove(grid); grid.geometry.dispose(); }
    const pos = [], col = [];
    const W = 0.18; // half the strip width
    const edge = (x0, z0, x1, z1, c) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.ceil(len / STEP);
      const nx = -(z1 - z0) / len * W, nz = (x1 - x0) / len * W; // sideways
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n;
        const xa = x0 + (x1 - x0) * a, za = z0 + (z1 - z0) * a, xb = x0 + (x1 - x0) * b, zb = z0 + (z1 - z0) * b;
        const ya = Math.max(heightAt(xa, za), 0) + LIFT, yb = Math.max(heightAt(xb, zb), 0) + LIFT; // over rivers, on the water
        pos.push(xa - nx, ya, za - nz, xa + nx, ya, za + nz, xb + nx, yb, zb + nz);
        pos.push(xa - nx, ya, za - nz, xb + nx, yb, zb + nz, xb - nx, yb, zb - nz);
        for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
      }
    };
    for (let iz = cz - GRID_R; iz <= cz + GRID_R; iz++) {
      for (let ix = cx - GRID_R; ix <= cx + GRID_R; ix++) {
        const c = COLORS[status(ix, iz)];
        // draw each plot slightly inset so neighbours' colours don't overlap
        const x0 = ix * PLOT + 0.4, z0 = iz * PLOT + 0.4, x1 = (ix + 1) * PLOT - 0.4, z1 = (iz + 1) * PLOT - 0.4;
        edge(x0, z0, x1, z0, c); edge(x1, z0, x1, z1, c); edge(x1, z1, x0, z1, c); edge(x0, z1, x0, z0, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    grid = new THREE.Mesh(geo, gridMat);
    grid.renderOrder = 2;
    scene.add(grid);
  }

  // See-through sheets over the chosen plots (and the one last tapped), following the ground
  function buildPick() {
    for (const m of pickMeshes) { scene.remove(m); m.geometry.dispose(); }
    pickMeshes = [];
    const show = new Set(chosen);
    if (selected) show.add(key(selected.ix, selected.iz));
    for (const k of show) {
      const [ix, iz] = k.split(',').map(Number);
      const n = 8;
      const geo = new THREE.PlaneGeometry(PLOT - 0.8, PLOT - 0.8, n, n);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      const ox = (ix + 0.5) * PLOT, oz = (iz + 0.5) * PLOT;
      for (let i = 0; i < p.count; i++) p.setY(i, Math.max(heightAt(ox + p.getX(i), oz + p.getZ(i)), 0) + LIFT * 0.8);
      geo.translate(ox, 0, oz);
      const m = new THREE.Mesh(geo, pickMat);
      m.renderOrder = 1;
      scene.add(m);
      pickMeshes.push(m);
    }
  }

  // Wooden posts with a coloured flag at the outer corners of each owner's land near you: where
  // a territory's border turns, not along straight edges or inside it
  function buildPosts(cx, cz) {
    for (const o of [...posts.children]) { posts.remove(o); o.geometry?.dispose(); }
    const wood = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.9 });
    const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.4, 6);
    const flagGeo = new THREE.PlaneGeometry(0.5, 0.32);
    const mats = new Map();
    const done = new Set();
    for (const p of lands.values()) {
      if (Math.abs(p.ix - cx) > 25 || Math.abs(p.iz - cz) > 25) continue;
      for (const [vx, vz] of [[p.ix, p.iz], [p.ix + 1, p.iz], [p.ix, p.iz + 1], [p.ix + 1, p.iz + 1]]) {
        const k = `${vx},${vz},${p.owner}`;
        if (done.has(k)) continue;
        done.add(k);
        // the four plots around this corner point: which belong to the same owner?
        const same = [[vx - 1, vz - 1], [vx, vz - 1], [vx - 1, vz], [vx, vz]].map(([i, j]) => lands.get(key(i, j))?.owner === p.owner);
        const n = same.filter(Boolean).length;
        const straight = n === 2 && (same[0] === same[1] || same[0] === same[2]);
        if (n === 4 || straight) continue;
        const x = vx * PLOT, z = vz * PLOT, y = heightAt(x, z);
        if (!mats.has(p.purpose)) mats.set(p.purpose, new THREE.MeshStandardMaterial({ color: PURPOSES[p.purpose]?.color || '#999', side: THREE.DoubleSide, roughness: 0.8 }));
        const post = new THREE.Mesh(postGeo, wood);
        post.position.set(x, y + 0.7, z);
        post.castShadow = true;
        posts.add(post);
        const flag = new THREE.Mesh(flagGeo, mats.get(p.purpose));
        flag.position.set(x + 0.27, y + 1.22, z);
        posts.add(flag);
      }
    }
  }

  return {
    // `plots` from the server: [{ix, iz, owner, purpose, flat, mine}]
    setLands(plots) {
      lands = new Map(plots.map((p) => [key(p.ix, p.iz), p]));
      canBuy.clear();
      if (on && centre) buildGrid(centre.ix, centre.iz);
      if (postsCentre) buildPosts(postsCentre.ix, postsCentre.iz);
      buildPick();
    },
    setMode(v) {
      on = v;
      if (!on) {
        if (grid) { scene.remove(grid); grid.geometry.dispose(); grid = null; }
        selected = null;
        chosen = new Set();
        buildPick();
      }
      centre = null;
    },
    get on() { return on; },
    // Follow the player: rebuild the grid when they cross into another plot
    update(x, z) {
      const ix = Math.floor(x / PLOT), iz = Math.floor(z / PLOT);
      if (on && (!centre || Math.abs(centre.ix - ix) > 2 || Math.abs(centre.iz - iz) > 2)) {
        centre = { ix, iz };
        buildGrid(ix, iz);
      }
      if (!postsCentre || Math.abs(postsCentre.ix - ix) > 8 || Math.abs(postsCentre.iz - iz) > 8) {
        postsCentre = { ix, iz };
        buildPosts(ix, iz);
      }
    },
    // The plot a ray from the camera lands on (marching over the ground)
    pick(ray) {
      const p = ray.origin.clone();
      for (let d = 0; d < 400; d += 0.5) {
        p.copy(ray.origin).addScaledVector(ray.direction, d);
        if (p.y <= heightAt(p.x, p.z)) return { ix: Math.floor(p.x / PLOT), iz: Math.floor(p.z / PLOT) };
      }
      return null;
    },
    select(plot) {
      selected = plot;
      buildPick();
      if (!plot) return null;
      const owned = lands.get(key(plot.ix, plot.iz)) || null;
      return { ...plot, owned, why: owned ? null : why(plot.ix, plot.iz), river: !owned && base(plot.ix, plot.iz).river };
    },
    // the plots picked to buy together ([{ix, iz}])
    setChosen(list) {
      chosen = new Set(list.map((p) => key(p.ix, p.iz)));
      if (on && centre) buildGrid(centre.ix, centre.iz);
      buildPick();
    },
    dispose() {
      if (grid) { scene.remove(grid); grid.geometry.dispose(); }
      for (const m of pickMeshes) { scene.remove(m); m.geometry.dispose(); }
      scene.remove(posts);
    },
  };
}

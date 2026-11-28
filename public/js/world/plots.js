// Land plots in the world: the buying grid (press L), the chosen plot, and a coloured line round owned land.
import * as THREE from 'three';
import { PLOT, surfaceAt } from '../data/world-layout.mjs';
import { whyNot, isRiver, NEIGHBOURS } from '../data/land.mjs';
import { isRuler } from '../data/building.mjs';

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

  // Glowing strips along every plot edge near (cx, cz), coloured by who owns the plot. Plots of the
  // same kind side by side (your own joined-up land, say) share one thin line where they touch; where
  // the kind changes (the edge of your land) each side has a thick strip, the two touching, no gap.
  const group = (ix, iz) => { const st = status(ix, iz); return st === 'taken' ? `taken:${lands.get(key(ix, iz)).owner}` : st; };
  const THICK = 0.42, THIN = 0.07;
  function buildGrid(cx, cz) {
    if (grid) { scene.remove(grid); grid.geometry.dispose(); }
    const pos = [], col = [];
    // a strip along the line from (x0, z0) to (x1, z1), from `a` to `b` metres to its left
    const strip = (x0, z0, x1, z1, a, b, c) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.ceil(len / STEP);
      const lx = -(z1 - z0) / len, lz = (x1 - x0) / len;
      const y = (x, z) => Math.max(surfaceAt(x, z), 0) + LIFT; // (the ground as drawn; over rivers, on the water)
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const xa = x0 + (x1 - x0) * t0, za = z0 + (z1 - z0) * t0, xb = x0 + (x1 - x0) * t1, zb = z0 + (z1 - z0) * t1;
        const p1 = [xa + lx * a, za + lz * a], p2 = [xa + lx * b, za + lz * b], p3 = [xb + lx * b, zb + lz * b], p4 = [xb + lx * a, zb + lz * a];
        const [y1, y2, y3, y4] = [p1, p2, p3, p4].map(([x, z]) => y(x, z));
        pos.push(p1[0], y1, p1[1], p2[0], y2, p2[1], p3[0], y3, p3[1]);
        pos.push(p1[0], y1, p1[1], p3[0], y3, p3[1], p4[0], y4, p4[1]);
        for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
      }
    };
    const inWindow = (ix, iz) => Math.abs(ix - cx) <= GRID_R && Math.abs(iz - cz) <= GRID_R;
    for (let iz = cz - GRID_R; iz <= cz + GRID_R; iz++) {
      for (let ix = cx - GRID_R; ix <= cx + GRID_R; ix++) {
        const g = group(ix, iz), c = COLORS[status(ix, iz)];
        const x0 = ix * PLOT, z0 = iz * PLOT, x1 = x0 + PLOT, z1 = z0 + PLOT;
        // each side, walked so the plot is on its left: [neighbour dx, dz, from, to]
        for (const [dx, dz, ax, az, bx, bz] of [[0, -1, x1, z0, x0, z0], [-1, 0, x0, z0, x0, z1], [0, 1, x0, z1, x1, z1], [1, 0, x1, z1, x1, z0]]) {
          const nx = ix + dx, nz = iz + dz;
          if (group(nx, nz) !== g) strip(ax, az, bx, bz, 0, THICK, c);
          else if (dx + dz < 0 || !inWindow(nx, nz)) strip(ax, az, bx, bz, -THIN, THIN, c); // (drawn once, by one of the two)
        }
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
  const pickedMat = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  let picked = new Set(); // "ix,iz" of your own plots chosen to clear or flatten together
  function sheet(ix, iz, mat) {
    const n = 8;
    const geo = new THREE.PlaneGeometry(PLOT - 0.8, PLOT - 0.8, n, n);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const ox = (ix + 0.5) * PLOT, oz = (iz + 0.5) * PLOT;
    for (let i = 0; i < p.count; i++) p.setY(i, Math.max(surfaceAt(ox + p.getX(i), oz + p.getZ(i)), 0) + LIFT * 0.8);
    geo.translate(ox, 0, oz);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 1;
    scene.add(m);
    pickMeshes.push(m);
  }
  function buildPick() {
    for (const m of pickMeshes) { scene.remove(m); m.geometry.dispose(); }
    pickMeshes = [];
    const show = new Set(chosen);
    if (selected && !picked.has(key(selected.ix, selected.iz))) show.add(key(selected.ix, selected.iz));
    for (const k of show) { const [ix, iz] = k.split(',').map(Number); sheet(ix, iz, pickMat); }
    for (const k of picked) { const [ix, iz] = k.split(',').map(Number); sheet(ix, iz, pickedMat); }
  }

  // A bright line along the outer border of each owner's land near you, following the ground:
  // gold round your own land, red round other people's, grey round a nation (a ruler's country).
  const lineMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const BORDER = { mine: new THREE.Color('#ffc83a'), other: new THREE.Color('#e0353a'), nation: new THREE.Color('#9aa0a8') };
  const LINE_H = 0.45, LINE_STEP = 2.5;
  function buildPosts(cx, cz) {
    for (const o of [...posts.children]) { posts.remove(o); o.geometry?.dispose(); }
    // whose land is a country: 100+ plots, all joined up
    const byOwner = new Map();
    for (const p of lands.values()) { if (!byOwner.has(p.owner)) byOwner.set(p.owner, []); byOwner.get(p.owner).push(p); }
    const ruler = new Map([...byOwner].map(([o, list]) => [o, isRuler(list)]));
    const pos = [], col = [];
    for (const p of lands.values()) {
      if (Math.abs(p.ix - cx) > 25 || Math.abs(p.iz - cz) > 25) continue;
      const c = p.mine ? BORDER.mine : ruler.get(p.owner) ? BORDER.nation : BORDER.other;
      const x0 = p.ix * PLOT, z0 = p.iz * PLOT;
      // each side whose neighbour belongs to someone else is part of the border
      for (const [dx, dz, ax, az, bx, bz] of [[0, -1, 0, 0, 1, 0], [0, 1, 0, 1, 1, 1], [-1, 0, 0, 0, 0, 1], [1, 0, 1, 0, 1, 1]]) {
        if (lands.get(key(p.ix + dx, p.iz + dz))?.owner === p.owner) continue;
        // pulled a little inside the plot so two neighbours' lines don't fight
        const ix = -dx * 0.12, iz = -dz * 0.12;
        const n = Math.round(PLOT / LINE_STEP);
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n;
          const xa = x0 + (ax + (bx - ax) * t0) * PLOT + ix, za = z0 + (az + (bz - az) * t0) * PLOT + iz;
          const xb = x0 + (ax + (bx - ax) * t1) * PLOT + ix, zb = z0 + (az + (bz - az) * t1) * PLOT + iz;
          const ya = surfaceAt(xa, za) + 0.02, yb = surfaceAt(xb, zb) + 0.02;
          pos.push(xa, ya, za, xb, yb, zb, xb, yb + LINE_H, zb, xa, ya, za, xb, yb + LINE_H, zb, xa, ya + LINE_H, za);
          for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
        }
      }
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geo, lineMat);
    mesh.renderOrder = 2;
    posts.add(mesh);
  }

  return {
    // `plots` from the server: [{ix, iz, owner, purpose, flat, mine}]
    setLands(plots) {
      const old = lands;
      lands = new Map(plots.map((p) => [key(p.ix, p.iz), p]));
      // whether a plot can be bought hangs on the ground, so only the plots by land that was levelled
      // (or that changed hands) are checked again; checking all of them was a stall after every change
      const changed = [...lands.values()].filter((p) => { const o = old.get(key(p.ix, p.iz)); return !o || o.flat !== p.flat; }).concat([...old.values()].filter((p) => !lands.has(key(p.ix, p.iz))));
      if (changed.length > 60) canBuy.clear();
      else for (const p of changed) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) canBuy.delete(key(p.ix + dx, p.iz + dz));
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
        picked = new Set();
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
        if (p.y <= Math.max(surfaceAt(p.x, p.z), 0)) return { ix: Math.floor(p.x / PLOT), iz: Math.floor(p.z / PLOT) };
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
    // your own plots chosen to clear or flatten together ([{ix, iz}])
    setPicked(list) {
      picked = new Set(list.map((p) => key(p.ix, p.iz)));
      buildPick();
    },
    dispose() {
      if (grid) { scene.remove(grid); grid.geometry.dispose(); }
      for (const m of pickMeshes) { scene.remove(m); m.geometry.dispose(); }
      scene.remove(posts);
    },
  };
}

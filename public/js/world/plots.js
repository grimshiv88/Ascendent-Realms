// Land plots in the world: the buying grid (press L), the chosen plot, and a coloured line round owned land.
import * as THREE from 'three';
import { PLOT, heightAt, surfaceAt } from '../data/world-layout.mjs';
import { whyNot, isRiver, NEIGHBOURS } from '../data/land.mjs';
import { COUNTRY_PLOTS } from '../data/building.mjs';

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

  // A bright line along the outer border of each owner's land near you, following the ground:
  // gold round your own land, red round other people's, grey round a nation (a ruler's country).
  const lineMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const BORDER = { mine: new THREE.Color('#ffc83a'), other: new THREE.Color('#e0353a'), nation: new THREE.Color('#9aa0a8') };
  const LINE_H = 0.45, LINE_STEP = 2.5;
  function buildPosts(cx, cz) {
    for (const o of [...posts.children]) { posts.remove(o); o.geometry?.dispose(); }
    const owned = new Map();
    for (const p of lands.values()) owned.set(p.owner, (owned.get(p.owner) || 0) + 1);
    const pos = [], col = [];
    for (const p of lands.values()) {
      if (Math.abs(p.ix - cx) > 25 || Math.abs(p.iz - cz) > 25) continue;
      const c = p.mine ? BORDER.mine : owned.get(p.owner) >= COUNTRY_PLOTS ? BORDER.nation : BORDER.other;
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

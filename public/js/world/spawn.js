// A waystone shrine: a ring of standing stones around a glowing crystal, with a campfire and signpost.
// The spawn point in the Central City is one; every village and homeland has its own.
import * as THREE from 'three';
import { heightAt, SAFE_R } from '../data/world-layout.mjs';
import { MARKETS } from '../data/items.mjs';

export function buildSpawn(place = { x: 0, z: 0, name: 'Central City' }, { market: withMarket = true, lanterns = true } = {}) {
  const g = new THREE.Group();
  const cx = place.x, cz = place.z;
  const baseY = heightAt(cx, cz);
  g.position.set(cx, baseY, cz);
  // solid things you bump into (low ones, like the logs, you can climb onto)
  const solid = [];
  const put = (x, z, r, height, step = false) => solid.push({ x: cx + x, z: cz + z, r, kind: 'wall', height, y: heightAt(cx + x, cz + z), step });
  const stone = new THREE.MeshStandardMaterial({ color: '#8a857a', roughness: 0.9 });
  const darkStone = new THREE.MeshStandardMaterial({ color: '#6a665e', roughness: 0.95 });
  const gold = new THREE.MeshStandardMaterial({ color: '#f5c84c', emissive: '#f5a81c', emissiveIntensity: 1.6, roughness: 0.3 });

  // Platform: a low round dais with steps
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.6, 0.45, 48), stone);
  dais.position.y = 0.22;
  const step = new THREE.Mesh(new THREE.CylinderGeometry(7.9, 8.4, 0.2, 48), darkStone);
  step.position.y = 0.1;
  for (const m of [dais, step]) { m.receiveShadow = true; m.castShadow = true; g.add(m); }

  // Glowing rune ring set into the dais
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.06, 8, 96), gold);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.46;
  g.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.05, 8, 64), gold);
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 0.46;
  g.add(inner);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.12), gold);
    rune.position.set(Math.cos(a) * 3.7, 0.46, Math.sin(a) * 3.7);
    rune.rotation.y = -a;
    g.add(rune);
  }

  // Standing stones around the edge, about 3.5 m tall
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const h = 3.2 + (i % 3) * 0.4;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.6), stone);
    s.position.set(Math.cos(a) * 9.5, heightAt(cx + Math.cos(a) * 9.5, cz + Math.sin(a) * 9.5) - baseY + h / 2 - 0.1, Math.sin(a) * 9.5);
    s.rotation.y = -a;
    s.rotation.z = (i % 2 ? 1 : -1) * 0.04;
    put(Math.cos(a) * 9.5, Math.sin(a) * 9.5, 0.55, h);
    s.castShadow = true;
    s.receiveShadow = true;
    g.add(s);
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.9), gold);
    glyph.position.copy(s.position).add(new THREE.Vector3(-Math.cos(a) * 0.31, 0.4, -Math.sin(a) * 0.31));
    glyph.rotation.y = -a - Math.PI / 2;
    g.add(glyph);
  }

  // Floating crystal in the centre
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#f5b52c', emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.2 }),
  );
  crystal.scale.set(1, 1.7, 1);
  crystal.position.y = 2.6;
  crystal.castShadow = true;
  g.add(crystal);
  const crystalLight = new THREE.PointLight('#ffc860', 25, 22, 1.6);
  crystalLight.position.y = 2.6;
  g.add(crystalLight);

  // Campfire beside the path
  const fire = new THREE.Group();
  const fireY = heightAt(cx + 9.5, cz - 11); // the fire and its seats sit on this, so you stand on them where they are drawn
  fire.position.set(9.5, fireY - baseY, -11);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), darkStone);
    r.position.set(Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8);
    fire.add(r);
    solid.push({ x: cx + 9.5 + r.position.x, z: cz - 11 + r.position.z, r: 0.22, kind: 'wall', height: 0.3, y: fireY, step: true });
  }
  const logMat = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6), logMat);
    log.rotation.set(Math.PI / 2 - 0.5, (i / 4) * Math.PI * 2, 0);
    log.position.y = 0.25;
    fire.add(log);
  }
  const flameMat = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff7a1a', emissiveIntensity: 3, transparent: true, opacity: 0.9 });
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.25 - i * 0.05, 0.9 - i * 0.15, 8), flameMat);
    f.position.set((i - 1) * 0.12, 0.6, (i % 2) * 0.1);
    fire.add(f);
    flames.push(f);
  }
  const fireLight = new THREE.PointLight('#ff9a3c', 18, 16, 1.8);
  fireLight.position.y = 1;
  fire.add(fireLight);
  // logs to sit on
  for (const [x, z, ry] of [[-1.8, 0.3, 0.2], [1.6, 1.2, -0.9]]) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 2, 10), logMat);
    seat.rotation.set(0, ry, Math.PI / 2);
    seat.position.set(x, 0.28, z);
    for (const k of [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9]) solid.push({ x: cx + 9.5 + x + Math.cos(ry) * k, z: cz - 11 + z - Math.sin(ry) * k, r: 0.3, kind: 'wall', height: 0.56, y: fireY, step: true });
    seat.castShadow = true;
    fire.add(seat);
  }
  g.add(fire);
  put(9.5, -11, 0.55, 0.5); // the fire

  // Signpost pointing north along the path
  const post = new THREE.Group();
  post.position.set(-4.5, heightAt(cx - 4.5, cz - 16) - baseY, -16);
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.95 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 8), wood);
  pole.position.y = 1.2;
  post.add(pole);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.06), wood);
  board.position.set(0.92, 2.0, 0); // to one side of the pole, so the pole never covers the name
  post.add(board);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36), new THREE.MeshBasicMaterial({ map: textTexture(place.name.replace(/ \(.*\)/, '')), transparent: true }));
  sign.position.set(0.92, 2.0, 0.035);
  post.add(sign);
  const signBack = sign.clone();
  signBack.rotation.y = Math.PI;
  signBack.position.z = -0.035;
  post.add(signBack);
  post.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(post);
  put(-4.5, -16, 0.15, 2.4);

  // The safe zone's edge: a ring of lantern posts. Monsters never cross it.
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffb84a', emissiveIntensity: 1.4 });
  for (let i = 0; i < (lanterns ? 24 : 0); i++) {
    const a = (i / 24) * Math.PI * 2, x = Math.cos(a) * SAFE_R, z = Math.sin(a) * SAFE_R;
    const lp = new THREE.Group();
    lp.position.set(x, heightAt(cx + x, cz + z) - baseY, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 6), wood);
    pole.position.y = 0.9;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), lanternMat);
    lamp.position.y = 1.9;
    lp.add(pole, lamp);
    put(x, z, 0.12, 2);
    g.add(lp);
  }

  // The game's market for this place: a stall with an awning, inside the safe zone
  const market = withMarket && MARKETS[place.id];
  let marketAt = null;
  if (market) {
    const mx = 14, mz = 8;
    const stall = new THREE.Group();
    stall.position.set(mx, heightAt(cx + mx, cz + mz) - baseY, mz);
    stall.rotation.y = -Math.PI / 2 + Math.atan2(mx, mz) + Math.PI; // facing the shrine
    const table = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.2), wood);
    table.position.y = 0.45;
    const ra = stall.rotation.y;
    for (const k of [-1, 0, 1]) put(mx + Math.cos(ra) * k, mz - Math.sin(ra) * k, 0.65, 0.9);
    const cloth = new THREE.MeshStandardMaterial({ color: '#a8322a', roughness: 0.9, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.8), cloth);
    roof.position.set(0, 2.5, -0.1);
    roof.rotation.x = 0.18;
    stall.add(table, roof);
    for (const [x, z] of [[-1.6, -0.8], [1.6, -0.8], [-1.6, 0.6], [1.6, 0.6]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), wood);
      leg.position.set(x, 1.25, z);
      stall.add(leg);
    }
    // goods on the table
    const goods = ['#d8a040', '#6a9a3a', '#4a7ad0', '#c04040'];
    goods.forEach((col, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
      box.position.set(-1.1 + i * 0.72, 1.05, 0);
      stall.add(box);
    });
    // the name on a board, written on both faces so it reads the right way round from either side
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.6), new THREE.MeshBasicMaterial({ map: textTexture(market.name), transparent: true }));
    label.position.set(0, 2.15, 0.56);
    const labelBack = label.clone();
    labelBack.rotation.y = Math.PI;
    labelBack.position.z = 0.54;
    const boardBack = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.66, 0.015), wood);
    boardBack.position.set(0, 2.15, 0.55);
    stall.add(boardBack, label, labelBack);
    stall.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(stall);
    marketAt = { id: place.id, x: cx + mx, z: cz + mz };
  }

  return {
    group: g,
    market: marketAt,
    solid,
    update(t) {
      crystal.rotation.y = t * 0.6;
      crystal.position.y = 2.6 + Math.sin(t * 1.3) * 0.15;
      crystalLight.intensity = 22 + Math.sin(t * 2.1) * 4;
      flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 12 + i * 2) * 0.18; f.rotation.y = t * (1 + i); });
      fireLight.intensity = 16 + Math.sin(t * 17) * 2 + Math.sin(t * 7.3) * 2;
    },
  };
}

export function textTexture(text) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f0e2c0';
  ctx.font = `bold ${text.length > 14 ? 48 : 60}px Cinzel, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 320, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

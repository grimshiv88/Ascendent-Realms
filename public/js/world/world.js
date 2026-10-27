// The playable world: the central forest spawn, your character, and a third-person camera.
import * as THREE from 'three';
import { buildGround, buildForest, heightAt, makeColliders, WORLD_SIZE } from './terrain.js';
import { buildSpawn } from './spawn.js';
import { buildCharacter, animateCharacter } from '../characters/model.js';

const WALK = 1.6;   // metres per second, a normal walking pace
const RUN = 4.6;

export function startWorld(canvas, character, { onSaveLocation, onKey } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color('#b9c9b0');
  scene.fog = new THREE.FogExp2(fogColor, 0.0085);
  scene.background = skyTexture();

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);

  // Light: warm afternoon sun, sky fill, and a sun shadow that follows the player
  scene.add(new THREE.HemisphereLight('#dfeaff', '#4a5a30', 1.25));
  const sun = new THREE.DirectionalLight('#fff0d0', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3(60, 90, 40).normalize();

  scene.add(buildGround());
  const forest = buildForest();
  scene.add(forest.group);
  const colliders = makeColliders(forest.trees);
  const spawn = buildSpawn();
  scene.add(spawn.group);

  // Your character
  const avatar = buildCharacter({ race: character.race, form: character.form, stage: character.stage || 0, look: character.look });
  scene.add(avatar);
  const loc = character.location || {};
  const pos = new THREE.Vector3(loc.x ?? 0, 0, loc.z ?? 6);
  let heading = loc.heading ?? Math.PI;
  let velY = 0;
  let airborne = false;
  pos.y = heightAt(pos.x, pos.z) + 0.45; // start standing on the dais

  const speedBonus = 1 + Math.min(character.stats.agi * 0.003, 0.6);
  const bodyH = avatar.userData.height;
  const bodyR = Math.max(0.25, Math.min(bodyH * 0.18, 0.9));

  // Camera orbit
  let yaw = heading + Math.PI;
  let pitch = 0.32;
  let dist = THREE.MathUtils.clamp(bodyH * 2.6 + 2, 3, 16);

  // ---------- input ----------
  const keys = new Set();
  const down = (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    keys.add(e.code);
    onKey?.(e);
  };
  const up = (e) => keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  // Mouse drag (or right side of a touch screen) turns the camera; left side of a touch screen moves
  let look = null;
  const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45) {
      stick.id = e.pointerId; stick.x0 = e.clientX; stick.y0 = e.clientY; stick.x = 0; stick.y = 0;
    } else {
      look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.id) {
      stick.x = THREE.MathUtils.clamp((e.clientX - stick.x0) / 50, -1, 1);
      stick.y = THREE.MathUtils.clamp((e.clientY - stick.y0) / 50, -1, 1);
    } else if (look && e.pointerId === look.id) {
      yaw -= (e.clientX - look.x) * 0.006;
      pitch = THREE.MathUtils.clamp(pitch + (e.clientY - look.y) * 0.004, -0.15, 1.2);
      look.x = e.clientX; look.y = e.clientY;
    }
  });
  const release = (e) => {
    if (e.pointerId === stick.id) { stick.id = null; stick.x = 0; stick.y = 0; }
    if (look && e.pointerId === look.id) look = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.01, 2, 30);
    e.preventDefault();
  }, { passive: false });

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const move = new THREE.Vector3();
  let speedNow = 0;
  let lastSave = 0;
  const half = WORLD_SIZE / 2 - 20;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // Movement relative to the camera
    let fx = 0, fz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
    fx += stick.x; fz -= stick.y;
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stick.x, stick.y) > 0.9;
    const amount = Math.min(1, Math.hypot(fx, fz));
    let target = 0;
    if (amount > 0.05) {
      const camFwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const camRight = new THREE.Vector3(-camFwd.z, 0, camFwd.x);
      move.copy(camFwd).multiplyScalar(fz).addScaledVector(camRight, fx).normalize();
      const want = Math.atan2(move.x, move.z);
      let diff = want - heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      heading += diff * Math.min(1, dt * 10);
      target = (running ? RUN : WALK) * speedBonus * amount * Math.max(0.6, Math.sqrt(bodyH / 1.8));
    }
    speedNow += (target - speedNow) * Math.min(1, dt * 8);
    if (speedNow > 0.01) {
      pos.x += Math.sin(heading) * speedNow * dt;
      pos.z += Math.cos(heading) * speedNow * dt;
      colliders.push(pos, bodyR);
      pos.x = THREE.MathUtils.clamp(pos.x, -half, half);
      pos.z = THREE.MathUtils.clamp(pos.z, -half, half);
    }

    // Ground, jumping and the dais
    let ground = heightAt(pos.x, pos.z);
    const r = Math.hypot(pos.x, pos.z);
    if (r < 7.4) ground = Math.max(ground, heightAt(0, 0) + 0.45);
    if (keys.has('Space') && !airborne) { velY = 4.2; airborne = true; }
    velY -= 9.81 * dt;
    pos.y += velY * dt;
    if (pos.y <= ground) { pos.y = ground; velY = 0; airborne = false; }

    avatar.position.copy(pos);
    avatar.rotation.y = heading;
    animateCharacter(avatar, t, airborne ? 0.3 : speedNow / WALK * 0.9);

    // Camera follows behind and above
    const focus = new THREE.Vector3(pos.x, pos.y + bodyH * 0.8, pos.z);
    const cam = new THREE.Vector3(
      focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      focus.y + Math.sin(pitch) * dist,
      focus.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.5);
    camera.position.lerp(cam, Math.min(1, dt * 10));
    camera.lookAt(focus);

    sun.position.copy(pos).addScaledVector(sunDir, 120);
    sun.target.position.copy(pos);
    spawn.update(t);

    renderer.render(scene, camera);

    if (t - lastSave > 10 && onSaveLocation) {
      lastSave = t;
      onSaveLocation({ x: pos.x, y: pos.y, z: pos.z, heading });
    }
  });

  const saveNow = () => onSaveLocation?.({ x: pos.x, y: pos.y, z: pos.z, heading });
  window.addEventListener('pagehide', saveNow);

  return {
    stop() {
      saveNow();
      renderer.setAnimationLoop(null);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pagehide', saveNow);
      renderer.dispose();
    },
  };
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#5f8fcf');
  g.addColorStop(0.55, '#a9c6e6');
  g.addColorStop(1, '#dfe6d6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

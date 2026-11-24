// Opening animation: a glowing core explodes, the camera rushes in, and embers keep drifting
// behind the menus afterwards.
import * as THREE from 'three';

const CORE_TIME = 0.7;     // seconds the core charges before it bursts
const TITLE_TIME = 1.5;    // when the gold title appears
const DONE_TIME = 3.4;     // when the title docks and the menu shows

function glowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,230,160,0.9)');
  g.addColorStop(0.6, 'rgba(255,140,40,0.25)');
  g.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function randomOnSphere(v) {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return v.set(s * Math.cos(t), s * Math.sin(t), u);
}

export function startIntro(canvas, { onFlash, onTitle, onDone }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.012);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  camera.position.set(0, 0, 70);

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const glow = glowTexture();

  // The charging core
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow, color: 0xffd27a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  core.scale.setScalar(0.5);
  scene.add(core);

  // Explosion sparks
  const SPARKS = 4000;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkCol = new Float32Array(SPARKS * 3);
  const palette = [new THREE.Color(0xfff1b8), new THREE.Color(0xffc040), new THREE.Color(0xff7a1a), new THREE.Color(0xd2380a)];
  const dir = new THREE.Vector3();
  for (let i = 0; i < SPARKS; i++) {
    randomOnSphere(dir).multiplyScalar(18 + Math.random() * 55 * Math.pow(Math.random(), 0.6));
    sparkVel.set([dir.x, dir.y, dir.z], i * 3);
    const c = palette[Math.floor(Math.random() * palette.length)];
    sparkCol.set([c.r, c.g, c.b], i * 3);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 1.4, map: glow, vertexColors: true, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  scene.add(sparks);

  // Shockwave ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 96),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI * 0.42;
  scene.add(ring);

  // Embers that keep drifting upwards behind the menus
  const EMBERS = 600;
  const emberPos = new Float32Array(EMBERS * 3);
  const emberSpeed = new Float32Array(EMBERS);
  for (let i = 0; i < EMBERS; i++) {
    emberPos.set([(Math.random() - 0.5) * 140, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 80], i * 3);
    emberSpeed[i] = 1.5 + Math.random() * 4;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({
    size: 0.9, map: glow, color: 0xffb347, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0,
  });
  scene.add(new THREE.Points(emberGeo, emberMat));

  const clock = new THREE.Clock();
  let elapsed = 0;
  let burst = false, titled = false, done = false;
  let running = true;

  function fire(name, fn) {
    if (name === 'burst' && !burst) { burst = true; fn?.(); }
    if (name === 'title' && !titled) { titled = true; fn?.(); }
    if (name === 'done' && !done) { done = true; fn?.(); }
  }

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    if (elapsed < CORE_TIME) {
      // Charge: the core swells and flickers
      const k = elapsed / CORE_TIME;
      core.scale.setScalar(0.5 + k * k * 9 + Math.sin(elapsed * 60) * 0.3 * k);
    } else {
      fire('burst', onFlash);
      const t = elapsed - CORE_TIME;

      core.scale.setScalar(Math.max(0, 14 - t * 30));
      core.material.opacity = Math.max(0, 1 - t * 2);

      // Sparks fly out and slow down
      const drag = Math.exp(-1.6 * dt);
      for (let i = 0; i < SPARKS * 3; i++) {
        sparkVel[i] *= drag;
        sparkPos[i] += sparkVel[i] * dt;
      }
      for (let i = 1; i < SPARKS * 3; i += 3) sparkVel[i] -= 2.5 * dt; // a little gravity
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = t < 0.1 ? t * 10 : Math.max(0, 1 - (t - 0.1) / 2.6);
      sparkMat.size = 1.4 + t * 0.6;

      const r = 1 + t * 70;
      ring.scale.setScalar(r);
      ring.material.opacity = Math.max(0, 0.9 - t * 1.1);

      // Camera rushes in, then settles with a slow drift
      const zoom = 1 - Math.exp(-t * 2.2);
      camera.position.z = 70 - 52 * zoom;
      camera.position.x = Math.sin(elapsed * 0.15) * 2;
      camera.position.y = Math.cos(elapsed * 0.12) * 1.2;
      if (t < 0.5) {
        const shake = (0.5 - t) * 1.2;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
      }
      camera.lookAt(0, 0, 0);

      emberMat.opacity = Math.min(0.85, t * 0.5);
    }

    for (let i = 0; i < EMBERS; i++) {
      const y = i * 3 + 1;
      emberPos[y] += emberSpeed[i] * dt;
      emberPos[y - 1] += Math.sin(elapsed + i) * 0.6 * dt;
      if (emberPos[y] > 45) emberPos[y] = -45;
    }
    emberGeo.attributes.position.needsUpdate = true;

    if (elapsed > TITLE_TIME) fire('title', onTitle);
    if (elapsed > DONE_TIME) fire('done', onDone);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    // Jump straight to the menu (click or key press during the intro)
    skip() {
      if (done) return;
      if (elapsed < CORE_TIME) elapsed = CORE_TIME;
      fire('burst', onFlash);
      fire('title', onTitle);
      elapsed = Math.max(elapsed, DONE_TIME);
      fire('done', onDone);
    },
    stop() {
      running = false;
      window.removeEventListener('resize', resize);
      renderer.dispose();
      renderer.forceContextLoss(); // free its graphics memory for the world
    },
  };
}

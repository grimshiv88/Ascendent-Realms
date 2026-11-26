// A lit showcase scene for viewing characters (gallery and character creation).
import * as THREE from 'three';
import { lightPool } from '../world/lightpool.js';

export function makeStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  lightPool(scene, camera, 2); // (a fairy's glow: see world/lightpool.js)

  scene.add(new THREE.HemisphereLight('#fff1d6', '#2a2016', 1.1));
  const key = new THREE.DirectionalLight('#ffe2b0', 2.4);
  key.position.set(4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -15; key.shadow.camera.right = 15;
  key.shadow.camera.top = 15; key.shadow.camera.bottom = -15;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8fb6ff', 1.2);
  rim.position.set(-5, 4, -6);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: '#2a2114', roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  return { renderer, scene, camera, resize, floor };
}

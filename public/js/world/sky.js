// The sky: a gradient dome with a soft sun glow, also used to light reflective surfaces.
import * as THREE from 'three';

export const HORIZON = new THREE.Color('#c9d6dc');

function skyMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#3f74b8') },
      mid: { value: new THREE.Color('#8fb4da') },
      horizon: { value: HORIZON.clone() },
      ground: { value: new THREE.Color('#8a9688') },
      sun: { value: sunDir.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sun;
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 c = y > 0.0
          ? mix(mix(horizon, mid, smoothstep(0.0, 0.18, y)), top, smoothstep(0.18, 0.8, y))
          : mix(horizon, ground, smoothstep(0.0, -0.2, y));
        float s = max(dot(normalize(vDir), sun), 0.0);
        c += vec3(1.0, 0.85, 0.6) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function createSky(scene, renderer, sunDir) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMaterial(sunDir));
  dome.scale.setScalar(30000);
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  scene.add(dome);

  // Reflections and soft fill light come from the same sky
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMaterial(sunDir));
  envDome.scale.setScalar(100);
  envScene.add(envDome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = env;
  pmrem.dispose();

  // Day and night: blend the sky from its day colours to a starless deep blue, move the sun glow
  const DAY = { top: new THREE.Color('#3f74b8'), mid: new THREE.Color('#8fb4da'), horizon: HORIZON.clone(), ground: new THREE.Color('#8a9688') };
  const NIGHT = { top: new THREE.Color('#03060f'), mid: new THREE.Color('#0b1428'), horizon: new THREE.Color('#1a2438'), ground: new THREE.Color('#0a0d12') };
  const DUSK = new THREE.Color('#e08a5a');
  function setTime(daylight, sun) {
    const u = dome.material.uniforms;
    for (const k of ['top', 'mid', 'ground']) u[k].value.copy(NIGHT[k]).lerp(DAY[k], daylight);
    // a warm horizon at dawn and dusk
    u.horizon.value.copy(NIGHT.horizon).lerp(DAY.horizon, daylight).lerp(DUSK, Math.max(0, 0.45 - Math.abs(daylight - 0.4)) * 0.9);
    u.sun.value.copy(sun).normalize();
    return u.horizon.value;
  }

  return {
    setTime,
    follow(camera) { dome.position.copy(camera.position); },
    dispose() { env.dispose(); dome.geometry.dispose(); dome.material.dispose(); },
  };
}

// A test stage for the sculpted bodies and their motions (for development; not part of the game)
import * as THREE from 'three';
import { makeStage } from '../characters/stage.js';
import { makeBody } from '../characters/body/build.js';

const canvas = document.getElementById('c');
const stage = makeStage(canvas);
stage.resize();
const { scene, camera, renderer } = stage;
const q = new URLSearchParams(location.search);
let body = null;
const studio = {
  build(opts = {}, look = {}) {
    if (body) scene.remove(body.root);
    const t = performance.now();
    body = makeBody(opts, { quality: 'high', ...look });
    scene.add(body.root);
    return { ms: Math.round(performance.now() - t), tris: Object.values(body.meshes).reduce((a, m) => a + m.geometry.index.count / 3, 0) };
  },
  view(at, look) { camera.position.set(...at); camera.lookAt(...look); },
  pose(rot) { for (const [n, r] of Object.entries(rot)) body.bones[n]?.rotation.set(...r); },
  get body() { return body; },
  render() { renderer.render(scene, camera); },
};
window.__studio = studio;
studio.build();
studio.view([0, 1.2, 3.2], [0, 0.95, 0]);
const loop = () => { renderer.render(scene, camera); requestAnimationFrame(loop); };
loop();

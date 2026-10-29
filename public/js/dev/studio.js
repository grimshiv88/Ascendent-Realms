// A test stage for the sculpted bodies and their motions (for development; not part of the game)
import * as THREE from 'three';
import { makeStage } from '../characters/stage.js';
import { makeBody } from '../characters/body/build.js';
import { poseOf, applyPose } from '../characters/body/motion.js';
import { MOTIONS } from './motions-demo.js';

const canvas = document.getElementById('c');
const stage = makeStage(canvas);
stage.resize();
const { scene, camera, renderer } = stage;
camera.near = 0.02; camera.updateProjectionMatrix();
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
  view(at, look) {
    // look: a point, or a bone's name (then `at` is an offset from that bone)
    if (typeof look === 'string') {
      const p = new THREE.Vector3();
      body.bones[look].getWorldPosition(p);
      camera.position.set(p.x + at[0], p.y + at[1], p.z + at[2]); camera.lookAt(p);
    } else { camera.position.set(...at); camera.lookAt(...look); }
  },
  pose(rot) { for (const [n, r] of Object.entries(rot)) body.bones[n]?.rotation.set(...r); },
  // spec: a pose (see motion.js poseOf)
  set(spec) { applyPose(body, poseOf(spec)); },
  // a motion from motions-demo.js at time t (seconds)
  play(name, t, opts) { MOTIONS[name](body, t, scene, opts); },
  get body() { return body; },
  render() { renderer.render(scene, camera); },
};
window.__studio = studio;
studio.build();
studio.view([0, 1.2, 3.2], [0, 0.95, 0]);
// ?still=1: no render loop (frames are drawn on request, for recording videos)
const loop = () => { renderer.render(scene, camera); if (!q.has('still')) requestAnimationFrame(loop); };
loop();

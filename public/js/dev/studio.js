// A test stage for the sculpted bodies and their motions (for development; not part of the game)
import * as THREE from 'three';
import { makeStage } from '../characters/stage.js';
import { makeBody } from '../characters/body/build.js';
import { poseOf, applyPose } from '../characters/body/motion.js';
import { MOTIONS } from './motions-demo.js';
import { RACES, GOBLIN_STAGES } from '../characters/body/races.js';
import { APPEARANCE } from '../data/game-data.mjs';

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
  // a playable race, in its palette's colours (i: which of the palette's choices)
  race(name, i = 0, extra = {}) {
    const R = RACES[name], pal = APPEARANCE[name];
    // the race's usual colouring first, then the palette's other choices
    const L = i === 0 && R.look ? R.look : { skin: pal.skin[i], hair: pal.accent[i], eyes: pal.eyes[i] };
    return this.build(R.body, { hair: R.hair, face: { eyes: L.eyes, ...R.eyes }, outfit: R.outfit, skin: L.skin, hairColor: L.hair, horn: L.horn, ...extra });
  },
  // a goblin at one of its six stages (0 just born .. 5 the last), bent over as the young ones stand
  goblin(stage, i = 0, extra = {}) {
    const G = GOBLIN_STAGES[stage], pal = APPEARANCE.goblin;
    const res = this.build(G.body, { hair: G.hair, face: { eyes: pal.eyes[i], ...G.eyes }, outfit: G.outfit, skin: pal.skin[i], hairColor: pal.accent[i], horn: G.horn, ...extra });
    const k = G.stoop || 0;
    if (k) this.pose({ spine: [0.22 * k, 0, 0], chest: [0.16 * k, 0, 0], neck: [-0.18 * k, 0, 0], head: [-0.12 * k, 0, 0],
      leftUpperLeg: [-0.3 * k, 0, 0.03], rightUpperLeg: [-0.3 * k, 0, -0.03], leftLowerLeg: [0.5 * k, 0, 0], rightLowerLeg: [0.5 * k, 0, 0], leftFoot: [-0.2 * k, 0, 0], rightFoot: [-0.2 * k, 0, 0],
      leftUpperArm: [-0.15 * k, 0, 0], rightUpperArm: [-0.15 * k, 0, 0], leftLowerArm: [-0.35 * k, 0, 0], rightLowerArm: [-0.35 * k, 0, 0] });
    return res;
  },
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

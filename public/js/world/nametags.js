import * as THREE from 'three';

// Monster name tags (name, level and health bar) are laid out on the screen each frame, so they
// stay readable however big the monster is or however close the camera comes:
//  - each tag is drawn at a fixed size on screen (a little smaller far away), not as a board in
//    the world that grows huge up close and gets cut off,
//  - it sits just above the top of its own monster's head, whatever its height,
//  - tags never overlap: a farther one moves up above a nearer one,
//  - a tag never leaves the screen: it slides back inside the edges (a huge King whose head is
//    above the top of the screen still shows his tag along the top),
//  - a tag is drawn over everything (another monster's body never hides it), and only for
//    monsters near enough (great beasts and bosses from further off).
// The game sets each tag's position to the top of its monster's head as before; `place` moves
// the tags just for drawing, and `restore` puts them back after the frame is drawn.

const GAP = 4;       // pixels between stacked tags, and above the head
const EDGE = 6;      // pixels kept clear at the edges of the screen
const v = new THREE.Vector3();
const placed = [];   // tags moved this frame: [sprite, x, y, z] (where the game had put it)
const boxes = [];

// how big a tag is drawn (in screen pixels) for a canvas of cw x ch, d metres away, on a screen h high
function sizeFor(cw, ch, d, h) {
  const fit = Math.min(1, Math.max(0.62, h / 820));        // (smaller on small screens)
  const far = Math.min(1, Math.max(0.55, 14 / Math.max(1, d))); // (smaller far away)
  const k = 0.72 * fit * far;
  return [cw * k, ch * k];
}

const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// `tags`: [{ sprite, foot: y of the monster's feet, far: metres it can be seen from }]; `w`, `h`: the canvas size in CSS pixels
export function place(camera, w, h, tags) {
  restore();
  if (!w || !h) return;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const list = [];
  for (const t of tags) {
    const s = t.sprite;
    if (!s.visible || !s.parent) continue;
    const p = s.position;
    // where the head is on screen (tags behind the camera, too far off or off the screen are hidden)
    v.copy(p).applyMatrix4(camera.matrixWorldInverse);
    const d = -v.z;
    if (d < 0.3 || d > (t.far || 90)) { hide(s); continue; }
    v.copy(p).project(camera);
    const hx = v.x, hy = v.y, hz = v.z;
    // and the feet: a monster wholly off the screen keeps its tag off too
    v.set(p.x, t.foot ?? p.y, p.z).project(camera);
    const fy = v.y;
    if (hx < -1.15 || hx > 1.15 || Math.max(hy, fy) < -1 || Math.min(hy, fy) > 1.05) { hide(s); continue; }
    const img = s.material.map?.image;
    const [pw, ph] = sizeFor(img?.width || 256, img?.height || 64, d, h);
    const cx = (hx + 1) / 2 * w, headY = (1 - hy) / 2 * h;
    list.push({ s, d, hz, pw, ph, cx, y1: headY - GAP });
  }
  // the nearest first: it keeps its place, farther tags move up out of its way
  list.sort((a, b) => a.d - b.d);
  boxes.length = 0;
  for (const it of list) {
    let x0 = Math.min(Math.max(it.cx - it.pw / 2, EDGE), w - EDGE - it.pw);
    let y1 = Math.min(it.y1, h - EDGE);
    let box = { x0, x1: x0 + it.pw, y0: y1 - it.ph, y1 };
    // up past every tag in the way (a few rounds: moving up can run into another one)
    for (let round = 0; round < 12; round++) {
      const hit = boxes.find((b) => overlaps(box, b));
      if (!hit) break;
      y1 = hit.y0 - GAP;
      box = { x0, x1: x0 + it.pw, y0: y1 - it.ph, y1 };
    }
    // off the top: bring it down inside the screen, then below whatever is already there
    if (box.y0 < EDGE) {
      y1 = EDGE + it.ph;
      box = { x0, x1: x0 + it.pw, y0: EDGE, y1 };
      for (let round = 0; round < 12; round++) {
        const hit = boxes.find((b) => overlaps(box, b));
        if (!hit) break;
        y1 = hit.y1 + GAP + it.ph;
        box = { x0, x1: x0 + it.pw, y0: y1 - it.ph, y1 };
      }
    }
    boxes.push(box);
    // back into the world, at the head's depth (drawn over everything, so another monster's
    // body never covers it; tags farther than `far` are hidden instead)
    const nx = ((box.x0 + box.x1) / 2) / w * 2 - 1;
    const ny = 1 - ((box.y0 + box.y1) / 2) / h * 2;
    const s = it.s;
    placed.push([s, s.position.x, s.position.y, s.position.z, true]);
    v.set(nx, ny, it.hz).unproject(camera);
    s.position.copy(v);
    if (s.material.sizeAttenuation) { s.material.sizeAttenuation = false; s.material.needsUpdate = true; }
    // (a sprite that ignores distance: scale 1 is the full height of the view at this field of view)
    s.scale.set(2 * it.pw * tanHalf / h, 2 * it.ph * tanHalf / h, 1);
  }
}

function hide(s) { placed.push([s, s.position.x, s.position.y, s.position.z, true]); s.visible = false; }

// put the tags back where the game had them (after drawing)
export function restore() {
  for (const [s, x, y, z, shown] of placed) { s.position.set(x, y, z); s.visible = shown; }
  placed.length = 0;
}

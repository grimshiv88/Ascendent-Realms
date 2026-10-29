// The painted face, anime style: almond eyes with a big glossy iris, a dark upper lash line with a
// flick at the outer corner, a soft crease above, fine brows and a small mouth. Painted onto a
// canvas that is laid on the face sheet (see sculptor.js faceSheet). A second painting has the eyes
// shut, for blinking.
import * as THREE from 'three';

const cache = new Map();

// look: { eyes: iris colour, brows: brow colour, lashes, lips, eyeShape: 1 (taller) .. , slit: true for a cat's pupil }
export function faceTextures(area, look = {}) {
  const key = JSON.stringify([area, look]);
  if (!cache.has(key)) cache.set(key, { open: paint(area, look, false), shut: paint(area, look, true) });
  return cache.get(key);
}

function paint(A, look, shut) {
  const W = 1024;
  const Hpx = Math.round(W * (A.y1 - A.y0) / (A.x1 - A.x0));
  const c = document.createElement('canvas');
  c.width = W; c.height = Hpx;
  const g = c.getContext('2d');
  const px = (x) => ((x - A.x0) / (A.x1 - A.x0)) * W;
  const py = (y) => (1 - (y - A.y0) / (A.y1 - A.y0)) * Hpx;
  const k = W / (A.x1 - A.x0); // pixels per metre
  const hd = A.hd;
  const iris = new THREE.Color(look.eyes || '#5a7fb8');
  const lash = look.lashes || '#1c1310';
  const brow = look.brows || '#3a2a20';
  const tall = look.eyeShape || 1;
  // sharp: 0 round, wide-open eyes .. 1 narrow, keen eyes with the outer corner lifted, the lid
  // lying over the top of the iris (most faces are a little sharp)
  const sharp = look.sharp ?? 0.55;

  for (const s of [-1, 1]) {
    const cx = px(s * A.eyeX), cy = py(A.eyeY);
    const w = 0.029 * hd * k * (look.eyeSize || 1) * (1 + 0.06 * sharp), h0 = 0.0178 * hd * k * tall * (look.eyeSize || 1);
    const h = h0 * (1 - 0.38 * sharp);
    const inner = [cx - s * w * 0.5, cy + h * (0.1 + 0.25 * sharp)], outer = [cx + s * w * 0.53, cy - h * (0.06 + 0.42 * sharp)];
    const upper = (ctx) => {
      ctx.moveTo(...inner);
      ctx.bezierCurveTo(cx - s * w * 0.36, cy - h * (0.62 + 0.1 * sharp), cx + s * w * 0.2, cy - h * (0.78 + 0.12 * sharp), ...outer);
    };
    const lower = (ctx) => {
      ctx.bezierCurveTo(cx + s * w * 0.3, cy + h * (0.42 + 0.1 * sharp), cx - s * w * 0.25, cy + h * (0.5 + 0.12 * sharp), ...inner);
    };
    if (shut) {
      // closed: the lid's curve with its lashes, and the crease
      g.lineCap = 'round';
      g.strokeStyle = lash; g.lineWidth = h * 0.16;
      g.beginPath(); g.moveTo(...inner); g.bezierCurveTo(cx - s * w * 0.3, cy + h * 0.3, cx + s * w * 0.25, cy + h * 0.3, ...outer); g.stroke();
      g.lineWidth = h * 0.1;
      g.beginPath(); g.moveTo(...outer); g.quadraticCurveTo(outer[0] + s * w * 0.1, outer[1] + h * 0.05, outer[0] + s * w * 0.14, outer[1] + h * 0.22); g.stroke();
      continue;
    }
    // the white of the eye, shaded under the upper lid
    g.save();
    g.beginPath(); upper(g); lower(g); g.closePath();
    g.clip();
    const white = g.createLinearGradient(0, cy - h * 0.7, 0, cy + h * 0.5);
    white.addColorStop(0, '#b8aca8'); white.addColorStop(0.35, '#ece6e2'); white.addColorStop(1, '#faf7f4');
    g.fillStyle = white;
    g.fillRect(cx - w, cy - h, w * 2, h * 2);
    // the iris: tall, dark at the top, bright at the bottom, with a dark rim and fine streaks
    // (the iris keeps its size as the eye narrows: the lids cover its top and bottom)
    const ix = cx + s * w * 0.03, iy = cy + h * 0.02 + h0 * 0.08 * sharp, rx = w * 0.3 * (1 - 0.06 * sharp), ry = h0 * 0.6 * (1 - 0.12 * sharp);
    const grad = g.createLinearGradient(0, iy - ry, 0, iy + ry);
    grad.addColorStop(0, '#' + iris.clone().multiplyScalar(0.25).getHexString());
    grad.addColorStop(0.45, '#' + iris.clone().multiplyScalar(0.75).getHexString());
    grad.addColorStop(0.85, '#' + iris.clone().lerp(new THREE.Color('#ffffff'), 0.3).getHexString());
    grad.addColorStop(1, '#' + iris.clone().lerp(new THREE.Color('#ffffff'), 0.45).getHexString());
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(ix, iy, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.2;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      g.beginPath(); g.moveTo(ix + Math.cos(a) * rx * 0.45, iy + Math.sin(a) * ry * 0.45); g.lineTo(ix + Math.cos(a) * rx * 0.92, iy + Math.sin(a) * ry * 0.92); g.stroke();
    }
    g.strokeStyle = '#' + iris.clone().multiplyScalar(0.18).getHexString(); g.lineWidth = rx * 0.12;
    g.beginPath(); g.ellipse(ix, iy, rx * 0.95, ry * 0.97, 0, 0, Math.PI * 2); g.stroke();
    // the pupil
    g.fillStyle = '#0e0807';
    g.beginPath();
    if (look.slit) g.ellipse(ix, iy - ry * 0.05, rx * 0.14, ry * 0.62, 0, 0, Math.PI * 2);
    else g.ellipse(ix, iy - ry * 0.06, rx * 0.4, ry * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    // the lid's shadow over the top of the eye
    const sh = g.createLinearGradient(0, cy - h * 0.7, 0, cy - h * 0.1);
    sh.addColorStop(0, 'rgba(40,20,20,0.55)'); sh.addColorStop(1, 'rgba(40,20,20,0)');
    g.fillStyle = sh; g.fillRect(cx - w, cy - h, w * 2, h * 0.9);
    // highlights: a big one up by the outer side, a small one low on the inner side
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.ellipse(ix + s * rx * 0.35, iy - ry * 0.35, rx * 0.26, ry * 0.2, s * -0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.ellipse(ix - s * rx * 0.32, iy + ry * 0.38, rx * 0.12, ry * 0.09, 0, 0, Math.PI * 2); g.fill();
    g.restore();

    // the upper lash line: thick, heaviest at the outer corner, with a little flick
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.fillStyle = lash;
    g.beginPath();
    g.moveTo(...inner);
    g.bezierCurveTo(cx - s * w * 0.36, cy - h * (0.62 + 0.1 * sharp), cx + s * w * 0.2, cy - h * (0.78 + 0.12 * sharp), ...outer);
    g.quadraticCurveTo(outer[0] + s * w * 0.12, outer[1] - h * 0.06, outer[0] + s * w * 0.2, outer[1] - h * 0.3); // the flick
    g.quadraticCurveTo(outer[0] + s * w * 0.04, outer[1] - h * 0.22, outer[0] - s * w * 0.06, outer[1] - h * 0.26);
    g.bezierCurveTo(cx + s * w * 0.18, cy - h * (1.0 + 0.3 * sharp), cx - s * w * 0.36, cy - h * (0.86 + 0.25 * sharp), inner[0] + s * w * 0.03, inner[1] - h * 0.16);
    g.closePath();
    g.fill();
    // the lower lashes: a fine line on the outer third
    g.strokeStyle = lash; g.globalAlpha = 0.5; g.lineWidth = h * 0.05;
    g.beginPath(); g.moveTo(outer[0] - s * w * 0.03, outer[1] + h * 0.08); g.bezierCurveTo(cx + s * w * 0.36, cy + h * 0.4, cx + s * w * 0.22, cy + h * 0.46, cx + s * w * 0.08, cy + h * 0.47); g.stroke();
    // the crease of the eyelid, just above the lashes
    g.globalAlpha = 0.28; g.lineWidth = h * 0.045;
    g.beginPath(); g.moveTo(cx - s * w * 0.22, cy - h * 0.86); g.bezierCurveTo(cx - s * w * 0.05, cy - h * 1.02, cx + s * w * 0.24, cy - h * 0.98, cx + s * w * 0.4, cy - h * 0.66); g.stroke();
    g.globalAlpha = 1;
  }
  // brows: thicker at the inner end; on a sharp face straighter and lower at the inner end (a keen,
  // level look); thick: heavier brows (dwarves)
  const thick = look.browThick || 1;
  for (const s of [-1, 1]) {
    const bx = px(s * A.eyeX * 1.06), by = py(A.eyeY + 0.03 * hd * (look.browLift || 1) - 0.004 * hd * sharp);
    const w = 0.031 * hd * k * (1 + 0.1 * (thick - 1)), t = 0.0024 * hd * k * thick;
    const tilt = 0.006 * hd * k * sharp; // the inner end down, the outer end up
    g.fillStyle = brow;
    g.beginPath();
    g.moveTo(bx - s * w * 0.5, by + t * 0.6 + tilt);
    g.quadraticCurveTo(bx, by - t * (1.6 - 0.8 * sharp) - tilt * 0.2, bx + s * w * 0.55, by + t * 0.9 - tilt * 0.5);
    g.quadraticCurveTo(bx, by - t * 0.4 + tilt * 0.2, bx - s * w * 0.48, by + t * 1.9 + tilt);
    g.closePath();
    g.fill();
    if (thick > 1.3) {
      // bushy: short hairs along the brow
      g.strokeStyle = brow; g.lineWidth = Math.max(1, t * 0.18); g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const f = i / 25, x = bx - s * w * 0.5 + s * w * 1.05 * f, y = by + t * 0.9 + tilt * (1 - f * 1.5) - Math.sin(f * Math.PI) * t * 0.8;
        g.beginPath(); g.moveTo(x, y + t * 0.6); g.lineTo(x + s * t * (0.6 + 0.6 * f), y - t * (0.8 + 0.4 * Math.sin(i * 2.3))); g.stroke();
      }
    }
  }
  // tired, shadowed eyes: a soft dark crescent under each (beastkin)
  if (look.darkCircles) {
    for (const s of [-1, 1]) {
      const cx = px(s * A.eyeX), cy = py(A.eyeY - 0.012 * hd);
      const w = 0.03 * hd * k, h = 0.009 * hd * k;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
      grad.addColorStop(0, `rgba(70,30,40,${0.35 * look.darkCircles})`); grad.addColorStop(1, 'rgba(70,30,40,0)');
      g.fillStyle = grad;
      g.beginPath(); g.ellipse(cx, cy, w * 0.6, h, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(60,25,30,${0.4 * look.darkCircles})`; g.lineWidth = h * 0.12;
      g.beginPath(); g.moveTo(cx - s * w * 0.42, cy - h * 0.3); g.quadraticCurveTo(cx, cy + h * 0.55, cx + s * w * 0.4, cy - h * 0.55); g.stroke();
    }
  }
  // the lines of an older, hard-worked face (dwarves): across the forehead, a frown between the
  // brows, crow's feet at the corners of the eyes, and the folds from the nose to the mouth
  if (look.wrinkles) {
    const a = look.wrinkles;
    g.strokeStyle = `rgba(90,45,30,${0.45 * a})`; g.lineCap = 'round';
    const line = (pts, wd) => { g.lineWidth = wd; g.beginPath(); g.moveTo(px(pts[0][0]), py(pts[0][1])); for (let i = 1; i < pts.length - 1; i += 2) g.quadraticCurveTo(px(pts[i][0]), py(pts[i][1]), px(pts[i + 1][0]), py(pts[i + 1][1])); g.stroke(); };
    const ey = A.eyeY, ex = A.eyeX, lw = 0.0011 * hd * k;
    for (let i = 0; i < 3; i++) { const y = ey + (0.05 + 0.012 * i) * hd; line([[-0.04 * hd, y - 0.002 * hd], [0, y + 0.003 * hd], [0.04 * hd, y - 0.002 * hd]], lw * (1 - i * 0.2)); }
    for (const s of [-1, 1]) {
      line([[s * 0.008 * hd, ey + 0.022 * hd], [s * 0.01 * hd, ey + 0.032 * hd], [s * 0.007 * hd, ey + 0.042 * hd]], lw * 0.9);
      for (let i = 0; i < 3; i++) line([[s * (ex + 0.018 * hd), ey + (0.004 - 0.006 * i) * hd], [s * (ex + 0.026 * hd), ey + (0.006 - 0.009 * i) * hd], [s * (ex + 0.032 * hd), ey + (0.009 - 0.013 * i) * hd]], lw * 0.7);
      line([[s * 0.017 * hd, A.mouthY + 0.03 * hd], [s * 0.027 * hd, A.mouthY + 0.012 * hd], [s * 0.025 * hd, A.mouthY - 0.008 * hd]], lw * 1.3);
      line([[s * (ex - 0.012 * hd), ey - 0.012 * hd], [s * ex, ey - 0.018 * hd], [s * (ex + 0.014 * hd), ey - 0.013 * hd]], lw * 0.7);
    }
  }
  // the mouth: a short soft line, a touch of shadow under the lower lip
  const mx = px(0), my = py(A.mouthY);
  const mw = 0.0155 * hd * k;
  const lipLine = look.lips || '#7a3a34';
  g.strokeStyle = lipLine; g.globalAlpha = 0.8; g.lineCap = 'round'; g.lineWidth = Math.max(2, mw * 0.07);
  g.beginPath(); g.moveTo(mx - mw / 2, my - mw * 0.02); g.quadraticCurveTo(mx, my + mw * 0.08, mx + mw / 2, my - mw * 0.02); g.stroke();
  g.globalAlpha = 0.18; g.fillStyle = '#5a2a20';
  g.beginPath(); g.ellipse(mx, my + mw * 0.42, mw * 0.28, mw * 0.08, 0, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

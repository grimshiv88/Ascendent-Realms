// Paints a bank of puffy clouds: solid on its outer side, billowing at its leading edge.
// The right bank reuses the same picture, mirrored in CSS.
export function paintCloudBanks() {
  const w = 900, h = 900;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Seeded random so the clouds look the same every time
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  ctx.fillStyle = '#e9e7ee';
  ctx.fillRect(0, 0, w * 0.55, h);

  const puff = (x, y, r) => {
    // Shadowed underside first, then a brighter top, for a bit of volume
    const shade = ctx.createRadialGradient(x, y + r * 0.25, 0, x, y + r * 0.25, r);
    shade.addColorStop(0, 'rgba(222,220,230,1)');
    shade.addColorStop(0.7, 'rgba(226,224,234,0.9)');
    shade.addColorStop(1, 'rgba(226,224,234,0)');
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.arc(x, y + r * 0.25, r, 0, Math.PI * 2); ctx.fill();

    const light = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, 0, x, y, r * 0.95);
    light.addColorStop(0, 'rgba(255,255,255,1)');
    light.addColorStop(0.6, 'rgba(246,245,250,0.95)');
    light.addColorStop(1, 'rgba(236,234,242,0)');
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, Math.PI * 2); ctx.fill();
  };

  for (let i = 0; i < 260; i++) {
    const across = Math.pow(rand(), 0.7);          // more puffs toward the outer side
    const x = across * w * 0.62;
    const y = rand() * (h + 160) - 80;
    const r = 70 + rand() * 100 * (1 - across * 0.4);
    puff(x, y, r);
  }
  // A row of big billows along the leading edge
  for (let y = -60; y < h + 80; y += 95 + rand() * 40) {
    puff(w * (0.66 + rand() * 0.08), y, 80 + rand() * 40);
  }

  const url = canvas.toDataURL('image/png');
  document.querySelectorAll('.cloud-bank').forEach((el) => {
    el.style.backgroundImage = `url(${url})`;
  });
}

// Graphics quality: how much of the world is drawn, and how sharply. Phones and tablets get a
// lighter setting so they stay cool and save battery; computers can see much further.
// 'auto' picks for the device; the player can choose another in Settings.

// a phone or tablet: a touch screen with no fine pointer (mouse), or a mobile browser
export function isMobile() {
  try {
    const coarse = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
    return coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  } catch { return false; }
}

// land: [tile distance, grid detail] rings. The nearest two must stay 64: the land you walk on,
// and the land around it where villages, huts and monsters stand, which would float over (or sink
// into) a coarser grid
export const QUALITY = {
  low: {
    name: 'Battery saver', pixelRatio: 1, shadows: false, shadowSize: 1024, fps: 30,
    lods: [[2, 64], [3, 16], [5, 8], [6, 8]], veg: 2, grass: 1, grassDensity: 0.4, nearTrees: 60, fog: 0.00042,
  },
  medium: {
    name: 'Balanced', pixelRatio: 1.25, shadows: true, shadowSize: 1024, fps: 60,
    lods: [[2, 64], [4, 32], [7, 16], [11, 8]], veg: 3, grass: 1, grassDensity: 0.75, nearTrees: 110, fog: 0.00024,
  },
  high: {
    name: 'Far view', pixelRatio: 1.5, shadows: true, shadowSize: 2048, fps: 0,
    lods: [[2, 64], [5, 32], [9, 16], [15, 8]], veg: 5, grass: 2, grassDensity: 1, nearTrees: 170, fog: 0.00015,
  },
};

export function pickQuality(choice) {
  // 'auto': phones save battery; computers get the balanced setting (Far view is a choice in Settings)
  const key = QUALITY[choice] ? choice : isMobile() ? 'low' : 'medium';
  return { key, ...QUALITY[key] };
}

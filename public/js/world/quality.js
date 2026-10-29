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

// land: [tile distance, grid detail] rings (the nearest must stay 64, the land you walk on)
export const QUALITY = {
  low: {
    name: 'Battery saver', pixelRatio: 1, shadows: false, shadowSize: 1024, fps: 30,
    lods: [[1, 64], [2, 16], [4, 8], [6, 8]], veg: 2, grass: 1, grassDensity: 0.4, nearTrees: 60, fog: 0.00042,
  },
  medium: {
    name: 'Balanced', pixelRatio: 1.25, shadows: true, shadowSize: 1024, fps: 60,
    lods: [[1, 64], [3, 32], [6, 16], [11, 8]], veg: 3, grass: 1, grassDensity: 0.75, nearTrees: 110, fog: 0.00024,
  },
  high: {
    name: 'Far view', pixelRatio: 2, shadows: true, shadowSize: 2048, fps: 0,
    lods: [[1, 64], [4, 32], [9, 16], [15, 8]], veg: 5, grass: 2, grassDensity: 1, nearTrees: 170, fog: 0.00015,
  },
};

export function pickQuality(choice) {
  const key = QUALITY[choice] ? choice : isMobile() ? 'low' : 'high';
  return { key, ...QUALITY[key] };
}

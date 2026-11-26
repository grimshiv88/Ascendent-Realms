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

// crowdFar: townsfolk, guards and monsters further than this (metres) aren't drawn or animated;
// detailFar: a city's small details (window frames, rails) further than this aren't drawn.
// lights: how many lamps, fires and glows near you shine at once (see lightpool.js).
// land: [tile distance, grid detail] rings. The nearest two must stay 64: the land you walk on,
// and the land around it where villages, huts and monsters stand, which would float over (or sink
// into) a coarser grid
export const QUALITY = {
  low: {
    name: 'Battery saver', pixelRatio: 1, shadows: false, shadowSize: 1024, fps: 30,
    lods: [[2, 64], [3, 16], [5, 8], [6, 8]], veg: 2, grass: 1, grassDensity: 0.4, nearTrees: 60, fog: 0.00042, crowdFar: 45, detailFar: 50, lights: 4,
  },
  medium: {
    name: 'Balanced', pixelRatio: 1.25, shadows: true, shadowSize: 1024, fps: 60,
    lods: [[2, 64], [4, 32], [7, 16], [11, 8]], veg: 3, grass: 1, grassDensity: 0.75, nearTrees: 110, fog: 0.00024, crowdFar: 75, detailFar: 90, lights: 6,
  },
  high: {
    name: 'Far view', pixelRatio: 1.5, shadows: true, shadowSize: 2048, fps: 0,
    lods: [[2, 64], [5, 32], [9, 16], [15, 8]], veg: 5, grass: 2, grassDensity: 1, nearTrees: 170, fog: 0.00015, crowdFar: 100, detailFar: 120, lights: 8,
  },
};

export function pickQuality(choice) {
  // 'auto': phones save battery; computers get the balanced setting (Far view is a choice in Settings)
  const key = QUALITY[choice] ? choice : isMobile() ? 'low' : 'medium';
  return { key, auto: !QUALITY[choice], ...QUALITY[key] };
}

// On Automatic, the game watches how smoothly it runs and lowers the sharpness (fewer pixels to
// draw) when frames come too slowly, then raises it again once there is room. It never goes
// below 60% of the setting's sharpness, and it waits a few seconds between changes so the picture
// doesn't flicker. Returns the new scale (1 = the setting's own sharpness).
export function createSmoothness() {
  let scale = 1, frames = 0, since = 0, goodFor = 0;
  return {
    get scale() { return scale; },
    reset() { frames = 0; since = 0; goodFor = 0; },
    // call once per drawn frame; `want` is the frames per second aimed for
    frame(now, want) {
      if (!since) { since = now; frames = 0; return null; }
      frames++;
      const span = now - since;
      if (span < 3000) return null;
      const fps = (frames * 1000) / span;
      since = now; frames = 0;
      if (span > 6000) return null; // the tab was hidden or the game paused: not a fair count
      if (fps < want * 0.75 && scale > 0.6) { scale = Math.max(0.6, +(scale - 0.15).toFixed(2)); goodFor = 0; return scale; }
      if (fps > want * 0.95 && scale < 1) {
        goodFor += span;
        if (goodFor >= 12000) { scale = Math.min(1, +(scale + 0.1).toFixed(2)); goodFor = 0; return scale; }
      } else goodFor = 0;
      return null;
    },
  };
}

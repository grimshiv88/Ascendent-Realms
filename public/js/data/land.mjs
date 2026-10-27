// Land you can buy: square plots of the Heartland (the central forest continent).
// Shared by the game and the server, so both agree on what can be bought and what it costs.
import { PLOT, sample, placesWithPositions } from './world-layout.mjs';

export { PLOT };
export const MAX_PLOTS = 10;
export const PURPOSE_FEE = 50; // to change what a plot is for

export const PURPOSES = {
  house: { name: 'House', color: '#d9a441', text: 'A home of your own. Build rooms, store your things and rest to heal faster.' },
  shop: { name: 'Shop', color: '#3d9bff', text: 'Sell your goods to other players, even while you are away.' },
  guild: { name: 'Guild Hall', color: '#b04ad9', text: 'Found a guild. Members can meet here and share storage.' },
  farm: { name: 'Farm', color: '#5fbf3a', text: 'Grow crops and food. Farmers harvest more.' },
  workshop: { name: 'Workshop', color: '#e0662a', text: 'A forge and workbench for crafting and upgrading. Blacksmiths work faster here.' },
  property: { name: 'Property', color: '#9aa4b0', text: 'Keep the land as an investment, or decide what to build later.' },
};

const tmp = {};
// Heights at the corners and middle of a plot (ignoring any levelling already done)
function plotHeights(ix, iz) {
  const out = [];
  for (const [fx, fz] of [[0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95], [0.5, 0.5]]) {
    sample((ix + fx) * PLOT, (iz + fz) * PLOT, tmp);
    out.push({ h: tmp.h, water: tmp.water, region: tmp.region });
  }
  return out;
}

// Why a plot can't be bought, or null if it can
export function whyNot(ix, iz) {
  const hs = plotHeights(ix, iz);
  if (hs.some((p) => p.region !== 'heart')) return 'Only land in the Heartland can be bought for now.';
  if (hs.some((p) => p.h < p.water + 0.5)) return 'This plot is under water.';
  const cx = (ix + 0.5) * PLOT, cz = (iz + 0.5) * PLOT;
  if (placesWithPositions().some((p) => Math.hypot(p.x - cx, p.z - cz) < (p.cave ? 40 : 90))) return 'This land belongs to everyone: it is too close to a landmark.';
  const spread = Math.max(...hs.map((p) => p.h)) - Math.min(...hs.map((p) => p.h));
  if (spread > 12) return 'Too steep to build on.';
  return null;
}

// Land near the towns of the Heartland costs more
export function plotPrice(ix, iz) {
  const cx = (ix + 0.5) * PLOT, cz = (iz + 0.5) * PLOT;
  let d = Infinity;
  for (const p of placesWithPositions()) if (!p.cave && p.region === 'heart') d = Math.min(d, Math.hypot(p.x - cx, p.z - cz));
  return Math.round((60 + 440 * Math.exp(-d / 2500)) / 10) * 10;
}

// Clearing and levelling costs more on steep ground; Builders pay half
export function prepareCost(ix, iz, cls) {
  const hs = plotHeights(ix, iz);
  const spread = Math.max(...hs.map((p) => p.h)) - Math.min(...hs.map((p) => p.h));
  const cost = Math.round((40 + spread * 12) / 5) * 5;
  return cls === 'builder' ? Math.round(cost / 2) : cost;
}

// The level a prepared plot is set to: the average of its ground
export function levelHeight(ix, iz) {
  const hs = plotHeights(ix, iz);
  return Math.round((hs.reduce((a, p) => a + p.h, 0) / hs.length) * 100) / 100;
}

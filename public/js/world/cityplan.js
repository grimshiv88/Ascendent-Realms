// A plan of a walled city, drawn on the world map (and the minimap) once you are close enough to
// read it: the walls and moat, the plaza and streets, every building in its roof's colour, the
// shop lots, the training grounds and the playground, with the names of the city's own buildings
// and quarters. North is at the top, as on the rest of the map.
import { CITY_R } from '../data/world-layout.mjs';
import { MARKETS } from '../data/items.mjs';
import { cityHouses, CASTLE_SPOT, LANES, CROSS_STREETS, HOUSE_D, LANE_W, PLAYGROUND, TRAINING_GROUND, ACADEMY_NAME } from '../data/birth.mjs';
import { CITY_SHOPS, SHOP_LOTS, PLAZA_R, INNER_R, MOAT, GATE_ANGLES, GUILD_NAME, DARK_GUILD_NAME, academyRoof } from './city.js';
import { TOWN_TONES } from './houses.js';

const QUARTERS = [['Civic Quarter', 34, -58], ['Market Quarter', 40, 44], ['Royal Quarter', 104, -40], ['Neighbourhood', -72, -24]];

// place: the city (its x, z are the middle); at(x, z): world metres to canvas pixels; k: canvas
// pixels per metre; alpha: how strongly to draw it (it fades in as you zoom); labels: with names
export function drawCityPlan(ctx, place, at, k, alpha = 1, labels = true) {
  const cx = place.x, cz = place.z, monster = !!place.monster;
  const P = (x, z) => at(cx + x, cz + z);
  ctx.save();
  ctx.globalAlpha = alpha;
  const circle = (r, fill, stroke, lw) => {
    const [x, y] = P(0, 0);
    ctx.beginPath(); ctx.arc(x, y, r * k, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  // a rectangle w × d (along x, z before turning) with its middle at (x, z), turned by rot
  const rect = (x, z, w, d, rot, fill, stroke = null, lw = 1) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    ctx.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], i) => {
      const lx = (a * w) / 2, lz = (b * d) / 2;
      const [px, py] = P(x + lx * c + lz * s, z - lx * s + lz * c);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  const label = (text, x, z, size, colour = '#fff4d8') => {
    const [px, py] = P(x, z);
    ctx.font = `700 ${size}px Cinzel, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, size * 0.28); ctx.strokeStyle = 'rgba(20, 14, 8, 0.85)'; ctx.strokeText(text, px, py);
    ctx.fillStyle = colour; ctx.fillText(text, px, py);
  };

  // the walls, the moat between them, and the ground inside
  circle(CITY_R, '#8f8676');
  circle(MOAT[1], '#3a6a9a');
  circle(MOAT[0], '#8f8676');
  circle(INNER_R, '#6f8f4a');
  // the bridges over the moat at the two gates
  for (const a of GATE_ANGLES) rect(Math.sin(a) * (INNER_R + CITY_R) / 2, Math.cos(a) * (INNER_R + CITY_R) / 2, 8, CITY_R - INNER_R + 2, a, '#a39a88');
  // the plaza and the streets
  const street = '#b8b0a0';
  circle(PLAZA_R + 10, '#c8c0ae');
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, mid = (CITY_R + PLAZA_R) / 2, along = i % 2 === 0;
    rect(Math.sin(a) * mid, Math.cos(a) * mid, along ? 7 : CITY_R - PLAZA_R, along ? CITY_R - PLAZA_R : 7, 0, street);
  }
  const zOf = (x) => Math.sqrt(Math.max(0, (INNER_R - 6) ** 2 - x * x));
  for (const lx of LANES) {
    rect(lx, 0, LANE_W + 2.6, zOf(lx) * 2, 0, street);
    const ax = lx + LANE_W / 2 + 1.2 + HOUSE_D + 1;
    rect(ax, 0, 2, zOf(ax) * 2, 0, street);
  }
  for (const z of CROSS_STREETS) { const x0 = -Math.sqrt(Math.max(0, (INNER_R - 6) ** 2 - z * z)); rect((x0 - 3.5) / 2, z, -3.5 - x0, 5, 0, street); }
  // open ground: shop lots, the training grounds, the playground
  for (const [x, z] of SHOP_LOTS) rect(x, z, 13, 13, 0, '#cfc6b2', '#7a6a4a', 1);
  const T = TRAINING_GROUND, PG = PLAYGROUND;
  rect((T.x0 + T.x1) / 2, (T.z0 + T.z1) / 2, T.x1 - T.x0, T.z1 - T.z0, 0, '#d8c48e', '#7a5a3a', 1);
  rect((PG.x0 + PG.x1) / 2, (PG.z0 + PG.z1) / 2, PG.x1 - PG.x0, PG.z1 - PG.z0, 0, '#8fb05a', '#5a7a3a', 1);
  // the homes, each in its roof's colour
  for (const h of cityHouses(place.id)) rect(h.x, h.z, h.w, h.d, h.rot, TOWN_TONES[(h.i * 7 + Math.floor(h.i / 3)) % TOWN_TONES.length][1], 'rgba(30, 20, 10, 0.6)', 0.6);
  // the castle and the city's own buildings, outlined in gold
  if (!monster) {
    const rot = Math.atan2(-CASTLE_SPOT.x, -CASTLE_SPOT.z);
    rect(CASTLE_SPOT.x, CASTLE_SPOT.z, 30, 24, rot, '#3a3e5a', '#ffd76a', 2);
  }
  const named = [];
  for (const [id, x, z, [fx, fz], w, d, , , roof] of CITY_SHOPS) {
    rect(x, z, w, d, Math.atan2(fx, fz), id === 'academy' ? academyRoof(place) : roof, '#ffd76a', 1.6);
    named.push([id === 'guild' ? (monster ? DARK_GUILD_NAME : GUILD_NAME) : id === 'academy' ? ACADEMY_NAME : MARKETS[id]?.name || id, x, z]);
  }
  // names: the quarters first; the buildings once they are big enough to read
  if (!labels) { ctx.restore(); return; }
  if (!monster) for (const [name, x, z] of QUARTERS) label(name, x, z, Math.min(22, Math.max(11, k * 9)), '#ffe9a8');
  if (k >= 2.5) {
    const size = Math.min(16, Math.max(10, k * 4));
    for (const [name, x, z] of named) label(name, x, z, size);
    if (!monster) label("The Emperors' Castle", CASTLE_SPOT.x, CASTLE_SPOT.z, size);
    label('Training Grounds', (T.x0 + T.x1) / 2, (T.z0 + T.z1) / 2, size * 0.85);
    label('Playground', (PG.x0 + PG.x1) / 2, (PG.z0 + PG.z1) / 2, size * 0.85);
    label('Plaza', 0, 0, size);
    if (k >= 3.5) for (const [x, z] of SHOP_LOTS) label('Shop lot', x, z, size * 0.7, '#e8dcc0');
  }
  ctx.restore();
}

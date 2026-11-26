// A plan of a walled city, drawn on the world map (and the minimap) once you are close enough to
// read it: the walls and moat, the plaza and streets, every building in its roof's colour, the
// shop lots, the training grounds and the playground, with the names of the city's own buildings
// and quarters. North is at the top, as on the rest of the map.
import { CITY_R } from '../data/world-layout.mjs';
import { MARKETS } from '../data/items.mjs';
import { cityHouses, CASTLE_SPOT, ACADEMIES, ACADEMY_W, ACADEMY_D, SCHOOLS } from '../data/birth.mjs';
import { TIERS, TERRACE, ROAD_ANGLES, ROAD_HALF } from '../data/citylevels.mjs';
import { cityPlan, PLAZA_R, GUILD_SPOT, RING_ROADS, ESTATE_ID, BANK_ID } from '../data/citylayout.mjs';
import { BANK_NAME } from '../data/economy.mjs';
import { INNER_R, MOAT, GATE_ANGLES, GUILD_NAME, DARK_GUILD_NAME, ESTATE_NAME } from './city.js';
import { TOWN_TONES } from './houses.js';

// the rings' names, drawn on the ring (at an angle clear of the roads)
const RING_LABEL_A = Math.PI * 0.75;
const RING_GROUND = { castle: '#7f9a56', noble: '#7a9450', common: '#6f8f4a', dump: '#7a7458' };

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
  // the rings, from the Dump up to Castle Hill, each ringed by its terrace wall
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const T = TIERS[i];
    circle(i === TIERS.length - 1 ? INNER_R : T.r1 + TERRACE, '#9a9282');
    circle(i === TIERS.length - 1 ? INNER_R : T.r1, RING_GROUND[T.id]);
  }
  // the bridges over the moat at the two gates
  for (const a of GATE_ANGLES) rect(Math.sin(a) * (INNER_R + CITY_R) / 2, Math.cos(a) * (INNER_R + CITY_R) / 2, 8, CITY_R - INNER_R + 2, a, '#a39a88');
  // the plaza, the ring roads and the four main roads
  const street = '#b8b0a0';
  const ringRoad = (r, w, colour) => { const [x, y] = P(0, 0); ctx.beginPath(); ctx.arc(x, y, r * k, 0, Math.PI * 2); ctx.strokeStyle = colour; ctx.lineWidth = Math.max(1, w * k); ctx.stroke(); };
  for (const R of RING_ROADS) ringRoad(R.r, R.w, R.dirt ? '#9a8a6a' : street);
  circle(PLAZA_R + 6, '#c8c0ae');
  for (const [name, a] of Object.entries(ROAD_ANGLES)) {
    const from = name === 'north' ? TIERS[0].r1 : PLAZA_R, mid = (from + INNER_R) / 2;
    rect(Math.sin(a) * mid, Math.cos(a) * mid, ROAD_HALF * 2, INNER_R - from, a, street);
  }
  const plan = cityPlan();
  // open ground: shop lots and the playground
  for (const L of plan.lots) rect(L.x, L.z, L.size, L.size, L.a, '#cfc6b2', '#7a6a4a', 1);
  const PG = plan.playground;
  rect(PG.x, PG.z, PG.w, PG.d, PG.a, '#8fb05a', '#5a7a3a', 1);
  // the homes, each in its roof's colour; houses for sale outlined in green
  for (const h of cityHouses(place.id)) if (!h.gone) rect(h.x, h.z, h.w, h.d, h.rot, h.style === 'shack' ? '#6a5a44' : TOWN_TONES[(h.i * 7 + Math.floor(h.i / 3)) % TOWN_TONES.length][1], 'rgba(30, 20, 10, 0.6)', 0.6);
  for (const h of plan.sale) rect(h.x, h.z, h.w, h.d, h.rot, h.style === 'shack' ? '#6a5a44' : '#8a7a5a', '#7aff8a', 1.2);
  // the castle and the city's own buildings, outlined in gold
  if (!monster) rect(CASTLE_SPOT.x, CASTLE_SPOT.z, 30, 24, 0, '#3a3e5a', '#ffd76a', 2);
  const named = [];
  const guildA = Math.atan2(-GUILD_SPOT.x, -GUILD_SPOT.z);
  rect(GUILD_SPOT.x, GUILD_SPOT.z, GUILD_SPOT.w, GUILD_SPOT.d, guildA, '#5a2a24', '#ffd76a', 1.6);
  named.push([monster ? DARK_GUILD_NAME : GUILD_NAME, GUILD_SPOT.x, GUILD_SPOT.z]);
  for (const p of plan.shops) {
    rect(p.x, p.z, p.w, p.d, p.rot, '#7a4a2a', '#ffd76a', 1.6);
    named.push([p.id === ESTATE_ID ? ESTATE_NAME : p.id === BANK_ID ? BANK_NAME : MARKETS[p.id]?.name || p.id, p.x, p.z]);
  }
  const academies = [];
  for (const { school, x, z, rot } of ACADEMIES) {
    rect(x, z, ACADEMY_W, ACADEMY_D, rot, SCHOOLS[school].roof, '#ffd76a', 1.6);
    academies.push([SCHOOLS[school].academy, x, z]);
  }
  // names: the rings first; the buildings once they are big enough to read
  if (!labels) { ctx.restore(); return; }
  for (const T of TIERS) {
    const r = T.id === 'castle' ? 62 : (T.r0 + T.r1) / 2 + TERRACE / 2;
    label(T.name, Math.sin(RING_LABEL_A) * r, Math.cos(RING_LABEL_A) * r, Math.min(20, Math.max(10, k * 8)), '#ffe9a8');
  }
  if (k >= 2.5) {
    const size = Math.min(16, Math.max(10, k * 4));
    for (const [name, x, z] of named) label(name, x, z, size);
    if (!monster) label("The Emperors' Castle", CASTLE_SPOT.x, CASTLE_SPOT.z, size);
    if (k >= 3.5) for (const [name, x, z] of academies) label(name, x, z, size * 0.7);
    label('Playground', PG.x, PG.z, size * 0.85);
    label('Plaza', 0, 0, size);
    if (k >= 3.5) for (const L of plan.lots) label('Shop lot', L.x, L.z, size * 0.7, '#e8dcc0');
    if (k >= 3.5) for (const h of plan.sale) label('For sale', h.x, h.z, size * 0.6, '#b8ffc0');
  }
  ctx.restore();
}

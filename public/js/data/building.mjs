// Building on your land: pieces placed on a grid of 4 m cells, storey by storey, and ready-made
// buildings that are just sets of those pieces. Shared by the game and the server, so both agree on
// what stands where, what holds it up and what it costs.
import { PLOT } from './world-layout.mjs';

export const CELL = 4;                 // metres a side
export const CELLS_PER_PLOT = PLOT / CELL;
export const STOREY = 3;               // metres from one floor to the next
export const SLAB = 0.3;               // how far a foundation stands above the ground
export const MAX_LEVEL = 7;            // the 8th storey is the highest
export const MAX_PIECES = 4000;        // per player
export const COUNTRY_PLOTS = 100;      // own this many plots, all joined up, and you rule a country (castles need one)
// The size of the biggest piece of joined-up land among these plots ({ ix, iz }): plots join when
// they share a side
export function largestTerritory(plots) {
  const left = new Set(plots.map((p) => `${p.ix},${p.iz}`));
  let best = 0;
  for (const start of [...left]) {
    if (!left.has(start)) continue;
    left.delete(start);
    let n = 0;
    const todo = [start];
    while (todo.length) {
      const k = todo.pop();
      n++;
      const [ix, iz] = k.split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = `${ix + dx},${iz + dz}`;
        if (left.has(nk)) { left.delete(nk); todo.push(nk); }
      }
    }
    best = Math.max(best, n);
  }
  return best;
}
export const isRuler = (plots) => plots.length >= COUNTRY_PLOTS && largestTerritory(plots) >= COUNTRY_PLOTS;

// Where a piece sits: on a cell, on a cell's north or west edge, or on a cell's north-west corner
export const PIECES = {
  foundation: { name: 'Foundation', on: 'cell', price: 40, text: 'Stone base on levelled ground. Everything starts here.' },
  floor: { name: 'Floor', on: 'cell', price: 40, text: 'An upper floor. Rest it on walls or pillars below.' },
  wall: { name: 'Wall', on: 'edge', price: 30, text: 'Stands on a floor or foundation, or on a wall below.' },
  door: { name: 'Doorway', on: 'edge', price: 40, text: 'A wall with a way through.' },
  window: { name: 'Window wall', on: 'edge', price: 35, text: 'A wall with a window.' },
  pillar: { name: 'Pillar', on: 'corner', price: 15, text: 'Holds up floors and roofs without a whole wall.' },
  stairs: { name: 'Stairs', on: 'cell', price: 60, text: 'Up to the next storey. Needs a floor under it.' },
  roof: { name: 'Roof', on: 'cell', price: 45, text: 'Sits on top of the walls of its storey. Add more storeys and roof them again.' },
  anvil: { name: 'Anvil and Forge', on: 'cell', price: 400, text: 'A Blacksmith\'s own anvil, forge and mould. A Blacksmith working here can forge more pieces than anywhere else. Stands on a foundation or floor.' },
  stand: { name: 'Display stand', on: 'cell', price: 50, text: 'A Blacksmith puts a weapon or piece of armour they made on it, so everyone who comes by can see their work and touch it to read about it. Stands on a foundation or floor.' },
  spawn: { name: 'Spawn Shrine', on: 'cell', price: 800, text: 'When you fall, you wake up here instead of back home. One per player. Stands on a foundation or floor.' },
  // fortress and castle walls: stone, thick, and they can stand straight on levelled ground
  stone_wall: { name: 'Fortress wall', on: 'edge', price: 55, wall: true, ground: true, text: 'Thick stone. Stands on levelled ground, a foundation, or another wall.' },
  slit_wall: { name: 'Arrow-slit wall', on: 'edge', price: 60, wall: true, ground: true, text: 'Fortress wall with a narrow slit to shoot through.' },
  battlement: { name: 'Battlements', on: 'edge', price: 35, wall: true, text: 'The notched top of a castle wall. Goes on top of a wall.' },
  gate: { name: 'Great gate', on: 'edge', price: 90, wall: true, ground: true, text: 'A wide stone gateway for a fortress or castle wall.' },
  wall_tower: { name: 'Wall turret', on: 'corner', price: 70, ground: true, text: 'A thick stone turret where walls meet. Stack them to build a tower.' },
  // fences: light walls round a garden, a field or a camp
  palisade: { name: 'Palisade', on: 'edge', price: 20, wall: true, ground: true, text: 'Sharpened wooden stakes. A cheap wall for a camp or a fort.' },
  fence: { name: 'Wooden fence', on: 'edge', price: 10, wall: true, ground: true, text: 'A low fence for a garden or a field.' },
  iron_fence: { name: 'Iron railings', on: 'edge', price: 30, wall: true, ground: true, text: 'Tall black railings.' },
};
// The pieces in sections, as the Builder shows them
export const PIECE_GROUPS = [
  ['Floors and roofs', ['foundation', 'floor', 'stairs', 'roof']],
  ['Walls', ['wall', 'door', 'window', 'pillar']],
  ['Fortress and castle', ['stone_wall', 'slit_wall', 'battlement', 'gate', 'wall_tower']],
  ['Fences', ['palisade', 'fence', 'iron_fence']],
  ['Special', ['anvil', 'stand', 'spawn']],
];
const WALLISH = new Set(Object.keys(PIECES).filter((t) => t === 'wall' || t === 'door' || t === 'window' || PIECES[t].wall));
export const MAX_SPAWNS = 1;
// Builders get a better price on everything they build themselves
export const BUILDER_SHARE = 0.6;

export const pieceCell = (p) => ({ ix: Math.floor(p.x / CELLS_PER_PLOT), iz: Math.floor(p.z / CELLS_PER_PLOT) });
// The plot a piece belongs to: the plot of its cell, or for a wall or pillar on the edge of your
// land, the plot of a cell beside it that `ok(ix, iz)` accepts. null if none is.
export function homePlot(p, ok) {
  const cells = PIECES[p.t].on === 'edge' ? [[p.x, p.z], p.e === 'n' ? [p.x, p.z - 1] : [p.x - 1, p.z]]
    : PIECES[p.t].on === 'corner' ? [[p.x, p.z], [p.x - 1, p.z], [p.x, p.z - 1], [p.x - 1, p.z - 1]] : [[p.x, p.z]];
  for (const [x, z] of cells) { const c = pieceCell({ x, z }); if (ok(c.ix, c.iz)) return c; }
  return null;
}
// one piece per slot: floors and foundations share a cell's floor, the three walls share an edge
const slotOf = (p) => (PIECES[p.t].on === 'edge' ? `e${p.e}` : p.t === 'foundation' || p.t === 'floor' ? 'f' : p.t === 'roof' ? 'r' : p.t === 'stairs' ? 's' : p.t === 'spawn' || p.t === 'anvil' || p.t === 'stand' ? 'p' : 'c');
export const pieceKey = (p) => `${slotOf(p)}:${p.x},${p.z},${p.l}`;

// Is this a well-formed piece? (types, whole numbers, levels in range)
export function validPiece(p) {
  if (!p || !PIECES[p.t] || !Number.isInteger(p.x) || !Number.isInteger(p.z) || !Number.isInteger(p.l)) return false;
  if (p.l < 0 || p.l > MAX_LEVEL || Math.abs(p.x) > 1e6 || Math.abs(p.z) > 1e6) return false;
  if (p.t === 'foundation' && p.l !== 0) return false;
  if (p.t === 'floor' && p.l === 0) return false;
  if (PIECES[p.t].on === 'edge' && p.e !== 'n' && p.e !== 'w') return false;
  if (p.r !== undefined && ![0, 1, 2, 3].includes(p.r)) return false;
  return true;
}
// keep only the fields that matter
export const cleanPiece = (p) => {
  const q = { t: p.t, x: p.x, z: p.z, l: p.l };
  if (PIECES[p.t].on === 'edge') q.e = p.e;
  if (p.t === 'stairs' || p.t === 'roof') q.r = p.r || 0;
  if (p.u) q.u = p.u;
  return q;
};

// Which pieces stand. `ground(ix, iz)` says whether a plot is yours and levelled.
// Everything must connect down, piece by piece, to a foundation on levelled ground.
// Returns the pieces that would fall.
export function unsupported(pieces, ground) {
  const at = new Map(pieces.map((p) => [pieceKey(p), p]));
  const has = (k) => at.has(k) && held.has(k);
  const held = new Set();
  const floorAt = (x, z, l) => `f:${x},${z},${l}`;
  const edgeKeys = (x, z, l) => [`en:${x},${z},${l}`, `en:${x},${z + 1},${l}`, `ew:${x},${z},${l}`, `ew:${x + 1},${z},${l}`];
  const cornerKeys = (x, z, l) => [`c:${x},${z},${l}`, `c:${x + 1},${z},${l}`, `c:${x},${z + 1},${l}`, `c:${x + 1},${z + 1},${l}`];
  const near = (x, z) => [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]];
  const onGround = (x, z) => { const c = pieceCell({ x, z }); return ground(c.ix, c.iz); };
  function standing(p) {
    const { x, z, l } = p;
    switch (p.t) {
      case 'foundation': { const c = pieceCell(p); return ground(c.ix, c.iz); }
      case 'floor':
        return edgeKeys(x, z, l - 1).some(has) || cornerKeys(x, z, l - 1).some(has) || near(x, z).some(([a, b]) => has(floorAt(a, b, l)));
      case 'pillar': case 'wall_tower':
        return [[x, z], [x - 1, z], [x, z - 1], [x - 1, z - 1]].some(([a, b]) => has(floorAt(a, b, l)) || (l === 0 && PIECES[p.t].ground && onGround(a, b))) || has(`c:${x},${z},${l - 1}`);
      case 'stairs': return has(floorAt(x, z, l)) || has(`s:${x},${z},${l - 1}`);
      case 'spawn': case 'anvil': case 'stand': return has(floorAt(x, z, l));
      case 'roof':
        return edgeKeys(x, z, l).some(has) || cornerKeys(x, z, l).some(has) || near(x, z).some(([a, b]) => has(`r:${a},${b},${l}`));
      default: {
        if (!WALLISH.has(p.t)) return false;
        const other = p.e === 'n' ? [x, z - 1] : [x - 1, z];
        // battlements only crown a wall; the rest stand on a floor, a wall below, or (fortress walls
        // and fences) straight on levelled ground
        if (p.t === 'battlement') return has(`e${p.e}:${x},${z},${l - 1}`);
        return has(floorAt(x, z, l)) || has(floorAt(other[0], other[1], l)) || has(`e${p.e}:${x},${z},${l - 1}`)
          || (l === 0 && !!PIECES[p.t].ground && (onGround(x, z) || onGround(other[0], other[1])));
      }
    }
  }
  // keep going until nothing new stands
  let grew = true;
  while (grew) {
    grew = false;
    for (const [k, p] of at) if (!held.has(k) && standing(p)) { held.add(k); grew = true; }
  }
  return pieces.filter((p) => !held.has(pieceKey(p)));
}

// Two pieces that can't share a spot (a roof where the next floor goes)
export function clashes(pieces) {
  const keys = new Set(pieces.map(pieceKey));
  return pieces.filter((p) => p.t === 'floor' && keys.has(`r:${p.x},${p.z},${p.l - 1}`));
}

// ---------- ready-made buildings ----------
// Each is drawn on a w × d grid of cells facing south (its door on the south side), then turned.
function box(w, d, levels, { doors = [[Math.floor(w / 2), d, 'n']], windows = true, stairsAt = [0, 0], roof = true } = {}) {
  const out = [];
  for (let l = 0; l < levels; l++) {
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) out.push({ t: l ? 'floor' : 'foundation', x, z, l });
    for (let x = 0; x < w; x++) {
      out.push({ t: windows && l && x % 2 ? 'window' : 'wall', x, z: 0, l, e: 'n' });
      const door = l === 0 && doors.some(([dx, dz]) => dx === x && dz === d);
      out.push({ t: door ? 'door' : windows && x % 2 ? 'window' : 'wall', x, z: d, l, e: 'n' });
    }
    for (let z = 0; z < d; z++) {
      out.push({ t: windows && z % 2 ? 'window' : 'wall', x: 0, z, l, e: 'w' });
      out.push({ t: windows && z % 2 ? 'window' : 'wall', x: w, z, l, e: 'w' });
    }
    if (l < levels - 1) out.push({ t: 'stairs', x: stairsAt[0], z: stairsAt[1], l, r: 0 });
  }
  if (roof) for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) out.push({ t: 'roof', x, z, l: levels - 1, r: 0 });
  // stairs and the floor above them can't both be there: leave a hole over the stairs
  return out.filter((p) => !(p.t === 'floor' && out.some((s) => s.t === 'stairs' && s.x === p.x && s.z === p.z && s.l === p.l - 1)));
}
function castle() {
  const W = 10, out = [];
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) out.push({ t: 'foundation', x, z, l: 0 });
  // curtain walls, three storeys high, with a gate in the south
  for (let l = 0; l < 3; l++) {
    for (let i = 0; i < W; i++) {
      out.push({ t: 'wall', x: i, z: 0, l, e: 'n' });
      out.push({ t: l === 0 && (i === 4 || i === 5) ? 'door' : 'wall', x: i, z: W, l, e: 'n' });
      out.push({ t: 'wall', x: 0, z: i, l, e: 'w' });
      out.push({ t: 'wall', x: W, z: i, l, e: 'w' });
    }
  }
  // four corner towers, five storeys
  for (const [tx, tz] of [[0, 0], [W - 2, 0], [0, W - 2], [W - 2, W - 2]]) {
    for (const p of box(2, 2, 5, { doors: [], windows: true, stairsAt: [0, 0] })) out.push({ ...p, x: p.x + tx, z: p.z + tz });
  }
  // the keep in the middle, four storeys
  for (const p of box(4, 4, 4, { doors: [[1, 4], [2, 4]], windows: true, stairsAt: [0, 0] })) out.push({ ...p, x: p.x + 3, z: p.z + 3 });
  // one piece per spot (towers and walls overlap at the corners)
  const seen = new Map();
  for (const p of out) seen.set(pieceKey(p), p);
  return [...seen.values()];
}
// A straight run of wall `n` cells long along the north edge: `rows` is the piece for each storey
// from the ground up; `turrets` puts a Wall turret at each end, as tall as the wall
function wallRun(n, rows, { turrets = false, middle = null } = {}) {
  const out = [];
  rows.forEach((t, l) => { for (let x = 0; x < n; x++) out.push({ t: l === 0 && middle && x === Math.floor(n / 2) ? middle : t, x, z: 0, l, e: 'n' }); });
  if (turrets) for (let l = 0; l < rows.length; l++) for (const x of [0, n]) out.push({ t: 'wall_tower', x, z: 0, l });
  return out;
}
// A square of wall `n` cells across with a gate in the middle of the south side
function ring(n, t, gate) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ t, x: i, z: 0, l: 0, e: 'n' });
    out.push({ t: i === Math.floor(n / 2) ? gate : t, x: i, z: n, l: 0, e: 'n' });
    out.push({ t, x: 0, z: i, l: 0, e: 'w' });
    out.push({ t, x: n, z: i, l: 0, e: 'w' });
  }
  return out;
}
export const BUILDINGS = {
  hut: { name: 'Hut', size: [2, 2], pieces: () => box(2, 2, 1, { windows: false }), text: 'One small room. A start.' },
  cottage: { name: 'Cottage', size: [3, 3], pieces: () => box(3, 3, 1), text: 'A snug home with windows.' },
  house: { name: 'House', size: [3, 4], pieces: () => box(3, 4, 2), text: 'Two storeys, with stairs.' },
  shop: { name: 'Shop', size: [4, 3], pieces: () => box(4, 3, 1, { doors: [[1, 3], [2, 3]] }), text: 'A wide front with two doors.' },
  smithy: { name: 'Smithy', size: [3, 3], pieces: () => [...box(3, 3, 1, { doors: [[0, 3], [1, 3], [2, 3]], windows: false }), { t: 'anvil', x: 1, z: 1, l: 0 }, { t: 'stand', x: 0, z: 2, l: 0 }, { t: 'stand', x: 2, z: 2, l: 0 }], text: 'Open to the street, with an anvil and forge inside, and two display stands at the front to show off your work.' },
  barn: { name: 'Barn', size: [4, 5], pieces: () => box(4, 5, 2, { doors: [[1, 5], [2, 5]], windows: false }), text: 'Tall and wide, for animals and crops.' },
  tower: { name: 'Watchtower', size: [2, 2], pieces: () => box(2, 2, 4), text: 'Four storeys to see far across your land.' },
  manor: { name: 'Manor', size: [5, 5], pieces: () => box(5, 5, 3, { doors: [[2, 5]] }), text: 'Three grand storeys.' },
  shrine: { name: 'Spawn Shrine', size: [1, 1], pieces: () => [{ t: 'foundation', x: 0, z: 0, l: 0 }, { t: 'spawn', x: 0, z: 0, l: 0 }], text: 'Wake up here when you fall, instead of back home. Only one.' },
  castle: { name: 'Castle', size: [10, 10], ruler: true, pieces: castle, text: 'Walls, towers and a keep. Only for rulers of a country.' },
  // walls and defences
  fence_run: { name: 'Fence', size: [5, 1], pieces: () => wallRun(5, ['fence']), text: 'A 20 m wooden fence.' },
  railings: { name: 'Iron railings', size: [5, 1], pieces: () => wallRun(5, ['iron_fence']), text: '20 m of tall black railings.' },
  palisade_run: { name: 'Palisade', size: [5, 1], pieces: () => wallRun(5, ['palisade']), text: '20 m of sharpened stakes.' },
  fortress_wall: { name: 'Fortress wall', size: [5, 1], pieces: () => wallRun(5, ['stone_wall', 'stone_wall', 'battlement'], { turrets: true }), text: '20 m of stone wall, two storeys high, with battlements and a turret at each end.' },
  castle_wall: { name: 'Castle wall', size: [5, 1], pieces: () => wallRun(5, ['stone_wall', 'slit_wall', 'stone_wall', 'battlement'], { turrets: true }), text: '20 m of great wall, three storeys high, with arrow slits, battlements and turrets.' },
  gatehouse: { name: 'Gatehouse', size: [3, 1], pieces: () => wallRun(3, ['stone_wall', 'slit_wall', 'battlement'], { turrets: true, middle: 'gate' }), text: 'A great gate in a stone wall, between two turrets.' },
  turret: { name: 'Turret', size: [1, 1], pieces: () => [0, 1, 2, 3].map((l) => ({ t: 'wall_tower', x: 0, z: 0, l })), text: 'A lone stone turret, four storeys tall. Put one where two walls meet.' },
  fort: { name: 'Wooden fort', size: [6, 6], pieces: () => [...ring(6, 'palisade', 'gate'), ...box(2, 2, 3).map((p) => ({ ...p, x: p.x + 1, z: p.z + 1 }))], text: 'A ring of stakes with a gate, and a watchtower inside.' },
  stone_keep: { name: 'Stone fort', size: [8, 8], pieces: () => [...ring(8, 'stone_wall', 'gate'), ...ring(8, 'stone_wall', 'stone_wall').map((p) => ({ ...p, l: 1 })), ...ring(8, 'battlement', 'battlement').map((p) => ({ ...p, l: 2 })),
    ...[[0, 0], [8, 0], [0, 8], [8, 8]].flatMap(([x, z]) => [0, 1, 2, 3].map((l) => ({ t: 'wall_tower', x, z, l })))], text: 'Two-storey stone walls with battlements, a gate and four turrets. Build your own keep inside.' },
};
// The ready buildings in sections, as the Builder shows them
export const BUILDING_GROUPS = [
  ['Homes', ['hut', 'cottage', 'house', 'manor']],
  ['Work', ['shop', 'smithy', 'barn']],
  ['Walls and fences', ['fence_run', 'railings', 'palisade_run', 'fortress_wall', 'castle_wall', 'gatehouse']],
  ['Towers and forts', ['tower', 'turret', 'fort', 'stone_keep', 'castle']],
  ['Special', ['shrine']],
];

// A ready-made building's pieces placed with its north-west corner on cell (x, z), turned `r` quarter turns
export function placeBuilding(type, x, z, r = 0) {
  const b = BUILDINGS[type];
  const [w, d] = b.size;
  return b.pieces().map((p) => {
    const q = { ...p };
    let { x: px, z: pz } = p;
    let e = p.e;
    for (let i = 0; i < r; i++) {
      // a quarter turn clockwise in a (w, d) box: (x, z) -> (D - z, x) where D is the depth so far
      const D = i % 2 ? w : d;
      if (PIECES[p.t].on === 'edge') {
        if (e === 'n') { [px, pz] = [D - pz, px]; e = 'w'; } else { [px, pz] = [D - pz - 1, px]; e = 'n'; }
      } else if (PIECES[p.t].on === 'corner') { [px, pz] = [D - pz, px]; } else { [px, pz] = [D - pz - 1, px]; }
    }
    q.x = px + x; q.z = pz + z;
    if (e) q.e = e;
    if (q.r !== undefined) q.r = (q.r + r) % 4;
    return q;
  });
}
export const buildingSize = (type, r = 0) => { const [w, d] = BUILDINGS[type].size; return r % 2 ? [d, w] : [w, d]; };

const piecesPrice = (pieces) => pieces.reduce((a, p) => a + PIECES[p.t].price, 0);
// Building piece by piece in the Builder View
export const piecesCost = (pieces, cls) => Math.round(piecesPrice(pieces) * (cls === 'builder' ? BUILDER_SHARE : 1));
// Taking pieces down costs too: about a third of what they cost to build (at least 1 Copper each)
export const REMOVE_SHARE = 0.3;
export const removeCost = (pieces, cls) => pieces.length ? Math.max(pieces.length, Math.round(piecesCost(pieces, cls) * REMOVE_SHARE)) : 0;

// A ready-made building costs very different amounts depending on who puts it up:
//  - 'hire': post a quest for a builder; they take a while, but it's the fair price
//  - 'self': raise it at once from the Builder View. A Builder does this cheaper than hiring;
//    anyone else pays a fortune for it
export const READY_MARKUP = 6;
export function buildingCost(type, cls, how) {
  const base = piecesPrice(BUILDINGS[type].pieces());
  if (how === 'hire') return base;
  return Math.round(base * (cls === 'builder' ? 0.7 : READY_MARKUP));
}
// how long a hired builder takes: a minute for every 12 pieces, at least 2
export const hireMinutes = (type) => Math.max(2, Math.ceil(BUILDINGS[type].pieces().length / 12));

// Work out a build on your plots ([{ix, iz, flat, pieces}]): `body` is { add: [pieces], remove: [keys] }
// or { building: { type, x, z, r, how: 'self' | 'hire' } }. Returns { cost, byPlot: Map("ix,iz" -> pieces) }
// for every plot that changes, or { error }.
export function applyBuild(plots, body, cls, now) {
  const mine = new Map(plots.map((p) => [`${p.ix},${p.iz}`, p]));
  const ground = (ix, iz) => mine.get(`${ix},${iz}`)?.flat != null;
  const current = plots.flatMap((p) => p.pieces || []);
  let add, cost;
  const b = body?.building;
  if (b) {
    if (!BUILDINGS[b.type]) return { error: 'Choose a building.' };
    if (!Number.isInteger(b.x) || !Number.isInteger(b.z) || ![0, 1, 2, 3].includes(b.r)) return { error: 'Choose where it goes.' };
    if (BUILDINGS[b.type].ruler && !isRuler(plots)) return { error: `Only rulers of a country can build a castle (own at least ${COUNTRY_PLOTS} plots, all joined up).` };
    const how = b.how === 'hire' ? 'hire' : 'self';
    add = placeBuilding(b.type, b.x, b.z, b.r);
    if (how === 'hire') { const u = now + hireMinutes(b.type) * 60000; for (const p of add) p.u = u; }
    cost = buildingCost(b.type, cls, how);
  } else {
    add = Array.isArray(body?.add) ? body.add : [];
    if (add.length > 500) return { error: 'Too many pieces at once.' };
    if (add.some((p) => !validPiece(p))) return { error: 'Something in the plan is not a real piece.' };
    add = add.map((p) => cleanPiece({ ...p, u: undefined }));
    cost = piecesCost(add, cls);
  }
  const remove = new Set(Array.isArray(body?.remove) ? body.remove.map(String) : []);
  if (current.some((p) => p.show && remove.has(pieceKey(p)))) return { error: 'Take the piece off the display stand before you take the stand down.' };
  const kept = current.filter((p) => !remove.has(pieceKey(p)));
  cost += removeCost(current.filter((p) => remove.has(pieceKey(p))), cls);
  const taken = new Set(kept.map(pieceKey));
  for (const p of add) {
    if (taken.has(pieceKey(p))) return { error: b ? 'Something is already built there. Clear the space first.' : 'Something is already built in that spot.' };
    taken.add(pieceKey(p));
  }
  const next = [...kept, ...add];
  if (next.length > MAX_PIECES) return { error: `That's more than ${MAX_PIECES} pieces.` };
  if (next.filter((p) => p.t === 'spawn').length > MAX_SPAWNS) return { error: 'You can have only one Spawn Shrine. Take the old one down first.' };
  const homes = new Map();
  for (const p of add) {
    const h = homePlot(p, ground);
    if (!h) return { error: b ? 'It has to fit on your own cleared and levelled land.' : 'Build only on your own land, once it is cleared and levelled (Land window).' };
    homes.set(p, h);
  }
  if (clashes(next).length) return { error: 'A floor can\'t go where a roof already is.' };
  const fall = unsupported(next, ground);
  if (fall.length) return { error: `${fall.length} piece${fall.length === 1 ? ' has' : 's have'} nothing holding ${fall.length === 1 ? 'it' : 'them'} up. Every piece must connect down to a foundation.`, falls: fall.map(pieceKey) };
  // regroup by plot, only for plots that changed
  const byPlot = new Map();
  const touched = new Set();
  for (const p of current) if (remove.has(pieceKey(p))) touched.add(homeKey(p, ground));
  for (const [, h] of homes) touched.add(`${h.ix},${h.iz}`);
  for (const k of touched) byPlot.set(k, []);
  for (const p of kept) { const k = homeKey(p, ground); if (byPlot.has(k)) byPlot.get(k).push(p); }
  for (const [p, h] of homes) byPlot.get(`${h.ix},${h.iz}`).push(p);
  return { cost, byPlot };
}

// Put a piece of gear on one of your display stands ({ x, z, l }), or take it off (item null).
// Changes the stand in `plots` and returns { plot, old } (old: what was on it), or { error }.
export function setStand(plots, at, item, now = Date.now()) {
  for (const p of plots) {
    for (const q of p.pieces || []) {
      if (q.t !== 'stand' || q.x !== at?.x || q.z !== at?.z || q.l !== at?.l) continue;
      if (q.u && q.u > now) return { error: 'The stand is not finished yet.' };
      if (item && q.show) return { error: 'Something is already on this stand. Take it off first.' };
      if (!item && !q.show) return { error: 'The stand is empty.' };
      const old = q.show || null;
      if (item) q.show = item; else delete q.show;
      return { plot: p, old };
    }
  }
  return { error: 'There is no display stand of yours there.' };
}
const homeKey = (p, ok) => { const h = homePlot(p, ok); return h ? `${h.ix},${h.iz}` : ''; };

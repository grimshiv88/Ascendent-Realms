// Live movement: players close by send each other where they are about 10 times a second, straight
// through Supabase Realtime (a websocket), instead of waiting for the once-a-second server check.
// The server still says who is near and what they look like (see main.js); this only moves them.
//
// The world is cut into squares (CELL metres). You send into the square you stand in and listen to
// it and the 8 around it, so only players close by get your updates.
// It speaks Supabase Realtime's own small protocol (Phoenix channels, JSON), so no library is needed.

export const CELL = 120;
const SEND_MS = 100;        // at most 10 updates a second while you move
const STILL_MS = 2000;      // standing still: one update every 2 seconds, so you don't vanish
const HEARTBEAT_MS = 25000; // the connection's own "still here", which Realtime needs

const r2 = (v) => Math.round(v * 100) / 100;
// the squares to listen to for a spot (one channel for a cave or a building)
function roomsFor(place, x, z) {
  const tag = String(place || 'out').replace(/[^\w-]/g, '_');
  if (place !== 'out') return [`ar-${tag}`];
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), out = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(`ar-out-${cx + i}_${cz + j}`);
  return out;
}
const myRoom = (place, x, z) => (place === 'out' ? `ar-out-${Math.floor(x / CELL)}_${Math.floor(z / CELL)}` : roomsFor(place, x, z)[0]);

// { url: 'https://<ref>.supabase.co', key: '<anon key>' }, my account id, and what to do with an update
// onAct gets the attacks and spells they do (see world.js actOther)
export function startLive({ url, key }, myId, onMove, onState = () => {}, onAct = () => {}) {
  let ws = null, ref = 0, beat = null, closed = false, tries = 0;
  let joined = new Map(); // topic -> join ref
  let lastSent = null, lastAt = 0, wantRooms = [], lastSpot = null, near = false, acts = [];
  const socketUrl = `${url.replace(/^http/, 'ws').replace(/\/$/, '')}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;

  const send = (msg) => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); };
  const join = (room) => {
    const topic = `realtime:${room}`;
    if (joined.has(topic) || ws?.readyState !== 1) return; // (joined once the connection is open)
    const r = String(++ref);
    joined.set(topic, r);
    send({ topic, event: 'phx_join', payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '', enabled: false }, postgres_changes: [], private: false }, access_token: key }, ref: r, join_ref: r });
  };
  const leave = (topic) => { send({ topic, event: 'phx_leave', payload: {}, ref: String(++ref), join_ref: joined.get(topic) }); joined.delete(topic); };
  function listen(rooms) {
    wantRooms = rooms;
    if (ws?.readyState !== 1) return;
    const want = new Set(rooms.map((r) => `realtime:${r}`));
    for (const t of [...joined.keys()]) if (!want.has(t)) leave(t);
    for (const r of rooms) join(r);
  }

  function connect() {
    if (closed) return;
    try { ws = new WebSocket(socketUrl); } catch { retry(); return; }
    joined = new Map();
    ws.onopen = () => {
      tries = 0; joined = new Map(); onState('on');
      beat = setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }), HEARTBEAT_MS);
      listen(wantRooms);
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.event === 'broadcast' && m.payload?.event === 'pos') {
        const p = m.payload.payload;
        if (p && p.i !== myId && Number.isFinite(p.x) && Number.isFinite(p.z)) onMove(p);
      } else if (m.event === 'broadcast' && m.payload?.event === 'act') {
        const p = m.payload.payload;
        if (p && p.i !== myId && typeof p.k === 'string') onAct(p);
      } else if (m.event === 'phx_reply' && m.payload?.status === 'error') onState('refused', m.payload?.response);
    };
    ws.onclose = () => { clearInterval(beat); beat = null; onState('off'); retry(); };
    ws.onerror = () => {};
  }
  function retry() { if (!closed) setTimeout(connect, Math.min(30000, 1000 * 2 ** tries++)); }
  connect();

  return {
    // called every frame with where you are; sends when you moved (at most 10 a second)
    update(spot, anyoneNear) {
      listen(roomsFor(spot.place, spot.x, spot.z));
      lastSpot = spot; near = !!anyoneNear;
      if (!anyoneNear || ws?.readyState !== 1) return;
      const now = performance.now();
      const moved = !lastSent || lastSent.place !== spot.place || lastSent.pose !== spot.pose
        || Math.hypot(spot.x - lastSent.x, spot.z - lastSent.z) > 0.03 || Math.abs(spot.y - lastSent.y) > 0.05
        || Math.abs(spot.heading - lastSent.heading) > 0.03 || Math.abs(spot.speed - lastSent.speed) > 0.2;
      if (now - lastAt < (moved ? SEND_MS : STILL_MS)) return;
      lastSent = { ...spot }; lastAt = now;
      const topic = `realtime:${myRoom(spot.place, spot.x, spot.z)}`;
      send({ topic, event: 'broadcast', payload: { type: 'broadcast', event: 'pos',
        payload: { i: myId, x: r2(spot.x), y: r2(spot.y), z: r2(spot.z), h: Math.round(spot.heading * 1000) / 1000, s: r2(spot.speed), p: spot.pose || '' } },
      ref: String(++ref), join_ref: joined.get(topic) });
    },
    // an attack or spell you just did, for players close by to see (at most 8 a second)
    act(a) {
      if (!lastSpot || !near || ws?.readyState !== 1 || !a) return;
      // (monster updates have their own pace: see world.js)
      if (a.k !== 'mobs' && a.k !== 'mobhit' && a.k !== 'mobwon') {
        const now = performance.now();
        acts = acts.filter((t) => now - t < 1000);
        if (acts.length >= 8) return;
        acts.push(now);
      }
      const topic = `realtime:${myRoom(lastSpot.place, lastSpot.x, lastSpot.z)}`;
      send({ topic, event: 'broadcast', payload: { type: 'broadcast', event: 'act', payload: { ...a, i: myId } }, ref: String(++ref), join_ref: joined.get(topic) });
    },
    get on() { return ws?.readyState === 1; },
    stop() { closed = true; clearInterval(beat); try { ws?.close(); } catch { /* gone */ } },
  };
}

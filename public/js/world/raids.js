// Monster attacks on the towns (see data/raids.mjs), as each player's game shows them:
//   - close to the town (RAID_SEEN), the monsters are there: a band round a city's walls (its
//     bridges are raised) or in among a village's houses, fighting anyone they find
//   - close by (RAID_NEAR), a warning across the screen when it starts, and when it is over
//   - in the towns round about (NEWS_FAR), the news: the townsfolk crowd the plaza and talk about it
// Each game has its own monsters (like every monster in the wilds); a player who beats every one of
// them has saved the town in their own world.
import { RAIDERS, RAID_NEAR, RAID_SEEN, NEWS_FAR, GATHER_NEWS_MS, raidActive, newsLine, raidWarning, raidEndText } from '../data/raids.mjs';
import { placesWithPositions, sample, CITY_R } from '../data/world-layout.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function createRaids({ creatures, getPos, inWorld, say, onSlain }) {
  let list = [];             // the attacks going on now and the ones still talked about
  const seen = new Map();    // raid id -> what this game has done about it { warned, ended, beaten }
  const bands = new Map();   // raid id -> the monsters of it here
  let first = true;          // (the first list after loading: no warning for attacks you already knew of)
  const where = (r) => placesWithPositions().find((p) => p.id === r.place);

  // the red banner across the top for players close by
  const banner = document.createElement('div');
  banner.className = 'raid-banner';
  banner.hidden = true;
  banner.innerHTML = '<b>⚔</b><span></span><button type="button" aria-label="Close">×</button>';
  document.body.append(banner);
  let bannerTimer = 0;
  banner.querySelector('button').addEventListener('click', () => { banner.hidden = true; });
  function warn(text, secs = 14) {
    banner.querySelector('span').innerHTML = esc(text);
    banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.hidden = true; }, secs * 1000);
  }

  // where around the town the monsters stand: outside a city's moat, in among a village's houses
  function spotFor(p, i, n) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    for (let k = 0; k < 8; k++) {
      const r = p.city ? CITY_R + 25 + Math.random() * 45 : 15 + Math.random() * 40;
      const x = p.x + Math.cos(a + k * 0.4) * r, z = p.z + Math.sin(a + k * 0.4) * r;
      const s = sample(x, z, {});
      if (s.h > s.water + 0.4) return { x, z };
    }
    return null;
  }
  function spawnBand(r, p) {
    const band = RAIDERS[r.raiders] || RAIDERS.goblins;
    const st = seen.get(r.id);
    const left = r.n - (st.beaten || 0);
    const ms = [];
    for (let i = 0; i < left; i++) {
      const at = spotFor(p, i, left);
      if (!at) continue;
      const leader = i === 0 && !st.leaderDown;
      const kind = leader ? band.leader : band.kinds[i % band.kinds.length];
      const level = Math.max(1, Math.round(r.level * (leader ? 1.15 : 0.85 + Math.random() * 0.25)));
      const m = creatures.spawnAt(kind, level, at.x, at.z, {
        keep: true, angry: true, raid: r.id, leader, boss: leader,
        title: leader ? `${RAIDERS[r.raiders]?.name.replace(/s$/, '')} Warlord` : undefined,
        leash: { x: p.x, z: p.z, r: p.city ? CITY_R + 90 : 70 },
      });
      ms.push(m);
    }
    bands.set(r.id, ms);
  }
  function clearBand(id) {
    const ms = bands.get(id);
    if (ms) creatures.removeWhere((m) => m.raid === id && !m.dead);
    bands.delete(id);
  }

  // a new list from the server (every few seconds)
  function set(raids = []) {
    list = raids;
    const now = Date.now();
    const me = getPos();
    for (const r of list) {
      const p = where(r);
      if (!p) continue;
      const st = seen.get(r.id) || { warned: false, ended: false, beaten: 0 };
      seen.set(r.id, st);
      const d = Math.hypot(me.x - p.x, me.z - p.z);
      if (raidActive(r, now)) {
        if (!st.warned) {
          st.warned = true;
          if (!first || now - r.at < 60000) {
            if (d < RAID_NEAR) warn(raidWarning(r), 20);
            else if (d < NEWS_FAR) warn(`News from ${r.placeName}: ${RAIDERS[r.raiders]?.name || 'monsters'} are attacking it!`, 10);
          } else if (d < RAID_NEAR) warn(raidWarning(r), 20);
        }
      } else if (!st.ended) {
        st.ended = true;
        clearBand(r.id);
        if (st.warned && d < NEWS_FAR && (!first || now - (r.endedAt || r.until) < 60000)) warn(raidEndText(r), 10);
      }
    }
    // gone from the list: forgotten
    for (const id of [...bands.keys()]) if (!list.some((r) => r.id === id)) clearBand(id);
    first = false;
  }

  // every second or so: the monsters come while you are near, and go when you leave
  let checkT = 0;
  function tick(dt) {
    checkT -= dt;
    if (checkT > 0) return;
    checkT = 1;
    const me = getPos(), now = Date.now();
    for (const r of list) {
      const p = where(r), st = seen.get(r.id);
      if (!p || !st) continue;
      const on = raidActive(r, now) && st.beaten < r.n;
      const d = Math.hypot(me.x - p.x, me.z - p.z);
      if (!on && st.ended !== true && raidActive(r, now) === false) { st.ended = true; clearBand(r.id); }
      const ms = bands.get(r.id);
      if (on && inWorld() && d < RAID_SEEN && !ms) spawnBand(r, p);
      else if (ms && (d > RAID_SEEN + 300 || !inWorld())) clearBand(r.id);
      // the ones you beat
      if (ms) {
        for (const m of ms) {
          if (!m.dead || m.counted) continue;
          m.counted = true;
          st.beaten = (st.beaten || 0) + 1;
          if (m.leader) st.leaderDown = true;
          onSlain?.(r, st.beaten);
          if (st.beaten >= r.n) { say(`You have driven off the ${(RAIDERS[r.raiders]?.name || 'monsters').toLowerCase()}! ${r.placeName} is safe`, 'exp'); warn(`You saved ${r.placeName}! Every monster attacking it is beaten.`, 12); }
          else if (m.leader) say(`The warlord falls! ${r.n - st.beaten} of the attackers are left`, 'exp');
        }
      }
    }
  }

  // the cities whose bridges an attack keeps raised (as far as this game knows)
  function raisedCities(now = Date.now()) {
    const out = {};
    for (const r of list) if (r.city && raidActive(r, now)) out[r.place] = true;
    return out;
  }
  // the news a town is talking about: the latest attack within NEWS_FAR of it, if any
  function newsAt(x, z, now = Date.now()) {
    let best = null;
    for (const r of list) {
      const p = where(r);
      if (!p || Math.hypot(p.x - x, p.z - z) > NEWS_FAR) continue;
      if (!best || r.at > best.at) best = r;
    }
    return best;
  }
  // whether a town's folk crowd the plaza: while an attack nearby is fresh (or still going on there)
  function gatherAt(place, now = Date.now()) {
    const r = newsAt(place.x, place.z, now);
    if (!r) return false;
    return now - r.at < GATHER_NEWS_MS || (raidActive(r, now) && r.place === place.id);
  }
  // what a townsperson says about it (by who is speaking)
  function talk(x, z, speaker = 0) {
    const r = newsAt(x, z);
    return r ? newsLine(r, speaker) : null;
  }

  return {
    set, tick, raisedCities, newsAt, gatherAt, talk,
    debugList: () => list.map((r) => ({ ...r, here: seen.get(r.id), monsters: (bands.get(r.id) || []).filter((m) => !m.dead).length })),
    dispose() { for (const id of [...bands.keys()]) clearBand(id); banner.remove(); },
  };
}

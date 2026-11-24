// Voice chat for players 16 and over: talk to the players near you. Voices get quieter with
// distance and can't be heard past HEAR_M metres. Your party (made from the Friends menu) has
// its own voice room, heard at full loudness however far apart you are; you choose whether your
// mic goes to Nearby or to Party. Every voice has a Mute button (only for you)
// and a Report button (the game's owner sees it on the admin board).
// The voices travel through LiveKit; the game server only gives out a short pass (api/voice/pass)
// after checking the player's age and that they aren't muted.
import * as api from './api.js';
import { VOICE_AGE } from './data/birthdate.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const FULL_M = 4; // full loudness this close
export const HEAR_M = 40; // silent (and not even downloaded) past this
const TICK_MS = 400; // how often positions are shared and volumes updated
const RECHECK_MS = 30 * 1000; // ask the server again: still allowed to talk? joined or left a party?
const MUTED_KEY = 'ar.voice.muted';
const REASONS = ['Bad words', 'Shouting or noise', 'Bullying', 'Too young', 'Other'];

// how loud a voice `d` metres away is (1 = full, 0 = silent)
export function loudness(d) {
  if (!(d >= 0)) return 0;
  if (d <= FULL_M) return 1;
  if (d >= HEAR_M) return 0;
  const t = 1 - (d - FULL_M) / (HEAR_M - FULL_M);
  return t * t;
}

let lib = null;
function loadLib() {
  if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
  lib ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/livekit-client.umd.js';
    s.onload = () => (window.LivekitClient ? resolve(window.LivekitClient) : reject(new Error('Voice chat could not load.')));
    s.onerror = () => { lib = null; reject(new Error('Voice chat could not load. Check your internet.')); };
    document.head.appendChild(s);
  });
  return lib;
}

const savedMuted = () => { try { return new Set(JSON.parse(localStorage.getItem(MUTED_KEY) || '[]')); } catch { return new Set(); } };
const saveMuted = (set) => { try { localStorage.setItem(MUTED_KEY, JSON.stringify([...set])); } catch { /* storage blocked */ } };

// host: the game's screen element; position(): { x, z } of the player in metres
export function createVoice(host, { position }) {
  host.insertAdjacentHTML('beforeend', `
    <button type="button" class="vo-toggle" aria-label="Voice chat" aria-expanded="false" title="Voice chat (${VOICE_AGE}+)">🎙️</button>
    <div class="vo-panel" hidden>
      <div class="vo-head"><b>Voice chat</b><span class="vo-state">Off</span><button type="button" class="vo-close ghost" aria-label="Close">✕</button></div>
      <p class="vo-note">Talk to players near you, or to your party wherever they are. For players ${VOICE_AGE} and over.</p>
      <div class="vo-actions">
        <button type="button" class="vo-join">Join voice</button>
        <button type="button" class="vo-mic" hidden>🎙️ Mic on</button>
        <button type="button" class="vo-leave ghost" hidden>Leave voice</button>
      </div>
      <div class="vo-to" role="group" aria-label="Talk to" hidden>
        <span>Talk to:</span><button type="button" data-to="near" aria-pressed="true">Nearby</button><button type="button" data-to="party" aria-pressed="false">Party</button>
      </div>
      <p class="vo-msg" role="status"></p>
      <ul class="vo-list"></ul>
      <div class="vo-audio" hidden></div>
    </div>`);
  const $ = (s) => host.querySelector(s);
  const toggle = $('.vo-toggle'), panel = $('.vo-panel'), stateEl = $('.vo-state'), msg = $('.vo-msg');
  const joinBtn = $('.vo-join'), micBtn = $('.vo-mic'), leaveBtn = $('.vo-leave'), list = $('.vo-list'), audioBox = $('.vo-audio');
  const toBox = $('.vo-to');

  let room = null, L = null, tick = null, recheck = null, micOn = true, joining = false;
  let party = null; // { room: Room, name: 'party-7' }
  let talkTo = 'near'; // where the mic goes: 'near' or 'party'
  const muted = savedMuted();
  const spots = new Map(); // identity -> { x, z, at }
  const speaking = { near: new Set(), party: new Set() };
  let reporting = null;

  const say = (text) => { msg.textContent = text || ''; };
  function setOpen(v) {
    panel.hidden = !v;
    toggle.setAttribute('aria-expanded', String(v));
    if (v) drawList();
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  $('.vo-close').addEventListener('click', () => setOpen(false));

  function showState() {
    const on = !!room;
    const where = talkTo === 'party' && party ? 'party' : 'nearby';
    stateEl.textContent = on ? (micOn ? `On · talking to ${where}` : 'On · mic off') : 'Off';
    toggle.classList.toggle('on', on);
    toggle.classList.toggle('live', on && micOn);
    toggle.classList.toggle('party', on && micOn && where === 'party');
    joinBtn.hidden = on;
    micBtn.hidden = leaveBtn.hidden = !on;
    micBtn.textContent = micOn ? '🎙️ Mic on' : '🔇 Mic off';
    micBtn.setAttribute('aria-pressed', String(micOn));
    toBox.hidden = !(on && party);
    for (const b of toBox.querySelectorAll('[data-to]')) b.setAttribute('aria-pressed', String(b.dataset.to === (party ? talkTo : 'near')));
  }

  // the mic goes to one room at a time
  async function applyMic() {
    if (!room) return;
    const toParty = talkTo === 'party' && !!party;
    try {
      if (party) await party.room.localParticipant.setMicrophoneEnabled(micOn && toParty);
      await room.localParticipant.setMicrophoneEnabled(micOn && !toParty);
      say('');
    } catch {
      micOn = false;
      say('Your microphone is blocked. You can still listen. Allow the microphone in your browser to talk.');
    }
    showState();
  }

  function near() {
    if (!room) return [];
    const me = position();
    const out = [];
    for (const p of room.remoteParticipants.values()) {
      const s = spots.get(p.identity);
      const d = s && me ? Math.hypot(s.x - me.x, s.z - me.z) : Infinity;
      out.push({ p, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  function row(n, where, extra) {
    const m = muted.has(n), talking = speaking[where].has(n) && !m;
    if (reporting === n) {
      return `<li class="vo-report"><form data-report-form="${esc(n)}">
        <b>Report ${esc(n)}</b>
        <select name="reason">${REASONS.map((r) => `<option>${r}</option>`).join('')}</select>
        <input name="text" maxlength="200" placeholder="What happened? (optional)">
        <span><button type="submit">Send</button><button type="button" class="ghost" data-cancel>Cancel</button></span>
      </form></li>`;
    }
    return `<li class="${talking ? 'talking' : ''}">
      <span class="vo-name">${talking ? '🔊' : '·'} ${esc(n)}</span><small>${extra}</small>
      <button type="button" class="ghost" data-mute="${esc(n)}" aria-pressed="${m}">${m ? 'Unmute' : 'Mute'}</button>
      <button type="button" class="ghost" data-report="${esc(n)}">Report</button>
    </li>`;
  }

  function drawList() {
    if (!room) { list.innerHTML = ''; return; }
    let html = '';
    if (party) {
      const mates = [...party.room.remoteParticipants.values()].map((p) => p.identity);
      html += '<li class="vo-sec">Party</li>' + (mates.length ? mates.map((n) => row(n, 'party', 'party')).join('') : '<li class="vo-empty">No one else from your party is in voice.</li>');
      html += '<li class="vo-sec">Nearby</li>';
    }
    const rows = near().filter((r) => r.d < HEAR_M);
    html += rows.length ? rows.map(({ p, d }) => row(p.identity, 'near', `${Math.round(d)} m`)).join('') : '<li class="vo-empty">Nobody is close enough to hear.</li>';
    list.innerHTML = html;
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mute) {
      const n = b.dataset.mute;
      if (muted.has(n)) muted.delete(n); else muted.add(n);
      saveMuted(muted);
      update();
    } else if (b.dataset.report) { reporting = b.dataset.report; drawList(); }
    else if (b.hasAttribute('data-cancel')) { reporting = null; drawList(); }
  });
  list.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, n = f.dataset.reportForm;
    try {
      await api.reportPlayer(n, `Voice chat: ${f.reason.value}`, f.text.value.trim());
      muted.add(n); saveMuted(muted); // stop hearing them straight away
      say(`Thank you. Your report about ${n} was sent, and they are muted for you.`);
    } catch (err) { say(err.message); }
    reporting = null;
    update();
  });
  toBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-to]');
    if (!b || !party || talkTo === b.dataset.to) return;
    talkTo = b.dataset.to;
    applyMic();
  });

  const listen = (p, v) => {
    for (const pub of p.audioTrackPublications.values()) if (pub.isSubscribed !== v > 0) pub.setSubscribed(v > 0);
    p.setVolume(v);
  };
  // nearby volumes and downloads follow distance; your own spot is shared with the room.
  // Party voices are always full loudness (unless you muted them).
  function update() {
    if (!room) return;
    const me = position();
    if (me) {
      const data = new TextEncoder().encode(JSON.stringify({ x: Math.round(me.x * 10) / 10, z: Math.round(me.z * 10) / 10 }));
      room.localParticipant.publishData(data, { reliable: false }).catch(() => {});
    }
    for (const { p, d } of near()) listen(p, muted.has(p.identity) ? 0 : loudness(d));
    if (party) for (const p of party.room.remoteParticipants.values()) listen(p, muted.has(p.identity) ? 0 : 1);
    if (!panel.hidden && !reporting) drawList();
  }

  function makeRoom(where) {
    const R = L.RoomEvent;
    const r = new L.Room({ adaptiveStream: false, dynacast: false, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    r.on(R.TrackSubscribed, (track) => { if (track.kind === 'audio') audioBox.appendChild(track.attach()); });
    r.on(R.TrackUnsubscribed, (track) => { for (const el of track.detach()) el.remove(); });
    r.on(R.ParticipantDisconnected, (p) => { if (where === 'near') spots.delete(p.identity); speaking[where].delete(p.identity); drawList(); });
    r.on(R.ParticipantConnected, () => drawList());
    r.on(R.ActiveSpeakersChanged, (who) => { speaking[where].clear(); for (const p of who) speaking[where].add(p.identity); });
    return r;
  }

  // join, switch or leave the party's voice room to match the party you are in now
  async function syncParty(info, url) {
    if ((party?.name || null) === (info?.room || null)) return;
    if (party) {
      const old = party; party = null;
      old.room.disconnect().catch(() => {});
      speaking.party.clear();
      if (!info) { if (talkTo === 'party') talkTo = 'near'; say('You left your party, so party voice ended.'); }
    }
    if (info) {
      const r = makeRoom('party');
      r.on(L.RoomEvent.Disconnected, () => { if (party?.room === r) { party = null; applyMic(); drawList(); } });
      await r.connect(url, info.token, { autoSubscribe: false });
      party = { room: r, name: info.room };
    }
    await applyMic();
    drawList();
  }

  async function join() {
    if (room || joining) return;
    joining = true;
    joinBtn.disabled = true;
    say('Joining…');
    try {
      const pass = await api.voicePass(); // says why not before loading anything
      L = await loadLib();
      const r = makeRoom('near');
      r.on(L.RoomEvent.DataReceived, (payload, p) => {
        if (!p) return;
        try {
          const s2 = JSON.parse(new TextDecoder().decode(payload));
          if (Number.isFinite(s2.x) && Number.isFinite(s2.z)) spots.set(p.identity, { x: s2.x, z: s2.z, at: Date.now() });
        } catch { /* not a spot */ }
      });
      r.on(L.RoomEvent.Disconnected, () => { if (room === r) stop('Voice chat ended.'); });
      await r.connect(pass.url, pass.token, { autoSubscribe: false });
      room = r;
      await r.startAudio().catch(() => {});
      if (pass.party) talkTo = 'party'; // in a party: talk to them first
      await syncParty(pass.party, pass.url).catch(() => say('Party voice could not start. Nearby voice still works.'));
      await applyMic();
      tick = setInterval(update, TICK_MS);
      recheck = setInterval(async () => {
        if (!room) return;
        let p2;
        try { p2 = await api.voicePass(); } catch (err) { stop(err.message); return; }
        syncParty(p2.party, p2.url).catch(() => {});
      }, RECHECK_MS);
      update();
    } catch (err) {
      say(err.message || 'Voice chat could not start.');
    } finally {
      joining = false;
      joinBtn.disabled = false;
      showState();
    }
  }

  function stop(why = '') {
    clearInterval(tick); clearInterval(recheck);
    const r = room, pr = party;
    room = null; party = null;
    if (r) r.disconnect().catch(() => {});
    if (pr) pr.room.disconnect().catch(() => {});
    audioBox.innerHTML = '';
    spots.clear(); speaking.near.clear(); speaking.party.clear();
    say(why);
    showState();
    drawList();
  }

  joinBtn.addEventListener('click', join);
  leaveBtn.addEventListener('click', () => stop());
  micBtn.addEventListener('click', () => { if (!room) return; micOn = !micOn; applyMic(); });
  window.addEventListener('pagehide', () => stop());
  showState();

  return { join, stop, get on() { return !!room; } };
}

// Voice chat for players 16 and over: talk to the players near you. Voices get quieter with
// distance and can't be heard past HEAR_M metres. Every voice has a Mute button (only for you)
// and a Report button (the game's owner sees it on the admin board).
// The voices travel through LiveKit; the game server only gives out a short pass (api/voice/pass)
// after checking the player's age and that they aren't muted.
import * as api from './api.js';
import { VOICE_AGE } from './data/birthdate.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const FULL_M = 4; // full loudness this close
export const HEAR_M = 40; // silent (and not even downloaded) past this
const TICK_MS = 400; // how often positions are shared and volumes updated
const RECHECK_MS = 8 * 60 * 1000; // ask the server again whether this player may still talk
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
      <p class="vo-note">Talk to players near you. Voices fade with distance. For players ${VOICE_AGE} and over.</p>
      <div class="vo-actions">
        <button type="button" class="vo-join">Join voice</button>
        <button type="button" class="vo-mic" hidden>🎙️ Mic on</button>
        <button type="button" class="vo-leave ghost" hidden>Leave voice</button>
      </div>
      <p class="vo-msg" role="status"></p>
      <ul class="vo-list"></ul>
      <div class="vo-audio" hidden></div>
    </div>`);
  const $ = (s) => host.querySelector(s);
  const toggle = $('.vo-toggle'), panel = $('.vo-panel'), stateEl = $('.vo-state'), msg = $('.vo-msg');
  const joinBtn = $('.vo-join'), micBtn = $('.vo-mic'), leaveBtn = $('.vo-leave'), list = $('.vo-list'), audioBox = $('.vo-audio');

  let room = null, L = null, tick = null, recheck = null, micOn = true, joining = false;
  const muted = savedMuted();
  const spots = new Map(); // identity -> { x, z, at }
  const speaking = new Set();
  let reporting = null;

  const say = (text) => { msg.textContent = text || ''; };
  function setOpen(v) {
    panel.hidden = !v;
    toggle.setAttribute('aria-expanded', String(v));
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  $('.vo-close').addEventListener('click', () => setOpen(false));

  function showState() {
    const on = !!room;
    stateEl.textContent = on ? (micOn ? 'On · talking' : 'On · mic off') : 'Off';
    toggle.classList.toggle('on', on);
    toggle.classList.toggle('live', on && micOn);
    joinBtn.hidden = on;
    micBtn.hidden = leaveBtn.hidden = !on;
    micBtn.textContent = micOn ? '🎙️ Mic on' : '🔇 Mic off';
    micBtn.setAttribute('aria-pressed', String(micOn));
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

  function drawList() {
    if (!room) { list.innerHTML = ''; return; }
    const rows = near().filter((r) => r.d < HEAR_M);
    if (!rows.length) { list.innerHTML = '<li class="vo-empty">Nobody is close enough to hear.</li>'; return; }
    list.innerHTML = rows.map(({ p, d }) => {
      const n = p.identity, m = muted.has(n);
      if (reporting === n) {
        return `<li class="vo-report"><form data-report-form="${esc(n)}">
          <b>Report ${esc(n)}</b>
          <select name="reason">${REASONS.map((r) => `<option>${r}</option>`).join('')}</select>
          <input name="text" maxlength="200" placeholder="What happened? (optional)">
          <span><button type="submit">Send</button><button type="button" class="ghost" data-cancel>Cancel</button></span>
        </form></li>`;
      }
      return `<li class="${speaking.has(n) && !m ? 'talking' : ''}">
        <span class="vo-name">${speaking.has(n) && !m ? '🔊' : '·'} ${esc(n)}</span><small>${Math.round(d)} m</small>
        <button type="button" class="ghost" data-mute="${esc(n)}" aria-pressed="${m}">${m ? 'Unmute' : 'Mute'}</button>
        <button type="button" class="ghost" data-report="${esc(n)}">Report</button>
      </li>`;
    }).join('');
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

  // volumes and downloads follow distance; your own spot is shared with the room
  function update() {
    if (!room) return;
    const me = position();
    if (me) {
      const data = new TextEncoder().encode(JSON.stringify({ x: Math.round(me.x * 10) / 10, z: Math.round(me.z * 10) / 10 }));
      room.localParticipant.publishData(data, { reliable: false }).catch(() => {});
    }
    for (const { p, d } of near()) {
      const v = muted.has(p.identity) ? 0 : loudness(d);
      for (const pub of p.audioTrackPublications.values()) {
        const want = v > 0;
        if (pub.isSubscribed !== want) pub.setSubscribed(want);
      }
      p.setVolume(v);
    }
    if (!panel.hidden && !reporting) drawList();
  }

  async function join() {
    if (room || joining) return;
    joining = true;
    joinBtn.disabled = true;
    say('Joining…');
    try {
      const pass = await api.voicePass(); // says why not before loading anything
      L = await loadLib();
      const R = L.RoomEvent;
      const r = new L.Room({ adaptiveStream: false, dynacast: false, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      r.on(R.TrackSubscribed, (track) => {
        if (track.kind !== 'audio') return;
        const el = track.attach();
        audioBox.appendChild(el);
      });
      r.on(R.TrackUnsubscribed, (track) => { for (const el of track.detach()) el.remove(); });
      r.on(R.DataReceived, (payload, p) => {
        if (!p) return;
        try {
          const s = JSON.parse(new TextDecoder().decode(payload));
          if (Number.isFinite(s.x) && Number.isFinite(s.z)) spots.set(p.identity, { x: s.x, z: s.z, at: Date.now() });
        } catch { /* not a spot */ }
      });
      r.on(R.ParticipantDisconnected, (p) => { spots.delete(p.identity); speaking.delete(p.identity); drawList(); });
      r.on(R.ActiveSpeakersChanged, (list2) => { speaking.clear(); for (const p of list2) speaking.add(p.identity); });
      r.on(R.Disconnected, () => { if (room === r) stop('Voice chat ended.'); });
      await r.connect(pass.url, pass.token, { autoSubscribe: false });
      room = r;
      await r.startAudio().catch(() => {});
      try { await r.localParticipant.setMicrophoneEnabled(micOn); }
      catch { micOn = false; say('Your microphone is blocked. You can still listen. Allow the microphone in your browser to talk.'); }
      if (micOn) say('');
      tick = setInterval(update, TICK_MS);
      recheck = setInterval(async () => {
        try { await api.voicePass(); } catch (err) { stop(err.message); }
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
    const r = room;
    room = null;
    if (r) r.disconnect().catch(() => {});
    audioBox.innerHTML = '';
    spots.clear(); speaking.clear();
    say(why);
    showState();
    drawList();
  }

  joinBtn.addEventListener('click', join);
  leaveBtn.addEventListener('click', () => stop());
  micBtn.addEventListener('click', async () => {
    if (!room) return;
    micOn = !micOn;
    try { await room.localParticipant.setMicrophoneEnabled(micOn); say(''); }
    catch { micOn = false; say('Your microphone is blocked. Allow it in your browser to talk.'); }
    showState();
  });
  window.addEventListener('pagehide', () => stop());
  showState();

  return { join, stop, get on() { return !!room; } };
}

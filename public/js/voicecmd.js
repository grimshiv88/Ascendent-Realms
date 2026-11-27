// Voice commands: switch them on (the 🗣 button above the chat button, or its key, 8) and the game listens
// to your microphone. Say your pet's name and an order ("Ignis, attack that wolf", "Dragon, come
// back") and it does it; say a skill's or a spell's name ("Fireball!") and it is used. What counts
// is worked out in data/voicecmd.mjs: in a party only orders that start with your pet's name, or a
// skill or spell name said on its own, count, so talking with your friends sets nothing off.
// The listening is the browser's own speech recognition (best in Chrome and Edge; Safari has it
// too; Firefox does not). It is separate from voice chat: it works without joining it, at any age,
// and what you say for a command is never sent to other players.
import { parseCommand, cleanPetName, ORDER_HELP, KIND_WORDS, PET_NAME_MAX } from './data/voicecmd.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const ON_KEY = 'ar.voicecmd.on';
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;
export const voiceCommandsSupported = () => !!Recognition;
// Inside the claude.ai preview page the browser's own listening is blocked, so the page's
// dictation (claude.use('dictation'), when the page is allowed it) is used instead.
let dictation = null;
if (typeof window !== 'undefined' && window.claude?.use) window.claude.use('dictation').then((d) => { dictation = d; }).catch(() => {});

// hooks: { say(text, kind), inParty(): Promise<bool>, pet(): { kind, item, name } | null,
//          petName(item): string | null, setPetName(item, name), order(order, what): string | null,
//          skills(): [{ id, name }], spells(): [{ id, name }], useSkill(id), castSpell(id), onOpen() }
export function createVoiceCommands(root, hooks) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vc-toggle';
  btn.title = 'Voice commands: say your pet\'s name and an order, or a skill or spell name';
  btn.setAttribute('aria-label', 'Voice commands');
  btn.textContent = '🗣';
  const panel = document.createElement('div');
  panel.className = 'vc-panel';
  panel.hidden = true;
  root.append(btn, panel);

  const canListen = () => !!(dictation || Recognition);
  let dictOff = null; // (unsubscribes from the dictation events)
  let on = false, rec = null, party = false, partyAt = 0, heard = '', did = '', restartT = null, failed = 0;

  function petLine() {
    const p = hooks.pet();
    if (!p) return '<p class="vc-hint">You have no dragon or mount with you right now. Once you do, you can give it a name here.</p>';
    const name = hooks.petName(p.item) || '';
    return `<label class="vc-name">Your ${esc(p.name.toLowerCase())}'s name
      <input type="text" maxlength="${PET_NAME_MAX}" value="${esc(name)}" placeholder="${esc(p.name.split(' ').pop())}" data-item="${esc(p.item || '')}" autocomplete="off" spellcheck="false">
      <button type="button" data-act="name">Save</button></label>
      <p class="vc-hint">It also answers to "${esc(p.name.split(' ').pop().toLowerCase())}".</p>`;
  }
  function draw() {
    const help = Object.entries(ORDER_HELP).map(([k, v]) => `<li><b>${k === 'back' ? 'come back' : k}</b>: ${esc(v)}</li>`).join('');
    panel.innerHTML = `
      <div class="vc-head"><b>Voice commands</b><button type="button" data-act="close" aria-label="Close">✕</button></div>
      ${canListen() ? `<button type="button" class="vc-switch" data-act="switch" aria-pressed="${on}">${on ? 'Listening: on' : 'Listening: off'}</button>` : '<p class="vc-hint">This browser can\'t listen for commands. Use Chrome or Edge (or Safari).</p>'}
      <p class="vc-mode">${party ? 'In a party: say your pet\'s name first ("Ignis, attack"), and a skill or spell name on its own.' : 'On your own: "attack", "come back", or any skill or spell name works.'}</p>
      ${heard ? `<p class="vc-heard">Heard: “${esc(heard)}”${did ? ` <span>→ ${esc(did)}</span>` : ''}</p>` : ''}
      ${petLine()}
      <ul class="vc-help">${help}</ul>
      <p class="vc-hint">Say a pet's order after its name: "Dragon, breathe fire", "Ignis, attack the wolf", "Ignis, stay". Skills and spells: just say the name. Spells are cast from the staff in your hand.</p>`;
  }
  function show(v) {
    btn.classList.toggle('on', on);
    btn.classList.toggle('live', on && !!rec);
    if (v !== undefined) panel.hidden = !v;
    if (!panel.hidden) draw();
  }

  async function checkParty() {
    if (Date.now() - partyAt < 20000) return;
    partyAt = Date.now();
    try { party = !!(await hooks.inParty()); } catch { /* keep the last answer */ }
  }

  function act(text) {
    const cmd = parseCommand(text, {
      party,
      petNames: petNames(),
      skills: hooks.skills(),
      spells: hooks.spells(),
    });
    heard = text.trim();
    did = '';
    if (!cmd) { if (!panel.hidden) draw(); return; }
    if (cmd.kind === 'pet') {
      const line = hooks.order(cmd.order, cmd.what);
      if (line) hooks.say(line, 'note');
      did = `pet: ${cmd.order}${cmd.what ? ` ${cmd.what}` : ''}`;
    } else if (cmd.kind === 'skill') { hooks.useSkill(cmd.id); did = cmd.name; }
    else if (cmd.kind === 'spell') { hooks.castSpell(cmd.id); did = cmd.name; }
    if (!panel.hidden) draw();
  }
  // the names your pet answers to: the one you gave it and what it is ("dragon")
  function petNames() {
    const p = hooks.pet();
    if (!p) return KIND_WORDS;
    const own = hooks.petName(p.item);
    const kind = p.name.split(' ').pop().toLowerCase();
    return [own, kind, ...KIND_WORDS].filter(Boolean);
  }

  // the page's dictation (in the preview): call from a click or key press, before any await
  function startDictation() {
    const d = dictation;
    if (!dictOff) {
      const offs = [
        d.onFinal(({ text }) => { if (text.trim()) { act(text); checkParty(); } }),
        d.onState(({ state, reason }) => {
          rec = state === 'idle' ? null : d;
          if (state === 'idle' && on) {
            if (reason === 'not_granted' || reason === 'unavailable') { hooks.say('Voice commands need your microphone. Allow dictation for this page, then switch them on again', 'hurt'); stop(true); }
            else if (reason === 'viewer_stopped' || reason === 'time_limit') stop(true);
            else waitForClick(); // (hidden, a hiccup: listen again at the next click)
          }
          show();
        }),
      ];
      dictOff = () => offs.forEach((f) => f());
    }
    rec = d;
    d.start().catch((e) => { if (e?.code === 'not_granted' || e?.code === 'unavailable') { hooks.say('Voice commands need your microphone. Allow dictation for this page, then switch them on again', 'hurt'); stop(true); } });
    show();
  }
  function waitForClick() {
    const again = () => { window.removeEventListener('pointerdown', again, true); if (on && !rec) startDictation(); };
    window.addEventListener('pointerdown', again, true);
  }
  function start() {
    if (dictation) { startDictation(); return; }
    if (!Recognition || rec) return;
    const r = new Recognition();
    r.lang = navigator.language || 'en-US';
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      failed = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) act(e.results[i][0].transcript);
      checkParty();
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        hooks.say('Voice commands need your microphone. Allow it for this site in your browser, then switch them on again', 'hurt');
        stop(true);
      } else if (e.error === 'network') { failed++; }
    };
    // the browser stops listening after a while of quiet; it starts again while commands are on
    r.onend = () => {
      rec = null;
      if (!on) { show(); return; }
      if (failed > 4) { hooks.say('Voice commands stopped: the browser\'s speech service could not be reached', 'hurt'); stop(true); return; }
      clearTimeout(restartT);
      restartT = setTimeout(start, failed ? 1500 : 250);
      show();
    };
    try { r.start(); rec = r; } catch { rec = null; }
    show();
  }
  function stop(quiet = false) {
    on = false;
    clearTimeout(restartT);
    const r = rec; rec = null;
    if (r && r === dictation) r.stop().catch(() => {});
    else try { r?.stop(); } catch { /* already stopped */ }
    try { localStorage.setItem(ON_KEY, '0'); } catch { /* private window */ }
    if (!quiet) hooks.say('Voice commands off', 'note');
    show();
  }
  async function toggle() {
    if (!canListen()) { hooks.say('This browser can\'t listen for voice commands. Use Chrome or Edge', 'hurt'); show(true); return; }
    if (on) { stop(); return; }
    on = true; failed = 0;
    try { localStorage.setItem(ON_KEY, '1'); } catch { /* private window */ }
    partyAt = 0;
    if (dictation) start(); // (it must start straight from the click)
    await checkParty();
    if (!dictation) start();
    hooks.say(party ? 'Voice commands on. In a party, say your pet\'s name first, or a skill or spell name on its own' : 'Voice commands on. Say your pet\'s name and an order, or a skill or spell name', 'exp');
  }

  btn.addEventListener('click', () => { const open = panel.hidden; if (open) hooks.onOpen?.(); show(open); });
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'close') show(false);
    if (b.dataset.act === 'switch') toggle();
    if (b.dataset.act === 'name') {
      const input = panel.querySelector('.vc-name input');
      const raw = input.value.trim();
      if (!raw) { hooks.setPetName(input.dataset.item, null); hooks.say('Name cleared', 'note'); draw(); return; }
      const name = cleanPetName(raw);
      if (!name) { hooks.say('Pick a name of 2 to 16 letters, with no bad words', 'hurt'); return; }
      hooks.setPetName(input.dataset.item, name);
      hooks.say(`Your pet is called ${name} now. Say "${name}, come back" to try it`, 'exp');
      draw();
    }
  });
  // typing a name mustn't move you or set off keys
  panel.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.target.matches('input')) panel.querySelector('[data-act="name"]')?.click(); });
  panel.addEventListener('keyup', (e) => e.stopPropagation());

  // left on last time: the browser needs a click or a key before it will listen again
  let want = false;
  try { want = localStorage.getItem(ON_KEY) === '1'; } catch { /* private window */ }
  if (want && canListen()) {
    btn.classList.add('wanted');
    const resume = (e) => { if (e.target?.closest?.('.vc-toggle, .vc-panel')) return; window.removeEventListener('pointerdown', resume, true); btn.classList.remove('wanted'); if (!on) toggle(); };
    window.addEventListener('pointerdown', resume, true);
  }
  return { toggle, get on() { return on; }, hear: act };
}

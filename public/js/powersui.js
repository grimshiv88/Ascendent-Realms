// An admin's powers in the game (given by the owner on the Admin Board, see data/staff.mjs): a small
// crown button on the left, under the voice button, opens switches for each power the account has.
// Which ones are on is remembered in this browser.
import { GAME_POWERS } from './data/staff.mjs';

const STORE = 'ar.powers.on';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } };
const keep = (on) => { try { localStorage.setItem(STORE, JSON.stringify(on)); } catch { /* private window */ } };

export function createPowers(host, have, { apply, say }) {
  const list = GAME_POWERS.filter(([id]) => have.includes(id));
  if (!list.length) return null;
  const saved = load();
  const on = Object.fromEntries(list.map(([id]) => [id, !!saved[id]]));
  host.insertAdjacentHTML('beforeend', `
    <button type="button" class="pw-toggle" aria-label="Admin powers" aria-expanded="false" title="Admin powers">👑</button>
    <div class="pw-panel" hidden>
      <div class="pw-head"><b>Admin powers</b><button type="button" class="pw-close ghost" aria-label="Close">✕</button></div>
      ${list.map(([id, name, about]) => `
        <label class="pw-row"><input type="checkbox" data-power="${id}"${on[id] ? ' checked' : ''}><span><b>${name}</b><small>${about}</small></span></label>`).join('')}
    </div>
    <button type="button" class="pw-down" hidden aria-label="Fly down">▼</button>`);
  const $ = (s) => host.querySelector(s);
  const toggle = $('.pw-toggle'), panel = $('.pw-panel'), down = $('.pw-down');
  const setOpen = (v) => { panel.hidden = !v; toggle.setAttribute('aria-expanded', String(v)); };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  $('.pw-close').addEventListener('click', () => setOpen(false));
  function show() {
    toggle.classList.toggle('on', Object.values(on).some(Boolean));
    // on touch screens a Fly down button shows while flying (the Jump button goes up)
    down.hidden = !(on.fly && matchMedia('(pointer: coarse)').matches);
    apply({ ...on });
  }
  panel.addEventListener('change', (e) => {
    const id = e.target.dataset.power;
    if (!id) return;
    on[id] = e.target.checked;
    keep(on);
    show();
    const name = list.find(([p]) => p === id)[1];
    say(`${name}: ${on[id] ? 'on' : 'off'}${id === 'fly' && on.fly ? '. Jump to rise, Ctrl to go down.' : id === 'teleport' && on.teleport ? '. Open the map (M) and tap where to go.' : ''}`);
  });
  const hold = (v) => (e) => { e.preventDefault(); apply({ ...on }, v); };
  down.addEventListener('pointerdown', hold(true));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) down.addEventListener(ev, hold(false));
  show();
  return { on: (id) => !!on[id] };
}

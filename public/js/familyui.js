// The Family window: your age, your spouse (or who you might marry), proposals between players,
// and your children with the school each is to go to (see data/family.mjs)
import { RACES } from './data/game-data.mjs';
import { className, SCHOOLS } from './data/birth.mjs';
import { ageYears, MARRY_AGE, canMarry, msUntilAge } from './data/life.mjs';
import { suitorsFor, WEDDING_FEE, ADOPT_FEE, MAX_CHILDREN, nextChildIn } from './data/family.mjs';
import { gameTime } from './data/clock.mjs';
import { money } from './data/money.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const hours = (ms) => (ms >= 3600000 ? `${Math.ceil(ms / 3600000)} h` : `${Math.ceil(ms / 60000)} min`);
const schoolPick = (attr, value) => `<select ${attr}><option value="">No school yet</option>${Object.entries(SCHOOLS).map(([id, s]) => `<option value="${id}" ${id === value ? 'selected' : ''}>${esc(s.icon)} ${esc(s.name)}</option>`).join('')}</select>`;

export function renderFamily(el, game, { server = null, message = '' } = {}) {
  const c = game.character;
  const age = ageYears(c);
  const sp = c.spouse;
  let marry = '';
  if (sp) {
    marry = `<p>Married to <b>${esc(sp.name)}</b> <small>(${esc(RACES[sp.race]?.name || sp.race)} · ${esc(className(sp.cls))}${sp.npc ? ', of the town' : ', a player'})</small>.</p>`;
  } else if (!canMarry(c)) {
    marry = `<p class="sys-hint">You can marry at ${MARRY_AGE}. That is about ${hours(msUntilAge(c, MARRY_AGE))} of play from now.</p>`;
  } else {
    const suitors = suitorsFor(c, gameTime().day);
    marry = `<p class="sys-hint">Townsfolk of any race who would marry you (new faces each day of the realm). A wedding at the shrine costs ${money(WEDDING_FEE)}.</p>
      <div class="quest-list">${suitors.map((s, i) => `<div class="bounty"><b>${esc(s.name)}</b><span>${esc(RACES[s.race].name)} · ${esc(className(s.cls))} · Lv ${s.level}</span>
        <button type="button" class="gold-button small" data-marry="${i}">Marry</button></div>`).join('')}</div>
      <h3 class="sys-sub">Marry another player</h3>
      <form class="bounty-form" data-propose-form><input name="to" maxlength="24" placeholder="Their username" autocomplete="off" required><button type="submit" class="gold-button small">Ask them</button></form>
      ${server?.sent?.length ? `<p class="sys-hint">Waiting for an answer from: ${server.sent.map(esc).join(', ')}</p>` : ''}`;
  }
  const asks = (server?.proposals || []).filter(() => !sp).map((n) => `<div class="bounty"><b>${esc(n)}</b><span>asks to marry you</span>
    <span><button type="button" class="gold-button small" data-answer="${esc(n)}:1">Yes</button> <button type="button" class="gold-button small" data-answer="${esc(n)}:0">No</button></span></div>`).join('');
  const kids = c.children || [];
  const wait = nextChildIn(c);
  const kidRows = kids.map((k, i) => `<div class="bounty"><b>${esc(k.name)}</b><span>${esc(RACES[k.race]?.name || k.race)} · will go to ${schoolPick(`data-kid-school="${i}"`, k.school)}</span></div>`).join('');
  const full = kids.length >= MAX_CHILDREN;
  el.innerHTML = `
    <div class="system-window quest-window" role="dialog" aria-label="Family">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      <div class="sys-title"><span class="sys-bang">♥</span><h2>Family</h2></div>
      <p class="sys-msg" role="status">${esc(message)}</p>
      <p>You are <b>${Math.floor(age)}</b> years old.</p>
      <h3 class="sys-sub">Marriage</h3>
      ${asks ? `<div class="quest-list">${asks}</div>` : ''}
      ${marry}
      <h3 class="sys-sub">Children</h3>
      <p class="sys-hint">A child takes your race or your spouse's (half and half). At their Ceremony they become your class or your spouse's (a quarter each), or anything at all (the other half). If your death is ever final, you may be <b>reborn as one of your children</b>.</p>
      ${kidRows ? `<div class="quest-list">${kidRows}</div>` : '<p class="sys-hint">No children yet.</p>'}
      ${full ? '<p class="sys-hint">Your house is full.</p>' : `
        <p>School for the new child: ${schoolPick('data-new-school', '')}</p>
        ${sp ? (wait > 0 ? `<p class="sys-hint">Your next child can come in about ${hours(wait)} of play.</p>` : '<button type="button" class="gold-button small" data-have-child>Have a child</button>') : ''}
        <button type="button" class="gold-button small" data-adopt>Ask the Temple for a child · ${money(ADOPT_FEE)}</button>`}
    </div>`;
}

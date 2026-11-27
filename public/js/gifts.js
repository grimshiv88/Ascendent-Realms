// Gifts and pet orders from the realm's keepers (the Admin Board), while you play: no reload needed.
// The chat check every few seconds (GET /api/social) brings what is waiting (see server/gifts.js):
//   - a gift lands in your bag wrapped as a 🎁 Gift, with a pop-up (when it arrives, or when you
//     next come in). Open it from the pop-up or from the bag: what is inside takes its place.
//   - an order for one of your pets: it comes to you, goes home, or is taken away
import * as api from './api.js';
import { ITEMS } from './data/items.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const giftUid = (id) => `gift${id}`;
export const giftIdOf = (uid) => (/^gift\d+$/.test(uid || '') ? Number(uid.slice(4)) : null);

export function createGifts({ game, world, say, onBag }) {
  const c = game.character;
  const shown = new Set();   // gifts whose pop-up this game has shown
  const doing = new Set();   // deliveries being handled right now
  const queue = [];          // pop-ups waiting their turn
  let fullWarned = 0;

  const pop = document.createElement('div');
  pop.className = 'gift-pop';
  pop.hidden = true;
  document.body.append(pop);
  let current = null;
  function close() { pop.hidden = true; current = null; setTimeout(next, 300); }
  function next() {
    if (current || !queue.length) return;
    current = queue.shift();
    current.show();
  }
  pop.addEventListener('click', (e) => {
    if (e.target === pop) { close(); return; }
    const b = e.target.closest('button');
    if (!b || !current) return;
    current.click(b.dataset.do);
  });
  function card(html, opened = false) {
    try { document.exitPointerLock?.(); } catch { /* not locked */ }
    pop.innerHTML = `<div class="gift-card${opened ? ' opened' : ''}" role="dialog" aria-label="A gift">${html}</div>`;
    pop.hidden = false;
  }

  // a gift arrives: "You received a gift!"
  function announce(g) {
    queue.push({
      show() {
        card(`<span class="gift-big">🎁</span><h3>You received a gift!</h3>
          <p class="gift-from">From ${esc(g.from || 'the keepers of the realm')}</p>
          ${g.note ? `<p class="gift-note">${esc(g.note)}</p>` : ''}
          <p class="gift-from">It is waiting in your bag.</p>
          <div class="gift-btns"><button type="button" class="gold-button" data-do="open">Open it now</button><button type="button" class="link-button" data-do="later">Later</button></div>`);
        api.giftAct(g.id, 'seen').catch(() => {});
      },
      click(what) { if (what === 'open') { const id = g.id; current = null; pop.hidden = true; open(giftUid(id)); } else close(); },
    });
    next();
  }

  // unwrap a gift (from the bag, or the pop-up): what is inside takes its place in the bag
  async function open(uid) {
    const id = giftIdOf(uid);
    if (!id || doing.has(id)) return;
    doing.add(id);
    try {
      const r = await api.giftAct(id, 'open');
      if (game.entry(uid)) game.removeItem(uid, 1);
      const it = ITEMS[r.item];
      if (!r.already && it) {
        if (!game.addItem(r.item, r.n || 1)) say?.('Your bag is full: the gift is on the ground at your feet… make room and ask the keepers to send it again.');
      }
      game.touch('bag');
      onBag?.();
      queue.unshift({
        show() {
          card(`<span class="gift-big">${esc(it?.icon || '🎁')}</span><h3>${r.already ? 'This gift was opened already' : `${esc(it?.name || r.item)}${r.n > 1 ? ` ×${r.n}` : ''}!`}</h3>
            ${r.already ? '' : `<p class="gift-from">${esc(it?.text || '')}</p>`}
            ${r.note ? `<p class="gift-note">${esc(r.note)}</p>` : ''}
            <p class="gift-from">From ${esc(r.from || 'the keepers of the realm')}</p>
            <div class="gift-btns">${!r.already && it?.kind === 'mount' ? '<button type="button" class="gold-button" data-do="call">Call it to you</button>' : ''}<button type="button" class="${!r.already && it?.kind === 'mount' ? 'link-button' : 'gold-button'}" data-do="ok">Thank you!</button></div>`, true);
        },
        click(what) { if (what === 'call') world()?.callMount(r.item); close(); },
      });
      current = null;
      next();
    } catch (err) { say?.(err.message); } finally { doing.delete(id); }
  }

  // an order for one of your pets (see riding.js): carried out, then the server is told
  function petOrder(o) {
    if (doing.has(o.id)) return;
    const w = world();
    if (!w) return;
    const name = ITEMS[o.item]?.name?.replace(/^(Riding|Tamed) /, '').toLowerCase() || 'pet';
    let done = true;
    if (o.action === 'call') {
      if (game.has(o.item)) { if (w.petCome(o.item) === 'riding') {} else say?.(`The keepers of the realm send your ${name} to you`); }
    } else if (o.action === 'home') {
      const r = w.petHome(o.item);
      if (r === 'flying') done = false; // (it waits until you land)
      else if (r === 'ok') say?.(`The keepers of the realm sent your ${name} home. Call it when you need it`);
    } else if (o.action === 'take') {
      if (w.petFlying(o.item)) done = false;
      else if (game.has(o.item)) {
        w.petHome(o.item);
        game.removeItem(o.item, 1);
        game.touch('bag');
        onBag?.();
        say?.(`The keepers of the realm have taken your ${name}`);
      }
    }
    if (!done) return;
    doing.add(o.id);
    api.giftAct(o.id, 'done').catch(() => {}).finally(() => setTimeout(() => doing.delete(o.id), 10000));
  }

  // what the server says is waiting (every few seconds)
  function take(list) {
    if (!Array.isArray(list)) return;
    const gifts = list.filter((d) => d.kind === 'gift');
    let changed = false;
    for (const g of gifts) {
      const uid = giftUid(g.id);
      if (!c.inventory.some((s) => s.uid === uid) && !doing.has(g.id)) {
        if (game.bagFull()) {
          if (Date.now() - fullWarned > 60000) { fullWarned = Date.now(); say?.('A gift is waiting for you, but your bag is full! Make room for it'); }
          continue;
        }
        c.inventory.push({ id: 'gift_box', n: 1, uid });
        changed = true;
      }
      if (!g.seen && !shown.has(g.id)) { shown.add(g.id); announce(g); }
    }
    // a gift the keepers took back before it was opened
    const waiting = new Set(gifts.map((g) => giftUid(g.id)));
    for (const s of [...c.inventory]) if (s.id === 'gift_box' && !waiting.has(s.uid) && !doing.has(giftIdOf(s.uid))) { game.removeItem(s.uid, s.n); changed = true; }
    if (changed) { game.touch('bag'); onBag?.(); }
    for (const o of list) if (o.kind === 'pet') petOrder(o);
  }

  return { take, open, dispose() { pop.remove(); } };
}

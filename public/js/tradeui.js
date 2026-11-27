// The Trade window: ask a player standing close by to trade, put items and coins on the table,
// and confirm. The trade happens only when both have confirmed the same offers (data/trade.mjs).
// A request to trade shows as a small card with Trade / No buttons, wherever you are.
import * as T from './data/trade.mjs';
import { ITEMS } from './data/items.mjs';
import { money, moneyWords } from './data/money.mjs';
import { fillIcons } from './characters/icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const itemName = (id) => ITEMS[id]?.name || id;
const pic = (id, plus = 0) => `<span class="trade-pic"><img class="item-pic" data-icon="${esc(id)}" data-plus="${plus}" alt=""><span class="bag-icon">${ITEMS[id]?.icon || '?'}</span></span>`;
const words = (o) => T.offerWords(o, itemName, moneyWords);
const keyOf = (it) => it.uid || it.id;

// `ctx`: { game, api, root, isOpen(), open(), redraw(), say(text), nearby() -> [{ name, dist }], onTraded() }
export function createTrade(ctx) {
  const { game, api } = ctx;
  let view = { trade: null, asks: [], finished: [] };
  let msg = '', bad = false, busy = false, typed = '';
  let seenAsks = new Set(), lastTrade = null, alive = true, timer = null, shown = '';

  // ---------- the card for a request to trade ----------
  const card = document.createElement('div');
  card.id = 'trade-ask';
  card.hidden = true;
  card.setAttribute('role', 'alert');
  ctx.root.append(card);
  function drawCard() {
    const a = view.asks[0];
    card.hidden = !a;
    if (!a) return;
    card.innerHTML = `<p><b>${esc(a.from)}</b> wants to trade with you.</p>
      <div><button type="button" class="sys-button" data-trade-yes="${esc(a.id)}">Trade</button><button type="button" class="sys-button ghost" data-trade-no="${esc(a.id)}">No</button></div>`;
  }
  card.addEventListener('click', (e) => {
    const yes = e.target.closest('[data-trade-yes]')?.dataset.tradeYes, no = e.target.closest('[data-trade-no]')?.dataset.tradeNo;
    if (yes) run({ action: 'answer', id: yes, accept: true }).then((r) => { if (r) ctx.open(); });
    else if (no) run({ action: 'answer', id: no, accept: false });
  });

  // ---------- what the server says ----------
  async function take(v) {
    if (!v) return;
    const before = lastTrade;
    view = { trade: v.trade || null, asks: v.asks || [], finished: v.finished || [] };
    // finished trades: what you gave leaves your bag, what you got comes in (once only)
    for (const f of view.finished) {
      if (game.takeTrade(f.id, f.give, f.get)) {
        ctx.say(`Trade with ${f.with} done. You got ${words(f.get)}.`);
        msg = `Done! You gave ${words(f.give)} and got ${words(f.get)}.`; bad = false;
        await Promise.resolve(game.saveNow()).catch(() => {});
        ctx.onTraded?.();
      }
      api.tradeAct({ action: 'taken', id: f.id }).catch(() => {});
    }
    // new requests to trade
    for (const a of view.asks) if (!seenAsks.has(a.id)) { seenAsks.add(a.id); ctx.say(`${a.from} wants to trade with you.`); }
    // the other player agreed, or called it off
    const now = view.trade;
    if (before && now && before.id === now.id && before.state === 'asked' && now.state === 'open' && now.asker) { ctx.say(`${now.with} agreed to trade.`); if (!ctx.isOpen()) ctx.open(); }
    if (before && !now && !view.finished.some((f) => f.id === before.id) && !before.endedByMe) { msg = before.state === 'asked' ? `${before.with} didn't take up your offer to trade.` : `${before.with} called off the trade.`; bad = true; if (before.state === 'open') ctx.say(msg); }
    if (now && before && before.id === now.id && before.v !== now.v && now.state === 'open') { msg = `${now.with} changed the offer: confirm again if you are happy.`; bad = false; }
    lastTrade = now ? { ...now } : null;
    drawCard();
    // (redrawn only when something changed, so a box you are typing in isn't wiped by each check)
    const sig = JSON.stringify([view, msg, bad, ctx.isOpen() ? ctx.nearby().map((p) => [p.name, Math.round(p.dist)]) : 0]);
    if (ctx.isOpen() && sig !== shown) { shown = sig; ctx.redraw(); }
  }
  async function run(body) {
    if (busy) return null;
    busy = true; if (ctx.isOpen()) ctx.redraw();
    try {
      // the server checks your latest save (what you have, and where you stand)
      await Promise.resolve(game.saveNow()).catch(() => {});
      await ctx.beforeAct?.();
      const r = await api.tradeAct(body);
      if (body.action === 'cancel' && lastTrade) lastTrade.endedByMe = true;
      msg = r.done ? '' : body.action === 'ask' ? `Asked ${body.name}. Waiting for them to answer...` : ''; bad = false;
      busy = false;
      await take(r);
      return r;
    } catch (err) {
      msg = err.message; bad = true;
      busy = false;
      if (ctx.isOpen()) ctx.redraw();
      return null;
    }
  }
  async function poll() {
    if (!alive) return;
    clearTimeout(timer);
    try { if (!busy) await take(await api.tradeView()); } catch { /* try again shortly */ }
    timer = setTimeout(poll, view.trade || ctx.isOpen() ? T.POLL_OPEN_MS : T.POLL_MS);
  }
  setTimeout(poll, 1500);

  // ---------- your offer ----------
  const mine = () => view.trade?.mine || { items: [], coins: 0 };
  function offerWith(change) {
    const o = { items: mine().items.map((it) => ({ ...it })), coins: mine().coins };
    change(o);
    o.items = o.items.filter((it) => it.n > 0);
    return run({ action: 'offer', id: view.trade.id, offer: o });
  }
  function put(key, all) {
    const e = game.entry(key);
    if (!e) return;
    offerWith((o) => {
      const on = o.items.find((it) => keyOf(it) === key);
      if (e.uid) { if (!on) o.items.push({ ...e, n: 1 }); return; }
      const left = e.n - (on?.n || 0);
      if (left <= 0) return;
      if (on) on.n += all ? left : 1; else o.items.push({ id: e.id, n: all ? left : 1 });
    });
  }
  function takeBack(key, all) {
    offerWith((o) => { const on = o.items.find((it) => keyOf(it) === key); if (on) on.n = all || on.uid ? 0 : on.n - 1; });
  }

  // ---------- the window ----------
  function render(el) {
    shown = JSON.stringify([view, msg, bad, ctx.nearby().map((p) => [p.name, Math.round(p.dist)])]);
    const t = view.trade, c = game.character, dis = busy ? 'disabled' : '';
    let body;
    if (!t) {
      const near = ctx.nearby().filter((p) => p.dist <= T.TRADE_NEAR * 3);
      body = `<p class="sys-hint">Stand next to another player (within ${T.TRADE_NEAR} m) and ask them to trade. You both put items and coins on the table; nothing changes hands until you have both pressed Confirm. If either of you changes the offer, both must confirm again.</p>
        <h3 class="sys-sub">Players near you</h3>
        <div class="estate-list">${near.length ? near.map((p) => `<div class="estate-row"><span><b>${esc(p.name)}</b> <span>·</span> ${Math.round(p.dist)} m away</span>
          <button type="button" class="sys-button" data-trade-ask="${esc(p.name)}" ${dis} ${p.dist > T.TRADE_NEAR ? 'disabled title="Walk closer"' : ''}>Ask to trade</button></div>`).join('') : '<p class="sys-hint">Nobody is close by right now.</p>'}</div>
        <div class="bank-row"><input class="bank-amount" id="trade-name" maxlength="32" placeholder="Or type their username" value="${esc(typed)}"><button type="button" class="sys-button" data-trade-ask-typed ${dis}>Ask to trade</button></div>
        ${view.asks.length ? `<h3 class="sys-sub">Waiting for you</h3><div class="estate-list">${view.asks.map((a) => `<div class="estate-row"><span><b>${esc(a.from)}</b> wants to trade</span><span class="bank-btns"><button type="button" class="sys-button" data-trade-yes="${esc(a.id)}" ${dis}>Trade</button><button type="button" class="sys-button ghost" data-trade-no="${esc(a.id)}" ${dis}>No</button></span></div>`).join('')}</div>` : ''}`;
    } else if (t.state === 'asked') {
      body = t.asker
        ? `<p class="sys-top">Waiting for <b>${esc(t.with)}</b> to answer...</p><p class="sys-hint">The request lapses after a minute.</p>
          <div class="land-actions"><button type="button" class="sys-button ghost" data-trade-cancel ${dis}>Cancel</button></div>`
        : `<p class="sys-top"><b>${esc(t.with)}</b> wants to trade with you.</p>
          <div class="land-actions"><button type="button" class="sys-button" data-trade-yes="${esc(t.id)}" ${dis}>Trade</button><button type="button" class="sys-button ghost" data-trade-no="${esc(t.id)}" ${dis}>No</button></div>`;
    } else {
      const onTable = new Map(t.mine.items.map((it) => [keyOf(it), it.n]));
      const bag = c.inventory.filter((e) => !game.isEquipped(e) && ITEMS[e.id] && e.n - (onTable.get(keyOf(e)) || 0) > 0);
      const row = (it, btns) => `<div class="estate-row trade-item"><span>${pic(it.id, it.plus || 0)} ${esc(itemName(it.id))}${it.plus ? ` +${it.plus}` : ''}${it.n > 1 ? ` <b>×${it.n}</b>` : ''}</span>${btns}</div>`;
      const side = (o, yours) => `${o.items.map((it) => row(it, yours ? `<span class="bank-btns">${!it.uid && it.n > 1 ? `<button type="button" class="sys-button ghost" data-trade-back="${esc(keyOf(it))}" ${dis}>−1</button>` : ''}<button type="button" class="sys-button ghost" data-trade-back="${esc(keyOf(it))}" data-all ${dis}>Take back</button></span>` : '')).join('')}
        ${o.coins ? `<div class="estate-row"><span>🪙 ${money(o.coins)}</span></div>` : ''}${!o.items.length && !o.coins ? '<p class="sys-hint">Nothing yet.</p>' : ''}`;
      const tick = (yes, who) => `<p class="trade-ok${yes ? ' yes' : ''}">${yes ? `✓ ${who} confirmed` : `${who} ${who === 'You' ? 'have' : 'has'} not confirmed`}</p>`;
      body = `<div class="trade-sides">
          <section><h3 class="sys-sub">You give</h3>${side(t.mine, true)}${tick(t.iConfirmed, 'You')}</section>
          <section><h3 class="sys-sub">${esc(t.with)} gives</h3>${side(t.theirs, false)}${tick(t.theyConfirmed, esc(t.with))}</section>
        </div>
        <div class="bank-row"><input class="bank-amount" id="trade-coins" type="number" min="0" step="1" inputmode="numeric" placeholder="Coins to give, in Copper (you have ${c.coins})" value="${t.mine.coins || ''}"><button type="button" class="sys-button" data-trade-coins ${dis}>Put coins</button></div>
        <div class="land-actions"><button type="button" class="sys-button" data-trade-confirm ${dis} ${t.iConfirmed ? 'disabled' : ''}>${t.iConfirmed ? 'Confirmed' : 'Confirm trade'}</button><button type="button" class="sys-button ghost" data-trade-cancel ${dis}>Cancel trade</button></div>
        <h3 class="sys-sub">Your bag <small>(worn gear must be taken off first)</small></h3>
        <div class="estate-list">${bag.map((e) => { const left = e.n - (onTable.get(keyOf(e)) || 0); return row({ ...e, n: left }, `<span class="bank-btns">${e.uid ? `<button type="button" class="sys-button" data-trade-put="${esc(e.uid)}" ${dis}>Offer</button>` : `<button type="button" class="sys-button" data-trade-put="${esc(e.id)}" ${dis}>+1</button>${left > 1 ? `<button type="button" class="sys-button" data-trade-put="${esc(e.id)}" data-all ${dis}>All</button>` : ''}`}</span>`); }).join('') || '<p class="sys-hint">Nothing in your bag to trade.</p>'}</div>`;
    }
    el.innerHTML = `
      <div class="system-window trade-window" role="dialog" aria-label="Trade">
        <button type="button" class="sys-close" data-close aria-label="Close">×</button>
        <div class="sys-title"><span class="sys-bang">!</span><h2>Trade${t ? ` with ${esc(t.with)}` : ''}</h2></div>
        <p class="sys-msg${bad ? ' bad' : ''}" role="status">${esc(msg)}</p>
        ${body}
      </div>`;
    fillIcons(el);
  }

  // a click in the window; true when it was the Trade window's own
  function click(e) {
    const d = (k) => e.target.closest(`[data-${k}]`);
    let b;
    if ((b = d('trade-ask'))) { run({ action: 'ask', name: b.dataset.tradeAsk }); return true; }
    if (d('trade-ask-typed')) { typed = document.getElementById('trade-name')?.value.trim() || ''; if (typed) run({ action: 'ask', name: typed }); return true; }
    if ((b = d('trade-yes'))) { run({ action: 'answer', id: b.dataset.tradeYes, accept: true }); return true; }
    if ((b = d('trade-no'))) { run({ action: 'answer', id: b.dataset.tradeNo, accept: false }); return true; }
    if (d('trade-cancel') && view.trade) { run({ action: 'cancel', id: view.trade.id }).then((r) => { if (r) { msg = 'Trade called off.'; bad = false; ctx.redraw(); } }); return true; }
    if ((b = d('trade-put')) && view.trade) { put(b.dataset.tradePut, b.hasAttribute('data-all')); return true; }
    if ((b = d('trade-back')) && view.trade) { takeBack(b.dataset.tradeBack, b.hasAttribute('data-all')); return true; }
    if (d('trade-coins') && view.trade) {
      const n = Math.max(0, Math.floor(Number(document.getElementById('trade-coins')?.value) || 0));
      if (n > game.character.coins) { msg = `You have only ${moneyWords(game.character.coins)}.`; bad = true; ctx.redraw(); return true; }
      offerWith((o) => { o.coins = n; });
      return true;
    }
    if (d('trade-confirm') && view.trade) {
      run({ action: 'confirm', id: view.trade.id, v: view.trade.v }).then((r) => { if (r && !r.done) { msg = `You confirmed. Waiting for ${view.trade?.with || 'them'}...`; bad = false; ctx.redraw(); } });
      return true;
    }
    return false;
  }

  return {
    render,
    click,
    // from a player's card: ask them to trade
    ask(name) { msg = ''; ctx.open(); return run({ action: 'ask', name }); },
    opened() { msg = view.trade ? msg : ''; poll(); },
    get trading() { return !!view.trade; },
    dispose() { alive = false; clearTimeout(timer); card.remove(); },
  };
}

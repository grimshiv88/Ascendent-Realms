// The Bank window (the counter of the Bank in every great city) and the window of an oil derrick.
// The rules are in data/economy.mjs.
import { CURRENCIES, FOREIGN, rate, buyRate, sellRate, oilPrice, currencyOfCity, coinsWords, loanLimit, LOAN_FEE, LOAN_DAYS, LOAN_MIN,
  COMPANY_FEE, DERRICK_COST, BARREL_MS, TANK, maxDerricks, BANK_NAME } from './data/economy.mjs';
import { money, moneyWords } from './data/money.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const TABS = [['safe', 'Safekeeping'], ['loan', 'Loans'], ['change', 'Money changer'], ['oil', 'Oil']];
const day = (ms) => new Date(ms).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const amountBox = (ph) => `<input class="bank-amount" id="bank-amount" type="number" min="1" step="1" inputmode="numeric" placeholder="${esc(ph)}">`;

// `info` is { bank, oil } from the server (or null while loading); `city` the city you are in
export function renderBank(el, game, { city, info, tab = 'safe', message = '', bad = false, busy = false, wells = [] } = {}) {
  const c = game.character;
  const cur = currencyOfCity(city?.id);
  const now = Date.now();
  const dis = busy ? 'disabled' : '';
  let body = '<p class="sys-hint">The clerk looks up your account...</p>';
  if (info?.bank) {
    const b = info.bank, o = info.oil || {};
    if (tab === 'safe') {
      body = `<p class="sys-hint">Coins left with the Bank are kept safe for you, exactly as they are. The Bank pays no interest and takes no fee: it is a trust, not a trade. Take them out at the Bank of any city.</p>
        <p class="sys-top">With you: <b>${money(c.coins)}</b> <span>·</span> In the Bank: <b>${money(b.deposit)}</b></p>
        <div class="bank-row">${amountBox('Amount in Copper')}
          <button type="button" class="sys-button" data-bank="deposit" ${dis}>Put in</button>
          <button type="button" class="sys-button" data-bank="withdraw" ${dis}>Take out</button></div>
        <p class="sys-hint">1 Silver = 100 Copper, 1 Gold = 100 Silver.</p>`;
    } else if (tab === 'loan') {
      const L = b.loan;
      body = `<p class="sys-hint">A goodwill loan: you pay back exactly what you borrow, never a coin more, however long it takes. The only charge is one small service fee of ${moneyWords(LOAN_FEE)} for the paperwork, the same for any amount. Pay back within ${LOAN_DAYS} days. If you are late it costs nothing extra, but the Bank takes what you owe from your safekeeping, and it will only lend you half as much from then on.</p>
        ${L ? `<p class="sys-top">You owe <b>${money(L.owed)}</b> of the ${money(L.amount)} you borrowed <span>·</span> due ${esc(day(L.due))}${now > L.due ? ' <b class="bad">(late)</b>' : ''}</p>
          <div class="bank-row">${amountBox(`Up to ${L.owed} Copper`)}
            <button type="button" class="sys-button" data-bank="repay" ${dis}>Pay back from my purse</button>
            <button type="button" class="sys-button ghost" data-bank="repay" data-from="bank" ${dis}>From my safekeeping</button></div>
          <p class="sys-hint">Leave the box empty to pay it all.</p>`
        : `<p class="sys-top">The Bank will lend you up to <b>${money(b.limit)}</b> at your level${b.late ? ' (halved: you were late before)' : ''}.</p>
          <div class="bank-row">${amountBox(`${LOAN_MIN} to ${b.limit} Copper`)}<button type="button" class="sys-button" data-bank="borrow" ${dis}>Borrow</button></div>`}`;
    } else if (tab === 'change') {
      const rows = FOREIGN.map((k) => {
        const C = CURRENCIES[k];
        return `<div class="estate-row bank-cur${k === cur ? ' mine' : ''}"><span>${C.icon} <b>${esc(C.name)}</b> <span>·</span> ${esc(C.text)}<br>
          <small>Worth ${rate(k, now)} Copper today <span>·</span> you buy at ${buyRate(k, now)}, sell at ${sellRate(k, now)} <span>·</span> yours: <b>${(b.wallet[k] || 0).toLocaleString()}</b></small></span>
          <span class="bank-btns"><button type="button" class="sys-button" data-bank="buy" data-cur="${k}" ${dis}>Buy</button>
          <button type="button" class="sys-button ghost" data-bank="sell" data-cur="${k}" ${dis} ${b.wallet[k] ? '' : 'disabled'}>Sell</button></span></div>`;
      }).join('');
      body = `<p class="sys-hint">Every land has its own money. The Crown (Copper, Silver and Gold) of the Heartland is taken everywhere; the others go up and down a little through the day. Each city's Bank pays for oil in its own money. Money is changed hand to hand, at today's rate: the Bank earns only the small gap between what it buys and sells at.</p>
        <p class="sys-top">With you: <b>${money(c.coins)}</b></p>
        <div class="bank-row">${amountBox('How many coins')}</div>
        <div class="estate-list">${rows}</div>`;
    } else {
      const each = oilPrice(cur, now);
      const mine = wells.filter((w) => w.mine);
      body = o.company
        ? `<p class="sys-top">Company: <b>${esc(o.company)}</b> <span>·</span> Barrels in store: <b>${o.barrels}</b> <span>·</span> Sold so far: ${o.sold}</p>
          <p class="sys-hint">This Bank buys oil at <b>${cur === 'crown' ? money(Math.floor(each)) : `${each} ${CURRENCIES[cur].plural}`}</b> a barrel today. The price moves through the day, and each city pays in its own money.</p>
          <div class="bank-row">${amountBox(`Barrels (all ${o.barrels})`)}<button type="button" class="sys-button" data-bank="sell_oil" ${dis} ${o.barrels ? '' : 'disabled'}>Sell oil</button></div>
          <h3 class="sys-sub">Your derricks (${mine.length} of ${maxDerricks(c)})</h3>
          <div class="estate-list">${mine.map((w) => `<div class="estate-row"><span>${w.dry ? 'Run dry' : `${w.tank} of ${Math.min(TANK, w.left)} barrels waiting`} <span>·</span> ${w.left.toLocaleString()} left in the pool</span><span>${Math.round(w.x)}, ${Math.round(w.z)}</span></div>`).join('') || '<p class="sys-hint">None yet. Find oil (a black seep, or a test pit that strikes it), then put up a derrick there.</p>'}</div>`
        : `<p class="sys-hint">Oil lies in pools under the ground of every land. Some show as black seeps at the surface; the rest are found by digging test pits with a Shovel (the pit tells you which way oil lies). An Oil Company puts up derricks over the pools, collects the barrels, and sells them at any city's Bank.</p>
          ${c.cls === 'businessman'
            ? `<p class="sys-top">Start an Oil Company for <b>${money(COMPANY_FEE)}</b>. A derrick then costs ${money(DERRICK_COST)} and pumps a barrel every ${BARREL_MS / 60000} minutes (it holds ${TANK}).</p>
              <div class="bank-row"><input class="bank-amount" id="bank-company" maxlength="32" placeholder="Company name"><button type="button" class="sys-button" data-bank="found" ${dis}>Start the company</button></div>`
            : '<p class="sys-top">Only a Businessman can run an Oil Company. Anyone can dig for oil, though.</p>'}`;
    }
  }
  const log = info?.bank?.log?.length ? `<details class="bank-log"><summary>Account history</summary>${info.bank.log.map((l) => `<div>${esc(day(l.at))}: ${esc(l.text)}</div>`).join('')}</details>` : '';
  el.innerHTML = `
    <div class="system-window" role="dialog" aria-label="${esc(BANK_NAME)}">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      <div class="sys-title"><span class="sys-bang">!</span><h2>${esc(BANK_NAME)} · ${esc(city?.name || '')}</h2></div>
      <div class="sys-tabs">${TABS.map(([id, name]) => `<button type="button" class="sys-tab${id === tab ? ' on' : ''}" data-bank-tab="${id}">${name}</button>`).join('')}</div>
      <p class="sys-msg${bad ? ' bad' : ''}" role="status">${esc(message)}</p>
      ${body}
      ${log}
    </div>`;
}

// An oil derrick: yours (collect the barrels, or take it down) or someone else's
export function renderDerrick(el, well, { message = '', bad = false, busy = false } = {}) {
  const w = well;
  const left = w.dry ? 'This pool has run dry.' : `${w.left.toLocaleString()} of ${w.total.toLocaleString()} barrels left in the pool.`;
  el.innerHTML = `
    <div class="system-window" role="dialog" aria-label="Oil derrick">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      <div class="sys-title"><span class="sys-bang">!</span><h2>Oil derrick · ${esc(w.company)}</h2></div>
      <p class="sys-top">${w.mine ? 'Your derrick' : `Run by <b>${esc(w.owner)}</b>`} <span>·</span> ${left}</p>
      ${w.mine ? `<p class="sys-hint">It pumps a barrel every ${BARREL_MS / 60000} minutes and its tank holds ${TANK}. Collect them here, then sell them at any city's Bank.</p>
        <p class="sys-top">In the tank: <b>${w.tank}</b> barrel${w.tank === 1 ? '' : 's'}${w.full ? ' (full: it has stopped pumping)' : ''}</p>
        <p class="sys-msg${bad ? ' bad' : ''}" role="status">${esc(message)}</p>
        <div class="land-actions"><button type="button" class="sys-button" data-oil="collect" ${busy || !w.tank ? 'disabled' : ''}>Collect the barrels</button>
          <button type="button" class="sys-button ghost" data-oil="close" ${busy ? 'disabled' : ''}>Take the derrick down</button></div>`
        : `<p class="sys-msg${bad ? ' bad' : ''}" role="status">${esc(message)}</p>`}
    </div>`;
}

// A pool of oil you are standing over (a seep, or one your test pit struck): who pumps it, or
// put up a derrick of your own
export function renderOilSpot(el, game, d, { info, well, message = '', bad = false, busy = false } = {}) {
  const c = game.character;
  const company = info?.oil?.company;
  let act;
  if (well) act = `<p class="sys-top">${esc(well.company)} already pumps this pool.</p>`;
  else if (company) act = `<p class="sys-top">Put up a derrick of <b>${esc(company)}</b> here for <b>${money(DERRICK_COST)}</b>. You have ${money(c.coins)}.</p>
    <div class="land-actions"><button type="button" class="sys-button" data-oil="drill" ${busy ? 'disabled' : ''}>Put up a derrick</button></div>`;
  else if (c.cls === 'businessman') act = '<p class="sys-top">Start an Oil Company at any city\'s Bank (Oil tab), then come back to put up a derrick.</p>';
  else act = '<p class="sys-top">Only a Businessman\'s Oil Company can pump it. Tell one where it is, or keep it to yourself.</p>';
  el.innerHTML = `
    <div class="system-window" role="dialog" aria-label="Oil">
      <button type="button" class="sys-close" data-close aria-label="Close">×</button>
      <div class="sys-title"><span class="sys-bang">!</span><h2>${d.seep ? 'An oil seep' : 'You struck oil'}</h2></div>
      <p class="sys-hint">A pool of about <b>${d.barrels.toLocaleString()}</b> barrels lies ${d.depth} m down. Its oil sells at any city's Bank.</p>
      <p class="sys-msg${bad ? ' bad' : ''}" role="status">${esc(message)}</p>
      ${act}
    </div>`;
}

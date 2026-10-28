// Friends and chat on screen: a username search with friend requests at the top right, and the
// chat at the bottom left (the general chat, plus a tab for each friend you talk to).
import * as api from './api.js';
import { cleanText, MAX_MESSAGE } from './data/social.mjs';
import { RACES, CLASSES } from './data/game-data.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const POLL_MS = 3000;
const KEEP = 150; // messages kept per tab

export function createSocial(host, { onError } = {}) {
  host.insertAdjacentHTML('beforeend', `
    <div id="social-top">
      <div class="so-search">
        <input type="search" placeholder="Find a player…" aria-label="Find a player by username" maxlength="16" autocomplete="off" spellcheck="false">
        <button type="button" class="so-friends-btn" aria-label="Friends" aria-expanded="false">👥<b class="so-badge" hidden></b></button>
      </div>
      <div class="so-drop" hidden></div>
    </div>
    <div id="chat" class="so-chat">
      <div class="so-tabs" role="tablist"></div>
      <div class="so-log" aria-live="polite"></div>
      <form class="so-form">
        <input type="text" placeholder="Press Enter to chat…" aria-label="Chat message" maxlength="${MAX_MESSAGE}" autocomplete="off">
        <button type="submit">Send</button>
      </form>
    </div>`);
  const $ = (s) => host.querySelector(s);
  const search = $('.so-search input'), drop = $('.so-drop'), friendsBtn = $('.so-friends-btn'), badge = $('.so-badge');
  const tabsEl = $('.so-tabs'), log = $('.so-log'), form = $('.so-form'), input = $('.so-form input');

  const tabs = new Map([['general', []]]); // channel -> messages
  const unread = new Map();
  const seen = new Set(); // messages already shown (by sender, time and text)
  let active = 'general';
  let lastId = 0;
  let lists = { friends: [], received: [], sent: [] };
  let dropMode = null; // 'search' | 'friends' | 'profile'
  let alive = true;

  // ---------- chat ----------
  const time = (at) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  function drawTabs() {
    tabsEl.innerHTML = [...tabs.keys()].map((ch) => `<button type="button" role="tab" data-tab="${esc(ch)}" aria-selected="${ch === active}">${ch === 'general' ? 'General' : esc(ch)}${unread.get(ch) ? ` <b>${unread.get(ch)}</b>` : ''}${ch !== 'general' ? `<span data-close-tab="${esc(ch)}" aria-label="Close">×</span>` : ''}</button>`).join('');
  }
  function drawLog() {
    const list = tabs.get(active) || [];
    log.innerHTML = list.length
      ? list.map((m) => `<p class="${m.mine ? 'me' : ''}"><time>${time(m.at)}</time> <b data-player="${esc(m.from)}">${esc(m.from)}</b> ${esc(cleanText(m.text))}</p>`).join('')
      : `<p class="so-empty">${active === 'general' ? 'Say hello to everyone in the realm.' : `Your private chat with ${esc(active)}.`}</p>`;
    log.scrollTop = log.scrollHeight;
    input.placeholder = active === 'general' ? 'Press Enter to chat…' : `Message ${active}…`;
  }
  function openTab(ch) {
    if (!tabs.has(ch)) tabs.set(ch, []);
    active = ch;
    unread.delete(ch);
    drawTabs(); drawLog();
  }
  function take(messages) {
    let fresh = false;
    for (const m of messages) {
      lastId = Math.max(lastId, m.id);
      const k = `${m.from}|${m.at}|${m.text}`;
      if (seen.has(k) || !m.channel) continue;
      seen.add(k);
      if (!tabs.has(m.channel)) tabs.set(m.channel, []);
      const list = tabs.get(m.channel);
      list.push(m);
      if (list.length > KEEP) list.splice(0, list.length - KEEP);
      if (m.channel !== active && !m.mine) unread.set(m.channel, (unread.get(m.channel) || 0) + 1);
      fresh = true;
    }
    if (fresh) { drawTabs(); drawLog(); }
  }
  function takeLists(r) {
    lists = { friends: r.friends || [], received: r.received || [], sent: r.sent || [] };
    badge.hidden = !lists.received.length;
    badge.textContent = lists.received.length || '';
    if (dropMode === 'friends') drawFriends();
  }
  async function poll() {
    if (!alive) return;
    try {
      const r = await api.socialPoll(lastId);
      take(r.messages || []);
      takeLists(r);
    } catch { /* try again next time */ }
    if (alive) setTimeout(poll, POLL_MS);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) { input.blur(); return; }
    input.value = '';
    try {
      const r = await api.chatSend(text, active === 'general' ? null : active, lastId);
      take(r.messages || []);
      takeLists(r);
    } catch (err) { say(err.message); input.value = text; }
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); input.blur(); } });
  tabsEl.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close-tab]')?.dataset.closeTab;
    if (close) { tabs.delete(close); unread.delete(close); if (active === close) active = 'general'; drawTabs(); drawLog(); return; }
    const t = e.target.closest('[data-tab]')?.dataset.tab;
    if (t) openTab(t);
  });
  log.addEventListener('click', (e) => { const n = e.target.closest('[data-player]')?.dataset.player; if (n) showProfile(n); });
  function say(text) {
    const p = document.createElement('p');
    p.className = 'so-note';
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  // ---------- finding players and friends ----------
  const relText = { friend: '✓ Friends', sent: 'Request sent', received: 'Accept request', none: 'Add friend', self: 'You' };
  function relButton(name, rel) {
    if (rel === 'self') return '';
    if (rel === 'friend') return `<button type="button" data-chat="${esc(name)}">Chat</button>`;
    if (rel === 'sent') return `<button type="button" disabled>Request sent</button>`;
    if (rel === 'received') return `<button type="button" data-accept="${esc(name)}">Accept</button>`;
    return `<button type="button" data-add="${esc(name)}">Add friend</button>`;
  }
  function openDrop(mode, html) {
    dropMode = mode;
    drop.innerHTML = html;
    drop.hidden = false;
    friendsBtn.setAttribute('aria-expanded', String(mode === 'friends'));
  }
  function closeDrop() { dropMode = null; drop.hidden = true; friendsBtn.setAttribute('aria-expanded', 'false'); }

  let searchTimer = 0;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = search.value.trim();
    if (q.length < 2) { if (dropMode === 'search') closeDrop(); return; }
    searchTimer = setTimeout(async () => {
      try {
        const r = await api.playerSearch(q);
        if (search.value.trim() !== q) return;
        openDrop('search', r.players.length
          ? `<ul class="so-list">${r.players.map((p) => `<li><button type="button" class="so-name" data-player="${esc(p.name)}">${p.online ? '<i class="on"></i>' : '<i></i>'}${esc(p.name)}</button>${relButton(p.name, p.relation)}</li>`).join('')}</ul>`
          : `<p class="so-empty">No player called “${esc(q)}…”</p>`);
      } catch (err) { openDrop('search', `<p class="so-empty">${esc(err.message)}</p>`); }
    }, 250);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); search.blur(); closeDrop(); }
    if (e.key === 'Enter') { e.preventDefault(); const q = search.value.trim(); if (q) showProfile(q); }
  });

  function drawFriends() {
    const row = (p, extra) => `<li><button type="button" class="so-name" data-player="${esc(p.name)}">${p.online ? '<i class="on"></i>' : '<i></i>'}${esc(p.name)}</button>${extra}</li>`;
    openDrop('friends', `
      ${lists.received.length ? `<h4>Friend requests</h4><ul class="so-list">${lists.received.map((p) => row(p, `<button type="button" data-accept="${esc(p.name)}">Accept</button><button type="button" class="ghost" data-decline="${esc(p.name)}">No</button>`)).join('')}</ul>` : ''}
      <h4>Friends (${lists.friends.length})</h4>
      ${lists.friends.length ? `<ul class="so-list">${lists.friends.map((p) => row(p, `<button type="button" data-chat="${esc(p.name)}">Chat</button>`)).join('')}</ul>` : '<p class="so-empty">Search a username above to add your first friend.</p>'}
      ${lists.sent.length ? `<h4>Waiting for them</h4><ul class="so-list">${lists.sent.map((p) => row(p, `<button type="button" class="ghost" data-unsend="${esc(p.name)}">Cancel</button>`)).join('')}</ul>` : ''}`);
  }
  friendsBtn.addEventListener('click', () => { if (dropMode === 'friends') closeDrop(); else drawFriends(); });

  async function showProfile(name) {
    try {
      const { player: p } = await api.playerProfile(name);
      const s = p.status;
      const why = p.privacy === 'private' ? 'keeps their Status private' : 'only shows their Status to friends';
      openDrop('profile', `
        <div class="so-profile">
          <h4>${p.online ? '<i class="on"></i>' : '<i></i>'}${esc(p.name)}</h4>
          ${s ? `<dl>
              <dt>Level</dt><dd>${s.level}</dd>
              <dt>Race</dt><dd>${esc(RACES[s.race]?.name || s.race)}</dd>
              <dt>Class</dt><dd>${esc(CLASSES[s.cls]?.name || s.cls)}</dd>
              ${s.stats ? `<dt>Stats</dt><dd>STR ${s.stats.str} · AGI ${s.stats.agi} · DEX ${s.stats.dex} · STA ${s.stats.sta} · INT ${s.stats.int}</dd>` : ''}
            </dl>`
          : `<p class="so-empty">${esc(p.name)} ${why}.</p>`}
          <div class="so-actions">${relButton(p.name, p.relation)}${p.relation === 'friend' ? `<button type="button" class="ghost" data-unfriend="${esc(p.name)}">Remove friend</button>` : ''}</div>
        </div>`);
    } catch (err) { openDrop('profile', `<p class="so-empty">${esc(err.message)}</p>`); }
  }

  async function act(call, then) {
    try { const r = await call(); takeLists(r); then?.(); } catch (err) { say(err.message); }
  }
  drop.addEventListener('click', (e) => {
    const d = (k) => e.target.closest(`[data-${k}]`)?.dataset[k.replace(/-(\w)/g, (_, c) => c.toUpperCase())];
    let n;
    if ((n = d('player'))) return showProfile(n);
    if ((n = d('add'))) return act(() => api.friendRequest(n), () => showProfile(n));
    if ((n = d('accept'))) return act(() => api.friendRespond(n, true), () => (dropMode === 'friends' ? drawFriends() : showProfile(n)));
    if ((n = d('decline'))) return act(() => api.friendRespond(n, false), drawFriends);
    if ((n = d('unsend'))) return act(() => api.friendRemove(n), drawFriends);
    if ((n = d('unfriend'))) return act(() => api.friendRemove(n), () => showProfile(n));
    if ((n = d('chat'))) { closeDrop(); openTab(n); input.focus(); }
  });
  // a click anywhere else closes the drop-down
  const away = (e) => { if (!e.target.closest('#social-top')) closeDrop(); };
  document.addEventListener('pointerdown', away);

  drawTabs(); drawLog();
  poll();

  return {
    // Enter in the world starts typing
    focusChat() { input.focus(); },
    get typing() { return document.activeElement === input || document.activeElement === search; },
    dispose() {
      alive = false;
      document.removeEventListener('pointerdown', away);
      $('#social-top')?.remove(); $('#chat')?.remove();
    },
  };
}

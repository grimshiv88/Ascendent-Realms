// Friends and chat on screen: a username search with friend requests at the top right, and the
// chat in a side panel on the left that hides away behind a small button (General, or Friends with
// a tab for each friend you talk to).
import * as api from './api.js';
import { cleanText, MAX_MESSAGE } from './data/social.mjs';
import { RACES, CLASSES } from './data/game-data.mjs';
import { codeFor, keyName } from './data/controls.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const POLL_MS = 3000;
const KEEP = 150; // messages kept per tab

// `onWorld(r)`: the rest of each check (gifts and pet orders, monster attacks, great beasts brought back)
export function createSocial(host, { onError, onDone, onWorld } = {}) {
  host.insertAdjacentHTML('beforeend', `
    <div id="social-top">
      <div class="so-search">
        <button type="button" class="so-find-btn" aria-label="Find a player" aria-expanded="false">🔍</button>
        <input type="search" placeholder="Find a player…" aria-label="Find a player by username" maxlength="16" autocomplete="off" spellcheck="false">
        <button type="button" class="so-friends-btn" aria-label="Friends" aria-expanded="false">👥<b class="so-badge" hidden></b></button>
      </div>
      <div class="so-drop" hidden></div>
    </div>
    <button type="button" class="so-chat-toggle" aria-label="Open the chat" aria-expanded="false">💬<b class="so-badge" hidden></b></button>
    <div id="chat" class="so-chat">
      <div class="so-modes"><button type="button" data-mode="general" aria-pressed="true">General</button><button type="button" data-mode="friends" aria-pressed="false">Friends<b hidden></b></button><button type="button" class="so-hide" aria-label="Hide the chat">⟨</button></div>
      <div class="so-tabs" role="tablist"></div>
      <div class="so-log" aria-live="polite"></div>
      <form class="so-form">
        <input type="text" placeholder="Press ${esc(keyName(codeFor('chat')))} to chat…" aria-label="Chat message" maxlength="${MAX_MESSAGE}" autocomplete="off">
        <button type="submit">Send</button>
      </form>
    </div>`);
  const $ = (s) => host.querySelector(s);
  const search = $('.so-search input'), drop = $('.so-drop'), friendsBtn = $('.so-friends-btn'), badge = $('.so-badge');
  const tabsEl = $('.so-tabs'), log = $('.so-log'), form = $('.so-form'), input = $('.so-form input');
  const panel = $('#chat'), toggle = $('.so-chat-toggle'), toggleBadge = toggle.querySelector('.so-badge'), modes = $('.so-modes');
  let open = false;
  function setOpen(v) {
    open = v;
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Hide the chat' : 'Open the chat');
    if (open) { unread.delete(active); drawTabs(); }
    else input.blur();
    drawBadges();
  }
  // unread messages show on the button while the chat is hidden, and on the Friends switch
  function drawBadges() {
    const total = [...unread.values()].reduce((a, b) => a + b, 0);
    toggleBadge.hidden = open || !total;
    toggleBadge.textContent = total || '';
    const fr = [...unread].filter(([ch]) => ch !== 'general').reduce((a, [, n]) => a + n, 0);
    const fb = modes.querySelector('[data-mode="friends"] b');
    fb.hidden = !fr; fb.textContent = fr || '';
  }
  toggle.addEventListener('click', () => setOpen(!open));
  modes.addEventListener('click', (e) => {
    if (e.target.closest('.so-hide')) { setOpen(false); return; }
    const m = e.target.closest('[data-mode]')?.dataset.mode;
    if (!m) return;
    if (m === 'general') openTab('general');
    else {
      const ch = [...tabs.keys()].find((k) => k !== 'general');
      if (ch) openTab(ch); else { active = 'friends'; drawTabs(); drawLog(); }
    }
  });

  const tabs = new Map([['general', []]]); // channel -> messages
  const unread = new Map();
  const seen = new Set(); // messages already shown (by sender, time and text)
  let active = 'general';
  let lastId = 0;
  let loaded = false; // the first look has been taken
  let lists = { friends: [], received: [], sent: [] };
  let dropMode = null; // 'search' | 'friends' | 'profile'
  let alive = true;

  // ---------- chat ----------
  const time = (at) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  function drawTabs() {
    const friendsMode = active !== 'general';
    for (const b of modes.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String((b.dataset.mode === 'friends') === friendsMode));
    tabsEl.hidden = !friendsMode;
    tabsEl.innerHTML = [...tabs.keys()].filter((ch) => ch !== 'general').map((ch) => `<button type="button" role="tab" data-tab="${esc(ch)}" aria-selected="${ch === active}">${ch === 'general' ? 'General' : esc(ch)}${unread.get(ch) ? ` <b>${unread.get(ch)}</b>` : ''}${ch !== 'general' ? `<span data-close-tab="${esc(ch)}" aria-label="Close">×</span>` : ''}</button>`).join('');
  }
  function drawLog() {
    drawBadges();
    if (active === 'friends') {
      // no private chat open yet: pick a friend to talk to
      log.innerHTML = lists.friends.length
        ? `<p class="so-empty">Pick a friend to chat with:</p>${lists.friends.map((p) => `<p><button type="button" class="so-name" data-chat-with="${esc(p.name)}">${p.online ? '<i class="on"></i>' : '<i></i>'}${esc(p.name)}</button></p>`).join('')}`
        : '<p class="so-empty">No friends yet. Search a username at the top right to add one.</p>';
      input.placeholder = 'Pick a friend first…';
      return;
    }
    const list = tabs.get(active) || [];
    log.innerHTML = list.length
      ? list.map((m) => `<p class="${m.mine ? 'me' : ''}"><time>${time(m.at)}</time> <b data-player="${esc(m.from)}">${esc(m.from)}</b> ${esc(cleanText(m.text))}</p>`).join('')
      : `<p class="so-empty">${active === 'general' ? 'Say hello to everyone in the realm.' : roomTabs.has(active) ? 'Only the people in it can read this chat.' : `Your private chat with ${esc(active)}.`}</p>`;
    log.scrollTop = log.scrollHeight;
    input.placeholder = active === 'general' ? `Press ${keyName(codeFor('chat'))} to chat…` : `Message ${active}…`;
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
      // the history shown when the game starts isn't counted as new
      if ((m.channel !== active || !open) && !m.mine && loaded) unread.set(m.channel, (unread.get(m.channel) || 0) + 1);
      fresh = true;
    }
    if (fresh) { drawTabs(); drawLog(); }
    drawBadges();
  }
  // private chats of the meeting rooms you're in: a tab while you may be there, gone when the time is up
  let roomTabs = new Set();
  function takeRooms(list) {
    if (!list) return;
    const now = new Set(list);
    let changed = false;
    for (const ch of now) if (!tabs.has(ch)) { tabs.set(ch, []); changed = true; }
    for (const ch of roomTabs) if (!now.has(ch)) { tabs.delete(ch); unread.delete(ch); if (active === ch) active = 'general'; changed = true; }
    roomTabs = now;
    if (changed) { drawTabs(); drawLog(); }
  }
  function takeLists(r) {
    lists = { friends: r.friends || [], received: r.received || [], sent: r.sent || [] };
    badge.hidden = !lists.received.length;
    badge.textContent = lists.received.length || '';
    if (dropMode === 'friends') drawFriends();
  }
  async function poll(once = false) {
    if (!alive) return;
    try {
      const r = await api.socialPoll(lastId);
      take(r.messages || []);
      takeRooms(r.rooms);
      takeLists(r);
      showAnnouncement(r.announcement);
      try { onWorld?.(r); } catch (err) { console.warn(err); }
      loaded = true;
    } catch { /* try again next time */ }
    if (alive && !once) setTimeout(poll, POLL_MS);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) { input.blur(); onDone?.(); return; }
    input.value = '';
    input.blur(); onDone?.(); // sent: back to the game (the mouse turns the camera again)
    try {
      const r = await api.chatSend(text, active === 'general' ? null : active, lastId);
      take(r.messages || []);
      takeLists(r);
    } catch (err) { say(err.message); input.value = text; }
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); input.blur(); onDone?.(); } });
  tabsEl.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close-tab]')?.dataset.closeTab;
    if (close) { tabs.delete(close); unread.delete(close); if (active === close) active = 'friends'; drawTabs(); drawLog(); return; }
    const t = e.target.closest('[data-tab]')?.dataset.tab;
    if (t) openTab(t);
  });
  log.addEventListener('click', (e) => {
    const w = e.target.closest('[data-chat-with]')?.dataset.chatWith;
    if (w) { openTab(w); input.focus(); return; }
    const n = e.target.closest('[data-player]')?.dataset.player; if (n) showProfile(n);
  });
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
  function closeDrop() { dropMode = null; drop.hidden = true; friendsBtn.setAttribute('aria-expanded', 'false'); fold(); }

  // On a phone the search box folds into a 🔍 button (it would cover your status card); a tap opens
  // it across the top of the screen, and it folds away again when you're done with it
  const top = $('#social-top'), findBtn = $('.so-find-btn');
  function unfold(on) { top.classList.toggle('finding', on); findBtn.setAttribute('aria-expanded', String(on)); }
  function fold() { if (document.activeElement !== search && !search.value.trim() && drop.hidden) unfold(false); }
  findBtn.addEventListener('click', () => { if (top.classList.contains('finding')) { search.value = ''; search.blur(); closeDrop(); unfold(false); } else { unfold(true); search.focus(); } });
  search.addEventListener('blur', () => setTimeout(fold, 150));

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

  // A message from the game's owner across the top of the screen (it can be closed)
  let bannerAt = 0;
  let closedAt = 0;
  try { closedAt = Number(localStorage.getItem('ar.announcement-closed')) || 0; } catch { /* blocked */ }
  const banner = document.createElement('div');
  banner.className = 'announce-banner';
  banner.hidden = true;
  banner.innerHTML = '<b>Announcement</b><span></span><button type="button" aria-label="Close">×</button>';
  document.body.append(banner);
  banner.querySelector('button').addEventListener('click', () => {
    banner.hidden = true; closedAt = bannerAt;
    try { localStorage.setItem('ar.announcement-closed', String(bannerAt)); } catch { /* blocked */ }
  });
  function showAnnouncement(a) {
    if (!a || a.at === closedAt) { banner.hidden = true; return; }
    bannerAt = a.at;
    banner.querySelector('span').textContent = a.text;
    banner.hidden = false;
  }

  const REPORT_REASONS = ['Bad words', 'Bullying', 'Cheating', 'Scamming', 'Bad name', 'Other'];
  function showReport(name) {
    openDrop('profile', `
      <form class="so-profile so-report">
        <h4>Report ${esc(name)}</h4>
        <p class="so-empty">Only the game's owner sees reports.</p>
        <select name="reason">${REPORT_REASONS.map((r) => `<option>${r}</option>`).join('')}</select>
        <textarea name="text" maxlength="500" rows="3" placeholder="What happened? (optional)"></textarea>
        <div class="so-actions"><button type="submit">Send report</button><button type="button" class="ghost" data-player="${esc(name)}">Back</button></div>
      </form>`);
    const f = drop.querySelector('.so-report');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.reportPlayer(name, f.reason.value, f.text.value.trim());
        openDrop('profile', `<p class="so-empty">Thank you. Your report about ${esc(name)} was sent.</p>`);
      } catch (err) { say(err.message); }
    });
  }

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
              ${p.cult ? `<dt>Cult</dt><dd>${esc(p.cult.rankName)} of ${esc(p.cult.name)} <small>(only you can see this)</small></dd>` : ''}
              ${s.stats ? `<dt>Stats</dt><dd>STR ${s.stats.str} · AGI ${s.stats.agi} · DEX ${s.stats.dex} · STA ${s.stats.sta} · INT ${s.stats.int}</dd>` : ''}
            </dl>`
          : `<p class="so-empty">${esc(p.name)} ${why}.</p>`}
          <div class="so-actions">${relButton(p.name, p.relation)}${p.relation === 'friend' ? `<button type="button" class="ghost" data-unfriend="${esc(p.name)}">Remove friend</button>` : ''}${p.relation !== 'self' ? `<button type="button" class="ghost" data-report="${esc(p.name)}">Report</button>` : ''}</div>
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
    if ((n = d('report'))) return showReport(n);
    if ((n = d('add'))) return act(() => api.friendRequest(n), () => showProfile(n));
    if ((n = d('accept'))) return act(() => api.friendRespond(n, true), () => (dropMode === 'friends' ? drawFriends() : showProfile(n)));
    if ((n = d('decline'))) return act(() => api.friendRespond(n, false), drawFriends);
    if ((n = d('unsend'))) return act(() => api.friendRemove(n), drawFriends);
    if ((n = d('unfriend'))) return act(() => api.friendRemove(n), () => showProfile(n));
    if ((n = d('chat'))) { closeDrop(); setOpen(true); openTab(n); input.focus(); }
  });
  // a click anywhere else closes the drop-down
  const away = (e) => { if (!e.target.closest('#social-top')) closeDrop(); };
  document.addEventListener('pointerdown', away);

  drawTabs(); drawLog();
  poll();

  return {
    // Enter in the world starts typing
    focusChat() { setOpen(true); if (active === 'friends') openTab('general'); input.focus(); },
    // open a meeting room's private chat
    openRoom(label) { setOpen(true); openTab(label); },
    refresh: () => poll(true),
    get typing() { return document.activeElement === input || document.activeElement === search; },
    dispose() {
      alive = false;
      document.removeEventListener('pointerdown', away);
      $('#social-top')?.remove(); $('#chat')?.remove(); toggle.remove();
    },
  };
}

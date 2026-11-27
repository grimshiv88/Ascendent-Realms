// The Colosseum on screen (rules in data/arena.mjs, the fights kept by server/arena.js):
//   - its board (E at the board outside its city gate): the fights on now to watch, challenging a
//     player, the Weekly Championship and your next fight, a practice bout, and the email choices
//   - a call when someone challenges you (Accept or Turn down)
//   - the summons when a fight of yours is ready: you are taken to the sand
//   - the fight: both fighters' HP across the top, the countdown, the time left, and the result
// It hears about your fights with every "who is near" report (see main.js), quicker while a fight is on.
import { startSpots, colosseumPlace, cupStart, roundAt, CUP, CHECKIN_MS, COUNTDOWN_MS } from './data/arena.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const local = (t) => new Date(t).toLocaleString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' });
const hm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SUMMON_SECS = 10;

export function createArena({ root, overlay, api, world, game, me, say, showArea, openPanel, closePanel, drawPanel, isOpen }) {
  const st = {
    duels: [], watching: null, watch: 0, champion: null, board: null, msg: '', busy: false, skew: 0,
    shown: new Set(), ended: new Set(), later: new Map(), practice: null, preview: false, tab: 'fights',
  };
  const W = () => world();
  const now = () => Date.now() + st.skew;
  const mine = (d) => d && (d.state === 'fighting' || (d.state === 'accepted' && d.mineIn));
  const fight = () => st.duels.find((d) => d.state === 'fighting') || null;

  // ---------- on screen: the call card, and the fight's bars ----------
  const card = document.createElement('div');
  card.className = 'arena-card hidden';
  const hud = document.createElement('div');
  hud.className = 'arena-hud hidden';
  root.append(card, hud);
  let cardFor = null, cardTimer = null;
  function showCard(key, html, auto = null) {
    if (cardFor === key) return;
    clearInterval(cardTimer);
    cardFor = key;
    card.innerHTML = html;
    card.classList.remove('hidden');
    if (auto) {
      let left = auto.secs;
      const tick = () => { const n = card.querySelector('[data-left]'); if (n) n.textContent = String(left); if (left-- <= 0) { clearInterval(cardTimer); auto.go(); } };
      tick();
      cardTimer = setInterval(tick, 1000);
    }
  }
  function hideCard(key = null) {
    if (key && cardFor !== key) return;
    clearInterval(cardTimer);
    cardFor = null;
    card.classList.add('hidden');
  }
  const bar = (name, hp, max, side) => `<div class="arena-side ${side}"><b>${esc(name)}</b><span class="arena-bar"><i style="width:${Math.max(0, Math.min(100, (100 * hp) / Math.max(1, max)))}%"></i></span><small>${Math.max(0, Math.round(hp))} / ${Math.round(max)}</small></div>`;
  function drawHud() {
    const d = fight();
    let html = '';
    if (st.practice) {
      const g = st.practice.handle.hp();
      html = `${bar('You', st.practice.hp, st.practice.max, 'me')}<div class="arena-mid"><b>Practice</b><button type="button" class="link-button" data-arena-stop>Stop</button></div>${bar('Gladiator', g.hp, g.max, 'foe')}`;
    } else if (d?.hp) {
      const t = now();
      const mid = t < d.startAt ? `<b class="arena-count">${Math.ceil((d.startAt - t) / 1000)}</b>` : `<b>${d.kind === 'cup' ? `Round ${d.round + 1}` : 'Duel'}</b><small>${mmss(d.endsAt - t)}</small>`;
      html = `${bar(d.me.name, d.hp.me, d.hp.meMax, 'me')}<div class="arena-mid">${mid}</div>${bar(d.foe.name, d.hp.foe, d.hp.foeMax, 'foe')}`;
    } else if (st.watching && (st.watching.state === 'fighting' || st.watching.state === 'done')) {
      const w = st.watching, t = now();
      const mid = w.state === 'done' ? `<b>${w.winner ? `${esc(w.winner)} wins` : 'A draw'}</b>` : t < w.startAt ? `<b class="arena-count">${Math.ceil((w.startAt - t) / 1000)}</b>` : `<b>Watching</b><small>${mmss(w.endsAt - t)}</small>`;
      html = `${bar(w.a.name, w.a.hp, w.a.max, 'me')}<div class="arena-mid">${mid}<button type="button" class="link-button" data-arena-unwatch>Stop watching</button></div>${bar(w.b.name, w.b.hp, w.b.max, 'foe')}`;
    }
    hud.classList.toggle('hidden', !html);
    if (hud.innerHTML !== html) hud.innerHTML = html;
  }
  setInterval(drawHud, 250);

  // ---------- going to the sand ----------
  function toSand(side) {
    const spot = startSpots(colosseumPlace())[side === 'a' ? 0 : 1];
    return W()?.goTo(spot.x, spot.z, spot.heading);
  }
  async function come(d) {
    hideCard();
    try {
      const r = await api.arenaAct({ act: 'enter', id: d.id });
      take(r);
      toSand(d.side);
      W()?.lockToFloor(true);
      say(`You are on the sand of the Colosseum. ${d.foeIn ? 'Get ready!' : `Waiting for ${d.foe.name}…`}`, 'note');
    } catch (e) { showArea(e.message); }
  }

  // ---------- what the server says (with every "who is near" report) ----------
  let lastFight = null;
  function take(a) {
    if (!a?.duels) return;
    if (a.now) st.skew = a.now - Date.now();
    st.duels = a.duels;
    st.watching = a.watching || (st.watch ? st.watching : null);
    st.champion = a.champion || null;
    const t = now();
    for (const d of st.duels) {
      // someone challenges you
      if (d.incoming && !st.shown.has(`ask${d.id}`)) {
        showCard(`ask${d.id}`, `<p><b>${esc(d.foe.name)}</b> challenges you to a duel in the Colosseum.</p><p class="bag-hint">A Colosseum fight never costs a life. If you accept, you are both called to the sand.</p>
          <div class="arena-buttons"><button type="button" class="gold-button small" data-arena-answer="${d.id}" data-yes="1">Accept</button><button type="button" class="link-button" data-arena-answer="${d.id}">Turn down</button><button type="button" class="link-button" data-arena-later="ask${d.id}">Later</button></div>`);
      }
      // a fight of yours is ready: you are called to the Colosseum
      if (d.state === 'accepted' && !d.mineIn && (st.later.get(d.id) || 0) < Date.now() && !st.practice) {
        const cup = d.kind === 'cup';
        const left = Math.max(0, d.until - t);
        showCard(`call${d.id}`, `<p>${cup ? `<b>Weekly Championship, round ${d.round + 1}:</b> your fight with <b>${esc(d.foe.name)}</b> is now.` : `<b>${esc(d.foe.name)}</b> accepted: your duel is ready.`}</p>
          <p class="bag-hint">${cup ? `Come within ${mmss(left)} or you are out of the championship.` : `You are called to the Colosseum. ${d.foeIn ? `${esc(d.foe.name)} is already on the sand.` : ''}`} Taking you there in <b data-left>${SUMMON_SECS}</b>…</p>
          <div class="arena-buttons"><button type="button" class="gold-button small" data-arena-come="${d.id}">Go now</button>${cup ? '' : `<button type="button" class="link-button" data-arena-later="${d.id}">Not now</button>`}</div>`,
        { secs: SUMMON_SECS, go: () => come(d) });
      }
      // the call to fight, and each blow that lands on you
      if (d.state === 'fighting') {
        if (lastFight?.id !== d.id) {
          W()?.setDuelFoe(() => W()?.otherPlayer(d.foe.id));
          W()?.lockToFloor(true);
          W()?.cheer(true);
          hideCard();
          if (t < d.startAt) setTimeout(() => { say('Fight!', 'exp'); W()?.floatOnMe('Fight!', 'exp'); }, Math.max(0, d.startAt - t));
          lastFight = { id: d.id, hp: d.hp.me };
        }
        if (d.hp.me < lastFight.hp) W()?.floatOnMe(`-${lastFight.hp - d.hp.me}`, 'hurt');
        lastFight.hp = d.hp.me;
      }
      // the end of a fight
      if ((d.state === 'done' || d.state === 'expired') && !st.ended.has(d.id) && (d.mineIn || d.state === 'done' || d.kind === 'cup')) {
        st.ended.add(d.id);
        endFight(d);
      }
    }
    if (lastFight && !st.duels.some((d) => d.id === lastFight.id && d.state === 'fighting')) { lastFight = null; W()?.setDuelFoe(null); W()?.lockToFloor(false); W()?.cheer(false); }
    if (cardFor?.startsWith('call') && !st.duels.some((d) => `call${d.id}` === cardFor && d.state === 'accepted' && !d.mineIn)) hideCard();
    if (cardFor?.startsWith('ask') && !st.duels.some((d) => `ask${d.id}` === cardFor && d.incoming)) hideCard();
    if (isOpen()) drawPanel();
  }
  function endFight(d) {
    W()?.lockToFloor(false);
    W()?.setDuelFoe(null);
    W()?.cheer(false);
    const cup = d.kind === 'cup';
    let text;
    if (d.state === 'expired') text = cup ? (d.mineIn ? `${d.foe.name} never came: you go through to the next round!` : 'You did not come in time: you are out of the championship.') : `${d.foe.name} did not come in time. The duel is off.`;
    else if (d.won === true) text = d.how === 'left' ? `${d.foe.name} left the fight: you win!` : d.how === 'time' ? `Time! You had more HP left: you win against ${d.foe.name}!` : `You beat ${d.foe.name}!`;
    else if (d.won === false) text = d.how === 'left' ? `You left the fight: ${d.foe.name} wins.` : d.how === 'time' ? `Time! ${d.foe.name} had more HP left and wins.` : `${d.foe.name} beat you. No life is lost in the Colosseum.`;
    else text = `Time! You and ${d.foe.name} are even: a draw.`;
    if (cup && d.state === 'done') text += d.won ? ` Your next championship fight is at ${hm(roundAt(cupStart(now()), d.round + 1))}, unless this was the final.` : ' You are out of this week\'s championship.';
    say(text, d.won ? 'exp' : 'note');
    showArea(text);
  }

  // ---------- a practice bout against a Gladiator (no EXP, no loot, no harm done) ----------
  function practice() {
    if (fight() || st.duels.some(mine)) { st.msg = 'Finish your own fight first.'; drawPanel(); return; }
    const w = W();
    if (!w?.colosseum()) { st.msg = 'Walk to the Colosseum first.'; drawPanel(); return; }
    const level = game.character.level || 1, max = game.stats().hp;
    toSand('a');
    w.lockToFloor(true);
    w.cheer(true);
    const p = { hp: max, max };
    p.handle = w.practice(level, {
      onStrike(dmg) { p.hp -= dmg; if (p.hp <= 0) stopPractice('The Gladiator knocks you down. Train and try again!'); },
      onYield() { stopPractice('The Gladiator yields! Well fought.'); },
    });
    if (!p.handle) { w.lockToFloor(false); return; }
    st.practice = p;
    closePanel();
    say('Practice: the Gladiator comes at you!', 'note');
  }
  function stopPractice(text) {
    if (!st.practice) return;
    st.practice.handle.stop();
    st.practice = null;
    W()?.lockToFloor(false);
    W()?.cheer(false);
    if (text) { say(text, 'exp'); showArea(text); }
  }

  // ---------- the board ----------
  async function loadBoard() {
    try {
      const r = await api.arenaBoard();
      st.board = r; st.preview = !!r.preview;
      if (r.duels) take(r);
    } catch (e) { st.msg = e.message; }
    if (isOpen()) drawPanel();
  }
  function cupHtml(cup) {
    if (!cup) return '<p class="bag-hint">Loading…</p>';
    const how = `<p class="bag-hint">Every grown-up player is in it. The draw is made on ${local(cup.drawAt)} and everyone gets an email with the time of their first fight. The fights start on <b>${local(cup.week)}</b> (your time), a round every ${Math.round(cup.roundMs / 60000)} minutes. Whoever is not in the Colosseum within ${Math.round(CHECKIN_MS / 60000)} minutes of their fight's time is out straight away. The last one standing wins the <b>No.1 medal</b> and keeps it until next week's champion takes it.</p>`;
    if (!cup.drawn) return `${how}<p><b>Not drawn yet.</b> The draw is ${local(cup.drawAt)}.</p>`;
    const m = cup.mine;
    let you = '';
    if (m?.champion) you = '<p class="arena-you">🥇 <b>You won this week\'s championship!</b></p>';
    else if (m?.out) you = `<p class="arena-you">You are out of this week's championship${m.how === 'no-show' || m.how === 'nobody' ? ' (you did not come in time)' : ''}.</p>`;
    else if (m?.live && m.foe) you = `<p class="arena-you"><b>Your next fight:</b> round ${m.round + 1}, ${local(m.at)}, against <b>${esc(m.foe)}</b>.</p>`;
    else if (m?.live) you = `<p class="arena-you"><b>Your next fight:</b> round ${m.round + 1}, ${local(m.at)}.</p>`;
    else if (!m) you = '<p class="arena-you">You were not in this week\'s draw (only grown-up characters at the time of the draw are in it).</p>';
    const rounds = cup.rounds.map((round, r) => `<details ${r === cup.rounds.length - 1 ? 'open' : ''}><summary>${r === cup.total - 1 ? 'Final' : `Round ${r + 1}`} · ${hm(cup.week + r * cup.roundMs)}</summary>${round.map((q) => {
      const res = q.winner === undefined ? '' : q.winner ? ` → <b>${esc(q.winner)}</b>${q.how === 'no-show' ? ' (no-show)' : q.how === 'bye' ? '' : ''}` : ' → nobody came';
      return `<div class="arena-match">${esc(q.a || '—')} <span>vs</span> ${q.b ? esc(q.b) : '<i>bye</i>'}${res}${q.duel && q.winner === undefined ? ` <button type="button" class="link-button" data-arena-watch="${q.duel}">Watch</button>` : ''}</div>`;
    }).join('')}</details>`).join('');
    return `${how}${you}<p class="bag-hint">${cup.players} players · ${cup.total} rounds${cup.done ? ` · <b>${cup.champion ? `Champion: ${esc(cup.champion.name)}` : 'No champion this week'}</b>` : ''}</p>${rounds}`;
  }
  function render(el) {
    const b = st.board;
    const meRec = b?.me;
    const tabs = [['fights', 'Fights now'], ['challenge', 'Challenge'], ['cup', 'Championship'], ['practice', 'Practice'], ['mail', 'Emails']];
    let body = '';
    if (st.tab === 'fights') {
      const live = b?.live || [];
      body = st.preview ? '<p class="bag-hint">Fights between players happen on the live game, where other players are. Here in the preview you can try a practice bout.</p>'
        : live.length ? live.map((f) => `<div class="sk-row"><span class="sk-icon">⚔️</span><span class="sk-name"><b>${esc(f.a.name)} vs ${esc(f.b.name)}</b><small>${f.kind === 'cup' ? `Championship round ${f.round + 1}` : 'Duel'} · ${f.state === 'fighting' ? `${f.a.hp}/${f.a.max} HP against ${f.b.hp}/${f.b.max} HP` : 'waiting for the fighters'}</small></span>
          ${f.state === 'fighting' ? `<button type="button" class="gold-button small" data-arena-watch="${f.id}">${st.watch === f.id ? 'Watching' : 'Watch'}</button>` : ''}</div>`).join('')
          : '<p class="bag-hint">No fights on right now. Challenge someone!</p>';
      body += '<p class="bag-hint">Watch from the stands: walk up the stairways on the outside of the great wall, then press E in a row to sit down.</p>';
    } else if (st.tab === 'challenge') {
      const open = st.duels.filter((d) => d.kind === 'friendly' && (d.state === 'asked' || d.state === 'accepted'));
      body = `<form class="arena-form" data-arena-challenge><label>Player's username <input name="name" maxlength="16" autocomplete="off" placeholder="e.g. Aria" required></label><button type="submit" class="gold-button small" ${st.busy || st.preview ? 'disabled' : ''}>Challenge</button></form>
        <p class="bag-hint">They get a call on screen, or an email when they are away (unless they turned those off). A challenge waits a day for an answer. Once accepted, you are both called to the sand. Each fighter has their own full HP for the fight, and nobody loses a life in the Colosseum. A fight lasts at most 3 minutes; then whoever has more of their HP left wins.</p>
        ${open.map((d) => `<div class="sk-row"><span class="sk-icon">📜</span><span class="sk-name"><b>${d.incoming ? `${esc(d.foe.name)} challenged you` : `You challenged ${esc(d.foe.name)}`}</b><small>${d.state === 'asked' ? `waiting for an answer until ${local(d.until)}` : 'accepted: come to the sand'}</small></span>
          ${d.incoming ? `<button type="button" class="gold-button small" data-arena-answer="${d.id}" data-yes="1">Accept</button><button type="button" class="link-button" data-arena-answer="${d.id}">Turn down</button>`
          : d.state === 'asked' ? `<button type="button" class="link-button" data-arena-cancel="${d.id}">Take back</button>` : `<button type="button" class="gold-button small" data-arena-come="${d.id}">Go to the sand</button>`}</div>`).join('')}`;
    } else if (st.tab === 'cup') {
      body = st.preview ? '<p class="bag-hint">The Weekly Championship runs on the live game, between all its players. Here is how it works:</p>' + cupHtml({ drawn: false, drawAt: b?.cup?.drawAt || Date.now(), week: b?.cup?.week || Date.now(), roundMs: CUP.roundMs }) : cupHtml(b?.cup);
    } else if (st.tab === 'practice') {
      body = `<p class="bag-hint">Fight a Gladiator of your own level on the sand, to learn the Colosseum. Its blows only come off your fight HP, never your own HP, and it gives no EXP or loot.</p>
        <button type="button" class="gold-button" data-arena-practice ${st.practice ? 'disabled' : ''}>Practice bout</button>`;
    } else {
      body = `<p class="bag-hint">The game can email you about the Colosseum. On the live game these go to your confirmed email.</p>
        <label class="arena-check"><input type="checkbox" data-arena-mail="duels" ${meRec?.mailDuels !== false ? 'checked' : ''} ${st.preview ? 'disabled' : ''}> Email me when someone challenges me (or accepts my challenge) while I'm away</label>
        <label class="arena-check"><input type="checkbox" data-arena-mail="cup" ${meRec?.mailCup !== false ? 'checked' : ''} ${st.preview ? 'disabled' : ''}> Email me my Weekly Championship fight times</label>`;
    }
    const champ = st.champion || b?.champion;
    el.innerHTML = `
      <div class="status-window skills-window arena-window" role="dialog" aria-label="The Colosseum">
        <button type="button" class="sw-close" data-close aria-label="Close">×</button>
        <h2>The Colosseum</h2>
        <p class="bag-hint">${champ ? `🥇 <b>No.1:</b> ${esc(champ.name)}` : 'No champion yet: the first Weekly Championship will crown one.'}${meRec ? ` · Your record: <b>${meRec.wins}</b> won, <b>${meRec.losses}</b> lost${meRec.cupWins ? `, ${meRec.cupWins} championship${meRec.cupWins > 1 ? 's' : ''}` : ''}` : ''}</p>
        <div class="arena-tabs">${tabs.map(([id, name]) => `<button type="button" class="${st.tab === id ? 'on' : ''}" data-arena-tab="${id}">${name}</button>`).join('')}</div>
        <p class="shop-msg" role="status">${esc(st.msg)}</p>
        ${body}
      </div>`;
  }

  // ---------- buttons ----------
  const act = async (body, ok = '') => {
    st.busy = true; drawPanel();
    try { const r = await api.arenaAct(body); take(r); st.msg = ok || ''; if (body.act === 'mail' && st.board) st.board.me = r.me; } catch (e) { st.msg = e.message; }
    st.busy = false;
    if (isOpen()) drawPanel();
  };
  const onClick = (e) => {
    const t = e.target.closest('[data-arena-tab],[data-arena-answer],[data-arena-cancel],[data-arena-come],[data-arena-later],[data-arena-watch],[data-arena-unwatch],[data-arena-practice],[data-arena-stop]');
    if (!t) return;
    if (t.dataset.arenaTab) { st.tab = t.dataset.arenaTab; st.msg = ''; drawPanel(); return; }
    if (t.dataset.arenaAnswer) { const yes = !!t.dataset.yes; hideCard(`ask${t.dataset.arenaAnswer}`); act({ act: 'answer', id: Number(t.dataset.arenaAnswer), accept: yes }, yes ? 'Accepted. You are both called to the Colosseum.' : 'You turned it down.'); return; }
    if (t.dataset.arenaCancel) { act({ act: 'answer', id: Number(t.dataset.arenaCancel), cancel: true }, 'Challenge taken back.'); return; }
    if (t.dataset.arenaCome) { const d = st.duels.find((q) => q.id === Number(t.dataset.arenaCome)); if (d) { closePanel(); come(d); } return; }
    if (t.dataset.arenaLater) {
      const k = t.dataset.arenaLater;
      if (k.startsWith('ask')) { st.shown.add(k); hideCard(k); showArea('The challenge waits for you at the Colosseum\'s board, under Challenge.'); }
      else { st.later.set(Number(k), Date.now() + 60000); hideCard(); showArea('You will be called again in a minute.'); }
      return;
    }
    if (t.dataset.arenaWatch) {
      const w = W()?.inColosseum();
      if (!w) { st.msg = 'Walk to the Colosseum to watch: it is in the Dump of the Central City, between the south and east roads.'; drawPanel(); return; }
      st.watch = Number(t.dataset.arenaWatch);
      st.msg = 'Watching. Sit in the stands (E in a row) for the best view.';
      drawPanel();
      return;
    }
    if (t.dataset.arenaUnwatch !== undefined) { st.watch = 0; st.watching = null; return; }
    if (t.dataset.arenaPractice !== undefined) { practice(); return; }
    if (t.dataset.arenaStop !== undefined) { stopPractice('You stop the practice bout.'); }
  };
  overlay.addEventListener('click', onClick);
  card.addEventListener('click', onClick);
  hud.addEventListener('click', onClick);
  overlay.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-arena-challenge]')) return;
    e.preventDefault();
    const name = new FormData(e.target).get('name');
    act({ act: 'challenge', name }, `Challenge sent to ${name}.`);
  });
  overlay.addEventListener('change', (e) => {
    const k = e.target.dataset?.arenaMail;
    if (!k) return;
    act({ act: 'mail', [k]: e.target.checked }, 'Saved.');
  });
  // the board, once, to hear of a championship fight coming up
  setTimeout(async () => {
    await loadBoard();
    const m = st.board?.cup?.mine;
    if (m?.live && m.at > Date.now() && m.at - Date.now() < 36 * 3600 * 1000) showArea(`Weekly Championship: your ${m.foe ? `fight with ${m.foe}` : 'first fight'} is ${local(m.at)}. Be in the game then, or you are out.`);
    if (st.champion && st.champion.name === me()?.username) showArea('You hold the No.1 medal of the Colosseum! It shows by your name.');
  }, 4000);

  return {
    take,
    render,
    // where the game should say you are: the fight you are in or watching (others there see you)
    place() {
      const d = st.duels.find(mine);
      if (d) return `arena:${d.id}`;
      if (st.watch && st.watching?.state !== 'expired') return `arena:${st.watch}`;
      return null;
    },
    watchId: () => st.watch || 0,
    // report more often while a fight is on
    fast: () => !!fight() || !!st.watch,
    onWorldEvent(type, data) {
      if (type === 'market' && data === 'colosseum') { st.msg = ''; openPanel('colosseum'); loadBoard(); return true; }
      if (type === 'duel-hit') {
        const d = fight();
        if (!d || now() < d.startAt) return true;
        api.arenaAct({ act: 'hit', id: d.id, mult: data.mult, magic: data.magic }).then((r) => {
          if (r.dmg) {
            const f = W()?.otherPlayer(d.foe.id);
            if (f) W()?.floatAt(`${r.dmg}${r.crit ? '!' : ''}`, f.x, f.y + f.height + 0.2, f.z, r.crit ? 'crit' : 'dmg');
          }
          if (r.duel) { const i = st.duels.findIndex((q) => q.id === r.duel.id); if (i >= 0) st.duels[i] = r.duel; if (r.duel.state === 'done' && !st.ended.has(r.duel.id)) { st.ended.add(r.duel.id); endFight(r.duel); } }
        }).catch(() => {});
        return true;
      }
      if (type === 'colosseum-seat') { showArea('You sit in the stands of the Colosseum. Open its board (outside the city gate) to pick a fight to watch. Press E or move to get up.'); return true; }
      return false;
    },
    // (the countdown also shows in the bars; this is for tests)
    debug: () => ({ ...st, countdown: COUNTDOWN_MS }),
  };
}

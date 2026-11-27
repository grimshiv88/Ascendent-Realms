// On-screen messages ("Torch placed", "Voice commands need your microphone", "Level 12!").
// They used to float up from your head and vanish in about a second, and two at once were drawn on top of each other.
// Now they sit in a stack near the top of the screen, each on its own dark panel, one under the other:
// - at most MAX_SHOWN at once; the rest wait their turn in order, nothing is dropped
// - each stays up long enough to read: longer messages stay longer (READ_MIN to READ_MAX)
// - the same message again does not pile up: the one already showing gets "x2" and its time starts over
// - tap or click a message to close it early
const MAX_SHOWN = 3;
const READ_MIN = 4000, READ_MAX = 10000, PER_CHAR = 60; // ms
const FADE = 400;

export const readTime = (text) => Math.max(READ_MIN, Math.min(READ_MAX, 2500 + String(text).length * PER_CHAR));

export function createNotices(host) {
  const box = document.createElement('div');
  box.className = 'notices';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  host.appendChild(box);
  const shown = []; // { text, kind, el, count, timer }
  const waiting = []; // { text, kind, count }

  function close(n) {
    if (n.closing) return;
    n.closing = true;
    clearTimeout(n.timer);
    n.el.classList.add('out');
    setTimeout(() => {
      n.el.remove();
      shown.splice(shown.indexOf(n), 1);
      next();
    }, FADE);
  }
  function arm(n) {
    clearTimeout(n.timer);
    n.timer = setTimeout(() => close(n), readTime(n.text));
  }
  function label(n) {
    n.el.querySelector('.notice-text').textContent = n.text;
    n.el.querySelector('.notice-count').textContent = n.count > 1 ? `×${n.count}` : '';
  }
  function open(w) {
    const el = document.createElement('div');
    el.className = `notice ${w.kind || 'note'}`;
    el.innerHTML = '<span class="notice-text"></span><span class="notice-count"></span>';
    const n = { ...w, el };
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); close(n); });
    label(n);
    box.appendChild(el);
    shown.push(n);
    arm(n);
  }
  function next() {
    while (shown.filter((n) => !n.closing).length < MAX_SHOWN && waiting.length) open(waiting.shift());
  }
  function say(text, kind = 'note') {
    text = String(text ?? '').trim();
    if (!text) return;
    const same = shown.find((n) => !n.closing && n.text === text);
    if (same) { same.count++; label(same); arm(same); same.el.classList.remove('bump'); void same.el.offsetWidth; same.el.classList.add('bump'); return; }
    const queued = waiting.find((w) => w.text === text);
    if (queued) { queued.count++; return; }
    waiting.push({ text, kind, count: 1 });
    next();
  }
  function clear() {
    waiting.length = 0;
    for (const n of [...shown]) { clearTimeout(n.timer); n.el.remove(); }
    shown.length = 0;
  }
  return { say, clear, el: box };
}

// one stack for the whole page, so a new world (after a portal or a respawn) does not add a second one
let shared = null;
export function sharedNotices(host) {
  if (!shared || !shared.el.isConnected) shared = createNotices(host || document.getElementById('game') || document.body);
  return shared;
}

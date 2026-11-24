// Redraw a piece of the screen from new HTML without throwing its buttons away.
// Setting innerHTML many times a second (the HUD as SP and fatigue tick) replaces every button under
// your finger, so a tap that lands between two redraws is lost and buttons feel slow or dead. This
// keeps the same elements and changes only the text and attributes that differ.
export function setHtml(el, html) {
  if (el.__html === html) return; // nothing changed: nothing to do
  el.__html = html;
  const t = document.createElement('template');
  t.innerHTML = html;
  patch(el, t.content);
}

function patch(into, from) {
  const have = [...into.childNodes], want = [...from.childNodes];
  want.forEach((w, i) => {
    const h = have[i];
    if (!h) { into.appendChild(w); return; }
    if (h.nodeType !== w.nodeType || h.nodeName !== w.nodeName) { into.replaceChild(w, h); return; }
    if (h.nodeType !== 1) { if (h.nodeValue !== w.nodeValue) h.nodeValue = w.nodeValue; return; }
    for (const a of [...h.attributes]) if (!w.hasAttribute(a.name)) h.removeAttribute(a.name);
    for (const a of w.attributes) if (h.getAttribute(a.name) !== a.value) h.setAttribute(a.name, a.value);
    patch(h, w);
  });
  for (let i = have.length - 1; i >= want.length; i--) into.removeChild(have[i]);
}

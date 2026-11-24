// Little flag pictures for the countries players come from (data/countries.mjs). The pictures are
// all in one file (data/flags.json), fetched the first time a flag is shown. Until then a flag is
// an empty frame that fillFlags() fills in.
import { COUNTRIES, countryName } from './data/countries.mjs';

let flags = null, loading = null;
export function loadFlags() {
  loading ??= fetch(new URL('./data/flags.json', import.meta.url)).then((r) => r.json()).then((d) => { flags = d; }).catch(() => { flags = {}; });
  return loading;
}
const attr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// a flag, as HTML (an empty frame until the pictures are loaded: then call fillFlags on its parent)
export function flagHtml(code, cls = 'flag') {
  if (!code || !countryName(code)) return '';
  const alt = `Flag of ${countryName(code)}`;
  return flags?.[code] ? `<img class="${cls}" src="${flags[code]}" alt="${attr(alt)}" title="${attr(countryName(code))}">` : `<img class="${cls}" data-flag="${attr(code)}" alt="${attr(alt)}" title="${attr(countryName(code))}">`;
}
export async function fillFlags(root) {
  if (!root?.querySelector('[data-flag]')) return;
  await loadFlags();
  for (const img of root.querySelectorAll('img[data-flag]')) { const src = flags[img.dataset.flag]; if (src) img.src = src; img.removeAttribute('data-flag'); }
}
// <option>s for a country picker (the first: rather not say)
export function countryOptions(selected = '') {
  return `<option value="">Rather not say</option>${COUNTRIES.map(([code, name]) => `<option value="${code}"${code === selected ? ' selected' : ''}>${attr(name)}</option>`).join('')}`;
}
// a picker with the chosen flag shown beside it
export function wireCountryPicker(select, preview) {
  const show = () => { preview.innerHTML = flagHtml(select.value, 'flag big'); fillFlags(preview); };
  select.addEventListener('change', show);
  show();
}

// Petits outils d'affichage communs à toutes les pages.
export { eur, grams } from './shared/pricing.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num2 = (v) => nf2.format(v || 0);
export const pct = (v) => (v > 0 ? '+' : '') + nf2.format(v) + ' %';
export const gramsNum = (g) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(g);
export const date = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
export const time = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function ago(iso) {
  if (!iso) return 'jamais';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

// Compte à rebours « 12:34 » jusqu'à une date ISO.
export function countdown(iso) {
  const s = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function toast(msg, kind = 'ok') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  box.appendChild(el);
  const life = kind === 'err' ? 6000 : 3800;
  setTimeout(() => el.classList.add('out'), life);
  setTimeout(() => el.remove(), life + 600);
}

// Fenêtre modale simple. Renvoie l'élément de contenu ; close() la ferme.
export function modal(html, { wide = false, onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true">
    <button class="modal-x" aria-label="Fermer">×</button><div class="modal-body">${html}</div></div>`;
  document.body.appendChild(back);
  document.body.classList.add('no-scroll');
  let closed = false;
  const close = (silent) => {
    if (closed) return;
    closed = true;
    back.remove(); document.body.classList.remove('no-scroll'); document.removeEventListener('keydown', onKey);
    if (!silent && onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('.modal-x')) close(); });
  const first = back.querySelector('input, select');
  if (first) setTimeout(() => first.focus(), 30);
  return { el: back.querySelector('.modal-body'), close };
}

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

// Désactive le bouton pendant l'action pour éviter les doubles clics (double achat).
export async function busy(btn, fn) {
  if (!btn || btn.disabled) return;
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('is-busy');
  try { return await fn(); } finally { btn.disabled = false; btn.classList.remove('is-busy'); btn.innerHTML = label; }
}

// Lien WhatsApp vers un numéro (format international, ou français 06… converti).
export function waLink(number, text = '') {
  let n = String(number || '').replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  else if (/^0[1-9]\d{8}$/.test(n)) n = '33' + n.slice(1);
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

// Courbe simple (sparkline) à partir de [[temps, valeur], …].
export function sparkline(points, { w = 320, h = 90, stroke = '#ecd28a', fill = 'rgba(236,210,138,.18)' } = {}) {
  if (!points || points.length < 3) return '';
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x) => ((x - x0) / (x1 - x0 || 1)) * w;
  const sy = (y) => h - 6 - ((y - y0) / (y1 - y0 || 1)) * (h - 12);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d} L${w},${h} L0,${h} Z" fill="${fill}"/><path d="${d}" fill="none" stroke="${stroke}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

// Vagues dorées décoratives (fond de l'accueil et de la carte patrimoine).
export function waves(height = 600) {
  const line = (y, amp, op, cls) => `<path class="${cls}" d="M0 ${y} C 200 ${y - amp}, 400 ${y + amp}, 600 ${y} S 1000 ${y - amp}, 1200 ${y} S 1600 ${y + amp}, 1800 ${y}" stroke="url(#wg)" stroke-width="1.2" fill="none" opacity="${op}"/>`;
  let paths = '';
  for (let i = 0; i < 14; i++) paths += line(height * 0.35 + i * 18, 60 + i * 6, (0.55 - i * 0.03).toFixed(2), i % 2 ? 'wave-a' : 'wave-b');
  return `<div class="waves" aria-hidden="true"><svg viewBox="0 0 1800 ${height}" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="wg" x1="0" x2="1"><stop offset="0" stop-color="#ecd28a" stop-opacity="0"/><stop offset=".4" stop-color="#ecd28a"/><stop offset="1" stop-color="#a87c22" stop-opacity=".2"/></linearGradient></defs>${paths}</svg></div>`;
}

export const FLAG = { fr: '🇫🇷', ch: '🇨🇭', tn: '🇹🇳', de: '🇩🇪', it: '🇮🇹', at: '🇦🇹', be: '🇧🇪', gb: '🇬🇧', za: '🇿🇦', mx: '🇲🇽', ca: '🇨🇦', au: '🇦🇺' };

const s = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  bag: s('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  wallet: s('<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/><path d="M6 6l9-3 1 3"/>'),
  home: s('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  grid: s('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  list: s('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  chart: s('<path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/>'),
  arrow: s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
  minus: s('<path d="M5 12h14"/>'),
  check: s('<path d="M5 12l5 5L20 7"/>'),
  shield: s('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  lock: s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  truck: s('<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
  shop: s('<path d="M4 9l2-5h12l2 5M5 9v11h14V9"/><path d="M10 20v-6h4v6"/>'),
  safe: s('<rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="12" cy="11.5" r="3.5"/><path d="M12 8v1M12 14v1M7 21v-2M17 21v-2"/>'),
  card: s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  euro: s('<path d="M17 6a7 7 0 1 0 0 12"/><path d="M4 10h9M4 14h8"/>'),
  coins: s('<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3"/>'),
  bar: s('<path d="M4 17l3-8h10l3 8z"/><path d="M8 9l1-3h6l1 3"/>'),
  in: s('<path d="M12 4v12M6 10l6 6 6-6"/><path d="M5 20h14"/>'),
  out: s('<path d="M12 20V8M6 14l6-6 6 6"/><path d="M5 4h14"/>'),
  sell: s('<path d="M7 17L17 7M9 7h8v8"/>'),
  buy: s('<path d="M17 7L7 17M15 17H7V9"/>'),
  bell: s('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  activity: s('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  users: s('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 3.5-5 7-5s6 1.5 7 5"/><path d="M16 4a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.4 2.2 4 5"/>'),
  settings: s('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>'),
  logout: s('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
  mail: s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  phone: s('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  info: s('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  alert: s('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'),
  eye: s('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  search: s('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  doc: s('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>'),
  x: s('<path d="M6 6l12 12M18 6L6 18"/>'),
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
};

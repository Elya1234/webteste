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

export function toast(msg, kind = 'ok') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), kind === 'err' ? 6000 : 3500);
  setTimeout(() => el.remove(), kind === 'err' ? 6600 : 4100);
}

// Fenêtre modale simple. Renvoie l'élément de contenu ; close() la ferme.
export function modal(html, { wide = false } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true">
    <button class="modal-x" aria-label="Fermer">×</button><div class="modal-body">${html}</div></div>`;
  document.body.appendChild(back);
  document.body.classList.add('no-scroll');
  const close = () => { back.remove(); document.body.classList.remove('no-scroll'); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.classList.contains('modal-x')) close(); });
  const first = back.querySelector('input, select, button:not(.modal-x)');
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

export const FLAG = { fr: '🇫🇷', ch: '🇨🇭', tn: '🇹🇳', de: '🇩🇪', it: '🇮🇹', at: '🇦🇹', be: '🇧🇪', gb: '🇬🇧', za: '🇿🇦', mx: '🇲🇽', ca: '🇨🇦', au: '🇦🇺' };

export const ICON = {
  cart: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 22h52l-6 26H12z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M20 22 28 8M44 22 36 8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="50" r="11" fill="currentColor"/><path d="M50 44v12M44 50h12" stroke="#1d1b18" stroke-width="3.5" stroke-linecap="round"/></svg>',
  wallet: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="20" width="50" height="36" rx="6" fill="none" stroke="currentColor" stroke-width="4"/><path d="M12 20 40 10l6 10" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><rect x="40" y="32" width="18" height="12" rx="4" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="47" cy="38" r="2.5" fill="currentColor"/><circle cx="40" cy="13" r="9" fill="#1d1b18" stroke="currentColor" stroke-width="3"/><path d="M42.5 9.5c-.8-.8-1.8-1-2.8-1-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2 2.8.8 2.8 2.1-1.2 2-2.8 2c-1.1 0-2.2-.4-2.9-1.2M39.8 6.5v2M39.8 16.6v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="4"/><path d="M14 54c2-12 8-18 18-18s16 6 18 18" fill="none" stroke="currentColor" stroke-width="4"/></svg>',
  truck: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 16h34v28H4zM38 26h12l10 10v8H38z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><circle cx="16" cy="46" r="6" fill="#fff" stroke="currentColor" stroke-width="3.5"/><circle cx="48" cy="46" r="6" fill="#fff" stroke="currentColor" stroke-width="3.5"/></svg>',
  card: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="14" width="52" height="36" rx="5" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M6 24h52" stroke="currentColor" stroke-width="6"/><path d="M14 40h14" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  euro: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M46 16a20 20 0 1 0 0 32" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M10 28h28M10 37h26" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/></svg>',
  shop: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 26 14 10h36l6 16M10 26v28h44V26" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M26 54V38h12v16" fill="none" stroke="currentColor" stroke-width="3.5"/></svg>',
  safe: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="8" width="48" height="44" rx="4" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="32" cy="30" r="10" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M32 20v4M32 36v4M22 30h4M38 30h4M16 52v4M48 52v4" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  piggy: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 30c0-10 9-16 20-16 6 0 11 1 15 4l7-3-2 9c2 2 3 4 4 6h3v10h-5c-2 3-4 5-7 6v6h-8v-4H25v4h-8v-7c-3-3-5-7-5-11z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><circle cx="44" cy="28" r="2.5" fill="currentColor"/></svg>',
  phone: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 6 28 20l-6 6c3 7 9 13 16 16l6-6 14 8-4 12C30 56 8 34 8 10z" fill="currentColor"/></svg>',
  calendar: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="12" width="48" height="44" rx="5" fill="none" stroke="currentColor" stroke-width="4"/><path d="M8 24h48M20 6v12M44 6v12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 34h6M30 34h6M42 34h6M18 44h6M30 44h6" stroke="currentColor" stroke-width="4"/></svg>',
  lock: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="28" width="40" height="30" rx="5" fill="none" stroke="currentColor" stroke-width="4"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="32" cy="42" r="4" fill="currentColor"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 10.5v6M12 7.2v.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m15 15 6 6M7 10h6M10 7v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

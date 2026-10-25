// Suivi de l'activité : ce que fait le client (produits vus, panier, opérations
// commencées) est envoyé au serveur pour que l'administrateur puisse l'aider.
import { post } from './api.js';
import { S } from './store.js';

const VKEY = 'mauriceor-visitor';

export function visitorId() {
  try {
    let v = localStorage.getItem(VKEY);
    if (!v) {
      v = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(VKEY, v);
    }
    return v;
  } catch { return null; }
}

export function track(type, data = {}) {
  // les simples pages vues ne sont envoyées que pour les clients connectés
  if (type === 'page' && !S.me) return;
  post('/api/track', { type, data, visitor: S.me ? undefined : visitorId() }).catch(() => {});
}

// Accès à l'API. Si le serveur Maurice Or répond, on l'utilise ; sinon
// (site ouvert en simple page, ex. GitHub Pages) on bascule en mode démo
// qui fait tourner la même logique dans le navigateur.
let backend = null;
let csrf = null;
export let demo = false;

export async function initApi() {
  try {
    const r = await fetch('/api/health', { headers: { accept: 'application/json' } });
    const j = r.ok ? await r.json() : null;
    if (j && j.ok) {
      backend = serverBackend;
      return;
    }
  } catch { /* pas de serveur */ }
  const { createDemoBackend } = await import('./demo.js');
  backend = await createDemoBackend();
  demo = true;
}

const serverBackend = async (method, path, body) => {
  const headers = { accept: 'application/json' };
  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  let res;
  try {
    res = await fetch(path, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body || {}), credentials: 'same-origin' });
  } catch {
    return { status: 0, data: { error: 'Connexion impossible. Vérifiez votre réseau.' } };
  }
  let data = {};
  try { data = await res.json(); } catch { /* réponse vide */ }
  return { status: res.status, data };
};

export class ApiError extends Error {
  constructor(status, data) { super(data?.error || 'Erreur'); this.status = status; this.data = data; }
}

export async function api(method, path, body) {
  const { status, data } = await backend(method, path, body);
  if (data && data.user && data.user.csrf) csrf = data.user.csrf;
  if (status === 200 && path === '/api/auth/logout') csrf = null;
  if (status >= 400 || status === 0) throw new ApiError(status, data);
  return data;
}

export const get = (p) => api('GET', p);
export const post = (p, b) => api('POST', p, b);
export const put = (p, b) => api('PUT', p, b);

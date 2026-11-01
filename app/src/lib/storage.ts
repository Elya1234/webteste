/* Copie locale (hors connexion, mode privé : on ne plante jamais si le stockage est refusé). */
export function read<T>(k: string): T | null {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
export function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota / mode privé */ }
}

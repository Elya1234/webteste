// Suivi automatique du cours des métaux (source : gold-api.com, gratuit, sans clé).
// Le cours est relevé toutes les 2 minutes ; un historique de 48 h sert à
// calculer la variation sur 24 h.
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.gold-api.com/price';
const INTERVAL = 2 * 60000;
const SAMPLE_EVERY = 10 * 60000;
const KEEP = 48 * 3600000;

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export function startPrices(dataDir, getSettings) {
  const file = path.join(dataDir, 'prices.json');
  let store = { last: null, samples: [] };
  try { store = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* premier démarrage */ }

  function persist() {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store));
    fs.renameSync(tmp, file);
  }

  async function refresh() {
    try {
      const [xauEur, xagEur, xptEur, xauUsd, xauGbp] = await Promise.all([
        getJson(`${API}/XAU/EUR`), getJson(`${API}/XAG/EUR`), getJson(`${API}/XPT/EUR`),
        getJson(`${API}/XAU`), getJson(`${API}/XAU/GBP`),
      ]);
      const eurRate = xauEur.exchangeRate, gbpRate = xauGbp.exchangeRate;
      const usd = { or: xauUsd.price, argent: xagEur.price / eurRate, platine: xptEur.price / eurRate };
      const spot = {
        eur: { or: xauEur.price, argent: xagEur.price, platine: xptEur.price },
        usd,
        gbp: { or: xauGbp.price, argent: usd.argent * gbpRate, platine: usd.platine * gbpRate },
        updatedAt: Date.now(),
        source: 'gold-api.com',
      };
      if (!(spot.eur.or > 0 && spot.eur.argent > 0 && spot.eur.platine > 0)) throw new Error('cours incohérent');
      store.last = spot;
      const lastSample = store.samples[store.samples.length - 1];
      if (!lastSample || spot.updatedAt - lastSample.t >= SAMPLE_EVERY) {
        store.samples.push({ t: spot.updatedAt, or: spot.eur.or });
        store.samples = store.samples.filter((x) => spot.updatedAt - x.t <= KEEP);
      }
      persist();
    } catch (e) {
      console.warn('[cours] mise à jour impossible :', e.message);
    }
  }

  function changePct() {
    if (!store.last || !store.samples.length) return null;
    const target = store.last.updatedAt - 24 * 3600000;
    let ref = store.samples[0];
    for (const s of store.samples) if (Math.abs(s.t - target) < Math.abs(ref.t - target)) ref = s;
    if (store.last.updatedAt - ref.t < 3600000) return null;
    return (store.last.or ?? store.last.eur.or) / ref.or * 100 - 100;
  }

  refresh();
  setInterval(refresh, INTERVAL).unref();

  return function getSpot() {
    const fb = getSettings().fallbackSpot;
    if (fb && (!store.last || Date.now() - store.last.updatedAt > getSettings().staleAfterMin * 60000)) {
      // cours de secours saisi par l'administrateur
      return { eur: fb, usd: { or: fb.or * 1.12 }, gbp: { or: fb.or * 0.84 }, updatedAt: Date.now(), manual: true, changePct: null };
    }
    if (!store.last) return null;
    return { ...store.last, changePct: changePct() };
  };
}

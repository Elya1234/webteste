// Graphique du cours de l'or dessiné par le site lui-même (SVG), à partir des relevés
// automatiques. Il s'affiche partout, même sans service extérieur, et se met à jour
// à chaque nouveau relevé. Toucher ou survoler la courbe affiche le prix à cet instant.
import { S, on } from './store.js';
import { num2 } from './ui.js';
import { OZ } from './shared/catalog.js';

const RANGES = [['24h', '24 h', 24 * 3600000], ['7j', '7 jours', 7 * 86400000]];

export function goldChart(el, { unit = 'g' } = {}) {
  let range = '24h';
  el.innerHTML = `<div class="gchart">
    <div class="gchart-head"><div class="gchart-now"><b data-gc="last">…</b><span data-gc="chg"></span></div>
      <div class="gchart-ranges" role="group" aria-label="Période">${RANGES.map(([k, l]) => `<button type="button" data-range="${k}" aria-pressed="${k === range}">${l}</button>`).join('')}</div></div>
    <div class="gchart-plot"><svg role="img" aria-label="Courbe du cours de l'or"></svg><div class="gchart-tip" hidden></div></div>
    <p class="gchart-empty" hidden>Le graphique se remplit au fil des relevés automatiques du cours.</p>
  </div>`;
  const svg = el.querySelector('svg');
  const tip = el.querySelector('.gchart-tip');
  const plot = el.querySelector('.gchart-plot');
  let pts = [];
  let geom = null;

  const fmtT = (t, long) => new Date(t).toLocaleString('fr-FR', long ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : (range === '24h' ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit' }));
  const value = (oz) => (unit === 'g' ? oz / OZ : oz);
  const suffix = unit === 'g' ? ' €/g' : ' €/once';

  function draw() {
    const hist = (S.prices && S.prices.history) || [];
    const now = Date.now();
    const span = RANGES.find((r) => r[0] === range)[2];
    pts = hist.filter((p) => now - p[0] <= span).map((p) => [p[0], value(p[1])]);
    if (S.prices && S.prices.available) {
      const cur = value(S.prices.oz.or);
      if (!pts.length || pts[pts.length - 1][0] < S.prices.updatedAt) pts.push([S.prices.updatedAt, cur]);
      el.querySelector('[data-gc="last"]').textContent = num2(cur) + suffix;
    }
    const empty = pts.length < 3;
    el.querySelector('.gchart-empty').hidden = !empty;
    if (pts.length >= 2) {
      const first = pts[0][1], last = pts[pts.length - 1][1];
      const c = (last / first - 1) * 100;
      const chg = el.querySelector('[data-gc="chg"]');
      chg.textContent = `${c >= 0 ? '▲ +' : '▼ '}${num2(c)} % sur ${range === '24h' ? '24 h' : '7 jours'}`;
      chg.className = c >= 0 ? 'up' : 'down';
    }
    const W = Math.max(280, plot.clientWidth || 600), H = Math.max(180, plot.clientHeight || 260);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (empty) { svg.innerHTML = ''; geom = null; return; }
    const padL = 8, padR = 62, padT = 14, padB = 26;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = xs[0], x1 = xs[xs.length - 1];
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    const m = (y1 - y0 || y1 * 0.002) * 0.15; y0 -= m; y1 += m;
    const sx = (x) => padL + ((x - x0) / (x1 - x0 || 1)) * (W - padL - padR);
    const sy = (y) => padT + (1 - (y - y0) / (y1 - y0)) * (H - padT - padB);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
    const grid = [0, 0.5, 1].map((f) => {
      const v = y0 + (y1 - y0) * (1 - f) , y = sy(v);
      return `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" class="gc-grid"/><text x="${W - padR + 6}" y="${y + 4}" class="gc-lbl">${num2(v)}</text>`;
    }).join('');
    const times = [x0, (x0 + x1) / 2, x1].map((t, i) => `<text x="${sx(t)}" y="${H - 6}" class="gc-lbl" text-anchor="${['start', 'middle', 'end'][i]}">${fmtT(t)}</text>`).join('');
    const lx = sx(xs[xs.length - 1]), ly = sy(ys[ys.length - 1]);
    svg.innerHTML = `<defs><linearGradient id="gc-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c9a032" stop-opacity=".35"/><stop offset="1" stop-color="#c9a032" stop-opacity="0"/></linearGradient></defs>
      ${grid}<path d="${line}L${sx(x1)},${H - padB}L${sx(x0)},${H - padB}Z" fill="url(#gc-fill)"/>
      <path d="${line}" class="gc-line"/>${times}
      <circle cx="${lx}" cy="${ly}" r="9" class="gc-pulse"/><circle cx="${lx}" cy="${ly}" r="4" class="gc-dot"/>
      <line class="gc-cursor" x1="0" x2="0" y1="${padT}" y2="${H - padB}" visibility="hidden"/><circle class="gc-hover" r="4" visibility="hidden"/>`;
    geom = { sx, sy, W, padL, padR };
  }

  // Affiche le prix au point le plus proche du doigt ou de la souris.
  function hover(clientX) {
    if (!geom) return;
    const r = svg.getBoundingClientRect();
    const x = (clientX - r.left) * (geom.W / r.width);
    let best = pts[0];
    for (const p of pts) if (Math.abs(geom.sx(p[0]) - x) < Math.abs(geom.sx(best[0]) - x)) best = p;
    const cx = geom.sx(best[0]), cy = geom.sy(best[1]);
    const cur = svg.querySelector('.gc-cursor'), dot = svg.querySelector('.gc-hover');
    cur.setAttribute('x1', cx); cur.setAttribute('x2', cx); cur.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<b>${num2(best[1])}${suffix}</b><span>${fmtT(best[0], true)}</span>`;
    const left = (cx / geom.W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 60), r.width - 60)}px`;
  }
  function leave() {
    tip.hidden = true;
    svg.querySelectorAll('.gc-cursor, .gc-hover').forEach((n) => n.setAttribute('visibility', 'hidden'));
  }
  plot.addEventListener('pointermove', (e) => hover(e.clientX));
  plot.addEventListener('pointerdown', (e) => hover(e.clientX));
  plot.addEventListener('pointerleave', leave);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-range]');
    if (!b) return;
    range = b.dataset.range;
    el.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  });
  let rt;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(draw, 150); };
  window.addEventListener('resize', onResize);
  const off = on('prices', draw);
  requestAnimationFrame(draw);
  return () => { off(); window.removeEventListener('resize', onResize); };
}

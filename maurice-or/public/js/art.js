// Illustrations des produits (dessinées en SVG, aucune photo nécessaire).
// Pour mettre de vraies photos : déposer public/img/produits/<id>.jpg
// et le site les utilisera automatiquement (voir productImage dans app.js).
let uid = 0;

const PAL = {
  or: ['#fff6c8', '#f0cd5e', '#c8952a', '#8a5d12'],
  argent: ['#ffffff', '#e3e6ea', '#b4b9c0', '#7b8189'],
  platine: ['#f7f8fa', '#d8dde4', '#a9b1bc', '#737c88'],
};

function grad(id, c) {
  return `<radialGradient id="${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${c[0]}"/><stop offset=".35" stop-color="${c[1]}"/><stop offset=".8" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[3]}"/></radialGradient>`;
}
function lin(id, c, vertical = false) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 1}"><stop offset="0" stop-color="${c[2]}"/><stop offset=".25" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[3]}"/></linearGradient>`;
}

function coinLabel(p) {
  const m = p.name.match(/^(\d+(?:,\d+)?)\s*(Fr|Mark|Pesos)/);
  if (m) return [m[1], { Fr: 'FRANCS', Mark: 'MARK', Pesos: 'PESOS' }[m[2]]];
  if (/Souverain/.test(p.name)) return ['£1', 'SOVEREIGN'];
  if (/Krugerrand/.test(p.name)) return ['1 OZ', 'KRUGERRAND'];
  if (/1\/4/.test(p.name)) return ['¼ OZ', 'FINE ' + (p.metal === 'or' ? 'GOLD' : 'PLAT.')];
  if (/2 Onces/.test(p.name)) return ['2 OZ', 'FINE SILVER'];
  const kind = { or: 'FINE GOLD', argent: 'FINE SILVER', platine: 'PLATINUM' }[p.metal];
  return ['1 OZ', kind];
}

function oneCoin(cx, cy, r, gid, c, label, sub, back) {
  const id = `c${++uid}`;
  const dots = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return `<circle cx="${(cx + Math.cos(a) * (r - 6)).toFixed(1)}" cy="${(cy + Math.sin(a) * (r - 6)).toFixed(1)}" r="1.4" fill="${c[3]}" opacity=".55"/>`;
  }).join('');
  const center = back
    ? `<path d="M${cx - r * 0.32} ${cy + r * 0.25} q${r * 0.12} ${-r * 0.55} ${r * 0.32} ${-r * 0.5} q${r * 0.25} ${r * 0.05} ${r * 0.3} ${r * 0.35} q${-r * 0.05} ${r * 0.2} ${-r * 0.3} ${r * 0.25}z" fill="${c[3]}" opacity=".35"/>
       <path d="M${cx - r * 0.1} ${cy - r * 0.38} q${r * 0.2} ${-r * 0.12} ${r * 0.3} ${r * 0.05}" stroke="${c[3]}" stroke-width="3" fill="none" opacity=".4"/>`
    : `<text x="${cx}" y="${cy + r * 0.1}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="${r * 0.42}" fill="${c[3]}" opacity=".8">${label}</text>
       <text x="${cx}" y="${cy + r * 0.42}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="${r * 0.13}" letter-spacing="1" fill="${c[3]}" opacity=".75">${sub}</text>`;
  return `<g><circle cx="${cx + 3}" cy="${cy + 5}" r="${r}" fill="#000" opacity=".18" filter="url(#${id}b)"/>
    <defs><filter id="${id}b"><feGaussianBlur stdDeviation="4"/></filter></defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gid})" stroke="${c[3]}" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 11}" fill="none" stroke="${c[3]}" stroke-width="1.2" opacity=".55"/>
    ${dots}${center}
    <ellipse cx="${cx - r * 0.35}" cy="${cy - r * 0.45}" rx="${r * 0.35}" ry="${r * 0.14}" fill="#fff" opacity=".35" transform="rotate(-30 ${cx - r * 0.35} ${cy - r * 0.45})"/></g>`;
}

export function coinSvg(p) {
  const c = PAL[p.metal] || PAL.or;
  const g = `g${++uid}`;
  const [label, sub] = coinLabel(p);
  return `<svg viewBox="0 0 240 200" class="art" role="img" aria-label="${p.name}"><defs>${grad(g, c)}</defs>
    ${oneCoin(92, 96, 70, g, c, label, sub, true)}${oneCoin(150, 112, 70, g, c, label, sub, false)}</svg>`;
}

export function barSvg(p) {
  const c = PAL[p.metal] || PAL.or;
  const g = `b${++uid}`;
  const w = p.weight >= 1000 ? `${p.weight / 1000} kg`.replace('.', ',') : Math.abs(p.weight - 31.1035) < 0.01 ? '1 oz' : `${p.weight} g`;
  const kind = p.metal === 'or' ? 'FINE GOLD' : 'FINE SILVER';
  const purity = String(p.purity).replace('.', ',');
  if (p.format === 'barre') {
    return `<svg viewBox="0 0 240 200" class="art" role="img" aria-label="${p.name}"><defs>${lin(g, c)}</defs>
      <ellipse cx="120" cy="160" rx="100" ry="10" fill="#000" opacity=".15"/>
      <path d="M30 150 50 70h140l20 80z" fill="url(#${g})" stroke="${c[3]}"/>
      <path d="M50 70h140l-12 18H62z" fill="${c[0]}" opacity=".45"/>
      <text x="120" y="122" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="15" font-weight="700" fill="${c[3]}" opacity=".8">${kind}</text>
      <text x="120" y="140" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="${c[3]}" opacity=".8">${w} · ${purity}</text></svg>`;
  }
  if (p.weight >= 100) {
    const h = p.weight >= 1000 ? 150 : p.weight >= 250 ? 130 : 110;
    const wd = p.weight >= 1000 ? 74 : p.weight >= 250 ? 70 : 64;
    const x = 120 - wd / 2, y = 100 - h / 2;
    return `<svg viewBox="0 0 240 200" class="art" role="img" aria-label="${p.name}"><defs>${lin(g, c)}</defs>
      <ellipse cx="120" cy="${y + h + 8}" rx="${wd * 0.75}" ry="7" fill="#000" opacity=".15"/>
      <rect x="${x}" y="${y}" width="${wd}" height="${h}" rx="14" fill="url(#${g})" stroke="${c[3]}" stroke-width="1.2"/>
      <rect x="${x + 5}" y="${y + 5}" width="${wd - 10}" height="${h - 10}" rx="11" fill="none" stroke="${c[0]}" opacity=".5"/>
      <circle cx="120" cy="${y + 26}" r="12" fill="none" stroke="${c[3]}" stroke-width="2" opacity=".55"/>
      <text x="120" y="${y + 31}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12" font-weight="700" fill="${c[3]}" opacity=".7">M</text>
      <text x="120" y="${y + h * 0.55}" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" fill="${c[3]}" opacity=".75">${w}</text>
      <text x="120" y="${y + h * 0.55 + 15}" text-anchor="middle" font-family="Georgia, serif" font-size="9" fill="${c[3]}" opacity=".75">${kind}</text>
      <text x="120" y="${y + h * 0.55 + 28}" text-anchor="middle" font-family="Georgia, serif" font-size="10" fill="${c[3]}" opacity=".75">${purity}</text>
      <ellipse cx="${x + wd * 0.3}" cy="${y + h * 0.25}" rx="7" ry="${h * 0.18}" fill="#fff" opacity=".25"/></svg>`;
  }
  // petit lingot frappé dans sa carte certificat
  return `<svg viewBox="0 0 240 200" class="art" role="img" aria-label="${p.name}"><defs>${lin(g, c, true)}
      <linearGradient id="${g}k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22324d"/><stop offset="1" stop-color="#121c2e"/></linearGradient></defs>
    <rect x="68" y="16" width="104" height="170" rx="8" fill="#000" opacity=".15" transform="translate(4 4)"/>
    <rect x="68" y="16" width="104" height="170" rx="8" fill="url(#${g}k)"/>
    <text x="120" y="38" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="10" letter-spacing="2" fill="#d9b55a">CERTIFICAT</text>
    <rect x="94" y="52" width="52" height="84" rx="4" fill="#0b1220" stroke="#d9b55a" stroke-width=".8"/>
    <rect x="99" y="58" width="42" height="72" rx="3" fill="url(#${g})" stroke="${c[3]}" stroke-width=".8"/>
    <text x="120" y="84" text-anchor="middle" font-family="Georgia, serif" font-size="11" font-weight="700" fill="${c[3]}">${w}</text>
    <text x="120" y="98" text-anchor="middle" font-family="Georgia, serif" font-size="6.5" fill="${c[3]}">${kind}</text>
    <text x="120" y="110" text-anchor="middle" font-family="Georgia, serif" font-size="7.5" fill="${c[3]}">${purity}</text>
    <text x="120" y="156" text-anchor="middle" font-family="Georgia, serif" font-size="8" fill="#c8cfdc">${p.name}</text>
    <text x="120" y="170" text-anchor="middle" font-family="Georgia, serif" font-size="6.5" fill="#8d97aa">N° ${String(100000 + p.sort * 7919 % 899999)}</text></svg>`;
}

export function productArt(p) {
  return p.category === 'lingot' ? barSvg(p) : coinSvg(p);
}

export function gramArt() {
  const g = `a${++uid}`;
  const c = PAL.or;
  return `<svg viewBox="0 0 240 200" class="art" role="img" aria-label="Or au gramme"><defs>${lin(g, c)}</defs>
    <path d="M40 150 60 110h50l20 40z" fill="url(#${g})" stroke="${c[3]}"/>
    <path d="M110 150 130 110h50l20 40z" fill="url(#${g})" stroke="${c[3]}"/>
    <path d="M75 108 95 68h50l20 40z" fill="url(#${g})" stroke="${c[3]}"/>
    <text x="120" y="96" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="14" font-weight="700" fill="${c[3]}">1 g</text>
    <text x="120" y="182" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12" letter-spacing="2" fill="${c[3]}">COMPTE POIDS OR</text></svg>`;
}

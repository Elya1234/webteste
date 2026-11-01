// Génère la version statique (HTML + PHP pour les formulaires) du thème Shopify, pour un hébergement Hostinger.
// Usage : DOMAIN=exemple.fr node build.mjs   ->  dist/
import { Liquid } from 'liquidjs';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const T = path.join(ROOT, 'shopify-theme');
const PAGES = path.join(ROOT, 'shopify-pages');
const OUT = path.join(import.meta.dirname, 'dist');
const DOMAIN = process.env.DOMAIN || 'energie-hachem-yazour.fr';
const SITE = 'https://' + DOMAIN;
const U = 'https://images.unsplash.com/photo-';

// ---------- Réglages du thème (valeurs par défaut + réglages enregistrés) ----------
const schema = JSON.parse(fs.readFileSync(path.join(T, 'config/settings_schema.json'), 'utf8'));
const settings = {};
schema.forEach(g => (g.settings || []).forEach(s => { if (s.id) settings[s.id] = s.default ?? ''; }));
Object.assign(settings, JSON.parse(fs.readFileSync(path.join(T, 'config/settings_data.json'), 'utf8')).current);

// ---------- Moteur Liquid avec les filtres/tags Shopify utilisés par le thème ----------
const engine = new Liquid({ root: [path.join(T, 'templates'), path.join(T, 'snippets'), path.join(T, 'layout')], extname: '.liquid' });
engine.registerFilter('asset_url', v => '/assets/' + v);
engine.registerFilter('stylesheet_tag', v => `<link rel="stylesheet" href="${v}">`);
engine.registerFilter('json', v => JSON.stringify(v ?? null));
engine.registerFilter('default_errors', () => '');
engine.registerFilter('default_pagination', () => '');
engine.registerFilter('image_url', (img, ...args) => {
  const w = (args.find(a => Array.isArray(a) && a[0] === 'width') || [])[1] || 1200;
  return String(img.src).replace(/^https:/, '') + `&w=${w}`;
});
engine.registerTag('form', {
  parse(tk, rem) {
    this.attrs = {};
    (tk.args.match(/(\w+)\s*:\s*'([^']*)'/g) || []).forEach(p => { const [, k, v] = p.match(/(\w+)\s*:\s*'([^']*)'/); this.attrs[k] = v; });
    this.tpl = []; const s = this.liquid.parser.parseStream(rem);
    s.on('tag:endform', () => s.stop()).on('template', t => this.tpl.push(t)); s.start();
  },
  *render(ctx, em) {
    const a = this.attrs, back = ctx.getSync(['_path']) || '/';
    const anchor = a.id === 'cb-form' ? '' : 'etude';
    em.write(`<form method="post" action="/envoyer.php" accept-charset="UTF-8"${a.id ? ` id="${a.id}"` : ''}${a.class ? ` class="${a.class}"` : ''}${a.novalidate ? ' novalidate' : ''}>`);
    em.write(`<input type="hidden" name="_retour" value="${back}"><input type="hidden" name="_ancre" value="${anchor}">`);
    ctx.push({ form: { posted_successfully: false, errors: null } });
    yield this.liquid.renderer.renderTemplates(this.tpl, ctx, em);
    ctx.pop(); em.write('</form>');
  }
});
engine.registerTag('paginate', {
  parse(tk, rem) { this.tpl = []; const s = this.liquid.parser.parseStream(rem); s.on('tag:endpaginate', () => s.stop()).on('template', t => this.tpl.push(t)); s.start(); },
  *render(ctx, em) { ctx.push({ paginate: { pages: 1 } }); yield this.liquid.renderer.renderTemplates(this.tpl, ctx, em); ctx.pop(); }
});

// ---------- Contenus ----------
const pagesMeta = JSON.parse(fs.readFileSync(path.join(PAGES, 'pages.json'), 'utf8')).map(x => x.page);
const meta = p => ({ title: p.metafields.find(m => m.key === 'title_tag').value, desc: p.metafields.find(m => m.key === 'description_tag').value });
const read = f => fs.readFileSync(path.join(PAGES, f), 'utf8');
const img = id => ({ src: `${U}${id}?auto=format&fit=crop&h=900&q=80`, aspect_ratio: 1.7778, alt: '' });
const ART = [
  ['pompe-a-chaleur-air-eau-ou-air-air-comment-choisir', 'Pompe à chaleur air/eau ou air/air : comment choisir ?', 'guides/pac-air-eau-air-air.html', '1600047509807-ba8f99d2cdde', '2026-10-05', 'Air/eau ou air/air : principes, avantages, limites et questions à se poser pour choisir la pompe à chaleur adaptée à votre logement.'],
  ['isolation-maison-par-quels-travaux-commencer', 'Isolation de la maison : par quels travaux commencer ?', 'guides/isolation-par-ou-commencer.html', '1607400201889-565b1ee75f8e', '2026-10-05', "Toiture, murs, planchers, ventilation, chauffage : l'ordre des travaux pour isoler efficacement votre maison et réduire vos besoins de chauffage."],
  ['dpe-et-location-le-calendrier-a-connaitre', 'DPE et location : le calendrier à connaître', 'guides/dpe-location-calendrier.html', '1600566753190-17f0baa2a6c3', '2026-10-05', "Logements classés G, F, E : les échéances de la loi Climat et Résilience pour la location, l'audit énergétique et les travaux pour gagner des classes DPE."]
];
JSON.parse(fs.readFileSync(path.join(PAGES, 'guides/articles-2.json'), 'utf8')).forEach((x, i) => {
  const a = x.article, ids = ['1503387762-592deb58ef4e', '1613490493576-7fde63acd811', '1600585154340-be6161a56a0c', '1600210492486-724fe5c67fb0'];
  ART.push([a.handle, a.title, null, ids[i], '2026-10-18', a.summary, a.body]);
});
const articles = ART.reverse().map(([handle, title, file, pic, date, summary, body], k) => ({
  id: k + 1, handle, title, url: `/blogs/guides-energie/${handle}`, image: { ...img(pic), alt: title },
  content: body || read(file), excerpt_or_content: summary, summary, published_at: date, updated_at: date
}));
const blog = { title: 'Guides et conseils', url: '/blogs/guides-energie', handle: 'guides-energie', articles, articles_count: articles.length };

// ---------- Rendu ----------
const base = { settings, routes: { root_url: '/' }, shop: { url: SITE }, content_for_header: '', blogs: { 'guides-energie': blog }, current_page: 1 };
const sitemap = [];
async function page(urlPath, tpl, extra) {
  const g = { ...base, ...extra, _path: urlPath, canonical_url: SITE + urlPath };
  engine.options.globals = g;
  let body = await engine.renderFile(tpl, g);
  let html = await engine.renderFile('theme', { ...g, content_for_layout: body });
  html = html.replace('</body>', '  <script src="/assets/statique.js" defer></script>\n</body>');
  const file = urlPath === '/' ? 'index.html' : urlPath === '/404' ? '404.html' : path.join(urlPath.slice(1), 'index.html');
  const out = path.join(OUT, file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
  if (urlPath !== '/404' && !extra.noindex) sitemap.push(urlPath);
}

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(T, 'assets'), path.join(OUT, 'assets'), { recursive: true });
fs.cpSync(path.join(import.meta.dirname, 'static'), OUT, { recursive: true });

await page('/', 'index.liquid', { template: { name: 'index', suffix: '' }, page_title: settings.seo_title, page_description: settings.seo_description });
await page('/pages/pompe-a-chaleur-aides', 'page.pac.liquid', { template: { name: 'page', suffix: 'pac' }, page: { handle: 'pompe-a-chaleur-aides', title: 'Pompe à chaleur : vérifiez vos aides' }, page_title: 'Pompe à chaleur : vérifiez vos aides en 30 s | Hachem Yazour', page_description: settings.seo_description, noindex: true });
await page('/pages/nos-solutions', 'page.nos-solutions.liquid', { template: { name: 'page', suffix: 'nos-solutions' }, page: { handle: 'nos-solutions', title: 'Toutes nos solutions' }, page_title: 'Rénovation énergétique : toutes nos solutions | Énergie Hachem Yazour', page_description: 'Pompe à chaleur, solaire, isolation, chauffe-eau thermodynamique, rénovation globale : étude personnalisée, installation soignée et suivi, partout en France.' });
for (const p of pagesMeta) {
  const m = meta(p);
  await page('/pages/' + p.handle, 'page.solution.liquid', { template: { name: 'page', suffix: 'solution' }, page: { handle: p.handle, title: p.title, content: p.body }, page_title: m.title, page_description: m.desc });
}
await page('/pages/hachem-yazour-mentions-legales', 'page.liquid', { template: { name: 'page', suffix: '' }, page: { handle: 'hachem-yazour-mentions-legales', title: 'Mentions légales', content: read('mentions.html') }, page_title: 'Mentions légales', page_description: 'Mentions légales du site Énergie Hachem Yazour.' });
await page('/pages/hachem-yazour-confidentialite', 'page.liquid', { template: { name: 'page', suffix: '' }, page: { handle: 'hachem-yazour-confidentialite', title: 'Confidentialité et cookies', content: read('confidentialite.html') }, page_title: 'Confidentialité et cookies', page_description: 'Politique de confidentialité et cookies du site Énergie Hachem Yazour.' });
await page('/blogs/guides-energie', 'blog.liquid', { template: { name: 'blog', suffix: '' }, blog, page_title: 'Guides rénovation énergétique | Énergie Hachem Yazour', page_description: 'Pompe à chaleur, isolation, DPE, solaire : nos guides pour préparer votre projet de rénovation énergétique.' });
for (const a of articles) await page(a.url, 'article.liquid', { template: { name: 'article', suffix: '' }, blog, article: a, page_title: a.title, page_description: a.summary });
await page('/404', '404.liquid', { template: { name: '404', suffix: '' }, page_title: 'Page introuvable', page_description: settings.seo_description, noindex: true });

// ---------- Plan du site et robots ----------
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /envoyer.php\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`OK : ${sitemap.length} pages indexables, domaine ${DOMAIN}, sortie ${OUT}`);

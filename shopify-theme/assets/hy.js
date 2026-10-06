/* Énergie Hachem Yazour — interactions (vanilla, sans dépendance) */
(() => {
  const d = document, root = d.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => [...c.querySelectorAll(s)];

  /* ---------- En-tête : fond au défilement, masquage en descente ---------- */
  const hdr = $('.hdr'), mbar = $('.mbar');
  let lastY = scrollY, ticking = false;
  const onScroll = () => {
    const y = scrollY;
    if (hdr) {
      hdr.classList.toggle('is-solid', y > 40);
      if (!hdr.classList.contains('is-open')) hdr.classList.toggle('is-hidden', y > lastY && y > 300);
    }
    if (mbar) mbar.classList.toggle('on', y > innerHeight * .6);
    lastY = y; ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  onScroll();

  /* ---------- Menu mobile ---------- */
  const burger = $('.burger'), menu = $('#menu');
  const setMenu = open => {
    if (!menu) return;
    hdr.classList.toggle('is-open', open);
    menu.classList.toggle('is-open', open);
    d.body.classList.toggle('no-scroll', open);
    burger.setAttribute('aria-expanded', open);
    menu.setAttribute('aria-hidden', !open);
    if ('inert' in menu) menu.inert = !open;
    if (open) setTimeout(() => $('a', menu)?.focus(), 300);
  };
  if (menu) menu.inert = true;
  burger?.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  $$('#menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  d.addEventListener('keydown', e => { if (e.key === 'Escape' && menu?.classList.contains('is-open')) { setMenu(false); burger.focus(); } });

  /* ---------- Révélations au défilement ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, group = el.parentElement ? [...el.parentElement.children].filter(c => c.classList.contains('rv')) : [];
    el.style.transitionDelay = Math.min(group.indexOf(el), 6) * 80 + 'ms';
    el.classList.add('in'); io.unobserve(el);
  }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  $$('.rv, .rv-img').forEach(el => io.observe(el));

  /* ---------- Compteurs ---------- */
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = parseFloat(el.dataset.count), dec = (el.dataset.count.split(/[.,]/)[1] || '').length;
    const t0 = performance.now(), dur = reduce ? 0 : 1800;
    const fmt = v => v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const tick = t => { const p = dur ? Math.min(1, (t - t0) / dur) : 1; el.textContent = fmt(end * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick); cio.unobserve(el);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => { if (!isNaN(parseFloat(el.dataset.count))) cio.observe(el); });

  /* ---------- Manifeste : mots qui s'allument ---------- */
  const mani = $('[data-words]');
  if (mani && !reduce) {
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = d.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(t => {
          if (!t) return;
          if (/^\s+$/.test(t)) frag.append(t);
          else { const s = d.createElement('span'); s.className = 'w'; s.textContent = t; frag.append(s); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(mani);
  }
  const words = mani ? $$('.w', mani) : [];

  /* ---------- Parallaxe, frise, manifeste (une seule boucle) ---------- */
  const par = reduce ? [] : $$('[data-parallax]');
  const tl = $('.tl'), tlSteps = tl ? $$('.tl__step', tl) : [];
  let raf = 0;
  const frame = () => {
    raf = 0;
    const vh = innerHeight;
    par.forEach(el => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const p = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.transform = `translate3d(0,${(p * parseFloat(el.dataset.parallax || 8)).toFixed(2)}%,0)`;
    });
    if (words.length) {
      const r = mani.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * .85 - r.top) / (r.height + vh * .35)));
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    }
    if (tl) {
      const r = tl.getBoundingClientRect();
      const p = reduce ? 1 : Math.min(1, Math.max(0, (vh * .75 - r.top) / (r.height * .9)));
      tl.style.setProperty('--p', p.toFixed(3));
      tlSteps.forEach((s, i) => s.classList.toggle('on', p >= i / tlSteps.length + .02));
    }
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  frame();

  /* ---------- Lueur qui suit le curseur ---------- */
  if (canHover) $$('.btn--primary, .aid').forEach(el => el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', e.clientX - r.left + 'px');
    el.style.setProperty('--my', e.clientY - r.top + 'px');
  }));

  /* ---------- Maison interactive ---------- */
  const house = $('.house');
  if (house) {
    const data = JSON.parse($('#house-data').textContent);
    const card = $('.house__card', house), tabs = $$('[data-part]', house);
    const show = key => {
      const it = data[key]; if (!it) return;
      house.dataset.active = key;
      $$('svg [data-k]', house).forEach(el => el.classList.toggle('on', el.dataset.k.split(' ').includes(key)));
      tabs.forEach(t => {
        const on = t.dataset.part === key;
        t.setAttribute(t.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-pressed', on);
      });
      card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
      $('[data-k]', card).textContent = it.k;
      $('[data-t]', card).textContent = it.t;
      $('[data-d]', card).textContent = it.d;
      const a = $('[data-l]', card); a.dataset.project = it.p || ''; $('span', a).textContent = it.l;
    };
    tabs.forEach(t => {
      t.addEventListener('click', () => show(t.dataset.part));
      if (canHover && t.classList.contains('hot')) t.addEventListener('mouseenter', () => show(t.dataset.part));
    });
    show(data.pac ? 'pac' : Object.keys(data)[0]);
  }

  /* ---------- Filtres réalisations ---------- */
  const fbar = $('.filters');
  if (fbar) {
    const items = $$('.work');
    fbar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', fbar).forEach(x => x.setAttribute('aria-pressed', x === b));
      const f = b.dataset.filter;
      items.forEach(it => {
        const ok = f === 'all' || it.dataset.cat.split(' ').includes(f);
        if (ok) {
          if (it.hidden) { it.hidden = false; it.classList.add('out'); requestAnimationFrame(() => requestAnimationFrame(() => it.classList.remove('out'))); }
        } else if (!it.hidden) {
          it.classList.add('out');
          setTimeout(() => { if (it.classList.contains('out')) it.hidden = true; }, reduce ? 0 : 420);
        }
      });
    });
  }

  /* ---------- Accordéons ---------- */
  $$('.acc__q').forEach(q => q.addEventListener('click', () => {
    const open = q.getAttribute('aria-expanded') === 'true';
    const panel = d.getElementById(q.getAttribute('aria-controls'));
    q.setAttribute('aria-expanded', !open);
    if (open) panel.removeAttribute('data-open'); else panel.setAttribute('data-open', '');
  }));

  /* ---------- Pré-sélection du projet depuis un lien ---------- */
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-project]'); if (!a || !a.dataset.project) return;
    const input = d.querySelector(`.form input[data-proj="${a.dataset.project}"]`);
    if (input) input.checked = true;
  });

  /* ---------- Formulaire « Obtenir mon étude » ---------- */
  const form = $('.form form');
  if (form && $('.step', form)) {
    const wrap = form.closest('.form');
    const steps = $$('.step', form), bar = $('.progress__bar i', wrap), lbl = $('.progress__lbl', wrap);
    const back = $('[data-back]', form), next = $('[data-next]', form);
    const t0 = Date.now();
    let cur = 0;
    const go = i => {
      cur = i;
      steps.forEach((s, k) => s.classList.toggle('is-current', k === i));
      wrap.classList.toggle('is-last', i === steps.length - 1);
      wrap.classList.toggle('is-auto', steps[i].hasAttribute('data-auto'));
      back.hidden = i === 0;
      if (bar) bar.style.width = ((i + 1) / steps.length * 100) + '%';
      if (lbl) lbl.textContent = `Étape ${i + 1} / ${steps.length}`;
    };
    const rules = {
      tel: v => /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/.test(v.trim()),
      email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
      cp: v => /^(?:0[1-9]|[1-8]\d|9[0-8]|2[AB])\d{3}$/i.test(v.trim()),
      req: v => v.trim().length > 1
    };
    const check = step => {
      let ok = true, first = null;
      $$('[data-group]', step).forEach(g => {
        const bad = !$$('input', g).some(i => i.checked);
        g.classList.toggle('err', bad);
        if (bad) { ok = false; first = first || $('input', g); }
      });
      $$('[data-rule]', step).forEach(inp => {
        const f = inp.closest('.field'), bad = !rules[inp.dataset.rule](inp.value);
        f.classList.toggle('err', bad); inp.setAttribute('aria-invalid', bad);
        if (bad) { ok = false; first = first || inp; }
      });
      const c = $('[data-consent]', step);
      if (c) { const bad = !c.checked; c.closest('.consent-wrap').classList.toggle('err', bad); if (bad) { ok = false; first = first || c; } }
      if (first) first.focus({ preventScroll: false });
      return ok;
    };
    form.addEventListener('change', e => { const g = e.target.closest('[data-group]'); if (g) g.classList.remove('err'); });
    // Étapes « un clic » : passage automatique à la question suivante
    form.addEventListener('click', e => {
      if (e.target.matches('[data-force]')) { go(cur + 1); return; }
      if (e.target.type !== 'radio') return;
      const step = e.target.closest('.step.is-current[data-auto]'); if (!step) return;
      const ok = $('[data-ok-msg]', step), ko = $('[data-ko-msg]', step);
      if (e.target.hasAttribute('data-ko')) { if (ok) ok.hidden = true; if (ko) ko.hidden = false; return; }
      if (ko) ko.hidden = true;
      if (ok) { ok.hidden = false; setTimeout(() => { if (steps[cur] === step) next.click(); }, reduce ? 0 : 900); }
      else setTimeout(() => next.click(), reduce ? 0 : 280);
    });
    form.addEventListener('input', e => {
      const f = e.target.closest('.field.err');
      if (f && rules[e.target.dataset.rule]?.(e.target.value)) { f.classList.remove('err'); e.target.setAttribute('aria-invalid', false); }
      if (e.target.dataset.consent && e.target.checked) e.target.closest('.consent-wrap').classList.remove('err');
    });
    next.addEventListener('click', () => { if (check(steps[cur])) { go(cur + 1); wrap.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); } });
    back.addEventListener('click', () => go(Math.max(0, cur - 1)));
    form.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && cur < steps.length - 1) { e.preventDefault(); next.click(); }
    });
    form.addEventListener('submit', e => {
      // Anti-spam : champ piège rempli ou envoi trop rapide (< 4 s)
      if ($('.hp input', form).value || Date.now() - t0 < 4000) { e.preventDefault(); return; }
      if (!steps.every(s => check(s))) {
        e.preventDefault();
        go(steps.findIndex(s => $$('.err', s).length));
        return;
      }
      $('[data-submit]', form).setAttribute('aria-busy', 'true');
    });
    go(0);
  }


  /* ---------- Simulateur de profil de revenus ---------- */
  const sim = $('[data-sim]');
  if (sim) {
    const data = JSON.parse($('#sim-data').textContent);
    const out = $('[data-out]', sim), nOut = $('[data-n]', sim), rfrIn = $('[data-rfr]', sim);
    const names = ['', 'Profil Bleu', 'Profil Jaune', 'Profil Violet', 'Profil Rose'];
    const labels = ['', 'très modeste', 'modeste', 'intermédiaire', 'aisé'];
    const colors = ['', '#3AB8F2', '#F5C542', '#9A86EE', '#F29BB8'];
    const txt = [
      'Renseignez votre revenu fiscal de référence.',
      'Revenus très modestes : c’est le profil qui peut ouvrir droit aux aides les plus importantes.',
      'Revenus modestes : des aides renforcées peuvent s’appliquer à votre projet.',
      'Revenus intermédiaires : des aides peuvent exister selon les travaux réalisés.',
      'Revenus supérieurs : l’accès aux aides est plus limité, mais certaines primes peuvent rester possibles selon les travaux.'
    ];
    let n = 2;
    const fmt = v => v.toLocaleString('fr-FR');
    const limits = (z, k) => { const d = data[z]; if (k <= 5) return d.t[k - 1]; const b = d.t[4]; return b.map((v, i) => v + (k - 5) * d.x[i]); };
    const update = () => {
      const z = $('input[name="sim-zone"]:checked', sim).value;
      nOut.textContent = n >= 10 ? '10+' : n;
      const raw = rfrIn.value.replace(/[^\d]/g, '');
      if (rfrIn.value !== (raw ? fmt(+raw) : '')) rfrIn.value = raw ? fmt(+raw) : '';
      const L = limits(z, n);
      let p = 0;
      if (raw) { const v = +raw; p = v <= L[0] ? 1 : v <= L[1] ? 2 : v <= L[2] ? 3 : 4; }
      out.dataset.p = p || 'none';
      $('[data-name]', out).textContent = p ? names[p] : '—';
      $('[data-txt]', out).textContent = txt[p];
      if (p) {
        const v = +raw, lo = [0, 0, L[0], L[1], L[2]][p], hi = [0, L[0], L[1], L[2], L[2] * 1.4][p];
        const f = Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));
        $('[data-cursor]', out).style.setProperty('--x', ((p - 1 + f) * 25) + '%');
        out.style.setProperty('--pc', colors[p]);
      }
      $$('input[data-profile]').forEach(i => i.value = p ? `${names[p]} (${labels[p]}) — ${z === 'idf' ? 'Île-de-France' : 'hors Île-de-France'}, ${n} pers.` : '');
      // Surlignage du tableau
      $$('.ptable', sim.parentElement).forEach(t => {
        const on = t.dataset.zone === z;
        $$('tbody tr', t).forEach((tr, i) => {
          const hl = on && i === Math.min(n, 5) - 1;
          tr.classList.toggle('hl', hl);
          $$('td', tr).forEach((td, k) => td.classList.toggle('on', hl && k === p - 1));
          if (hl) tr.style.setProperty('--pc', colors[p] || 'transparent');
        });
      });
    };
    $$('[data-step]', sim).forEach(b => b.addEventListener('click', () => { n = Math.min(10, Math.max(1, n + +b.dataset.step)); update(); }));
    sim.addEventListener('input', update);
    sim.addEventListener('change', update);
    update();
  }

  /* ---------- Année du pied de page ---------- */
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();

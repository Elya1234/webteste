/* Énergie Hachem Yazour — interactions (vanilla, sans dépendance) */
(() => {
  const d = document, root = d.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => [...c.querySelectorAll(s)];

  /* ---------- En-tête : fond au défilement, masquage en descente ---------- */
  const hdr = $('.hdr'), mbar = $('.mbar'), wa = $('.wa');
  let lastY = scrollY, ticking = false;
  const onScroll = () => {
    const y = scrollY;
    if (hdr) {
      hdr.classList.toggle('is-solid', y > 40);
      if (!hdr.classList.contains('is-open')) hdr.classList.toggle('is-hidden', y > lastY && y > 300);
    }
    if (mbar) mbar.classList.toggle('on', y > innerHeight * .6);
    if (wa) wa.classList.toggle('on', y > innerHeight * .6 || innerWidth >= 1080);
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
      wrap.classList.toggle('is-first', i === 0);
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



  /* ---------- Maison PAC pédagogique : un numéro = une fiche, sans défilement ---------- */
  const px = $('[data-pacx]');
  if (px) {
    const pick = key => {
      px.dataset.active = key;
      $$('svg [data-k]', px).forEach(el => el.classList.toggle('on', el.dataset.k.split(' ').includes(key)));
      $$('.hot', px).forEach(b => {
        const on = b.dataset.part === key;
        b.setAttribute('aria-pressed', on);
        b.classList.remove('blink'); if (on) { void b.offsetWidth; b.classList.add('blink'); }
      });
      $$('.pcnav button', px).forEach(b => b.setAttribute('aria-selected', b.dataset.part === key));
      $$('.pc', px).forEach(c => c.classList.toggle('is-on', c.dataset.part === key));
    };
    $$('.hot, .pcnav button', px).forEach(b => b.addEventListener('click', () => pick(b.dataset.part)));
    pick('ext');
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
      'Tapez votre revenu fiscal : votre couleur s’affiche aussitôt.',
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
      $('[data-name]', out).textContent = p ? names[p] : 'Votre couleur ?';
      const mini = $('[data-mini]', sim); if (mini) { mini.innerHTML = p ? `<i style="background:${colors[p]}"></i>${names[p]} · ${labels[p]}` : ''; mini.classList.toggle('on', !!p); }
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
          const hl = on && !tr.classList.contains('extra') && i === Math.min(n, 5) - 1;
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



  /* ---------- PAC : air animé dans le haut de page ---------- */
  const air = $('[data-air]');
  if (air && !reduce) {
    const ctx = air.getContext('2d'); let W = 0, H = 0, run = false, raf2 = 0;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const N = innerWidth < 760 ? 22 : 42;
    const P = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), v: .0006 + Math.random() * .0012, r: .8 + Math.random() * 1.8, a: Math.random() * Math.PI * 2 }));
    const size = () => { W = air.clientWidth; H = air.clientHeight; air.width = W * dpr; air.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      P.forEach(p => {
        p.x -= p.v; p.a += .02; if (p.x < -.02) { p.x = 1.02; p.y = Math.random(); }
        const y = p.y * H + Math.sin(p.a) * 6, x = p.x * W;
        const alpha = Math.min(1, Math.min(p.x, 1 - p.x) * 6) * .55;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,227,161,${alpha})`; ctx.fill();
      });
      if (run) raf2 = requestAnimationFrame(draw);
    };
    size(); addEventListener('resize', size);
    new IntersectionObserver(([e]) => { run = e.isIntersecting; cancelAnimationFrame(raf2); if (run) draw(); }).observe(air);
  }

  /* ---------- PAC : saison Hiver / Été ---------- */
  const pxs = $('[data-pacx]');
  if (pxs) {
    const txtS = { winter: 'La pompe à chaleur chauffe la maison.', summer: 'Certains modèles rafraîchissent la maison.' };
    $$('[data-season]', pxs).forEach(b => b.addEventListener('click', () => {
      const s = b.dataset.season;
      pxs.classList.toggle('is-summer', s === 'summer');
      $$('[data-season]', pxs).forEach(x => x.setAttribute('aria-pressed', x === b));
      const t = $('[data-season-t]', pxs); t.textContent = txtS[s]; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    }));
  }

  /* ---------- PAC : étapes, ligne animée ---------- */
  const stp = $('[data-steps]');
  if (stp) new IntersectionObserver(([e], o) => { if (e.isIntersecting) { stp.classList.add('in'); o.disconnect(); } }, { threshold: .4 }).observe(stp);

  /* ---------- Galerie : léger effet 3D au survol ---------- */
  if (canHover && !reduce) $$('[data-tilt]').forEach(c => {
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
    });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; });
  });

  /* ---------- Carrousels mobiles : points indicateurs ---------- */
  const mqSnap = matchMedia('(max-width: 759px)');
  $$('.solutions, .works, .aids, .reviews, .posts, .gain').forEach(track => {
    const dots = d.createElement('div'); dots.className = 'snap-dots'; dots.setAttribute('aria-hidden', 'true');
    track.after(dots);
    const items = () => [...track.children].filter(c => !c.hidden);
    const build = () => {
      dots.innerHTML = '';
      if (!mqSnap.matches) return;
      items().forEach((it, k) => { const b = d.createElement('i'); b.addEventListener('click', () => track.scrollTo({ left: it.offsetLeft - track.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: reduce ? 'auto' : 'smooth' })); dots.append(b); });
      sync();
    };
    const sync = () => {
      const its = items(), x = track.scrollLeft, w = track.clientWidth;
      let k = 0, best = 1e9;
      its.forEach((it, i) => { const dd = Math.abs(it.offsetLeft - track.offsetLeft - x); if (dd < best) { best = dd; k = i; } });
      if (x + w >= track.scrollWidth - 4) k = its.length - 1;
      [...dots.children].forEach((b, i) => b.classList.toggle('on', i === k));
    };
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    mqSnap.addEventListener('change', build);
    new MutationObserver(build).observe(track, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    build();
  });


  /* ---------- Rappel en 1 clic (volontaire, refermable) ---------- */
  const cb = $('[data-cb]');
  if (cb) {
    const store = (k, v) => { try { v === undefined ? 0 : localStorage.setItem(k, v); return localStorage.getItem(k); } catch (e) { return null; } };
    const sess = (k, v) => { try { if (v !== undefined) { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } return sessionStorage.getItem(k); } catch (e) { return null; } };
    const cbForm = $('form', cb), t0 = Date.now();
    let lastFocus = null;
    const open = () => {
      if (!cb.hidden) return;
      lastFocus = d.activeElement; cb.hidden = false;
      requestAnimationFrame(() => cb.classList.add('is-open'));
      d.body.classList.add('cb-lock');
      setTimeout(() => { const f = $('#cb-fn', cb); if (f && innerWidth >= 760) f.focus(); }, 350);
    };
    const close = manual => {
      cb.classList.remove('is-open'); d.body.classList.remove('cb-lock');
      setTimeout(() => { cb.hidden = true; }, reduce ? 0 : 400);
      if (manual) store('cb-dismiss', Date.now());
      lastFocus?.focus?.();
    };
    $$('[data-cb-open]').forEach(b => b.addEventListener('click', open));
    $$('[data-cb-close]', cb).forEach(b => b.addEventListener('click', () => close(true)));
    d.addEventListener('keydown', e => { if (e.key === 'Escape' && !cb.hidden) close(true); });

    // Retour après envoi : afficher la confirmation dans la fenêtre
    if (/contact_posted=true/.test(location.search) && sess('cb-sent')) {
      sess('cb-sent', null);
      $('[data-cb-body]', cb).hidden = true; $('[data-cb-ok]', cb).hidden = false; open();
    }

    // Ouverture automatique : une seule fois par visite, jamais si la personne a fermé (3 jours) ou a déjà commencé un formulaire
    const dismissed = +store('cb-dismiss') > Date.now() - 3 * 864e5;
    const busy = () => !!d.querySelector('.form form :is(input,textarea):focus') || $$('.form form input[type=radio]:checked, .form form input[type=checkbox]:checked').length > 0;
    if (!dismissed && !sess('cb-auto') && !/contact_posted=true/.test(location.search)) {
      const auto = () => { if (sess('cb-auto') || busy()) return; sess('cb-auto', 1); open(); };
      setTimeout(auto, 35000);
      addEventListener('scroll', function onS() { if (scrollY > (d.documentElement.scrollHeight - innerHeight) * .6) { removeEventListener('scroll', onS); auto(); } }, { passive: true });
      if (canHover) d.addEventListener('mouseout', function onOut(e) { if (!e.relatedTarget && e.clientY <= 0) { d.removeEventListener('mouseout', onOut); auto(); } });
    }

    // Validation et anti-spam
    const R = { req: v => v.trim().length > 1, tel: v => /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/.test(v.trim()), email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) };
    cbForm.addEventListener('input', e => { const f = e.target.closest('.field.err'); if (f && R[e.target.dataset.cbrule]?.(e.target.value)) f.classList.remove('err'); if (e.target.dataset.cbconsent !== undefined && e.target.checked) e.target.closest('.consent-wrap').classList.remove('err'); });
    cbForm.addEventListener('submit', e => {
      if ($('.hp input', cbForm).value || Date.now() - t0 < 3000) { e.preventDefault(); return; }
      let first = null;
      $$('[data-cbrule]', cbForm).forEach(i => { const bad = !R[i.dataset.cbrule](i.value); i.closest('.field').classList.toggle('err', bad); i.setAttribute('aria-invalid', bad); if (bad && !first) first = i; });
      const c = $('[data-cbconsent]', cbForm); const badC = !c.checked; c.closest('.consent-wrap').classList.toggle('err', badC); if (badC && !first) first = c;
      if (first) { e.preventDefault(); first.focus(); return; }
      sess('cb-sent', 1);
    });
  }

  /* ---------- Année du pied de page ---------- */
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();

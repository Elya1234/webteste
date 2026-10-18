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

    // Reprise : les réponses restent dans ce navigateur uniquement, jusqu'à l'envoi
    const KEY = 'hy-form:' + location.pathname;
    const ls = { get: () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
                 set: v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} },
                 del: () => { try { localStorage.removeItem(KEY); } catch (e) {} } };
    const fields = () => $$('input, textarea', form).filter(i => i.name && i.type !== 'hidden' && !i.closest('.hp') && !i.hasAttribute('data-consent'));
    const save = () => {
      const v = {}; fields().forEach(i => { if (i.type === 'radio' || i.type === 'checkbox') { if (i.checked) v[i.name + '|' + i.value] = 1; } else if (i.value) v[i.name] = i.value; });
      ls.set({ v, step: cur, t: Date.now() });
    };
    form.addEventListener('change', save); form.addEventListener('input', save);
    form.addEventListener('click', e => { if (e.target.closest('[data-next],[data-back],[data-force]')) setTimeout(save, 50); });
    if (/contact_posted=true/.test(location.search)) ls.del();
    const saved = ls.get();
    if (saved && Date.now() - saved.t < 14 * 864e5) {
      fields().forEach(i => {
        if (i.type === 'radio' || i.type === 'checkbox') i.checked = !!saved.v[i.name + '|' + i.value];
        else if (saved.v[i.name]) { i.value = saved.v[i.name]; i.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      const st = Math.min(saved.step || 0, steps.length - 1);
      go(st);
      if (st > 0 && saved.from !== 'wel') {
        const note = d.createElement('p'); note.className = 'resume'; note.innerHTML = 'Vos réponses ont été conservées. <button type="button">Recommencer</button>';
        $('.progress', wrap)?.after(note);
        $('button', note).addEventListener('click', () => { ls.del(); form.reset(); note.remove(); go(0); });
      }
    } else go(0);
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


  /* ---------- Confort de saisie : téléphone formaté, ville automatique, envoi WhatsApp ---------- */
  d.addEventListener('input', e => {
    const i = e.target;
    if (i.type === 'tel') {
      const raw = i.value;
      if (/^\s*\+/.test(raw)) return;
      const dg = raw.replace(/\D/g, '').slice(0, 10);
      const f = dg.replace(/(\d{2})(?=\d)/g, '$1 ');
      if (f !== raw && !(e.inputType || '').startsWith('delete')) i.value = f;
    }
  });
  const cityCache = {};
  $$('input[autocomplete="postal-code"]').forEach(cp => {
    const form = cp.form, hid = form && $('[data-city]', form);
    const box = d.createElement('div'); box.className = 'cp-city'; box.setAttribute('aria-live', 'polite');
    cp.closest('.field').append(box);
    const show = list => {
      box.innerHTML = '';
      if (!list || !list.length) { if (hid) hid.value = ''; return; }
      if (list.length === 1) { box.innerHTML = `<span>${'📍'} ${list[0]}</span>`; if (hid) hid.value = list[0]; return; }
      const sel = d.createElement('select'); sel.setAttribute('aria-label', 'Commune');
      list.forEach(n => { const o = d.createElement('option'); o.textContent = n; sel.append(o); });
      sel.addEventListener('change', () => { if (hid) hid.value = sel.value; });
      box.append('📍 ', sel); if (hid) hid.value = list[0];
    };
    cp.addEventListener('input', () => {
      const v = cp.value.replace(/\D/g, '').slice(0, 5); if (v !== cp.value) cp.value = v;
      if (v.length !== 5) { show(null); return; }
      if (cityCache[v]) { show(cityCache[v]); return; }
      fetch(`https://geo.api.gouv.fr/communes?codePostal=${v}&fields=nom`).then(r => r.ok ? r.json() : []).then(js => { cityCache[v] = js.map(c => c.nom).sort(); show(cityCache[v]); }).catch(() => show(null));
    });
    if (cp.value.length === 5) cp.dispatchEvent(new Event('input'));
  });
  $$('[data-wa-answers]').forEach(b => b.addEventListener('click', () => {
    const f = b.closest('form') || b.closest('.form')?.querySelector('form');
    const wa = $('[data-wa-url]')?.dataset.waUrl; if (!f || !wa) return;
    const lines = ['Bonjour, je souhaite être rappelé pour une pompe à chaleur.'];
    $$('input:checked', f).forEach(i => { if (i.type === 'radio' || (i.type === 'checkbox' && !i.hasAttribute('data-consent'))) { const k = (i.name.match(/\[(.+)\]/) || [])[1] || ''; lines.push(i.value === 'Oui' ? k : `${k} : ${i.value}`); } });
    const val = n => (f.querySelector(`[name="contact[${n}]"]`) || {}).value || '';
    [['Prénom', 'Prénom'], ['Code postal', 'Code postal'], ['Ville', 'Ville'], ['Profil revenus estimé', 'Profil']].forEach(([n, l]) => { const v = val(n); if (v) lines.push(`${l} : ${v}`); });
    open(`${wa}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  }));


  /* ---------- Assistant automatique + WhatsApp (bouton noir) ---------- */
  const ai = $('[data-ai]');
  if (ai) {
    const panel = $('.ai__panel', ai), log = $('[data-ai-log]', ai), chipsBox = $('[data-ai-chips]', ai), fab = $('.ai__fab', ai);
    const input = $('#ai-q', ai), home = ai.dataset.home || '', waUrl = ai.dataset.waUrl;
    const S = { get: k => { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
    let hist = S.get('ai-hist') || [];
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9€ ]/g, ' ');
    const L = (t, href) => `<a href="${href}">${t}</a>`;
    const KB = [
      { k: ['bonjour', 'salut', 'hello', 'bonsoir', 'coucou'], a: 'Bonjour ! Je réponds à vos questions sur la pompe à chaleur et les aides. Que souhaitez-vous savoir ?', c: ['Suis-je éligible ?', 'Quelles aides ?', 'Combien ça coûte ?'] },
      { k: ['eligib', 'droit', 'eligible', 'possible pour moi', 'ai je le droit'], flow: 'elig' },
      { k: ['1 €', '1€', '1 euro', 'un euro', 'gratuit', 'gratuite'], a: 'Personne ne peut garantir une pompe à chaleur à 1 € sans étude. Selon vos revenus et votre logement, les aides peuvent couvrir une part importante du coût. ' + L('Lire notre réponse honnête', home + '/blogs/guides-energie/pompe-a-chaleur-a-1-euro-vrai-ou-faux') + '.', c: ['Suis-je éligible ?', 'Être rappelé'] },
      { k: ['aide', 'maprimerenov', 'prime', 'cee', 'coup de pouce', 'subvention', 'financement', 'eco ptz', 'pret', 'tva'], a: 'Plusieurs aides peuvent s\'additionner : MaPrimeRénov\', prime CEE « Coup de pouce », TVA réduite, éco-prêt à taux zéro, aides locales. Leur montant dépend surtout de vos revenus et de votre logement.', c: ['Mon profil de revenus', 'Suis-je éligible ?', 'Être rappelé'] },
      { k: ['profil', 'revenu', 'bleu', 'jaune', 'violet', 'rose', 'plafond', 'rfr', 'impot'], a: 'Votre profil (Bleu, Jaune, Violet ou Rose) dépend de votre revenu fiscal de référence et du nombre de personnes du foyer. ' + L('Calculez-le en 10 secondes', home + '/pages/pompe-a-chaleur-aides#profil') + '.', c: ['Quelles aides ?', 'Être rappelé'] },
      { k: ['prix', 'cout', 'combien', 'tarif', 'cher', 'devis', 'budget'], a: 'Le prix dépend du type de pompe à chaleur, de la puissance, de votre maison et des travaux annexes. Les aides réduisent ensuite le reste à payer. Le plus simple : une étude gratuite pour un devis précis.', c: ['Être rappelé', 'Quelles aides ?'] },
      { k: ['delai', 'duree', 'combien de temps', 'quand', 'installation', 'installer', 'pose', 'jours'], a: 'La pose d\'une pompe à chaleur prend en général quelques jours. Le calendrier précis vous est donné avec la proposition, après l\'étude.', c: ['Être rappelé', 'Comment ça marche ?'] },
      { k: ['radiateur', 'plancher'], a: 'Vos radiateurs actuels peuvent souvent être conservés. Nous vérifions leur compatibilité pendant l\'étude. Un plancher chauffant est idéal.', c: ['Suis-je éligible ?', 'Être rappelé'] },
      { k: ['froid', 'hiver', 'gel', 'neige', 'temperature'], a: 'Oui, les pompes à chaleur actuelles fonctionnent même par températures négatives. Leur puissance est choisie selon le climat de votre région.', c: ['Comment ça marche ?', 'Être rappelé'] },
      { k: ['marche', 'fonctionne', 'comment ca', 'principe', 'c est quoi', 'cest quoi'], a: 'Elle capte la chaleur de l\'air extérieur grâce à une unité posée dehors, puis l\'envoie dans votre chauffage par un module intérieur, à la place de votre ancienne chaudière. ' + L('Voir le schéma', home + '/pages/pompe-a-chaleur-aides') + '.', c: ['Suis-je éligible ?', 'Quelles aides ?'] },
      { k: ['entretien', 'entretenir', 'maintenance', 'panne'], a: 'Un entretien est obligatoire tous les deux ans pour les pompes à chaleur de 4 à 70 kW. Nous restons disponibles pour le suivi.', c: ['Être rappelé'] },
      { k: ['bruit', 'bruyant', 'son'], a: 'L\'unité extérieure fait un léger bruit de ventilateur. Nous choisissons son emplacement avec vous pour limiter la gêne.', c: ['Être rappelé'] },
      { k: ['fioul', 'mazout', 'cuve'], a: 'Les chaudières neuves au fioul sont interdites depuis 2022 : la pompe à chaleur est le remplacement le plus courant, et des aides peuvent s\'appliquer. ' + L('Notre guide', home + '/blogs/guides-energie/remplacer-chaudiere-fioul-par-pompe-a-chaleur') + '.', c: ['Suis-je éligible ?', 'Être rappelé'] },
      { k: ['gaz'], a: 'Remplacer une chaudière gaz par une pompe à chaleur est possible et peut ouvrir droit à des aides, selon votre situation.', c: ['Suis-je éligible ?', 'Être rappelé'] },
      { k: ['zone', 'ville', 'region', 'intervenez', 'ou etes', 'departement', 'secteur', 'france'], a: 'Nous intervenons partout en France métropolitaine. Indiquez votre code postal dans le formulaire et nous vous confirmons le calendrier.', c: ['Être rappelé'] },
      { k: ['arnaque', 'demarchage', 'fiable', 'confiance', 'serieux', 'rge'], a: 'Bons réflexes : jamais de signature sous pression, pas d\'acompte avant étude, et vérifiez la certification RGE sur l\'annuaire France Rénov\'. Nous ne promettons aucun montant d\'aide sans étude.', c: ['Être rappelé'] },
      { k: ['rappel', 'rappeler', 'appel', 'appeler', 'telephone', 'contact', 'conseiller', 'humain', 'parler', 'etude'], act: 'cb', a: 'Avec plaisir ! Laissez votre prénom et votre numéro, un conseiller vous rappelle au créneau choisi.' },
      { k: ['whatsapp', 'message'], act: 'wa', a: 'Je vous ouvre WhatsApp avec le résumé de notre échange.' },
      { k: ['merci', 'super', 'parfait', 'ok', 'top'], a: 'Avec plaisir ! Autre chose ?', c: ['Être rappelé', 'Parler sur WhatsApp'] }
    ];
    const CHIP = {
      'Suis-je éligible ?': () => flowElig(0), 'Quelles aides ?': () => ask('aides'), 'Combien ça coûte ?': () => ask('prix'),
      'Mon profil de revenus': () => ask('profil'), 'Comment ça marche ?': () => ask('comment ca marche'),
      'Être rappelé': () => ask('rappel'), 'Parler sur WhatsApp': () => ask('whatsapp')
    };
    const save = () => S.set('ai-hist', hist.slice(-30));
    const bubble = (who, html, store = true) => {
      const m = d.createElement('div'); m.className = 'ai__msg ai__msg--' + who; m.innerHTML = html; log.append(m);
      log.scrollTop = log.scrollHeight; if (store) { hist.push([who, html]); save(); }
    };
    const chips = list => { chipsBox.innerHTML = ''; (list || []).forEach(t => { const b = d.createElement('button'); b.type = 'button'; b.textContent = t; b.addEventListener('click', () => { bubble('me', t); (CHIP[t] || (() => ask(t)))(); }); chipsBox.append(b); }); };
    const say = (html, list, then) => {
      chips([]); const t = d.createElement('div'); t.className = 'ai__msg ai__msg--bot ai__typing'; t.innerHTML = '<i></i><i></i><i></i>'; log.append(t); log.scrollTop = log.scrollHeight;
      setTimeout(() => { t.remove(); bubble('bot', html); chips(list); then && then(); }, reduce ? 0 : 650);
    };
    const summary = () => hist.filter(h => h[0] === 'me').map(h => '• ' + h[1].replace(/<[^>]+>/g, '')).slice(-6).join('\n');
    const openWA = () => {
      if (!waUrl) return;
      const txt = 'Bonjour, je souhaite des informations sur une pompe à chaleur.' + (summary() ? '\nMes questions :\n' + summary() : '');
      open(`${waUrl}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
    };
    let elig = {};
    const flowElig = step => {
      if (step === 0) { say('Quel type de chaudière avez-vous ?', ['Gaz', 'Fioul', 'Bois', 'Électrique / aucune']); CHIP['Gaz'] = CHIP['Fioul'] = CHIP['Bois'] = () => { elig.ch = 1; flowElig(1); }; CHIP['Électrique / aucune'] = () => { elig.ch = 0; flowElig(1); }; }
      if (step === 1) { say('Vous êtes propriétaire du logement ?', ['Oui, j\'y habite', 'Oui, je le loue', 'Non, locataire']); CHIP['Oui, j\'y habite'] = CHIP['Oui, je le loue'] = () => { elig.pr = 1; flowElig(2); }; CHIP['Non, locataire'] = () => { elig.pr = 0; flowElig(2); }; }
      if (step === 2) {
        if (elig.ch && elig.pr) say('Bonne nouvelle : votre situation est <b>compatible</b> avec un remplacement par pompe à chaleur, et des aides peuvent s\'appliquer. Un conseiller peut vérifier le montant avec vous.', ['Être rappelé', 'Parler sur WhatsApp', 'Mon profil de revenus']);
        else if (!elig.pr) say('En tant que locataire, les travaux se décident avec votre propriétaire. Il peut lui-même bénéficier de certaines aides.', ['Être rappelé', 'Quelles aides ?']);
        else say('Sans chaudière, les aides au remplacement de chaudière ne s\'appliquent pas, mais d\'autres solutions existent selon votre logement.', ['Être rappelé', 'Parler sur WhatsApp']);
      }
    };
    const ask = q => {
      const n = ' ' + norm(q) + ' ';
      let best = null, score = 0;
      KB.forEach(e => { let s = 0; e.k.forEach(k => { if (n.includes(norm(k))) s += k.length; }); if (s > score) { score = s; best = e; } });
      if (!best) return say('Je n\'ai pas de réponse précise à cette question. Un conseiller peut vous répondre rapidement :', ['Être rappelé', 'Parler sur WhatsApp']);
      if (best.flow === 'elig') return flowElig(0);
      say(best.a, best.c, () => { if (best.act === 'cb') { $('[data-cb-open]')?.click(); } if (best.act === 'wa') openWA(); });
    };
    const toggle = force => {
      const show = force ?? panel.hidden;
      panel.hidden = !show; ai.classList.toggle('is-open', show); fab.setAttribute('aria-expanded', show);
      $('[data-ai-hint]', ai)?.classList.remove('on'); $('.ai__badge', ai)?.remove();
      if (show) {
        try { sessionStorage.setItem('ai-seen', 1); } catch (e) {}
        if (!log.children.length) {
          if (hist.length) { hist.forEach(([w, h]) => bubble(w, h, false)); chips(['Être rappelé', 'Parler sur WhatsApp']); }
          else say('Bonjour 👋 Je suis l\'assistant automatique d\'Énergie Hachem Yazour. Posez votre question ou choisissez :', ['Suis-je éligible ?', 'Quelles aides ?', 'Combien ça coûte ?', 'Être rappelé', 'Parler sur WhatsApp']);
        }
        if (innerWidth >= 760) setTimeout(() => input.focus(), 300);
      }
    };
    $$('[data-ai-toggle]', ai).forEach(b => b.addEventListener('click', () => toggle()));
    d.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { toggle(false); fab.focus(); } });
    $('[data-ai-wa]', ai)?.addEventListener('click', e => { e.preventDefault(); openWA(); });
    $('[data-ai-form]', ai).addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ''; bubble('me', q.replace(/</g, '&lt;')); ask(q); });
    // Petite bulle d'invitation, une fois par visite
    let seen = null; try { seen = sessionStorage.getItem('ai-seen'); } catch (e) {}
    if (!seen) setTimeout(() => { if (panel.hidden && fab.classList.contains('on')) $('[data-ai-hint]', ai)?.classList.add('on'); }, 9000);
    else $('.ai__badge', ai)?.remove();
  }


  /* ---------- Accueil « comptoir » : après ~12 s sur le site, centré pompe à chaleur ---------- */
  const wel = $('[data-wel]');
  if (wel) {
    const ss = (k, v) => { try { if (v !== undefined) sessionStorage.setItem(k, v); return sessionStorage.getItem(k); } catch (e) { return '1'; } };
    const lsg = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lss = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const posted = /contact_posted=true/.test(location.search);
    if (!ss('hy-start')) ss('hy-start', Date.now());
    const DELAY = 12000;
    const formStarted = () => !!d.querySelector('.form form :is(input,textarea):focus') || $$('.form form input[type=radio]:checked, .form form input[type=checkbox]:checked, .form form input[type=text]:not([name=website]), .form form input[type=tel], .form form input[type=email]').some(i => i.type === 'radio' || i.type === 'checkbox' ? i.checked : i.value);
    const busy = () => !$('[data-cb]')?.hidden || !$('.ai__panel')?.hidden || !!d.querySelector('.menu.is-open') || !!d.querySelector('.cb__form :focus, .ai__bar :focus');
    if (!ss('hy-welcomed') && !posted) {
      const back = !!lsg('hy-visited'); lss('hy-visited', 1);
      let tries = 0;
      const show = () => {
        if (ss('hy-welcomed')) return;
        if (formStarted()) { ss('hy-welcomed', 1); return; }        // la personne remplit déjà : on ne la dérange pas
        if (busy() || d.hidden) { if (++tries < 6) setTimeout(show, 8000); return; }
        ss('hy-welcomed', 1); ss('cb-auto', 1);
        const hr = new Date().getHours(), hello = hr >= 18 || hr < 5 ? 'Bonsoir' : 'Bonjour';
        let resume = false;
        try { resume = Object.keys(localStorage).some(k => k.startsWith('hy-form:') && (JSON.parse(localStorage.getItem(k)) || {}).step > 0); } catch (e) {}
        const text = resume
          ? `${hello} 👋 Votre demande de pompe à chaleur vous attend. On la termine ensemble ?`
          : back
            ? `${hello} 👋 Bon retour ! Vérifions si votre maison peut passer à la pompe à chaleur.`
            : `${hello} 👋 Bienvenue chez Énergie Hachem Yazour. Vérifions en 10 secondes si votre maison peut passer à la pompe à chaleur.`;
        const msg = $('[data-wel-msg]', wel), last = d.activeElement;
        wel.hidden = false; d.body.classList.add('wel-lock');
        if (resume) $('[data-wel-resume]', wel).hidden = false;
        requestAnimationFrame(() => wel.classList.add('is-open'));
        const type = () => {
          if (reduce) { msg.textContent = text; wel.classList.add('typed'); return; }
          let i = 0; msg.textContent = '';
          const step = () => { msg.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(step, text[i - 1] === ' ' ? 18 : 24); else wel.classList.add('typed'); };
          step();
        };
        setTimeout(type, reduce ? 0 : 550);
        setTimeout(() => $('[data-wel-ch]', wel)?.focus({ preventScroll: true }), 700);
        wel._close = () => { wel.classList.remove('is-open'); setTimeout(() => { wel.hidden = true; }, reduce ? 0 : 450); d.body.classList.remove('wel-lock'); last?.focus?.(); };
      };
      const close = () => wel._close && wel._close();
      $$('[data-wel-close]', wel).forEach(b => b.addEventListener('click', close));
      d.addEventListener('keydown', e => { if (e.key === 'Escape' && !wel.hidden) close(); });
      $$('[data-wel-go]', wel).forEach(a => a.addEventListener('click', () => close()));
      $$('[data-wel-ai]', wel).forEach(b => b.addEventListener('click', () => { close(); setTimeout(() => $('.ai__fab')?.click(), 300); }));
      $$('[data-wel-cb]', wel).forEach(b => b.addEventListener('click', () => { close(); setTimeout(() => $('[data-cb-open]')?.click(), 300); }));
      // Éligibilité : type de chaudière, puis suite sur la page pompe à chaleur avec la réponse déjà cochée
      let choice = '';
      $$('[data-wel-ch]', wel).forEach(b => b.addEventListener('click', () => {
        choice = b.dataset.welCh;
        $$('[data-wel-ch]', wel).forEach(x => x.classList.toggle('is-sel', x === b));
        const ko = b.hasAttribute('data-ko');
        $('[data-wel-ok]', wel).hidden = ko; $('[data-wel-next]', wel).hidden = ko; $('[data-wel-ko]', wel).hidden = !ko;
        (ko ? $('[data-wel-force]', wel) : $('[data-wel-next]', wel))?.focus({ preventScroll: true });
      }));
      $$('[data-wel-next], [data-wel-force]', wel).forEach(a => a.addEventListener('click', () => {
        try {
          const path = new URL(a.href, location.href).pathname;
          localStorage.setItem('hy-form:' + path, JSON.stringify({ v: { ['contact[Chaudière actuelle]|' + choice]: 1 }, step: 1, t: Date.now(), from: 'wel' }));
        } catch (e) {}
        close();
      }));
      setTimeout(show, Math.max(1500, DELAY - (Date.now() - +ss('hy-start'))));
    }
  }

  /* ---------- Année du pied de page ---------- */
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();

/* =========================================================
   CORPUS HOVDJO — interactions & animations
   ========================================================= */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  $("#year").textContent = new Date().getFullYear();

  /* ---------- 1. BOOT SEQUENCE ---------- */
  const boot = $("#boot");
  const bootLog = $("#bootLog");
  const bootBar = $("#bootBar");
  const bootLines = [
    '<span class="dim">[  0.000]</span> corpus-hovdjo kernel v8.0.0',
    '<span class="dim">[  0.112]</span> chargement des modules <span class="cy">design</span> ... ok',
    '<span class="dim">[  0.204]</span> compilation <span class="cy">html / css / js</span> ... ok',
    '<span class="dim">[  0.318]</span> optimisation <span class="cy">SEO</span> ... ok',
    '<span class="dim">[  0.402]</span> connexion sécurisée <span class="cy">https</span> ... ok',
    '<span class="dim">[  0.520]</span> démarrage de l\'expérience ▸',
  ];
  let started = false;
  function startSite() {
    if (started) return;
    started = true;
    boot.classList.add("done");
    document.body.classList.remove("is-loading");
    initReveal();
    startEditor();
  }
  if (reduce) {
    startSite();
  } else {
    let i = 0;
    const step = () => {
      if (i < bootLines.length) {
        bootLog.innerHTML += bootLines[i] + "\n";
        i++;
        bootBar.style.width = (i / bootLines.length) * 100 + "%";
        setTimeout(step, 170 + Math.random() * 120);
      } else {
        setTimeout(startSite, 350);
      }
    };
    step();
    setTimeout(startSite, 4000); // sécurité
  }
  boot.addEventListener("click", startSite);

  /* ---------- 2. NAV ---------- */
  const nav = $("#nav");
  const burger = $("#burger");
  const navLinks = $("#navLinks");
  burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  });
  $$("a", navLinks).forEach(a => a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  }));

  /* ---------- 3. SCROLL: nav, progress, timeline ---------- */
  const progress = $("#progress");
  const timeline = $("#timeline");
  const fill = $("#timelineFill");
  const steps = $$(".step");
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle("scrolled", y > 30);
    const h = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${h > 0 ? y / h : 0})`;

    const r = timeline.getBoundingClientRect();
    const mid = innerHeight * 0.6;
    const ratio = Math.min(1, Math.max(0, (mid - r.top) / r.height));
    fill.style.transform = `scaleY(${ratio})`;
    steps.forEach(s => {
      const n = s.querySelector(".step__n").getBoundingClientRect();
      s.classList.toggle("active", n.top + n.height / 2 < mid);
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------- 4. REVEAL + COUNTERS ---------- */
  function initReveal() {
    // délais en cascade pour les éléments frères
    $$(".services, .showcase, .pricing, .stats, .faq, .why").forEach(group => {
      $$(".reveal", group).forEach((el, i) => el.style.setProperty("--d", (i % 6) * 0.08 + "s"));
    });
    $$(".hero .reveal").forEach((el, i) => el.style.setProperty("--d", i * 0.1 + "s"));

    if (!("IntersectionObserver" in window)) {
      $$(".reveal, .mock").forEach(el => el.classList.add("in"));
      $$(".count").forEach(countUp);
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        const c = e.target.querySelector(".count");
        if (c) countUp(c);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    $$(".reveal").forEach(el => io.observe(el));
  }

  function countUp(el) {
    const to = +el.dataset.to;
    const pre = el.dataset.prefix || "";
    const suf = el.dataset.suffix || "";
    if (reduce) { el.textContent = pre + to + suf; return; }
    const dur = 1600;
    const t0 = performance.now();
    const tick = t => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = pre + Math.round(to * e) + suf;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- 5. SCRAMBLE TEXT ---------- */
  const scrambleEl = $("#scramble");
  const words = ["impressionnent", "convertissent", "se chargent vite", "rankent sur Google", "vous ressemblent"];
  const glyphs = "!<>-_\\/[]{}—=+*^?#01";
  let wIndex = 0;
  function scrambleTo(text) {
    const from = scrambleEl.textContent;
    const len = Math.max(from.length, text.length);
    const queue = [];
    for (let i = 0; i < len; i++) {
      const start = Math.floor(Math.random() * 20);
      queue.push({ from: from[i] || "", to: text[i] || "", start, end: start + Math.floor(Math.random() * 20) });
    }
    let frame = 0;
    const update = () => {
      let out = "", done = 0;
      for (const q of queue) {
        if (frame >= q.end) { done++; out += q.to; }
        else if (frame >= q.start) {
          if (!q.char || Math.random() < 0.28) q.char = glyphs[Math.floor(Math.random() * glyphs.length)];
          out += `<span style="color:var(--violet)">${q.char}</span>`;
        } else out += q.from;
      }
      scrambleEl.innerHTML = out;
      if (done < queue.length) { frame++; requestAnimationFrame(update); }
    };
    update();
  }
  if (!reduce) {
    setInterval(() => {
      wIndex = (wIndex + 1) % words.length;
      scrambleTo(words[wIndex]);
    }, 2800);
  }

  /* ---------- 6. CODE EDITOR TYPING ---------- */
  const codeEl = $("#editorCode");
  const perf = $("#perfScore");
  const codeSrc = [
    ['<span class="tk-com">&lt;!-- Votre futur site --&gt;</span>'],
    ['<span class="tk-tag">&lt;header</span> <span class="tk-attr">class</span>=<span class="tk-str">"hero"</span><span class="tk-tag">&gt;</span>'],
    ['  <span class="tk-tag">&lt;h1&gt;</span>Votre entreprise<span class="tk-tag">&lt;/h1&gt;</span>'],
    ['  <span class="tk-tag">&lt;p&gt;</span>Enfin visible en ligne.<span class="tk-tag">&lt;/p&gt;</span>'],
    ['  <span class="tk-tag">&lt;a</span> <span class="tk-attr">href</span>=<span class="tk-str">"#devis"</span><span class="tk-tag">&gt;</span>Contact<span class="tk-tag">&lt;/a&gt;</span>'],
    ['<span class="tk-tag">&lt;/header&gt;</span>'],
    [''],
    ['<span class="tk-tag">&lt;script&gt;</span>'],
    ['  <span class="tk-kw">const</span> site = <span class="tk-fn">corpus</span>({'],
    ['    design: <span class="tk-str">"sur-mesure"</span>,'],
    ['    seo: <span class="tk-kw">true</span>, mobile: <span class="tk-kw">true</span>,'],
    ['    prix: <span class="tk-str">"dès 800€"</span>'],
    ['  });'],
    ['  site.<span class="tk-fn">launch</span>(); <span class="tk-com">// 🚀</span>'],
    ['<span class="tk-tag">&lt;/script&gt;</span>'],
  ];
  // Découpe une ligne HTML en "unités" : balises span entières + entités + caractères
  function tokenize(html) {
    const out = [];
    const re = /(<[^>]+>)|(&[a-z]+;)|([\s\S])/g;
    let m;
    while ((m = re.exec(html))) out.push({ tag: !!m[1], s: m[0] });
    return out;
  }
  function startEditor() {
    const lines = codeSrc.map(l => tokenize(l[0]));
    if (reduce) {
      codeEl.innerHTML = codeSrc.map((l, i) => `<span class="ln">${i + 1}</span>${l[0]}`).join("\n");
      perf.textContent = 100;
      return;
    }
    let li = 0, ci = 0;
    const done = [];
    let current = "";
    const render = () => {
      const all = done.concat([current]);
      codeEl.innerHTML = all.map((l, i) => `<span class="ln">${i + 1}</span>${l}`).join("\n") + '<span class="cur"></span>';
    };
    const type = () => {
      if (li >= lines.length) {
        let s = 0;
        const iv = setInterval(() => { s += 4; perf.textContent = Math.min(100, s); if (s >= 100) clearInterval(iv); }, 30);
        setTimeout(() => { done.length = 0; current = ""; li = 0; ci = 0; perf.textContent = 0; type(); }, 6000);
        return;
      }
      const line = lines[li];
      // ajoute les balises d'un coup, puis un caractère visible
      while (ci < line.length && line[ci].tag) current += line[ci++].s;
      if (ci < line.length) current += line[ci++].s;
      while (ci < line.length && line[ci].tag) current += line[ci++].s;
      render();
      if (ci >= line.length) {
        done.push(current); current = ""; li++; ci = 0;
        setTimeout(type, 140);
      } else {
        setTimeout(type, 18 + Math.random() * 40);
      }
    };
    type();
  }

  /* ---------- 7. NETWORK CANVAS ---------- */
  const canvas = $("#net");
  const ctx = canvas.getContext("2d");
  let W, H, DPR, nodes = [];
  const mouse = { x: -9999, y: -9999 };
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const count = Math.round(Math.min(110, (W * H) / 14000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
      r: Math.random() * 1.6 + .6,
      c: Math.random() < .5 ? "0,240,255" : "168,85,247",
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const max = 130;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      a.x += a.vx; a.y += a.vy;
      if (a.x < 0 || a.x > W) a.vx *= -1;
      if (a.y < 0 || a.y > H) a.vy *= -1;
      // attraction souris
      const dxm = mouse.x - a.x, dym = mouse.y - a.y;
      const dm = Math.hypot(dxm, dym);
      if (dm < 180) { a.x += dxm * .006; a.y += dym * .006; }
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < max) {
          ctx.strokeStyle = `rgba(${a.c},${(1 - d / max) * .35})`;
          ctx.lineWidth = .7;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (dm < 180) {
        ctx.strokeStyle = `rgba(0,240,255,${(1 - dm / 180) * .6})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
      ctx.fillStyle = `rgba(${a.c},.9)`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  let heroVisible = true;
  function loop() {
    if (heroVisible) draw();
    requestAnimationFrame(loop);
  }
  resize();
  addEventListener("resize", resize);
  if (reduce) draw(); else loop();
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(canvas);
  canvas.parentElement.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  canvas.parentElement.addEventListener("mouseleave", () => { mouse.x = mouse.y = -9999; });

  /* ---------- 8. CURSOR, SPOTLIGHT, TILT, MAGNETIC ---------- */
  if (finePointer && !reduce) {
    document.body.classList.add("has-cursor");
    const cur = $("#cursor"), dot = $("#cursorDot");
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener("mousemove", e => {
      tx = e.clientX; ty = e.clientY;
      dot.style.transform = `translate(${tx}px,${ty}px)`;
    });
    (function follow() {
      cx += (tx - cx) * .18; cy += (ty - cy) * .18;
      cur.style.transform = `translate(${cx}px,${cy}px)`;
      requestAnimationFrame(follow);
    })();
    document.addEventListener("mouseover", e => {
      cur.classList.toggle("hover", !!e.target.closest("a, button, input, select, textarea, label, summary, .tilt"));
    });

    // tilt 3D
    $$(".tilt").forEach(el => {
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5;
        const py = (e.clientY - r.top) / r.height - .5;
        el.style.transition = "transform .12s ease-out, box-shadow .4s";
        el.style.transform = `perspective(900px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateZ(0)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transition = "transform .7s cubic-bezier(.2,.8,.2,1), box-shadow .4s";
        el.style.transform = "";
      });
    });

    // boutons magnétiques
    $$(".magnetic").forEach(el => {
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .35}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }
  // spotlight (aussi au toucher)
  $$(".glow-card").forEach(el => {
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", e.clientX - r.left + "px");
      el.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

  /* ---------- 9. ESTIMATOR ---------- */
  const pages = $("#pages"), pagesOut = $("#pagesOut"), total = $("#estTotal");
  const opts = $$("#estimator input[type=checkbox]");
  let shown = 800;
  function compute() {
    const p = +pages.value;
    pagesOut.textContent = p;
    pages.style.setProperty("--p", ((p - 1) / 19) * 100 + "%");
    let sum = 800 + Math.max(0, p - 5) * 90; // 5 pages incluses, puis 90 €/page
    opts.forEach(o => { if (o.checked) sum += +o.dataset.price; });
    animateNumber(sum);
  }
  let raf;
  function animateNumber(to) {
    cancelAnimationFrame(raf);
    const from = shown, t0 = performance.now(), dur = reduce ? 1 : 450;
    const tick = t => {
      const k = Math.min(1, (t - t0) / dur);
      shown = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      total.textContent = shown.toLocaleString("fr-FR");
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  pages.addEventListener("input", compute);
  opts.forEach(o => o.addEventListener("change", compute));
  compute();

  $("#estCta").addEventListener("click", () => {
    const chosen = opts.filter(o => o.checked).map(o => "- " + o.parentElement.querySelector("span").textContent);
    const msg = `Bonjour,\n\nJ'ai fait une estimation sur votre site : environ ${total.textContent} € HT.\n• ${pages.value} pages\n${chosen.join("\n")}\n\nMon projet : `;
    const ta = $("#f-msg");
    ta.value = msg;
    setTimeout(() => ta.focus({ preventScroll: true }), 700);
  });
  $$("[data-plan]").forEach(b => b.addEventListener("click", () => {
    const sel = $("#f-type");
    [...sel.options].forEach(o => { if (o.text === b.dataset.plan) sel.value = o.value; });
  }));

  /* ---------- 10. TERMINAL INTERACTIF ---------- */
  const termBody = $("#termBody"), termForm = $("#termForm"), termInput = $("#termInput");
  const history = []; let hIdx = 0;
  const cmds = {
    help: () => `Commandes disponibles :
  <b>services</b>   ce que l'on fait
  <b>prix</b>       nos tarifs
  <b>delais</b>     délais de création
  <b>stack</b>      technologies utilisées
  <b>pourquoi</b>   pourquoi Corpus Hovdjo
  <b>contact</b>    nous écrire
  <b>devis</b>      aller au formulaire
  <b>matrix</b>     ??? 👀
  <b>hack</b>       mode hacker
  <b>clear</b>      vider l'écran`,
    services: () => `<span class="g">✔</span> Site vitrine
<span class="g">✔</span> E-commerce
<span class="g">✔</span> Application web sur mesure
<span class="g">✔</span> Refonte de site
<span class="g">✔</span> SEO &amp; performance
<span class="g">✔</span> Maintenance &amp; hébergement`,
    prix: () => `┌──────────────┬────────────┐
│ Essentiel    │ <span class="g">dès   800 €</span> │
│ Business     │ <span class="g">dès 1 490 €</span> │
│ E-commerce   │ <span class="g">dès 2 400 €</span> │
│ Maintenance  │ <span class="g">dès 39 €/m</span>  │
└──────────────┴────────────┘
Astuce : essayez le <b>simulateur</b> au-dessus ↑`,
    tarifs: () => cmds.prix(),
    delais: () => `Site vitrine    → <span class="v">1 à 2 semaines</span>
E-commerce      → <span class="v">3 à 6 semaines</span>
Application web → <span class="v">selon le projet</span>
Réponse devis   → <span class="v">sous 24 h</span>`,
    stack: () => `<span class="p">front</span>  HTML · CSS · JavaScript · React · Next.js · Tailwind
<span class="p">back</span>   Node.js · PHP · API REST
<span class="p">cms</span>    WordPress · Shopify
<span class="p">outils</span> Figma · Git · Google Analytics · Search Console`,
    pourquoi: () => `→ Code fait main, pas de template générique
→ Sites rapides, sécurisés et bien référencés
→ Prix clairs, dès 800 €
→ Un interlocuteur unique, réactif`,
    contact: () => `email    <b>contact@corpus-hovdjo.fr</b>
horaires lun – ven · 9h – 19h
Tapez <b>devis</b> pour ouvrir le formulaire.`,
    devis: () => { setTimeout(() => $("#contact").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }), 300); return '<span class="g">Ouverture du formulaire…</span>'; },
    sudo: () => '<span class="p">Permission refusée.</span> Mais on peut quand même vous faire un super site 😉',
    ls: () => 'services/  tarifs/  realisations/  contact.txt  <span class="g">votre-futur-site.html</span>',
    whoami: () => 'Un futur client satisfait, visiblement.',
    hello: () => 'Bonjour ! 👋 Tapez <b>help</b> pour commencer.',
    bonjour: () => cmds.hello(),
  };
  function print(cmd) {
    const c = document.createElement("div");
    c.className = "term__cmd";
    c.innerHTML = `<span>$</span> ${cmd.replace(/[<>&]/g, m => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]))}`;
    termBody.appendChild(c);
    const key = cmd.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (key === "clear") { termBody.innerHTML = ""; return; }
    if (!key) return;
    const out = document.createElement("div");
    out.className = "term__out";
    out.innerHTML = cmds[key] ? cmds[key]() : `commande introuvable : ${c.innerHTML.replace(/^<span>\$<\/span> /, "")}\nTapez <b>help</b>.`;
    termBody.appendChild(out);
    termBody.scrollTop = termBody.scrollHeight;
  }
  termForm.addEventListener("submit", e => {
    e.preventDefault();
    const v = termInput.value;
    if (v.trim()) { history.push(v); hIdx = history.length; }
    print(v);
    termInput.value = "";
  });
  termInput.addEventListener("keydown", e => {
    if (e.key === "ArrowUp" && hIdx > 0) { termInput.value = history[--hIdx]; e.preventDefault(); }
    if (e.key === "ArrowDown") { hIdx = Math.min(history.length, hIdx + 1); termInput.value = history[hIdx] || ""; e.preventDefault(); }
  });
  $$(".term__hints button").forEach(b => b.addEventListener("click", () => print(b.dataset.cmd)));
  $("#term").addEventListener("click", e => { if (!e.target.closest("button")) termInput.focus({ preventScroll: true }); });

  // démo auto quand le terminal apparaît
  let demoDone = false;
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting || demoDone) return;
    demoDone = true; obs.disconnect();
    const word = "services";
    let i = 0;
    const t = setInterval(() => {
      termInput.value = word.slice(0, ++i);
      if (i >= word.length) { clearInterval(t); setTimeout(() => { print(word); termInput.value = ""; }, 350); }
    }, reduce ? 0 : 90);
  }, { threshold: .5 }).observe($("#term"));

  /* ---------- 11. CONTACT FORM ---------- */
  // ⚠️ Remplacez cette adresse par votre email réel :
  const CONTACT_EMAIL = "contact@corpus-hovdjo.fr";
  const form = $("#contactForm"), formMsg = $("#formMsg");
  form.addEventListener("submit", e => {
    e.preventDefault();
    let ok = true;
    ["f-name", "f-email", "f-msg"].forEach(id => {
      const f = $("#" + id);
      const bad = !f.value.trim() || (f.type === "email" && !/^\S+@\S+\.\S+$/.test(f.value));
      f.parentElement.classList.toggle("error", bad);
      if (bad) ok = false;
    });
    if (!ok) {
      formMsg.className = "form__msg err";
      formMsg.textContent = "> erreur : merci de compléter les champs en rouge.";
      return;
    }
    const subject = `Demande de devis — ${$("#f-type").value}`;
    const body = `Nom : ${$("#f-name").value}\nEmail : ${$("#f-email").value}\nProjet : ${$("#f-type").value}\n\n${$("#f-msg").value}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    formMsg.className = "form__msg";
    formMsg.textContent = "> ok : votre messagerie s'ouvre pour envoyer la demande ✓";
  });

  /* =========================================================
     12. EFFETS AVANCÉS
     ========================================================= */

  /* ---- 12a. Pluie de code (Matrix) réutilisable ---- */
  function makeMatrix(cv, { color = "61,255,154", size = 16, fps = 22, fade = "5,7,13" } = {}) {
    const c = cv.getContext("2d");
    const chars = "01アイウエオカキクケコサシスセソ<>/{}[]=;$#*+ABCDEF";
    let w, h, drops, running = false, last = 0, raf;
    function fit() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      drops = Array.from({ length: Math.ceil(w / size) }, () => Math.random() * -h / size);
      c.fillStyle = `rgb(${fade})`; c.fillRect(0, 0, w, h);
    }
    function frame(t) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (t - last < 1000 / fps) return;
      last = t;
      c.fillStyle = `rgba(${fade},.09)`;
      c.fillRect(0, 0, w, h);
      c.font = `${size}px "JetBrains Mono", monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[(Math.random() * chars.length) | 0];
        const y = drops[i] * size;
        c.fillStyle = Math.random() < .04 ? "#ffffff" : `rgba(${color},${.55 + Math.random() * .45})`;
        c.fillText(ch, i * size, y);
        if (y > h && Math.random() > .975) drops[i] = 0;
        drops[i] += 1;
      }
    }
    fit();
    addEventListener("resize", fit);
    return {
      start() { if (running || reduce) return; running = true; raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      fit,
    };
  }
  // boot
  const bootRain = makeMatrix($("#bootMatrix"), { size: 14, fps: 28 });
  if (!document.body.classList.contains("is-loading") || reduce) bootRain.stop(); else bootRain.start();
  new MutationObserver(() => { if (boot.classList.contains("done")) bootRain.stop(); }).observe(boot, { attributes: true });
  // section terminal
  const secRain = makeMatrix($("#sectionMatrix"), { size: 15, fps: 18 });
  new IntersectionObserver(([e]) => e.isIntersecting ? secRain.start() : secRain.stop()).observe($("#sectionMatrix"));

  /* ---- 12b. Globe 3D interactif ---- */
  const gcv = $("#globe"), g = gcv.getContext("2d");
  let gw, gh, gR;
  const gPts = [];
  const N = 520;
  for (let i = 0; i < N; i++) { // sphère de Fibonacci
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
    gPts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  const arcs = Array.from({ length: 9 }, () => [(Math.random() * N) | 0, (Math.random() * N) | 0, Math.random()]);
  let rotY = 0, rotX = .35, tRotY = 0, tRotX = .35, gm = { x: 0, y: 0 };
  function gFit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    gw = gcv.clientWidth; gh = gcv.clientHeight;
    gcv.width = gw * dpr; gcv.height = gh * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    gR = Math.min(gw, gh) * .36;
  }
  function rot([x, y, z]) {
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
    return [x1, y1, z2];
  }
  function proj(p) { const s = 1 / (1.9 - p[2] * .5); return [gw / 2 + p[0] * gR * s * 1.4, gh / 2 + p[1] * gR * s * 1.4, p[2]]; }
  let gt = 0;
  function gDraw() {
    gt += 1;
    tRotY += .0035; rotY += (tRotY + gm.x * .8 - rotY) * .06;
    rotX += (tRotX + gm.y * .5 - rotX) * .06;
    g.clearRect(0, 0, gw, gh);
    // halo
    const grd = g.createRadialGradient(gw / 2, gh / 2, gR * .2, gw / 2, gh / 2, gR * 1.5);
    grd.addColorStop(0, "rgba(0,240,255,.07)"); grd.addColorStop(1, "rgba(0,240,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, gw, gh);
    // points
    for (const p of gPts) {
      const r = rot(p), [x, y, z] = proj(r);
      const k = (z + 1) / 2;
      g.fillStyle = z > 0 ? `rgba(0,240,255,${.15 + k * .75})` : `rgba(168,85,247,${.08 + k * .3})`;
      g.beginPath(); g.arc(x, y, .6 + k * 1.5, 0, 6.283); g.fill();
    }
    // arcs de données entre deux points
    for (const a of arcs) {
      const A = gPts[a[0]], B = gPts[a[1]];
      const prog = ((gt * .006 + a[2]) % 1);
      g.beginPath();
      let first = true;
      for (let s = 0; s <= 1.0001; s += .05) {
        const m = [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s, A[2] + (B[2] - A[2]) * s];
        const L = Math.hypot(...m) || 1, lift = 1 + Math.sin(s * Math.PI) * .35;
        const pp = proj(rot(m.map(v => v / L * lift)));
        first ? g.moveTo(pp[0], pp[1]) : g.lineTo(pp[0], pp[1]); first = false;
      }
      g.strokeStyle = "rgba(255,61,154,.35)"; g.lineWidth = 1; g.stroke();
      // paquet qui voyage
      const m = [A[0] + (B[0] - A[0]) * prog, A[1] + (B[1] - A[1]) * prog, A[2] + (B[2] - A[2]) * prog];
      const L = Math.hypot(...m) || 1, lift = 1 + Math.sin(prog * Math.PI) * .35;
      const pp = proj(rot(m.map(v => v / L * lift)));
      g.fillStyle = "#ff3d9a"; g.shadowColor = "#ff3d9a"; g.shadowBlur = 12;
      g.beginPath(); g.arc(pp[0], pp[1], 2.4, 0, 6.283); g.fill(); g.shadowBlur = 0;
    }
    // anneau en orbite + satellite
    g.beginPath();
    for (let s = 0; s <= 6.3; s += .05) {
      const pp = proj(rot([Math.cos(s) * 1.45, Math.sin(s) * .18, Math.sin(s) * 1.45]));
      s === 0 ? g.moveTo(pp[0], pp[1]) : g.lineTo(pp[0], pp[1]);
    }
    g.strokeStyle = "rgba(168,85,247,.35)"; g.stroke();
    const sa = gt * .015, sp = proj(rot([Math.cos(sa) * 1.45, Math.sin(sa) * .18, Math.sin(sa) * 1.45]));
    g.fillStyle = "#00f0ff"; g.shadowColor = "#00f0ff"; g.shadowBlur = 16;
    g.beginPath(); g.arc(sp[0], sp[1], 3.5, 0, 6.283); g.fill(); g.shadowBlur = 0;
  }
  gFit(); addEventListener("resize", gFit);
  addEventListener("mousemove", e => { gm.x = e.clientX / innerWidth - .5; gm.y = e.clientY / innerHeight - .5; });
  if (reduce) gDraw(); else (function gl() { if (heroVisible) gDraw(); requestAnimationFrame(gl); })();

  /* ---- 12c. Titres qui se décodent ---- */
  const GL = "ABCDEF0123456789<>/{}#$%&*+=?";
  function decode(el, speed = 1) {
    if (reduce || el.dataset.decoding) return;
    el.dataset.decoding = 1;
    el.classList.add("decoding");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push({ n: walker.currentNode, o: walker.currentNode.nodeValue });
    const total = nodes.reduce((a, b) => a + b.o.length, 0);
    let f = 0;
    (function tick() {
      let idx = 0;
      for (const it of nodes) {
        let out = "";
        for (const ch of it.o) {
          const at = idx * .55 / speed + 6;
          out += (f >= at || ch === " " || ch === " ") ? ch : GL[(Math.random() * GL.length) | 0];
          idx++;
        }
        it.n.nodeValue = out;
      }
      f++;
      if (f < total * .55 / speed + 8) requestAnimationFrame(tick);
      else { nodes.forEach(it => it.n.nodeValue = it.o); el.classList.remove("decoding"); delete el.dataset.decoding; }
    })();
  }
  const titleIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { setTimeout(() => decode(e.target), 150); titleIO.unobserve(e.target); }
  }), { threshold: .6 });
  $$(".section h2, .estimator h3").forEach(h => titleIO.observe(h));
  // liens du menu et kickers : décodage au survol
  $$(".nav__links a:not(.btn), .kicker, .logo__text").forEach(a => a.addEventListener("mouseenter", () => decode(a, 2)));

  /* ---- 12d. Transition « terminal » entre sections ---- */
  const wipe = $("#wipe"), wipeText = $("#wipeText");
  const names = { top: "accueil", services: "services", realisations: "exemples", process: "methode", tarifs: "tarifs", faq: "faq", contact: "contact", stack: "stack", terminal: "terminal" };
  let wiping = false;
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || reduce || wiping) return;
    const id = a.getAttribute("href").slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    wiping = true;
    wipe.classList.add("on");
    const cmd = `$ cd ~/${names[id] || id}`;
    let i = 0;
    setTimeout(() => {
      wipe.classList.add("text");
      const t = setInterval(() => {
        wipeText.textContent = cmd.slice(0, ++i) + "▌";
        if (i >= cmd.length) {
          clearInterval(t);
          setTimeout(() => {
            target.scrollIntoView({ behavior: "instant", block: "start" });
            window.history.replaceState(null, "", "#" + id);
            wipe.classList.remove("text");
            wipe.classList.remove("on");
            setTimeout(() => { wiping = false; wipeText.textContent = ""; }, 700);
          }, 220);
        }
      }, 22);
    }, 420);
  });

  /* ---- 12e. Étincelles de code au clic + traînée du curseur ---- */
  const sparkChars = ["{", "}", "<", "/>", ";", "0", "1", "#", "*", "()", "=>"];
  const sparkCols = ["#00f0ff", "#a855f7", "#ff3d9a", "#3dff9a"];
  document.addEventListener("pointerdown", e => {
    if (reduce || e.target.closest("input, textarea, select, .term")) return;
    for (let i = 0; i < 9; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      s.textContent = sparkChars[(Math.random() * sparkChars.length) | 0];
      const ang = (i / 9) * Math.PI * 2 + Math.random() * .5, dist = 40 + Math.random() * 50;
      s.style.cssText = `--x:${e.clientX}px;--y:${e.clientY}px;--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist}px;--r:${(Math.random() - .5) * 180}deg;transform:translate(${e.clientX}px,${e.clientY}px);color:${sparkCols[i % 4]}`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 850);
    }
  });
  if (finePointer && !reduce) {
    let lastT = 0;
    addEventListener("mousemove", e => {
      const now = performance.now();
      if (now - lastT < 28) return;
      lastT = now;
      const d = document.createElement("i");
      d.className = "trail";
      const t = `translate(${e.clientX}px,${e.clientY}px)`;
      d.style.transform = t; d.style.setProperty("--t", t);
      d.style.background = sparkCols[(now / 100 | 0) % 3];
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 650);
    });
  }

  /* ---- 12f. Cube 3D : on peut le faire tourner à la souris ---- */
  const cube = $("#cube");
  let drag = null, cRX = -22, cRY = 0;
  cube.parentElement.addEventListener("pointerdown", e => {
    drag = { x: e.clientX, y: e.clientY, rx: cRX, ry: cRY };
    cube.style.animation = "none";
    cube.parentElement.setPointerCapture(e.pointerId);
  });
  addEventListener("pointermove", e => {
    if (!drag) return;
    cRY = drag.ry + (e.clientX - drag.x) * .6;
    cRX = drag.rx - (e.clientY - drag.y) * .6;
    cube.style.transform = `rotateX(${cRX}deg) rotateY(${cRY}deg)`;
  });
  addEventListener("pointerup", () => { drag = null; });

  /* ---- 12g. Easter eggs : mode Matrix + mode hacker ---- */
  const mFull = $("#matrixFull"), mMsg = $("#matrixMsg");
  const fullRain = makeMatrix($("#fullMatrix"), { size: 18, fps: 26, fade: "0,0,0" });
  let mTimer;
  function matrixMode() {
    mFull.classList.add("on");
    requestAnimationFrame(() => { fullRain.fit(); fullRain.start(); });
    const msg = "Le code est partout… et votre site aussi bientôt.";
    mMsg.textContent = "";
    let i = 0;
    clearInterval(mTimer);
    mTimer = setInterval(() => { mMsg.textContent = msg.slice(0, ++i); if (i >= msg.length) clearInterval(mTimer); }, 45);
    setTimeout(closeMatrix, 6500);
  }
  function closeMatrix() { mFull.classList.remove("on"); setTimeout(() => fullRain.stop(), 500); }
  mFull.addEventListener("click", closeMatrix);
  cmds.matrix = () => { setTimeout(matrixMode, 300); return '<span class="g">Initialisation de la Matrice…</span>'; };
  cmds.hack = () => {
    const lines = ["Connexion au serveur Corpus…", "Contournement du pare-feu… [OK]", "Téléchargement de bonnes idées… 100%", "Injection de créativité… [OK]",
      '<span class="p">ACCÈS AUTORISÉ</span> : votre futur site vous attend 😎'];
    lines.forEach((l, i) => setTimeout(() => {
      const o = document.createElement("div"); o.className = "term__out"; o.innerHTML = '<span class="g">▸</span> ' + l;
      termBody.appendChild(o); termBody.scrollTop = termBody.scrollHeight;
    }, 350 * (i + 1)));
    return '<span class="v">Mode hacker activé…</span>';
  };
  // code Konami (↑↑↓↓←→←→BA) ou taper « matrix » n'importe où
  const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kPos = 0, typed = "";
  addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    kPos = e.key === konami[kPos] ? kPos + 1 : (e.key === konami[0] ? 1 : 0);
    if (kPos === konami.length) { kPos = 0; matrixMode(); }
    typed = (typed + e.key).slice(-6).toLowerCase();
    if (typed === "matrix") matrixMode();
    if (e.key === "Escape") closeMatrix();
  });
})();

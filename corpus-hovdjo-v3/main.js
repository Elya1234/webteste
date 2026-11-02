/* =========================================================
   CORPUS HOVDJO — modèle « Plan d'architecte »
   ========================================================= */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");
  $("#year").textContent = new Date().getFullYear();

  /* ---------- menu ---------- */
  const burger = $("#burger"), links = $("#navLinks"), nav = $("#nav");
  burger.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  });
  $$("a", links).forEach(a => a.addEventListener("click", () => {
    links.classList.remove("open"); burger.setAttribute("aria-expanded", "false");
  }));

  /* ---------- scroll : nav + progression méthode ---------- */
  const steps = $("#steps"), stepItems = $$("#steps li");
  function onScroll() {
    nav.classList.toggle("scrolled", scrollY > 10);
    const vertical = matchMedia("(max-width:960px)").matches;
    const r = steps.getBoundingClientRect();
    const mid = innerHeight * .65;
    let p;
    if (vertical) p = (mid - r.top) / r.height;
    else p = (innerHeight - r.top) / (innerHeight * .9);
    p = Math.max(0, Math.min(1, p));
    steps.style.setProperty("--prog", p * 100 + "%");
    stepItems.forEach((li, i) => li.classList.toggle("on", p > i / stepItems.length));
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------- apparitions + compteurs ---------- */
  $$(".svc-list, .sheets, .pledges, .faq, .steps, .hero__copy").forEach(g =>
    $$(".reveal", g).forEach((el, i) => el.style.setProperty("--d", Math.min(i, 6) * .07 + "s")));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    $$(".count", e.target).forEach(countUp);
    io.unobserve(e.target);
  }), { threshold: .12, rootMargin: "0px 0px -30px 0px" });
  $$(".reveal").forEach(el => io.observe(el));

  function countUp(el) {
    const to = +el.dataset.to;
    if (reduce) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 1400;
    (function tick(t) {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------- grille du hero qui suit la souris ---------- */
  const grid = $("#heroGrid");
  if (!reduce && matchMedia("(hover:hover)").matches) {
    $(".hero").addEventListener("mousemove", e => {
      const x = (e.clientX / innerWidth - .5) * 14, y = (e.clientY / innerHeight - .5) * 14;
      grid.style.transform = `translate(${x}px,${y}px)`;
    });
  }

  /* ---------- PLAN → CODE → RENDU ---------- */
  const bp = $("#blueprint"), plan = $("#plan"), render = $("#render");
  const clone = $(".ms", render).cloneNode(true);
  plan.prepend(clone);
  const drawables = $$(".ms-nav, .ms-logo, .ms-links i, .ms-btn, .ms-eyebrow, .ms-h, .ms-p, .ms-cta, .ms-img, .ms-cards > div", clone);
  drawables.forEach((el, i) => { el.classList.add("draw"); el.style.setProperty("--dl", i * .08 + "s"); });
  $$(".dim", plan).forEach((d, i) => d.style.setProperty("--dl", 0.6 + i * .15 + "s"));

  // code tapé ligne par ligne
  const pre = $("#codePre"), perf = $("#perf");
  const T = (t, c) => `<span class="tk-${t}">${c}</span>`;
  const src = [
    T("com", "&lt;!-- Atelier Brun · accueil --&gt;"),
    T("tag", "&lt;header") + " " + T("attr", "class") + "=" + T("str", '"nav"') + T("tag", "&gt;"),
    "  " + T("tag", "&lt;a") + " " + T("attr", "href") + "=" + T("str", '"/"') + T("tag", "&gt;") + "Atelier Brun" + T("tag", "&lt;/a&gt;"),
    T("tag", "&lt;/header&gt;"),
    T("tag", "&lt;section") + " " + T("attr", "class") + "=" + T("str", '"hero"') + T("tag", "&gt;"),
    "  " + T("tag", "&lt;h1&gt;") + "Du bois, du sur-mesure," + T("tag", "&lt;/h1&gt;"),
    "  " + T("tag", "&lt;p&gt;") + "Cuisines, escaliers…" + T("tag", "&lt;/p&gt;"),
    "  " + T("tag", "&lt;a") + " " + T("attr", "class") + "=" + T("str", '"btn"') + T("tag", "&gt;") + "Rendez-vous" + T("tag", "&lt;/a&gt;"),
    T("tag", "&lt;/section&gt;"),
    T("tag", "&lt;div") + " " + T("attr", "class") + "=" + T("str", '"cards"') + T("tag", "&gt;") + "…" + T("tag", "&lt;/div&gt;"),
  ];
  const tok = html => { const o = [], re = /(<[^>]+>)|(&[a-z]+;)|([\s\S])/g; let m; while ((m = re.exec(html))) o.push({ tag: !!m[1], s: m[0] }); return o; };
  const lines = src.map(tok);
  let typeTimer = null;
  function renderCode(done, cur, caret) {
    pre.innerHTML = done.concat(cur === null ? [] : [cur]).map((l, i) => `<span class="ln">${i + 1}</span>${l}`).join("\n") + (caret ? '<span class="cur"></span>' : "");
  }
  function fullCode() { clearTimeout(typeTimer); renderCode(src, null, false); perf.textContent = 100; }
  function typeCode(onDone) {
    clearTimeout(typeTimer);
    const done = []; let li = 0, ci = 0, cur = "";
    perf.textContent = 0;
    (function step() {
      if (li >= lines.length) {
        renderCode(done, null, true);
        let s = 0; const iv = setInterval(() => { s += 5; perf.textContent = Math.min(100, s); if (s >= 100) clearInterval(iv); }, 25);
        onDone && (typeTimer = setTimeout(onDone, 700));
        return;
      }
      const L = lines[li];
      while (ci < L.length && L[ci].tag) cur += L[ci++].s;
      for (let k = 0; k < 2 && ci < L.length; k++) { cur += L[ci++].s; while (ci < L.length && L[ci].tag) cur += L[ci++].s; }
      renderCode(done, cur, true);
      if (ci >= L.length) { done.push(cur); cur = ""; li++; ci = 0; typeTimer = setTimeout(step, 90); }
      else typeTimer = setTimeout(step, 22);
    })();
  }

  const toggles = $$(".toggle button");
  let auto = true, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearAll = () => { timers.forEach(clearTimeout); timers = []; clearTimeout(typeTimer); };
  function scan() { bp.classList.remove("scan-run"); void bp.offsetWidth; bp.classList.add("scan-run"); }
  function setState(v, { typing = false, onTyped } = {}) {
    toggles.forEach(b => b.classList.toggle("on", b.dataset.view === v));
    const prev = bp.dataset.state || "plan";
    bp.classList.remove("s-code", "s-rendu");
    if (v !== "plan") bp.classList.add("s-" + v);
    bp.dataset.state = v;
    if (v === "plan") {
      bp.classList.remove("drawn"); void bp.offsetWidth;
      requestAnimationFrame(() => bp.classList.add("drawn"));
    } else {
      bp.classList.add("drawn");
      if (prev === "plan" || (prev === "code" && v === "rendu")) scan();
    }
    if (v === "code") { pre.innerHTML = ""; typing ? typeCode(onTyped) : typeCode(); }
    else if (v === "rendu") fullCode();
  }
  function cycle() {
    if (!auto) return;
    setState("plan");
    later(() => setState("code", { typing: true, onTyped: () => later(() => { setState("rendu"); later(cycle, 5000); }, 900) }), 3400);
  }
  toggles.forEach(b => b.addEventListener("click", () => { auto = false; clearAll(); setState(b.dataset.view); }));
  if (reduce) { bp.classList.add("drawn"); auto = false; fullCode(); }
  else {
    renderCode([], "", true);
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && auto && !timers.length) cycle();
      if (!e.isIntersecting && auto) clearAll();
    }, { threshold: .3 }).observe(bp);
  }

  /* ---------- réseau de points (hero) ---------- */
  const cv = $("#net"), cx = cv.getContext("2d");
  let W, H, pts = [], heroOn = true;
  const mouse = { x: -999, y: -999 };
  function fit() {
    const d = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
    pts = Array.from({ length: Math.round(Math.min(70, W * H / 22000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3 }));
  }
  function drawNet() {
    cx.clearRect(0, 0, W, H);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      a.x += a.vx; a.y += a.vy;
      if (a.x < 0 || a.x > W) a.vx *= -1;
      if (a.y < 0 || a.y > H) a.vy *= -1;
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120) { cx.strokeStyle = `rgba(90,140,255,${(1 - d / 120) * .25})`; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
      }
      const dm = Math.hypot(mouse.x - a.x, mouse.y - a.y);
      if (dm < 160) { cx.strokeStyle = `rgba(56,214,245,${(1 - dm / 160) * .5})`; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(mouse.x, mouse.y); cx.stroke(); }
      cx.fillStyle = "rgba(120,160,255,.8)"; cx.beginPath(); cx.arc(a.x, a.y, 1.3, 0, 6.283); cx.fill();
    }
  }
  fit(); addEventListener("resize", fit);
  new IntersectionObserver(([e]) => { heroOn = e.isIntersecting; }).observe(cv);
  if (reduce) drawNet(); else (function loop() { if (heroOn) drawNet(); requestAnimationFrame(loop); })();
  $(".hero").addEventListener("mousemove", e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  $(".hero").addEventListener("mouseleave", () => { mouse.x = mouse.y = -999; });

  /* ---------- halo lumineux sur les fiches ---------- */
  $$(".sheet").forEach(el => el.addEventListener("pointermove", e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", e.clientX - r.left + "px");
    el.style.setProperty("--my", e.clientY - r.top + "px");
  }));

  /* ---------- avant / après ---------- */
  const cmp = $("#compare"), range = $("#cmpRange");
  const setPos = v => cmp.style.setProperty("--pos", v + "%");
  range.addEventListener("input", () => setPos(range.value));
  // petite démo à l'apparition
  let shown = false;
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting || shown || reduce) return;
    shown = true; o.disconnect();
    const seq = [50, 18, 82, 35]; let i = 0;
    const t0 = performance.now();
    (function anim(t) {
      const seg = Math.floor((t - t0) / 700);
      if (seg >= seq.length - 1) { setPos(35); range.value = 35; return; }
      const k = ((t - t0) % 700) / 700, e2 = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const v = seq[seg] + (seq[seg + 1] - seq[seg]) * e2;
      setPos(v); range.value = v;
      requestAnimationFrame(anim);
    })(t0);
  }, { threshold: .5 }).observe(cmp);

  /* ---------- simulateur ---------- */
  const pages = $("#pages"), pagesOut = $("#pagesOut"), total = $("#total"), bar = $("#calcBar");
  const opts = $$("#calc input[type=checkbox]");
  let cur = 800, raf;
  function compute() {
    const p = +pages.value;
    pagesOut.textContent = p;
    pages.style.setProperty("--p", (p - 1) / 19 * 100 + "%");
    let sum = 800 + Math.max(0, p - 5) * 90;
    opts.forEach(o => { if (o.checked) sum += +o.dataset.price; });
    bar.style.width = Math.min(100, sum / 6000 * 100) + "%";
    cancelAnimationFrame(raf);
    const from = cur, t0 = performance.now();
    (function tick(t) {
      const k = reduce ? 1 : Math.min(1, (t - t0) / 400);
      cur = Math.round(from + (sum - from) * (1 - Math.pow(1 - k, 3)));
      total.textContent = cur.toLocaleString("fr-FR");
      if (k < 1) raf = requestAnimationFrame(tick);
    })(t0);
  }
  pages.addEventListener("input", compute);
  opts.forEach(o => o.addEventListener("change", compute));
  compute();

  $("#calcCta").addEventListener("click", () => {
    const chosen = opts.filter(o => o.checked).map(o => "- " + o.parentElement.querySelector("span").textContent);
    $("#f-msg").value = `Bonjour,\n\nEstimation faite sur votre site : environ ${total.textContent} € HT.\n- ${pages.value} pages\n${chosen.join("\n")}\n\nMon projet : `;
  });
  const typeSel = $("#f-type");
  const pick = label => [...typeSel.options].forEach(o => { if (o.text === label) typeSel.value = o.value; });
  $$("[data-plan]").forEach(b => b.addEventListener("click", () => pick(b.dataset.plan)));
  $$(".svc[data-type]").forEach(b => b.addEventListener("click", () => pick(b.dataset.type)));

  /* ---------- formulaire ---------- */
  // ⚠️ Remplacez par votre adresse email réelle :
  const CONTACT_EMAIL = "contact@corpus-hovdjo.fr";
  const form = $("#form"), msg = $("#formMsg");
  form.addEventListener("submit", e => {
    e.preventDefault();
    let ok = true;
    ["f-name", "f-email", "f-msg"].forEach(id => {
      const f = $("#" + id);
      const bad = !f.value.trim() || (f.type === "email" && !/^\S+@\S+\.\S+$/.test(f.value));
      f.closest(".fld").classList.toggle("error", bad);
      if (bad) ok = false;
    });
    const c = $("#f-consent");
    c.closest(".chk").classList.toggle("error", !c.checked);
    if (!c.checked) ok = false;
    if (!ok) { msg.className = "form__msg err"; msg.textContent = "Merci de remplir les champs en rouge et de cocher la case de consentement."; return; }
    const v = id => $("#" + id).value || "-";
    const subject = `Demande de devis — ${v("f-type")}`;
    const body = `Nom : ${v("f-name")}\nEntreprise : ${v("f-company")}\nEmail : ${v("f-email")}\nTéléphone : ${v("f-tel")}\nProjet : ${v("f-type")}\nBudget : ${v("f-budget")}\n\n${v("f-msg")}`;
    location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    msg.className = "form__msg";
    msg.textContent = "Votre messagerie s'ouvre avec la demande prête à envoyer.";
  });
})();

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

  /* ---------- PLAN → RENDU ---------- */
  const bp = $("#blueprint"), plan = $("#plan"), render = $("#render");
  // le plan est une copie exacte du rendu : mêmes positions, stylée en traits
  const clone = $(".ms", render).cloneNode(true);
  plan.prepend(clone);
  const drawables = $$(".ms-nav, .ms-logo, .ms-links i, .ms-btn, .ms-eyebrow, .ms-h, .ms-p, .ms-cta, .ms-img, .ms-cards > div", clone);
  drawables.forEach((el, i) => { el.classList.add("draw"); el.style.setProperty("--dl", i * .08 + "s"); });
  $$(".dim", plan).forEach((d, i) => d.style.setProperty("--dl", 0.6 + i * .15 + "s"));

  const toggles = $$(".toggle button");
  let auto = true, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  function setBtn(v) { toggles.forEach(b => b.classList.toggle("on", b.dataset.view === v)); }
  function showPlan() {
    bp.classList.remove("rendered", "scanning", "drawn");
    setBtn("plan");
    // relance l'animation de tracé
    void bp.offsetWidth;
    requestAnimationFrame(() => bp.classList.add("drawn"));
  }
  function showRender() {
    bp.classList.add("drawn", "scanning");
    requestAnimationFrame(() => bp.classList.add("rendered"));
    setBtn("rendu");
    later(() => bp.classList.remove("scanning"), 1600);
  }
  function cycle() {
    if (!auto) return;
    showPlan();
    later(showRender, 3600);
    later(cycle, 9000);
  }
  toggles.forEach(b => b.addEventListener("click", () => {
    auto = false; clear();
    b.dataset.view === "plan" ? showPlan() : showRender();
  }));
  if (reduce) { bp.classList.add("drawn"); auto = false; }
  else {
    const bio = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && auto && !timers.length) cycle();
      if (!e.isIntersecting && auto) clear();
    }, { threshold: .3 });
    bio.observe(bp);
  }

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

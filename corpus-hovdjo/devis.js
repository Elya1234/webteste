/* =========================================================
   CORPUS HOVDJO — configurateur de devis
   ========================================================= */
(() => {
  "use strict";
  // ⚠️ Remplacez par vos vraies coordonnées :
  const WHATSAPP = "33600000000";            // numéro au format international, sans + ni espaces
  const CONTACT_EMAIL = "contact@corpus-hovdjo.fr";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = n => Math.round(n).toLocaleString("fr-FR");

  const TYPES = {
    vitrine:     { label: "Site de présentation", base: 800 },
    ecommerce:   { label: "Site commercial (e-commerce)", base: 2400, includes: "shop" },
    reservation: { label: "Site avec réservation", base: 1100, includes: "booking" },
    refonte:     { label: "Refonte de site", base: 800 },
  };
  const SECTORS = {
    restaurant: { label: "Restaurant", h: "Une cuisine de saison, faite maison", cta: "Réserver une table", img: "linear-gradient(135deg,#7a4a22,#e8b04a)" },
    commerce:   { label: "Boutique", h: "Les nouveautés de la saison sont arrivées", cta: "Voir la boutique", img: "linear-gradient(135deg,#ff8fab,#7b61ff)" },
    artisan:    { label: "Artisan", h: "Un savoir-faire local, des finitions impeccables", cta: "Demander un devis", img: "linear-gradient(135deg,#c98b52,#5e3518)" },
    sante:      { label: "Bien-être", h: "Prenez soin de vous, on s'occupe du reste", cta: "Prendre rendez-vous", img: "linear-gradient(135deg,#7dd3c0,#2a7f8f)" },
    services:   { label: "Services", h: "Des experts à vos côtés pour faire grandir votre activité", cta: "Nous contacter", img: "linear-gradient(135deg,#5c94ff,#1f2a55)" },
    autre:      { label: "Bienvenue", h: "Bienvenue sur votre futur site", cta: "Découvrir", img: "linear-gradient(135deg,#8b80f9,#5c94ff)" },
  };
  const STYLES = { moderne: "Moderne", elegant: "Élégant", colore: "Coloré" };
  const FEAT_LABEL = { blog: "Blog / actualités", booking: "Réservation en ligne", shop: "Boutique en ligne", lang: "Site multilingue", seo: "Référencement avancé", text: "Rédaction des textes", logo: "Création du logo", wa: "Bouton WhatsApp" };

  /* ---------- état ---------- */
  const pv = $("#pv");
  const optInputs = $$("#opts input");
  const pageInputs = $$("#pages input");
  let step = 0, shownTotal = 800, raf;

  function state() {
    const type = $('input[name="type"]:checked').value;
    const sector = $("#sector").value;
    const style = $('input[name="style"]:checked').value;
    const pages = pageInputs.filter(i => i.checked).map(i => i.value);
    const feats = optInputs.filter(i => i.checked && !i.disabled).map(i => i.value);
    const included = TYPES[type].includes;
    const all = new Set(feats); if (included) all.add(included);
    return {
      type, sector, style, pages, feats, all, included,
      name: $("#bizName").value.trim(),
      premium: $("#premium").checked,
      express: $('input[name="delay"]:checked').value === "express",
      maint: +$('input[name="maint"]:checked').value,
    };
  }

  function price(s) {
    const lines = [[TYPES[s.type].label, TYPES[s.type].base]];
    const extra = Math.max(0, s.pages.length + (s.all.has("blog") ? 1 : 0) - 5);
    if (extra) lines.push([`${extra} page${extra > 1 ? "s" : ""} supplémentaire${extra > 1 ? "s" : ""}`, extra * 90]);
    if (s.premium) lines.push(["Design premium & animations", 350]);
    s.feats.forEach(f => lines.push([FEAT_LABEL[f], +$(`#opts input[value="${f}"]`).dataset.price]));
    let sub = lines.reduce((a, l) => a + l[1], 0);
    if (s.express) { const x = Math.round(sub * .25); lines.push(["Délai express (+25 %)", x]); sub += x; }
    let weeks = 1.5 + Math.max(0, s.pages.length - 5) * .25 + (s.all.has("shop") ? 2.5 : 0) + (s.all.has("booking") ? .5 : 0) + (s.all.has("lang") ? .5 : 0) + (s.premium ? .5 : 0);
    if (s.express) weeks *= .6;
    return { lines, total: sub, weeks: Math.max(1, Math.round(weeks)) };
  }

  /* ---------- aperçu ---------- */
  const slug = t => (t || "votre-entreprise").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "votre-entreprise";
  let prevSig = "";
  function renderPreview(s) {
    const sec = SECTORS[s.sector];
    const name = s.name || "Votre entreprise";
    pv.dataset.style = s.style;
    $("#pvLogo").textContent = name;
    $("#pvFootName").textContent = `© ${new Date().getFullYear()} ${name}`;
    $("#pvUrl").textContent = slug(s.name) + ".fr";
    $("#pvSector").textContent = sec.label;
    $("#pvH").textContent = sec.h;
    $("#pvCta").textContent = s.all.has("booking") ? "Réserver" : s.all.has("shop") ? "Voir la boutique" : sec.cta;
    $("#pvImg").style.background = sec.img;

    const links = s.pages.filter(p => p !== "Accueil").concat(s.all.has("blog") ? ["Blog"] : []);
    const linksEl = $("#pvLinks");
    const sig = links.join("|");
    if (sig !== linksEl.dataset.sig) {
      linksEl.dataset.sig = sig;
      linksEl.innerHTML = links.map((l, i) => `<i style="animation-delay:${i * 40}ms">${l}</i>`).join("");
    }
    pv.classList.toggle("has-lang", s.all.has("lang"));
    pv.classList.toggle("has-shop", s.all.has("shop"));
    pv.classList.toggle("has-wa", s.all.has("wa"));
    pv.classList.toggle("is-premium", s.premium);

    const map = { pvShop: s.all.has("shop"), pvBooking: s.all.has("booking"), pvServices: s.pages.includes("Services"),
      pvGallery: s.pages.includes("Galerie"), pvPrices: s.pages.includes("Tarifs"), pvReviews: s.pages.includes("Avis clients"), pvBlog: s.all.has("blog") };
    let newest = null;
    Object.entries(map).forEach(([id, on]) => {
      const el = $("#" + id);
      if (on && !el.classList.contains("show")) newest = el;
      el.classList.toggle("show", on);
    });
    // fait défiler l'aperçu vers l'élément qui vient d'apparaître
    const nowSig = JSON.stringify([s.style, s.sector, s.type]);
    if (newest) pv.scrollTo({ top: newest.offsetTop - 60, behavior: reduce ? "auto" : "smooth" });
    else if (nowSig !== prevSig) { pv.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); pv.classList.remove("flash"); void pv.offsetWidth; pv.classList.add("flash"); }
    prevSig = nowSig;
  }

  /* ---------- prix ---------- */
  function renderPrice(s) {
    const p = price(s);
    $("#lines").innerHTML = p.lines.map(([l, v]) => `<li><span>${l}</span><span>${v ? "+" + fmt(v) + " €" : "inclus"}</span></li>`).join("");
    $("#weeks").textContent = `≈ ${p.weeks} semaine${p.weeks > 1 ? "s" : ""}`;
    $("#split").textContent = `ou 3 × ${fmt(Math.ceil(p.total / 3))} € sans frais`;
    $("#maintLine").textContent = s.maint ? `+ suivi ${s.maint} €/mois (sans engagement)` : "Sans suivi mensuel";
    cancelAnimationFrame(raf);
    const from = shownTotal, to = p.total, t0 = performance.now(), dur = reduce ? 1 : 600;
    (function tick(t) {
      const k = Math.min(1, (t - t0) / dur);
      shownTotal = from + (to - from) * (1 - Math.pow(1 - k, 3));
      $("#total").textContent = fmt(shownTotal);
      if (k < 1) raf = requestAnimationFrame(tick);
    })(t0);
    // pages
    const n = s.pages.length + (s.all.has("blog") ? 1 : 0), extra = Math.max(0, n - 5);
    $("#pageCount").textContent = n;
    $("#pageExtra").textContent = extra ? `${extra} en supplément (+${extra * 90} €)` : "incluses";
    return p;
  }

  function recapText(s, p) {
    const L = [];
    L.push(`Projet      : ${TYPES[s.type].label}`);
    if (s.name) L.push(`Entreprise  : ${s.name}`);
    L.push(`Secteur     : ${$("#sector").selectedOptions[0].text}`);
    L.push(`Pages (${s.pages.length})  : ${s.pages.join(", ")}`);
    L.push(`Style       : ${STYLES[s.style]}${s.premium ? " + design premium" : ""}`);
    const opts = [...s.all].map(f => FEAT_LABEL[f]);
    L.push(`Options     : ${opts.length ? opts.join(", ") : "aucune"}`);
    L.push(`Délai       : ${s.express ? "express" : "standard"} (≈ ${p.weeks} sem.)`);
    L.push(`Suivi       : ${s.maint ? s.maint + " €/mois" : "aucun"}`);
    L.push(`ESTIMATION  : ${fmt(p.total)} € HT`);
    return L.join("\n");
  }

  function update() {
    const s = state();
    // options incluses dans le type choisi
    optInputs.forEach(i => {
      const inc = s.included === i.value;
      i.disabled = inc;
      if (inc) i.checked = true;
      const lab = i.closest(".dv-opt");
      lab.classList.toggle("is-included", inc);
      lab.querySelector("em").textContent = inc ? "inclus" : "+" + fmt(+i.dataset.price) + " €";
    });
    const s2 = state();
    renderPreview(s2);
    const p = renderPrice(s2);
    $("#recap").textContent = recapText(s2, p);
    updateLinks(s2, p);
  }

  /* ---------- envoi ---------- */
  function message(s, p) {
    const who = [$("#cName").value.trim(), $("#cTel").value.trim(), $("#cEmail").value.trim()].filter(Boolean).join(" · ");
    const note = $("#cMsg").value.trim();
    return `Bonjour Corpus Hovdjo, je souhaite un devis :\n\n${recapText(s, p)}\n\n${who ? "Contact : " + who + "\n" : ""}${note ? "Message : " + note : ""}`.trim();
  }
  function updateLinks(s, p) {
    const msg = message(s, p);
    $("#sendWa").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
    $("#sendMail").href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Demande de devis — " + TYPES[s.type].label)}&body=${encodeURIComponent(msg)}`;
    $("#waFloat").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Bonjour, je souhaite un devis pour mon site internet.")}`;
  }
  function validate() {
    const err = $("#sendErr");
    const nameOk = !!$("#cName").value.trim();
    const email = $("#cEmail").value.trim();
    const emailOk = /^\S+@\S+\.\S+$/.test(email);
    $("#cName").closest(".dv-field").classList.toggle("error", !nameOk);
    $("#cEmail").closest(".dv-field").classList.toggle("error", !emailOk);
    if (!nameOk || !emailOk) { err.className = "dv-error"; err.textContent = "Indiquez votre nom et un email valide pour envoyer la demande."; return false; }
    err.className = "dv-error ok"; err.textContent = "Votre demande est prête. Envoyez-la, nous répondons sous 24 h.";
    return true;
  }
  ["#sendWa", "#sendMail"].forEach(sel => $(sel).addEventListener("click", e => { if (!validate()) e.preventDefault(); }));
  $("#copyRecap").addEventListener("click", () => {
    const txt = message(state(), price(state()));
    const done = () => { $("#sendErr").className = "dv-error ok"; $("#sendErr").textContent = "Récapitulatif copié."; };
    try {
      navigator.clipboard.writeText(txt).then(done, () => selectRecap());
    } catch (e) { selectRecap(); }
  });
  function selectRecap() {
    const r = document.createRange(); r.selectNodeContents($("#recap"));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    $("#sendErr").className = "dv-error ok"; $("#sendErr").textContent = "Récapitulatif sélectionné : copiez-le avec Ctrl+C.";
  }

  /* ---------- navigation entre étapes ---------- */
  const stepsEl = $$(".dv-step"), progBtns = $$("#progress button");
  function go(n) {
    step = Math.max(0, Math.min(stepsEl.length - 1, n));
    stepsEl.forEach((el, i) => el.classList.toggle("on", i === step));
    progBtns.forEach((b, i) => { b.classList.toggle("on", i === step); b.classList.toggle("done", i < step); });
    $("#progressBar").style.width = ((step + 1) / stepsEl.length) * 100 + "%";
    $("#prev").hidden = step === 0;
    $("#next").hidden = step === stepsEl.length - 1;
    if (step === stepsEl.length - 1) update();
    const top = $(".dv-steps").getBoundingClientRect().top + scrollY - 90;
    if (scrollY > top) scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }
  $("#next").addEventListener("click", () => go(step + 1));
  $("#prev").addEventListener("click", () => go(step - 1));
  progBtns.forEach(b => b.addEventListener("click", () => go(+b.dataset.go)));

  document.addEventListener("input", e => { if (e.target.closest(".dv-steps")) update(); });
  document.addEventListener("change", e => { if (e.target.closest(".dv-steps")) update(); });

  /* ---------- préremplissage depuis le site (#essentiel, #business, #ecommerce…) ---------- */
  const preset = location.hash.slice(1);
  const pick = v => { const r = $(`input[name="type"][value="${v}"]`); if (r) r.checked = true; };
  if (preset === "ecommerce") pick("ecommerce");
  if (preset === "reservation") pick("reservation");
  if (preset === "refonte") pick("refonte");
  if (preset === "business") {
    $("#premium").checked = true;
    const b = optInputs.find(x => x.value === "blog"); if (b) b.checked = true;
  }

  update();
  go(0);
})();

/* Page /pages/admin : modifier les textes de l'écran sans compte Shopify.
 * Port de app/admin/page.tsx. Les réglages de départ sont ceux de l'éditeur de thème (lus sur la page d'accueil) ;
 * les modifications sont enregistrées sur cet appareil et peuvent être envoyées aux autres écrans par un lien. */
(function () {
  "use strict";
  var K_OVERRIDE = "sd.override.v1", K_AUTH = "sd.admin.until";
  var home = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* mode privé */ } }
  };

  var ZMANIM = [
    ["alot", "Alot HaShahar", [["alot16.1", "Hebcal – 16,1° sous l'horizon"], ["alot_bht", "Baal HaTanya"]]],
    ["misheyakir", "Début Talit & Téfilines (Misheyakir)", [["mish11.5", "Hebcal – 11,5°"], ["mish10.2", "Hebcal – 10,2° (Machmir)"]]],
    ["sunrise", "Hanetz HaHama", [["sunrise", "Lever du soleil (Hebcal)"]]],
    ["shemaMGA", "Sof Zman Shema – Maguen Avraham", [["mga16.1", "MGA – 16,1°"], ["mga72", "MGA – 72 min fixes"], ["mga19.8", "MGA – 19,8°"]]],
    ["shemaGRA", "Sof Zman Shema – Gra", [["gra", "GR\"A (lever → coucher)"], ["bht", "Baal HaTanya"]]],
    ["tefilaMGA", "Sof Zman Tefila – Maguen Avraham", [["mga16.1", "MGA – 16,1°"], ["mga72", "MGA – 72 min fixes"], ["mga19.8", "MGA – 19,8°"]]],
    ["tefilaGRA", "Sof Zman Tefila – Gra", [["gra", "GR\"A"], ["bht", "Baal HaTanya"]]],
    ["chatzot", "Hatsot HaYom", [["chatzot", "Milieu du jour (Hebcal)"]]],
    ["minchaG", "Minha Guedola", [["gra", "GR\"A – 6,5 h zmaniyot"], ["mga", "MGA"], ["chatzot30", "Hatsot + 30 min (dérivé, à faire valider par le Rav)"]]],
    ["minchaK", "Minha Ketana", [["gra", "GR\"A – 9,5 h zmaniyot"], ["mga", "MGA"]]],
    ["plag", "Plag HaMinha", [["gra", "GR\"A – 10,75 h zmaniyot"], ["bht", "Baal HaTanya"]]],
    ["sunset", "Shkiat HaHama", [["sunset", "Coucher du soleil (Hebcal)"]]],
    ["tzeit", "Tzeit HaKokhavim", [["deg7.083", "7,083°"], ["deg8.5", "8,5°"], ["min42", "Coucher + 42 min"], ["min50", "Coucher + 50 min"], ["min72", "Coucher + 72 min"]]],
    ["rt", "Rabbenou Tam", [["rt72", "Coucher + 72 min fixes (Hebcal)"], ["rt72z", "72 min zmaniyot (dérivé, à faire valider par le Rav)"]]],
    ["chatzotNight", "Hatsot Laila", [["chatzotNight", "Milieu de la nuit (Hebcal)"]]]
  ];
  var CITIES = [["2988507", "Paris"], ["2995469", "Marseille"], ["2996944", "Lyon"], ["2990440", "Nice"], ["2973783", "Strasbourg"],
    ["2972315", "Toulouse"], ["3031582", "Bordeaux"], ["2992166", "Montpellier"], ["2990969", "Nantes"], ["2998324", "Lille"],
    ["2968254", "Villeurbanne"], ["2976043", "Sarcelles"], ["2660646", "Genève"], ["2800866", "Bruxelles"], ["2803138", "Anvers"],
    ["281184", "Jérusalem"], ["293397", "Tel-Aviv"], ["294801", "Haïfa"], ["294071", "Netanya"], ["5128581", "New York"],
    ["2643743", "Londres"], ["6077243", "Montréal"]];

  var base = null, s = null;

  function sha256(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (b) {
      return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    });
  }
  function loadBase() {
    return fetch(home + "?sd-admin=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (html) {
      var m = html.match(/<script type="application\/json" id="sd-config">([\s\S]*?)<\/script>/);
      if (!m) throw new Error("Réglages de l'écran introuvables sur la page d'accueil.");
      return JSON.parse(m[1]);
    });
  }
  function current() {
    var ov = null; try { ov = JSON.parse(store.get(K_OVERRIDE) || "null"); } catch (e) { ov = null; }
    var c = Object.assign({}, base, ov || {});
    // ajoute les zmanim que la sauvegarde ne connaît pas (masqués), pour pouvoir les réactiver
    c.zmanim = (c.zmanim || []).map(function (z) { return { id: z.id, method: z.method, visible: z.visible !== false }; });
    ZMANIM.forEach(function (d) { if (!c.zmanim.some(function (z) { return z.id === d[0]; })) c.zmanim.push({ id: d[0], method: d[2][0][0], visible: false }); });
    c.prayers = (c.prayers || []).map(function (p) { return Object.assign({}, p); });
    c.announcements = (c.announcements || []).slice();
    return c;
  }
  // ce que l'écran doit recevoir : uniquement les textes et réglages modifiables (jamais le code)
  function payload() {
    return { name: s.name, nameHe: s.nameHe, geonameid: Number(s.geonameid) || 2988507, cityLabel: s.cityLabel || "",
      elevation: !!s.elevation, candleMinutes: Number(s.candleMinutes), havdalah: s.havdalah || "",
      validatedByRav: !!s.validatedByRav, showSeconds: !!s.showSeconds, showCountdown: !!s.showCountdown,
      dedication: s.dedication || "", dedicationNames: s.dedicationNames || "",
      dedication: s.dedication || "", dedicationNames: s.dedicationNames || "",
      prayers: s.prayers.map(function (p) { return { id: p.id, group: p.group, label: p.label, labelHe: p.labelHe, times: p.times }; }),
      announcements: s.announcements.filter(function (a) { return a.trim(); }).slice(0, 3),
      zmanim: s.zmanim.filter(function (z) { return z.visible; }).map(function (z) { return { id: z.id, method: z.method }; }) };
  }
  function shareLink() {
    var json = JSON.stringify(payload());
    var b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return window.location.origin + home + "#sd=" + b64;
  }

  /* ───────── Connexion ───────── */
  function unlock() { $("sd-login").hidden = true; $("sd-panel").hidden = false; s = current(); render(); }
  loadBase().then(function (b) {
    base = b;
    if (Number(store.get(K_AUTH) || 0) > Date.now()) unlock();
  }).catch(function (e) { $("sd-err").textContent = e.message; });
  $("sd-login").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!base) { $("sd-err").textContent = "Chargement… réessayez dans un instant."; return; }
    sha256($("sd-code").value.trim()).then(function (h) {
      if (h !== base.adminCodeHash) { $("sd-err").textContent = "Code incorrect."; return; }
      store.set(K_AUTH, String(Date.now() + 12 * 3600 * 1000)); unlock();
    });
  });

  /* ───────── Formulaire ───────── */
  var GROUP = { weekday: "Semaine", friday: "Vendredi", shabbat: "Chabbat" };
  function render() {
    var known = CITIES.some(function (c) { return c[0] === String(s.geonameid); });
    var h = '<div class="sd-top"><h1>Administration</h1><button type="button" class="sd-link" data-act="logout">Se déconnecter</button></div>' +
      '<p class="sd-muted">Enregistrer applique les changements à l\'écran ouvert sur <b>cet appareil</b>. Pour une autre télévision, utilisez « Copier le lien pour un autre écran » et ouvrez ce lien sur la télévision.</p>';

    h += '<section class="sd-card"><h2>Synagogue</h2>' +
      '<input class="sd-in" data-k="name" value="' + esc(s.name) + '" placeholder="Nom (français)">' +
      '<input class="sd-in" data-k="nameHe" dir="rtl" value="' + esc(s.nameHe) + '" placeholder="שם בית הכנסת"></section>';

    h += '<section class="sd-card"><h2>Ville & Chabbat</h2><label class="sd-lab">Ville<select class="sd-in" data-k="city">' +
      CITIES.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === String(s.geonameid) ? " selected" : "") + ">" + c[1] + "</option>"; }).join("") +
      '<option value="other"' + (known ? "" : " selected") + '>Autre ville (identifiant GeoNames)…</option></select></label>' +
      (known ? "" : '<label class="sd-lab">Identifiant GeoNames<input class="sd-in" data-k="geonameid" inputmode="numeric" value="' + esc(s.geonameid) + '"><span class="sd-help">Trouvez-le sur hebcal.com/zmanim : il apparaît dans l\'adresse (geonameid=…).</span></label>') +
      '<label class="sd-lab">Nom de ville affiché (facultatif)<input class="sd-in" data-k="cityLabel" value="' + esc(s.cityLabel) + '"></label>' +
      '<label class="sd-chk"><input type="checkbox" data-k="elevation"' + (s.elevation ? " checked" : "") + "> Tenir compte de l'altitude (lever/coucher)</label>" +
      '<label class="sd-lab">Allumage des bougies : minutes avant le coucher<input class="sd-in" type="number" min="0" max="90" data-k="candleMinutes" value="' + esc(s.candleMinutes) + '"></label>' +
      '<label class="sd-lab">Sortie de Chabbat<select class="sd-in" data-k="havdalah">' +
      [["", "Tzeit 8,5° (Hebcal par défaut)"], ["42", "Coucher + 42 min"], ["50", "Coucher + 50 min"], ["72", "Coucher + 72 min"]].map(function (o) {
        return '<option value="' + o[0] + '"' + (String(s.havdalah || "") === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label></section>";

    h += '<section class="sd-card"><h2>Horaires des offices</h2>';
    s.prayers.forEach(function (p, i) {
      h += '<div class="sd-prayer"><div class="sd-row2"><select class="sd-in" data-p="' + i + '" data-f="group">' +
        Object.keys(GROUP).map(function (g) { return '<option value="' + g + '"' + (p.group === g ? " selected" : "") + ">" + GROUP[g] + "</option>"; }).join("") +
        '</select><button type="button" class="sd-mini" data-act="delp" data-i="' + i + '" aria-label="Supprimer">✕</button></div>' +
        '<div class="sd-row2"><input class="sd-in" data-p="' + i + '" data-f="label" value="' + esc(p.label) + '" placeholder="Nom (ex. Chaharit)">' +
        '<input class="sd-in" dir="rtl" data-p="' + i + '" data-f="labelHe" value="' + esc(p.labelHe) + '" placeholder="שחרית"></div>' +
        '<input class="sd-in" data-p="' + i + '" data-f="times" value="' + esc(p.times) + '" placeholder="07:00 / 08:00 / 08:45"></div>';
    });
    h += '<button type="button" class="sd-btn sd-ghost" data-act="addp">+ Ajouter un office</button><p class="sd-help">Format HH:MM, séparés par « / ». Une heure invalide n\'est pas affichée.</p></section>';

    h += '<section class="sd-card"><h2>Dédicace (bas de l\'écran)</h2>' +
      '<label class="sd-lab">Ligne principale (grande)<input class="sd-in" dir="rtl" data-k="dedication" value="' + esc(s.dedication) + '" placeholder="לעלוי נשמת…"></label>' +
      '<label class="sd-lab">Noms (plus petits, un par ligne)<textarea class="sd-in" dir="rtl" rows="3" data-k="dedicationNames">' + esc(s.dedicationNames) + "</textarea></label></section>";

    h += '<section class="sd-card"><h2>Dédicace (bas de l\'écran)</h2>' +
      '<label class="sd-lab">Ligne principale (grande)<input class="sd-in" dir="rtl" data-k="dedication" value="' + esc(s.dedication) + '" placeholder="לעלוי נשמת…"></label>' +
      '<label class="sd-lab">Noms (plus petits, un par ligne)<textarea class="sd-in" dir="rtl" rows="3" data-k="dedicationNames">' + esc(s.dedicationNames) + "</textarea></label></section>";

    h += '<section class="sd-card"><h2>Annonces</h2><textarea class="sd-in" rows="4" data-k="announcements" placeholder="Une annonce par ligne (3 maximum)">' +
      esc(s.announcements.join("\n")) + "</textarea>" +
      '<label class="sd-chk"><input type="checkbox" data-k="showSeconds"' + (s.showSeconds ? " checked" : "") + "> Afficher les secondes</label>" +
      '<label class="sd-chk"><input type="checkbox" data-k="showCountdown"' + (s.showCountdown ? " checked" : "") + "> Compte à rebours avant le prochain office</label></section>";

    h += '<section class="sd-card"><h2>Zmanim : méthodes & affichage</h2><p class="sd-muted">Les heures viennent toujours de Hebcal. Choisissez la méthode validée par votre Rav.</p>';
    s.zmanim.forEach(function (z, i) {
      var d = ZMANIM.find(function (x) { return x[0] === z.id; }); if (!d) return;
      h += '<div class="sd-z"><div class="sd-row2"><label class="sd-chk sd-grow"><input type="checkbox" data-z="' + i + '" data-f="visible"' + (z.visible ? " checked" : "") + "> " + d[1] + "</label>" +
        '<button type="button" class="sd-mini" data-act="up" data-i="' + i + '" aria-label="Monter">↑</button><button type="button" class="sd-mini" data-act="down" data-i="' + i + '" aria-label="Descendre">↓</button></div>' +
        (d[2].length > 1 ? '<select class="sd-in" data-z="' + i + '" data-f="method">' + d[2].map(function (m) {
          return '<option value="' + m[0] + '"' + (z.method === m[0] ? " selected" : "") + ">" + m[1] + "</option>"; }).join("") + "</select>" : "") + "</div>";
    });
    h += '<label class="sd-chk"><input type="checkbox" data-k="validatedByRav"' + (s.validatedByRav ? " checked" : "") + "> Méthodes validées par le Rav</label></section>";

    h += '<section class="sd-card"><h2>Autres écrans</h2><button type="button" class="sd-btn sd-ghost sd-full" data-act="share">Copier le lien pour un autre écran</button>' +
      '<input class="sd-in" id="sd-share" readonly hidden><button type="button" class="sd-link" data-act="reset">Revenir aux réglages d\'origine (thème Shopify)</button></section>';

    h += '<div class="sd-bar"><a class="sd-btn sd-ghost" href="' + home + '" target="_blank">Voir l\'écran</a><button type="button" class="sd-btn" data-act="save" id="sd-save">Enregistrer</button></div>';
    $("sd-panel").innerHTML = h;
  }

  function dirty() { var b = $("sd-save"); if (b) b.textContent = "Enregistrer"; }
  $("sd-panel").addEventListener("input", function (e) {
    var t = e.target, k = t.dataset.k;
    if (t.dataset.p != null) s.prayers[+t.dataset.p][t.dataset.f] = t.value;
    else if (t.dataset.z != null) s.zmanim[+t.dataset.z][t.dataset.f] = t.type === "checkbox" ? t.checked : t.value;
    else if (k === "announcements") s.announcements = t.value.split("\n").slice(0, 3);
    else if (k === "city") { if (t.value !== "other") s.geonameid = Number(t.value); else s.geonameid = ""; render(); }
    else if (k === "candleMinutes") s.candleMinutes = Math.max(0, Math.min(90, Number(t.value) || 0));
    else if (k) s[k] = t.type === "checkbox" ? t.checked : t.value;
    dirty();
  });
  $("sd-panel").addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) return;
    var i = Number(t.dataset.i), act = t.dataset.act;
    if (act === "up" || act === "down") { var j = act === "up" ? i - 1 : i + 1; if (j < 0 || j >= s.zmanim.length) return; var x = s.zmanim[i]; s.zmanim[i] = s.zmanim[j]; s.zmanim[j] = x; render(); dirty(); }
    if (act === "delp") { s.prayers.splice(i, 1); render(); dirty(); }
    if (act === "addp") { s.prayers.push({ id: "p" + Date.now(), group: "weekday", label: "", labelHe: "", times: "" }); render(); dirty(); }
    if (act === "save") {
      if (!(Number(s.geonameid) > 0)) { alert("Indiquez l'identifiant GeoNames de la ville."); return; }
      var ok = store.set(K_OVERRIDE, JSON.stringify(payload()));
      t.textContent = ok ? "Enregistré ✓" : "Impossible d'enregistrer (navigation privée ?)";
    }
    if (act === "share") {
      var url = shareLink(), box = $("sd-share"); box.hidden = false; box.value = url; box.select();
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { t.textContent = "Lien copié ✓ : ouvrez-le sur la télévision"; },
        function () { t.textContent = "Copiez le lien ci-dessous et ouvrez-le sur la télévision"; });
    }
    if (act === "reset" && confirm("Effacer les modifications faites sur cet appareil ?")) { store.del(K_OVERRIDE); s = current(); render(); }
    if (act === "logout") { store.del(K_AUTH); window.location.href = home; }
  });
})();

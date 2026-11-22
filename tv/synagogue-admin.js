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

  // Réglages de départ : ceux de la page d'accueil si on peut les lire ; sinon on se contente de la base
  // partagée (son adresse est aussi écrite dans cette page), pour que l'administration marche toujours.
  function loadBase() {
    var own = {};
    try { own = JSON.parse(($("sd-admin-config") || {}).textContent || "{}"); } catch (e) { own = {}; }
    return fetch(home + "?sd-admin=" + Date.now(), { cache: "no-store", credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (html) {
      var m = html.match(/<script type="application\/json" id="sd-config">([\s\S]*?)<\/script>/);
      return Object.assign(m ? JSON.parse(m[1]) : {}, own.remoteUrl ? { remoteUrl: own.remoteUrl } : {});
    }, function () { return own; });
  }
  /* Base partagée (Google Apps Script) : le code est vérifié côté Google, pas dans le téléphone. */
  var remote = null, code = "";
  function api(body) {
    // envoi en text/plain : pas de requête préalable CORS, accepté par Google Apps Script
    return fetch(base.remoteUrl, { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function loadRemote() {
    if (!base.remoteUrl) return Promise.resolve(null);
    return fetch(base.remoteUrl + (base.remoteUrl.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? j.settings : null; });
  }
  function current() {
    var c = Object.assign({}, base, remote || {});
    c.useSchedule = !(remote && remote.useSchedule === false);
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
      dedication: s.dedication || "", dedicationNames: s.dedicationNames || "", useSchedule: s.useSchedule !== false,
      sponsor: s.sponsor || "", sponsorContact: s.sponsorContact || "", background: s.background || "photo", reloadTimes: s.reloadTimes || "04:00 / 07:00",
      prayers: s.prayers.map(function (p) { return { id: p.id, group: p.group, label: p.label, labelHe: p.labelHe, times: p.times }; }),
      announcements: s.announcements.filter(function (a) { return a.trim(); }).slice(0, 3),
      zmanim: s.zmanim.filter(function (z) { return z.visible; }).map(function (z) { return { id: z.id, method: z.method }; }) };
  }

  /* ───────── Lecture de la feuille des horaires (PDF) ─────────
   * Le PDF dessine chaque case du tableau : une case fusionnée (ex. Minha sur 3 jours) est un seul rectangle.
   * On range chaque texte dans la plus petite case qui le contient, puis chaque case s'applique
   * à toutes les lignes de dates qu'elle recouvre. */
  function parseSheet(pdfjsLib, data, today) {
    var OPS = pdfjsLib.OPS;
    var mul = function (a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; };
    var pt = function (m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };
    var norm = function (s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase(); };
    var clean = function (s) { return String(s).replace(/\s+/g, " ").replace(/\s+([.,:])/g, "$1").trim(); };
    var hhmm = function (h, m) { return String(h).padStart(2, "0") + ":" + m; };
    var timesIn = function (s) { var r = [], re = /(\d{1,2})\s*[hH:]\s*(\d{2})/g, m; while ((m = re.exec(s))) if (+m[1] < 24 && +m[2] < 60) r.push(hhmm(+m[1], m[2])); return r; };
    var segs = function (s) { return clean(s).split(/(?:^|\s)-\s*/).map(function (x) { return x.replace(/^[\s\-.–]+|[\s.]+$/g, ""); }).filter(Boolean); };
    var nice = function (s) { // MAJUSCULES -> Majuscule
      return clean(s).replace(/[A-ZÀ-Ý][A-ZÀ-Ý'’\-]{2,}/g, function (w) { return w.charAt(0) + w.slice(1).toLowerCase().replace(/(-)(\S)/g, function (_, a, b) { return a + b.toUpperCase(); }); });
    };

    function readPage(page) {
      return Promise.all([page.getOperatorList(), page.getTextContent()]).then(function (r) {
        var ops = r[0], rects = [], ctm = [1, 0, 0, 1, 0, 0], stack = [];
        for (var i = 0; i < ops.fnArray.length; i++) {
          var f = ops.fnArray[i], a = ops.argsArray[i];
          if (f === OPS.save) stack.push(ctm);
          else if (f === OPS.restore) ctm = stack.pop() || ctm;
          else if (f === OPS.transform) ctm = mul(ctm, a);
          else if (f === OPS.constructPath && a[2]) {
            var mm = a[2], p1 = pt(ctm, mm[0], mm[2]), p2 = pt(ctm, mm[1], mm[3]);
            var R = { x0: Math.min(p1[0], p2[0]), x1: Math.max(p1[0], p2[0]), y0: Math.min(p1[1], p2[1]), y1: Math.max(p1[1], p2[1]), t: [] };
            if (R.x1 - R.x0 > 15 && R.y1 - R.y0 > 8 && R.x1 - R.x0 < page.view[2] * 0.9) rects.push(R);
          }
        }
        // doublons (contour + fond de la même case)
        rects = rects.filter(function (R, k) { return !rects.slice(0, k).some(function (Q) { return Math.abs(Q.x0 - R.x0) < 1 && Math.abs(Q.x1 - R.x1) < 1 && Math.abs(Q.y0 - R.y0) < 1 && Math.abs(Q.y1 - R.y1) < 1; }); });
        r[1].items.forEach(function (it) {
          if (!it.str || !it.str.trim()) return;
          var x = it.transform[4] + (it.width || 0) / 2, y = it.transform[5] + Math.abs(it.transform[3]) * 0.35, best = null;
          rects.forEach(function (R) { if (x >= R.x0 && x <= R.x1 && y >= R.y0 && y <= R.y1 && (!best || (R.x1 - R.x0) * (R.y1 - R.y0) < (best.x1 - best.x0) * (best.y1 - best.y0))) best = R; });
          if (best) best.t.push({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 });
        });
        rects.forEach(function (R) {
          R.t.sort(function (a, b) { return Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x; });
          var lines = [], cur = null;
          R.t.forEach(function (w) {
            if (!cur || Math.abs(cur.y - w.y) > 2) { cur = { y: w.y, s: "", end: 0 }; lines.push(cur); }
            else if (w.x - cur.end > 1 && !/\s$/.test(cur.s) && !/^\s/.test(w.s)) cur.s += " ";
            cur.s += w.s; cur.end = w.x + w.w;
          });
          R.lines = lines.map(function (l) { return clean(l.s); }).filter(Boolean);
          R.text = R.lines.join(" ");
        });
        return rects.filter(function (R) { return R.text; });
      });
    }

    var year0 = today.getFullYear(), month0 = today.getMonth() + 1;
    return pdfjsLib.getDocument({ data: data }).promise.then(function (doc) {
      var pages = []; for (var n = 1; n <= doc.numPages; n++) pages.push(n);
      return Promise.all(pages.map(function (n) { return doc.getPage(n).then(readPage); }));
    }).then(function (all) {
      var days = {}, warnings = [], cols = null;
      all.forEach(function (rects) {
        // colonnes : d'après l'en-tête de la page (sinon celui de la page précédente)
        var find = function (re) { return rects.find(function (R) { return re.test(norm(R.text)); }); };
        var hd = { date: find(/FRANCAIS/), ev: find(/^EVENEMENT/), ch: find(/^CHAHARIT/), mi: find(/^MINHA$/), ar: find(/^ARVIT$/), so: find(/^SORTIE/) };
        if (hd.date && hd.ch && hd.mi && hd.ar) cols = hd;
        if (!cols) return;
        var colOf = function (R) {
          var cx = (R.x0 + R.x1) / 2, k = null;
          ["date", "ev", "ch", "mi", "ar", "so"].forEach(function (c) { var H = cols[c]; if (H && cx >= H.x0 && cx <= H.x1) k = c; });
          return k;
        };
        var rows = rects.filter(function (R) { return colOf(R) === "date" && /(\d{1,2})\s*\/\s*(\d{1,2})/.test(R.text) && R !== cols.date; })
          .map(function (R) {
            var m = R.text.match(/(\d{1,2})\s*\/\s*(\d{1,2})/), d = +m[1], mo = +m[2], y = year0;
            if (mo - month0 > 6) y--; else if (month0 - mo > 6) y++;
            var iso = y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
            var rest = segs(R.text.replace(/^.*?\d{1,2}\s*\/\s*\d{1,2}\.?/, ""));
            return { R: R, cy: (R.y0 + R.y1) / 2, day: { date: iso }, notes: rest };
          });
        rects.forEach(function (R) {
          var c = colOf(R); if (!c || c === "date" || R === cols[c]) return;
          rows.forEach(function (row) { if (row.cy > R.y0 && row.cy < R.y1) (row[c] = row[c] || []).push(R); });
        });
        rows.forEach(function (row) {
          var d = row.day, txt = function (c) { return (row[c] || []).map(function (R) { return R.text; }).join(" "); };
          var wd = new Date(d.date + "T12:00:00Z").getUTCDay();
          var titles = row.notes.slice();
          // Événement : début du Talith (va sous Chaharit), le reste en titre
          var ev = (row.ev || []).map(function (R) { return R.lines; })[0] || [];
          var talith = "", evTxt = clean(ev.join(" "));
          var mt = evTxt.match(/D[ée]but\s+Talith[^0-9]*?(\d{1,2}\s*h\s*\d{2})/i);
          if (mt) { talith = clean(mt[0].replace(/\s*-\s*/g, " ")); evTxt = evTxt.replace(mt[0], ""); }
          segs(evTxt).forEach(function (x) { titles.push(x); });
          // Chaharit
          var ch = timesIn(txt("ch"));
          if (ch.length) d.chaharit = { times: ch }; else if (txt("ch")) d.chaharit = { times: [], text: clean(txt("ch")) };
          if (talith && d.chaharit) d.chaharit.note = talith.replace(/\s*à?\s*(\d{1,2})\s*h\s*(\d{2})/, " à $1h$2");
          // Minha : « MINHA à 17h50 » + le reste (cours, Séouda…) en note
          var mi = clean(txt("mi")), ms = segs(mi), mm = ms.filter(function (x) { return /^MINHA\b/i.test(x); })[0];
          if (mm && timesIn(mm).length) {
            d.minha = { times: timesIn(mm).slice(0, 1) };
            var other = ms.filter(function (x) { return x !== mm; })
              .map(function (x) { return x.replace(/(\d{1,2})\s*h\s*(\d{2})/g, "$1h$2").replace(/Chélichit\.\s*/i, "Chélichit ").replace(/\s*:\s*/, " "); });
            if (other.length) d.minha.note = other.map(nice).join(" · ");
          } else if (mi) { var t = timesIn(mi); d.minha = t.length ? { times: t.slice(0, 1) } : { times: [], text: mi }; }
          // Arvit
          var ar = clean(txt("ar"));
          if (/suivi/i.test(ar)) d.arvit = { times: [], text: "Suivi" }; else if (ar) { var ta = timesIn(ar); d.arvit = ta.length ? { times: ta.slice(0, 1) } : { times: [], text: ar }; }
          // Sortie
          var so = timesIn(txt("so"));
          if (so.length) { d.sortie = { times: so.slice(0, 1) }; d.sortieLabel = wd === 6 ? "Sortie de Chabbat" : "Sortie de fête"; }
          titles = titles.map(nice).filter(function (x) { return x && !/^(samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi)$/i.test(x); });
          if (titles.length) d.title = titles.join(" · ");
          if (!d.chaharit && !d.minha && !d.arvit) warnings.push("Ligne du " + d.date + " sans horaires");
          // ordre des clés comme dans le fichier des horaires
          var o = { date: d.date }; if (d.title) o.title = d.title;
          ["chaharit", "minha", "arvit", "sortie", "sortieLabel"].forEach(function (k) { if (d[k]) o[k] = d[k]; });
          days[d.date] = o;
        });
      });
      var list = Object.keys(days).sort().map(function (k) { return days[k]; });
      if (!list.length) warnings.push("Aucune date trouvée : ce PDF ne ressemble pas à la feuille des horaires.");
      return { days: list, warnings: warnings };
    });
  }

  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (ok, ko) {
      var sc = document.createElement("script"); sc.src = PDFJS + "pdf.min.js";
      sc.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); };
      sc.onerror = function () { ko(new Error("Impossible de charger le lecteur de PDF. Vérifiez Internet.")); };
      document.head.appendChild(sc);
    });
  }
  var sheet = null; // { name, days, warnings, status }
  var cell = function (c) { return c ? esc((c.times || []).join(" · ") || c.text || "") : ""; };
  function sheetHtml() {
    var h = '<section class="sd-card sd-upload"><h2>Nouvelle feuille des horaires (PDF)</h2>' +
      '<p class="sd-muted">Déposez le PDF des horaires : l\'écran le lit tout seul. Vérifiez le tableau, puis « Publier ».</p>' +
      '<input type="file" accept="application/pdf,.pdf" class="sd-in" data-act-file="pdf">';
    if (sheet && sheet.status) h += '<p class="sd-help">' + esc(sheet.status) + "</p>";
    if (sheet && sheet.days && sheet.days.length) {
      h += (sheet.warnings.length ? '<p class="sd-err">' + sheet.warnings.map(esc).join("<br>") + "</p>" : "") +
        '<p class="sd-muted"><b>' + sheet.days.length + " jours</b> du " + esc(fmtD(sheet.days[0].date)) + " au " + esc(fmtD(sheet.days[sheet.days.length - 1].date)) + "</p>" +
        '<div class="sd-sched"><table><tr><th>Date</th><th>Chaharit</th><th>Minha</th><th>Arvit</th><th>Sortie</th></tr>' +
        sheet.days.map(function (d) {
          return "<tr><td><b>" + esc(fmtD(d.date)) + "</b>" + (d.title ? "<br><small>" + esc(d.title) + "</small>" : "") + "</td><td>" + cell(d.chaharit) +
            "</td><td>" + cell(d.minha) + "</td><td>" + cell(d.arvit) + "</td><td>" + cell(d.sortie) + "</td></tr>";
        }).join("") + "</table></div>" +
        '<button type="button" class="sd-btn sd-full" data-act="pubsched"' + (sheet.published ? " disabled" : "") + ">" +
        (sheet.published ? "Publié ✓ (télés à jour dans 1 min)" : "Publier ces horaires sur les télés") + "</button>";
    }
    return h + "</section>";
  }
  function fmtD(iso) { return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso + "T12:00:00Z")); }
  function readSheet(file) {
    sheet = { name: file.name, days: [], warnings: [], status: "Lecture du PDF…" }; render();
    var buf;
    file.arrayBuffer().then(function (b) { buf = new Uint8Array(b); return loadPdfJs(); })
      .then(function (lib) { return parseSheet(lib, buf, new Date()); })
      .then(function (r) { sheet = { name: file.name, days: r.days, warnings: r.warnings, status: "" }; render(); })
      .catch(function (e) { sheet = { name: file.name, days: [], warnings: [], status: "Erreur : " + (e.message || "PDF illisible") }; render(); });
  }
  function publishSheet(btn) {
    btn.disabled = true; btn.textContent = "Publication…";
    var keepFrom = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    fetch(base.remoteUrl + (base.remoteUrl.indexOf("?") < 0 ? "?" : "&") + "what=schedule&t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.json(); }).catch(function () { return null; })
      .then(function (j) {
        var by = {};
        ((j && j.schedule && j.schedule.days) || []).forEach(function (d) { if (d.date >= keepFrom) by[d.date] = d; });
        sheet.days.forEach(function (d) { by[d.date] = d; });
        var days = Object.keys(by).sort().map(function (k) { return by[k]; });
        return api({ action: "saveSchedule", code: code, schedule: { source: sheet.name, days: days } });
      }).then(function (j) {
        if (j.ok) { sheet.published = true; render(); return; }
        btn.disabled = false;
        btn.textContent = /inconnue/i.test(j.error || "") ? "La base Google doit être mise à jour (nouveau Code.gs)" : "Erreur : " + (j.error || "non publié");
      }).catch(function () { btn.disabled = false; btn.textContent = "Pas de connexion, réessayez"; });
  }

  /* ───────── Connexion ───────── */
  function unlock() { $("sd-login").hidden = true; $("sd-panel").hidden = false; s = current(); render(); }
  store.del(K_OVERRIDE); store.del(K_AUTH); // anciens réglages « sur cet appareil »
  loadBase().then(function (b) {
    base = b;
    if (!base.remoteUrl) $("sd-err").textContent = "La base partagée n'est pas encore installée : les modifications ne peuvent pas encore être enregistrées.";
    return loadRemote().then(function (r) { remote = r; }, function () { $("sd-err").textContent = "Impossible de joindre la base Google. Vérifiez Internet puis rechargez la page."; });
  }).catch(function (e) { $("sd-err").textContent = e.message || "Impossible de charger les réglages."; });
  $("sd-login").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!base || !base.remoteUrl) { $("sd-err").textContent = base ? "La base partagée n'est pas encore installée." : "Chargement… réessayez dans un instant."; return; }
    var typed = $("sd-code").value.trim(), btn = e.target.querySelector("button");
    btn.disabled = true; $("sd-err").textContent = "";
    api({ action: "check", code: typed }).then(function (j) {
      btn.disabled = false;
      if (!j.ok) { $("sd-err").textContent = j.error || "Code incorrect."; return; }
      code = typed; unlock();
    }).catch(function () { btn.disabled = false; $("sd-err").textContent = "Pas de connexion. Réessayez."; });
  });

  /* ───────── Formulaire ───────── */
  var GROUP = { weekday: "Semaine", friday: "Vendredi", shabbat: "Chabbat" };
  function render() {
    var known = CITIES.some(function (c) { return c[0] === String(s.geonameid); });
    var h = '<div class="sd-top"><h1>Administration</h1><button type="button" class="sd-link" data-act="logout">Se déconnecter</button></div>' + sheetHtml() +
      '<button type="button" class="sd-btn sd-full sd-save-top" data-act="save">Enregistrer</button>' +
      '<p class="sd-muted">Après « Enregistrer », <b>toutes les télévisions</b> se mettent à jour toutes seules en moins d\'une minute.</p>';

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

    h += '<section class="sd-card"><h2>Horaires des offices</h2>' +
      '<label class="sd-chk"><input type="checkbox" data-k="useSchedule"' + (s.useSchedule ? " checked" : "") + '> Suivre la feuille des horaires (calendrier)</label>' +
      '<p class="sd-help" style="margin:-4px 0 10px">Coché : pour les dates de la feuille, l\'écran affiche ses horaires. Décoché : l\'écran affiche toujours les horaires ci-dessous.</p>';
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

    h += '<section class="sd-card"><h2>Case à dédier (parrainage)</h2>' +
      '<label class="sd-lab">Texte de la dédicace<textarea class="sd-in" rows="3" data-k="sponsor" placeholder="Ex. : Cette semaine, l\'écran est dédié à l\'anniversaire de…">' + esc(s.sponsor) + "</textarea>" +
      '<span class="sd-help">Vide : la case affiche « Espace à dédier » pour trouver un donateur.</span></label>' +
      '<label class="sd-lab">Contact affiché quand la case est libre<input class="sd-in" data-k="sponsorContact" value="' + esc(s.sponsorContact) + '" placeholder="Vide : « Parlez-en à M. Zarka, responsable de la synagogue »"></label></section>';

    h += '<section class="sd-card"><h2>Fond de l\'écran</h2><select class="sd-in" data-k="background">' +
      [["ohel", "Clair : blanc, noir et rouge"], ["marbre-nuit", "Marbre gris, cases bleu nuit"], ["photo", "Photo de la synagogue"], ["ciel", "Ciel clair"], ["ivoire", "Ivoire et étoiles"], ["pierre", "Pierre de Jérusalem"], ["bleu-doux", "Bleu doux"], ["nuit", "Bleu nuit"]].map(function (o) {
        return '<option value="' + o[0] + '"' + ((s.background || "photo") === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" +
      '<label class="sd-lab">Rafraîchir l\'écran chaque jour à<input class="sd-in" data-k="reloadTimes" value="' + esc(s.reloadTimes || "04:00 / 07:00") + '" placeholder="04:00 / 07:00"></label>' +
      '<span class="sd-help">La télé recharge aussi toute seule dès qu\'une nouvelle version du site est en ligne.</span></section>';

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
  $("sd-panel").addEventListener("change", function (e) {
    if (e.target.dataset.actFile === "pdf" && e.target.files && e.target.files[0]) readSheet(e.target.files[0]);
  });
  $("sd-panel").addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) return;
    var i = Number(t.dataset.i), act = t.dataset.act;
    if (act === "up" || act === "down") { var j = act === "up" ? i - 1 : i + 1; if (j < 0 || j >= s.zmanim.length) return; var x = s.zmanim[i]; s.zmanim[i] = s.zmanim[j]; s.zmanim[j] = x; render(); dirty(); }
    if (act === "delp") { s.prayers.splice(i, 1); render(); dirty(); }
    if (act === "addp") { s.prayers.push({ id: "p" + Date.now(), group: "weekday", label: "", labelHe: "", times: "" }); render(); dirty(); }
    if (act === "save") {
      if (!(Number(s.geonameid) > 0)) { alert("Indiquez l'identifiant GeoNames de la ville."); return; }
      t.disabled = true; t.textContent = "Enregistrement…";
      var data = payload();
      api({ action: "save", code: code, settings: data }).then(function (j) {
        t.disabled = false;
        if (!j.ok) { t.textContent = "Erreur : " + (j.error || "non enregistré"); return; }
        remote = data; t.textContent = "Enregistré ✓ (télés à jour dans 1 min)";
      }).catch(function () { t.disabled = false; t.textContent = "Pas de connexion, réessayez"; });
    }
    if (act === "pubsched") publishSheet(t);
    if (act === "logout") { code = ""; window.location.href = home; }
  });
})();

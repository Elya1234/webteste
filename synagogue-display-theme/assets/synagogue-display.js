/* Synagogue Display — version thème Shopify.
 * Port de components/Display.tsx + lib/*.ts : aucun serveur nécessaire, Hebcal est appelé
 * directement depuis le navigateur (API publique avec CORS). Les réglages viennent de
 * l'éditeur de thème Shopify (= l'administration) et sont injectés dans #sd-config. */
(function () {
  "use strict";
  // version de ce fichier (lien « …synagogue-display.js?v=… ») : sert à savoir si une nouvelle version est en ligne
  var MY_VERSION = ((document.currentScript && document.currentScript.src || "").match(/[?&]v=([^&]+)/) || [])[1] || "";
  var LOADED_AT = Date.now();
  var BASE = "https://www.hebcal.com";
  var BASE_CFG = JSON.parse(document.getElementById("sd-config").textContent);
  // Réglages : ceux du thème Shopify, remplacés par ceux de la base partagée (Google) modifiés depuis
  // la page d'administration. Les anciens réglages enregistrés sur un seul appareil sont effacés.
  try { localStorage.removeItem("sd.override.v1"); } catch (e) { /* mode privé */ }
  if (/sd=/.test(window.location.hash)) history.replaceState(null, "", window.location.pathname + window.location.search);
  var K_REMOTE = "sd.remote.v1";
  var SHARED_KEYS = ["name", "nameHe", "geonameid", "cityLabel", "elevation", "candleMinutes", "havdalah", "validatedByRav",
    "showSeconds", "showCountdown", "dedication", "dedicationNames", "footerLeft", "footerRight", "prayers", "announcements", "zmanim", "sponsor", "sponsorContact", "background", "reloadTimes"];
  function withShared(base, rs) {
    var c = Object.assign({}, base);
    if (!rs) return c;
    SHARED_KEYS.forEach(function (k) { if (rs[k] !== undefined && rs[k] !== null) c[k] = rs[k]; });
    if (rs.useSchedule === false) c.scheduleUrl = "";
    return c;
  }
  var remoteSettings = null;
  try { remoteSettings = BASE_CFG.remoteUrl ? JSON.parse(localStorage.getItem(K_REMOTE) || "null") : null; } catch (e) { remoteSettings = null; }
  var CFG = withShared(BASE_CFG, remoteSettings);
  var root = document.getElementById("sd-root");
  var HDate = window.HebcalCore && window.HebcalCore.HDate;

  /* ───────── Catalogue des Zmanim (lib/methods.ts) ───────── */
  function addMin(iso, m) { return iso ? new Date(new Date(iso).getTime() + m * 60000).toISOString() : null; }
  function shaaZmanitMin(t) { return t.sunrise && t.sunset ? (+new Date(t.sunset) - +new Date(t.sunrise)) / 60000 / 12 : null; }
  var DERIVE = {
    chatzot30: function (t) { return addMin(t.chatzot, 30); },
    rt72z: function (t) { var m = shaaZmanitMin(t); return m ? addMin(t.sunset, 72 * m / 60) : null; }
  };
  var CATALOG = {
    alot: { fr: "Alot HaShahar", he: "עלות השחר", m: { "alot16.1": "alotHaShachar", alot_bht: "alosBaalHatanya" } },
    misheyakir: { short: "Talit & Téfilines", he: "משיכיר", m: { "mish11.5": "misheyakir", "mish10.2": "misheyakirMachmir" } },
    sunrise: { fr: "Hanetz HaHama", he: "הנץ החמה", m: { sunrise: "sunrise" } },
    shemaMGA: { short: 'Sof Zman Shema M"A', he: "סוף זמן שמע מג״א", m: { "mga16.1": "sofZmanShmaMGA16Point1", mga72: "sofZmanShmaMGA", "mga19.8": "sofZmanShmaMGA19Point8" } },
    shemaGRA: { short: 'Sof Zman Shema GR"A', he: "סוף זמן שמע גר״א", m: { gra: "sofZmanShma", bht: "sofZmanShmaBaalHatanya" } },
    tefilaMGA: { short: 'Sof Zman Tefila M"A', he: "סוף זמן תפילה מג״א", m: { "mga16.1": "sofZmanTfillaMGA16Point1", mga72: "sofZmanTfillaMGA", "mga19.8": "sofZmanTfillaMGA19Point8" } },
    tefilaGRA: { short: 'Sof Zman Tefila GR"A', he: "סוף זמן תפילה גר״א", m: { gra: "sofZmanTfilla", bht: "sofZmanTfilaBaalHatanya" } },
    chatzot: { fr: "Hatsot HaYom", he: "חצות היום", m: { chatzot: "chatzot" } },
    minchaG: { fr: "Minha Guedola", he: "מנחה גדולה", m: { gra: "minchaGedola", mga: "minchaGedolaMGA", chatzot30: null } },
    minchaK: { fr: "Minha Ketana", he: "מנחה קטנה", m: { gra: "minchaKetana", mga: "minchaKetanaMGA" } },
    plag: { fr: "Plag HaMinha", he: "פלג המנחה", m: { gra: "plagHaMincha", bht: "plagHaminchaBaalHatanya" } },
    sunset: { fr: "Shkiat HaHama", he: "שקיעת החמה", m: { sunset: "sunset" } },
    tzeit: { fr: "Tzeit HaKokhavim", he: "צאת הכוכבים", m: { "deg7.083": "tzeit7083deg", "deg8.5": "tzeit85deg", min42: "tzeit42min", min50: "tzeit50min", min72: "tzeit72min" } },
    rt: { fr: "Rabbenou Tam", he: "רבנו תם", m: { rt72: "tzeit72min", rt72z: null } },
    chatzotNight: { fr: "Hatsot Laila", he: "חצות הלילה", m: { chatzotNight: "chatzotNight" } }
  };
  function resolveZman(t, id, method) {
    var def = CATALOG[id];
    if (!t || !def) return null;
    if (!(method in def.m)) method = Object.keys(def.m)[0];
    if (DERIVE[method] && def.m[method] === null) return DERIVE[method](t);
    return t[def.m[method]] || null;
  }

  /* Fenêtre de chaque office : début et fin permis (méthodes choisies pour les zmanim de l'écran) */
  function zMethod(id) { var z = (CFG.zmanim || []).find(function (x) { return x.id === id; }); return z ? z.method : ""; }
  // Chaharit : Talit & Téfilines → fin de la Tefila (GR"A) ; Minha : Minha Guedola → Chkia ; Arvit : Plag HaMinha → Hatsot
  var WINDOWS = { chaharit: ["misheyakir", "tefilaGRA"], minha: ["minchaG", "sunset"], arvit: ["plag", "chatzotNight"] };
  function officeWindow(key, t, tz) {
    var w = WINDOWS[key]; if (!w || !t) return "";
    var a = resolveZman(t, w[0], zMethod(w[0])), b = resolveZman(t, w[1], zMethod(w[1]));
    return a && b ? "Permis de " + hm(a, tz) + " à " + hm(b, tz) : "";
  }
  function windowKey(label) {
    var l = String(label || "").toLowerCase();
    if (l.indexOf("-") >= 0 || l.indexOf("\u2011") >= 0) return "";
    return /chaharit|shacharit|cha?harit/.test(l) ? "chaharit" : /minh?a/.test(l) ? "minha" : /arvit|maariv/.test(l) ? "arvit" : "";
  }

  /* ───────── Dates & fuseaux (lib/hebcal.ts, lib/format.ts) ───────── */
  function todayIn(tz, d) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date()); }
  function addDays(ymd, n) { var d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function hm(iso, tz) { return iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "—"; }
  function nowParts(tz, d) {
    var p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d);
    var g = function (t) { return Number(p.find(function (x) { return x.type === t; }).value); };
    return { h: g("hour") % 24, m: g("minute"), s: g("second") };
  }
  function weekdayIn(tz, d) { return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d)]; }
  function frenchDate(tz, d) { return new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d); }
  function wdName(iso, tz) { return new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long" }).format(new Date(iso)); }

  /* Le jour hébraïque change au coucher du soleil Hebcal ; sans coucher connu, aucun changement n'est deviné. */
  function hebrewDate(tz, now, times) {
    if (!HDate) return { fr: "", he: "" };
    var p = todayIn(tz, now).split("-").map(Number);
    var hd = new HDate(new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)));
    if (times && times.sunset && now >= new Date(times.sunset)) hd = hd.next();
    return { fr: hd.getDate() + " " + hd.getMonthName() + " " + hd.getFullYear(), he: hd.render("he-x-nonikud").replace(",", "") };
  }

  function upcoming(cal, tz, now) {
    var today = todayIn(tz, now);
    var ymd = function (i) { return i.date.slice(0, 10); };
    var future = cal.filter(function (i) { return ymd(i) >= today; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var nextOf = function (cat) { return future.find(function (i) { return i.category === cat && ((cat !== "candles" && cat !== "havdalah") || new Date(i.date) >= now); }); };
    return {
      parasha: nextOf("parashat"), candles: nextOf("candles"), havdalah: nextOf("havdalah"),
      roshChodesh: future.find(function (i) { return i.category === "roshchodesh"; }),
      holidays: future.filter(function (i) { return i.category === "holiday" && ymd(i) <= addDays(today, 30); }).slice(0, 3)
    };
  }

  /* ───────── Hebcal : 30 jours en une requête + calendrier, cache local ───────── */
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function getJson(url, tries) {
    tries = tries || 3;
    var attempt = function (i) {
      return fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).catch(function (e) { if (i + 1 >= tries) throw e; return sleep(800 * (i + 1)).then(function () { return attempt(i + 1); }); });
    };
    return attempt(0);
  }
  function locParams() { return "geonameid=" + CFG.geonameid + (CFG.elevation ? "&ue=on" : ""); }

  var cacheKey = "sd.bundle.v2." + [CFG.geonameid, CFG.candleMinutes, CFG.havdalah, CFG.elevation].join("|");
  var read = function (k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  var write = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota / mode privé */ } };

  function buildBundle() {
    var tzGuess = (state.bundle && state.bundle.location.tzid) || "UTC";
    var start = todayIn(tzGuess);
    // la 1re requête fournit le fuseau exact de la synagogue ; on recale "aujourd'hui" dessus
    return getJson(BASE + "/zmanim?cfg=json&" + locParams() + "&start=" + addDays(start, -1) + "&end=" + addDays(start, 30)).then(function (z) {
      var loc = z.location, days = {};
      Object.keys(z.times || {}).forEach(function (key) {
        var byDay = z.times[key];
        Object.keys(byDay).forEach(function (d) { (days[d] = days[d] || {})[key] = byDay[d]; });
      });
      var s = todayIn(loc.tzid);
      var hv = CFG.havdalah ? "&m=" + CFG.havdalah : "";
      var url = BASE + "/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&s=on&c=on&M=on&i=off&lg=fr" +
        "&b=" + CFG.candleMinutes + hv + "&" + locParams() + "&start=" + s + "&end=" + addDays(s, 37);
      return getJson(url).then(function (c) { return c.items || []; }, function () { return null; }).then(function (cal) {
        return { generatedAt: new Date().toISOString(), location: loc, days: days, calendar: cal || [], calendarError: !cal };
      });
    });
  }

  var state = { bundle: read(cacheKey), offline: false };
  function refresh() {
    return buildBundle().then(function (b) { state.bundle = b; state.offline = false; write(cacheKey, b); render(true); })
      .catch(function () { state.offline = true; render(true); });
  }

  /* ───────── Rendu (scène 1920×1080 mise à l'échelle) ───────── */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var clean = function (x) { return x.normalize("NFC").replace(/[\u0331\u0332\u0323]/g, ""); };
  var toMin = function (t) { var p = t.split(":").map(Number); return p[0] * 60 + p[1]; };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var parashaName = function (p) { return clean(p.title).replace(/^Parach?a?h?\s*/i, ""); };
  var validTime = function (t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(t); };

  function buildPrayers() {
    return (CFG.prayers || []).map(function (p) {
      return { id: p.id, group: p.group, label: p.label, labelHe: p.labelHe,
               times: String(p.times || "").split(/[\/,;]/).map(function (x) { return x.trim(); }).filter(validTime) };
    });
  }
  var prayers = buildPrayers();
  /* Calendrier des offices (assets/synagogue-horaires.json) : prioritaire sur les horaires de la semaine type */
  var K_SCHED = "sd.schedule.v1";
  var schedule = read(K_SCHED);
  // Fichier des horaires du site + feuille déposée en PDF depuis l'administration (base Google, prioritaire)
  function loadSchedule() {
    if (!CFG.scheduleUrl) return;
    var getJ = function (u) { return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
    var remoteSched = BASE_CFG.remoteUrl ? getJ(BASE_CFG.remoteUrl + (BASE_CFG.remoteUrl.indexOf("?") < 0 ? "?" : "&") + "what=schedule&t=" + Date.now())
      .then(function (j) { return j && j.ok && j.schedule ? j.schedule : null; }, function () { return undefined; }) : Promise.resolve(null);
    Promise.all([getJ(CFG.scheduleUrl).catch(function () { return undefined; }), remoteSched]).then(function (r) {
      // un fichier illisible (hors connexion, page de vérification…) : on garde la copie locale plutôt que de tout perdre
      if (r[0] === undefined && !(r[1] && r[1].days && r[1].days.length)) { setTimeout(loadSchedule, 60000); return; }
      var by = {};
      (r[0] ? r[0].days || [] : []).forEach(function (d) { by[d.date] = d; });
      (r[1] ? r[1].days || [] : []).forEach(function (d) { by[d.date] = d; });
      schedule = { url: CFG.scheduleUrl, byDate: by }; write(K_SCHED, schedule); render(true);
    });
  }
  if (schedule && schedule.url !== CFG.scheduleUrl) schedule = null;
  var SROWS = [["chaharit", "Chaharit", "שחרית"], ["minha", "Minha", "מנחה"], ["arvit", "Arvit", "ערבית"], ["sortie", "", ""]];
  var HE_DAY = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "ערב שבת", "שבת קודש"];

  /* Colonne des offices : le calendrier s'il couvre aujourd'hui, sinon la semaine type */
  function officeView(tz, today, group) {
    var sd = schedule && schedule.byDate;
    if (sd && sd[today]) {
      var groups = [];
      [0, 1].forEach(function (i) {
        var d = sd[addDays(today, i)]; if (!d) return;
        var dt = new Date(d.date + "T12:00:00Z");
        var wdn = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(dt);
        var rows = [], zt = state.bundle && state.bundle.days ? state.bundle.days[d.date] : null;
        SROWS.forEach(function (k) {
          var c = d[k[0]]; if (!c) return;
          rows.push({ id: d.date + k[0], label: k[0] === "sortie" ? (d.sortieLabel || "Sortie") : k[1], labelHe: k[2],
                      times: (c.times || []).filter(validTime), text: c.text || "", note: c.note || "", win: i === 0 ? officeWindow(k[0], zt, tz) : "", counts: k[0] !== "sortie" });
        });
        groups.push({ title: (i === 0 ? "Aujourd'hui · " : i === 1 ? "Demain · " : "") + wdn, he: HE_DAY[dt.getUTCDay()],
                      sub: i === 0 ? "" : [d.event, d.title].filter(Boolean).join(" · "), isToday: i === 0, rows: rows });
      });
      return groups;
    }
    return GROUPS.map(function (g) {
      return { title: g.title + (g.key === group ? " · aujourd'hui" : ""), he: g.he, sub: "", isToday: g.key === group,
               rows: prayers.filter(function (p) { return p.group === g.key; }).map(function (p) { return { id: p.id, label: p.label, labelHe: p.labelHe, times: p.times, counts: true,
        win: g.key === group ? officeWindow(windowKey(p.label), state.bundle && state.bundle.days ? state.bundle.days[today] : null, tz) : "" }; }) };
    }).filter(function (g) { return g.rows.length; });
  }

  var GROUPS = [{ key: "weekday", title: "Semaine", he: "חול" }, { key: "friday", title: "Vendredi", he: "ערב שבת" }, { key: "shabbat", title: "Chabbat", he: "שבת" }];

  var stage = document.createElement("div");
  stage.className = "sd-stage";
  // Fond de l'écran (réglage « background » ; ?fond=… dans l'adresse pour un aperçu)
  var BGS = { photo: 0, ciel: 1, ivoire: 1, pierre: 1, "bleu-doux": 0, nuit: 0, ohel: 2 };
  function applyBg() {
    var q = (window.location.search.match(/[?&]fond=([\w-]+)/) || [])[1];
    var bg = q in BGS ? q : CFG.background in BGS ? CFG.background : "photo";
    stage.setAttribute("data-bg", bg);
    stage.classList.toggle("bg-light", BGS[bg] === 1);
  }
  applyBg();
  root.appendChild(stage);
  /* Mise à l'échelle : certains navigateurs de télévision annoncent une taille de fenêtre fausse,
     on prend donc la plus petite taille visible connue. Réglage manuel à la télécommande :
     touches + / − (ou haut / bas) pour agrandir / réduire, 0 pour revenir au réglage auto. */
  var K_ZOOM = "sd.zoom.v1";
  var userZoom = Number(read(K_ZOOM)) || 1;
  function viewSize() {
    var w = [window.innerWidth, document.documentElement.clientWidth], h = [window.innerHeight, document.documentElement.clientHeight];
    if (window.visualViewport) { w.push(window.visualViewport.width); h.push(window.visualViewport.height); }
    var pick = function (a) { return Math.min.apply(null, a.filter(function (x) { return x > 0; })); };
    return { w: pick(w), h: pick(h) };
  }
  function fit() {
    var v = viewSize(), s = Math.min(v.w / 1920, v.h / 1080) * userZoom;
    stage.style.left = Math.round((v.w - 1920 * s) / 2) + "px";
    stage.style.top = Math.round((v.h - 1080 * s) / 2) + "px";
    stage.style.transform = "scale(" + s + ")";
  }
  var zoomTip = null;
  function setZoom(z) {
    userZoom = Math.max(0.5, Math.min(1.5, Math.round(z * 100) / 100)); write(K_ZOOM, userZoom); fit();
    if (!zoomTip) { zoomTip = document.createElement("div"); zoomTip.className = "sd-zoomtip"; document.body.appendChild(zoomTip); }
    zoomTip.textContent = "Taille : " + Math.round(userZoom * 100) + " %"; zoomTip.style.opacity = "1";
    clearTimeout(setZoom.t); setZoom.t = setTimeout(function () { zoomTip.style.opacity = "0"; }, 2000);
  }
  window.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "+" || k === "=" || k === "ArrowUp" || k === "ChannelUp") { setZoom(userZoom + 0.02); e.preventDefault(); }
    else if (k === "-" || k === "ArrowDown" || k === "ChannelDown") { setZoom(userZoom - 0.02); e.preventDefault(); }
    else if (k === "0") setZoom(1);
  });
  window.addEventListener("resize", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  fit();
  // les navigateurs de télévision donnent souvent la bonne taille quelques secondes après l'ouverture
  [500, 1500, 3000, 6000, 12000].forEach(function (t) { setTimeout(fit, t); });

  var lastMinute = "";
  function render(force) {
    var now = new Date();
    var b = state.bundle;
    var tz = (b && b.location && b.location.tzid) || Intl.DateTimeFormat().resolvedOptions().timeZone;
    var np = nowParts(tz, now);
    var nowMin = np.h * 60 + np.m;
    var wd = weekdayIn(tz, now);
    var group = wd === 6 ? "shabbat" : wd === 5 ? "friday" : "weekday";
    var view = officeView(tz, todayIn(tz, now), group);
    var all = [];
    view.filter(function (g) { return g.isToday; }).forEach(function (g) { g.rows.forEach(function (p) { if (p.counts) p.times.forEach(function (t) { all.push({ id: p.id, t: t, min: toMin(t) }); }); }); });
    all.sort(function (a, c) { return a.min - c.min; });
    var next = all.find(function (x) { return x.min * 60 > nowMin * 60 + np.s - 1; }) || null;
    var remain = next ? next.min * 60 - (nowMin * 60 + np.s) : 0;

    // tic de chaque seconde : uniquement l'horloge et le compte à rebours
    var key = todayIn(tz, now) + nowMin + (next ? next.id + next.t : "");
    if (!force && key === lastMinute) {
      var clk = stage.querySelector("[data-clock]"); if (clk) clk.innerHTML = clockHtml(np);
      var cd = stage.querySelector("[data-countdown]");
      if (cd) cd.textContent = pad(Math.floor(remain / 3600)) + ":" + pad(Math.floor((remain % 3600) / 60)) + ":" + pad(remain % 60);
      return;
    }
    lastMinute = key;

    var today = todayIn(tz, now);
    var times = b && b.days ? b.days[today] : null;
    var hd = hebrewDate(tz, now, times);
    var up = b ? upcoming(b.calendar, tz, now) : null;
    var loc = b ? b.location : null;
    var h = "";
    // Événement du jour (feuille des horaires, sinon calendrier Hebcal) : affiché en tête des annonces
    var sd0 = schedule && schedule.byDate && schedule.byDate[today];
    var evs = sd0 ? [sd0.title, sd0.event].filter(Boolean) : [];
    if (!evs.length && b) b.calendar.forEach(function (i) {
      if (i.date.slice(0, 10) === today && (i.category === "holiday" || i.category === "roshchodesh")) evs.push(clean(i.title));
    });
    var evText = evs.join(" · ");
    var shortDate = function (iso) { return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso.slice(0, 10) + "T12:00:00Z")); };
    var longDate = function (iso) { return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso.slice(0, 10) + "T12:00:00Z")); };
    // Hanouka : prochaine bougie (Hebcal), annoncée 3 semaines avant le 1er allumage puis chaque soir
    var han = null;
    if (b) b.calendar.forEach(function (i) {
      var m = clean(i.title).match(/^Hanouk?ah?\s*:\s*(\d)\s*Bougie/i);
      if (m && !han && i.date.slice(0, 10) >= today) han = { n: +m[1], date: i.date.slice(0, 10) };
    });
    var hanLabel = function (h) { return (h.n === 1 ? "1re" : h.n + "e") + " bougie de Hanouka"; };
    var hanAnn = "";
    if (han && han.date === today) hanAnn = "Ce soir : allumage de la " + hanLabel(han);
    else if (han && han.n === 1 && han.date <= addDays(today, 21)) hanAnn = "Hanouka : 1er allumage " + longDate(han.date);

    // En-tête
    h += '<header class="sd-header"><div class="sd-brand">' +
      '<a class="sd-logo glass" href="' + esc(CFG.adminUrl) + '" aria-label="Modifier l\'écran"><span class="serif sd-star-ic">✡\uFE0E</span></a><div>' +
      '<div class="serif gold-text sd-name">' + esc(CFG.name) + "</div>" +
      '<div class="sd-sub"><span class="hebrew">' + esc(CFG.nameHe) + "</span>" +
      (loc ? '<span class="sd-city">' + esc(CFG.cityLabel || loc.city) + " · " + esc(loc.country) + "</span>" : "") + "</div></div></div>" +
      '<div class="sd-dates"><div class="serif sd-greg">' + esc(frenchDate(tz, now)) + "</div>" +
      '<div class="sd-hdate"><span class="gold">' + esc(hd.fr) + '</span><span class="hebrew">' + esc(hd.he) + "</span></div></div>" +
      '<div class="sd-right"><div class="num gold-text sd-clock" data-clock>' + clockHtml(np) + "</div>" +
      (up && up.parasha ? '<div class="sd-par"><span>Paracha</span><span class="serif">' + esc(parashaName(up.parasha)) + '</span><span class="hebrew">' + esc(up.parasha.hebrew) + "</span></div>" : "") +
      "</div></header><div class=\"hair sd-hair\"></div>";

    // Offices
    h += '<section class="glass sd-col sd-prayers"><div class="sd-phead"><h2 class="serif gold-text">Offices <span class="hebrew">תפילות</span></h2>';
    if (CFG.showCountdown && next) {
      h += '<div class="next-glow sd-next"><div class="sd-nlabel">Prochain office<br><b>' + next.t + '</b></div><div class="num gold-text sd-cd" data-countdown>' +
        pad(Math.floor(remain / 3600)) + ":" + pad(Math.floor((remain % 3600) / 60)) + ":" + pad(remain % 60) + "</div></div>";
    }
    h += '</div><div class="hair"></div><div class="sd-groups">';
    view.forEach(function (g) {
      h += '<div><div class="sd-gtitle"><span>' + esc(g.title) + '</span><span class="hebrew">' + esc(g.he) + "</span></div>" +
        (g.sub ? '<div class="sd-gsub">' + esc(g.sub) + "</div>" : "");
      g.rows.forEach(function (p) {
        var isNext = g.isToday && next && next.id === p.id;
        var info = [p.note, p.win].filter(Boolean).join(" · ");
        h += '<div class="sd-row ' + (isNext ? "next-glow" : "") + '"><div class="sd-rl"><div class="sd-plabel"><span class="serif">' + esc(p.label) + "</span>" +
          (p.labelHe ? '<span class="hebrew sd-phe">' + esc(p.labelHe) + "</span>" : "") + "</div>" +
          (info ? '<div class="sd-pnote">' + esc(info) + "</div>" : "") + "</div>" +
          '<div class="num sd-ptimes">' + p.times.map(function (t) { return '<span class="' + (isNext && next.t === t ? "gold-text" : "") + '">' + t + "</span>"; }).join("") +
          (p.text ? '<span class="sd-ptext">' + esc(p.text) + "</span>" : "") + "</div></div>";
      });
      h += "</div>";
    });
    h += "</div></section>";

    // Zmanim
    h += '<section class="glass sd-col sd-zmanim"><h2 class="serif gold-text">Zmanim <span class="hebrew">זמני היום</span></h2><div class="hair"></div>';
    if (!times) h += '<div class="sd-wait">Horaires indisponibles : en attente de Hebcal…</div>';
    h += "<ul>";
    CFG.zmanim.forEach(function (z) {
      var def = CATALOG[z.id]; if (!def) return;
      h += '<li><span class="sd-zl"><span class="sd-zfr">' + esc(def.short || def.fr) + '</span><span class="hebrew sd-zhe">' + def.he + "</span></span>" +
        '<span class="num gold-text sd-zt">' + hm(resolveZman(times, z.id, z.method), tz) + "</span></li>";
    });
    h += "</ul></section>";

    // Chabbat
    h += '<section class="glass sd-col sd-shabbat"><h2 class="serif gold-text">Chabbat <span class="hebrew">שבת</span></h2><div class="hair"></div>';
    if (up && up.parasha) h += '<div class="sd-pbig"><div class="serif">' + esc(parashaName(up.parasha)) + '</div><div class="hebrew gold">' + esc(up.parasha.hebrew) + "</div></div>";
    h += '<div class="sd-tiles">' + tile("Entrée", "הדלקת נרות", up && up.candles, tz) + tile("Sortie", "הבדלה", up && up.havdalah, tz) + "</div>";
    // prochains événements avec leur date (Hanouka, Roch Hodech, fêtes)
    var nextEv = [];
    if (han) nextEv.push({ t: hanLabel(han), d: han.date });
    if (up && up.roshChodesh) nextEv.push({ t: clean(up.roshChodesh.title), d: up.roshChodesh.date.slice(0, 10) });
    if (up) (up.holidays || []).forEach(function (i) { if (!/bougie/i.test(i.title)) nextEv.push({ t: clean(i.title), d: i.date.slice(0, 10) }); });
    nextEv.sort(function (a, c) { return a.d.localeCompare(c.d); });
    h += '<div class="sd-cal">' + nextEv.filter(function (e, k) { return nextEv.findIndex(function (x) { return x.t === e.t; }) === k; }).slice(0, 2).map(function (e) {
      return '<div class="sd-evl"><span class="gold">' + esc(e.t) + "</span><span>" + esc(e.d === today ? "ce soir" : shortDate(e.d)) + "</span></div>";
    }).join("") + "</div></section>";

    // Annonces
    h += '<section class="glass sd-col sd-ann"><h2 class="serif gold-text">Annonces <span class="hebrew">הודעות</span></h2><div class="hair"></div>' +
      (evText || hanAnn || CFG.announcements.length ? "<ul>" + (hanAnn ? '<li class="sd-ann-ev">' + esc(hanAnn) + "</li>" : "") + (evText ? '<li class="sd-ann-ev">' + esc(evText) + "</li>" : "") +
        CFG.announcements.slice(0, 5).map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>"
                                : '<div class="sd-empty">Aucune annonce pour le moment</div>') + "</section>";

    // Case à dédier (parrainage payant), texte modifiable dans l'administration
    var sp = String(CFG.sponsor || "").trim();
    h += '<section class="glass sd-col sd-sponsor' + (sp ? " is-on" : "") + '"><div class="sd-sp-head"><span class="serif gold-text">' + (sp ? "Dédicace" : "Espace à dédier") +
      '</span><span class="hebrew gold">הקדשה</span></div>' +
      (sp ? '<div class="sd-sp-text">' + esc(sp) + "</div>"
          : '<div class="sd-sp-text sd-sp-empty">Anniversaire, Azkara, Bar Mitsva, mariage… Dédiez cet écran à un proche.' +
            '<br><b>' + esc(CFG.sponsorContact || "Parlez-en à M. Zarka, responsable de la synagogue") + "</b></div>") + "</section>";

    // Pied
    // Dédicace : grande ligne, puis les noms en plus petit
    var dedNames = String(CFG.dedicationNames || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    if (CFG.dedication || dedNames.length) {
      h += '<div class="sd-ded"><div class="hair"></div>' +
        (CFG.dedication ? '<div class="hebrew gold-text sd-ded-main">' + esc(CFG.dedication) + "</div>" : "") +
        (CFG.dedication && dedNames.length ? '<div class="sd-ded-sep"><i></i><span>✦</span><i></i></div>' : "") +
        (dedNames.length ? '<div class="hebrew gold-text sd-ded-main">' + esc(dedNames.join(" ")) + "</div>" : "") + "</div>";
    }
    h += '<footer class="sd-foot"><span>' + esc(CFG.footerLeft) + (state.offline ? " · hors connexion" : "") + "</span><span>" +
      esc(CFG.footerRight) + "</span></footer>";

    stage.innerHTML = h;
    // beaucoup d'offices : la liste rétrécit jusqu'à tenir dans le cadre
    var groups = stage.querySelector(".sd-groups");
    for (var fs = 11; fs > 6 && groups.scrollHeight > groups.clientHeight + 1; fs -= 0.25) groups.style.fontSize = (fs - 0.25) + "px";
    // noms de zmanim trop longs : ils rétrécissent un peu au lieu de toucher les heures
    var zul = stage.querySelector(".sd-zmanim ul"), zls = stage.querySelectorAll(".sd-zmanim .sd-zl");
    var zOver = function () { return Array.prototype.some.call(zls, function (e) { return e.scrollWidth > e.clientWidth + 1; }); };
    if (zul) for (var zs = 23; zs > 15 && zOver(); zs -= 0.5) zul.style.fontSize = (zs - 0.5) + "px";
    var spT = stage.querySelector(".sd-sp-text"), spB = stage.querySelector(".sd-sponsor");
    if (spT) for (var ss = 22; ss > 13 && spB.scrollHeight > spB.clientHeight + 1; ss -= 1) spT.style.fontSize = (ss - 1) + "px";
    // beaucoup d'annonces : le texte rétrécit jusqu'à tenir dans le cadre
    var ann = stage.querySelector(".sd-ann"), annList = ann && ann.querySelector("ul");
    if (annList) for (var as = 25; as > 12 && ann.scrollHeight > ann.clientHeight + 1; as -= 1) annList.style.fontSize = (as - 1) + "px";
  }
  function clockHtml(np) { return pad(np.h) + ":" + pad(np.m) + (CFG.showSeconds ? '<span class="sd-sec">:' + pad(np.s) + "</span>" : ""); }
  function tile(label, he, item, tz) {
    return '<div class="sd-tile"><div class="sd-tl">' + label + '</div><div class="num gold-text sd-tv">' + hm(item && item.date, tz) +
      '</div><div class="sd-ts"><span>' + (item ? esc(wdName(item.date, tz)) : "") + '</span><span class="hebrew">' + he + "</span></div></div>";
  }

  /* ───────── Boucles : seconde, jour, 6 h, retour réseau, réglages publiés ───────── */
  render(true);
  refresh();
  loadSchedule();
  setInterval(loadSchedule, 6 * 3600 * 1000);

  // Base partagée : vérifiée toutes les 30 s ; si quelqu'un a enregistré depuis son téléphone, l'écran se recharge seul.
  // Applique les réglages partagés sans recharger la page (marche aussi quand le navigateur n'a pas de stockage).
  function applyShared(rs) {
    var before = [CFG.geonameid, CFG.candleMinutes, CFG.havdalah, CFG.elevation].join("|");
    remoteSettings = rs;
    CFG = withShared(BASE_CFG, rs);
    // changement de ville ou de bougies : il faut d'autres données Hebcal, on repart de zéro
    if ([CFG.geonameid, CFG.candleMinutes, CFG.havdalah, CFG.elevation].join("|") !== before) { window.location.reload(); return; }
    prayers = buildPrayers();
    applyBg();
    if (!CFG.scheduleUrl) schedule = null;
    else if (!schedule || schedule.url !== CFG.scheduleUrl) loadSchedule();
    render(true);
  }
  var lastScheduleStamp = null;
  function checkRemote() {
    if (!BASE_CFG.remoteUrl) return;
    fetch(BASE_CFG.remoteUrl + (BASE_CFG.remoteUrl.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) return;
        // nouvelle feuille des horaires déposée depuis l'administration
        if (j.scheduleUpdated && j.scheduleUpdated !== lastScheduleStamp) { if (lastScheduleStamp !== null) loadSchedule(); lastScheduleStamp = j.scheduleUpdated; }
        if (JSON.stringify(j.settings || null) !== JSON.stringify(remoteSettings || null)) {
          try { localStorage.setItem(K_REMOTE, JSON.stringify(j.settings || null)); } catch (e) { /* page sans stockage */ }
          applyShared(j.settings || null);
        }
      }).catch(function () { /* hors connexion : on garde les derniers réglages */ });
  }
  checkRemote();
  setInterval(checkRemote, 30 * 1000);
  setInterval(function () { render(false); }, 1000);
  setInterval(refresh, 6 * 3600 * 1000);
  var day = null;
  setInterval(function () {
    var tz = state.bundle ? state.bundle.location.tzid : "UTC";
    var d = todayIn(tz); if (day && d !== day) refresh(); day = d;
  }, 60000);
  window.addEventListener("online", refresh);

  /* Rafraîchissement automatique de la page entière :
     - dès qu'une nouvelle version du site est en ligne (fichier de version vérifié toutes les 2 min) ;
     - chaque jour aux heures choisies dans l'administration (par défaut 04:00 et 07:00).
     On ne recharge que si le site répond, pour ne jamais laisser une page d'erreur sur la télé. */
  var VERSION_URL = /ecran\.html$/.test(window.location.pathname) ? "ecran-version.json" : "version.json";
  function siteVersion() {
    return fetch(VERSION_URL + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function reloadIfOnline() { siteVersion().then(function () { window.location.reload(); }, function () { /* hors connexion : on réessaiera */ }); }
  setInterval(function () {
    if (!MY_VERSION || Date.now() - LOADED_AT < 10 * 60 * 1000) return; // au plus une fois toutes les 10 min (jamais de boucle)
    siteVersion().then(function (j) { if (j && j.v && String(j.v) !== MY_VERSION) window.location.reload(); }, function () {});
  }, 2 * 60 * 1000);
  var lastAuto = "";
  setInterval(function () {
    var tz = state.bundle ? state.bundle.location.tzid : Intl.DateTimeFormat().resolvedOptions().timeZone;
    var np = nowParts(tz, new Date()), hhmm = pad(np.h) + ":" + pad(np.m), stamp = todayIn(tz) + " " + hhmm;
    var times = String(CFG.reloadTimes || "04:00 / 07:00").split(/[\/,;\s]+/).filter(validTime);
    if (times.indexOf(hhmm) >= 0 && stamp !== lastAuto && Date.now() - LOADED_AT > 2 * 60 * 1000) { lastAuto = stamp; reloadIfOnline(); }
  }, 20 * 1000);

  // Les TV se mettent à jour d'elles-mêmes quand l'admin enregistre dans l'éditeur de thème Shopify.
  if (!window.Shopify || !window.Shopify.designMode) {
    setInterval(function () {
      fetch(window.location.pathname + "?sd=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : null; }).then(function (html) {
        if (!html) return;
        var m = html.match(/<script type="application\/json" id="sd-config">([\s\S]*?)<\/script>/);
        if (m && JSON.stringify(JSON.parse(m[1])) !== JSON.stringify(BASE_CFG)) window.location.reload();
      }).catch(function () { /* hors connexion : on garde l'affichage */ });
    }, 60 * 1000);
  }
})();

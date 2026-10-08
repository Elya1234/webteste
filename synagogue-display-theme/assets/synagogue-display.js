/* Synagogue Display — version thème Shopify.
 * Port de components/Display.tsx + lib/*.ts : aucun serveur nécessaire, Hebcal est appelé
 * directement depuis le navigateur (API publique avec CORS). Les réglages viennent de
 * l'éditeur de thème Shopify (= l'administration) et sont injectés dans #sd-config. */
(function () {
  "use strict";
  var BASE = "https://www.hebcal.com";
  var BASE_CFG = JSON.parse(document.getElementById("sd-config").textContent);
  var K_OVERRIDE = "sd.override.v1";
  // Réglages faits dans /pages/admin : soit sur cet appareil (localStorage), soit reçus par lien (#sd=…)
  var link = window.location.hash.match(/sd=([A-Za-z0-9_-]+)/);
  if (link) {
    try {
      var json = decodeURIComponent(escape(atob(link[1].replace(/-/g, "+").replace(/_/g, "/"))));
      JSON.parse(json); localStorage.setItem(K_OVERRIDE, json);
    } catch (e) { /* lien abîmé : on l'ignore */ }
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  var override = null;
  try { override = JSON.parse(localStorage.getItem(K_OVERRIDE) || "null"); } catch (e) { override = null; }
  var CFG = Object.assign({}, BASE_CFG, override || {});
  window.addEventListener("storage", function (e) { if (e.key === K_OVERRIDE) window.location.reload(); });
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
  var clean = function (x) { return x.normalize("NFC").replace(/[̲̣]/g, ""); };
  var toMin = function (t) { var p = t.split(":").map(Number); return p[0] * 60 + p[1]; };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var parashaName = function (p) { return p.title.replace(/^Parach?a?h?\s*/i, ""); };
  var validTime = function (t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(t); };

  var prayers = CFG.prayers.map(function (p) {
    return { id: p.id, group: p.group, label: p.label, labelHe: p.labelHe,
             times: String(p.times || "").split(/[\/,;]/).map(function (x) { return x.trim(); }).filter(validTime) };
  });
  var GROUPS = [{ key: "weekday", title: "Semaine", he: "חול" }, { key: "friday", title: "Vendredi", he: "ערב שבת" }, { key: "shabbat", title: "Chabbat", he: "שבת" }];

  var stage = document.createElement("div");
  stage.className = "sd-stage";
  root.appendChild(stage);
  function fit() { stage.style.transform = "translate(-50%,-50%) scale(" + Math.min(window.innerWidth / 1920, window.innerHeight / 1080) + ")"; }
  window.addEventListener("resize", fit); fit();

  var lastMinute = "";
  function render(force) {
    var now = new Date();
    var b = state.bundle;
    var tz = (b && b.location && b.location.tzid) || Intl.DateTimeFormat().resolvedOptions().timeZone;
    var np = nowParts(tz, now);
    var nowMin = np.h * 60 + np.m;
    var wd = weekdayIn(tz, now);
    var group = wd === 6 ? "shabbat" : wd === 5 ? "friday" : "weekday";
    var all = [];
    prayers.filter(function (p) { return p.group === group; }).forEach(function (p) { p.times.forEach(function (t) { all.push({ id: p.id, t: t, min: toMin(t) }); }); });
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

    // En-tête
    h += '<header class="sd-header"><div class="sd-brand">' +
      '<a class="sd-logo glass" href="' + esc(CFG.adminUrl) + '" aria-label="Espace administrateur"><span class="serif gold-text">✡</span></a><div>' +
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
    GROUPS.forEach(function (g) {
      var rows = prayers.filter(function (p) { return p.group === g.key; });
      if (!rows.length) return;
      var isToday = g.key === group;
      h += '<div class="' + (isToday ? "" : "dim") + '"><div class="sd-gtitle"><span>' + g.title + (isToday ? " · aujourd'hui" : "") + '</span><span class="hebrew">' + g.he + "</span></div>";
      rows.forEach(function (p) {
        var isNext = isToday && next && next.id === p.id;
        h += '<div class="sd-row ' + (isNext ? "next-glow" : "") + '"><div><div class="serif sd-plabel">' + esc(p.label) + '</div><div class="hebrew sd-phe">' + esc(p.labelHe) + "</div></div>" +
          '<div class="num sd-ptimes">' + p.times.map(function (t) { return '<span class="' + (isNext && next.t === t ? "gold-text" : "") + '">' + t + "</span>"; }).join("") + "</div></div>";
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
    h += '<div class="sd-cal">';
    if (up && up.roshChodesh) h += '<div class="gold sd-rc">' + esc(clean(up.roshChodesh.title)) + '</div><div class="sd-rcd">' +
      esc(new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(up.roshChodesh.date.slice(0, 10) + "T12:00:00Z"))) + "</div>";
    if (up && up.holidays && up.holidays[0]) h += '<div class="sd-hol">' + esc(clean(up.holidays[0].title)) + "</div>";
    h += "</div></section>";

    // Annonces
    h += '<section class="glass sd-col sd-ann"><h2 class="serif gold-text">Annonces <span class="hebrew">הודעות</span></h2><div class="hair"></div>' +
      (CFG.announcements.length ? "<ul>" + CFG.announcements.slice(0, 3).map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>"
                                : '<div class="sd-empty">Aucune annonce pour le moment</div>') + "</section>";

    // Pied
    // Dédicace : grande ligne, puis les noms en plus petit
    var dedNames = String(CFG.dedicationNames || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    if (CFG.dedication || dedNames.length) {
      h += '<div class="sd-ded"><div class="hair"></div>' +
        (CFG.dedication ? '<div class="hebrew gold-text sd-ded-main">' + esc(CFG.dedication) + "</div>" : "") +
        (dedNames.length ? '<div class="hebrew gold-text sd-ded-main sd-ded-names">' + esc(dedNames.join(" ")) + "</div>" : "") + "</div>";
    }
    h += '<footer class="sd-foot"><span>Données : Hebcal.com (CC BY 4.0)' + (b ? " · actualisé " + hm(b.generatedAt, tz) : "") +
      (state.offline ? " · hors connexion, dernières données enregistrées" : "") + "</span><span>" +
      (CFG.validatedByRav ? "Méthodes de calcul validées" : "Méthodes de calcul à valider par le Rav") + "</span></footer>";

    stage.innerHTML = h;
    // beaucoup d'offices : la liste rétrécit jusqu'à tenir dans le cadre
    var groups = stage.querySelector(".sd-groups");
    for (var fs = 11; fs > 6 && groups.scrollHeight > groups.clientHeight + 1; fs -= 0.25) groups.style.fontSize = (fs - 0.25) + "px";
  }
  function clockHtml(np) { return pad(np.h) + ":" + pad(np.m) + (CFG.showSeconds ? '<span class="sd-sec">:' + pad(np.s) + "</span>" : ""); }
  function tile(label, he, item, tz) {
    return '<div class="sd-tile"><div class="sd-tl">' + label + '</div><div class="num gold-text sd-tv">' + hm(item && item.date, tz) +
      '</div><div class="sd-ts"><span>' + (item ? esc(wdName(item.date, tz)) : "") + '</span><span class="hebrew">' + he + "</span></div></div>";
  }

  /* ───────── Boucles : seconde, jour, 6 h, retour réseau, réglages publiés ───────── */
  render(true);
  refresh();
  setInterval(function () { render(false); }, 1000);
  setInterval(refresh, 6 * 3600 * 1000);
  var day = null;
  setInterval(function () {
    var tz = state.bundle ? state.bundle.location.tzid : "UTC";
    var d = todayIn(tz); if (day && d !== day) refresh(); day = d;
  }, 60000);
  window.addEventListener("online", refresh);

  // Les TV se mettent à jour d'elles-mêmes quand l'admin enregistre dans l'éditeur de thème Shopify.
  if (!window.Shopify || !window.Shopify.designMode) {
    setInterval(function () {
      fetch(window.location.pathname + "?sd=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : null; }).then(function (html) {
        if (!html) return;
        var m = html.match(/<script type="application\/json" id="sd-config">([\s\S]*?)<\/script>/);
        if (m && JSON.stringify(JSON.parse(m[1])) !== JSON.stringify(BASE_CFG)) window.location.reload();
      }).catch(function () { /* hors connexion : on garde l'affichage */ });
    }, 5 * 60 * 1000);
  }
})();

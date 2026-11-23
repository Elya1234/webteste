/* Mes Rendez-vous — tout est enregistré dans le téléphone / l'ordinateur (localStorage). */
(() => {
  'use strict';

  const KEY = 'rdv.items.v1';
  const CATS = [
    { id: 'perso', label: 'Perso', c: '#4f46e5' },
    { id: 'travail', label: 'Travail', c: '#0891b2' },
    { id: 'sante', label: 'Santé', c: '#dc2626' },
    { id: 'famille', label: 'Famille', c: '#16a34a' },
    { id: 'admin', label: 'Admin', c: '#d97706' },
    { id: 'autre', label: 'Autre', c: '#7c3aed' },
  ];
  const catOf = id => CATS.find(c => c.id === id) || CATS[0];

  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeKey = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const parseStart = s => { const [d, t] = s.split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi); };
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDay = d => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtTime = d => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- Données ----------
  let items = load();
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function save() { localStorage.setItem(KEY, JSON.stringify(items)); render(); }
  const sorted = () => items.slice().sort((a, b) => a.start.localeCompare(b.start));
  const remindAt = it => it.remind < 0 ? null : new Date(parseStart(it.start).getTime() - it.remind * 60000);
  const endOf = it => new Date(parseStart(it.start).getTime() + (it.duration || 60) * 60000);

  // ---------- État de l'écran ----------
  let view = 'upcoming';
  let selDay = startOfDay(new Date());
  let weekStart = mondayOf(selDay);
  let editingId = null;
  let formCat = 'perso';
  function mondayOf(d) { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); }

  // ---------- Ajout rapide en langage naturel ----------
  const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function parseQuick(raw) {
    let text = ' ' + raw + ' ';
    let n = norm(text);
    const today = startOfDay(new Date());
    let date = null, hour = null, min = 0;
    const cut = re => { const m = n.match(re); if (m) { text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length); n = norm(text); } return m; };

    // Heure : 14h, 14h30, 14:30, 9 h 15, midi, minuit
    let m = cut(/\s(?:a\s|vers\s)?(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?=\W)/);
    if (m && +m[1] < 24) { hour = +m[1]; min = m[2] ? +m[2] : 0; }
    else if ((m = cut(/\s(?:a\s)?midi(?=\W)/))) hour = 12;
    else if ((m = cut(/\s(?:a\s)?minuit(?=\W)/))) hour = 0;

    // Date
    if (cut(/\s(?:apres-demain|apres demain)(?=\W)/)) date = addDays(today, 2);
    else if (cut(/\sdemain(?=\W)/)) date = addDays(today, 1);
    else if (cut(/\s(?:aujourd'hui|aujourd’hui|auj|ce soir|ce matin|cet apres-midi)(?=\W)/)) date = today;
    else if ((m = cut(/\s(?:le\s)?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?(?=\W)/))) {
      let y = m[3] ? +m[3] : today.getFullYear(); if (y < 100) y += 2000;
      date = new Date(y, +m[2] - 1, +m[1]);
      if (!m[3] && date < today) date.setFullYear(y + 1);
    } else if ((m = cut(new RegExp('\\s(?:le\\s)?(\\d{1,2})(?:er)?\\s(' + MONTHS.join('|') + ')(?:\\s(\\d{4}))?(?=\\W)')))) {
      let y = m[3] ? +m[3] : today.getFullYear();
      date = new Date(y, MONTHS.indexOf(m[2]), +m[1]);
      if (!m[3] && date < today) date.setFullYear(y + 1);
    } else if ((m = cut(new RegExp('\\s(?:ce\\s|le\\s)?(' + WEEKDAYS.join('|') + ')(?:\\sprochain)?(?=\\W)')))) {
      const target = WEEKDAYS.indexOf(m[1]);
      let diff = (target - today.getDay() + 7) % 7;
      if (diff === 0 && /prochain/.test(m[0])) diff = 7;
      date = addDays(today, diff);
      if (diff === 0 && hour !== null && new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, min) < new Date()) date = addDays(today, 7);
    }

    if (!date && hour !== null) {
      date = today;
      if (new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, min) < new Date()) date = addDays(today, 1);
    }

    let title = text.replace(/\s+/g, ' ').trim().replace(/^(?:a|à|le|la|rdv|rendez-vous)\s+/i, '').replace(/\s+(?:a|à|le)$/i, '').trim();
    let person = '';
    const pm = title.match(/\s+avec\s+(.+)$/i);
    if (pm) { person = pm[1].trim(); title = title.slice(0, pm.index).trim() || 'Rendez-vous'; }
    if (title) title = title[0].toUpperCase() + title.slice(1);
    return { title, person, date, hour, min };
  }

  function describeQuick(p) {
    if (!p.title && !p.date) return '';
    const parts = [];
    parts.push(p.title ? `« ${p.title} »` : '« Rendez-vous »');
    if (p.person) parts.push(`avec ${p.person}`);
    if (p.date) parts.push(fmtDay(p.date));
    if (p.hour !== null) parts.push('à ' + pad(p.hour) + 'h' + pad(p.min));
    else parts.push('— heure à choisir');
    return '→ ' + parts.join(' ');
  }

  $('#quick-input').addEventListener('input', e => {
    $('#quick-preview').textContent = e.target.value.trim() ? describeQuick(parseQuick(e.target.value)) : '';
  });

  $('#quick').addEventListener('submit', e => {
    e.preventDefault();
    const raw = $('#quick-input').value.trim();
    if (!raw) return openForm();
    const p = parseQuick(raw);
    const draft = {
      title: p.title || 'Rendez-vous', person: p.person,
      date: dayKey(p.date || selDay), time: p.hour !== null ? `${pad(p.hour)}:${pad(p.min)}` : '',
    };
    $('#quick-input').value = ''; $('#quick-preview').textContent = '';
    if (p.hour === null) return openForm(null, draft); // il manque l'heure : on ouvre le formulaire
    const it = newItem({ title: draft.title, person: draft.person, start: `${draft.date}T${draft.time}` });
    items.push(it); save();
    toast(`Ajouté : ${it.title}, ${fmtDay(parseStart(it.start))} à ${fmtTime(parseStart(it.start))}`, () => openForm(it.id));
    askNotifOnce();
  });

  function newItem(o) {
    return { id: uid(), title: '', start: '', duration: 60, person: '', place: '', cat: 'perso', remind: 30, notes: '', done: false, notified: false, ...o };
  }

  // ---------- Formulaire ----------
  const dlg = $('#dlg'), form = $('#form');

  function renderCats() {
    $('#cats').innerHTML = CATS.map(c => `<button type="button" data-cat="${c.id}" style="--c:${c.c}" class="${c.id === formCat ? 'sel' : ''}">${c.label}</button>`).join('');
  }
  $('#cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { formCat = b.dataset.cat; renderCats(); } });

  function openForm(id = null, draft = {}) {
    editingId = id;
    const it = id ? items.find(x => x.id === id) : null;
    form.reset();
    const now = new Date();
    const defTime = `${pad(Math.min(now.getHours() + 1, 23))}:00`;
    const f = form.elements;
    f.title.value = it?.title ?? draft.title ?? '';
    f.date.value = it ? it.start.slice(0, 10) : (draft.date || dayKey(selDay));
    f.time.value = it ? it.start.slice(11, 16) : (draft.time || defTime);
    f.duration.value = String(it?.duration ?? 60);
    f.person.value = it?.person ?? draft.person ?? '';
    f.place.value = it?.place ?? '';
    f.remind.value = String(it?.remind ?? 30);
    f.notes.value = it?.notes ?? '';
    formCat = it?.cat ?? 'perso';
    renderCats();
    $('#form-title').textContent = it ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous';
    $('#edit-actions').hidden = !it;
    dlg.showModal();
    if (!it && !f.title.value) f.title.focus();
    else if (!draft.time && !it) f.time.focus();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements;
    const data = {
      title: f.title.value.trim(), start: `${f.date.value}T${f.time.value}`, duration: +f.duration.value,
      person: f.person.value.trim(), place: f.place.value.trim(), cat: formCat, remind: +f.remind.value, notes: f.notes.value.trim(),
    };
    if (editingId) {
      const it = items.find(x => x.id === editingId);
      if (it.start !== data.start || it.remind !== data.remind) { data.notified = false; data.snooze = null; }
      Object.assign(it, data);
    } else {
      items.push(newItem(data));
    }
    selDay = startOfDay(parseStart(data.start)); weekStart = mondayOf(selDay);
    dlg.close(); save(); toast('Enregistré ✔'); askNotifOnce();
  });
  $('#btn-cancel').addEventListener('click', () => dlg.close());
  $('#btn-delete').addEventListener('click', () => {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    const removed = items.find(x => x.id === editingId);
    items = items.filter(x => x.id !== editingId);
    dlg.close(); save();
    toast('Supprimé', () => { items.push(removed); save(); }, 'Annuler');
  });

  // Bouton « agenda du téléphone » (ajouté dynamiquement dans le formulaire)
  const icsBtn = document.createElement('button');
  icsBtn.type = 'button'; icsBtn.id = 'btn-ics'; icsBtn.className = 'btn'; icsBtn.textContent = '📅 Agenda du téléphone';
  icsBtn.title = 'Ajoute aussi ce rendez-vous dans l\u2019agenda du téléphone (rappel même si l\u2019appli est fermée)';
  $('#edit-actions').prepend(icsBtn); $('#btn-delete').style.marginLeft = 'auto';
  icsBtn.addEventListener('click', () => { const it = items.find(x => x.id === editingId); if (it) downloadICS([it]); });

  // ---------- Affichage ----------
  function render() {
    renderHeader(); renderWeek(); renderSummary(); renderList();
  }

  function renderHeader() {
    $('#today-label').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const on = 'Notification' in window && Notification.permission === 'granted';
    const b = $('#btn-notif');
    b.textContent = on ? '🔔 Rappels activés' : '🔕 Activer les rappels';
    b.classList.toggle('on', on);
  }

  function renderWeek() {
    const today = dayKey(new Date());
    const byDay = {};
    for (const it of items) (byDay[it.start.slice(0, 10)] ||= []).push(it);
    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i), k = dayKey(d);
      const dots = (byDay[k] || []).slice(0, 4).map(it => `<i style="background:${catOf(it.cat).c}"></i>`).join('');
      html += `<button data-day="${k}" class="${k === today ? 'today' : ''} ${k === dayKey(selDay) && view === 'day' ? 'sel' : ''}">
        <span class="wd">${d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span>
        <span class="dn">${d.getDate()}</span><span class="dots">${dots}</span></button>`;
    }
    $('#week').innerHTML = `<button data-nav="-7" aria-label="Semaine précédente">‹</button>${html}<button data-nav="7" aria-label="Semaine suivante">›</button>`;
    $('#week').style.gridTemplateColumns = '28px repeat(7, 1fr) 28px';
  }
  $('#week').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.nav) { weekStart = addDays(weekStart, +b.dataset.nav); renderWeek(); return; }
    selDay = startOfDay(parseStart(b.dataset.day + 'T00:00')); setView('day');
  });

  function relative(ms) {
    const min = Math.round(ms / 60000);
    if (min < 1) return 'maintenant';
    if (min < 60) return `dans ${min} min`;
    const h = Math.floor(min / 60), r = min % 60;
    if (h < 24) return `dans ${h} h${r ? ' ' + pad(r) : ''}`;
    const d = Math.round(h / 24);
    return d === 1 ? 'demain' : `dans ${d} jours`;
  }

  function renderSummary() {
    const now = new Date(), tk = dayKey(now);
    const todays = items.filter(it => it.start.startsWith(tk) && !it.done);
    const next = sorted().find(it => !it.done && endOf(it) > now);
    let html = `<strong>${todays.length === 0 ? 'Rien de prévu aujourd\u2019hui' : todays.length === 1 ? '1 rendez-vous aujourd\u2019hui' : todays.length + ' rendez-vous aujourd\u2019hui'}</strong>`;
    if (next) {
      const s = parseStart(next.start);
      const when = s <= now ? 'en cours' : relative(s - now);
      html += `<p>Prochain : <b>${esc(next.title)}</b>${next.person ? ' avec ' + esc(next.person) : ''} — ${dayKey(s) === tk ? 'aujourd\u2019hui' : fmtDay(s)} à ${fmtTime(s)} (${when})</p>`;
    } else html += `<p>Aucun rendez-vous à venir. Ajoutez-en un avec le bouton ＋</p>`;
    $('#summary').innerHTML = html;
  }

  function card(it) {
    const s = parseStart(it.start), now = new Date(), c = catOf(it.cat);
    let badge = '';
    if (!it.done) {
      const diff = s - now;
      if (diff <= 0 && endOf(it) > now) badge = '<span class="badge now">En cours</span>';
      else if (diff > 0 && diff < 2 * 3600e3) badge = `<span class="badge soon">${relative(diff)}</span>`;
    }
    const meta = [it.person && '👤 ' + esc(it.person), it.place && '📍 ' + esc(it.place)].filter(Boolean).join(' · ');
    const rem = it.remind >= 0 && !it.done ? ` <span class="muted" title="Rappel">🔔</span>` : '';
    return `<article class="card ${it.done ? 'done' : ''}" style="--c:${c.c}" data-id="${it.id}">
      <div class="time">${fmtTime(s)}<small>${c.label}</small></div>
      <div><div class="title">${esc(it.title)}${rem}</div>${meta ? `<div class="meta">${meta}</div>` : ''}
        ${it.notes ? `<div class="notes">${esc(it.notes)}</div>` : ''}${badge}</div>
      <button class="check" data-done="${it.id}" aria-label="Marquer comme fait">${it.done ? '✓' : ''}</button>
    </article>`;
  }

  function matches(it, q) {
    if (!q) return true;
    return norm([it.title, it.person, it.place, it.notes, catOf(it.cat).label].join(' ')).includes(q);
  }

  function renderList() {
    const q = norm($('#search').value.trim());
    const now = new Date(), today = startOfDay(now);
    let list = sorted().filter(it => matches(it, q));
    let empty = '';
    if (view === 'upcoming') { list = list.filter(it => endOf(it) > now || (it.start.slice(0, 10) === dayKey(today))); empty = 'Aucun rendez-vous à venir.'; }
    else if (view === 'day') { list = list.filter(it => it.start.startsWith(dayKey(selDay))); empty = `Rien de prévu ${fmtDay(selDay)}.`; }
    else { list = list.filter(it => endOf(it) <= now && it.start.slice(0, 10) !== dayKey(today)).reverse(); empty = 'Aucun rendez-vous passé.'; }

    if (!list.length) {
      $('#list').innerHTML = `<div class="empty"><div class="big">🗓️</div><p>${q ? 'Aucun résultat.' : empty}</p></div>`;
      return;
    }
    let html = '', last = '';
    for (const it of list) {
      const k = it.start.slice(0, 10);
      if (k !== last) {
        const d = parseStart(k + 'T00:00');
        const diffDays = Math.round((d - today) / 864e5);
        const tag = diffDays === 0 ? 'aujourd\u2019hui' : diffDays === 1 ? 'demain' : diffDays === -1 ? 'hier' : '';
        html += `<div class="day-head">${fmtDay(d)}${tag ? `<small>${tag}</small>` : ''}</div>`;
        last = k;
      }
      html += card(it);
    }
    $('#list').innerHTML = html;
  }

  $('#list').addEventListener('click', e => {
    const d = e.target.closest('[data-done]');
    if (d) { const it = items.find(x => x.id === d.dataset.done); it.done = !it.done; save(); return; }
    const c = e.target.closest('[data-id]'); if (c) openForm(c.dataset.id);
  });
  $('#search').addEventListener('input', renderList);

  function setView(v) {
    view = v;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    if (v === 'day') { weekStart = mondayOf(selDay); document.querySelector('.tab[data-view="day"]').textContent = fmtDay(selDay).replace(/^\w/, c => c.toUpperCase()); }
    else document.querySelector('.tab[data-view="day"]').textContent = 'Jour choisi';
    render();
  }
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));
  $('#fab').addEventListener('click', () => openForm());

  // ---------- Rappels ----------
  let swReg = null;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => {});

  let asked = false;
  function askNotifOnce() {
    if (asked || !('Notification' in window) || Notification.permission !== 'default') return;
    asked = true; Notification.requestPermission().then(renderHeader);
  }
  $('#btn-notif').addEventListener('click', async () => {
    if (!('Notification' in window)) return alert('Ce navigateur ne gère pas les notifications. Les rappels s\u2019afficheront quand l\u2019appli est ouverte. Astuce : utilisez « 📅 Agenda du téléphone » dans un rendez-vous.');
    if (Notification.permission === 'denied') return alert('Les notifications sont bloquées. Autorisez-les dans les réglages du navigateur pour ce site.');
    const p = await Notification.requestPermission();
    renderHeader();
    if (p === 'granted') notify('Rappels activés ✔', 'Vous serez prévenu avant vos rendez-vous.', 'test');
  });

  function notify(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body, tag, icon: 'icon-192.png', badge: 'icon-192.png', requireInteraction: true, vibrate: [200, 100, 200] };
    if (swReg && swReg.showNotification) swReg.showNotification(title, opts).catch(() => { try { new Notification(title, opts); } catch {} });
    else { try { new Notification(title, opts); } catch {} }
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(t => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
      });
    } catch {}
  }

  const queue = [];
  let showing = null;
  function checkReminders() {
    const now = new Date();
    let changed = false;
    for (const it of items) {
      if (it.done || it.remind < 0 || it.notified) continue;
      const at = it.snooze ? new Date(it.snooze) : remindAt(it);
      if (!at || at > now) continue;
      if (endOf(it) < now) { it.notified = true; changed = true; continue; } // trop tard, déjà fini
      it.notified = true; changed = true;
      const s = parseStart(it.start);
      const when = s <= now ? 'maintenant' : relative(s - now);
      const body = `${fmtTime(s)} (${when})${it.person ? ' · avec ' + it.person : ''}${it.place ? ' · ' + it.place : ''}${it.notes ? '\n' + it.notes : ''}`;
      notify('⏰ ' + it.title, body, it.id);
      queue.push({ id: it.id, title: it.title, body });
    }
    if (changed) { localStorage.setItem(KEY, JSON.stringify(items)); render(); }
    showNextAlarm();
  }

  function showNextAlarm() {
    if (showing || !queue.length) return;
    showing = queue.shift();
    $('#alarm-text').innerHTML = `<h2 style="margin:6px 0">${esc(showing.title)}</h2><p class="muted" style="white-space:pre-wrap">${esc(showing.body)}</p>`;
    $('#alarm').hidden = false;
    beep();
  }
  $('#alarm-ok').addEventListener('click', () => { $('#alarm').hidden = true; showing = null; showNextAlarm(); });
  $('#alarm-snooze').addEventListener('click', () => {
    const it = items.find(x => x.id === showing.id);
    if (it) { it.snooze = Date.now() + 10 * 60000; it.notified = false; localStorage.setItem(KEY, JSON.stringify(items)); }
    $('#alarm').hidden = true; showing = null; toast('Rappel dans 10 minutes'); showNextAlarm();
  });

  setInterval(() => { checkReminders(); renderSummary(); }, 20000);
  setInterval(render, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); checkReminders(); } });

  // ---------- Agenda du téléphone (.ics) ----------
  function icsDate(d) { return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; }
  function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m); }
  function downloadICS(list) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mes Rendez-vous//FR', 'CALSCALE:GREGORIAN'];
    for (const it of list) {
      const s = parseStart(it.start);
      lines.push('BEGIN:VEVENT', `UID:${it.id}@mes-rendez-vous`, `DTSTAMP:${icsDate(new Date())}`,
        `DTSTART:${icsDate(s)}`, `DTEND:${icsDate(endOf(it))}`, `SUMMARY:${icsText(it.title + (it.person ? ' avec ' + it.person : ''))}`);
      if (it.place) lines.push(`LOCATION:${icsText(it.place)}`);
      if (it.notes) lines.push(`DESCRIPTION:${icsText(it.notes)}`);
      if (it.remind >= 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(it.title)}`, `TRIGGER:-PT${it.remind}M`, 'END:VALARM');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = (list.length === 1 ? list[0].title : 'rendez-vous').replace(/[^\w\u00C0-\u017F -]/g, '') + '.ics';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- Sauvegarde ----------
  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'mes-rendez-vous', version: 1, items }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `rendez-vous-${dayKey(new Date())}.json`; a.click();
  });
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(list)) throw 0;
      const ids = new Set(items.map(x => x.id));
      let n = 0;
      for (const it of list) if (it && it.id && it.start && !ids.has(it.id)) { items.push(newItem(it)); n++; }
      save(); toast(`${n} rendez-vous restauré(s)`);
    } catch { alert('Fichier de sauvegarde illisible.'); }
    e.target.value = '';
  });

  // ---------- Petit message ----------
  let toastTimer;
  function toast(msg, action, label = 'Modifier') {
    const t = $('#toast');
    t.innerHTML = esc(msg) + (action ? ` <button class="link" style="color:#a5b4fc;margin-left:8px">${label}</button>` : '');
    if (action) t.querySelector('button').onclick = () => { t.hidden = true; action(); };
    t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
  }

  // Ouvrir un rendez-vous depuis une notification
  navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.open) { const it = items.find(x => x.id === e.data.open); if (it) openForm(it.id); } });

  // Exposé pour les tests
  window.__rdv = { parseQuick };

  render();
  checkReminders();
})();

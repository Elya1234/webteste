/* Pense-bêtes : des choses à faire, avec pourquoi / détails, une date limite,
   et un rappel chaque jour de ce qu'il reste tant que ce n'est pas fini. */
(() => {
  'use strict';
  const R = window.RDV;
  const { esc, pad, dayKey, fmtDay, startOfDay, addDays, uid, notify, toast } = R;
  const $ = s => document.querySelector(s);
  const KEY = 'rdv.memos.v1';
  const COLORS = { late: '#dc2626', today: '#dc2626', soon: '#d97706', ok: '#4f46e5', none: '#7c3aed', done: '#16a34a' };

  let memos = load();
  let mview = 'open';
  let editingId = null;

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function persist() { localStorage.setItem(KEY, JSON.stringify(memos)); }
  function save() { persist(); render(); }

  const remaining = m => m.steps.filter(s => !s.ok);
  const parseDay = k => { const [y, mo, d] = k.split('-').map(Number); return new Date(y, mo - 1, d); };
  const daysLeft = m => m.deadline ? Math.round((parseDay(m.deadline) - startOfDay(new Date())) / 864e5) : null;

  function deadlineInfo(m) {
    const d = daysLeft(m);
    if (d === null) return { cls: 'none', text: 'Pas de date limite' };
    if (d < 0) return { cls: 'late', text: `⚠️ En retard de ${-d} jour${d < -1 ? 's' : ''}` };
    if (d === 0) return { cls: 'today', text: '⚠️ Limite aujourd’hui !' };
    if (d === 1) return { cls: 'soon', text: 'Limite demain' };
    if (d <= 3) return { cls: 'soon', text: `Encore ${d} jours` };
    return { cls: 'ok', text: 'Limite ' + parseDay(m.deadline).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ` (J-${d})` };
  }

  // ---------- Liste ----------
  function sortOpen(a, b) {
    const da = daysLeft(a), db = daysLeft(b);
    if (da !== null && db !== null) return da - db;
    if (da !== null) return -1;
    if (db !== null) return 1;
    return (b.created || 0) - (a.created || 0);
  }

  function memoCard(m) {
    const info = m.done ? { cls: 'done', text: '✅ Terminé' } : deadlineInfo(m);
    const total = m.steps.length, ok = total - remaining(m).length;
    const steps = m.steps.map((s, i) => `<li class="${s.ok ? 'ok' : ''}" data-step="${i}"><span class="box">${s.ok ? '✓' : ''}</span><span>${esc(s.t)}</span></li>`).join('');
    const foot = m.done ? '' : (m.daily ? `🔔 Rappel chaque jour à ${m.time.replace(':', 'h')}` : (m.deadline ? '🔔 Rappel la veille et le jour de la limite' : '🔕 Pas de rappel'));
    return `<article class="memo ${m.done ? 'done' : ''}" style="--c:${COLORS[info.cls]}" data-mid="${m.id}">
      <div class="memo-head" data-open="${m.id}">
        <span class="title">${esc(m.title)}</span><span class="dl ${info.cls}">${info.text}</span>
      </div>
      ${total ? `<div class="progress" title="${ok}/${total} fait"><i style="width:${Math.round(ok / total * 100)}%"></i></div>
      <div class="memo-foot">${ok}/${total} fait${remaining(m).length ? ` — il reste ${remaining(m).length} chose${remaining(m).length > 1 ? 's' : ''}` : ''}</div>
      <ul class="steps-view">${steps}</ul>` : ''}
      ${m.notes ? `<div class="memo-notes">📝 ${esc(m.notes)}</div>` : ''}
      ${foot ? `<div class="memo-foot">${foot}</div>` : ''}
    </article>`;
  }

  function render() {
    const open = memos.filter(m => !m.done);
    const todo = open.reduce((n, m) => n + remaining(m).length, 0);
    const urgent = open.filter(m => { const d = daysLeft(m); return d !== null && d <= 1; });

    const badge = $('#memo-count');
    badge.hidden = !open.length; badge.textContent = open.length;

    const sum = $('#memo-summary');
    sum.classList.toggle('calm', !urgent.length);
    if (!open.length) sum.innerHTML = '<strong>Rien en attente 👍</strong><p>Créez un pense-bête pour ne rien oublier.</p>';
    else {
      let h = `<strong>${open.length} pense-bête${open.length > 1 ? 's' : ''} en cours · ${todo} chose${todo > 1 ? 's' : ''} à faire</strong>`;
      if (urgent.length) h += `<p>⚠️ Urgent : ${urgent.map(m => `<b>${esc(m.title)}</b> (${deadlineInfo(m).text.replace('⚠️ ', '')})`).join(', ')}</p>`;
      else h += '<p>Pas d’urgence pour l’instant.</p>';
      sum.innerHTML = h;
    }

    document.querySelectorAll('[data-mview]').forEach(t => t.classList.toggle('active', t.dataset.mview === mview));
    const list = mview === 'open' ? open.sort(sortOpen) : memos.filter(m => m.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    $('#memo-list').innerHTML = list.length ? list.map(memoCard).join('')
      : `<div class="empty"><div class="big">📝</div><p>${mview === 'open' ? 'Aucun pense-bête en cours.<br>Touchez ＋ pour en créer un.' : 'Rien de terminé pour l’instant.'}</p></div>`;
  }

  function toggleStep(m, i) {
    m.steps[i].ok = !m.steps[i].ok;
    if (m.steps.length && !remaining(m).length && !m.done) {
      m.done = true; m.doneAt = Date.now();
      toast(`Bravo, « ${m.title} » est terminé ✅`, () => { m.done = false; m.steps[i].ok = false; save(); }, 'Annuler');
    } else if (remaining(m).length && m.done) m.done = false;
    save();
  }

  $('#memo-list').addEventListener('click', e => {
    const card = e.target.closest('[data-mid]'); if (!card) return;
    const m = memos.find(x => x.id === card.dataset.mid);
    const li = e.target.closest('[data-step]');
    if (li) return toggleStep(m, +li.dataset.step);
    openMemo(m.id);
  });
  document.querySelectorAll('[data-mview]').forEach(t => t.addEventListener('click', () => { mview = t.dataset.mview; render(); }));

  // ---------- Formulaire ----------
  const dlg = $('#memo-dlg'), form = $('#memo-form');

  function stepRow(text = '', ok = false) {
    const row = document.createElement('div');
    row.className = 'step-row';
    row.innerHTML = `<input type="checkbox" ${ok ? 'checked' : ''} title="Fait"><input type="text" placeholder="Ex : Appeler le garage pour prévenir" value="${esc(text)}"><button type="button" class="x" title="Enlever">✕</button>`;
    row.querySelector('.x').onclick = () => row.remove();
    row.querySelector('input[type=text]').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const r = stepRow(); row.after(r); r.querySelector('input[type=text]').focus(); }
    });
    return row;
  }
  $('#memo-add-step').addEventListener('click', () => { const r = stepRow(); $('#memo-steps').append(r); r.querySelector('input[type=text]').focus(); });

  function openMemo(id = null, draft = {}) {
    editingId = id;
    const m = id ? memos.find(x => x.id === id) : null;
    form.reset();
    const f = form.elements;
    f.title.value = m?.title ?? draft.title ?? '';
    f.notes.value = m?.notes ?? '';
    f.deadline.value = m?.deadline ?? draft.deadline ?? '';
    f.time.value = m?.time ?? '09:00';
    f.daily.checked = m ? m.daily : true;
    const box = $('#memo-steps'); box.innerHTML = '';
    (m?.steps.length ? m.steps : [{ t: '' }, { t: '' }]).forEach(s => box.append(stepRow(s.t, s.ok)));
    $('#memo-form-title').textContent = m ? 'Modifier le pense-bête' : 'Nouveau pense-bête';
    $('#memo-edit-actions').hidden = !m;
    $('#memo-done').textContent = m?.done ? '↩️ Remettre en cours' : '✅ Tout est fait';
    R.setMode('memo');
    dlg.showModal();
    if (!m) (f.title.value ? box.querySelector('input[type=text]') : f.title).focus();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements;
    const steps = [...$('#memo-steps').querySelectorAll('.step-row')]
      .map(r => ({ t: r.querySelector('input[type=text]').value.trim(), ok: r.querySelector('input[type=checkbox]').checked }))
      .filter(s => s.t);
    const data = { title: f.title.value.trim(), notes: f.notes.value.trim(), deadline: f.deadline.value, time: f.time.value || '09:00', daily: f.daily.checked, steps };
    if (editingId) {
      const m = memos.find(x => x.id === editingId);
      if (m.time !== data.time) m.lastDay = alreadyPassedToday(data.time) ? dayKey(new Date()) : '';
      Object.assign(m, data);
      if (steps.length && !remaining(m).length) { m.done = true; m.doneAt = m.doneAt || Date.now(); }
      else if (remaining(m).length) m.done = false;
    } else {
      // Le premier rappel : aujourd'hui si l'heure n'est pas encore passée, sinon demain.
      memos.push({ id: uid(), created: Date.now(), done: false, snooze: null, lastDay: alreadyPassedToday(data.time) ? dayKey(new Date()) : '', ...data });
    }
    dlg.close(); mview = 'open'; save(); toast('Pense-bête enregistré ✔'); R.askNotifOnce();
  });
  function alreadyPassedToday(t) { const [h, mi] = t.split(':').map(Number); const n = new Date(); return n.getHours() * 60 + n.getMinutes() >= h * 60 + mi; }

  $('#memo-cancel').addEventListener('click', () => dlg.close());
  $('#memo-delete').addEventListener('click', () => {
    if (!confirm('Supprimer ce pense-bête ?')) return;
    const removed = memos.find(x => x.id === editingId);
    memos = memos.filter(x => x.id !== editingId);
    dlg.close(); save();
    toast('Supprimé', () => { memos.push(removed); save(); }, 'Annuler');
  });
  $('#memo-done').addEventListener('click', () => {
    const m = memos.find(x => x.id === editingId);
    m.done = !m.done; m.doneAt = Date.now();
    if (m.done) m.steps.forEach(s => { s.ok = true; });
    dlg.close(); save();
    if (m.done) toast(`Bravo, « ${m.title} » est terminé ✅`);
  });

  // Création rapide : « Réparer la voiture avant vendredi » → ouvre le formulaire pour lister les choses à faire
  $('#memo-quick').addEventListener('submit', e => {
    e.preventDefault();
    const raw = $('#memo-quick-input').value.trim();
    let draft = {};
    if (raw) {
      const p = window.__rdv.parseQuick(raw.replace(/\s(avant|pour|d'ici)\s*$/i, ''));
      let title = (p.title || raw).replace(/\s+(?:avant|pour|d'ici|jusqu'à|jusqu'au)(?:\s+(?:le|la))?$/i, '').trim();
      draft = { title: title || raw, deadline: p.date ? dayKey(p.date) : '' };
    }
    $('#memo-quick-input').value = '';
    openMemo(null, draft);
  });
  $('#fab').addEventListener('click', () => { if (document.body.dataset.mode === 'memo') openMemo(); });

  // ---------- Rappel de chaque jour ----------
  function reminderBody(m) {
    const rest = remaining(m);
    const info = deadlineInfo(m);
    let head = rest.length ? `Il reste ${rest.length} chose${rest.length > 1 ? 's' : ''} à faire` : 'Pense-bête en cours';
    if (m.deadline) head += ` — ${info.text.replace('⚠️ ', '').toLowerCase()}`;
    return { head, rest, info };
  }

  function fire(m) {
    const { head, rest } = reminderBody(m);
    const text = head + (rest.length ? '\n' + rest.map(s => '• ' + s.t).join('\n') : '') + (m.notes ? '\n📝 ' + m.notes : '');
    notify('📝 ' + m.title, text, 'memo-' + m.id);
    const id = m.id;
    const alarmHtml = () => {
      const x = memos.find(y => y.id === id); if (!x) return '';
      const b = reminderBody(x);
      return `<p class="muted">${esc(b.head)}</p>` +
        (x.steps.length ? `<ul class="alarm-list">${x.steps.map((s, i) => `<li class="${s.ok ? 'ok' : ''}" data-astep="${i}"><span class="box">${s.ok ? '✓' : ''}</span><span>${esc(s.t)}</span></li>`).join('')}</ul>` : '') +
        (x.notes ? `<p class="muted" style="white-space:pre-wrap;text-align:left">📝 ${esc(x.notes)}</p>` : '');
    };
    R.pushAlarm({
      title: '📝 ' + m.title,
      html: alarmHtml(),
      snoozeLabel: 'Me rappeler dans 1 h',
      onSnooze: () => { const x = memos.find(y => y.id === id); if (x) { x.snooze = Date.now() + 3600e3; persist(); } toast('Rappel dans 1 heure'); },
      onOpen: () => openMemo(id),
      onClick: e => {
        const li = e.target.closest('[data-astep]'); if (!li) return;
        const x = memos.find(y => y.id === id); if (!x) return;
        toggleStep(x, +li.dataset.astep);
        const box = document.querySelector('#alarm-text');
        box.innerHTML = `<h2 style="margin:6px 0">${esc('📝 ' + x.title)}</h2>` + alarmHtml();
      },
    });
  }

  function tick(now) {
    const today = dayKey(now);
    let changed = false;
    for (const m of memos) {
      if (m.done) continue;
      if (m.snooze && now.getTime() >= m.snooze) { m.snooze = null; changed = true; fire(m); continue; }
      if (m.snooze || m.lastDay === today) continue;
      const d = daysLeft(m);
      const wanted = m.daily || (d !== null && d <= 1); // sans rappel quotidien : la veille et le jour J (et en retard)
      if (!wanted) continue;
      const [h, mi] = (m.time || '09:00').split(':').map(Number);
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + mi) continue;
      m.lastDay = today; changed = true;
      fire(m);
    }
    if (changed) { persist(); render(); }
  }

  // ---------- Branchements avec app.js ----------
  R.tickers.push(tick);
  R.renderers.push(render);
  R.openers.push(tag => { const id = String(tag).replace(/^memo-/, ''); if (memos.some(m => m.id === id)) openMemo(id); });
  R.backups.push({
    get: () => ({ memos }),
    restore: data => {
      if (!Array.isArray(data.memos)) return 0;
      const ids = new Set(memos.map(m => m.id)); let n = 0;
      for (const m of data.memos) if (m && m.id && m.title && !ids.has(m.id)) { memos.push({ steps: [], time: '09:00', daily: true, ...m }); n++; }
      persist(); render(); return n;
    },
  });
  setInterval(render, 60000);

  render();
})();

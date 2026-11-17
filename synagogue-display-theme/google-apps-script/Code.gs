/**
 * Base partagée de l'écran synagogue (Google Apps Script, gratuit, dans le compte Google du propriétaire).
 *
 * - GET  : renvoie les réglages enregistrés (lus par les télévisions toutes les 30 secondes).
 * - GET ?what=schedule : renvoie la feuille des horaires déposée depuis l'administration (PDF lu dans le téléphone).
 * - POST : { action: "check" | "save" | "saveSchedule", code, settings | schedule } — le code est vérifié ICI,
 *          côté Google, jamais dans le téléphone. Après 10 codes faux en 10 minutes, tout est bloqué 10 minutes.
 *
 * Installation : script.google.com → Nouveau projet → coller ce fichier → Déployer → Nouveau
 * déploiement → Type « Application Web » → Exécuter en tant que « Moi » → Accès « Tout le monde ».
 * Le code d'accès se change dans Paramètres du projet → Propriétés du script → ADMIN_CODE.
 * Mise à jour de ce fichier : Déployer → Gérer les déploiements → ✎ → Version « Nouvelle version » → Déployer
 * (l'adresse reste la même, les télés n'ont rien à changer).
 */
var DEFAULT_CODE = '5787';

var CHUNK = 8000; // une propriété Google ne dépasse pas 9 Ko : la feuille des horaires est découpée en morceaux

function doGet(e) {
  var p = PropertiesService.getScriptProperties();
  if (e && e.parameter && e.parameter.what === 'schedule') {
    var n = Number(p.getProperty('schedule_n') || 0), json = '';
    for (var i = 0; i < n; i++) json += p.getProperty('schedule_' + i) || '';
    return out_({ ok: true, schedule: json ? JSON.parse(json) : null, updated: p.getProperty('scheduleUpdated') || '' });
  }
  return out_({ ok: true, settings: JSON.parse(p.getProperty('settings') || 'null'), updated: p.getProperty('updated') || '',
    scheduleUpdated: p.getProperty('scheduleUpdated') || '' });
}

function doPost(e) {
  var p = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('fails') || 0);
  if (fails >= 10) return out_({ ok: false, error: 'Trop d\'essais. Réessayez dans 10 minutes.' });

  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: 'Requête invalide' }); }
  if (String(body.code || '') !== (p.getProperty('ADMIN_CODE') || DEFAULT_CODE)) {
    cache.put('fails', String(fails + 1), 600);
    return out_({ ok: false, error: 'Code incorrect.' });
  }
  if (body.action === 'check') return out_({ ok: true });
  if (body.action === 'save' && body.settings && typeof body.settings === 'object') {
    var json = JSON.stringify(body.settings);
    if (json.length > 8500) return out_({ ok: false, error: 'Réglages trop longs.' });
    var lock = LockService.getScriptLock(); lock.waitLock(5000);
    try {
      p.setProperty('settings', json);
      p.setProperty('updated', new Date().toISOString());
    } finally { lock.releaseLock(); }
    return out_({ ok: true, updated: p.getProperty('updated') });
  }
  if (body.action === 'saveSchedule' && body.schedule && Array.isArray(body.schedule.days)) {
    var sj = JSON.stringify(body.schedule);
    if (sj.length > 300000) return out_({ ok: false, error: 'Feuille des horaires trop longue.' });
    var lk = LockService.getScriptLock(); lk.waitLock(5000);
    try {
      var old = Number(p.getProperty('schedule_n') || 0), n = Math.ceil(sj.length / CHUNK);
      for (var i = 0; i < n; i++) p.setProperty('schedule_' + i, sj.slice(i * CHUNK, (i + 1) * CHUNK));
      for (var j = n; j < old; j++) p.deleteProperty('schedule_' + j);
      p.setProperty('schedule_n', String(n));
      p.setProperty('scheduleUpdated', new Date().toISOString());
    } finally { lk.releaseLock(); }
    return out_({ ok: true, updated: p.getProperty('scheduleUpdated') });
  }
  return out_({ ok: false, error: 'Action inconnue' });
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

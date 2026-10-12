/**
 * Base partagée de l'écran synagogue (Google Apps Script, gratuit, dans le compte Google du propriétaire).
 *
 * - GET  : renvoie les réglages enregistrés (lus par les télévisions toutes les 30 secondes).
 * - POST : { action: "check" | "save", code, settings } — le code est vérifié ICI, côté Google,
 *          jamais dans le téléphone. Après 10 codes faux en 10 minutes, tout est bloqué 10 minutes.
 *
 * Installation : script.google.com → Nouveau projet → coller ce fichier → Déployer → Nouveau
 * déploiement → Type « Application Web » → Exécuter en tant que « Moi » → Accès « Tout le monde ».
 * Le code d'accès se change dans Paramètres du projet → Propriétés du script → ADMIN_CODE.
 */
var DEFAULT_CODE = '5787';

function doGet() {
  var p = PropertiesService.getScriptProperties();
  return out_({ ok: true, settings: JSON.parse(p.getProperty('settings') || 'null'), updated: p.getProperty('updated') || '' });
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
  return out_({ ok: false, error: 'Action inconnue' });
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

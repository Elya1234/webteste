/* Version Hostinger : confirmation ou erreur d'envoi des formulaires (remplace l'affichage géré par Shopify). */
(() => {
  const q = new URLSearchParams(location.search);
  const form = document.querySelector('.form form');
  if (q.get('contact_posted') === 'true' && q.get('f') === 'etude' && form) {
    form.innerHTML = '<div class="form__ok" role="status" tabindex="-1"><span class="badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><h2 style="font-size:1.6rem">C\'est envoyé !</h2><p class="muted" style="max-width:44ch">Un conseiller étudie votre demande et vous rappelle très prochainement. Aucun engagement de votre part.</p></div>';
    form.closest('.form')?.classList.remove('is-auto', 'is-first');
    try { Object.keys(localStorage).filter(k => k.startsWith('hy-form:')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    setTimeout(() => form.querySelector('.form__ok')?.focus(), 300);
  }
  if (q.get('contact_erreur') && form) {
    const p = document.createElement('div'); p.className = 'form__err'; p.setAttribute('role', 'alert');
    p.textContent = "Votre demande n'a pas pu être envoyée. Vérifiez vos coordonnées, ou contactez-nous sur WhatsApp.";
    form.prepend(p);
  }
  if (q.has('contact_posted') || q.has('contact_erreur')) setTimeout(() => history.replaceState(null, '', location.pathname + location.hash), 1500);
})();

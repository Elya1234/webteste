/* Contrôles des saisies (téléphone, mot de passe). Les mêmes règles sont revérifiées côté serveur
 * (contrainte SQL sur le téléphone, règles de mot de passe de Supabase) : le téléphone ne fait que prévenir tôt. */

export type Country = "FR" | "US";
export const COUNTRIES: { id: Country; dial: string; label: string; flag: string; placeholder: string }[] = [
  { id: "FR", dial: "+33", label: "France", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
  { id: "US", dial: "+1", label: "États-Unis / Canada", flag: "🇺🇸", placeholder: "(212) 555-0123" }
];

/** Numéro saisi → format international (+33612345678), ou null s'il n'est pas valable. */
export function normalizePhone(country: Country, raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (country === "FR") {
    if (d.startsWith("33")) d = d.slice(2);
    if (d.length === 10 && d.startsWith("0")) d = d.slice(1);
    // 9 chiffres, sans 0 au début : 1-5 fixes, 6-7 mobiles, 8 numéros spéciaux, 9 box
    return /^[1-9]\d{8}$/.test(d) ? "+33" + d : null;
  }
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  // plan nord-américain : indicatif et central ne commencent ni par 0 ni par 1
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? "+1" + d : null;
}

/** +33612345678 → « +33 6 12 34 56 78 » ; +12125550123 → « +1 (212) 555-0123 » */
export function formatPhone(e164: string): string {
  if (/^\+33\d{9}$/.test(e164)) { const d = e164.slice(3); return "+33 " + d[0] + " " + d.slice(1).replace(/(\d{2})(?=\d)/g, "$1 "); }
  if (/^\+1\d{10}$/.test(e164)) { const d = e164.slice(2); return "+1 (" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6); }
  return e164;
}
export const countryOf = (e164: string): Country => (e164.startsWith("+1") ? "US" : "FR");
export const localPart = (e164: string) => (e164.startsWith("+33") ? "0" + e164.slice(3) : e164.startsWith("+1") ? e164.slice(2) : e164);

/* ───────── Mot de passe ─────────
 * Au moins 10 caractères, une minuscule, une majuscule, un chiffre ; pas l'e-mail ni le prénom dedans ;
 * pas une suite trop simple (123456, azerty, motdepasse…). */
const WEAK = ["password", "motdepasse", "azerty", "qwerty", "123456", "000000", "111111", "abcdef", "soleil", "bonjour", "shalom", "chalom", "synagogue"];
export type PasswordCheck = { ok: boolean; score: 0 | 1 | 2 | 3 | 4; rules: { label: string; ok: boolean }[] };
export function checkPassword(pw: string, personal: string[] = []): PasswordCheck {
  const low = pw.toLowerCase();
  const own = personal.map((x) => x.toLowerCase().split("@")[0]).filter((x) => x.length >= 3);
  const rules = [
    { label: "10 caractères minimum", ok: pw.length >= 10 },
    { label: "Une minuscule et une majuscule", ok: /[a-zà-ÿ]/.test(pw) && /[A-ZÀ-Ý]/.test(pw) },
    { label: "Au moins un chiffre", ok: /\d/.test(pw) },
    { label: "Ni votre nom ni votre e-mail, ni un mot trop courant", ok: pw.length > 0 && !own.some((x) => low.includes(x)) && !WEAK.some((w) => low.includes(w)) && !/(.)\1{3,}/.test(pw) }
  ];
  const passed = rules.filter((r) => r.ok).length;
  const bonus = /[^A-Za-z0-9]/.test(pw) && pw.length >= 12 ? 1 : 0;
  const score = Math.min(4, Math.max(0, passed - 1 + bonus)) as PasswordCheck["score"];
  return { ok: rules.every((r) => r.ok), score, rules };
}

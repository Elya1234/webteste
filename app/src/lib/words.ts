/* Montant en toutes lettres (obligatoire sur un reçu fiscal) : 1250,50 → « mille deux cent cinquante euros et cinquante centimes ». */
const U = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const T = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function under100(n: number): string {
  if (n <= 16) return U[n];
  if (n < 20) return "dix-" + U[n - 10];
  const t = Math.floor(n / 10), u = n % 10;
  if (t === 7 || t === 9) return T[t] + (u === 1 && t === 7 ? " et " : "-") + under100(10 + u);
  if (u === 0) return T[t] + (t === 8 ? "s" : "");
  return T[t] + (u === 1 && t !== 8 ? " et un" : "-" + U[u]);
}
function under1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const head = h === 0 ? "" : h === 1 ? "cent" : U[h] + " cent" + (r === 0 ? "s" : "");
  return [head, r ? under100(r) : ""].filter(Boolean).join(" ");
}
export function numberFr(n: number): string {
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const m = Math.floor(n / 1e6), k = Math.floor((n % 1e6) / 1000), r = n % 1000;
  if (m) parts.push(under1000(m) + " million" + (m > 1 ? "s" : ""));
  if (k) parts.push(k === 1 ? "mille" : under1000(k).replace(/cents$/, "cent") + " mille");
  if (r) parts.push(under1000(r));
  return parts.join(" ");
}
export function eurosInWords(cents: number): string {
  const e = Math.floor(cents / 100), c = cents % 100;
  return numberFr(e) + " euro" + (e > 1 ? "s" : "") + (c ? " et " + numberFr(c) + " centime" + (c > 1 ? "s" : "") : "");
}

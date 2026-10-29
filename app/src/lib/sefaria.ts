/* Textes d'étude (Sefaria, API publique) : Siddour séfarade « Edot HaMizrach » (domaine public, CC0),
 * Halakha Yomit (Choulhan Aroukh, Maran) et Daf Hayomi du jour. Copie locale pour la lecture hors connexion. */
import { read, write } from "./storage";

const API = "https://www.sefaria.org/api";
export const SIDDUR = "Siddur Edot HaMizrach";

async function cached<T>(key: string, url: string, maxAgeMs: number): Promise<T> {
  const c = read<{ at: number; v: T }>(key);
  if (c && Date.now() - c.at < maxAgeMs) return c.v;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const v = (await r.json()) as T;
    write(key, { at: Date.now(), v });
    return v;
  } catch (e) {
    if (c) return c.v; // hors connexion : dernière copie
    throw e;
  }
}

export type SiddurNode = { key: string; en: string; he: string; ref: string; children?: SiddurNode[] };
type RawNode = { key?: string; titles?: { lang: string; text: string; primary?: boolean }[]; nodes?: RawNode[] };

export async function siddurOutline(): Promise<SiddurNode[]> {
  const j = await cached<{ schema: RawNode }>("sef.siddur.index", API + "/v2/raw/index/" + encodeURIComponent(SIDDUR.replace(/ /g, "_")), 30 * 86400000);
  const title = (n: RawNode, lang: string) => n.titles?.find((t) => t.lang === lang && t.primary)?.text || n.key || "";
  const walk = (n: RawNode, path: string): SiddurNode => {
    const en = title(n, "en"), ref = path + ", " + en;
    return { key: ref, en, he: title(n, "he").trim(), ref, children: n.nodes?.map((c) => walk(c, ref)) };
  };
  return (j.schema.nodes || []).map((n) => walk(n, SIDDUR));
}

type TextResp = { ref: string; heRef?: string; versions: { language: string; versionTitle: string; text: unknown }[] };
/** Renvoie des paragraphes (HTML déjà nettoyé) par langue. */
export async function getText(ref: string, langs: ("hebrew" | "english")[] = ["hebrew"]) {
  const q = langs.map((l) => "version=" + l).join("&");
  const j = await cached<TextResp>("sef.t." + ref + "|" + q, API + "/v3/texts/" + encodeURIComponent(ref) + "?" + q, 30 * 86400000);
  const flat = (x: unknown): string[] => (Array.isArray(x) ? x.flatMap(flat) : typeof x === "string" && x.trim() ? [x] : []);
  const out: Record<string, string[]> = {};
  j.versions.forEach((v) => { out[v.language] = flat(v.text).map(sanitize); });
  return { ref: j.ref, he: out.he || [], en: out.en || [] };
}

export type CalendarItem = { title: { en: string; he: string }; displayValue: { en: string; he: string }; ref?: string };
export async function todaysLearning() {
  const day = new Date().toISOString().slice(0, 10);
  const j = await cached<{ calendar_items: CalendarItem[] }>("sef.cal." + day, API + "/calendars?timezone=" + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone), 86400000);
  const find = (t: string) => j.calendar_items.find((i) => i.title.en === t) || null;
  return { daf: find("Daf Yomi"), halakha: find("Halakhah Yomit"), parasha: find("Parashat Hashavua") };
}

/* Les textes Sefaria contiennent un peu de HTML : on ne garde que la mise en forme simple, jamais de liens ni de scripts. */
const KEEP = new Set(["B", "STRONG", "I", "EM", "BIG", "SMALL", "BR"]);
export function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return (n.textContent || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    if (n.nodeType !== Node.ELEMENT_NODE) return "";
    const el = n as Element;
    if (el.tagName === "SUP" || el.tagName === "I" && el.hasAttribute("data-commentator")) return ""; // renvois de notes
    const inner = Array.from(el.childNodes).map(walk).join("");
    if (el.tagName === "BR") return "<br>";
    return KEEP.has(el.tagName) ? "<" + el.tagName.toLowerCase() + ">" + inner + "</" + el.tagName.toLowerCase() + ">" : inner;
  };
  return walk(doc.body.firstChild!);
}

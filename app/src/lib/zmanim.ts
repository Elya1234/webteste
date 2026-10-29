/* Calculs repris de l'écran TV (synagogue-display-theme/assets/synagogue-display.js) :
 * zmanim Hebcal (31 jours en une requête), calendrier (Chabbat, paracha, fêtes), calendrier des offices. */
import { HDate } from "@hebcal/core";
import type { SynaConfig } from "../config";

const BASE = "https://www.hebcal.com";

export type Times = Record<string, string>;
export type CalItem = { title: string; date: string; category: string; hebrew?: string };
export type Bundle = { generatedAt: string; location: { tzid: string; city: string; country: string }; days: Record<string, Times>; calendar: CalItem[] };

/* ───────── Catalogue des Zmanim ───────── */
const addMin = (iso: string | undefined, m: number) => (iso ? new Date(new Date(iso).getTime() + m * 60000).toISOString() : null);
const shaaZmanitMin = (t: Times) => (t.sunrise && t.sunset ? (+new Date(t.sunset) - +new Date(t.sunrise)) / 60000 / 12 : null);
const DERIVE: Record<string, (t: Times) => string | null> = {
  chatzot30: (t) => addMin(t.chatzot, 30),
  rt72z: (t) => { const m = shaaZmanitMin(t); return m ? addMin(t.sunset, (72 * m) / 60) : null; }
};
export const CATALOG: Record<string, { fr?: string; short?: string; he: string; m: Record<string, string | null> }> = {
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
export function resolveZman(t: Times | null | undefined, id: string, method: string): string | null {
  const def = CATALOG[id];
  if (!t || !def) return null;
  if (!(method in def.m)) method = Object.keys(def.m)[0];
  const key = def.m[method];
  if (key === null) return DERIVE[method] ? DERIVE[method](t) : null;
  return t[key] || null;
}

/* ───────── Dates & fuseaux ───────── */
export const todayIn = (tz: string, d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export function addDays(ymd: string, n: number) { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const hm = (iso: string | null | undefined, tz: string) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "—";
export function nowParts(tz: string, d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { h: g("hour") % 24, m: g("minute"), s: g("second") };
}
export const weekdayIn = (tz: string, d: Date) =>
  ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d)];
export const frenchDate = (tz: string, d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
export const wdName = (iso: string, tz: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long" }).format(new Date(iso));
export const clean = (x: string) => x.normalize("NFC").replace(/[̱̲̣]/g, "");
export const parashaName = (p: CalItem) => clean(p.title).replace(/^Parach?a?h?\s*/i, "");
export const toMin = (t: string) => { const p = t.split(":").map(Number); return p[0] * 60 + p[1]; };
export const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/* Le jour hébraïque change au coucher du soleil Hebcal ; sans coucher connu, aucun changement n'est deviné. */
export function hebrewDate(tz: string, now: Date, times: Times | null | undefined) {
  const p = todayIn(tz, now).split("-").map(Number);
  let hd = new HDate(new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)));
  if (times && times.sunset && now >= new Date(times.sunset)) hd = hd.next();
  return { fr: hd.getDate() + " " + hd.getMonthName() + " " + hd.getFullYear(), he: hd.renderGematriya(true) };
}

export function upcoming(cal: CalItem[], tz: string, now: Date) {
  const today = todayIn(tz, now);
  const ymd = (i: CalItem) => i.date.slice(0, 10);
  const future = cal.filter((i) => ymd(i) >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextOf = (cat: string) => future.find((i) => i.category === cat && ((cat !== "candles" && cat !== "havdalah") || new Date(i.date) >= now));
  return {
    parasha: nextOf("parashat"), candles: nextOf("candles"), havdalah: nextOf("havdalah"),
    roshChodesh: future.find((i) => i.category === "roshchodesh"),
    holidays: future.filter((i) => i.category === "holiday" && ymd(i) <= addDays(today, 30)).slice(0, 5)
  };
}

/* ───────── Hebcal : 30 jours en une requête + calendrier ───────── */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function getJson<T>(url: string, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return (await r.json()) as T;
    } catch (e) {
      if (i + 1 >= tries) throw e;
      await sleep(800 * (i + 1));
    }
  }
}

export const bundleKey = (c: SynaConfig) => "app.bundle.v1." + [c.geonameid, c.candleMinutes, c.havdalah, c.elevation].join("|");

export async function buildBundle(c: SynaConfig, tzGuess = "Europe/Paris"): Promise<Bundle> {
  const loc = "geonameid=" + c.geonameid + (c.elevation ? "&ue=on" : "");
  const start = todayIn(tzGuess);
  const z = await getJson<{ location: Bundle["location"]; times: Record<string, Record<string, string>> }>(
    BASE + "/zmanim?cfg=json&" + loc + "&start=" + addDays(start, -1) + "&end=" + addDays(start, 30));
  const days: Record<string, Times> = {};
  Object.keys(z.times || {}).forEach((key) => {
    Object.keys(z.times[key]).forEach((d) => { (days[d] = days[d] || {})[key] = z.times[key][d]; });
  });
  const s = todayIn(z.location.tzid);
  const hv = c.havdalah ? "&m=" + c.havdalah : "";
  const url = BASE + "/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&s=on&c=on&M=on&i=off&lg=fr" +
    "&b=" + c.candleMinutes + hv + "&" + loc + "&start=" + s + "&end=" + addDays(s, 37);
  const cal = await getJson<{ items: CalItem[] }>(url).then((j) => j.items || [], () => []);
  return { generatedAt: new Date().toISOString(), location: z.location, days, calendar: cal };
}

/* ───────── Offices : calendrier (synagogue-horaires.json) prioritaire sur la semaine type ───────── */
type SchedSlot = { times?: string[]; note?: string; text?: string };
export type SchedDay = { date: string; title?: string; event?: string; sortieLabel?: string } & Partial<Record<"chaharit" | "minha" | "arvit" | "sortie", SchedSlot>>;
export type Schedule = { source?: string; byDate: Record<string, SchedDay> };
export type OfficeRow = { id: string; label: string; labelHe: string; times: string[]; text?: string; note?: string; counts: boolean };
export type OfficeGroup = { date?: string; title: string; he: string; sub: string; isToday: boolean; rows: OfficeRow[] };

const SROWS: [keyof SchedDay, string, string][] = [["chaharit", "Chaharit", "שחרית"], ["minha", "Minha", "מנחה"], ["arvit", "Arvit", "ערבית"], ["sortie", "", ""]];
const HE_DAY = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "ערב שבת", "שבת קודש"];
const GROUPS = [{ key: "weekday", title: "Semaine", he: "חול" }, { key: "friday", title: "Vendredi", he: "ערב שבת" }, { key: "shabbat", title: "Chabbat", he: "שבת" }];

export function schedDayGroup(d: SchedDay, label = ""): OfficeGroup {
  const dt = new Date(d.date + "T12:00:00Z");
  const wdn = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(dt);
  const rows: OfficeRow[] = [];
  SROWS.forEach(([k, lab, he]) => {
    const c = d[k] as SchedSlot | undefined; if (!c) return;
    rows.push({ id: d.date + k, label: k === "sortie" ? d.sortieLabel || "Sortie" : lab, labelHe: he,
      times: (c.times || []).filter(validTime), text: c.text || "", note: c.note || "", counts: k !== "sortie" });
  });
  return { date: d.date, title: label + wdn, he: HE_DAY[dt.getUTCDay()], sub: [d.event, d.title].filter(Boolean).join(" · "), isToday: false, rows };
}

export function officeView(c: SynaConfig, schedule: Schedule | null, today: string, group: string): OfficeGroup[] {
  const sd = schedule && c.useSchedule !== false ? schedule.byDate : null;
  if (sd && sd[today]) {
    return [0, 1].map((i) => sd[addDays(today, i)]).filter(Boolean).map((d, i) => {
      const g = schedDayGroup(d, i === 0 ? "Aujourd'hui · " : "Demain · ");
      g.isToday = i === 0;
      return g;
    });
  }
  return GROUPS.map((g) => ({
    title: g.title + (g.key === group ? " · aujourd'hui" : ""), he: g.he, sub: "", isToday: g.key === group,
    rows: (c.prayers || []).filter((p) => p.group === g.key).map((p) => ({
      id: p.id, label: p.label, labelHe: p.labelHe, counts: true,
      times: String(p.times || "").split(/[/,;]/).map((x) => x.trim()).filter(validTime)
    }))
  })).filter((g) => g.rows.length);
}

export function nextOffice(view: OfficeGroup[], nowSec: number) {
  const all: { id: string; label: string; t: string; min: number }[] = [];
  view.filter((g) => g.isToday).forEach((g) => g.rows.forEach((p) => { if (p.counts) p.times.forEach((t) => all.push({ id: p.id, label: p.label, t, min: toMin(t) })); }));
  all.sort((a, b) => a.min - b.min);
  return all.find((x) => x.min * 60 > nowSec - 1) || null;
}

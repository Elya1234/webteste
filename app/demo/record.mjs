// Enregistre les données réelles du jour pour la démo : node demo/record.mjs <dossier-de-sortie>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { demoKey, fileFor } from "./key.js";

const out = process.argv[2];
mkdirSync(join(out, "demo-data"), { recursive: true });
const GEO = 2988507, CANDLES = 18;
const REMOTE = "https://script.google.com/macros/s/AKfycbxfsUIHwUQCGC3oQvioq3IJFXLBZQHobTr0K2SOBB-LliZ7ZisnSNGuMlHQnEep_Lswdw/exec";
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
let count = 0;
async function save(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status + " " + url);
  const body = await r.text();
  writeFileSync(join(out, fileFor(demoKey(url))), body);
  count++;
  return JSON.parse(body);
}
const remote = await save(REMOTE);
const cfg = remote.settings || {};
const geo = cfg.geonameid || GEO, b = cfg.candleMinutes || CANDLES;
await save(`https://www.hebcal.com/zmanim?cfg=json&geonameid=${geo}&start=${day(-2)}&end=${day(75)}`);
await save(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&s=on&c=on&M=on&i=off&lg=fr&b=${b}&geonameid=${geo}&start=${day(-2)}&end=${day(110)}`);
for (let i = -1; i <= 4; i++) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i);
  await save(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&s=on&c=on&o=on&i=off&lg=fr&b=${b}&geonameid=${geo}&year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
}
const cal = await save("https://www.sefaria.org/api/calendars?timezone=Europe/Paris");
for (const t of ["Daf Yomi", "Halakhah Yomit"]) {
  const it = cal.calendar_items.find((i) => i.title.en === t);
  if (it?.ref) await save("https://www.sefaria.org/api/v3/texts/" + encodeURIComponent(it.ref) + "?version=hebrew&version=english");
}
const idx = await save("https://www.sefaria.org/api/v2/raw/index/Siddur_Edot_HaMizrach");
const title = (n) => n.titles?.find((t) => t.lang === "en" && t.primary)?.text || n.key;
const refs = [];
const walk = (n, path) => { const ref = path + ", " + title(n); if (n.nodes) n.nodes.forEach((c) => walk(c, ref)); else refs.push(ref); };
idx.schema.nodes.forEach((n) => walk(n, "Siddur Edot HaMizrach"));
for (let i = 0; i < refs.length; i += 8) {
  await Promise.all(refs.slice(i, i + 8).map((ref) => save("https://www.sefaria.org/api/v3/texts/" + encodeURIComponent(ref) + "?version=hebrew").catch((e) => console.error("siddour", e.message))));
}
console.log(count + " réponses enregistrées");

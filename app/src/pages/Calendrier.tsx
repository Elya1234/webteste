import { useEffect, useState } from "react";
import { HDate } from "@hebcal/core";
import { useSynagogue } from "../lib/synagogue";
import { read, write } from "../lib/storage";
import { clean, hm, todayIn, type CalItem } from "../lib/zmanim";

/* Calendrier juif du mois (Hebcal, en français) : fêtes, Roch Hodech, jeûnes, paracha, Chabbat, Omer. */
const KIND: Record<string, string> = { holiday: "fete", roshchodesh: "rh", parashat: "par", candles: "nerot", havdalah: "nerot", omer: "omer", mevarchim: "rh" };
const WD = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Chab"];

function useMonth(year: number, month: number) {
  const { config } = useSynagogue();
  const key = "app.cal." + [config.geonameid, config.candleMinutes, config.havdalah, year, month].join(".");
  const [items, setItems] = useState<CalItem[] | null>(() => read(key));
  useEffect(() => {
    setItems(read(key));
    const hv = config.havdalah ? "&m=" + config.havdalah : "";
    fetch("https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&s=on&c=on&o=on&i=off&lg=fr&b=" + config.candleMinutes + hv +
      "&geonameid=" + config.geonameid + "&year=" + year + "&month=" + month)
      .then((r) => r.json()).then((j: { items?: CalItem[] }) => { write(key, j.items || []); setItems(j.items || []); })
      .catch(() => { /* hors connexion : copie locale, sinon dates hébraïques seules */ });
  }, [key, year, month, config.candleMinutes, config.geonameid, config.havdalah]);
  return items;
}

export default function Calendrier() {
  const { tz } = useSynagogue();
  const today = todayIn(tz);
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [sel, setSel] = useState(today);
  const items = useMonth(ym.y, ym.m);
  const first = new Date(Date.UTC(ym.y, ym.m - 1, 1, 12));
  const nDays = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const ymd = (d: number) => ym.y + "-" + String(ym.m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  const byDay: Record<string, CalItem[]> = {};
  (items || []).forEach((i) => { (byDay[i.date.slice(0, 10)] ||= []).push(i); });
  const hFirst = new HDate(first), hLast = new HDate(new Date(Date.UTC(ym.y, ym.m - 1, nDays, 12)));
  const hebMonths = hFirst.getMonth() === hLast.getMonth() ? hFirst.getMonthName() + " " + hFirst.getFullYear() : hFirst.getMonthName() + " – " + hLast.getMonthName() + " " + hLast.getFullYear();
  const move = (n: number) => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; });
  const selH = new HDate(new Date(sel + "T12:00:00Z"));
  const selItems = byDay[sel] || [];

  return (
    <div className="page narrow">
      <section className="card">
        <div className="cal-head">
          <button className="btn ghost sm" aria-label="Mois précédent" onClick={() => move(-1)}>‹</button>
          <div className="center">
            <div className="serif cal-month cap">{new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" }).format(first)}</div>
            <div className="small gold">{hebMonths}</div>
          </div>
          <button className="btn ghost sm" aria-label="Mois suivant" onClick={() => move(1)}>›</button>
        </div>
        <div className="cal-grid">
          {WD.map((w) => <div key={w} className="cal-wd small muted">{w}</div>)}
          {Array.from({ length: first.getUTCDay() }, (_, i) => <div key={"e" + i} />)}
          {Array.from({ length: nDays }, (_, i) => {
            const d = ymd(i + 1);
            const ev = byDay[d] || [];
            const h = new HDate(new Date(d + "T12:00:00Z"));
            const kinds = Array.from(new Set(ev.map((e) => ((e as CalItem & { subcat?: string }).subcat === "fast" ? "jeune" : KIND[e.category])).filter((k) => k && k !== "nerot" && k !== "omer")));
            const isShab = new Date(d + "T12:00:00Z").getUTCDay() === 6;
            return (
              <button key={d} className={"cal-day" + (d === today ? " today" : "") + (d === sel ? " sel" : "") + (isShab ? " shab" : "") + (kinds.includes("fete") ? " fete" : "")} onClick={() => setSel(d)}>
                <b className="num">{i + 1}</b>
                <span className="hebrew cal-h">{h.renderGematriya(true).split(" ")[0]}</span>
                <span className="cal-dots">{kinds.map((k) => <i key={k} className={"dot " + k} />)}</span>
              </button>
            );
          })}
        </div>
        <div className="cal-legend small muted"><span><i className="dot fete" /> Fête</span><span><i className="dot rh" /> Roch Hodech</span><span><i className="dot jeune" /> Jeûne</span><span><i className="dot par" /> Paracha</span></div>
      </section>

      <section className="card">
        <div className="serif cap" style={{ fontSize: "1.25rem" }}>{new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(sel + "T12:00:00Z"))}</div>
        <div className="gold">{selH.getDate()} {selH.getMonthName()} {selH.getFullYear()} · <span className="hebrew">{selH.renderGematriya(true)}</span></div>
        {selItems.length ? (
          <ul className="cal-events">
            {selItems.map((e, i) => (
              <li key={i}><span>{clean(e.title).replace(/:\s*\d{1,2}:\d{2}$/, "")}{e.hebrew && <span className="hebrew muted"> {e.hebrew}</span>}</span>
                {(e.category === "candles" || e.category === "havdalah") && <b className="num gold-text">{hm(e.date, tz)}</b>}</li>
            ))}
          </ul>
        ) : <p className="muted small">{items ? "Rien de particulier ce jour-là." : "Chargement du calendrier…"}</p>}
      </section>
    </div>
  );
}

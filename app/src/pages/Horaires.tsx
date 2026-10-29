import { useState } from "react";
import { useSynagogue } from "../lib/synagogue";
import { CATALOG, addDays, hebrewDate, hm, officeView, resolveZman, schedDayGroup, todayIn, weekdayIn } from "../lib/zmanim";
import { OfficeList } from "./Home";

export function DayStrip({ day, setDay, days = 8 }: { day: string; setDay: (d: string) => void; days?: number }) {
  const { tz } = useSynagogue();
  const today = todayIn(tz);
  return (
    <div className="day-strip" role="tablist">
      {Array.from({ length: days }, (_, i) => addDays(today, i)).map((d) => {
        const x = new Date(d + "T12:00:00Z");
        return (
          <button key={d} role="tab" aria-selected={d === day} className={"day-chip" + (d === day ? " on" : "")} onClick={() => setDay(d)}>
            <span className="small">{d === today ? "Auj." : new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short" }).format(x)}</span>
            <b className="num">{x.getUTCDate()}</b>
          </button>
        );
      })}
    </div>
  );
}

export default function Horaires() {
  const { config, schedule, tz } = useSynagogue();
  const [day, setDay] = useState(() => todayIn(tz));
  const sched = schedule && config.useSchedule !== false ? schedule.byDate[day] : null;
  const wd = weekdayIn("UTC", new Date(day + "T12:00:00Z"));
  const groups = sched ? [schedDayGroup(sched)] : officeView(config, null, day, wd === 6 ? "shabbat" : wd === 5 ? "friday" : "weekday").filter((g) => g.isToday);
  return (
    <div className="page narrow">
      <DayStrip day={day} setDay={setDay} days={15} />
      <section className="card">
        <h2 className="serif gold-text">Offices <span className="hebrew">תפילות</span></h2>
        {groups.length ? <OfficeList groups={groups.map((g) => ({ ...g, isToday: true }))} /> : <div className="muted">Pas d'horaires pour ce jour.</div>}
      </section>
      <a className="btn ghost full" href="#/zmanim">Zmanim de ce jour</a>
    </div>
  );
}

export function Zmanim() {
  const { config, bundle, tz } = useSynagogue();
  const [day, setDay] = useState(() => todayIn(tz));
  const times = bundle?.days[day];
  const hd = hebrewDate("UTC", new Date(day + "T12:00:00Z"), null);
  return (
    <div className="page narrow">
      <DayStrip day={day} setDay={setDay} days={30} />
      <section className="card">
        <h2 className="serif gold-text">Zmanim <span className="hebrew">זמני היום</span></h2>
        <div className="small muted cap">{new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(day + "T12:00:00Z"))} · {hd.fr} · <span className="hebrew">{hd.he}</span>{bundle && <> · {config.cityLabel || bundle.location.city}</>}</div>
        {!times && <div className="muted">Horaires indisponibles : en attente de Hebcal…</div>}
        <ul className="zmanim">
          {config.zmanim.map((z) => {
            const def = CATALOG[z.id]; if (!def) return null;
            return <li key={z.id}><span>{def.short || def.fr} <span className="hebrew muted">{def.he}</span></span><span className="num gold-text">{hm(resolveZman(times, z.id, z.method), tz)}</span></li>;
          })}
        </ul>
        {!config.validatedByRav && <div className="small muted">Méthodes de calcul à faire valider par le Rav.</div>}
      </section>
    </div>
  );
}

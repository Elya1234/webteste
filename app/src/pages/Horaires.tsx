import { useState } from "react";
import { useSynagogue } from "../lib/synagogue";
import { CATALOG, addDays, hm, officeView, resolveZman, schedDayGroup, todayIn, weekdayIn } from "../lib/zmanim";
import { OfficeList } from "./Home";

export default function Horaires() {
  const { config, bundle, schedule, tz } = useSynagogue();
  const today = todayIn(tz);
  const [day, setDay] = useState(today);
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i));
  const times = bundle?.days[day];
  const sched = schedule && config.useSchedule !== false ? schedule.byDate[day] : null;
  const dt = new Date(day + "T12:00:00Z");
  const wd = weekdayIn("UTC", dt);
  const groups = sched ? [schedDayGroup(sched)] : officeView(config, null, day, wd === 6 ? "shabbat" : wd === 5 ? "friday" : "weekday").filter((g) => g.isToday);

  return (
    <div className="page">
      <div className="day-strip" role="tablist">
        {days.map((d) => {
          const x = new Date(d + "T12:00:00Z");
          return (
            <button key={d} role="tab" aria-selected={d === day} className={"day-chip" + (d === day ? " on" : "")} onClick={() => setDay(d)}>
              <span className="small">{d === today ? "Auj." : new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short" }).format(x)}</span>
              <b className="num">{x.getUTCDate()}</b>
            </button>
          );
        })}
      </div>
      <div className="grid-2">
        <section className="card">
          <h2 className="serif gold-text">Offices <span className="hebrew">תפילות</span></h2>
          {groups.length ? <OfficeList groups={groups.map((g) => ({ ...g, isToday: true }))} /> : <div className="muted">Pas d'horaires pour ce jour.</div>}
        </section>
        <section className="card">
          <h2 className="serif gold-text">Zmanim <span className="hebrew">זמני היום</span></h2>
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
    </div>
  );
}

import { useNow, useSynagogue } from "../lib/synagogue";
import { clean, frenchDate, hebrewDate, hm, nextOffice, nowParts, officeView, parashaName, todayIn, upcoming, wdName, weekdayIn, type OfficeGroup } from "../lib/zmanim";
import { go } from "../lib/router";


const pad = (n: number) => String(n).padStart(2, "0");

export function OfficeList({ groups, nextId }: { groups: OfficeGroup[]; nextId?: string }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.title} className={"office-group" + (g.isToday ? "" : " dim")}>
          <div className="og-title"><span>{g.title}</span><span className="hebrew">{g.he}</span></div>
          {g.sub && <div className="og-sub">{g.sub}</div>}
          {g.rows.map((p) => (
            <div key={p.id} className={"office-row" + (g.isToday && nextId === p.id ? " is-next" : "")}>
              <div>
                <div className="serif or-label">{p.label} {p.labelHe && <span className="hebrew or-he">{p.labelHe}</span>}</div>
                {p.note && <div className="or-note">{p.note}</div>}
              </div>
              <div className="num or-times">{p.times.map((t) => <span key={t}>{t}</span>)}{p.text && <span className="or-text">{p.text}</span>}</div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export default function Home() {
  const { config, bundle, schedule, tz, offline } = useSynagogue();
  const now = useNow();
  const today = todayIn(tz, now);
  const times = bundle?.days[today];
  const hd = hebrewDate(tz, now, times);
  const up = bundle ? upcoming(bundle.calendar, tz, now) : null;
  const np = nowParts(tz, now);
  const nowSec = np.h * 3600 + np.m * 60 + np.s;
  const wd = weekdayIn(tz, now);
  const view = officeView(config, schedule, today, wd === 6 ? "shabbat" : wd === 5 ? "friday" : "weekday");
  const next = nextOffice(view, nowSec);
  const remain = next ? next.min * 60 - nowSec : 0;

  return (
    <div className="page">
      <section className="hero card">
        <div className="hero-date">
          <div className="serif hero-greg">{frenchDate(tz, now)}</div>
          <div className="hero-heb"><span className="gold">{hd.fr}</span> <span className="hebrew">{hd.he}</span></div>
        </div>
        <div className="num gold-text hero-clock">{pad(np.h)}:{pad(np.m)}</div>
        {next && (
          <div className="next-box">
            <div>Prochain office<br /><b className="serif">{next.label} · {next.t}</b></div>
            <div className="num gold-text next-cd">{pad(Math.floor(remain / 3600))}:{pad(Math.floor((remain % 3600) / 60))}:{pad(remain % 60)}</div>
          </div>
        )}
        {offline && <div className="muted small">Hors connexion : dernières données enregistrées.</div>}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="serif gold-text">Offices <span className="hebrew">תפילות</span></h2>
          <OfficeList groups={view} nextId={next?.id} />
          <button className="btn ghost full" onClick={() => go("horaires")}>Les offices des jours suivants</button>
        </section>

        <div className="stack">
          <section className="card">
            <h2 className="serif gold-text">Chabbat <span className="hebrew">שבת</span></h2>
            {up?.parasha && <div className="parasha"><span className="serif">{parashaName(up.parasha)}</span> <span className="hebrew gold">{up.parasha.hebrew}</span></div>}
            <div className="tiles">
              <div className="tile"><div className="muted small">Entrée · הדלקת נרות</div><div className="num gold-text tile-v">{hm(up?.candles?.date, tz)}</div><div className="small">{up?.candles ? wdName(up.candles.date, tz) : ""}</div></div>
              <div className="tile"><div className="muted small">Sortie · הבדלה</div><div className="num gold-text tile-v">{hm(up?.havdalah?.date, tz)}</div><div className="small">{up?.havdalah ? wdName(up.havdalah.date, tz) : ""}</div></div>
            </div>
            {up?.roshChodesh && <div className="small"><span className="gold">{clean(up.roshChodesh.title)}</span> · {new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(up.roshChodesh.date.slice(0, 10) + "T12:00:00Z"))}</div>}
            {up?.holidays[0] && <div className="small muted">{clean(up.holidays[0].title)}</div>}
          </section>

          <section className="card">
            <h2 className="serif gold-text">Annonces <span className="hebrew">הודעות</span></h2>
            {config.announcements.length
              ? <ul className="ann">{config.announcements.map((a, i) => <li key={i}>{a}</li>)}</ul>
              : <div className="muted">Aucune annonce pour le moment.</div>}
          </section>

          <section className="card cta">
            <div><b className="serif">Soutenir la synagogue</b><div className="small muted">Don, cotisation, kibboud, dédicace.</div></div>
            <button className="btn" onClick={() => go("dons")}>Faire un don</button>
          </section>
        </div>
      </div>

      {(config.dedication || config.dedicationNames) && (
        <section className="dedication">
          {config.dedication && <div className="hebrew gold-text">{config.dedication}</div>}
          {config.dedication && config.dedicationNames && <div className="ded-sep" aria-hidden="true"><i /><span>✦</span><i /></div>}
          {config.dedicationNames && <div className="hebrew gold-text">{config.dedicationNames.split("\n").join(" ")}</div>}
        </section>
      )}
    </div>
  );
}

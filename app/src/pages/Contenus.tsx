import { loc, t } from "../lib/i18n";
import { useEffect, useState } from "react";
import { courseCounts, listCourses, listPhotos, listVideos, myRegistrations, registerCourse, unregisterCourse, type Course, type Photo, type Video } from "../lib/backend";
import { useAuth } from "../lib/auth";
import { go } from "../lib/router";

function useList<T>(fn: () => Promise<T[]>) {
  const [v, setV] = useState<T[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { fn().then(setV, () => setErr(true)); }, [fn]);
  return { v, err };
}
const Loading = ({ err }: { err: boolean }) => <div className="muted">{err ? t("Impossible de charger. Vérifiez votre connexion.") : t("Chargement…")}</div>;

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Chabbat"];
export function Cours() {
  const { v, err } = useList<Course>(listCourses);
  const { profile } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const refresh = () => { courseCounts().then(setCounts, () => {}); if (profile) myRegistrations().then(setMine, () => {}); };
  useEffect(refresh, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function toggle(c: Course) {
    if (!profile) { go("compte", "suite=cours"); return; }
    setBusy(c.id); setMsg("");
    try { if (mine.includes(c.id)) await unregisterCourse(c.id); else await registerCourse(c); }
    catch (e) { setMsg(/complet/.test(String(e)) ? t("Inscription impossible : le cours est complet.") : t("Une erreur est survenue. Réessayez.")); }
    refresh(); setBusy("");
  }
  return (
    <div className="page narrow">
      <section className="card">
        <h2 className="serif gold-text">{t("Cours à la synagogue")} <span className="hebrew">שיעורים</span></h2>
        {msg && <p className="error small">{msg}</p>}
        {!v ? <Loading err={err} /> : !v.length ? <div className="muted">{t("Aucun cours annoncé.")}</div> : DAYS.filter((d) => v.some((c) => c.day === d)).concat(v.some((c) => !DAYS.includes(c.day)) ? ["Autres"] : []).map((d) => (
          <div key={d} className="office-group">
            <div className="og-title"><span>{d}</span></div>
            {v.filter((c) => (d === "Autres" ? !DAYS.includes(c.day) : c.day === d)).map((c) => (
              <div key={c.id} className="office-row">
                <div><div className="serif or-label">{c.title}</div><div className="small muted">{[c.rav, c.place, c.audience].filter(Boolean).join(" · ")}</div>{c.description && <div className="or-note">{c.description}</div>}</div>
                <div className="course-side">
                  <div className="num or-times">{c.time}</div>
                  {c.registration && (() => {
                    const n = counts[c.id] || 0, full = !!c.capacity && n >= c.capacity, me = mine.includes(c.id);
                    return <>
                      <span className="small muted">{c.capacity ? t("{n} / {c} places", { n, c: c.capacity }) : t("{n} inscrit(s)", { n })}</span>
                      <button className={"btn sm-text " + (me ? "ghost" : "")} disabled={busy === c.id || (full && !me)} onClick={() => toggle(c)}>
                        {me ? t("Se désinscrire") : full ? t("Complet") : t("S'inscrire")}</button>
                      {me && <span className="small status-paid">{t("Inscrit ✓")}</span>}
                    </>;
                  })()}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

export function Videos() {
  const { v, err } = useList<Video>(listVideos);
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <div className="page">
      <h2 className="serif gold-text">{t("Cours en vidéo")} <span className="hebrew">שיעורי וידאו</span></h2>
      {!v ? <Loading err={err} /> : !v.length ? <div className="card muted">{t("Les vidéos des cours seront bientôt ajoutées ici.")}</div> : (
        <div className="products">
          {v.map((x) => (
            <article key={x.id} className="card product">
              <div className="video">
                {playing === x.id
                  ? <iframe src={"https://www.youtube-nocookie.com/embed/" + encodeURIComponent(x.youtube_id) + "?autoplay=1"} title={x.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                  : <button onClick={() => setPlaying(x.id)} aria-label={"Lire " + x.title}><img src={"https://i.ytimg.com/vi/" + encodeURIComponent(x.youtube_id) + "/hqdefault.jpg"} alt="" loading="lazy" /><span className="play">▶</span></button>}
              </div>
              <h3 className="serif">{x.title}</h3>
              <div className="small muted">{x.rav}{x.published_at && " · " + new Date(x.published_at).toLocaleDateString(loc())}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function Galerie() {
  const { v, err } = useList<Photo>(listPhotos);
  const [open, setOpen] = useState<Photo | null>(null);
  const albums = v ? Array.from(new Set(v.map((p) => p.album))) : [];
  return (
    <div className="page">
      <h2 className="serif gold-text">{t("Galerie")} <span className="hebrew">גלריה</span></h2>
      {!v ? <Loading err={err} /> : !v.length ? <div className="card muted">{t("Les photos seront bientôt ajoutées ici.")}</div> : albums.map((a) => (
        <section key={a}>
          <h3 className="serif">{a}</h3>
          <div className="gallery">{v.filter((p) => p.album === a).map((p) => <button key={p.id} onClick={() => setOpen(p)}><img src={p.url} alt={p.caption} loading="lazy" /></button>)}</div>
        </section>
      ))}
      {open && (
        <div className="sheet-bg lightbox" onClick={() => setOpen(null)} role="dialog" aria-label={open.caption}>
          <figure><img src={open.url} alt={open.caption} /><figcaption>{open.caption}</figcaption></figure>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { getText, todaysLearning, type CalendarItem } from "../lib/sefaria";

/* Halakha Yomit (Choulhan Aroukh de Maran) et Daf Hayomi : la lecture du jour, en hébreu, traduction anglaise si disponible. */
export default function Etude({ kind }: { kind: "halakha" | "daf" }) {
  const [item, setItem] = useState<CalendarItem | null>(null);
  const [text, setText] = useState<{ he: string[]; en: string[] } | null>(null);
  const [lang, setLang] = useState<"he" | "en">("he");
  const [err, setErr] = useState("");
  useEffect(() => {
    todaysLearning().then((t) => {
      const it = kind === "daf" ? t.daf : t.halakha;
      setItem(it);
      if (it?.ref) return getText(it.ref, ["hebrew", "english"]).then(setText);
    }).catch(() => setErr("Pas de connexion : la lecture du jour n'a pas pu être chargée."));
  }, [kind]);

  const title = kind === "daf" ? "Daf Hayomi" : "Halakha Yomit";
  const he = kind === "daf" ? "דף היומי" : "הלכה יומית";
  const paras = text ? (lang === "en" && text.en.length ? text.en : text.he) : [];
  return (
    <div className="page narrow">
      <section className="card">
        <h2 className="serif gold-text">{title} <span className="hebrew">{he}</span></h2>
        {item && <div className="study-ref"><b>{item.displayValue.en}</b> · <span className="hebrew gold">{item.displayValue.he}</span></div>}
        {kind === "halakha" && <p className="small muted">Le Choulhan Aroukh de Maran Rabbi Yossef Karo, quelques paragraphes chaque jour.</p>}
        {text && text.en.length > 0 && (
          <div className="seg" style={{ marginTop: 12 }}>
            <button className={lang === "he" ? "on" : ""} onClick={() => setLang("he")}>Texte original</button>
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>Traduction (anglais)</button>
          </div>
        )}
        {err && <p className="error">{err}</p>}
        {!text && !err && <p className="muted">Chargement…</p>}
        <div className={"study-text" + (lang === "he" ? " hebrew" : "")}>
          {paras.map((p, i) => <p key={i} dangerouslySetInnerHTML={{ __html: p }} />)}
        </div>
        <p className="small muted">Texte : Sefaria.org</p>
      </section>
    </div>
  );
}

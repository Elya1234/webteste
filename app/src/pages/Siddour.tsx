import { useEffect, useState } from "react";
import { getText, siddurOutline, type SiddurNode } from "../lib/sefaria";
import { go } from "../lib/router";
import { read, write } from "../lib/storage";

/* Siddour séfarade (nossah Edot HaMizrah, Sefaria, domaine public). Sommaire → lecture d'une prière. */
const leaves = (ns: SiddurNode[]): SiddurNode[] => ns.flatMap((n) => (n.children ? leaves(n.children) : [n]));

export default function Siddour({ params }: { params: URLSearchParams }) {
  const ref = params.get("ref");
  const [outline, setOutline] = useState<SiddurNode[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { siddurOutline().then(setOutline, () => setErr("Pas de connexion : ouvrez le Siddour une première fois avec Internet, il restera ensuite disponible.")); }, []);
  if (err) return <div className="page narrow"><div className="card">{err}</div></div>;
  if (!outline) return <div className="page narrow"><div className="card muted">Chargement du Siddour…</div></div>;
  return ref ? <Reader refName={ref} all={leaves(outline)} /> : <Outline outline={outline} />;
}

function Outline({ outline }: { outline: SiddurNode[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="page narrow">
      <section className="card">
        <h2 className="serif gold-text">Siddour <span className="hebrew">סידור עדות המזרח</span></h2>
        <p className="small muted">Rite séfarade (Edot HaMizrah).</p>
        <ul className="sid-list">
          {outline.map((n) => (
            <li key={n.key}>
              {n.children ? (
                <>
                  <button className="sid-sec" aria-expanded={open === n.key} onClick={() => setOpen(open === n.key ? null : n.key)}>
                    <span className="hebrew sid-he">{n.he}</span><span className="small muted">{n.en}</span><span className="gold">{open === n.key ? "−" : "+"}</span>
                  </button>
                  {open === n.key && <ul className="sid-sub">{n.children.map((c) => <li key={c.key}><a href={"#/siddour?ref=" + encodeURIComponent(c.ref)}><span className="hebrew">{c.he}</span><span className="small muted">{c.en}</span></a></li>)}</ul>}
                </>
              ) : (
                <a className="sid-sec" href={"#/siddour?ref=" + encodeURIComponent(n.ref)}><span className="hebrew sid-he">{n.he}</span><span className="small muted">{n.en}</span><span /></a>
              )}
            </li>
          ))}
        </ul>
        <p className="small muted">Texte : Sefaria.org (domaine public).</p>
      </section>
    </div>
  );
}

function Reader({ refName, all }: { refName: string; all: SiddurNode[] }) {
  const [paras, setParas] = useState<string[] | null>(null);
  const [err, setErr] = useState(false);
  const [size, setSize] = useState(() => read<number>("app.siddour.size") || 1.35);
  const i = all.findIndex((n) => n.ref === refName);
  const node = all[i];
  useEffect(() => { setParas(null); setErr(false); getText(refName).then((t) => setParas(t.he), () => setErr(true)); }, [refName]);
  const zoom = (d: number) => { const v = Math.min(2.6, Math.max(1, Math.round((size + d) * 100) / 100)); setSize(v); write("app.siddour.size", v); };
  const open = (n?: SiddurNode) => n && go("siddour", "ref=" + encodeURIComponent(n.ref));
  return (
    <div className="page narrow">
      <div className="reader-bar">
        <a className="btn ghost" href="#/siddour">‹ Sommaire</a>
        <div className="row-end"><button className="btn ghost sm" aria-label="Texte plus petit" onClick={() => zoom(-0.15)}>A−</button><button className="btn ghost sm" aria-label="Texte plus grand" onClick={() => zoom(0.15)}>A+</button></div>
      </div>
      <article className="card">
        {node && <h2 className="hebrew gold-text center">{node.he}</h2>}
        {err && <p className="error">Pas de connexion : cette prière n'a pas encore été enregistrée sur l'appareil.</p>}
        {!paras && !err && <p className="muted">Chargement…</p>}
        <div className="hebrew sid-text" style={{ fontSize: size + "rem" }}>{paras?.map((p, k) => <p key={k} dangerouslySetInnerHTML={{ __html: p }} />)}</div>
      </article>
      <div className="reader-bar">
        <button className="btn ghost" disabled={i <= 0} onClick={() => open(all[i - 1])}>‹ Précédent</button>
        <button className="btn ghost" disabled={i < 0 || i >= all.length - 1} onClick={() => open(all[i + 1])}>Suivant ›</button>
      </div>
    </div>
  );
}

import { t } from "../lib/i18n";
import { useEffect, useState } from "react";
import { getText, siddurOutline, type SiddurNode } from "../lib/sefaria";
import { CATEGORIES, fr, suggestion } from "../lib/siddour-fr";
import { go } from "../lib/router";
import { read, write } from "../lib/storage";
import { LineIcon } from "./Menu";

/* Siddour séfarade (nossah Edot HaMizrah, Sefaria, domaine public).
 * 4 rubriques → parties (carrés) → prières (liste) → lecture. */
const leaves = (ns: SiddurNode[]): SiddurNode[] => ns.flatMap((n) => (n.children ? leaves(n.children) : [n]));
const link = (q: Record<string, string>) => "#/siddour?" + new URLSearchParams(q).toString();

export default function Siddour({ params }: { params: URLSearchParams }) {
  const [outline, setOutline] = useState<SiddurNode[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { siddurOutline().then(setOutline, () => setErr(t("Pas de connexion : ouvrez le Siddour une première fois avec Internet, il restera ensuite disponible."))); }, []);
  if (err) return <div className="page narrow"><div className="card">{err}</div></div>;
  if (!outline) return <div className="page narrow"><div className="card muted">{t("Chargement du Siddour…")}</div></div>;

  const ref = params.get("ref"), sec = params.get("sec"), cat = params.get("cat");
  const all = leaves(outline);
  if (ref) return <Reader refName={ref} all={all} outline={outline} />;
  const section = sec ? outline.find((n) => n.en === sec) : null;
  if (section) return <Section node={section} />;
  const category = CATEGORIES.find((c) => c.id === cat);
  if (category) return <CategoryView cat={category} outline={outline} />;
  return <Home outline={outline} />;
}

function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav className="crumbs" aria-label="Fil d'Ariane">
      {items.map(([label, href], i) => (
        <span key={i}>{i > 0 && <span className="crumb-sep">›</span>}{href ? <a href={href}>{label}</a> : <b>{label}</b>}</span>
      ))}
    </nav>
  );
}

function Home({ outline }: { outline: SiddurNode[] }) {
  const s = suggestion();
  const sec = outline.find((n) => n.en === s.section);
  return (
    <div className="page narrow">
      <Crumbs items={[[t("Menu"), "#/menu"], [t("Siddour")]]} />
      <header className="page-head">
        <h1 className="serif gold-text">{t("Siddour")} <span className="hebrew">סידור</span></h1>
        <p className="muted">{t("Rite séfarade, nossah Edot Hamizrah.")}</p>
      </header>
      {sec && (
        <a className="card now-card" href={sec.children ? link({ sec: sec.en }) : link({ ref: sec.ref })}>
          <span className="small muted">{t("À prier maintenant")}</span>
          <b className="serif">{fr(s.section)}</b>
          <span className="hebrew gold">{sec.he}</span>
        </a>
      )}
      <div className="tiles-sq">
        {CATEGORIES.map((c) => (
          <a key={c.id} className="card tile-sq" href={link({ cat: c.id })}>
            <span className="tile-ic"><LineIcon d={c.icon} size={26} /></span>
            <b>{t(c.label)}</b>
            <span className="hebrew muted">{c.he}</span>
            <span className="small muted">{t("{n} parties", { n: c.sections.length })}</span>
          </a>
        ))}
      </div>
      <p className="small muted">{t("Texte : Sefaria.org (domaine public). Chaque prière ouverte reste lisible sans Internet.")}</p>
    </div>
  );
}

function CategoryView({ cat, outline }: { cat: (typeof CATEGORIES)[number]; outline: SiddurNode[] }) {
  const nodes = cat.sections.map((en) => outline.find((n) => n.en === en)).filter((n): n is SiddurNode => !!n);
  return (
    <div className="page narrow">
      <Crumbs items={[[t("Siddour"), "#/siddour"], [t(cat.label)]]} />
      <header className="page-head"><h1 className="serif gold-text">{t(cat.label)} <span className="hebrew">{cat.he}</span></h1></header>
      <div className="tiles-sq">
        {nodes.map((n) => (
          <a key={n.key} className="card tile-sq" href={n.children ? link({ sec: n.en, cat: cat.id }) : link({ ref: n.ref })}>
            <b>{fr(n.en)}</b>
            <span className="hebrew gold">{n.he}</span>
            <span className="small muted">{n.children ? t("{n} prières", { n: n.children.length }) : t("Lire")}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Section({ node }: { node: SiddurNode }) {
  const cat = CATEGORIES.find((c) => c.sections.includes(node.en));
  return (
    <div className="page narrow">
      <Crumbs items={[[t("Siddour"), "#/siddour"], ...(cat ? [[t(cat.label), link({ cat: cat.id })] as [string, string]] : []), [fr(node.en)]]} />
      <header className="page-head"><h1 className="serif gold-text">{fr(node.en)}</h1><div className="hebrew gold head-he">{node.he}</div></header>
      <ol className="card prayer-list">
        {(node.children || []).map((c, i) => (
          <li key={c.key}><a href={link({ ref: c.ref })}>
            <span className="num pl-n">{i + 1}</span>
            <span className="pl-t"><b>{fr(c.en)}</b><span className="hebrew muted">{c.he}</span></span>
            <span className="gold" aria-hidden="true">›</span>
          </a></li>
        ))}
      </ol>
    </div>
  );
}

function Reader({ refName, all, outline }: { refName: string; all: SiddurNode[]; outline: SiddurNode[] }) {
  const [paras, setParas] = useState<string[] | null>(null);
  const [err, setErr] = useState(false);
  const [size, setSize] = useState(() => read<number>("app.siddour.size") || 1.35);
  const i = all.findIndex((n) => n.ref === refName);
  const node = all[i];
  const parent = outline.find((n) => refName.startsWith(n.ref + ",") || n.ref === refName);
  useEffect(() => { setParas(null); setErr(false); getText(refName).then((t) => setParas(t.he), () => setErr(true)); }, [refName]);
  const zoom = (d: number) => { const v = Math.min(2.6, Math.max(1, Math.round((size + d) * 100) / 100)); setSize(v); write("app.siddour.size", v); };
  const open = (n?: SiddurNode) => n && go("siddour", "ref=" + encodeURIComponent(n.ref));
  const prev = all[i - 1], next = all[i + 1];
  return (
    <div className="page narrow">
      <Crumbs items={[[t("Siddour"), "#/siddour"], ...(parent && parent.children ? [[fr(parent.en), link({ sec: parent.en })] as [string, string]] : [])]} />
      <div className="reader-bar">
        <header className="page-head"><h1 className="serif gold-text">{node ? fr(node.en) : t("Siddour")}</h1>{node && <div className="hebrew gold head-he">{node.he}</div>}</header>
        <div className="zoom" role="group" aria-label={t("Taille du texte")}>
          <button className="btn ghost sm" aria-label={t("Texte plus petit")} onClick={() => zoom(-0.15)}>A−</button>
          <button className="btn ghost sm" aria-label={t("Texte plus grand")} onClick={() => zoom(0.15)}>A+</button>
        </div>
      </div>
      <article className="card reader">
        {err && <p className="error">{t("Pas de connexion : cette prière n'a pas encore été enregistrée sur l'appareil.")}</p>}
        {!paras && !err && <p className="muted">{t("Chargement…")}</p>}
        <div className="hebrew sid-text" style={{ fontSize: size + "rem" }}>{paras?.map((p, k) => <p key={k} dangerouslySetInnerHTML={{ __html: p }} />)}</div>
      </article>
      <div className="pager">
        <button className="card pager-btn" disabled={!prev} onClick={() => open(prev)}><span className="small muted">{t("‹ Précédent")}</span><b>{prev ? fr(prev.en) : "—"}</b></button>
        <button className="card pager-btn right" disabled={!next} onClick={() => open(next)}><span className="small muted">{t("Suivant ›")}</span><b>{next ? fr(next.en) : "—"}</b></button>
      </div>
    </div>
  );
}

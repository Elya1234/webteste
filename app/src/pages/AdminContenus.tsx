import { useEffect, useState } from "react";
import { euros, listCourses, listPhotos, listProducts, listVideos, type ContentTable, type Course, type Photo, type Product, type Video } from "../lib/backend";
import { courseRegistrants, deleteContent, listMembers, saveContent, sendMessage, uploadImage, type ContentRow, type Member } from "../lib/admin";
import { courseCounts } from "../lib/backend";

/* Administration › Contenus : tout ce que les membres voient dans la boutique, les cours, les vidéos et la galerie. */
type Kind = "products" | "courses" | "videos" | "gallery";
const KINDS: [Kind, string][] = [["products", "Boutique"], ["courses", "Cours"], ["videos", "Vidéos"], ["gallery", "Galerie"]];
const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Chabbat"];
const youtubeId = (s: string) => (s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/) || s.match(/^([\w-]{11})$/) || [])[1] || "";

export default function AdminContenus() {
  const [kind, setKind] = useState<Kind>("products");
  return (
    <>
      <div className="seg four" role="tablist">
        {KINDS.map(([k, l]) => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {kind === "products" && <Products />}
      {kind === "courses" && <Courses />}
      {kind === "videos" && <Videos />}
      {kind === "gallery" && <Gallery />}
    </>
  );
}

/* Liste + fenêtre d'ajout / modification, commune aux 4 contenus */
function useRows<T>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const reload = () => load().then(setRows, () => setRows([]));
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { rows, reload };
}
function Confirm({ onYes, label = "Supprimer" }: { onYes: () => void; label?: string }) {
  const [ask, setAsk] = useState(false);
  return ask
    ? <span className="row-end"><button className="btn danger-solid sm-text" onClick={onYes}>Confirmer</button><button className="link small" onClick={() => setAsk(false)}>Annuler</button></span>
    : <button className="link small danger" onClick={() => setAsk(true)}>{label}</button>;
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet card member-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="card-head"><h2 className="serif gold-text">{title}</h2><button className="btn ghost sm" aria-label="Fermer" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}
function useSave(table: ContentTable, done: () => void) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async (row: ContentRow) => {
    setBusy(true); setErr("");
    try { await saveContent(table, row); done(); } catch (x) { setErr((x as Error).message || "Enregistrement impossible."); }
    setBusy(false);
  };
  return { busy, err, setErr, save };
}
function PhotoPicker({ id, value, onChange }: { id: string; value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="field"><span>Photo</span>
      <div className="photo-pick">
        {value ? <img src={value} alt="" /> : <span className="muted small">Aucune photo</span>}
        <label className="btn ghost" htmlFor={id}>{busy ? "Envoi…" : value ? "Changer" : "Choisir une photo"}</label>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return; setBusy(true); setErr("");
          try { onChange(await uploadImage(f)); } catch (x) { setErr((x as Error).message); } setBusy(false); e.target.value = "";
        }} />
        {value && <button type="button" className="link small" onClick={() => onChange("")}>Retirer</button>}
      </div>
      {err && <span className="error small">{err}</span>}
    </div>
  );
}
const Empty = ({ what, onAdd }: { what: string; onAdd: () => void }) => (
  <div className="empty"><p className="muted">Aucun {what} pour le moment.</p><button className="btn" onClick={onAdd}>+ Ajouter</button></div>
);

/* ───────── Boutique ───────── */
function Products() {
  const { rows, reload } = useRows(() => listProducts(true));
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const cats = Array.from(new Set((rows || []).map((p) => p.category))).sort();
  return (
    <section className="card">
      <div className="card-head"><h2 className="serif gold-text">Boutique</h2><button className="btn" onClick={() => setEdit({ active: true, category: cats[0] || "Livres" })}>+ Ajouter un article</button></div>
      {!rows ? <p className="muted">Chargement…</p> : !rows.length ? <Empty what="article" onAdd={() => setEdit({ active: true, category: "Livres" })} /> : (
        <ul className="admin-list">{rows.map((p) => (
          <li key={p.id}>
            <div className="content-row">{p.image_url ? <img className="thumb" src={p.image_url} alt="" /> : <span className="thumb" aria-hidden="true">✡</span>}
              <div><b>{p.name}</b><div className="small muted">Réf. {p.ref} · {p.category} · {p.stock === null ? "stock illimité" : p.stock + " en stock"}{!p.active && " · masqué"}</div>
                {p.comment_label && <div className="small">Commentaire demandé : « {p.comment_label} »</div>}</div></div>
            <div className="right"><b className="num">{euros(p.price_cents)}</b><div className="row-end"><button className="link small" onClick={() => setEdit(p)}>Modifier</button>
              <Confirm label="Retirer" onYes={() => deleteContent("products", p.id).then(reload)} /></div></div>
          </li>
        ))}</ul>
      )}
      {edit && <ProductForm initial={edit} cats={cats} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </section>
  );
}
function ProductForm({ initial, cats, onClose, onSaved }: { initial: Partial<Product>; cats: string[]; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState({ ref: initial.ref || "", name: initial.name || "", description: initial.description || "", category: initial.category || "",
    price: initial.price_cents ? (initial.price_cents / 100).toFixed(2).replace(".", ",") : "", stock: initial.stock == null ? "" : String(initial.stock),
    ask: !!initial.comment_label, comment_label: initial.comment_label || "", image_url: initial.image_url || "", active: initial.active !== false });
  const { busy, err, setErr, save } = useSave("products", onSaved);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = Math.round(Number(p.price.replace(",", ".")) * 100);
    if (!(price > 0)) { setErr("Indiquez un prix."); return; }
    if (p.stock && !/^\d+$/.test(p.stock)) { setErr("Le stock est un nombre entier (vide = illimité)."); return; }
    save({ id: initial.id, ref: p.ref.trim().toUpperCase(), name: p.name.trim(), description: p.description.trim(), category: p.category.trim() || "Divers",
      price_cents: price, stock: p.stock === "" ? null : Number(p.stock), comment_label: p.ask ? p.comment_label.trim() || "Commentaire" : null, image_url: p.image_url || null, active: p.active });
  }
  return (
    <Sheet title={initial.id ? "Modifier l'article" : "Nouvel article"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid-2 tight">
          <label className="field"><span>Référence</span><input id="p-ref" className="input" required maxLength={20} value={p.ref} onChange={(e) => setP({ ...p, ref: e.target.value })} placeholder="SID-001" /></label>
          <label className="field"><span>Prix (€)</span><input id="p-price" className="input num" required inputMode="decimal" value={p.price} onChange={(e) => setP({ ...p, price: e.target.value.replace(/[^\d,.]/g, "") })} /></label>
        </div>
        <label className="field"><span>Nom</span><input id="p-name" className="input" required maxLength={120} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <label className="field"><span>Catégorie</span><input id="p-cat" className="input" list="p-cats" required maxLength={40} value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })} />
          <datalist id="p-cats">{[...new Set([...cats, "Livres", "Objets", "Dédicaces"])].map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="field"><span>Description</span><textarea id="p-desc" className="input" rows={2} maxLength={600} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></label>
        <label className="field"><span>Stock (vide = illimité)</span><input id="p-stock" className="input num" inputMode="numeric" value={p.stock} onChange={(e) => setP({ ...p, stock: e.target.value.replace(/\D/g, "") })} /></label>
        <label className="check"><input type="checkbox" checked={p.ask} onChange={(e) => setP({ ...p, ask: e.target.checked })} /> Demander un commentaire à l'acheteur (dédicace, nom…)</label>
        {p.ask && <label className="field"><span>Question posée</span><input id="p-ask" className="input" maxLength={120} value={p.comment_label} onChange={(e) => setP({ ...p, comment_label: e.target.value })} placeholder="Nom à inscrire (Leilouy Nichmat…)" /></label>}
        <PhotoPicker id="p-photo" value={p.image_url} onChange={(u) => setP({ ...p, image_url: u })} />
        <label className="check"><input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Visible dans la boutique</label>
        {err && <p className="error">{err}</p>}
        <button className="btn full" disabled={busy}>{busy ? "…" : "Enregistrer"}</button>
      </form>
    </Sheet>
  );
}

/* ───────── Cours ───────── */
function Courses() {
  const { rows, reload } = useRows<Course & { position?: number }>(listCourses);
  const [edit, setEdit] = useState<Partial<Course & { position?: number }> | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [who, setWho] = useState<Course | null>(null);
  useEffect(() => { courseCounts().then(setCounts, () => {}); }, [rows]);
  return (
    <section className="card">
      <div className="card-head"><h2 className="serif gold-text">Cours</h2><button className="btn" onClick={() => setEdit({ day: "Dimanche", audience: "Tous" })}>+ Ajouter un cours</button></div>
      {!rows ? <p className="muted">Chargement…</p> : !rows.length ? <Empty what="cours" onAdd={() => setEdit({ day: "Dimanche", audience: "Tous" })} /> : (
        <ul className="admin-list">{rows.map((c) => (
          <li key={c.id}><div><b>{c.title}</b><div className="small muted">{c.day} · {c.time} · {[c.rav, c.place, c.audience].filter(Boolean).join(" · ")}</div>
            {c.registration && <div className="small gold">Inscriptions ouvertes · {counts[c.id] || 0}{c.capacity ? " / " + c.capacity : ""} inscrit(s)</div>}</div>
            <div className="row-end">{c.registration && <button className="link small" onClick={() => setWho(c)}>Inscrits</button>}<button className="link small" onClick={() => setEdit(c)}>Modifier</button><Confirm onYes={() => deleteContent("courses", c.id).then(reload)} /></div></li>
        ))}</ul>
      )}
      {edit && <CourseForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {who && <Registrants course={who} onClose={() => setWho(null)} />}
    </section>
  );
}
function CourseForm({ initial, onClose, onSaved }: { initial: Partial<Course & { position?: number }>; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState({ title: initial.title || "", rav: initial.rav || "", day: initial.day || "Dimanche", time: initial.time || "", place: initial.place || "",
    audience: initial.audience || "Tous", description: initial.description || "", registration: !!initial.registration, capacity: initial.capacity ? String(initial.capacity) : "" });
  const { busy, err, save } = useSave("courses", onSaved);
  const set = (k: "title" | "rav" | "day" | "time" | "place" | "audience" | "description") => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });
  return (
    <Sheet title={initial.id ? "Modifier le cours" : "Nouveau cours"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save({ id: initial.id, ...c, capacity: c.registration && c.capacity ? Number(c.capacity) : null, title: c.title.trim(), position: DAYS.indexOf(c.day) * 10000 + (Number(c.time.replace(/\D/g, "")) || 0) }); }}>
        <label className="field"><span>Titre</span><input id="c-title" className="input" required maxLength={120} value={c.title} onChange={set("title")} placeholder="Guemara, Halakha, Paracha…" /></label>
        <div className="grid-2 tight">
          <label className="field"><span>Jour</span><select id="c-day" className="input" value={c.day} onChange={set("day")}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label className="field"><span>Heure</span><input id="c-time" className="input" required maxLength={30} value={c.time} onChange={set("time")} placeholder="20:30 ou Avant Minha" /></label>
        </div>
        <div className="grid-2 tight">
          <label className="field"><span>Rav / intervenant</span><input id="c-rav" className="input" maxLength={80} value={c.rav} onChange={set("rav")} /></label>
          <label className="field"><span>Salle</span><input id="c-place" className="input" maxLength={80} value={c.place} onChange={set("place")} /></label>
        </div>
        <label className="field"><span>Public</span><select id="c-aud" className="input" value={c.audience} onChange={set("audience")}>{["Tous", "Hommes", "Femmes", "Jeunes", "Enfants"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="field"><span>Description</span><textarea id="c-desc" className="input" rows={2} maxLength={600} value={c.description} onChange={set("description")} /></label>
        <label className="check"><input type="checkbox" checked={c.registration} onChange={(e) => setC({ ...c, registration: e.target.checked })} /> Les membres peuvent s'inscrire depuis l'application</label>
        {c.registration && <label className="field"><span>Nombre de places (vide = sans limite)</span><input id="c-cap" className="input num" inputMode="numeric" value={c.capacity} onChange={(e) => setC({ ...c, capacity: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>}
        {err && <p className="error">{err}</p>}
        <button className="btn full" disabled={busy}>{busy ? "…" : "Enregistrer"}</button>
      </form>
    </Sheet>
  );
}

/* ───────── Vidéos ───────── */
function Videos() {
  const { rows, reload } = useRows<Video>(listVideos);
  const [edit, setEdit] = useState<Partial<Video> | null>(null);
  return (
    <section className="card">
      <div className="card-head"><h2 className="serif gold-text">Cours en vidéo</h2><button className="btn" onClick={() => setEdit({})}>+ Ajouter une vidéo</button></div>
      {!rows ? <p className="muted">Chargement…</p> : !rows.length ? <Empty what="vidéo" onAdd={() => setEdit({})} /> : (
        <ul className="admin-list">{rows.map((v) => (
          <li key={v.id}><div className="content-row"><img className="thumb" src={"https://i.ytimg.com/vi/" + v.youtube_id + "/default.jpg"} alt="" /><div><b>{v.title}</b><div className="small muted">{v.rav}{v.published_at && " · " + new Date(v.published_at).toLocaleDateString("fr-FR")}</div></div></div>
            <div className="row-end"><button className="link small" onClick={() => setEdit(v)}>Modifier</button><Confirm onYes={() => deleteContent("videos", v.id).then(reload)} /></div></li>
        ))}</ul>
      )}
      {edit && <VideoForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </section>
  );
}
function VideoForm({ initial, onClose, onSaved }: { initial: Partial<Video>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ title: initial.title || "", rav: initial.rav || "", link: initial.youtube_id ? "https://youtu.be/" + initial.youtube_id : "", date: initial.published_at?.slice(0, 10) || new Date().toISOString().slice(0, 10) });
  const { busy, err, setErr, save } = useSave("videos", onSaved);
  const id = youtubeId(v.link.trim());
  return (
    <Sheet title={initial.id ? "Modifier la vidéo" : "Nouvelle vidéo"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (!id) { setErr("Collez le lien de la vidéo YouTube (youtube.com/watch?v=… ou youtu.be/…)."); return; } save({ id: initial.id, title: v.title.trim(), rav: v.rav.trim(), youtube_id: id, published_at: v.date }); }}>
        <label className="field"><span>Lien YouTube</span><input id="v-link" className="input" required value={v.link} onChange={(e) => setV({ ...v, link: e.target.value })} placeholder="https://youtu.be/…" /></label>
        {id && <img className="yt-preview" src={"https://i.ytimg.com/vi/" + id + "/mqdefault.jpg"} alt="Aperçu" />}
        <label className="field"><span>Titre</span><input id="v-title" className="input" required maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <div className="grid-2 tight">
          <label className="field"><span>Rav / intervenant</span><input id="v-rav" className="input" maxLength={80} value={v.rav} onChange={(e) => setV({ ...v, rav: e.target.value })} /></label>
          <label className="field"><span>Date</span><input id="v-date" className="input" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></label>
        </div>
        {err && <p className="error">{err}</p>}
        <button className="btn full" disabled={busy}>{busy ? "…" : "Enregistrer"}</button>
      </form>
    </Sheet>
  );
}

/* ───────── Galerie ───────── */
function Gallery() {
  const { rows, reload } = useRows<Photo>(listPhotos);
  const [edit, setEdit] = useState<Partial<Photo> | null>(null);
  const albums = Array.from(new Set((rows || []).map((p) => p.album)));
  return (
    <section className="card">
      <div className="card-head"><h2 className="serif gold-text">Galerie</h2><button className="btn" onClick={() => setEdit({ album: albums[0] || "La synagogue" })}>+ Ajouter une photo</button></div>
      {!rows ? <p className="muted">Chargement…</p> : !rows.length ? <Empty what="photo" onAdd={() => setEdit({ album: "La synagogue" })} /> : (
        <div className="gallery admin-gallery">{rows.map((p) => (
          <figure key={p.id}><img src={p.url} alt={p.caption} /><figcaption className="small">{p.caption || "—"} · <span className="muted">{p.album}</span>
            <span className="row-end"><button className="link small" onClick={() => setEdit(p)}>Modifier</button><Confirm onYes={() => deleteContent("gallery", p.id).then(reload)} /></span></figcaption></figure>
        ))}</div>
      )}
      {edit && <PhotoForm initial={edit} albums={albums} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </section>
  );
}
function PhotoForm({ initial, albums, onClose, onSaved }: { initial: Partial<Photo>; albums: string[]; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState({ url: initial.url || "", caption: initial.caption || "", album: initial.album || "La synagogue" });
  const { busy, err, setErr, save } = useSave("gallery", onSaved);
  return (
    <Sheet title={initial.id ? "Modifier la photo" : "Nouvelle photo"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (!p.url) { setErr("Choisissez une photo."); return; } save({ id: initial.id, url: p.url, caption: p.caption.trim(), album: p.album.trim() || "La synagogue" }); }}>
        <PhotoPicker id="g-photo" value={p.url} onChange={(u) => setP({ ...p, url: u })} />
        <label className="field"><span>Légende</span><input id="g-cap" className="input" maxLength={120} value={p.caption} onChange={(e) => setP({ ...p, caption: e.target.value })} /></label>
        <label className="field"><span>Album</span><input id="g-album" className="input" list="g-albums" maxLength={60} value={p.album} onChange={(e) => setP({ ...p, album: e.target.value })} />
          <datalist id="g-albums">{albums.map((a) => <option key={a} value={a} />)}</datalist></label>
        {err && <p className="error">{err}</p>}
        <button className="btn full" disabled={busy}>{busy ? "…" : "Enregistrer"}</button>
      </form>
    </Sheet>
  );
}

/* Inscrits à un cours, avec un message à tous les inscrits (rappel, changement d'horaire…) */
function Registrants({ course, onClose }: { course: Course; onClose: () => void }) {
  const [list, setList] = useState<{ user_id: string; created_at: string }[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { courseRegistrants(course.id).then(setList, () => setList([])); listMembers().then(setMembers, () => {}); }, [course.id]);
  const name = (id: string) => { const m = members.find((x) => x.id === id); return m ? [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email : "—"; };
  async function send(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try { const n = await sendMessage({ title: course.title + " · " + course.day + " " + course.time, body: text.trim(), to: "users", user_ids: (list || []).map((x) => x.user_id) }); setMsg("Message envoyé à " + n + " inscrit(s)."); setText(""); }
    catch (x) { setMsg((x as Error).message); }
  }
  return (
    <Sheet title={"Inscrits · " + course.title} onClose={onClose}>
      {!list ? <p className="muted">Chargement…</p> : !list.length ? <p className="muted">Personne n'est encore inscrit.</p> : (
        <>
          <ol className="reg-list">{list.map((r) => <li key={r.user_id}>{name(r.user_id)}{r.created_at && <span className="small muted"> · {new Date(r.created_at).toLocaleDateString("fr-FR")}</span>}</li>)}</ol>
          <form onSubmit={send}>
            <label className="field"><span>Message aux {list.length} inscrit(s)</span><textarea id="reg-msg" className="input" rows={3} required maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. Le cours de ce soir commence à 21h." /></label>
            {msg && <p className="small gold">{msg}</p>}
            <button className="btn full" disabled={!text.trim()}>Envoyer</button>
          </form>
        </>
      )}
    </Sheet>
  );
}

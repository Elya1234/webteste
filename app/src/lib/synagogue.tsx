/* Données de la synagogue pour toute l'application : réglages partagés avec les écrans TV,
 * zmanim et calendrier Hebcal, calendrier des offices. Tout est gardé sur l'appareil pour marcher hors connexion. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_CONFIG, REMOTE_URL, SCHEDULE_URLS, type SynaConfig } from "../config";
import { buildBundle, bundleKey, todayIn, type Bundle, type SchedDay, type Schedule } from "./zmanim";
import { read, write } from "./storage";

const K_REMOTE = "app.remote.v1", K_SCHED = "app.schedule.v1";
const SHARED_KEYS: (keyof SynaConfig)[] = ["name", "nameHe", "geonameid", "cityLabel", "elevation", "candleMinutes", "havdalah", "validatedByRav",
  "showSeconds", "showCountdown", "dedication", "dedicationNames", "footerLeft", "footerRight", "prayers", "announcements", "zmanim", "useSchedule"];

function withShared(rs: Partial<SynaConfig> | null): SynaConfig {
  const c: SynaConfig = { ...DEFAULT_CONFIG };
  if (rs) SHARED_KEYS.forEach((k) => { if (rs[k] !== undefined && rs[k] !== null) (c as Record<string, unknown>)[k] = rs[k]; });
  return c;
}

type Ctx = { config: SynaConfig; bundle: Bundle | null; schedule: Schedule | null; offline: boolean; tz: string; reload: () => void };
const SynaCtx = createContext<Ctx | null>(null);

export function SynagogueProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SynaConfig>(() => withShared(read(K_REMOTE)));
  const [bundle, setBundle] = useState<Bundle | null>(() => read(bundleKey(config)));
  const [schedule, setSchedule] = useState<Schedule | null>(() => read(K_SCHED));
  const [offline, setOffline] = useState(false);
  const [tick, setTick] = useState(0);
  const key = bundleKey(config);

  // Réglages partagés (Google Apps Script), comme les télévisions : toutes les 5 min ici (pas besoin de 30 s sur un téléphone)
  useEffect(() => {
    if (!REMOTE_URL) return;
    const load = () => fetch(REMOTE_URL + (REMOTE_URL.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" })
      .then((r) => r.json()).then((j) => { if (j && j.ok) { write(K_REMOTE, j.settings || null); setConfig(withShared(j.settings)); } })
      .catch(() => { /* hors connexion : derniers réglages connus */ });
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [tick]);

  // Hebcal : au lancement, toutes les 6 h, au changement de ville et au retour d'Internet
  useEffect(() => {
    let alive = true;
    const cached = read<Bundle>(key);
    if (cached) setBundle(cached);
    const run = () => buildBundle(config, cached?.location.tzid).then((b) => {
      if (!alive) return;
      // calcul de secours : on garde une copie Hebcal encore valable plutôt que de la remplacer
      if (!b.local || !cached || cached.local) { write(key, b); setBundle(b); } else if (!cached.days[todayIn(cached.location.tzid)]) setBundle(b);
      setOffline(!!b.local);
    })
      .catch(() => alive && setOffline(true));
    run();
    const id = setInterval(run, 6 * 3600 * 1000);
    window.addEventListener("online", run);
    return () => { alive = false; clearInterval(id); window.removeEventListener("online", run); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  // Calendrier des offices
  useEffect(() => {
    const get = (u: string) => fetch(u, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
    get(SCHEDULE_URLS[0] + (SCHEDULE_URLS[0].includes("?") ? "&" : "?") + "t=" + Date.now()).catch(() => get(SCHEDULE_URLS[1]))
      .then((j: { source?: string; days?: SchedDay[] }) => {
        // la copie intégrée ne remplace jamais une feuille plus récente déjà reçue
        const cached = read<Schedule>(K_SCHED);
        const last = (s: { days?: SchedDay[] } | Schedule | null) => (s && "byDate" in s ? Object.keys(s.byDate).sort().pop() : s?.days?.map((d) => d.date).sort().pop()) || "";
        if (cached && last(cached) > last(j)) return;
        const byDate: Record<string, SchedDay> = {};
        (j.days || []).forEach((d) => { byDate[d.date] = d; });
        const s = { source: j.source, byDate }; write(K_SCHED, s); setSchedule(s);
      }).catch(() => { /* copie locale */ });
  }, [tick]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 6 * 3600 * 1000); return () => clearInterval(id); }, []);

  // Changement de jour : on recharge tout
  useEffect(() => {
    let day = todayIn(bundle?.location.tzid || "Europe/Paris");
    const id = setInterval(() => { const d = todayIn(bundle?.location.tzid || "Europe/Paris"); if (d !== day) { day = d; setTick((t) => t + 1); } }, 60000);
    return () => clearInterval(id);
  }, [bundle?.location.tzid]);

  const value = useMemo<Ctx>(() => ({
    config, bundle, schedule, offline,
    tz: bundle?.location.tzid || Intl.DateTimeFormat().resolvedOptions().timeZone,
    reload: () => setTick((t) => t + 1)
  }), [config, bundle, schedule, offline]);
  return <SynaCtx.Provider value={value}>{children}</SynaCtx.Provider>;
}

export function useSynagogue() {
  const c = useContext(SynaCtx);
  if (!c) throw new Error("SynagogueProvider manquant");
  return c;
}

/** Heure courante, rafraîchie chaque seconde (uniquement dans les écrans qui l'affichent). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

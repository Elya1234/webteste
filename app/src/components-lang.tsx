import { getLang, setLang, t } from "./lib/i18n";

/** Choix de la langue : Français / English */
export function LangSwitch() {
  const l = getLang();
  return (
    <div className="lang-switch" role="group" aria-label={t("Langue")}>
      <button type="button" className={l === "fr" ? "on" : ""} aria-pressed={l === "fr"} onClick={() => setLang("fr")}>Français</button>
      <button type="button" className={l === "en" ? "on" : ""} aria-pressed={l === "en"} onClick={() => setLang("en")}>English</button>
    </div>
  );
}

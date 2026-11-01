import { useState } from "react";
import { t } from "./lib/i18n";
import { checkPassword, COUNTRIES, normalizePhone, type Country } from "./lib/validate";

/** Téléphone : choix du pays (+33 / +1) puis le numéro, vérifié pendant la saisie. */
export function PhoneField({ id, value, onChange, required = false }:
  { id: string; value: { country: Country; raw: string }; onChange: (v: { country: Country; raw: string }) => void; required?: boolean }) {
  const c = COUNTRIES.find((x) => x.id === value.country)!;
  const ok = normalizePhone(value.country, value.raw);
  const touched = value.raw.replace(/\D/g, "").length > 0;
  return (
    <div className="field">
      <label htmlFor={id}>{t(required ? "Téléphone" : "Téléphone (facultatif)")}</label>
      <div className="phone">
        <select aria-label={t("Pays")} value={value.country} onChange={(e) => onChange({ country: e.target.value as Country, raw: value.raw })} className="input phone-cc">
          {COUNTRIES.map((x) => <option key={x.id} value={x.id}>{x.flag} {x.dial}</option>)}
        </select>
        <input id={id} className={"input" + (touched && !ok ? " invalid" : "")} type="tel" inputMode="tel" autoComplete="tel-national" placeholder={c.placeholder}
          value={value.raw} onChange={(e) => onChange({ country: value.country, raw: e.target.value.replace(/[^\d\s().+-]/g, "").slice(0, 20) })}
          aria-invalid={touched && !ok} aria-describedby={id + "-hint"} required={required} />
      </div>
      <span id={id + "-hint"} className={"small " + (touched && !ok ? "error" : "muted")}>
        {touched && !ok ? (value.country === "FR" ? t("Numéro français : 10 chiffres, par exemple 06 12 34 56 78.") : t("Numéro américain : 10 chiffres, par exemple (212) 555-0123."))
          : touched ? "✓ " + t("Numéro valide") : value.country === "FR" ? t("France : 10 chiffres") : t("États-Unis / Canada : 10 chiffres")}
      </span>
    </div>
  );
}

/** Mot de passe : afficher / masquer, jauge de solidité et règles à respecter (création seulement). */
export function PasswordField({ id, value, onChange, isNew, personal = [] }: { id: string; value: string; onChange: (v: string) => void; isNew: boolean; personal?: string[] }) {
  const [show, setShow] = useState(false);
  const c = checkPassword(value, personal);
  const LABEL = ["Très faible", "Faible", "Moyen", "Solide", "Très solide"];
  return (
    <div className="field">
      <label htmlFor={id}>{t("Mot de passe")}</label>
      <div className="pw">
        <input id={id} className="input" type={show ? "text" : "password"} required autoComplete={isNew ? "new-password" : "current-password"}
          value={value} onChange={(e) => onChange(e.target.value)} maxLength={128} aria-describedby={isNew ? id + "-rules" : undefined} />
        <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}>{show ? t("Masquer") : t("Afficher")}</button>
      </div>
      {isNew && (
        <>
          <div className={"pw-meter s" + (value ? c.score : 0)} aria-hidden="true"><i /><i /><i /><i /></div>
          {value && <span className="small muted">{t("Solidité")} : {t(LABEL[c.score])}</span>}
          <ul id={id + "-rules"} className="pw-rules">{c.rules.map((r) => <li key={r.label} className={r.ok ? "ok" : ""}>{r.ok ? "✓" : "•"} {t(r.label)}</li>)}</ul>
        </>
      )}
    </div>
  );
}

import "./demo-shim";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState, type ReactNode } from "react";
import App from "./App";
import { getLang, onLang } from "./lib/i18n";
import { SynagogueProvider } from "./lib/synagogue";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

// changement de langue : toute l'application est redessinée dans la nouvelle langue
function LangGate({ children }: { children: ReactNode }) {
  const [lang, setL] = useState(getLang());
  useEffect(() => onLang(() => setL(getLang())), []);
  return <div key={lang} style={{ display: "contents" }}>{children}</div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangGate>
    <SynagogueProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SynagogueProvider>
    </LangGate>
  </StrictMode>
);

// Site / appli installée sur ordinateur : ouverture hors connexion. Dans l'appli iPhone/Android les fichiers sont déjà sur l'appareil.
if ("serviceWorker" in navigator && !Capacitor.isNativePlatform() && import.meta.env.PROD && import.meta.env.VITE_DEMO !== "1") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

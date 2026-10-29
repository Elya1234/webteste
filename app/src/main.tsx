import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { SynagogueProvider } from "./lib/synagogue";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SynagogueProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SynagogueProvider>
  </StrictMode>
);

// Site / appli installée sur ordinateur : ouverture hors connexion. Dans l'appli iPhone/Android les fichiers sont déjà sur l'appareil.
if ("serviceWorker" in navigator && !Capacitor.isNativePlatform() && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

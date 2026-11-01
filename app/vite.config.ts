import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" : les mêmes fichiers servent pour le site, l'appli iPhone/Android (Capacitor) et l'ordinateur.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false }
});

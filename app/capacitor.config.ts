import type { CapacitorConfig } from "@capacitor/cli";

// appId : identifiant unique dans l'App Store et le Play Store, définitif après la première publication.
const config: CapacitorConfig = {
  appId: "fr.bethchalom.app",
  appName: "Beth Chalom",
  webDir: "dist",
  backgroundColor: "#050b1f"
};

export default config;

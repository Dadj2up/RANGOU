import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relatif ("./") : fonctionne quel que soit le nom exact du dépôt
// GitHub (majuscules/minuscules), pas besoin de le modifier à la main.
export default defineConfig({
  base: "./",
  plugins: [react()],
});

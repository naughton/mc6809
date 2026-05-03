import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  // Repo is served at https://<user>.github.io/mc6809/ on GitHub Pages, so
  // every asset URL needs the /mc6809/ prefix in production. Local `vite dev`
  // and `vite preview` keep using "/" as before.
  base: command === "build" ? "/mc6809/" : "/",
  plugins: [react()],
  server: {
    port: 3000,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
}));

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 42879,
    strictPort: true,
  },
  test: {
    // Solo se prueba lógica pura (src/lib), que no toca el DOM: no hace falta jsdom.
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});

import { defineConfig } from "vitest/config";
import path from "path";

// Config propia (no extiende vite.config.ts) para no cargar el plugin de React ni
// lovable-tagger en los tests: por ahora solo se testea lógica pura de src/lib.
// Cuando entren tests de componentes hay que sumar @vitejs/plugin-react-swc acá.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});

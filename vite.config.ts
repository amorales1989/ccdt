import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ← AGREGAR ESTA SECCIÓN
  define: {
    'process.env': {},
    'global': 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        // Solo se fija el chunk de react: es lo unico que carga si o si en el arranque,
        // y separarlo evita re-bajarlo en cada deploy. El resto lo agrupa Rollup segun
        // quien lo importa; forzarlo aca hacia que chunks async (recharts, jspdf) pasaran
        // a contarse como dependencia estatica del entry y se precargaran de mas.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
}));

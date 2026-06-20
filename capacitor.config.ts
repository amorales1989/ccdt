import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ccdt.mobile',
  appName: 'CCDT',
  webDir: 'dist',
  // La app abre el sitio en produccion: se actualiza sola con cada deploy,
  // sin recompilar la APK (salvo cambios nativos: icono, nombre, permisos).
  server: {
    url: 'https://ccdt.vercel.app',
    cleartext: false,
  },
};

export default config;

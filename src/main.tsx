import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Reporte de errores a GlitchTip (misma API que Sentry, instancia propia en
// errores.n-xus.com). Solo en build de prod y si hay DSN, asi los errores de
// desarrollo no ensucian el proyecto. Va antes del render para atrapar tambien
// lo que explote durante el montaje.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (import.meta.env.PROD && sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Sin tracesSampleRate a proposito: el tracing queda apagado. Contra una
    // instancia propia cada transaccion ocupa disco del VPS y no la miramos.
    // No mandar IP ni datos del usuario: la app maneja datos de menores.
    sendDefaultPii: false,
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Cloudflare Web Analytics: solo en build de prod y si hay token, asi no cuenta
// las visitas de desarrollo. Detecta solo los cambios de ruta de la SPA.
// Cloudflare valida el token contra el dominio del sitio: cada dominio tiene el suyo.
const cfAnalyticsToken = window.location.hostname.endsWith('n-xus.com')
  ? import.meta.env.VITE_CF_ANALYTICS_TOKEN_NXUS
  : import.meta.env.VITE_CF_ANALYTICS_TOKEN;
if (import.meta.env.PROD && cfAnalyticsToken) {
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token: cfAnalyticsToken });
  document.head.appendChild(script);
}

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
      })
      .catch((error) => {
        console.error('❌ Error al registrar Service Worker:', error);
      });
  });
}
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

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
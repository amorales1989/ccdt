import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

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
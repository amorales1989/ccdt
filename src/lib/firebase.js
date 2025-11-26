import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

console.log('Variables Firebase:', {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  vapidLength: import.meta.env.VITE_FIREBASE_VAPID_KEY?.length,
  vapidStart: import.meta.env.VITE_FIREBASE_VAPID_KEY?.substring(0, 5)
});

// Evitar inicializar Firebase múltiples veces
export const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export async function configurarMensajeria(onMessageCallback) {
  console.log('[firebase] configurarMensajeria iniciado');
  
  const soportado = await isSupported().catch(() => false);
  console.log('[firebase] Soporte:', soportado);
  
  if (!soportado) {
    console.warn('[FCM] No soportado en este navegador');
    return { soportado: false, token: null };
  }

  try {
    console.log('[firebase] Obteniendo messaging...');
    const messaging = getMessaging(fbApp);
    console.log('[firebase] ✅ Messaging obtenido');
    
    console.log('[firebase] Registrando service worker...');
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[firebase] Service worker registrado');
    
    console.log('[firebase] Esperando service worker ready...');
    await navigator.serviceWorker.ready;
    console.log('[firebase] ✅ Service worker ready');

    console.log('[firebase] Solicitando permisos...');
    const permiso = await Notification.requestPermission();
    console.log('[firebase] Permiso:', permiso);
    
    if (permiso !== 'granted') {
      console.warn('[FCM] Permiso de notificaciones denegado');
      return { soportado: true, token: null };
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    console.log('[firebase] VAPID key:', vapidKey ? 'OK' : 'FALTA');
    
    if (!vapidKey || !vapidKey.startsWith('B') || vapidKey.length < 40) {
      console.error('[FCM] VAPID key inválida');
      return { soportado: true, token: null };
    }
    
    console.log('[firebase] Solicitando token FCM...');
    const token = await getToken(messaging, { 
      vapidKey,
      serviceWorkerRegistration: reg 
    });
    console.log('[firebase] ✅ Token obtenido:', token ? token.substring(0, 30) + '...' : 'null');
    
    if (!token) {
      console.warn('[FCM] No se pudo obtener token');
      return { soportado: true, token: null };
    }

    console.log('[firebase] Configurando onMessage...');
    onMessage(messaging, (payload) => {
      console.log('[FCM] Mensaje recibido en foreground:', payload);
      if (onMessageCallback) {
        onMessageCallback(payload);
      }
    });

    console.log('[firebase] ✅✅✅ TODO COMPLETO');
    return { soportado: true, token };
    
  } catch (error) {
    console.error('[firebase] ❌ Error:', error);
    console.error('[firebase] Detalles:', error.message);
    return { soportado: true, token: null };
  }
}

export async function obtenerTokenActual() {
  const soportado = await isSupported().catch(() => false);
  if (!soportado) return null;

  try {
    const messaging = getMessaging(fbApp);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    
    if (!vapidKey || !vapidKey.startsWith('B') || vapidKey.length < 40) {
      return null;
    }

    const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg ?? undefined,
    });
    
    return token ?? null;
  } catch (e) {
    console.error('[FCM] Error obteniendo token actual:', e);
    return null;
  }
}

// Para debugging en desarrollo
if (import.meta.env.DEV) {
  window.configurarMensajeria = configurarMensajeria;
  window.obtenerTokenActual = obtenerTokenActual;
}
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

// ⚠️ IMPORTANTE: Reemplaza estos valores con los de tu proyecto Firebase
// Puedes encontrarlos en la consola de Firebase -> Configuración del proyecto
const firebaseConfig = {
  apiKey: "AIzaSyCwveY6gv9TCaaLUkp9ZyaHLKSlJgsB1h4",
  authDomain: "appccdt.firebaseapp.com",
  projectId: "appccdt",
  storageBucket: "appccdt.firebasestorage.app",
  messagingSenderId: "807401870234",
  appId: "1:807401870234:web:cb58cd39de14bbbedd2023"
};

// Intentar inicializar solo si los valores han sido actualizados
try {
  // Inicializar Firebase
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Manejar mensajes en segundo plano
  messaging.onBackgroundMessage((payload) => {
    console.log('[BG] Mensaje recibido:', payload);

    const notif = payload?.notification || {};
    const clickUrl = (payload?.data && payload.data.url) || '/';
    const title = notif.title || 'Nueva Notificación';
    const body = notif.body || '';

    const options = {
      body,
      icon: '/logo192.png', // Asegúrate de que este archivo existe
      badge: '/logo192.png',
      data: {
        url: clickUrl,
        ...payload.data
      },
      // actions: [
      //   { action: 'open', title: 'Ver' }
      // ],
      tag: 'fcm-background',
      requireInteraction: false,
    };

    self.registration.showNotification(title, options);
  });
} catch (e) {
  console.error('Error inicializando Firebase en SW:', e);
}

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Si ya hay una ventana abierta, focusearla
        for (const client of windowClients) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
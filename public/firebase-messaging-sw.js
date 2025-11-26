/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

// Configuración de Firebase (debe coincidir con tu .env)
firebase.initializeApp({
  apiKey: 'AIzaSyCwveY6gv9TCaaLUkp9ZyaHLKSlJgsB1h4',                    // Mismo que REACT_APP_FIREBASE_API_KEY
  authDomain: 'appccdt.firebaseapp.com',
  projectId: 'appccdt',
  appId: '1:807401870234:web:cb58cd39de14bbbedd2023',                       // Mismo que REACT_APP_FIREBASE_APP_ID
  messagingSenderId: '807401870234',
});

const messaging = firebase.messaging();
 
// Manejar mensajes en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[BG] Mensaje recibido:', payload);
  
  const notif = payload?.notification || {};
  const clickUrl = (payload?.data && payload.data.url) || '/';
  const title = notif.title || 'Notificación';
  const body = notif.body || '';
  
  const options = {
    body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: { 
      url: clickUrl,
      ...payload.data 
    },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Cerrar' }
    ],
    tag: 'fcm-background',
    requireInteraction: false,
  };
  
  self.registration.showNotification(title, options);
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  const action = event.action;

  if (action === 'close') return;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
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
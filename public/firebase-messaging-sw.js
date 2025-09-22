// public/firebase-messaging-sw.js
// Service Worker para manejar notificaciones en segundo plano

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Tu configuración de Firebase (la misma que en el archivo de configuración)
const firebaseConfig = {
  apiKey: "AIzaSyCwveY6gv9TCaaLUkp9ZyaHLKSlJgsB1h4",
  authDomain: "appccdt.firebaseapp.com",
  projectId: "appccdt",
  storageBucket: "appccdt.firebasestorage.app",
  messagingSenderId: "807401870234",
  appId: "1:807401870234:web:cb58cd39de14bbbedd2023",
  measurementId: "G-PWC58EVX21"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obtener instancia de messaging
const messaging = firebase.messaging();

// Manejar mensajes en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('Mensaje recibido en segundo plano:', payload);

  // Personalizar la notificación según el tipo
  const notificationTitle = payload.notification?.title || 'Nueva notificación';
  let notificationOptions = {
    body: payload.notification?.body || 'Tienes una nueva notificación',
    icon: payload.notification?.icon || '/fire.png',
    badge: '/fire.png',
    tag: 'ccdt-notification',
    requireInteraction: false,
    silent: false,
    data: payload.data || {},
  };

  // Personalizar según el tipo de notificación
  if (payload.data?.type === 'new_request') {
    notificationOptions = {
      ...notificationOptions,
      requireInteraction: true,
      actions: [
        {
          action: 'view_requests',
          title: 'Ver Solicitudes',
          icon: '/fire.png'
        },
        {
          action: 'dismiss',
          title: 'Descartar',
          icon: '/fire.png'
        }
      ],
      tag: 'new-request',
    };
  } else if (payload.data?.type === 'request_status_update') {
    const isApproved = payload.data.status === 'approved';
    notificationOptions = {
      ...notificationOptions,
      requireInteraction: true,
      actions: [
        {
          action: 'view_my_requests',
          title: 'Ver Mis Solicitudes',
          icon: '/fire.png'
        },
        {
          action: 'dismiss',
          title: 'Descartar',
          icon: '/fire.png'
        }
      ],
      tag: isApproved ? 'request-approved' : 'request-rejected',
      icon: isApproved ? '/fire.png' : '/fire.png', // Puedes usar iconos diferentes
    };
  }

  // Mostrar la notificación
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clics en la notificación
self.addEventListener('notificationclick', (event) => {
  console.log('Click en notificación:', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Cerrar la notificación
  notification.close();

  // Manejar las acciones
  if (action === 'dismiss') {
    return; // Solo cerrar la notificación
  }

  // Determinar la URL de destino
  let targetUrl = '/';
  
  if (action === 'view_requests' || data.type === 'new_request') {
    targetUrl = '/solicitudes'; // Ajusta según tu routing
  } else if (action === 'view_my_requests' || data.type === 'request_status_update') {
    targetUrl = '/mis-solicitudes'; // O la ruta que uses para las solicitudes del usuario
  }

  // Abrir o enfocar la aplicación
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then((clientList) => {
      // Buscar si ya hay una ventana abierta con la app
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          // Si encontramos una ventana abierta, enfocarla y navegar
          return client.focus().then(() => {
            // Enviar mensaje al cliente para navegar
            return client.postMessage({
              type: 'NOTIFICATION_CLICK',
              action: action,
              data: data,
              targetUrl: targetUrl
            });
          });
        }
      }
      
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Manejar cierre de notificación
self.addEventListener('notificationclose', (event) => {
  console.log('Notificación cerrada:', event.notification.data);
  
  // Opcional: Enviar analytics sobre notificaciones cerradas
  // trackNotificationDismissed(event.notification.data);
});

// Cache básico para la aplicación (opcional)
const CACHE_NAME = 'ccdt-app-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/fire.png',
  '/manifest.json'
];

// Instalar service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker instalándose...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache).catch((error) => {
          console.log('Error agregando URLs al cache:', error);
          // No fallar la instalación si algunas URLs no se pueden cachear
        });
      })
  );
  
  // Forzar la activación inmediata
  self.skipWaiting();
});

// Activar service worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activándose...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Tomar control de todos los clientes inmediatamente
  self.clients.claim();
});

// Estrategia de cache: Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Excluir APIs y requests con parámetros de query complejos
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('chrome-extension://')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, clonarla y guardarla en cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar servir desde cache
        return caches.match(event.request);
      })
  );
});

// Función auxiliar para tracking (opcional)
function trackNotificationDismissed(data) {
  // Implementar tracking/analytics si es necesario
  console.log('Notification dismissed:', data);
}
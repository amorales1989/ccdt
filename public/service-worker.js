
// Service worker for push notifications
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nuevo evento creado',
      icon: '/fire.png',
      badge: '/favicon.ico',
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Nuevo Evento', options)
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // This looks to see if the current is already open and focuses if it is
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const hadWindowToFocus = clientList.some(client => {
        if (client.url === event.notification.data.url && 'focus' in client) {
          client.focus();
          return true;
        }
        return false;
      });

      if (!hadWindowToFocus && clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

// Skip waiting and become active
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

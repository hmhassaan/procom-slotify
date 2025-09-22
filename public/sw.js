// public/sw.js

// Listen for push events
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.error("Push event but no data");
    return;
  }
  
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.error("Error parsing push data:", e);
    return;
  }

  const title = data.title || 'PROCOM Slotify';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: '/android-chrome-192x192.png', // An icon to display
    badge: '/android-chrome-192x192.png', // Icon for the notification tray
    data: {
      url: data.data?.url || '/', // URL to open on click
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listen for notification click events
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // If a window for the app is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

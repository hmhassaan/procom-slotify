
// Service Worker

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // Cache assets here if needed
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

self.addEventListener('push', (event) => {
  console.log('Service Worker: Push Received.');
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('Push event has no data or data is not valid JSON', e);
    data = {
      title: 'New Notification',
      body: 'Something new happened!',
      data: { url: '/' },
    };
  }

  const { title, body, data: notificationData } = data;

  const options = {
    body: body,
    icon: '/android-chrome-192x192.png', // An icon for the notification
    badge: '/favicon.ico', // A smaller icon
    data: notificationData, // URL to open on click
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked.');
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // Check if there's already a window open with the target URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

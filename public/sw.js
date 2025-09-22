self.addEventListener('push', function(event) {
  if (!event.data) {
    console.error('Push event but no data');
    return;
  }
  const data = event.data.json();
  const title = data.title || "New Notification";
  const options = {
    body: data.body,
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    data: {
      url: data.data.url || '/'
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

self.addEventListener('install', function(event) {
  // Perform install steps
  // e.g., precaching static assets
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', function(event) {
  // Perform activation steps
  // e.g., cleaning up old caches
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

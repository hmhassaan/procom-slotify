// public/sw.js

// Listen for the install event, which fires when the service worker is first installed.
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  // waitUntil() ensures the service worker doesn't move on to the activating state
  // until the passed-in promise has resolved.
  event.waitUntil(self.skipWaiting()); // Force the waiting service worker to become the active service worker.
});

// Listen for the activate event, which fires when the service worker becomes active.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  // clients.claim() allows an active service worker to set itself as the controller
  // for all clients within its scope.
  event.waitUntil(self.clients.claim());
});

// This is the core listener for handling push notifications.
// It fires whenever a push message is received from the server.
self.addEventListener('push', event => {
  console.log('Service Worker: Push event received.');

  let data;
  try {
    // The push message data is sent as a string, so we need to parse it as JSON.
    data = event.data.json();
    console.log('Service Worker: Push data parsed:', data);
  } catch (e) {
    console.error('Service Worker: Failed to parse push data.', e);
    // If parsing fails, create a default notification.
    data = {
      title: 'New Notification',
      body: 'You have a new update.',
      data: { url: '/' }
    };
  }

  const title = data.title || 'PROCOM Slotify';
  const options = {
    body: data.body || 'You have a new message.',
    icon: '/android-chrome-192x192.png', // Icon to display in the notification
    badge: '/notification-badge-72.png', // Icon for the notification tray on Android
    data: {
      url: data.data?.url || '/', // The URL to open when the notification is clicked
    },
  };

  // This is the crucial command that shows the notification to the user.
  // It must be wrapped in event.waitUntil() to ensure the browser doesn't
  // terminate the service worker before the notification is displayed.
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
  console.log('Service Worker: Notification shown.');
});

// Listen for the notificationclick event, which fires when a user clicks on a notification.
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification click received.');

  // Close the notification pop-up.
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  // This logic checks if a window/tab with the app is already open.
  // If so, it focuses that window. If not, it opens a new one.
  const promiseChain = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  }).then(clientList => {
    if (clientList.length > 0) {
      // Check if there's a client that's already focused.
      let focusedClient = clientList.find(client => client.focused);
      if (!focusedClient) {
        // If not, just grab the first one.
        focusedClient = clientList[0];
      }
       if (focusedClient) {
          // If we found a client, focus it and navigate to the correct URL.
          return focusedClient.focus().then(client => client.navigate(urlToOpen));
       }
    }
    // If we didn't find a client, open a new one.
    return self.clients.openWindow(urlToOpen);
  });

  event.waitUntil(promiseChain);
});

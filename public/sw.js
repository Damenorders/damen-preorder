// Damen Preorder service worker — Web Push order alerts.
// Shows a banner when a new order is placed and opens the app on tap.

self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "Damen Preorder", body: event.data.text() };
  }
  const title = data.title || "New order";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/badge-96.png",
    tag: data.tag, // same tag collapses duplicate pushes for one order
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url: data.url || "/buyer/submissions" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/buyer/submissions";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          // Focus an already-open app window instead of opening a new one.
          if ("focus" in client) {
            client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});

// Activate the updated worker immediately so alert changes ship without a
// manual refresh of every device.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

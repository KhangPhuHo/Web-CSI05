// sw.js
// Service worker GOM CHUNG 2 chuc nang:
// 1. Cache san trang offline (404.html) va tra ve khi mat mang (tu 404sw.js)
// 2. Nhan push notification qua Firebase Cloud Messaging (tu firebase-messaging-sw.js)
// Ly do gop: 1 scope chi co the co 1 service worker "chu" dieu khien.
// Neu dang ky 2 file rieng cung scope, file dang ky/active sau se de len file truoc,
// khien 1 trong 2 chuc nang bi vo hieu (day la nguyen nhan push khong hien).

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC6rMbPR5P7gwsxLBZz0eCV7bO1v8KmqSk",
  authDomain: "book-store-csi05.firebaseapp.com",
  projectId: "book-store-csi05",
  storageBucket: "book-store-csi05.firebasestorage.app",
  messagingSenderId: "597545670363",
  appId: "1:597545670363:web:4f2c28b934b724cc6e5efe",
  measurementId: "G-KYNZWVJTQ5"
});

const messaging = firebase.messaging();

// PHAN 1: OFFLINE 404 CACHE

const CACHE_NAME = "offline-cache-v2";
// Doi duong dan nay thanh file offline that su cua ban (vd: /404.html)
const OFFLINE_URL = "./404.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Chi xu ly rieng cho navigation request (load 1 trang HTML),
  // con lai (css/js/img/api...) de trinh duyet tu xu ly binh thuong
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
  }
});

// PHAN 2: FIREBASE PUSH NOTIFICATION

// Xu ly khi nhan push luc trinh duyet/tab dang DONG hoac chay ngam
messaging.onBackgroundMessage((payload) => {
  // notify.js (backend) gui data-only payload (KHONG co "notification")
  // de tranh trinh duyet tu dong hien thong bao trung voi showNotification() ben duoi.
  const data = payload.data || {};
  const title = data.title || "Thông báo mới";
  const body = data.body || "";

  self.registration.showNotification(title, {
    body,
    icon: "https://cdn-icons-png.flaticon.com/512/4712/4712027.png",
    data: {
      url: data.url || "/"
    }
  });
});

// Xu ly khi nguoi dung BAM VAO thong bao
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
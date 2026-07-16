// firebase-messaging-sw.js
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

// Xu ly khi nhan push luc trinh duyet/tab dang DONG hoac chay ngam
messaging.onBackgroundMessage((payload) => {
  // notify.js (backend) gio gui data-only payload (KHONG con "notification"
  // nua) - de tranh viec trinh duyet TU DONG hien 1 thong bao rieng (chong
  // len thong bao do chinh doan showNotification() ben duoi tao ra, gay
  // hien thi trung 2 lan cho cung 1 push). Doc tu payload.data thay vi
  // payload.notification.
  const data = payload.data || {};
  const title = data.title || "Thông báo mới";
  const body = data.body || "";

  self.registration.showNotification(title, {
    body,
    icon: "https://cdn-icons-png.flaticon.com/512/4712/4712027.png",
    // Luu lai o day de notificationclick ben duoi biet mo trang nao khi bam vao
    data: {
      url: data.url || "/"
    }
  });
});

// Xu ly khi nguoi dung BAM VAO thong bao - mac dinh trinh duyet chi dong
// popup thong bao, KHONG tu dong mo/focus lai tab web. Can tu code phan nay.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Neu da co san 1 tab dang mo dung website -> focus vao tab do,
      // khong mo tab moi (tranh mo hang chuc tab trung nhau)
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }

      // Chua co tab nao mo san -> mo tab moi
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
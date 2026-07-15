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
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: "https://cdn-icons-png.flaticon.com/512/4712/4712027.png"
  });
});
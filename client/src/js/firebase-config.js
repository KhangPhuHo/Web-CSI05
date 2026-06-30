// ✅ firebase-config.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6rMbPR5P7gwsxLBZz0eCV7bO1v8KmqSk",
  authDomain: "book-store-csi05.firebaseapp.com",
  projectId: "book-store-csi05",
  storageBucket: "book-store-csi05.firebasestorage.app",
  messagingSenderId: "597545670363",
  appId: "1:597545670363:web:4f2c28b934b724cc6e5efe",
  measurementId: "G-KYNZWVJTQ5"
};

// ✅ Chỉ khởi tạo nếu chưa có app nào
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from './firebase-config.js';
import { showToast } from './toast.js';

const VAPID_KEY = "BFqqkrZrXw4yOgXToHv9r5u7oA_A7tBte2y-2Wr0hhAaXuqv_mQ10c4GhfSuAZ9USEBRID19nBlRoFnSO4CGHRw";

export async function setupPushNotification(uid) {
  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Người dùng từ chối nhận thông báo.");
      return;
    }

    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (token) {
      await setDoc(doc(db, "users", uid), { fcmToken: token }, { merge: true });
    }
  } catch (error) {
    console.error("Lỗi khi đăng ký push notification:", error);
  }
}

export function listenForegroundMessages() {
  const messaging = getMessaging();
  onMessage(messaging, (payload) => {
    const { title, body } = payload.notification;
    showToast(`${title}: ${body}`, "info");
  });
}
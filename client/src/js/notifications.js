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
    // notify.js (backend) gio gui data-only payload (khong con "notification"
    // nua, de tranh hien thong bao trung voi service worker) - doc tu
    // payload.data thay vi payload.notification
    const { title, body } = payload.data || {};
    if (title) {
      showToast(`${title}: ${body || ""}`, "info");
    }
  });
}
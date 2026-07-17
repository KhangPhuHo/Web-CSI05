import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from './firebase-config.js';
import { showToast } from './toast.js';
import { swRegistrationPromise } from './register-sw.js';

const VAPID_KEY = "BFqqkrZrXw4yOgXToHv9r5u7oA_A7tBte2y-2Wr0hhAaXuqv_mQ10c4GhfSuAZ9USEBRID19nBlRoFnSO4CGHRw";

export async function setupPushNotification(uid) {
  try {
    // KHONG tu register() service worker rieng nua - dung lai registration
    // chung (sw.js) da duoc dang ky 1 lan duy nhat trong register-sw.js.
    // Dang ky 2 lan 2 file khac nhau la nguyen nhan push bi de len truoc day.
    const registration = await swRegistrationPromise;
    if (!registration) {
      console.error("Chưa có service worker registration, không thể bật push.");
      return;
    }

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
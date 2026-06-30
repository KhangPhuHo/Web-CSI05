import { auth, db } from './firebase-config.js';
import { getTranslation } from './language.js'; // ✅ Thêm dòng này
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { showToast } from './toast.js';


function checkAdminAccess() {
  onAuthStateChanged(auth, async (user) => {
    const session = JSON.parse(localStorage.getItem("session"));
    const now = Date.now();

    if (!user || !session || (!session.isAdmin && now >= session.expired_at)) {
      localStorage.removeItem("session");

      const msg = await getTranslation("admin.need_login_again");
      showToast(msg || "Bạn cần đăng nhập lại để truy cập.", "info");

      setTimeout(() => {
        window.location.href = "home.html";
      }, 1000);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (!userDoc.exists() || userDoc.data().role !== "admin" || userDoc.data().id !== 1) {
        const msg = await getTranslation("admin.no_permission");
        showToast(msg || "Bạn không có quyền truy cập trang này.", "error");

        setTimeout(() => {
          window.location.href = "home.html";
        }, 1000);
      }
    } catch (error) {
      console.error("Lỗi khi kiểm tra quyền admin:", error.message);

      const msg = await getTranslation("admin.error");
      showToast(msg || "Đã xảy ra lỗi. Vui lòng thử lại sau.", "error");

      window.location.href = "home.html";
    }
  });
}

document.addEventListener("DOMContentLoaded", checkAdminAccess);

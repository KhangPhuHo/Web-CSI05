// auth-check.js
import { getTranslation } from "./language.js"; // ✅ Thêm dòng này
import { showToast } from "./toast.js";
import { auth } from "./firebase-config.js";

async function checkLogin() {
  auth.onAuthStateChanged(async (user) => {
    const session = JSON.parse(localStorage.getItem("session"));
    const now = Date.now();
    const isAdmin = session?.isAdmin === true;

    if (user && session) {
      if (isAdmin || now < session.expired_at) return;
    }

    localStorage.removeItem("session");
    localStorage.removeItem("user_session");

    const content = document.getElementById("content9");
    if (content) content.innerHTML = "";

    auth.signOut();

    const message = await getTranslation("toast.session_expired"); // 🔑 Key từ file lang
    showToast(message, "info");

    setTimeout(() => {
      window.location.href = "home.html";
    }, 1000);
  });
}

document.addEventListener("DOMContentLoaded", checkLogin);
import { auth, db } from './firebase-config.js';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  deleteUser,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { setLanguage, getTranslation } from './language.js';
import { showToast } from './toast.js';

document.addEventListener("DOMContentLoaded", () => {
  handleLogoutUI();
  setupGlobalEvents();
});

function handleLogoutUI() {
  const logoutWrapper = document.getElementById('logout');
  if (!logoutWrapper) return;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Người dùng đã đăng nhập: hiển thị nút Logout
      logoutWrapper.innerHTML = `
        <button id="logoutButtonMain" class="box border-none text-white flex items-center gap-2">
          <button id="logoutButtonMain" class="z-10 bg-transparent border-none"><i class="fa fa-sign-out-alt"></i>
            <button id="logoutButtonMain" data-i18n="menu.logout" class="z-10 bg-transparent border-none">Log out</button>
          </button>
        </button>
      `;
      setupLogoutButtons();
    } else {
      // Chưa đăng nhập
      logoutWrapper.innerHTML = `
        <a href="login.html">
          <button id="Signin" class="box border-none text-white flex items-center gap-2">
            <span><i class="fa fa-sign-in" aria-hidden="true"></i> <span data-i18n="menu.sign_in">Signin/Login</span></span>
          </button>
        </a>
      `;
    }

    const lang = localStorage.getItem("lang") || "en";
    setLanguage(lang);
  });
}

function setupLogoutButtons() {
  const modal = document.getElementById('logout-confirm-modal');
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const cancelModalBtn = document.getElementById("cancelModalBtn");
  const logoutMainBtn = document.getElementById("logoutButtonMain");

  if (!modal || !confirmBtn || !cancelBtn || !logoutMainBtn) return;

  logoutMainBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
  });

  confirmBtn.onclick = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const providerId = user.providerData[0]?.providerId;

      if (providerId === "password") {
        const password = prompt(await getTranslation("common.confirm_password_prompt"));
        if (!password) {
          const msg = await getTranslation("common.password_required");
          showToast(msg, "error");
          return;
        }

        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);

      } else if (providerId === "google.com") {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      } else {
        const msg = await getTranslation("common.unsupported_login_method");
        showToast(msg, "error");
        return;
      }

      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);

      localStorage.removeItem("user_session");
      const msg = await getTranslation("common.account_deleted");
      showToast(msg, "success");
      window.location.href = "login.html";

    } catch (error) {
      console.error("Lỗi khi xoá:", error.message);

      if (error.code === "auth/popup-closed-by-user") {
        const msg = await getTranslation("common.google_cancelled");
        showToast(msg, "info");
      } else if (error.code === "auth/wrong-password") {
        const msg = await getTranslation("common.wrong_password");
        showToast(msg, "error");
      } else {
        const msg = await getTranslation("common.account_delete_error");
        showToast(msg, "error");
      }
    }
  };

  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
    signOut(auth)
      .then(async () => {
        localStorage.removeItem("user_session");
        const msg = await getTranslation("common.logout_success");
        showToast(msg, "success");
        window.location.href = "login.html";
      })
      .catch(async (error) => {
        console.error("Lỗi khi đăng xuất:", error.message);
        const msg = await getTranslation("common.logout_error");
        showToast(msg, "error");
      });
  };

  cancelModalBtn?.addEventListener("click", () => {
    modal.classList.add("hidden");
  });
}

// 👉 Ẩn popup khi click ra ngoài
function setupGlobalEvents() {
  const popup = document.getElementById('popup');

  document.addEventListener('click', (e) => {
    const profileBtn = document.getElementById('profile-btn');
    if (!profileBtn?.contains(e.target) && !popup?.contains(e.target)) {
      popup?.classList.add('hidden');
    }
  });
}

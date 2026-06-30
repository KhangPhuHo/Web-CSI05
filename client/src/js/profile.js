import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// không gọi lại initializeApp!

document.addEventListener("DOMContentLoaded", () => {
  setupProfileUI();
  observeAuthState();
});

function setupProfileUI() {
  const profileContainer = document.getElementById('profile');
  profileContainer.innerHTML = `
    <div id="profile-btn" class="relative inline-block cursor-pointer select-none">
      <div class="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 transition">
        <i class="fa-solid fa-circle-user fa-2x text-gray-600"></i>
        <span class="font-semibold" data-i18n="menu.no_account">No account</span>
      </div>
    </div>
  `;
}

function observeAuthState() {
  const profileContainer = document.getElementById('profile');
  const popup = document.getElementById('popup');
  const myaccount = document.getElementById('myaccount');

  onAuthStateChanged(auth, async (user) => {
    popup.classList.add('hidden'); // Ẩn popup mỗi lần trạng thái thay đổi

    if (user) {
      myaccount.innerHTML = `<span class="text-gray-400">Đang tải...</span>`;

      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        const userInfo = docSnap.exists() ? docSnap.data() : {};

        if (!docSnap.exists()) {
          console.warn("Không tìm thấy tài khoản Firestore cho UID:", user.uid);
        }

        const avatar = userInfo.avatar || user.photoURL || null;
        const username = userInfo.name || user.displayName || "Người dùng";

        profileContainer.innerHTML = `
          <div id="profile-btn" class="relative inline-block cursor-pointer select-none">
            <div class="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 transition">
              ${avatar
                ? `<img src="${avatar}" alt="Avatar" class="w-8 h-8 rounded-full object-cover">`
                : `<i class="fa-solid fa-circle-user fa-2x text-gray-600"></i>`
              }
              <span class="font-semibold">${username}</span>
            </div>
          </div>
        `;

        const profileBtn = document.getElementById('profile-btn');
        profileBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.classList.toggle('hidden');
        });

        myaccount.innerHTML = `
          <div class="flex flex-col items-center space-y-2 mb-2">
            ${avatar
              ? `<img src="${avatar}" alt="Avatar" class="w-12 h-12 rounded-full object-cover">`
              : `<i class="fa-solid fa-circle-user fa-2x text-gray-600"></i>`
            }
            <span class="font-semibold text-lg">${username}</span>
          </div>
        `;

      } catch (error) {
        console.error("Lỗi khi lấy thông tin người dùng:", error);
        myaccount.innerHTML = `<span class="text-red-500">Lỗi tải dữ liệu</span>`;
      }

    } else {
      // Chưa đăng nhập
      setupProfileUI();
      const profileBtn = document.getElementById('profile-btn');
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.classList.toggle('hidden');
      });

      myaccount.innerHTML = `
        <div class="flex flex-col items-center space-y-2 mb-2 text-gray-500">
          <i class="fa-solid fa-circle-user fa-2x text-gray-600"></i>
          <span class="text-lg" data-i18n="menu.no_account">No account</span>
        </div>
      `;
    }
  });
}


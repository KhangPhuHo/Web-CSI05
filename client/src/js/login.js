// ✅ login.js
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { showToast } from "./toast.js";
import { getTranslation } from "./language.js"; // ✅ Thêm dòng này

// DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginBtn = document.getElementById("login-button");

  if (signupForm) signupForm.addEventListener("submit", handleSignup);
  if (loginBtn) loginBtn.addEventListener("click", handleLogin);

  showHidePassword();

  const wrapper = document.querySelector('.wrapper');
  const showRegister = document.getElementById('show-register');
  const showLogin = document.getElementById('show-login');

  if (wrapper && showRegister && showLogin) {
    showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      wrapper.classList.add('active');
    });

    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      wrapper.classList.remove('active');
    });
  }
});

// Đăng ký
async function handleSignup(event) {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (!name || !email || !password || !confirmPassword) {
    const msg = await getTranslation("login.fill_all_fields");
    showToast(msg, "error");
    return;
  }

  if (password !== confirmPassword) {
    const msg = await getTranslation("login.password_mismatch");
    showToast(msg, "error");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      name,
      email,
      role: "customer",
      id: 2,
      createdAt: serverTimestamp()
    });

    const msg = await getTranslation("login.signup_success");
    showToast(msg, "success");

  } catch (error) {
    console.error("Signup error:", error.message);
    const msg = await getTranslation("login.signup_failed");
    showToast(msg, "error");
  }
}

// Đăng nhập
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    const msg = await getTranslation("login.fill_all_fields");
    showToast(msg, "error");
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();

    const isAdmin = userData?.role === "admin" && userData?.id === 1;
    const session = {
      userId: user.uid,
      email: user.email,
      isAdmin,
    };

    if (!isAdmin) session.expired_at = Date.now() + 2 * 60 * 60 * 1000;

    localStorage.setItem("session", JSON.stringify(session));
    localStorage.setItem("user_session", JSON.stringify(session));

    const msg = await getTranslation("login.login_success");
    showToast(msg, "success");

    document.body.style.transition = "opacity 0.5s";
    document.body.style.opacity = 0;
    setTimeout(() => (window.location.href = "home.html"), 500);

  } catch (error) {
    console.error("Login error:", error.message);
    const msg = await getTranslation("login.login_failed");
    showToast(msg, "error");
  }
}

// Hiển thị/ẩn mật khẩu
function showHidePassword() {
  document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener("click", () => {
      const input = icon.previousElementSibling;
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
        icon.classList.toggle("fa-eye");
        icon.classList.toggle("fa-eye-slash");
      }
    });
  });
}
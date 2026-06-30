import { showToast } from './toast.js';

let currentCurrency = "VND";
let cachedTranslations = {};

// 🌐 Lấy bản dịch theo đường dẫn dạng "a.b.c"
function getNestedTranslation(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

// ✅ API gọi trong JS để lấy bản dịch động
async function getTranslation(key) {
  const lang = localStorage.getItem("lang") || "en";
  if (!Object.keys(cachedTranslations).length) {
    const res = await fetch(`./lang/${lang}.json`);
    cachedTranslations = await res.json();
  }
  return getNestedTranslation(cachedTranslations, key) || key;
}

// ✅ Hàm chính: đổi ngôn ngữ giao diện
async function setLanguage(lang) {
  try {
    const res = await fetch(`./lang/${lang}.json`);
    if (!res.ok) throw new Error("Language file not found");

    const translations = await res.json();
    cachedTranslations = translations;

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const value = getNestedTranslation(translations, key);
      if (!value) return;

      if (el.hasAttribute("placeholder")) el.setAttribute("placeholder", value);
      if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.hasAttribute("value"))
        el.value = value;
      if (!el.hasAttribute("placeholder") || ["BUTTON", "SPAN", "LABEL", "A"].includes(el.tagName))
        el.textContent = value;
    });

    localStorage.setItem("lang", lang);
    currentCurrency = lang === "en" ? "USD" : "VND";

    document.dispatchEvent(new Event("languageChanged"));
    updateCurrencyUI();
    updateLangUI(lang);
  } catch (error) {
    console.error("Error loading language file:", error.message);
    //showToast("Chưa thực hiện được, vui lòng thử lại sau.", "error");
    const msg = await getTranslation("common.try_again_error");
    showToast(msg, "error");
  }
}

// 💱 Đổi tiền VND/USD
function getCurrency() {
  return currentCurrency;
}

function updateCurrencyUI() {
  if (typeof loadCart === "function") loadCart();
  if (typeof displayProducts === "function") displayProducts(products);
}

// 🏳️ Cập nhật UI nút đổi ngôn ngữ (flag + tên)
function updateLangUI(lang) {
  const flagClasses = {
    en: 'fi fi-us',
    vn: 'fi fi-vn'
  };
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    langBtn.innerHTML = `<span class="${flagClasses[lang]}"></span><span>${lang.toUpperCase()}</span>`;
  }
}

// 🔄 Toggle chuyển ngôn ngữ (nút chung)
function setupLangToggle() {
  const langBtn = document.getElementById('lang-toggle');
  if (!langBtn) return;

  const languages = ['en', 'vn'];
  langBtn.addEventListener('click', () => {
    const currentLang = localStorage.getItem("lang") || "en";
    const nextLang = languages[(languages.indexOf(currentLang) + 1) % languages.length];
    setLanguage(nextLang);
  });
}

// ✅ Tự động gọi khi DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("lang") || "en";
  setLanguage(savedLang);
  setupLangToggle();

  document.getElementById("lang-en")?.addEventListener("click", () => setLanguage("en"));
  document.getElementById("lang-vn")?.addEventListener("click", () => setLanguage("vn"));
});

// 🧹 Clear cache khi đổi ngôn ngữ
document.addEventListener("languageChanged", () => {
  cachedTranslations = {};
});

export {
  setLanguage,
  getCurrency,
  getTranslation
};
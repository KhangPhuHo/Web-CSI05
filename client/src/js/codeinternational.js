//Đặt trong myaccount.js nếu cần chuyển sang hỗ trợ quốc tế
const isGlobalMode = localStorage.getItem("lang") !== "vn"; // ví dụ

if (isGlobalMode) {
  import('./phone-address-global.js').then(({ validatePhoneInternational }) => {
    if (!validatePhoneInternational(phone)) {
      showToast("Invalid phone number", "warning");
      return;
    }
  });
} else {
  const phoneRegexVN = /^(?:\+84|0)(?:\d){9}$/;
  if (!phoneRegexVN.test(phone)) {
    showToast("Số điện thoại không hợp lệ!", "warning");
    return;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderMenu();
});

function renderMenu() {
  const menu = document.getElementById("Menu");
  if (!menu) return;

  menu.innerHTML = `
  <header class="fixed w-full top-0 left-0 bg-white z-50 shadow-sm">
    <nav class="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
      <button id="menu-toggle" class="md:hidden text-xl">
        <i class="fa fa-bars"></i>
      </button>
      <a href="home.html" class="flex items-center text-blue-400 font-extrabold space-x-2">
        <img src="./src/img/logo.jpg" class="w-10 h-10 aspect-square rounded-full object-cover" alt="shapespeak">
        <span class="text-lg md:text-xl">BookStore</span>
      </a>

      <!-- Menu Desktop -->
      <nav id="Menu1" class="hidden md:flex space-x-6 text-gray-700 text-base font-medium items-center">
        <a href="home.html" class="flex items-center gap-2 hover:text-blue-600"><i class="fa fa-home"></i><span data-i18n="menu.home">Home</span></a>
        <a href="news.html" class="flex items-center gap-2 hover:text-blue-600"><i class="fa fa-newspaper"></i><span data-i18n="menu.news">News</span></a>
        <a href="store.html" class="flex items-center gap-2 hover:text-blue-600"><i class="fa-solid fa-cart-shopping"></i><span data-i18n="menu.store">Store</span></a>
        <a href="Language.html" class="flex items-center gap-2 hover:text-blue-600"><i class="fa fa-globe"></i><span data-i18n="menu.language">Language</span></a>
      </nav>

      <!-- Profile + Popup -->
      <div id="profile" class="relative"></div>
      <div id="popup"
        class="hidden absolute right-4 top-16 max-w-xs bg-white border rounded-lg shadow-lg z-50 p-4 flex flex-col items-center text-center">
        <div id="myaccount" class="mb-2"></div>
        <a href="myaccount.html" class="text-blue-600 font-semibold"><i class="fa fa-address-book"></i> <span data-i18n="menu.my_account">My Account</span></a>
        <a href="cart.html" class="text-blue-600 font-semibold"><i class="fa-solid fa-basket-shopping"></i> <span data-i18n="menu.cart">Cart</span></a>
        <a href="orders.html" class="text-blue-600 font-semibold"><i class="fa-solid fa-truck"></i> <span data-i18n="menu.orders">Orders</span></a>
        <div id="logout" class="mt-2"></div>
      </div>
    </nav>

    <!-- Menu Mobile -->
    <nav id="Menu1-mobile" class="hidden flex-col items-center text-center space-y-4 text-gray-700 text-base font-medium bg-white absolute w-full left-0 top-[71px] z-[1000] py-4 shadow-lg md:hidden">
      <a href="home.html" class="flex items-center gap-2 hover:text-blue-600"><i class="fa fa-home"></i><span data-i18n="menu.home">Home</span></a>
      <a href="news.html" class="flex items-center gap-2 hover:text-blue-600"><i class="fa fa-newspaper"></i><span data-i18n="menu.news">News</span></a>
      <a href="store.html" class="flex items-center gap-2 hover:text-blue-600"><i class="fa-solid fa-cart-shopping"></i><span data-i18n="menu.store">Store</span></a>
      <a href="Language.html" class="flex items-center gap-2 hover:text-blue-600"><i class="fa fa-globe"></i><span data-i18n="menu.language">Language</span></a>
    </nav>
  </header>

  <!-- Modal xác nhận xóa tài khoản -->
  <div id="logout-confirm-modal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 hidden">
    <div class="bg-white rounded-xl shadow-lg p-6 max-w-md w-full text-center animate-fadeIn">
      <div class="mb-4">
        <div class="text-4xl mb-2">⚠️</div>
        <h2 class="text-xl font-semibold mb-2">Bạn muốn làm gì?</h2>
        <p class="text-sm text-gray-600">Xoá tài khoản sẽ không thể khôi phục. Đăng xuất sẽ giữ lại tài khoản của bạn.</p>
      </div>
      <div class="flex justify-center gap-3 mt-6 flex-wrap">
        <button id="confirmDeleteBtn" class="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition">
          🗑️ Xoá tài khoản
        </button>
        <button id="cancelBtn" class="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 transition">
          🔄 Đăng xuất
        </button>
        <button id="cancelModalBtn" class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 transition">
          ❌ Huỷ
        </button>
      </div>
    </div>
  </div>
  `;

  // Gán sự kiện toggle menu mobile
  const menuToggle = document.getElementById("menu-toggle");
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      const mobileMenu = document.getElementById("Menu1-mobile");
      if (mobileMenu) {
        mobileMenu.classList.toggle("hidden");
      }
    });
  }
}

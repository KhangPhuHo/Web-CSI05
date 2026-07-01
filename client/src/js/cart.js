import { db } from './firebase-config.js';
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getCurrency, getTranslation } from './language.js';
import { showToast } from './toast.js';

const cartList = document.getElementById("CartList");
const cartSummary = document.getElementById("CartSummary");
const totalAmount = document.getElementById("TotalAmount");

const exchangeRate = 24000;

function formatCurrency(amount) {
  const currentCurrency = getCurrency();
  return currentCurrency === "USD"
    ? `$${(amount / exchangeRate).toFixed(2)}`
    : amount.toLocaleString("vi-VN") + " VND";
}

function loadCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  cartList.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    cartList.innerHTML = `
      <div class="bg-gray-800 text-center text-gray-300 p-6 rounded-lg shadow-md">
        <span data-i18n="cart.empty">Chưa có sản phẩm nào trong giỏ hàng.</span>
      </div>
    `;
    cartSummary.classList.add("hidden");
    applyTranslation(); // 🔁 dịch sau khi render
    return;
  }

  cart.forEach((product, index) => {
    const imageSrc = product.picture?.trim() || "./src/img/shapespeakicon.jpg";
    const maxStock = typeof product.stock === "number" ? product.stock : 1;
    total += product.price * product.quantity;

    const itemEl = document.createElement("div");
    itemEl.className = "flex flex-col sm:flex-row sm:items-center gap-4 bg-gray-800 p-4 rounded-lg shadow-md";

    itemEl.innerHTML = `
      <div class="flex items-start gap-4 flex-wrap sm:flex-nowrap">
        <img src="${imageSrc}" alt="${product.name}" class="w-20 h-20 object-cover rounded-md flex-shrink-0" />
        <div class="flex-grow max-w-[250px] sm:max-w-none break-words">
          <h3 class="text-yellow-400 font-semibold text-lg break-words max-w-full sm:max-w-[135px]">
            ${product.name}
          </h3>
          <p class="text-sm text-gray-300"><span data-i18n="cart.price">Price:</span> ${formatCurrency(product.price)}</p>
          <p class="text-sm text-gray-400"><span data-i18n="cart.stock">Stock:</span> ${maxStock}</p>
        </div>
      </div>

      <div class="flex flex-wrap justify-center sm:justify-start items-center gap-1 mt-4 text-sm">
        <button onclick="setMin(${index})" class="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs">⬅ Min</button>
        <button onclick="changeQuantity(${index}, -10)" class="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs">-10</button>
        <button onclick="changeQuantity(${index}, -1)" class="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded">-</button>
        <span class="px-2 text-white">${product.quantity}</span>
        <button onclick="changeQuantity(${index}, 1)" class="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded">+</button>
        <button onclick="changeQuantity(${index}, 10)" class="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs">+10</button>
        <button onclick="setMax(${index})" class="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs">Max ➡</button>
      </div>

      <div class="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0 sm:ml-auto w-full sm:w-auto justify-center sm:justify-end">
        <button onclick="buyNow(${index})" class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md w-full sm:w-auto" data-i18n="cart.buy">Buy</button>
        <button onclick="removeFromCart(${index})" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md w-full sm:w-auto" data-i18n="cart.delete">Delete</button>
      </div>
    `;

    cartList.appendChild(itemEl);
  });

  totalAmount.textContent = formatCurrency(total);
  cartSummary.classList.remove("hidden");

  applyTranslation(); // ✅ Dịch các phần tử mới render
}

function applyTranslation() {
  const lang = localStorage.getItem("lang") || "en";
  fetch(`./lang/${lang}.json`)
    .then(res => res.json())
    .then(translations => {
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        const value = key.split(".").reduce((acc, k) => acc?.[k], translations);
        if (!value) return;

        if (el.hasAttribute("placeholder")) el.setAttribute("placeholder", value);
        if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.hasAttribute("value"))
          el.value = value;
        if (!el.hasAttribute("placeholder") || ["BUTTON", "SPAN", "LABEL", "A"].includes(el.tagName))
          el.textContent = value;
      });
    })
    .catch(err => console.error("Translate error:", err));
}

function removeFromCart(index) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  loadCart();
}

async function changeQuantity(index, delta) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const item = cart[index];
  const maxStock = typeof item.stock === "number" ? item.stock : 1;

  if (!item) return;

  // ✅ Nếu tăng thì giới hạn không vượt quá maxStock
  if (delta > 0) {
    const maxCanAdd = maxStock - item.quantity;
    if (maxCanAdd <= 0) {
      //showToast(`Sản phẩm "${item.name}" chỉ còn ${maxStock} trong kho.`, "error");
      const msgTemplate = await getTranslation("toast.max_stock_reached");
      const message = msgTemplate
        .replace("{name}", item.name)
        .replace("{stock}", maxStock);

      showToast(message, "error");

      return;
    }
    delta = Math.min(delta, maxCanAdd);
  }

  item.quantity += delta;

  // Nếu giảm về 0 thì xóa khỏi giỏ hàng
  if (item.quantity <= 0) {
    cart.splice(index, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    loadCart();
    return;
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  const itemEls = cartList.querySelectorAll(".flex.flex-col");
  const thisItem = itemEls[index];
  if (thisItem) {
    const qtySpan = thisItem.querySelector("span.px-2");
    if (qtySpan) qtySpan.textContent = item.quantity;
  }

  const total = cart.reduce((sum, p) => sum + p.price * p.quantity, 0);
  totalAmount.textContent = formatCurrency(total);
}


async function buyNow(index) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const product = cart[index];
  if (!product) return;

  const total = product.price * product.quantity;
  //const confirmBuy = confirm(`🛒 Bạn có chắc muốn mua ${product.quantity} x ${product.name} (${formatCurrency(total)}) không?`);
  const confirmMsg = await getTranslation("toast.confirm_buy");
  const confirmBuy = confirm(`${confirmMsg.replace("{name}", product.name).replace("{qty}", product.quantity).replace("{total}", formatCurrency(total))}`);

  if (!confirmBuy) return;

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    //showToast("⚠️ Vui lòng đăng nhập để mua hàng.", "error");
    const msg = await getTranslation("toast.login_required");
    showToast(msg, "error");
    return;
  }

  try {
    // ✅ Lấy thông tin user từ Firestore
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      //showToast("❌ Không tìm thấy thông tin người dùng.", "error");
      const msg = await getTranslation("toast.missing_user");
      showToast(msg, "error");
      return;
    }

    const userData = userSnap.data();
    const { phone, address } = userData;

    if (!phone || !address) {
      //showToast("⚠️ Vui lòng cập nhật số điện thoại và địa chỉ trước khi mua hàng.", "warning");
      const msg = await getTranslation("toast.missing_contact");
      showToast(msg, "warning");
      return;
    }

    // ✅ Kiểm tra tồn kho sản phẩm
    const productRef = doc(db, "products", product.id);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) throw new Error(`Không tìm thấy sản phẩm ${product.name}`);

    const productData = productSnap.data();
    if (productData.stock < product.quantity) {
      //showToast(`❌ Sản phẩm "${product.name}" chỉ còn ${productData.stock}`, "error");
        const msgTemplate = await getTranslation("toast.insufficient_stock");
        const message = msgTemplate
          .replace("{name}", item.name)
          .replace("{stock}", productData.stock);
        showToast(message, "error");
      return;
    }

    // ✅ Cập nhật tồn kho
    await updateDoc(productRef, {
      stock: productData.stock - product.quantity
    });

    // ✅ Tạo đơn hàng (thêm phone và address)
    await addDoc(collection(db, "orders"), {
      uid: user.uid,
      date: serverTimestamp(),
      status: "pending",
      items: [product],
      phone,
      address
    });

    //showToast(`✅ Đã tạo đơn hàng cho "${product.name}".`, "success");
    const msgTemplate = await getTranslation("toast.order_created");
    const message = msgTemplate.replace("{name}", product.name); // ✅ đúng giá trị
    showToast(message, "success");

    // ✅ Cập nhật giỏ hàng
    cart.splice(index, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    loadCart();
  } catch (err) {
    console.error(err);
    //showToast("❌ Lỗi khi tạo đơn hàng.", "error");
    const msg = await getTranslation("toast.order_error");
    showToast(msg, "error");
  }
}

async function checkoutAll() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (cart.length === 0) {
    //showToast("🛒 Giỏ hàng đang trống.", "warning");
    const msg = await getTranslation("toast.cart_empty");
    showToast(msg, "info");
    return;
  }

  const total = cart.reduce((sum, p) => sum + p.price * p.quantity, 0);
  //const confirmCheckout = confirm(`💳 Bạn có chắc muốn thanh toán ${cart.length} sản phẩm với tổng tiền ${formatCurrency(total)} không?`);
  const confirmTemplate = await getTranslation("toast.confirm_checkout");
  const confirmMsg = confirmTemplate
    .replace("{count}", cart.length)
    .replace("{total}", formatCurrency(total));

  const confirmCheckout = confirm(confirmMsg);

  if (!confirmCheckout) return;

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    //showToast("⚠️ Vui lòng đăng nhập để thanh toán.", "error");
    const msg = await getTranslation("toast.login_required");
    showToast(msg, "warning");
    return;
  }

  try {
    // ✅ Lấy thông tin user từ Firestore
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      //showToast("❌ Không tìm thấy thông tin người dùng.", "error");
      const msg = await getTranslation("toast.missing_user");
      showToast(msg, "error");
      return;
    }

    const userData = userSnap.data();
    const { phone, address } = userData;

    if (!phone || !address) {
      //showToast("⚠️ Vui lòng cập nhật số điện thoại và địa chỉ trước khi thanh toán.", "warning");
      const msg = await getTranslation("toast.missing_contact");
      showToast(msg, "warning");
      return;
    }

    // 🔁 Check từng sản phẩm
    for (const item of cart) {
      const productRef = doc(db, "products", item.id);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        //showToast(`❌ Không tìm thấy sản phẩm "${item.name}"`, "error");
        const msgTemplate = await getTranslation("toast.product_not_found");
        const message = msgTemplate.replace("{name}", item.name);
        showToast(message, "error");

        return;
      }

      const productData = productSnap.data();
      if (productData.stock < item.quantity) {
        //showToast(`⚠️ Sản phẩm "${item.name}" chỉ còn ${productData.stock} trong kho.`, "error");
        const msgTemplate = await getTranslation("toast.insufficient_stock");
        const message = msgTemplate
          .replace("{name}", item.name)
          .replace("{stock}", productData.stock);
        showToast(message, "error");

        return;
      }

      // ✏️ Trừ stock
      await updateDoc(productRef, {
        stock: productData.stock - item.quantity
      });
    }

    // ✅ Tạo đơn hàng (thêm phone và address)
    await addDoc(collection(db, "orders"), {
      uid: user.uid,
      date: serverTimestamp(),
      status: "pending",
      items: cart,
      phone,
      address
    });

    //showToast(`✅ Đã tạo đơn hàng với ${cart.length} sản phẩm.`, "success");
    const msgTemplate = await getTranslation("toast.order_created_all");
    const message = msgTemplate.replace("{count}", cart.length);
    showToast(message, "success");

    localStorage.removeItem("cart");
    loadCart();
  } catch (err) {
    console.error(err);
    //showToast("❌ Lỗi khi tạo đơn hàng.", "error");
    const msg = await getTranslation("toast.order_error");
    showToast(msg, "error");
  }
}

function setMin(index) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart[index].quantity = 1;
  localStorage.setItem("cart", JSON.stringify(cart));
  loadCart();
}

function setMax(index) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const maxStock = typeof cart[index].stock === "number" ? cart[index].stock : 1;
  cart[index].quantity = maxStock;
  localStorage.setItem("cart", JSON.stringify(cart));
  loadCart();
}

window.onload = loadCart;
document.addEventListener("languageChanged", loadCart);

window.buyNow = buyNow;
window.checkoutAll = checkoutAll;
window.removeFromCart = removeFromCart;
window.changeQuantity = changeQuantity;
window.setMin = setMin;
window.setMax = setMax;

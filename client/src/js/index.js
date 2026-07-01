// ✅ index.js (Firebase v10 Modular)
import { db } from "./firebase-config.js";
import { showToast } from "./toast.js";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { renderMediaPreview, uploadMultipleMedia, renderExistingMedia, selectedFiles } from "./multiplemedia.js";

const API_BASE_URL = "https://shapespeaker.onrender.com";

// ✅ Load danh sách sản phẩm
async function loadProducts(container) {
  let htmls = "";
  try {
    const querySnapshot = await getDocs(collection(db, "shapespeakitems"));
    if (querySnapshot.empty) {
      container.innerHTML = "<tr><td colspan='9'>Không có sản phẩm nào.</td></tr>";
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const coffee = docSnap.data();
      const coffeeId = docSnap.id;

      htmls += `
  <tr>
    <td><img src="${coffee.picture || '../img/shapespeakicon.jpg'}" style="width: 100px;"></td>
    <td>${coffee.name}</td>
    <td>${coffee.details}</td>
    <td>${coffee.price} VND</td>
    <td>${coffee.stock}</td>
    <td>${Array.isArray(coffee.category) ? coffee.category.join(", ") : coffee.category}</td>
    <td>
      <button onclick="location.href='edit-product-intro.html?productId=${coffeeId}'"
        class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
        Chỉnh sửa giới thiệu
      </button>
    </td>
    <td>
      <button onclick="deleteProduct('${coffeeId}')"
        class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">
        Xóa
      </button>
    </td>
    <td>
      <button onclick="getOneProduct('${coffeeId}')"
        class="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded text-sm">
        Sửa
      </button>
    </td>
  </tr>
`;
    });

    container.innerHTML = htmls;
  } catch (error) {
    showToast("❌ Lỗi khi tải sản phẩm", "error");
    console.error("Error fetching products:", error);
    container.innerHTML = `<tr><td colspan='9'>Lỗi khi tải danh sách sản phẩm.</td></tr>`;
  }
}

// ✅ Xóa sản phẩm
window.deleteProduct = async (productId) => {
  if (confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) {
    try {
      await deleteDoc(doc(db, "shapespeakitems", productId));
      showToast("✅ Đã xóa sản phẩm!", "success");
      loadProducts(document.getElementById("content"));
    } catch (error) {
      showToast("❌ Lỗi khi xóa sản phẩm!", "error");
      console.error("Error removing product:", error);
    }
  }
};

// ✅ Lấy 1 sản phẩm
window.getOneProduct = async (productId) => {
  try {
    const docSnap = await getDoc(doc(db, "shapespeakitems", productId));
    if (!docSnap.exists()) {
      showToast("❌ Sản phẩm không tồn tại!", "error");
      return;
    }

    const productItem = docSnap.data();

    // --- Ảnh thumbnail ---
    document.getElementById("preview-picture-edit").src =
      productItem.picture || "../img/shapespeakicon.jpg";

    // --- Gán các input ---
    document.getElementById("edit-name").value = productItem.name || "";
    document.getElementById("edit-details").value = productItem.details || "";
    document.getElementById("edit-price").value = productItem.price || 0;
    document.getElementById("edit-stock").value = productItem.stock || 0;

    // --- Hiển thị media phụ có sẵn ---
    const previewBox = document.getElementById("edit-mediaPreview");
    if (productItem.media && Array.isArray(productItem.media)) {
      renderExistingMedia(productItem.media, previewBox);
    } else {
      previewBox.innerHTML =
        "<p class='text-gray-400 text-sm'>Không có hình ảnh / video phụ.</p>";
    }

    // --- Danh mục ---
    const categories = Array.isArray(productItem.category)
      ? productItem.category
      : [productItem.category];
    document.querySelectorAll(".edit-category-option").forEach((cb) => {
      cb.checked = categories.includes(cb.value);
    });

    const updateEditText = () => {
      const checked = Array.from(
        document.querySelectorAll(".edit-category-option:checked")
      ).map((cb) => cb.value);
      document.getElementById("editCategorySelectedText").textContent =
        checked.length > 0 ? checked.join(", ") : "Chọn danh mục";
    };
    updateEditText();

    document.getElementById("form-edit-product").dataset.productId = productId;
    openModal2();
  } catch (error) {
    showToast("❌ Lỗi khi lấy sản phẩm", "error");
    console.error("Error getting product:", error);
  }
};

// ✅ Cập nhật sản phẩm
window.updateProduct = async (event) => {
  event.preventDefault();

  const productID = document.getElementById("form-edit-product").dataset.productId;
  const picture = document.getElementById("edit-picture").files[0];

  let productDataUpdate = {
    name: document.getElementById("edit-name").value.trim(),
    details: document.getElementById("edit-details").value.trim(),
    price: Number(document.getElementById("edit-price").value),
    stock: Number(document.getElementById("edit-stock").value),
    category: Array.from(
      document.querySelectorAll(".edit-category-option:checked")
    ).map((cb) => cb.value),
  };

  // --- Upload thumbnail mới (nếu có) ---
  if (picture) {
    const formData = new FormData();
    formData.append("media", picture);

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, { method: "POST", body: formData });
      const result = await res.json();
      if (result?.success) {
        productDataUpdate.picture = result.data.secure_url;
      } else {
        showToast("❌ Upload ảnh thumbnail thất bại!", "error");
      }
    } catch (err) {
      console.error("Lỗi upload thumbnail:", err);
      showToast("❌ Lỗi khi upload ảnh!", "error");
    }
  }

  // --- Upload media phụ mới nếu có ---
  let newUploaded = [];
  try {
    // Upload chỉ những file là File object (người dùng mới thêm)
    const newFiles = selectedFiles.filter(f => f instanceof File);
    if (newFiles.length > 0) {
      newUploaded = await uploadMultipleMedia();
    }

    // Giữ lại media cũ chưa bị xoá
    const remainingMedia = selectedFiles
      .filter(f => f.url) // có url nghĩa là media cũ
      .map(f => ({
        url: f.url,
        type: f.type.startsWith("video") ? "video" : "image",
      }));

    productDataUpdate.media = [...remainingMedia, ...newUploaded];
  } catch (err) {
    console.error("Lỗi xử lý media phụ:", err);
    showToast("❌ Lỗi upload hoặc lưu media phụ!", "error");
  }

  // --- Lưu Firestore ---
  try {
    await updateDoc(doc(db, "shapespeakitems", productID), productDataUpdate);
    showToast("✅ Cập nhật thành công!", "success");
    closeModal2();
    loadProducts(document.getElementById("content"));
  } catch (error) {
    console.error("Error updating product:", error);
    showToast("❌ Lỗi khi cập nhật sản phẩm!", "error");
  }
};

// ✅ Thêm sản phẩm mới
async function AddProduct(newProduct) {
  try {
    await addDoc(collection(db, "shapespeakitems"), newProduct);
    showToast("✅ Thêm sản phẩm thành công!", "success");
    loadProducts(document.getElementById("content"));
  } catch (error) {
    showToast("❌ Lỗi khi thêm sản phẩm!", "error");
    console.error("Error adding product:", error);
  }
}

// --- GẮN preview khi người dùng chọn file ---
const mediaInput = document.getElementById("mediaFiles");
const mediaPreview = document.getElementById("mediaPreview");

if (mediaInput && mediaPreview) {
  mediaInput.addEventListener("change", (e) => {
    renderMediaPreview(e.target.files, mediaPreview);
    e.target.value = ""; // ✅ Reset input mỗi lần chọn
  });
}

// --- Preview cho form sửa sản phẩm ---
const editMediaInput = document.getElementById("edit-mediaFiles");
const editMediaPreview = document.getElementById("edit-mediaPreview");

// replace (thay thế toàn bộ selectedFiles bằng file mới)
if (editMediaInput && editMediaPreview) {
  editMediaInput.addEventListener("change", (e) => {
    const newFiles = Array.from(e.target.files);
    // Thay thế nội dung của selectedFiles bằng file mới
    selectedFiles.length = 0;
    selectedFiles.push(...newFiles);

    renderMediaPreview(selectedFiles, editMediaPreview);

    // Reset input nếu muốn chọn lại cùng file
    editMediaInput.value = null;
  });
}

// ✅ HÀM XỬ LÝ TẠO SẢN PHẨM
async function handleAddProduct() {
  const name = document.getElementById("name").value.trim();
  const details = document.getElementById("details").value.trim();
  const price = Number(document.getElementById("price").value);
  const stock = Number(document.getElementById("stock").value);
  const picture = document.getElementById("picture").files[0];
  const selectedCategories = Array.from(
    document.querySelectorAll(".category-option:checked")
  ).map(cb => cb.value);

  if (!name || !details) {
    showToast("⚠️ Vui lòng nhập đầy đủ thông tin!", "warning");
    return;
  }

  let newProduct = {
    name,
    details,
    price,
    stock,
    category: selectedCategories,
    createdAt: new Date(),
  };

  // ✅ 1. Upload thumbnail nếu có
  if (picture) {
    const formData = new FormData();
    formData.append("media", picture);
    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (result?.success) {
        newProduct.picture = result.data.secure_url;
      } else {
        showToast("❌ Upload ảnh thumbnail thất bại!", "error");
      }
    } catch (err) {
      console.error("Lỗi upload thumbnail:", err);
      showToast("❌ Lỗi khi upload ảnh!", "error");
    }
  }

  // ✅ 2. Upload media phụ nếu có
  let uploadedMedia = [];
  if (selectedFiles.length > 0) {
    try {
      uploadedMedia = await uploadMultipleMedia();
      newProduct.media = uploadedMedia;
    } catch (err) {
      console.error("Lỗi upload media phụ:", err);
      showToast("❌ Lỗi upload media phụ!", "error");
    }
  }

  // ✅ 3. Lưu Firestore hoặc server
  console.log("✅ Dữ liệu sản phẩm mới:", newProduct);
  AddProduct(newProduct);

  // ✅ 4. Reset form
  document.getElementById("form-new-product").reset();
  selectedFiles.length = 0;
  mediaPreview.innerHTML = "";
  document.getElementById("preview-picture-new").style.display = "none";

  showToast("🎉 Sản phẩm đã được thêm!", "success");
}

// ✅ Gắn duy nhất 1 listener cho form
document.getElementById("form-new-product").addEventListener("submit", (e) => {
  e.preventDefault();
  handleAddProduct();
});

// ✅ Cuối file index.js

function initMultiSelectDropdown(wrapperId, toggleBtnId, dropdownId, selectedTextId, checkboxClass) {
  const wrapper = document.getElementById(wrapperId);
  const toggleBtn = document.getElementById(toggleBtnId);
  const dropdown = document.getElementById(dropdownId);
  const selectedText = document.getElementById(selectedTextId);

  toggleBtn.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
  });

  function updateText() {
    const checked = Array.from(document.querySelectorAll(`.${checkboxClass}:checked`)).map(cb => cb.value);
    selectedText.textContent = checked.length > 0 ? checked.join(", ") : "Chọn danh mục";
  }

  document.querySelectorAll(`.${checkboxClass}`).forEach(cb =>
    cb.addEventListener("change", updateText)
  );

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });

  updateText(); // Initial
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("content");
  loadProducts(container);

  initMultiSelectDropdown(
    "multi-select-category",
    "dropdownToggle",
    "dropdownMenu",
    "selectedText",
    "category-option"
  );

  initMultiSelectDropdown(
    "multi-select-edit-category",
    "editCategoryDropdownBtn",
    "editCategoryDropdown",
    "editCategorySelectedText",
    "edit-category-option"
  );
});

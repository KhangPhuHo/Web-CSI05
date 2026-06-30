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

const API_BASE_URL = "https://shapespeaker.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("content");
  loadProducts(container);
});

// ✅ Load danh sách sản phẩm
async function loadProducts(container) {
  let htmls = "";
  try {
    const querySnapshot = await getDocs(collection(db, "shapespeakitems"));
    if (querySnapshot.empty) {
      container.innerHTML = "<tr><td colspan='5'>Không có sản phẩm nào.</td></tr>";
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
    container.innerHTML = "<tr><td colspan='5'>Lỗi khi tải danh sách sản phẩm.</td></tr>";
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
    if (docSnap.exists()) {
      const productItem = docSnap.data();
      if (productItem.picture) {
        document.getElementById("preview-picture-edit").src = productItem.picture || '../img/shapespeakicon.jpg';
      }
      document.getElementById("edit-name").value = productItem.name;
      document.getElementById("edit-details").value = productItem.details;
      document.getElementById("edit-price").value = productItem.price;
      document.getElementById("edit-stock").value = productItem.stock;
      document.getElementById("form-edit-product").dataset.productId = productId;
      openModal2();
    } else {
      showToast("❌ Sản phẩm không tồn tại!", "error");
    }
  } catch (error) {
    showToast("❌ Lỗi khi lấy sản phẩm", "error");
    console.error("Error getting product:", error);
  }
};

// ✅ Cập nhật sản phẩm
window.updateProduct = async (event) => {
  event.preventDefault();
  const productID = document.getElementById("form-edit-product").dataset.productId;
  let picture = document.getElementById("edit-picture").files[0];
  let productDataUpdate = {
    name: document.getElementById("edit-name").value,
    details: document.getElementById("edit-details").value,
    price: Number(document.getElementById("edit-price").value),
    stock: Number(document.getElementById("edit-stock").value),
  };

  if (picture) {
    const formData = new FormData();
    formData.append("media", picture); // ✅ Sửa đúng tên field

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      productDataUpdate.picture = result.data.secure_url;
    } catch (error) {
      showToast("❌ Lỗi khi upload ảnh!", "error");
      console.error("Error uploading image:", error);
    }
  }

  try {
    await updateDoc(doc(db, "shapespeakitems", productID), productDataUpdate);
    showToast("✅ Cập nhật thành công!", "success");
    closeModal2();
    loadProducts(document.getElementById("content"));
  } catch (error) {
    showToast("❌ Lỗi khi cập nhật sản phẩm!", "error");
    console.error("Error updating product:", error);
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

// ✅ Xử lý thêm sản phẩm
async function handleAddProduct() {
  let picture = document.getElementById("picture").files[0];
  let newProduct = {
    name: document.getElementById("name").value,
    details: document.getElementById("details").value,
    price: Number(document.getElementById("price").value),
    stock: Number(document.getElementById("stock").value),
  };

  if (picture) {
    const formData = new FormData();
    formData.append("media", picture); // ✅ Sửa đúng tên field

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      newProduct.picture = result.data.secure_url;
    } catch (error) {
      showToast("❌ Lỗi khi upload ảnh!", "error");
      console.error("Error uploading image:", error);
    }
  }

  AddProduct(newProduct);
}

// ✅ Gắn sự kiện cho form thêm sản phẩm
document.getElementById("form-new-product").addEventListener("submit", (e) => {
  e.preventDefault();
  handleAddProduct();
});

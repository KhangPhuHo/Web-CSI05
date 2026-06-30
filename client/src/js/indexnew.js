// ✅ news-manager.js
import { db } from "./firebase-config.js";
import { showToast } from "./toast.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const API_BASE_URL = "https://shapespeaker.onrender.com";

// ✅ DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("content");
  loadProducts(container);
});

// ✅ Load danh sách bài báo
async function loadProducts(container) {
  let htmls = "";
  try {
    const q = query(collection(db, "shapespeaknews"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      container.innerHTML = "<tr><td colspan='9'>Không có bài báo nào.</td></tr>";
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const news = docSnap.data();
      const newsId = docSnap.id;

      const formatDate = (timestamp) => {
        const date = timestamp?.toDate?.() || new Date();
        return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")
          }/${date.getFullYear()} ${date.getHours().toString().padStart(2, "0")}:${date
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;
      };

      htmls += `
        <tr>
          <td><img src="${news.picture || '../img/shapespeakicon.jpg'}" style="width: 100px;"></td>
          <td>${news.name}</td>
          <td>${news.details}</td>
          <td>${news.author}</td>
          <td>
          <button onclick="location.href='edit-product-intro.html?productId=${newsId}'"
          class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
          Chỉnh sửa giới thiệu
          </button>
          </td>
          <td>${formatDate(news.createdAt)}</td>
          <td>${formatDate(news.updatedAt)}</td>
          <td><button onclick="deleteProduct('${newsId}')">Xóa</button></td>
          <td><button onclick="getOneProduct('${newsId}')">Sửa</button></td>
        </tr>
      `;
    });

    container.innerHTML = htmls;
  } catch (error) {
    console.error("❌ Error fetching news:", error);
    showToast("❌ Lỗi khi tải danh sách bài báo", "error");
    container.innerHTML = "<tr><td colspan='9'>Lỗi khi tải danh sách bài báo.</td></tr>";
  }
}

// ✅ Xoá bài báo
window.deleteProduct = async (newsId) => {
  if (confirm("Bạn có chắc chắn muốn xóa bài báo này?")) {
    try {
      await deleteDoc(doc(db, "shapespeaknews", newsId));
      showToast("✅ Đã xóa bài báo!", "success");
      loadProducts(document.getElementById("content"));
    } catch (error) {
      console.error("❌ Error deleting news:", error);
      showToast("❌ Lỗi khi xóa bài báo!", "error");
    }
  }
};

// ✅ Lấy chi tiết bài báo
window.getOneProduct = async (newsId) => {
  try {
    const docSnap = await getDoc(doc(db, "shapespeaknews", newsId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById("preview-picture-edit").src = data.picture || "../img/shapespeakicon.jpg";
      document.getElementById("edit-name").value = data.name || "";
      document.getElementById("edit-details").value = data.details || "";
      document.getElementById("edit-author").value = data.author || "";
      document.getElementById("form-edit-product").dataset.productId = newsId;
      openModal2();
    } else {
      showToast("❌ Bài báo không tồn tại!", "error");
    }
  } catch (error) {
    console.error("❌ Error getting news:", error);
    showToast("❌ Lỗi khi lấy bài báo!", "error");
  }
};

// ✅ Cập nhật bài báo
window.updateProduct = async (event) => {
  event.preventDefault();
  const newsId = document.getElementById("form-edit-product").dataset.productId;
  const pictureFile = document.getElementById("edit-picture").files[0];

  let updatedData = {
    name: document.getElementById("edit-name").value,
    details: document.getElementById("edit-details").value,
    author: document.getElementById("edit-author").value,
    updatedAt: serverTimestamp(),
  };

  if (pictureFile) {
    const formData = new FormData();
    formData.append("media", pictureFile);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      updatedData.picture = result.data.secure_url;
    } catch (error) {
      console.error("❌ Lỗi khi upload ảnh:", error);
      showToast("❌ Lỗi khi upload ảnh!", "error");
    }
  }

  try {
    await updateDoc(doc(db, "shapespeaknews", newsId), updatedData);
    showToast("✅ Cập nhật bài báo thành công!", "success");
    closeModal2();
    loadProducts(document.getElementById("content"));
  } catch (error) {
    console.error("❌ Error updating news:", error);
    showToast("❌ Lỗi khi cập nhật bài báo!", "error");
  }
};

// ✅ Thêm bài báo mới
async function AddProduct(newProduct) {
  try {
    await addDoc(collection(db, "shapespeaknews"), {
      ...newProduct,
      createdAt: serverTimestamp(),
    });
    showToast("✅ Thêm bài báo thành công!", "success");
    loadProducts(document.getElementById("content"));
  } catch (error) {
    console.error("❌ Error adding news:", error);
    showToast("❌ Lỗi khi thêm bài báo!", "error");
  }
}

// ✅ Xử lý submit thêm bài báo
async function handleAddProduct() {
  const picture = document.getElementById("picture").files[0];
  let newProduct = {
    name: document.getElementById("name").value,
    details: document.getElementById("details").value,
    author: document.getElementById("author").value,
  };

  if (picture) {
    const formData = new FormData();
    formData.append("media", picture);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      newProduct.picture = result.data.secure_url;
    } catch (error) {
      console.error("❌ Lỗi khi upload ảnh:", error);
      showToast("❌ Lỗi khi upload ảnh!", "error");
    }
  }

  await AddProduct(newProduct);
}

// ✅ Gắn sự kiện cho form
document.getElementById("form-new-product").addEventListener("submit", (e) => {
  e.preventDefault();
  handleAddProduct();
});

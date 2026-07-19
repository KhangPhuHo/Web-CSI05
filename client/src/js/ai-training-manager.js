// ai-manager.js

import { showToast } from "./toast.js";

const API_BASE_URL = "https://bookstore-bsjx.onrender.com";

let allProducts = [];
let currentProduct = null;


// Load toàn bộ products.json
document.addEventListener("DOMContentLoaded", () => {

    loadProductsJson();

    document
        .getElementById("reload-btn")
        .addEventListener("click", loadProductsJson);

    document
        .getElementById("download-btn")
        .addEventListener("click", () => {

            window.open(
                `${API_BASE_URL}/api/products-json/download?t=${Date.now()}`,
                "_blank"
            );

        });

    document
        .getElementById("search-input")
        .addEventListener("input", searchProducts);

});


// Load dữ liệu

async function loadProductsJson() {

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/products-json`
        );

        allProducts = await response.json();

        renderProducts(allProducts);

    }

    catch (error) {

        console.error(error);

        showToast(
            "❌ Không thể tải products.json",
            "error"
        );

    }

}


// ===============================
// Render bảng
// ===============================

function renderProducts(data) {

    const tbody =
        document.getElementById("content");

    tbody.innerHTML = "";

    Object.entries(data).forEach(([id, product]) => {

        const tr =
            document.createElement("tr");

        tr.innerHTML = `

<td>${id}</td>

<td>${product.name || ""}</td>

<td>

${product.isFixed
                ? "<span class='status-fixed'>✅</span>"
                : "<span class='status-notfixed'>❌</span>"
            }

</td>

<td>

${shortSummary(product.summary)}

</td>

<td>

<button
class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
onclick="viewProduct('${id}')">

Xem

</button>

<button
class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
onclick="deleteProductFromAI('${id}')">

Xóa

</button>

</td>

`;

        tbody.appendChild(tr);

    });

}


// Rút gọn summary

function shortSummary(text) {

    if (!text) return "";

    if (text.length <= 120)
        return text;

    return text.substring(0, 120) + "...";

}


// Search

function searchProducts(e) {

    const keyword =
        e.target.value
            .trim()
            .toLowerCase();

    if (!keyword) {

        renderProducts(allProducts);

        return;
    }

    const filtered = {};

    Object.entries(allProducts)
        .forEach(([id, product]) => {

            const text = `

${id}

${product.name || ""}

${product.summary || ""}

`
                .toLowerCase();

            if (text.includes(keyword)) {

                filtered[id] = product;

            }

        });

    renderProducts(filtered);

}


// Xem chi tiết

window.viewProduct =
    async function (id) {

        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/api/products-json/${id}`
                );

            currentProduct =
                await response.json();

            document
                .getElementById("modal-id")
                .value = id;

            document
                .getElementById("modal-name")
                .value =
                currentProduct.name || "";

            document
                .getElementById("modal-summary")
                .value =
                currentProduct.summary || "";

            document
                .getElementById("modal-fixed")
                .value =
                currentProduct.isFixed
                    ? "Đã sửa"
                    : "Chưa sửa";

            document
                .getElementById("modal-json")
                .textContent =
                JSON.stringify(
                    currentProduct,
                    null,
                    2
                );

            openJsonModal();

        }

        catch (error) {

            console.error(error);

            showToast(
                "Không lấy được dữ liệu",
                "error"
            );

        }

    };


// Copy JSON

document
    .getElementById("copy-json-btn")
    .addEventListener("click", async () => {

        if (!currentProduct)
            return;

        await navigator.clipboard.writeText(

            JSON.stringify(
                currentProduct,
                null,
                2
            )

        );

        showToast(
            "Đã copy JSON",
            "success"
        );

    });


// Xóa khỏi AI

window.deleteProductFromAI =
    async function (id) {

        if (!confirm(
            "Bạn có chắc chắn muốn xóa sản phẩm này khỏi AI?"
        ))
            return;

        try {

            const response =
                await fetch(

                    `${API_BASE_URL}/api/products-json/${id}`,

                    {
                        method: "DELETE"
                    }

                );

            const result =
                await response.json();

            if (!result.success) {

                throw new Error();

            }

            showToast(
                "Đã xóa khỏi AI",
                "success"
            );

            closeJsonModal();

            loadProductsJson();

        }

        catch (error) {

            console.error(error);

            showToast(
                "Không thể xóa",
                "error"
            );

        }

    };
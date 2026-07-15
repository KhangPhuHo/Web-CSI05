const fs = require("fs");
const path = require("path");

const repairProductsJson =
  require("../utils/repairProductsJson");

const PRODUCTS_JSON_PATH = path.join(
  __dirname,
  "../../agent/data/text/products.json"
);

async function syncProductToJson(db, productId) {

  const docSnap = await db
    .collection("products")
    .doc(productId)
    .get();

  if (!docSnap.exists) {
    throw new Error("Product not found");
  }

  const firestoreData = docSnap.data();

  let jsonData = {};

  if (fs.existsSync(PRODUCTS_JSON_PATH)) {

    jsonData = JSON.parse(
      fs.readFileSync(PRODUCTS_JSON_PATH, "utf8")
    );
  }

  const oldProduct =
    jsonData[productId] || {};

  const summaryChanged =
    oldProduct.summary !==
    (firestoreData.summary || "");

  jsonData[productId] = {
    ...oldProduct,
    ...firestoreData
  };

  // Nếu sản phẩm mới
  if (!oldProduct.isFixed) {

    jsonData[productId].isFixed = false;
  }

  // Nếu summary bị sửa
  if (summaryChanged) {

    jsonData[productId].isFixed = false;
  }

  if (!jsonData[productId].summary) {
    jsonData[productId].summary = "";
  }

  jsonData[productId].isFixed = false;

  console.log("Saving to:", PRODUCTS_JSON_PATH);
  console.log("Total products:", Object.keys(jsonData).length);
  console.log("Updated product:", jsonData[productId]);

  fs.writeFileSync(
    PRODUCTS_JSON_PATH,
    JSON.stringify(jsonData, null, 2),
    "utf8"
  );

  await repairProductsJson(
    PRODUCTS_JSON_PATH
  );

  console.log("✅ Synced:", productId);
}

async function syncRatingToJson(db, productId) {

  // Doc TAT CA danh gia trong subcollection products/{productId}/ratings
  // (moi doc: { rating, timestamp, uid }) roi tinh trung binh - KHONG luu
  // tung danh gia le vao products.json, chi luu 1 con so trung binh.
  const ratingsSnap = await db
    .collection("products")
    .doc(productId)
    .collection("ratings")
    .get();

  const ratings = [];

  ratingsSnap.forEach(doc => {
    const value = doc.data().rating;

    if (typeof value === "number" && !Number.isNaN(value)) {
      ratings.push(value);
    }
  });

  const ratingCount = ratings.length;

  const avgRating = ratingCount
    ? Math.round(
        (ratings.reduce((sum, r) => sum + r, 0) / ratingCount) * 10
      ) / 10 // lam tron 1 chu so thap phan, VD 4.3
    : 0;

  let jsonData = {};

  if (fs.existsSync(PRODUCTS_JSON_PATH)) {

    jsonData = JSON.parse(
      fs.readFileSync(PRODUCTS_JSON_PATH, "utf8")
    );
  }

  if (!jsonData[productId]) {
    // San pham nay chua tung duoc sync vao products.json (VD chua co
    // summary/AI data) - bo qua, tranh tao ra 1 entry thieu du lieu khac
    console.log(
      `⚠️ Bo qua sync rating: san pham ${productId} chua co trong products.json`
    );
    return;
  }

  // CHI patch 2 field nay, giu nguyen moi thu khac (summary, gia, ton kho...)
  jsonData[productId].avgRating = avgRating;
  jsonData[productId].ratingCount = ratingCount;

  fs.writeFileSync(
    PRODUCTS_JSON_PATH,
    JSON.stringify(jsonData, null, 2),
    "utf8"
  );

  console.log(
    `⭐ Synced rating cho ${productId}: ${avgRating}/5 (${ratingCount} danh gia)`
  );
}

async function deleteProductFromJson(productId) {

  let jsonData = {};

  if (fs.existsSync(PRODUCTS_JSON_PATH)) {

    jsonData = JSON.parse(
      fs.readFileSync(PRODUCTS_JSON_PATH, "utf8")
    );
  }

  if (jsonData[productId]) {

    delete jsonData[productId];

    fs.writeFileSync(
      PRODUCTS_JSON_PATH,
      JSON.stringify(jsonData, null, 2),
      "utf8"
    );

    console.log("🗑️ Deleted:", productId);
  }
}

module.exports = {
  syncProductToJson,
  syncRatingToJson,
  deleteProductFromJson
};
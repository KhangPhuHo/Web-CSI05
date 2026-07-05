const fs = require("fs");
const path = require("path");
const cleanSummary = require("../utils/repairJsonFile");

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

  const oldSummary =
    oldProduct.summary || "";

  const newSummary =
    firestoreData.summary || "";

  const summaryChanged =
    oldSummary !== newSummary;

  let mergedProduct = {
    ...oldProduct,
    ...firestoreData
  };

  if (
    !oldProduct.isFixed ||
    summaryChanged
  ) {

    mergedProduct.summary =
      cleanSummary(newSummary);

    mergedProduct.isFixed = true;
  }

  jsonData[productId] =
    mergedProduct;

  fs.writeFileSync(
    PRODUCTS_JSON_PATH,
    JSON.stringify(jsonData, null, 2),
    "utf8"
  );

  await repairJsonFile(
    PRODUCTS_JSON_PATH
  );

  console.log("✅ Synced:", productId);
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
  deleteProductFromJson
};
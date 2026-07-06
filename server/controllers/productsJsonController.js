const fs = require("fs");
const path = require("path");
const {
    deleteProductFromJson
} = require("../services/productSyncService");

const PRODUCTS_JSON_PATH = path.join(
    __dirname,
    "../../agent/data/text/products.json"
);

// Lấy toàn bộ json
exports.getProductsJson = (req, res) => {

    if (!fs.existsSync(PRODUCTS_JSON_PATH)) {
        return res.json({});
    }

    const data = JSON.parse(
        fs.readFileSync(PRODUCTS_JSON_PATH, "utf8")
    );

    res.json(data);
};

// Download
exports.downloadProductsJson = (req, res) => {

    res.download(PRODUCTS_JSON_PATH);
};

// Lấy 1 product
exports.getOneProductJson = (req, res) => {

    if (!fs.existsSync(PRODUCTS_JSON_PATH))
        return res.status(404).json({
            message: "File not found"
        });

    const data = JSON.parse(
        fs.readFileSync(PRODUCTS_JSON_PATH, "utf8")
    );

    res.json(
        data[req.params.id] || null
    );
};

// Xóa khỏi AI
exports.deleteProductJson =
async (req, res) => {

    await deleteProductFromJson(
        req.params.id
    );

    res.json({
        success: true
    });
};
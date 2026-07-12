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
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    });
    res.download(PRODUCTS_JSON_PATH, "products.json");
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

// Cap nhat rieng field visual_description (mo ta anh bia do Gemini Vision tao ra)
// Duoc goi tu script step0_enrich_covers.py (chay local) sau khi tao xong mo ta,
// de dong bo ban products.json tren Render voi ban local - khong dam vao cac
// field khac (name/summary/price/stock...) cua san pham.
exports.updateVisualDescription = (req, res) => {

    const { id } = req.params;
    const { visual_description } = req.body;

    if (typeof visual_description !== "string" || !visual_description.trim()) {
        return res.status(400).json({
            success: false,
            message: "Thieu hoac sai dinh dang truong 'visual_description'."
        });
    }

    if (!fs.existsSync(PRODUCTS_JSON_PATH)) {
        return res.status(404).json({
            success: false,
            message: "Khong tim thay products.json tren server."
        });
    }

    const data = JSON.parse(
        fs.readFileSync(PRODUCTS_JSON_PATH, "utf8")
    );

    if (!data[id]) {
        return res.status(404).json({
            success: false,
            message: `Khong tim thay san pham co id '${id}'.`
        });
    }

    data[id].visual_description = visual_description;

    fs.writeFileSync(
        PRODUCTS_JSON_PATH,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    console.log(`Da cap nhat visual_description cho san pham ${id}`);

    res.json({ success: true });
};
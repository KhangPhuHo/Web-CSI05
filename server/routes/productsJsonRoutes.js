const express = require("express");

const router = express.Router();

const controller =
require("../controllers/productsJsonController");

router.get(
    "/products-json",
    controller.getProductsJson
);

router.get(
    "/products-json/download",
    controller.downloadProductsJson
);

router.get(
    "/products-json/:id",
    controller.getOneProductJson
);

router.delete(
    "/products-json/:id",
    controller.deleteProductJson
);

// Cap nhat rieng visual_description (goi tu step0_enrich_covers.py)
router.patch(
    "/products-json/:id",
    controller.updateVisualDescription
);

module.exports = router;
const express = require("express");
const router = express.Router();

const {
  syncProductToJson,
  deleteProductFromJson
} = require("../services/productSyncService");

module.exports = (db) => {

  router.post("/sync-product/:id", async (req, res) => {

    try {

      await syncProductToJson(
        db,
        req.params.id
      );

      res.json({ success: true });

    } catch (err) {

      res.status(500).json({
        success: false,
        error: err.message
      });

    }

  });

  router.delete("/sync-product/:id", async (req, res) => {

    try {

      await deleteProductFromJson(
        req.params.id
      );

      res.json({ success: true });

    } catch (err) {

      res.status(500).json({
        success: false
      });

    }

  });

  return router;
};
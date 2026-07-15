const express = require("express");
const router = express.Router();

const {
  syncProductToJson,
  syncRatingToJson,
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

  // Goi sau khi 1 khach hang gui danh gia (rating) cho san pham - server tu
  // doc lai subcollection ratings tu Firestore va tinh trung binh, KHONG can
  // client gui gia tri gi len, tranh bi gia mao/sai lech.
  router.post("/sync-rating/:id", async (req, res) => {

    try {

      await syncRatingToJson(
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
const express = require("express");
const router = express.Router();

const upload = require("../middleware/multer"); // middleware da co san, dung chung voi /upload

const ragController = require("../controllers/ragController");

// Hoi dap bang text - proxy sang Python RAG server
router.post("/ask-rag", ragController.askRag);

// Goi y sach tu hinh anh - proxy sang Python RAG server (Gemini Vision)
// field ten "media" de dong bo voi route /upload dang co san
router.post(
    "/recommend-from-image-rag",
    upload.single("media"),
    ragController.recommendFromImageRag
);

module.exports = router;

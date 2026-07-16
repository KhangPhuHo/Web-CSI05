const express = require("express");
const router = express.Router();

const notifyController = require("../controllers/notifyController");

router.post("/notify-canned-reply", notifyController.sendCannedReplyNotification);

module.exports = router;
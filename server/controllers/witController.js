// witController.js
// Route proxy: client -> backend Node (Render) -> Wit.ai
// Token KHONG bao gio gui ve client, chi dung trong request server -> Wit.ai

const express = require('express');
const router = express.Router();

// Bat buoc: dat bien moi truong WIT_ACCESS_TOKEN tren Render Dashboard
// (Environment > Add Environment Variable), KHONG duoc hardcode hay commit vao git.
const WIT_ACCESS_TOKEN = process.env.WIT_ACCESS_TOKEN;
const WIT_API_VERSION = '20230616'; // co the giu nguyen, xem giai thich ben tren

router.get('/api/wit-message', async (req, res) => {
  const question = req.query.q;

  if (!question) {
    return res.status(400).json({ error: 'Thiếu tham số q (câu hỏi).' });
  }

  if (!WIT_ACCESS_TOKEN) {
    console.error('Thiếu biến môi trường WIT_ACCESS_TOKEN trên server.');
    return res.status(500).json({ error: 'Server chưa cấu hình Wit.ai token.' });
  }

  try {
    const witRes = await fetch(
      `https://api.wit.ai/message?v=${WIT_API_VERSION}&q=${encodeURIComponent(question)}`,
      {
        headers: {
          Authorization: `Bearer ${WIT_ACCESS_TOKEN}`,
        },
      }
    );

    const data = await witRes.json();

    // Tra nguyen JSON cua Wit.ai ve cho client (client van doc data.intents nhu cu)
    return res.status(witRes.status).json(data);
  } catch (error) {
    console.error('Lỗi khi gọi Wit.ai từ server:', error);
    return res.status(500).json({ error: 'Lỗi khi kết nối tới Wit.ai.' });
  }
});

module.exports = router;

// Trong file server chinh (vi du app.js / index.js), nho gan router nay vao app:
//   const witController = require('./witController');
//   app.use(witController);
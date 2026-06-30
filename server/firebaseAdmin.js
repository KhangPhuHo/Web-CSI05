const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(), // hoặc dùng serviceAccountKey.json nếu cần
});

module.exports = admin;

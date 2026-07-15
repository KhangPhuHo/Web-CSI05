// utils/notify.js
const admin = require("firebase-admin");

async function notifyUser(userId, { type, title, body }) {
  if (!userId) return;

  // Ghi lịch sử noti (hiển thị trong app lúc mở lại)
  await admin.firestore()
    .collection("users").doc(userId)
    .collection("notifications").add({
      type, title, body,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

  // Đẩy push thật sự (nhận được cả khi tắt tab/máy đã đăng ký sẵn token)
  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  const token = userDoc.data()?.fcmToken;

  if (token) {
    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data: { type }
      });
    } catch (error) {
      // Token có thể đã hết hạn/thu hồi (user gỡ quyền, đổi trình duyệt...)
      console.error(`Gửi push cho user ${userId} thất bại:`, error.message);
    }
  }
}

module.exports = { notifyUser };
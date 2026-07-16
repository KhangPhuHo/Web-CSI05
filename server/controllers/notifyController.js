const { notifyUser } = require("../utils/notify");

// POST /api/notify-canned-reply  { userId, type, title, body }
// Dung cho cac cau tra loi "co san" (Wit.ai xu ly truc tiep o frontend -
// greeting/thank/goodbye/ask_features), KHONG di qua RAG server. Vi frontend
// khong goi AI nao trong nhanh nay, can 1 route rieng chi de gui push
// notification that (notifyUser ghi Firestore + gui FCM), thay vi chi ghi
// Firestore nhu pushNotification() client-side truoc day.
exports.sendCannedReplyNotification = async (req, res) => {

    const { userId, type, title, body } = req.body;

    if (!userId) {
        // Khach chua dang nhap - khong co gi de gui, khong tinh la loi
        return res.json({ success: true, skipped: true });
    }

    if (!title || !body) {
        return res.status(400).json({
            success: false,
            message: "Thieu truong 'title' hoac 'body'."
        });
    }

    try {
        await notifyUser(userId, {
            type: type || "chatbot_reply",
            title,
            body
        });

        res.json({ success: true });

    } catch (error) {
        console.error("Loi khi gui notification (canned reply):", error);

        // Day chi la thong bao, khong phai chuc nang chinh - tra ve 200 kem
        // success:false de frontend biet nhung khong hien loi to cho nguoi dung
        res.json({ success: false, message: "Gui thong bao that bai." });
    }
};
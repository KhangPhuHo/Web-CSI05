const fs = require("fs");

// URL cua Python RAG API server (api_server.py) - vi du:
// https://<ten-service-rag>.onrender.com
// RAG_API_KEY: key bi mat, PHAI khop voi RAG_API_KEY trong .env cua server Python.
// Ca 2 gia tri nay CHI nam trong .env cua Node, KHONG bao gio gui ve trinh duyet.
const RAG_SERVER_URL = process.env.RAG_SERVER_URL;
const RAG_API_KEY = process.env.RAG_API_KEY;

function ensureRagConfigured(res) {
    if (!RAG_SERVER_URL || !RAG_API_KEY) {
        res.status(500).json({
            success: false,
            message: "RAG_SERVER_URL hoac RAG_API_KEY chua duoc cau hinh trong .env cua backend."
        });
        return false;
    }
    return true;
}

const { notifyUser } = require("../utils/notify");

// POST /api/ask-rag  { question }
// Trinh duyet goi vao day - KHONG can biet RAG_API_KEY la gi
exports.askRag = async (req, res) => {

    if (!ensureRagConfigured(res)) return;

    const { question, top_k, history } = req.body;

    if (!question || !question.trim()) {
        return res.status(400).json({
            success: false,
            message: "Thieu truong 'question'."
        });
    }

    try {
        const response = await fetch(`${RAG_SERVER_URL}/ask`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": RAG_API_KEY
            },
            body: JSON.stringify({
                question,
                top_k: top_k || 3,
                // Lich su hoi-dap gan nhat (mang [{role, content}]) - client gui
                // len de server viet lai cau hoi cho doc lap truoc khi tim FAISS.
                // Neu client cu chua gui field nay thi mac dinh mang rong.
                history: Array.isArray(history) ? history : []
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: data.detail || "Loi tu RAG server."
            });
        }

        // 👉 CHÈN Ở ĐÂY - ngay sau khi có câu trả lời thành công, trước khi res.json
        await notifyUser(userId, {
            type: "chatbot_reply",
            title: "Chatbot đã trả lời",
            body: data.answer.slice(0, 100)
        });

        res.json({
            success: true,
            answer: data.answer,
            sources: data.sources
        });

    } catch (error) {
        console.error("Loi khi goi RAG server (/ask):", error);

        // QUAN TRONG: khi container Render "ngu" lau, chinh gateway cua Render
        // co the tra ve trang loi HTML (JSON.parse that bai) TRUOC KHI request
        // toi duoc app Python - day la 1 dang khac cua "server dang khoi dong",
        // khong phai loi that su. Tra ve 503 (thay vi 502) de chatbot.js (da co
        // san co che tu dong cho + hoi lai khi gap 503) tiep tuc thu, thay vi
        // bo cuoc ngay o lan dau.
        res.status(503).json({
            success: false,
            message: "RAG server dang khoi dong hoac tam thoi khong phan hoi, vui long thu lai."
        });
    }
};

// POST /api/recommend-from-image-rag  (multipart, field "media" - dung chung
// middleware multer voi route /upload de khong can them cau hinh moi)
// req.file.path da duoc multer luu tam ra dia (giong cach /upload dang lam)
exports.recommendFromImageRag = async (req, res) => {

    if (!ensureRagConfigured(res)) return;

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Khong co file anh nao duoc gui."
        });
    }

    try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const blob = new Blob([fileBuffer], { type: req.file.mimetype });

        const formData = new FormData();
        formData.append("image", blob, req.file.originalname);

        const response = await fetch(`${RAG_SERVER_URL}/recommend-from-image`, {
            method: "POST",
            headers: {
                "X-API-Key": RAG_API_KEY
                // KHONG dat Content-Type thu cong - de fetch tu dong sinh
                // boundary dung cho multipart/form-data tu FormData
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: data.detail || "Loi tu RAG server."
            });
        }

        // 👉 CHÈN Ở ĐÂY - ngay sau khi có câu trả lời thành công, trước khi res.json
        await notifyUser(userId, {
            type: "chatbot_reply",
            title: "Chatbot đã trả lời",
            body: data.answer.slice(0, 100)
        });

        res.json({
            success: true,
            answer: data.answer,
            sources: data.sources,
            image_description: data.image_description
        });

    } catch (error) {
        console.error("Loi khi goi RAG server (/recommend-from-image):", error);

        // Ly do giong het nhanh /ask ben tren - xem comment day du o do
        res.status(503).json({
            success: false,
            message: "RAG server dang khoi dong hoac tam thoi khong phan hoi, vui long thu lai."
        });

    } finally {
        // Xoa file tam da luu tren dia, du thanh cong hay loi
        fs.unlink(req.file.path, () => { });
    }
};
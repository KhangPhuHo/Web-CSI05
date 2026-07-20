# BookStore — Website bán sách kèm Chatbot AI (RAG)

Website thương mại điện tử bán sách, tích hợp chatbot AI trả lời câu hỏi về sản phẩm và chính sách dựa trên dữ liệu thật của cửa hàng (kiến trúc RAG — Retrieval-Augmented Generation), kèm khả năng gợi ý sách từ hình ảnh và thông báo đẩy (push notification).

---

## Mục lục

- [Tính năng](#tính-năng)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Cài đặt & chạy local](#cài-đặt--chạy-local)
- [Biến môi trường](#biến-môi-trường)

---

## Tính năng

### Khách hàng
- Xem danh sách sản phẩm, tìm kiếm, lọc theo thể loại
- Đánh giá sao (rating) cho sản phẩm, xem điểm trung bình + số lượt đánh giá
- Đặt hàng, theo dõi trạng thái đơn hàng (chờ xác nhận → đang xử lý → đang giao → đã giao), huỷ đơn
- Đăng ký/đăng nhập bằng Email hoặc Google

### Chatbot AI (điểm nhấn chính của dự án)
- **Hỏi đáp bằng văn bản**: trả lời câu hỏi về giá, tồn kho, thể loại, đánh giá sao — dựa trên dữ liệu sản phẩm **thật, cập nhật theo thời gian thực** (không phải dữ liệu "đóng băng" lúc huấn luyện)
- **Câu hỏi so sánh/tổng hợp**: "sản phẩm nào đánh giá cao nhất", "sách nào rẻ nhất" — xử lý bằng so sánh trực tiếp trên toàn bộ dữ liệu, không chỉ dựa vào tìm kiếm ngữ nghĩa
- **Duy trì ngữ cảnh hội thoại**: hiểu được các câu hỏi nối tiếp dùng đại từ ("nó", "cuốn đó"...) nhờ tự viết lại câu hỏi dựa trên lịch sử trò chuyện
- **Gợi ý sách từ hình ảnh**: khách tải lên 1 tấm ảnh (khung cảnh/tâm trạng) → Gemini Vision mô tả ảnh → tái sử dụng pipeline tìm kiếm để gợi ý sách phù hợp
- **Trả lời có căn cứ**: mỗi câu trả lời kèm nguồn tài liệu đã dùng, chủ động từ chối khi câu hỏi ngoài phạm vi dữ liệu (không bịa thông tin)
- **Phân luồng thông minh**: câu chào hỏi/cảm ơn xử lý nhanh qua Wit.ai (rẻ, tức thời), câu hỏi về sản phẩm/chính sách mới gọi tới AI (Gemini)
- **Thông báo đẩy (push notification)**: nhận thông báo ngay khi chatbot trả lời xong, kể cả khi đã đóng tab trình duyệt

### Quản trị (Admin)
- Thêm/sửa/xoá sản phẩm, upload ảnh (qua Cloudinary)
- Quản lý thể loại: thêm/sửa/xoá, gợi ý thể loại phổ biến theo mức độ sử dụng
- Đồng bộ dữ liệu sản phẩm sang file phục vụ AI mỗi khi có thay đổi (tự động)
- Tạo mô tả ảnh bìa sách bằng AI (Gemini Vision) để cải thiện độ chính xác gợi ý từ ảnh

---

## Kiến trúc hệ thống

Hệ thống gồm **3 phần triển khai độc lập**, giao tiếp qua HTTP:

```
┌──────────────────────┐
│   Frontend (Web)     │  HTML/CSS/JS thuần, Firebase SDK (client)
│   Vercel             │
└──────────┬───────────┘
           │ REST API
           ▼
┌────────────────────────┐        ┌────────────────────────┐
│  Backend Node.js       │──────▶[]  RAG API Server       []
│  (Express)             │  HTTP  │  (Python, FastAPI)     │
│  Render                │  +Key  │  Render                │
│                        │◀──────[]                       []
│  - Firebase Admin SDK  │        │  - LangChain + Gemini  │
│  - Cloudinary upload   │        │  - FAISS vector store  │
│  - Đồng bộ Firestore   │        │  - RAGChatbot class    │
│    ↔ products.json     │        └────────────────────────┘
│  - Proxy Wit.ai (giấu  │
│    token)              │
│  - Proxy RAG (giấu key)│
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────┐
│  Firebase                                              │
│  - Firestore (products, ratings, users, notifications) │
│  - Authentication                                      │
│  - Cloud Messaging (push notification)                 │
└────────────────────────────────────────────────────────┘
```

**Vì sao tách server AI (Python) riêng khỏi backend chính (Node)?** Node.js không phù hợp để chạy các thư viện AI/ML (LangChain, FAISS) — tách riêng giúp mỗi phần dùng đúng ngôn ngữ/công cụ phù hợp, đồng thời bảo vệ được `GOOGLE_API_KEY` (không bao giờ lộ ra ngoài server Python) bằng 1 lớp API key trung gian riêng (`RAG_API_KEY`) chỉ Node biết.

**Luồng dữ liệu cho AI:** Firestore (nguồn dữ liệu gốc, admin chỉnh sửa) → Node backend tự động đồng bộ mỗi khi có thay đổi → `products.json` (dữ liệu tĩnh dùng để AI tìm kiếm) → Python đọc, chia nhỏ, tạo embedding → FAISS vector store.

---

## Công nghệ sử dụng

**Frontend**
- HTML/CSS/JavaScript (vanilla, ES Modules)
- Firebase SDK (Auth, Firestore, Cloud Messaging) — bản modular v10
- Tailwind CSS (giao diện quản trị)

**Backend chính (Node.js)**
- Express.js
- Firebase Admin SDK
- Cloudinary (lưu trữ ảnh)
- Multer (xử lý upload file)

**Server AI (Python)**
- FastAPI + Uvicorn (API server)
- LangChain (`langchain-core`, `langchain-community`, `langchain-google-genai`, `langchain-text-splitters`)
- Google Gemini API (LLM sinh câu trả lời + Gemini Vision đọc ảnh + embedding)
- FAISS (vector store — tìm kiếm ngữ nghĩa)
- python-dotenv, requests

**Dịch vụ ngoài**
- **Firebase** — xác thực người dùng, cơ sở dữ liệu, thông báo đẩy
- **Wit.ai** — phân loại ý định (intent) cho câu chào hỏi đơn giản
- **Cloudinary** — lưu trữ ảnh sản phẩm
- **Render** — hosting cho Node backend và Python RAG server (2 service riêng biệt)
- **Vercel** — hosting frontend

---

## Cấu trúc thư mục

```
project-root/
├── client/             # Frontend (web tĩnh)
|   ├── các file html của dự án 
|   ├── sw.js   # Service worker xử lý push notification + 404 error
|   ├──lang/
|   |   ├──en.json  # Hai file json chứa các phần ngôn ngữ của trang web, hiện đang có 2 ngôn ngữ
|   |   └──vn.json
|   ├──src/
|   |   ├──css/
|   |   ├──img/
|   |   ├──js/
|   |   |   ├── các file js xử lý chức năng cho web
|   |   │   ├── index.js                   # Trang quản trị sản phẩm
│   |   |   ├── chatbot.js                 # Widget chatbot (nổi trên mọi trang)
│   |   |   ├── ratings.js                 # Xử lý đánh giá sao
│   |   |   ├── register-sw + notifications.js  # Đăng ký nhận push notification
│   |   |   └── components/
│   |   |   |   └── genreSelector.js       # Component chọn/quản lý thể loại
|   |   ├──sounds/
|   |   └──video/
|
│
├── server/                       # server Node.js (Express)
│   ├── index.js                   # Điểm khởi động server
│   ├── controllers/
│   │   ├── productsJsonController.js
│   │   ├── ragController.js       # Proxy sang RAG server (giấu API key)
│   │   ├── notifyController.js    # Gửi push notification
│   │   └── witController.js       # Proxy sang Wit.ai (giấu token)
│   ├── routes/
|   |   ├── notifyRoutes.js   # Gửi push notification cho wit.ai
│   │   ├── productsJsonRoutes.js   # Gửi các yêu cầu khác nhau để xử lý json
│   │   ├── ragRoutes.js            # Gửi yêu cầu khác nhau bao gồm (về hình ảnh và văn bảng)
│   │   └── syncRoutes.js 
│   ├── services/
│   │   └── productSyncService.js  # Đồng bộ Firestore -> products.json
│   └── utils/
│       ├── notify.js               # Gửi push notification (FCM)
│       └── cloudinary.js
│
└── agent/                          # Server AI (Python, RAG)
    ├── api_server.py               # FastAPI server (production)
    ├── chatbot.py                  # Class RAGChatbot (logic chính)
    ├── requirements-api.txt        # Thư viện cần cho deploy
    ├── evaluate_rag.ipynb          # Notebook đánh giá chất lượng chatbot
    ├── step0_enrich_covers.py      # Tạo mô tả ảnh bìa bằng Gemini Vision
    ├── step1_load.py               # (Học/test riêng lẻ) đọc + chia nhỏ dữ liệu
    ├── step2_embed_store.py         # (Học/test riêng lẻ) tạo embedding + FAISS
    ├── step3_retrieve.py            # (Học/test riêng lẻ) tìm kiếm
    ├── step4_generate.py            # (Học/test riêng lẻ) sinh câu trả lời
    ├── step5_image.py               # (Học/test riêng lẻ) gợi ý từ ảnh
    ├── data/
    │   ├── text/
    │   │   ├── products.json        # Dữ liệu sản phẩm (đồng bộ tự động)
    │   │   └── guideusers.txt       # Tài liệu hướng dẫn/FAQ
    │   └── img/                     # Ảnh bìa sách
    └── vector_store/                 # Cache FAISS đã build (commit vào git)
```

---

## Cài đặt & chạy local

### Backend Node.js
```bash
cd server
npm install
npm start
```

### Server AI (Python)
```bash
cd agent
python -m venv myvenv
myvenv\Scripts\Activate.ps1      # Windows
pip install -r requirements-api.txt

# Build vector store lần đầu (hoặc sau khi đổi dữ liệu)
python chatbot.py

# Chạy server
uvicorn api_server:app --reload --port 8000
```

### Frontend
Mở trực tiếp bằng Live Server (VS Code) hoặc bất kỳ static file server nào.

---

## Biến môi trường

**Backend Node.js (`.env`)**
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_SECRET_KEY=

FIREBASE_TYPE=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_CLIENT_ID=
FIREBASE_AUTH_URI=
FIREBASE_TOKEN_URI=
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=
FIREBASE_CLIENT_X509_CERT_URL=

RAG_API_KEY=...               # Phải khớp với .env bên Python
RAG_SERVER_URL=...            # URL server Python sau khi deploy
WIT_ACCESS_TOKEN=

```

**Server AI (`agent/.env`)**
```
GOOGLE_API_KEY=...            # Key gọi Gemini API
RAG_API_KEY=...               # Phải khớp với .env bên Node
```

> Không bao giờ commit file `.env` thật vào git — Chức năng thông báo(quan trọng)
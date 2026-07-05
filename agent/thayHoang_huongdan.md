# Xây Dựng RAG Chatbot Hỏi Đáp Tài Liệu

Chào các bạn,

Trong tài liệu này thầy sẽ hướng dẫn các bạn xây dựng một chatbot có khả năng trả lời câu hỏi dựa trên tài liệu do mình cung cấp. Không phải chatbot bịa đặt — mà là chatbot đọc tài liệu của bạn và trả lời từ đó.

Các bạn không cần biết AI hay Machine Learning. Chỉ cần biết Python cơ bản (biến, hàm, if/else, vòng lặp) và cách cài thư viện bằng `pip install` là đủ.

Thời gian để hoàn thành từ đầu đến cuối khoảng 3 đến 4 tiếng nếu các bạn làm từng bước một theo tài liệu này.

---

## Mục lục

1. [RAG là gì](#1-rag-là-gì)
2. [Hệ thống hoạt động như thế nào](#2-hệ-thống-hoạt-động-như-thế-nào)
3. [Chuẩn bị môi trường](#3-chuẩn-bị-môi-trường)
4. [Dữ liệu mẫu](#4-dữ-liệu-mẫu)
5. [Bước 1 — Đọc và chia nhỏ văn bản](#5-bước-1--đọc-và-chia-nhỏ-văn-bản)
6. [Bước 2+3 — Tạo Embedding và lưu Vector Store](#6-bước-23--tạo-embedding-và-lưu-vector-store)
7. [Bước 4 — Tìm đoạn văn liên quan](#7-bước-4--tìm-đoạn-văn-liên-quan)
8. [Bước 5 — Sinh câu trả lời](#8-bước-5--sinh-câu-trả-lời)
9. [Ghép tất cả thành chatbot hoàn chỉnh](#9-ghép-tất-cả-thành-chatbot-hoàn-chỉnh)
10. [Giao diện web với Streamlit](#10-giao-diện-web-với-streamlit)
11. [Thứ tự chạy và kiểm tra](#11-thứ-tự-chạy-và-kiểm-tra)
12. [Các lỗi thường gặp](#12-các-lỗi-thường-gặp)
13. [Tóm tắt toàn bộ pipeline](#13-tóm-tắt-toàn-bộ-pipeline)
14. [Nâng cấp tiếp theo](#14-nâng-cấp-tiếp-theo)

---

## 1. RAG là gì

### Vấn đề ban đầu

Hãy thử hỏi ChatGPT: *"Trong tài liệu nội bộ của công ty mình, quy trình xin nghỉ phép là thế nào?"*

ChatGPT sẽ trả lời... bịa. Vì nó chưa đọc tài liệu đó bao giờ. Nó không có cách nào biết được.

RAG sinh ra để giải quyết đúng chỗ này.

---

### RAG hoạt động thế nào

**Không có RAG:**
```
Người dùng: "Trong sách X, tác giả nói gì về thói quen buổi sáng?"
AI: (chưa đọc sách X, nhưng vẫn bịa ra câu trả lời) "Tác giả nói..."
    -> Không đáng tin cậy
```

**Có RAG:**
```
Người dùng: "Trong sách X, tác giả nói gì về thói quen buổi sáng?"

Hệ thống RAG:
  1. Tìm trong sách X các đoạn nói về "thói quen buổi sáng"
  2. Đưa các đoạn đó cho AI đọc
  3. AI đọc xong rồi trả lời DỰA TRÊN đó

    -> Chính xác, có nguồn gốc rõ ràng
```

**RAG = Retrieval-Augmented Generation**

- **Retrieval** — Tìm kiếm (tìm đoạn văn liên quan trong tài liệu)
- **Augmented** — Bổ sung (đưa đoạn văn đó vào làm ngữ cảnh)
- **Generation** — Sinh câu trả lời (AI đọc ngữ cảnh và trả lời)

---

### So sánh nhanh

| Tình huống | Không có RAG | Có RAG |
|---|---|---|
| Hỏi về tài liệu nội bộ | Bịa | Chính xác |
| Hỏi về sách mới ra tháng trước | Không biết | Có nếu cung cấp |
| Trích dẫn nguồn | Không được | Biết đoạn nào |

---

## 2. Hệ thống hoạt động như thế nào

Hệ thống có 2 giai đoạn tách biệt nhau. Các bạn cần hiểu rõ hai giai đoạn này trước khi đọc code, nếu không sẽ rất dễ bị rối.

### Giai đoạn 1: Chuẩn bị (chỉ làm 1 lần)

```
Tài liệu (.txt / .pdf / .docx)
        |
        v
+---------------------+
|  1. ĐỌC VĂN BẢN    |  TextLoader, PyPDFLoader, Docx2txtLoader
|     (step1_load.py) |
+----------+----------+
           |
           v
+---------------------+
|  2. CHIA THÀNH      |  Mỗi đoạn khoảng 500 ký tự, gọi là "chunk"
|     CÁC ĐOẠN NHỎ   |
|     (step1_load.py) |
+----------+----------+
           |
           v
+---------------------+
|  3. CHUYỂN THÀNH    |  Mỗi đoạn chữ -> dãy số [0.2, -0.8, ...]
|     SỐ (EMBEDDING)  |  Gọi API Google: gemini-embedding-001
|  (step2_embed.py)   |
+----------+----------+
           |
           v
+---------------------+
|  4. LƯU VÀO KHO    |  Thư mục vector_store/ trên máy các bạn
|     (VECTOR STORE)  |  Dùng FAISS (chạy offline, miễn phí)
|  (step2_embed.py)   |
+---------------------+
```

### Giai đoạn 2: Trả lời (mỗi khi có câu hỏi)

```
Người dùng hỏi: "Thói quen buổi sáng của người thành công?"
        |
        v
+---------------------+
|  1. CHUYỂN CÂU HỎI |  "Thói quen buổi sáng..." -> [0.3, -0.7, ...]
|     THÀNH SỐ        |
+----------+----------+
           |
           v
+---------------------+
|  2. TÌM KIẾM        |  So sánh số câu hỏi với số từng đoạn văn
|     ĐOẠN LIÊN QUAN  |  Lấy 3 đoạn "gần nhất" = liên quan nhất
|  (step3_retrieve.py)|
+----------+----------+
           |
           v
+---------------------+
|  3. GHÉP VÀO PROMPT |  "Dựa vào: [đoạn 1]...[đoạn 2]...
|                     |   Hãy trả lời: Thói quen buổi sáng?"
+----------+----------+
           |
           v
+---------------------+
|  4. GEMINI TRẢ LỜI  |  Đọc đoạn văn được cung cấp -> trả lời
|  (step4_generate.py)|
+----------+----------+
           |
           v
  Câu trả lời có trích dẫn nguồn
```

> **Điểm quan trọng cần nhớ:** AI không "nhớ" tài liệu của các bạn theo nghĩa học thuộc. Mỗi lần hỏi, hệ thống đều đi tìm lại đoạn liên quan rồi đưa cho AI đọc tại chỗ. Đây chính là lý do RAG chính xác hơn so với cách để AI tự trả lời.

---

## 3. Chuẩn bị môi trường

### 3.1 Kiểm tra phiên bản Python

Mở Terminal (PowerShell trên Windows) và chạy:

```bash
python --version
```

Kết quả mong đợi:
```
Python 3.12.x
```

Dự án này dùng `faiss-cpu` — một thư viện C extension. Nó có wheel sẵn cho Python 3.10, 3.11, 3.12. **Python 3.13 trở lên chưa có wheel sẵn**, vì vậy các bạn cần dùng Python 3.12.

Nếu chưa có Python, tải tại python.org và nhớ tick vào **"Add to PATH"** khi cài.

---

### 3.2 Tạo thư mục dự án

```bash
mkdir rag-chatbot
cd rag-chatbot
```

---

### 3.3 Tạo môi trường ảo

Môi trường ảo giống như một "phòng riêng" cho dự án. Thư viện cài vào đây không ảnh hưởng đến các dự án Python khác trên máy.

```bash
# Tạo môi trường ảo
python -m venv venv

# Kích hoạt (Windows PowerShell)
venv\Scripts\activate

# Kích hoạt (Mac/Linux)
source venv/bin/activate
```

Sau khi kích hoạt thành công, các bạn sẽ thấy `(venv)` xuất hiện ở đầu dòng lệnh:
```
(venv) PS C:\rag-chatbot>
```

---

### 3.4 Cấu trúc thư mục

Tạo thư mục `data`:

```bash
mkdir data
```

Cấu trúc cuối cùng của dự án:

```
rag-chatbot/
├── data/
│   └── sach_mau.txt          <- Tài liệu mẫu
├── vector_store/             <- Tự tạo sau bước 2 (không tạo tay)
├── venv/                     <- Môi trường ảo (không cần đụng vào)
├── step1_load.py             <- Bước 1: đọc và chia văn bản
├── step2_embed_store.py      <- Bước 2+3: embedding và lưu trữ
├── step3_retrieve.py         <- Bước 4: tìm kiếm
├── step4_generate.py         <- Bước 5: sinh câu trả lời
├── chatbot.py                <- Ghép tất cả lại thành class
├── app.py                    <- Giao diện web Streamlit
├── check_models.py           <- Kiểm tra model embedding có sẵn
├── .env                      <- API key (không chia sẻ file này)
└── requirements.txt          <- Danh sách thư viện cần cài
```

---

### 3.5 Tạo `requirements.txt` và cài thư viện

Tạo file `requirements.txt` với nội dung sau:

```
langchain>=0.3.0
langchain-google-genai>=2.0.0
langchain-community>=0.3.0
langchain-text-splitters>=0.3.0
pypdf>=4.3.1
docx2txt>=0.8
faiss-cpu>=1.12.0
pillow>=11.0.0
streamlit>=1.40.0
python-dotenv>=1.0.1
```

Cài đặt:

```bash
pip install -r requirements.txt
```

Bước này mất khoảng 3-5 phút tùy tốc độ mạng. Nếu thấy lỗi `pip is not recognized`, kiểm tra lại môi trường ảo đã được kích hoạt chưa — phải có `(venv)` ở đầu dòng.

---

### 3.6 Lấy API Key Google Gemini (miễn phí)

1. Truy cập `aistudio.google.com/app/apikey`
2. Đăng nhập bằng tài khoản Google
3. Nhấn **"Create API Key"** rồi chọn **"Create API key in new project"**
4. Copy key (dạng `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

Tạo file `.env` trong thư mục dự án:

```
GOOGLE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

File `.env` chứa key bí mật. Tuyệt đối không commit lên GitHub hay gửi cho ai. Tạo file `.gitignore` với nội dung `.env` để bảo vệ.

Kiểm tra key hoạt động:

```bash
python -c "
from dotenv import load_dotenv
import os
load_dotenv()
key = os.getenv('GOOGLE_API_KEY')
print('Key tim thay:', key[:10] + '...' if key else 'KHONG TIM THAY!')
"
```

Kết quả mong đợi:
```
Key tim thay: AIzaSyXXXX...
```

---

## 4. Dữ liệu mẫu

Tạo file `data/sach_mau.txt`. Đây là tài liệu mẫu để các bạn test chatbot. Sau khi hiểu cách hoạt động rồi, các bạn có thể thay bằng file PDF hoặc Word thật của mình.

```
NHỮNG THÓI QUEN CỦA NGƯỜI THÀNH CÔNG
Tổng hợp từ nghiên cứu và sách kỹ năng sống

CHƯƠNG 1: THÓI QUEN BUỔI SÁNG

Thói quen buổi sáng là nền tảng của một ngày thành công. Nghiên cứu trên
hàng trăm CEO và người thành công cho thấy 90% trong số họ dậy trước 6 giờ
sáng. Không phải vì họ không cần ngủ, mà vì buổi sáng sớm là thời điểm
yên tĩnh nhất để làm việc sâu mà không bị gián đoạn.

Thói quen buổi sáng hiệu quả thường gồm 5 yếu tố:
1. Dậy đúng giờ, không nhấn nút báo thức lần hai (snooze)
2. Uống 1-2 ly nước ngay khi thức dậy để cơ thể tỉnh táo
3. Vận động nhẹ 10-20 phút (đi bộ, yoga, hoặc stretching)
4. Thiền hoặc thực hành chánh niệm 5-10 phút
5. Xem xét mục tiêu và kế hoạch trong ngày

Hal Elrod, tác giả cuốn "The Miracle Morning", gọi đây là phương pháp SAVERS:
- S (Silence): Im lặng, thiền định
- A (Affirmations): Khẳng định tích cực
- V (Visualization): Hình dung mục tiêu
- E (Exercise): Tập thể dục
- R (Reading): Đọc sách
- S (Scribing): Viết nhật ký

CHƯƠNG 2: SỨC MẠNH CỦA THÓI QUEN

Theo nghiên cứu của Đại học Duke, khoảng 40% hành động hàng ngày của chúng
ta không phải là quyết định có ý thức mà là thói quen.

Charles Duhigg trong cuốn "The Power of Habit" giải thích vòng lặp thói quen:
- Gợi nhắc (Cue): Tác nhân kích hoạt thói quen
- Thói quen (Routine): Hành động được thực hiện
- Phần thưởng (Reward): Lợi ích nhận được

Để tạo thói quen mới, chuyên gia tâm lý học khuyên:
1. Bắt đầu cực kỳ nhỏ: Muốn tập thể dục? Bắt đầu với 2 phút mỗi ngày
2. Gắn vào thói quen có sẵn: "Sau khi pha cà phê, tôi sẽ đọc sách 10 phút"
3. Tạo môi trường thuận lợi: Để sách trên bàn thay vì trong ngăn kéo
4. Theo dõi chuỗi ngày liên tiếp (habit streak)

CHƯƠNG 3: QUẢN LÝ THỜI GIAN HIỆU QUẢ

Warren Buffett từng nói: "Sự khác biệt giữa người thành công và người rất
thành công là người rất thành công nói không với hầu hết mọi thứ."

Kỹ thuật quản lý thời gian phổ biến nhất là ma trận Eisenhower:
- Quan trọng + Khẩn cấp: Làm ngay
- Quan trọng + Không khẩn cấp: Lên lịch và làm (đây là ô quan trọng nhất!)
- Không quan trọng + Khẩn cấp: Ủy thác cho người khác
- Không quan trọng + Không khẩn cấp: Loại bỏ

Phương pháp Pomodoro giúp tập trung sâu:
1. Chọn 1 nhiệm vụ cụ thể
2. Đặt hẹn giờ 25 phút, tập trung 100%
3. Nghỉ 5 phút
4. Sau 4 vòng Pomodoro, nghỉ dài 15-30 phút

CHƯƠNG 4: TƯ DUY PHÁT TRIỂN (GROWTH MINDSET)

Carol Dweck, giáo sư Đại học Stanford, phân chia con người thành 2 nhóm:

Tư duy cố định (Fixed Mindset):
- Tin rằng tài năng là bẩm sinh, không thể thay đổi
- Tránh thử thách vì sợ thất bại
- Coi thất bại là bằng chứng của sự thiếu năng lực

Tư duy phát triển (Growth Mindset):
- Tin rằng khả năng có thể được phát triển qua nỗ lực
- Đón nhận thử thách như cơ hội học hỏi
- Coi thất bại là phản hồi để cải thiện

Thay vì "Tôi không giỏi điều này" -> "Tôi chưa giỏi điều này... YET"

CHƯƠNG 5: SỨC KHỎE LÀ NỀN TẢNG

Ngủ đủ giấc (7-9 tiếng):
- Tăng khả năng tập trung và ghi nhớ lên 40%
- Giảm nguy cơ mắc bệnh tim, tiểu đường, béo phì

Tập thể dục đều đặn:
- 150 phút hoạt động cường độ vừa mỗi tuần là mức tối thiểu
- Ngay cả đi bộ 30 phút mỗi ngày cũng đủ để thấy tác dụng

Dinh dưỡng:
- Ăn đủ protein (1.6-2.2g/kg cân nặng) để duy trì cơ bắp và năng lượng
- Uống đủ nước (2-3 lít mỗi ngày)
```

---

## 5. Bước 1 — Đọc và chia nhỏ văn bản

### Tại sao phải chia nhỏ?

AI có giới hạn về số từ có thể xử lý cùng lúc (gọi là "context window"). Các bạn không thể nhét cả cuốn sách 300 trang vào một câu hỏi.

Giải pháp là chia sách thành nhiều đoạn nhỏ, mỗi đoạn khoảng 500 ký tự. Khi có câu hỏi, chỉ lấy ra 3-5 đoạn liên quan nhất rồi đưa cho AI đọc.

**Overlap là gì?** Khi chia đoạn, các đoạn liền kề "chồng lên nhau" một chút:

```
Đoạn 1: ký tự 1   -> ký tự 500
Đoạn 2: ký tự 450 -> ký tự 950   <- 50 ký tự cuối đoạn 1 lặp lại
Đoạn 3: ký tự 900 -> ký tự 1400
```

Thầy dùng overlap để tránh trường hợp cắt đúng giữa một câu quan trọng — câu đó sẽ bị mất ngữ cảnh ở cả hai đoạn.

---

### Code: `step1_load.py`

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader, PyPDFLoader
import os


def doc_load(file_path: str):
    extension = os.path.splitext(file_path)[1].lower()

    if extension == ".txt":
        loader = TextLoader(file_path, encoding="utf-8")
    elif extension == ".pdf":
        loader = PyPDFLoader(file_path)
    else:
        raise ValueError(f"Dinh dang file '{extension}' chua duoc ho tro. Dung .txt hoac .pdf")

    documents = loader.load()
    print(f"Doc thanh cong: {len(documents)} phan tu file '{file_path}'")
    return documents


def split_documents(documents, chunk_size=500, chunk_overlap=50):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ".", "!", "?", ",", " "]
    )

    chunks = splitter.split_documents(documents)

    print(f"Chia xong: {len(chunks)} doan")
    print(f"   Vi du doan dau tien ({len(chunks[0].page_content)} ky tu):")
    print(f"   '{chunks[0].page_content[:150]}...'")

    return chunks


if __name__ == "__main__":
    print("=" * 50)
    print("BUOC 1: DOC VA CHIA NHO VAN BAN")
    print("=" * 50)

    docs = doc_load("data/sach_mau.txt")
    chunks = split_documents(docs)

    print(f"\nTong ket:")
    print(f"   - So doan tao ra: {len(chunks)}")
    print(f"   - Doan ngan nhat: {min(len(c.page_content) for c in chunks)} ky tu")
    print(f"   - Doan dai nhat:  {max(len(c.page_content) for c in chunks)} ky tu")

    print(f"\n3 doan dau tien:")
    for i, chunk in enumerate(chunks[:3]):
        print(f"\n--- Doan {i+1} ---")
        print(chunk.page_content[:200])
        print("...")
```

### Giải thích `RecursiveCharacterTextSplitter`

Thầy dùng `RecursiveCharacterTextSplitter` thay vì cắt thẳng theo số ký tự vì nó thông minh hơn: nó ưu tiên cắt tại đoạn văn (`\n\n`) trước, nếu đoạn vẫn quá dài thì mới cắt tại xuống dòng (`\n`), rồi mới cắt tại dấu chấm câu. Nhờ vậy văn bản ít bị cắt ngang giữa câu.

### Chạy thử

```bash
python step1_load.py
```

Kết quả mong đợi:

```
==================================================
BUOC 1: DOC VA CHIA NHO VAN BAN
==================================================
Doc thanh cong: 1 phan tu file 'data/sach_mau.txt'
Chia xong: 16 doan
   Vi du doan dau tien (487 ky tu):
   'NHUNG THOI QUEN CUA NGUOI THANH CONG...'

Tong ket:
   - So doan tao ra: 16
   - Doan ngan nhat: 98 ky tu
   - Doan dai nhat:  500 ky tu
```

> Nếu sách có 300 trang, mỗi trang ~1000 ký tự, với `chunk_size=500` thì tạo ra khoảng 600 đoạn.

---

## 6. Bước 2+3 — Tạo Embedding và lưu Vector Store

### Embedding là gì?

Máy tính không "hiểu" chữ nhưng rất giỏi so sánh số. Embedding là quá trình chuyển đoạn chữ thành một dãy số — quan trọng là những đoạn có nghĩa gần nhau sẽ cho ra dãy số gần nhau:

```
"Thói quen buổi sáng"    -> [0.20,  0.80, -0.30, 0.50, ...]
"Thức dậy sớm mỗi ngày"  -> [0.21,  0.79, -0.28, 0.52, ...]  <- rất gần!
"Công thức nấu phở"      -> [-0.50, 0.10,  0.90, -0.20, ...] <- rất xa!
```

Khi các bạn hỏi một câu, câu hỏi cũng được chuyển thành số theo cùng cách đó. Hệ thống tìm những đoạn văn có số "gần nhất" với câu hỏi — đó chính là những đoạn liên quan nhất.

### FAISS là gì?

FAISS (Facebook AI Similarity Search) là một thư viện tìm kiếm nhanh cho vector. Thầy chọn FAISS vì nó chạy hoàn toàn trên máy của các bạn, không cần server, miễn phí 100%, và đủ nhanh cho vài nghìn đoạn văn.

---

### Code: `step2_embed_store.py`

```python
import os
from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from step1_load import doc_load, split_documents


def create_embedding_model():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("Khong tim thay GOOGLE_API_KEY trong file .env!")

    embedding_model = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key
    )

    print("Tao embedding model thanh cong")
    return embedding_model


def build_vector_store(chunks, embedding_model):
    print(f"Dang tao embedding cho {len(chunks)} doan van...")
    print("   (Buoc nay goi API Google, co the mat 1-2 phut)")

    vector_store = FAISS.from_documents(
        documents=chunks,
        embedding=embedding_model
    )

    print(f"Tao vector store thanh cong!")
    print(f"   Da luu {len(chunks)} doan van vao bo nho")

    return vector_store


def save_vector_store(vector_store, save_path="vector_store"):
    vector_store.save_local(save_path)
    print(f"Da luu vector store vao thu muc '{save_path}/'")


def load_vector_store(embedding_model, load_path="vector_store"):
    if not os.path.exists(load_path):
        raise FileNotFoundError(
            f"Khong tim thay vector store tai '{load_path}'. "
            "Hay chay step2_embed_store.py truoc!"
        )

    vector_store = FAISS.load_local(
        load_path,
        embedding_model,
        allow_dangerous_deserialization=True
    )

    print(f"Nap vector store thanh cong tu '{load_path}/'")
    return vector_store


if __name__ == "__main__":
    print("=" * 50)
    print("BUOC 2+3: TAO EMBEDDING VA LUU VAO VECTOR STORE")
    print("=" * 50)

    print("\n[1/3] Doc va chia van ban...")
    docs = doc_load("data/sach_mau.txt")
    chunks = split_documents(docs)

    print("\n[2/3] Tao embedding model...")
    embedding_model = create_embedding_model()

    print("\n[3/3] Tao va luu vector store...")
    vector_store = build_vector_store(chunks, embedding_model)
    save_vector_store(vector_store)

    print("\nHoan thanh! Bay gio co the chay buoc tiep theo.")
    print("   Thu muc 'vector_store/' da duoc tao.")
```

### Tại sao phải lưu vector store?

Tạo embedding tốn thời gian và tốn quota API. Lưu ra ổ cứng để lần sau chỉ cần load lại trong vài giây thay vì tạo lại từ đầu. Thư mục `vector_store/` sau khi tạo xong chính là "bộ não" của chatbot.

### Chạy thử

```bash
python step2_embed_store.py
```

Kết quả mong đợi:

```
==================================================
BUOC 2+3: TAO EMBEDDING VA LUU VAO VECTOR STORE
==================================================

[1/3] Doc va chia van ban...
Doc thanh cong: 1 phan tu file 'data/sach_mau.txt'
Chia xong: 16 doan

[2/3] Tao embedding model...
Tao embedding model thanh cong

[3/3] Tao va luu vector store...
Dang tao embedding cho 16 doan van...
   (Buoc nay goi API Google, co the mat 1-2 phut)
Tao vector store thanh cong!
   Da luu 16 doan van vao bo nho
Da luu vector store vao thu muc 'vector_store/'

Hoan thanh! Bay gio co the chay buoc tiep theo.
   Thu muc 'vector_store/' da duoc tao.
```

---

## 7. Bước 4 — Tìm đoạn văn liên quan

Khi người dùng hỏi, hệ thống cần tìm 3-5 đoạn văn liên quan nhất trong vector store.

Cách tìm: chuyển câu hỏi thành vector số (dùng cùng embedding model), so sánh với tất cả vector trong kho, trả về các đoạn có vector "gần nhất".

**Về score:** FAISS trả về **khoảng cách** (distance), không phải điểm tương đồng:
- Score nhỏ = đoạn văn **rất liên quan**
- Score lớn = đoạn văn **ít liên quan**

---

### Code: `step3_retrieve.py`

```python
import os
from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from step2_embed_store import load_vector_store, create_embedding_model


def search_relevant_chunks(vector_store, query: str, top_k: int = 3):
    print(f"Tim kiem cho cau hoi: '{query}'")

    results = vector_store.similarity_search_with_score(
        query=query,
        k=top_k
    )

    print(f"Tim duoc {len(results)} doan lien quan:")

    for i, (doc, score) in enumerate(results):
        print(f"\n  Doan {i+1} (score: {score:.4f} - cang nho cang lien quan):")
        print(f"  '{doc.page_content[:200]}...'")

    return results


def format_context(search_results) -> str:
    context_parts = []

    for i, (doc, score) in enumerate(search_results):
        part = f"[Doan {i+1}]\n{doc.page_content}"
        context_parts.append(part)

    context = "\n\n---\n\n".join(context_parts)
    return context


if __name__ == "__main__":
    print("=" * 50)
    print("BUOC 4: TIM KIEM DOAN VAN LIEN QUAN")
    print("=" * 50)

    print("\nNap vector store...")
    embedding_model = create_embedding_model()
    vector_store = load_vector_store(embedding_model)

    test_queries = [
        "Thoi quen buoi sang cua nguoi thanh cong la gi?",
        "Lam sao de quan ly thoi gian hieu qua?",
        "Growth mindset la gi?",
    ]

    for query in test_queries:
        print(f"\n{'='*50}")
        results = search_relevant_chunks(vector_store, query, top_k=2)

        context = format_context(results)
        print(f"\nContext se dua vao Gemini:")
        print(context[:400] + "...")
```

### Chạy thử

```bash
python step3_retrieve.py
```

Kết quả mong đợi:

```
==================================================
BUOC 4: TIM KIEM DOAN VAN LIEN QUAN
==================================================

Nap vector store...
Tao embedding model thanh cong
Nap vector store thanh cong tu 'vector_store/'

==================================================
Tim kiem cho cau hoi: 'Thoi quen buoi sang cua nguoi thanh cong la gi?'
Tim duoc 2 doan lien quan:

  Doan 1 (score: 0.3412 - cang nho cang lien quan):
  'CHUONG 1: THOI QUEN BUOI SANG...'
```

---

## 8. Bước 5 — Sinh câu trả lời

Đây là bước cuối: đưa context (các đoạn văn tìm được) và câu hỏi vào Gemini để sinh câu trả lời.

### Tại sao cần prompt template?

Nếu chỉ hỏi Gemini "thói quen buổi sáng là gì?" mà không kèm tài liệu, nó sẽ trả lời từ kiến thức chung của nó. Bằng cách dùng prompt template có `{context}` và dặn rõ *"chỉ dùng thông tin này"*, các bạn ép Gemini trả lời từ tài liệu của mình.

### LCEL — cách viết chain trong LangChain mới

Từ LangChain 0.3 trở đi, cách tạo chain là dùng **pipe operator** `|`:

```
prompt | llm | StrOutputParser()
   |        |         |
   |        |         +-- Chuyển output thành string thuần
   |        +-- Đưa vào Gemini -> nhận AIMessage
   +-- Điền {context} và {question} -> nhận PromptValue
```

Cú pháp này thay thế `LLMChain` cũ đã bị xóa trong LangChain 0.3+.

---

### Code: `step4_generate.py`

```python
import os
from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser


def create_llm():
    llm = ChatGoogleGenerativeAI(
        model="gemini-flash-lite-latest",
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=0.1
    )
    print("Ket noi Gemini thanh cong")
    return llm


def create_qa_chain(llm):
    template = """Ban la tro ly AI thong minh, chuyen tra loi cau hoi dua tren tai lieu duoc cung cap.

THONG TIN TU TAI LIEU:
{context}

CAU HOI: {question}

HUONG DAN TRA LOI:
- Tra loi DUA TREN thong tin trong tai lieu o tren
- Trich dan hoac de cap den phan tai lieu ban dung
- Neu tai lieu khong co du thong tin, hay noi thang: "Tai lieu khong co thong tin ve van de nay"
- Tra loi bang tieng Viet, ro rang va de hieu
- Khong bia them thong tin ngoai tai lieu

TRA LOI:"""

    prompt = PromptTemplate(
        input_variables=["context", "question"],
        template=template
    )

    chain = prompt | llm | StrOutputParser()
    return chain


def answer_question(chain, context: str, question: str) -> str:
    print("Gemini dang doc tai lieu va tra loi...")

    result = chain.invoke({"context": context, "question": question})
    return result


if __name__ == "__main__":
    print("=" * 50)
    print("BUOC 5: SINH CAU TRA LOI VOI GEMINI")
    print("=" * 50)

    from step2_embed_store import create_embedding_model, load_vector_store
    from step3_retrieve import search_relevant_chunks, format_context

    print("\nChuan bi he thong...")
    embedding_model = create_embedding_model()
    vector_store = load_vector_store(embedding_model)
    llm = create_llm()
    chain = create_qa_chain(llm)

    questions = [
        "Phuong phap SAVERS trong thoi quen buoi sang gom nhung gi?",
        "Tu duy phat trien (Growth Mindset) khac tu duy co dinh o diem nao?",
        "Ky thuat Pomodoro hoat dong nhu the nao?",
    ]

    for question in questions:
        print(f"\n{'='*50}")
        print(f"Cau hoi: {question}")

        results = search_relevant_chunks(vector_store, question, top_k=3)
        context = format_context(results)

        answer = answer_question(chain, context, question)

        print(f"\nCau tra loi:")
        print(answer)
        print()
```

### Về `temperature`

| Giá trị | Ý nghĩa | Dùng khi nào |
|---|---|---|
| `0.0` | Luôn chọn câu trả lời chắc chắn nhất | Q&A cần nhất quán |
| `0.1` | Ưu tiên chính xác, ít sáng tạo | Q&A tài liệu (thầy dùng ở đây) |
| `0.7` | Sáng tạo, đa dạng | Viết nội dung, brainstorm |
| `1.0` | Tối đa sáng tạo | Thơ, truyện |

### Chạy thử

```bash
python step4_generate.py
```

Kết quả mong đợi:

```
Cau hoi: Phuong phap SAVERS trong thoi quen buoi sang gom nhung gi?

Cau tra loi:
Dua tren tai lieu, phuong phap SAVERS cua Hal Elrod bao gom:

- S (Silence): Im lang, thien dinh
- A (Affirmations): Khang dinh tich cuc
- V (Visualization): Hinh dung muc tieu
- E (Exercise): Tap the duc
- R (Reading): Doc sach
- S (Scribing): Viet nhat ky
```

---

## 9. Ghép tất cả thành chatbot hoàn chỉnh

Bây giờ thầy ghép 5 bước trên vào một class duy nhất. File này cũng hỗ trợ thêm định dạng `.docx` cho tiện.

### Code: `chatbot.py`

```python
import os
from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader, PyPDFLoader, Docx2txtLoader


class RAGChatbot:
    """Chatbot hoi dap tai lieu dung RAG."""

    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("Khong tim thay GOOGLE_API_KEY trong file .env!")

        self.embedding_model = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=api_key
        )

        self.llm = ChatGoogleGenerativeAI(
            model="gemini-flash-lite-latest",
            google_api_key=api_key,
            temperature=0.1
        )

        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=["\n\n", "\n", ".", "!", "?", ",", " "]
        )

        self.prompt = PromptTemplate(
            input_variables=["context", "question"],
            template="""Ban la tro ly AI thong minh, chuyen tra loi cau hoi dua tren tai lieu.

THONG TIN TU TAI LIEU:
{context}

CAU HOI: {question}

HUONG DAN:
- Tra loi DUA TREN thong tin trong tai lieu o tren
- Neu tai lieu khong du thong tin, hay noi: "Tai lieu khong co thong tin ve van de nay"
- Tra loi bang tieng Viet, ro rang va de hieu
- Khong bia them thong tin ngoai tai lieu

TRA LOI:"""
        )

        self.chain = self.prompt | self.llm | StrOutputParser()
        self.vector_store = None

        print("RAGChatbot khoi tao thanh cong!")

    def load_documents(self, file_path: str, force_rebuild: bool = False):
        """Nap tai lieu va xay dung vector store.

        force_rebuild=False: dung cache neu co (nhanh, tiet kiem API quota)
        force_rebuild=True:  xoa cache va tao lai tu dau
        """
        cache_path = "vector_store"

        if os.path.exists(cache_path) and not force_rebuild:
            print("Tim thay vector store cache. Dang nap...")
            self.vector_store = FAISS.load_local(
                cache_path,
                self.embedding_model,
                allow_dangerous_deserialization=True
            )
            print("Nap vector store tu cache thanh cong!")
            return

        print(f"Dang doc file: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".txt":
            loader = TextLoader(file_path, encoding="utf-8")
        elif ext == ".pdf":
            loader = PyPDFLoader(file_path)
        elif ext == ".docx":
            loader = Docx2txtLoader(file_path)
        else:
            raise ValueError(f"Dinh dang '{ext}' chua ho tro. Dung .txt, .pdf hoac .docx")

        documents = loader.load()

        print("Chia van ban thanh doan nho...")
        chunks = self.splitter.split_documents(documents)
        print(f"   -> Tao ra {len(chunks)} doan")

        print("Dang tao embedding (goi Gemini API)...")
        self.vector_store = FAISS.from_documents(chunks, self.embedding_model)

        self.vector_store.save_local(cache_path)
        print(f"Hoan thanh! Da luu cache vao '{cache_path}/'")

    def ask(self, question: str, top_k: int = 3) -> dict:
        """Tra loi cau hoi dua tren tai lieu da nap.

        Tra ve dict voi hai key:
          "answer"  : cau tra loi (string)
          "sources" : list cac doan van da dung de tra loi
        """
        if self.vector_store is None:
            return {
                "answer": "Chua nap tai lieu! Hay goi load_documents() truoc.",
                "sources": []
            }

        results = self.vector_store.similarity_search_with_score(question, k=top_k)

        context_parts = [f"[Doan {i+1}]\n{doc.page_content}"
                        for i, (doc, _) in enumerate(results)]
        context = "\n\n---\n\n".join(context_parts)

        result = self.chain.invoke({"context": context, "question": question})

        return {
            "answer": result,
            "sources": [doc.page_content for doc, _ in results]
        }


if __name__ == "__main__":
    print("=" * 55)
    print("  RAG CHATBOT - HOI DAP TAI LIEU")
    print("=" * 55)

    bot = RAGChatbot()
    bot.load_documents("data/sach_mau.txt")

    print("\nChatbot san sang! Go 'quit' de thoat.\n")

    while True:
        question = input("Cau hoi cua ban: ").strip()

        if question.lower() in ["quit", "exit", "thoat", "q"]:
            print("Tam biet!")
            break

        if not question:
            print("   (Vui long nhap cau hoi)")
            continue

        print("\nDang tim kiem va tra loi...")
        result = bot.ask(question)

        print(f"\nTra loi:")
        print(result["answer"])

        show_source = input("\nXem doan van nguon? (y/n): ").strip().lower()
        if show_source == "y":
            print("\nCac doan van da dung de tra loi:")
            for i, source in enumerate(result["sources"], 1):
                print(f"\n  [Doan {i}]")
                print(f"  {source[:300]}...")

        print("\n" + "-" * 55 + "\n")
```

### Chạy chatbot trong terminal

```bash
python chatbot.py
```

---

## 10. Giao diện web với Streamlit

Thêm giao diện web bằng Streamlit — các bạn không cần biết HTML hay CSS.

### Code: `app.py`

```python
import streamlit as st
import os

from chatbot import RAGChatbot

st.set_page_config(
    page_title="RAG Chatbot - Hoi Dap Tai Lieu",
    layout="centered"
)

# Session state giu du lieu giua cac lan render cua Streamlit.
# Moi khi nguoi dung click hoac go phim, Streamlit render lai toan bo app,
# neu khong co session_state thi moi bien se bi reset ve None.
if "chatbot" not in st.session_state:
    st.session_state.chatbot = None
if "messages" not in st.session_state:
    st.session_state.messages = []
if "doc_loaded" not in st.session_state:
    st.session_state.doc_loaded = False

# Sidebar
with st.sidebar:
    st.title("RAG Chatbot")
    st.caption("Hoi dap tai lieu voi Gemini AI")
    st.divider()

    st.subheader("Tai lieu")
    doc_source = st.radio(
        "Chon nguon tai lieu:",
        options=["Dung file mau co san", "Upload file cua toi"]
    )

    uploaded_file = None
    if doc_source == "Upload file cua toi":
        uploaded_file = st.file_uploader(
            "Chon file",
            type=["txt", "pdf", "docx"],
            help="Ho tro .txt, .pdf, .docx"
        )
        if uploaded_file:
            st.caption(f"{uploaded_file.name} - {uploaded_file.size // 1024} KB")

    if st.button("Nap Tai Lieu", type="primary", use_container_width=True):
        with st.spinner("Dang xu ly tai lieu..."):
            try:
                if st.session_state.chatbot is None:
                    st.session_state.chatbot = RAGChatbot()

                if doc_source == "Dung file mau co san":
                    file_path = "data/sach_mau.txt"
                    if not os.path.exists(file_path):
                        st.error("Khong tim thay data/sach_mau.txt")
                        st.stop()
                    st.session_state.chatbot.load_documents(file_path)
                else:
                    if uploaded_file is None:
                        st.warning("Hay chon file truoc khi nhan Nap.")
                        st.stop()
                    temp_path = f"data/temp_{uploaded_file.name}"
                    with open(temp_path, "wb") as f:
                        f.write(uploaded_file.read())
                    st.session_state.chatbot.load_documents(temp_path, force_rebuild=True)

                st.session_state.doc_loaded = True
                st.success("Nap tai lieu thanh cong!")

            except Exception as e:
                st.error(f"Loi: {str(e)}")

    st.divider()

    if st.session_state.doc_loaded:
        st.success("San sang tra loi")
    else:
        st.warning("Chua nap tai lieu")

    if st.button("Xoa lich su chat", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

    st.divider()

    st.subheader("Cau hoi goi y")
    suggestions = [
        "Thoi quen buoi sang SAVERS gom nhung gi?",
        "Vong lap thoi quen hoat dong nhu the nao?",
        "Ma tran Eisenhower chia cong viec the nao?",
        "Growth Mindset va Fixed Mindset khac nhau ra sao?",
        "Tap the duc bao nhieu phut moi tuan?",
    ]
    for s in suggestions:
        if st.button(s, key=f"sug_{s[:18]}", use_container_width=True):
            st.session_state["prefill"] = s
            st.rerun()

# Main area
st.title("Hoi Dap Tai Lieu")
st.caption("Chatbot tra loi dua tren noi dung tai lieu ban cung cap — khong bia dat, co nguon ro rang.")
st.divider()

if not st.session_state.doc_loaded and not st.session_state.messages:
    st.info(
        "**Huong dan bat dau:**\n\n"
        "1. Sidebar ben trai — chon **Dung file mau** hoac **Upload file cua toi**\n"
        "2. Nhan **Nap Tai Lieu** va cho xu ly (10-30 giay)\n"
        "3. Dat cau hoi ben duoi\n\n"
        "Ho tro dinh dang: .txt, .pdf, .docx"
    )

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])
        if msg["role"] == "assistant" and "sources" in msg:
            with st.expander("Xem doan van tham khao"):
                for i, src in enumerate(msg["sources"], 1):
                    st.markdown(f"**Doan {i}:**")
                    st.text(src[:400] + ("..." if len(src) > 400 else ""))
                    if i < len(msg["sources"]):
                        st.divider()

prefill_text = st.session_state.pop("prefill", "")
question = st.chat_input(
    placeholder="Nhap cau hoi ve tai lieu...",
    disabled=not st.session_state.doc_loaded
)

final_question = prefill_text or question

if final_question:
    if not st.session_state.doc_loaded:
        st.error("Hay nap tai lieu truoc. Nhan 'Nap Tai Lieu' o sidebar.")
        st.stop()

    st.session_state.messages.append({"role": "user", "content": final_question})
    with st.chat_message("user"):
        st.write(final_question)

    with st.chat_message("assistant"):
        with st.spinner("Dang tim kiem va tong hop cau tra loi..."):
            result = st.session_state.chatbot.ask(final_question)
        st.write(result["answer"])
        with st.expander("Xem doan van tham khao"):
            for i, src in enumerate(result["sources"], 1):
                st.markdown(f"**Doan {i}:**")
                st.text(src[:400] + ("..." if len(src) > 400 else ""))
                if i < len(result["sources"]):
                    st.divider()

    st.session_state.messages.append({
        "role": "assistant",
        "content": result["answer"],
        "sources": result["sources"]
    })
```

### Chạy giao diện web

```bash
streamlit run app.py
```

Trình duyệt sẽ tự mở tại `http://localhost:8501`.

---

## 11. Thứ tự chạy và kiểm tra

### Lần đầu chạy (tạo vector store)

```bash
# Đảm bảo môi trường ảo đang bật
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

# Kiểm tra đọc file
python step1_load.py

# Tạo embedding và vector store (mất 1-2 phút)
python step2_embed_store.py

# Kiểm tra tìm kiếm
python step3_retrieve.py

# Kiểm tra sinh câu trả lời
python step4_generate.py

# Chạy chatbot trong terminal
python chatbot.py

# Hoặc chạy giao diện web
streamlit run app.py
```

### Từ lần thứ 2 trở đi

```bash
# Không cần chạy lại step1-4 nữa vì đã có cache vector_store/
venv\Scripts\activate
streamlit run app.py
```

### Câu hỏi nên thử

Có trong tài liệu — chatbot phải trả lời đúng:
```
"Phuong phap SAVERS la gi?"
"Vong lap thoi quen gom may phan?"
"Ngu du giac bao nhieu tieng moi dem?"
"Ky thuat Pomodoro thuc hien nhu the nao?"
```

Không có trong tài liệu — chatbot phải từ chối:
```
"Gia Bitcoin hom nay la bao nhieu?"
"Thu do cua Phap la gi?"
"Ai la tong thong My hien tai?"
```

Với câu hỏi ngoài phạm vi tài liệu, chatbot sẽ trả lời: *"Tai lieu khong co thong tin ve van de nay"*. Đây là hành vi đúng — các bạn cần kiểm tra điều này để chắc chắn chatbot không bịa đặt.

---

## 12. Các lỗi thường gặp

Phần này thầy tổng hợp từ các lỗi thực tế gặp khi chạy thử dự án.

---

### Lỗi 1: `No module named 'langchain.prompts'`

```
ModuleNotFoundError: No module named 'langchain.prompts'
```

**Nguyên nhân:** LangChain 0.3 đã xóa các namespace cũ.

**Cách sửa:**

```python
# Sai (phiên bản cũ)
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Đúng (phiên bản mới)
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
```

---

### Lỗi 2: `models/text-embedding-004 is not found`

```
404 NOT_FOUND: models/text-embedding-004 is not found for API version v1beta
```

**Nguyên nhân:** Google đổi tên model embedding vào năm 2025.

**Cách sửa:**

```python
# Sai
embedding_model = GoogleGenerativeAIEmbeddings(
    model="models/text-embedding-004",
)

# Đúng
embedding_model = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    google_api_key=api_key
)
```

Để kiểm tra model embedding nào đang có sẵn, các bạn chạy:

```bash
python check_models.py
```

---

### Lỗi 3: `models/gemini-1.5-flash is not found`

```
404 NOT_FOUND: models/gemini-1.5-flash is not found for API version v1beta
```

**Nguyên nhân:** Google khai tử `gemini-1.5-flash` vào năm 2025.

**Cách sửa:**

```python
# Sai (model đã khai tử)
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", ...)

# Đúng (model mới, miễn phí)
llm = ChatGoogleGenerativeAI(model="gemini-flash-lite-latest", ...)
```

---

### Lỗi 4: Response trả về list thay vì string

**Triệu chứng:**
```python
[{'type': 'text', 'text': 'Dua tren tai lieu...', 'extras': {...}}]
```

**Nguyên nhân:** LangChain mới trả về structured content thay vì string thuần khi không có parser.

**Cách sửa:** Thêm `StrOutputParser()` vào cuối chain:

```python
from langchain_core.output_parsers import StrOutputParser

# Sai (trả về AIMessage với content có thể là list)
chain = prompt | llm
result = chain.invoke({...})
answer = result.content  # Có thể là list!

# Đúng (luôn trả về string)
chain = prompt | llm | StrOutputParser()
result = chain.invoke({...})
answer = result  # Luôn là string
```

---

### Lỗi 5: `429 RESOURCE_EXHAUSTED`

```
429 RESOURCE_EXHAUSTED: You exceeded your current quota
```

**Nguyên nhân:** API key miễn phí có giới hạn số request mỗi phút/ngày.

**Cách sửa:**
1. Đợi 1 phút rồi thử lại
2. Đảm bảo đang dùng model `gemini-flash-lite-latest` (free tier)
3. Kiểm tra quota tại `aistudio.google.com`

---

### Lỗi 6: `GOOGLE_API_KEY not found`

```
ValueError: Khong tim thay GOOGLE_API_KEY trong file .env!
```

**Kiểm tra:**

```bash
# File .env có tồn tại không?
dir .env          # Windows
# ls -la .env    # Mac/Linux
```

Nội dung file `.env` phải đúng định dạng — không có dấu nháy, không có khoảng trắng thừa:
```
GOOGLE_API_KEY=AIzaSyXXXXXXX
```

File `.env` phải nằm cùng thư mục với các file `.py`.

---

### Lỗi 7: `No module named 'langchain'`

**Nguyên nhân:** Môi trường ảo chưa được kích hoạt, hoặc thư viện chưa cài.

**Cách sửa:**

```bash
# Kích hoạt môi trường ảo
venv\Scripts\activate    # Windows
# source venv/bin/activate # Mac/Linux

# Cài lại thư viện
pip install -r requirements.txt
```

---

### Lỗi 8: `FileNotFoundError: vector_store`

**Nguyên nhân:** Chạy `step3_retrieve.py` hoặc `step4_generate.py` trước khi chạy `step2_embed_store.py`.

**Cách sửa:** Chạy đúng thứ tự:

```bash
python step2_embed_store.py  # Chạy trước để tạo vector_store/
python step3_retrieve.py     # Rồi mới chạy được
```

---

### Lỗi 9: `faiss-cpu` không cài được trên Python 3.13+

**Nguyên nhân:** `faiss-cpu` là C extension, chưa có pre-built wheel cho Python 3.13.

**Cách sửa:** Dùng Python 3.12. Xem lại mục [3.1](#31-kiểm-tra-phiên-bản-python).

---

## 13. Tóm tắt toàn bộ pipeline

```
GIAI DOAN 1: CHUAN BI (1 lan)
================================================

data/sach_mau.txt
       |
       v [step1] doc_load()
  List[Document]
       |
       v [step1] split_documents()
  List[Chunk] -- 16 doan, moi doan ~500 ky tu
       |
       v [step2] build_vector_store()
       |         Goi API: gemini-embedding-001
  FAISS Vector Store
       |
       v [step2] save_vector_store()
  vector_store/  <- luu tren o cung


GIAI DOAN 2: TRA LOI (moi cau hoi)
================================================

"Thoi quen buoi sang?"
       |
       v [step3] similarity_search_with_score()
  3 doan van lien quan nhat
       |
       v [step3] format_context()
  "[Doan 1]\n...\n---\n[Doan 2]\n..."
       |
       v [step4] prompt | llm | StrOutputParser()
       |         Goi API: gemini-flash-lite-latest
  "Thoi quen buoi sang gom 5 yeu to..."
```

---

## 14. Nâng cấp tiếp theo

Sau khi các bạn đã chạy được bản cơ bản này, có thể thử các hướng nâng cấp sau:

**Cải thiện chất lượng trả lời:**
- Conversation memory — chatbot nhớ ngữ cảnh hội thoại (hiện tại mỗi câu hỏi độc lập)
- Re-ranking — sắp xếp lại kết quả tìm kiếm theo độ liên quan thực sự
- Hybrid Search — kết hợp tìm kiếm vector với tìm kiếm từ khóa

**Mở rộng tính năng:**
- Nạp cả thư mục chứa nhiều file cùng lúc
- ChromaDB thay FAISS — vector database hỗ trợ Python 3.13+
- LlamaIndex — framework RAG nâng cao hơn LangChain

**Hướng production:**
- Docker — đóng gói và triển khai
- REST API — biến chatbot thành API để tích hợp vào app khác
- Authentication — thêm đăng nhập, phân quyền người dùng

---

## Checklist hoàn thành

- [ ] Hiểu RAG là gì và tại sao cần dùng
- [ ] Cài đặt môi trường ảo và thư viện thành công (Python 3.12)
- [ ] Có API key Google Gemini và đã kiểm tra hoạt động
- [ ] Chạy được `python step1_load.py` — thấy văn bản được chia thành 16 đoạn
- [ ] Chạy được `python step2_embed_store.py` — thấy thư mục `vector_store/` được tạo
- [ ] Chạy được `python step3_retrieve.py` — thấy kết quả tìm kiếm với score
- [ ] Chạy được `python step4_generate.py` — thấy câu trả lời từ Gemini
- [ ] Chạy được `python chatbot.py` — chat được trong terminal
- [ ] Chạy được `streamlit run app.py` — thấy giao diện web tại localhost:8501
- [ ] Test với câu hỏi có trong tài liệu — chatbot trả lời đúng
- [ ] Test với câu hỏi không trong tài liệu — chatbot từ chối đúng

---

*Tài liệu này dùng kèm với các file `.py` trong dự án.*
*Tương thích: LangChain >= 0.3, Google GenAI API 2025-2026, Python 3.12.*

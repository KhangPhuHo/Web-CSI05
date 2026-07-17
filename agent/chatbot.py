# File tong hop: gom RAG (hoi dap van ban) + Goi y sach tu hinh anh (Gemini Vision) vao 1 class RAGChatbot
# Duoc dung boi app.py (giao dien web) va co the dung doc lap trong terminal

import os
import json
import base64
from typing import List, Optional, Dict
from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader, PyPDFLoader, Docx2txtLoader


class APIKeyManager:
    """
    Quan ly 1 DANH SACH nhieu Google API key va tu dong xoay vong.

    Muc dich: khi dung Gemini free tier, moi key co quota rieng (VD X request/ngay).
    Khi key dang dung bi tra ve loi het quota (HTTP 429 / ResourceExhausted),
    thay vi chatbot bi "chet" thi se tu dong chuyen sang key tiep theo trong
    danh sach va thu lai - khong can vao Render sua tay.
    """

    def __init__(self, keys: List[str]):
        # Loai bo khoang trang / phan tu rong (phong khi bien moi truong co dau phay du)
        cleaned = [k.strip() for k in keys if k and k.strip()]
        if not cleaned:
            raise ValueError(
                "Danh sach API key rong! Hay dat bien moi truong GOOGLE_API_KEYS "
                "(nhieu key, phan cach boi dau phay) hoac GOOGLE_API_KEY (1 key)."
            )
        self.keys = cleaned
        self.index = 0

    @property
    def current_key(self) -> str:
        return self.keys[self.index]

    def rotate(self) -> str:
        """Chuyen sang key tiep theo (vong tron). Tra ve key moi."""
        self.index = (self.index + 1) % len(self.keys)
        print(f"[APIKeyManager] Da chuyen sang API key #{self.index + 1}/{len(self.keys)}")
        return self.current_key

    def __len__(self):
        return len(self.keys)


def _is_quota_error(err: Exception) -> bool:
    """Nhan dien loi 'het quota / rate limit' tu Google Gemini API.
    Cac loi nay thuong co ma 429 hoac ten ResourceExhausted trong message,
    du thu vien co the wrap lai thanh nhieu kieu Exception khac nhau."""
    msg = str(err).lower()
    return (
        "429" in msg
        or "resourceexhausted" in msg
        or "quota" in msg
        or "rate limit" in msg
        or "resource has been exhausted" in msg
    )


class RAGChatbot:
    """Chatbot hoi dap tai lieu (RAG) + goi y sach tu hinh anh (Gemini Vision)."""

    def __init__(self):
        # ------------------------------------------------------------
        # Doc DANH SACH API key thay vi chi 1 key duy nhat.
        # Uu tien GOOGLE_API_KEYS (nhieu key, cach nhau boi dau phay),
        # neu khong co thi fallback ve GOOGLE_API_KEY (1 key, cho tuong thich nguoc).
        #
        # Vi du trong file .env (hoac Environment Variables tren Render):
        #   GOOGLE_API_KEYS=AIzaSy_key_thu_nhat,AIzaSy_key_thu_hai,AIzaSy_key_thu_ba
        # ------------------------------------------------------------
        keys_str = os.getenv("GOOGLE_API_KEYS") or os.getenv("GOOGLE_API_KEY")
        if not keys_str:
            raise ValueError(
                "Khong tim thay GOOGLE_API_KEYS (hoac GOOGLE_API_KEY) trong file .env!"
            )
        api_keys = [k.strip() for k in keys_str.split(",") if k.strip()]
        self.key_manager = APIKeyManager(api_keys)

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
- Moi doan co the kem dong thong tin san pham (Ten sach/Tac gia/The loai/Gia/Ton kho/Danh gia)
  ngay truoc noi dung - neu cau hoi ve gia, con hang hay khong, the loai, hoac
  duoc danh gia may sao, hay lay TRUC TIEP tu dong thong tin nay, khong can
  suy dien tu phan noi dung ben duoi
- Neu tai lieu khong du thong tin, hay noi: "Tai lieu khong co thong tin ve van de nay"
- Tra loi bang tieng Viet, ro rang va de hieu
- Khong bia them thong tin ngoai tai lieu

TRA LOI:"""
        )

        # ------------------------------------------------------------------
        # Prompt viet lai cau hoi cho "doc lap" dua vao lich su hoi thoai gan
        # nhat. VD: lich su co "Sach Phuong Phap Hoc Tap Feynman gia bao nhieu?"
        # -> cau hoi moi "no con ban bao nhieu" se duoc viet lai thanh
        # "Sach Phuong Phap Hoc Tap Feynman con ban bao nhieu?" truoc khi dua
        # vao FAISS tim kiem - tranh tinh trang dai tu ("no", "cai do"...)
        # khien FAISS tim ra doan van khong lien quan.
        self.rewrite_prompt = PromptTemplate(
            input_variables=["history", "question"],
            template="""Dua vao doan hoi thoai gan day giua nguoi dung va tro ly ban ban sach,
hay viet lai CAU HOI MOI cua nguoi dung thanh 1 cau hoi DOC LAP, day du y nghia,
khong con phu thuoc vao dai tu ("no", "cai do", "quyen do", "san pham do"...) hay
ngu canh phia truoc.

LICH SU HOI THOAI:
{history}

CAU HOI MOI: {question}

HUONG DAN:
- Neu cau hoi moi da ro nghia, DOC LAP san (khong can lich su van hieu duoc), giu nguyen y, chi tra ve lai chinh no
- Neu cau hoi moi phu thuoc vao lich su (dai tu, nhac lai an y ten san pham/chu de truoc do), hay thay the bang ten cu the lay tu lich su
- Chi tra ve DUY NHAT cau hoi da viet lai, khong giai thich, khong ghi chu them
- Giu nguyen tieng Viet

CAU HOI DA VIET LAI:"""
        )
        # Khoi tao embedding_model / llm / vision_model / chain / rewrite_chain
        # theo key hien tai. Ham nay se duoc goi lai moi khi APIKeyManager xoay
        # sang key khac (het quota), de cac chain dung dung key moi.
        self._build_models(self.key_manager.current_key)

        self.vector_store = None
        self.products_json_path = None  # duong dan products.json, de lay gia/ton kho MOI NHAT khi hoi

        print(f"RAGChatbot khoi tao thanh cong! (dang dung {len(self.key_manager)} API key, bat dau tu key #1)")

    def _build_models(self, api_key: str):
        """Tao lai embedding_model, llm, vision_model va cac chain voi 1 api_key cu the.
        Duoc goi luc khoi tao, va goi lai moi khi xoay sang key khac."""
        self.embedding_model = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=api_key
        )

        # temperature=0.1: can bang giua chinh xac va tu nhien, phu hop voi Q&A tai lieu
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-flash-lite-latest",
            google_api_key=api_key,
            temperature=0.1
        )

        # Model rieng cho Gemini Vision (doc hinh anh)
        # Dung alias "-latest" (tu dong tro sang ban flash-lite moi nhat con ton tai)
        # thay vi ghim ten model cu the - tranh loi khi Google khai tu model doi cu
        # (VD gemini-2.0-flash-lite da bi ngung hoan toan tu 1/6/2026)
        self.vision_model = ChatGoogleGenerativeAI(
            model="gemini-flash-lite-latest",
            google_api_key=api_key,
            temperature=0.2
        )

        # Pipe operator |: ket noi cac buoc xu ly theo thu tu
        # prompt -> llm -> StrOutputParser (lay chuoi text thuan tu AIMessage)
        self.chain = self.prompt | self.llm | StrOutputParser()
        self.rewrite_chain = self.rewrite_prompt | self.llm | StrOutputParser()

        # Neu vector_store da ton tai (dang xoay key giua chung), cap nhat luon
        # embedding_function cua no de cac lan tim kiem sau dung key moi.
        if getattr(self, "vector_store", None) is not None:
            self.vector_store.embedding_function = self.embedding_model

    def _call_with_key_rotation(self, func):
        """
        Goi func() (khong tham so) va tu dong xoay sang API key tiep theo neu
        gap loi het quota (429), roi thu lai - cho den khi thanh cong hoac da
        thu HET tat ca key trong danh sach.

        func thuong la 1 lambda goi self.chain.invoke(...), self.vector_store.similarity_search_with_score(...)...
        """
        last_err = None
        attempts = len(self.key_manager)
        for _ in range(attempts):
            try:
                return func()
            except Exception as e:
                if _is_quota_error(e):
                    last_err = e
                    print(f"[APIKeyManager] Key #{self.key_manager.index + 1} het quota ({e}). Dang xoay sang key ke tiep...")
                    new_key = self.key_manager.rotate()
                    self._build_models(new_key)
                    continue
                raise  # loi khac (khong phai het quota) thi nem thang ra ngoai
        raise RuntimeError(
            f"Tat ca {attempts} API key trong danh sach deu da het quota. Loi cuoi cung: {last_err}"
        )

    # ------------------------------------------------------------------
    # Nap tai lieu / xay dung vector store
    # ------------------------------------------------------------------

    def _load_products_json(self, file_path: str):
        """
        Doc file products.json (dang dict: { product_id: { name, author, summary, ... } })
        va chuyen moi san pham thanh 1 Document.

        - page_content: lay tu 'summary' (noi dung se duoc chunk + embed de tim kiem)
        - metadata: giu lai name/author/genres/price/stock de khong bi mat thong tin
          khi 'summary' bi cat nho thanh nhieu chunk.
        """
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        documents = []

        for product_id, product in data.items():
            summary = (product.get("summary") or "").strip()

            if not summary:
                continue

            # Neu da chay step0_enrich_covers.py, san pham co the co them
            # "visual_description" (mo ta tu anh bia). Gop vao content de
            # goi y tu hinh anh (recommend_from_image) match chinh xac hon.
            visual_description = (product.get("visual_description") or "").strip()

            content = summary
            if visual_description:
                content = f"{summary}\n\nBối cảnh/cảm xúc từ ảnh bìa: {visual_description}"

            genres = product.get("genres", [])

            metadata = {
                "product_id": product_id,
                "name": product.get("name"),
                "author": product.get("author"),
                "publishedYear": product.get("publishedYear"),
                "price": product.get("price"),
                "stock": product.get("stock"),
                # Noi thanh chuoi vi nhieu vector store khong nhan metadata dang list
                "genres": ", ".join(genres) if isinstance(genres, list) else genres,
                # Trung binh sao + so luot danh gia - Node backend tinh san
                # tu subcollection ratings trong Firestore (xem syncRatingToJson)
                "avgRating": product.get("avgRating"),
                "ratingCount": product.get("ratingCount"),
                "source": file_path,
            }

            documents.append(Document(page_content=content, metadata=metadata))

        print(f"Doc thanh cong: {len(documents)} san pham tu file '{file_path}'")
        return documents

    def load_documents(self, file_path: str, force_rebuild: bool = False):
        """Nap tai lieu va xay dung vector store.

        force_rebuild=False: dung cache neu co (nhanh, tiet kiem API quota)
        force_rebuild=True:  xoa cache va tao lai tu dau
        """
        cache_path = "vector_store"
        ext = os.path.splitext(file_path)[1].lower()

        # Ghi nho duong dan products.json de sau nay _get_live_products() doc lai,
        # lay gia/ton kho MOI NHAT tai thoi diem hoi (khong chi dua vao metadata cu trong cache)
        if ext == ".json":
            self.products_json_path = file_path

        # Neu da co cache thi load thang, khoi mat thoi gian goi API de tao lai
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

        if ext == ".json":
            documents = self._load_products_json(file_path)
        elif ext == ".txt":
            documents = TextLoader(file_path, encoding="utf-8").load()
        elif ext == ".pdf":
            documents = PyPDFLoader(file_path).load()
        elif ext == ".docx":
            documents = Docx2txtLoader(file_path).load()
        else:
            raise ValueError(f"Dinh dang '{ext}' chua ho tro. Dung .json, .txt, .pdf hoac .docx")

        print("Chia van ban thanh doan nho...")
        chunks = self.splitter.split_documents(documents)
        print(f"   -> Tao ra {len(chunks)} doan")

        print("Dang tao embedding (goi Gemini API)...")
        self.vector_store = self._call_with_key_rotation(
            lambda: FAISS.from_documents(chunks, self.embedding_model)
        )

        # Luu lai de lan sau dung khong can goi API
        self.vector_store.save_local(cache_path)
        print(f"Hoan thanh! Da luu cache vao '{cache_path}/'")

    # ------------------------------------------------------------------
    # Ho tro: lay gia/ton kho MOI NHAT + ghep context cho prompt
    # ------------------------------------------------------------------

    def _get_live_products(self) -> dict:
        """
        Doc lai products.json TAI THOI DIEM HOI (khong lay tu vector store).
        Metadata trong vector store la anh chup luc build - neu gia/ton kho
        thay doi sau do ma chua rebuild lai vector store, cau tra loi se bi cu.
        """
        if not self.products_json_path or not os.path.exists(self.products_json_path):
            return {}

        with open(self.products_json_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _build_context(self, results, live_products: dict) -> str:
        # Ghep cac doan tim duoc thanh 1 khoi van ban de dua vao prompt cho Gemini
        # Moi doan (neu la san pham) se kem theo dong thong tin ten/tac gia/the loai/gia/ton kho
        context_parts = []

        for i, (doc, score) in enumerate(results):
            meta = doc.metadata
            product_id = meta.get("product_id")
            live = live_products.get(product_id) if live_products else None

            if live:
                genres = live.get("genres", [])
                genres_str = ", ".join(genres) if isinstance(genres, list) else genres

                name = live.get("name", meta.get("name"))
                author = live.get("author", meta.get("author"))
                price = live.get("price", meta.get("price"))
                stock = live.get("stock", meta.get("stock"))
                genres_final = genres_str or meta.get("genres")
                avg_rating = live.get("avgRating", meta.get("avgRating"))
                rating_count = live.get("ratingCount", meta.get("ratingCount"))
            else:
                name = meta.get("name")
                author = meta.get("author")
                genres_final = meta.get("genres")
                price = meta.get("price")
                stock = meta.get("stock")
                avg_rating = meta.get("avgRating")
                rating_count = meta.get("ratingCount")

            if avg_rating is not None and rating_count:
                rating_text = f"{avg_rating}/5 ({rating_count} lượt đánh giá)"
            else:
                rating_text = "Chưa có đánh giá"

            if name:
                info_line = (
                    f"Tên sách: {name} | Tác giả: {author} | "
                    f"Thể loại: {genres_final} | Giá: {price} VND | "
                    f"Tồn kho: {stock} | Đánh giá: {rating_text}"
                )
                part = f"[Đoạn {i+1}] ({info_line})\n{doc.page_content}"
            else:
                # Tai lieu khong phai san pham (VD nap tu .txt/.pdf thuong) - khong co metadata nay
                part = f"[Đoạn {i+1}]\n{doc.page_content}"

            context_parts.append(part)

        return "\n\n---\n\n".join(context_parts)

    def _format_history(self, history: List[Dict]) -> str:
        """Chuyen list [{role, content}, ...] thanh doan van ban de dua vao prompt.
        Chi lay toi da 3 cap hoi-dap gan nhat (6 dong) de prompt khong qua dai."""
        recent = history[-6:] if history else []
        lines = []
        for turn in recent:
            role = turn.get("role")
            content = (turn.get("content") or "").strip()
            if not content:
                continue
            speaker = "Nguoi dung" if role == "user" else "Tro ly"
            lines.append(f"{speaker}: {content}")
        return "\n".join(lines)

    def _rewrite_question_with_history(self, question: str, history: Optional[List[Dict]]) -> str:
        """Dung LLM viet lai cau hoi cho doc lap dua vao lich su hoi thoai gan nhat.
        Neu chua co lich su (lan hoi dau tien) hoac co loi khi goi LLM, tra ve
        nguyen cau hoi goc - khong de loi o buoc nay lam gian doan ca luong hoi dap."""
        if not history:
            return question

        history_text = self._format_history(history)
        if not history_text:
            return question

        try:
            rewritten = self._call_with_key_rotation(
                lambda: self.rewrite_chain.invoke({
                    "history": history_text,
                    "question": question
                })
            ).strip()

            if not rewritten:
                return question

            print(f"Cau hoi goc: '{question}' -> Viet lai: '{rewritten}'")
            return rewritten
        except Exception as e:
            print(f"Loi khi viet lai cau hoi (dung cau hoi goc): {e}")
            return question

    def _detect_aggregate_query(self, question: str):
        """
        Nhan dien cac cau hoi dang "cao nhat/thap nhat/re nhat/con nhieu nhat..."
        - nhung cau nay CAN SO SANH SO giua TAT CA san pham, ma FAISS (tim kiem
        ngu nghia) khong lam duoc: no chi lay top_k doan "giong nghia" voi cau
        hoi, khong dam bao san pham co gia tri lon nhat/nho nhat nam trong do.

        Tra ve (field, order) neu nhan dien duoc, vi du ("avgRating", "desc"),
        hoac None neu day la cau hoi thong thuong (van di qua FAISS nhu cu).
        """
        q = question.lower()

        if any(k in q for k in ["đánh giá cao", "đánh giá tốt", "nhiều sao", "sao cao", "tốt nhất"]):
            return ("avgRating", "desc")

        if any(k in q for k in ["đánh giá thấp", "đánh giá kém", "ít sao", "sao thấp", "kém nhất"]):
            return ("avgRating", "asc")

        if any(k in q for k in ["rẻ nhất", "giá thấp", "giá rẻ"]):
            return ("price", "asc")

        if any(k in q for k in ["đắt nhất", "giá cao", "giá đắt"]):
            return ("price", "desc")

        if any(k in q for k in ["còn nhiều nhất", "tồn kho nhiều", "hàng nhiều nhất"]):
            return ("stock", "desc")

        if any(k in q for k in ["sắp hết hàng", "còn ít nhất", "tồn kho ít", "hàng ít nhất"]):
            return ("stock", "asc")

        return None

    def _answer_aggregate_query(self, question: str, field: str, order: str, top_n: int = 3) -> dict:
        """
        Tra loi cau hoi so sanh (cao nhat/thap nhat...) bang cach doc TOAN BO
        products.json, sap xep THAT SU theo field yeu cau, roi moi dua top_n
        san pham DUNG NHAT vao prompt - dam bao chinh xac 100%, khong phu
        thuoc vao viec FAISS co "tinh co" tim ra dung san pham hay khong.
        """
        live_products = self._get_live_products()

        items = []
        for pid, p in live_products.items():
            # San pham chua co ai danh gia thi bo qua khoi xep hang theo rating
            if field == "avgRating" and not p.get("ratingCount"):
                continue

            value = p.get(field)
            if value is None:
                continue

            items.append((pid, p, value))

        if not items:
            return {
                "answer": "Hiện chưa có đủ dữ liệu để trả lời câu hỏi này.",
                "sources": []
            }

        items.sort(key=lambda x: x[2], reverse=(order == "desc"))
        top_items = items[:top_n]

        lines = []
        for pid, p, value in top_items:
            genres = p.get("genres", [])
            genres_str = ", ".join(genres) if isinstance(genres, list) else genres
            lines.append(
                f"- {p.get('name')} | Tác giả: {p.get('author')} | Thể loại: {genres_str} | "
                f"Giá: {p.get('price')} VND | Tồn kho: {p.get('stock')} | "
                f"Đánh giá: {p.get('avgRating', 0)}/5 ({p.get('ratingCount', 0)} lượt)"
            )

        context = (
            "Danh sách sau đã được HỆ THỐNG SẮP XẾP CHÍNH XÁC theo đúng yêu cầu "
            "của câu hỏi (không phải do bạn tự chọn), hãy trả lời dựa đúng theo "
            "thứ tự này:\n" + "\n".join(lines)
        )

        answer = self._call_with_key_rotation(
            lambda: self.chain.invoke({"context": context, "question": question})
        )

        return {"answer": answer, "sources": lines}

    def _search_and_answer(self, question: str, top_k: int = 3) -> dict:
        results = self._call_with_key_rotation(
            lambda: self.vector_store.similarity_search_with_score(question, k=top_k)
        )
        live_products = self._get_live_products()
        context = self._build_context(results, live_products)

        answer = self._call_with_key_rotation(
            lambda: self.chain.invoke({"context": context, "question": question})
        )

        return {
            "answer": answer,
            "sources": [doc.page_content for doc, _ in results]
        }

    # ------------------------------------------------------------------
    # Hoi dap bang TEXT
    # ------------------------------------------------------------------

    def ask(self, question: str, top_k: int = 3, history: Optional[List[Dict]] = None) -> dict:
        """Tra loi cau hoi dua tren tai lieu da nap.

        history: vai luot hoi-dap gan nhat, dang [{"role": "user"/"assistant",
                 "content": "..."}], dung de viet lai cau hoi hien tai cho
                 doc lap (giai quyet dai tu nhu "no", "cai do") truoc khi tim
                 kiem FAISS. Truyen None hoac [] neu la luot hoi dau tien.

        Tra ve dict voi hai key:
          "answer"  : cau tra loi (string)
          "sources" : list cac doan van da dung de tra loi
        """
        if self.vector_store is None:
            return {
                "answer": "Chua nap tai lieu! Hay goi load_documents() truoc.",
                "sources": []
            }

        standalone_question = self._rewrite_question_with_history(question, history)

        # Cau hoi dang "cao nhat/re nhat/con nhieu nhat..." can so sanh so
        # giua TAT CA san pham - FAISS (tim kiem ngu nghia) khong lam duoc
        # viec nay, nen xu ly rieng bang cach doc va sap xep truc tiep.
        aggregate = self._detect_aggregate_query(standalone_question)
        if aggregate:
            field, order = aggregate
            return self._answer_aggregate_query(standalone_question, field, order)

        return self._search_and_answer(standalone_question, top_k=top_k)

    # ------------------------------------------------------------------
    # Goi y sach tu HINH ANH (Gemini Vision)
    # ------------------------------------------------------------------

    def _describe_image(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
        # Chuyen anh thanh mo ta van ban: chu de, cam xuc, boi canh, the loai phu hop
        # Doan text nay se duoc dung nhu 1 cau hoi binh thuong o buoc sau (FAISS + Gemini)
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        prompt_text = (
            "Hay quan sat buc anh nay va mo ta bang tieng Viet, gom: "
            "chu de chinh trong anh, cam xuc/tam trang toat ra tu anh "
            "(vi du: yen binh, hung phan, co don, tinh cam...), "
            "boi canh (thien nhien, do thi, quan cafe...), "
            "va goi y the loai sach ban nghi se phu hop voi nguoi dang o "
            "tam trang/boi canh do. Chi tra ve doan mo ta, khong giai thich them."
        )

        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt_text},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{image_b64}"}
                }
            ]
        )

        response = self._call_with_key_rotation(lambda: self.vision_model.invoke([message]))
        description = self._extract_text(response.content)

        if not description:
            raise ValueError("Gemini Vision khong tra ve noi dung mo ta (content rong).")

        return description

    @staticmethod
    def _extract_text(content) -> str:
        """
        response.content cua AIMessage co the la 1 chuoi string, hoac 1 list
        cac "content block" (VD [{"type": "text", "text": "..."}]) tuy phien ban
        langchain-google-genai. Ham nay xu ly duoc ca 2 truong hop.
        """
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text", "")
                    if text:
                        parts.append(text)
            return "".join(parts).strip()

        return str(content).strip()

    def recommend_from_image(self, image_bytes: bytes, mime_type: str = "image/jpeg", top_k: int = 3) -> dict:
        """Nhan bytes cua 1 tam anh, tra ve goi y sach.

        Dung CHUNG vector store va chain voi ask() - chi khac diem dau vao (anh thay vi text).

        Tra ve dict voi ba key:
          "answer"            : cau tra loi/goi y (string)
          "sources"           : list cac doan van da dung de tra loi
          "image_description" : mo ta van ban ma Gemini Vision doc duoc tu anh
        """
        if self.vector_store is None:
            return {
                "answer": "Chua nap tai lieu! Hay goi load_documents() truoc.",
                "sources": [],
                "image_description": ""
            }

        description = self._describe_image(image_bytes, mime_type)
        print(f"Mo ta anh: '{description[:200]}...'")

        result = self._search_and_answer(description, top_k=top_k)
        result["image_description"] = description

        return result


if __name__ == "__main__":
    print("=" * 55)
    print("  RAG CHATBOT - HOI DAP TAI LIEU + GOI Y TU HINH ANH")
    print("=" * 55)

    bot = RAGChatbot()
    bot.load_documents("data/text/products.json")

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
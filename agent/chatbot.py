# File tong hop: gom RAG (hoi dap van ban) + Goi y sach tu hinh anh (Gemini Vision) vao 1 class RAGChatbot
# Duoc dung boi app.py (giao dien web) va co the dung doc lap trong terminal

import os
import json
import base64
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


class RAGChatbot:
    """Chatbot hoi dap tai lieu (RAG) + goi y sach tu hinh anh (Gemini Vision)."""

    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("Khong tim thay GOOGLE_API_KEY trong file .env!")

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
- Moi doan co the kem dong thong tin san pham (Ten sach/Tac gia/The loai/Gia/Ton kho)
  ngay truoc noi dung - neu cau hoi ve gia, con hang hay khong, hoac the loai, hay lay
  TRUC TIEP tu dong thong tin nay, khong can suy dien tu phan noi dung ben duoi
- Neu tai lieu khong du thong tin, hay noi: "Tai lieu khong co thong tin ve van de nay"
- Tra loi bang tieng Viet, ro rang va de hieu
- Khong bia them thong tin ngoai tai lieu

TRA LOI:"""
        )

        # Pipe operator |: ket noi cac buoc xu ly theo thu tu
        # prompt -> llm -> StrOutputParser (lay chuoi text thuan tu AIMessage)
        self.chain = self.prompt | self.llm | StrOutputParser()

        self.vector_store = None
        self.products_json_path = None  # duong dan products.json, de lay gia/ton kho MOI NHAT khi hoi

        print("RAGChatbot khoi tao thanh cong!")

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
        self.vector_store = FAISS.from_documents(chunks, self.embedding_model)

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
            else:
                name = meta.get("name")
                author = meta.get("author")
                genres_final = meta.get("genres")
                price = meta.get("price")
                stock = meta.get("stock")

            if name:
                info_line = (
                    f"Tên sách: {name} | Tác giả: {author} | "
                    f"Thể loại: {genres_final} | Giá: {price} VND | Tồn kho: {stock}"
                )
                part = f"[Đoạn {i+1}] ({info_line})\n{doc.page_content}"
            else:
                # Tai lieu khong phai san pham (VD nap tu .txt/.pdf thuong) - khong co metadata nay
                part = f"[Đoạn {i+1}]\n{doc.page_content}"

            context_parts.append(part)

        return "\n\n---\n\n".join(context_parts)

    def _search_and_answer(self, question: str, top_k: int = 3) -> dict:
        results = self.vector_store.similarity_search_with_score(question, k=top_k)
        live_products = self._get_live_products()
        context = self._build_context(results, live_products)

        answer = self.chain.invoke({"context": context, "question": question})

        return {
            "answer": answer,
            "sources": [doc.page_content for doc, _ in results]
        }

    # ------------------------------------------------------------------
    # Hoi dap bang TEXT
    # ------------------------------------------------------------------

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

        return self._search_and_answer(question, top_k=top_k)

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

        response = self.vision_model.invoke([message])
        return response.content.strip()

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

# File tong hop: gom tat ca 5 buoc vao mot class RAGChatbot
# Class nay duoc dung boi app.py (giao dien web) va co the dung doc lap trong terminal

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

        # temperature=0.1: can bang giua chinh xac va tu nhien, phu hop voi Q&A tai lieu
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

        # Pipe operator |: ket noi cac buoc xu ly theo thu tu
        # prompt -> llm -> StrOutputParser (lay chuoi text thuan tu AIMessage)
        self.chain = self.prompt | self.llm | StrOutputParser()
        self.vector_store = None

        print("RAGChatbot khoi tao thanh cong!")

    def load_documents(self, file_path: str, force_rebuild: bool = False):
        """Nap tai lieu va xay dung vector store.

        force_rebuild=False: dung cache neu co (nhanh, tiet kiem API quota)
        force_rebuild=True:  xoa cache va tao lai tu dau
        """
        cache_path = "vector_store"

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

        # Luu lai de lan sau dung khong can goi API
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

        # Tim top_k doan lien quan nhat voi cau hoi
        results = self.vector_store.similarity_search_with_score(question, k=top_k)

        # Ghep cac doan tim duoc thanh context de dua vao prompt
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

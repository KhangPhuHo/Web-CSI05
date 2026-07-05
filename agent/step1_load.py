# Buoc 1: Doc file tai lieu va chia thanh cac doan nho (chunk)
# Chay file nay truoc tien de kiem tra doc file co thanh cong khong

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader, PyPDFLoader
import os


def doc_load(file_path: str):
    # Phan loai loader theo duoi file, moi dinh dang can loader rieng
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
    # chunk_size=500: moi doan toi da 500 ky tu
    # chunk_overlap=50: 50 ky tu cuoi doan truoc se lap lai o dau doan sau,
    #   tranh cat dut giua mot cau quan trong
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        # Thu tu uu tien cat: doan van -> dong -> dau cham -> dau phay -> khoang trang
        # Cat tai doan van truoc de giu nguyen y nghia, chi cat tai ky tu neu bat buoc
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

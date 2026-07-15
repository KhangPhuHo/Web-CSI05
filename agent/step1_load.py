# Buoc 1: Doc file tai lieu va chia thanh cac doan nho (chunk)
# Chay file nay truoc tien de kiem tra doc file co thanh cong khong

import json
import os

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader, PyPDFLoader


def load_products_json(file_path: str):
    """
    Doc file products.json (dang dict: { product_id: { name, author, summary, ... } })
    va chuyen moi san pham thanh 1 Document.

    - page_content: lay tu truong 'summary', gop them 'visual_description'
      (mo ta anh bia, neu co) de tim kiem tu hinh anh chinh xac hon
    - metadata: giu lai name, author, genres, price... de khong bi mat
      thong tin khi noi dung bi cat nho thanh nhieu chunk. Langchain se
      tu dong copy metadata nay sang cho tung chunk con.
    """

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    documents = []

    for product_id, product in data.items():

        summary = (product.get("summary") or "").strip()

        # Bo qua san pham khong co noi dung de tim kiem
        if not summary:
            continue

        # Neu da chay step0_enrich_covers.py, san pham co the co them
        # "visual_description" (mo ta boi canh/cam xuc tu anh bia, do Gemini
        # Vision tao ra). Gop vao page_content de gop phan "hoc" cung summary,
        # giup goi y tu hinh anh (step5) match chinh xac hon.
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
            # Noi thanh chuoi vi nhieu vector store (Chroma...) khong
            # chap nhan metadata la list, chi chap nhan str/int/float/bool
            "genres": ", ".join(genres) if isinstance(genres, list) else genres,
            # Trung binh sao + so luot danh gia - duoc backend Node tinh san
            # tu subcollection ratings trong Firestore (xem syncRatingToJson)
            "avgRating": product.get("avgRating"),
            "ratingCount": product.get("ratingCount"),
            "source": file_path,
        }

        documents.append(
            Document(page_content=content, metadata=metadata)
        )

    print(f"Doc thanh cong: {len(documents)} san pham tu file '{file_path}'")

    return documents


def doc_load(file_path: str):
    # Phan loai loader theo duoi file, moi dinh dang can loader rieng
    extension = os.path.splitext(file_path)[1].lower()

    if extension == ".json":
        documents = load_products_json(file_path)
    elif extension == ".txt":
        loader = TextLoader(file_path, encoding="utf-8")
        documents = loader.load()
        print(f"Doc thanh cong: {len(documents)} phan tu file '{file_path}'")
    elif extension == ".pdf":
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        print(f"Doc thanh cong: {len(documents)} phan tu file '{file_path}'")
    else:
        raise ValueError(f"Dinh dang file '{extension}' chua duoc ho tro. Dung .json, .txt hoac .pdf")

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

    docs = doc_load("data/text/products.json")
    chunks = split_documents(docs)

    print(f"\nTong ket:")
    print(f"   - So doan tao ra: {len(chunks)}")
    print(f"   - Doan ngan nhat: {min(len(c.page_content) for c in chunks)} ky tu")
    print(f"   - Doan dai nhat:  {max(len(c.page_content) for c in chunks)} ky tu")

    print(f"\n3 doan dau tien:")
    for i, chunk in enumerate(chunks[:3]):
        print(f"\n--- Doan {i+1} ---")
        print(f"   [metadata] name: {chunk.metadata.get('name')} | author: {chunk.metadata.get('author')} | genres: {chunk.metadata.get('genres')}")
        print(chunk.page_content[:200])
        print("...")
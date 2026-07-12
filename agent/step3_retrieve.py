# Buoc 4: Tim cac doan van lien quan nhat voi cau hoi trong vector store
# Yeu cau: da chay step2_embed_store.py va co thu muc vector_store/

import json
import os
from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from step2_embed_store import load_vector_store, create_embedding_model


def load_live_products(json_path: str = "data/text/products.json") -> dict:
    """
    Doc TRUC TIEP file products.json tai thoi diem hoi (khong lay tu vector store).

    Ly do: metadata (name/author/genres/price/stock) duoc luu trong vector store
    la "anh chup" tai thoi diem chay step2_embed_store.py. Neu gia hoac ton kho
    thay doi sau do ma khong rebuild lai vector store, cau tra loi se bi sai lech.
    Doc lai file json (hoac sau nay la goi Firestore/API that su) moi dam bao
    du lieu gia/ton kho luon la moi nhat.
    """

    if not os.path.exists(json_path):
        print(f"Canh bao: khong tim thay '{json_path}', se dung metadata cu trong vector store.")
        return {}

    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def search_relevant_chunks(vector_store, query: str, top_k: int = 3):
    print(f"Tim kiem cho cau hoi: '{query}'")

    # similarity_search_with_score tra ve (Document, score) - score cang nho cang lien quan
    # Day la khoang cach Euclidean trong khong gian vector, khac voi diem tuong dong thong thuong
    results = vector_store.similarity_search_with_score(
        query=query,
        k=top_k
    )

    print(f"Tim duoc {len(results)} doan lien quan:")

    for i, (doc, score) in enumerate(results):
        print(f"\n  Doan {i+1} (score: {score:.4f} - cang nho cang lien quan):")
        print(f"  '{doc.page_content[:200]}...'")

    return results


def _get_fresh_fields(doc_metadata: dict, live_products: dict) -> dict:
    """
    Uu tien lay name/author/genres/price/stock tu products.json (moi nhat).
    Neu khong tim thay product_id trong live_products (VD file bi xoa/doi ten),
    fallback ve metadata cu duoc luu trong vector store.
    """

    product_id = doc_metadata.get("product_id")
    live = live_products.get(product_id) if live_products else None

    if live:
        genres = live.get("genres", [])
        genres_str = ", ".join(genres) if isinstance(genres, list) else genres

        return {
            "name": live.get("name", doc_metadata.get("name")),
            "author": live.get("author", doc_metadata.get("author")),
            "genres": genres_str or doc_metadata.get("genres"),
            "price": live.get("price", doc_metadata.get("price")),
            "stock": live.get("stock", doc_metadata.get("stock")),
        }

    return {
        "name": doc_metadata.get("name"),
        "author": doc_metadata.get("author"),
        "genres": doc_metadata.get("genres"),
        "price": doc_metadata.get("price"),
        "stock": doc_metadata.get("stock"),
    }


def format_context(search_results, live_products: dict = None) -> str:
    # Ghep cac doan tim duoc thanh mot khoi van ban de dua vao prompt cho Gemini
    # Dau phan cach "---" giup Gemini nhan biet ranh gioi giua cac doan
    # Moi doan giờ kem theo thong tin san pham (ten/tac gia/the loai/gia/ton kho)
    # de Gemini co the tra loi truc tiep cac cau hoi ve thuoc tinh, khong chi noi dung
    live_products = live_products or {}

    context_parts = []

    for i, (doc, score) in enumerate(search_results):
        fields = _get_fresh_fields(doc.metadata, live_products)

        info_line = (
            f"Tên sách: {fields['name']} | "
            f"Tác giả: {fields['author']} | "
            f"Thể loại: {fields['genres']} | "
            f"Giá: {fields['price']} VND | "
            f"Tồn kho: {fields['stock']}"
        )

        part = f"[Đoạn {i+1}] ({info_line})\n{doc.page_content}"
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

    print("\nDoc du lieu san pham moi nhat (gia/ton kho)...")
    live_products = load_live_products("data/text/products.json")

    test_queries = [
        "Có sách nào nói về phương pháp học tập của Feynman không?",
        "Sách Súng, Vi Trùng Và Thép giá bao nhiêu và còn hàng không?",
        "Sách Mùa Lá Rụng Trong Vườn thuộc thể loại gì?",
    ]

    for query in test_queries:
        print(f"\n{'='*50}")
        results = search_relevant_chunks(vector_store, query, top_k=2)

        context = format_context(results, live_products)
        print(f"\nContext se dua vao Gemini:")
        print(context[:400] + "...")

# Buoc 4: Tim cac doan van lien quan nhat voi cau hoi trong vector store
# Yeu cau: da chay step2_embed_store.py va co thu muc vector_store/

import os
from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from step2_embed_store import load_vector_store, create_embedding_model


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


def format_context(search_results) -> str:
    # Ghep cac doan tim duoc thanh mot khoi van ban de dua vao prompt cho Gemini
    # Dau phan cach "---" giup Gemini nhan biet ranh gioi giua cac doan
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

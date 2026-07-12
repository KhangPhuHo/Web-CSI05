# Buoc 2+3: Chuyen tung doan van thanh vector so (embedding) va luu vao FAISS
# Chi can chay 1 lan. Lan sau load tu cache vector_store/ cho nhanh

import os
from dotenv import load_dotenv

# load_dotenv() phai goi truoc khi import cac thu vien Google
# de bien GOOGLE_API_KEY trong .env duoc nap vao os.environ
load_dotenv()

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from step1_load import doc_load, split_documents


def create_embedding_model():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("Khong tim thay GOOGLE_API_KEY trong file .env!")

    # gemini-embedding-001 la model embedding moi nhat cua Google (thay the text-embedding-004)
    embedding_model = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key
    )

    print("Tao embedding model thanh cong")
    return embedding_model


def build_vector_store(chunks, embedding_model):
    print(f"Dang tao embedding cho {len(chunks)} doan van...")
    print("   (Buoc nay goi API Google, co the mat 1-2 phut)")

    # FAISS.from_documents: chuyen tung chunk thanh vector roi xay dung chi muc tim kiem
    vector_store = FAISS.from_documents(
        documents=chunks,
        embedding=embedding_model
    )

    print(f"Tao vector store thanh cong!")
    print(f"   Da luu {len(chunks)} doan van vao bo nho")

    return vector_store


def save_vector_store(vector_store, save_path="vector_store"):
    # Luu ra o cung de lan sau khoi can goi API lai
    vector_store.save_local(save_path)
    print(f"Da luu vector store vao thu muc '{save_path}/'")


def load_vector_store(embedding_model, load_path="vector_store"):
    if not os.path.exists(load_path):
        raise FileNotFoundError(
            f"Khong tim thay vector store tai '{load_path}'. "
            "Hay chay step2_embed_store.py truoc!"
        )

    # allow_dangerous_deserialization=True: FAISS luu bang pickle, phai bat flag nay moi load duoc
    # An toan vi file nay do chinh minh tao ra
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
    docs = doc_load("data/text/products.json")
    chunks = split_documents(docs)

    print("\n[2/3] Tao embedding model...")
    embedding_model = create_embedding_model()

    print("\n[3/3] Tao va luu vector store...")
    vector_store = build_vector_store(chunks, embedding_model)
    save_vector_store(vector_store)

    print("\nHoan thanh! Bay gio co the chay buoc tiep theo.")
    print("   Thu muc 'vector_store/' da duoc tao.")

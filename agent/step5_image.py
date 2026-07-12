# Buoc 5: Doc anh bang Gemini Vision, chuyen thanh mo ta van ban,
# roi tai su dung NGUYEN VEN pipeline RAG da co (step3_retrieve.py + step4_generate.py)
#
# Luong hoat dong:
#   Anh (bytes) -> Gemini Vision -> mo ta bang text -> dung mo ta do lam "cau hoi"
#   -> FAISS search (step3) -> Gemini tra loi (step4)
#
# File nay KHONG thay doi logic RAG cu, chi them 1 lop "anh -> text" o phia truoc.

import os
import base64
from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage


def create_vision_model():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("Khong tim thay GOOGLE_API_KEY trong file .env!")

    # gemini-flash-lite-latest: alias TU DONG CAP NHAT sang ban flash-lite moi nhat con ton tai
    # (khong ghim cung ten model cu the - Google thuong xuyen "khai tu" cac model doi cu,
    # VD gemini-2.0-flash-lite da bi ngung hoan toan tu 1/6/2026, dung alias tranh loi nay lap lai)
    vision_model = ChatGoogleGenerativeAI(
        model="gemini-flash-lite-latest",
        google_api_key=api_key,
        temperature=0.2
    )

    print("Ket noi Gemini Vision thanh cong")
    return vision_model


def _extract_text(content) -> str:
    """
    response.content cua AIMessage co the la:
      - 1 chuoi string don gian (cac phien ban cu)
      - 1 list cac "content block", VD [{"type": "text", "text": "..."}] (cac phien ban
        langchain-google-genai moi hon, dac biet khi model ho tro "thinking")

    Ham nay xu ly duoc ca 2 truong hop, luon tra ve 1 chuoi string sach.
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


def describe_image(vision_model, image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Nhan bytes cua 1 tam anh, tra ve 1 doan mo ta bang tieng Viet:
    chu de, cam xuc, boi canh, the loai sach phu hop.

    Doan text tra ve se duoc dung TRUC TIEP nhu mot cau hoi binh thuong,
    dua thang vao search_relevant_chunks() (step3) va answer_question() (step4)
    - khong can sua gi o 2 file do.
    """

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

    print("Gemini Vision dang doc anh...")

    response = vision_model.invoke([message])
    description = _extract_text(response.content)

    if not description:
        raise ValueError("Gemini Vision khong tra ve noi dung mo ta (content rong).")

    print(f"Mo ta anh: '{description[:200]}...'")

    return description


def recommend_from_image(image_bytes: bytes, vector_store, chain, vision_model=None,
                          mime_type: str = "image/jpeg", top_k: int = 3) -> dict:
    """
    Ham tien ich gop toan bo luong: anh -> mo ta -> tim kiem FAISS -> Gemini tra loi.
    Chatbot.py se goi ham nay trong method recommend_from_image(image_bytes) cua no,
    nen giu chu ky ham don gian, de goi lai.
    """

    from step3_retrieve import search_relevant_chunks, format_context, load_live_products
    from step4_generate import answer_question

    if vision_model is None:
        vision_model = create_vision_model()

    description = describe_image(vision_model, image_bytes, mime_type)

    live_products = load_live_products("data/text/products.json")

    results = search_relevant_chunks(vector_store, description, top_k=top_k)
    context = format_context(results, live_products)

    answer = answer_question(chain, context, description)

    sources = [
        {
            "product_id": doc.metadata.get("product_id"),
            "name": doc.metadata.get("name"),
            "score": score
        }
        for doc, score in results
    ]

    return {
        "answer": answer,
        "sources": sources,
        "image_description": description
    }


if __name__ == "__main__":
    print("=" * 50)
    print("BUOC 5: GOI Y SACH TU HINH ANH (GEMINI VISION)")
    print("=" * 50)

    from step2_embed_store import create_embedding_model, load_vector_store
    from step4_generate import create_llm, create_qa_chain

    print("\nChuan bi he thong...")
    embedding_model = create_embedding_model()
    vector_store = load_vector_store(embedding_model)
    llm = create_llm()
    chain = create_qa_chain(llm)
    vision_model = create_vision_model()

    # Doi duong dan nay thanh 1 anh that (VD anh khung canh, tam trang) de chay thu
    test_image_path = "data/img/test.jpg"

    if not os.path.exists(test_image_path):
        print(f"\nKhong tim thay anh test tai '{test_image_path}'.")
        print("Hay dat 1 anh vao duong dan tren, hoac goi recommend_from_image() truc tiep tu app.py.")

    else:
        with open(test_image_path, "rb") as f:
            image_bytes = f.read()

        ext = os.path.splitext(test_image_path)[1].lower()
        mime_type = "image/png" if ext == ".png" else "image/jpeg"

        result = recommend_from_image(
            image_bytes, vector_store, chain,
            vision_model=vision_model, mime_type=mime_type
        )

        print(f"\n{'='*50}")
        print(f"Mo ta anh: {result['image_description']}")
        print(f"\nCau tra loi goi y:")
        print(result["answer"])
        print(f"\nNguon tham khao:")
        for s in result["sources"]:
            print(f"   - {s['name']} (score: {s['score']:.4f})")
# Buoc 5: Dua context va cau hoi vao Gemini de sinh cau tra loi
# Yeu cau: da chay step2 (co vector_store/) truoc khi chay file nay

import os
from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser


def create_llm():
    # temperature=0.1: uu tien tra loi chinh xac, giam thieu sang tao tu do
    # Voi Q&A tai lieu, muon AI bam sat noi dung, khong san sinh ra thong tin ngoai le
    llm = ChatGoogleGenerativeAI(
        model="gemini-flash-lite-latest",
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=0.1
    )
    print("Ket noi Gemini thanh cong")
    return llm


def create_qa_chain(llm):
    # Template co 2 bien {context} va {question}
    # Phan "HUONG DAN TRA LOI" quan trong: ep Gemini chi dung thong tin trong tai lieu
    # neu khong co phan nay, Gemini se tu them thong tin tu kien thuc chung cua no
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

    # Cach viet chain voi LangChain >= 0.3 dung pipe operator |
    # prompt -> dien bien -> llm -> nhan AIMessage -> StrOutputParser -> lay chuoi text thuan
    chain = prompt | llm | StrOutputParser()
    return chain


def answer_question(chain, context: str, question: str) -> str:
    print("Gemini dang doc tai lieu va tra loi...")

    # chain.invoke nhan dict voi cac key tuong ung voi input_variables trong PromptTemplate
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

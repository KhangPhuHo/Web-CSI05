# api_server.py
# Server API rieng cho RAG Chatbot (Gemini), boc lai class RAGChatbot (chatbot.py)
# de cac service khac (VD Node backend) co the goi qua HTTP.
#
# Duoc bao ve bang 1 API key RIENG (RAG_API_KEY) - KHONG phai GOOGLE_API_KEY.
# Chi ai biet RAG_API_KEY moi goi duoc server nay; GOOGLE_API_KEY khong bao gio
# lo ra ngoai, van chi nam trong .env cua server nay (dung noi bo qua chatbot.py).
#
# Chay dev:  uvicorn api_server:app --reload --port 8000
# Chay prod: uvicorn api_server:app --host 0.0.0.0 --port $PORT

import os
from typing import List

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Header, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel

from chatbot import RAGChatbot


RAG_API_KEY = os.getenv("RAG_API_KEY")
if not RAG_API_KEY:
    raise ValueError(
        "Chua cau hinh RAG_API_KEY trong file .env! "
        "Tao 1 key ngau nhien bang: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

PRODUCTS_JSON_PATH = "data/text/products.json"


app = FastAPI(title="RAG Chatbot API", version="1.0.0")

print("Dang khoi tao RAGChatbot (co the mat vai giay neu chua co cache vector_store/)...")
bot = RAGChatbot()
bot.load_documents(PRODUCTS_JSON_PATH)
print("RAGChatbot da san sang nhan request!")


def verify_api_key(x_api_key: str = Header(alias="X-API-Key")):
    """
    Kiem tra header 'X-API-Key' co khop voi RAG_API_KEY trong .env khong.
    Day la lop bao ve DUY NHAT cho server nay - chi client nao biet dung
    RAG_API_KEY (VD Node backend, dang giu key nay trong .env cua no) moi
    goi duoc, con lai deu bi tu choi voi loi 401.
    """
    if not x_api_key or x_api_key != RAG_API_KEY:
        raise HTTPException(status_code=401, detail="API key khong hop le hoac bi thieu.")


# ------------------------------------------------------------------
# POST /ask - hoi dap bang TEXT
# ------------------------------------------------------------------

class AskRequest(BaseModel):
    question: str
    top_k: int = 3


class AskResponse(BaseModel):
    answer: str
    sources: List[str]


@app.post("/ask", response_model=AskResponse, dependencies=[Depends(verify_api_key)])
async def ask(payload: AskRequest):
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=400, detail="Truong 'question' khong duoc de trong.")

    result = bot.ask(payload.question, top_k=payload.top_k)
    return result


# ------------------------------------------------------------------
# POST /recommend-from-image - goi y sach tu HINH ANH (Gemini Vision)
# ------------------------------------------------------------------

class RecommendFromImageResponse(BaseModel):
    answer: str
    sources: List[str]
    image_description: str


@app.post(
    "/recommend-from-image",
    response_model=RecommendFromImageResponse,
    dependencies=[Depends(verify_api_key)]
)
async def recommend_from_image(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File gui len khong phai hinh anh.")

    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="File anh rong.")

    result = bot.recommend_from_image(image_bytes, mime_type=image.content_type)
    return result


# ------------------------------------------------------------------
# GET /health - kiem tra server con song, KHONG yeu cau API key
# (dung de "danh thuc" server tren Render truoc khi goi that, giong wake_up_render())
# ------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}

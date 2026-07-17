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
import threading
from typing import List, Optional

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

DOCUMENT_SOURCES = [
    "data/text/products.json",
    "data/text/guideusers.txt",  # huong dan su dung / FAQ don hang, thanh toan, hoan tien...
]


app = FastAPI(title="RAG Chatbot API", version="1.0.0")

# Trang thai khoi tao RAGChatbot - CHAY NGAM (background thread), KHONG chan
# viec uvicorn mo cong lang nghe. Neu de RAGChatbot()/load_documents() chay
# truc tiep o top-level (nhu ban cu), toan bo qua trinh import file se bi
# chan lai cho toi khi tai xong model + FAISS - luc "thuc day" sau khi ngu
# ca dem, buoc nay co the lau hon thoi gian Render cho, khien Render tuong
# service "khong khoi dong duoc" va tra ve trang loi thay vi doi.
bot: Optional[RAGChatbot] = None
bot_ready = False
bot_error: Optional[str] = None


def _load_bot_in_background():
    global bot, bot_ready, bot_error
    try:
        print("Dang khoi tao RAGChatbot (chay ngam, khong chan cong lang nghe)...")
        instance = RAGChatbot()
        instance.load_documents(DOCUMENT_SOURCES)
        bot = instance
        bot_ready = True
        print("RAGChatbot da san sang nhan request!")
    except Exception as e:
        bot_error = str(e)
        print(f"Loi khi khoi tao RAGChatbot: {e}")


@app.on_event("startup")
def on_startup():
    threading.Thread(target=_load_bot_in_background, daemon=True).start()


def verify_api_key(x_api_key: str = Header(alias="X-API-Key")):
    """
    Kiem tra header 'X-API-Key' co khop voi RAG_API_KEY trong .env khong.
    Day la lop bao ve DUY NHAT cho server nay - chi client nao biet dung
    RAG_API_KEY (VD Node backend, dang giu key nay trong .env cua no) moi
    goi duoc, con lai deu bi tu choi voi loi 401.
    """
    if not x_api_key or x_api_key != RAG_API_KEY:
        raise HTTPException(status_code=401, detail="API key khong hop le hoac bi thieu.")


def ensure_bot_ready():
    """
    Goi o dau moi endpoint can dung bot - neu RAGChatbot chua tai xong (dang
    chay ngam) hoac tai loi, tra ve thong bao ro rang thay vi de client nhan
    loi mo ho hoac cho vo han.
    """
    if bot_error:
        raise HTTPException(
            status_code=500,
            detail=f"RAGChatbot khoi tao that bai: {bot_error}"
        )
    if not bot_ready:
        raise HTTPException(
            status_code=503,
            detail="Server dang khoi dong (tai model/du lieu), vui long thu lai sau vai giay."
        )


# ------------------------------------------------------------------
# POST /ask - hoi dap bang TEXT
# ------------------------------------------------------------------

class HistoryTurn(BaseModel):
    role: str      # "user" hoac "assistant"
    content: str


class AskRequest(BaseModel):
    question: str
    top_k: int = 3
    # Vai luot hoi-dap gan nhat, dung de RAGChatbot viet lai cau hoi hien tai
    # cho "doc lap" (khong con phu thuoc dai tu nhu "no", "cai do") truoc khi
    # tim kiem FAISS. Mac dinh rong neu client khong gui (VD lan hoi dau tien).
    history: List[HistoryTurn] = []


class AskResponse(BaseModel):
    answer: str
    sources: List[str]


@app.post("/ask", response_model=AskResponse, dependencies=[Depends(verify_api_key)])
async def ask(payload: AskRequest):
    ensure_bot_ready()

    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=400, detail="Truong 'question' khong duoc de trong.")

    history_as_dicts = [turn.dict() for turn in payload.history]

    result = bot.ask(payload.question, top_k=payload.top_k, history=history_as_dicts)
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
    ensure_bot_ready()

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

@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    # Luon tra ve NGAY LAP TUC, khong phu thuoc bot_ready - dung de Render
    # (hoac dich vu keep-alive) xac nhan server con song, tach biet voi
    # trang thai "da san sang xu ly RAG" (xem field bot_ready)
    return {"status": "ok", "bot_ready": bot_ready, "bot_error": bot_error}
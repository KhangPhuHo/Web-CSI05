# Giao dien web dung Streamlit
# Chay bang lenh: streamlit run app.py
# Trinh duyet tu mo tai http://localhost:8501

import streamlit as st
import os

from chatbot import RAGChatbot

st.set_page_config(
    page_title="RAG Chatbot - Hoi Dap Tai Lieu",
    layout="centered"
)

# Session state giu du lieu giua cac lan render cua Streamlit.
# Moi khi nguoi dung click hoac go phim, Streamlit render lai toan bo app tu dau,
# nen can session_state de luu chatbot va lich su chat khoi bi mat.
if "chatbot" not in st.session_state:
    st.session_state.chatbot = None
if "messages" not in st.session_state:
    st.session_state.messages = []
if "doc_loaded" not in st.session_state:
    st.session_state.doc_loaded = False

# Sidebar ben trai: cac thao tac cai dat
with st.sidebar:
    st.title("RAG Chatbot")
    st.caption("Hoi dap tai lieu voi Gemini AI")
    st.divider()

    st.subheader("Tai lieu")
    doc_source = st.radio(
        "Chon nguon tai lieu:",
        options=["Dung file mau co san", "Upload file cua toi"]
    )

    uploaded_file = None
    if doc_source == "Upload file cua toi":
        uploaded_file = st.file_uploader(
            "Chon file",
            type=["txt", "pdf", "docx"],
            help="Ho tro .txt, .pdf, .docx"
        )
        if uploaded_file:
            st.caption(f"{uploaded_file.name} - {uploaded_file.size // 1024} KB")

    if st.button("Nap Tai Lieu", type="primary", use_container_width=True):
        with st.spinner("Dang xu ly tai lieu..."):
            try:
                # Khoi tao chatbot lan dau, giu lai trong session_state de tai su dung
                if st.session_state.chatbot is None:
                    st.session_state.chatbot = RAGChatbot()

                if doc_source == "Dung file mau co san":
                    file_path = "data/sach_mau.txt"
                    if not os.path.exists(file_path):
                        st.error("Khong tim thay data/sach_mau.txt")
                        st.stop()
                    st.session_state.chatbot.load_documents(file_path)
                else:
                    if uploaded_file is None:
                        st.warning("Hay chon file truoc khi nhan Nap.")
                        st.stop()
                    # Luu file upload tam thoi vao thu muc data/ truoc khi xu ly
                    temp_path = f"data/temp_{uploaded_file.name}"
                    with open(temp_path, "wb") as f:
                        f.write(uploaded_file.read())
                    # force_rebuild=True vi day la file moi, khong dung cache cu
                    st.session_state.chatbot.load_documents(temp_path, force_rebuild=True)

                st.session_state.doc_loaded = True
                st.success("Nap tai lieu thanh cong!")

            except Exception as e:
                st.error(f"Loi: {str(e)}")

    st.divider()

    if st.session_state.doc_loaded:
        st.success("San sang tra loi")
    else:
        st.warning("Chua nap tai lieu")

    if st.button("Xoa lich su chat", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

    st.divider()

    # Cac cau hoi goi y giup nguoi dung biet nen hoi gi
    st.subheader("Cau hoi goi y")
    suggestions = [
        "Thoi quen buoi sang SAVERS gom nhung gi?",
        "Vong lap thoi quen hoat dong nhu the nao?",
        "Ma tran Eisenhower chia cong viec the nao?",
        "Growth Mindset va Fixed Mindset khac nhau ra sao?",
        "Tap the duc bao nhieu phut moi tuan?",
    ]
    for s in suggestions:
        if st.button(s, key=f"sug_{s[:18]}", use_container_width=True):
            # Luu cau hoi vao session_state roi rerun de dien vao o chat
            st.session_state["prefill"] = s
            st.rerun()

# Phan chinh: tieu de va khu vuc chat
st.title("Hoi Dap Tai Lieu")
st.caption("Chatbot tra loi dua tren noi dung tai lieu ban cung cap — khong bia dat, co nguon ro rang.")
st.divider()

if not st.session_state.doc_loaded and not st.session_state.messages:
    st.info(
        "**Huong dan bat dau:**\n\n"
        "1. Sidebar ben trai — chon **Dung file mau** hoac **Upload file cua toi**\n"
        "2. Nhan **Nap Tai Lieu** va cho xu ly (10-30 giay)\n"
        "3. Dat cau hoi ben duoi\n\n"
        "Ho tro dinh dang: .txt, .pdf, .docx"
    )

# Hien thi lich su toan bo cuoc chat
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])
        # Chi hien thi nguon tham khao voi tin nhan cua assistant
        if msg["role"] == "assistant" and "sources" in msg:
            with st.expander("Xem doan van tham khao"):
                for i, src in enumerate(msg["sources"], 1):
                    st.markdown(f"**Doan {i}:**")
                    st.text(src[:400] + ("..." if len(src) > 400 else ""))
                    if i < len(msg["sources"]):
                        st.divider()

# prefill: neu nguoi dung nhan nut goi y, cau hoi duoc dien san vao day
prefill_text = st.session_state.pop("prefill", "")
question = st.chat_input(
    placeholder="Nhap cau hoi ve tai lieu...",
    disabled=not st.session_state.doc_loaded
)

# Xu ly ca cau hoi tu o nhap lan tu nut goi y
final_question = prefill_text or question

if final_question:
    if not st.session_state.doc_loaded:
        st.error("Hay nap tai lieu truoc. Nhan 'Nap Tai Lieu' o sidebar.")
        st.stop()

    st.session_state.messages.append({"role": "user", "content": final_question})
    with st.chat_message("user"):
        st.write(final_question)

    with st.chat_message("assistant"):
        with st.spinner("Dang tim kiem va tong hop cau tra loi..."):
            result = st.session_state.chatbot.ask(final_question)
        st.write(result["answer"])
        with st.expander("Xem doan van tham khao"):
            for i, src in enumerate(result["sources"], 1):
                st.markdown(f"**Doan {i}:**")
                st.text(src[:400] + ("..." if len(src) > 400 else ""))
                if i < len(result["sources"]):
                    st.divider()

    st.session_state.messages.append({
        "role": "assistant",
        "content": result["answer"],
        "sources": result["sources"]
    })

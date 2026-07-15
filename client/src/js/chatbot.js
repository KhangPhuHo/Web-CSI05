import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
// add collection, addDoc, serverTimestamp for notification:
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { showToast } from './toast.js';

let currentUserId = null;
let currentUserUid = null;
let currentUserRole = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUid = user.uid;
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const userData = docSnap.data();
        currentUserId = userData.id;
        currentUserRole = userData.role;
      }

      await setupPushNotification(user.uid);
      listenForegroundMessages();

    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu người dùng:", error);
      showToast("Lỗi xác thực người dùng.", "error");
    }
  }
});

let chatbotBox, popupNotification, popupTimeout;

// Cac cau hoi goi y hien thi luc chatbot con trong (chua co tin nhan nao)
// giup nguoi dung moi biet nen hoi gi. Co the tuy chinh lai cho phu hop
// voi danh muc sach / dich vu thuc te cua shop.
const SUGGESTED_QUESTIONS = [
  'Sách bán chạy nhất tháng này?',
  'Shop có sách kỹ năng sống không?',
  'Làm sao để đặt hàng và thanh toán?'
];

// Wit.ai access token KHONG con nam o client nua - da chuyen xu ly sang
// backend Node (bien moi truong WIT_ACCESS_TOKEN tren Render).
// Xem ham getWitResponse ben duoi, no goi qua NODE_API_BASE_URL/api/wit-message.

// Backend Node - noi proxy sang RAG chatbot (Python), xem controllers/ragController.js
const NODE_API_BASE_URL = 'https://bookstore-bsjx.onrender.com';

// Cau hinh cho viec tu dong "cho + hoi lai" khi RAG server dang khoi dong (503)
const RAG_MAX_WAIT_MS = 6 * 60 * 1000;   // toi da 6 phut
const RAG_POLL_INTERVAL_MS = 10 * 1000;  // moi 10 giay thu lai 1 lan

// Luu lai vai luot hoi-dap gan nhat (RAM, mat khi tai lai trang) de gui kem
// sang RAG server -> server dung LLM "viet lai cau hoi cho doc lap" truoc khi
// tim FAISS. Nho vay "no con ban bao nhieu" van hieu duoc "no" la sach gi.
let conversationHistory = [];
const MAX_HISTORY_TURNS = 6; // 6 dong = 3 cap hoi-dap gan nhat

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Goi 1 ham fetch (tra ve Promise<Response>) NHIEU LAN cho toi khi response
// khong con la 503 nua (server da san sang), hoac qua thoi gian cho toi da.
// Dung chung cho ca hoi text (askRagChatbot) va goi y tu anh (recommendFromImageRag),
// de nguoi dung khong phai tu bam gui lai moi khi RAG server dang "thuc day".
async function fetchWithRagRetry(doFetch, onWaiting) {
  const startTime = Date.now();
  let hasNotified = false;

  while (true) {
    const response = await doFetch();

    if (response.status !== 503) {
      return response;
    }

    if (Date.now() - startTime > RAG_MAX_WAIT_MS) {
      return response; // qua lau - tra ve 503 cuoi cung, de ham goi tu bao loi
    }

    if (!hasNotified) {
      onWaiting();
      hasNotified = true;
    }

    await sleep(RAG_POLL_INTERVAL_MS);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  createSummonButton();
  createChatbot();
});

function createSummonButton() {
  const bot = document.getElementById("bot");
  bot.innerHTML = `
        <div id="summon" title="Mở chatbot">
          <img src="https://cdn-icons-png.flaticon.com/512/4712/4712027.png" alt="Chatbot" />
        </div>
      `;
  document.getElementById('summon').onclick = toggleChatbot;
}


function createChatbot() {
  chatbotBox = document.createElement('div');
  chatbotBox.id = 'chatbot';
  chatbotBox.innerHTML = `
    <div id="chat-header">
      Chatbot
      <button class="close-popup" id="close-btn" title="Đóng">&times;</button>
    </div>
    <div id="chat-body"></div>
    <div id="chat-input">
      <input type="text" id="user-input" placeholder="Nhập câu hỏi..." autocomplete="off" />
      <input type="file" id="image-input" accept="image/*" hidden />
      <button id="add-image-btn" title="Gửi hình ảnh">
        <i class="fa fa-image" aria-hidden="true"></i>
      </button>
      <button id="send-btn">Gửi</button>
    </div>
  `;
  document.body.appendChild(chatbotBox);

  document.getElementById('close-btn').onclick = toggleChatbot;
  document.getElementById('send-btn').onclick = sendMessage;

  // Nut them hinh anh: bam vao se mo hop thoai chon file (input file dang bi an)
  document.getElementById('add-image-btn').onclick = () => {
    document.getElementById('image-input').click();
  };

  // Khi nguoi dung da chon 1 anh
  document.getElementById('image-input').addEventListener('change', handleImageSelected);

  // Gửi tin nhắn khi nhấn Enter
  document.getElementById('user-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  renderSuggestedQuestions();
}

// Hien 1 bong bong nho voi vai cau hoi goi y ngay khi chatbot con trong,
// bam vao 1 goi y se tu dien vao o input va gui luon (khong can go tay).
// Bong bong nay se tu an di ngay khi nguoi dung gui cau hoi dau tien.
function renderSuggestedQuestions() {
  const chatBody = document.getElementById('chat-body');
  if (!chatBody || SUGGESTED_QUESTIONS.length === 0) return;

  const box = document.createElement('div');
  box.id = 'suggested-questions';
  box.innerHTML = `
    <div style="margin:4px 0 6px; font-size:13px; color:#666;">Bạn có thể hỏi:</div>
    ${SUGGESTED_QUESTIONS.map(q => `<button class="suggestion-chip" type="button">${escapeHtml(q)}</button>`).join('')}
  `;

  box.querySelectorAll('.suggestion-chip').forEach((btn, idx) => {
    btn.onclick = () => {
      const input = document.getElementById('user-input');
      if (!input || input.disabled) return;
      input.value = SUGGESTED_QUESTIONS[idx];
      sendMessage();
    };
  });

  chatBody.appendChild(box);
}

// Go bong bong goi y (goi luc nguoi dung bat dau tu go/gui cau hoi thuc su)
function removeSuggestedQuestions() {
  const box = document.getElementById('suggested-questions');
  if (box) box.remove();
}

function toggleChatbot() {
  if (chatbotBox.classList.contains('show')) {
    chatbotBox.classList.remove('show');
    setTimeout(() => {
      chatbotBox.style.display = 'none';
      showPopupLastMessage();
    }, 300);
  } else {
    chatbotBox.style.display = 'flex';
    setTimeout(() => chatbotBox.classList.add('show'), 10);
    hidePopup();
    document.getElementById('user-input').focus();
  }
}

// Escape ky tu HTML dac biet - tranh nguoi dung go </div>, <script>... bi
// chen thang vao trang (XSS), va la buoc bat buoc TRUOC KHI ap dung markdown ben duoi
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Chuyen markdown CO BAN (**in dam**, gach dau dong bang "* " hoac "- ",
// xuong dong) ma Gemini hay tra ve, thanh HTML that su de hien thi dep hon.
// Khong dung thu vien ngoai - chi can du cho cac dinh dang Gemini thuong tra ve.
function formatBotMessage(text) {
  let safe = escapeHtml(text);

  // **chu dam** -> <strong>chu dam</strong>
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const lines = safe.split(/\r?\n/);
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inList) {
        html += '<ul style="margin:6px 0; padding-left:20px;">';
        inList = true;
      }
      html += `<li>${line.slice(2)}</li>`;
      continue;
    }

    if (inList) {
      html += '</ul>';
      inList = false;
    }

    if (line) {
      html += `<p style="margin:4px 0;">${line}</p>`;
    }
  }

  if (inList) html += '</ul>';

  return html;
}

function addMessage(sender, message, side) {
  const chatBody = document.getElementById('chat-body');
  const msg = document.createElement('div');
  msg.className = `message ${side}`;

  if (side === 'left') {
    // Tin nhan cua bot: parse markdown (in dam, gach dau dong, xuong dong)
    msg.innerHTML = `
      <img src="https://cdn-icons-png.flaticon.com/512/4712/4712027.png" alt="Bot" style="width:30px; height:30px; border-radius:50%; vertical-align:middle; margin-right:8px;">
      <strong>${sender}:</strong>
      <div style="margin-top:4px;">${formatBotMessage(message)}</div>
    `;
  } else {
    // Tin nhan cua nguoi dung: chi escape HTML, khong can parse markdown
    msg.innerHTML = `<strong>${sender}:</strong> ${escapeHtml(message)}`;
  }

  chatBody.appendChild(msg);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Ghi 1 thông báo vào Firestore cho user hiện tại (nếu đã đăng nhập).
// Không throw lỗi ra ngoài - noti fail không được làm gián đoạn trải nghiệm chat.
async function pushNotification(type, title, body) {
  if (!currentUserUid) return; // khách chưa đăng nhập -> bỏ qua, không lưu noti

  try {
    await addDoc(collection(db, "users", currentUserUid, "notifications"), {
      type,
      title,
      body,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Lỗi khi ghi thông báo:", error);
  }
}

// Hien thi 1 tam anh trong khung chat (dung ObjectURL - chi hien thi tam thoi
// trong trinh duyet, khong can doi upload xong moi hien)
function addImageMessage(sender, file, side) {
  const chatBody = document.getElementById('chat-body');
  const msg = document.createElement('div');
  msg.className = `message ${side}`;

  const imgUrl = URL.createObjectURL(file);
  const imgTag = `<img src="${imgUrl}" alt="Hình ảnh" style="max-width:150px; max-height:150px; border-radius:8px; margin-top:4px; display:block;">`;

  if (side === 'left') {
    msg.innerHTML = `
      <img src="https://cdn-icons-png.flaticon.com/512/4712/4712027.png" alt="Bot" style="width:30px; height:30px; border-radius:50%; vertical-align:middle; margin-right:8px;">
      <strong>${sender}:</strong>
      ${imgTag}
    `;
  } else {
    msg.innerHTML = `<strong>${sender}:</strong>${imgTag}`;
  }

  chatBody.appendChild(msg);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Nguoi dung vua chon 1 file anh tu nut "Gui hinh anh"
async function handleImageSelected(event) {
  const file = event.target.files[0];
  event.target.value = ""; // reset de chon lai chinh file nay van kich hoat duoc 'change'

  if (!file) return;

  // Chap nhan HAU HET dinh dang anh pho bien (jpg, png, webp, gif, bmp, svg...)
  // - dua vao MIME type do trinh duyet tu nhan dien, khong gioi han cung 1 danh sach
  if (!file.type.startsWith('image/')) {
    showToast("❌ File này không phải hình ảnh. Vui lòng chọn 1 tệp ảnh (JPG, PNG, WEBP, GIF...).", "error");
    return;
  }

  addImageMessage('Bạn', file, 'right');
  removeSuggestedQuestions();

  const chatBody = document.getElementById('chat-body');
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'message left typing-indicator';
  loadingMsg.textContent = 'Đang xử lý ảnh...';
  chatBody.appendChild(loadingMsg);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const result = await recommendFromImageRag(file);
    loadingMsg.remove();
    addMessage('Chatbot', result.answer, 'left');

    // ✅ Thông báo: chatbot vừa gợi ý xong từ ảnh
    pushNotification(
      "chatbot_reply",
      "Chatbot đã gợi ý sách từ ảnh",
      result.answer.length > 100 ? result.answer.slice(0, 100) + "..." : result.answer
    );

  } catch (error) {
    loadingMsg.remove();
    console.error('Lỗi khi xử lý ảnh:', error);
    addMessage('Chatbot', 'Xin lỗi, mình chưa xử lý được ảnh này. Vui lòng thử lại.', 'left');
  }
}

// Gui anh sang backend Node -> Node proxy tiep sang RAG server (Gemini Vision)
// Tra ve { answer, sources, image_description }
async function recommendFromImageRag(file) {
  const formData = new FormData();
  formData.append('media', file);

  const response = await fetchWithRagRetry(
    () => fetch(`${NODE_API_BASE_URL}/api/recommend-from-image-rag`, {
      method: 'POST',
      body: formData
    }),
    () => addMessage(
      'Chatbot',
      'Hệ thống đang khởi động (server vừa "ngủ dậy", có thể mất vài phút). Mình sẽ gợi ý ngay khi xong, bạn chờ chút nhé!',
      'left'
    )
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Lỗi không xác định từ RAG server.');
  }

  return data;
}

async function processInput(text) {
  if (text.startsWith("/cmd")) {
    return await handleCommand(text);
  } else {
    return await getWitResponse(text);
  }
}

const SUPER_ADMIN_UID = "7ZXC61fOA4beVOjcxwDZFqeYu9y1";

// ⚙️ Cập nhật session local khi đổi quyền
function updateLocalSessionForRoleChange({ isAdmin }) {
  const session = JSON.parse(localStorage.getItem("session"));
  if (session) {
    if (isAdmin) {
      delete session.expired_at;
      session.isAdmin = true;
    } else {
      session.expired_at = Date.now() + 2 * 60 * 60 * 1000;
      session.isAdmin = false;
    }
    localStorage.setItem("session", JSON.stringify(session));
  }
}

async function handleCommand(input) {
  if (currentUserId !== 1 || currentUserRole !== "admin") {
    return "❗ Bạn không có quyền thực hiện lệnh này.";
  }

  const parts = input.trim().split(" ");
  if (parts.length < 2) {
    return "⚠ Lệnh không hợp lệ. Ví dụ:\n- /cmd index.html\n- /cmd user {uid} admin\n- /cmd remove {uid} admin";
  }

  const command = parts[1];

  // 🔁 Chuyển trang
  if (command.endsWith(".html")) {
    setTimeout(() => { window.location.href = command; }, 2000);
    return `🔄 Đang chuyển đến ${command}...`;
  }

  // ✅ Cấp quyền admin
  if (command === "user" && parts.length >= 4 && parts[3] === "admin") {
    const targetUserId = parts[2];

    try {
      await setDoc(doc(db, "users", targetUserId), {
        role: "admin",
        id: 1
      }, { merge: true });

      if (targetUserId === auth.currentUser.uid) {
        updateLocalSessionForRoleChange({ isAdmin: true });
      }

      return `✅ Đã cấp quyền admin cho user ${targetUserId}`;
    } catch (error) {
      console.error("❌ Lỗi khi cấp quyền admin:", error);
      return "❌ Lỗi khi cấp quyền admin.";
    }
  }

  // 🔒 Gỡ quyền admin
  if (command === "remove" && parts.length >= 4 && parts[3] === "admin") {
    const targetUserId = parts[2];

    if (targetUserId === SUPER_ADMIN_UID) {
      return "❗ Không thể gỡ quyền ADMIN GỐC.";
    }

    try {
      await firebase.firestore().collection("users").doc(targetUserId).set({
        role: "customer",
        id: 2
      }, { merge: true });

      if (targetUserId === firebase.auth().currentUser.uid) {
        updateLocalSessionForRoleChange({ isAdmin: false });
      }

      return `✅ Đã gỡ quyền admin khỏi user ${targetUserId}`;
    } catch (error) {
      console.error("❌ Lỗi khi gỡ quyền admin:", error);
      return "❌ Lỗi khi gỡ quyền admin.";
    }
  }

  // 🚫 Ban (xoá) người dùng
  if (command === "user" && parts.length >= 4 && parts[3] === "ban") {
    console.log("Lệnh ban được kích hoạt");

    const targetUserId = parts[2];

    if (!currentUserUid) {
      return "❗ Không xác định được UID người dùng hiện tại.";
    }

    if (currentUserUid !== SUPER_ADMIN_UID) {
      return "❌ Bạn không có quyền dùng lệnh này.";
    }

    if (targetUserId === SUPER_ADMIN_UID) {
      return "❌ Không thể xoá người dùng đặc biệt này.";
    }

    try {
      const response = await fetch('https://bookstore-bsjx.onrender.com/deleteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterUid: currentUserUid,
          targetUid: targetUserId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return "❌ " + (data.error || "Lỗi không xác định.");
      }

      return data.message || "✅ Đã xoá người dùng.";
    } catch (error) {
      console.error(error);
      return "❌ Lỗi không xác định khi gọi API.";
    }
  }

  return "⚠ Lệnh không hợp lệ hoặc chưa hỗ trợ.";
}

// Gui cau hoi sang backend Node -> Node proxy tiep sang RAG server (Gemini)
async function askRagChatbot(question) {
  try {
    const response = await fetchWithRagRetry(
      () => fetch(`${NODE_API_BASE_URL}/api/ask-rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Gui kem lich su hoi-dap gan nhat (KHONG bao gom cau hoi hien tai) de
        // server viet lai cau hoi cho doc lap truoc khi tim FAISS
        // Mới - gửi kèm userId để Node biết gửi noti cho ai:
        body: JSON.stringify({ question, history: conversationHistory, userId: currentUserUid })
      }),
      () => addMessage(
        'Chatbot',
        'Hệ thống gợi ý sách đang khởi động (server vừa "ngủ dậy", có thể mất vài phút). Mình sẽ tự trả lời ngay khi sẵn sàng, bạn chờ chút nhé!',
        'left'
      )
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Lỗi từ RAG chatbot:', data);

      // Van con 503 sau khi da thu het thoi gian cho toi da
      if (response.status === 503) {
        return 'Xin lỗi, hệ thống khởi động hơi lâu. Bạn vui lòng hỏi lại giúp mình sau ít phút nhé!';
      }

      return 'Xin lỗi, mình chưa trả lời được câu này. Vui lòng thử lại sau.';
    }

    // Cap nhat lich su hoi thoai: them luot nay vao cuoi, chi giu MAX_HISTORY_TURNS
    // dong gan nhat (cat bot dong cu de payload gui di khong phinh to dan)
    conversationHistory.push({ role: 'user', content: question });
    conversationHistory.push({ role: 'assistant', content: data.answer });
    if (conversationHistory.length > MAX_HISTORY_TURNS) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);
    }

    // ✅ Thông báo: chatbot vừa trả lời xong
    pushNotification(
      "chatbot_reply",
      "Chatbot đã trả lời",
      data.answer.length > 100 ? data.answer.slice(0, 100) + "..." : data.answer
    );

    return data.answer;

  } catch (error) {
    console.error('Lỗi khi gọi RAG chatbot:', error);
    return 'Xin lỗi, có lỗi khi kết nối tới hệ thống gợi ý sách.';
  }
}

// Goi Wit.ai THONG QUA backend Node (khong goi thang tu client nua) de token
// khong bi lo ra trinh duyet. Backend se doc WIT_ACCESS_TOKEN tu bien moi
// truong va tra ve nguyen JSON cua Wit.ai (xem route mau /api/wit-message).
async function getWitResponse(input) {
  try {
    const res = await fetch(`${NODE_API_BASE_URL}/api/wit-message?q=${encodeURIComponent(input)}`);
    const data = await res.json();

    let intent = 'none';
    if (data.intents && data.intents.length > 0) {
      intent = data.intents[0].name;
    }

    switch (intent) {
      case 'greeting':
        return 'Xin chào! Tôi có thể giúp gì cho bạn?';
      case 'ask_features':
        return 'Tôi có chức năng trò chuyện, giải đáp các thắc mắc của bạn về sản phẩm và dịch vụ bên chúng tôi';
      case 'thank':
        return 'Cảm ơn bạn vì đã tin tưởng dịch vụ bên mình';
      case 'goodbye':
        return 'Cảm ơn bạn, hẹn gặp lại!';
      case 'ask_product':
      case 'products_by_category':
      case 'get_price_of_product':
      case 'check_stock':
      case 'compare_price':
      case 'top_rated_products':
      case "product_detail":
      case 'buy_product':
        // Cau hoi ve san pham cu the (gia, ton kho, the loai, goi y sach...)
        // -> day sang RAG chatbot (Gemini) de tra loi dua tren du lieu that
        return await askRagChatbot(input);
      default:
        // Intent khong ro / Wit.ai chua nhan dien duoc -> van thu hoi RAG chatbot,
        // vi rat co the day la cau hoi ve sach ma Wit.ai chua duoc train du
        return await askRagChatbot(input);
    }
  } catch (error) {
    console.error('Lỗi gọi Wit.ai:', error);
    return 'Xin lỗi, có lỗi khi xử lý yêu cầu của bạn.';
  }
}

// Khoa/mo o nhap + nut gui (va nut anh) trong luc cho chatbot tra loi,
// tranh nguoi dung bam gui lien tuc gay don cau hoi / nghen server
function setInputLocked(locked) {
  const input = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const imageBtn = document.getElementById('add-image-btn');

  if (input) {
    input.disabled = locked;
    input.placeholder = locked ? 'Đang trả lời...' : 'Nhập câu hỏi...';
  }
  if (sendBtn) sendBtn.disabled = locked;
  if (imageBtn) imageBtn.disabled = locked;

  if (!locked && input) input.focus();
}

async function sendMessage() {
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (text === '') return;

  removeSuggestedQuestions();

  addMessage('Bạn', text, 'right');
  input.value = '';

  setInputLocked(true);

  const chatBody = document.getElementById('chat-body');
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'message left typing-indicator';
  loadingMsg.textContent = 'Đang trả lời...';
  chatBody.appendChild(loadingMsg);
  chatBody.scrollTop = chatBody.scrollHeight;

  setTimeout(async () => {
    try {
      const response = await processInput(text); // 👉 xử lý command hoặc gọi Wit.ai
      addMessage('Chatbot', response, 'left');

      if (typeof chatbotBox !== 'undefined' && chatbotBox.style.display === 'none') {
        showPopup(response);
      }
    } catch (error) {
      console.error('Lỗi khi xử lý tin nhắn:', error);
      addMessage('Chatbot', 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.', 'left');
    } finally {
      loadingMsg.remove();
      setInputLocked(false);
    }
  }, 1500);
}

function showPopup(message) {
  hidePopup();
  popupNotification = document.createElement('div');
  popupNotification.id = 'chat-popup';
  popupNotification.textContent = message;
  popupNotification.onclick = toggleChatbot;
  document.body.appendChild(popupNotification);
  popupTimeout = setTimeout(hidePopup, 5000);
}

function hidePopup() {
  if (popupNotification) {
    popupNotification.remove();
    popupNotification = null;
  }
  if (popupTimeout) clearTimeout(popupTimeout);
}

function showPopupLastMessage() {
  const chatBody = document.getElementById('chat-body');
  const lastMsg = chatBody.querySelector('.left:last-child');
  if (lastMsg) showPopup(lastMsg.textContent);
}
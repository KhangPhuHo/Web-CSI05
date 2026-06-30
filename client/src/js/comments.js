// ✅ comment.js (Phiên bản cập nhật: Toggle ghim admin UI)
import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  doc,
  getDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { showToast } from "./toast.js";

const session = JSON.parse(localStorage.getItem("user_session") || "{}");

let currentUser = {
  uid: session?.userId || null,
  email: session?.email || null,
  role: session?.isAdmin ? "admin" : "customer", // Tạm gán
  name: "Anonymous",
  avatar: ""
};

if (currentUser.uid) {
  (async () => {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        currentUser.name = userData.name || currentUser.name;
        currentUser.avatar = userData.avatar || currentUser.avatar;
        currentUser.role = userData.role || currentUser.role;
      }
    } catch (err) {
      console.warn("Không thể tải thông tin người dùng:", err);
    }
  })();
} else {
  // ✅ Nếu không đăng nhập, chặn input/comment UI
  document.getElementById("comment-input").placeholder = "Bạn cần đăng nhập để bình luận.";
  document.getElementById("comment-input").disabled = true;
  document.getElementById("submit-comment").disabled = true;
}

function formatTime(timestamp) {
  const date = timestamp?.toDate?.();
  return date ? date.toLocaleString("vi-VN", {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  }) : "";
}

const REACTION_EMOJIS = ["❤️", "😄", "😲", "😢", "😡"];

let pinnedBox = null;

async function loadComments(postId) {
  const q = query(collection(db, "comments"), where("postId", "==", postId));
  const commentList = document.getElementById("comments-list");
  const pinnedBox = document.getElementById("admin-pinned");
  const wrapper = document.getElementById("admin-pinned-wrapper");


  onSnapshot(q, async (snapshot) => {
    commentList.innerHTML = "";
    pinnedBox.innerHTML = "";

    if (wrapper?.dataset.visible === "false") {
      pinnedBox.style.display = "none";
      return;
    }

    pinnedBox.style.display = "block";

    if (snapshot.empty) {
      commentList.innerHTML = `<p class="text-gray-500 text-sm">No comments yet.</p>`;
      pinnedBox.innerHTML = `
      <div class="text-center text-sm italic text-gray-400 mt-8">
        Hiện tại chưa có thông báo nào từ admin.
      </div>`;
      return;
    }

    // Lấy toàn bộ comment kèm thông tin user
    const comments = await Promise.all(snapshot.docs.map(async (docSnap) => {
      const comment = { id: docSnap.id, ...docSnap.data() };
      try {
        const userSnap = await getDoc(doc(db, "users", comment.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          comment.name = userData.name || "Anonymous";
          comment.avatar = userData.avatar || "";
          comment.role = userData.role || "customer";
          comment.isDeletedUser = false;
        } else {
          // User đã bị xoá
          comment.name = "🗑 Tài khoản đã bị xoá";
          comment.avatar = ""; // hoặc avatar mặc định
          comment.role = "deleted";
          comment.text = "Tin nhắn đã bị xoá";
          comment.isDeletedUser = true;
        }
      } catch (err) {
        console.warn("Không thể lấy user:", err);
        comment.role = "customer";
        comment.isDeletedUser = false;
      }
      return comment;
    }));

    // ✅ Xác định bình luận admin mới nhất (đảm bảo đã có role rồi)
    const pinnedAdminComment = comments
      .filter(c => c.role === "admin")
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];

    if (pinnedAdminComment) {
      pinnedBox.innerHTML = `
      <div class="flex items-start bg-indigo-700/40 border border-indigo-400 rounded-xl p-3 shadow-md animate-fade-up max-w-full">
        <img src="${pinnedAdminComment.avatar}" class="w-10 h-10 rounded-full object-cover mr-3 flex-shrink-0" />
        <div class="flex flex-col">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-yellow-300 font-bold text-base">${pinnedAdminComment.name}</span>
            <span class="text-pink-400 text-xs">[Admin ghim]</span>
          </div>
          <div class="flex items-center gap-2 mb-1 text-white text-sm leading-snug">
            ${pinnedAdminComment.text || ""}
          </div>
          ${Array.isArray(pinnedAdminComment.media) && pinnedAdminComment.media.length > 0
          ? `<div class="flex flex-wrap gap-2 mt-2">` +
          pinnedAdminComment.media.map(({ url, type }) =>
            type === "video"
              ? `<video controls src="${url}" class="w-32 rounded max-h-[100px]"></video>`
              : `<img src="${url}" class="w-20 h-20 object-cover rounded" />`
          ).join("") + `</div>`
          : ""}
        </div>
      </div>
    `;
    } else {
      pinnedBox.innerHTML = `
      <div class="text-center text-sm italic text-gray-400 mt-8">
        Hiện tại chưa có thông báo nào từ admin.
      </div>
    `;
    }

    // ✅ Render các comment còn lại
    const filteredComments = comments.filter(c => c.id !== pinnedAdminComment?.id);
    filteredComments.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
      .forEach(c => commentList.appendChild(renderComment(c)));

    commentList.scrollTop = commentList.scrollHeight;
  });
}

function scrollToPinned() {
  const pinnedWrapper = document.getElementById("admin-pinned-wrapper");
  if (pinnedWrapper) pinnedWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderComment(comment) {
  const isMe = comment.uid === currentUser?.uid;
  const isAdmin = comment.role === 'admin';
  const isDeletedUser = comment.isDeletedUser === true;

  const avatar = comment.avatar || 'https://www.gravatar.com/avatar?d=mp&s=200';
  const sideClass = isMe ? 'justify-end' : 'justify-start';
  const messageAlign = isMe ? 'flex-row-reverse' : 'flex-row';
  const colorClass = isAdmin ? 'border-pink-500 border-2' : 'border-white/10';
  const timeText = formatTime(comment.createdAt);

  const mediaHTML = Array.isArray(comment.media)
    ? `<div class="flex flex-wrap gap-2 mt-1">` + comment.media.map(({ url, type }) => {
      return type === "video"
        ? `<video controls src="${url}" class="w-32 rounded cursor-pointer hover:opacity-80" onclick="this.requestFullscreen()"></video>`
        : `<div class="relative inline-block">
             <img src="${url}" class="w-24 h-24 object-cover rounded cursor-pointer hover:opacity-80" onclick="previewImage('${url}')" />
             <a href="${url}" download class="absolute top-1 right-1 text-white text-xs bg-black/50 px-1 rounded">⬇</a>
           </div>`;
    }).join("") + `</div>` : "";

  const container = document.createElement("div");
  container.className = `flex ${sideClass}`;
  container.title = comment.name;

  // Nếu user đã xoá, đổi style và ẩn phần reaction, emoji
  if (isDeletedUser) {
    container.innerHTML = `
      <div class="flex ${messageAlign} gap-2 max-w-[80%] opacity-50 italic text-gray-400 select-none pointer-events-none">
        <img src="https://www.gravatar.com/avatar?d=mp&s=200" class="w-8 h-8 rounded-full object-cover self-end" />
        <div class="bg-white/10 p-2 rounded-lg border border-gray-500 text-sm relative">
          <p class="font-semibold">${comment.name}</p>
          <p>${comment.text || ""}</p>
        </div>
      </div>
    `;
    return container;
  }

  // Nếu bình luận bình thường, render bình thường (giữ nguyên code bạn có)
  container.innerHTML = `
    <div class="flex ${messageAlign} gap-2 max-w-[80%]">
      <img src="${avatar}" class="w-8 h-8 rounded-full object-cover self-end" />
      <div class="bg-white/10 p-2 rounded-lg ${colorClass} text-sm relative">
        <p class="font-semibold">
          ${comment.name} ${isAdmin ? '<span class="text-pink-400 ml-1 text-xs">[Admin]</span>' : ''}
        </p>
        <p>${comment.text || ""}</p>
        ${mediaHTML}
        <div class="text-xs text-gray-400 mt-2 flex justify-between items-center">
          <button class="emoji-toggle text-xl text-white/60 hover:text-yellow-300" title="Reaction">
            <i class="fa-solid fa-face-smile"></i>
          </button>
          <span>${timeText}</span>
        </div>
        <div class="hidden emoji-dropdown bg-white text-black rounded shadow absolute left-0 bottom-[-45px] z-10 px-2 py-1"></div>
        <div class="reaction-group flex gap-2 mt-1"></div>
      </div>
    </div>
  `;

  const emojiBtn = container.querySelector(".emoji-toggle");
  const dropdown = container.querySelector(".emoji-dropdown");
  const reactionBox = container.querySelector(".reaction-group");
  const reactRef = collection(db, "comments", comment.id, "reactions");

  emojiBtn.onclick = () => {
    dropdown.classList.toggle("hidden");
    dropdown.innerHTML = REACTION_EMOJIS.map(e => `<button class="px-1 emoji-pick text-lg hover:scale-110" data-emoji="${e}">${e}</button>`).join("");
    dropdown.querySelectorAll(".emoji-pick").forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        const emoji = btn.dataset.emoji;
        const docRef = doc(reactRef, `${currentUser.uid}_${emoji}`);
        const existing = await getDoc(docRef);
        if (existing.exists()) {
          await deleteDoc(docRef);
        } else {
          await setDoc(docRef, { emoji, uid: currentUser.uid });
          dropdown.classList.add("hidden");
        }
      };
    });
  };

  onSnapshot(reactRef, snap => {
    const emojiMap = {};
    snap.forEach(doc => {
      const { emoji, uid } = doc.data();
      if (!emojiMap[emoji]) emojiMap[emoji] = [];
      emojiMap[emoji].push(uid);
    });
    reactionBox.innerHTML = Object.entries(emojiMap).map(([emoji, uids]) => {
      const count = uids.length;
      const tooltip = uids.map(id => id === currentUser.uid ? "Bạn" : id).join(", ");
      return `<span title="${tooltip}" class="text-white text-sm">${emoji} <span class="text-xs">${count}</span></span>`;
    }).join("");
  });

  return container;
}

function setupCommentSubmit(postId) {
  const form = document.getElementById("comment-form");
  const input = document.getElementById("comment-input");
  const fileInput = document.getElementById("comment-image");
  const emojiBtn = document.getElementById("emoji-toggle");
  const emojiBox = document.getElementById("emoji-box");
  const submitBtn = document.getElementById("submit-comment");
  const stickers = document.querySelectorAll(".sticker-option");
  const previewBox = document.getElementById("media-preview");

    // ✅ Ngăn người chưa đăng nhập
  if (!currentUser.uid) {
    input.placeholder = "Bạn cần đăng nhập để bình luận.";
    input.disabled = true;
    submitBtn.disabled = true;
    // ❌ Không gán sự kiện sticker nếu chưa đăng nhập
    stickers?.forEach(btn => {
      btn.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
    });
    return;
  }

  let sending = false;
  let selectedFiles = [];

  // ✅ Preview media khi chọn
  function renderPreview() {
    previewBox.innerHTML = "";

    if (selectedFiles.length === 0) {
      previewBox.classList.add("hidden");
      return;
    }

    selectedFiles.forEach(file => {
      const fileURL = URL.createObjectURL(file);
      const isVideo = file.type.startsWith("video");

      const previewEl = document.createElement("div");
      previewEl.className = "relative group";

      previewEl.innerHTML = isVideo
        ? `<video src="${fileURL}" class="w-24 h-20 rounded border border-gray-500" muted></video>`
        : `<img src="${fileURL}" class="w-20 h-20 object-cover rounded border border-gray-500" />`;

      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = "×";
      removeBtn.title = "Xóa";
      removeBtn.className = "absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow";
      removeBtn.onclick = () => removeFile(file.name);

      previewEl.appendChild(removeBtn);
      previewBox.appendChild(previewEl);
    });

    previewBox.classList.remove("hidden");
  }

  // ✅ Khi chọn file mới
  fileInput.addEventListener("change", () => {
    selectedFiles = [...fileInput.files];
    renderPreview();
  });

  // ✅ Xóa file khỏi preview + input
  function removeFile(name) {
    selectedFiles = selectedFiles.filter(file => file.name !== name);
    const dataTransfer = new DataTransfer();
    selectedFiles.forEach(f => dataTransfer.items.add(f));
    fileInput.files = dataTransfer.files;
    renderPreview();
  }

  // ✅ Gửi sticker
stickers?.forEach(btn => {
  btn.addEventListener("click", async () => {
    const stickerUrl = btn.dataset.url;
    await addDoc(collection(db, "comments"), {
      postId,
      uid: currentUser.uid,
      name: currentUser.name,
      avatar: currentUser.avatar,
      role: currentUser.role,
      text: "",
      media: [{ url: stickerUrl, type: "image" }],
      createdAt: serverTimestamp(),
    });
  });
});


  // ✅ Gửi bình luận
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (sending) return;

    if (!currentUser.uid) {
      showToast("Bạn cần đăng nhập để gửi bình luận.", "error");
      return; // dừng gửi
    }

    const text = input.value.trim();
    const files = selectedFiles;
    if (!text && files.length === 0) return;
    if (files.length > 5) return alert("Tối đa 5 file mỗi lần.");

    submitBtn.innerHTML = `<i class='fa fa-spinner animate-spin'></i>`;
    sending = true;

    let media = [];
    try {
      const uploads = await Promise.all(files.map(async (file) => {
        if (file.size > 150 * 1024 * 1024) throw new Error(`File ${file.name} quá 150MB`);
        const formData = new FormData();
        formData.append("media", file);
        const res = await fetch("https://shapespeaker.onrender.com/upload", { method: "POST", body: formData });
        const result = await res.json();
        if (!result?.data?.secure_url) throw new Error("Upload thất bại");
        return { url: result.data.secure_url, type: file.type.startsWith("video") ? "video" : "image" };
      }));
      media = uploads;
    } catch (err) {
      alert("Upload lỗi: " + err.message);
      submitBtn.innerHTML = `<i class='fa-solid fa-paper-plane'></i>`;
      sending = false;
      return;
    }

    await addDoc(collection(db, "comments"), {
      postId,
      uid: currentUser.uid,
      name: currentUser.name,
      avatar: currentUser.avatar,
      role: currentUser.role,
      text,
      media,
      createdAt: serverTimestamp(),
    });

    // ✅ Reset sau khi gửi
    input.value = "";
    fileInput.value = null;
    selectedFiles = [];
    renderPreview(); // Xóa preview
    emojiBox?.classList.add("hidden");

    let seconds = 5;
    const countdown = setInterval(() => {
      submitBtn.innerText = `${seconds}s`;
      if (--seconds < 0) {
        clearInterval(countdown);
        submitBtn.innerHTML = `<i class='fa-solid fa-paper-plane'></i>`;
        sending = false;
      }
    }, 1000);
  };

  // ✅ Gửi bằng Enter
  input.addEventListener("keydown", (e) => {
    const isTypingInInput = document.activeElement === input;
    if (e.key === "Enter" && !e.shiftKey && isTypingInInput) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // ✅ Toggle emoji
  emojiBtn?.addEventListener("click", () => {
    emojiBox.classList.toggle("hidden");
  });

  emojiBox?.addEventListener("click", (e) => {
    if (e.target?.tagName === "BUTTON") {
      e.preventDefault();
      e.stopPropagation();
      input.value += e.target.textContent;
      input.focus();
    }
  });
}

function previewImage(url) {
  const modal = document.getElementById("image-preview-modal");
  const img = document.getElementById("preview-image");
  const video = document.getElementById("preview-video");
  const closeBtn = document.getElementById("close-preview");

  const isVideo = url.match(/\.(mp4|webm|ogg)$/i);

  if (isVideo) {
    video.src = url;
    video.classList.remove("hidden");
    img.classList.add("hidden");
    img.src = "";
  } else {
    img.src = url;
    img.classList.remove("hidden");
    video.classList.add("hidden");
    video.pause();
    video.src = "";
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex", "animate-fade-in");
  document.body.style.overflow = "hidden";

  const closeModal = () => {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
    img.src = "";
    video.pause();
    video.src = "";
    document.body.style.overflow = "";
  };

  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  img.onclick = (e) => e.stopPropagation();
  video.onclick = (e) => e.stopPropagation();
  closeBtn.onclick = closeModal;
}

function togglePinned() {
  const wrapper = document.getElementById("admin-pinned-wrapper");
  const btn = document.getElementById("pinned-toggle-btn");
  if (wrapper && btn) {
    const isVisible = wrapper.dataset.visible !== "false";
    wrapper.dataset.visible = (!isVisible).toString();
    document.getElementById("admin-pinned").style.display = isVisible ? "none" : "block";
    btn.classList.toggle("bg-indigo-500", !isVisible);
    btn.classList.toggle("bg-white/10", isVisible);
  }
}

window.togglePinned = togglePinned;
window.previewImage = previewImage;
window.scrollToPinned = scrollToPinned;

export { loadComments, setupCommentSubmit, previewImage, scrollToPinned };
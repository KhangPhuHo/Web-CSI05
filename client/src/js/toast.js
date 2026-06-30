// ✅ toast.js
export function showToast(message, type = "info", duration = 3000) {
  let toastContainer = document.getElementById("toast-container");

  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.className = `
      fixed top-5 right-5 z-[9999]
      flex flex-col gap-3 items-end max-w-sm w-full
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.classList.add(
    "animate-fade-in-up", "transition-all", "rounded-lg", "shadow-md",
    "px-4", "py-3", "text-white", "w-full", "flex", "items-start", "justify-between", "gap-3"
  );

  switch (type) {
    case "success": toast.classList.add("bg-green-600"); break;
    case "error": toast.classList.add("bg-red-500"); break;
    case "info": toast.classList.add("bg-blue-500"); break;
    case "warning": toast.classList.add("bg-yellow-500", "text-black"); break;
  }

  toast.innerHTML = `
    <span class="flex-1">${message}</span>
    <button class="font-bold text-lg hover:opacity-70" onclick="this.parentElement.remove()">×</button>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("animate-fade-in-up");
    toast.classList.add("animate-fade-out-up");
    setTimeout(() => toast.remove(), 500);
  }, duration);
}

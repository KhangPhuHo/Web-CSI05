// ✅ Phiên bản đầy đủ với Layer Manager nâng cao, snap, multi-select, resize 8 góc, border vàng, edit text, z-index control
// ✅ Phiên bản đầy đủ: Layer Manager, snap, multi-select, resize 8 góc, scroll block theo vị trí
import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { showToast } from './toast.js';

const canvas = document.getElementById("editable-area");
const addTextBtn = document.getElementById("add-text");
const addImageBtn = document.getElementById("add-image");
const addQuoteBtn = document.getElementById("add-quote");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const saveBtn = document.getElementById("save-content");
const imagePicker = document.getElementById("image-picker");
const toolOptions = document.getElementById("tool-options");
const fontSizeSlider = document.getElementById("font-size-slider");
const colorPicker = document.getElementById("font-color-picker");
const boldToggle = document.getElementById("bold-toggle");


const layerPanel = document.createElement("div");
layerPanel.id = "layer-panel";
layerPanel.className = "absolute top-3 right-3 bg-gray-800 border border-white/10 rounded p-2 max-h-[60vh] overflow-y-auto z-[999]";
layerPanel.innerHTML = `<h3 class='text-yellow-400 font-semibold mb-2 text-sm'>Layer</h3>`;
document.body.appendChild(layerPanel);

let selectedBlock = null;
let selectedBlocks = new Set();
let history = [];
let redoStack = [];

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id") || urlParams.get("productId");
if (!productId) alert("Thiếu productId trên URL!");

canvas.addEventListener("click", handleCanvasClick);

function handleCanvasClick(e) {
  const block = e.target.closest(".block-item");
  if (!block) return;
  if (e.shiftKey) {
    selectedBlocks.has(block) ? selectedBlocks.delete(block) : selectedBlocks.add(block);
  } else {
    selectedBlocks.clear();
    selectedBlocks.add(block);
  }
  selectedBlock = block;
  highlightSelectedBlocks();
  updateToolOptions(block);
  updateBadgeHandle();
  block.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

const popupMenu = document.getElementById("block-popup-menu");
const popupDelete = document.getElementById("popup-delete");
const popupDuplicate = document.getElementById("popup-duplicate");
const popupBringFront = document.getElementById("popup-bring-front");
const popupSendBack = document.getElementById("popup-send-back");

let popupTarget = null;

// Chuột phải block => hiện popup
canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
  const block = e.target.closest(".block-item");
  if (!block) return hidePopup();

  popupTarget = block;

  // Canh giữa theo block
  const rect = block.getBoundingClientRect();
  popupMenu.style.left = rect.left + rect.width / 2 + "px";
  popupMenu.style.top = rect.top - 40 + window.scrollY + "px"; // 40px lên trên
  popupMenu.style.transform = "translateX(-50%)";
  popupMenu.classList.remove("hidden");
});

// Click ra ngoài => ẩn
document.addEventListener("click", e => {
  if (!popupMenu.contains(e.target)) hidePopup();
});

// Chuột phải ngoài block => ẩn
document.addEventListener("contextmenu", e => {
  if (!e.target.closest(".block-item")) hidePopup();
});

function hidePopup() {
  popupMenu.classList.add("hidden");
  popupTarget = null;
}

popupDelete.onclick = () => {
  if (popupTarget) {
    const trashSound = document.getElementById("trash-sound");
    if (trashSound) trashSound.play().catch(() => { }); // tránh lỗi autoplay block

    popupTarget.remove();
    saveState();
    hidePopup();
  }
};

popupDuplicate.onclick = () => {
  if (popupTarget) {
    const dupSound = document.getElementById("duplicate-sound");
    if (dupSound) dupSound.play().catch(() => { });

    const type = popupTarget.dataset.type;
    let content = "";

    if (type === "text" || type === "quote") {
      content = popupTarget.innerText;
    } else if (type === "image") {
      content = popupTarget.querySelector("img")?.src || "";
    }

    const style = {
      x: popupTarget.offsetLeft + 20,
      y: popupTarget.offsetTop + 20,
      width: popupTarget.offsetWidth,
      height: popupTarget.offsetHeight,
      zIndex: (parseInt(popupTarget.style.zIndex) || 100) + 1,
      fontSize: popupTarget.style.fontSize,
      color: popupTarget.style.color,
      bold: popupTarget.style.fontWeight === "bold",
      align: popupTarget.style.textAlign,
    };

    const newBlock = createBlock(type, content, style);
    newBlock.dataset.rotation = popupTarget.dataset.rotation || "0";
    newBlock.style.transform = `rotate(${newBlock.dataset.rotation}deg)`;

    selectedBlock = newBlock;
    selectedBlocks.clear();
    selectedBlocks.add(newBlock);
    highlightSelectedBlocks();
    updateToolOptions(newBlock);
    updateBadgeHandle();
    updateLayerPanel();
    saveState();
    hidePopup();
  }
};

popupBringFront.onclick = () => {
  if (!popupTarget) return;

  const allBlocks = [...canvas.querySelectorAll(".block-item")];
  const zIndexes = allBlocks.map(b => parseInt(b.style.zIndex) || 100);
  const maxZ = Math.max(...zIndexes);

  if (maxZ >= 2000) {
    showToast("Không thể đưa lên trên: đã đạt giới hạn z-index (2000)");
    return;
  }

  popupTarget.style.zIndex = maxZ + 1;
  saveState();
  updateLayerPanel();
  checkOverlap(popupTarget);
  hidePopup();
};

popupSendBack.onclick = () => {
  if (!popupTarget) return;

  const allBlocks = [...canvas.querySelectorAll(".block-item")];
  const zIndexes = allBlocks.map(b => parseInt(b.style.zIndex) || 100);
  const minZ = Math.min(...zIndexes);

  if (minZ <= 100) {
    showToast("Không thể lùi xuống dưới: đã đạt giới hạn z-index (100)");
    return;
  }

  popupTarget.style.zIndex = minZ - 1;
  saveState();
  updateLayerPanel();
  checkOverlap(popupTarget);
  hidePopup();
};

function updateCanvasHeight() {
  const canvasArea = document.getElementById("canvas-area");
  const blocks = [...canvas.querySelectorAll(".block-item")];
  if (!blocks.length) return;

  let maxBottom = 0;
  blocks.forEach(block => {
    const bottom = block.offsetTop + block.offsetHeight;
    maxBottom = Math.max(maxBottom, bottom);
  });

  const newHeight = maxBottom + 100;
  canvas.style.height = newHeight + "px";
}

function autoScrollCanvas(ev) {
  const canvasArea = document.getElementById("canvas-area");
  if (!canvasArea) return;

  const rect = canvasArea.getBoundingClientRect();
  const threshold = 80;

  const distToBottom = rect.bottom - ev.clientY;
  const distToTop = ev.clientY - rect.top;

  // Nếu chuột gần đáy ⇒ cuộn xuống (nhanh dần)
  if (distToBottom < threshold) {
    const speed = Math.max(2, (threshold - distToBottom) / 5);
    canvasArea.scrollTop += speed;
  }

  // Nếu chuột gần đỉnh ⇒ cuộn lên (nhanh dần)
  if (distToTop < threshold) {
    const speed = Math.max(2, (threshold - distToTop) / 5);
    canvasArea.scrollTop -= speed;
  }
}

function enforceBoundary(block) {
  const canvas = document.getElementById("editable-area");
  if (!canvas) return;

  const canvasRect = canvas.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();

  // --- Chiều ngang: trái / phải ---
  const overLeft = blockRect.left < canvasRect.left;
  const overRight = blockRect.right > canvasRect.right;

  if (overLeft) {
    const shift = canvasRect.left - blockRect.left;
    block.style.left = (block.offsetLeft + shift) + "px";
  } else if (overRight) {
    const shift = blockRect.right - canvasRect.right;
    block.style.left = (block.offsetLeft - shift) + "px";
  }

  // --- Chiều dọc: trên ---
  const overTop = blockRect.top < canvasRect.top;

  if (overTop) {
    const shift = canvasRect.top - blockRect.top;
    block.style.top = (block.offsetTop + shift) + "px";
  }

  updateCanvasHeight(); // cập nhật chiều cao khi thay đổi vị trí
}


const rotateSlider = document.getElementById("rotateSlider");
const rotateLabel = document.getElementById("rotate-angle");
const rotateResetBtn = document.getElementById("reset-rotate");
const rotateOptions = document.getElementById("rotate-options");

function removeGuides() {
  document.querySelectorAll('.alignment-guide, .distance-label').forEach(el => el.remove());
}

function updateRotateOptions(block) {
  if (!block || !rotateSlider || !rotateLabel || !rotateOptions) return;
  const deg = parseFloat(block.dataset.rotation || "0");
  rotateSlider.value = deg;
  rotateLabel.textContent = `${Math.round(deg)}°`;
  rotateOptions.classList.remove("hidden");
}

if (rotateSlider && rotateLabel && rotateResetBtn) {
  // Khi kéo slider
  rotateSlider.oninput = () => {
    if (!selectedBlock) return;
    const deg = parseFloat(rotateSlider.value);
    selectedBlock.style.transform = `rotate(${deg}deg)`;
    selectedBlock.dataset.rotation = deg;
    rotateLabel.textContent = `${Math.round(deg)}°`;
    showAlignmentGuides(selectedBlock); // ✅ hiển thị canh chỉnh
  };

  // Khi buông chuột hoặc rời khỏi thanh trượt → xoá guide
  ["mouseup", "mouseleave", "touchend"].forEach(event => {
    rotateSlider.addEventListener(event, removeGuides);
  });

  // Khi bấm nút reset
  rotateResetBtn.onclick = () => {
    if (!selectedBlock) return;
    selectedBlock.style.transform = `rotate(0deg)`;
    selectedBlock.dataset.rotation = 0;
    rotateSlider.value = 0;
    rotateLabel.textContent = "0°";

    showAlignmentGuides(selectedBlock); // ✅ tạm hiện lại
    setTimeout(removeGuides, 400);      // ✅ xoá nhẹ nhàng sau 400ms
    saveState();
  };
}

function updateBadgeHandle() {
  // Xóa tất cả badge và rotate cũ
  document.querySelectorAll('.block-badge-handle, .rotate-handle').forEach(el => el.remove());

  if (!selectedBlock) return;

  // === 1. Drag Handle (top-right) ===
  const dragHandle = document.createElement('div');
  dragHandle.className = 'block-badge-handle';
  Object.assign(dragHandle.style, {
    position: 'absolute',
    top: '-12px',
    right: '-12px',
    width: '16px',
    height: '16px',
    background: '#60a5fa',
    borderRadius: '50%',
    border: '2px solid white',
    cursor: 'grab',
    zIndex: '1000'
  });

  selectedBlock.append(dragHandle);

  dragHandle.addEventListener('mousedown', e => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const initLeft = selectedBlock.offsetLeft, initTop = selectedBlock.offsetTop;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      selectedBlock.style.left = initLeft + dx + 'px';
      selectedBlock.style.top = initTop + dy + 'px';
      enforceBoundary(selectedBlock); // ✅ Thêm dòng này để giới hạn trong canvas
      showAlignmentGuides(selectedBlock); // ✅ thêm dòng này để cập nhật realtime
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.querySelectorAll('.alignment-guide, .distance-label').forEach(el => el.remove()); // ✅ xoá guide
      saveState();
      updateLayerPanel();
      highlightSelectedBlocks();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // === 2. Rotate Handle (top-center) ===
  const rotateHandle = document.createElement('div');
  rotateHandle.className = 'rotate-handle';
  Object.assign(rotateHandle.style, {
    position: 'absolute',
    top: '-20px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '14px',
    height: '14px',
    background: '#facc15',
    borderRadius: '50%',
    border: '2px solid white',
    cursor: 'grab',
    zIndex: '1000'
  });

  selectedBlock.append(rotateHandle);

  rotateHandle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    const rect = selectedBlock.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    function onMove(ev) {
      const dx = ev.clientX - cx;
      const dy = ev.clientY - cy;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const deg = Math.round(angle);

      selectedBlock.dataset.rotation = deg;
      selectedBlock.style.transform = `rotate(${deg}deg)`;

      const rotateSlider = document.getElementById("rotateSlider");
      const rotateLabel = document.getElementById("rotate-angle");

      if (rotateSlider) rotateSlider.value = deg;
      if (rotateLabel) rotateLabel.textContent = `${deg}°`;
      showAlignmentGuides(selectedBlock); // ✅ thêm dòng này để cập nhật realtime
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      document.querySelectorAll('.alignment-guide, .distance-label').forEach(el => el.remove()); // ✅ xoá guide

      saveState();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function changeZIndex(block, delta) {
  const currentZ = parseInt(block.style.zIndex) || 100;
  const newZ = Math.max(100, Math.min(2000, currentZ + delta));
  if (newZ !== currentZ) {
    block.style.zIndex = newZ;
    updateLayerPanel();
    checkOverlap(block);
    saveState();
  } else {
    showToast("Giới hạn z-index là từ 100 đến 2000");
  }
}

function updateLayerPanel() {
  layerPanel.innerHTML = `<h3 class='text-yellow-400 font-semibold mb-2 text-sm'>Layer</h3>`;
  [...canvas.querySelectorAll(".block-item")].reverse().forEach((block, idx) => {
    const type = block.dataset.type;
    const id = block.dataset.id || idx;
    const div = document.createElement("div");
    div.className = "text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-gray-700 flex justify-between items-center";
    if (block === selectedBlock) div.classList.add("bg-yellow-500", "text-black");
    const wrap = document.createElement("div");
    wrap.className = "flex items-center gap-1 flex-1";
    if (type === "image") {
      const thumb = document.createElement("img");
      thumb.src = block.querySelector("img").src;
      thumb.className = "w-6 h-6 object-cover";
      wrap.appendChild(thumb);
    }
    const input = document.createElement("input");
    input.value = block.dataset.name || `${type}(#${id})`;
    input.className = "bg-transparent text-white text-xs w-24 border-none focus:outline-none";
    input.onchange = () => block.dataset.name = input.value;
    wrap.appendChild(input);
    const zSpan = document.createElement("span");
    zSpan.textContent = `(z:${block.style.zIndex})`;
    zSpan.className = "text-gray-400 text-xs ml-1";
    wrap.appendChild(zSpan);
    const controls = document.createElement("div");
    controls.className = "flex gap-1";
    const up = document.createElement("button");
    up.textContent = "⬆";
    up.onclick = e => {
      e.stopPropagation();
      changeZIndex(block, +1);
    };

    const down = document.createElement("button");
    down.textContent = "⬇";
    down.onclick = e => {
      e.stopPropagation();
      changeZIndex(block, -1);
    };
    controls.append(up, down);
    div.append(wrap, controls);
    div.onclick = () => {
      selectedBlock = block;
      selectedBlocks.clear();
      selectedBlocks.add(block);
      highlightSelectedBlocks();
      updateToolOptions(block);
      updateBadgeHandle();
      updateLayerPanel(); // 👈 thêm dòng này vào đây
    };
    layerPanel.appendChild(div);
  });
}

function snapToOtherBlocks(block) {
  const others = [...canvas.querySelectorAll(".block-item")].filter(b => b !== block);
  const threshold = 5;
  const r1 = block.getBoundingClientRect();
  others.forEach(b => {
    const r2 = b.getBoundingClientRect();
    if (Math.abs(r1.left - r2.left) < threshold) block.style.left = b.offsetLeft + "px";
    if (Math.abs(r1.top - r2.top) < threshold) block.style.top = b.offsetTop + "px";
  });
}

function highlightSelectedBlocks() {
  document.querySelectorAll(".block-item").forEach(block => {
    block.style.border = selectedBlocks.has(block)
      ? "2px solid #facc15"
      : "1px dashed #ccc";
  });
}

function checkOverlap(targetBlock = null) {
  const blocks = [...canvas.querySelectorAll(".block-item")];
  const canvasArea = document.getElementById("canvas-area");
  const existingWarning = canvasArea.querySelector(".overlap-warning");
  let hasOverlap = false;

  // 👇 Reset trước: bỏ viền đỏ cũ
  blocks.forEach(b => b.classList.remove("overlapping-block"));

  for (let i = 0; i < blocks.length; i++) {
    const b1 = blocks[i];
    const r1 = b1.getBoundingClientRect();
    const z1 = parseInt(b1.style.zIndex) || 100;

    for (let j = i + 1; j < blocks.length; j++) {
      const b2 = blocks[j];
      const r2 = b2.getBoundingClientRect();
      const z2 = parseInt(b2.style.zIndex) || 100;

      const isOverlap = !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
      if (isOverlap && z1 === z2) {
        b1.classList.add("overlapping-block");
        b2.classList.add("overlapping-block");
        hasOverlap = true;
      }
    }
  }

  if (hasOverlap) {
    if (!existingWarning) {
      const warning = document.createElement("div");
      warning.textContent = "⚠️ Hai phần tử bị chồng nhau (z-index giống nhau)";
      warning.className = `
        overlap-warning 
        sticky bottom-0 left-0 
        text-yellow-300 bg-black/70 px-3 py-1 text-sm rounded 
        z-[9999] ml-2 mb-2 w-fit
      `;
      canvasArea.appendChild(warning);
    }
  } else {
    if (existingWarning) existingWarning.remove();
  }
}

function createResizeHandle(block) {
  if (!block) return;

  const directions = [
    { dir: 'nw', x: '0%', y: '0%', cursor: 'nwse-resize' },
    { dir: 'n', x: '50%', y: '0%', cursor: 'ns-resize' },
    { dir: 'ne', x: '100%', y: '0%', cursor: 'nesw-resize' },
    { dir: 'e', x: '100%', y: '50%', cursor: 'ew-resize' },
    { dir: 'se', x: '100%', y: '100%', cursor: 'nwse-resize' },
    { dir: 's', x: '50%', y: '100%', cursor: 'ns-resize' },
    { dir: 'sw', x: '0%', y: '100%', cursor: 'nesw-resize' },
    { dir: 'w', x: '0%', y: '50%', cursor: 'ew-resize' }
  ];

  directions.forEach(p => {
    const handle = document.createElement("div");
    handle.className = `resize-handle ${p.dir}`;
    handle.style.cssText = `
      position: absolute;
      width: 10px;
      height: 10px;
      background: #fff;
      border: 1px solid #888;
      cursor: ${p.cursor};
      transform: translate(-50%, -50%);
      left: ${p.x};
      top: ${p.y};
      z-index: 999;
    `;
    handle.dataset.dir = p.dir;

    handle.addEventListener("mousedown", e => {
      e.preventDefault();
      e.stopPropagation();

      const start = {
        x: e.clientX,
        y: e.clientY,
        w: block.offsetWidth,
        h: block.offsetHeight,
        left: block.offsetLeft,
        top: block.offsetTop
      };

      const img = block.querySelector("img");
      const aspectRatio = img
        ? img.naturalWidth / img.naturalHeight
        : start.w / start.h;

      function onMove(ev) {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;

        const keepRatio = document.getElementById("keepRatio")?.checked;
        let newWidth = start.w;
        let newHeight = start.h;
        let newLeft = start.left;
        let newTop = start.top;

        if (keepRatio) {
          let delta = 0;
          if (p.dir.includes('e')) delta = dx;
          else if (p.dir.includes('w')) delta = -dx;
          else if (p.dir.includes('s')) delta = dy * aspectRatio;
          else if (p.dir.includes('n')) delta = -dy * aspectRatio;

          newWidth = Math.max(30, start.w + (p.dir.includes('w') ? -delta : delta));
          newHeight = newWidth / aspectRatio;

          if (p.dir.includes('w')) newLeft = start.left + (start.w - newWidth);
          if (p.dir.includes('n')) newTop = start.top + (start.h - newHeight);
        } else {
          if (p.dir.includes('e')) newWidth = Math.max(30, start.w + dx);
          if (p.dir.includes('s')) newHeight = Math.max(30, start.h + dy);

          if (p.dir.includes('w')) {
            newWidth = Math.max(30, start.w - dx);
            newLeft = start.left + dx;
          }

          if (p.dir.includes('n')) {
            newHeight = Math.max(30, start.h - dy);
            newTop = start.top + dy;
          }
        }

        block.style.width = newWidth + "px";
        block.style.height = newHeight + "px";
        block.style.left = newLeft + "px";
        block.style.top = newTop + "px";

        enforceBoundary(block);
        checkOverlap();

        showAlignmentGuides(block);
      }

      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);

        // ✅ Xoá các guide & label
        document.querySelectorAll('.alignment-guide, .distance-label').forEach(el => el.remove());
        updateBadgeHandle(); // Đặt lại núm xanh, xoay đúng vị trí
        saveState();
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    block.appendChild(handle);
  });
}

function createBlock(type, content = "", style = {}, silent = false) {
  const b = document.createElement("div");
  b.className = "block-item";
  b.dataset.type = type;
  b.setAttribute('tabindex', '0');

  Object.assign(b.style, {
    position: 'absolute',
    left: (style.x || 50) + 'px',
    top: (style.y || 50) + 'px',
    width: (style.width || 150) + 'px',
    height: (style.height || 60) + 'px',
    zIndex: style.zIndex || 100
  });

  if (type === 'text' || type === 'quote') {
    b.contentEditable = true;
    b.textContent = content || (type === 'text' ? 'Văn bản mới' : '“Trích dẫn”');
    b.style.cursor = 'text';
    b.style.fontSize = style.fontSize || '16px';
    b.style.color = style.color || 'white';
    b.style.fontWeight = style.bold ? 'bold' : 'normal';
    b.style.textAlign = style.align || 'left';
  } else if (type === 'image') {
    const imgEl = document.createElement('img');
    imgEl.src = content;
    imgEl.style.cssText = 'width:100%;height:100%;pointer-events:none;';
    b.append(imgEl);

    imgEl.onload = () => {
      if (!style.height || !style.width) {
        const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
        const currentWidth = b.offsetWidth;
        b.style.height = (currentWidth / ratio) + 'px';
      }
    };

    const btn = document.createElement('button');
    btn.textContent = 'Chọn ảnh';
    btn.className = 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/10 text-white px-3 py-1 text-sm rounded hover:bg-white/20';
    btn.onclick = () => imagePicker.click();
    b.append(btn);
  }

  b.addEventListener('mousedown', e => {
    if (e.target.classList.contains('resize-handle') || b.isContentEditable) return;
    handleDrag(e, b);
  });

  createResizeHandle(b, type === 'image');
  canvas.append(b);

  updateLayerPanel();
  checkOverlap(b);
  highlightSelectedBlocks();
  updateToolOptions(b);
  updateBadgeHandle();

  if (!silent) {
    saveState(); // ✅ chỉ gọi nếu không ở chế độ silent
  }

  return b;
}

function handleDrag(e, block) {
  e.preventDefault();
  selectedBlock = block;
  selectedBlocks.clear();
  selectedBlocks.add(block);
  highlightSelectedBlocks();

  const ox = e.offsetX, oy = e.offsetY;

  function move(ev) {
    const r = canvas.getBoundingClientRect();
    block.style.left = (ev.clientX - r.left - ox) + 'px';
    block.style.top = (ev.clientY - r.top - oy) + 'px';
    enforceBoundary(block);
    checkOverlap();
  }

  function moveAt(ev) {
    showAlignmentGuides(block);
    snapToOtherBlocks(block);
    move(ev);
    updateCanvasHeight();
    autoScrollCanvas(ev); // ✅ Gọi ở đây mỗi lần kéo chuột
  }

  function up() {
    document.removeEventListener('mousemove', moveAt);
    document.removeEventListener('mouseup', up);

    // ✅ Xoá các đường căn và label sau khi drag xong
    document.querySelectorAll('.alignment-guide, .distance-label').forEach(el => el.remove());

    saveState();
  }

  document.addEventListener('mousemove', moveAt);
  document.addEventListener('mouseup', up);
  updateToolOptions(block);
  updateBadgeHandle();
}

function showAlignmentGuides(block) {
  const canvasRect = canvas.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  const cx = blockRect.left + blockRect.width / 2;
  const cy = blockRect.top + blockRect.height / 2;
  const threshold = 5;

  // Xoá hướng dẫn cũ
  document.querySelectorAll('.alignment-guide, .distance-label').forEach(el => el.remove());

  // Canh giữa theo chiều dọc & ngang
  ['v', 'h'].forEach(dir => {
    const guide = document.createElement('div');
    guide.className = 'alignment-guide';
    Object.assign(guide.style, {
      position: 'absolute',
      background: '#facc15',
      zIndex: 50,
      pointerEvents: 'none',
      ...(dir === 'v'
        ? { top: 0, bottom: 0, width: '1px', left: '50%' }
        : { left: 0, right: 0, height: '1px', top: '50%' })
    });

    const isNearCenter = dir === 'v'
      ? Math.abs(cx - (canvasRect.left + canvasRect.width / 2)) < threshold
      : Math.abs(cy - (canvasRect.top + canvasRect.height / 2)) < threshold;

    if (isNearCenter) canvas.append(guide);
  });

  // Tính và hiển thị khoảng cách trái, phải, trên, dưới
  const sides = [
    {
      name: 'left',
      dist: blockRect.left - canvasRect.left,
      x: canvasRect.left + (blockRect.left - canvasRect.left) / 2,
      y: blockRect.top + blockRect.height / 2,
      width: blockRect.left - canvasRect.left,
      height: 1,
      vertical: true,
    },
    {
      name: 'right',
      dist: canvasRect.right - blockRect.right,
      x: blockRect.right + (canvasRect.right - blockRect.right) / 2,
      y: blockRect.top + blockRect.height / 2,
      width: canvasRect.right - blockRect.right,
      height: 1,
      vertical: true,
    },
    {
      name: 'top',
      dist: blockRect.top - canvasRect.top,
      x: blockRect.left + blockRect.width / 2,
      y: canvasRect.top + (blockRect.top - canvasRect.top) / 2,
      width: 1,
      height: blockRect.top - canvasRect.top,
      vertical: false,
    },
    {
      name: 'bottom',
      dist: canvasRect.bottom - blockRect.bottom,
      x: blockRect.left + blockRect.width / 2,
      y: blockRect.bottom + (canvasRect.bottom - blockRect.bottom) / 2,
      width: 1,
      height: canvasRect.bottom - blockRect.bottom,
      vertical: false,
    },
  ];

  sides.forEach(side => {
    if (side.dist > 10) {
      // Tạo line guide
      const line = document.createElement('div');
      line.className = 'alignment-guide';
      Object.assign(line.style, {
        position: 'absolute',
        background: '#facc15',
        zIndex: 49,
        pointerEvents: 'none',
        left: side.vertical ? `${side.x - canvasRect.left}px` : `${side.x - 0.5 - canvasRect.left}px`,
        top: side.vertical ? `${side.y - 0.5 - canvasRect.top}px` : `${side.y - canvasRect.top}px`,
        width: side.vertical ? '1px' : `${side.width}px`,
        height: side.vertical ? `${side.height}px` : '1px',
      });
      canvas.appendChild(line);

      // Tạo viên thuốc khoảng cách
      const label = document.createElement('div');
      label.className = 'distance-label';
      label.textContent = `${Math.round(side.dist)}px`;
      Object.assign(label.style, {
        position: 'absolute',
        padding: '2px 8px',
        background: '#facc15',
        color: '#000',
        fontSize: '12px',
        borderRadius: '9999px',
        fontWeight: 'bold',
        zIndex: 2002,
        transform: 'translate(-50%, -50%)',
        left: `${side.x - canvasRect.left}px`,
        top: `${side.y - canvasRect.top}px`,
        zIndex: 51,
        pointerEvents: 'none',
        boxShadow: '0 0 0 1px #00000020'
      });
      canvas.appendChild(label);
    }
  });
  // Kẻ một đường ngang kéo dài toàn vùng canvas (editable), đi qua giữa block
  const fullWidthLine = document.createElement('div');
  fullWidthLine.className = 'alignment-guide';
  Object.assign(fullWidthLine.style, {
    position: 'absolute',
    top: `${blockRect.top + blockRect.height / 2 - canvasRect.top}px`,
    left: `0`,
    width: `${canvasRect.width}px`,
    height: `1px`,
    borderTop: '1px dashed #facc15',
    zIndex: 2001,
    pointerEvents: 'none',
  });
  canvas.appendChild(fullWidthLine);

}

function updateToolOptions(block) {
  const toolOptions = document.getElementById("tool-options");
  const rotateOptions = document.getElementById("rotate-options");
  const textOptions = document.getElementById("text-options");
  const keepRatioCheckbox = document.getElementById("keepRatio");

  if (!block) {
    toolOptions.classList.add("hidden");
    rotateOptions.classList.add("hidden");
    textOptions.classList.add("hidden");
    return;
  }

  toolOptions.classList.remove("hidden");
  rotateOptions.classList.remove("hidden");
  keepRatioCheckbox.parentElement.classList.remove("hidden");

  // Nếu là text block thì hiện các text tool
  if (block.getAttribute("data-type") === "text") {
    textOptions.classList.remove("hidden");
    fontSizeSlider.value = parseInt(block.style.fontSize || "16");
    colorPicker.value = rgbToHex(block.style.color || "#000000");
  } else {
    textOptions.classList.add("hidden");
  }

  updateRotateOptions(block);
}

function rgbToHex(rgb) {
  if (!rgb) return "#ffffff";
  const result = rgb?.match(/\d+/g);
  return result ? "#" + result.map(x => Number(x).toString(16).padStart(2, "0")).join("") : "#ffffff";
}

function saveState() {
  const blocks = Array.from(canvas.querySelectorAll(".block-item")).map(block => {
    const type = block.dataset.type;
    const base = {
      type,
      x: Math.round(block.offsetLeft),
      y: Math.round(block.offsetTop),
      width: Math.round(block.offsetWidth),
      height: Math.round(block.offsetHeight),
      rotation: parseFloat(block.dataset.rotation || "0"),
      zIndex: Number(block.style.zIndex) || 0,
    };

    if (type === "text" || type === "quote") {
      base.content = block.innerText;
      base.fontSize = block.style.fontSize;
      base.color = block.style.color;
      base.bold = block.style.fontWeight === "bold";
      base.align = block.style.textAlign;
    } else if (type === "image") {
      base.content = block.querySelector("img")?.src || "";
    }

    return base;
  });

  // ✅ Clone sâu để không bị tham chiếu
  const cloned = JSON.parse(JSON.stringify(blocks));

  history.push(cloned);
  redoStack = [];
}

function restoreState(state, { pushHistory = false } = {}) {
  canvas.innerHTML = "";
  selectedBlock = null;
  selectedBlocks.clear();

  for (const blockData of state) {
    const b = createBlock(blockData.type, blockData.content, blockData, true);

    if (typeof blockData.rotation !== "undefined") {
      b.dataset.rotation = blockData.rotation;
      b.style.transform = `rotate(${blockData.rotation}deg)`;
    }

    if (!selectedBlock) {
      selectedBlock = b;
      selectedBlocks.add(b);
    }
  }

  highlightSelectedBlocks();
  updateToolOptions(selectedBlock);
  updateRotateOptions(selectedBlock);
  updateCanvasHeight();

  if (pushHistory) {
    const current = JSON.parse(JSON.stringify(state));
    history.push(current);
  }
}

addTextBtn.onclick = () => createBlock("text");
addQuoteBtn.onclick = () => createBlock("quote");
addImageBtn.onclick = () => createBlock("image");

fontSizeSlider.oninput = () => {
  if (!selectedBlock) return;
  selectedBlock.style.fontSize = fontSizeSlider.value + "px";
  saveState();
};

colorPicker.oninput = () => {
  if (!selectedBlock) return;
  selectedBlock.style.color = colorPicker.value;
  saveState();
};

boldToggle.onclick = () => {
  if (!selectedBlock) return;
  const isBold = selectedBlock.style.fontWeight === "bold";
  selectedBlock.style.fontWeight = isBold ? "normal" : "bold";
  saveState();
};

document.querySelectorAll('[data-align]').forEach(btn => {
  btn.onclick = () => {
    if (!selectedBlock) return;
    selectedBlock.style.textAlign = btn.getAttribute("data-align");
    saveState();
  };
});

undoBtn.onclick = () => {
  if (history.length <= 1) return;

  const current = history.pop();
  redoStack.push(JSON.parse(JSON.stringify(current)));

  restoreState(history[history.length - 1]);
};

redoBtn.onclick = () => {
  if (!redoStack.length) return;

  const state = redoStack.pop();
  restoreState(state, { pushHistory: true }); // ✅ Ghi lại vào lịch sử
};

saveBtn.onclick = async () => {
  saveState(); // ⬅️ Gọi trước để đảm bảo trạng thái mới nhất được ghi vào history

  const finalState = history[history.length - 1];
  const keepRatio = document.getElementById("keepRatio")?.checked;

  console.log("Saving to Firestore:", finalState);
  try {
    await setDoc(doc(db, "productIntros", productId), {
      blocks: finalState,
      keepRatio: !!keepRatio  // ✅ lưu trạng thái checkbox
    });
    showToast("Đã lưu thành công!", "success");
  } catch (err) {
    console.error("🔥 Lỗi Firestore:", err);
    showToast("Lỗi khi lưu. Hãy thử lại!", "error");
  }
};


imagePicker.onchange = (e) => {
  const file = e.target.files[0];
  if (file && selectedBlock && selectedBlock.getAttribute("data-type") === "image") {
    const reader = new FileReader();

    reader.onload = ev => {
      const imgEl = selectedBlock.querySelector("img");
      imgEl.src = ev.target.result;

      imgEl.onload = () => {
        // ✅ Chỉ cập nhật lại chiều cao nếu ảnh chưa có height rõ ràng
        const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
        const currentWidth = selectedBlock.offsetWidth;
        const currentHeight = selectedBlock.offsetHeight;

        if (!currentHeight || currentHeight < 30) {
          selectedBlock.style.height = (currentWidth / ratio) + 'px';
        }

        saveState(); // ✅ Gọi ở đây để cập nhật resize do người dùng chọn ảnh mới
      };
    };

    reader.readAsDataURL(file);
  }
};

(async function loadExisting() {
  if (!productId) return;
  const snap = await getDoc(doc(db, "productIntros", productId));
  if (snap.exists()) {
    const data = snap.data();

    if (Array.isArray(data.blocks)) {
      restoreState(data.blocks); // ⚠️ Không push khi load
      history.push(JSON.parse(JSON.stringify(data.blocks)));
    } else {
      history.push([]);
    }

    const keepRatio = data.keepRatio ?? true;
    document.getElementById("keepRatio").checked = keepRatio;
  }
})();
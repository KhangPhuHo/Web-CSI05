// 404sw.js
// Service worker rieng, chi lo 1 viec: cache san 1 trang offline va tra ve
// trang do khi nguoi dung mat mang. Khong dinh gi den push notification -
// firebase-messaging-sw.js van chay binh thuong, tach biet hoan toan.

const CACHE_NAME = "offline-cache-v1";
// Doi duong dan nay thanh file offline that su cua ban (vd: /404.html)
const OFFLINE_URL = "./404.html";

// Khi service worker duoc cai dat lan dau -> tai va luu san trang offline vao cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  // Kich hoat ngay, khong doi tab cu dong het
  self.skipWaiting();
});

// Don cache cu khi co ban sw moi (doi CACHE_NAME o tren de force update)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Bat tat ca request dieu huong trang (khi nguoi dung go URL / bam link)
self.addEventListener("fetch", (event) => {
  // Chi xu ly rieng cho navigation request (load 1 trang HTML),
  // con lai (css/js/img/api...) de trinh duyet tu xu ly binh thuong
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Mang loi / khong ket noi duoc -> tra ve trang offline da cache san
        return caches.match(OFFLINE_URL);
      })
    );
  }
});
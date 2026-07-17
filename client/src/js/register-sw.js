// Dat doan nay trong file JS chinh cua trang (vd: main.js, hoac ngay
// truoc </body> cua index.html trong tag <script>).
// Luu y: sw.js phai duoc dat o thu muc GOC cua site (vd: /client/sw.js
// -> truy cap duoc tai yourdomain.com/sw.js) thi moi kiem soat duoc
// toan bo cac trang. Neu de trong thu muc con, no chi kiem soat duoc
// cac trang trong thu muc do.
//
// QUAN TRONG: chi con DUY NHAT 1 lan register() trong ca web (gom ca
// chuc nang 404-offline va push notification trong cung 1 file sw.js).
// Khong duoc goi register() them lan nao khac (vd trong notifications.js)
// vi 1 scope chi co 1 service worker "chu" duoc active - dang ky 2 lan
// se de len nhau va gay loi y het truong hop cu.

export let swRegistrationPromise = null;

if ("serviceWorker" in navigator) {
  swRegistrationPromise = new Promise((resolve, reject) => {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("sw.js registered:", reg.scope);
          resolve(reg);
        })
        .catch((err) => {
          console.error("sw.js register failed:", err);
          reject(err);
        });
    });
  });
}
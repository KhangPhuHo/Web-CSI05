// Dat doan nay trong file JS chinh cua trang (vd: main.js, hoac ngay
// truoc </body> cua index.html trong tag <script>).
// Luu y: 404sw.js phai duoc dat o thu muc GOC cua site (vd: /client/404sw.js
// -> truy cap duoc tai yourdomain.com/404sw.js) thi moi kiem soat duoc
// toan bo cac trang. Neu de trong thu muc con, no chi kiem soat duoc
// cac trang trong thu muc do.

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("../../404sw.js")
      .then((reg) => console.log("404sw.js registered:", reg.scope))
      .catch((err) => console.error("404sw.js register failed:", err));
  });
}
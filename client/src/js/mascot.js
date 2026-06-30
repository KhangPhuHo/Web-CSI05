if (window.innerWidth >= 720) {
  const leftMascot = document.createElement("div");
  const rightMascot = document.createElement("div");

  leftMascot.id = "mascot-left";
  rightMascot.id = "mascot-right";

  leftMascot.innerHTML = `<img src="./src/img/meoJay.png" alt="Mèo Jay">`;
  rightMascot.innerHTML = `<img src="./src/img/voiFi.png" alt="Voi Fi">`;

  document.body.appendChild(leftMascot);
  document.body.appendChild(rightMascot);

  // Ẩn khi chuyển tab để giảm lag
  window.addEventListener("blur", () => {
    leftMascot.style.display = "none";
    rightMascot.style.display = "none";
  });

  window.addEventListener("focus", () => {
    leftMascot.style.display = "block";
    rightMascot.style.display = "block";
  });
}
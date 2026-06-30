// session-keeper.js
let lastSessionUpdate = 0;

export function refreshSession() {
  const now = Date.now();
  if (now - lastSessionUpdate < 120 * 1000) return;

  const session = JSON.parse(localStorage.getItem("session"));
  if (!session) return;

  const isAdmin = session?.isAdmin === true;
  if (!isAdmin) {
    session.expired_at = now + 2 * 60 * 60 * 1000;
    localStorage.setItem("session", JSON.stringify(session));
    lastSessionUpdate = now;
  }
}

export function enableSessionKeepAlive() {
  document.addEventListener("mousemove", refreshSession);
  document.addEventListener("keydown", refreshSession);
}

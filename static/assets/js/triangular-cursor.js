(() => {
  if (window.__lunarTriangularCursorInitialized) return;
  window.__lunarTriangularCursorInitialized = true;
  document.documentElement.classList.add("lunar-triangular-cursor-active");

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "/assets/css/triangular-cursor.css?v=1";
  document.head.appendChild(style);

  const cursor = document.createElement("div");
  cursor.className = "lunar-triangular-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = '<svg viewBox="0 0 30 34" focusable="false" aria-hidden="true"><path d="M2 1.5 27 21.2 16.8 21.2 21.4 31.2 16.2 33 11.8 22.7 5.2 29.4Z"/></svg>';
  document.body.appendChild(cursor);

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let visible = false;

  const move = event => {
    targetX = event.clientX;
    targetY = event.clientY;
    if (!visible) {
      currentX = targetX;
      currentY = targetY;
      visible = true;
      cursor.classList.add("is-visible");
    }
  };

  const animate = () => {
    currentX += (targetX - currentX) * 0.19;
    currentY += (targetY - currentY) * 0.19;
    cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    requestAnimationFrame(animate);
  };

  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerdown", () => cursor.classList.add("is-pressed"), { passive: true });
  document.addEventListener("pointerup", () => cursor.classList.remove("is-pressed"), { passive: true });
  document.addEventListener("pointercancel", () => cursor.classList.remove("is-pressed"), { passive: true });
  window.addEventListener("blur", () => cursor.classList.remove("is-visible"));
  window.addEventListener("focus", () => {
    if (visible) cursor.classList.add("is-visible");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cursor.classList.remove("is-visible");
    else if (visible) cursor.classList.add("is-visible");
  });

  requestAnimationFrame(animate);
})();
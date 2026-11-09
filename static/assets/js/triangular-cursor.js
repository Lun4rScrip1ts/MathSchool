(() => {
  if (window.__lunarTriangularCursorInitialized) return;
  window.__lunarTriangularCursorInitialized = true;

  // Inject the critical styles synchronously so a slow/missing stylesheet can
  // never leave the native cursor hidden without the replacement being drawn.
  const style = document.createElement("style");
  style.id = "lunar-triangular-cursor-styles";
  style.textContent = `
    html.lunar-triangular-cursor-active,
    html.lunar-triangular-cursor-active *,
    html.lunar-triangular-cursor-active *::before,
    html.lunar-triangular-cursor-active *::after { cursor: none !important; }
    #lunar-triangular-cursor {
      position: fixed !important; display: block !important;
      width: 28px !important; height: 28px !important;
      left: 0; top: 0; margin: 0 !important; padding: 0 !important;
      z-index: 2147483647 !important; pointer-events: none !important;
      visibility: visible !important; opacity: 0;
      transform: translate3d(-100px,-100px,0);
      transform-origin: 2px 2px; will-change: transform;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.8)) drop-shadow(0 0 1px #000);
      transition: opacity .1s ease;
    }
    #lunar-triangular-cursor.is-visible { opacity: 1 !important; }
    #lunar-triangular-cursor svg { display:block !important; width:100%; height:100%; overflow:visible; }
    #lunar-triangular-cursor path { fill:#fff; stroke:rgba(0,0,0,.82); stroke-width:1.15; stroke-linejoin:round; }
    @media (pointer: coarse) { #lunar-triangular-cursor { display:none !important; } }
  `;
  (document.head || document.documentElement).appendChild(style);

  const cursor = document.createElement("div");
  cursor.id = "lunar-triangular-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = '<svg viewBox="0 0 30 30" focusable="false" aria-hidden="true"><path d="M2 1.5 27 24 2 24Z"/></svg>';
  (document.body || document.documentElement).appendChild(cursor);

  let targetX = -100, targetY = -100;
  let currentX = -100, currentY = -100;
  let active = false;

  const move = event => {
    if (event.pointerType === "touch") return;
    targetX = event.clientX;
    targetY = event.clientY;
    if (!active) {
      currentX = targetX;
      currentY = targetY;
      active = true;
      cursor.classList.add("is-visible");
      // Only suppress the system cursor once the replacement is on screen.
      document.documentElement.classList.add("lunar-triangular-cursor-active");
    }
  };

  const animate = () => {
    currentX += (targetX - currentX) * 0.22;
    currentY += (targetY - currentY) * 0.22;
    cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    requestAnimationFrame(animate);
  };

  window.addEventListener("pointermove", move, { passive: true, capture: true });
  window.addEventListener("mousemove", move, { passive: true, capture: true });
  requestAnimationFrame(animate);
})();
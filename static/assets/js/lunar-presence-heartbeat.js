(() => {
  let inFlight = false;

  const touchPresence = async () => {
    if (inFlight || document.hidden || document.visibilityState === "prerender") return;
    inFlight = true;
    try {
      const authResponse = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const auth = authResponse.ok ? await authResponse.json() : null;
      if (!auth?.user || auth.guest) return;
      await fetch("/api/presence/heartbeat", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Cache-Control": "no-cache" },
      });
    } catch {}
    finally { inFlight = false; }
  };

  touchPresence();
  setInterval(touchPresence, 25_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) touchPresence();
  });
  window.addEventListener("focus", touchPresence);
})();

document.addEventListener("DOMContentLoaded", async () => {
  const panel = document.querySelector(".lunar-console-panel");
  const feed = document.getElementById("lunar-discord-feed");
  const status = document.getElementById("lunar-chat-status");
  const form = document.getElementById("lunar-discord-form");
  const input = document.getElementById("lunar-discord-message");
  const send = document.getElementById("lunar-discord-send");
  const feedback = document.getElementById("lunar-discord-feedback");
  const count = document.getElementById("lunar-discord-count");
  const emojiButton = document.getElementById("lunar-console-emoji-button");
  const emojiPicker = document.getElementById("lunar-console-emoji-picker");
  const emojiHost = document.getElementById("lunar-console-emoji-host");
  const emojiClose = document.getElementById("lunar-console-emoji-close");
  const showFeedback = (message, kind = "") => {
    feedback.textContent = message;
    feedback.classList.toggle("is-success", kind === "success");
    feedback.classList.toggle("is-error", kind === "error");
  };

  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    const auth = response.ok ? await response.json() : null;
    if (String(auth?.user?.username || "").toLowerCase() !== "lunar") {
      panel.innerHTML = '<div class="lunar-console-denied"><i class="fa-solid fa-lock"></i><h1>Access restricted</h1><p>This page is only available to the @lunar account.</p><a class="key-button" href="/account">Go to account</a></div>';
      return;
    }
  } catch {
    panel.innerHTML = '<div class="lunar-console-denied"><h1>Could not verify account</h1><p>Refresh the page and try again.</p></div>';
    return;
  }

  const loadMessages = async () => {
    try {
      const response = await fetch("/api/lunar-console/discord-messages", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load Discord messages.");
      feed.replaceChildren();
      const messages = Array.isArray(result.messages) ? result.messages : [];
      if (!messages.length) {
        const empty = document.createElement("div");
        empty.className = "lunar-chat-empty";
        empty.textContent = "No messages in this channel yet.";
        feed.appendChild(empty);
      }
      for (const message of messages) {
        const item = document.createElement("article");
        item.className = "lunar-chat-message";
        const header = document.createElement("div");
        header.className = "lunar-chat-message-header";
        const author = document.createElement("strong");
        author.textContent = message.username || "Unknown";
        header.appendChild(author);
        if (message.isBot) {
          const tag = document.createElement("span");
          tag.className = "lunar-chat-bot-tag";
          tag.textContent = "BOT";
          header.appendChild(tag);
        }
        const time = document.createElement("time");
        const date = new Date(message.timestamp);
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleString();
        header.appendChild(time);
        const content = document.createElement("p");
        content.className = "lunar-chat-message-content";
        content.textContent = message.content || (message.isBot ? "Bot message or embed" : "No text content");
        item.append(header, content);
        feed.appendChild(item);
      }
      feed.scrollTop = feed.scrollHeight;
      status.textContent = "Live · refreshes every 5s";
    } catch (error) {
      status.textContent = "Not connected";
      feed.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "lunar-chat-empty lunar-chat-error";
      empty.textContent = error.message || "Could not load messages.";
      feed.appendChild(empty);
    }
  };

  input.addEventListener("input", () => { count.textContent = input.value.length + " / 1500"; });
  const closeEmojiPicker = () => { if (emojiPicker) emojiPicker.hidden = true; };
  if (emojiButton && emojiPicker && emojiHost) {
    emojiButton.addEventListener("click", async () => {
      try {
        if (!customElements.get("emoji-picker")) await import("https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js");
        await customElements.whenDefined("emoji-picker");
        let picker = emojiHost.querySelector("emoji-picker");
        if (!picker) {
          picker = document.createElement("emoji-picker");
          picker.className = "dark";
          picker.setAttribute("locale", "en");
          picker.setAttribute("emoji-version", "17.0");
          emojiHost.appendChild(picker);
          picker.addEventListener("emoji-click", event => {
            const emoji = event.detail?.unicode;
            if (!emoji) return;
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            input.setRangeText(emoji, start, end, "end");
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.focus();
            closeEmojiPicker();
          });
        }
        emojiPicker.hidden = !emojiPicker.hidden;
      } catch {
        showFeedback("Emoji picker could not load. Try refreshing.", "error");
      }
    });
  }
  if (emojiClose) emojiClose.addEventListener("click", closeEmojiPicker);\n  window.addEventListener("resize", () => { if (emojiPicker && !emojiPicker.hidden) positionEmojiPicker(); });
  document.addEventListener("click", event => {
    if (emojiPicker && !emojiPicker.hidden && !emojiPicker.contains(event.target) && !emojiButton?.contains(event.target)) closeEmojiPicker();
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) { showFeedback("Write a message first.", "error"); input.focus(); return; }
    send.disabled = true;
    send.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
    showFeedback("");
    try {
      const response = await fetch("/api/lunar-console/discord-message", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not send message.");
      input.value = "";
      count.textContent = "0 / 1500";
      showFeedback("Message sent to Discord.", "success");
      await loadMessages();
    } catch (error) {
      showFeedback(error.message || "Could not send message.", "error");
    } finally {
      send.disabled = false;
      send.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send to Discord';
    }
  });
  await loadMessages();
  window.setInterval(loadMessages, 5000);
});
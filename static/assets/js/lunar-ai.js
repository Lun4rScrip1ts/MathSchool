(() => {
  const launcher = document.getElementById("lunar-ai-launcher");
  const modal = document.getElementById("lunar-ai-modal");
  if (!launcher || !modal) return;

  const panel = modal.querySelector(".lunar-ai-window");
  const closeButton = document.getElementById("lunar-ai-close");
  const newChatButton = document.getElementById("lunar-ai-new-chat");
  const history = document.getElementById("lunar-ai-history");
  const messages = document.getElementById("lunar-ai-messages");
  const status = document.getElementById("lunar-ai-status");
  const form = document.getElementById("lunar-ai-form");
  const textarea = document.getElementById("lunar-ai-input");
  const sendButton = document.getElementById("lunar-ai-send");
  const uploadButton = document.getElementById("lunar-ai-upload");
  const fileInput = document.getElementById("lunar-ai-file-input");
  const pending = document.getElementById("lunar-ai-pending");
  const mobileMenu = document.getElementById("lunar-ai-mobile-menu");
  let chats = [];
  let activeChat = null;
  let pendingFiles = [];
  let busy = false;
  let signedIn = false;

  const escapeText = value => String(value ?? "");
  const setStatus = value => { status.textContent = value || ""; };
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  };
  const jsonOptions = body => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  function showAuthNote() {
    messages.replaceChildren();
    const note = document.createElement("div");
    note.className = "lunar-ai-auth-note";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-lock";
    icon.style.fontSize = "25px";
    icon.style.color = "#c4b5fd";
    const text = document.createElement("div");
    text.textContent = "Log in to your Lunar account to use AI and save your conversations to your account.";
    const link = document.createElement("a");
    link.href = "/account";
    link.textContent = "log in or create an account";
    note.append(icon, text, link);
    messages.appendChild(note);
  }

  function renderHistory() {
    history.replaceChildren();
    if (!chats.length) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding:8px;color:rgba(245,245,250,.35);font-size:11px;line-height:1.6";
      empty.textContent = "Your saved chats will appear here.";
      history.appendChild(empty);
      return;
    }
    chats.forEach(chat => {
      const row = document.createElement("div");
      row.className = "lunar-ai-chat-item" + (activeChat?.id === chat.id ? " is-active" : "");
      row.setAttribute("role", "group");
      const open = document.createElement("button");
      open.type = "button";
      open.className = "lunar-ai-chat-item";
      open.style.cssText = "flex:1;min-width:0;padding:0;border:0;background:transparent;color:inherit;text-align:left";
      open.setAttribute("aria-label", "Open chat " + chat.title);
      const title = document.createElement("span");
      title.className = "lunar-ai-chat-title";
      title.textContent = chat.title || "New chat";
      open.appendChild(title);
      open.addEventListener("click", () => loadChat(chat.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "lunar-ai-chat-delete";
      remove.setAttribute("aria-label", "Delete chat");
      remove.title = "Delete chat";
      const trash = document.createElement("i");
      trash.className = "fa-regular fa-trash-can";
      remove.appendChild(trash);
      remove.addEventListener("click", async event => {
        event.stopPropagation();
        if (!window.confirm("Delete this saved chat? This cannot be undone.")) return;
        try {
          await api("/api/ai/chats/" + encodeURIComponent(chat.id), { method: "DELETE" });
          chats = chats.filter(item => item.id !== chat.id);
          if (activeChat?.id === chat.id) activeChat = null;
          renderHistory();
          renderMessages();
          setStatus("Chat deleted.");
        } catch (error) {
          setStatus(error.message);
        }
      });
      row.append(open, remove);
      history.appendChild(row);
    });
  }

  function renderMessages(optimistic = null) {
    messages.replaceChildren();
    const items = [...(activeChat?.messages || [])];
    if (optimistic) items.push(optimistic);
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "lunar-ai-empty";
      const mark = document.createElement("div");
      mark.className = "lunar-ai-empty-mark";
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-wand-magic-sparkles";
      mark.appendChild(icon);
      const heading = document.createElement("h2");
      heading.textContent = "How can I help you today?";
      const sub = document.createElement("p");
      sub.textContent = "Ask a question, work through a problem, or attach an image or text document for help.";
      empty.append(mark, heading, sub);
      messages.appendChild(empty);
      return;
    }
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "lunar-ai-message " + (item.role === "assistant" ? "assistant" : "user");
      if (item.role === "assistant") {
        const avatar = document.createElement("div");
        avatar.className = "lunar-ai-message-avatar";
        const icon = document.createElement("i");
        icon.className = "fa-solid fa-wand-magic-sparkles";
        avatar.appendChild(icon);
        row.appendChild(avatar);
      }
      const body = document.createElement("div");
      body.className = "lunar-ai-message-body";
      body.textContent = escapeText(item.content);
      if (Array.isArray(item.attachments) && item.attachments.length) {
        const chips = document.createElement("div");
        chips.className = "lunar-ai-attachments";
        item.attachments.forEach(name => {
          const chip = document.createElement("span");
          chip.className = "lunar-ai-attachment-chip";
          const icon = document.createElement("i");
          icon.className = String(name).match(/\.(png|jpe?g|webp)$/i) ? "fa-regular fa-image" : "fa-regular fa-file-lines";
          const label = document.createElement("span");
          label.textContent = name;
          chip.append(icon, label);
          chips.appendChild(chip);
        });
        body.appendChild(chips);
      }
      row.appendChild(body);
      if (item.role !== "assistant") {
        const avatar = document.createElement("div");
        avatar.className = "lunar-ai-message-avatar";
        const icon = document.createElement("i");
        icon.className = "fa-regular fa-user";
        avatar.appendChild(icon);
        row.appendChild(avatar);
      }
      messages.appendChild(row);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  function renderPending() {
    pending.replaceChildren();
    pendingFiles.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "lunar-ai-pending-item";
      const icon = document.createElement("i");
      icon.className = file.type.startsWith("image/") ? "fa-regular fa-image" : "fa-regular fa-file-lines";
      const name = document.createElement("span");
      name.textContent = file.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove " + file.name);
      const x = document.createElement("i");
      x.className = "fa-solid fa-xmark";
      remove.appendChild(x);
      remove.addEventListener("click", () => {
        pendingFiles.splice(index, 1);
        renderPending();
      });
      item.append(icon, name, remove);
      pending.appendChild(item);
    });
    sendButton.disabled = busy || (!textarea.value.trim() && !pendingFiles.length);
  }

  async function refreshChats() {
    try {
      const data = await api("/api/ai/chats");
      chats = Array.isArray(data.chats) ? data.chats : [];
      signedIn = true;
      renderHistory();
      return true;
    } catch (error) {
      if (/log in|logged in|account/i.test(error.message)) {
        signedIn = false;
        showAuthNote();
      } else {
        setStatus(error.message);
      }
      return false;
    }
  }

  async function loadChat(id) {
    setStatus("");
    try {
      const data = await api("/api/ai/chats/" + encodeURIComponent(id));
      activeChat = data.chat;
      renderHistory();
      renderMessages();
      panel.classList.remove("sidebar-open");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function createChat() {
    const data = await api("/api/ai/chats", jsonOptions({}));
    activeChat = data.chat;
    chats.unshift({ id: activeChat.id, title: activeChat.title, updatedAt: activeChat.updatedAt, messageCount: 0 });
    chats = chats.filter((chat, index, all) => all.findIndex(item => item.id === chat.id) === index);
    renderHistory();
    renderMessages();
    return activeChat;
  }

  async function openAi() {
    modal.hidden = false;
    document.body.classList.add("lunar-ai-open");
    setStatus("");
    const ok = await refreshChats();
    if (!ok) return;
    if (activeChat && chats.some(chat => chat.id === activeChat.id)) {
      await loadChat(activeChat.id);
    } else if (chats.length) {
      await loadChat(chats[0].id);
    } else {
      activeChat = null;
      renderHistory();
      renderMessages();
    }
    window.setTimeout(() => textarea.focus(), 50);
  }

  function closeAi() {
    modal.hidden = true;
    document.body.classList.remove("lunar-ai-open");
    panel.classList.remove("sidebar-open");
    launcher.focus();
  }

  function updateBusy(value) {
    busy = value;
    sendButton.disabled = value || (!textarea.value.trim() && !pendingFiles.length);
    uploadButton.disabled = value;
    newChatButton.disabled = value;
    textarea.disabled = value;
    sendButton.innerHTML = value ? '<i class="fa-solid fa-circle-notch fa-spin"></i>' : '<i class="fa-solid fa-arrow-up"></i>';
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read " + file.name + "."));
      reader.readAsDataURL(file);
    });
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (busy) return;
    const message = textarea.value.trim();
    if (!message && !pendingFiles.length) return;
    updateBusy(true);
    setStatus("");
    let optimistic = { role: "user", content: message || "Please analyze the attached file(s).", attachments: pendingFiles.map(file => file.name), createdAt: new Date().toISOString() };
    renderMessages(optimistic);
    try {
      if (!signedIn) {
        const ok = await refreshChats();
        if (!ok) throw new Error("Please log in to your Lunar account first.");
      }
      if (!activeChat) await createChat();
      const attachments = [];
      for (const file of pendingFiles) {
        if (file.name.toLowerCase().endsWith(".txt") || file.type === "text/plain") {
          const text = (await file.text()).slice(0, 12000);
          attachments.push({ name: file.name, type: "text/plain", text });
        } else {
          attachments.push({ name: file.name, type: file.type, data: await fileToDataUrl(file) });
        }
      }
      const data = await api("/api/ai/chats/" + encodeURIComponent(activeChat.id) + "/messages", jsonOptions({ message, attachments }));
      activeChat = data.chat;
      chats = [activeChat, ...chats.filter(chat => chat.id !== activeChat.id)];
      renderHistory();
      renderMessages();
      textarea.value = "";
      pendingFiles = [];
      fileInput.value = "";
      renderPending();
      setStatus("");
      textarea.focus();
    } catch (error) {
      renderMessages();
      setStatus(error.message || "Could not send your message.");
    } finally {
      updateBusy(false);
      textarea.focus();
    }
  }

  launcher.addEventListener("click", openAi);
  closeButton.addEventListener("click", closeAi);
  modal.addEventListener("click", event => {
    if (event.target.matches("[data-ai-close]")) closeAi();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) closeAi();
  });
  newChatButton.addEventListener("click", async () => {
    setStatus("");
    if (!signedIn) {
      const ok = await refreshChats();
      if (!ok) return;
    }
    try {
      activeChat = await createChat();
      panel.classList.remove("sidebar-open");
      textarea.focus();
    } catch (error) {
      setStatus(error.message);
    }
  });
  mobileMenu.addEventListener("click", () => panel.classList.toggle("sidebar-open"));
  uploadButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const chosen = Array.from(fileInput.files || []);
    const accepted = [];
    for (const file of chosen) {
      const isText = file.name.toLowerCase().endsWith(".txt") || file.type === "text/plain";
      const isImage = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
      if (!isText && !isImage) {
        setStatus(file.name + ": use .txt, PNG, JPG, or WEBP files.");
        continue;
      }
      if (isText && file.size > 100 * 1024) {
        setStatus(file.name + ": text files must be 100 KB or smaller.");
        continue;
      }
      if (isImage && file.size > 4 * 1024 * 1024) {
        setStatus(file.name + ": images must be 4 MB or smaller.");
        continue;
      }
      accepted.push(file);
    }
    for (const file of accepted) {
      if (pendingFiles.length >= 3) {
        setStatus("Attach up to 3 files per message.");
        break;
      }
      if (!pendingFiles.some(item => item.name === file.name && item.size === file.size)) pendingFiles.push(file);
    }
    const imageTotal = pendingFiles.filter(file => file.type.startsWith("image/")).reduce((sum, file) => sum + file.size, 0);
    if (imageTotal > 4 * 1024 * 1024) {
      pendingFiles = pendingFiles.filter(file => !file.type.startsWith("image/"));
      setStatus("Images must total 4 MB or less per message.");
    }
    renderPending();
    fileInput.value = "";
  });
  form.addEventListener("submit", sendMessage);
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
    sendButton.disabled = busy || (!textarea.value.trim() && !pendingFiles.length);
  });
  textarea.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  window.addEventListener("beforeunload", () => {
    document.body.classList.remove("lunar-ai-open");
  });
})();

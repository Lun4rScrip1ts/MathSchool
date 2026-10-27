document.addEventListener("DOMContentLoaded", async () => {
  const panel = document.querySelector(".lunar-console-panel");
  const feed = document.getElementById("lunar-discord-feed");
  const status = document.getElementById("lunar-chat-status");
  const form = document.getElementById("lunar-discord-form");
  const input = document.getElementById("lunar-discord-message");
  const send = document.getElementById("lunar-discord-send");
  const feedback = document.getElementById("lunar-discord-feedback");
  const count = document.getElementById("lunar-discord-count");
  const memberList = document.getElementById("lunar-member-list");
  const memberCount = document.getElementById("lunar-member-count");
  const memberSearch = document.getElementById("lunar-member-search");
  let cachedMembers = [];
  const emojiSuggestions = document.createElement("div");
  emojiSuggestions.className = "lunar-emoji-suggestions";
  emojiSuggestions.hidden = true;
  input.insertAdjacentElement("afterend", emojiSuggestions);
  const emojiList = [{"name":"smile","emoji":"😄"},{"name":"grin","emoji":"😁"},{"name":"joy","emoji":"😂"},{"name":"rofl","emoji":"🤣"},{"name":"smiley","emoji":"😃"},{"name":"laughing","emoji":"😆"},{"name":"wink","emoji":"😉"},{"name":"blush","emoji":"😊"},{"name":"heart_eyes","emoji":"😍"},{"name":"thinking","emoji":"🤔"},{"name":"think","emoji":"🤔"},{"name":"sob","emoji":"😭"},{"name":"cry","emoji":"😢"},{"name":"sad","emoji":"🙁"},{"name":"angry","emoji":"😠"},{"name":"rage","emoji":"😡"},{"name":"fire","emoji":"🔥"},{"name":"heart","emoji":"❤️"},{"name":"white_heart","emoji":"🤍"},{"name":"purple_heart","emoji":"💜"},{"name":"broken_heart","emoji":"💔"},{"name":"thumbsup","emoji":"👍"},{"name":"+1","emoji":"👍"},{"name":"thumbsdown","emoji":"👎"},{"name":"-1","emoji":"👎"},{"name":"wave","emoji":"👋"},{"name":"clap","emoji":"👏"},{"name":"pray","emoji":"🙏"},{"name":"eyes","emoji":"👀"},{"name":"skull","emoji":"💀"},{"name":"sparkles","emoji":"✨"},{"name":"star","emoji":"⭐"},{"name":"check","emoji":"✅"},{"name":"x","emoji":"❌"},{"name":"warning","emoji":"⚠️"},{"name":"sob","emoji":"😭"},{"name":"sunglasses","emoji":"😎"},{"name":"nerd","emoji":"🤓"},{"name":"skull","emoji":"💀"},{"name":"100","emoji":"💯"},{"name":"tada","emoji":"🎉"},{"name":"party","emoji":"🥳"},{"name":"thinking_face","emoji":"🤔"},{"name":"heartpulse","emoji":"💗"},{"name":"blue_heart","emoji":"💙"},{"name":"green_heart","emoji":"💚"},{"name":"yellow_heart","emoji":"💛"},{"name":"orange_heart","emoji":"🧡"},{"name":"black_heart","emoji":"🖤"},{"name":"kiss","emoji":"😘"},{"name":"pleading","emoji":"🥺"},{"name":"sweat_smile","emoji":"😅"},{"name":"upside_down","emoji":"🙃"},{"name":"shrug","emoji":"🤷"},{"name":"wave","emoji":"👋"},{"name":"rocket","emoji":"🚀"},{"name":"checkered_flag","emoji":"🏁"},{"name":"eyes","emoji":"👀"},{"name":"100","emoji":"💯"},{"name":"poop","emoji":"💩"},{"name":"coffee","emoji":"☕"},{"name":"pizza","emoji":"🍕"},{"name":"cat","emoji":"🐱"},{"name":"dog","emoji":"🐶"},{"name":"alien","emoji":"👽"},{"name":"ghost","emoji":"👻"},{"name":"moon","emoji":"🌙"},{"name":"sun","emoji":"☀️"},{"name":"rainbow","emoji":"🌈"},{"name":"snowflake","emoji":"❄️"},{"name":"muscle","emoji":"💪"},{"name":"handshake","emoji":"🤝"},{"name":"ok_hand","emoji":"👌"},{"name":"peace","emoji":"✌️"},{"name":"point_up","emoji":"☝️"},{"name":"thinking","emoji":"🤔"},{"name":"heart_on_fire","emoji":"❤️‍🔥"}];
  let activeEmojiIndex = 0;
  let matchingEmojis = [];
  const closeEmojiSuggestions = () => { emojiSuggestions.hidden = true; matchingEmojis = []; activeEmojiIndex = 0; };
  const renderEmojiSuggestions = () => {
    const cursor = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, cursor);
    const match = before.match(/:([a-z0-9_+-]{1,24})$/i);
    if (!match) { closeEmojiSuggestions(); return; }
    const query = match[1].toLowerCase();
    matchingEmojis = emojiList.filter(item => item.name.includes(query)).slice(0, 8);
    if (!matchingEmojis.length) { closeEmojiSuggestions(); return; }
    activeEmojiIndex = Math.min(activeEmojiIndex, matchingEmojis.length - 1);
    emojiSuggestions.replaceChildren();
    matchingEmojis.forEach((item, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "lunar-emoji-option" + (index === activeEmojiIndex ? " active" : "");
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === activeEmojiIndex));
      const emoji = document.createElement("span");
      emoji.className = "lunar-emoji-option-icon";
      emoji.textContent = item.emoji;
      const name = document.createElement("span");
      name.className = "lunar-emoji-option-name";
      name.textContent = ":" + item.name + ":";
      option.append(emoji, name);
      option.addEventListener("mousedown", event => { event.preventDefault(); chooseEmoji(index); });
      emojiSuggestions.appendChild(option);
    });
    emojiSuggestions.hidden = false;
  };
  const chooseEmoji = index => {
    const item = matchingEmojis[index];
    if (!item) return;
    const cursor = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, cursor);
    const match = before.match(/:([a-z0-9_+-]{1,24})$/i);
    if (!match) return closeEmojiSuggestions();
    const start = cursor - match[0].length;
    input.setRangeText(item.emoji, start, cursor, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    closeEmojiSuggestions();
    input.focus();
  };
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
        const avatar = document.createElement("img");
        avatar.className = "lunar-chat-avatar";
        avatar.alt = "";
        avatar.loading = "lazy";
        avatar.referrerPolicy = "no-referrer";
        avatar.src = message.avatarUrl || "https://cdn.discordapp.com/embed/avatars/0.png";
        avatar.addEventListener("error", () => {
          avatar.src = "https://cdn.discordapp.com/embed/avatars/0.png";
        }, { once: true });
        const authorBlock = document.createElement("div");
        authorBlock.className = "lunar-chat-author";
        const author = document.createElement("strong");
        author.textContent = message.displayName || message.username || "Unknown";
        authorBlock.appendChild(author);
        if (message.username) {
          const username = document.createElement("span");
          username.className = "lunar-chat-username";
          username.textContent = "@" + message.username;
          authorBlock.appendChild(username);
        }
        header.append(avatar, authorBlock);
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
        content.textContent = message.content || (message.attachments?.length ? "" : message.isBot ? "Bot message or embed" : "No text content");
        item.append(header, content);
        for (const attachment of Array.isArray(message.attachments) ? message.attachments : []) {
          if (!attachment.url) continue;
          if (String(attachment.contentType || "").startsWith("image/")) {
            const image = document.createElement("img");
            image.className = "lunar-chat-attachment-image";
            image.src = attachment.url;
            image.alt = attachment.filename || "Discord image";
            image.loading = "lazy";
            image.referrerPolicy = "no-referrer";
            item.appendChild(image);
          } else {
            const link = document.createElement("a");
            link.className = "lunar-chat-attachment-link";
            link.href = attachment.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = attachment.filename || "Open attachment";
            item.appendChild(link);
          }
        }
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

  const renderMembers = () => {
    const query = String(memberSearch.value || "").trim().toLowerCase();
    const filtered = cachedMembers.filter(member => (member.displayName + " " + member.username).toLowerCase().includes(query));
    memberList.replaceChildren();
    if (!filtered.length) { const empty = document.createElement("div"); empty.className = "lunar-member-empty"; empty.textContent = query ? "No matching members." : "No members found."; memberList.appendChild(empty); return; }
    const labels = { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" };
    let lastStatus = "";
    for (const member of filtered) {
      const statusName = labels[member.status] || "Offline";
      if (statusName !== lastStatus) { const group = document.createElement("div"); group.className = "lunar-member-group"; group.textContent = statusName; memberList.appendChild(group); lastStatus = statusName; }
      const row = document.createElement("div"); row.className = "lunar-member-row"; row.title = "@" + member.username;
      const wrap = document.createElement("div"); wrap.className = "lunar-member-avatar-wrap";
      const avatar = document.createElement("img"); avatar.className = "lunar-member-avatar"; avatar.src = member.avatarUrl; avatar.alt = ""; avatar.loading = "lazy";
      avatar.addEventListener("error", () => { avatar.src = "https://cdn.discordapp.com/embed/avatars/0.png"; }, { once: true });
      const dot = document.createElement("span"); dot.className = "lunar-member-status " + (member.status || "offline"); wrap.append(avatar, dot);
      const details = document.createElement("div"); details.className = "lunar-member-details";
      const name = document.createElement("span"); name.className = "lunar-member-name"; name.textContent = member.displayName || member.username;
      const subtitle = document.createElement("span"); subtitle.className = "lunar-member-subtitle"; subtitle.textContent = member.bot ? "Bot · @" + member.username : "@" + member.username;
      details.append(name, subtitle); row.append(wrap, details); memberList.appendChild(row);
    }
  };
  const loadMembers = async () => {
    try {
      const response = await fetch("/api/lunar-console/discord-members", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load members.");
      cachedMembers = Array.isArray(result.members) ? result.members : [];
      memberCount.textContent = cachedMembers.length + " members";
      renderMembers();
    } catch (error) {
      memberCount.textContent = "Unavailable";
      memberList.replaceChildren();
      const message = document.createElement("div"); message.className = "lunar-member-empty"; message.textContent = error.message || "Could not load members."; memberList.appendChild(message);
    }
  };
  memberSearch.addEventListener("input", renderMembers);
  input.addEventListener("input", () => { count.textContent = input.value.length + " / 1500"; renderEmojiSuggestions(); });
  input.addEventListener("click", renderEmojiSuggestions);
  input.addEventListener("keyup", event => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) renderEmojiSuggestions(); });
  input.addEventListener("keydown", event => {
    if (!emojiSuggestions.hidden && event.key === "ArrowDown") { event.preventDefault(); activeEmojiIndex = (activeEmojiIndex + 1) % matchingEmojis.length; renderEmojiSuggestions(); return; }
    if (!emojiSuggestions.hidden && event.key === "ArrowUp") { event.preventDefault(); activeEmojiIndex = (activeEmojiIndex - 1 + matchingEmojis.length) % matchingEmojis.length; renderEmojiSuggestions(); return; }
    if (!emojiSuggestions.hidden && event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); chooseEmoji(activeEmojiIndex); return; }
    if (event.key === "Escape") closeEmojiSuggestions();
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
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
      closeEmojiSuggestions();
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
  const typingLabel = document.createElement("div");
  typingLabel.className = "lunar-chat-typing";
  typingLabel.hidden = true;
  feed.insertAdjacentElement("beforebegin", typingLabel);
  const loadTyping = async () => {
    try {
      const response = await fetch("/api/lunar-console/discord-typing", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      const users = Array.isArray(result.users) ? result.users : [];
      typingLabel.hidden = !users.length;
      typingLabel.textContent = users.length === 1 ? (users[0].username || "Someone") + " is typing…" : users.length === 2 ? (users[0].username || "Someone") + " and " + (users[1].username || "someone") + " are typing…" : users.length > 2 ? "Several people are typing…" : "";
    } catch {}
  };
  await loadMessages();
  await loadTyping();
  await loadMembers();
  window.setInterval(loadMessages, 5000);
  window.setInterval(loadMembers, 30000);
  window.setInterval(loadTyping, 1500);
});
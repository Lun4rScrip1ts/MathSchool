(() => {
  const messagesEl = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const status = document.getElementById("chat-status");
  const note = document.getElementById("chat-login-note");
  const accountLabel = document.getElementById("community-account-label");
  const replyBar = document.getElementById("reply-bar");
  const replyLabel = document.getElementById("reply-label");
  const editBar = document.getElementById("edit-bar");
  const stickerDrawer = document.getElementById("sticker-drawer");
  const stickerGrid = document.getElementById("sticker-grid");
  const stickerEmpty = document.getElementById("sticker-empty");
  const toast = document.getElementById("chat-toast");
  const reactionPicker = document.getElementById("reaction-picker");
  const reactionUsers = document.getElementById("reaction-users");
  const attachmentDraftEl = document.getElementById("attachment-draft");
  const giphyPanel=document.getElementById("global-gif-panel"),giphySearch=document.getElementById("global-gif-search-input"),giphyGrid=document.getElementById("global-gif-grid"),giphyStatus=document.getElementById("global-gif-status"),giphyClose=document.getElementById("global-gif-close");
  let giphyKey="",giphyTab="trending",giphyItems=[];
  const attachmentPreviewEl = document.getElementById("attachment-preview");
  const attachmentNameEl = document.getElementById("attachment-name");
  const attachmentKindEl = document.getElementById("attachment-kind");
  const cancelAttachmentButton = document.getElementById("cancel-attachment");
  let currentUser = null;
  let guestMode = false;
  let messages = [];
  let replyTo = null;
  let editingId = null;
  let lastSignature = "";
  let refreshBusy = false;
  let toastTimer = null;
  let attachmentDraft = null;

  const escape = value => {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  };

  function roleBadges(roles){return (Array.isArray(roles)?roles:[]).map(role=>'<span class="chat-role-badge">'+escape(role)+'</span>').join("")}
const escapeAttr = value => escape(value).replace(/"/g, "&quot;");
  const initials = name => (name || "?").trim().slice(0, 2).toUpperCase();
  const avatar = user => {
    const avatarUrl = user?.avatarUrl || (user?.userId && user.userId === currentUser?.id ? currentUser?.avatarUrl : "");
    const name = user?.displayName || user?.username || currentUser?.displayName || currentUser?.username || "";
    return avatarUrl
      ? `<img src="${escapeAttr(avatarUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="chat-avatar-fallback" style="display:none">${escape(initials(name))}</span>`
      : escape(initials(name));
  };
  const time = iso => new Date(iso).toLocaleString([], {
    month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit"
  });

  async function api(url, options) {
    const response = await fetch(url, { credentials:"same-origin", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }
  function ensureForwardModal(){
    let modal=document.getElementById("chat-forward-modal");
    if(modal)return modal;
    modal=document.createElement("div");
    modal.id="chat-forward-modal";
    modal.className="modal-backdrop chat-forward-modal";
    modal.hidden=true;
    modal.innerHTML='<div class="forward-modal"><div class="modal-head"><strong>Forward message</strong><button type="button" data-close-chat-forward><i class="fa-solid fa-xmark"></i></button></div><p class="forward-question">Where would you like to forward this message?</p><div class="friend-search forward-search-wrap"><i class="fa-solid fa-magnifying-glass"></i><input id="chat-forward-search" placeholder="Search friends..."></div><div id="chat-forward-friends" class="forward-friends"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector("[data-close-chat-forward]").onclick=()=>{modal.hidden=true};
    modal.addEventListener("click",e=>{if(e.target===modal)modal.hidden=true});
    return modal;
  }
  async function openForwardGlobal(message){
    if(!currentUser)return;
    const modal=ensureForwardModal();
    const data=await api("/api/friends/bootstrap");
    const friends=data.friends||[];
    const search=modal.querySelector("#chat-forward-search");
    const list=modal.querySelector("#chat-forward-friends");
    const render=()=>{
      const q=(search.value||"").trim().toLowerCase();
      const filtered=friends.filter(f=>((f.displayName||"")+" "+(f.username||"")).toLowerCase().includes(q));
      list.innerHTML=filtered.map(f=>'<button data-chat-forward="'+escapeAttr(f.id)+'">'+(f.avatarUrl?'<img src="'+escapeAttr(f.avatarUrl)+'" alt="">':'<span class="forward-initials">'+escape(initials(f.displayName))+'</span>')+'<span><strong>'+escape(f.displayName)+'</strong><small>@'+escape(f.username)+'</small></span></button>').join("")||'<div class="friends-empty">No matching friends.</div>';
    };
    search.value="";
    search.oninput=render;
    list.onclick=async e=>{
      const b=e.target.closest("[data-chat-forward]"); if(!b)return;
      try{
        await api("/api/chat/messages/"+encodeURIComponent(message.id)+"/forward",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetType:"friend",recipientId:b.dataset.chatForward})});
        modal.hidden=true; showToast("Message forwarded.");
      }catch(err){showToast(err.message)}
    };
    render();
    modal.hidden=false;
    search.focus();
  }

  function closePopovers() {
    reactionPicker.hidden = true;
    reactionUsers.hidden = true;
  }

  function ensureChatMessageMenu() {
    let menu = document.getElementById("chat-message-menu");
    if (menu) return menu;
    menu = document.createElement("div");
    menu.id = "chat-message-menu";
    menu.className = "chat-message-menu";
    menu.hidden = true;
    document.body.appendChild(menu);
    menu.addEventListener("click", async event => {
      const button = event.target.closest("[data-chat-mm]");
      if (!button) return;
      const message = messages.find(item => item.id === menu.dataset.messageId);
      if (!message) return;
      menu.hidden = true;
      const action = button.dataset.chatMm;
      if (action === "copy") {
        try { await navigator.clipboard.writeText(message.message || ""); showToast("Copied."); }
        catch (error) { showToast(error.message || "Could not copy message."); }
      } else if (action === "forward") openForwardGlobal(message);
      else if (action === "react") showReactionPicker(button, message.id);
      else if (action === "reply") openReply(message);
      else if (action === "edit") openEdit(message);
      else if (action === "delete" && message.userId === currentUser?.id && !message.deletedAt) {
        if (!confirm("Delete this message?")) return;
        try { await api("/api/chat/messages/" + encodeURIComponent(message.id), {method:"DELETE"}); showToast("Message deleted."); await refresh(); }
        catch (error) { showToast(error.message); }
      }
    });
    return menu;
  }

  function showChatMessageMenu(message, anchor) {
    const menu = ensureChatMessageMenu();
    const own = message.userId === currentUser?.id;
    menu.innerHTML =
      '<button data-chat-mm="copy"><i class="fa-regular fa-copy"></i><span>Copy</span></button>' +
      '<button data-chat-mm="forward"><i class="fa-solid fa-share"></i><span>Forward</span></button>' +
      '<button data-chat-mm="react"><i class="fa-regular fa-face-smile"></i><span>React</span></button>' +
      '<button data-chat-mm="reply"><i class="fa-solid fa-reply"></i><span>Reply</span></button>' +
      (own && !message.deletedAt ? '<button data-chat-mm="edit"><i class="fa-solid fa-pen"></i><span>Edit</span></button><button data-chat-mm="delete"><i class="fa-regular fa-trash-can"></i><span>Delete</span></button>' : '');
    const rect = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(window.innerWidth - 190, rect.left)) + "px";
    menu.style.top = Math.max(8, Math.min(window.innerHeight - 230, rect.bottom + 5)) + "px";
    menu.dataset.messageId = message.id;
    menu.hidden = false;
  }

  function openReply(message) {
    if (!currentUser) return;
    editingId = null;
    editBar.hidden = true;
    replyTo = message;
    replyLabel.textContent = `Replying to @${message.username}: ${(message.message || "[attachment]").slice(0, 90)}`;
    replyBar.hidden = false;
    input.focus();
  }

  function cancelReply() {
    replyTo = null;
    replyBar.hidden = true;
  }

  function openEdit(message) {
    if (!currentUser || message.userId !== currentUser.id) return;
    replyTo = null;
    replyBar.hidden = true;
    editingId = message.id;
    editBar.hidden = false;
    input.value = message.message || "";
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function cancelEdit() {
    editingId = null;
    editBar.hidden = true;
    input.value = "";
  }

  function attachmentHtml(message) {
    const attachment = message.attachments?.[0];
    if (!attachment) return "";
    const url = escapeAttr(attachment.url);
    if (attachment.kind === "sticker") {
      const savedSticker = (currentUser?.stickers || []).find(sticker => sticker.url === attachment.url);
      return `<div class="chat-attachment chat-sticker-attachment" data-sticker-url="${url}" data-sticker-name="${escapeAttr(attachment.name || "Saved sticker")}" data-sticker-id="${escapeAttr(savedSticker?.id || "")}">
        <img src="${url}" alt="${escapeAttr(attachment.name || "Sticker")}" loading="lazy">
        <button class="sticker-save-badge ${savedSticker ? "is-saved" : ""}" type="button" title="${savedSticker ? "Remove from sticker collection" : "Save sticker"}" aria-label="${savedSticker ? "Remove from sticker collection" : "Save sticker"}"><i class="fa-${savedSticker ? "solid" : "regular"} fa-bookmark"></i></button>
      </div>`;
    }
    return `<div class="chat-attachment ${attachment.kind === "gif" ? "chat-gif" : "chat-image"}"><img src="${url}" alt="${escapeAttr(attachment.name || attachment.kind)}" loading="lazy"></div>`;
  }

  function reactionHtml(message) {
    return (message.reactions || []).map(reaction => {
      const mine = (reaction.users || []).some(user => user.userId === currentUser?.id);
      const kind = reaction.kind === "sticker" ? "sticker" : "emoji";
      const visual = kind === "sticker"
        ? `<img class="reaction-sticker" src="${escapeAttr(reaction.stickerUrl)}" alt="${escapeAttr(reaction.stickerName || "Sticker")}">`
        : `<span>${escape(reaction.emoji || "")}</span>`;
      return `<button type="button" class="reaction-pill ${mine ? "mine" : ""}" data-reaction-message="${message.id}" data-reaction-kind="${kind}" data-reaction-emoji="${escapeAttr(reaction.emoji || "")}" data-reaction-sticker-url="${escapeAttr(reaction.stickerUrl || "")}" title="Click to react • Right-click to see who reacted">
        ${visual}<b>${reaction.users?.length || 0}</b>
      </button>`;
    }).join("");
  }

  function render(messagesList) {
    const signature = JSON.stringify(messagesList.map(m => ({
      id:m.id, message:m.message, editedAt:m.editedAt, replyTo:m.replyTo?.id || "",
      attachments:m.attachments || [], reactions:m.reactions || [], avatarUrl:m.avatarUrl || "", username:m.username || "", displayName:m.displayName || ""
    })));
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
    messages = messagesList;
    if (signature === lastSignature) return;
    lastSignature = signature;

    let previousSender = "";
    let previousTime = 0;
    messagesEl.innerHTML = messagesList.map(message => {
      const currentTime = Date.parse(message.createdAt) || 0;
      const grouped = previousSender === message.userId &&
        currentTime - previousTime <= 5 * 60 * 1000 &&
        !message.replyTo;
      previousSender = message.userId;
      previousTime = currentTime;

      return `
      <article class="chat-message ${message.deletedAt ? "is-deleted" : ""} ${grouped ? "is-grouped" : ""}" data-message-id="${message.id}" data-own-message="${message.userId === currentUser?.id ? "true" : "false"}">
        <div class="chat-avatar">${grouped ? "" : `<button type="button" class="chat-profile-trigger" data-profile-user="${escapeAttr(message.username)}">${avatar(message.userId === currentUser?.id ? {...message, avatarUrl: currentUser?.avatarUrl || message.avatarUrl, displayName: currentUser?.displayName || message.displayName} : message)}</button>`}</div>
        <div class="chat-message-body">
          ${grouped ? "" : `<div class="chat-meta">
            <button type="button" class="chat-name chat-profile-trigger" data-profile-user="${escapeAttr(message.username)}">${escape(message.displayName)}</button>
            ${roleBadges(message.roles)}
            <time class="chat-time" datetime="${escapeAttr(message.createdAt)}">${escape(time(message.createdAt))}</time>
          </div>`}
          ${message.forwarded ? `<div class="chat-edited">Forwarded</div>` : ""}
          ${message.replyTo ? `<button type="button" class="chat-reply-preview" data-jump-to="${escapeAttr(message.replyTo.id)}"><i class="fa-solid fa-reply"></i><span>Replying to <b>@${escape(message.replyTo.username)}</b>: ${escape((message.replyTo.message || "[attachment]").slice(0, 90))}</span></button>` : ""}
          ${message.deletedAt ? `<div class="chat-deleted"><i class="fa-solid fa-ban"></i><span>Message deleted</span></div>` : `<div class="chat-text">${escape(message.message)}</div>
          ${attachmentHtml(message)}
          ${message.editedAt ? `<div class="chat-edited" title="${escapeAttr("Edited " + time(message.editedAt))}">Edited</div>` : ""}
          <div class="reaction-row">${reactionHtml(message)}</div>`}
        </div>
        <div class="message-actions" aria-label="Message actions">
          <div class="quick-reactions" aria-label="Quick reactions">
            <button type="button" data-quick-reaction="😀">😀</button><button type="button" data-quick-reaction="❤️">❤️</button><button type="button" data-quick-reaction="😂">😂</button><button type="button" data-quick-reaction="😮">😮</button><button type="button" data-quick-reaction="😢">😢</button><button type="button" data-quick-reaction="👍">👍</button>
          </div>
          <button type="button" data-action="react" title="Add reaction"><i class="fa-regular fa-face-smile"></i></button>
          <button type="button" data-action="reply" title="Reply"><i class="fa-solid fa-reply"></i></button>
          <button type="button" data-action="forward" title="Forward"><i class="fa-solid fa-share"></i></button>
          <button type="button" data-action="copy" title="Copy"><i class="fa-regular fa-copy"></i></button>
          ${message.userId === currentUser?.id && !message.deletedAt ? `<button type="button" data-action="edit" title="Edit"><i class="fa-solid fa-pen"></i></button><button type="button" data-action="delete" title="Delete"><i class="fa-regular fa-trash-can"></i></button>` : ""}
          <button type="button" data-action="menu" title="More"><i class="fa-solid fa-ellipsis"></i></button>
        </div>
      </article>`;
    }).join("");

    if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

function canManageProfileRoles(){
    return ["lunar","lunarstudios"].includes(String(currentUser?.username||"").toLowerCase());
  }
  async function renderProfileRoleManager(container, user){
    if(!container || !canManageProfileRoles()) return;
    container.innerHTML='<div class="profile-role-manager"><div class="profile-role-manager-head"><div><strong>Profile Roles</strong><span>Only @lunar and @lunarstudios can edit these tags.</span></div></div><div class="profile-role-manager-list">'+(user.roles||[]).map(role=>'<span class="profile-role-edit-tag">'+escape(role)+'<button type="button" data-remove-profile-role="'+escapeAttr(role)+'" aria-label="Remove '+escapeAttr(role)+'"><i class="fa-solid fa-xmark"></i></button></span>').join("")+'</div><div class="profile-role-manager-add"><input type="text" maxlength="32" placeholder="Add a role..."><button type="button" data-add-profile-role><i class="fa-solid fa-plus"></i> Add</button></div></div>';
    const save=async roles=>{
      try{
        const data=await api("/api/users/"+encodeURIComponent(user.username)+"/roles",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({roles})});
        user.roles=data.user.roles||[];
        document.getElementById("friends-profile-roles").innerHTML=user.roles.map(r=>"<span>"+escape(r)+"</span>").join("");
        await renderProfileRoleManager(container,user);
        showToast("Profile roles updated.");
      }catch(error){showToast(error.message)}
    };
    container.querySelector("[data-add-profile-role]")?.addEventListener("click",async()=>{
      const input=container.querySelector("input");
      const role=(input?.value||"").trim();
      if(!role)return;
      if((user.roles||[]).some(r=>r.toLowerCase()===role.toLowerCase())){showToast("That role is already on the profile.");return;}
      await save([...(user.roles||[]),role]);
    });
    container.querySelector("input")?.addEventListener("keydown",e=>{
      if(e.key==="Enter"){e.preventDefault();container.querySelector("[data-add-profile-role]")?.click();}
    });
    container.querySelectorAll("[data-remove-profile-role]").forEach(button=>{
      button.addEventListener("click",()=>save((user.roles||[]).filter(role=>role!==button.dataset.removeProfileRole)));
    });
  }

  async function openChatProfile(username, anchor = null) {
    try {
      const data = await api("/api/users/" + encodeURIComponent(username));
      const u = data.user;
      if (!u) return;

      let modal = document.getElementById("friends-profile-modal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "friends-profile-modal";
        modal.className = "friends-profile-modal";
        modal.hidden = true;
        modal.innerHTML = '<div class="friends-profile-card"><button id="friends-profile-close" class="friends-profile-close" type="button" aria-label="Close profile"><i class="fa-solid fa-xmark"></i></button><div id="friends-profile-banner" class="friends-profile-banner"></div><div class="friends-profile-body"><div id="friends-profile-avatar" class="friends-profile-avatar"></div><div class="friends-profile-name"><h2 id="friends-profile-display"></h2><span id="friends-profile-owner" class="friends-profile-owner" hidden>Owner</span></div><div id="friends-profile-username" class="friends-profile-username"></div><div id="friends-profile-status" class="friends-profile-status"></div><div id="friends-profile-member" class="friends-profile-member"></div><p id="friends-profile-bio" class="friends-profile-bio"></p><div id="friends-profile-actions" class="profile-actions"><button id="friends-profile-message" type="button" class="message-action">Message</button><button id="friends-profile-friend" type="button" class="friend-action">Friend</button><button id="friends-profile-block" type="button" class="block-action">Block</button><button id="friends-profile-report" type="button" class="report-action">Report</button></div><div id="friends-profile-roles" class="friends-profile-roles"></div><div id="friends-profile-stickers" class="friends-profile-stickers"></div></div></div>';
        document.body.appendChild(modal);
      }

      const avatarHtml = user => user && user.avatarUrl
        ? '<img src="' + escapeAttr(user.avatarUrl) + '" alt="" onerror="this.remove()">'
        : escape(initials(user && (user.displayName || user.username)));

      document.getElementById("friends-profile-avatar").innerHTML = avatarHtml(u);
      document.getElementById("friends-profile-display").textContent = u.displayName || u.username;
      document.getElementById("friends-profile-username").textContent = "@" + u.username;
      document.getElementById("friends-profile-status").textContent = u.isOnline ? "Online" : (u.status || "Offline");
      document.getElementById("friends-profile-status").classList.toggle("is-online", Boolean(u.isOnline));
      document.getElementById("friends-profile-member").textContent = u.createdAt
        ? "Member since " + new Date(u.createdAt).toLocaleDateString([], {month:"short",year:"numeric"})
        : "";
      document.getElementById("friends-profile-bio").textContent = u.bio || "No bio yet.";
      document.getElementById("friends-profile-owner").hidden = !u.isOwner;
      document.getElementById("friends-profile-roles").innerHTML = (u.roles || []).map(r => "<span>" + escape(r) + "</span>").join("");
      let roleManager = document.getElementById("friends-profile-role-manager");
      if (!roleManager) { roleManager = document.createElement("div"); roleManager.id = "friends-profile-role-manager"; document.getElementById("friends-profile-roles").after(roleManager); }
      roleManager.innerHTML = "";
      renderProfileRoleManager(roleManager, u);
      document.getElementById("friends-profile-stickers").innerHTML = (u.stickers || []).slice(0, 12).map(sticker =>
        '<img src="' + escapeAttr(sticker.url) + '" alt="' + escapeAttr(sticker.name || "Sticker") + '" loading="lazy">'
      ).join("");

      const banner = document.getElementById("friends-profile-banner");
      banner.style.backgroundImage = u.bannerUrl
        ? 'url("' + String(u.bannerUrl).replace(/"/g, '\\\"') + '")'
        : "none";

      const card = modal.querySelector(".friends-profile-card");
      const bg = u.backgroundUrl || "";
      card.style.backgroundImage = bg
        ? 'linear-gradient(180deg,rgba(10,12,17,.18),rgba(10,12,17,.94) 62%),url("' + String(bg).replace(/"/g, '\\\"') + '")'
        : "linear-gradient(180deg,#20242d,#17191e)";
      card.style.backgroundSize = bg ? "cover" : "auto";
      card.style.backgroundPosition = "center";

      const actions = document.getElementById("friends-profile-actions");
      const mutuals = Array.isArray(u.mutualFriends) ? u.mutualFriends : [];
      let mutualBox = document.getElementById("friends-profile-mutuals");
      if (!mutualBox) {
        mutualBox = document.createElement("div");
        mutualBox.id = "friends-profile-mutuals";
        mutualBox.className = "friends-profile-mutuals";
        actions.before(mutualBox);
      }
      mutualBox.innerHTML = mutuals.length
        ? '<strong>' + mutuals.length + ' Mutual Friend' + (mutuals.length === 1 ? "" : "s") + '</strong><div>' +
          mutuals.slice(0, 6).map(m => m.avatarUrl
            ? '<img src="' + escapeAttr(m.avatarUrl) + '" alt="@' + escapeAttr(m.username) + '" title="@' + escapeAttr(m.username) + '">'
            : '<span title="@' + escapeAttr(m.username) + '">' + escape(initials(m.displayName || m.username)) + '</span>').join("") +
          '</div>'
        : "<strong>No Mutual Friends</strong>";

      actions.hidden = !!u.isSelf;
      const message = document.getElementById("friends-profile-message");
      const friend = document.getElementById("friends-profile-friend");
      const block = document.getElementById("friends-profile-block");
      const report = document.getElementById("friends-profile-report");

      message.onclick = () => { location.href = "/friends?user=" + encodeURIComponent(u.username); };
      friend.textContent = u.isFriend ? "Added" : (u.friendRequestPending ? "Pending" : "Friend");
      friend.disabled = !!u.isFriend || !!u.friendRequestPending;
      friend.onclick = async () => {
        try {
          await api("/api/friends/requests", {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({username:u.username})
          });
          friend.textContent = "Pending";
          friend.disabled = true;
          showToast("Friend request sent.");
        } catch (e) {
          showToast(e.message);
        }
      };
      block.textContent = u.isBlocked ? "Blocked" : "Block";
      block.disabled = !!u.isBlocked;
      block.onclick = async () => {
        if (!confirm("Block @" + u.username + "?")) return;
        try {
          await api("/api/friends/block/" + encodeURIComponent(u.id), {method:"POST"});
          block.textContent = "Blocked";
          block.disabled = true;
          showToast("User blocked.");
          closeChatProfile();
        } catch (e) {
          showToast(e.message);
        }
      };
      if (report) {
        report.onclick = async () => {
          try {
            await api("/api/friends/report/" + encodeURIComponent(u.id), {
              method:"POST",
              headers:{"Content-Type":"application/json"},
              body:JSON.stringify({reason:"Reported from Global Chat profile"})
            });
            showToast("Report submitted.");
          } catch (e) {
            showToast(e.message);
          }
        };
      }

      modal.hidden = false;
      modal.onclick = e => { if (e.target === modal) closeChatProfile(); };
      document.getElementById("friends-profile-close").onclick = closeChatProfile;
    } catch (e) {
      showToast(e.message);
    }
  }

  function closeChatProfile() {
    const modal = document.getElementById("friends-profile-modal");
    if (modal) modal.hidden = true;
  }

  function renderStickers(stickers) {
    stickerGrid.innerHTML = (stickers || []).map(sticker => `
      <button type="button" class="sticker-card" data-send-sticker="${escapeAttr(sticker.url)}" data-sticker-name="${escapeAttr(sticker.name || "Saved sticker")}">
        <img src="${escapeAttr(sticker.url)}" alt="${escapeAttr(sticker.name || "Sticker")}" loading="lazy">
        <span>${escape(sticker.name || "Sticker")}</span>
      </button>
    `).join("");
    stickerEmpty.hidden = Boolean(stickers?.length);
    document.getElementById("sticker-count").textContent = `${stickers?.length || 0} saved sticker${stickers?.length === 1 ? "" : "s"}`;
  }


  function gifObject(g){return{id:g.id,title:g.title||"GIF",url:g.images?.original?.url||g.images?.fixed_width?.url,preview:g.images?.fixed_width?.url||g.images?.downsized?.url||g.images?.original?.url}}
  async function loadGlobalGifs(){if(!giphyPanel)return;if(giphyTab==="favorites"){try{const d=await api("/api/friends/bootstrap");giphyItems=d.gifFavorites||[];renderGlobalGifs(giphyItems)}catch(e){giphyStatus.textContent=e.message}return}if(!giphyKey)return;const q=giphySearch?.value.trim()||"";const url=q?"https://api.giphy.com/v1/gifs/search?api_key="+encodeURIComponent(giphyKey)+"&q="+encodeURIComponent(q)+"&limit=30&rating=g&bundle=messaging_non_clips":"https://api.giphy.com/v1/gifs/trending?api_key="+encodeURIComponent(giphyKey)+"&limit=30&rating=g&bundle=messaging_non_clips";try{const r=await fetch(url);const d=await r.json();if(!r.ok)throw Error(d.message||"GIF search failed.");giphyItems=(d.data||[]).map(gifObject);renderGlobalGifs(giphyItems)}catch(e){giphyStatus.textContent=e.message}}
  function renderGlobalGifs(list){
    giphyGrid.innerHTML=(list||[]).map(g=>'<button class="gif-card" data-global-gif-id="'+escapeAttr(g.id)+'"><img src="'+escapeAttr(g.preview||g.url)+'" alt=""><span class="gif-fav '+(giphyTab==="favorites"?"is-saved":"")+'" title="'+(giphyTab==="favorites"?"Saved GIF":"Save GIF")+'"><i class="fa-'+(giphyTab==="favorites"?"solid":"regular")+' fa-bookmark"></i></span></button>').join("");
    giphyStatus.textContent=list?.length?"":"No GIFs found.";
  }
  async function setupGlobalGifs(){if(!giphyPanel)return;try{const d=await api("/api/friends/gifs/config");giphyKey=d.apiKey;loadGlobalGifs()}catch(e){giphyStatus.textContent=e.message}}

  async function refresh() {
    if (refreshBusy) return;
    refreshBusy = true;
    try {
      const [me, chat] = await Promise.all([
        api("/api/auth/me"),
        api("/api/chat/messages?limit=100")
      ]);
      currentUser = me.user;
      guestMode = Boolean(me.guest);
      status.textContent = currentUser ? `Signed in as @${currentUser.username}` : (guestMode ? "Browsing as guest · Read-only" : "Read-only mode");
      accountLabel.textContent = currentUser ? "Profile" : (guestMode ? "Guest" : "Log in");
      note.hidden = Boolean(currentUser);
      if (guestMode) note.querySelector("span").textContent = "Guest browsing is read-only. Create an account to send messages or use community features.";
      form.hidden = guestMode;
      input.disabled = !currentUser;
      input.placeholder = currentUser ? (editingId ? "Edit your message..." : "Write a message...") : (guestMode ? "Guest browsing is read-only" : "Log in to send a message");
      render(chat.messages);
      if (currentUser) renderStickers(currentUser.stickers || []);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      refreshBusy = false;
    }
  }

  function clearAttachmentDraft() {
    attachmentDraft = null;
    attachmentDraftEl.hidden = true;
    attachmentPreviewEl.innerHTML = "";
    attachmentNameEl.textContent = "Attachment";
    attachmentKindEl.textContent = "Ready to send";
  }

  async function setAttachmentDraft(file, kind) {
    if (!currentUser) {
      location.href = "/account";
      return;
    }
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)) {
      showToast("Use a PNG, JPG, WEBP, or GIF image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("Images must be smaller than 8 MB.");
      return;
    }
    if (kind === "gif" && file.type !== "image/gif") {
      showToast("Choose a GIF file for the GIF button.");
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the image."));
        reader.readAsDataURL(file);
      });

      attachmentDraft = {
        file,
        kind,
        dataUrl,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || (kind === "sticker" ? "Sticker" : "Image")
      };

      attachmentNameEl.textContent = attachmentDraft.name;
      attachmentKindEl.textContent = kind === "sticker"
        ? "Sticker preview"
        : kind === "gif"
          ? "GIF preview"
          : "Image preview";

      attachmentPreviewEl.innerHTML = "";
      const preview = document.createElement("img");
      preview.src = dataUrl;
      preview.alt = attachmentDraft.name;
      attachmentPreviewEl.appendChild(preview);
      attachmentDraftEl.hidden = false;
    } catch (error) {
      clearAttachmentDraft();
      showToast(error.message);
    }
  }

  async function uploadDraft() {
    if (!attachmentDraft) return null;

    const draft = attachmentDraft;
    const uploaded = await api("/api/chat/uploads", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({kind:draft.kind, data:draft.dataUrl})
    });

    return {
      url: uploaded.url,
      kind: uploaded.kind,
      name: draft.name
    };
  }

  const stickerCreateInline = document.getElementById("sticker-create-inline");
  const stickerCreateForm = document.getElementById("sticker-create-form");
  const stickerCreateFile = document.getElementById("sticker-create-file");
  const stickerCreatePreview = document.getElementById("sticker-create-preview");
  let stickerCreateData = "";
  const openStickerCreator = () => {
    if (!stickerCreateInline) return;
    stickerCreateInline.hidden = false;
    stickerCreateForm?.reset();
    stickerCreateData = "";
    if (stickerCreatePreview) stickerCreatePreview.innerHTML = '<i class="fa-regular fa-image"></i>';
    document.getElementById("sticker-create-name")?.focus();
  };
  const closeStickerCreator = () => {
    if (!stickerCreateInline) return;
    stickerCreateInline.hidden = true;
    stickerCreateData = "";
  };
  const readStickerFile = file => new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Choose an image first."));
    if (!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)) return reject(new Error("Use PNG, JPG, WEBP, or GIF."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("Sticker images must be smaller than 8 MB."));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
  stickerCreateFile?.addEventListener("change", async event => {
    try {
      stickerCreateData = await readStickerFile(event.target.files?.[0]);
      if (stickerCreatePreview) stickerCreatePreview.innerHTML = '<img src="' + escapeAttr(stickerCreateData) + '" alt="Sticker preview">';
    } catch (error) {
      stickerCreateData = "";
      showToast(error.message);
    }
  });
  document.getElementById("sticker-browse")?.addEventListener("click", () => stickerCreateFile?.click());
  document.getElementById("sticker-upload-zone")?.addEventListener("click", event => {
    if (!event.target.closest("button")) stickerCreateFile?.click();
  });
  document.getElementById("open-sticker-create")?.addEventListener("click", openStickerCreator);
  document.getElementById("close-sticker-create")?.addEventListener("click", closeStickerCreator);
  document.getElementById("cancel-sticker-create")?.addEventListener("click", closeStickerCreator);
  stickerCreateForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!stickerCreateData) return showToast("Upload a sticker image first.");
    const saveButton = document.getElementById("save-sticker-create");
    if (saveButton) { saveButton.disabled = true; saveButton.classList.add("is-loading"); }
    try {
      const data = await api("/api/stickers/create", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          data: stickerCreateData,
          name: document.getElementById("sticker-create-name")?.value.trim() || "My Sticker",
          emoji: document.getElementById("sticker-create-emoji")?.value.trim() || "",
          category: document.getElementById("sticker-create-category")?.value || "Custom"
        })
      });
      currentUser.stickers = data.stickers || [];
      renderStickers(currentUser.stickers);
      closeStickerCreator();
      const context = pickerContext.type === "reaction" || pickerContext.type === "browse"
        ? pickerContext
        : {type:"browse",messageId:"",anchor:document.getElementById("chat-sticker-button")};
      await openUnifiedPicker("stickers", context.anchor || document.getElementById("chat-emoji-button"), context);
      showToast("Sticker created and added to your collection.");
    } catch (error) {
      showToast(error.message);
    } finally {
      if (saveButton) { saveButton.disabled = false; saveButton.classList.remove("is-loading"); }
    }
  });

  async function saveSticker(url, name) {
    if (!currentUser || !url) return null;
    try {
      const data = await api("/api/stickers/save", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({url, name:name || "Saved sticker"})
      });
      currentUser.stickers = data.stickers || [];
      renderStickers(currentUser.stickers);
      return currentUser.stickers.find(sticker => sticker.url === url) || null;
    } catch {
      return null;
    }
  }

  async function removeSticker(url) {
    if (!currentUser || !url) return false;
    const saved = (currentUser.stickers || []).find(sticker => sticker.url === url);
    if (!saved?.id) return false;
    try {
      const data = await api("/api/stickers/" + encodeURIComponent(saved.id), {method:"DELETE"});
      currentUser.stickers = data.stickers || [];
      renderStickers(currentUser.stickers);
      return true;
    } catch {
      return false;
    }
  }

  async function toggleStickerSave(attachment) {
    if (!currentUser || !attachment?.url) return;
    const saved = (currentUser.stickers || []).find(sticker => sticker.url === attachment.url);
    const badge = attachment.querySelector(".sticker-save-badge");
    if (badge) {
      badge.disabled = true;
      badge.classList.toggle("is-saving", true);
    }

    try {
      if (saved) {
        const removed = await removeSticker(attachment.url);
        if (removed && badge) {
          badge.classList.remove("is-saved");
          badge.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
          badge.title = "Save sticker";
          badge.setAttribute("aria-label", "Save sticker");
        }
        if (removed) showToast("Sticker removed from your collection.");
      } else {
        const added = await saveSticker(attachment.url, attachment.dataset.stickerName);
        if (added && badge) {
          badge.classList.add("is-saved");
          badge.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
          badge.title = "Remove from sticker collection";
          badge.setAttribute("aria-label", "Remove from sticker collection");
        }
        if (added) showToast("Sticker saved to your collection.");
      }
    } finally {
      if (badge) {
        badge.disabled = false;
        badge.classList.remove("is-saving");
      }
    }
  }

  async function sendMessage(text, attachment = null) {
    if (!currentUser) return;
    const payload = { message:text, attachment };
    if (replyTo) payload.replyTo = replyTo.id;
    const data = await api("/api/chat/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    if (attachment?.kind === "sticker") await saveSticker(attachment.url, attachment.name);
    replyTo = null;
    replyBar.hidden = true;
    input.value = "";
    clearAttachmentDraft();
    await refresh();
    input.focus();
    return data;
  }

  let pickerContext = {type:"compose", messageId:"", anchor:null};
  let emojiPickerElement = null;
  let emojiPickerLoading = null;

  function setPickerTab(tab) {
    const stickerTab = document.querySelector("#reaction-picker [data-picker-tab=\"stickers\"]");
    const stickersAllowed = pickerContext.type === "reaction" || pickerContext.type === "browse" || pickerContext.type === "compose";
    if (stickerTab) stickerTab.hidden = !stickersAllowed;
    if (!stickersAllowed && tab === "stickers") tab = "emoji";
    document.querySelectorAll("#reaction-picker [data-picker-tab]").forEach(button => button.classList.toggle("active", button.dataset.pickerTab === tab));
    document.querySelectorAll("#reaction-picker [data-picker-pane]").forEach(pane => pane.classList.toggle("active", pane.dataset.pickerPane === tab));
    if (tab === "stickers") renderStickers(currentUser?.stickers || []); else renderRecentEmojis();
  }

  function renderRecentEmojis(){
    const wrap=document.getElementById("community-emoji-recent");if(!wrap)return;let recent=[];try{recent=JSON.parse(localStorage.getItem("lunar-recent-emojis")||"[]")}catch{}
    wrap.innerHTML=recent.map(emoji=>`<button type="button" data-recent-emoji="${escapeAttr(emoji)}" title="Recently used">${escape(emoji)}</button>`).join("");wrap.hidden=!recent.length;
  }
  function rememberEmoji(emoji){let recent=[];try{recent=JSON.parse(localStorage.getItem("lunar-recent-emojis")||"[]")}catch{};recent=[emoji,...recent.filter(x=>x!==emoji)].slice(0,24);localStorage.setItem("lunar-recent-emojis",JSON.stringify(recent));renderRecentEmojis();}
  async function ensureEmojiPicker() {
    if (emojiPickerElement) return emojiPickerElement;
    if (emojiPickerLoading) return emojiPickerLoading;
    emojiPickerLoading = (async () => {
      if (!customElements.get("emoji-picker")) await import("https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js");
      await customElements.whenDefined("emoji-picker");
      const host = document.getElementById("community-emoji-picker-host");
      if (!host) return null;
      emojiPickerElement = document.createElement("emoji-picker");
      emojiPickerElement.className = "dark";
      emojiPickerElement.setAttribute("locale", "en");
      emojiPickerElement.setAttribute("emoji-version", "17.0");
      host.replaceChildren(emojiPickerElement);
      emojiPickerElement.addEventListener("emoji-click", async event => {
        const emoji = event.detail?.unicode;
        if (!emoji) return;
        rememberEmoji(emoji);
        if (pickerContext.type === "reaction") return reactWithPickerEmoji(pickerContext.messageId, emoji);
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        input.setRangeText(emoji, start, end, "end");
        input.focus();
        closePopovers();
      });
      return emojiPickerElement;
    })().catch(error => { emojiPickerLoading = null; showToast("Emoji picker could not load. Please try again."); throw error; });
    return emojiPickerLoading;
  }

  function positionPicker(anchor) {
    const rect = (anchor || document.getElementById("chat-gif-button"))?.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 20);
    const height = Math.min(500, window.innerHeight - 100);
    let left = rect ? rect.left + rect.width / 2 - width / 2 : (window.innerWidth - width) / 2;
    let top = rect ? rect.top - height - 8 : 80;
    if (top < 8) top = rect ? rect.bottom + 8 : 80;
    reactionPicker.style.setProperty("width",width+"px","important");
    reactionPicker.style.setProperty("left",Math.max(8,Math.min(window.innerWidth-width-8,left))+"px","important");
    reactionPicker.style.setProperty("right","auto","important");
    reactionPicker.style.setProperty("bottom","auto","important");
    reactionPicker.style.setProperty("top",Math.max(8,Math.min(window.innerHeight-height-8,top))+"px","important");
  }

  async function openUnifiedPicker(tab="emoji", anchor=null, context={type:"compose"}) {
    if (!currentUser) { location.href="/account"; return; }
    pickerContext = context;
    await ensureEmojiPicker();
    const slot = document.getElementById("community-sticker-slot");
    if (stickerDrawer && slot && stickerDrawer.parentElement !== slot) slot.appendChild(stickerDrawer);
    renderStickers(currentUser.stickers || []);
    setPickerTab(tab);
    reactionUsers.hidden = true;
    reactionPicker.hidden = false;
    positionPicker(anchor);
  }

  async function reactWithPickerEmoji(messageId, emoji) {
    try {
      await api("/api/chat/messages/" + encodeURIComponent(messageId) + "/reactions", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"emoji",emoji})});
      closePopovers();
      await refresh();
    } catch (error) { showToast(error.message); }
  }

  async function reactWithPickerSticker(messageId, sticker) {
    try {
      await api("/api/chat/messages/" + encodeURIComponent(messageId) + "/reactions", {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({kind:"sticker",stickerUrl:sticker.url,stickerName:sticker.name || "Sticker"})
      });
      closePopovers();
      await refresh();
    } catch (error) { showToast(error.message); }
  }

  function showReactionPicker(button, messageId) { openUnifiedPicker("emoji", button, {type:"reaction", messageId}); }

  document.getElementById("community-emoji-recent")?.addEventListener("click", event => { const b=event.target.closest("[data-recent-emoji]"); if(!b)return; const emoji=b.dataset.recentEmoji; if(pickerContext.type==="reaction") reactWithPickerEmoji(pickerContext.messageId,emoji); else { const start=input.selectionStart??input.value.length; const end=input.selectionEnd??start; input.setRangeText(emoji,start,end,"end"); input.focus(); closePopovers(); } });
  reactionPicker.addEventListener("click", async event => {
    const tab = event.target.closest("[data-picker-tab]");
    if (tab) { setPickerTab(tab.dataset.pickerTab); return; }
    if (event.target.closest("#emoji-sticker-close")) { closePopovers(); return; }
    const sticker = event.target.closest("[data-send-sticker]");
    if (!sticker) return;

    const stickerData = {
      url: sticker.dataset.sendSticker,
      name: sticker.dataset.stickerName || "Sticker"
    };

    if (pickerContext.type === "reaction") {
      await reactWithPickerSticker(pickerContext.messageId, stickerData);
      return;
    }

    if (pickerContext.type === "compose") {
      try {
        await sendMessage("", {kind:"sticker", url:stickerData.url, name:stickerData.name});
        closePopovers();
      } catch (error) {
        showToast(error.message);
      }
    }
  });
  function showReactionUsers(button, reaction) {
    closePopovers();
    const users = reaction?.users || [];
    reactionUsers.innerHTML = `
      <div class="reaction-users-title">${escape(reaction?.emoji || "")} ${users.length} reaction${users.length === 1 ? "" : "s"}</div>
      <div class="reaction-users-list">${users.map(user => `<a href="/profile/${encodeURIComponent(user.username)}"><span class="reaction-user-avatar">${escape(initials(user.username))}</span>@${escape(user.username)}</a>`).join("") || "<span class=\"reaction-users-empty\">Nobody has reacted yet.</span>"}</div>
    `;
    const rect = button.getBoundingClientRect();
    reactionUsers.style.left = Math.max(8, Math.min(window.innerWidth - 260, rect.left)) + "px";
    reactionUsers.style.top = Math.max(8, rect.top - Math.min(220, 70 + users.length * 34)) + "px";
    reactionUsers.hidden = false;
  }

  messagesEl.addEventListener("click", event => {
    const profile = event.target.closest("[data-profile-user]");
    if (profile) { event.preventDefault(); openChatProfile(profile.dataset.profileUser, profile); }
  });

  messagesEl.addEventListener("click", async event => {
    const messageArticle = event.target.closest("[data-message-id]");
    if (event.shiftKey && messageArticle?.dataset.ownMessage === "true" && !event.target.closest("button, a, input, textarea")) {
      try {
        await api("/api/chat/messages/" + encodeURIComponent(messageArticle.dataset.messageId), {method:"DELETE"});
        showToast("Message deleted.");
        await refresh();
      } catch (error) { showToast(error.message); }
      return;
    }

    const reactionButton = event.target.closest("[data-reaction-message]");
    if (reactionButton) {
      const id = reactionButton.dataset.reactionMessage;
      if (!currentUser) { location.href="/account"; return; }
      const kind = reactionButton.dataset.reactionKind === "sticker" ? "sticker" : "emoji";
      try {
        const body = kind === "sticker"
          ? {kind:"sticker",stickerUrl:reactionButton.dataset.reactionStickerUrl,stickerName:"Sticker"}
          : {kind:"emoji",emoji:reactionButton.dataset.reactionEmoji};
        await api(`/api/chat/messages/${encodeURIComponent(id)}/reactions`, {
          method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
        });
        await refresh();
      } catch (error) { showToast(error.message); }
      return;
    }

    const quick = event.target.closest("[data-quick-reaction]");
    if (quick) {
      const article = quick.closest("[data-message-id]");
      const message = messages.find(item => item.id === article?.dataset.messageId);
      if (!message) return;
      try {
        await api(`/api/chat/messages/${encodeURIComponent(message.id)}/reactions`, {
          method:"PATCH",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({kind:"emoji",emoji:quick.dataset.quickReaction})
        });
        await refresh();
      } catch (error) { showToast(error.message); }
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action) {
      const article = action.closest("[data-message-id]");
      const message = messages.find(item => item.id === article?.dataset.messageId);
      if (!message) return;
      if (action.dataset.action === "react") showReactionPicker(action, message.id);
      if (action.dataset.action === "reply") openReply(message);
      if (action.dataset.action === "edit") openEdit(message);
      if (action.dataset.action === "forward") openForwardGlobal(message);
      if (action.dataset.action === "copy") {
        try { await navigator.clipboard.writeText(message.message || ""); showToast("Copied."); }
        catch (error) { showToast(error.message || "Could not copy message."); }
      }
      if (action.dataset.action === "menu") showChatMessageMenu(message, action);
      if (action.dataset.action === "delete" && message.userId === currentUser?.id && !message.deletedAt) {
        if (!confirm("Delete this message?")) return;
        try { await api("/api/chat/messages/" + encodeURIComponent(message.id), {method:"DELETE"}); showToast("Message deleted."); await refresh(); }
        catch (error) { showToast(error.message); }
      }
      return;
    }

    const jump = event.target.closest("[data-jump-to]");
    if (jump) {
      const target = messagesEl.querySelector(`[data-message-id="${CSS.escape(jump.dataset.jumpTo)}"]`);
      if (target) {
        target.scrollIntoView({behavior:"smooth", block:"center"});
        target.classList.add("chat-message-highlight");
        setTimeout(() => target.classList.remove("chat-message-highlight"), 1100);
      }
      return;
    }

  });

  messagesEl.addEventListener("contextmenu", event => {
    const reactionButton = event.target.closest("[data-reaction-message]");
    if (!reactionButton) return;
    event.preventDefault();
    const message = messages.find(item => item.id === reactionButton.dataset.reactionMessage);
    const reaction = message?.reactions?.find(item => {
      const kind = item.kind === "sticker" ? "sticker" : "emoji";
      return kind === "sticker"
        ? item.stickerUrl === reactionButton.dataset.reactionStickerUrl
        : item.emoji === reactionButton.dataset.reactionEmoji;
    });
    showReactionUsers(reactionButton, reaction);
  });

  messagesEl.addEventListener("click", event => {
    const save = event.target.closest(".sticker-save-badge");
    if (!save) return;
    const attachment = save.closest(".chat-sticker-attachment");
    if (attachment) {
      event.preventDefault();
      event.stopPropagation();
      toggleStickerSave(attachment);
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser) { location.href = "/account"; return; }
    const text = input.value.trim();
    if (editingId) {
      if (!text) return;
      const id = editingId;
      try {
        await api(`/api/chat/messages/${encodeURIComponent(id)}`, {
          method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message:text})
        });
        cancelEdit();
        showToast("Message edited.");
        await refresh();
      } catch (error) { showToast(error.message); }
      return;
    }
    if (!text && !attachmentDraft) return;
    input.disabled = true;
    try {
      const attachment = await uploadDraft();
      await sendMessage(text, attachment);
      if (attachment?.kind === "sticker") {
        await saveSticker(attachment.url, attachment.name);
      }
    } catch (error) {
      showToast(error.message);
    } finally {
      input.disabled = !currentUser;
    }
  });

  document.getElementById("cancel-reply").addEventListener("click", cancelReply);
  document.getElementById("cancel-edit-top").addEventListener("click", cancelEdit);

  const chatGifButton = document.getElementById("chat-gif-button");
  const chatImageButton = document.getElementById("chat-image-button");
  const chatStickerButton = document.getElementById("chat-sticker-button");
  function positionChatToolPanel(panel, anchor) {
    if (!panel || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 20);
    const height = Math.min(500, window.innerHeight - 100);
    let left = rect.left + rect.width / 2 - width / 2;
    let top = rect.top - height - 10;
    if (top < 8) top = rect.bottom + 8;
    panel.style.setProperty("width", width + "px", "important");
    panel.style.setProperty("left", Math.max(8, Math.min(window.innerWidth - width - 8, left)) + "px", "important");
    panel.style.setProperty("right", "auto", "important");
    panel.style.setProperty("bottom", "auto", "important");
    panel.style.setProperty("top", Math.max(8, Math.min(window.innerHeight - height - 8, top)) + "px", "important");
  }
  function openChatGifs() {
    if (!currentUser) { location.href="/account"; return; }
    closePopovers();
    if (!giphyPanel) return;
    giphyPanel.hidden = false;
    giphyPanel.removeAttribute("hidden");
    giphyPanel.style.display = "flex";
    positionChatToolPanel(giphyPanel, chatGifButton);
    loadGlobalGifs();
    giphySearch?.focus();
  }
  function openChatImageUpload() {
    closePopovers();
    chatImageButton?.blur();
    document.getElementById("chat-image-file")?.click();
  }
  function openChatStickers() {
    closePopovers();
    openStickerDrawer(chatStickerButton);
  }
  chatGifButton?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openChatGifs();
  });
  chatImageButton?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openChatImageUpload();
  });
  chatStickerButton?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openChatStickers();
  });
  giphyClose?.addEventListener("click",()=>{giphyPanel.hidden=true;giphyPanel.style.display="";});
  giphySearch?.addEventListener("input",()=>{clearTimeout(window.__lunarGiphyTimer);window.__lunarGiphyTimer=setTimeout(loadGlobalGifs,300)});
  giphyClose?.addEventListener("click", () => {
    if (!giphyPanel) return;
    giphyPanel.hidden = true;
    giphyPanel.style.display = "";
  });
  document.getElementById("global-gif-search-clear")?.addEventListener("click",()=>{if(!giphySearch)return;giphySearch.value="";loadGlobalGifs();giphySearch.focus();});
  document.querySelectorAll("[data-global-gif-tab]").forEach(tab=>tab.addEventListener("click",()=>{document.querySelectorAll("[data-global-gif-tab]").forEach(x=>x.classList.remove("active"));tab.classList.add("active");giphyTab=tab.dataset.globalGifTab;loadGlobalGifs()}));
  giphyGrid?.addEventListener("click",async event=>{
    const card=event.target.closest("[data-global-gif-id]");
    if(!card)return;
    const gif=giphyItems.find(x=>x.id===card.dataset.globalGifId);
    if(!gif)return;
    const favorite=event.target.closest(".gif-fav");
    if(favorite){
      try{
        await api("/api/friends/gifs/favorites",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({gif})
        });
        favorite.classList.add("is-saved");
        favorite.innerHTML='<i class="fa-solid fa-bookmark"></i>';
        favorite.title="Saved GIF";
        showToast("GIF saved to favourites.")
      }catch(e){showToast(e.message)}
      return;
    }
    try{
      await sendMessage("",{url:gif.url,kind:"gif",name:gif.title});
      giphyPanel.hidden=true;
      giphyPanel.style.display="";
    }catch(e){showToast(e.message)}
  });
  document.getElementById("chat-image-file").addEventListener("change", event => setAttachmentDraft(event.target.files?.[0], "image").finally(() => event.target.value=""));
  cancelAttachmentButton.addEventListener("click", clearAttachmentDraft);

  function openStickerDrawer(anchor = document.getElementById("chat-sticker-button")) {
    closePopovers();
    renderStickers(currentUser?.stickers || []);
    return openUnifiedPicker("stickers", anchor, {type:"compose"});
  }
  function closeStickerDrawer() { closePopovers(); stickerDrawer?.setAttribute("aria-hidden","true"); }
  document.getElementById("close-sticker-drawer").addEventListener("click", closeStickerDrawer);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (stickerCreateInline && !stickerCreateInline.hidden) closeStickerCreator();
      else { closePopovers(); if (giphyPanel) { giphyPanel.hidden=true; giphyPanel.style.display=""; } }
    }
  });
  document.addEventListener("click", event => {
    const target = event.target;
    if (reactionPicker && !reactionPicker.hidden && !reactionPicker.contains(target) && !target.closest("#chat-gif-button") && !target.closest("#chat-image-button") && !target.closest("#chat-sticker-button") && !target.closest("[data-action=\"react\"]")) closePopovers();
    if (giphyPanel && !giphyPanel.hidden && !giphyPanel.contains(target) && !target.closest("#chat-plus")) { giphyPanel.hidden=true; giphyPanel.style.display=""; }
    if (reactionPicker && !reactionPicker.contains(target) && !target.closest("[data-action='react']")) reactionPicker.hidden = true;
    if (reactionUsers && !reactionUsers.contains(target) && !target.closest("[data-reaction-message]")) reactionUsers.hidden = true;
  });

  setupGlobalGifs();
  refresh();
  setInterval(refresh, 3000);
  document.addEventListener("click", event => {
    const menu = document.getElementById("chat-message-menu");
    if (menu && !menu.hidden && !menu.contains(event.target) && !event.target.closest("[data-action=\"menu\"]")) menu.hidden = true;
  });

})();
(() => {
  const applyLunarHome = () => {
    const useNewHomeUI = store.get("homeUI") !== "old";
    const title = document.querySelector(".title");
    const splash = document.getElementById("splash");
    const logo = document.querySelector(".lunar-nav-logo");
    const brand = document.querySelector(".lunar-brand");
    if (useNewHomeUI && brand) brand.remove();
    if (logo) logo.setAttribute("aria-label", "Lunar Studios");
    document.body.classList.add("ls-ready");
    if (useNewHomeUI && title) {
      title.textContent = "Lunar Proxy";
      title.setAttribute("aria-label", "Lunar Proxy");
      title.dataset.flowBound = "1";
    }
    if (useNewHomeUI && splash) splash.textContent = "A cleaner way to explore the web.";
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyLunarHome); else applyLunarHome();
  window.setTimeout(applyLunarHome, 150);

  const uiToggle = document.getElementById("lunar-ui-toggle");
  const uiSwitch = document.getElementById("lunar-ui-switch");
  const syncHomeUI = () => {
    const isNew = store.get("homeUI") !== "old";
    document.body.classList.toggle("lunar-home-old-ui", !isNew);
    document.body.classList.toggle("lunar-home-new-ui", isNew);
    if (uiToggle) uiToggle.setAttribute("aria-pressed", String(isNew));
    if (uiSwitch) uiSwitch.classList.toggle("is-new", isNew);
  };
  uiToggle?.addEventListener("click", async () => {
    if (uiToggle.dataset.reloading === "1") return;
    uiToggle.dataset.reloading = "1";

    const isNew = store.get("homeUI") !== "old";
    const nextMode = isNew ? "old" : "new";
    store.set("homeUI", nextMode);
    syncHomeUI();

    // Let the thumb visibly slide, then reload the Home page so the
    // actual navigation/layout is rebuilt for the selected UI mode.
    const reload = () => window.location.reload();
    const savePromise = typeof store.flushAccountSettings === "function"
      ? store.flushAccountSettings()
      : Promise.resolve(true);

    await Promise.race([
      savePromise,
      new Promise(resolve => setTimeout(resolve, 900))
    ]);
    window.setTimeout(reload, 180);
  });
  syncHomeUI();

  let memberRequestInFlight = false, memberTimer = null;
  const counterIds = { online: "lunar-online-count", offline: "lunar-offline-count", members: "lunar-member-count" };
  const setCounterText = (data) => {
    const allTime = document.getElementById("lunar-all-time-logins");
    if (allTime) allTime.textContent = Number(data.allTimeLogins || 0).toLocaleString();
    for (const [key, id] of Object.entries(counterIds)) {
      const el = document.getElementById(id); if (!el) continue;
      el.textContent = Number(data[key] || 0).toLocaleString();
      el.removeAttribute("contenteditable"); el.removeAttribute("role"); el.removeAttribute("aria-label"); el.removeAttribute("title");
    }
    const reset = document.getElementById("lunar-counter-reset"); if (reset) reset.hidden = true;
    document.getElementById("lunar-member-status")?.classList.remove("counter-editor");
  };
  const recordVisit = async () => {
    try {
      const response = await fetch("/api/site-visit", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const allTime = document.getElementById("lunar-all-time-logins");
      if (allTime) allTime.textContent = Number(data.allTimeLogins || 0).toLocaleString();
    } catch {}
  };
  recordVisit();

  const updateMemberStatus = async () => {
    const status = document.getElementById("lunar-member-status"); if (!status || memberRequestInFlight) return;
    memberRequestInFlight = true;
    try {
      const response = await fetch("/api/member-display", { cache: "no-store", credentials: "same-origin", headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) return; latestMemberData = await response.json(); setCounterText(latestMemberData);
    } catch {} finally { memberRequestInFlight = false; }
  };
  let latestMemberData = { memberList: [] };
  const memberFilterLabels = { online: "Online", offline: "Offline", members: "Members" };
  const closeMemberDropdown = () => {
    const dropdown = document.getElementById("lunar-member-dropdown");
    if (!dropdown) return;
    dropdown.hidden = true;
    document.querySelectorAll("[data-member-filter]").forEach(button => button.setAttribute("aria-expanded", "false"));
  };
  const showMiniMemberProfile = async (member) => {
    let modal = document.getElementById("lunar-home-profile-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "lunar-home-profile-modal";
      modal.className = "lunar-home-profile-modal";
      modal.hidden = true;
      document.body.appendChild(modal);
      modal.addEventListener("click", event => {
        if (event.target === modal || event.target.closest("[data-home-profile-close]")) modal.hidden = true;
      });
    }
    modal.innerHTML = '<div class="lunar-home-profile-card"><button class="lunar-home-profile-close" data-home-profile-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button><div class="lunar-home-profile-banner"></div><div class="lunar-home-profile-body"><div class="lunar-home-profile-avatar"></div><div class="lunar-home-profile-name"></div><div class="lunar-home-profile-username"></div><div class="lunar-home-profile-status"></div><div class="lunar-home-profile-bio"></div><div class="lunar-home-profile-roles"></div></div></div>';
    modal.hidden = false;
    try {
      const response = await fetch("/api/users/" + encodeURIComponent(member.username), { cache: "no-store", credentials: "same-origin" });
      const data = await response.json();
      const user = response.ok && data.user ? data.user : member;
      const banner = modal.querySelector(".lunar-home-profile-banner");
      const avatar = modal.querySelector(".lunar-home-profile-avatar");
      const name = modal.querySelector(".lunar-home-profile-name");
      const username = modal.querySelector(".lunar-home-profile-username");
      const status = modal.querySelector(".lunar-home-profile-status");
      const bio = modal.querySelector(".lunar-home-profile-bio");
      const roles = modal.querySelector(".lunar-home-profile-roles");
      if (user.bannerUrl) banner.style.backgroundImage = 'url("' + String(user.bannerUrl).replace(/"/g, "%22") + '")';
      if (user.avatarUrl) avatar.innerHTML = '<img src="' + escapeHtml(user.avatarUrl) + '" alt="">'; else avatar.textContent = String(user.displayName || user.username || "?").slice(0,2).toUpperCase();
      name.textContent = user.displayName || user.username;
      username.textContent = "@" + user.username;
      status.textContent = user.status || "";
      status.hidden = !user.status;
      bio.textContent = user.bio || "";
      bio.hidden = !user.bio;
      roles.innerHTML = (Array.isArray(user.roles) ? user.roles : []).map(role => '<span>' + escapeHtml(role) + '</span>').join("");
      roles.hidden = !roles.innerHTML;
    } catch {}
  };
  const positionMemberDropdown = (dropdown, anchor) => {
    if (!dropdown || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 28);
    const left = Math.max(14, Math.min(window.innerWidth - width - 14, rect.left + rect.width / 2 - width / 2));
    const top = Math.min(window.innerHeight - 18, rect.bottom + 10);
    dropdown.style.position = "fixed";
    dropdown.style.width = width + "px";
    dropdown.style.left = left + "px";
    dropdown.style.top = top + "px";
    dropdown.style.transform = "none";
    dropdown.style.zIndex = "2147483646";
  };
  const renderMemberDropdown = (filter, anchor) => {
    const dropdown = document.getElementById("lunar-member-dropdown");
    if (!dropdown) return;
    if (dropdown.parentElement !== document.body) document.body.appendChild(dropdown);
    const all = Array.isArray(latestMemberData.memberList) ? latestMemberData.memberList : [];
    const members = filter === "online" ? all.filter(member => member.isOnline) : filter === "offline" ? all.filter(member => !member.isOnline) : all;
    dropdown.innerHTML = '<div class="lunar-member-dropdown-head"><strong>' + memberFilterLabels[filter] + '</strong><span>' + members.length.toLocaleString() + '</span></div>' + (members.length ? members.map(member => '<button class="lunar-member-row" type="button" data-member-username="' + escapeHtml(member.username) + '"><span class="lunar-member-avatar">' + (member.avatarUrl ? '<img src="' + escapeHtml(member.avatarUrl) + '" alt="">' : escapeHtml(String(member.displayName || member.username || "?").slice(0,2).toUpperCase())) + '</span><span class="lunar-member-row-info"><strong>' + escapeHtml(member.displayName || member.username) + '</strong><small>@' + escapeHtml(member.username) + '</small></span><span class="lunar-member-presence ' + (member.isOnline ? "online" : "offline") + '"></span></button>').join("") : '<div class="lunar-member-empty">No members in this group.</div>');
    dropdown.hidden = false;
    positionMemberDropdown(dropdown, anchor);
    document.querySelectorAll("[data-member-filter]").forEach(button => button.setAttribute("aria-expanded", button.dataset.memberFilter === filter ? "true" : "false"));
  };
  document.addEventListener("click", event => {
    const counter = event.target.closest("[data-member-filter]");
    if (counter) { event.stopPropagation(); renderMemberDropdown(counter.dataset.memberFilter, counter); return; }
    const row = event.target.closest("[data-member-username]");
    if (row) { const member = (latestMemberData.memberList || []).find(item => item.username === row.dataset.memberUsername); if (member) showMiniMemberProfile(member); return; }
    const dropdown = document.getElementById("lunar-member-dropdown");
    if (dropdown && !dropdown.contains(event.target)) closeMemberDropdown();
  });
  window.addEventListener("resize", () => {
    const dropdown = document.getElementById("lunar-member-dropdown");
    const active = document.querySelector('[data-member-filter][aria-expanded="true"]');
    if (dropdown && !dropdown.hidden && active) positionMemberDropdown(dropdown, active);
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { closeMemberDropdown(); document.getElementById("lunar-home-profile-modal")?.setAttribute("hidden", ""); } });

  const startMemberUpdates = () => { if (memberTimer) clearInterval(memberTimer); updateMemberStatus(); memberTimer = setInterval(updateMemberStatus, 5000); };
  startMemberUpdates();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) updateMemberStatus(); });
  window.addEventListener("focus", updateMemberStatus);

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
  const loadChangelog = async () => {
    const list = document.getElementById("lunar-changelog-list"); if (!list) return;
    try {
      const [baseResult, recentResult] = await Promise.allSettled([
        fetch("/assets/data/changelog.json?v=lunar2", { cache: "no-store" }).then(r => r.ok ? r.json() : {entries:[]}),
        fetch("/assets/data/changelog-recent.json?v=lunar1", { cache: "no-store" }).then(r => r.ok ? r.json() : {entries:[]})
      ]);
      const base = baseResult.status === "fulfilled" && Array.isArray(baseResult.value.entries) ? baseResult.value.entries : [];
      const recent = recentResult.status === "fulfilled" && Array.isArray(recentResult.value.entries) ? recentResult.value.entries : [];
      const entries = [...recent, ...base].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      list.innerHTML = entries.map((entry, index) => {
        const date = new Date(entry.timestamp);
        const formatted = Number.isNaN(date.getTime()) ? escapeHtml(entry.timestamp) : date.toLocaleString([], { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" });
        const items = Array.isArray(entry.items) ? entry.items : [];
        return '<article class="lunar-changelog-entry ' + (index === 0 ? "latest" : "") + '"><div class="lunar-changelog-entry-head"><div class="lunar-changelog-entry-title"><i class="fa-solid fa-satellite-dish"></i><span>' + escapeHtml(entry.title || "Lunar Update") + '</span></div><span class="lunar-changelog-tag">' + escapeHtml(entry.tag || "Update") + '</span></div><div class="lunar-changelog-time">' + formatted + '</div><ul class="lunar-changelog-items">' + items.map(item => '<li>' + escapeHtml(item) + '</li>').join("") + '</ul></article>';
      }).join("") || '<div class="lunar-changelog-loading">No updates have been posted yet.</div>';
    } catch {
      list.innerHTML = '<div class="lunar-changelog-loading"><i class="fa-solid fa-cloud"></i><span>Update log is temporarily unavailable.</span></div>';
    }
  };
  loadChangelog();
})();

(() => {
  const button=document.getElementById("lunar-report-button");
  const modal=document.getElementById("lunar-report-modal");
  const status=document.getElementById("lunar-report-status");
  const form=document.getElementById("lunar-report-form");
  const message=document.getElementById("lunar-report-message");
  const gameLabel=document.getElementById("lunar-report-game-label");
  const gameInput=document.getElementById("lunar-report-game");
  const submit=document.getElementById("lunar-report-submit");
  if(!button||!modal)return;
  let selectedType="";
  const close=()=>{modal.hidden=true;document.body.classList.remove("lunar-report-open");};
  button.addEventListener("click",()=>{modal.hidden=false;document.body.classList.add("lunar-report-open");});
  modal.querySelectorAll("[data-report-close]").forEach(el=>el.addEventListener("click",close));
  modal.querySelectorAll("[data-report-type]").forEach(option=>{
    option.addEventListener("click",()=>{
      selectedType=option.dataset.reportType||"bug";
      form.hidden=false;
      gameLabel.hidden=selectedType!=="game";
      if(status)status.textContent="";
      if(selectedType==="game") gameInput?.focus(); else message?.focus();
    });
  });
  submit?.addEventListener("click",async()=>{
    const text=(message?.value||"").trim();
    const gameApp=(gameInput?.value||"").trim();
    if(!text){if(status)status.textContent="Please enter a message.";return;}
    if(selectedType==="game"&&!gameApp){if(status)status.textContent="Please enter the game or app name.";return;}
    submit.disabled=true;
    try{
      const response=await fetch("/api/reports",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        type:selectedType||"bug",message:text,gameApp,page:location.pathname+location.search,viewport:window.innerWidth+"x"+window.innerHeight
      })});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Could not send the report.");
      if(status)status.textContent="Report sent to the Lunar team.";
      message.value="";
      if(gameInput)gameInput.value="";
      setTimeout(close,700);
    }catch(error){if(status)status.textContent=error.message}
    finally{submit.disabled=false}
  });
})();

(() => {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/spotify' || path === '/spotify.html') return;

  const start = () => {
    const useNewUI = store.get("homeUI") !== "old";

    // Old UI is intentionally the original site-wide interface. Do not inject
    // any of the refined redesign CSS/navigation when Old UI is selected.
    if (!useNewUI) {
      document.body?.classList.add("lunar-site-old-ui");
      return;
    }
    document.body?.classList.add("lunar-site-new-ui");

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/assets/css/lunar-redesign.css?v=figma5';
    document.head.appendChild(style);

    const fixesStyle = document.createElement('link');
    fixesStyle.rel = 'stylesheet';
    fixesStyle.href = '/assets/css/lunar-redesign-fixes.css?v=fix8';
    document.head.appendChild(fixesStyle);

  const loadChatFixes = () => {
    if (path !== '/chat' && path !== '/chat.html' && path !== '/friends' && path !== '/friends.html') return;
    const script = document.createElement('script');
    script.src = '/assets/js/lunar-chat-fixes.js?v=fix2';
    script.defer = false;
    document.body.appendChild(script);
  };

  const buildNav = () => {
    const nav = document.querySelector('.nav-bar');
    if (!nav) return;
    const links = [
      ['/','fa-house','Home'],
      ['/friends','fa-user-group','Friends'],
      ['/chat','fa-comments','Chat'],
      ['/apps','fa-table-cells','Apps'],
      ['/games','fa-gamepad','Games'],
      ['/spotify','fa-spotify','Spotify'],
      ['/settings','fa-gear','Settings']
    ];
    const normalize = p => p.replace(/\/$/, '') || '/';
    const current = normalize(window.location.pathname);
    nav.innerHTML = `
      <aside class="lunar-sidebar">
        <a class="lunar-sidebar-brand" href="/" aria-label="LunarProxys">LS</a>
        ${links.map(([href, icon, label]) => `<a class="lunar-side-link navbar-link lunar-nav-${label.toLowerCase()}" href="${href}"><i class="${icon === 'fa-spotify' ? 'fa-brands' : 'fa-solid'} ${icon}"></i><span>${label}</span></a>`).join('')}
        <div class="lunar-side-spacer"></div>
        <a class="lunar-side-link lunar-account-mini navbar-link lunar-account-nav" href="/account"><span>A</span></a>
      </aside>
`;

    nav.querySelectorAll('.navbar-link').forEach(link => {
      const href = normalize(new URL(link.href, window.location.origin).pathname);
      const active = href === current || (current === '/play.html' && href === '/games') || (current.startsWith('/profile') && href === '/account');
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
    });

    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.user) return;
        if (String(data.user.username || "").toLowerCase() === "lunar" && !nav.querySelector(".lunar-console-nav")) {
          const consoleLink = document.createElement("a");
          consoleLink.className = "lunar-side-link navbar-link lunar-console-nav";
          consoleLink.href = "/lunar-console";
          consoleLink.innerHTML = '<i class="fa-solid fa-moon"></i><span>Lunar Console</span>';
          const spacer = nav.querySelector(".lunar-side-spacer");
          if (spacer) spacer.before(consoleLink);
          else nav.querySelector(".lunar-sidebar")?.appendChild(consoleLink);
          if (normalize(window.location.pathname) === "/lunar-console") {
            consoleLink.classList.add("is-active");
            consoleLink.setAttribute("aria-current", "page");
          }
        }
        const labels = nav.querySelectorAll('.lunar-account-nav span');
        if (labels[0]) labels[0].textContent = String(data.user.displayName || data.user.username || 'A').slice(0, 1).toUpperCase();
        if (labels[1]) labels[1].textContent = 'Profile';
      }).catch(() => {});
  };

    const setupReportNotifications = (nav, user) => {
      if (!nav || !user || !["lunar","lunarstudios"].includes(String(user.username || "").toLowerCase())) return;
      const bell=document.createElement("button");
      bell.type="button";
      bell.className="lunar-side-link lunar-report-notifications";
      bell.setAttribute("aria-label","Lunar reports");
      bell.innerHTML='<i class="fa-solid fa-bell"></i><span>Reports</span><b class="lunar-report-count" hidden>0</b>';
      const brand=nav.querySelector(".lunar-sidebar-brand");
      brand?.after(bell);

      const panel=document.createElement("div");
      panel.className="lunar-report-center";
      panel.hidden=true;
      panel.innerHTML='<div class="lunar-report-center-backdrop" data-report-center-close></div><section class="lunar-report-center-panel" role="dialog" aria-modal="true" aria-labelledby="lunar-report-center-title"><header><div><span>LUNAR MODERATION</span><h2 id="lunar-report-center-title">Reports</h2><p id="lunar-report-stats">Loading reports…</p></div><button type="button" data-report-center-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></header><div class="lunar-report-center-list" id="lunar-report-center-list"></div><div class="lunar-mini-profile" id="lunar-mini-profile" hidden></div></section>';
      document.body.appendChild(panel);
      const list=panel.querySelector("#lunar-report-center-list");
      const stats=panel.querySelector("#lunar-report-stats");
      const count=bell.querySelector(".lunar-report-count");
      const profile=panel.querySelector("#lunar-mini-profile");

      const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
      const avatar=userData=>userData?.avatarUrl?'<img src="'+escapeHtml(userData.avatarUrl)+'" alt="">':'<span>'+escapeHtml((userData?.displayName||userData?.username||"?").slice(0,1).toUpperCase())+'</span>';

      const openMiniProfile=async(username)=>{
        try{
          const response=await fetch("/api/users/"+encodeURIComponent(username),{credentials:"same-origin",cache:"no-store"});
          const data=await response.json();
          if(!response.ok||!data.user)throw new Error("Profile unavailable.");
          const u=data.user;
          profile.hidden=false;
          profile.innerHTML='<button class="lunar-mini-profile-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button><div class="lunar-mini-profile-avatar">'+avatar(u)+'</div><strong>'+escapeHtml(u.displayName||u.username)+'</strong><span class="lunar-mini-profile-username">@'+escapeHtml(u.username)+'</span><span class="lunar-mini-profile-status">'+(u.isOnline?"Online":escapeHtml(u.status||"Offline"))+'</span><p>'+escapeHtml(u.bio||"No bio yet.")+'</p><small>'+(u.createdAt?"Member since "+new Date(u.createdAt).toLocaleDateString([],{month:"short",year:"numeric"}):"")+'</small><div class="lunar-mini-profile-roles">'+(u.roles||[]).map(role=>"<span>"+escapeHtml(role)+"</span>").join("")+'</div>';
          profile.querySelector(".lunar-mini-profile-close").onclick=()=>{profile.hidden=true};
        }catch(error){profile.hidden=true}
      };

      const loadReports=async()=>{
        try{
          const response=await fetch("/api/reports",{credentials:"same-origin",cache:"no-store"});
          const data=await response.json();
          if(!response.ok)throw new Error(data.error||"Unable to load reports.");
          const reports=Array.isArray(data.reports)?data.reports:[];
          const unread=Number(data.stats?.unread||0);
          count.textContent=String(unread);
          count.hidden=unread===0;
          bell.classList.toggle("has-unread",unread>0);
          stats.textContent=(data.stats?.total||reports.length)+" total · "+unread+" new · "+(data.stats?.byType?.bug||0)+" bugs · "+(data.stats?.byType?.game||0)+" game/app · "+(data.stats?.byType?.feature||0)+" features";
          list.innerHTML=reports.length?reports.map(report=>{
            const r=report.reporter||{};
            const date=report.createdAt?new Date(report.createdAt):null;
            return '<article class="lunar-report-item '+escapeHtml(report.status||"new")+'" data-report-id="'+escapeHtml(report.id)+'"><div class="lunar-report-item-head"><button type="button" class="lunar-report-person" data-lunar-profile="'+escapeHtml(r.username||"")+'"><span class="lunar-report-avatar">'+avatar(r)+'</span><span><strong>'+escapeHtml(r.displayName||r.username||"Unknown")+'</strong><small>@'+escapeHtml(r.username||"unknown")+'</small></span></button><time>'+escapeHtml(date?date.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"")+'</time></div><div class="lunar-report-type"><i class="fa-solid '+(report.type==="bug"?"fa-bug":report.type==="game"?"fa-gamepad":"fa-lightbulb")+'"></i><strong>'+escapeHtml(report.subject)+'</strong>'+(report.gameApp?'<span> · '+escapeHtml(report.gameApp)+'</span>':"")+'</div><p>'+escapeHtml(report.message)+'</p><div class="lunar-report-meta"><span>'+escapeHtml(report.page||"Unknown page")+'</span><span>'+escapeHtml(report.viewport||"")+'</span><button type="button" data-report-status="'+escapeHtml(report.id)+'" data-status="'+(report.status==="resolved"?"new":"resolved")+'">'+(report.status==="resolved"?"Reopen":"Resolve")+'</button></div></article>';
          }).join(""):'<div class="lunar-report-empty"><i class="fa-regular fa-flag"></i><strong>No reports yet</strong><span>New reports will appear here.</span></div>';
          list.querySelectorAll("[data-lunar-profile]").forEach(el=>el.addEventListener("click",async e=>{e.stopPropagation();await openMiniProfile(el.dataset.lunarProfile);}));
        }catch(error){
          stats.textContent=error.message;
          list.innerHTML='<div class="lunar-report-empty">Unable to load reports.</div>';
        }
      };
      const openReportCenter = async () => {
        panel.hidden = false;
        panel.removeAttribute("hidden");
        panel.setAttribute("aria-hidden", "false");
        panel.style.display = "grid";
        document.body.classList.add("lunar-report-center-open");
        await loadReports();
      };
      const closeReportCenter = () => {
        panel.hidden = true;
        panel.setAttribute("aria-hidden", "true");
        panel.style.display = "none";
        profile.hidden = true;
        document.body.classList.remove("lunar-report-center-open");
      };
      bell.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openReportCenter();
      });
      panel.querySelectorAll("[data-report-center-close]").forEach(el => el.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        closeReportCenter();
      }));
      document.addEventListener("click", event => {
        const reportButton = event.target.closest?.(".lunar-report-notifications");
        if (!reportButton || !document.body.contains(reportButton)) return;
        event.preventDefault();
        event.stopPropagation();
        openReportCenter();
      }, true);
      list.addEventListener("click",async e=>{
        const statusButton=e.target.closest("[data-report-status]");
        if(!statusButton)return;
        await fetch("/api/reports/"+encodeURIComponent(statusButton.dataset.reportStatus),{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:statusButton.dataset.status})});
        await loadReports();
      });
      loadReports();
      window.setInterval(loadReports,15000);
    };

    buildNav();
    const currentUserPromise = fetch('/api/auth/me', { credentials:'same-origin', cache:'no-store' }).then(r=>r.ok?r.json():null).catch(()=>null);
    currentUserPromise.then(data=>setupReportNotifications(document.querySelector('.nav-bar'), data?.user));
    loadChatFixes();
  };

  const boot = async () => {
    // Account settings are authoritative, so the Old/New mode remains
    // consistent after switching accounts or opening the site elsewhere.
    if (typeof store.loadAccountSettings === "function") {
      try { await store.loadAccountSettings(); } catch {}
    }
    start();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

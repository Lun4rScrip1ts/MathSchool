// Theme is applied immediately, to prevent flashing on page load
(() => {
  const themeid = store.get("theme");
  const themes = {
    catppuccinMocha: "/assets/css/themes/catppuccin/mocha.css",
    catppuccinMacchiato: "/assets/css/themes/catppuccin/macchiato.css",
    catppuccinFrappe: "/assets/css/themes/catppuccin/frappe.css",
    catppuccinLatte: "/assets/css/themes/catppuccin/latte.css",
    Inverted: "/assets/css/themes/colors/light.css",
    sky: "/assets/css/themes/colors/sky.css",
    tokyoNight: "/assets/css/themes/colors/tokyo-night.css",
    nord: "/assets/css/themes/colors/nord.css",
    rosePine: "/assets/css/themes/colors/rose-pine.css",
    oled: "/assets/css/themes/colors/oled.css",
    light: "/assets/css/themes/colors/light.css",
    gruvbox: "/assets/css/themes/colors/gruvbox.css",
    gruvboxLight: "/assets/css/themes/colors/gruvbox-light.css",
    everforest: "/assets/css/themes/colors/everforest.css",
    monokai: "/assets/css/themes/colors/monokai.css",
    oneDark: "/assets/css/themes/colors/one-dark.css",
    synthwave: "/assets/css/themes/colors/synthwave.css",
    solarized: "/assets/css/themes/colors/solarized.css",
    solarizedLight: "/assets/css/themes/colors/solarized-light.css",
  };

  const resolvedTheme = themeid || "d";
  document.documentElement.setAttribute("data-lunar-theme", resolvedTheme);
  if (themes[themeid]) {
    const themeLink = document.createElement("link");
    themeLink.rel = "stylesheet";
    themeLink.href = themes[themeid];
    document.head.appendChild(themeLink);
  } else if (themeid) {
    const customThemeCss = store.getRaw(`t${themeid}`);
    if (customThemeCss) {
      const customThemeStyle = document.createElement("style");
      customThemeStyle.textContent = customThemeCss;
      document.head.appendChild(customThemeStyle);
    }
  }
  const lunarThemeV2 = document.createElement("link");
  lunarThemeV2.rel = "stylesheet";
  lunarThemeV2.href = "/assets/css/lunar-theme-v2.css?v=lunar1";
  document.head.appendChild(lunarThemeV2);

  const PROXY_KEY = "proxy";
  const ALLOWED = ["uv", "sj"];
  const DEFAULT = "sj";

  function initProxy() {
    const current = store.get(PROXY_KEY);
    if (current === null) {
      store.set(PROXY_KEY, DEFAULT);
      return DEFAULT;
    }
    if (ALLOWED.includes(current)) {
      return current;
    }
    store.set(PROXY_KEY, DEFAULT);
    return DEFAULT;
  }

  window.resolveProxyChoice = initProxy;
  window.resolveProxyChoice();
})();

let isInTabMode;

try {
  isInTabMode = window.top.location.pathname === "/tabs";
} catch {
  try {
    isInTabMode = window.parent.location.pathname === "/tabs";
  } catch {
    isInTabMode = false;
  }
}

function reconstructSafeUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw);
    const allowed = ["https:", "http:", "data:"];
    if (!allowed.includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    if (typeof raw === "string" && !raw.includes(":")) return raw;
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Shared presence/deployment services run on every page, including proxy/search/game contexts.
  if (!document.querySelector('script[data-lunar-global-presence]')) {
    const presence=document.createElement("script");
    presence.src="/assets/js/lunar-presence-heartbeat.js?v=presence4";
    presence.dataset.lunarGlobalPresence="true";
    presence.defer=false;
    document.body.appendChild(presence);
  }
  if (!document.querySelector('script[data-lunar-deployment-watch]')) {
    const deploy=document.createElement("script");
    deploy.src="/assets/js/lunar-deployment-watch.js?v=deploy2";
    deploy.dataset.lunarDeploymentWatch="true";
    deploy.defer=false;
    document.body.appendChild(deploy);
  }
  if (!document.querySelector('script[data-lunar-notifications]')) {
    const notifications=document.createElement("script");
    notifications.src="/assets/js/lunar-notifications.js?v=notify1";
    notifications.dataset.lunarNotifications="true";
    notifications.defer=false;
    document.body.appendChild(notifications);
  }

  if (window.location.hostname === "gointerstellar.app" && !document.getElementById("frame-container")) {
    const ads = document.createElement("script");
    ads.async = true;
    ads.crossOrigin = "anonymous";
    ads.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6840529569014734";
    document.head.appendChild(ads);
  }

  const nav = document.querySelector(".nav-bar");

  if (nav) {
    const themeId = store.get("theme");
    const lightThemes = ["Inverted", "light", "gruvboxLight", "solarizedLight"];
    const html = `
      <div id="icon-container">
        <a class="icon lunar-nav-logo" href="/./" aria-label="Lunar Studios"><img src="/icons/LunarStudios.png" alt="Lunar Studios"></a>
      </div>
      <div class="nav-bar-right">
        <a class="navbar-link" href="/./friends"><i class="fa-solid fa-user-group navbar-icon"></i><span>Friends</span></a>
        <a class="navbar-link" href="/./chat"><i class="fa-solid fa-comments navbar-icon"></i><span>Chat</span></a>
        <a class="navbar-link donate-nav-link" href="/./donate"><i class="fa-solid fa-heart navbar-icon"></i><span>Donate</span></a>
        <a class="navbar-link" href="/./games"><i class="fa-solid fa-gamepad navbar-icon"></i><span>Games</span></a>
        <a class="navbar-link" href="/./movies"><i class="fa-solid fa-film navbar-icon"></i><span>Movies</span></a>
        <a class="navbar-link" href="/./apps"><i class="fa-solid fa-table-cells navbar-icon"></i><span>Apps</span></a>
        <a class="navbar-link" href="/./settings"><i class="fa-solid fa-gear navbar-icon settings-icon"></i><span>Settings</span></a>
        <a class="navbar-link lunar-console-nav" href="/./lunar-console" hidden><i class="fa-solid fa-moon navbar-icon"></i><span>Lunar Console</span></a>
        <a class="navbar-link lunar-account-nav" href="/./account"><i class="fa-solid fa-user navbar-icon"></i><span>Account</span></a>
      </div>`;
    nav.innerHTML = html;

    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    nav.querySelectorAll(".navbar-link").forEach(link => {
      try {
        const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, "") || "/";
        const active = linkPath === currentPath || (currentPath === "/play.html" && linkPath === "/games");
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      } catch {}
    });

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const accountLink = document.querySelector(".lunar-account-nav span");
        if (accountLink && data?.user) accountLink.textContent = "Profile";
        const consoleLink = document.querySelector(".lunar-console-nav");
        if (consoleLink) { const isOwner = String(data?.user?.username || "").toLowerCase() === "lunar"; consoleLink.hidden = !isOwner; consoleLink.style.display = isOwner ? "" : "none"; }
      })
      .catch(() => {});
  }

  if (window.location.pathname !== "/account" && window.location.pathname !== "/account.html") {
    fetch("/api/auth/me", {credentials:"same-origin", cache:"no-store"}).then(response => response.ok ? response.json() : {user:null}).then(data => {
      if (data?.user || document.getElementById("lunar-auth-gate")) return;
      const gate=document.createElement("div");
      gate.id="lunar-auth-gate";
      gate.innerHTML='<div class="lunar-auth-backdrop"></div><section class="lunar-auth-panel" role="dialog" aria-modal="true" aria-labelledby="lunar-auth-title"><div class="lunar-auth-orb"><i class="fa-solid fa-moon"></i></div><span class="lunar-auth-kicker">LUNAR MEMBERS</span><h2 id="lunar-auth-title">Create your Lunar account</h2><p>Register to unlock the proxy, chats, games, apps, settings, and the rest of Lunar.</p><div class="lunar-auth-actions"><a class="lunar-auth-primary" href="/account?mode=register&returnTo='+encodeURIComponent(location.pathname+location.search)+'">Register</a><a class="lunar-auth-secondary" href="/account?returnTo='+encodeURIComponent(location.pathname+location.search)+'">Log In</a></div><div class="lunar-auth-security"><i class="fa-solid fa-shield-halved"></i><span><strong>Your privacy matters</strong><br>Account credentials are protected and are not exposed to other users or displayed on the Lunar interface.</span></div><small>Your account keeps your profile, chat features, and preferences connected across Lunar.</small></section>';
      document.body.appendChild(gate);
      gate.style.setProperty("position","fixed","important");
      gate.style.setProperty("z-index","2147483647","important");
      gate.style.setProperty("inset","0","important");
      gate.style.setProperty("pointer-events","auto","important");
      document.body.classList.add("lunar-auth-locked");
    }).catch(()=>{});
  }

  const applyLunarBackground = () => {
    const mode = store.get("backgroundMode") || "default";
    const saved = store.get("backgroundImage");
    document.body.style.backgroundImage = "";
    document.getElementById("lunar-background-image")?.remove();
    if (mode === "none") {
      document.body.style.backgroundImage = "none";
      return;
    }
    const defaultBliss = "https://cdn.discordapp.com/attachments/1552677976980590602/1554634440548950047/1536061.jpg?backend=b2&ex=6abd99a6&is=6abc4826&hm=9d440db406ac0f9344d92d072419f6b7a&";
    const image = mode === "default" ? defaultBliss : (mode === "original" ? "/assets/media/background/full-main.png" : (mode === "custom" ? saved : ""));
    if (!image || image === "none") return;
    const imageLayer = document.createElement("div");
    imageLayer.id = "lunar-background-image";
    imageLayer.style.backgroundImage = 'url("' + String(image).replace(/"/g, '\\"') + '")';
    imageLayer.style.opacity = String(Number(store.get("backgroundImageOpacity") || 100) / 100);
    imageLayer.style.filter = "blur(" + Number(store.get("backgroundImageBlur") || 0) + "px)";
    imageLayer.style.backgroundPosition = "center";
    imageLayer.style.backgroundRepeat = "no-repeat";
    imageLayer.style.backgroundSize = "cover";
    imageLayer.style.backgroundAttachment = "fixed";
    imageLayer.style.position = "fixed";
    imageLayer.style.inset = "0";
    imageLayer.style.zIndex = "0";
    imageLayer.style.pointerEvents = "none";
    document.body.insertBefore(imageLayer, document.body.firstChild);
  };

  if (typeof store.loadAccountSettings === "function") {
    store.loadAccountSettings().then(() => {
      applyLunarBackground();
      if (typeof window.applyLunarSettings === "function") window.applyLunarSettings();
      if (typeof window.applyLunarCursorSelection === "function") window.applyLunarCursorSelection();
    }).catch(() => {});
  }

  const icon = document.getElementById("tab-favicon");
  const title = document.getElementById("t");
  const cloakName = store.get("CustomName") || store.get("name");
  const cloakIcon = store.get("CustomIcon") || store.get("icon");
  if (cloakName && title) title.textContent = cloakName;
  if (cloakIcon && icon) {
    const safeIcon = reconstructSafeUrl(cloakIcon);
    if (safeIcon) icon.setAttribute("href", safeIcon);
  }

  const rawEventKey = store.get("eventKey");
  let eventKey = ["`"];
  try {
    const parsedEventKey = rawEventKey ? JSON.parse(rawEventKey) : null;
    if (Array.isArray(parsedEventKey) && parsedEventKey.length) eventKey = parsedEventKey;
  } catch {}
  const rawPLink = store.get("pLink") || "https://classroom.google.com/";
  const safePLink = reconstructSafeUrl(rawPLink) ?? "https://classroom.google.com/";

  const panicAnchor = document.createElement("a");
  panicAnchor.href = safePLink;
  panicAnchor.style.display = "none";
  document.body.appendChild(panicAnchor);

  let pressedKeys = [];
  document.addEventListener("keydown", event => {
    pressedKeys.push(event.key);
    const recentKeys = pressedKeys.slice(-eventKey.length);
    if (recentKeys.length === eventKey.length && eventKey.every((key, i) => key === recentKeys[i])) {
      panicAnchor.click();
      pressedKeys = [];
    }
  });

  applyLunarBackground();

  const backgroundEffect = store.get("particles") || "off";
  const effectLayer = document.getElementById("lunar-background-effect");
  if (effectLayer) effectLayer.remove();

  if (backgroundEffect !== "off") {
    const layer = document.createElement("div");
    layer.id = "lunar-background-effect";
    layer.className = `lunar-bg-effect lunar-bg-${backgroundEffect === "true" ? "stars" : backgroundEffect}`;
    document.body.insertBefore(layer, document.body.firstChild);

    if (backgroundEffect === "stars" || backgroundEffect === "true") {
      ["stars", "stars2", "stars3"].forEach(id => {
        if (!document.getElementById(id)) {
          const el = document.createElement("div");
          el.id = id;
          layer.appendChild(el);
        }
      });
    }

    if (backgroundEffect === "reactive") {
      let rafPending = false;
      let lastX = 50;
      let lastY = 50;
      const updateGlow = () => {
        rafPending = false;
        layer.style.setProperty("--lunar-mx", lastX + "%");
        layer.style.setProperty("--lunar-my", lastY + "%");
      };
      const trackPointer = event => {
        lastX = Math.max(0, Math.min(100, (event.clientX / window.innerWidth) * 100));
        lastY = Math.max(0, Math.min(100, (event.clientY / window.innerHeight) * 100));
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(updateGlow);
        }
      };
      window.addEventListener("pointermove", trackPointer, { passive: true });
      layer.style.setProperty("--lunar-mx", "50%");
      layer.style.setProperty("--lunar-my", "50%");
    }
  }

  const interactiveSurfaceSelector = ".settings-card,.column,.support-card,.cash-card,.donate-action,.navbar-link";
  let surfaceRaf = false;
  let surfaceEvent = null;
  document.addEventListener("pointermove", event => {
    surfaceEvent = event;
    if (surfaceRaf) return;
    surfaceRaf = true;
    requestAnimationFrame(() => {
      surfaceRaf = false;
      const target = surfaceEvent && surfaceEvent.target;
      const surface = target && target.closest ? target.closest(interactiveSurfaceSelector) : null;
      if (!surface) return;
      const rect = surface.getBoundingClientRect();
      const x = ((surfaceEvent.clientX - rect.left) / rect.width) * 100;
      const y = ((surfaceEvent.clientY - rect.top) / rect.height) * 100;
      surface.style.setProperty("--lunar-card-x", Math.max(0, Math.min(100, x)) + "%");
      surface.style.setProperty("--lunar-card-y", Math.max(0, Math.min(100, y)) + "%");
    });
  }, { passive: true });

  const CURSOR_EFFECTS = [
    "rainbow-stars", "white-orbs", "rainbow-trail", "blue-orbs", "red-circle",
    "the-sims", "curly-cursor", "comet-cursor", "spark-cursor", "crosshair-cursor",
    "soft-glow-cursor", "pixel-cursor", "ring-cursor"
  ];
  const STATIC_CURSORS = ["normal-lunar","normal-graphite","normal-minimal","normal-outline","normal-cross"];
  const applyStaticCursor = () => {
    if (!document.body) return;
    document.body.classList.remove("lunar-static-cursor", "lunar-default-cursor");
    STATIC_CURSORS.forEach(name => document.body.classList.remove("lunar-" + name));
    const selected = store.get("pointer") || "default";
    if (STATIC_CURSORS.includes(selected)) {
      document.body.classList.add("lunar-static-cursor", "lunar-" + selected);
    } else if (selected === "default") {
      document.body.classList.add("lunar-default-cursor");
    }
  };
  window.applyLunarCursorSelection = applyStaticCursor;
  applyStaticCursor();
  let activePointer = store.get("pointer");
  const allowedPointers = new Set([...CURSOR_EFFECTS, ...STATIC_CURSORS, "default"]);
  if (!allowedPointers.has(activePointer)) {
    store.remove("pointer");
    activePointer = "default";
    applyStaticCursor();
  }
  const effectsLevel = store.get("interfaceEffects") || "full";
  const motionLevel = store.get("interfaceAnimations") || "on";

  if (CURSOR_EFFECTS.includes(activePointer) && effectsLevel !== "off" && motionLevel !== "off") {
    const cursorScript = document.createElement("script");
    cursorScript.src = "/assets/js/cursor.js?v=lunar12";
    cursorScript.onload = () => initCursorEffect();
    document.head.appendChild(cursorScript);
  }
});

(() => {
  const KEY = "lunar-context-navigation";
  const read = () => {
    try {
      const value = JSON.parse(sessionStorage.getItem(KEY) || "{}");
      return Array.isArray(value.entries) && Number.isInteger(value.index) ? value : {entries:[],index:-1};
    } catch { return {entries:[],index:-1}; }
  };
  const write = state => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  const current = () => location.href;
  const state = read();
  const here = current();
  if (!state.entries.length) { state.entries=[here]; state.index=0; write(state); }
  else if (state.entries[state.index] !== here) {
    const existing = state.entries.indexOf(here);
    if (existing >= 0) state.index=existing;
    else { state.entries=state.entries.slice(0,state.index+1); state.entries.push(here); state.index++; }
    write(state);
  }
  window.lunarContextNavigate = direction => {
    const next = read();
    const targetIndex = next.index + (direction === "forward" ? 1 : -1);
    if (targetIndex < 0 || targetIndex >= next.entries.length) {
      if (direction === "back" && history.length > 1) history.back();
      else if (direction === "forward") history.forward();
      return;
    }
    next.index=targetIndex;
    const target=next.entries[targetIndex];
    write(next);
    if (target && target !== current()) location.href=target;
  };
  document.addEventListener("click", event => {
    const link=event.target.closest?.("a[href]");
    if (!link || event.defaultPrevented || link.target==="_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    let url;
    try { url=new URL(link.href,location.href); } catch { return; }
    if (url.origin !== location.origin || url.protocol !== location.protocol) return;
    const state=read();
    const next=url.href;
    if (state.entries[state.index] === next) return;
    state.entries=state.entries.slice(0,state.index+1); state.entries.push(next); state.index++; write(state);
  }, true);
})();

(() => {
  const boot = () => {
    if (document.getElementById("lunar-context-menu")) return;
    const menu=document.createElement("div");
    menu.id="lunar-context-menu";
    menu.className="lunar-context-menu";
    menu.innerHTML='<div class="lunar-context-head"><strong>Lunar Menu</strong><span id="lunar-context-target">Page actions</span></div><div id="lunar-context-actions"></div>';
    document.body.appendChild(menu);
    let context={x:0,y:0,link:null,image:null,selection:"",input:null};
    const actions=menu.querySelector("#lunar-context-actions");
    const close=()=>{menu.classList.remove("is-open");context={...context,x:context.x,y:context.y}};
    const item=(icon,label,key,extra="")=>'<button type="button" class="lunar-context-item '+extra+'" data-context-action="'+key+'"><i class="'+icon+'"></i><span>'+label+'</span></button>';
    function render(){
      const target=document.querySelector("#lunar-context-target");
      const parts=[];
      if(context.link) parts.push(item("fa-solid fa-arrow-up-right-from-square","Open link in new tab","open-link"));
      if(context.image) parts.push(item("fa-regular fa-image","Open image","open-image"),item("fa-regular fa-copy","Copy image address","copy-image"));
      parts.push(item("fa-solid fa-arrow-left","Back","back"),item("fa-solid fa-arrow-right","Forward","forward"),item("fa-solid fa-rotate","Reload","reload"));
      if(context.selection) parts.push('<div class="lunar-context-sep"></div>',item("fa-regular fa-copy","Copy selection","copy"),item("fa-solid fa-magnifying-glass","Search selection","search"));
      if(context.input) parts.push('<div class="lunar-context-sep"></div>',item("fa-regular fa-clipboard","Paste","paste"),item("fa-solid fa-i-cursor","Select all","select-all"));
      if(context.link) parts.push('<div class="lunar-context-sep"></div>',item("fa-regular fa-copy","Copy link","copy-link"));
      actions.innerHTML=parts.join("");
      target.textContent=context.link?"Link actions":context.image?"Image actions":context.input?"Text field":"Page actions";
    }
    document.addEventListener("contextmenu",e=>{
      e.preventDefault();
      const t=e.target;
      const link=t.closest?.("a[href]");
      const img=t.closest?.("img[src]");
      const input=t.closest?.("input,textarea,[contenteditable='true']");
      const sel=window.getSelection?.()?.toString().trim()||"";
      context={x:e.clientX,y:e.clientY,link:link?.href||null,image:img?.src||null,selection:sel,input:input||null};
      render();
      menu.style.left="0px";menu.style.top="0px";menu.classList.add("is-open");
      const rect=menu.getBoundingClientRect();
      const left=Math.min(e.clientX,innerWidth-rect.width-8);
      const top=Math.min(e.clientY,innerHeight-rect.height-8);
      menu.style.left=Math.max(8,left)+"px";menu.style.top=Math.max(8,top)+"px";
    });
    document.addEventListener("click",e=>{if(!menu.contains(e.target))close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
    actions.addEventListener("click",async e=>{
      const b=e.target.closest("[data-context-action]");if(!b)return;
      const a=b.dataset.contextAction;
      try{
        if(a==="back") window.lunarContextNavigate?.("back");
        else if(a==="forward") window.lunarContextNavigate?.("forward");
        else if(a==="reload") location.reload();
        else if(a==="open-link"&&context.link) window.open(context.link,"_blank","noopener,noreferrer");
        else if(a==="copy-link"&&context.link){await navigator.clipboard.writeText(context.link);window.dispatchEvent(new CustomEvent("lunar:toast",{detail:"Link copied"}))}
        else if(a==="open-image"&&context.image) window.open(context.image,"_blank","noopener,noreferrer");
        else if(a==="copy-image"&&context.image){await navigator.clipboard.writeText(context.image);window.dispatchEvent(new CustomEvent("lunar:toast",{detail:"Image address copied"}))}
        else if(a==="copy"&&context.selection){await navigator.clipboard.writeText(context.selection);window.dispatchEvent(new CustomEvent("lunar:toast",{detail:"Copied"}))}
        else if(a==="paste"&&context.input){const text=await navigator.clipboard.readText();if("value" in context.input){const start=context.input.selectionStart??context.input.value.length;const end=context.input.selectionEnd??start;context.input.setRangeText(text,start,end,"end");context.input.dispatchEvent(new Event("input",{bubbles:true}))}else{document.execCommand("insertText",false,text)}}
        else if(a==="select-all"&&context.input){context.input.focus();if("select" in context.input)context.input.select();else{const r=document.createRange();r.selectNodeContents(context.input);const s=getSelection();s.removeAllRanges();s.addRange(r)}}
        else if(a==="search"&&context.selection){const q=encodeURIComponent(context.selection);window.open("https://www.google.com/search?q="+q,"_blank","noopener,noreferrer")}
      }catch(err){window.dispatchEvent(new CustomEvent("lunar:toast",{detail:"Action unavailable"}))}
      close();
    });
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

(function initLunarCursorCompositor(){
  const effectPointers = new Set([
    "rainbow-stars","white-orbs","rainbow-trail","blue-orbs","red-circle",
    "the-sims","curly-cursor","comet-cursor","spark-cursor","crosshair-cursor",
    "soft-glow-cursor","pixel-cursor","ring-cursor"
  ]);
  const staticPointers = new Set(["normal-lunar","normal-graphite","normal-minimal","normal-outline","normal-cross"]);
  function sync(){
    if (!document.body || typeof store === "undefined") return;
    const pointer = store.get("pointer") || "default";
    document.documentElement.classList.toggle("lunar-pointer-active", effectPointers.has(pointer));
    document.body.classList.toggle("lunar-custom-cursor-active", effectPointers.has(pointer));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once:true}); else sync();
  let last = null;
  setInterval(() => {
    if (typeof store === "undefined") return;
    const current = store.get("pointer") || "default";
    if (current !== last) { last = current; sync(); }
  }, 300);
})();

const lunarAuthGateStyle=document.createElement("style");lunarAuthGateStyle.textContent=`
.lunar-auth-locked{overflow:hidden!important}#lunar-auth-gate{position:fixed!important;inset:0;z-index:2147483647!important;display:grid;place-items:center;padding:22px;isolation:isolate}#lunar-auth-gate .lunar-auth-backdrop{position:absolute;inset:0;background:rgba(4,7,13,.56);backdrop-filter:blur(15px) saturate(120%);-webkit-backdrop-filter:blur(15px) saturate(120%)}#lunar-auth-gate .lunar-auth-panel{position:relative;width:min(430px,100%);padding:34px 30px 28px;text-align:center;border:1px solid rgba(255,255,255,.15);border-radius:28px;background:linear-gradient(145deg,rgba(25,29,42,.88),rgba(9,12,19,.8));box-shadow:0 30px 100px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1);color:var(--text);animation:lunarAuthIn .45s cubic-bezier(.16,1,.3,1)}#lunar-auth-gate .lunar-auth-orb{width:62px;height:62px;margin:0 auto 13px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,rgba(180,190,255,.72) 20%,rgba(110,115,255,.18) 58%,transparent 72%);box-shadow:0 0 45px rgba(130,130,255,.28);color:#fff;font-size:22px}#lunar-auth-gate .lunar-auth-kicker{font-size:9px;font-weight:900;letter-spacing:.18em;color:#aaa1ff}#lunar-auth-gate h2{margin:7px 0 8px;font-size:27px;letter-spacing:-.7px}#lunar-auth-gate p{margin:0 auto;color:var(--text-faint);font-size:12px;line-height:1.65;max-width:340px}#lunar-auth-gate .lunar-auth-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:22px 0 14px}#lunar-auth-gate .lunar-auth-actions a{display:flex;align-items:center;justify-content:center;min-height:46px;border-radius:13px;text-decoration:none;font-weight:800;font-size:12px;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}.lunar-auth-primary{background:linear-gradient(135deg,#8f86ff,#655cff);color:#fff;box-shadow:0 12px 28px rgba(100,90,255,.28)}.lunar-auth-primary:hover{transform:translateY(-2px)}.lunar-auth-secondary{border:1px solid var(--border-strong);background:var(--surface);color:var(--text)}.lunar-auth-secondary:hover{transform:translateY(-2px);background:var(--surface-hover)}#lunar-auth-gate .lunar-auth-security{display:flex;align-items:flex-start;gap:10px;margin:0 0 13px;padding:11px 12px;text-align:left;border:1px solid rgba(145,130,255,.18);border-radius:13px;background:rgba(130,115,255,.055);color:var(--text-faint);font-size:10px;line-height:1.5}
#lunar-auth-gate .lunar-auth-security i{flex:0 0 auto;margin-top:2px;color:#aaa1ff;font-size:13px}
#lunar-auth-gate .lunar-auth-security strong{color:var(--text);font-size:10px}
#lunar-auth-gate small{display:block;color:var(--text-faint);font-size:9px;line-height:1.5}@keyframes lunarAuthIn{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}@media(max-width:560px){#lunar-auth-gate{padding:14px}#lunar-auth-gate .lunar-auth-panel{padding:28px 20px 23px;border-radius:22px}#lunar-auth-gate .lunar-auth-actions{grid-template-columns:1fr}}`;
document.head.appendChild(lunarAuthGateStyle);

/* Load the shared motion layer after all theme styles so it remains consistent on every page. */
const lunarMotionLink = document.createElement("link");
lunarMotionLink.rel = "stylesheet";
lunarMotionLink.href = "/assets/css/lunar-motion.css?v=lunar1";
document.head.appendChild(lunarMotionLink);

/* Smooth same-origin page exits. External links, downloads, new tabs and form controls are untouched. */
document.addEventListener("click", event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.("a[href]");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
  let url;
  try { url = new URL(link.href, location.href); } catch { return; }
  if (url.origin !== location.origin || url.protocol !== location.protocol) return;
  if (url.href === location.href || link.dataset.noPageTransition === "true") return;
  if (event.target.closest(".lunar-select-menu,.lunar-context-menu")) return;
  event.preventDefault();
  document.body.classList.add("lunar-page-leaving");
  window.setTimeout(() => { location.href = url.href; }, 170);
});

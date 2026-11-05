(() => {
  const list = document.getElementById("soundboard-list");
  const viewTitle = document.getElementById("soundboard-view-title");
  const browseTools = document.getElementById("soundboard-browse-tools");
  const loadStatus = document.getElementById("soundboard-load-status");
  const randomizeButton = document.getElementById("soundboard-randomize");
  const categoryContainer = document.getElementById("soundboard-browse-categories");
  const searchForm = document.getElementById("soundboard-search-form");
  const searchInput = document.getElementById("soundboard-search");
  const count = document.getElementById("soundboard-count");
  const form = document.getElementById("sound-upload-form");
  const fileInput = document.getElementById("sound-file");
  const fileLabel = document.getElementById("sound-file-label");
  const titleInput = document.getElementById("sound-title");
  const uploadButton = document.getElementById("sound-upload-button");
  const status = document.getElementById("sound-upload-status");
  if (!list || !form) return;

  const players = new Map();
  let sounds = [];
  let currentUser = null;
  let currentView = "community";
  let catalogPage = 1;
  let catalogHasMore = false;
  let catalogLoading = false;
  let activeCategory = "All";
  let catalogExhausted = false;
  let favorites = new Set();
  let externalSounds = [];
  let browsePool = [];
  let catalogSeen = new Set();

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const formatTime = value => {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  };
  const setStatus = (message, kind = "") => { status.textContent = message; status.className = "soundboard-status " + kind; };
  const audioMime = file => {
    const type = String(file.type || "").toLowerCase();
    if (type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4") && type.startsWith("video/")) return "";
    const ext = file.name.toLowerCase().split(".").pop();
    const map = { mp3:"audio/mpeg", wav:"audio/wav", ogg:"audio/ogg", webm:"audio/webm", m4a:"audio/mp4", aac:"audio/aac", flac:"audio/flac", mp4:"audio/mp4" };
    if (type.startsWith("audio/")) return type;
    return map[ext] || "";
  };
  const readDuration = file => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { const duration = audio.duration; URL.revokeObjectURL(url); audio.remove(); resolve(duration); };
    audio.onerror = () => { URL.revokeObjectURL(url); audio.remove(); reject(new Error("This file could not be read as audio. MP4 must contain audio only.")); };
    audio.src = url;
  });

  async function loadUser() {
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      currentUser = data.user || null;
    } catch {}
  }

  function render() {
    count.textContent = sounds.length + " sound" + (sounds.length === 1 ? "" : "s") + " available";
    if (!sounds.length) {
      list.innerHTML = '<div class="soundboard-empty"><i class="fa-solid fa-music"></i><strong>No sounds yet</strong><span>Upload the first sound and it will appear here for everyone.</span></div>';
      return;
    }
    list.innerHTML = sounds.map(sound => {
      const canDelete = currentUser && (currentUser.id === sound.ownerId || ["lunar","lunarstudios"].includes(String(currentUser.username || "").toLowerCase()));
      const favorite = favorites.has(sound.favoriteKey || sound.id);
      const favButton = currentUser ? '<button type="button" class="soundboard-favorite ' + (favorite ? 'active' : '') + '" data-favorite="' + escapeHtml(sound.favoriteKey || sound.id) + '" aria-label="' + (favorite ? 'Remove from favorites' : 'Add to favorites') + '" aria-pressed="' + favorite + '"><i class="fa-solid fa-heart"></i></button>' : '';
      return '<article class="soundboard-card" data-sound-id="' + escapeHtml(sound.id) + '">' +
        '<div class="soundboard-card-top"><span class="soundboard-card-icon"><i class="fa-solid fa-wave-square"></i></span><div class="soundboard-card-info"><strong title="' + escapeHtml(sound.title) + '">' + escapeHtml(sound.title) + '</strong><small>by ' + escapeHtml(sound.author) + (sound.license ? ' · ' + escapeHtml(sound.license) : '') + '</small></div><span class="soundboard-card-duration">' + formatTime(sound.duration) + '</span>' + favButton +
        '<div class="soundboard-play-controls"><button class="soundboard-play" type="button" data-play="' + escapeHtml(sound.id) + '" aria-label="Play ' + escapeHtml(sound.title) + '" title="Play sound"><i class="fa-solid fa-play"></i></button><button class="soundboard-pause" type="button" data-pause="' + escapeHtml(sound.id) + '" aria-label="Pause ' + escapeHtml(sound.title) + '" title="Pause sound"><i class="fa-solid fa-pause"></i></button></div></div>' +
        '<div class="soundboard-audio-controls"><input class="soundboard-timeline" data-seek="' + escapeHtml(sound.id) + '" type="range" min="0" max="' + Math.max(0.1, Number(sound.duration) || 0.1) + '" step="0.1" value="0" aria-label="Audio timeline">' +
        '<div class="soundboard-control-row"><span class="soundboard-time" data-time="' + escapeHtml(sound.id) + '">0:00 / ' + formatTime(sound.duration) + '</span>' +
        '<label class="soundboard-time">Volume <input class="soundboard-volume" data-volume="' + escapeHtml(sound.id) + '" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume"></label>' +
        '<button type="button" class="soundboard-loop" data-loop="' + escapeHtml(sound.id) + '" aria-pressed="false"><i class="fa-solid fa-repeat"></i> Loop</button>' +
        (sound.downloadUrl ? '<a class="soundboard-download" href="' + escapeHtml(sound.downloadUrl) + '" download="' + escapeHtml((sound.title || 'sound').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase()) + '.mp3" target="_blank" rel="noopener noreferrer" title="Download sound"><i class="fa-solid fa-download"></i> Download</a>' : '') + (canDelete ? '<button type="button" class="soundboard-delete" data-delete="' + escapeHtml(sound.id) + '" title="Delete your sound"><i class="fa-solid fa-trash"></i></button>' : '') +
        '</div></div>' + (sound.sourceUrl ? '<a class="soundboard-external" href="' + escapeHtml(sound.sourceUrl) + '" target="_blank" rel="noopener noreferrer">View source <i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '') + '</article>';
    }).join("");
    list.querySelectorAll("[data-play]").forEach(button => button.addEventListener("click", () => play(button.dataset.play)));
    list.querySelectorAll("[data-pause]").forEach(button => button.addEventListener("click", () => {
      const audio = players.get(button.dataset.pause);
      if (audio) audio.pause();
    }));
    list.querySelectorAll("[data-seek]").forEach(input => input.addEventListener("input", () => {
      const audio = players.get(input.dataset.seek);
      if (audio && Number.isFinite(audio.duration)) audio.currentTime = Number(input.value);
    }));
    list.querySelectorAll("[data-volume]").forEach(input => input.addEventListener("input", () => {
      const audio = players.get(input.dataset.volume);
      if (audio) audio.volume = Number(input.value);
    }));
    list.querySelectorAll("[data-loop]").forEach(button => button.addEventListener("click", () => {
      const audio = players.get(button.dataset.loop) || makePlayer(button.dataset.loop);
      audio.loop = !audio.loop;
      button.classList.toggle("active", audio.loop);
      button.setAttribute("aria-pressed", String(audio.loop));
    }));
    list.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => removeSound(button.dataset.delete)));
    list.querySelectorAll("[data-favorite]").forEach(button => button.addEventListener("click", () => toggleFavorite(button.dataset.favorite)));
  }

  function makePlayer(id) {
    const sound = sounds.find(item => item.id === id) || externalSounds.find(item => item.id === id);
    if (!sound) return null;
    let audio = players.get(id);
    if (audio) return audio;
    audio = new Audio(sound.audioUrl);
    audio.preload = "none";
    audio.volume = 1;
    audio.addEventListener("timeupdate", () => {
      const seek = list.querySelector('[data-seek="' + CSS.escape(id) + '"]');
      const time = list.querySelector('[data-time="' + CSS.escape(id) + '"]');
      if (seek && !seek.matches(":active")) seek.value = String(audio.currentTime);
      if (time) time.textContent = formatTime(audio.currentTime) + " / " + formatTime(audio.duration || sound.duration);
    });
    audio.addEventListener("play", () => {
      const button = list.querySelector('[data-play="' + CSS.escape(id) + '"]');
      if (button) button.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    });
    audio.addEventListener("pause", () => {
      const button = list.querySelector('[data-play="' + CSS.escape(id) + '"]');
      if (button) button.innerHTML = '<i class="fa-solid fa-play"></i>';
    });
    audio.addEventListener("ended", () => {
      if (!audio.loop) {
        const button = list.querySelector('[data-play="' + CSS.escape(id) + '"]');
        if (button) button.innerHTML = '<i class="fa-solid fa-play"></i>';
      }
    });
    players.set(id, audio);
    return audio;
  }

  async function play(id) {
    const audio = makePlayer(id);
    if (!audio) return;
    try {
      audio.currentTime = 0;
      await audio.play();
    }
    catch { setStatus("The browser blocked playback. Press Play again to allow audio.", "error"); }
  }

  async function loadSounds() {
    list.innerHTML = '<div class="soundboard-empty"><i class="fa-solid fa-spinner fa-spin"></i><strong>Loading sounds…</strong></div>';
    try {
      const response = await fetch("/api/sounds", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load sounds.");
      const next = data.sounds || [];
      const validIds = new Set(next.map(sound => sound.id));
      for (const [id, audio] of players) if (!validIds.has(id)) { audio.pause(); audio.src = ""; players.delete(id); }
      sounds = next.map(sound => ({...sound, favoriteKey: "community:" + sound.id}));
      if (currentView === "community") render();
    } catch (error) {
      if (currentView === "community") {
        list.innerHTML = '<div class="soundboard-empty"><i class="fa-solid fa-circle-exclamation"></i><strong>Sounds unavailable</strong><span>' + escapeHtml(error.message) + '</span></div>';
        count.textContent = "Could not load sounds";
      }
    }
  }


  async function loadFavorites() {
    if (!currentUser) { favorites = new Set(); return; }
    const response = await fetch("/api/sounds/favorites", {credentials:"same-origin", cache:"no-store"});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load favorites.");
    favorites = new Set(data.favorites || []);
  }

  async function toggleFavorite(id) {
    if (!currentUser) { setStatus("Log in to save favorites.", "error"); return; }
    try {
      const response = await fetch("/api/sounds/favorites/" + encodeURIComponent(id), {method:"POST", credentials:"same-origin", cache:"no-store"});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update favorite.");
      favorites = new Set(data.favorites || []);
      if (currentView === "favorites") await loadFavoritesView();
      else render();
      setStatus(data.favorited ? "Added to favorites." : "Removed from favorites.", "success");
    } catch (error) { setStatus(error.message, "error"); }
  }

  const BUILTIN_CATALOG = [
    {id:"builtin:soft-pop",title:"Soft Pop",category:"Reactions",duration:0.7,wave:"sine",start:520,end:180,decay:7},
    {id:"builtin:bubble-pop",title:"Bubble Pop",category:"Reactions",duration:0.55,wave:"sine",start:760,end:260,decay:9},
    {id:"builtin:digital-blip",title:"Digital Blip",category:"Gaming",duration:0.32,wave:"square",start:880,end:440,decay:12},
    {id:"builtin:power-up",title:"Power Up",category:"Gaming",duration:1.25,wave:"saw",start:240,end:1100,decay:2.5},
    {id:"builtin:retro-coin",title:"Retro Coin",category:"Gaming",duration:0.8,wave:"square",start:660,end:1320,decay:5},
    {id:"builtin:magic-sparkle",title:"Magic Sparkle",category:"Music",duration:1.6,wave:"sine",start:1200,end:620,decay:2.2},
    {id:"builtin:happy-chime",title:"Happy Chime",category:"Music",duration:1.4,wave:"sine",start:660,end:990,decay:1.8},
    {id:"builtin:cartoon-boing",title:"Cartoon Boing",category:"Memes & Fun",duration:1.1,wave:"triangle",start:180,end:620,decay:2.7},
    {id:"builtin:comedy-slide",title:"Comedy Slide",category:"Memes & Fun",duration:1.3,wave:"saw",start:680,end:130,decay:2.4},
    {id:"builtin:notification",title:"Notification",category:"UI",duration:0.65,wave:"sine",start:740,end:920,decay:4},
    {id:"builtin:soft-whoosh",title:"Soft Whoosh",category:"Sound Effects",duration:1.2,wave:"noise",start:0,end:0,decay:2.2},
    {id:"builtin:tiny-drumroll",title:"Tiny Drumroll",category:"Sound Effects",duration:1.35,wave:"noise",start:0,end:0,decay:1.2}
  ];

  function makeSoundWav(sound) {
    const sampleRate = 22050;
    const length = Math.max(1, Math.floor(sampleRate * sound.duration));
    const bytes = new ArrayBuffer(44 + length * 2);
    const view = new DataView(bytes);
    const write = (offset, value) => { for (let i=0;i<value.length;i++) view.setUint8(offset+i,value.charCodeAt(i)); };
    write(0,"RIFF"); view.setUint32(4,36+length*2,true); write(8,"WAVE"); write(12,"fmt ");
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
    view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true);
    view.setUint16(32,2,true); view.setUint16(34,16,true); write(36,"data"); view.setUint32(40,length*2,true);
    let phase=0, noise=0;
    for(let i=0;i<length;i++){
      const t=i/sampleRate, p=t/sound.duration;
      const attack=Math.min(1,t/0.018);
      const envelope=attack*Math.pow(Math.max(0,1-p),sound.decay);
      let sample=0;
      if(sound.wave==="noise"){
        noise=noise*0.72+(Math.random()*2-1)*0.28;
        sample=noise*(sound.id.endsWith("drumroll") ? (0.45+0.35*Math.sin(t*34)) : 1);
      } else {
        const freq=sound.start+(sound.end-sound.start)*p;
        phase+=2*Math.PI*freq/sampleRate;
        const s=Math.sin(phase);
        if(sound.wave==="square") sample=Math.sign(s)*0.62;
        else if(sound.wave==="saw") sample=2*((phase/(2*Math.PI))%1)-1;
        else if(sound.wave==="triangle") sample=(2/Math.PI)*Math.asin(s);
        else sample=s;
        if(sound.id.endsWith("magic-sparkle")) sample*=0.72+0.28*Math.sin(t*31);
      }
      const value=Math.max(-1,Math.min(1,sample*envelope*0.72));
      view.setInt16(44+i*2,Math.round(value*32767),true);
    }
    return URL.createObjectURL(new Blob([bytes],{type:"audio/wav"}));
  }

  function prepareBuiltin(item) {
    if(item.audioUrl) return item;
    const audioUrl=makeSoundWav(item);
    return {...item,audioUrl,downloadUrl:audioUrl,author:"Lunar",license:"Original · Lunar"};
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function renderCategories() {
    if(!categoryContainer) return;
    const categories=["All",...new Set(BUILTIN_CATALOG.map(item=>item.category))];
    categoryContainer.innerHTML=categories.map(category=>'<button type="button" data-category="'+escapeHtml(category)+'" class="'+(activeCategory===category?'active':'')+'">'+escapeHtml(category)+'</button>').join("");
    categoryContainer.querySelectorAll("[data-category]").forEach(button=>button.addEventListener("click",()=>{
      activeCategory=button.dataset.category;
      renderCategories();
      loadBrowse(true);
    }));
  }

  async function loadBrowse(reset = true) {
    if (catalogLoading) return;
    if (reset) {
      catalogPage=1; catalogHasMore=false; catalogExhausted=false;
      const query=searchInput.value.trim().toLowerCase();
      browsePool=BUILTIN_CATALOG.filter(item=>(activeCategory==="All"||item.category===activeCategory) &&
        (!query || (item.title+" "+item.category).toLowerCase().includes(query)));
      browsePool=shuffle(browsePool);
      sounds=[];
      list.innerHTML='<div class="soundboard-empty"><i class="fa-solid fa-spinner fa-spin"></i><strong>Preparing Lunar sounds…</strong></div>';
    }
    if(catalogExhausted) return;
    catalogLoading=true;
    if(loadStatus){loadStatus.hidden=false;loadStatus.textContent="Loading more sounds…";}
    try{
      const batch=browsePool.slice((catalogPage-1)*8,catalogPage*8).map(prepareBuiltin);
      batch.forEach(item=>{if(!catalogSeen.has(item.id))catalogSeen.add(item.id);});
      sounds=reset?batch:[...sounds,...batch];
      catalogHasMore=catalogPage*8<browsePool.length;
      catalogExhausted=!catalogHasMore;
      render();
      count.textContent=sounds.length+" of "+browsePool.length+" sounds · Lunar Library";
      if(loadStatus){loadStatus.hidden=catalogExhausted;loadStatus.textContent="Scroll for more sounds…";}
      catalogPage++;
      if(!browsePool.length) list.innerHTML='<div class="soundboard-empty"><strong>No sounds found</strong><span>Try another search or category.</span></div>';
    }catch(error){
      list.innerHTML='<div class="soundboard-empty"><i class="fa-solid fa-circle-exclamation"></i><strong>Browse unavailable</strong><span>'+escapeHtml(error.message)+'</span></div>';
      count.textContent="Could not load Lunar sounds";
      if(loadStatus)loadStatus.hidden=true;
    }finally{catalogLoading=false;}
  }

  function renderSounds(items) { sounds = items; render(); }

  async function loadMoreBrowse() {
    if (currentView === "browse" && catalogHasMore && !catalogLoading && !catalogExhausted) await loadBrowse(false);
  }

  async function loadFavoritesView() {
    if (!currentUser) {
      list.innerHTML = '<div class="soundboard-empty"><strong>Log in to use Favorites</strong><span>Your saved sounds are tied to your Lunar account.</span></div>';
      count.textContent = "Login required";
      return;
    }
    try {
      await loadFavorites();
      const response = await fetch("/api/sounds", {credentials:"same-origin", cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load community sounds.");
      const community = (data.sounds || []).map(sound => ({...sound, favoriteKey:"community:" + sound.id}));
      const local = community.filter(item => favorites.has(item.favoriteKey));
      const builtins = BUILTIN_CATALOG.filter(item=>favorites.has(item.id)).map(prepareBuiltin);
      const external = [];
      const combined = [...local, ...builtins, ...external];
      count.textContent = combined.length + " saved sounds";
      if (combined.length) renderSounds(combined);
      else list.innerHTML = '<div class="soundboard-empty"><strong>No favorites yet</strong><span>Tap the heart on a sound to save it here.</span></div>';
    } catch (error) {
      list.innerHTML = '<div class="soundboard-empty"><strong>Favorites unavailable</strong><span>' + escapeHtml(error.message) + '</span></div>';
    }
  }

  async function switchView(view) {
    currentView = view;
    document.querySelectorAll("[data-view]").forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    browseTools.hidden = view !== "browse";
    if (loadStatus) loadStatus.hidden = view !== "browse";
    document.getElementById("soundboard-refresh").hidden = view === "favorites";
    viewTitle.textContent = view === "community" ? "Community sounds" : view === "browse" ? "Browse Lunar sounds" : "Favorite sounds";
    if (view === "community") await loadSounds();
    else if (view === "browse") await loadBrowse();
    else await loadFavoritesView();
  }

  async function removeSound(id) {
    if (!confirm("Delete this sound from the community soundboard?")) return;
    try {
      const response = await fetch("/api/sounds/" + encodeURIComponent(id), { method:"DELETE", credentials:"same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete sound.");
      const player = players.get(id);
      if (player) { player.pause(); player.src = ""; players.delete(id); }
      await loadSounds();
      setStatus("Sound deleted.", "success");
    } catch (error) { setStatus(error.message, "error"); }
  }

  fileInput.addEventListener("change", () => { fileLabel.textContent = fileInput.files?.[0]?.name || "Choose an audio file"; });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const file = fileInput.files?.[0];
    const title = titleInput.value.trim();
    if (!file || !title) { setStatus("Add a title and choose an audio file.", "error"); return; }
    const contentType = audioMime(file);
    if (!contentType) { setStatus("Choose an audio file. MP4 videos are not supported.", "error"); return; }
    if (file.size > 12 * 1024 * 1024) { setStatus("Audio files must be 12 MB or smaller.", "error"); return; }
    uploadButton.disabled = true;
    setStatus("Checking audio duration…");
    try {
      const duration = await readDuration(file);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 60) throw new Error("Sounds must be no longer than 1 minute.");
      setStatus("Uploading sound…");
      const response = await fetch("/api/sounds/upload", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": contentType, "X-Sound-Title": title, "X-Sound-Duration": String(duration) },
        body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      form.reset();
      fileLabel.textContent = "Choose an audio file";
      await loadSounds();
      setStatus("Your sound was uploaded and added to the community soundboard.", "success");
    } catch (error) { setStatus(error.message, "error"); }
    finally { uploadButton.disabled = false; }
  });
  document.getElementById("soundboard-refresh")?.addEventListener("click", () => switchView(currentView));
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  searchForm?.addEventListener("submit", event => { event.preventDefault(); loadBrowse(true); });
  randomizeButton?.addEventListener("click", () => { if(currentView==="browse") loadBrowse(true); });
  const browseObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadMoreBrowse();
  }, {rootMargin:"700px"});
  if (loadStatus) browseObserver.observe(loadStatus);
  renderCategories();
  loadUser().then(async () => { await loadFavorites(); await loadSounds(); });
})();
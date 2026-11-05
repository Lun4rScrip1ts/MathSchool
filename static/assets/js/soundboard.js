(() => {
  const list = document.getElementById("soundboard-list");
  const viewTitle = document.getElementById("soundboard-view-title");
  const browseTools = document.getElementById("soundboard-browse-tools");
  const pagination = document.getElementById("soundboard-pagination");
  const pageLabel = document.getElementById("soundboard-page-label");
  const previousPage = document.getElementById("soundboard-prev");
  const nextPage = document.getElementById("soundboard-next");
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
  let catalogType = "trending";
  let catalogPage = 1;
  let catalogTotalPages = null;
  let favorites = new Set();
  let externalSounds = [];

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
        '<div class="soundboard-card-top"><span class="soundboard-card-icon"><i class="fa-solid fa-wave-square"></i></span><div class="soundboard-card-info"><strong title="' + escapeHtml(sound.title) + '">' + escapeHtml(sound.title) + '</strong><small>by ' + escapeHtml(sound.author) + '</small></div><span class="soundboard-card-duration">' + formatTime(sound.duration) + '</span>' + favButton +
        '<button class="soundboard-play" type="button" data-play="' + escapeHtml(sound.id) + '" aria-label="Play ' + escapeHtml(sound.title) + '" title="Play sound"><i class="fa-solid fa-play"></i></button></div>' +
        '<div class="soundboard-audio-controls"><input class="soundboard-timeline" data-seek="' + escapeHtml(sound.id) + '" type="range" min="0" max="' + Math.max(0.1, Number(sound.duration) || 0.1) + '" step="0.1" value="0" aria-label="Audio timeline">' +
        '<div class="soundboard-control-row"><span class="soundboard-time" data-time="' + escapeHtml(sound.id) + '">0:00 / ' + formatTime(sound.duration) + '</span>' +
        '<label class="soundboard-time">Volume <input class="soundboard-volume" data-volume="' + escapeHtml(sound.id) + '" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume"></label>' +
        '<button type="button" class="soundboard-loop" data-loop="' + escapeHtml(sound.id) + '" aria-pressed="false"><i class="fa-solid fa-repeat"></i> Loop</button>' +
        (canDelete ? '<button type="button" class="soundboard-delete" data-delete="' + escapeHtml(sound.id) + '" title="Delete your sound"><i class="fa-solid fa-trash"></i></button>' : '') +
        '</div></div>' + (sound.sourceUrl ? '<a class="soundboard-external" href="' + escapeHtml(sound.sourceUrl) + '" target="_blank" rel="noopener noreferrer">View on MyInstants <i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '') + '</article>';
    }).join("");
    list.querySelectorAll("[data-play]").forEach(button => button.addEventListener("click", () => play(button.dataset.play)));
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
    list.querySelectorAll("[data-favorite]").forEach(button => button.addEventListener("click", () => toggleFavorite(button.dataset.favorite)));
  }

  function makePlayer(id) {
    const sound = sounds.find(item => item.id === id);
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
    // Play-only button: clicking again restarts the clip instead of pausing it.
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
    try {
      const response = await fetch("/api/sounds/favorites", {credentials:"same-origin", cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load favorites.");
      favorites = new Set(data.favorites || []);
    } catch { favorites = new Set(); }
  }

  async function toggleFavorite(id) {
    if (!currentUser) { setStatus("Log in to save favorites.", "error"); return; }
    try {
      const response = await fetch("/api/sounds/favorites/" + encodeURIComponent(id), {method:"POST", credentials:"same-origin"});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update favorite.");
      favorites = new Set(data.favorites || []);
      if (currentView === "favorites") await loadFavoritesView();
      else render();
    } catch (error) { setStatus(error.message, "error"); }
  }

  function normalizeCatalog(item) {
    return {
      id: "myinstants:" + item.id,
      favoriteKey: "myinstants:" + item.id,
      title: item.title,
      author: "MyInstants",
      duration: item.duration || 0,
      audioUrl: item.audioUrl,
      sourceUrl: item.sourceUrl,
    };
  }

  async function loadBrowse() {
    list.innerHTML = '<div class="soundboard-empty"><i class="fa-solid fa-spinner fa-spin"></i><strong>Loading MyInstants…</strong></div>';
    pagination.hidden = true;
    const params = new URLSearchParams({type:catalogType, page:String(catalogPage)});
    if (catalogType === "search") params.set("q", searchInput.value.trim());
    try {
      const response = await fetch("/api/sounds/browse?" + params.toString(), {cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Browse is unavailable.");
      externalSounds = (data.sounds || []).map(normalizeCatalog);
      catalogTotalPages = data.totalPages || null;
      count.textContent = externalSounds.length + " catalog sounds · MyInstants";
      if (!externalSounds.length) {
        list.innerHTML = '<div class="soundboard-empty"><strong>No sounds found</strong><span>Try another search or category.</span></div>';
      } else renderSounds(externalSounds);
      pagination.hidden = false;
      pageLabel.textContent = "Page " + catalogPage + (catalogTotalPages ? " of " + catalogTotalPages : "");
      previousPage.disabled = catalogPage <= 1;
      nextPage.disabled = !data.hasNext && catalogTotalPages !== null;
    } catch (error) {
      list.innerHTML = '<div class="soundboard-empty"><i class="fa-solid fa-circle-exclamation"></i><strong>Browse unavailable</strong><span>' + escapeHtml(error.message) + '</span></div>';
      count.textContent = "MyInstants catalog unavailable";
    }
  }

  function renderSounds(items) {
    const oldSounds = sounds;
    sounds = items;
    render();
    sounds = oldSounds;
  }

  async function loadFavoritesView() {
    if (!currentUser) {
      list.innerHTML = '<div class="soundboard-empty"><strong>Log in to use Favorites</strong><span>Your saved sounds are tied to your Lunar account.</span></div>';
      count.textContent = "Login required";
      return;
    }
    await loadFavorites();
    const communityFavs = sounds.filter(sound => favorites.has("community:" + sound.id));
    const catalogIds = [...favorites].filter(id => id.startsWith("myinstants:")).map(id => id.slice("myinstants:".length));
    const catalogFavs = [];
    for (const id of catalogIds) {
      try {
        const response = await fetch("/api/sounds/browse?type=search&q=" + encodeURIComponent(id), {cache:"no-store"});
        if (!response.ok) continue;
        const data = await response.json();
        const found = (data.sounds || []).find(item => item.id === id);
        if (found) catalogFavs.push(normalizeCatalog(found));
      } catch {}
    }
    const combined = [...communityFavs, ...catalogFavs];
    count.textContent = combined.length + " saved sounds";
    renderSounds(combined);
  }

  async function switchView(view) {
    currentView = view;
    document.querySelectorAll("[data-view]").forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    browseTools.hidden = view !== "browse";
    pagination.hidden = view !== "browse";
    document.getElementById("soundboard-refresh").hidden = view === "favorites";
    viewTitle.textContent = view === "community" ? "Community sounds" : view === "browse" ? "Browse MyInstants" : "Favorite sounds";
    if (view === "community") await loadSounds();
    else if (view === "browse") await loadBrowse();
    else await loadFavoritesView();
  }

  async function loadFavorites() {
    if (!currentUser) { favorites = new Set(); return; }
    const response = await fetch("/api/sounds/favorites", {credentials:"same-origin", cache:"no-store"});
    const data = await response.json();
    if (response.ok) favorites = new Set(data.favorites || []);
  }
  async function toggleFavorite(id) {
    if (!currentUser) { setStatus("Log in to save favorites.", "error"); return; }
    try {
      const response = await fetch("/api/sounds/favorites/" + encodeURIComponent(id), {method:"POST", credentials:"same-origin"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update favorite.");
      favorites = new Set(data.favorites || []);
      if (currentView === "favorites") await loadFavoritesView();
      else render();
    } catch (error) { setStatus(error.message, "error"); }
  }
  function normalizeCatalog(item) {
    return {id:"myinstants:" + item.id, favoriteKey:"myinstants:" + item.id, title:item.title, author:"MyInstants", duration:item.duration || 0, audioUrl:item.audioUrl, sourceUrl:item.sourceUrl};
  }
  async function loadBrowse() {
    list.innerHTML = '<div class="soundboard-empty"><i class="fa-solid fa-spinner fa-spin"></i><strong>Loading MyInstants…</strong></div>';
    const params = new URLSearchParams({type:catalogType, page:String(catalogPage)});
    if (catalogType === "search") params.set("q", searchInput.value.trim());
    try {
      const response = await fetch("/api/sounds/browse?" + params.toString(), {cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Browse unavailable.");
      const items = (data.sounds || []).map(normalizeCatalog);
      catalogTotalPages = data.totalPages || null;
      count.textContent = items.length + " catalog sounds · MyInstants";
      renderSounds(items);
      pagination.hidden = false;
      pageLabel.textContent = "Page " + catalogPage + (catalogTotalPages ? " of " + catalogTotalPages : "");
      previousPage.disabled = catalogPage <= 1;
      nextPage.disabled = !data.hasNext && catalogTotalPages !== null;
    } catch (error) {
      list.innerHTML = '<div class="soundboard-empty"><strong>Browse unavailable</strong><span>' + escapeHtml(error.message) + '</span></div>';
    }
  }
  function renderSounds(items) {
    const previous = sounds;
    sounds = items;
    render();
    sounds = previous;
  }
  async function loadFavoritesView() {
    if (!currentUser) {
      list.innerHTML = '<div class="soundboard-empty"><strong>Log in to use Favorites</strong><span>Saved sounds are linked to your Lunar account.</span></div>';
      return;
    }
    await loadFavorites();
    const local = sounds.filter(item => favorites.has("community:" + item.id));
    const externalIds = [...favorites].filter(id => id.startsWith("myinstants:"));
    const external = externalIds.map(id => externalSounds.find(item => item.favoriteKey === id)).filter(Boolean);
    count.textContent = (local.length + external.length) + " saved sounds";
    renderSounds([...local, ...external]);
  }
  async function switchView(view) {
    currentView = view;
    document.querySelectorAll("[data-view]").forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    browseTools.hidden = view !== "browse";
    pagination.hidden = view !== "browse";
    document.getElementById("soundboard-refresh").hidden = view === "favorites";
    viewTitle.textContent = view === "community" ? "Community sounds" : view === "browse" ? "Browse MyInstants" : "Favorite sounds";
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
  searchForm?.addEventListener("submit", event => { event.preventDefault(); if (!searchInput.value.trim()) return; catalogType = "search"; catalogPage = 1; document.querySelectorAll("[data-catalog]").forEach(button => button.classList.remove("active")); loadBrowse(); });
  document.querySelectorAll("[data-catalog]").forEach(button => button.addEventListener("click", () => { catalogType = button.dataset.catalog; catalogPage = 1; document.querySelectorAll("[data-catalog]").forEach(item => item.classList.toggle("active", item === button)); searchInput.value = ""; loadBrowse(); }));
  previousPage?.addEventListener("click", () => { if (catalogPage > 1) { catalogPage--; loadBrowse(); } });
  nextPage?.addEventListener("click", () => { if (catalogPage < 500 && (catalogTotalPages === null || catalogPage < catalogTotalPages)) { catalogPage++; loadBrowse(); } });
  loadUser().then(async () => { await loadFavorites(); await loadSounds(); });
})();
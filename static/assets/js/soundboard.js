(() => {
  const list = document.getElementById("soundboard-list");
  const viewTitle = document.getElementById("soundboard-view-title");
  const loadStatus = document.getElementById("soundboard-load-status");
  const searchForm = document.getElementById("soundboard-search-form");
  const searchInput = document.getElementById("soundboard-search");
  const count = document.getElementById("soundboard-count");
  const form = document.getElementById("sound-upload-form");
  const fileInput = document.getElementById("sound-file");
  const fileLabel = document.getElementById("sound-file-label");
  const titleInput = document.getElementById("sound-title");
  const uploadButton = document.getElementById("sound-upload-button");
  const editor = document.getElementById("sound-editor");
  const originalPreview = document.getElementById("sound-original-preview");
  const editedPreview = document.getElementById("sound-edited-preview");
  const selectionStart = document.getElementById("sound-selection-start");
  const selectionEnd = document.getElementById("sound-selection-end");
  let decodedUpload = null, uploadObjectUrl = "", editedObjectUrl = "";
  let clipStart = 0, clipEnd = 0;
  const status = document.getElementById("sound-upload-status");
  if (!list || !form) return;

  const players = new Map();
  let sounds = [];
  let currentUser = null;
  let currentView = "community";
  let favorites = new Set();

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
        ((sound.downloadUrl || sound.audioUrl) ? '<a class="soundboard-download" href="' + escapeHtml(sound.downloadUrl || sound.audioUrl) + '" download="' + escapeHtml((sound.title || 'sound').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase()) + '.' + escapeHtml((String(sound.downloadUrl || sound.audioUrl).split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] || (sound.license === 'Original · Lunar' ? 'wav' : 'mp3')).toLowerCase()) + '" title="Download sound"><i class="fa-solid fa-download"></i> Download</a>' : '') + (canDelete ? '<button type="button" class="soundboard-delete" data-delete="' + escapeHtml(sound.id) + '" title="Delete your sound"><i class="fa-solid fa-trash"></i></button>' : '') +
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
      const combined = local;
      count.textContent = combined.length + " saved sounds";
      if (combined.length) renderSounds(combined);
      else list.innerHTML = '<div class="soundboard-empty"><strong>No favorites yet</strong><span>Tap the heart on a sound to save it here.</span></div>';
    } catch (error) {
      list.innerHTML = '<div class="soundboard-empty"><strong>Favorites unavailable</strong><span>' + escapeHtml(error.message) + '</span></div>';
    }
  }

  async function switchView(view) {
    currentView = view === "favorites" ? "favorites" : "community";
    document.querySelectorAll("[data-view]").forEach(button => {
      const active = button.dataset.view === currentView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.getElementById("soundboard-refresh").hidden = currentView === "favorites";
    viewTitle.textContent = currentView === "community" ? "Community sounds" : "Favorite sounds";
    if (currentView === "community") await loadSounds();
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

  function updateEditor() {
    if (!decodedUpload) return;
    clipStart = Number(selectionStart.value);
    clipEnd = Number(selectionEnd.value);
    document.getElementById("sound-selection-start-label").textContent = formatTime(clipStart);
    document.getElementById("sound-selection-end-label").textContent = formatTime(clipEnd);
    document.getElementById("sound-clip-range").textContent = formatTime(clipStart) + " – " + formatTime(clipEnd);
    document.getElementById("sound-cut-duration").textContent = formatTime(Math.max(0, clipEnd - clipStart));
  }
  function resetEditor() {
    decodedUpload = null; clipStart = 0; clipEnd = 0;
    if (uploadObjectUrl) URL.revokeObjectURL(uploadObjectUrl);
    if (editedObjectUrl) URL.revokeObjectURL(editedObjectUrl);
    uploadObjectUrl = ""; editedObjectUrl = "";
    originalPreview.removeAttribute("src"); originalPreview.load();
    editedPreview.hidden = true; editedPreview.removeAttribute("src"); editedPreview.load();
    editor.hidden = true;
  }
  fileInput.addEventListener("change", async () => {
    fileLabel.textContent = fileInput.files?.[0]?.name || "Choose an audio file";
    resetEditor();
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!audioMime(file)) { setStatus("Choose a supported audio file. MP4 videos are not supported.", "error"); return; }
    try {
      setStatus("Preparing audio preview…");
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Audio editing is not supported by this browser.");
      const context = new AudioContextClass();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      await context.close();
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error("This audio file could not be decoded.");
      decodedUpload = buffer; clipStart = 0; clipEnd = buffer.duration;
      selectionStart.max = String(buffer.duration); selectionEnd.max = String(buffer.duration);
      selectionStart.value = "0"; selectionEnd.value = String(buffer.duration);
      document.getElementById("sound-editor-duration").textContent = formatTime(buffer.duration);
      uploadObjectUrl = URL.createObjectURL(file); originalPreview.src = uploadObjectUrl;
      editor.hidden = false; updateEditor();
      setStatus("Audio ready. Preview and edit your clip before uploading.", "success");
    } catch (error) { resetEditor(); setStatus(error.message || "Could not prepare this audio file.", "error"); }
  });
  selectionStart?.addEventListener("input", () => {
    if (Number(selectionStart.value) >= Number(selectionEnd.value)) {
      selectionStart.value = String(Math.max(0, Number(selectionEnd.value) - 0.05));
    }
    editedPreview.hidden = true;
    updateEditor();
  });
  selectionEnd?.addEventListener("input", () => {
    if (Number(selectionEnd.value) <= Number(selectionStart.value)) {
      selectionEnd.value = String(Math.min(decodedUpload.duration, Number(selectionStart.value) + 0.05));
    }
    editedPreview.hidden = true;
    updateEditor();
  });
  document.getElementById("sound-reset-edits")?.addEventListener("click", () => {
    if (!decodedUpload) return;
    clipStart = 0;
    clipEnd = decodedUpload.duration;
    selectionStart.value = "0";
    selectionEnd.value = String(decodedUpload.duration);
    editedPreview.hidden = true;
    updateEditor();
    setStatus("Selection reset to the full audio.", "success");
  });
  function makeEditedWav() {
    const buffer = decodedUpload, rate = buffer.sampleRate;
    const from = Math.max(0, Math.floor(clipStart * rate));
    const to = Math.min(buffer.length, Math.floor(clipEnd * rate));
    const frames = to - from;
    if (frames <= 0) throw new Error("Choose a valid section of audio.");
    const channels = Math.min(2, buffer.numberOfChannels);
    const bytes = new ArrayBuffer(44 + frames * channels * 2);
    const view = new DataView(bytes);
    const write = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    write(0, "RIFF"); view.setUint32(4, 36 + frames * channels * 2, true); write(8, "WAVE"); write(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * channels * 2, true);
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, frames * channels * 2, true);
    for (let frame = 0; frame < frames; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = buffer.getChannelData(channel)[from + frame] || 0;
        view.setInt16(44 + (frame * channels + channel) * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
      }
    }
    return {blob: new Blob([bytes], {type: "audio/wav"}), duration: frames / rate};
  }
  document.getElementById("sound-preview-edited")?.addEventListener("click", () => {
    try {
      const result = makeEditedWav();
      if (editedObjectUrl) URL.revokeObjectURL(editedObjectUrl);
      editedObjectUrl = URL.createObjectURL(result.blob);
      editedPreview.src = editedObjectUrl; editedPreview.hidden = false; editedPreview.load();
      editedPreview.play().catch(() => {});
      setStatus("Previewing your edited clip.", "success");
    } catch (error) { setStatus(error.message, "error"); }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const file = fileInput.files?.[0];
    const title = titleInput.value.trim();
    if (!file || !title) { setStatus("Add a title and choose an audio file.", "error"); return; }
    const contentType = audioMime(file);
    if (!contentType) { setStatus("Choose an audio file. MP4 videos are not supported.", "error"); return; }
    if (file.size > 12 * 1024 * 1024) { setStatus("Audio files must be 12 MB or smaller.", "error"); return; }
    if (!decodedUpload) { setStatus("Wait for the audio preview and editor to finish loading.", "error"); return; }
    uploadButton.disabled = true;
    setStatus("Checking audio duration…");
    try {
      const edited = makeEditedWav();
      if (!Number.isFinite(edited.duration) || edited.duration <= 0 || edited.duration > 60) throw new Error("The final edited clip must be no longer than 1 minute.");
      if (edited.blob.size > 12 * 1024 * 1024) throw new Error("The edited audio is larger than 12 MB. Shorten the clip and try again.");
      setStatus("Uploading edited clip…");
      const response = await fetch("/api/sounds/upload", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "audio/wav", "X-Sound-Title": title, "X-Sound-Duration": String(edited.duration) },
        body: edited.blob,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      form.reset();
      fileLabel.textContent = "Choose an audio file";
      resetEditor();
      await loadSounds();
      setStatus("Your sound was uploaded and added to the community soundboard.", "success");
    } catch (error) { setStatus(error.message, "error"); }
    finally { uploadButton.disabled = false; }
  });
  document.getElementById("soundboard-refresh")?.addEventListener("click", () => switchView(currentView));
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  loadUser().then(async () => { await loadFavorites(); await loadSounds(); });
})();
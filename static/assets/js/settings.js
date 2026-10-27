document.addEventListener("DOMContentLoaded", () => {
  const adTypeElement = document.getElementById("adType");
  if (adTypeElement) {
    adTypeElement.addEventListener("change", function () {
      store.set("ads", this.value === "default" ? "on" : this.value);
    });
    const storedAd = store.get("ads");
    adTypeElement.value = storedAd === "popups" || storedAd === "off" ? storedAd : "default";
  }

  const transportRow = document.getElementById("transport-row");
  const pChangeElement = document.getElementById("pChange");
  if (pChangeElement) {
    pChangeElement.addEventListener("change", function () {
      store.set("proxy", this.value);
      if (transportRow) transportRow.style.display = this.value === "sj" ? "" : "none";
    });
    pChangeElement.value = store.get("proxy") || "sj";
  }

  const transportElement = document.getElementById("transport-dropdown");
  if (transportElement) {
    transportElement.value = store.get("transport") === "libcurl" ? "libcurl" : "epoxy";
    transportElement.addEventListener("change", function () {
      store.set("transport", this.value);
      window.location.reload();
    });
    if (transportRow) transportRow.style.display = (store.get("proxy") || "sj") === "sj" ? "" : "none";
  }

  const wispInput = document.getElementById("wisp-input");
  const wispSaveBtn = document.getElementById("wisp-save-btn");
  if (wispInput && wispSaveBtn) {
    wispInput.value = store.get("wisp-url") || "";
    wispSaveBtn.addEventListener("click", () => {
      const val = wispInput.value.trim();
      if (val === "") {
        store.remove("wisp-url");
      } else if (/^wss?:\/\//i.test(val)) {
        store.set("wisp-url", val);
      } else {
        alert("Enter a valid Wisp URL starting with ws:// or wss://");
        return;
      }
      window.location.reload();
    });
  }

  const eventKeyInput = document.getElementById("eventKeyInput");
  const linkInput = document.getElementById("linkInput");

  let eventKey = JSON.parse(store.get("eventKey")) || ["`"];
  const eventKeyRaw = store.get("eventKeyRaw") || "`";
  let pLink = store.get("pLink") || "https://classroom.google.com/";

  eventKeyInput.value = eventKeyRaw;
  linkInput.value = pLink;

  eventKeyInput.addEventListener("input", () => {
    eventKey = eventKeyInput.value.split(",");
  });
  linkInput.addEventListener("input", () => {
    pLink = linkInput.value;
  });

  const cloakDropdown = document.getElementById("cloak-dropdown");

  const sortedOptions = Array.from(cloakDropdown.getElementsByTagName("option")).sort((a, b) => a.textContent.localeCompare(b.textContent));
  while (cloakDropdown.firstChild) cloakDropdown.removeChild(cloakDropdown.firstChild);
  for (const option of sortedOptions) cloakDropdown.appendChild(option);

  cloakDropdown.value = store.get("selectedOption") || "Classroom";
  cloakDropdown.addEventListener("change", () => handleDropdownChange(cloakDropdown));

  document.getElementById("cloak-save-btn").addEventListener("click", () => {
    saveCustomCloak();
    redirectToMainDomain();
  });
  document.getElementById("cloak-reset-btn").addEventListener("click", () => {
    resetCustomCloak();
    redirectToMainDomain();
  });

  document.getElementById("custom-cloak-name").value = store.get("CustomName") || "";
  document.getElementById("custom-cloak-icon").value = store.get("CustomIcon") || "";

  if (store.get("ab") === "true") {
    document.getElementById("ab-settings-switch").checked = true;
  }

  // Themes
  const themeDropdown = document.getElementById("theme-dropdown");
  themeDropdown.value = store.get("theme") || "d";
  themeDropdown.addEventListener("change", function () {
    themeChange(this);
  });

  // Background image upload + image-only opacity/blur controls.
  const bgDropdown = document.getElementById("background-dropdown");
  const bgCustomRow = document.getElementById("background-custom-row");
  const bgFile = document.getElementById("background-file-input");
  const bgFileLabel = document.getElementById("background-file-label-text");
  const bgStatus = document.getElementById("background-upload-status");
  const bgControls = document.getElementById("background-image-controls");
  const bgOpacity = document.getElementById("background-opacity-range");
  const bgOpacityValue = document.getElementById("background-opacity-value");
  const bgBlur = document.getElementById("background-blur-range");
  const bgBlurValue = document.getElementById("background-blur-value");
  const bgClear = document.getElementById("background-clear-button");
  const bgSavedButton = document.getElementById("background-saved-button");
  const bgSavedPanel = document.getElementById("background-saved-panel");
  const bgSavedGrid = document.getElementById("background-saved-grid");
  const bgSavedStatus = document.getElementById("background-saved-status");

  const DEFAULT_BACKGROUND_URL = "https://cdn.discordapp.com/attachments/1552677976980590602/1554634440548950047/1536061.jpg?backend=b2&ex=6abd99a6&is=6abc4826&hm=9d440db406ac0f9344d92d072419f6b7a&";
  const ORIGINAL_BACKGROUND_URL = "/assets/media/background/full-main.png";

  const readSavedBackgrounds = () => {
    try {
      const parsed = JSON.parse(store.get("savedBackgrounds") || "[]");
      return Array.isArray(parsed)
        ? parsed.filter(item =>
            item &&
            item.url &&
            item.url !== "none" &&
            item.url !== DEFAULT_BACKGROUND_URL &&
            item.url !== ORIGINAL_BACKGROUND_URL &&
            !item.isDefault
          )
        : [];
    } catch {
      return [];
    }
  };

  const writeSavedBackgrounds = items => {
    store.set("savedBackgrounds", JSON.stringify(items.filter(item =>
      item &&
      item.url &&
      item.url !== "none" &&
      item.url !== DEFAULT_BACKGROUND_URL &&
      item.url !== ORIGINAL_BACKGROUND_URL &&
      !item.isDefault
    )));
  };

  const rememberBackground = (url, name) => {
    if (!url || url === "none" || url === DEFAULT_BACKGROUND_URL || url === ORIGINAL_BACKGROUND_URL) return;
    const current = readSavedBackgrounds();
    if (current.some(item => item.url === url)) return;
    writeSavedBackgrounds([
      { id: Date.now().toString(36), name: name || "Saved background", url, isDefault: false },
      ...current
    ]);
  };

  const deleteSavedBackground = async item => {
    if (!item?.url) return;
    const next = readSavedBackgrounds().filter(saved => saved.id !== item.id && saved.url !== item.url);
    writeSavedBackgrounds(next);
    const currentUrl = store.get("backgroundImage");
    if (currentUrl === item.url) {
      store.set("backgroundImage", "none");
      store.set("backgroundMode", "none");
      if (typeof store.flushAccountSettings === "function") await store.flushAccountSettings();
      if (bgStatus) bgStatus.textContent = "Active background deleted.";
      window.location.reload();
      return;
    }
    if (typeof store.flushAccountSettings === "function") await store.flushAccountSettings();
    renderSavedBackgrounds();
  };

  const applySavedBackground = async item => {
    if (!item || !item.url || item.url === "none" || item.isDefault) return;
    store.set("backgroundImage", item.url);
    store.set("backgroundMode", "custom");
    if (bgDropdown) bgDropdown.value = "custom";
    if (bgStatus) bgStatus.textContent = "Saved background selected.";
    if (typeof store.flushAccountSettings === "function") await store.flushAccountSettings();
    window.location.reload();
  };

  const renderSavedBackgrounds = () => {
    if (!bgSavedGrid) return;
    const items = readSavedBackgrounds();
    bgSavedGrid.innerHTML = "";
    if (!items.length) {
      bgSavedGrid.innerHTML = '<div class="background-saved-empty">No saved backgrounds yet. Apply a custom image and it will appear here.</div>';
      if (bgSavedStatus) bgSavedStatus.textContent = "Only custom backgrounds are saved.";
      return;
    }
    items.forEach(item => {
      const card = document.createElement("div");
      card.className = "background-saved-card";
      const preview = document.createElement("button");
      preview.type = "button";
      preview.className = "background-saved-preview";
      preview.style.backgroundImage = 'url("' + String(item.url).replace(/"/g, '\\\"') + '")';
      preview.title = "Use " + (item.name || "saved background");
      preview.addEventListener("click", () => applySavedBackground(item));
      const meta = document.createElement("div");
      meta.className = "background-saved-meta";
      const title = document.createElement("strong");
      title.textContent = item.name || "Saved background";
      const actions = document.createElement("div");
      actions.className = "background-saved-actions";
      const use = document.createElement("button");
      use.type = "button";
      use.className = "key-button background-saved-use";
      use.textContent = "Use";
      use.addEventListener("click", () => applySavedBackground(item));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "key-button background-saved-delete";
      remove.setAttribute("aria-label", "Delete " + (item.name || "saved background"));
      remove.title = "Delete";
      remove.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
      remove.addEventListener("click", () => deleteSavedBackground(item));
      actions.append(use, remove);
      meta.append(title, actions);
      card.append(preview, meta);
      bgSavedGrid.appendChild(card);
    });
    if (bgSavedStatus) bgSavedStatus.textContent = items.length + " saved background" + (items.length === 1 ? "" : "s");
  };

  const bgSavedClose = document.getElementById("background-saved-close");

  bgSavedButton && bgSavedButton.addEventListener("click", () => {
    const open = bgSavedPanel.classList.toggle("is-open");
    bgSavedPanel.setAttribute("aria-hidden", String(!open));
    if (open) renderSavedBackgrounds();
  });

  bgSavedClose && bgSavedClose.addEventListener("click", () => {
    bgSavedPanel?.classList.remove("is-open");
    bgSavedPanel?.setAttribute("aria-hidden", "true");
  });


  const savedBg = store.get("backgroundImage");
  const savedBgMode = store.get("backgroundMode") || "default";
  const savedBgOpacity = Number(store.get("backgroundImageOpacity") || 100);
  const savedBgBlur = Number(store.get("backgroundImageBlur") || 0);

  if (bgDropdown) bgDropdown.value = savedBgMode;
  if (bgOpacity) bgOpacity.value = String(savedBgOpacity);
  if (bgBlur) bgBlur.value = String(savedBgBlur);
  if (bgOpacityValue) bgOpacityValue.textContent = savedBgOpacity + "%";
  if (bgBlurValue) bgBlurValue.textContent = savedBgBlur + "px";

  const syncBackgroundControls = () => {
    const custom = (bgDropdown?.value === "custom") && Boolean(store.get("backgroundImage"));
    if (bgCustomRow) bgCustomRow.style.display = bgDropdown?.value === "custom" ? "" : "none";
    if (bgControls) bgControls.style.display = custom ? "" : "none";
  };

  if (savedBgMode === "custom" && savedBg) {
    rememberBackground(savedBg, "Current background");
    syncBackgroundControls();
  }

  bgDropdown?.addEventListener("change", function () {
    const mode = this.value;
    store.set("backgroundMode", mode);
    if (mode === "default") {
      store.set("backgroundImage", "https://cdn.discordapp.com/attachments/1552677976980590602/1554634440548950047/1536061.jpg?backend=b2&ex=6abd99a6&is=6abc4826&hm=9d440db406ac0f9344d92d072419f6b7a&");
      store.set("backgroundImageOpacity", "100");
      store.set("backgroundImageBlur", "0");
      (async () => {
        if (typeof store.flushAccountSettings === "function") await store.flushAccountSettings();
        window.location.reload();
      })();
    } else if (mode === "original") {
      store.set("backgroundImage", "/assets/media/background/full-main.png");
      store.set("backgroundImageOpacity", "100");
      store.set("backgroundImageBlur", "0");
      syncBackgroundControls();
      (async () => {
        if (typeof store.flushAccountSettings === "function") await store.flushAccountSettings();
        window.location.reload();
      })();
    } else if (mode === "none") {
      store.set("backgroundImage", "none");
      syncBackgroundControls();
      document.body.style.backgroundImage = "none";
      document.getElementById("lunar-background-image")?.remove();
      (async () => {
        if (typeof store.flushAccountSettings === "function") await store.flushAccountSettings();
        window.location.reload();
      })();
    } else {
      syncBackgroundControls();
    }
  });

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxWidth = 2400;
          const maxHeight = 1600;
          const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          let quality = 0.82;
          let data = canvas.toDataURL("image/jpeg", quality);
          while (data.length > 1900000 && quality > 0.5) {
            quality -= 0.06;
            data = canvas.toDataURL("image/jpeg", quality);
          }
          if (data.length > 2000000) return reject(new Error("That image is too large after compression. Choose a smaller image."));
          resolve(data);
        };
        image.onerror = () => reject(new Error("That image could not be read."));
        image.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Could not read the image."));
      reader.readAsDataURL(file);
    });
  }

  bgFile?.addEventListener("change", () => {
    const file = bgFile.files?.[0];
    if (file) {
      bgFileLabel.textContent = file.name;
      bgStatus.textContent = "Ready to apply · " + Math.round(file.size / 1024) + " KB";
    }
  });

  document.getElementById("save-button")?.addEventListener("click", async () => {
    const file = bgFile?.files?.[0];
    if (!file) {
      bgStatus.textContent = "Choose an image first.";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      bgStatus.textContent = "That image is larger than 8 MB.";
      return;
    }
    try {
      bgStatus.textContent = "Preparing image…";
      const data = await readImage(file);
      let backgroundValue = data;

      // Logged-in users get a server-backed copy, so the background survives
      // account switching and device changes. Guests keep a compressed local copy.
      try {
        const response = await fetch("/api/chat/uploads", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "image", data }),
        });
        if (response.ok) {
          const result = await response.json();
          if (result.url) backgroundValue = result.url;
        }
      } catch {}

      rememberBackground(backgroundValue, file.name);
      store.set("backgroundImage", backgroundValue);
      store.set("backgroundMode", "custom");
      if (bgDropdown) bgDropdown.value = "custom";
      bgStatus.textContent = backgroundValue.startsWith("/uploads/") ? "Saved to your account." : "Saved on this browser.";
      syncBackgroundControls();
      if (typeof store.flushAccountSettings === "function") {
        await store.flushAccountSettings();
      }
      window.location.reload();
    } catch (error) {
      bgStatus.textContent = error.message || "Could not apply image.";
    }
  });

  bgClear?.addEventListener("click", () => {
    store.remove("backgroundImage");
    store.set("backgroundMode", "none");
    if (bgDropdown) bgDropdown.value = "none";
    if (bgFile) bgFile.value = "";
    if (bgFileLabel) bgFileLabel.textContent = "Choose background image";
    if (bgStatus) bgStatus.textContent = "Background image cleared.";
    syncBackgroundControls();
    document.getElementById("lunar-background-image")?.remove();
    (async () => {
      if (typeof store.flushAccountSettings === "function") {
        await store.flushAccountSettings();
      }
      window.location.reload();
    })();
  });

  bgOpacity?.addEventListener("input", () => {
    store.set("backgroundImageOpacity", bgOpacity.value);
    if (bgOpacityValue) bgOpacityValue.textContent = bgOpacity.value + "%";
    document.documentElement.style.setProperty("--lunar-background-opacity", String(Number(bgOpacity.value) / 100));
  });
  bgBlur?.addEventListener("input", () => {
    store.set("backgroundImageBlur", bgBlur.value);
    if (bgBlurValue) bgBlurValue.textContent = bgBlur.value + "px";
    document.documentElement.style.setProperty("--lunar-background-blur", bgBlur.value + "px");
  });
  document.documentElement.style.setProperty("--lunar-background-opacity", String(savedBgOpacity / 100));
  document.documentElement.style.setProperty("--lunar-background-blur", savedBgBlur + "px");
  // Background Particles
  const particlesDropdown = document.getElementById("particles-dropdown");
  const savedParticles = store.get("particles") || "off";
  particlesDropdown.value = savedParticles === "true" ? "stars" : savedParticles;
  particlesDropdown.addEventListener("change", function () {
    store.set("particles", this.value);
    window.location.reload();
  });

  // Cursor Effects
  const pointerDropdown = document.getElementById("pointer-dropdown");
  pointerDropdown.value = store.get("pointer") || "default";
  pointerDropdown.addEventListener("change", async function () {
    const val = this.value;
    if (val === "default") {
      store.remove("pointer");
    } else {
      store.set("pointer", val);
    }
    // Commit the cursor choice before navigating so the next page cannot
    // restore an older account setting over the newly selected cursor.
    if (typeof store.flushAccountSettings === "function") {
      await store.flushAccountSettings();
    }
    window.location.reload();
  });

  document.getElementById("engine").addEventListener("change", function () {
    changeEngine(this);
  });
  document.getElementById("engine-save-btn").addEventListener("click", saveCustomEngine);

  const glassEffect = document.getElementById("glass-effect-dropdown");
  const glassStrength = document.getElementById("glass-strength-range");
  const glassStrengthValue = document.getElementById("glass-strength-value");
  const animations = document.getElementById("animations-dropdown");
  const visualEffects = document.getElementById("visual-effects-dropdown");
  const interfaceReset = document.getElementById("interface-reset-btn");

  if (glassEffect) {
    glassEffect.value = store.get("interfaceGlass") || "off";
    glassEffect.addEventListener("change", () => {
      store.set("interfaceGlass", glassEffect.value);
      document.body.classList.toggle("interface-glass", glassEffect.value === "on");
    });
    document.body.classList.toggle("interface-glass", glassEffect.value === "on");
  }

  if (glassStrength) {
    const saved = Number(store.get("interfaceGlassStrength") || 65);
    glassStrength.value = String(saved);
    if (glassStrengthValue) glassStrengthValue.textContent = saved + "%";
    glassStrength.addEventListener("input", () => {
      store.set("interfaceGlassStrength", glassStrength.value);
      if (glassStrengthValue) glassStrengthValue.textContent = glassStrength.value + "%";
      document.documentElement.style.setProperty("--interface-glass-alpha", String(0.18 + Number(glassStrength.value) / 180));
      document.documentElement.style.setProperty("--interface-glass-blur", Math.round(4 + Number(glassStrength.value) / 5) + "px");
    });
    document.documentElement.style.setProperty("--interface-glass-alpha", String(0.18 + saved / 180));
    document.documentElement.style.setProperty("--interface-glass-blur", Math.round(4 + saved / 5) + "px");
  }

  if (animations) {
    animations.value = store.get("interfaceAnimations") || "on";
    animations.addEventListener("change", async () => {
      store.set("interfaceAnimations", animations.value);
      document.body.classList.toggle("reduce-interface-motion", animations.value !== "on");
      document.documentElement.style.setProperty("--interface-motion-scale", animations.value === "off" ? "0" : animations.value === "reduced" ? "0.45" : "1");
      if (typeof store.flushAccountSettings === "function") {
        await store.flushAccountSettings();
      }
    });
    document.body.classList.toggle("reduce-interface-motion", animations.value !== "on");
    document.documentElement.style.setProperty("--interface-motion-scale", animations.value === "off" ? "0" : animations.value === "reduced" ? "0.45" : "1");
  }

  if (visualEffects) {
    // Visual effects are locked to Full for all users because disabling them
    // can hide required interface layers and cause a black screen.
    visualEffects.value = "full";
    visualEffects.disabled = true;
    store.set("interfaceEffects", "full");
    document.body.classList.remove("reduce-interface-effects", "disable-interface-effects");
    document.documentElement.style.setProperty("--interface-effects-opacity", "1");
  }

  if (interfaceReset) {
    interfaceReset.addEventListener("click", () => {
      store.remove("interfaceGlass");
      store.remove("interfaceGlassStrength");
      store.remove("interfaceAnimations");
      store.remove("interfaceEffects");
      window.location.reload();
    });
  }

  const savedEngineName = store.get("enginename");
  if (savedEngineName) document.getElementById("engine").value = savedEngineName;

  initLunarGlassDropdowns();
});

function saveEventKey() {
  const eventKeyInput = document.getElementById("eventKeyInput");
  const linkInput = document.getElementById("linkInput");
  const eventKey = eventKeyInput.value.split(",");
  const eventKeyRaw = eventKeyInput.value;
  const pLink = linkInput.value;
  store.set("eventKey", JSON.stringify(eventKey));
  store.set("eventKeyRaw", eventKeyRaw);
  store.set("pLink", pLink);
  // biome-ignore lint: idk
  window.location = window.location;
}

const cloakOptions = {
  Google: { name: "Google", icon: "/assets/media/favicon/google.png" },
  "Savvas Realize": { name: "Savvas Realize", icon: "/assets/media/favicon/savvas-realize.png" },
  SmartPass: { name: "SmartPass", icon: "/assets/media/favicon/smartpass.png" },
  "World Book Online - Super Home": { name: "Super Home Page", icon: "/assets/media/favicon/wbo.ico" },
  "World Book Online - Student": { name: "WBO Student | Home Page", icon: "/assets/media/favicon/wbo.ico" },
  "World Book Online - Timelines": { name: "Timelines - Home Page", icon: "/assets/media/favicon/wbo.ico" },
  Naviance: { name: "Naviance Student", icon: "/assets/media/favicon/naviance.png" },
  "PBS Learning Media": { name: "PBS LearningMedia | Teaching Resources For Students And Teachers", icon: "/assets/media/favicon/pbslearningmedia.ico" },
  "PBS Learning Media Student Home": { name: "Student Homepage | PBS LearningMedia", icon: "/assets/media/favicon/pbslearningmedia.ico" },
  Drive: { name: "My Drive - Google Drive", icon: "/assets/media/favicon/drive.png" },
  Classroom: { name: "Home", icon: "/assets/media/favicon/classroom.png" },
  Schoology: { name: "Home | Schoology", icon: "/assets/media/favicon/schoology.png" },
  Gmail: { name: "Gmail", icon: "/assets/media/favicon/gmail.png" },
  Clever: { name: "Clever | Portal", icon: "/assets/media/favicon/clever.png" },
  Khan: { name: "Dashboard | Khan Academy", icon: "/assets/media/favicon/khan.png" },
  Dictionary: { name: "Dictionary.com | Meanings & Definitions of English Words", icon: "/assets/media/favicon/dictionary.png" },
  Thesaurus: { name: "Synonyms and Antonyms of Words | Thesaurus.com", icon: "/assets/media/favicon/thesaurus.png" },
  Campus: { name: "Infinite Campus", icon: "/assets/media/favicon/campus.png" },
  IXL: { name: "IXL | Dashboard", icon: "/assets/media/favicon/ixl.png" },
  Canvas: { name: "Dashboard", icon: "/assets/media/favicon/canvas.png" },
  CodeHS: { name: "Sandbox | CodeHS", icon: "/assets/media/favicon/codehs.png" },
  LinkIt: { name: "Test Taker", icon: "/assets/media/favicon/linkit.ico" },
  Edpuzzle: { name: "Edpuzzle", icon: "/assets/media/favicon/edpuzzle.png" },
  "i-Ready Math": { name: "Math To Do, i-Ready", icon: "/assets/media/favicon/i-ready.ico" },
  "i-Ready Reading": { name: "Reading To Do, i-Ready", icon: "/assets/media/favicon/i-ready.ico" },
  "ClassLink Login": { name: "Login", icon: "/assets/media/favicon/classlink-login.png" },
  "Google Meet": { name: "Google Meet", icon: "/assets/media/favicon/google-meet.png" },
  "Google Docs": { name: "Google Docs", icon: "/assets/media/favicon/google-docs.ico" },
  "Google Slides": { name: "Google Slides", icon: "/assets/media/favicon/google-slides.ico" },
  Wikipedia: { name: "Wikipedia", icon: "/assets/media/favicon/wikipedia.png" },
  Britannica: { name: "Encyclopedia Britannica | Britannica", icon: "/assets/media/favicon/britannica.png" },
  Ducksters: { name: "Ducksters", icon: "/assets/media/favicon/ducksters.png" },
  Minga: { name: "Minga – Creating Amazing Schools", icon: "/assets/media/favicon/minga.png" },
  "i-Ready Learning Games": { name: "Learning Games, i-Ready", icon: "/assets/media/favicon/i-ready.ico" },
  "NoRedInk Home": { name: "Student Home | NoRedInk", icon: "/assets/media/favicon/noredink.png" },
  Desmos: { name: "Desmos | Graphing Calculator", icon: "/assets/media/favicon/desmos.ico" },
  "Newsela Binder": { name: "Newsela | Binder", icon: "/assets/media/favicon/newsela.png" },
  "Newsela Assignments": { name: "Newsela | Assignments", icon: "/assets/media/favicon/newsela.png" },
  "Newsela Home": { name: "Newsela | Instructional Content Platform", icon: "/assets/media/favicon/newsela.png" },
  "PowerSchool Sign In": { name: "Student and Parent Sign In", icon: "/assets/media/favicon/powerschool.png" },
  "PowerSchool Grades and Attendance": { name: "Grades and Attendance", icon: "/assets/media/favicon/powerschool.png" },
  "PowerSchool Teacher Comments": { name: "Teacher Comments", icon: "/assets/media/favicon/powerschool.png" },
  "PowerSchool Standards Grades": { name: "Standards Grades", icon: "/assets/media/favicon/powerschool.png" },
  "PowerSchool Attendance": { name: "Attendance", icon: "/assets/media/favicon/powerschool.png" },
  Nearpod: { name: "Nearpod", icon: "/assets/media/favicon/nearpod.png" },
  StudentVUE: { name: "StudentVUE", icon: "/assets/media/favicon/studentvue.ico" },
  "Quizlet Home": { name: "Flashcards, learning tools and textbook solutions | Quizlet", icon: "/assets/media/favicon/quizlet.webp" },
  "Google Forms Locked Mode": { name: "Start your quiz", icon: "/assets/media/favicon/googleforms.png" },
  DeltaMath: { name: "DeltaMath", icon: "/assets/media/favicon/deltamath.png" },
  Kami: { name: "Kami", icon: "/assets/media/favicon/kami.png" },
  "GoGuardian Admin Restricted": { name: "Restricted", icon: "/assets/media/favicon/goguardian-lock.png" },
  "GoGuardian Teacher Block": { name: "Uh oh!", icon: "/assets/media/favicon/goguardian.png" },
  "World History Encyclopedia": { name: "World History Encyclopedia", icon: "/assets/media/favicon/worldhistoryencyclopedia.png" },
  "Big Ideas Math Assignment Player": { name: "Assignment Player", icon: "/assets/media/favicon/bim.ico" },
  "Big Ideas Math": { name: "Big Ideas Math", icon: "/assets/media/favicon/bim.ico" },
};

function handleDropdownChange(selectElement) {
  const selectedValue = selectElement.value;
  const preset = cloakOptions[selectedValue];

  store.remove("CustomName");
  store.remove("CustomIcon");
  store.set("selectedOption", selectedValue);

  if (preset) {
    store.set("name", preset.name);
    store.set("icon", preset.icon);
    document.getElementById("t").textContent = preset.name;
    document.getElementById("tab-favicon").setAttribute("href", preset.icon);
  }

  redirectToMainDomain();
}

function saveCustomCloak() {
  const nameVal = document.getElementById("custom-cloak-name").value.trim();
  const iconVal = document.getElementById("custom-cloak-icon").value.trim();
  if (nameVal) {
    store.set("CustomName", nameVal);
    store.set("name", nameVal);
  }
  if (iconVal) {
    store.set("CustomIcon", iconVal);
    store.set("icon", iconVal);
  }
}

function resetCustomCloak() {
  store.remove("CustomName");
  store.remove("CustomIcon");
  document.getElementById("custom-cloak-name").value = "";
  document.getElementById("custom-cloak-icon").value = "";
}

function redirectToMainDomain() {
  const target = window.location.origin + window.location.pathname;
  if (window !== top) {
    try {
      top.location.href = target;
    } catch {
      try {
        parent.location.href = target;
      } catch {
        window.location.href = target;
      }
    }
  } else {
    window.location.href = target;
  }
}

function themeChange(selectElement) {
  const value = selectElement.value;
  if (value === "d") {
    store.remove("theme");
  } else {
    store.set("theme", value);
  }
  window.location.reload();
}

function AB() {
  let inFrame;
  try {
    inFrame = window !== top;
  } catch {
    inFrame = true;
  }

  if (inFrame) {
    alert("Please open the settings page directly (not inside a frame) to use the AB popup.");
    return;
  }
  if (navigator.userAgent.includes("Firefox")) {
    alert("AB cloak is not supported in Firefox.");
    return;
  }

  const popup = open("about:blank", "_blank");
  if (!popup || popup.closed) {
    alert("Window blocked. Please allow popups for this site.");
    return;
  }

  const name = store.get("name") || "My Drive - Google Drive";
  const icon = store.get("icon") || "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png";
  const panicLink = store.get("pLink") || getRandomURL();

  const doc = popup.document;
  const iframe = doc.createElement("iframe");
  const link = doc.createElement("link");
  doc.title = name;
  link.rel = "icon";
  link.href = icon;

  iframe.src = location.href;
  const style = iframe.style;
  style.position = "fixed";
  style.top = style.bottom = style.left = style.right = 0;
  style.border = style.outline = "none";
  style.width = style.height = "100%";

  doc.head.appendChild(link);
  doc.body.appendChild(iframe);

  location.replace(panicLink);
}

function toggleAB() {
  const ab = store.get("ab");
  store.set("ab", ab === "true" ? "false" : "true");
}

function changeEngine(dropdown) {
  const engineUrls = {
    Brave: "https://search.brave.com/search?q=",
    Google: "https://www.google.com/search?q=",
    Bing: "https://www.bing.com/search?q=",
    Qwant: "https://www.qwant.com/?q=",
    Startpage: "https://www.startpage.com/search?q=",
    SearchEncrypt: "https://www.searchencrypt.com/search/?q=",
    Ecosia: "https://www.ecosia.org/search?q=",
  };
  const selected = dropdown.value;
  store.set("engine", engineUrls[selected]);
  store.set("enginename", selected);
}

function saveCustomEngine() {
  const customEngine = document.getElementById("engine-form").value.trim();
  if (customEngine) {
    store.set("engine", customEngine);
    store.set("enginename", "Custom");
  } else {
    alert("Please enter a custom search engine value.");
  }
}

function exportSaveData() {
  const cookies = Object.fromEntries(
    document.cookie
      .split("; ")
      .filter(Boolean)
      .map(c => c.split("=")),
  );
  const localStorageData = Object.fromEntries(
    Object.keys(localStorage)
      .filter(k => Object.hasOwn(localStorage, k))
      .map(k => [k, localStorage.getItem(k)]),
  );
  const blob = new Blob([JSON.stringify({ cookies, localStorage: localStorageData }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "save_data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importSaveData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.cookies) {
          Object.entries(data.cookies).forEach(([key, value]) => {
            // biome-ignore lint/suspicious/noDocumentCookie: legacy cookie restore; CookieStore API lacks broad enough support for this use case
            document.cookie = `${key}=${value}; path=/`;
          });
        }
        if (data.localStorage) {
          Object.entries(data.localStorage).forEach(([key, value]) => {
            localStorage.setItem(key, value);
          });
          store.reload();
          if (typeof window.resolveProxyChoice === "function") {
            window.resolveProxyChoice();
          }
        }
        alert("Your save data has been imported. Please test it out.");
        alert("If you find any issues then report it in the LunarStudio Discord server!");
      } catch (error) {
        console.error("Error parsing JSON file:", error);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function getRandomURL() {
  const urls = [
    "https://kahoot.it",
    "https://classroom.google.com",
    "https://drive.google.com",
    "https://google.com",
    "https://docs.google.com",
    "https://slides.google.com",
    "https://www.nasa.gov",
    "https://blooket.com",
    "https://clever.com",
    "https://edpuzzle.com",
    "https://khanacademy.org",
    "https://wikipedia.org",
    "https://dictionary.com",
  ];
  return urls[Math.floor(Math.random() * urls.length)];
}

function initLunarGlassDropdowns() {
  document.querySelectorAll(".settings-card select").forEach(select => {
    if (select.dataset.lunarCustomized === "true") return;
    select.dataset.lunarCustomized = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "lunar-select";
    wrapper.dataset.for = select.id || "";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "lunar-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    const arrow = document.createElement("span");
    arrow.className = "lunar-select-arrow";
    arrow.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    trigger.append(label, arrow);

    const menu = document.createElement("div");
    menu.className = "lunar-select-menu";
    menu.setAttribute("role", "listbox");

    const sync = () => {
      const selected = select.options[select.selectedIndex];
      label.textContent = selected?.textContent?.trim() || "Select…";
      menu.querySelectorAll(".lunar-select-option").forEach(option => {
        const active = option.dataset.value === select.value;
        option.classList.toggle("is-selected", active);
        option.setAttribute("aria-selected", active ? "true" : "false");
      });
    };

    Array.from(select.children).forEach(node => {
      if (node.tagName === "OPTGROUP") {
        const group = document.createElement("div");
        group.className = "lunar-select-group";
        group.textContent = node.label;
        menu.appendChild(group);
        Array.from(node.children).forEach(option => addOption(option));
      } else if (node.tagName === "OPTION") {
        addOption(node);
      }
    });

    function addOption(option) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "lunar-select-option";
      item.dataset.value = option.value;
      item.textContent = option.textContent.trim();
      if (select.id === "theme-dropdown") {
        item.classList.add("theme-option");
        const swatch = document.createElement("span");
        swatch.className = "theme-swatch theme-" + option.value;
        const text = document.createElement("span");
        text.className = "theme-option-label";
        text.textContent = option.textContent.trim();
        item.textContent = "";
        item.append(swatch, text);
      }
      item.setAttribute("role", "option");
      item.addEventListener("click", event => {
        event.stopPropagation();
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
        close();
      });
      menu.appendChild(item);
    }

    function open() {
      document.querySelectorAll(".lunar-select.is-open").forEach(other => {
        if (other !== wrapper) other.classList.remove("is-open");
      });
      wrapper.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    }
    function close() {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", event => {
      event.stopPropagation();
      wrapper.classList.contains("is-open") ? close() : open();
    });
    select.addEventListener("change", sync);

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(trigger, menu, select);
    sync();

    trigger.addEventListener("keydown", event => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
        menu.querySelector(".lunar-select-option")?.focus();
      }
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".lunar-select.is-open").forEach(el => el.classList.remove("is-open"));
  });
}

const isGamesPage = window.location.pathname === "/games";
const isAppsPage = window.location.pathname === "/apps";

function getStorageKey(baseKey) {
  if (isGamesPage) return `G${baseKey}`;
  if (isAppsPage) return `A${baseKey}`;
  return baseKey;
}

// Kept out of the settings blob: these grow with whatever the user adds and are only read on
// the page that owns them.
function getFromStorage(baseKey) {
  return store.getRaw(getStorageKey(baseKey));
}

function setInStorage(baseKey, value) {
  store.setRaw(getStorageKey(baseKey), value);
}

function createSpanElements(text) {
  return text.split("").map(char => {
    const span = document.createElement("span");
    span.textContent = char;
    return span;
  });
}

function saveUrlToSession(url) {
  sessionStorage.setItem("GoUrl", url);
}

function handleAppClick(app) {
  if (app.say) {
    alert(app.say);
  }

  let selectedUrl = app.link;
  if (app.links && app.links.length > 1) {
    selectedUrl = promptUserForLink(app.links);
    if (!selectedUrl) return false;
  }

  const proxy = app.proxy;

  // Some Unity/WebGL games cannot be transported through UV/Scramjet. Open these
  // explicitly so their Unity loader can talk directly to the game's host.
  if (app.direct) {
    const directWindow = window.open(selectedUrl, "_blank", "noopener,noreferrer");
    if (!directWindow) {
      window.location.href = selectedUrl;
    }
    return false;
  }

  // isInTabMode is declared in main.js
  if (app.local) {
    saveUrlToSession(selectedUrl);
    window.location.href = isInTabMode ? selectedUrl : "tabs";
  } else if (app.local2) {
    saveUrlToSession(selectedUrl);
    window.location.href = selectedUrl;
  } else if (app.blank) {
    blank(selectedUrl, proxy);
  } else if (app.now) {
    blank(selectedUrl, proxy);
    if (isInTabMode) window.location.href = selectedUrl;
  } else if (app.custom) {
    createCustomApp();
  } else {
    go(selectedUrl, proxy);
    if (isInTabMode) blank(selectedUrl, proxy);
  }

  return false;
}

function promptUserForLink(links) {
  const options = links.map((link, index) => `${index + 1}: ${link.name}`).join("\n");

  const choice = prompt(`Select a link by entering the corresponding number:\n${options}`);
  const selectedIndex = parseInt(choice, 10) - 1;

  if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= links.length) {
    alert("Invalid selection. Please try again.");
    return null;
  }

  return links[selectedIndex].url;
}

function saveCustomApp(customApp) {
  let apps = getFromStorage("custom");

  if (!apps) {
    apps = {};
  } else {
    apps = JSON.parse(apps);
  }

  const key = `custom${Object.keys(apps).length + 1}`;
  apps[key] = customApp;

  setInStorage("custom", JSON.stringify(apps));
}

function promptRequired(message) {
  while (true) {
    const value = prompt(message);
    if (value === null) return null;
    if (value.trim() !== "") return value.trim();
    alert("This field is required. Please enter a value.");
  }
}

function createCustomApp() {
  const title = promptRequired("Enter title for the app:");
  if (!title) return;

  const link = promptRequired("Enter link for the app:");
  if (!link) return;
  const customApp = {
    name: `[Custom] ${title}`,
    link: link,
    image: "/assets/media/icons/custom.webp",
    custom: false,
  };

  saveCustomApp(customApp);

  const card = renderAppCard(customApp, 0, true);
  const pinnedContainer = document.querySelector(".pinned");
  pinnedContainer.appendChild(card);
}

function getAppStorageId(app, appIndex) {
  if (app?.link) return `url:${app.link}`;
  return `name:${String(app?.name || "app").toLowerCase()}`;
}

function getPinnedApps() {
  const raw = store.get(getStorageKey("pinned")) || "";
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw.split(",").map(Number).filter(Number.isFinite);
  }
}

function savePinnedApps(pins) {
  store.set(getStorageKey("pinned"), JSON.stringify([...new Set(pins)]));
}

function migrateLegacyPins(appsList) {
  const raw = store.get(getStorageKey("pinned")) || getFromStorage("pinned") || "";
  if (!raw || raw.trim().startsWith("[")) return;
  const oldIndexes = raw.split(",").map(Number).filter(Number.isFinite);
  const migrated = oldIndexes
    .filter(index => index >= 2)
    .map(index => appsList[index - 1])
    .filter(Boolean)
    .map((app, index) => getAppStorageId(app, index));
  savePinnedApps(migrated);
}

function togglePin(app, appIndex) {
  const pins = getPinnedApps();
  const appId = getAppStorageId(app, appIndex);
  const pinIndex = pins.indexOf(appId);
  const isCurrentlyPinned = pinIndex !== -1;

  if (isCurrentlyPinned) {
    pins.splice(pinIndex, 1);
  } else {
    pins.push(appId);
  }

  savePinnedApps(pins);

  const card = document.querySelector(`.column[data-app-id="${CSS.escape(appId)}"]`);
  if (card) {
    const pinButton = card.querySelector("button");
    if (pinButton) {
      pinButton.classList.toggle("is-pinned", !isCurrentlyPinned);
      pinButton.setAttribute("aria-pressed", String(!isCurrentlyPinned));
      pinButton.title = isCurrentlyPinned ? "Pin" : "Unpin";
    }
    const pinnedContainer = document.querySelector(".pinned");
    const nonPinnedContainer = document.querySelector(".apps");
    if (isCurrentlyPinned) {
      const unpinnedCards = Array.from(nonPinnedContainer.getElementsByClassName("column"));
      const cardName = card.getElementsByTagName("p")[0].textContent.toLowerCase();
      const insertBefore = unpinnedCards.find(c => c.getElementsByTagName("p")[0].textContent.toLowerCase() > cardName);
      nonPinnedContainer.insertBefore(card, insertBefore ?? null);
    } else {
      pinnedContainer.appendChild(card);
    }
  }
}

function isAppPinned(app, appIndex, pinnedList) {
  return pinnedList.includes(getAppStorageId(app, appIndex));
}

function createPinButton(app, appIndex) {
  const pinIcon = document.createElement("i");
  pinIcon.classList.add("fa", "fa-map-pin");
  pinIcon.ariaHidden = true;

  const button = document.createElement("button");
  button.appendChild(pinIcon);
  const initiallyPinned = getPinnedApps().includes(getAppStorageId(app, appIndex));
  button.style.cssText = `
    position:absolute;
    top:8px;
    right:8px;
    width:34px;
    height:34px;
    padding:0;
    margin:0;
    display:grid;
    place-items:center;
    cursor:pointer;
    background:rgba(8,10,15,.72);
    border:1px solid rgba(255,255,255,.10);
    border-radius:10px;
    color:white;
    z-index:4;
  `;
  button.classList.toggle("is-pinned", initiallyPinned);
  button.setAttribute("aria-pressed", String(initiallyPinned));
  button.title = initiallyPinned ? "Unpin" : "Pin";
  button.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    togglePin(app, appIndex);
  };

  return button;
}

function createGameThumbnail(app) {
  const category = app.hubCategory || (app.categories || []).find(value => value !== "all" && value !== "open-source") || "arcade";
  const palettes = {
    puzzle: ["#7c3aed", "#312e81", "🧩"],
    arcade: ["#ec4899", "#831843", "🕹️"],
    shooter: ["#ef4444", "#7f1d1d", "🎯"],
    racing: ["#f59e0b", "#78350f", "🏎️"],
    sports: ["#10b981", "#064e3b", "⚽"],
    platformer: ["#06b6d4", "#164e63", "🏃"],
    casual: ["#f472b6", "#831843", "🎈"],
    board: ["#64748b", "#1e293b", "♟️"],
    "word-quiz": ["#3b82f6", "#1e3a8a", "📝"],
    "3d": ["#8b5cf6", "#4c1d95", "🌐"],
    "open-source": ["#5865f2", "#20264f", "🎮"]
  };
  const palette = palettes[category] || palettes["open-source"];
  const title = String(app.name || "Game").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  })[character]);
  const shortTitle = title.length > 22 ? title.slice(0, 20) + "…" : title;
  const description = String(app.hubDescription || "Open-source browser game").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  })[character]).slice(0, 54);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="290" height="290" viewBox="0 0 290 290">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient>
      <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#fff" stroke-opacity=".08"/></pattern>
    </defs>
    <rect width="290" height="290" rx="24" fill="url(#bg)"/>
    <rect width="290" height="290" rx="24" fill="url(#grid)"/>
    <circle cx="230" cy="55" r="66" fill="#fff" fill-opacity=".08"/>
    <circle cx="44" cy="252" r="78" fill="#fff" fill-opacity=".06"/>
    <rect x="22" y="22" width="246" height="246" rx="18" fill="#080b18" fill-opacity=".18" stroke="#fff" stroke-opacity=".18"/>
    <text x="145" y="115" text-anchor="middle" font-size="66" font-family="Segoe UI Emoji, Apple Color Emoji, sans-serif">${palette[2]}</text>
    <text x="145" y="169" text-anchor="middle" font-size="${shortTitle.length > 15 ? 18 : 23}" font-weight="700" fill="#fff" font-family="Arial, sans-serif">${shortTitle}</text>
    <text x="145" y="197" text-anchor="middle" font-size="11" fill="#fff" fill-opacity=".8" font-family="Arial, sans-serif">${description}</text>
    <rect x="82" y="225" width="126" height="24" rx="12" fill="#fff" fill-opacity=".16"/>
    <text x="145" y="241" text-anchor="middle" font-size="10" letter-spacing="1.4" fill="#fff" font-family="Arial, sans-serif">OPEN SOURCE</text>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function renderAppCard(app, appIndex, isCustom = false) {
  const columnDiv = document.createElement("div");
  columnDiv.classList.add("column");

  const categories = isCustom ? "all" : (app.categories || []).join(" ");
  columnDiv.setAttribute("data-category", categories);
  const appId = getAppStorageId(app, appIndex);
  columnDiv.setAttribute("data-app-index", appIndex);
  columnDiv.setAttribute("data-app-id", appId);

  const link = document.createElement("a");
  link.onclick = () => handleAppClick(app);

  const image = document.createElement("img");
  image.width = 145;
  image.height = 145;
  image.loading = "lazy";

  if (app.image) {
    image.src = app.image;
  } else {
    image.src = createGameThumbnail(app);
  }

  const paragraph = document.createElement("p");
  for (const span of createSpanElements(app.name)) {
    paragraph.appendChild(span);
  }

  if (app.error) {
    paragraph.classList.add("launcher-status-error");
    paragraph.style.setProperty("color", "red", "important");
    app.say = app.say || "This app is currently not working.";
  } else if (app.load) {
    paragraph.classList.add("launcher-status-warning");
    paragraph.style.setProperty("color", "yellow", "important");
    app.say = app.say || "This app may experience excessive loading times.";
  } else if (app.partial) {
    paragraph.classList.add("launcher-status-warning");
    paragraph.style.setProperty("color", "yellow", "important");
    app.say = app.say || "This app is currently experiencing some issues, it may not work for you.";
  }

  link.appendChild(image);
  link.appendChild(paragraph);
  columnDiv.appendChild(link);

  if (!isCustom && appIndex !== 0) {
    columnDiv.appendChild(createPinButton(app, appIndex));
  }

  return columnDiv;
}

function getJsonPath() {
  if (isGamesPage) return "/assets/json/games.min.json?v=lunar9";
  if (isAppsPage) return "/assets/json/apps.min.json?v=lunar9";
  return "/assets/json/apps.min.json";
}

function applyAppFlags(app) {
  if (app.categories?.includes("local")) {
    app.local = true;
  }

  if (app.link && (app.link.includes("now.gg") || app.link.includes("nowgg.me"))) {
    if (app.partial === null || app.partial === undefined) {
      app.partial = true;
      app.say = "Now.gg is currently not working for some users.";
    }
  }

  if (app.link?.includes("nowgg.nl")) {
    if (app.error === null || app.error === undefined) {
      app.error = true;
      app.say = "NowGG.nl is currently down.";
    }
  }
}

// Replaced at build time with the per-build key. [0] is identity, so dev serves the plain
// dataset and the production payload arrives as an encoded string instead of an array.
const CATALOGUE_KEY = [0];

function decodeCatalogue(payload) {
  const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index) ^ CATALOGUE_KEY[index % CATALOGUE_KEY.length];
  return JSON.parse(new TextDecoder().decode(bytes));
}

function loadAppsFromJson() {
  const jsonPath = getJsonPath();

  fetch(jsonPath)
    .then(response => response.json())
    .then(data => (typeof data === "string" ? decodeCatalogue(data) : data))
    .then(appsList => {
      const nonPinnedContainer = document.querySelector(".apps");
      const pinnedContainer = document.querySelector(".pinned");
      const pinnedList = getPinnedApps();

      const appsContainer = document.getElementById("apps-container");
      if (appsContainer) {
        appsContainer.appendChild(pinnedContainer);
        appsContainer.appendChild(nonPinnedContainer);
      }

      const customCards = appsList.filter(app => app.custom === "true" || app.custom === true);
      const catalogCards = appsList.filter(app => !(app.custom === "true" || app.custom === true));

      catalogCards.sort((a, b) => a.name.localeCompare(b.name));
      appsList = [...customCards, ...catalogCards];

      migrateLegacyPins(appsList);
      const migratedPinnedList = getPinnedApps();

      let appIndex = 0;

      appsList.forEach(app => {
        applyAppFlags(app);

        const card = renderAppCard(app, appIndex);

        if (appIndex === 0 && (app.custom === "true" || app.custom === true)) {
          pinnedContainer.appendChild(card);
        } else if (migratedPinnedList != null && isAppPinned(app, appIndex, migratedPinnedList)) {
          pinnedContainer.appendChild(card);
        } else {
          nonPinnedContainer.appendChild(card);
        }

        appIndex++;
      });

      loadCustomAppsInline();
    })
    .catch(error => {
      console.error("Error fetching app data:", error);
    });
}

function loadCustomAppsInline() {
  const storedApps = getFromStorage("custom");

  if (storedApps) {
    const apps = JSON.parse(storedApps);

    const pinnedContainer = document.querySelector(".pinned");
    Object.values(apps).forEach(app => {
      const card = renderAppCard(app, 0, true);
      pinnedContainer.appendChild(card);
    });
  }
}

function applyFilters() {
  const searchTerm = (document.getElementById("search")?.value ?? "").toLowerCase();
  const selectedCategories = Array.from(document.querySelectorAll("#category option:checked")).map(option => option.value);

  Array.from(document.getElementsByClassName("column")).forEach(card => {
    const appName = card.getElementsByTagName("p")[0].textContent.toLowerCase();
    const categories = card.getAttribute("data-category").split(" ");

    const matchesSearch = !searchTerm || appName.includes(searchTerm);
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.some(cat => categories.includes(cat));

    card.style.display = matchesSearch && matchesCategory ? "block" : "none";
  });
}

function filterByCategory() {
  applyFilters();
}

function filterBySearchTerm() {
  applyFilters();
}

window.category = filterByCategory;
window.bar = filterBySearchTerm;

document.addEventListener("DOMContentLoaded", async () => {
  try { await store.loadAccountSettings?.(); } catch {}
  const accountKey = getStorageKey("pinned");
  if (!store.get(accountKey)) {
    const legacy = getFromStorage("pinned");
    if (legacy) { try { store.set(accountKey, JSON.stringify(JSON.parse(legacy))); store.removeRaw("pinned"); } catch {} }
  }
  loadAppsFromJson();
});

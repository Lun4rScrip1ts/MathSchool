import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, randomUUID } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";
import express from "express";
import { promises as fs } from "node:fs";
import fetch from "node-fetch";
import { mkdir, rename } from "node:fs/promises";

const scrypt = promisify(scryptCallback);
const router = express.Router();

const DATA_DIR = process.env.LUNAR_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DATA_FILE = path.join(DATA_DIR, "community.json");
const SESSION_DAYS = 365;
const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_CODE_ATTEMPTS = 5;
const PASSWORD_RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
const passwordResetCooldowns = new Map();
const MAX_MESSAGES = 500;
const MAX_MESSAGE_LENGTH = 500;
const MAX_USERS = 10000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_STICKERS = 100;
const MAX_PROFILE_ROLES = 12;
const PROFILE_ROLE_MAX = 32;
const ROLE_MANAGERS = new Set(["lunar", "lunarstudios"]);
const USERNAME_MAX = 20;
const DISPLAY_NAME_MAX = 20;
const MAX_REACTION_TEXT = 8;
const MAX_MOVIE_BYTES = 500 * 1024 * 1024;
const PUBLIC_MOVIE_UPLOADERS = new Set(["lunar", "lunarstudios"]);

let state = {
  users: {},
  sessions: {},
  messages: [],
  friendRequests: [],
  friendships: [],
  dmThreads: {},
  dmMessages: [],
  reports: [],
  movies: [],
  passwordResets: {},
  aiChats: {},
};
let writeQueue = Promise.resolve();

async function loadState() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state = {
        users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
        sessions: parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
        messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-MAX_MESSAGES) : [],
        friendRequests: Array.isArray(parsed.friendRequests) ? parsed.friendRequests : [],
        friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
        dmThreads: parsed.dmThreads && typeof parsed.dmThreads === "object" ? parsed.dmThreads : {},
        dmMessages: Array.isArray(parsed.dmMessages) ? parsed.dmMessages.slice(-5000) : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        movies: Array.isArray(parsed.movies) ? parsed.movies.slice(-500) : [],
        passwordResets: parsed.passwordResets && typeof parsed.passwordResets === "object" ? parsed.passwordResets : {},
        aiChats: parsed.aiChats && typeof parsed.aiChats === "object" ? parsed.aiChats : {},
      };
      state.friendships = normalizeFriendshipEntries(state.friendships, state.friendRequests);
      for (const user of Object.values(state.users)) {
        user.username = String(user.username || "").slice(0, USERNAME_MAX);
        user.displayName = String(user.displayName || user.username || "").slice(0, DISPLAY_NAME_MAX);
        user.email = String(user.email || "").toLowerCase();
        user.bannerUrl = String(user.bannerUrl || "");
        user.backgroundUrl = String(user.backgroundUrl || "");
        user.stickers = Array.isArray(user.stickers) ? user.stickers.slice(0, MAX_STICKERS) : [];
        user.gifFavorites = Array.isArray(user.gifFavorites) ? user.gifFavorites.slice(0, 200) : [];
        user.roles = Array.isArray(user.roles) ? user.roles.map(role => cleanText(role, PROFILE_ROLE_MAX)).filter(Boolean).slice(0, MAX_PROFILE_ROLES) : (user.username.toLowerCase() === "lunar" ? ["Owner"] : user.username.toLowerCase() === "lunarstudios" ? ["Co-Owner"] : []);
        user.blockedUsers = Array.isArray(user.blockedUsers) ? user.blockedUsers.slice(0, 500) : [];
        user.dmReadAt = user.dmReadAt && typeof user.dmReadAt === "object" ? user.dmReadAt : {};
        user.settings = user.settings && typeof user.settings === "object" ? user.settings : {};
      }
      for (const message of state.messages) {
        message.reactions = Array.isArray(message.reactions) ? message.reactions : [];
        if (state.users[message.userId]) message.roles = normalizeProfileRoles(state.users[message.userId]);
        message.attachments = Array.isArray(message.attachments) ? message.attachments : [];
        message.replyTo = message.replyTo && typeof message.replyTo === "object" ? message.replyTo : null;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("[Lunar Community] Could not read database:", error.message);
    await persist();
  }
}

async function persist() {
  const snapshot = JSON.stringify(state, null, 2);
  writeQueue = writeQueue.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const temp = DATA_FILE + ".tmp";
    await fs.writeFile(temp, snapshot, "utf8");
    await rename(temp, DATA_FILE);
  }).catch(error => console.error("[Lunar Community] Save failed:", error.message));
  return writeQueue;
}

function normalizeFriendshipEntries(entries, requests = []) {
  const normalized = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    let ids = null;
    if (typeof entry === "string") {
      ids = entry.split(":");
    } else if (entry && typeof entry === "object") {
      ids = Array.isArray(entry.userIds) ? entry.userIds
        : Array.isArray(entry.users) ? entry.users
        : [entry.userId1 || entry.userA || entry.fromUserId, entry.userId2 || entry.userB || entry.toUserId];
    }
    if (Array.isArray(ids) && ids.length >= 2 && ids[0] && ids[1] && ids[0] !== ids[1]) {
      const a = String(ids[0]);
      const b = String(ids[1]);
      if (state.users[a] && state.users[b]) normalized.add(friendshipKey(a, b));
    }
  }
  if (!normalized.size) {
    for (const request of Array.isArray(requests) ? requests : []) {
      if (request?.status !== "accepted") continue;
      const a = request.fromUserId;
      const b = request.toUserId;
      if (a && b && a !== b && state.users[a] && state.users[b]) normalized.add(friendshipKey(a, b));
    }
  }
  return [...normalized];
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validUsername(username) {
  return /^[a-zA-Z0-9_]{4,20}$/.test(username);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) && email.length <= 254;
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

function normalizeProfileRoles(user) {
  if (!Array.isArray(user.roles)) user.roles = user.username.toLowerCase() === "lunar" ? ["Owner"] : user.username.toLowerCase() === "lunarstudios" ? ["Co-Owner"] : [];
  user.roles = [...new Set(user.roles.map(role => cleanText(role, PROFILE_ROLE_MAX)).filter(Boolean))].slice(0, MAX_PROFILE_ROLES);
  return user.roles;
}

function canManageProfileRoles(user) {
  return Boolean(user && ROLE_MANAGERS.has(String(user.username || "").toLowerCase()));
}

function publicUser(user, includeEmail = true) {
  const result = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
    bannerUrl: user.bannerUrl || "",
    backgroundUrl: user.backgroundUrl || "",
    bio: user.bio || "",
    status: user.status || "",
    isOnline: isUserOnline(user.id),
    createdAt: user.createdAt,
    stickers: Array.isArray(user.stickers) ? user.stickers : [],
    isOwner: user.username.toLowerCase() === "lunar",
    roles: normalizeProfileRoles(user),
  };
  if (includeEmail) result.email = user.email || "";
  return result;
}

function getSessionUser(req) {
  const token = req.cookies?.lunar_session;
  if (!token) return null;
  const session = state.sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete state.sessions[token];
    return null;
  }
  const user = state.users[session.userId] || null;
  if (user?.kickedAt) {
    delete state.sessions[token];
    return null;
  }
  if (user) session.lastSeen = Date.now();
  return user;
}

function getOnlineMemberCount() {
  const cutoff = Date.now() - 2 * 60 * 1000;
  const online = new Set();
  for (const session of Object.values(state.sessions)) {
    if (session?.kind === "active" && session.lastSeen && session.lastSeen > cutoff && state.users[session.userId]) {
      online.add(session.userId);
    }
  }
  return online.size;
}

function requireUser(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "You need to log in first." });
  req.user = user;
  next();
}

function setSession(res, userId) {
  const token = randomBytes(32).toString("hex");
  const rememberedToken = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  state.sessions[token] = { userId, expiresAt, kind: "active", lastSeen: Date.now() };
  state.sessions[rememberedToken] = { userId, expiresAt, kind: "remembered" };
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
  res.cookie("lunar_session", token, cookieOptions);
  res.cookie("lunar_account_" + userId, rememberedToken, cookieOptions);
}
function getRememberedAccounts(req) {
  const result = [];
  for (const [name, token] of Object.entries(req.cookies || {})) {
    if (!name.startsWith("lunar_account_")) continue;
    const userId = name.slice("lunar_account_".length);
    const session = state.sessions[token];
    const user = state.users[userId];
    if (!session || session.kind !== "remembered" || !user || user.kickedAt || session.userId !== userId || Date.now() > session.expiresAt) continue;
    result.push({ id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl || "" });
  }
  return result;
}

function imageDataToFile(value) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) return null;
  const match = value.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error("Only PNG, JPG, WEBP, or GIF images are supported.");
  const extension = match[1].toLowerCase() === "jpeg" || match[1].toLowerCase() === "jpg" ? "jpg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("Images must be smaller than 8 MB.");
  return { extension, buffer };
}

async function saveImage(dataUrl, userId, kind) {
  if (!dataUrl) return "";
  const image = imageDataToFile(dataUrl);
  if (!image) throw new Error("Invalid image upload.");
  const filename = userId + "-" + kind + "-" + randomUUID() + "." + image.extension;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), image.buffer, { mode: 0o644 });
  return "/uploads/" + filename;
}

function uniqueUsername(username, exceptId = "") {
  const key = username.toLowerCase();
  return !Object.values(state.users).some(user => user.id !== exceptId && user.username.toLowerCase() === key);
}

function uniqueEmail(email, exceptId = "") {
  const key = email.toLowerCase();
  return !Object.values(state.users).some(user => user.id !== exceptId && user.email && user.email.toLowerCase() === key);
}

function updateMessagesForUser(user) {
  for (const message of state.messages) {
    if (message.userId === user.id) {
      message.username = user.username;
      message.displayName = user.displayName;
      message.avatarUrl = user.avatarUrl || "";
      message.roles = normalizeProfileRoles(user);
    }
    for (const reaction of message.reactions || []) {
      for (const reactor of reaction.users || []) {
        if (reactor.userId === user.id) reactor.username = user.username;
      }
    }
    if (message.replyTo?.userId === user.id) {
      message.replyTo.username = user.username;
      message.replyTo.displayName = user.displayName;
    }
  }
  for (const message of state.dmMessages) {
    if (message.senderId === user.id) message.sender = publicFriendUser(user);
  }
}

function findMessage(id) {
  return state.messages.find(message => message.id === id);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(derived).toString("hex") };
}

async function verifyPassword(password, record) {
  try {
    const derived = await scrypt(password, record.salt, 64);
    const expected = Buffer.from(record.hash, "hex");
    const actual = Buffer.from(derived);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}


function movieExtension(contentType) {
  const type = String(contentType || "").split(";")[0].toLowerCase();
  return type === "video/mp4" ? "mp4" : type === "video/webm" ? "webm" : type === "video/ogg" ? "ogv" : type === "video/quicktime" ? "mov" : type === "video/x-matroska" ? "mkv" : "";
}
function isPublicMovie(movie) {
  return PUBLIC_MOVIE_UPLOADERS.has(String(movie.username || "").toLowerCase());
}
function publicMovie(movie) {
  return { id: movie.id, title: movie.title, description: movie.description || "", category: movie.category || "Other", videoUrl: movie.videoUrl, posterUrl: movie.posterUrl || "", uploadedBy: movie.username || "Lunar", uploadedAt: movie.uploadedAt, size: movie.size, contentType: movie.contentType, ownerId: movie.ownerId, visibility: isPublicMovie(movie) ? "public" : "private" };
}
router.get("/movies", (req, res) => { const user = getSessionUser(req); res.set("Cache-Control", "no-store"); const visible = state.movies.filter(movie => isPublicMovie(movie) || (user && movie.ownerId === user.id)); res.json({ movies: visible.slice().reverse().map(publicMovie) }); });
router.post("/movies/upload", requireUser, express.raw({ type: req => /^video\//i.test(String(req.headers["content-type"] || "")), limit: "500mb" }), async (req, res) => {
  const contentType = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
  const extension = movieExtension(contentType);
  const buffer = Buffer.isBuffer(req.body) ? req.body : null;
  const title = cleanText(req.headers["x-movie-title"], 100);
  const description = cleanText(req.headers["x-movie-description"], 500);
  const category = cleanText(req.headers["x-movie-category"], 30) || "Other";
  if (!extension) return res.status(415).json({ error: "Use MP4, WebM, OGG, MOV, or MKV video." });
  if (!buffer?.length) return res.status(400).json({ error: "Choose a video first." });
  if (buffer.length > MAX_MOVIE_BYTES) return res.status(413).json({ error: "Videos must be 500 MB or smaller." });
  if (!title) return res.status(400).json({ error: "Give the video a title." });
  try {
    const id = randomUUID();
    const filename = "movie-" + id + "." + extension;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer, { mode: 0o644 });
    const movie = { id, ownerId: req.user.id, username: req.user.username, title, description, category, videoUrl: "/uploads/" + filename, posterUrl: "", uploadedAt: new Date().toISOString(), size: buffer.length, contentType, visibility: PUBLIC_MOVIE_UPLOADERS.has(req.user.username.toLowerCase()) ? "public" : "private" };
    state.movies.push(movie);
    if (state.movies.length > 500) state.movies.splice(0, state.movies.length - 500);
    await persist();
    res.status(201).json({ movie: publicMovie(movie) });
  } catch { res.status(500).json({ error: "The video could not be saved." }); }
});
router.post("/movies/:id/poster", requireUser, async (req, res) => {
  const movie = state.movies.find(item => item.id === req.params.id && item.ownerId === req.user.id);
  if (!movie) return res.status(404).json({ error: "Movie not found." });
  try { const poster = await saveImage(req.body?.data, req.user.id, "movie-poster"); if (!poster) return res.status(400).json({ error: "Choose a poster first." }); movie.posterUrl = poster; await persist(); res.json({ movie: publicMovie(movie) }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});
router.delete("/movies/:id", requireUser, async (req, res) => {
  const index = state.movies.findIndex(item => item.id === req.params.id && item.ownerId === req.user.id);
  if (index < 0) return res.status(404).json({ error: "Movie not found." });
  const [movie] = state.movies.splice(index, 1);
  for (const url of [movie.videoUrl, movie.posterUrl]) if (url?.startsWith("/uploads/")) { try { await fs.unlink(path.join(UPLOAD_DIR, path.basename(url))); } catch {} }
  await persist(); res.json({ ok: true });
});
function canViewReports(user) {
  return Boolean(user && ROLE_MANAGERS.has(String(user.username || "").toLowerCase()));
}

function publicReport(report) {
  const reporter = state.users[report.reporterId];
  return {
    id: report.id,
    type: report.type,
    subject: report.subject || "",
    message: report.message || "",
    gameApp: report.gameApp || "",
    page: report.page || "",
    viewport: report.viewport || "",
    createdAt: report.createdAt,
    status: report.status || "new",
    reporter: reporter ? publicUser(reporter, false) : {
      id: report.reporterId,
      username: report.reporterUsername || "Unknown",
      displayName: report.reporterDisplayName || report.reporterUsername || "Unknown",
      avatarUrl: report.reporterAvatarUrl || "",
      isOnline: false,
      roles: []
    }
  };
}

router.post("/reports", requireUser, async (req, res) => {
  const type = ["bug", "game", "feature"].includes(req.body?.type) ? req.body.type : "bug";
  const message = cleanText(req.body?.message, 3000);
  const gameApp = cleanText(req.body?.gameApp, 120);
  const page = cleanText(req.body?.page, 300);
  const viewport = cleanText(req.body?.viewport, 40);
  if (!message) return res.status(400).json({ error: "Please describe the report or recommendation." });
  if (type === "game" && !gameApp) return res.status(400).json({ error: "Enter the game or app name." });

  const report = {
    id: randomUUID(),
    reporterId: req.user.id,
    reporterUsername: req.user.username,
    reporterDisplayName: req.user.displayName,
    reporterAvatarUrl: req.user.avatarUrl || "",
    type,
    subject: type === "bug" ? "Bug Report" : type === "game" ? "Game/App Report" : "Feature Recommendation",
    message,
    gameApp,
    page,
    viewport,
    createdAt: new Date().toISOString(),
    status: "new",
  };
  state.reports.push(report);
  if (state.reports.length > 2000) state.reports = state.reports.slice(-2000);
  await persist();
  res.status(201).json({ report: publicReport(report) });
});

router.get("/reports", requireUser, (req, res) => {
  if (!canViewReports(req.user)) return res.status(403).json({ error: "Reports are restricted to Lunar managers." });
  const reports = state.reports.slice().reverse().map(publicReport);
  const unread = reports.filter(report => report.status === "new").length;
  const byType = reports.reduce((counts, report) => {
    counts[report.type] = (counts[report.type] || 0) + 1;
    return counts;
  }, {});
  res.set("Cache-Control", "no-store");
  res.json({ reports, stats: { total: reports.length, unread, byType } });
});

router.patch("/reports/:id", requireUser, async (req, res) => {
  if (!canViewReports(req.user)) return res.status(403).json({ error: "Reports are restricted to Lunar managers." });
  const report = state.reports.find(item => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found." });
  const status = ["new", "read", "resolved"].includes(req.body?.status) ? req.body.status : report.status || "new";
  report.status = status;
  await persist();
  res.json({ report: publicReport(report) });
});


const discordTypingUsers = new Map();
let discordGatewaySocket = null;
let discordGatewayHeartbeat = null;
let discordGatewaySequence = null;
let discordGatewayReconnectTimer = null;

function connectDiscordTypingGateway() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!token || !/^\d{17,20}$/.test(channelId || "") || typeof WebSocket === "undefined") return;
  if (discordGatewayReconnectTimer) clearTimeout(discordGatewayReconnectTimer);
  try {
    discordGatewaySocket = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
    discordGatewaySocket.addEventListener("message", event => {
      let packet;
      try { packet = JSON.parse(String(event.data)); } catch { return; }
      if (packet.s !== null && packet.s !== undefined) discordGatewaySequence = packet.s;
      if (packet.op === 10) {
        if (discordGatewayHeartbeat) clearInterval(discordGatewayHeartbeat);
        discordGatewayHeartbeat = setInterval(() => {
          if (discordGatewaySocket?.readyState === WebSocket.OPEN) discordGatewaySocket.send(JSON.stringify({ op: 1, d: discordGatewaySequence }));
        }, packet.d.heartbeat_interval);
        discordGatewaySocket.send(JSON.stringify({
          op: 2,
          d: {
            token,
            intents: (1 << 9) | (1 << 11) | (1 << 15),
            properties: { os: process.platform, browser: "Lunar Console", device: "Lunar Console" }
          }
        }));
      }
      if (packet.op === 1) {
        if (discordGatewaySocket?.readyState === WebSocket.OPEN) discordGatewaySocket.send(JSON.stringify({ op: 1, d: discordGatewaySequence }));
      }
      if (packet.op === 7 || packet.op === 9) {
        try { discordGatewaySocket.close(); } catch {}
      }
      if (packet.t === "TYPING_START" && packet.d?.channel_id === channelId) {
        const userId = String(packet.d.user_id || "");
        if (!userId || userId === packet.d.member?.user?.id) {
          if (!userId) return;
        }
        discordTypingUsers.set(userId, { userId, timestamp: Date.now() });
      }
      if (packet.t === "GUILD_CREATE" && Array.isArray(packet.d?.members)) {
        for (const member of packet.d.members) {
          const id = member.user?.id;
          if (id && discordTypingUsers.has(id)) discordTypingUsers.set(id, { ...discordTypingUsers.get(id), username: member.user.global_name || member.user.username });
        }
      }
    });
    discordGatewaySocket.addEventListener("close", () => {
      if (discordGatewayHeartbeat) clearInterval(discordGatewayHeartbeat);
      discordGatewayHeartbeat = null;
      discordGatewayReconnectTimer = setTimeout(connectDiscordTypingGateway, 5000);
    });
    discordGatewaySocket.addEventListener("error", () => {
      try { discordGatewaySocket.close(); } catch {}
    });
  } catch {
    discordGatewayReconnectTimer = setTimeout(connectDiscordTypingGateway, 5000);
  }
}
connectDiscordTypingGateway();
setInterval(() => {
  for (const [id, user] of discordTypingUsers) {
    if (Date.now() - user.timestamp > 10000) discordTypingUsers.delete(id);
  }
}, 2000);

router.get("/lunar-console/discord-typing", requireUser, async (req, res) => {
  if (String(req.user.username || "").toLowerCase() !== "lunar") return res.status(403).json({ error: "This console is only available to @lunar." });
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!channelId) return res.status(503).json({ error: "Discord channel is not configured." });
  const users = [...discordTypingUsers.values()].filter(user => Date.now() - user.timestamp < 10000);
  res.set("Cache-Control", "no-store");
  res.json({ users });
});

router.get("/lunar-console/discord-messages", requireUser, async (req, res) => {
  if (String(req.user.username || "").toLowerCase() !== "lunar") {
    return res.status(403).json({ error: "This console is only available to @lunar." });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!botToken || !channelId) {
    return res.status(503).json({ error: "Discord chat reading is not configured. Add DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID." });
  }

  if (!/^\d{17,20}$/.test(channelId)) {
    return res.status(503).json({ error: "DISCORD_CHANNEL_ID must be the numeric ID of your Discord channel." });
  }

  try {
    const response = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages?limit=50", {
      headers: { Authorization: "Bot " + botToken }
    });
    if (!response.ok) {
      console.error("[Lunar Console] Discord message fetch failed:", response.status);
      return res.status(response.status === 401 || response.status === 403 ? 502 : 503).json({
        error: response.status === 401 ? "Discord rejected the bot token." : response.status === 403 ? "The bot cannot read this channel. Check its channel permissions." : "Could not load Discord messages."
      });
    }
    const messages = await response.json();
    res.set("Cache-Control", "no-store");
    res.json({
      messages: messages.map(message => {
        const author = message.author || {};
        const userId = /^\d{17,20}$/.test(String(author.id || "")) ? String(author.id) : "";
        const avatarUrl = userId
          ? author.avatar
            ? "https://cdn.discordapp.com/avatars/" + userId + "/" + author.avatar + ".png?size=96"
            : "https://cdn.discordapp.com/embed/avatars/" + (Number((BigInt(userId) >> 22n) % 6n)) + ".png"
          : "";
        return {
          id: message.id,
          userId,
          username: String(author.username || "unknown"),
          displayName: String(author.global_name || author.username || "Unknown"),
          avatarUrl,
          content: String(message.content || "").slice(0, 2000),
          attachments: Array.isArray(message.attachments) ? message.attachments.slice(0, 10).map(attachment => ({
            filename: String(attachment.filename || "Attachment").slice(0, 150),
            url: /^https:\/\//i.test(String(attachment.url || "")) ? attachment.url : "",
            contentType: String(attachment.content_type || "")
          })) : [],
          timestamp: message.timestamp,
          isBot: Boolean(author.bot || message.webhook_id)
        };
      }).reverse()
    });
  } catch (error) {
    console.error("[Lunar Console] Discord message fetch error:", error.message);
    res.status(502).json({ error: "Could not reach Discord to load messages." });
  }
});

router.post("/lunar-console/discord-message", requireUser, async (req, res) => {
  if (String(req.user.username || "").toLowerCase() !== "lunar") {
    return res.status(403).json({ error: "This console is only available to @lunar." });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(503).json({ error: "Discord webhook is not configured on the server." });
  }

  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim() || message.length > 1500) {
    return res.status(400).json({ error: "Enter a message up to 1500 characters." });
  }

  let url;
  try {
    url = new URL(webhookUrl);
  } catch {
    return res.status(503).json({ error: "Discord webhook configuration is invalid." });
  }
  if (url.protocol !== "https:" || !["discord.com", "discordapp.com"].includes(url.hostname) || !url.pathname.startsWith("/api/webhooks/")) {
    return res.status(503).json({ error: "Discord webhook configuration is invalid." });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: message.trim(), allowed_mentions: { parse: [] } }),
    });
    if (!response.ok) {
      console.warn("[Lunar Console] Discord webhook returned", response.status);
      return res.status(502).json({ error: "Discord could not accept the message." });
    }
    res.json({ ok: true });
  } catch (error) {
    console.warn("[Lunar Console] Discord message failed:", error.message);
    res.status(502).json({ error: "Could not reach Discord. Please try again." });
  }
});

router.get("/auth/me", (req, res) => {
  const user = getSessionUser(req);
  res.json({ user: user ? publicUser(user, true) : null });
});

router.get("/members/online", (req, res) => {
  // A homepage heartbeat also keeps the current logged-in session online.
  getSessionUser(req);
  res.set("Cache-Control", "no-store");
  res.json({
    online: getOnlineMemberCount(),
    members: Object.keys(state.users).length,
  });
});

router.post("/auth/register", async (req, res) => {
  const username = cleanText(req.body?.username, USERNAME_MAX);
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const password = req.body?.password;
  const displayName = cleanText(req.body?.displayName, DISPLAY_NAME_MAX) || username;

  if (!validUsername(username)) return res.status(400).json({ error: "Username must be 4–20 characters using letters, numbers, or underscores." });
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!validPassword(password)) return res.status(400).json({ error: "Password must be 8–128 characters." });
  if (!uniqueUsername(username)) return res.status(409).json({ error: "That username is already taken." });
  if (!uniqueEmail(email)) return res.status(409).json({ error: "That email is already registered." });
  if (Object.keys(state.users).length >= MAX_USERS) return res.status(503).json({ error: "Registration is temporarily full." });

  const credentials = await hashPassword(password);
  const user = {
    id: randomUUID(), username, email, displayName,
    avatarUrl: "", bannerUrl: "", backgroundUrl: "", bio: "", status: "",
    stickers: [], gifFavorites: [], blockedUsers: [], dmReadAt: {}, salt: credentials.salt, hash: credentials.hash, createdAt: new Date().toISOString(),
  };

  state.users[user.id] = user;

  // Every new account is automatically friends with @lunar.
  // This is a direct accepted friendship, so the new user does not need
  // to send or accept a friend request.
  const lunarUser = Object.values(state.users).find(item =>
    item.id !== user.id && String(item.username || "").toLowerCase() === "lunar"
  );
  if (lunarUser) {
    state.friendships = normalizeFriendshipEntries(
      [...state.friendships, friendshipKey(user.id, lunarUser.id)],
      state.friendRequests
    );
    state.friendRequests = state.friendRequests.filter(request =>
      !(
        (request.fromUserId === user.id && request.toUserId === lunarUser.id) ||
        (request.fromUserId === lunarUser.id && request.toUserId === user.id)
      )
    );
  }

  setSession(res, user.id);
  await persist();
  res.status(201).json({ user: publicUser(user, true) });
});

function findUserByEmail(email) {
  const key = String(email || "").trim().toLowerCase();
  return Object.values(state.users).find(user => user.email && user.email.toLowerCase() === key) || null;
}

function resetCodeHtml(code) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#0b0d12;color:#f4f5f8;font-family:Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:40px 20px">
      <div style="padding:28px;border:1px solid #252a35;border-radius:18px;background:#11151c">
        <div style="font-size:12px;font-weight:800;letter-spacing:.18em;color:#a995ff">LUNAR ACCOUNT</div>
        <h1 style="margin:12px 0 8px;font-size:28px">Password reset code</h1>
        <p style="color:#aab1bf;line-height:1.6">Use this code to confirm that you own this Lunar account. It expires in 10 minutes.</p>
        <div style="margin:24px 0;padding:18px;text-align:center;border-radius:14px;background:#191e29;border:1px solid #303747;font-size:34px;font-weight:900;letter-spacing:.28em;color:#fff">${code}</div>
        <p style="color:#727b8c;font-size:12px;line-height:1.6">If you did not request a password reset, you can ignore this email.</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendPasswordResetEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Password reset email service is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your Lunar password reset code",
      html: resetCodeHtml(code),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The password reset email could not be sent.");
}

router.post("/auth/password-reset/request", async (req, res) => {
  const email = cleanText(req.body?.email, 254).toLowerCase();
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });

  const now = Date.now();
  const cooldownKey = email + "|" + String(req.ip || "");
  const lastRequested = passwordResetCooldowns.get(cooldownKey) || 0;
  if (now - lastRequested < PASSWORD_RESET_REQUEST_COOLDOWN_MS) {
    return res.status(429).json({ error: "Please wait a minute before requesting another code." });
  }
  passwordResetCooldowns.set(cooldownKey, now);

  const user = findUserByEmail(email);
  if (!user) return res.json({ ok: true, message: "If an account uses that email, a verification code has been sent." });

  const code = String(randomInt(100000, 1000000));
  const credentials = await hashPassword(code);
  state.passwordResets[user.id] = {
    userId: user.id,
    codeSalt: credentials.salt,
    codeHash: credentials.hash,
    attempts: 0,
    expiresAt: now + PASSWORD_RESET_TTL_MS,
    verifiedTokenHash: "",
    verifiedTokenSalt: "",
    verifiedExpiresAt: 0,
  };

  try {
    await sendPasswordResetEmail(user.email, code);
    await persist();
    res.json({ ok: true, message: "If an account uses that email, a verification code has been sent." });
  } catch (error) {
    delete state.passwordResets[user.id];
    await persist();
    res.status(503).json({ error: "Password reset email service is unavailable right now." });
  }
});

router.post("/auth/password-reset/verify", async (req, res) => {
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const code = cleanText(req.body?.code, 6);
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit verification code." });

  const user = findUserByEmail(email);
  const reset = user ? state.passwordResets[user.id] : null;
  if (!user || !reset || Date.now() > reset.expiresAt) return res.status(400).json({ error: "That verification code is invalid or expired." });
  if (reset.attempts >= PASSWORD_RESET_CODE_ATTEMPTS) return res.status(429).json({ error: "Too many incorrect attempts. Request a new code." });

  reset.attempts += 1;
  if (!(await verifyPassword(code, { salt: reset.codeSalt, hash: reset.codeHash }))) {
    await persist();
    return res.status(400).json({ error: "That verification code is invalid or expired." });
  }

  const resetToken = randomBytes(32).toString("hex");
  const tokenCredentials = await hashPassword(resetToken);
  reset.verifiedTokenSalt = tokenCredentials.salt;
  reset.verifiedTokenHash = tokenCredentials.hash;
  reset.verifiedExpiresAt = Date.now() + PASSWORD_RESET_TTL_MS;
  reset.codeHash = "";
  reset.codeSalt = "";
  await persist();
  res.json({ ok: true, resetToken });
});

router.post("/auth/password-reset/complete", async (req, res) => {
  const resetToken = cleanText(req.body?.resetToken, 128);
  const password = req.body?.password;
  if (!resetToken) return res.status(400).json({ error: "Verify the code first." });
  if (!validPassword(password)) return res.status(400).json({ error: "Password must be 8–128 characters." });

  let matched = null;
  for (const reset of Object.values(state.passwordResets)) {
    if (!reset.verifiedTokenHash || Date.now() > reset.verifiedExpiresAt) continue;
    if (await verifyPassword(resetToken, { salt: reset.verifiedTokenSalt, hash: reset.verifiedTokenHash })) {
      matched = reset;
      break;
    }
  }
  if (!matched) return res.status(400).json({ error: "Your reset session is invalid or expired. Start again." });

  const user = state.users[matched.userId];
  if (!user) return res.status(400).json({ error: "That account could not be found." });

  const credentials = await hashPassword(password);
  user.salt = credentials.salt;
  user.hash = credentials.hash;

  for (const [token, session] of Object.entries(state.sessions)) {
    if (session?.userId === user.id) delete state.sessions[token];
  }
  delete state.passwordResets[user.id];
  await persist();
  res.json({ ok: true });
});

router.post("/auth/login", async (req, res) => {
  const identifier = cleanText(req.body?.identifier || req.body?.username, 254);
  const password = req.body?.password;
  const key = identifier.toLowerCase();
  const user = Object.values(state.users).find(item =>
    item.username.toLowerCase() === key || (item.email && item.email.toLowerCase() === key)
  );

  if (!user || !(await verifyPassword(password, user))) {
    return res.status(401).json({ error: "Incorrect username/email or password." });
  }
  if (user.kickedAt) {
    return res.status(403).json({ error: "This account has been kicked from LunarProxys." });
  }

  if (!Array.isArray(user.stickers)) user.stickers = [];
  if (!Array.isArray(user.gifFavorites)) user.gifFavorites = [];
  if (!Array.isArray(user.blockedUsers)) user.blockedUsers = [];
  setSession(res, user.id);
  await persist();
  res.json({ user: publicUser(user, true) });
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.lunar_session;
  if (token) delete state.sessions[token];
  res.clearCookie("lunar_session", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  await persist();
  res.json({ ok: true });
});

router.get("/auth/saved-accounts", (req, res) => {
  res.json({ accounts: getRememberedAccounts(req) });
});

router.post("/auth/switch", (req, res) => {
  const userId = cleanText(req.body?.userId, 80);
  if (!userId) return res.status(400).json({ error: "Choose an account." });
  const token = req.cookies?.["lunar_account_" + userId];
  const session = state.sessions[token];
  const user = state.users[userId];
  if (!token || !session || !user || user.kickedAt || session.userId !== userId || Date.now() > session.expiresAt) {
    return res.status(401).json({ error: "That saved account needs you to log in again." });
  }
  setSession(res, userId);
  res.json({ user: publicUser(user, true) });
});

router.get("/profile/settings", requireUser, (req, res) => {
  res.json({ settings: req.user.settings || {} });
});

router.patch("/profile/settings", requireUser, async (req, res) => {
  const incoming = req.body?.settings;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return res.status(400).json({ error: "Invalid settings." });
  }
  const safe = {};
  const removals = [];
  for (const [key, value] of Object.entries(incoming).slice(0, 200)) {
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(key)) continue;
    if (value === null) {
      removals.push(key);
      continue;
    }
    if (typeof value === "string") safe[key] = value.slice(0, 20000);
  }
  const current = { ...(req.user.settings || {}) };
  for (const key of removals) delete current[key];
  req.user.settings = { ...current, ...safe };
  await persist();
  res.json({ settings: req.user.settings });
});

router.patch("/profile", requireUser, async (req, res) => {
  const username = cleanText(req.body?.username, USERNAME_MAX);
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const displayName = cleanText(req.body?.displayName, DISPLAY_NAME_MAX);
  const bio = cleanText(req.body?.bio, 160);
  const status = cleanText(req.body?.status, 80);

  if (!validUsername(username)) return res.status(400).json({ error: "Username must be 4–20 characters using letters, numbers, or underscores." });
  if (!displayName) return res.status(400).json({ error: "Display name cannot be empty." });
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!uniqueUsername(username, req.user.id)) return res.status(409).json({ error: "That username is already taken." });
  if (!uniqueEmail(email, req.user.id)) return res.status(409).json({ error: "That email is already registered." });

  req.user.username = username;
  req.user.email = email;
  req.user.displayName = displayName;
  req.user.bio = bio;
  req.user.status = status;
  if (!Array.isArray(req.user.stickers)) req.user.stickers = [];

  try {
    for (const kind of ["avatar", "banner", "background"]) {
      const field = kind + "Data";
      if (req.body?.[field]) req.user[kind + "Url"] = await saveImage(req.body[field], req.user.id, kind);
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  updateMessagesForUser(req.user);
  await persist();
  res.json({ user: publicUser(req.user, true) });
});

router.post("/profile/password", requireUser, async (req, res) => {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;
  if (!validPassword(currentPassword) || !validPassword(newPassword)) {
    return res.status(400).json({ error: "Passwords must be 8–128 characters." });
  }
  if (!(await verifyPassword(currentPassword, req.user))) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: "Choose a different new password." });
  }

  const credentials = await hashPassword(newPassword);
  req.user.salt = credentials.salt;
  req.user.hash = credentials.hash;
  await persist();
  res.json({ ok: true });
});


router.patch("/users/:username/roles", requireUser, async (req, res) => {
  if (!canManageProfileRoles(req.user)) {
    return res.status(403).json({ error: "Only @lunar and @lunarstudios can manage profile roles." });
  }

  const username = cleanText(req.params.username, USERNAME_MAX).toLowerCase();
  const target = Object.values(state.users).find(item => item.username.toLowerCase() === username);
  if (!target) return res.status(404).json({ error: "Profile not found." });

  if (!Array.isArray(req.body?.roles)) {
    return res.status(400).json({ error: "Roles must be an array." });
  }

  const roles = [...new Set(
    req.body.roles
      .filter(role => typeof role === "string")
      .map(role => cleanText(role, PROFILE_ROLE_MAX))
      .filter(Boolean)
  )].slice(0, MAX_PROFILE_ROLES);

  target.roles = roles;
  await persist();
  res.json({ user: publicUser(target, false) });
});

router.post("/users/:username/kick", requireUser, async (req, res) => {
  if (!ROLE_MANAGERS.has(String(req.user.username || "").toLowerCase())) {
    return res.status(403).json({ error: "Only @lunar and @lunarstudios can kick members." });
  }

  const username = cleanText(req.params.username, USERNAME_MAX).toLowerCase();
  const target = Object.values(state.users).find(item => String(item.username || "").toLowerCase() === username);
  if (!target) return res.status(404).json({ error: "Profile not found." });
  if (target.id === req.user.id) return res.status(400).json({ error: "You cannot kick yourself." });
  if (ROLE_MANAGERS.has(String(target.username || "").toLowerCase())) {
    return res.status(403).json({ error: "Managers cannot kick @lunar or @lunarstudios." });
  }

  target.kickedAt = new Date().toISOString();
  target.kickedBy = req.user.username;

  for (const [token, session] of Object.entries(state.sessions)) {
    if (session?.userId === target.id) delete state.sessions[token];
  }

  state.friendships = state.friendships.filter(key => !key.split(":").includes(target.id));
  state.friendRequests = state.friendRequests.filter(request =>
    request.fromUserId !== target.id && request.toUserId !== target.id
  );
  for (const user of Object.values(state.users)) {
    if (Array.isArray(user.blockedUsers)) {
      user.blockedUsers = user.blockedUsers.filter(id => id !== target.id);
    }
  }

  await persist();
  res.json({ ok: true, username: target.username });
});

router.get("/users/:username", (req, res) => {
  const username = cleanText(req.params.username, USERNAME_MAX).toLowerCase();
  const user = Object.values(state.users).find(item => item.username.toLowerCase() === username);
  if (!user) return res.status(404).json({ error: "Profile not found." });
  const viewer = getSessionUser(req);
  const profile = publicUser(user, false);
  if (viewer) {
    profile.mutualFriends = getMutualFriends(viewer.id, user.id);
    profile.isSelf = viewer.id === user.id;
    profile.isFriend = viewer.id !== user.id && areFriends(viewer.id, user.id);
    profile.isBlocked = viewer.id !== user.id && isBlocked(viewer.id, user.id);
    profile.friendRequestPending = viewer.id !== user.id && state.friendRequests.some(item =>
      (item.fromUserId === viewer.id && item.toUserId === user.id) ||
      (item.fromUserId === user.id && item.toUserId === viewer.id)
    );
  }
  res.json({ user: profile });
});

router.get("/chat/messages", (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 100);
  const messages = state.messages.slice(-limit).map(message => {
    const user = state.users[message.userId];
    if (!user) return message;
    const hydrated = { ...message, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl || "", roles: normalizeProfileRoles(user) };
    if (hydrated.replyTo?.userId && state.users[hydrated.replyTo.userId]) {
      const replyUser = state.users[hydrated.replyTo.userId];
      hydrated.replyTo = { ...hydrated.replyTo, username: replyUser.username, displayName: replyUser.displayName };
    }
    return hydrated;
  });
  res.set("Cache-Control", "no-store");
  res.json({ messages });
});

router.post("/chat/uploads", requireUser, async (req, res) => {
  const kind = ["image","gif","sticker"].includes(req.body?.kind) ? req.body.kind : "image";
  try {
    const url = await saveImage(req.body?.data, req.user.id, "chat-" + kind);
    if (!url) return res.status(400).json({ error: "Choose an image first." });
    res.status(201).json({ url, kind });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/chat/messages", requireUser, async (req, res) => {
  const text = cleanText(req.body?.message, MAX_MESSAGE_LENGTH);
  const attachment = req.body?.attachment && typeof req.body.attachment === "object" ? req.body.attachment : null;
  const replyId = cleanText(req.body?.replyTo, 80);
  if (!text && !attachment) return res.status(400).json({ error: "Message cannot be empty." });
  if (attachment) {
    const url = typeof attachment.url === "string" ? attachment.url : "";
    const validLocalAttachment = url.startsWith("/uploads/") && ["image","sticker"].includes(attachment.kind);
    let validGif = false;
    if (attachment.kind === "gif" && /^https:\/\//i.test(url)) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        validGif = host === "giphy.com" || host.endsWith(".giphy.com");
      } catch {}
    }
    if (!validLocalAttachment && !validGif) {
      return res.status(400).json({ error: "Invalid attachment." });
    }
  }

  const now = Date.now();
  const last = state.messages.slice().reverse().find(message => message.userId === req.user.id);
  if (last && now - Date.parse(last.createdAt) < 1000) return res.status(429).json({ error: "Slow down a little." });

  const replied = replyId ? findMessage(replyId) : null;
  const message = {
    id: randomUUID(),
    userId: req.user.id,
    username: req.user.username,
    displayName: req.user.displayName,
    avatarUrl: req.user.avatarUrl || "",
    roles: normalizeProfileRoles(req.user),
    message: text,
    attachments: attachment ? [{ url: attachment.url, kind: attachment.kind, name: cleanText(attachment.name, 80) }] : [],
    replyTo: replied ? {
      id: replied.id, userId: replied.userId, username: replied.username,
      displayName: replied.displayName, message: replied.message || "[attachment]",
    } : null,
    reactions: [],
    deletedAt: "",
    deletedBy: "",
    createdAt: new Date(now).toISOString(),
    editedAt: "",
  };

  state.messages.push(message);
  if (state.messages.length > MAX_MESSAGES) state.messages = state.messages.slice(-MAX_MESSAGES);
  await persist();
  const hydratedMessage = {
    ...message,
    username: req.user.username,
    displayName: req.user.displayName,
    avatarUrl: req.user.avatarUrl || "",
    roles: normalizeProfileRoles(req.user),
  };
  res.status(201).json({ message: hydratedMessage });
});

router.patch("/chat/messages/:id", requireUser, async (req, res) => {
  const message = findMessage(req.params.id);
  if (!message) return res.status(404).json({ error: "Message not found." });
  if (message.userId !== req.user.id) return res.status(403).json({ error: "You can only edit your own messages." });
  if (message.deletedAt) return res.status(400).json({ error: "Deleted messages cannot be edited." });
  const text = cleanText(req.body?.message, MAX_MESSAGE_LENGTH);
  if (!text && !(message.attachments || []).length) return res.status(400).json({ error: "Message cannot be empty." });
  message.message = text;
  message.editedAt = new Date().toISOString();
  await persist();
  res.json({ message });
});

router.delete("/chat/messages/:id", requireUser, async (req, res) => {
  const message = findMessage(req.params.id);
  if (!message || message.userId !== req.user.id) return res.status(404).json({ error: "Message not found." });
  if (!message.deletedAt) {
    message.deletedAt = new Date().toISOString();
    message.deletedBy = req.user.id;
    message.message = "";
    message.attachments = [];
    message.replyTo = null;
    message.reactions = [];
    message.editedAt = "";
    await persist();
  }
  res.json({ ok: true });
});

router.patch("/chat/messages/:id/reactions", requireUser, async (req, res) => {
  const message = findMessage(req.params.id);
  if (!message) return res.status(404).json({ error: "Message not found." });
  if (message.deletedAt) return res.status(400).json({ error: "Deleted messages cannot receive reactions." });

  const kind = req.body?.kind === "sticker" ? "sticker" : "emoji";
  const emoji = cleanText(req.body?.emoji, 8);
  const stickerUrl = cleanText(req.body?.stickerUrl, 1000);
  const stickerName = cleanText(req.body?.stickerName, 80) || "Sticker";

  if (kind === "emoji" && (!emoji || emoji.length > MAX_REACTION_TEXT)) {
    return res.status(400).json({ error: "Reaction is not available." });
  }
  if (kind === "sticker" && !stickerUrl.startsWith("/uploads/")) {
    return res.status(400).json({ error: "Invalid sticker reaction." });
  }

  if (!Array.isArray(message.reactions)) message.reactions = [];
  let reaction = message.reactions.find(item => {
    const itemKind = item.kind === "sticker" ? "sticker" : "emoji";
    return itemKind === kind && (kind === "sticker" ? item.stickerUrl === stickerUrl : item.emoji === emoji);
  });

  if (!reaction) {
    reaction = kind === "sticker"
      ? { kind, stickerUrl, stickerName, users: [] }
      : { kind, emoji, users: [] };
    message.reactions.push(reaction);
  }

  const index = reaction.users.findIndex(user => user.userId === req.user.id);
  if (index >= 0) reaction.users.splice(index, 1);
  else reaction.users.push({ userId: req.user.id, username: req.user.username });

  if (!reaction.users.length) {
    message.reactions = message.reactions.filter(item => {
      const itemKind = item.kind === "sticker" ? "sticker" : "emoji";
      return itemKind !== kind || (kind === "sticker" ? item.stickerUrl !== stickerUrl : item.emoji !== emoji);
    });
  }

  await persist();
  res.json({ reactions: message.reactions });
});

router.post("/chat/messages/:id/forward", requireUser, async (req, res) => {
  const source = findMessage(req.params.id);
  if (!source) return res.status(404).json({ error: "Message not found." });
  if (source.deletedAt) return res.status(400).json({ error: "Deleted messages cannot be forwarded." });

  const targetType = cleanText(req.body?.targetType, 20) || "friend";
  if (targetType === "global") {
    return res.status(400).json({ error: "You cannot forward a Global Chat message to Global Chat." });
  }

  const target = findUser(cleanText(req.body?.recipientId, 80));
  if (!target || target.id === req.user.id) return res.status(400).json({ error: "Choose a friend to forward this message to." });
  if (!areFriends(req.user.id, target.id) || isBlocked(req.user.id, target.id)) {
    return res.status(403).json({ error: "You can only forward messages to a friend." });
  }

  const message = {
    id: randomUUID(),
    threadId: getDmThread(req.user.id, target.id, true).id,
    senderId: req.user.id,
    recipientId: target.id,
    sender: publicFriendUser(req.user),
    message: source.message || "",
    attachment: source.attachments?.[0] ? {...source.attachments[0]} : null,
    replyTo: null,
    reactions: [],
    deletedFor: [],
    forwarded: true,
    createdAt: new Date().toISOString(),
    editedAt: "",
  };
  state.dmMessages.push(message);
  if (state.dmMessages.length > 5000) state.dmMessages = state.dmMessages.slice(-5000);
  await persist();
  res.status(201).json({ message: publicDmMessage(message, req.user.id) });
});

router.post("/stickers/create", requireUser, async (req, res) => {
  try {
    const name = cleanText(req.body?.name, 50) || "My Sticker";
    const emoji = cleanText(req.body?.emoji, 8);
    const category = cleanText(req.body?.category, 24) || "Custom";
    const data = req.body?.data;
    const url = await saveImage(data, req.user.id, "sticker");
    if (!url) return res.status(400).json({ error: "Upload a sticker image first." });
    if (!Array.isArray(req.user.stickers)) req.user.stickers = [];
    const existing = req.user.stickers.find(sticker => sticker.url === url);
    if (!existing) {
      req.user.stickers.unshift({
        id: randomUUID(),
        url,
        name,
        emoji,
        category,
        createdAt: new Date().toISOString()
      });
      req.user.stickers = req.user.stickers.slice(0, MAX_STICKERS);
      await persist();
    }
    res.status(201).json({ sticker: req.user.stickers[0], stickers: req.user.stickers });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to create sticker." });
  }
});




// Friends / direct-message helpers
function findUser(id) {
  return state.users[id] || null;
}

function isUserOnline(userId) {
  const cutoff = Date.now() - 2 * 60 * 1000;
  return Object.values(state.sessions).some(session =>
    session?.kind === "active" &&
    session.userId === userId &&
    session.lastSeen &&
    session.lastSeen > cutoff
  );
}

function publicFriendUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
    status: user.status || "",
    isOnline: isUserOnline(user.id),
  };
}

function getMutualFriends(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) return [];
  const viewerFriends = new Set();
  const targetFriends = new Set();
  for (const key of state.friendships) {
    const ids = key.split(":");
    if (ids.includes(viewerId)) viewerFriends.add(ids.find(id => id !== viewerId));
    if (ids.includes(targetId)) targetFriends.add(ids.find(id => id !== targetId));
  }
  return [...viewerFriends]
    .filter(id => targetFriends.has(id))
    .map(findUser)
    .filter(Boolean)
    .filter(user => !state.users[viewerId]?.blockedUsers?.includes(user.id))
    .slice(0, 12)
    .map(publicFriendUser);
}

function publicFriendUserForViewer(user, viewerId) {
  const result = publicFriendUser(user);
  result.mutualFriends = getMutualFriends(viewerId, user.id);
  result.isFriend = areFriends(viewerId, user.id);
  result.isBlocked = isBlocked(viewerId, user.id);
  return result;
}

function friendshipKey(a, b) {
  return [a, b].sort().join(":");
}

function areFriends(a, b) {
  return state.friendships.includes(friendshipKey(a, b));
}

function isBlocked(a, b) {
  const one = findUser(a);
  const two = findUser(b);
  return Boolean(one?.blockedUsers?.includes(b) || two?.blockedUsers?.includes(a));
}

function getDmThread(a, b, create = true) {
  const key = friendshipKey(a, b);
  if (!state.dmThreads[key] && create) {
    state.dmThreads[key] = { id: key, userIds: [a, b] };
  }
  return state.dmThreads[key] || null;
}

function publicDmMessage(message, viewerId) {
  const currentSender = state.users[message.senderId];
  const currentRecipient = state.users[message.recipientId];
  const base = {
    ...message,
    sender: currentSender ? publicFriendUser(currentSender) : message.sender,
    recipient: currentRecipient ? publicFriendUser(currentRecipient) : message.recipient,
    reactions: (message.reactions || []).map(reaction => ({
      kind: reaction.kind === "sticker" ? "sticker" : "emoji",
      emoji: reaction.emoji || "",
      stickerUrl: reaction.stickerUrl || "",
      stickerName: reaction.stickerName || "",
      users: (reaction.users || []).map(user => ({ userId: user.userId, username: user.username })),
    })),
  };
  if (message.deletedAt) {
    return {
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      sender: message.sender,
      message: "",
      attachment: null,
      replyTo: null,
      reactions: [],
      deletedAt: message.deletedAt,
      deletedBy: message.deletedBy || "",
      forwarded: Boolean(message.forwarded),
      createdAt: message.createdAt,
      editedAt: "",
    };
  }
  return base;
}
function publicGifFavorite(gif) {
  return {
    id: cleanText(gif.id, 100),
    title: cleanText(gif.title, 120),
    url: cleanText(gif.url, 1000),
    preview: cleanText(gif.preview || gif.url, 1000),
  };
}

router.get("/friends/bootstrap", requireUser, (req, res) => {
  const me = req.user;
  if (!me.dmReadAt || typeof me.dmReadAt !== "object") me.dmReadAt = {};

  const ids = new Set();
  for (const key of state.friendships) {
    const pair = key.split(":");
    if (pair.includes(me.id)) {
      const id = pair.find(value => value !== me.id);
      if (id) ids.add(id);
    }
  }
  for (const thread of Object.values(state.dmThreads)) {
    if (thread?.userIds?.includes(me.id)) {
      const id = thread.userIds.find(value => value !== me.id);
      if (id) ids.add(id);
    }
  }

  const conversationUsers = [...ids]
    .map(findUser)
    .filter(Boolean)
    .filter(user => user.id !== me.id)
    .filter(user => !me.blockedUsers?.includes(user.id));

  const friends = conversationUsers.map(user => publicFriendUserForViewer(user, me.id));

  const incoming = state.friendRequests
    .filter(item => item.toUserId === me.id && item.status === "pending")
    .map(item => ({ ...item, from: publicFriendUser(findUser(item.fromUserId)) }))
    .filter(item => item.from);

  const outgoing = state.friendRequests
    .filter(item => item.fromUserId === me.id && item.status === "pending")
    .map(item => ({ ...item, to: publicFriendUser(findUser(item.toUserId)) }))
    .filter(item => item.to);

  const threads = conversationUsers.map(friend => {
    const thread = getDmThread(me.id, friend.id, false);
    const last = thread ? state.dmMessages.slice().reverse().find(message =>
      thread.userIds.includes(message.senderId) &&
      thread.userIds.includes(message.recipientId) &&
      !(message.deletedFor || []).includes(me.id)
    ) : null;
    const unreadSince = Number(me.dmReadAt?.[thread?.id] || 0);
    const unreadCount = thread
      ? state.dmMessages.filter(message =>
          message.threadId === thread.id &&
          message.recipientId === me.id &&
          !message.deletedAt &&
          Date.parse(message.createdAt) > unreadSince &&
          !me.blockedUsers?.includes(message.senderId)
        ).length
      : 0;
    return {
      friend,
      lastMessage: last ? publicDmMessage(last, me.id) : null,
      unreadCount,
    };
  });

  const unread = state.dmMessages
    .filter(message =>
      message.recipientId === me.id &&
      !message.deletedAt &&
      !me.blockedUsers?.includes(message.senderId) &&
      Date.parse(message.createdAt) > Number(me.dmReadAt?.[message.threadId] || 0)
    )
    .slice(-50)
    .map(message => ({
      id: message.id,
      threadId: message.threadId,
      sender: publicFriendUser(findUser(message.senderId)),
      message: message.message || (message.attachment?.kind === "gif" ? "Sent a GIF" : "Sent a sticker"),
      createdAt: message.createdAt,
    }))
    .filter(item => item.sender);

  const blocked = (me.blockedUsers || []).map(findUser).filter(Boolean).map(publicFriendUser);
  const unreadCount = incoming.length + unread.length;

  res.json({
    user: publicUser(me, true),
    friends,
    incoming,
    outgoing,
    threads,
    blocked,
    unread,
    unreadCount,
    gifFavorites: (me.gifFavorites || []).map(publicGifFavorite),
  });
});

router.get("/friends/users", requireUser, (req, res) => {
  const q = cleanText(req.query.q, 40).toLowerCase();
  if (q.length < 2) return res.json({ users: [] });
  const users = Object.values(state.users)
    .filter(user => user.id !== req.user.id)
    .filter(user => !req.user.blockedUsers?.includes(user.id))
    .filter(user => user.username.toLowerCase().includes(q) || user.displayName.toLowerCase().includes(q))
    .slice(0, 20)
    .map(publicFriendUser);
  res.json({ users });
});

router.post("/friends/requests", requireUser, async (req, res) => {
  const username = cleanText(req.body?.username, USERNAME_MAX).toLowerCase();
  const target = Object.values(state.users).find(user => user.username.toLowerCase() === username);
  if (!target) return res.status(404).json({ error: "User not found." });
  if (target.id === req.user.id) return res.status(400).json({ error: "You cannot add yourself." });
  if (isBlocked(req.user.id, target.id)) return res.status(403).json({ error: "This user is blocked." });
  if (areFriends(req.user.id, target.id)) return res.status(409).json({ error: "You are already friends." });

  const existing = state.friendRequests.find(item =>
    item.status === "pending" &&
    ((item.fromUserId === req.user.id && item.toUserId === target.id) ||
     (item.fromUserId === target.id && item.toUserId === req.user.id))
  );
  if (existing) return res.status(409).json({ error: "A friend request is already pending." });

  const request = {
    id: randomUUID(),
    fromUserId: req.user.id,
    toUserId: target.id,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  state.friendRequests.push(request);
  await persist();
  res.status(201).json({ request });
});

router.patch("/friends/requests/:id", requireUser, async (req, res) => {
  const request = state.friendRequests.find(item => item.id === req.params.id && item.toUserId === req.user.id);
  if (!request || request.status !== "pending") return res.status(404).json({ error: "Friend request not found." });
  const action = cleanText(req.body?.action, 10);
  if (!["accept","decline"].includes(action)) return res.status(400).json({ error: "Invalid request action." });

  request.status = action === "accept" ? "accepted" : "declined";
  request.respondedAt = new Date().toISOString();
  if (action === "accept") state.friendships.push(friendshipKey(request.fromUserId, request.toUserId));
  await persist();
  res.json({ ok: true, status: request.status });
});

router.delete("/friends/:userId", requireUser, async (req, res) => {
  const userId = req.params.userId;
  state.friendships = state.friendships.filter(key => key !== friendshipKey(req.user.id, userId));
  await persist();
  res.json({ ok: true });
});

router.get("/friends/blocked", requireUser, (req, res) => {
  const blocked = (req.user.blockedUsers || []).map(findUser).filter(Boolean).map(publicFriendUser);
  res.json({ users: blocked });
});

router.delete("/friends/blocked/:userId", requireUser, async (req, res) => {
  req.user.blockedUsers = (req.user.blockedUsers || []).filter(id => id !== req.params.userId);
  await persist();
  res.json({ ok: true });
});

router.post("/friends/block/:userId", requireUser, async (req, res) => {
  const target = findUser(req.params.userId);
  if (!target || target.id === req.user.id) return res.status(404).json({ error: "User not found." });
  if (!Array.isArray(req.user.blockedUsers)) req.user.blockedUsers = [];
  if (!req.user.blockedUsers.includes(target.id)) req.user.blockedUsers.push(target.id);
  state.friendships = state.friendships.filter(key => key !== friendshipKey(req.user.id, target.id));
  await persist();
  res.json({ ok: true });
});

router.post("/friends/report/:userId", requireUser, async (req, res) => {
  const target = findUser(req.params.userId);
  if (!target || target.id === req.user.id) return res.status(404).json({ error: "User not found." });
  state.reports.push({
    id: randomUUID(),
    reporterId: req.user.id,
    reportedUserId: target.id,
    reason: cleanText(req.body?.reason, 300) || "Reported as spam",
    createdAt: new Date().toISOString(),
  });
  await persist();
  res.json({ ok: true });
});

router.get("/friends/dms/:friendId/messages", requireUser, (req, res) => {
  const friend = findUser(req.params.friendId);
  if (!friend || friend.id === req.user.id) return res.status(404).json({ error: "User not found." });
  if (isBlocked(req.user.id, friend.id)) return res.status(403).json({ error: "Messaging is blocked." });
  const thread = getDmThread(req.user.id, friend.id, false);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 100);
  const messages = thread
    ? state.dmMessages.filter(message => thread.userIds.includes(message.senderId) && thread.userIds.includes(message.recipientId))
        .slice(-limit).map(message => publicDmMessage(message, req.user.id)).filter(Boolean)
    : [];
  res.json({ messages });
});

router.post("/friends/dms/:friendId/messages", requireUser, async (req, res) => {
  const friend = findUser(req.params.friendId);
  if (!friend || friend.id === req.user.id) return res.status(404).json({ error: "User not found." });
  if (isBlocked(req.user.id, friend.id)) return res.status(403).json({ error: "Messaging is blocked." });

  const text = cleanText(req.body?.message, MAX_MESSAGE_LENGTH);
  const attachment = req.body?.attachment && typeof req.body.attachment === "object" ? req.body.attachment : null;
  if (!text && !attachment) return res.status(400).json({ error: "Message cannot be empty." });
  if (attachment) {
    const validGif = attachment.kind === "gif" && typeof attachment.url === "string" && /^https:\/\//i.test(attachment.url);
    const validImage = attachment.kind === "image" && typeof attachment.url === "string" && attachment.url.startsWith("/uploads/");
    const validSticker = attachment.kind === "sticker" && typeof attachment.url === "string" && attachment.url.startsWith("/uploads/");
    if (!validGif && !validImage && !validSticker) return res.status(400).json({ error: "Invalid attachment." });
  }

  const thread = getDmThread(req.user.id, friend.id, true);
  const replyId = cleanText(req.body?.replyTo, 80);
  const replied = replyId ? state.dmMessages.find(message => message.id === replyId && thread.userIds.includes(message.senderId) && thread.userIds.includes(message.recipientId)) : null;
  const message = {
    id: randomUUID(),
    threadId: thread.id,
    senderId: req.user.id,
    recipientId: friend.id,
    sender: publicFriendUser(req.user),
    message: text,
    attachment: attachment ? {
      kind: attachment.kind === "sticker" ? "sticker" : (attachment.kind === "image" ? "image" : "gif"),
      url: cleanText(attachment.url, 1000),
      title: cleanText(attachment.title, 120),
      name: cleanText(attachment.name, 80)
    } : null,
    replyTo: replied ? { id: replied.id, sender: publicFriendUser(findUser(replied.senderId)), message: replied.message || "[GIF]" } : null,
    reactions: [],
    deletedFor: [],
    deletedAt: "",
    deletedBy: "",
    createdAt: new Date().toISOString(),
    editedAt: "",
  };
  state.dmMessages.push(message);
  if (state.dmMessages.length > 5000) state.dmMessages = state.dmMessages.slice(-5000);
  await persist();
  res.status(201).json({ message: publicDmMessage(message, req.user.id) });
});

router.post("/friends/dms/:friendId/read", requireUser, async (req, res) => {
  const friend = findUser(req.params.friendId);
  if (!friend || friend.id === req.user.id) return res.status(404).json({ error: "User not found." });
  if (isBlocked(req.user.id, friend.id)) return res.status(403).json({ error: "Messaging is blocked." });
  const thread = getDmThread(req.user.id, friend.id, false);
  if (!thread) return res.json({ ok: true });
  if (!req.user.dmReadAt || typeof req.user.dmReadAt !== "object") req.user.dmReadAt = {};
  req.user.dmReadAt[thread.id] = Date.now();
  await persist();
  res.json({ ok: true });
});

router.patch("/friends/dms/messages/:id", requireUser, async (req, res) => {
  const message = state.dmMessages.find(item => item.id === req.params.id);
  if (!message || message.senderId !== req.user.id) return res.status(404).json({ error: "Message not found." });
  if (message.deletedAt) return res.status(400).json({ error: "Deleted messages cannot be edited." });
  const text = cleanText(req.body?.message, MAX_MESSAGE_LENGTH);
  if (!text && !message.attachment) return res.status(400).json({ error: "Message cannot be empty." });
  message.message = text;
  message.editedAt = new Date().toISOString();
  await persist();
  res.json({ message: publicDmMessage(message, req.user.id) });
});

router.delete("/friends/dms/messages/:id", requireUser, async (req, res) => {
  const message = state.dmMessages.find(item => item.id === req.params.id);
  if (!message || message.senderId !== req.user.id) return res.status(404).json({ error: "Message not found." });
  if (!message.deletedAt) {
    message.deletedAt = new Date().toISOString();
    message.deletedBy = req.user.id;
    message.message = "";
    message.attachment = null;
    message.replyTo = null;
    message.reactions = [];
    message.editedAt = "";
    await persist();
  }
  res.json({ ok: true });
});

router.patch("/friends/dms/messages/:id/reactions", requireUser, async (req, res) => {
  const message = state.dmMessages.find(item => item.id === req.params.id);
  if (!message || ![message.senderId, message.recipientId].includes(req.user.id)) return res.status(404).json({ error: "Message not found." });
  if (message.deletedAt) return res.status(400).json({ error: "Deleted messages cannot receive reactions." });

  const kind = req.body?.kind === "sticker" ? "sticker" : "emoji";
  const emoji = cleanText(req.body?.emoji, 8);
  const stickerUrl = cleanText(req.body?.stickerUrl, 1000);
  const stickerName = cleanText(req.body?.stickerName, 80) || "Sticker";

  if (kind === "emoji" && (!emoji || Array.from(emoji).length > MAX_REACTION_TEXT)) {
    return res.status(400).json({ error: "Reaction is not available." });
  }
  if (kind === "sticker" && !stickerUrl.startsWith("/uploads/")) {
    return res.status(400).json({ error: "Invalid sticker reaction." });
  }

  if (!Array.isArray(message.reactions)) message.reactions = [];
  let reaction = message.reactions.find(item => {
    const itemKind = item.kind === "sticker" ? "sticker" : "emoji";
    return itemKind === kind && (kind === "sticker" ? item.stickerUrl === stickerUrl : item.emoji === emoji);
  });

  if (!reaction) {
    reaction = kind === "sticker"
      ? { kind, stickerUrl, stickerName, users: [] }
      : { kind, emoji, users: [] };
    message.reactions.push(reaction);
  }

  const index = reaction.users.findIndex(user => user.userId === req.user.id);
  if (index >= 0) reaction.users.splice(index, 1);
  else reaction.users.push({ userId: req.user.id, username: req.user.username });

  if (!reaction.users.length) {
    message.reactions = message.reactions.filter(item => {
      const itemKind = item.kind === "sticker" ? "sticker" : "emoji";
      return itemKind !== kind || (kind === "sticker" ? item.stickerUrl !== stickerUrl : item.emoji !== emoji);
    });
  }

  await persist();
  res.json({ reactions: message.reactions });
});

router.post("/friends/dms/messages/:id/forward", requireUser, async (req, res) => {
  const source = state.dmMessages.find(item => item.id === req.params.id);
  if (!source) return res.status(404).json({ error: "Message not found." });
  if (![source.senderId, source.recipientId].includes(req.user.id)) return res.status(403).json({ error: "You cannot forward this message." });

  const targetType = cleanText(req.body?.targetType, 20) || "friend";
  if (targetType === "global") {
    const message = {
      id: randomUUID(),
      userId: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl || "",
      message: source.message || "",
      attachments: source.attachment ? [{...source.attachment}] : [],
      replyTo: null,
      reactions: [],
      forwarded: true,
      createdAt: new Date().toISOString(),
      editedAt: "",
    };
    state.messages.push(message);
    if (state.messages.length > MAX_MESSAGES) state.messages = state.messages.slice(-MAX_MESSAGES);
    await persist();
    return res.status(201).json({ message });
  }

  const target = findUser(cleanText(req.body?.recipientId, 80));
  if (!target || target.id === req.user.id || target.id === source.senderId || target.id === source.recipientId) {
    return res.status(400).json({ error: "You cannot forward a message to the same conversation." });
  }
  if (!areFriends(req.user.id, target.id) || isBlocked(req.user.id, target.id)) {
    return res.status(403).json({ error: "You can only forward to a friend." });
  }

  const thread = getDmThread(req.user.id, target.id, true);
  const message = {
    id: randomUUID(), threadId: thread.id, senderId: req.user.id, recipientId: target.id,
    sender: publicFriendUser(req.user), message: source.message, attachment: source.attachment ? {...source.attachment} : null,
    replyTo: null, reactions: [], deletedFor: [], forwarded: true, createdAt: new Date().toISOString(), editedAt: "",
  };
  state.dmMessages.push(message);
  await persist();
  res.status(201).json({ message: publicDmMessage(message, req.user.id) });
});

router.post("/friends/gifs/favorites", requireUser, async (req, res) => {
  const favorite = publicGifFavorite(req.body?.gif || {});
  if (!favorite.id || !favorite.url) return res.status(400).json({ error: "Invalid GIF." });
  if (!Array.isArray(req.user.gifFavorites)) req.user.gifFavorites = [];
  if (!req.user.gifFavorites.some(item => item.id === favorite.id)) req.user.gifFavorites.unshift(favorite);
  req.user.gifFavorites = req.user.gifFavorites.slice(0, 200);
  await persist();
  res.json({ favorites: req.user.gifFavorites.map(publicGifFavorite) });
});

router.delete("/friends/gifs/favorites/:id", requireUser, async (req, res) => {
  if (!Array.isArray(req.user.gifFavorites)) req.user.gifFavorites = [];
  req.user.gifFavorites = req.user.gifFavorites.filter(item => item.id !== req.params.id);
  await persist();
  res.json({ favorites: req.user.gifFavorites.map(publicGifFavorite) });
});

router.get("/friends/gifs/config", requireUser, (_req, res) => {
  if (!process.env.GIPHY_API_KEY) return res.status(503).json({ error: "GIF search is not configured. Add GIPHY_API_KEY to Railway variables." });
  res.json({ apiKey: process.env.GIPHY_API_KEY });
});


const MAX_AI_CHATS_PER_USER = 50;
const MAX_AI_MESSAGES_PER_CHAT = 100;
const MAX_AI_TEXT_LENGTH = 20000;
const MAX_AI_IMAGE_BYTES = 4 * 1024 * 1024;

function publicAiChat(chat, includeMessages = false) {
  const result = {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messageCount: Array.isArray(chat.messages) ? chat.messages.length : 0,
  };
  if (includeMessages) result.messages = Array.isArray(chat.messages) ? chat.messages : [];
  return result;
}

function getUserAiChats(userId) {
  if (!Array.isArray(state.aiChats[userId])) state.aiChats[userId] = [];
  return state.aiChats[userId];
}

router.get("/ai/chats", requireUser, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ chats: getUserAiChats(req.user.id).slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).map(chat => publicAiChat(chat)) });
});

router.post("/ai/chats", requireUser, async (req, res) => {
  const chats = getUserAiChats(req.user.id);
  if (chats.length >= MAX_AI_CHATS_PER_USER) return res.status(400).json({ error: "You have reached the 50-chat limit. Delete an older chat to create another." });
  const now = new Date().toISOString();
  const chat = { id: randomUUID(), title: "New chat", createdAt: now, updatedAt: now, messages: [] };
  chats.unshift(chat);
  await persist();
  res.status(201).json({ chat: publicAiChat(chat, true) });
});

router.get("/ai/chats/:id", requireUser, (req, res) => {
  const chat = getUserAiChats(req.user.id).find(item => item.id === req.params.id);
  if (!chat) return res.status(404).json({ error: "Chat not found." });
  res.set("Cache-Control", "no-store");
  res.json({ chat: publicAiChat(chat, true) });
});

router.delete("/ai/chats/:id", requireUser, async (req, res) => {
  const chats = getUserAiChats(req.user.id);
  const index = chats.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Chat not found." });
  chats.splice(index, 1);
  await persist();
  res.json({ ok: true });
});

router.post("/ai/chats/:id/messages", requireUser, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI is not configured yet. Add GEMINI_API_KEY to your server environment variables." });

  const chat = getUserAiChats(req.user.id).find(item => item.id === req.params.id);
  if (!chat) return res.status(404).json({ error: "Chat not found." });
  if (!Array.isArray(chat.messages)) chat.messages = [];
  if (chat.messages.length >= MAX_AI_MESSAGES_PER_CHAT - 2) return res.status(400).json({ error: "This chat has reached its message limit. Start a new chat to continue." });

  const message = cleanText(req.body?.message, MAX_AI_TEXT_LENGTH);
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 3) : [];
  const imageParts = [];
  const attachmentLabels = [];
  const documentTexts = [];
  let totalImageBytes = 0;

  for (const attachment of attachments) {
    const name = cleanText(attachment?.name, 160) || "attachment";
    const type = String(attachment?.type || "").toLowerCase();
    attachmentLabels.push(name);
    if (type === "text/plain" || name.toLowerCase().endsWith(".txt")) {
      const text = typeof attachment?.text === "string" ? attachment.text.slice(0, 12000) : "";
      if (text) documentTexts.push("Contents of " + name + ":\n" + text);
      continue;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(type)) {
      return res.status(400).json({ error: "Only .txt, PNG, JPG, and WEBP files are supported." });
    }
    const dataUrl = typeof attachment?.data === "string" ? attachment.data : "";
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match || match[1] !== type) return res.status(400).json({ error: "An uploaded image could not be read. Please choose it again." });
    const buffer = Buffer.from(match[2], "base64");
    totalImageBytes += buffer.length;
    if (buffer.length > MAX_AI_IMAGE_BYTES || totalImageBytes > MAX_AI_IMAGE_BYTES) return res.status(413).json({ error: "Images must total 4 MB or less per message." });
    imageParts.push({ inlineData: { mimeType: type, data: buffer.toString("base64") } });
  }

  if (!message && !attachments.length) return res.status(400).json({ error: "Write a message or attach a file first." });
  const userText = [message, ...documentTexts, ...imageParts.map((_, index) => "Please inspect attached image " + (index + 1) + ".")].filter(Boolean).join("\n\n").slice(0, MAX_AI_TEXT_LENGTH);
  const savedUserText = [message, ...documentTexts, ...attachmentLabels.map(name => "[Attachment: " + name + "]")].filter(Boolean).join("\n\n").slice(0, MAX_AI_TEXT_LENGTH);
  const contents = chat.messages.slice(-12).map(item => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: String(item.content || "").slice(0, MAX_AI_TEXT_LENGTH) }],
  }));
  const currentParts = [{ text: userText || "Please analyze the attached file and help me understand it." }, ...imageParts];
  contents.push({ role: "user", parts: currentParts });

  let providerTimeout;
  try {
    const providerController = new AbortController();
    providerTimeout = setTimeout(() => providerController.abort(), 45000);
    const model = cleanText(process.env.GEMINI_MODEL, 80) || "gemini-3.6-flash";
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are Lunar AI, a friendly and careful study assistant. Help users understand questions and images step by step. Be accurate, explain uncertainty, and do not claim to see details that are unclear. Keep responses clear and useful." }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
      }),
      signal: providerController.signal,
    });
    clearTimeout(providerTimeout);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = cleanText(data?.error?.message, 300);
      console.warn("[Lunar AI] Provider request failed:", response.status, providerMessage);
      return res.status(502).json({ error: response.status === 429 ? "The free AI limit has been reached. Try again later." : "The AI provider could not answer right now. Check the server API key and model settings." });
    }
    const answer = (Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts.map(part => part.text || "").join("") : "").trim();
    if (!answer) return res.status(502).json({ error: "The AI returned an empty response. Please try again." });

    const now = new Date().toISOString();
    const userEntry = { id: randomUUID(), role: "user", content: savedUserText || "Please analyze the attached file.", attachments: attachmentLabels, createdAt: now };
    const assistantEntry = { id: randomUUID(), role: "assistant", content: answer, attachments: [], createdAt: new Date().toISOString() };
    chat.messages.push(userEntry, assistantEntry);
    if (chat.messages.length > MAX_AI_MESSAGES_PER_CHAT) chat.messages.splice(0, chat.messages.length - MAX_AI_MESSAGES_PER_CHAT);
    if (chat.title === "New chat") chat.title = cleanText(message || attachmentLabels[0] || "New chat", 60) || "New chat";
    chat.updatedAt = assistantEntry.createdAt;
    await persist();
    res.json({ chat: publicAiChat(chat, true), answer });
  } catch (error) {
    if (providerTimeout) clearTimeout(providerTimeout);
    console.warn("[Lunar AI] Request failed:", error.message);
    res.status(502).json({ error: "Could not reach the AI provider. Please try again in a moment." });
  }
});

await loadState();

export default router;

import express from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";

const router = express.Router();
const DATA_DIR = process.env.LUNAR_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data");
const PLAYLIST_FILE = path.join(DATA_DIR, "spotify-lunar-playlists.json");
const tokenCache = { accessToken: "", expiresAt: 0 };

const getCredentials = () => ({ clientId: process.env.SPOTIFY_CLIENT_ID || "", clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "" });
async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch (error) { if (error.code !== "ENOENT") console.warn("[Spotify] Read failed:", error.message); return fallback; } }
async function writeJson(file, value) { await fs.mkdir(DATA_DIR, { recursive: true }); const temp = file + ".tmp"; await fs.writeFile(temp, JSON.stringify(value, null, 2), "utf8"); await fs.rename(temp, file); }
async function getAccessToken() {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) { const error = new Error("Spotify API credentials are not configured."); error.code = "SPOTIFY_NOT_CONFIGURED"; throw error; }
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.accessToken;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials" }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) { const error = new Error(data.error_description || "Spotify authorization failed."); error.status = response.status; throw error; }
  tokenCache.accessToken = data.access_token;
  tokenCache.expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return tokenCache.accessToken;
}
async function requireUser(req, res, next) {
  const state = await readJson(path.join(DATA_DIR, "community.json"), { users: {}, sessions: {} });
  const token = req.cookies?.lunar_session;
  const session = token ? state.sessions?.[token] : null;
  const user = session && Date.now() <= Number(session.expiresAt || 0) ? state.users?.[session.userId] : null;
  if (!user) return res.status(401).json({ error: "You need to log in to save playlists." });
  req.user = user;
  next();
}

router.get("/spotify/search", requireUser, async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 120);
  const requestedTypes = String(req.query.type || "track,album,artist,playlist").split(",").map(value => value.trim()).filter(Boolean);
  const allowedTypes = new Set(["track", "album", "artist", "playlist"]);
  const types = requestedTypes.filter(type => allowedTypes.has(type));
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 8, 1), 10);
  if (!q) return res.status(400).json({ error: "Enter a song, artist, album, or playlist to search." });
  if (!types.length) return res.status(400).json({ error: "No valid Spotify result types were requested." });
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({ q, type: types.join(","), limit: String(limit), market: "US" });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { tokenCache.accessToken = ""; tokenCache.expiresAt = 0; }
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "Spotify search failed." });
    res.setHeader("Cache-Control", "private, max-age=30");
    return res.json({ tracks: data.tracks?.items || [], albums: data.albums?.items || [], artists: data.artists?.items || [], playlists: data.playlists?.items || [] });
  } catch (error) {
    if (error.code === "SPOTIFY_NOT_CONFIGURED") return res.status(503).json({ error: "Spotify search is not configured yet. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to the server environment." });
    console.error("Spotify search error:", error);
    return res.status(502).json({ error: "Spotify is temporarily unavailable. Try again in a moment." });
  }
});

router.get("/spotify/playlists", requireUser, async (req, res) => {
  const all = await readJson(PLAYLIST_FILE, {});
  res.set("Cache-Control", "no-store");
  res.json({ playlists: Object.values(all[req.user.id] || {}) });
});
router.post("/spotify/playlists", requireUser, async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: "Give your playlist a name." });
  const all = await readJson(PLAYLIST_FILE, {});
  all[req.user.id] ||= {};
  const id = randomBytes(12).toString("hex");
  const playlist = { id, name, description: String(req.body?.description || "").slice(0, 300), tracks: [], createdAt: Date.now(), updatedAt: Date.now() };
  all[req.user.id][id] = playlist;
  await writeJson(PLAYLIST_FILE, all);
  res.status(201).json({ playlist });
});
router.post("/spotify/playlists/:playlistId/tracks", requireUser, async (req, res) => {
  const all = await readJson(PLAYLIST_FILE, {});
  const playlist = all[req.user.id]?.[req.params.playlistId];
  const track = req.body?.track;
  if (!playlist) return res.status(404).json({ error: "Playlist not found." });
  if (!track?.id || !track?.name) return res.status(400).json({ error: "Invalid track." });
  if (playlist.tracks.some(item => item.id === String(track.id))) return res.status(409).json({ error: "That song is already in the playlist." });
  playlist.tracks.push({ id: String(track.id), uri: String(track.uri || `spotify:track:${track.id}`), name: String(track.name).slice(0, 200), artists: String(track.artists || "").slice(0, 200), album: String(track.album || "").slice(0, 200), image: String(track.image || "").slice(0, 1000), duration_ms: Number(track.duration_ms || 0) });
  playlist.updatedAt = Date.now();
  await writeJson(PLAYLIST_FILE, all);
  res.status(201).json({ playlist });
});
router.delete("/spotify/playlists/:playlistId/tracks/:trackId", requireUser, async (req, res) => {
  const all = await readJson(PLAYLIST_FILE, {});
  const playlist = all[req.user.id]?.[req.params.playlistId];
  if (!playlist) return res.status(404).json({ error: "Playlist not found." });
  playlist.tracks = playlist.tracks.filter(track => track.id !== String(req.params.trackId));
  playlist.updatedAt = Date.now();
  await writeJson(PLAYLIST_FILE, all);
  res.json({ playlist });
});
router.delete("/spotify/playlists/:playlistId", requireUser, async (req, res) => {
  const all = await readJson(PLAYLIST_FILE, {});
  if (!all[req.user.id]?.[req.params.playlistId]) return res.status(404).json({ error: "Playlist not found." });
  delete all[req.user.id][req.params.playlistId];
  await writeJson(PLAYLIST_FILE, all);
  res.json({ ok: true });
});

export default router;

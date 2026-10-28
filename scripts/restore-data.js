import { spawnSync } from "node:child_process";
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const archivePath = process.argv[2];
if (!archivePath) {
  console.error("Usage: node scripts/restore-data.js /path/to/lunar-backup.tar.gz --confirm-restore");
  process.exit(1);
}
if (!process.argv.includes("--confirm-restore")) {
  console.error("Restore was not run. Add --confirm-restore only after verifying the backup and target data directory.");
  process.exit(1);
}

const dataDir = path.resolve(process.env.LUNAR_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data"));
const archive = path.resolve(archivePath);
await stat(archive);
const listing = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
if (listing.status !== 0) throw new Error(listing.stderr || "The backup archive could not be read.");
const entries = listing.stdout.split("\n").filter(Boolean);
if (!entries.includes("community.json") || entries.some(entry => entry !== "community.json" && entry !== "uploads" && !entry.startsWith("uploads/") || entry.startsWith("/") || entry.split("/").includes(".."))) {
  throw new Error("The archive contains unexpected paths and was not restored.");
}

const workDir = await mkdtemp(path.join(os.tmpdir(), "lunar-restore-"));
const beforePath = path.join(workDir, "community-before-restore.json");
const extractDir = path.join(workDir, "extract");
await mkdir(extractDir, { recursive: true });

try {
  const extract = spawnSync("tar", ["-xzf", archive, "-C", extractDir], { encoding: "utf8" });
  if (extract.status !== 0) throw new Error(extract.stderr || "Could not extract the backup.");
  const parsed = JSON.parse(await readFile(path.join(extractDir, "community.json"), "utf8"));
  if (!parsed || typeof parsed !== "object" || !parsed.users || typeof parsed.users !== "object" || !Array.isArray(parsed.messages)) {
    throw new Error("The backup database failed validation.");
  }

  await mkdir(dataDir, { recursive: true });
  const liveDatabase = path.join(dataDir, "community.json");
  const safetyDir = path.join(dataDir, "before-restore-" + Date.now());
  await mkdir(safetyDir, { recursive: true });
  try {
    await copyFile(liveDatabase, beforePath);
    await copyFile(beforePath, path.join(safetyDir, "community.json"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const incomingUploads = path.join(extractDir, "uploads");
  const liveUploads = path.join(dataDir, "uploads");
  try {
    await cp(liveUploads, path.join(safetyDir, "uploads"), { recursive: true, errorOnExist: true, force: false });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await rm(liveUploads, { recursive: true, force: true });
  await mkdir(liveUploads, { recursive: true });
  try {
    for (const name of await readdir(incomingUploads)) {
      if (name.includes("/") || name.includes("\\") || name === "." || name === "..") throw new Error("Invalid upload filename in backup.");
      await copyFile(path.join(incomingUploads, name), path.join(liveUploads, name));
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await copyFile(path.join(extractDir, "community.json"), liveDatabase);
  console.log("Lunar data restored. Restart the website service to reload the database.");
} finally {
  await rm(workDir, { recursive: true, force: true });
}

import { createHash, createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dataDir = path.resolve(process.env.LUNAR_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data"));
const endpointValue = process.env.BACKUP_S3_ENDPOINT;
const bucket = process.env.BACKUP_S3_BUCKET;
const region = process.env.BACKUP_S3_REGION || "us-east-1";
const accessKey = process.env.BACKUP_S3_ACCESS_KEY_ID;
const secretKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
const prefix = (process.env.BACKUP_S3_PREFIX || "lunar-backups").replace(/^\/+|\/+$/g, "");
const required = { BACKUP_S3_ENDPOINT: endpointValue, BACKUP_S3_BUCKET: bucket, BACKUP_S3_ACCESS_KEY_ID: accessKey, BACKUP_S3_SECRET_ACCESS_KEY: secretKey };

for (const [name, value] of Object.entries(required)) {
  if (!value) {
    console.error("Missing required environment variable: " + name);
    process.exit(1);
  }
}

const endpoint = new URL(endpointValue);
if (endpoint.protocol !== "https:") {
  console.error("BACKUP_S3_ENDPOINT must use HTTPS.");
  process.exit(1);
}

const dataFile = path.join(dataDir, "community.json");
await stat(dataFile);
const workDir = await mkdtemp(path.join(os.tmpdir(), "lunar-backup-"));
const archivePath = path.join(workDir, "lunar-data.tar.gz");

try {
  const tar = spawnSync("tar", ["-czf", archivePath, "-C", dataDir, "community.json", "uploads"], { encoding: "utf8" });
  if (tar.status !== 0) throw new Error(tar.stderr || "Could not create the backup archive.");
  const body = await readFile(archivePath);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const key = [prefix, dateStamp.slice(0, 4), dateStamp.slice(4, 6), dateStamp.slice(6, 8), "lunar-" + amzDate + ".tar.gz"].filter(Boolean).join("/");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const basePath = endpoint.pathname.replace(/\/$/, "");
  const canonicalUri = basePath + "/" + encodeURIComponent(bucket) + "/" + encodedKey;
  const host = endpoint.host;
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    "x-amz-server-side-encryption": "AES256"
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map(name => name + ":" + headers[name].trim() + "\n").join("");
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = dateStamp + "/" + region + "/s3/aws4_request";
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const hmac = (keyValue, value, encoding) => createHmac("sha256", keyValue).update(value).digest(encoding);
  const kDate = hmac("AWS4" + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  const authorization = "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;
  const url = new URL(endpointValue);
  url.pathname = canonicalUri;
  url.search = "";
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/gzip",
      "content-length": String(body.length),
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      "x-amz-server-side-encryption": "AES256",
      authorization
    },
    body
  });
  if (!response.ok) throw new Error("Backup upload failed with HTTP " + response.status + ": " + (await response.text()).slice(0, 500));
  console.log("Lunar data backup uploaded successfully: " + key);
} finally {
  await rm(workDir, { recursive: true, force: true });
}

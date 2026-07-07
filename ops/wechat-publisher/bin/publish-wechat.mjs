#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";

const WECHAT_API_BASE = "https://api.weixin.qq.com";
const COVER_CACHE_PATH = ".cache/wechat-thumb-media.json";
const MAX_COVER_BYTES = 10 * 1024 * 1024;
const COVER_WIDTH = 900;
const COVER_HEIGHT = 383;

function parseEnvFile(raw) {
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
    values[key] = value;
  }
  return values;
}

async function loadServerEnv() {
  try {
    const raw = await fs.readFile(".env", "utf8");
    for (const [key, value] of Object.entries(parseEnvFile(raw))) {
      process.env[key] ||= value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return { items: [] };
  return JSON.parse(raw);
}

async function loadJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(filePath.split("/").slice(0, -1).join("/"), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function wechatJsonRequest(path, options = {}) {
  const response = await fetch(`${WECHAT_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok || payload.errcode) {
    throw new Error(`WeChat API failed: ${payload.errcode || response.status} ${payload.errmsg || ""}`.trim());
  }
  return payload;
}

async function wechatUploadRequest(path, asset) {
  const form = new FormData();
  const blob = new Blob([asset.bytes], { type: asset.mimeType });
  form.append("media", blob, asset.filename);

  const response = await fetch(`${WECHAT_API_BASE}${path}`, {
    method: "POST",
    body: form,
  });
  const payload = await response.json();
  if (!response.ok || payload.errcode) {
    throw new Error(`WeChat upload failed: ${payload.errcode || response.status} ${payload.errmsg || ""}`.trim());
  }
  return payload;
}

async function getAccessToken() {
  const params = new URLSearchParams({
    grant_type: "client_credential",
    appid: requiredEnv("WECHAT_MP_APP_ID"),
    secret: requiredEnv("WECHAT_MP_APP_SECRET"),
  });
  const payload = await wechatJsonRequest(`/cgi-bin/token?${params.toString()}`);
  if (!payload.access_token) throw new Error("WeChat API did not return access_token.");
  return payload.access_token;
}

function hashValue(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function supportedImageExtension(contentType) {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/bmp") return "bmp";
  return undefined;
}

async function downloadCoverAsset(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cover download failed: ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  const extension = supportedImageExtension(contentType);
  if (!extension) throw new Error(`Unsupported cover content type: ${contentType || "unknown"}`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_COVER_BYTES) {
    throw new Error(`Cover is too large: ${bytes.length} bytes`);
  }

  return {
    bytes,
    mimeType: contentType.split(";")[0].trim(),
    filename: `cover-${hashValue(url).slice(0, 12)}.${extension}`,
    source: "url",
  };
}

function generatedCoverColors(item) {
  const hash = createHash("sha256").update(`${item.slug}:${item.title}`).digest();
  return {
    a: [hash[0], hash[1], hash[2]].map((value) => Math.max(40, value)),
    b: [hash[3], hash[4], hash[5]].map((value) => Math.max(50, value)),
    accent: [hash[6], hash[7], hash[8]].map((value) => Math.max(80, value)),
  };
}

function writeBmpHeader(buffer, imageSize) {
  buffer.write("BM", 0);
  buffer.writeUInt32LE(54 + imageSize, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(COVER_WIDTH, 18);
  buffer.writeInt32LE(COVER_HEIGHT, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(imageSize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
}

function generateBmpCover(item) {
  const rowSize = Math.ceil((COVER_WIDTH * 3) / 4) * 4;
  const imageSize = rowSize * COVER_HEIGHT;
  const buffer = Buffer.alloc(54 + imageSize);
  const colors = generatedCoverColors(item);

  writeBmpHeader(buffer, imageSize);

  for (let y = 0; y < COVER_HEIGHT; y += 1) {
    for (let x = 0; x < COVER_WIDTH; x += 1) {
      const tx = x / Math.max(1, COVER_WIDTH - 1);
      const ty = y / Math.max(1, COVER_HEIGHT - 1);
      const band = Math.abs((x + y * 1.6) % 220 - 110) < 16 ? 0.18 : 0;
      const glow = Math.max(0, 1 - Math.hypot(tx - 0.78, ty - 0.3) * 2.2);
      const r = Math.min(255, colors.a[0] * (1 - tx) + colors.b[0] * tx + colors.accent[0] * glow * 0.45 + 255 * band);
      const g = Math.min(255, colors.a[1] * (1 - ty) + colors.b[1] * ty + colors.accent[1] * glow * 0.4 + 255 * band);
      const b = Math.min(255, (colors.a[2] + colors.b[2]) / 2 + colors.accent[2] * glow * 0.35 + 220 * band);
      const row = COVER_HEIGHT - 1 - y;
      const offset = 54 + row * rowSize + x * 3;
      buffer[offset] = Math.round(b);
      buffer[offset + 1] = Math.round(g);
      buffer[offset + 2] = Math.round(r);
    }
  }

  return {
    bytes: buffer,
    mimeType: "image/bmp",
    filename: `${item.slug || "cover"}-${hashValue(item.title).slice(0, 8)}.bmp`,
    source: "generated",
  };
}

async function coverAssetForItem(item) {
  if (item.cover_url) {
    try {
      return await downloadCoverAsset(item.cover_url);
    } catch (error) {
      console.warn(`Cover URL failed for ${item.slug}: ${error.message}. Falling back to generated cover.`);
    }
  }
  return generateBmpCover(item);
}

async function uploadPermanentImage(accessToken, asset) {
  const payload = await wechatUploadRequest(`/cgi-bin/material/add_material?access_token=${accessToken}&type=image`, asset);
  if (!payload.media_id) throw new Error("WeChat material API did not return media_id.");
  return payload.media_id;
}

async function resolveThumbMediaId(accessToken, item, coverCache) {
  if (item.thumb_media_id) return { mediaId: item.thumb_media_id, source: "payload" };

  const defaultMediaId = process.env.WECHAT_MP_DEFAULT_THUMB_MEDIA_ID || process.env.WECHAT_MP_THUMB_MEDIA_ID;
  if (defaultMediaId) return { mediaId: defaultMediaId, source: "default" };

  const cacheKey = item.cover_url
    ? `url:${item.cover_url}`
    : `generated:${item.slug}:${hashValue(item.title).slice(0, 12)}`;
  if (coverCache[cacheKey]?.media_id) {
    return { mediaId: coverCache[cacheKey].media_id, source: coverCache[cacheKey].source || "cache" };
  }

  const asset = await coverAssetForItem(item);
  const mediaId = await uploadPermanentImage(accessToken, asset);
  coverCache[cacheKey] = {
    media_id: mediaId,
    source: asset.source,
    filename: asset.filename,
    uploaded_at: new Date().toISOString(),
  };
  await writeJson(COVER_CACHE_PATH, coverCache);
  return { mediaId, source: asset.source };
}

function itemToArticle(item, thumbMediaId) {
  return {
    title: item.title,
    author: process.env.WECHAT_MP_AUTHOR || item.author || "",
    digest: item.digest || "",
    content: item.content_html,
    content_source_url: item.source_url,
    thumb_media_id: thumbMediaId,
    need_open_comment: 0,
    only_fans_can_comment: 0,
  };
}

async function createDraft(accessToken, item, thumbMediaId) {
  const payload = await wechatJsonRequest(`/cgi-bin/draft/add?access_token=${accessToken}`, {
    method: "POST",
    body: JSON.stringify({ articles: [itemToArticle(item, thumbMediaId)] }),
  });
  if (!payload.media_id) throw new Error("WeChat draft API did not return media_id.");
  return payload.media_id;
}

async function publishDraft(accessToken, mediaId) {
  return wechatJsonRequest(`/cgi-bin/freepublish/submit?access_token=${accessToken}`, {
    method: "POST",
    body: JSON.stringify({ media_id: mediaId }),
  });
}

await loadServerEnv();
const payload = await readStdinJson();
const items = Array.isArray(payload.items) ? payload.items : [];
const dryRun = String(process.env.WECHAT_DRY_RUN || "").toLowerCase() === "true";

if (items.length === 0) {
  console.log("No WeChat items requested.");
  process.exit(0);
}

if (dryRun) {
  console.log(JSON.stringify({
    ok: true,
    dry_run: true,
    items: items.map((item) => ({
      slug: item.slug,
      title: item.title,
      action: item.publish ? "publish" : "draft",
      source_url: item.source_url,
      cover: item.cover_url ? "cover_url" : "generated",
      thumb_media_id: item.thumb_media_id ? "provided" : "automatic",
    })),
  }, null, 2));
  process.exit(0);
}

const accessToken = await getAccessToken();
const coverCache = await loadJson(COVER_CACHE_PATH, {});
const results = [];

for (const item of items) {
  const thumb = await resolveThumbMediaId(accessToken, item, coverCache);
  const mediaId = await createDraft(accessToken, item, thumb.mediaId);
  const result = {
    slug: item.slug,
    title: item.title,
    action: item.publish ? "publish" : "draft",
    media_id: mediaId,
    thumb_media_source: thumb.source,
  };
  if (item.publish) {
    const publishResult = await publishDraft(accessToken, mediaId);
    result.publish_id = publishResult.publish_id || null;
  }
  results.push(result);
}

console.log(JSON.stringify({ ok: true, dry_run: false, results }, null, 2));

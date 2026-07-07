#!/usr/bin/env node
import { promises as fs } from "node:fs";

const WECHAT_API_BASE = "https://api.weixin.qq.com";

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

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function wechatRequest(path, options = {}) {
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

async function getAccessToken() {
  const params = new URLSearchParams({
    grant_type: "client_credential",
    appid: requiredEnv("WECHAT_MP_APP_ID"),
    secret: requiredEnv("WECHAT_MP_APP_SECRET"),
  });
  const payload = await wechatRequest(`/cgi-bin/token?${params.toString()}`);
  if (!payload.access_token) throw new Error("WeChat API did not return access_token.");
  return payload.access_token;
}

function itemToArticle(item) {
  return {
    title: item.title,
    author: process.env.WECHAT_MP_AUTHOR || item.author || "",
    digest: item.digest || "",
    content: item.content_html,
    content_source_url: item.source_url,
    thumb_media_id: requiredEnv("WECHAT_MP_THUMB_MEDIA_ID"),
    need_open_comment: 0,
    only_fans_can_comment: 0,
  };
}

async function createDraft(accessToken, item) {
  const payload = await wechatRequest(`/cgi-bin/draft/add?access_token=${accessToken}`, {
    method: "POST",
    body: JSON.stringify({ articles: [itemToArticle(item)] }),
  });
  if (!payload.media_id) throw new Error("WeChat draft API did not return media_id.");
  return payload.media_id;
}

async function publishDraft(accessToken, mediaId) {
  return wechatRequest(`/cgi-bin/freepublish/submit?access_token=${accessToken}`, {
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
    })),
  }, null, 2));
  process.exit(0);
}

const accessToken = await getAccessToken();
const results = [];

for (const item of items) {
  const mediaId = await createDraft(accessToken, item);
  const result = {
    slug: item.slug,
    title: item.title,
    action: item.publish ? "publish" : "draft",
    media_id: mediaId,
  };
  if (item.publish) {
    const publishResult = await publishDraft(accessToken, mediaId);
    result.publish_id = publishResult.publish_id || null;
  }
  results.push(result);
}

console.log(JSON.stringify({ ok: true, dry_run: false, results }, null, 2));

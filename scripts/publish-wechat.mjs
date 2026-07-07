#!/usr/bin/env node
import { loadContentEntries, isPublishable, normalizeChannels } from "./lib/content.mjs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import MarkdownIt from "markdown-it";

const entries = (await loadContentEntries()).filter(isPublishable);
const requested = entries.filter((entry) => normalizeChannels(entry.data.channels).includes("wechat_mp"));
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });

if (requested.length === 0) {
  console.log("Skipping WeChat Official Account: no publishable content requested wechat_mp.");
  process.exit(0);
}

function absoluteUrl(url) {
  const baseUrl = process.env.SITE_BASE_URL || "https://icyzhao.com";
  return new URL(url, baseUrl).toString();
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function hasSshPublisherConfig() {
  return Boolean(
    process.env.WECHAT_PUBLISHER_HOST &&
      process.env.WECHAT_PUBLISHER_SSH_KEY,
  );
}

function entryToPayload(entry) {
  return {
    slug: entry.data.slug,
    title: entry.data.title,
    digest: entry.data.summary || "",
    source_url: absoluteUrl(entry.url),
    publish: entry.data.wechat_mp?.publish === true,
    cover_url: entry.data.wechat_mp?.cover_url || entry.data.cover_url || null,
    thumb_media_id: entry.data.wechat_mp?.thumb_media_id || null,
    content_html: markdown.render(entry.body),
    content_markdown: entry.body,
    relative_path: entry.relativePath,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";

    if (options.input !== undefined) {
      child.stdin?.end(options.input);
    }
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function publishViaSsh() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "wechat-publisher-"));
  const keyPath = path.join(tempDir, "ssh_key");
  const user = process.env.WECHAT_PUBLISHER_USER || "ubuntu";
  const host = process.env.WECHAT_PUBLISHER_HOST;
  const port = process.env.WECHAT_PUBLISHER_PORT || "22";
  const remotePath = process.env.WECHAT_PUBLISHER_PATH || "/home/ubuntu/icyzhao-wechat-publisher";
  const payload = JSON.stringify({ items: requested.map(entryToPayload) });

  try {
    await writeFile(keyPath, `${process.env.WECHAT_PUBLISHER_SSH_KEY.trim()}\n`, { mode: 0o600 });
    await run("ssh", [
      "-i",
      keyPath,
      "-p",
      port,
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=accept-new",
      `${user}@${host}`,
      `cd ${shellQuote(remotePath)} && node bin/publish-wechat.mjs`,
    ], {
      input: payload,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (hasSshPublisherConfig()) {
  await publishViaSsh();
  process.exit(0);
}

const hasCredentials = Boolean(process.env.WECHAT_MP_APP_ID && process.env.WECHAT_MP_APP_SECRET);
let failures = 0;

for (const entry of requested) {
  const shouldPublish = entry.data.wechat_mp?.publish === true;
  if (!hasCredentials) {
    const action = shouldPublish ? "publish" : "draft";
    console.warn(`${entry.relativePath}: cannot create WeChat ${action}; WECHAT_MP_APP_ID or WECHAT_MP_APP_SECRET is missing.`);
    if (shouldPublish) failures += 1;
    continue;
  }

  const action = shouldPublish ? "publish" : "draft";
  console.log(`${entry.relativePath}: WeChat ${action} requested. API adapter will be implemented after credentials are configured.`);
  if (shouldPublish) failures += 1;
}

if (failures > 0) {
  console.error("WeChat channel publishing has requested publish actions that could not be completed.");
  process.exit(1);
}

console.log(`WeChat channel check completed (${requested.length} requested item${requested.length === 1 ? "" : "s"}).`);

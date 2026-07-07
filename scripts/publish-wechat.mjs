#!/usr/bin/env node
import { loadContentEntries, isPublishable, normalizeChannels } from "./lib/content.mjs";

const entries = (await loadContentEntries()).filter(isPublishable);
const requested = entries.filter((entry) => normalizeChannels(entry.data.channels).includes("wechat_mp"));

if (requested.length === 0) {
  console.log("Skipping WeChat Official Account: no publishable content requested wechat_mp.");
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


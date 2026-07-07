import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { listFiles } from "./files.mjs";

export const CONTENT_ROOTS = ["content/ideas", "content/notion"];
export const VALID_TYPES = new Set(["note", "essay", "project", "link", "now"]);
export const VALID_LANGUAGES = new Set(["en", "zh"]);
export const VALID_STATUSES = new Set(["inbox", "draft", "ready", "published", "archived"]);
export const VALID_VISIBILITIES = new Set(["public", "unlisted", "private"]);
export const VALID_CHANNELS = new Set(["site", "wechat_mp"]);

export function normalizeStatus(status) {
  return String(status || "draft").trim().toLowerCase();
}

export function normalizeVisibility(visibility) {
  return String(visibility || "public").trim().toLowerCase();
}

export function normalizeChannels(channels) {
  if (!channels) return ["site"];
  if (Array.isArray(channels)) return channels.map((channel) => String(channel).trim()).filter(Boolean);
  return [String(channels).trim()].filter(Boolean);
}

export function isPublishable(entry) {
  const status = normalizeStatus(entry.data.status);
  const visibility = normalizeVisibility(entry.data.visibility);
  return ["ready", "published"].includes(status) && visibility !== "private";
}

export function urlForContent(data) {
  if (data.type === "now") return "/now/";
  if (data.type === "essay") return `/writing/${data.slug}/`;
  if (data.type === "project") return `/projects/${data.slug}/`;
  if (data.type === "link") return `/links/${data.slug}/`;
  return `/notes/${data.slug}/`;
}

export async function readContentFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  return {
    path: filePath,
    relativePath: path.relative(process.cwd(), filePath),
    data: parsed.data,
    body: parsed.content.trim(),
    url: parsed.data.slug ? urlForContent(parsed.data) : undefined,
  };
}

export async function listContentFiles() {
  const nested = await Promise.all(
    CONTENT_ROOTS.map((root) => listFiles(root, (filePath) => filePath.endsWith(".md"))),
  );
  return nested.flat().sort();
}

export async function loadContentEntries() {
  const files = await listContentFiles();
  return Promise.all(files.map((filePath) => readContentFile(filePath)));
}

export function validateEntry(entry) {
  const errors = [];
  const data = entry.data;
  const channels = normalizeChannels(data.channels);
  const status = normalizeStatus(data.status);
  const visibility = normalizeVisibility(data.visibility);

  if (!data.title || typeof data.title !== "string") errors.push("missing string title");
  if (!data.slug || typeof data.slug !== "string") errors.push("missing string slug");
  if (typeof data.slug === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
    errors.push("slug must use lowercase kebab-case");
  }

  if (!VALID_TYPES.has(data.type)) errors.push(`type must be one of ${Array.from(VALID_TYPES).join(", ")}`);
  if (!VALID_LANGUAGES.has(data.language)) {
    errors.push(`language must be one of ${Array.from(VALID_LANGUAGES).join(", ")}`);
  }
  if (!VALID_STATUSES.has(status)) {
    errors.push(`status must be one of ${Array.from(VALID_STATUSES).join(", ")}`);
  }
  if (!VALID_VISIBILITIES.has(visibility)) {
    errors.push(`visibility must be one of ${Array.from(VALID_VISIBILITIES).join(", ")}`);
  }

  const invalidChannels = channels.filter((channel) => !VALID_CHANNELS.has(channel));
  if (invalidChannels.length > 0) errors.push(`unknown channels: ${invalidChannels.join(", ")}`);

  if (channels.includes("wechat_mp") && typeof data.wechat_mp?.publish !== "boolean") {
    errors.push("wechat_mp.publish must be true or false when channel includes wechat_mp");
  }

  if (data.type === "project" && data.project_url && typeof data.project_url !== "string") {
    errors.push("project_url must be a string when present");
  }
  if (data.type === "project" && data.repo_url && typeof data.repo_url !== "string") {
    errors.push("repo_url must be a string when present");
  }

  return errors;
}

export function groupEntriesByType(entries) {
  return entries.reduce((groups, entry) => {
    const type = entry.data.type || "note";
    groups[type] ||= [];
    groups[type].push(entry);
    return groups;
  }, {});
}


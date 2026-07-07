#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { pathExists } from "./lib/files.mjs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const NOTION_VERSION = process.env.NOTION_VERSION || "2022-06-28";
const OUTPUT_DIR = "content/notion";

if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.log("Skipping Notion import: NOTION_TOKEN or NOTION_DATABASE_ID is not set.");
  process.exit(0);
}

async function notionRequest(endpoint, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
      ...options.headers,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Notion request failed: ${payload.message || response.status}`);
  }
  return payload;
}

function plainText(richText = []) {
  return richText.map((text) => text.plain_text || "").join("");
}

function propertyValue(properties, name) {
  const property = properties[name];
  if (!property) return undefined;

  if (property.type === "title") return plainText(property.title);
  if (property.type === "rich_text") return plainText(property.rich_text);
  if (property.type === "select") return property.select?.name;
  if (property.type === "status") return property.status?.name;
  if (property.type === "multi_select") return property.multi_select.map((item) => item.name);
  if (property.type === "checkbox") return property.checkbox;
  if (property.type === "date") return property.date?.start;
  if (property.type === "url") return property.url;
  return undefined;
}

function firstTitle(properties) {
  const titleProperty = Object.values(properties).find((property) => property.type === "title");
  return titleProperty ? plainText(titleProperty.title) : "";
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function richTextToMarkdown(richText = []) {
  return richText
    .map((text) => {
      let value = text.plain_text || "";
      if (text.href) value = `[${value}](${text.href})`;
      if (text.annotations?.code) value = `\`${value}\``;
      if (text.annotations?.bold) value = `**${value}**`;
      if (text.annotations?.italic) value = `_${value}_`;
      if (text.annotations?.strikethrough) value = `~~${value}~~`;
      return value;
    })
    .join("");
}

function fileObjectUrl(fileObject) {
  if (!fileObject) return undefined;
  if (fileObject.type === "external") return fileObject.external?.url;
  if (fileObject.type === "file") return fileObject.file?.url;
  return undefined;
}

async function queryReadyPages() {
  const pages = [];
  let startCursor;

  do {
    const payload = await notionRequest(`/databases/${NOTION_DATABASE_ID}/query`, {
      method: "POST",
      body: JSON.stringify({
        page_size: 50,
        start_cursor: startCursor,
      }),
    });

    pages.push(...payload.results);
    startCursor = payload.has_more ? payload.next_cursor : undefined;
  } while (startCursor);

  return pages.filter((page) => propertyValue(page.properties, "Status") === "Ready");
}

async function listBlockChildren(blockId) {
  const blocks = [];
  let startCursor;

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (startCursor) query.set("start_cursor", startCursor);
    const payload = await notionRequest(`/blocks/${blockId}/children?${query.toString()}`);
    blocks.push(...payload.results);
    startCursor = payload.has_more ? payload.next_cursor : undefined;
  } while (startCursor);

  return blocks;
}

async function blockToMarkdown(block, depth = 0) {
  const indent = "  ".repeat(depth);
  const type = block.type;
  const data = block[type];
  let current = "";

  if (type === "paragraph") current = richTextToMarkdown(data.rich_text);
  if (type === "heading_1") current = `# ${richTextToMarkdown(data.rich_text)}`;
  if (type === "heading_2") current = `## ${richTextToMarkdown(data.rich_text)}`;
  if (type === "heading_3") current = `### ${richTextToMarkdown(data.rich_text)}`;
  if (type === "bulleted_list_item") current = `${indent}- ${richTextToMarkdown(data.rich_text)}`;
  if (type === "numbered_list_item") current = `${indent}1. ${richTextToMarkdown(data.rich_text)}`;
  if (type === "quote") current = `> ${richTextToMarkdown(data.rich_text)}`;
  if (type === "divider") current = "---";
  if (type === "to_do") current = `${indent}- [${data.checked ? "x" : " "}] ${richTextToMarkdown(data.rich_text)}`;
  if (type === "code") {
    current = `\`\`\`${data.language || ""}\n${plainText(data.rich_text)}\n\`\`\``;
  }
  if (type === "image") {
    const source = data.type === "external" ? data.external.url : data.file.url;
    current = `![${plainText(data.caption) || ""}](${source})`;
  }
  if (type === "bookmark") current = data.url;
  if (!current && type !== "unsupported") current = `<!-- Unsupported Notion block: ${type} -->`;

  if (!block.has_children) return current;
  const children = await listBlockChildren(block.id);
  const childMarkdown = await Promise.all(children.map((child) => blockToMarkdown(child, depth + 1)));
  return [current, childMarkdown.filter(Boolean).join("\n")].filter(Boolean).join("\n");
}

async function pageToMarkdown(page) {
  const properties = page.properties;
  const title = propertyValue(properties, "Title") || firstTitle(properties);
  const slug = propertyValue(properties, "Slug") || slugify(title);
  const channels = propertyValue(properties, "Channels") || ["site"];
  const wechatCoverUrl = propertyValue(properties, "WeChat Cover URL") || fileObjectUrl(page.cover);
  const blocks = await listBlockChildren(page.id);
  const bodyParts = await Promise.all(blocks.map((block) => blockToMarkdown(block)));
  const body = bodyParts.filter(Boolean).join("\n\n");
  const tags = propertyValue(properties, "Tags") || [];

  return {
    slug,
    frontMatter: {
      title,
      slug,
      type: String(propertyValue(properties, "Type") || "note").toLowerCase(),
      language: propertyValue(properties, "Language") || "en",
      status: "ready",
      summary: propertyValue(properties, "Summary") || "",
      tags,
      channels,
      wechat_mp: {
        publish: Boolean(propertyValue(properties, "WeChat Publish")),
        cover_url: wechatCoverUrl || null,
        thumb_media_id: propertyValue(properties, "WeChat Thumb Media ID") || null,
      },
      visibility: propertyValue(properties, "Visibility") || "public",
      published_at: propertyValue(properties, "Published At") || null,
      updated_at: propertyValue(properties, "Updated At") || page.last_edited_time,
      source: "notion",
      notion: {
        page_id: page.id,
        last_edited_time: page.last_edited_time,
      },
    },
    body,
  };
}

async function assertSafeWrite(filePath, pageId) {
  if (!(await pathExists(filePath))) return;
  const existing = matter(await fs.readFile(filePath, "utf8"));
  if (existing.data.source !== "notion" || existing.data.notion?.page_id !== pageId) {
    throw new Error(`Refusing to overwrite non-matching file: ${filePath}`);
  }
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const pages = await queryReadyPages();

for (const page of pages) {
  const converted = await pageToMarkdown(page);
  const filePath = path.join(OUTPUT_DIR, `${converted.slug}.md`);
  await assertSafeWrite(filePath, page.id);
  await fs.writeFile(filePath, matter.stringify(`${converted.body}\n`, converted.frontMatter));
}

console.log(`Imported ${pages.length} Ready Notion page${pages.length === 1 ? "" : "s"}.`);

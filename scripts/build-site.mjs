#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import {
  groupEntriesByType,
  isPublishable,
  loadContentEntries,
  normalizeVisibility,
  urlForContent,
} from "./lib/content.mjs";
import { readJsonIfExists } from "./lib/files.mjs";

const PUBLIC_DIR = "public";
const SITE_BASE_URL = process.env.SITE_BASE_URL || "https://icyzhao.com";
const SITE_TITLE = process.env.SITE_TITLE || "Chenyang Zhao";
const SITE_DESCRIPTION = process.env.SITE_DESCRIPTION || "Writing, projects, and notes.";
const CUSTOM_DOMAIN = process.env.SITE_CUSTOM_DOMAIN || new URL(SITE_BASE_URL).hostname;

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function absoluteUrl(relativeUrl) {
  return new URL(relativeUrl, SITE_BASE_URL).toString();
}

function pageShell({ title, description = SITE_DESCRIPTION, body, language = "en", canonicalPath = "/" }) {
  const fullTitle = title === SITE_TITLE ? SITE_TITLE : `${title} | ${SITE_TITLE}`;
  return `<!doctype html>
<html lang="${escapeHtml(language)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(absoluteUrl(canonicalPath))}">
    <link rel="stylesheet" href="/assets/site.css">
    <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_TITLE)}" href="/feed.xml">
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/">${escapeHtml(SITE_TITLE)}</a>
      <nav aria-label="Primary navigation">
        <a href="/writing/">Writing</a>
        <a href="/notes/">Notes</a>
        <a href="/projects/">Projects</a>
      </nav>
    </header>
    <main>
${body}
    </main>
  </body>
</html>
`;
}

function dateText(entry) {
  const value = entry.data.published_at || entry.data.updated_at;
  if (!value) return "";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function entryCard(entry) {
  const summary = entry.data.summary ? `<p>${escapeHtml(entry.data.summary)}</p>` : "";
  const date = dateText(entry);
  const meta = date ? `<time datetime="${escapeHtml(entry.data.published_at || entry.data.updated_at)}">${escapeHtml(date)}</time>` : "";
  return `<article class="entry">
  <h3><a href="${escapeHtml(entry.url)}">${escapeHtml(entry.data.title)}</a></h3>
  ${summary}
  ${meta}
</article>`;
}

function entriesList(entries, emptyText) {
  if (entries.length === 0) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<div class="entry-list">${entries.map(entryCard).join("\n")}</div>`;
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const aDate = new Date(a.data.published_at || a.data.updated_at || 0).getTime();
    const bDate = new Date(b.data.published_at || b.data.updated_at || 0).getTime();
    return bDate - aDate || a.data.title.localeCompare(b.data.title);
  });
}

function domainMap(subdomains) {
  const entries = subdomains.entries || [];
  if (entries.length === 0) return `<p class="muted">No public subdomains are registered yet.</p>`;
  const groups = Map.groupBy(entries, (entry) => entry.category || "uncategorized");
  return Array.from(groups.entries())
    .map(([category, groupEntries]) => `<section class="domain-group">
  <h3>${escapeHtml(category)}</h3>
  <ul>
    ${groupEntries
      .map((entry) => `<li><a href="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</a>${entry.description ? `<span>${escapeHtml(entry.description)}</span>` : ""}</li>`)
      .join("\n    ")}
  </ul>
</section>`)
    .join("\n");
}

async function writePage(relativePath, html) {
  const filePath = path.join(PUBLIC_DIR, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, html);
}

async function writeContentPage(entry) {
  const html = markdown.render(entry.body);
  const body = `      <article class="content-page">
        <header>
          <p class="eyebrow">${escapeHtml(entry.data.type)}</p>
          <h1>${escapeHtml(entry.data.title)}</h1>
          ${entry.data.summary ? `<p class="summary">${escapeHtml(entry.data.summary)}</p>` : ""}
        </header>
        <div class="prose">
${html}
        </div>
      </article>`;
  const outputPath = path.join(entry.url.replace(/^\/|\/$/g, ""), "index.html");
  await writePage(outputPath, pageShell({
    title: entry.data.title,
    description: entry.data.summary || SITE_DESCRIPTION,
    body,
    language: entry.data.language || "en",
    canonicalPath: entry.url,
  }));
}

async function writeIndex(entries, subdomains) {
  const recent = sortEntries(entries).slice(0, 8);
  const grouped = groupEntriesByType(entries);
  const body = `      <section class="intro">
        <p class="eyebrow">icyzhao.com</p>
        <h1>${escapeHtml(SITE_TITLE)}</h1>
        <p>${escapeHtml(SITE_DESCRIPTION)}</p>
      </section>

      <section>
        <div class="section-heading">
          <h2>Recent</h2>
          <a href="/notes/">All notes</a>
        </div>
        ${entriesList(recent, "No published writing yet.")}
      </section>

      <section>
        <div class="section-heading">
          <h2>Projects</h2>
          <a href="/projects/">All projects</a>
        </div>
        ${entriesList(sortEntries(grouped.project || []).slice(0, 4), "No published projects yet.")}
      </section>

      <section>
        <div class="section-heading">
          <h2>Domain Map</h2>
        </div>
        <div class="domain-map">
          ${domainMap(subdomains)}
        </div>
      </section>`;

  await writePage("index.html", pageShell({ title: SITE_TITLE, body }));
}

async function writeCollectionPage({ title, pathPrefix, entries, emptyText }) {
  const body = `      <section class="collection">
        <h1>${escapeHtml(title)}</h1>
        ${entriesList(sortEntries(entries), emptyText)}
      </section>`;
  await writePage(`${pathPrefix}/index.html`, pageShell({ title, body, canonicalPath: `/${pathPrefix}/` }));
}

function feedXml(entries) {
  const items = sortEntries(entries)
    .slice(0, 20)
    .map((entry) => `<item>
      <title>${escapeHtml(entry.data.title)}</title>
      <link>${escapeHtml(absoluteUrl(entry.url))}</link>
      <guid>${escapeHtml(absoluteUrl(entry.url))}</guid>
      ${entry.data.summary ? `<description>${escapeHtml(entry.data.summary)}</description>` : ""}
      ${entry.data.published_at ? `<pubDate>${new Date(entry.data.published_at).toUTCString()}</pubDate>` : ""}
    </item>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(SITE_TITLE)}</title>
    <link>${escapeHtml(SITE_BASE_URL)}</link>
    <description>${escapeHtml(SITE_DESCRIPTION)}</description>
${items}
  </channel>
</rss>
`;
}

function sitemapXml(entries) {
  const urls = ["/", "/writing/", "/notes/", "/projects/", ...entries.map((entry) => entry.url)];
  return `<?xml version="1.0" encoding="UTF-8" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeHtml(absoluteUrl(url))}</loc></url>`).join("\n")}
</urlset>
`;
}

async function writeAssets() {
  await writePage("assets/site.css", `:root {
  color-scheme: light;
  --bg: #fafafa;
  --text: #1f2933;
  --muted: #667085;
  --line: #d8dee4;
  --accent: #0f766e;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

a {
  color: var(--accent);
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
}

.site-header,
main {
  width: min(920px, calc(100% - 32px));
  margin: 0 auto;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 0;
  border-bottom: 1px solid var(--line);
}

.brand {
  color: var(--text);
  font-weight: 700;
  text-decoration: none;
}

nav {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

nav a {
  color: var(--muted);
  text-decoration: none;
}

main {
  padding: 44px 0 80px;
}

section + section {
  margin-top: 56px;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  max-width: 760px;
  font-size: clamp(2.25rem, 8vw, 4.5rem);
  line-height: 1;
  letter-spacing: 0;
  margin-bottom: 18px;
}

h2 {
  font-size: 1.35rem;
  line-height: 1.2;
}

h3 {
  font-size: 1.05rem;
  line-height: 1.3;
  margin-bottom: 8px;
}

.intro p:last-child,
.summary {
  max-width: 680px;
  color: var(--muted);
  font-size: 1.08rem;
}

.eyebrow {
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.entry-list {
  display: grid;
  gap: 14px;
}

.entry {
  padding: 18px 0;
  border-top: 1px solid var(--line);
}

.entry p {
  color: var(--muted);
  margin-bottom: 8px;
}

time,
.muted {
  color: var(--muted);
}

.domain-map {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.domain-group {
  margin: 0;
}

.domain-group ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.domain-group li {
  padding: 10px 0;
  border-top: 1px solid var(--line);
}

.domain-group span {
  display: block;
  color: var(--muted);
}

.content-page {
  max-width: 760px;
}

.prose {
  margin-top: 36px;
}

.prose img {
  max-width: 100%;
  height: auto;
}

.prose pre {
  overflow-x: auto;
  padding: 16px;
  background: #111827;
  color: #f9fafb;
}

@media (max-width: 640px) {
  .site-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
`);
}

const allEntries = await loadContentEntries();
const entries = allEntries
  .filter(isPublishable)
  .filter((entry) => ["public", "unlisted"].includes(normalizeVisibility(entry.data.visibility)))
  .map((entry) => ({
    ...entry,
    url: urlForContent(entry.data),
  }));
const subdomains = await readJsonIfExists("data/subdomains.generated.json", { entries: [] });
const grouped = groupEntriesByType(entries);

await fs.rm(PUBLIC_DIR, { recursive: true, force: true });
await fs.mkdir(PUBLIC_DIR, { recursive: true });

await writeAssets();
await writeIndex(entries, subdomains);
await writeCollectionPage({
  title: "Writing",
  pathPrefix: "writing",
  entries: grouped.essay || [],
  emptyText: "No published essays yet.",
});
await writeCollectionPage({
  title: "Notes",
  pathPrefix: "notes",
  entries: grouped.note || [],
  emptyText: "No published notes yet.",
});
await writeCollectionPage({
  title: "Projects",
  pathPrefix: "projects",
  entries: grouped.project || [],
  emptyText: "No published projects yet.",
});

for (const entry of entries) await writeContentPage(entry);

await writePage("feed.xml", feedXml(entries));
await writePage("sitemap.xml", sitemapXml(entries));
await writePage("robots.txt", `User-agent: *
Allow: /

Sitemap: ${absoluteUrl("/sitemap.xml")}
`);
await writePage("CNAME", `${CUSTOM_DOMAIN}\n`);

console.log(`Built ${PUBLIC_DIR}/ with ${entries.length} publishable content file${entries.length === 1 ? "" : "s"}.`);

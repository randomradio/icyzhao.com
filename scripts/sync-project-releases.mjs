#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { isPublishable, loadContentEntries, normalizeVisibility, urlForContent } from "./lib/content.mjs";
import { writeJson } from "./lib/files.mjs";
import { githubRepoFromUrl } from "./lib/projects.mjs";

const OUTPUT_PATH = "data/projects.generated.json";
const GITHUB_API = "https://api.github.com";
const GITHUB_TOKEN = githubToken();

function githubToken() {
  const envToken = process.env.PROJECTS_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) return envToken;

  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
  };
}

async function githubRequest(path, { allowMissing = false } = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(),
  });

  if (allowMissing && response.status === 404) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 && path.startsWith("/repos/")) {
      throw new Error(`GitHub repository is missing or not accessible: ${path}. For private repos, set PROJECTS_GITHUB_TOKEN with read access.`);
    }
    throw new Error(`GitHub request failed for ${path}: ${payload.message || response.status}`);
  }
  return payload;
}

function releaseData(release) {
  if (!release) return null;
  return {
    tag_name: release.tag_name,
    name: release.name || release.tag_name,
    html_url: release.html_url,
    published_at: release.published_at,
    body: release.body || "",
    assets: (release.assets || []).map((asset) => ({
      name: asset.name,
      url: asset.browser_download_url,
      content_type: asset.content_type,
      size: asset.size,
      download_count: asset.download_count,
    })),
  };
}

function tagData(tag, repo) {
  if (!tag) return null;
  return {
    name: tag.name,
    html_url: `https://github.com/${repo.full_name}/tree/${tag.name}`,
  };
}

async function projectReleaseData(entry) {
  const repo = githubRepoFromUrl(entry.data.repo_url);
  if (!repo) {
    return {
      slug: entry.data.slug,
      title: entry.data.title,
      url: urlForContent(entry.data),
      repo_url: entry.data.repo_url || null,
      project_url: entry.data.project_url || null,
      repo: null,
      latest_release: null,
      latest_tag: null,
    };
  }

  const repoPath = `/repos/${repo.owner}/${repo.name}`;
  const [repository, latestRelease] = await Promise.all([
    githubRequest(repoPath),
    githubRequest(`${repoPath}/releases/latest`, { allowMissing: true }),
  ]);
  const tags = latestRelease ? [] : await githubRequest(`${repoPath}/tags?per_page=1`, { allowMissing: true });

  return {
    slug: entry.data.slug,
    title: entry.data.title,
    url: urlForContent(entry.data),
    repo_url: repository.html_url,
    project_url: entry.data.project_url || repository.homepage || null,
    repo: {
      full_name: repository.full_name,
      description: repository.description || "",
      homepage: repository.homepage || "",
      html_url: repository.html_url,
      topics: repository.topics || [],
    },
    latest_release: releaseData(latestRelease),
    latest_tag: tagData(tags?.[0], repo),
  };
}

const allEntries = await loadContentEntries();
const projectEntries = allEntries
  .filter((entry) => entry.data.type === "project")
  .filter(isPublishable)
  .filter((entry) => ["public", "unlisted"].includes(normalizeVisibility(entry.data.visibility)))
  .sort((a, b) => a.data.title.localeCompare(b.data.title));

const entries = [];
for (const entry of projectEntries) {
  entries.push(await projectReleaseData(entry));
}

await writeJson(OUTPUT_PATH, {
  generated_at: new Date().toISOString(),
  source: "github",
  entries,
});

console.log(`Generated ${OUTPUT_PATH} (${entries.length} project${entries.length === 1 ? "" : "s"}).`);

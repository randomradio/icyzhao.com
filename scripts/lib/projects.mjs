export function githubRepoFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const shorthand = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand) return repoParts(shorthand[1], shorthand[2]);

  const ssh = raw.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (ssh) return repoParts(ssh[1], ssh[2]);

  let parsed;
  try {
    parsed = new URL(raw.startsWith("github.com/") ? `https://${raw}` : raw);
  } catch {
    return null;
  }

  if (parsed.hostname !== "github.com") return null;

  const [owner, repo] = parsed.pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 2);

  if (!owner || !repo) return null;
  return repoParts(owner, repo);
}

function repoParts(owner, repo) {
  const name = repo.replace(/\.git$/, "");
  return {
    owner,
    name,
    full_name: `${owner}/${name}`,
  };
}

export function projectDataBySlug(projects) {
  return new Map((projects.entries || []).map((project) => [project.slug, project]));
}

# Publishing Automation

## Recommended First Architecture

Use a static-site pipeline with Git as the published source.

```text
Notion
  -> importer script
  -> Markdown in Git
  -> CI build
  -> static host
  -> optional channel publishers
```

Hugo is the lowest-risk first choice because the current live site already uses Hugo/PaperMod. Astro is a good later option if the homepage and project pages need more custom interaction.

## Environment Variables

Automation uses these names:

```text
NOTION_TOKEN=
NOTION_DATABASE_ID=
NOTION_PROJECTS_DATABASE_ID=
NOTION_DATABASE_IDS=
NOTION_VERSION=2022-06-28
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
SITE_BASE_URL=https://icyzhao.com
SITE_CUSTOM_DOMAIN=icyzhao.com
SITE_TITLE=Chenyang Zhao
SITE_DESCRIPTION=Writing, projects, and notes.
GITHUB_TOKEN=
PROJECTS_GITHUB_TOKEN=
WECHAT_MP_APP_ID=
WECHAT_MP_APP_SECRET=
```

## Commands

```text
npm run import:notion
npm run validate:content
npm run sync:projects
npm run discover:subdomains
npm run build
npm run publish:wechat
npm run publish
```

`publish` should run the importer, content validation, project release sync, and subdomain discovery before the static build. Channel publishers should run after the site URL exists, because they may need canonical links.

`NOTION_DATABASE_ID` keeps the original content database working. `NOTION_PROJECTS_DATABASE_ID` adds a separate project database, and `NOTION_DATABASE_IDS` can be used for a comma-separated list when more databases are needed.

## CI Flow

The GitHub Actions workflow in `.github/workflows/publish.yml` runs on pushes to `main`, manual dispatch, and a scheduled pull.

1. Install dependencies.
2. Import `Ready` Notion pages from configured Notion databases if secrets are available.
3. Validate front matter, URL collisions, and requested channels.
4. Commit generated Notion Markdown back to `content/notion/` when it changed.
5. Sync project release metadata from GitHub for project pages with `Repo URL`.
6. Discover subdomains if Cloudflare secrets are available.
7. Build the static site.
8. Deploy to GitHub Pages.
9. Check optional channels only when explicitly requested by content metadata.

## Project Release Sync

Project pages are created in Notion or local Markdown with `type: project` and a GitHub `repo_url`.

The sync step reads publishable project content, fetches repository metadata and the latest GitHub Release, and writes `data/projects.generated.json` for the static build. This keeps project descriptions and release notes current without letting each tool repository commit directly to the site.

Public repositories can use the workflow's default `GITHUB_TOKEN`. Private or cross-repository projects need `PROJECTS_GITHUB_TOKEN` with read access to those repositories.

## Optional WeChat Official Account Flow

The WeChat Official Account should not be part of every publish. It is a channel adapter that runs only when the content asks for it.

Recommended behavior:

- Default channel list is `site`.
- `wechat_mp` must be explicitly present in Notion `Channels` or repo front matter.
- The workflow creates a WeChat draft unless a separate publish gate is true.
- The workflow records the WeChat URL or draft result back to Notion or Git metadata.
- If WeChat publishing fails, the main site deployment should remain successful and the channel failure should be reported separately.

Current implementation status:

- Channel gating is implemented.
- Missing WeChat credentials are reported clearly.
- The real WeChat API adapter is intentionally not implemented until credentials and account behavior are verified.

## Guardrails

- The importer should be idempotent.
- The importer should not overwrite locally edited Markdown unless the front matter says it is generated.
- Generated files should include source IDs, timestamps, and stable slugs.
- Publishing should fail loudly if two pages resolve to the same URL.
- Optional channel publishing should be opt-in and idempotent.

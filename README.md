# icyzhao.com

This repo is the source of truth for `icyzhao.com`.

The live site is published by GitHub Pages from this repository. Content can be written as local Markdown or drafted in Notion and imported by the publishing workflow.

## Working Assumptions

- Use Markdown in Git as the canonical published format.
- Use Notion as a capture and drafting surface, not as the only long-term archive.
- Prefer a small static-site pipeline that keeps the generator replaceable.
- Automate subdomain navigation from DNS discovery plus a small local registry for human-readable metadata.

## Success Criteria

- Any idea can start in Notion or a local Markdown note.
- A publishable piece has clear metadata, a stable slug, and a predictable URL.
- Publishing is a repeatable command or CI workflow, not a manual copy-paste ritual.
- Main-site navigation can discover active subdomains automatically.
- Human curation is reserved for meaning: title, description, category, and visibility.

## Documents

- [Site Direction](docs/01-site-direction.md)
- [Content Workflow](docs/02-content-workflow.md)
- [Publishing Automation](docs/03-publishing-automation.md)
- [Subdomain Navigation](docs/04-subdomain-navigation.md)
- [Publishing Flow Diagram](docs/diagrams/publishing-flow.puml)
- [Roadmap](docs/05-roadmap.md)

## Commands

```bash
npm run publish
```

This imports Notion content when credentials exist, validates content, enriches project pages with GitHub release metadata, discovers subdomains when Cloudflare credentials exist, and builds `public/`.

```bash
npm run publish:wechat
```

This checks the optional WeChat Official Account channel. It only runs for publishable content that explicitly includes `wechat_mp`.

## Notion Publishing

Project publishing database: [Project Publishing](https://app.notion.com/p/cc7de304fd5249ca992624301408538c)

The GitHub Actions workflow imports Notion rows where `Status` is `Ready`. Required fields are:

- `Title`
- `Slug`
- `Status`
- `Type`
- `Language`
- `Channels`
- `Visibility`

For project pages, add:

- `Repo URL`
- `Project URL` (optional)

Set `Channels` to `site` for normal site publishing. Add `wechat_mp` and set `WeChat Publish` to checked only when the optional WeChat channel should run.

## Project Publishing

To publish a tool, add a Notion row with `Type` set to `project`, `Status` set to `Ready`, `Visibility` set to `public`, and `Channels` containing `site`.

The project table can live in its own Notion database. Set `NOTION_PROJECTS_DATABASE_ID` to that database ID, or put all content database IDs in `NOTION_DATABASE_IDS` as a comma-separated list.

If `Repo URL` points to a GitHub repository, the site publish workflow automatically pulls the repository description, latest GitHub Release, release notes, release URL, and downloadable assets into the project page. For private repositories, set a `PROJECTS_GITHUB_TOKEN` secret with read access to those repos.

WeChat publishing is routed through a fixed-IP SSH publisher at `/home/ubuntu/icyzhao-wechat-publisher` on the publishing server. GitHub Actions uses `WECHAT_PUBLISHER_*` secrets to run that remote CLI, so official-account API calls originate from the server IP instead of GitHub-hosted runner IPs.

WeChat covers are automatic. The publisher uses `WeChat Cover URL` or the Notion page cover when present, uploads it as a permanent image material, and caches the returned media id. If a piece has no cover, the publisher generates a deterministic fallback cover. `WeChat Thumb Media ID` is only for rare manual overrides.

## Initial Repository Shape

```text
content/
  ideas/              short local notes and publishable fragments
  notion/             generated Markdown exported from Notion
  templates/          starter front matter for different content types
data/
  subdomains.registry.example.json
docs/
  planning docs for the site and workflow
scripts/
  import, discovery, build, and publishing scripts
```

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

This imports Notion content when credentials exist, discovers subdomains when Cloudflare credentials exist, validates content, and builds `public/`.

```bash
npm run publish:wechat
```

This checks the optional WeChat Official Account channel. It only runs for publishable content that explicitly includes `wechat_mp`.

## Notion Publishing

Publishing database: [Articles](https://app.notion.com/p/3963f5fd592c81b79d6acbce33a702cc)

The GitHub Actions workflow imports Notion rows where `Status` is `Ready`. Required fields are:

- `Title`
- `Slug`
- `Status`
- `Type`
- `Language`
- `Channels`
- `Visibility`

Set `Channels` to `site` for normal site publishing. Add `wechat_mp` and set `WeChat Publish` to checked only when the optional WeChat channel should run.

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

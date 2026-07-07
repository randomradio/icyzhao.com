# icyzhao.com

This repo is the future source of truth for `icyzhao.com`.

The live site is currently a lightweight Hugo/PaperMod blog. This repository starts from a clean planning layer instead of copying the live site blindly, so the content model, publishing flow, and navigation automation can be designed first.

## Working Assumptions

- Keep the current public site stable while this repo becomes the new publishing workspace.
- Use Markdown in Git as the canonical published format.
- Use Notion as a capture and drafting surface, not as the only long-term archive.
- Prefer a small static-site pipeline first. Hugo remains the default because the live site already uses it, but the plan keeps the generator replaceable.
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
- [Roadmap](docs/05-roadmap.md)

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
  future import and discovery scripts
```


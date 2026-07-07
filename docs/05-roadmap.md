# Roadmap

## Phase 0 - Repository Foundation

Goal: make this folder a real project.

Verification:

- `git status` works.
- Planning docs exist.
- Content and data directories are ready.

## Phase 1 - Static Site Baseline

Goal: recreate the current blog locally with a small static-site setup.

Verification:

- Local build succeeds.
- Homepage renders recent posts.
- Existing public URLs can be preserved or redirected.

Initial implementation:

- `npm run publish` builds a static site into `public/`.
- Publishable Markdown is read from `content/ideas/` and `content/notion/`.
- GitHub Actions can deploy the generated site to GitHub Pages.

## Phase 2 - Content Loop

Goal: publish from either Notion or local Markdown.

Verification:

- A Notion page marked `Ready` becomes a Markdown file.
- A local note under `content/ideas/` appears on the site.
- Duplicate slugs fail the build.

## Phase 3 - Automated Domain Map

Goal: main-site navigation reflects active subdomains.

Verification:

- Cloudflare DNS records generate `data/subdomains.generated.json`.
- Registry metadata enriches generated entries.
- Hidden records do not appear publicly.

## Phase 4 - Deployment

Goal: publish with one Git push or one local command.

Verification:

- CI builds the site.
- CI deploys the site.
- The live homepage shows latest content and domain navigation.

# Publishing Automation

## Recommended First Architecture

Use a static-site pipeline with Git as the published source.

```text
Notion
  -> importer script
  -> Markdown in Git
  -> CI build
  -> static host
```

Hugo is the lowest-risk first choice because the current live site already uses Hugo/PaperMod. Astro is a good later option if the homepage and project pages need more custom interaction.

## Environment Variables

Future automation should use these names:

```text
NOTION_TOKEN=
NOTION_DATABASE_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
SITE_BASE_URL=https://icyzhao.com
```

## Commands To Add Later

```text
npm run import:notion
npm run discover:subdomains
npm run build
npm run publish
```

`publish` should run the importer and subdomain discovery before the static build.

## CI Flow

On push to the main branch:

1. Install dependencies.
2. Import `Ready` Notion pages if secrets are available.
3. Discover subdomains if Cloudflare secrets are available.
4. Build the static site.
5. Deploy to the chosen host.

## Guardrails

- The importer should be idempotent.
- The importer should not overwrite locally edited Markdown unless the front matter says it is generated.
- Generated files should include source IDs, timestamps, and stable slugs.
- Publishing should fail loudly if two pages resolve to the same URL.


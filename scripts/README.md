# Scripts

Available scripts:

- `npm run import:notion`: export Notion pages marked `Ready` into Markdown from configured Notion databases.
- `npm run sync:projects`: enrich project pages with GitHub repository and latest release metadata.
- `npm run discover:subdomains`: read Cloudflare DNS records when credentials are configured and write generated navigation data.
- `npm run validate:content`: check required front matter, duplicate slugs, URL collisions, and channel settings.
- `npm run build`: build the static site into `public/`.
- `npm run publish`: run the site publishing pipeline locally.
- `npm run publish:wechat`: check the optional WeChat Official Account channel.

Keep scripts idempotent. Generated files should be safe to rebuild.

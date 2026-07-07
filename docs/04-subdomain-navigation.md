# Subdomain Navigation

## Goal

The main site should show an up-to-date map of important subdomains under `icyzhao.com`.

DNS can tell us what exists. A local registry can tell visitors what each thing means.

## Data Sources

1. Cloudflare DNS records for automatic discovery.
2. `data/subdomains.registry.json` for optional metadata.

The generated output should be:

```text
data/subdomains.generated.json
```

## Discovery Rules

Include:

- `A`, `AAAA`, and `CNAME` records.
- Records ending in `.icyzhao.com`.
- Records not explicitly hidden by the registry.

Exclude by default:

- Root domain.
- `www`.
- Verification records.
- Internal preview or staging records unless opted in.

## Registry Fields

```json
{
  "name": "lab.icyzhao.com",
  "title": "Lab",
  "description": "Experiments and prototypes.",
  "category": "experiments",
  "visibility": "public",
  "order": 20
}
```

## Navigation Behavior

- Show public entries grouped by category.
- Use DNS name as fallback title when registry metadata is missing.
- Prefer explicit `order`, then alphabetical order.
- Mark newly discovered unregistered entries as `uncategorized`.

## Important Tradeoff

Pure DNS discovery is automatic but shallow. A registry adds a tiny bit of manual curation so the homepage stays understandable instead of becoming a raw infrastructure list.


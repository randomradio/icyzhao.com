# Content Workflow

## Principle

Capture should be effortless. Publishing should be deliberate but fast.

Notion is the drafting surface. Git Markdown is the published archive. The boundary between them is the export step.

## Notion Database

Create one Notion database for publishable material.

Recommended properties:

| Property | Type | Notes |
| --- | --- | --- |
| Title | Title | Public title |
| Slug | Text | Stable URL slug |
| Status | Select | `Inbox`, `Draft`, `Ready`, `Published`, `Archived` |
| Type | Select | `note`, `essay`, `project`, `link`, `now` |
| Language | Select | `en`, `zh` |
| Tags | Multi-select | Keep sparse |
| Summary | Text | Used for cards and feeds |
| Published At | Date | Set when published |
| Updated At | Date | Optional |
| Visibility | Select | `public`, `unlisted`, `private` |
| Channels | Multi-select | Default `site`; add `wechat_mp` only when the piece should go to the official account |
| WeChat Publish | Checkbox | Optional extra gate before sending to the official account |
| Canonical URL | URL | Filled after publish |
| WeChat URL | URL | Filled only when published to the official account |
| Repo URL | URL | Used by project pages to pull GitHub release metadata |
| Project URL | URL | Optional live product or documentation URL for project pages |

## Status Flow

```text
Inbox -> Draft -> Ready -> Published
                  \-> Archived
```

- `Inbox`: raw thought, not expected to be coherent.
- `Draft`: being shaped.
- `Ready`: can be exported and published.
- `Published`: exported to Git and live.
- `Archived`: kept in Notion but not part of the site.

## Publishing Flow

```text
Notion Ready pages
  -> export script
  -> Markdown files under content/notion/
  -> static site build
  -> deploy
```

Local notes can skip Notion:

```text
content/ideas/YYYY-MM-DD-slug.md
  -> static site build
  -> deploy
```

## Channels

The main site is the default channel. Other channels are opt-in per piece.

Recommended initial channels:

| Channel | Meaning | Default |
| --- | --- | --- |
| `site` | Publish to `icyzhao.com` | Yes |
| `wechat_mp` | Publish to a WeChat Official Account | No |

For Notion content, use the `Channels` property. For repo content, use front matter:

```yaml
channels:
  - site
wechat_mp:
  publish: false
```

The WeChat channel should be conservative: create a draft by default, and only publish when the content explicitly opts in.

## Project Publishing

Projects can use the same Notion database as notes and essays, or a separate Project Publishing database. When they live separately, set `NOTION_PROJECTS_DATABASE_ID` in the publish environment.

Required project fields:

| Property | Value |
| --- | --- |
| Type | `project` |
| Status | `Ready` |
| Visibility | `public` or `unlisted` |
| Channels | `site` |
| Repo URL | GitHub repository URL |

When a project has a GitHub `Repo URL`, the site publish workflow generates `data/projects.generated.json` with the repository description, latest release, release notes, release URL, and downloadable assets. The generated file is not committed; it is rebuilt during publishing.

## Editorial Rules

- A note can be small. It only needs one clear idea.
- Slugs should not change after publishing.
- Tags are for retrieval, not decoration.
- If a piece needs more than one afternoon of shaping, it is probably an essay rather than a note.

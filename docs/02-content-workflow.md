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
| Canonical URL | URL | Filled after publish |

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

## Editorial Rules

- A note can be small. It only needs one clear idea.
- Slugs should not change after publishing.
- Tags are for retrieval, not decoration.
- If a piece needs more than one afternoon of shaping, it is probably an essay rather than a note.


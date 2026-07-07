# icyzhao WeChat Publisher

This project runs on a fixed-IP server and receives publish payloads over SSH from GitHub Actions.

## Files

- `bin/health.mjs`: prints runtime and public egress IP.
- `bin/publish-wechat.mjs`: reads a JSON payload from stdin and creates WeChat drafts or publish jobs.
- `.env`: server-local secrets, never committed.

## Required Server Env

```bash
WECHAT_DRY_RUN=true
WECHAT_MP_APP_ID=
WECHAT_MP_APP_SECRET=
WECHAT_MP_DEFAULT_THUMB_MEDIA_ID=
WECHAT_MP_AUTHOR=Chenyang Zhao
```

Set `WECHAT_DRY_RUN=false` after the official account credentials are configured and `38.175.194.162` is in the WeChat Official Account IP allowlist.

Covers are automatic:

- Uses the article's `cover_url` when present.
- Falls back to a generated BMP cover.
- Uploads the cover as a permanent image material and caches the returned `media_id` in `.cache/wechat-thumb-media.json`.
- `WECHAT_MP_DEFAULT_THUMB_MEDIA_ID` is optional and only needed if you want to bypass automatic cover uploads.

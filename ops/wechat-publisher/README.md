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
WECHAT_MP_THUMB_MEDIA_ID=
WECHAT_MP_AUTHOR=Chenyang Zhao
```

Set `WECHAT_DRY_RUN=false` after the official account credentials and reusable cover `thumb_media_id` are configured.

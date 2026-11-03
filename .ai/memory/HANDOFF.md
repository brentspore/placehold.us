# Handoff

**State (2026-11-03):** Big service update built and verified locally, NOT yet pushed (check `git status`; if clean and origin has it, it shipped). What changed:
- Security: colors are validated hex only (a crafted color URL ran script on placehold.us, confirmed in Chrome). Image responses carry a CSP (`default-src 'none' ... sandbox`), nosniff and CORS `*`.
- Limits: max 3000x3000 output pixels, @2x/@3x included. Memory per render cut to one pixel copy.
- New: `.webp` (jsquash lossless), `transparent` background, `@2x`/`@3x`, `?font-size=`.
- Cache key is built from what gets drawn (`/__cache/v2/...`), so junk query strings can't force renders and pre-fix cached SVGs are retired.
- www + beta 301 to placehold.us (needs `assets.run_worker_first: true`; `dev.host` keeps wrangler dev from redirecting itself).
- SVG brand font fixed: fontkit subsets had no cmap, so every SVG showed Arial since June. Now HarfBuzz WOFF2 subsets. Font size formula unified across formats (see DECISIONS).
- Homepage: HTML5, no jQuery, docs for every option, alt text, privacy link, canonical, JSON-LD. New pink og.png and favicon set from `scripts/build-og.mjs`, used on both pages. Privacy page restyled (policy text unchanged).
- Config: compatibility_date 2026-06-01, `ratelimits` instead of `unsafe`.
- Second pass (same day, after an independent review): WebP capped at 1500x1500 (memory), renders serialized per isolate with a fresh WebP encoder each time, failed wasm init retried, control characters stripped from text, text capped at 500 chars / 20 lines, large-image rate limit (20/min over 1MP), IPv6 keyed per /64, cpu_ms 5000, workers.dev + preview URLs off, GA client id is a daily-rotating HMAC (keyed with GA_API_SECRET), ETag + 304, `immutable`, robots.txt now disallows /0-/9 only (favicons crawlable), full-coverage font subset for accented text. Privacy policy rewritten to match what the site does. Upgrades: wrangler 4.157, vitest 5, workers-types 5, TypeScript 7; npm audit clean.

**Run/verify:** `npm install`, `npm run dev`, then `npm test` and `npm run smoke` (or `-- http://localhost:PORT`). After pushing: `npm run smoke -- https://placehold.us`, check og.png in a share debugger.

**Done by the owner 2026-11-03:** GA Measurement Protocol API secret rotated (the old one is in public history, commit f3491d8) and the Worker's `GA_API_SECRET` updated. Privacy-page contact line points at brentspore.com until there is a contact address.

**Next:** Push, then run the live smoke test (the 3000x3000 WebP/GIF checks are the ones that can only fail in production, on memory).

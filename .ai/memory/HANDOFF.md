# Handoff

Last updated: 2026-11-03

**State:** Live (version 529d96e4, commit c291b13), live smoke test all green. Shipped today:
- Security: colors must be hex (a crafted color URL ran script on placehold.us); image responses carry CSP with sandbox, nosniff, CORS `*`. GA Measurement Protocol secret rotated by the owner (the old one is in public history, commit f3491d8).
- Limits: 3000x3000 max output (WebP 1500x1500, memory), text 500 chars / 20 lines, control characters stripped. Rate limits per IPv4 or IPv6 /64: 100 new images a minute, 20 a minute for raster over 1MP. cpu_ms 5000. Raster renders serialized per isolate. workers.dev + preview URLs off.
- Features: .webp, transparent background, @2x/@3x, ?font-size=.
- SVG brand font works again (old fontkit subsets had no cmap; now HarfBuzz WOFF2, with a full-coverage subset for accented text). One font-size formula for all formats.
- Cache key built from what is drawn (`/__cache/v2/...`), ETag + 304, immutable. www and beta 301 to placehold.us.
- GA client id is a daily-rotating HMAC (keyed with GA_API_SECRET).
- Site: new og.png + favicon set (scripts/build-og.mjs), homepage without jQuery, docs for every option, privacy policy rewritten to match reality (contact points at brentspore.com until there is an address).
- Tooling: vitest tests, smoke script; wrangler 4.157, vitest 5, workers-types 5, TypeScript 7; npm audit clean.

**Trap:** nothing deploys on push. Run `npm run deploy` after pushing. The green "pages build and deployment" check on GitHub is a leftover GitHub Pages site (brentspore.github.io/placehold.us, serves 404), not the Worker.

**Run/verify:** `npm install`; `npm run dev`; `npm test`; `npm run smoke` (local) or `npm run smoke -- https://placehold.us` (live; uses about 6 of the 20-a-minute large-image budget). Rebuild assets with `npm run build:og` and `npm run build:fonts`.

**Next:** Optional cleanup, owner's call: turn off the leftover GitHub Pages site (repo Settings > Pages), and detach the beta.placehold.us custom domain once nothing links to it (it only redirects now). Check GA Realtime shows `image_generated` events with the new secret.

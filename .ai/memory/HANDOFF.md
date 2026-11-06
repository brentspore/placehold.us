# Handoff

Last updated: 2026-11-05

**State:** Live (version c20de02e, commit 0bffa3e, 2026-11-05), live smoke test all green. 2026-11-05: removed the "New in November 2026" banner and the "How to customize" jump row. Shipped 2026-11-03:
- Security: colors must be hex (a crafted color URL ran script on placehold.us); image responses carry CSP with sandbox, nosniff, CORS `*`. GA Measurement Protocol secret rotated by the owner (the old one is in public history, commit f3491d8).
- Limits: 3000x3000 max output (WebP 1500x1500, memory), text 500 chars / 20 lines, control characters stripped. Rate limits per IPv4 or IPv6 /64: 100 new images a minute, 20 a minute for raster over 1MP. cpu_ms 5000. Raster renders serialized per isolate. workers.dev + preview URLs off.
- Features: .webp, transparent background, @2x/@3x, ?font-size=.
- SVG brand font works again (old fontkit subsets had no cmap; now HarfBuzz WOFF2, with a full-coverage subset for accented text). One font-size formula for all formats.
- Cache key built from what is drawn (`/__cache/v2/...`), ETag + 304, immutable. www 301s to placehold.us.
- GA client id is a daily-rotating HMAC (keyed with GA_API_SECRET).
- Cleanup: GitHub Pages site deleted; beta.placehold.us custom domain detached (DNS record gone). The Size panel states caching and per-visitor limits.
- Tip jar (public/tip-jar.js): same coffee-cup badge as One Page Toys/BuildUtilities, pink, to ko-fi.com/synergyprod; nudges once on a visitor's 3rd distinct visit day, 21-day cooldown, never after a click (localStorage `phu_tipjar_v1`, GA events tip_jar_click / tip_ask_shown). Also a footer Tip Jar link.
- "More from Synergy" strip: 4 of 7 dev/design sister sites, shuffled per visit (taglines copied from BuildUtilities' src/config/sister-sites.ts, which were checked against each site). Footer is "Free to use · Tip Jar · Privacy · Made by Synergy" (no personal name). Privacy contact is now hello@synergyprod.com, and the policy covers the tip jar's local storage and Ko-fi.
- Homepage layout: always-visible docs section (2 columns, stacked on phones) under a dotted divider; the old tab toggling is gone. Removed 2026-11-05: the "New in November 2026" strip and the "How to customize" jump-link row (it only jumped to just below itself).
- Site: new og.png + favicon set (scripts/build-og.mjs), homepage without jQuery, docs for every option, privacy policy rewritten to match reality.
- Tooling: vitest tests, smoke script; wrangler 4.157, vitest 5, workers-types 5, TypeScript 7; npm audit clean.

**Trap:** nothing deploys on push. Run `npm run deploy` after pushing (the old GitHub Pages build that made pushes look deployed was deleted 2026-11-03).

**Run/verify:** `npm install`; `npm run dev`; `npm test`; `npm run smoke` (local) or `npm run smoke -- https://placehold.us` (live; uses about 6 of the 20-a-minute large-image budget). Rebuild assets with `npm run build:og` and `npm run build:fonts`.

**Next:** Nothing owed. Open question from the owner (2026-11-03): watermark images and sell removal? Advised against (placeholders are temporary, free no-watermark rivals are one URL change away, and it would change images already embedded on other sites); suggested a tip link or paying for more (limits, sizes) instead. Owner chose a tip jar and no API for now (2026-11-03). Also check GA Realtime shows `image_generated` events with the new secret.

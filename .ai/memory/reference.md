---
name: Project reference
description: Commands, repo pointers, external systems, and operational notes
type: reference
---

- **Local repo:** ~/Personal Projects/placehold.us
- **Remote repo:** https://github.com/brentspore/placehold.us
- **Commands:** `npm run dev` (wrangler dev, :8787), `npm test` (vitest unit tests: URL grammar, colors, SVG safety, routing), `npm run smoke [-- URL]` (end-to-end against a running server; defaults to localhost:8787, pass https://placehold.us after a deploy), `npx tsc --noEmit`, `npm run build:fonts` (WOFF2 subsets into src/font-subsets.ts), `npm run build:og` (og.png + favicon set into public/). Deploy = `npm run deploy` (wrangler deploy) after pushing; nothing deploys on push.
- **Docker (local dev):** `docker compose up -d` → http://localhost:5129, `docker compose down` to stop. Runs this repo's `dev` script in a container over the live working tree, hot reload as with `start`; the first start installs dependencies into a Docker volume, later starts take seconds. Local only: `start` stays the everyday server and `git push` still deploys. Port from `~/.ai/skills/docker/ports.md`; details in the `docker` skill. (Added 2026-09-24.)
- **External systems:** Cloudflare Worker `placehold-us` (routes in `wrangler.jsonc`: beta.placehold.us custom domain, placehold.us/* and www.placehold.us/* zone routes; www and beta 301 to the apex in code; workers.dev and preview URLs are off since 2026-11-03). DNS on Cloudflare: apex A 192.0.2.1 proxied (originless placeholder, since 2026-10-26), www CNAME to apex proxied, beta AAAA 100:: proxied. No wildcard: other subdomains do not resolve. The old PHP origin (Plesk on Lightsail, 35.160.40.62) is gone.
- **Secrets/env:** `GA_API_SECRET` is a Worker secret in Cloudflare (GA4 Measurement Protocol for image events). `GA_MEASUREMENT_ID` is a plain var in wrangler.jsonc.
- **Deployment notes:** NOTHING deploys on push. Workers Builds was never connected (every deployment in `wrangler deployments list` is a manual upload); the green GitHub check on each push is a leftover GitHub Pages build of the repo, unrelated to the site. Ship = commit, push, `npm run deploy`, then `npm run smoke -- https://placehold.us` (every format at max size against the 128MB memory limit, headers, the www/beta redirects).
- **Builder/sync notes:** TODO: If applicable, note how Lovable or another builder syncs with GitHub, what it may regenerate, and what requires manual redeploy or review.

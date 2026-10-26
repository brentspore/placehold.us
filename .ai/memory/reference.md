---
name: Project reference
description: Commands, repo pointers, external systems, and operational notes
type: reference
---

- **Local repo:** ~/Personal Projects/placehold.us
- **Remote repo:** https://github.com/brentspore/placehold.us
- **Commands:** TODO: dev, build, test, lint, deploy.
- **Docker (local dev):** `docker compose up -d` → http://localhost:5129, `docker compose down` to stop. Runs this repo's `dev` script in a container over the live working tree, hot reload as with `start`; the first start installs dependencies into a Docker volume, later starts take seconds. Local only: `start` stays the everyday server and `git push` still deploys. Port from `~/.ai/skills/docker/ports.md`; details in the `docker` skill. (Added 2026-09-24.)
- **External systems:** Cloudflare Worker `placehold-us` (routes in `wrangler.jsonc`: beta.placehold.us custom domain, placehold.us/* and www.placehold.us/* zone routes). DNS on Cloudflare: apex A 192.0.2.1 proxied (originless placeholder, since 2026-10-26), www CNAME to apex proxied, beta AAAA 100:: proxied. No wildcard: other subdomains do not resolve. The old PHP origin (Plesk on Lightsail, 35.160.40.62) is gone.
- **Secrets/env:** TODO: Where secrets live. Do not paste secret values here.
- **Deployment notes:** TODO: What deploys automatically and what needs manual action.
- **Builder/sync notes:** TODO: If applicable, note how Lovable or another builder syncs with GitHub, what it may regenerate, and what requires manual redeploy or review.

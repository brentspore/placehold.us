---
name: Project reference
description: Commands, repo pointers, external systems, and operational notes
type: reference
---

- **Local repo:** TODO
- **Remote repo:** https://github.com/brentspore/placehold.us
- **Commands:** TODO: dev, build, test, lint, deploy.
- **Docker (local dev):** `docker compose up -d` → http://localhost:5129, `docker compose down` to stop. Runs this repo's `dev` script in a container over the live working tree, hot reload as with `start`; the first start installs dependencies into a Docker volume, later starts take seconds. Local only: `start` stays the everyday server and `git push` still deploys. Port from `~/.ai/skills/docker/ports.md`; details in the `docker` skill. (Added 2026-09-24.)
- **External systems:** TODO: hosting, database, analytics, email, APIs.
- **Secrets/env:** TODO: Where secrets live. Do not paste secret values here.
- **Deployment notes:** TODO: What deploys automatically and what needs manual action.
- **Builder/sync notes:** TODO: If applicable, note how Lovable or another builder syncs with GitHub, what it may regenerate, and what requires manual redeploy or review.

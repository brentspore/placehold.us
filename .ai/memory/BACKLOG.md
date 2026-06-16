# Context

Placehold.us is a developer placeholder image service — generates images by URL (e.g. `placehold.us/300x200`) for use in wireframes, prototypes, and designs.

Not loaded into context every session — pull from here when picking up new work or reviewing project scope. If an item belongs across multiple projects, move it to `~/.ai/memory/BACKLOG.md` instead. Work items only: decisions belong in `.ai/memory/DECISIONS.md`; active missions and directives belong in project memory that loads every session.

## Entry format

Items in this file follow the structure below so that any AI tool or human editing the file directly produces entries Backlog Viewer can parse, display, and manage. Keep this section intact — it is the in-file format reference that prevents format drift. Backlog Viewer hides it from the app display and treats the example item as a template, not a real entry.

### Item title

**Why it matters:** What value this delivers or what risk it avoids.

**When to revisit:** The specific trigger or condition that makes this worth acting on.

**Notes:** Context, constraints, related files, or prior decisions.

---

### Rebuild on Cloudflare Workers (move off PHP server, free hosting)

**Why it matters:** Eliminates the current paid/managed PHP server — moves to free, edge-hosted Cloudflare while keeping all real functionality, with **zero ongoing spend** (no API calls). Also removes the disk-cache cleanup burden and gets the committed GA4 secret out of source.

**When to revisit:** Plan fully specified — ready to build whenever picked up.

**Notes:** Target is a single **Cloudflare Worker + Static Assets** (GitHub Pages ruled out — static only, can't run dynamic generation). Domain already on Cloudflare DNS. Agreed scope: static homepage + image generation only — **full format parity: SVG + PNG + JPG + GIF**; resvg-wasm → PNG, jpeg-js → JPG, **`gifenc` → GIF** (quantization is lossless for solid-bg+text placeholders), all from one resvg pixel buffer, AauxOffice TTF loaded into the font DB. **SVG default uses a SUBSET of AauxOffice (only the glyphs each image's text uses) base64-embedded → ~2-5KB/image** (vs ~84KB with the full font today). Keeps the brand look AND makes SVG the genuinely-small low-bandwidth default Brent wants (goal: serve lowest bandwidth first, default = SVG, other formats only on request via extension). Build-time approach: precompute a subset for the common charset (digits + `x` + space, the usual dimension text) for a fast no-CPU path; subset dynamically via `harfbuzzjs`/hb-subset (runs in Workers) only when custom `?text=` uses other glyphs. **Measured size order (flat-color placeholders): GIF≈PNG (~1.8KB) < SVG-subset (~2-5KB) < JPG (~7KB)** — PNG is among the smallest; JPG heaviest (photographic compression is poor on flat color). SVG stays the default (no need to switch default to PNG). **Cache API for images** (delete the disk cache + `cleanup-cache.sh`); **native Cloudflare rate-limit rule** (drop the per-IP file limiter); GA4 tracking via `fetch()`. Port the exact URL grammar from `code.php` and test real `<img src>` URL shapes against current output before cutover — backward-compat is the main risk. Build on a branch, keep PHP in place until verified. **REMOVED: the lorem AI-text feature** — `lorem.php`, `lorem-demo.html`, and `INTEGRATION_GUIDE.md` deleted from the repo (orphaned/unlinked, only ongoing-Anthropic-spend piece; app needs no AI). Removes the need for KV and the Anthropic secret. **Security:** GA4 api_secret is committed in `code.php:33` — rotate on move; it's the only remaining secret. Remaining PHP pieces to port: `index.php` (homepage), `code.php` (image gen), `font.php`; routing via an `.htaccess` not in the repo.

---

# Project Decisions

Durable decisions specific to this project that should not be relitigated every time they come up.

Use this for product direction, architecture choices, deployment constraints, naming decisions, scope boundaries, and tradeoffs that apply to this repo only.

If a decision should apply across multiple projects, record it in `~/.ai/memory/DECISIONS.md` instead. If this project intentionally differs from a global decision, record the exception here and reference the global default.

## Entry format

### YYYY-MM-DD — Decision title

**Context:** What kept coming up or forced the choice.

**Decision:** What was decided for this project.

**Rationale:** Why this is the right default here.

**Revisit if:** What would make this worth reconsidering.

---

### 2026-11-03 — Max image size is 3000x3000

**Context:** 3999x3999 JPG/GIF crashed the Worker (Cloudflare 1102, out of memory). The old rule was an area cap of 16M pixels.

**Decision:** No side may exceed 3000 output pixels, in any format. @2x/@3x count toward it for raster formats (so 1500@2x.png is the largest at 2x). Larger requests get a 413.

**Rationale:** Owner's call: no huge images.

**Amended 2026-11-03 (owner): WebP stops at 1500x1500.** The lossless WebP encoder's wasm heap reaches about 195MB at 3000x3000 (49MB at 1500x1500) and a Worker gets 128MB. PNG/JPG/GIF at 3000x3000 worked live before the change; confirm all formats with `npm run smoke -- https://placehold.us` after each deploy, since wrangler dev does not enforce the memory limit.

**Revisit if:** People ask for long banners (e.g. 4000x200), which are cheap but blocked by the per-side rule.

### 2026-11-03 — One www-less site

**Decision:** www.placehold.us and beta.placehold.us 301 to placehold.us (path and query kept) in src/routing.ts. The routes stay in wrangler.jsonc so the redirect keeps working; the beta custom domain can be detached later.

**Rationale:** Duplicate homepages hurt search, and three hosts split the image cache.

### 2026-11-03 — One font-size formula for all formats

**Context:** The old service drew SVG text about 40% smaller than PNG text. Nobody noticed because the SVG font subset was broken (no cmap) from June to November 2026 and browsers showed Arial.

**Decision:** Every format uses the raster formula (min of width/longest-line*1.2, 30% of height, and a multi-line height fit; floor 5px). `?font-size=` overrides it.

**Revisit if:** Anyone reports their SVG placeholders changed size in a way that breaks a layout (the image size itself never changed, only the label).

### 2026-11-03 — Abuse limits

**Decision:** Two per-client limits on cache misses: 100 new images a minute, and 20 a minute for raster images over 1 megapixel. Clients are keyed per IPv4 address or IPv6 /64. Worker CPU is capped at 5s (`limits.cpu_ms`, paid plan). Raster renders run one at a time per isolate. workers.dev and preview URLs are off (no Cache API there, so they were an uncached mirror).

**Revisit if:** Legit heavy users hit 429s (raise the large limit first).

### 2026-11-05 — Bad URLs get an error image, not a fallback

**Context:** Errors were plain text, so inside an `<img>` they showed only the browser's broken-image icon. Bad colors and unknown extensions were quietly replaced (gray, SVG), so nobody learned the URL was wrong.

**Decision:** Every image error returns an SVG drawn at the requested size that says what is wrong and how to fix it (pink, dashed border). Status codes stay errors. Non-hex colors and unknown extensions are errors, not fallbacks. Only short plain values are echoed into the image.

**Rationale:** Owner approved. The image is the UI most users see; the landing page is visited once. Named colors never worked on the old service (it always prefixed `#`), so no previously-correct URL changes.

**Revisit if:** Someone reports a long-standing embed turning pink and wants the old fallback back for that case.


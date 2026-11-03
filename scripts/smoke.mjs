// End-to-end check against a running server: every format renders, headers are
// right, limits hold, and markup can't be injected.
//   npm run smoke                          # local wrangler dev on :8787
//   npm run smoke -- https://placehold.us  # live (cache-busted with ?text=)
const base = (process.argv[2] || "http://localhost:8787").replace(/\/$/, "");
const run = Date.now().toString(36);
let failed = 0;

const MAGIC = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46],
};

function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failed++;
}

async function get(path, opts) {
  const res = await fetch(base + path, { redirect: "manual", ...opts });
  const body = new Uint8Array(await res.arrayBuffer());
  return { res, body, text: () => new TextDecoder().decode(body) };
}

const t = `smoke-${run}`;
for (const fmt of ["svg", "png", "jpg", "gif", "webp"]) {
  for (const extra of ["", "/transparent/e8117f", "@2x"]) {
    const path = `/300x200${extra}.${fmt}?text=${t}`;
    const { res, body, text } = await get(path);
    const magic = MAGIC[fmt];
    const okBody = magic ? magic.every((b, i) => body[i] === b) : text().includes("<svg");
    check(path, res.status === 200 && okBody, `${res.status} ${body.length}B`);
  }
}

{
  const { res } = await get(`/300?text=${t}h`);
  check("CORS header", res.headers.get("access-control-allow-origin") === "*");
  check("CSP header", (res.headers.get("content-security-policy") || "").includes("default-src 'none'"));
  check("nosniff", res.headers.get("x-content-type-options") === "nosniff");
}
{
  const { text } = await get(`/300/%22%3E%3Csvg%20onload=%22x%22%20a=%22?text=${t}x`);
  check("color injection blocked", !text().includes("onload"));
}
for (const [fmt, side] of [["svg", 3000], ["png", 3000], ["jpg", 3000], ["gif", 3000], ["webp", 1500]]) {
  // The largest allowed image must render inside the Worker's memory limit.
  const { res, body } = await get(`/${side}x${side}.${fmt}?text=${t}-max`);
  check(`${side}x${side}.${fmt} renders`, res.status === 200, `${res.status} ${body.length}B`);
}
check("1501 webp rejected", (await get(`/1501.webp?text=${t}`)).res.status === 413);
check("control characters don't break png", (await get(`/300.png?text=a%01b${t}`)).res.status === 200);
check("501-char text rejected", (await get(`/300?text=${"a".repeat(501)}`)).res.status === 400);
{
  const first = await get(`/300?text=${t}-etag`);
  const etag = first.res.headers.get("etag");
  const again = await get(`/300?text=${t}-etag`, { headers: { "If-None-Match": etag } });
  check("ETag + 304", !!etag && again.res.status === 304);
}
check("3001 rejected", (await get(`/3001?text=${t}`)).res.status === 413);
check("1600@2x png rejected", (await get(`/1600@2x.png?text=${t}`)).res.status === 413);
check("bad encoding is 400", (await get(`/300%E0`)).res.status === 400);
check("homepage", (await get("/")).res.status === 200);
check("og image", (await get("/og.png")).res.status === 200);
check("POST rejected", (await get(`/300?text=${t}`, { method: "POST" })).res.status === 405);

if (base.includes("placehold.us")) {
  for (const host of ["https://www.placehold.us"]) {
    const res = await fetch(`${host}/300?x=${run}`, { redirect: "manual" });
    check(`${host} redirects`, res.status === 301 && res.headers.get("location") === `https://placehold.us/300?x=${run}`);
  }
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);

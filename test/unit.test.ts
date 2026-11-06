// Unit tests for the URL grammar, colors, SVG markup and routing.
// Run with `npm test`. Every documented URL form people already use is pinned
// here, because breaking one breaks <img> tags on other people's sites.

import { describe, it, expect } from "vitest";
import { parseRequest, cacheKeyFor, cleanText, MAX_SIDE, MAX_SIDE_WEBP } from "../src/parse";
import { normalizeHex } from "../src/color";
import { buildSvg, errorSvg, fontSize } from "../src/svg";
import { canonicalRedirect, isImagePath, rateLimitKey } from "../src/routing";

const parse = (path: string) => parseRequest(new URL("https://placehold.us" + path));

describe("legacy URL forms (must never change)", () => {
  const cases: [string, object][] = [
    ["/300", { format: "svg", w: 300, h: 300, bg: "cccccc", fg: "969696", text: "300 x 300" }],
    ["/350x150", { format: "svg", w: 350, h: 150, text: "350 x 150" }],
    ["/300.png/09f/fff", { format: "png", w: 300, h: 300, bg: "0099ff", fg: "ffffff" }],
    ["/300/09f.jpg/fff", { format: "jpg", bg: "0099ff", fg: "ffffff" }],
    ["/300/09f.jpeg/fff", { format: "jpg" }],
    ["/300/09f/fff.gif", { format: "gif", bg: "0099ff", fg: "ffffff" }],
    ["/250/ffffff/000000", { bg: "ffffff", fg: "000000" }],
    ["/350x150?text=Hello+World", { text: "Hello World", customText: true }],
    ["/300&text=placehold.us+rocks!", { text: "placehold.us rocks!", w: 300 }],
    ["/300?text=a|b", { text: "a\nb" }],
    ["/300/A/AB", { bg: "aaaaaa", fg: "ababab" }],
  ];
  for (const [path, want] of cases) {
    it(path, () => {
      const r = parse(path);
      expect(r.spec).not.toBeNull();
      expect({ format: r.format, ...r.spec }).toMatchObject(want);
    });
  }
});

describe("new options", () => {
  it("webp", () => expect(parse("/300.webp").format).toBe("webp"));
  it("transparent background", () => expect(parse("/300/transparent/000.png").spec?.bg).toBe("transparent"));
  it("@2x anywhere, label keeps layout size", () => {
    for (const p of ["/300x200@2x.png", "/300x200/09f/fff@2x.png", "/300x200.png@2x"]) {
      const r = parse(p);
      expect(r.spec).toMatchObject({ w: 300, h: 200, scale: 2, text: "300 x 200" });
    }
  });
  it("@4x is rejected", () => expect(parse("/300@4x.png").status).toBe(400));
  it("font-size from query or inline form", () => {
    expect(parse("/300?font-size=40").spec?.fontSize).toBe(40);
    expect(parse("/300&text=hi&font-size=40").spec?.fontSize).toBe(40);
    expect(parse("/300?font-size=abc").spec?.fontSize).toBeNull();
    expect(parse("/300?font-size=99999").spec?.fontSize).toBe(1000);
  });
});

describe("limits", () => {
  it(`allows ${MAX_SIDE}x${MAX_SIDE}`, () => expect(parse(`/${MAX_SIDE}`).spec).not.toBeNull());
  it("rejects a side over the max", () => {
    expect(parse(`/${MAX_SIDE + 1}x10`).status).toBe(413);
    expect(parse(`/10x${MAX_SIDE + 1}.svg`).status).toBe(413);
  });
  it("@2x counts output pixels for raster, not for svg", () => {
    expect(parse("/1600@2x.png").status).toBe(413);
    expect(parse("/1500@2x.png").spec).not.toBeNull();
    expect(parse("/1600@2x.svg").spec).not.toBeNull();
  });
  it(`WebP stops at ${MAX_SIDE_WEBP}x${MAX_SIDE_WEBP} (memory)`, () => {
    expect(parse(`/${MAX_SIDE_WEBP}.webp`).spec).not.toBeNull();
    expect(parse(`/${MAX_SIDE_WEBP + 1}.webp`).status).toBe(413);
    expect(parse(`/800@2x.webp`).status).toBe(413);
    expect(parse(`/${MAX_SIDE_WEBP + 1}.png`).spec).not.toBeNull();
  });
  it("text over 500 characters or 20 lines is rejected", () => {
    expect(parse("/300?text=" + "a".repeat(500)).spec).not.toBeNull();
    expect(parse("/300?text=" + "a".repeat(501)).status).toBe(400);
    expect(parse("/300?text=" + "a|".repeat(19) + "a").spec).not.toBeNull();
    expect(parse("/300?text=" + "a|".repeat(20) + "a").status).toBe(400);
  });
  it("bad dimensions are 404", () => {
    expect(parse("/0").status).toBe(404);
    expect(parse("/x").status).toBe(404);
  });
  it("bad percent-encoding is 400, not a crash", () => expect(parse("/300%E0").status).toBe(400));
});

describe("colors", () => {
  it("normalizes shorthand", () => {
    expect(normalizeHex("09f")).toBe("0099ff");
    expect(normalizeHex("#ABCDEF")).toBe("abcdef");
  });
  it("rejects non-hex and odd lengths", () => {
    for (const bad of ["zzz", "12345", "1234", "", '"><svg', "0099ff00"]) expect(normalizeHex(bad)).toBeNull();
  });
  it("invalid colors are an error that names the color (they used to quietly fall back)", () => {
    const r = parse("/300x200/zzz/fff");
    expect(r.spec).toBeNull();
    expect(r.status).toBe(400);
    expect(r.error).toContain("Unknown color: zzz");
    expect(r.errorSize).toEqual({ w: 300, h: 200 });
    expect(parse("/300/09f/qqq").error).toContain("Unknown color: qqq");
    expect(parse("/300/1234").status).toBe(400);
  });
  it("empty color segments still mean the defaults", () => {
    expect(parse("/300/").spec).toMatchObject({ bg: "cccccc", fg: "969696" });
    expect(parse("/300//fff").spec).toMatchObject({ bg: "cccccc", fg: "ffffff" });
    expect(parse("/300/transparent").spec).toMatchObject({ bg: "transparent" });
  });
});

describe("text cleaning", () => {
  it("drops control characters, keeps new lines", () => {
    expect(cleanText("a\u0001b\tc\u007f")).toBe("abc");
    expect(cleanText("a\r\nb|c\rd")).toBe("a\nb\nc\nd");
  });
  it("keeps emoji, drops lone surrogates", () => {
    expect(cleanText("hi 👋")).toBe("hi 👋");
    expect(cleanText("a\uD800b")).toBe("ab");
  });
  it("control characters never reach the SVG", () => {
    const svg = buildSvg(parse("/300?text=a%01b").spec!, { embedFont: false });
    expect(svg).not.toMatch(/[\u0000-\u0008]/);
    expect(svg).toContain(">ab<");
  });
});

describe("SVG output is safe", () => {
  it("markup in the color slot never reaches the SVG (XSS regression, 2026-11-03)", () => {
    const r = parse('/300/%22%3E%3Csvg%20onload=%22alert(1)%22%20a=%22');
    expect(r.spec).toBeNull();
    const svg = errorSvg(r.error!, r.errorSize);
    expect(svg).not.toContain("onload");
    expect(svg).toContain("Unknown color<");
  });
  it("text is escaped", () => {
    const r = parse("/300?text=" + encodeURIComponent(`<script>"&'`));
    const svg = buildSvg(r.spec!, { embedFont: false });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&quot;&amp;&#39;");
  });
  it("transparent background draws no rect", () => {
    expect(buildSvg(parse("/300/transparent").spec!, { embedFont: false })).not.toContain("<rect");
  });
  it("embeds a WOFF2 subset sized to the text", () => {
    const len = (p: string) => buildSvg(parse(p).spec!, { embedFont: true }).length;
    expect(buildSvg(parse("/300").spec!, { embedFont: true })).toContain("data:font/woff2;base64,d09GMg");
    expect(len("/300")).toBeLessThan(len("/300?text=Hello"));
    expect(len("/300?text=Hello")).toBeLessThan(len("/300?text=Caf%C3%A9"));
  });
});

describe("font sizing", () => {
  it("explicit size wins", () => expect(fontSize(parse("/300?font-size=33").spec!)).toBe(33));
  it("an emoji counts as one character", () => {
    expect(fontSize(parse("/300?text=%F0%9F%91%8B%F0%9F%91%8B").spec!)).toBe(fontSize(parse("/300?text=ab").spec!));
  });
  it("several lines fit the height", () => {
    const s = parse("/300x100?text=a|b|c|d").spec!;
    expect(fontSize(s) * 1.2 * 4).toBeLessThanOrEqual(100);
  });
});

describe("cache key", () => {
  const key = (p: string) => {
    const r = parse(p);
    return cacheKeyFor("https://placehold.us", r.format, r.spec!);
  };
  it("ignores junk query params", () => expect(key("/300?x=1")).toBe(key("/300")));
  it("/300 and /300x300 share an entry", () => expect(key("/300")).toBe(key("/300x300")));
  it("text and font size change the key", () => {
    expect(key("/300?text=a")).not.toBe(key("/300?text=b"));
    expect(key("/300?font-size=20")).not.toBe(key("/300"));
  });
  it("scale only matters for raster", () => {
    expect(key("/300@2x.svg")).toBe(key("/300.svg"));
    expect(key("/300@2x.png")).not.toBe(key("/300.png"));
  });
});

describe("routing", () => {
  it("www redirects to the main domain, keeping path and query", () => {
    expect(canonicalRedirect(new URL("https://www.placehold.us/300?text=hi"))).toBe("https://placehold.us/300?text=hi");
  });
  it("main domain and workers.dev are served", () => {
    expect(canonicalRedirect(new URL("https://placehold.us/300"))).toBeNull();
    expect(canonicalRedirect(new URL("https://placehold-us.example.workers.dev/300"))).toBeNull();
  });
  it("rate-limit key: IPv4 as-is, IPv6 cut to its /64", () => {
    expect(rateLimitKey("203.0.113.9")).toBe("203.0.113.9");
    expect(rateLimitKey("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(rateLimitKey("2001:0db8:0001:0002:ffff:ffff:ffff:ffff")).toBe("2001:db8:1:2::/64");
    expect(rateLimitKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateLimitKey("::1")).toBe("0:0:0:0::/64");
    expect(rateLimitKey(null)).toBe("unknown");
  });
  it("image paths start with a digit", () => {
    expect(isImagePath("/300")).toBe(true);
    expect(isImagePath("/")).toBe(false);
    expect(isImagePath("/og.png")).toBe(false);
    expect(isImagePath("/privacypolicy")).toBe(false);
  });
});

describe("error images", () => {
  it("unknown extensions are an error (.bmp used to quietly become SVG)", () => {
    const r = parse("/300/09f/fff.bmp");
    expect(r.status).toBe(400);
    expect(r.error).toContain("Unknown format: bmp");
    expect(parse("/300.svg").spec).not.toBeNull();
    expect(parse("/300.jpeg").spec).not.toBeNull();
  });
  it("are drawn at the requested size, capped for layout", () => {
    expect(errorSvg("x", { w: 4000, h: 200 })).toContain('width="4000" height="200"');
    expect(errorSvg("x", { w: 99999, h: 10 })).toContain('width="4000" height="10"');
    expect(errorSvg("x")).toContain('width="300" height="150"');
  });
  it("too-big errors keep their size and say the limit", () => {
    const r = parse("/4000x200");
    expect(r.status).toBe(413);
    expect(r.errorSize).toEqual({ w: 4000, h: 200 });
    expect(r.error).toBe("Too big\nLargest size is 3000 x 3000");
    expect(parse("/800@2x.webp").error).toBe("Too big\nLargest WebP size at @2x is 750 x 750");
  });
  it("bad sizes have no size to keep", () => {
    expect(parse("/300x0").errorSize).toBeUndefined();
  });
  it("only short plain values are echoed back", () => {
    expect(parse("/300/" + "a".repeat(13)).error).toMatch(/^Unknown color\n/);
    expect(parse("/300/hello world").error).toMatch(/^Unknown color\n/);
  });
  it("messages are escaped and look unlike a real placeholder", () => {
    const svg = errorSvg("<b>&", { w: 300, h: 150 });
    expect(svg).toContain("&lt;b&gt;&amp;");
    expect(svg).toContain('stroke-dasharray="6 4"');
    expect(svg).toContain('fill="#fdeaf3"');
  });
});

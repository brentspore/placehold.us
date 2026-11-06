// URL grammar. Started as a port of the old PHP service's parsing; every form
// below must keep working because people have years of <img> tags using them.
//
//   /300                         -> 300x300 svg, default colors
//   /350x150                     -> 350x150 svg
//   /300.png/09f/fff             -> png, bg=0099ff fg=ffffff
//   /300/09f.jpg/fff             -> jpg (the extension can sit on any segment)
//   /300/09f/fff.gif             -> gif
//   /300/09f/fff.webp            -> webp
//   /350x150?text=Hello+World    -> custom text ('+' -> space)
//   /300&text=foo                -> inline text form used on the homepage
//   text may contain '|' which becomes a new line
//   /300/transparent/000.png     -> transparent background
//   /300x200@2x.png              -> 600x400 pixels, laid out like 300x200
//   /300?font-size=40            -> fixed text size in px (before @2x scaling)

import { normalizeHex, TRANSPARENT } from "./color";

export type Format = "svg" | "png" | "jpg" | "gif" | "webp";

export const MAX_SIDE = 3000; // largest image we generate, in output pixels
// The WebP encoder needs about 195MB of memory at 3000x3000 and a Worker gets
// 128MB, so WebP has its own lower cap (about 50MB at 1500x1500).
export const MAX_SIDE_WEBP = 1500;
export const MAX_TEXT_CHARS = 500;
export const MAX_TEXT_LINES = 20;
export const DEFAULT_BG = "cccccc";
export const DEFAULT_FG = "969696";
const MIN_FONT = 4;
const MAX_FONT = 1000;

export interface ImageSpec {
  w: number; // layout size (before scale)
  h: number;
  scale: number; // 1, 2 or 3; only raster formats use it
  bg: string; // 6-digit hex (no '#') or "transparent"
  fg: string; // 6-digit hex (no '#')
  text: string; // '|' already converted to '\n'
  customText: boolean;
  fontSize: number | null; // null = automatic
}

export interface ParseResult {
  format: Format;
  spec: ImageSpec | null;
  status?: number;
  // What went wrong, drawn into the error image. Lines split on "\n": the
  // first says what is wrong, the rest say how to fix it.
  error?: string;
  // Size to draw the error image at, so a broken URL keeps its spot in the
  // page layout. Missing when the size itself is what's wrong.
  errorSize?: { w: number; h: number };
}

const FORMAT_EXTENSIONS = new Set(["svg", "png", "jpg", "jpeg", "gif", "webp"]);

// A bad value is echoed back in the error image only when it is short and
// plain, so the image can't be made to say arbitrary things.
function shown(value: string): string {
  return /^[a-z0-9#]{1,12}$/.test(value) ? `: ${value}` : "";
}

export function parseRequest(url: URL): ParseResult {
  let raw = url.pathname.replace(/^\/+/, "");

  // Split off an inline "&text=..." fragment (homepage form with no '?').
  let inlineQuery = "";
  const ampIdx = raw.indexOf("&");
  if (ampIdx !== -1) {
    inlineQuery = raw.slice(ampIdx + 1);
    raw = raw.slice(0, ampIdx);
  }

  let specStr: string;
  try {
    specStr = decodeURIComponent(raw).toLowerCase();
  } catch {
    return { format: "svg", spec: null, status: 400, error: "Bad URL\nCheck the %-codes in it" };
  }

  // Format: matches anywhere in the path. Default SVG.
  let format: Format = "svg";
  const m = specStr.match(/(png|gif|jpe?g|webp)/);
  if (m) format = m[1] === "jpeg" ? "jpg" : (m[1] as Format);

  // Retina scale: "@2x" or "@3x" anywhere in the path.
  let scale = 1;
  const sm = specStr.match(/@(\d+)x/);
  if (sm) {
    scale = parseInt(sm[1], 10);
    specStr = specStr.replace(/@\d+x/g, "");
  }

  const parts = specStr.split("/");
  const segment = (i: number) => (parts[i] ?? "").split(".")[0];

  // Dimensions: first segment, split on 'x', digits only.
  const dims = (parts[0] ?? "").split("x");
  const w = parseInt((dims[0] || "").replace(/[^\d]/g, ""), 10) || 0;
  const h =
    dims[1] !== undefined ? parseInt(dims[1].replace(/[^\d]/g, ""), 10) || 0 : w;

  if (w <= 0 || h <= 0) {
    return { format, spec: null, status: 404, error: "Bad size\nUse width x height, like 300x150" };
  }
  const errorSize = { w, h };
  const fail = (status: number, error: string): ParseResult => ({ format, spec: null, status, error, errorSize });

  if (scale < 1 || scale > 3) return fail(400, "Bad scale\nUse @2x or @3x");

  // Every extension must be a format we make (.bmp used to quietly become SVG).
  for (const part of parts) {
    for (const ext of part.split(".").slice(1)) {
      if (ext && !FORMAT_EXTENSIONS.has(ext)) {
        return fail(400, `Unknown format${shown(ext)}\nUse png, jpg, gif, webp or svg`);
      }
    }
  }

  // Colors: empty means the default; anything else must be hex (or
  // "transparent" for the background). Bad colors used to quietly fall back.
  const bgIn = segment(1);
  const fgIn = segment(2);
  const bg = bgIn === "" ? DEFAULT_BG : bgIn === TRANSPARENT ? TRANSPARENT : normalizeHex(bgIn);
  const fg = fgIn === "" ? DEFAULT_FG : normalizeHex(fgIn);
  for (const [value, ok] of [[bgIn, bg], [fgIn, fg]] as const) {
    if (ok === null) return fail(400, `Unknown color${shown(value)}\nUse 3 or 6 hex digits, like 09f`);
  }

  const outScale = format === "svg" ? 1 : scale;
  const max = format === "webp" ? MAX_SIDE_WEBP : MAX_SIDE;
  if (w * outScale > max || h * outScale > max) {
    const what = format === "webp" ? "WebP " : "";
    const at = outScale > 1 ? ` at @${outScale}x` : "";
    const side = Math.floor(max / outScale);
    return fail(413, `Too big\nLargest ${what}size${at} is ${side} x ${side}`);
  }

  // Query values: '?' query wins, then the inline '&' fragment.
  const inline = new URLSearchParams(inlineQuery);
  const param = (name: string) => url.searchParams.get(name) ?? inline.get(name);

  const text = param("text");
  let finalText = `${w} x ${h}`;
  if (text !== null) {
    finalText = cleanText(text);
    if ([...finalText].length > MAX_TEXT_CHARS) {
      return fail(400, `Text too long\n${MAX_TEXT_CHARS} characters max`);
    }
    if (finalText.split("\n").length > MAX_TEXT_LINES) {
      return fail(400, `Too many lines\n${MAX_TEXT_LINES} max`);
    }
  }

  let fontSize: number | null = null;
  const fs = param("font-size");
  if (fs !== null) {
    const n = parseInt(fs, 10);
    if (n > 0) fontSize = Math.min(Math.max(n, MIN_FONT), MAX_FONT);
  }

  return {
    format,
    spec: { w, h, scale, bg: bg!, fg: fg!, text: finalText, customText: text !== null, fontSize },
  };
}

/**
 * Custom text as drawn: '|' and line breaks become new lines, and control
 * characters are dropped (XML 1.0 forbids them, so they broke the SVG and made
 * the raster formats return a 500).
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\|/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F\uFFFE\uFFFF]/g, "")
    .replace(/[\uD800-\uDFFF]/g, (c, i, str) => {
      // keep valid surrogate pairs (emoji etc.), drop lone halves
      const code = c.charCodeAt(0);
      if (code <= 0xdbff) {
        const next = str.charCodeAt(i + 1);
        return next >= 0xdc00 && next <= 0xdfff ? c : "";
      }
      const prev = str.charCodeAt(i - 1);
      return prev >= 0xd800 && prev <= 0xdbff ? c : "";
    });
}

/**
 * A cache key that depends only on what gets drawn, so /300 and /300x300 share
 * an entry and junk query strings can't force a fresh render. The "v2" prefix
 * retires everything cached before 2026-11-03 (including the unsafe SVGs).
 */
export function cacheKeyFor(origin: string, format: Format, s: ImageSpec): string {
  const scale = format === "svg" ? 1 : s.scale;
  const q = new URLSearchParams({ t: s.text, fs: s.fontSize === null ? "auto" : String(s.fontSize) });
  return `${origin}/__cache/v2/${s.w}x${s.h}@${scale}x/${s.bg}/${s.fg}.${format}?${q}`;
}

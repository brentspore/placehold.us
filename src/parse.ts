// URL grammar — faithful port of code.php's request parsing.
//
// Examples that must keep working:
//   /300                         -> 300x300 svg, default colors
//   /350x150                     -> 350x150 svg
//   /300.png/09f/fff             -> png, bg=0099ff fg=ffffff
//   /300/09f.jpg/fff             -> jpg
//   /300/09f/fff.gif             -> gif
//   /350x150?text=Hello+World    -> custom text ('+' -> space)
//   /300&text=foo                -> inline text form used on the homepage
//   text may contain '|' which becomes a newline

import { normalizeHex } from "./color";

export type Format = "svg" | "png" | "jpg" | "gif";

export interface ImageSpec {
  w: number;
  h: number;
  bgHex: string; // normalized 6-digit hex, no '#'
  fgHex: string;
  text: string; // '|' already converted to '\n'
}

export interface ParseResult {
  format: Format;
  spec: ImageSpec | null;
  error?: string;
}

export function parseRequest(url: URL): ParseResult {
  // Path after the leading slash. code.php did strtolower() on the whole thing.
  let raw = url.pathname.replace(/^\/+/, "");

  // Split off an inline "&text=..." fragment (homepage form with no '?').
  let inlineQuery = "";
  const ampIdx = raw.indexOf("&");
  if (ampIdx !== -1) {
    inlineQuery = raw.slice(ampIdx + 1);
    raw = raw.slice(0, ampIdx);
  }
  const specStr = decodeURIComponent(raw).toLowerCase();

  // Format detection — matches anywhere in the path. Default SVG.
  let format: Format = "svg";
  const m = specStr.match(/(png|gif|jpe?g)/);
  if (m) format = m[1] === "jpeg" ? "jpg" : (m[1] as Format);

  const parts = specStr.split("/");

  // Colors: strip any extension, fall back to code.php's defaults.
  const bgHex = normalizeHex((parts[1] ?? "").split(".")[0] || "ccc");
  const fgHex = normalizeHex((parts[2] ?? "").split(".")[0] || "969696");

  // Dimensions: first segment, split on 'x', digits only.
  const dims = (parts[0] ?? "").split("x");
  const w = parseInt((dims[0] || "").replace(/[^\d]/g, ""), 10) || 0;
  const h =
    dims[1] !== undefined ? parseInt(dims[1].replace(/[^\d]/g, ""), 10) || 0 : w;

  if (w <= 0 || h <= 0) return { format, spec: null, error: "Invalid dimensions" };
  if (w * h >= 16000000) return { format, spec: null, error: "Too big!" };

  // Text: ?text= wins; else the inline &text= fragment; else "W x H".
  let text = url.searchParams.get("text");
  if (text === null && inlineQuery) {
    text = new URLSearchParams(inlineQuery).get("text");
  }
  const finalText = text !== null ? text.replace(/\|/g, "\n") : `${w} x ${h}`;

  return { format, spec: { w, h, bgHex, fgHex, text: finalText } };
}

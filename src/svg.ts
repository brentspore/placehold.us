// SVG markup for a placeholder. Used directly for .svg responses (with a font
// subset embedded so the brand font shows inside <img>) and as the drawing
// source for the raster formats (resvg gets the full font as a buffer).
//
// No wasm imports here, so unit tests can load this file in plain Node.

import { TRANSPARENT } from "./color";
import { NUMERIC_CHARS, SUBSET_NUMERIC, SUBSET_ASCII, SUBSET_FULL } from "./font-subsets";
import type { ImageSpec } from "./parse";

export const FONT_FAMILY = "AauxOffice";
const FONT_STACK = `${FONT_FAMILY}, Arial, sans-serif`;

// Pick the smallest prebuilt font subset that covers the text: the ~2KB
// numeric one for the default "300 x 200" label, ASCII (~10KB) for plain
// English, or every glyph the font has (~20KB) for accented letters and curly
// quotes. Characters the font lacks (CJK, emoji, Greek...) fall back to the
// browser's own fonts through the Arial/sans-serif stack.
const numericChars = new Set(NUMERIC_CHARS);
function fontSubsetBase64(text: string): string {
  let ascii = true;
  let numeric = true;
  for (const ch of text) {
    if (ch === " " || ch === "\n") continue;
    if (!numericChars.has(ch)) numeric = false;
    if (ch.charCodeAt(0) > 0x7e) ascii = false;
  }
  if (numeric) return SUBSET_NUMERIC;
  if (ascii) return SUBSET_ASCII;
  return SUBSET_FULL;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Automatic sizing: one formula for every format, so /300.svg and /300.png
// look the same. (The old service drew SVG text about 40% smaller, which was
// hidden while the SVG font subset was broken and Arial showed instead.)
// An explicit ?font-size= overrides it.
export function fontSize(spec: ImageSpec): number {
  if (spec.fontSize !== null) return spec.fontSize;
  const lines = spec.text.split("\n");
  const longestLine = Math.max(...lines.map((l) => [...l].length), 1); // code points, not UTF-16 units
  // Several lines must fit the height together (1.2 line height, 80% of h).
  const linesCap = lines.length > 1 ? (spec.h * 0.8) / (lines.length * 1.2) : Infinity;
  return Math.max(Math.min((spec.w / longestLine) * 1.2, spec.h * 0.3, linesCap), 5);
}

function tspans(text: string, size: number): string {
  const lines = text.split("\n");
  if (lines.length === 1) return esc(text);
  // vertically center the block of lines around y=50%
  const lineHeight = size * 1.2;
  const startDy = -((lines.length - 1) / 2) * lineHeight;
  return lines
    .map((line, i) => {
      const dy = i === 0 ? startDy : lineHeight;
      return `<tspan x="50%" dy="${dy}">${esc(line)}</tspan>`;
    })
    .join("");
}

const HEX6 = /^[0-9a-f]{6}$/;

export function buildSvg(spec: ImageSpec, opts: { embedFont: boolean }): string {
  // Colors were validated by the parser; check again so markup can never be
  // built from anything but a hex value.
  const bg = spec.bg === TRANSPARENT ? null : HEX6.test(spec.bg) ? spec.bg : "cccccc";
  const fg = HEX6.test(spec.fg) ? spec.fg : "969696";
  const size = fontSize(spec);
  const fontFace = opts.embedFont
    ? `<defs><style type="text/css">
@font-face {
font-family: "${FONT_FAMILY}";
src: url("data:font/woff2;base64,${fontSubsetBase64(spec.text)}") format("woff2");
font-weight: bold;
}
</style></defs>`
    : "";
  const rect = bg ? `<rect width="100%" height="100%" fill="#${bg}"/>\n` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${spec.w}" height="${spec.h}" viewBox="0 0 ${spec.w} ${spec.h}" xmlns="http://www.w3.org/2000/svg">
${fontFace}${rect}<text x="50%" y="50%" font-family="${FONT_STACK}" font-size="${size}" font-weight="bold" fill="#${fg}" text-anchor="middle" dominant-baseline="middle">${tspans(spec.text, size)}</text>
</svg>`;
}

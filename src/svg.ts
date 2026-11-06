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

// Error images. A bad URL inside <img> used to show only the browser's broken
// image icon, because the error was plain text. Now it gets an SVG at the
// requested size (so the page layout holds) that says what's wrong, in pink
// with a dashed border so it can't be mistaken for a working placeholder.
export const ERROR_FALLBACK_SIZE = { w: 300, h: 150 };
const ERROR_MAX_SIDE = 4000; // SVG is cheap at any size; this just bounds layout
const ERROR_BG = "fdeaf3";
const ERROR_FG = "b00d62";
const ERROR_BORDER = "e8117f";

// The brand font is condensed: a bold character is about 0.42em wide. 0.5
// leaves a margin so a line never touches the border.
const CHAR_EM = 0.5;

export function errorSvg(message: string, size: { w: number; h: number } = ERROR_FALLBACK_SIZE): string {
  const w = Math.min(Math.max(Math.round(size.w), 1), ERROR_MAX_SIDE);
  const h = Math.min(Math.max(Math.round(size.h), 1), ERROR_MAX_SIDE);
  const [title, ...hints] = cleanMessage(message).split("\n");
  const fitWidth = (line: string) => (w * 0.85) / (Math.max([...line].length, 1) * CHAR_EM);

  // The title (what's wrong) is big; the hints (how to fix it) are smaller.
  let titleSize = Math.min(fitWidth(title), h * 0.3);
  let hintSize = hints.length ? Math.min(...hints.map(fitWidth), titleSize * 0.6) : 0;
  // Everything together must fit in 80% of the height.
  const block = titleSize * 1.2 + hints.length * hintSize * 1.3;
  if (block > h * 0.8) {
    const k = (h * 0.8) / block;
    titleSize *= k;
    hintSize *= k;
  }
  titleSize = Math.max(titleSize, 6);
  hintSize = Math.max(hintSize, 5);

  const lines = [
    { text: title, size: titleSize, step: titleSize * 1.2 },
    ...hints.map((t) => ({ text: t, size: hintSize, step: hintSize * 1.3 })),
  ];
  const total = lines.reduce((sum, l) => sum + l.step, 0);
  let y = (h - total) / 2;
  const texts = lines
    .map((l) => {
      const cy = y + l.step / 2;
      y += l.step;
      return `<text x="50%" y="${round(cy)}" font-size="${round(l.size)}">${esc(l.text)}</text>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
<defs><style type="text/css">
@font-face {
font-family: "${FONT_FAMILY}";
src: url("data:font/woff2;base64,${fontSubsetBase64(title + hints.join(""))}") format("woff2");
font-weight: bold;
}
</style></defs><rect width="100%" height="100%" fill="#${ERROR_BG}"/>
<rect x="1" y="1" width="${Math.max(w - 2, 0)}" height="${Math.max(h - 2, 0)}" fill="none" stroke="#${ERROR_BORDER}" stroke-width="2" stroke-dasharray="6 4"/>
<g font-family="${FONT_STACK}" font-weight="bold" fill="#${ERROR_FG}" text-anchor="middle" dominant-baseline="middle">
${texts}
</g>
</svg>`;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

// Messages are written by us, but may echo a short value from the URL.
function cleanMessage(message: string): string {
  return message.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").slice(0, 200);
}

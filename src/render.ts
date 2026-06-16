// Image generation — port of code.php's SVG + raster paths.
//
// SVG (default): brand font subset (fontkit) base64-embedded so text renders
//   inside <img> tags; small (~2-5KB) instead of the old ~84KB full-font embed.
// PNG/JPG/GIF: render the same SVG geometry with resvg-wasm (full font passed
//   as a buffer, so no embed needed), then encode the RGBA pixels.

import { Resvg, initWasm } from "@resvg/resvg-wasm";
// @ts-ignore - .wasm import resolves to a WebAssembly.Module in Workers
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
// @ts-ignore - .ttf import resolves to an ArrayBuffer via the Data module rule
import fontTtf from "../AauxOffice-Bold.ttf";
import jpeg from "jpeg-js";
import { quantize, applyPalette, GIFEncoder } from "gifenc";
import type { Format, ImageSpec } from "./parse";
import { NUMERIC_CHARS, SUBSET_NUMERIC, SUBSET_ASCII } from "./font-subsets";

const FONT_FAMILY = "AauxOffice";
const FONT_STACK = `${FONT_FAMILY}, Arial, sans-serif`;
const fontBytes = new Uint8Array(fontTtf as ArrayBuffer);

// --- resvg wasm init (once per isolate) ---
let wasmReady: Promise<unknown> | null = null;
function ensureWasm(): Promise<unknown> {
  if (!wasmReady) wasmReady = initWasm(resvgWasm as WebAssembly.Module);
  return wasmReady;
}

// Pick the smallest prebuilt font subset that covers the text. Default
// dimension text ("300 x 200") only needs the ~3KB numeric subset; anything
// with letters/symbols uses the fuller ASCII subset. Glyphs outside both fall
// back to the SVG's Arial/sans-serif stack in the browser.
const numericChars = new Set(NUMERIC_CHARS);
function fontSubsetBase64(text: string): string {
  for (const ch of text) {
    if (ch === " " || ch === "\n") continue;
    if (!numericChars.has(ch)) return SUBSET_ASCII;
  }
  return SUBSET_NUMERIC;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Two sizing formulas, matching code.php: SVG text is smaller than raster text.
function fontSize(spec: ImageSpec, raster: boolean): number {
  const len = Math.max(spec.text.length, 1);
  if (raster) {
    return Math.max(Math.min((spec.w / len) * 1.2, spec.h * 0.3), 12);
  }
  return Math.max(Math.min((spec.w / len) * 0.75, spec.h * 0.25), 5);
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

export function buildSvg(spec: ImageSpec, opts: { embedFont: boolean; raster: boolean }): string {
  const size = fontSize(spec, opts.raster);
  const fontFace = opts.embedFont
    ? `<defs><style type="text/css">
@font-face {
font-family: "${FONT_FAMILY}";
src: url("data:font/truetype;charset=utf-8;base64,${fontSubsetBase64(spec.text)}") format("truetype");
font-weight: bold;
}
</style></defs>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${spec.w}" height="${spec.h}" xmlns="http://www.w3.org/2000/svg">
${fontFace}<rect width="100%" height="100%" fill="#${spec.bgHex}"/>
<text x="50%" y="50%" font-family="${FONT_STACK}" font-size="${size}" font-weight="bold" fill="#${spec.fgHex}" text-anchor="middle" dominant-baseline="middle">${tspans(spec.text, size)}</text>
</svg>`;
}

async function rasterPixels(spec: ImageSpec): Promise<{ pixels: Uint8Array; width: number; height: number; png: Uint8Array }> {
  await ensureWasm();
  const svg = buildSvg(spec, { embedFont: false, raster: true });
  const r = new Resvg(svg, {
    font: { fontBuffers: [fontBytes], defaultFontFamily: FONT_FAMILY, loadSystemFonts: false },
  });
  const rendered = r.render();
  const png = rendered.asPng();
  const pixels = rendered.pixels;
  const width = rendered.width;
  const height = rendered.height;
  rendered.free();
  r.free();
  return { pixels, width, height, png };
}

export interface RenderResult {
  body: Uint8Array | string;
  contentType: string;
}

export async function render(spec: ImageSpec, format: Format): Promise<RenderResult> {
  if (format === "svg") {
    return {
      body: buildSvg(spec, { embedFont: true, raster: false }),
      contentType: "image/svg+xml",
    };
  }

  const { pixels, width, height, png } = await rasterPixels(spec);

  if (format === "png") {
    return { body: png, contentType: "image/png" };
  }

  if (format === "jpg") {
    const encoded = jpeg.encode({ data: pixels, width, height }, 75);
    return { body: new Uint8Array(encoded.data), contentType: "image/jpeg" };
  }

  // gif
  const rgba = new Uint8Array(pixels);
  const palette = quantize(rgba, 256);
  const index = applyPalette(rgba, palette);
  const enc = GIFEncoder();
  enc.writeFrame(index, width, height, { palette });
  enc.finish();
  return { body: enc.bytes(), contentType: "image/gif" };
}

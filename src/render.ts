// Image generation.
//
// SVG (default): markup from svg.ts with a brand font subset embedded.
// PNG/JPG/GIF/WebP: the same SVG drawn by resvg-wasm (full font passed as a
// buffer), then encoded.
//
// Memory is the constraint (a Worker gets 128MB, and wasm memory never shrinks
// once grown). So raster renders run one at a time per isolate, only one JS
// copy of the pixels is kept, and the WebP encoder gets a fresh wasm instance
// per image so its ~50MB peak can be garbage-collected afterwards.

import { Resvg, initWasm } from "@resvg/resvg-wasm";
// @ts-ignore - .wasm import resolves to a WebAssembly.Module in Workers
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
// @ts-ignore - Workers support SIMD, so jsquash loads its SIMD build
import webpWasm from "@jsquash/webp/codec/enc/webp_enc_simd.wasm";
import encodeWebp, { init as initWebp } from "@jsquash/webp/encode";
// @ts-ignore - .ttf import resolves to an ArrayBuffer via the Data module rule
import fontTtf from "../AauxOffice-Bold.ttf";
import jpeg from "jpeg-js";
import { quantize, applyPalette, GIFEncoder } from "gifenc";
import { TRANSPARENT } from "./color";
import type { Format, ImageSpec } from "./parse";
import { buildSvg, FONT_FAMILY } from "./svg";

const fontBytes = new Uint8Array(fontTtf as ArrayBuffer);

// resvg can only be initialized once per isolate. A failed attempt is not
// remembered, so the next request tries again instead of failing forever.
let resvgReady: Promise<void> | null = null;
function ensureResvg(): Promise<void> {
  if (!resvgReady) {
    resvgReady = initWasm(resvgWasm as WebAssembly.Module).catch((e) => {
      resvgReady = null;
      throw e;
    });
  }
  return resvgReady;
}

export interface RenderResult {
  body: Uint8Array | string;
  contentType: string;
}

// One raster render at a time per isolate, so two big images never hold
// memory at once. A failed render doesn't block the ones queued behind it.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

export function render(spec: ImageSpec, format: Format): Promise<RenderResult> {
  if (format === "svg") {
    return Promise.resolve({
      body: buildSvg(spec, { embedFont: true }),
      contentType: "image/svg+xml; charset=utf-8",
    });
  }
  return serialized(() => renderRaster(spec, format));
}

// resvg hands back premultiplied RGBA. Opaque pixels are unaffected; edge
// pixels of text on a transparent background need un-premultiplying or they
// come out darker than the text color.
function unpremultiply(px: Uint8Array): void {
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a === 0 || a === 255) continue;
    px[i] = Math.min(255, Math.round((px[i] * 255) / a));
    px[i + 1] = Math.min(255, Math.round((px[i + 1] * 255) / a));
    px[i + 2] = Math.min(255, Math.round((px[i + 2] * 255) / a));
  }
}

/** Draw the image. PNG comes straight from resvg; the rest get RGBA pixels. */
function draw(spec: ImageSpec, format: Format): { png: Uint8Array } | { pixels: Uint8Array; width: number; height: number } {
  const transparent = spec.bg === TRANSPARENT;
  const r = new Resvg(buildSvg(spec, { embedFont: false }), {
    font: { fontBuffers: [fontBytes], defaultFontFamily: FONT_FAMILY, loadSystemFonts: false },
    fitTo: spec.scale > 1 ? { mode: "zoom", value: spec.scale } : { mode: "original" },
    // JPG has no alpha channel: a transparent background becomes white.
    ...(transparent && format === "jpg" ? { background: "#ffffff" } : {}),
  });
  try {
    const rendered = r.render();
    try {
      if (format === "png") return { png: rendered.asPng() };
      return { pixels: rendered.pixels, width: rendered.width, height: rendered.height };
    } finally {
      rendered.free();
    }
  } finally {
    r.free();
  }
}

async function renderRaster(spec: ImageSpec, format: Format): Promise<RenderResult> {
  await ensureResvg();
  const drawn = draw(spec, format);
  if ("png" in drawn) return { body: drawn.png, contentType: "image/png" };

  const { pixels, width, height } = drawn;

  if (format === "jpg") {
    const encoded = jpeg.encode({ data: pixels, width, height }, 75);
    return { body: new Uint8Array(encoded.data), contentType: "image/jpeg" };
  }

  if (spec.bg === TRANSPARENT) unpremultiply(pixels);

  if (format === "webp") {
    // A fresh encoder instance per image (see the note at the top).
    await initWebp(webpWasm as WebAssembly.Module);
    // Lossless: flat-color placeholders compress to a few hundred bytes.
    const buf = await encodeWebp(
      { data: new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength), width, height } as unknown as Parameters<typeof encodeWebp>[0],
      { lossless: 1, quality: 100, method: 2 },
    );
    return { body: new Uint8Array(buf), contentType: "image/webp" };
  }

  // gif
  const transparent = spec.bg === TRANSPARENT;
  const palette = transparent
    ? quantize(pixels, 256, { format: "rgba4444", oneBitAlpha: true })
    : quantize(pixels, 256);
  const index = transparent ? applyPalette(pixels, palette, "rgba4444") : applyPalette(pixels, palette);
  const transparentIndex = transparent ? palette.findIndex((c: number[]) => c[3] === 0) : -1;
  const enc = GIFEncoder();
  enc.writeFrame(index, width, height, {
    palette,
    transparent: transparentIndex >= 0,
    transparentIndex: Math.max(transparentIndex, 0),
  });
  enc.finish();
  return { body: enc.bytes(), contentType: "image/gif" };
}

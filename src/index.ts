// placehold.us — Cloudflare Worker entrypoint.
//
// The Worker runs first for every request (assets.run_worker_first), so it can
// send www to the main domain. Paths that start with a digit are image
// requests (/350x150/09f/fff.png); everything else is a static file in
// ./public, served through the ASSETS binding.

import { parseRequest, cacheKeyFor } from "./parse";
import { render } from "./render";
import { errorSvg } from "./svg";
import { canonicalRedirect, isImagePath, rateLimitKey } from "./routing";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ASSETS: Fetcher;
  GA_MEASUREMENT_ID?: string;
  GA_API_SECRET?: string;
  RATE_LIMITER: RateLimiter; // 100 new images / minute per client
  RATE_LIMITER_LARGE: RateLimiter; // 20 / minute for raster images over 1MP
}

const EXPIRES = 2592000; // 30 days
const LARGE_PIXELS = 1_000_000;

// Sent on every image and image error. CORS lets other sites draw our images
// into <canvas>/WebGL. The CSP means an SVG opened directly in a tab can never
// run script, even if a future bug lets markup through again.
const IMAGE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Timing-Allow-Origin": "*",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; sandbox",
};

// Bad-URL answers never change, so browsers may keep them for an hour.
function errorCacheControl(status: number): string {
  return [400, 404, 413].includes(status) ? "public, max-age=3600" : "no-store";
}

function textResponse(status: number, body: string, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { ...IMAGE_HEADERS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": errorCacheControl(status), ...extra },
  });
}

// Image errors come back as an SVG that says what's wrong, drawn at the
// requested size, so an <img> shows the problem instead of a broken icon. The
// status code stays an error, and X-Placehold-Error carries the message for
// curl and devtools. Always SVG, whatever format was asked for: it costs
// nothing to make at any size.
function errorImage(
  status: number,
  message: string,
  size?: { w: number; h: number },
  extra: Record<string, string> = {},
): Response {
  return new Response(errorSvg(message, size), {
    status,
    headers: {
      ...IMAGE_HEADERS,
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": errorCacheControl(status),
      "X-Placehold-Error": message.replace(/\s*\n\s*/g, ". ").replace(/[^\x20-\x7e]/g, ""),
      ...extra,
    },
  });
}

async function sha256Hex(key: string | null, message: string): Promise<string> {
  const enc = new TextEncoder();
  if (key === null) {
    return toHex(await crypto.subtle.digest("SHA-256", enc.encode(message)));
  }
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}
function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// GA client id: a keyed hash of IP + browser + today's date. It can't be
// reversed without the secret, and the same person gets a new id every day,
// so nobody can follow them across the sites that embed our images.
async function clientId(secret: string, ip: string, ua: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  return (await sha256Hex(secret, `${day}|${ip}|${ua}`)).slice(0, 32);
}

async function trackImageGeneration(env: Env, request: Request, params: Record<string, string>): Promise<void> {
  const secret = env.GA_API_SECRET;
  const measurementId = env.GA_MEASUREMENT_ID || "G-73WR5GHTDB";
  if (!secret) return; // not configured (e.g. local dev) -> skip

  try {
    const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
    const ua = request.headers.get("User-Agent") || "";
    const payload = {
      client_id: await clientId(secret, ip, ua),
      events: [{ name: "image_generated", params: { ...params, engagement_time_msec: 100 } }],
    };
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${secret}`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  } catch {
    // analytics must never affect the image
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const redirectTo = canonicalRedirect(url);
    if (redirectTo) {
      return new Response(null, {
        status: 301,
        headers: { Location: redirectTo, "Cache-Control": "public, max-age=86400" },
      });
    }

    if (!isImagePath(url.pathname)) return env.ASSETS.fetch(request);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...IMAGE_HEADERS,
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return textResponse(405, "Method not allowed", { Allow: "GET, HEAD, OPTIONS" });
    }

    const { format, spec, status, error, errorSize } = parseRequest(url);
    if (!spec) return errorImage(status ?? 404, error || "Not found", errorSize);

    const key = cacheKeyFor(url.origin, format, spec);
    // The same URL always draws the same image, so the ETag is the cache key.
    const etag = `"${(await sha256Hex(null, key)).slice(0, 32)}"`;
    const cacheHeaders = {
      "Cache-Control": `public, max-age=${EXPIRES}, immutable`,
      ETag: etag,
    };

    // The browser already has it: answer 304 without touching the cache.
    const inm = request.headers.get("If-None-Match");
    if (inm && inm.split(",").some((t) => t.trim().replace(/^W\//, "") === etag)) {
      return new Response(null, { status: 304, headers: { ...IMAGE_HEADERS, ...cacheHeaders } });
    }

    // Serve from the edge cache when we have it.
    const cache = caches.default;
    const cacheKey = new Request(key, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // Rate limits on cache misses (the expensive path), per client. Large
    // raster images get a much tighter limit of their own.
    const client = rateLimitKey(request.headers.get("CF-Connecting-IP"));
    const scale = format === "svg" ? 1 : spec.scale;
    const large = format !== "svg" && spec.w * spec.h * scale * scale > LARGE_PIXELS;
    const size = { w: spec.w, h: spec.h };
    if (!(await env.RATE_LIMITER.limit({ key: client })).success) {
      return errorImage(429, "Slow down\n100 new images a minute\nTry again in a minute", size, { "Retry-After": "60" });
    }
    if (large && !(await env.RATE_LIMITER_LARGE.limit({ key: client })).success) {
      return errorImage(429, "Slow down\n20 large images a minute\nTry again in a minute", size, { "Retry-After": "60" });
    }

    let result;
    try {
      result = await render(spec, format);
    } catch (e) {
      console.error("render failed", url.pathname, e);
      return errorImage(500, "Something went wrong\nTry again", { w: spec.w, h: spec.h });
    }

    const response = new Response(result.body, {
      headers: {
        ...IMAGE_HEADERS,
        "Content-Type": result.contentType,
        ...cacheHeaders,
        Expires: new Date(Date.now() + EXPIRES * 1000).toUTCString(),
        "Last-Modified": new Date().toUTCString(),
      },
    });

    // Cache + fire-and-forget analytics, neither blocking the response.
    ctx.waitUntil(cache.put(cacheKey, response.clone()).catch((e) => console.error("cache put failed", e)));
    if (request.method === "GET") {
      ctx.waitUntil(
        trackImageGeneration(env, request, {
          dimensions: `${spec.w}x${spec.h}`,
          format,
          custom_text: spec.customText ? "yes" : "no",
          scale: `${scale}x`,
          background: spec.bg === "transparent" ? "transparent" : "color",
        }),
      );
    }

    return response;
  },
};

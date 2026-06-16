// placehold.us — Cloudflare Worker entrypoint.
//
// Static files (homepage, css, favicon, font) are served by the [assets]
// binding before this Worker runs. The Worker handles image generation for
// paths like /350x150/09f/fff.png — replacing code.php + the .htaccess rewrite.

import { parseRequest } from "./parse";
import { render } from "./render";

interface Env {
  ASSETS: Fetcher;
  GA_MEASUREMENT_ID?: string;
  GA_API_SECRET?: string;
}

const EXPIRES = 2592000; // 30 days, matching code.php

// Stable-ish client id from IP + UA (replaces md5($ip.$ua) in code.php).
function clientId(ip: string, ua: string): string {
  let h = 0x811c9dc5;
  const s = ip + ua;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function trackImageGeneration(
  env: Env,
  request: Request,
  dims: string,
  format: string,
  hasText: boolean,
): Promise<unknown> | null {
  const secret = env.GA_API_SECRET;
  const measurementId = env.GA_MEASUREMENT_ID || "G-73WR5GHTDB";
  if (!secret) return null; // not configured (e.g. local dev) -> skip

  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const ua = request.headers.get("User-Agent") || "";
  const payload = {
    client_id: clientId(ip, ua),
    events: [
      {
        name: "image_generated",
        params: {
          dimensions: dims,
          format,
          custom_text: hasText ? "yes" : "no",
          engagement_time_msec: 100,
        },
      },
    ],
  };
  return fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${secret}`,
    { method: "POST", body: JSON.stringify(payload) },
  ).catch(() => {});
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cache = caches.default;

    // Serve from edge cache when we have it.
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const { format, spec, error } = parseRequest(url);
    if (!spec) {
      const status = error === "Too big!" ? 413 : 404;
      return new Response(error || "Not found", {
        status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    let result;
    try {
      result = await render(spec, format);
    } catch (e) {
      return new Response("Image generation failed", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const now = new Date().toUTCString();
    const response = new Response(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": `public, max-age=${EXPIRES}, must-revalidate`,
        Expires: new Date(Date.now() + EXPIRES * 1000).toUTCString(),
        "Last-Modified": now,
      },
    });

    // Cache + fire-and-forget analytics, neither blocking the response.
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    const track = trackImageGeneration(
      env,
      request,
      `${spec.w}x${spec.h}`,
      format,
      url.searchParams.has("text") || url.pathname.includes("&text="),
    );
    if (track) ctx.waitUntil(track);

    return response;
  },
};

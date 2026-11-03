// Host and path routing decisions, kept free of wasm imports for unit tests.

export const CANONICAL_HOST = "placehold.us";
const REDIRECT_HOSTS = new Set(["www.placehold.us"]);

/** Where to send a request on a non-canonical host, or null to serve it. */
export function canonicalRedirect(url: URL): string | null {
  if (!REDIRECT_HOSTS.has(url.hostname)) return null;
  const to = new URL(url.toString());
  to.hostname = CANONICAL_HOST;
  to.protocol = "https:";
  to.port = "";
  return to.toString();
}

/** Image URLs start with a digit (/300, /350x150/...); the rest are static files. */
export function isImagePath(pathname: string): boolean {
  return /^\/\d/.test(pathname);
}

/**
 * The rate-limit key for a client IP. IPv4 is used as-is. IPv6 is cut to its
 * /64 network, because one home or server usually gets a whole /64 and could
 * otherwise rotate through billions of addresses to dodge the limit.
 */
export function rateLimitKey(ip: string | null): string {
  if (!ip) return "unknown";
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = ip.includes("::") ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array(Math.max(missing, 0)).fill("0"), ...right];
  return groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, "") || "0")
    .join(":") + "::/64";
}

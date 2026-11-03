// Color parsing for the URL grammar.
//
// Only real hex colors are accepted. Anything else falls back to the default,
// because these values are written into SVG markup: an unchecked value let a
// crafted URL inject elements and run script on placehold.us (fixed 2026-11-03).

export const TRANSPARENT = "transparent";

const HEX = /^[0-9a-f]+$/;

/**
 * Normalize a hex color to 6 lowercase digits (no '#'), or return null if the
 * input is not a valid hex color. Shorthand follows the old PHP service:
 *   "a"   -> "aaaaaa"
 *   "ab"  -> "ababab"
 *   "09f" -> "0099ff"
 *   6 digits as-is
 */
export function normalizeHex(input: string): string | null {
  const hex = (input || "").toLowerCase().replace(/^#/, "");
  if (!HEX.test(hex)) return null;
  switch (hex.length) {
    case 1:
      return hex.repeat(6);
    case 2:
      return hex.repeat(3);
    case 3:
      return hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    case 6:
      return hex;
    default:
      return null;
  }
}

/** Background color: a hex color or "transparent". Invalid input -> fallback. */
export function parseBackground(input: string, fallback: string): string {
  const v = (input || "").toLowerCase();
  if (v === TRANSPARENT) return TRANSPARENT;
  return normalizeHex(v) ?? fallback;
}

/** Text color: a hex color. Invalid input -> fallback. */
export function parseForeground(input: string, fallback: string): string {
  return normalizeHex(input) ?? fallback;
}

// Color parsing for the URL grammar.
//
// Only real hex colors are accepted, because these values are written into SVG
// markup: an unchecked value let a crafted URL inject elements and run script
// on placehold.us (fixed 2026-11-03). Since 2026-11-05 anything else gets an
// error image instead of quietly falling back to the default colors.

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

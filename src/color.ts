// Port of the bits of color.class.php that code.php actually uses:
// set_hex() shorthand expansion + hex->rgb. CMYK/pantone/color-names are
// unused by the image path and intentionally omitted.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Normalize a hex color string to a full 6-digit lowercase hex (no '#').
 * Mirrors color.class.php::set_hex shorthand handling:
 *   1 char  "a"   -> "aaaaaa"
 *   2 chars "ab"  -> "ababab"
 *   3 chars "09f" -> "0099ff"
 *   6 chars       -> as-is
 * Any other length is left as-is (degenerate input).
 *
 * Note: the original PHP emitted the *raw* (unexpanded) string into the SVG
 * fill, so "#09f"/"#ccc" rendered identically to the expanded form. We expand
 * for both SVG and raster so the two paths always agree; rendered output is
 * identical for all valid 3/6-digit colors and this also fixes the latent
 * 1-/2-digit case where the SVG previously got invalid CSS.
 */
export function normalizeHex(input: string): string {
  let hex = (input || "").toLowerCase().replace(/#/g, "");
  switch (hex.length) {
    case 1:
      hex = hex.repeat(6);
      break;
    case 2:
      hex = (hex[0] + hex[1]).repeat(3);
      break;
    case 3:
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      break;
  }
  return hex;
}

export function hexToRgb(input: string): Rgb {
  const hex = normalizeHex(input);
  return {
    r: parseInt(hex.slice(0, 2), 16) || 0,
    g: parseInt(hex.slice(2, 4), 16) || 0,
    b: parseInt(hex.slice(4, 6), 16) || 0,
  };
}

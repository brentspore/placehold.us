// Builds the share image and favicon set from SVG with resvg, using the
// site's own font and colors. Run `npm run build:og` after changing the
// design; the PNGs in public/ are committed.
//
//   public/og.png               1200x630  Open Graph / Twitter card
//   public/favicon.svg          vector favicon
//   public/favicon.ico          16/32/48 (PNG-in-ICO)
//   public/favicon-32.png       32x32
//   public/apple-touch-icon.png 180x180
//   public/icon-512.png         512x512 (web manifest)
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { readFileSync, writeFileSync } from "fs";

await initWasm(readFileSync("node_modules/@resvg/resvg-wasm/index_bg.wasm"));
const font = readFileSync("AauxOffice-Bold.ttf");

const PINK = "#E8117F";
const INK = "#222222";
const GRAY = "#cccccc";
const GRAY_TEXT = "#969696";

function png(svg, width) {
  const r = new Resvg(svg, {
    font: { fontBuffers: [font], defaultFontFamily: "AauxOffice", loadSystemFonts: false },
    fitTo: { mode: "width", value: width },
  });
  const out = r.render().asPng();
  r.free();
  return out;
}

// A placeholder tile, drawn the way the service draws one.
function tile(x, y, w, h, bg, fg, label, size) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>
  <text x="${x + w / 2}" y="${y + h / 2}" font-size="${size}" fill="${fg}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
}

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="AauxOffice" font-weight="bold">
  <defs>
    <pattern id="checker" width="24" height="24" patternUnits="userSpaceOnUse">
      <rect width="24" height="24" fill="#ffffff"/>
      <rect width="12" height="12" fill="#ececec"/>
      <rect x="12" y="12" width="12" height="12" fill="#ececec"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="${PINK}"/>

  <!-- wordmark, styled like the homepage header -->
  <rect x="80" y="92" width="292" height="64" fill="${INK}"/>
  <text x="98" y="125" font-size="40" fill="#ffffff" dominant-baseline="central" letter-spacing="1">PLACEHOLD.US</text>

  <text font-size="76" fill="#ffffff" letter-spacing="-1">
    <tspan x="76" y="268">Placeholder</tspan>
    <tspan x="76" y="350">images from</tspan>
    <tspan x="76" y="432">a URL.</tspan>
  </text>

  <!-- the URL you type -->
  <rect x="80" y="486" width="322" height="60" fill="#ffffff"/>
  <text x="102" y="517" font-size="32" fill="${INK}" dominant-baseline="central">placehold.us/<tspan fill="${PINK}">350x150</tspan></text>

  <!-- what you get -->
  ${tile(640, 92, 480, 206, GRAY, GRAY_TEXT, "350 x 150", 64)}
  ${tile(640, 318, 274, 228, INK, "#ffffff", "300 x 250", 44)}
  <rect x="934" y="318" width="186" height="104" fill="url(#checker)"/>
  <text x="1027" y="370" font-size="28" fill="${PINK}" text-anchor="middle" dominant-baseline="central">transparent</text>
  ${tile(934, 442, 186, 104, "#ffffff", INK, ".webp @2x", 28)}
</svg>`;

// Favicon: a gray placeholder tile on brand pink.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${PINK}"/>
  <rect x="6" y="8" width="20" height="16" fill="${GRAY}"/>
  <path d="M6 8 L26 24 M26 8 L6 24" stroke="${GRAY_TEXT}" stroke-width="1.6"/>
</svg>
`;
// ICO with PNG payloads (supported by every browser since IE Vista era).
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); // color planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((im) => Buffer.from(im.data))]);
}

// Apple and manifest icons get a square, unrounded background (iOS rounds them).
const iconSquare = icon.replace(' rx="6"', "");

writeFileSync("public/og.png", png(og, 1200));
writeFileSync("public/favicon.svg", icon);
writeFileSync("public/favicon-32.png", png(icon, 32));
writeFileSync("public/favicon.ico", ico([16, 32, 48].map((size) => ({ size, data: png(icon, size) }))));
writeFileSync("public/apple-touch-icon.png", png(iconSquare, 180));
writeFileSync("public/icon-512.png", png(iconSquare, 512));
console.log("wrote public/og.png, favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png, icon-512.png");

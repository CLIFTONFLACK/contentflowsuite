/**
 * Generates og-image.png — the 1200x630 link preview card.
 *
 * Same layout as the DealMaker and masterbrand cards (GetBrian-DealMaker/scripts/gen-og.mjs,
 * GetBrian-Main/scripts/gen-icons.mjs): the traced lockup vector from brand/, the product
 * name letterspaced in Gold Deep under it, then plain type on the dot-grid white ground.
 *
 * Run:
 *   node scripts/gen-og.mjs
 *
 * `sharp` is not a dependency of this site — it's only needed to regenerate this one
 * committed PNG, so borrow it from the masterbrand repo rather than adding a native
 * module to a static deploy. Node ignores NODE_PATH for ES module imports, so the
 * script resolves sharp itself from SHARP_FROM (a node_modules directory), defaulting
 * to a sibling GetBrian-Main checkout. PowerShell:
 *   $env:SHARP_FROM = "G:\My Drive\CLAUDE\Ai-projects-BRIAN\GetBrian-Main\node_modules"; node scripts/gen-og.mjs
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const sharpFrom = path.resolve(process.env.SHARP_FROM || path.join(root, "..", "GetBrian-Main", "node_modules"));
const sharp = createRequire(path.join(sharpFrom, path.sep))("sharp");
const BRAND = path.join(root, "brand");

const NAVY = "#0A1D3B";
const INK = "#14172B";
const MUTED = "#454A64";
const GOLD_DEEP = "#8A6520";

/* Bricolage Grotesque and DM Sans are self-hosted woff2 for the page, which librsvg
   cannot load, so this falls back to the machine's UI grotesque — the same compromise
   the DealMaker and masterbrand cards make. The one thing that must be exact, the
   lockup, is the traced vector, not type. */
const UI_FONT = "Segoe UI, Helvetica Neue, Arial, sans-serif";

const OG_W = 1200;
const OG_H = 630;

const lock = await sharp(path.join(BRAND, "brian-logo.svg"))
  .resize({ width: 320 })
  .png()
  .toBuffer();
const lockMeta = await sharp(lock).metadata();

const lockTop = 96;
const titleY = lockTop + lockMeta.height + 86;

const bg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">` +
    `<defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">` +
    `<circle cx="1" cy="1" r="1" fill="rgba(20,23,43,0.09)"/></pattern></defs>` +
    `<rect width="${OG_W}" height="${OG_H}" fill="#ffffff"/>` +
    `<rect width="${OG_W}" height="${OG_H}" fill="url(#dots)"/>` +
    `<rect x="0" y="0" width="${OG_W}" height="7" fill="${NAVY}"/>` +
    `</svg>`
);

const mid = OG_W / 2;
const text = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">` +
    `<text x="${mid}" y="${lockTop + lockMeta.height + 36}" text-anchor="middle" font-family="${UI_FONT}" font-size="30" font-weight="600" letter-spacing="6" fill="${GOLD_DEEP}">CONTENTFLOW</text>` +
    `<text x="${mid}" y="${titleY + 16}" text-anchor="middle" font-family="${UI_FONT}" font-size="44" font-weight="700" fill="${INK}">One WordPress plugin. Not four subscriptions.</text>` +
    `<text x="${mid}" y="${titleY + 70}" text-anchor="middle" font-family="${UI_FONT}" font-size="26" font-weight="400" fill="${MUTED}">A theme, a writer, a reviewer and the plumbing that gets you cited by AI.</text>` +
    `<text x="${mid}" y="${OG_H - 40}" text-anchor="middle" font-family="${UI_FONT}" font-size="24" font-weight="600" fill="${NAVY}">flow.getbrian.xyz</text>` +
    `</svg>`
);

const og = await sharp(bg)
  .composite([
    { input: lock, left: Math.round((OG_W - lockMeta.width) / 2), top: lockTop },
    { input: text, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();

const out = path.join(root, "og-image.png");
writeFileSync(out, og);
console.log(`wrote ${path.relative(root, out)} (${(og.length / 1024).toFixed(1)} kB)`);

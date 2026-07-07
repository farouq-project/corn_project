// Run with: node scripts/generate-icons.mjs
// Generates PNG icons from the SVG for PWA use
// Requires: npm install -D sharp (one-time)

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const iconsDir = join(publicDir, "icons");

mkdirSync(iconsDir, { recursive: true });

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.log("sharp not installed — run: npm install -D sharp");
  process.exit(0);
}

const svgPath = join(iconsDir, "icon.svg");
const svg = readFileSync(svgPath);

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, `icon-${size}.png`));
  console.log(`✓ icon-${size}.png`);
}

// Apple touch icon (180x180)
await sharp(svg).resize(180, 180).png().toFile(join(iconsDir, "apple-touch-icon.png"));
console.log("✓ apple-touch-icon.png");
console.log("Done!");

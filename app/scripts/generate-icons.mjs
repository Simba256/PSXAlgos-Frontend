#!/usr/bin/env node
// Rasterizes the SVG source icons to PNG at the standard resolutions.
// Run: node scripts/generate-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");

const jobs = [
  // Browser favicons (light OS / default)
  { src: "icon-paper.svg", out: "favicon-16.png", size: 16 },
  { src: "icon-paper.svg", out: "favicon-32.png", size: 32 },
  { src: "icon-paper.svg", out: "favicon-48.png", size: 48 },

  // Browser favicons (dark OS)
  { src: "icon-amber.svg", out: "favicon-16-amber.png", size: 16 },
  { src: "icon-amber.svg", out: "favicon-32-amber.png", size: 32 },

  // iOS home screen / Safari pinned
  { src: "apple-touch-icon.svg", out: "apple-touch-icon.png", size: 180 },

  // PWA / Android
  { src: "apple-touch-icon.svg", out: "icon-192.png", size: 192 },
  { src: "apple-touch-icon.svg", out: "icon-512.png", size: 512 },
  { src: "icon-maskable.svg", out: "icon-maskable-192.png", size: 192 },
  { src: "icon-maskable.svg", out: "icon-maskable-512.png", size: 512 },

  // High-res for app-store / marketing
  { src: "apple-touch-icon.svg", out: "icon-1024.png", size: 1024 },
];

for (const { src, out, size } of jobs) {
  const buf = await readFile(path.join(publicDir, src));
  const png = await sharp(buf, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(publicDir, out), png);
  console.log(`✓ ${out.padEnd(28)} (${size}×${size})  ← ${src}`);
}

console.log("\nDone.");

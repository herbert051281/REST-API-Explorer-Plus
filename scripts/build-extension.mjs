#!/usr/bin/env node
/**
 * Builds the browser extension package.
 *
 * 1. Rebuilds bookmarklet.min.js via esbuild
 * 2. Copies it into extension/
 * 3. Generates icons (16, 48, 128 px) — solid teal with a white sidebar glyph
 * 4. Creates extension.zip ready for Edge Add-ons submission or IT distribution
 *
 * No external npm dependencies required.
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// SharePoint folder synced via OneDrive for Business.
// Teammates point "Load unpacked" at their own synced copy of this folder.
const SHAREPOINT_DEPLOY_PATH =
  'C:\\Users\\E112671\\RSM\\Customer Success - Project & Document Templates and Wiki\\REST API Explorer Plus Extension';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Minimal PNG encoder ────────────────────────────────────────────────────────

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; }
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Buffer.concat([u32(d.length), t, d, u32(crc32(Buffer.concat([t, d])))]);
}

/**
 * Creates a solid-color PNG image.
 * @param {number} size - Width and height in pixels
 * @param {[number,number,number]} rgb - RGB color [r, g, b] (0–255 each)
 * @param {(x:number, y:number) => [number,number,number]|null} [overlay]
 *   Optional callback — if it returns an [r,g,b] array for a given pixel, that
 *   color is used instead of the base color. Used to draw the white glyph.
 */
function makePNG(size, [br, bg, bb], overlay) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13, 0);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: truecolor RGB
  const ihdr = pngChunk('IHDR', ihdrData);

  const rowSize = 1 + size * 3;
  const rawData = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    rawData[y * rowSize] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      const px = overlay ? overlay(x, y, size) : null;
      const [r, g, b] = px ?? [br, bg, bb];
      const off = y * rowSize + 1 + x * 3;
      rawData[off] = r;
      rawData[off + 1] = g;
      rawData[off + 2] = b;
    }
  }

  const idat = pngChunk('IDAT', deflateSync(rawData));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Brand color: #1d3c4b
const TEAL = [29, 60, 75];
const WHITE = [255, 255, 255];

/**
 * Draws a simplified "side panel" glyph:
 *   - Two short white horizontal lines on the left half (hamburger-style)
 *   - A white vertical bar on the right (representing the open panel)
 * Works reasonably at 16px, 48px, and 128px.
 */
function glyphOverlay(x, y, size) {
  const s = size;
  const p = (v) => Math.round(v * s); // scale a 0–1 fraction to pixels

  // Right-side panel bar: x in [68%..80%], y in [12%..88%]
  if (x >= p(0.68) && x <= p(0.80) && y >= p(0.12) && y <= p(0.88)) return WHITE;

  // Top menu line: x in [14%..56%], y in [28%..36%]
  if (x >= p(0.14) && x <= p(0.56) && y >= p(0.28) && y <= p(0.36)) return WHITE;

  // Middle menu line: x in [14%..56%], y in [46%..54%]
  if (x >= p(0.14) && x <= p(0.56) && y >= p(0.46) && y <= p(0.54)) return WHITE;

  // Bottom menu line: x in [14%..56%], y in [64%..72%]
  if (x >= p(0.14) && x <= p(0.56) && y >= p(0.64) && y <= p(0.72)) return WHITE;

  return null; // use base teal
}

// ── Main build steps ───────────────────────────────────────────────────────────

console.log('① Rebuilding bookmarklet.min.js…');
execSync(
  'npx esbuild public/bookmarklet.js --bundle --minify --format=iife --target=chrome90 --platform=browser --outfile=public/bookmarklet.min.js',
  { cwd: root, stdio: 'inherit' }
);

console.log('② Copying files into extension/…');
mkdirSync(join(root, 'extension', 'icons'), { recursive: true });
cpSync(join(root, 'public', 'bookmarklet.min.js'), join(root, 'extension', 'bookmarklet.min.js'));

console.log('③ Generating icons…');
for (const size of [16, 48, 128]) {
  writeFileSync(
    join(root, 'extension', 'icons', `icon${size}.png`),
    makePNG(size, TEAL, glyphOverlay)
  );
  console.log(`   icon${size}.png ✓`);
}

console.log('④ Packaging extension.zip…');
const zipPath = join(root, 'extension.zip');
execSync(
  `powershell -Command "if (Test-Path '${zipPath}') { Remove-Item '${zipPath}' }; Compress-Archive -Path '${join(root, 'extension')}\\*' -DestinationPath '${zipPath}'"`,
  { cwd: root, stdio: 'inherit' }
);

console.log('⑤ Deploying to SharePoint (OneDrive sync)…');
try {
  cpSync(join(root, 'extension'), SHAREPOINT_DEPLOY_PATH, { recursive: true });
  console.log(`   Copied → ${SHAREPOINT_DEPLOY_PATH}`);
} catch (err) {
  console.warn(`   ⚠ Deploy skipped: ${err.message}`);
  console.warn('   (Is the OneDrive folder accessible? Run "npm run deploy" manually when it is.)');
}

console.log('\n✅ Done!');
console.log('   extension/               — local copy');
console.log('   SharePoint/OneDrive      — teammates reload their extension to pick up changes');

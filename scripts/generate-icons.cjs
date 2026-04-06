/**
 * Generates PNG app icons for the PWA — no external dependencies.
 * Creates a chess-board pattern icon at multiple sizes.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ── PNG helpers ─────────────────────────────────────────────────────── */
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : c >>> 1;
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }
function chunk(type, data) {
  const t = Buffer.from(type);
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))]);
}

/* ── Draw a chess-board icon ─────────────────────────────────────────── */
function createPNG(size) {
  const border  = Math.max(1, Math.round(size * 0.06));
  const inner   = size - 2 * border;
  const squares = 8;
  // Colours
  const DARK_BLUE  = [29, 78, 216];   // border + dark squares  #1D4ED8
  const LIGHT_BLUE = [59, 130, 246];  // light squares          #3B82F6
  const WHITE      = [242, 244, 248]; // near-white squares

  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      let rgb;
      if (x < border || x >= size - border || y < border || y >= size - border) {
        rgb = DARK_BLUE;
      } else {
        const sqX = Math.floor((x - border) * squares / inner);
        const sqY = Math.floor((y - border) * squares / inner);
        rgb = (sqX + sqY) % 2 === 0 ? WHITE : LIGHT_BLUE;
      }
      const off = y * (1 + size * 3) + 1 + x * 3;
      raw[off] = rgb[0]; raw[off + 1] = rgb[1]; raw[off + 2] = rgb[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit depth, RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── Write files ─────────────────────────────────────────────────────── */
const outDir = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  { size: 192,  name: 'pwa-192x192.png' },
  { size: 512,  name: 'pwa-512x512.png' },
  { size: 180,  name: 'apple-touch-icon.png' },
];

for (const { size, name } of sizes) {
  const buf = createPNG(size);
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(`✓ ${name} (${size}×${size}, ${buf.length} bytes)`);
}
// Copy apple-touch-icon to public root (standard path)
fs.copyFileSync(
  path.join(outDir, 'apple-touch-icon.png'),
  path.resolve(__dirname, '..', 'public', 'apple-touch-icon.png')
);
console.log('✓ public/apple-touch-icon.png');

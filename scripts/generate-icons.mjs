#!/usr/bin/env node
// One-off dev utility: generates placeholder PWA icons as real PNG files
// using only Node's built-in zlib deflate (no sharp/canvas/native deps,
// so it runs anywhere Node runs). Re-run with `npm run generate-icons`
// if the brand mark ever needs to change.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = pngChunk("IHDR", ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // per-row filter: None
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }
  const idat = pngChunk("IDAT", deflateSync(raw, { level: 9 }));
  const iend = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function makeCanvas(width, height) {
  const buf = Buffer.alloc(width * height * 4);
  return {
    buf,
    setPixel(x, y, r, g, b, a) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      const srcA = a / 255;
      buf[i] = Math.round(r * srcA + buf[i] * (1 - srcA));
      buf[i + 1] = Math.round(g * srcA + buf[i + 1] * (1 - srcA));
      buf[i + 2] = Math.round(b * srcA + buf[i + 2] * (1 - srcA));
      buf[i + 3] = Math.round(a + buf[i + 3] * (1 - srcA));
    },
    fill(r, g, b, a = 255) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          buf[i] = r;
          buf[i + 1] = g;
          buf[i + 2] = b;
          buf[i + 3] = a;
        }
      }
    },
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Icon: a sand-patch test circle bisected by two diameter lines (the
// actual field measurement being recorded) on the app's navy brand tile.
function drawIcon(size, { padding = 0.14, maskable = false } = {}) {
  const canvas = makeCanvas(size, size);
  const navy = hexToRgb("#101826");
  const orange = hexToRgb("#f4791f");
  const cream = hexToRgb("#f5f4f1");

  canvas.fill(navy.r, navy.g, navy.b, 255);

  const cx = size / 2;
  const cy = size / 2;
  const safeR = size * (0.5 - padding) * (maskable ? 0.82 : 1);
  const ringBand = size * 0.018;
  const crossHalfWidth = size * 0.014;

  const SS = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let fillCoverage = 0;
      let ringCoverage = 0;
      let crossCoverage = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= safeR) fillCoverage++;
          if (Math.abs(dist - safeR) < ringBand) ringCoverage++;
          if (
            (Math.abs(dx) < crossHalfWidth || Math.abs(dy) < crossHalfWidth) &&
            dist <= safeR * 0.92
          ) {
            crossCoverage++;
          }
        }
      }
      const total = SS * SS;
      if (fillCoverage > 0) {
        canvas.setPixel(px, py, cream.r, cream.g, cream.b, (fillCoverage / total) * 255);
      }
      if (crossCoverage > 0) {
        canvas.setPixel(px, py, navy.r, navy.g, navy.b, (crossCoverage / total) * 255);
      }
      if (ringCoverage > 0) {
        canvas.setPixel(px, py, orange.r, orange.g, orange.b, (ringCoverage / total) * 255);
      }
    }
  }

  return canvas.buf;
}

function writeIcon(name, size, opts) {
  const rgba = drawIcon(size, opts);
  const png = encodePng(size, size, rgba);
  writeFileSync(join(outDir, name), png);
  console.log(`wrote public/icons/${name} (${size}x${size}, ${png.length} bytes)`);
  return png;
}

// Modern .ico files can embed PNG-compressed images directly (valid since
// Windows Vista, supported by every current browser/OS) - much simpler
// than encoding legacy uncompressed BMP entries.
function encodeIco(pngsBySize) {
  const count = pngsBySize.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const imageBuffers = [];
  let offset = 6 + count * 16;
  for (const { size, png } of pngsBySize) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count (0 = no palette)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    dirEntries.push(entry);
    imageBuffers.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers]);
}

writeIcon("icon-192.png", 192, {});
writeIcon("icon-512.png", 512, {});
writeIcon("icon-maskable-512.png", 512, { maskable: true });
writeIcon("apple-touch-icon.png", 180, { padding: 0.16 });
const favicon32Png = writeIcon("favicon-32.png", 32, {});
const favicon16Png = encodePng(16, 16, drawIcon(16, {}));

const icoPath = join(__dirname, "..", "app", "favicon.ico");
writeFileSync(
  icoPath,
  encodeIco([
    { size: 16, png: favicon16Png },
    { size: 32, png: favicon32Png },
  ]),
);
console.log("wrote app/favicon.ico (16x16 + 32x32)");

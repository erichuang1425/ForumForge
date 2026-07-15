import { deflateSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, "apps", "extension", "public", "icons");
const sizes = [16, 32, 48, 128];
const check = process.argv.includes("--check");

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return result;
}

function insideRoundedRectangle(x, y, left, top, right, bottom, radius) {
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function insideDiamond(x, y, centerX, centerY, radius) {
  return Math.abs(x - centerX) + Math.abs(y - centerY) <= radius;
}

function colorAt(x, y) {
  if (!insideRoundedRectangle(x, y, 0.0625, 0.0625, 0.9375, 0.9375, 0.1875)) {
    return [0, 0, 0, 0];
  }

  const white = [248, 250, 252, 255];
  const isVertical = x >= 0.265625 && x <= 0.390625 && y >= 0.21875 && y <= 0.78125;
  const isTop = x >= 0.265625 && x <= 0.703125 && y >= 0.21875 && y <= 0.34375;
  const isMiddle = x >= 0.265625 && x <= 0.625 && y >= 0.453125 && y <= 0.578125;
  if (isVertical || isTop || isMiddle) return white;

  if (insideDiamond(x, y, 0.7109375, 0.7109375, 0.1171875)) {
    return [245, 158, 11, 255];
  }

  return [23, 37, 84, 255];
}

function renderIcon(size) {
  const scale = 4;
  const width = size * scale;
  const highResolution = Buffer.alloc(width * width * 4);

  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = colorAt((x + 0.5) / width, (y + 0.5) / width);
      const offset = (y * width + x) * 4;
      highResolution.set(color, offset);
    }
  }

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < scale; sampleY += 1) {
        for (let sampleX = 0; sampleX < scale; sampleX += 1) {
          const source = ((y * scale + sampleY) * width + x * scale + sampleX) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            totals[channel] += highResolution[source + channel];
          }
        }
      }
      const target = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        pixels[target + channel] = Math.round(totals[channel] / (scale * scale));
      }
    }
  }

  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    scanlines[row] = 0;
    pixels.copy(scanlines, row + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

if (!check) await mkdir(outputDir, { recursive: true });

for (const size of sizes) {
  const path = join(outputDir, `icon-${size}.png`);
  const expected = renderIcon(size);
  if (check) {
    let actual;
    try {
      actual = await readFile(path);
    } catch {
      throw new Error(`Missing generated extension icon: ${path}`);
    }
    if (!actual.equals(expected)) {
      throw new Error(`Extension icon is stale; run pnpm icons:generate: ${path}`);
    }
  } else {
    await writeFile(path, expected);
  }
}

console.log(check ? "Extension icons are current." : "Generated extension icons.");

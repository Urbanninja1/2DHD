/**
 * Shared PNG creation and pixel manipulation helpers.
 * Used by generate-sprites.mjs, generate-parallax.mjs, and future generators.
 */

import { writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

/** Create an RGBA color object. */
export function hex(r, g, b, a = 255) {
  return { r, g, b, a };
}

/** Set a single pixel in a PNG buffer (bounds-checked). */
export function setPixel(png, x, y, color) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = color.a;
}

/** Fill a rectangle in a PNG buffer. */
export function fillRect(png, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(png, x + dx, y + dy, color);
    }
  }
}

/** Create a transparent PNG of the given dimensions. */
export function createPNG(width, height) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }
  return png;
}

/** Write a PNG to disk and log the result. */
export async function writePNG(png, filePath) {
  const buffer = PNG.sync.write(png, { colorType: 6 });
  await writeFile(filePath, buffer);
  const kb = (buffer.length / 1024).toFixed(1);
  console.log(`  wrote ${filePath} (${png.width}x${png.height}, ${kb} KB)`);
}

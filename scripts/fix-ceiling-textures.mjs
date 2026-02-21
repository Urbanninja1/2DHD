#!/usr/bin/env node
/**
 * Fix placeholder ceiling textures:
 * - ironwood-ceiling: replace flat normal + flat AO with proper wood-grain versions
 * - dark-stone: generate missing AO map
 *
 * One-shot script — run once, then delete.
 */

import { PNG } from 'pngjs';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SIZE = 1024;

// --- Seeded PRNG (same as hero prop generator) ---

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generateNoiseGrid(gridSize, rng) {
  const values = new Float32Array((gridSize + 1) * (gridSize + 1));
  for (let i = 0; i < values.length; i++) values[i] = rng();
  return values;
}

function sampleGrid(values, gridSize, u, v) {
  const gx = u * gridSize;
  const gy = v * gridSize;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const stride = gridSize + 1;
  const v00 = values[y0 * stride + x0];
  const v10 = values[y0 * stride + x0 + 1];
  const v01 = values[(y0 + 1) * stride + x0];
  const v11 = values[(y0 + 1) * stride + x0 + 1];
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

function multiOctaveNoise(u, v, octaves, rng) {
  let total = 0;
  let amplitude = 1;
  let maxAmplitude = 0;
  for (const { gridSize, weight } of octaves) {
    const grid = generateNoiseGrid(gridSize, rng);
    total += sampleGrid(grid, gridSize, u, v) * weight * amplitude;
    maxAmplitude += weight * amplitude;
    amplitude *= 0.5;
  }
  return total / maxAmplitude;
}

async function pngToJpeg(png, quality = 85) {
  const pngBuffer = PNG.sync.write(png, { colorType: 6 });
  return sharp(pngBuffer).jpeg({ quality }).toBuffer();
}

// --- Wood grain normal map ---

function generateWoodNormal(size, seed) {
  const png = new PNG({ width: size, height: size });
  const data = png.data;

  // Height map with directional wood grain (horizontal lines)
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const rng = mulberry32(seed + 50000 + y * size + x);

      // Wood grain: strong horizontal frequency, weaker vertical
      const grainOctaves = [
        { gridSize: 4, weight: 0.3 },   // broad planks
        { gridSize: 16, weight: 0.35 },  // grain lines
        { gridSize: 48, weight: 0.2 },   // fine grain
        { gridSize: 96, weight: 0.15 },  // micro detail
      ];
      const broadNoise = multiOctaveNoise(u, v, grainOctaves, rng);

      // Add horizontal streaks (wood grain direction)
      const streakRng = mulberry32(seed + 60000 + y);
      const streak = streakRng() * 0.3;

      height[y * size + x] = broadNoise * 0.7 + streak;
    }
  }

  // Sobel → normal
  const strength = 2.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = (x - 1 + size) % size;
      const x1 = (x + 1) % size;
      const y0 = (y - 1 + size) % size;
      const y1 = (y + 1) % size;

      const dX = (height[y * size + x1] - height[y * size + x0]) * strength;
      const dY = (height[y1 * size + x] - height[y0 * size + x]) * strength;

      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

      const idx = (y * size + x) * 4;
      data[idx + 0] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  return png;
}

// --- Wood AO map ---

function generateWoodAO(size, seed) {
  const png = new PNG({ width: size, height: size });
  const data = png.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const rng = mulberry32(seed + 70000 + y * size + x);

      const octaves = [
        { gridSize: 8, weight: 0.5 },
        { gridSize: 24, weight: 0.3 },
        { gridSize: 48, weight: 0.2 },
      ];
      const noise = multiOctaveNoise(u, v, octaves, rng);

      // Plank gap darkening — periodic horizontal lines
      const plankWidth = size / 8; // 8 planks
      const distToGap = Math.abs((y % plankWidth) - plankWidth / 2) / (plankWidth / 2);
      const gapDarken = Math.pow(distToGap, 8) * 0.25; // sharp darkening at gaps

      const ao = 1.0 - gapDarken - (1 - noise) * 0.12;
      const value = Math.max(0, Math.min(255, Math.round(ao * 255)));

      const idx = (y * size + x) * 4;
      data[idx + 0] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }

  return png;
}

// --- Stone AO map ---

function generateStoneAO(size, seed) {
  const png = new PNG({ width: size, height: size });
  const data = png.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const rng = mulberry32(seed + 80000 + y * size + x);

      const octaves = [
        { gridSize: 6, weight: 0.5 },
        { gridSize: 16, weight: 0.3 },
        { gridSize: 40, weight: 0.2 },
      ];
      const noise = multiOctaveNoise(u, v, octaves, rng);

      // Mortar line darkening — grid pattern
      const blockW = size / 6;
      const blockH = size / 4;
      const distToMortarX = Math.abs((x % blockW) - blockW / 2) / (blockW / 2);
      const distToMortarY = Math.abs((y % blockH) - blockH / 2) / (blockH / 2);
      const mortarX = Math.pow(distToMortarX, 12) * 0.3;
      const mortarY = Math.pow(distToMortarY, 12) * 0.3;
      const mortarDarken = Math.max(mortarX, mortarY);

      const ao = 1.0 - mortarDarken - (1 - noise) * 0.1;
      const value = Math.max(0, Math.min(255, Math.round(ao * 255)));

      const idx = (y * size + x) * 4;
      data[idx + 0] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }

  return png;
}

// --- Main ---

async function main() {
  console.log('Fixing ceiling textures...\n');

  // 1. Ironwood ceiling — replace normal + AO
  const iwDir = path.join(ROOT, 'public', 'assets', 'textures', 'wood', 'ironwood-ceiling');
  const iwSeed = 0xCE111;

  console.log('  ironwood-ceiling: generating wood-grain normal map...');
  const iwNormal = generateWoodNormal(SIZE, 0xCE111);
  const iwNormalBuf = await pngToJpeg(iwNormal, 90);
  fs.writeFileSync(path.join(iwDir, 'normal.jpg'), iwNormalBuf);
  console.log(`    normal.jpg: ${(iwNormalBuf.length / 1024).toFixed(0)}KB`);

  console.log('  ironwood-ceiling: generating wood AO map...');
  const iwAO = generateWoodAO(SIZE, 0xCE222);
  const iwAOBuf = await pngToJpeg(iwAO, 85);
  fs.writeFileSync(path.join(iwDir, 'ao.jpg'), iwAOBuf);
  console.log(`    ao.jpg: ${(iwAOBuf.length / 1024).toFixed(0)}KB\n`);

  // 2. Dark stone ceiling — generate missing AO
  const dsDir = path.join(ROOT, 'public', 'assets', 'textures', 'ceiling', 'dark-stone');

  console.log('  dark-stone: generating stone AO map...');
  const dsAO = generateStoneAO(SIZE, 0xD5333);
  const dsAOBuf = await pngToJpeg(dsAO, 85);
  fs.writeFileSync(path.join(dsDir, 'ao.jpg'), dsAOBuf);
  console.log(`    ao.jpg: ${(dsAOBuf.length / 1024).toFixed(0)}KB\n`);

  console.log('Done! Ceiling textures fixed.');
}

main().catch(console.error);

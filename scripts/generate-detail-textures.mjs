#!/usr/bin/env node

/**
 * Procedural Detail Texture Generator
 *
 * Generates two textures used by the HD-2D surface detail system:
 *   1. stone-micro-normal.png (512x512) — Micro-detail normal map for stone surfaces
 *   2. northern-grunge.png   (512x512) — Low-frequency grunge/dirt overlay
 *
 * Normal maps are encoded in tangent-space: R=X, G=Y, B=Z
 *   Flat normal = (128, 128, 255)
 *
 * Usage:
 *   node scripts/generate-detail-textures.mjs
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPNG, setPixel, hex, writePNG } from './lib/png-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DETAIL_DIR = join(PROJECT_ROOT, 'public', 'assets', 'textures', 'detail');

const SIZE = 512;

// --- Seeded PRNG (mulberry32) ---
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Simplex-like value noise ---
function makeNoise2D(seed) {
  const rng = mulberry32(seed);
  // 256-entry permutation table
  const perm = new Uint8Array(512);
  const grad = new Float32Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) {
    perm[i + 256] = perm[i];
    grad[i] = (rng() - 0.5) * 2;
    grad[i + 256] = grad[i];
  }

  return function noise(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];

    return lerp(
      lerp(dot2(grad[aa], grad[aa + 128], xf, yf), dot2(grad[ba], grad[ba + 128], xf - 1, yf), u),
      lerp(dot2(grad[ab], grad[ab + 128], xf, yf - 1), dot2(grad[bb], grad[bb + 128], xf - 1, yf - 1), u),
      v,
    );
  };
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function dot2(gx, gy, x, y) { return gx * x + gy * y; }

function fbm(noise, x, y, octaves, lacunarity = 2.0, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    maxAmp += amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum / maxAmp;
}

// --- Generate stone-micro-normal.png ---
async function generateStoneNormal() {
  console.log('Generating stone-micro-normal.png...');
  const png = createPNG(SIZE, SIZE);
  const noise1 = makeNoise2D(12345);
  const noise2 = makeNoise2D(67890);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;

      // High-frequency stone grain (micro detail)
      const scale = 32.0;
      const grain = fbm(noise1, u * scale, v * scale, 4, 2.2, 0.45);

      // Medium-frequency cracks/veins
      const crackScale = 12.0;
      const crack = fbm(noise2, u * crackScale + 100, v * crackScale + 100, 3, 2.5, 0.4);

      // Combine: grain provides subtle texture, cracks provide directionality
      const combined = grain * 0.6 + crack * 0.4;

      // Compute normal from height field via finite differences
      const eps = 1.0 / SIZE;
      const hR = fbm(noise1, (u + eps) * scale, v * scale, 4, 2.2, 0.45) * 0.6
               + fbm(noise2, (u + eps) * crackScale + 100, v * crackScale + 100, 3, 2.5, 0.4) * 0.4;
      const hU = fbm(noise1, u * scale, (v + eps) * scale, 4, 2.2, 0.45) * 0.6
               + fbm(noise2, u * crackScale + 100, (v + eps) * crackScale + 100, 3, 2.5, 0.4) * 0.4;

      const dx = (hR - combined) * 3.0;
      const dy = (hU - combined) * 3.0;

      // Tangent-space normal: flat=(0,0,1), encode to (128,128,255)
      const nx = clamp(-dx * 0.5 + 0.5, 0, 1);
      const ny = clamp(-dy * 0.5 + 0.5, 0, 1);
      const nz = clamp(Math.sqrt(Math.max(0, 1 - (nx - 0.5) * 4 * (nx - 0.5) * 4 - (ny - 0.5) * 4 * (ny - 0.5) * 4)), 0, 1);

      setPixel(png, x, y, hex(
        Math.round(nx * 255),
        Math.round(ny * 255),
        Math.round(nz * 128 + 127),
        255,
      ));
    }
  }

  await writePNG(png, join(DETAIL_DIR, 'stone-micro-normal.png'));
}

// --- Generate northern-grunge.png ---
async function generateGrunge() {
  console.log('Generating northern-grunge.png...');
  const png = createPNG(SIZE, SIZE);
  const noise1 = makeNoise2D(11111);
  const noise2 = makeNoise2D(22222);
  const noise3 = makeNoise2D(33333);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;

      // Large-scale dirt patches (low frequency)
      const dirtScale = 4.0;
      const dirt = fbm(noise1, u * dirtScale, v * dirtScale, 3, 2.0, 0.5);

      // Medium stain blobs
      const stainScale = 8.0;
      const stain = fbm(noise2, u * stainScale + 50, v * stainScale + 50, 3, 2.0, 0.45);

      // Fine grain texture
      const grainScale = 20.0;
      const grain = fbm(noise3, u * grainScale, v * grainScale, 2, 2.0, 0.5);

      // Combine: grunge is grayscale intensity used as multiply overlay
      // 0.5 = neutral (no darkening), 0.0 = maximum darkening
      const base = 0.7; // Start fairly bright (subtle grunge)
      const combined = base
        + dirt * 0.15   // Large soft variation
        + stain * 0.10  // Medium blotches
        + grain * 0.05; // Fine texture

      const brightness = clamp(combined, 0.3, 1.0);

      // Grayscale grunge map — fully opaque
      const c = Math.round(brightness * 255);
      setPixel(png, x, y, hex(c, c, c, 255));
    }
  }

  await writePNG(png, join(DETAIL_DIR, 'northern-grunge.png'));
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// --- Main ---
async function main() {
  console.log('=== Detail Texture Generator ===\n');
  await generateStoneNormal();
  await generateGrunge();
  console.log('\nDone!');
}

main().catch((err) => { console.error(err); process.exit(1); });

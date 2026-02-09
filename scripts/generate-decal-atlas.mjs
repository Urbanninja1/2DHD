#!/usr/bin/env node

/**
 * Procedural Decal Atlas Generator
 *
 * Generates a 2048x2048 atlas with 8x8 grid (256x256 per tile) for the
 * instanced decal system. Each tile is a different surface detail decal.
 *
 * Tile layout (row-major, 0-indexed):
 *   Row 0: Floor cracks (col 0-3), stone chips (col 4-7)
 *   Row 1: Moss patches (col 0-3), water stains (col 4-7)
 *   Row 2: Dirt scuffs (col 0-3), wear marks (col 4-7)
 *   Row 3: Soot marks (col 0-3), blood spatters (col 4-7)
 *   Row 4: Lichen (col 0-3), frost patterns (col 4-7)
 *   Row 5: Wood grain details (col 0-3), iron rust (col 4-7)
 *   Row 6: Scratch marks (col 0-3), dust patches (col 4-7)
 *   Row 7: Grout lines (col 0-3), decorative stamps (col 4-7)
 *
 * Usage:
 *   node scripts/generate-decal-atlas.mjs
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPNG, setPixel, hex, writePNG } from './lib/png-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DECALS_DIR = join(PROJECT_ROOT, 'public', 'assets', 'textures', 'decals');

const ATLAS_SIZE = 2048;
const GRID = 8;
const TILE = ATLAS_SIZE / GRID; // 256

// --- Seeded PRNG ---
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Noise ---
function makeNoise2D(seed) {
  const rng = mulberry32(seed);
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
function fbm(noise, x, y, octaves, lac = 2.0, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    maxAmp += amp;
    freq *= lac;
    amp *= gain;
  }
  return sum / maxAmp;
}
function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

// --- Tile generators ---
// Each returns {r,g,b,a} for a pixel at local tile coordinates (0-255)

function crackTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const cx = 0.5, cy = 0.5;
  const dx = u - cx + (noise(u * 8 + variant * 100, v * 8) * 0.1);
  const dy = v - cy + (noise(u * 8, v * 8 + variant * 100) * 0.1);

  // Crack line — thin dark line with falloff
  const angle = (variant * 0.7 + 0.3);
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));

  const crackWidth = 0.008 + noise(along * 20, variant) * 0.006;
  const crackAlpha = perp < crackWidth ? clamp(1.0 - perp / crackWidth, 0, 1) : 0;

  // Add noise breakup
  const breakup = clamp(fbm(noise, u * 30 + variant * 50, v * 30, 3) * 0.5 + 0.5, 0, 1);
  const alpha = crackAlpha * breakup;

  // Edge falloff — round vignette
  const distFromCenter = Math.sqrt(dx * dx + dy * dy) * 2;
  const edgeFade = clamp(1.0 - distFromCenter * 1.2, 0, 1);

  const finalAlpha = Math.round(clamp(alpha * edgeFade, 0, 1) * 200);
  return hex(30, 25, 20, finalAlpha);
}

function stoneChipTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const cx = 0.5 + (rng() - 0.5) * 0.2;
  const cy = 0.5 + (rng() - 0.5) * 0.2;
  const dist = Math.sqrt((u - cx) ** 2 + (v - cy) ** 2);
  const chipRadius = 0.15 + rng() * 0.1;
  const noiseVal = fbm(noise, u * 15 + variant * 30, v * 15, 3) * 0.05;
  const inside = dist < chipRadius + noiseVal;
  if (!inside) return hex(0, 0, 0, 0);
  const edgeFade = clamp(1.0 - dist / (chipRadius + noiseVal), 0, 1);
  const brightness = 120 + Math.round(fbm(noise, u * 20, v * 20, 2) * 40);
  return hex(brightness, brightness - 10, brightness - 15, Math.round(edgeFade * 180));
}

function mossPatchTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const blobVal = fbm(noise, u * 6 + variant * 20, v * 6, 4, 2.0, 0.55);
  const threshold = 0.05 + variant * 0.02;
  if (blobVal < threshold) return hex(0, 0, 0, 0);
  const density = clamp((blobVal - threshold) * 4, 0, 1);
  const detail = fbm(noise, u * 30 + variant * 10, v * 30, 2) * 0.5 + 0.5;
  const g = Math.round(clamp(60 + detail * 50, 40, 120));
  const r = Math.round(g * 0.5);
  const b = Math.round(g * 0.3);
  // Edge vignette
  const dx = u - 0.5, dy = v - 0.5;
  const edgeDist = Math.sqrt(dx * dx + dy * dy) * 2;
  const edgeFade = clamp(1.0 - edgeDist, 0, 1);
  return hex(r, g, b, Math.round(density * edgeFade * 200));
}

function waterStainTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const dx = u - 0.5, dy = v - 0.5;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Ring shape
  const ringRadius = 0.25 + variant * 0.05;
  const ringWidth = 0.04;
  const ringDist = Math.abs(dist - ringRadius);
  const ringAlpha = ringDist < ringWidth ? clamp(1.0 - ringDist / ringWidth, 0, 1) : 0;
  // Interior faint fill
  const fillAlpha = dist < ringRadius ? 0.15 : 0;
  const alpha = Math.max(ringAlpha * 0.7, fillAlpha);
  const noise1 = fbm(noise, u * 12 + variant * 40, v * 12, 2) * 0.3;
  return hex(90, 85, 75, Math.round(clamp(alpha + noise1 * 0.1, 0, 1) * 150));
}

function dirtScuffTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const scuffNoise = fbm(noise, u * 10 + variant * 25, v * 10, 3, 2.3, 0.5);
  const alpha = clamp(scuffNoise * 0.5 + 0.2, 0, 0.8);
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.2, 0, 1);
  const c = 60 + Math.round(fbm(noise, u * 20, v * 20, 2) * 30);
  return hex(c + 10, c, c - 5, Math.round(alpha * edgeFade * 180));
}

function wearMarkTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const streak = Math.abs(fbm(noise, u * 3 + variant * 15, v * 20, 3, 2.0, 0.4));
  const alpha = clamp(streak * 2.0, 0, 0.6);
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.0, 0, 1);
  return hex(100, 95, 85, Math.round(alpha * edgeFade * 160));
}

function sootMarkTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  // Soot rises upward — stronger at top
  const heightBias = clamp(1.0 - v * 1.5, 0, 1);
  const sootNoise = fbm(noise, u * 8 + variant * 30, v * 6, 4, 2.0, 0.5);
  const alpha = clamp((sootNoise * 0.5 + 0.3) * heightBias, 0, 0.9);
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.0, 0, 1);
  return hex(20, 18, 15, Math.round(alpha * edgeFade * 220));
}

function bloodSplatterTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const splat = fbm(noise, u * 10 + variant * 40, v * 10, 3, 2.5, 0.45);
  const threshold = 0.1;
  if (splat < threshold) return hex(0, 0, 0, 0);
  const alpha = clamp((splat - threshold) * 3, 0, 0.7);
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.3, 0, 1);
  const darkness = fbm(noise, u * 20, v * 20, 2) * 0.3;
  return hex(Math.round(80 - darkness * 30), 10, 10, Math.round(alpha * edgeFade * 200));
}

function lichenTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const blob = fbm(noise, u * 7 + variant * 20, v * 7, 4, 2.0, 0.5);
  if (blob < 0.05) return hex(0, 0, 0, 0);
  const density = clamp((blob - 0.05) * 3, 0, 1);
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.0, 0, 1);
  const detail = fbm(noise, u * 25 + variant, v * 25, 2) * 0.5 + 0.5;
  return hex(Math.round(150 + detail * 40), Math.round(140 + detail * 30), Math.round(80 + detail * 20), Math.round(density * edgeFade * 170));
}

function frostTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const crystal = fbm(noise, u * 15 + variant * 30, v * 15, 4, 2.2, 0.45);
  const alpha = clamp(crystal * 0.4 + 0.1, 0, 0.5);
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.0, 0, 1);
  const shimmer = (fbm(noise, u * 40, v * 40, 2) * 0.5 + 0.5);
  const c = Math.round(200 + shimmer * 55);
  return hex(c, c, Math.min(255, c + 20), Math.round(alpha * edgeFade * 140));
}

function woodGrainTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const grain = Math.sin((v + fbm(noise, u * 3 + variant * 10, v * 3, 2) * 0.3) * 40) * 0.5 + 0.5;
  const alpha = clamp(grain * 0.4, 0, 0.5);
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.0, 0, 1);
  const c = Math.round(100 + grain * 50);
  return hex(c, Math.round(c * 0.7), Math.round(c * 0.4), Math.round(alpha * edgeFade * 160));
}

function rustTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const rustNoise = fbm(noise, u * 8 + variant * 20, v * 8, 3, 2.0, 0.5);
  if (rustNoise < 0.0) return hex(0, 0, 0, 0);
  const density = clamp(rustNoise * 2, 0, 1);
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.0, 0, 1);
  return hex(Math.round(140 + rustNoise * 40), Math.round(60 + rustNoise * 30), 20, Math.round(density * edgeFade * 180));
}

function scratchTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  // Thin diagonal lines
  const angle = variant * 0.5 + 0.2;
  const rotU = u * Math.cos(angle) + v * Math.sin(angle);
  const rotV = -u * Math.sin(angle) + v * Math.cos(angle);
  const scratch = Math.abs(Math.sin(rotU * 30 + noise(rotV * 10, variant) * 2));
  const alpha = scratch < 0.1 ? clamp(1.0 - scratch / 0.1, 0, 1) * 0.6 : 0;
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.0, 0, 1);
  return hex(140, 130, 120, Math.round(alpha * edgeFade * 160));
}

function dustPatchTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const dustNoise = fbm(noise, u * 5 + variant * 20, v * 5, 3, 2.0, 0.5);
  const alpha = clamp(dustNoise * 0.3 + 0.15, 0, 0.5);
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.0, 0, 1);
  const c = Math.round(160 + dustNoise * 40);
  return hex(c, c - 5, c - 15, Math.round(alpha * edgeFade * 130));
}

function groutTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  // Grid lines with noise breakup
  const gridU = Math.abs(Math.sin(u * Math.PI * 4));
  const gridV = Math.abs(Math.sin(v * Math.PI * 4));
  const grid = Math.min(gridU, gridV);
  const lineAlpha = grid < 0.15 ? clamp(1.0 - grid / 0.15, 0, 1) * 0.5 : 0;
  const breakup = fbm(noise, u * 20 + variant * 30, v * 20, 2) * 0.5 + 0.5;
  const dx = u - 0.5, dy = v - 0.5;
  const edgeFade = clamp(1.0 - Math.sqrt(dx * dx + dy * dy) * 2.0, 0, 1);
  return hex(80, 75, 70, Math.round(lineAlpha * breakup * edgeFade * 180));
}

function decorStampTile(rng, noise, lx, ly, variant) {
  const u = lx / TILE;
  const v = ly / TILE;
  const dx = u - 0.5, dy = v - 0.5;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Concentric rings with noise modulation
  const rings = Math.abs(Math.sin(dist * 20 + variant * 2));
  const alpha = rings < 0.3 ? clamp(1.0 - rings / 0.3, 0, 1) * 0.4 : 0;
  const edgeFade = clamp(1.0 - dist * 2.5, 0, 1);
  const golden = 140 + Math.round(noise(u * 10, v * 10) * 30);
  return hex(golden, Math.round(golden * 0.8), Math.round(golden * 0.4), Math.round(alpha * edgeFade * 160));
}

// Tile type map: [row][col] → generator function
const TILE_GENERATORS = [
  // Row 0: floor cracks (0-3), stone chips (4-7)
  [crackTile, crackTile, crackTile, crackTile, stoneChipTile, stoneChipTile, stoneChipTile, stoneChipTile],
  // Row 1: moss (0-3), water stains (4-7)
  [mossPatchTile, mossPatchTile, mossPatchTile, mossPatchTile, waterStainTile, waterStainTile, waterStainTile, waterStainTile],
  // Row 2: dirt scuffs (0-3), wear marks (4-7)
  [dirtScuffTile, dirtScuffTile, dirtScuffTile, dirtScuffTile, wearMarkTile, wearMarkTile, wearMarkTile, wearMarkTile],
  // Row 3: soot (0-3), blood (4-7)
  [sootMarkTile, sootMarkTile, sootMarkTile, sootMarkTile, bloodSplatterTile, bloodSplatterTile, bloodSplatterTile, bloodSplatterTile],
  // Row 4: lichen (0-3), frost (4-7)
  [lichenTile, lichenTile, lichenTile, lichenTile, frostTile, frostTile, frostTile, frostTile],
  // Row 5: wood grain (0-3), rust (4-7)
  [woodGrainTile, woodGrainTile, woodGrainTile, woodGrainTile, rustTile, rustTile, rustTile, rustTile],
  // Row 6: scratches (0-3), dust (4-7)
  [scratchTile, scratchTile, scratchTile, scratchTile, dustPatchTile, dustPatchTile, dustPatchTile, dustPatchTile],
  // Row 7: grout (0-3), decorative stamps (4-7)
  [groutTile, groutTile, groutTile, groutTile, decorStampTile, decorStampTile, decorStampTile, decorStampTile],
];

async function main() {
  console.log('=== Decal Atlas Generator ===\n');
  console.log(`Atlas: ${ATLAS_SIZE}x${ATLAS_SIZE}, Grid: ${GRID}x${GRID}, Tile: ${TILE}x${TILE}\n`);

  const png = createPNG(ATLAS_SIZE, ATLAS_SIZE);

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const generator = TILE_GENERATORS[row][col];
      const seed = (row * GRID + col) * 7919 + 42;
      const rng = mulberry32(seed);
      const noise = makeNoise2D(seed);
      const variant = col % 4; // 0-3 variant within each type

      const ox = col * TILE;
      const oy = row * TILE;

      for (let ly = 0; ly < TILE; ly++) {
        for (let lx = 0; lx < TILE; lx++) {
          const color = generator(rng, noise, lx, ly, variant);
          if (color.a > 0) {
            setPixel(png, ox + lx, oy + ly, color);
          }
        }
      }

      const typeName = generator.name.replace('Tile', '');
      if (col === 0) {
        console.log(`  Row ${row}: ${typeName} (4 variants) + ...`);
      }
    }
  }

  await writePNG(png, join(DECALS_DIR, 'northern-atlas.png'));
  console.log('\nDone!');
}

main().catch((err) => { console.error(err); process.exit(1); });

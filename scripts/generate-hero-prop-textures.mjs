#!/usr/bin/env node
/**
 * Generate dedicated PBR texture sets for hero props.
 *
 * Creates diffuse, normal, roughness, and AO maps for each hero prop
 * using procedural techniques based on the prop's material category.
 *
 * Uses pngjs for pixel manipulation (project convention) and sharp for JPEG output.
 *
 * Usage: node scripts/generate-hero-prop-textures.mjs
 * Output: public/assets/textures/props/{prop-name}/diffuse.jpg etc.
 */

import { PNG } from 'pngjs';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'textures', 'props');

// --- Hero prop definitions ---

const HERO_PROPS = [
  { name: 'ironwood-throne',    category: 'ironwood', size: 1024 },
  { name: 'long-table',         category: 'dark-wood', size: 1024 },
  { name: 'stone-hearth',       category: 'stone',    size: 1024 },
  { name: 'iron-chandelier',    category: 'iron',     size: 512 },
  { name: 'ironwood-column',    category: 'ironwood', size: 512 },
  { name: 'raised-dais',        category: 'stone',    size: 512 },
  { name: 'weapon-rack',        category: 'dark-wood', size: 512 },
  { name: 'wooden-chest-large', category: 'dark-wood', size: 512 },
  { name: 'high-seat',          category: 'dark-wood', size: 512 },
  { name: 'stone-arch',         category: 'stone',    size: 512 },
];

// --- Category color palettes ---

const PALETTES = {
  stone: {
    base: [0x5A, 0x55, 0x50],
    variation: 20,
    roughnessBase: 200,
    roughnessVar: 40,
    aoStrength: 0.35,
  },
  ironwood: {
    base: [0x3A, 0x2A, 0x1A],
    variation: 15,
    roughnessBase: 170,
    roughnessVar: 50,
    aoStrength: 0.3,
  },
  'dark-wood': {
    base: [0x4A, 0x38, 0x28],
    variation: 18,
    roughnessBase: 180,
    roughnessVar: 45,
    aoStrength: 0.3,
  },
  iron: {
    base: [0x3C, 0x3C, 0x40],
    variation: 12,
    roughnessBase: 120,
    roughnessVar: 60,
    aoStrength: 0.4,
  },
};

// --- Seeded PRNG ---

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// --- Multi-octave value noise ---

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

// --- PNG helpers ---

function createPNG(size) {
  const png = new PNG({ width: size, height: size });
  // Initialize to black transparent
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 255;
  }
  return png;
}

/** Convert a PNG to JPEG buffer via sharp */
async function pngToJpeg(png, quality = 85) {
  const pngBuffer = PNG.sync.write(png, { colorType: 6 });
  return sharp(pngBuffer).jpeg({ quality }).toBuffer();
}

// --- Texture generation ---

function generateDiffuse(size, palette, propSeed) {
  const png = createPNG(size);
  const data = png.data;

  const octaves = [
    { gridSize: 4, weight: 0.4 },
    { gridSize: 12, weight: 0.3 },
    { gridSize: 32, weight: 0.2 },
    { gridSize: 64, weight: 0.1 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const noise = multiOctaveNoise(u, v, octaves, mulberry32(propSeed + y * size + x));

      // Edge darkening (vignette-like AO baked into diffuse)
      const edgeX = Math.min(u, 1 - u) * 4;
      const edgeY = Math.min(v, 1 - v) * 4;
      const edgeFactor = Math.min(1, Math.min(edgeX, edgeY));

      const variation = (noise - 0.5) * palette.variation * 2;
      const idx = (y * size + x) * 4;
      data[idx + 0] = Math.max(0, Math.min(255, palette.base[0] + variation * edgeFactor));
      data[idx + 1] = Math.max(0, Math.min(255, palette.base[1] + variation * edgeFactor * 0.9));
      data[idx + 2] = Math.max(0, Math.min(255, palette.base[2] + variation * edgeFactor * 0.8));
      data[idx + 3] = 255;
    }
  }

  return png;
}

function generateNormal(size, propSeed) {
  const png = createPNG(size);
  const data = png.data;

  // Generate height map first
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const rng = mulberry32(propSeed + 10000 + y * size + x);
      const octaves = [
        { gridSize: 8, weight: 0.5 },
        { gridSize: 24, weight: 0.3 },
        { gridSize: 64, weight: 0.2 },
      ];
      height[y * size + x] = multiOctaveNoise(u, v, octaves, rng);
    }
  }

  // Sobel filter: height → normal
  const strength = 2.0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = (x - 1 + size) % size;
      const x1 = (x + 1) % size;
      const y0 = (y - 1 + size) % size;
      const y1 = (y + 1) % size;

      const dX = (height[y * size + x1] - height[y * size + x0]) * strength;
      const dY = (height[y1 * size + x] - height[y0 * size + x]) * strength;

      // Normal in tangent space: blue-dominant
      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      data[idx + 0] = Math.round((nx * 0.5 + 0.5) * 255); // R = X
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255); // G = Y
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255); // B = Z
      data[idx + 3] = 255;
    }
  }

  return png;
}

function generateRoughness(size, palette, propSeed) {
  const png = createPNG(size);
  const data = png.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const rng = mulberry32(propSeed + 20000 + y * size + x);
      const octaves = [
        { gridSize: 6, weight: 0.5 },
        { gridSize: 20, weight: 0.3 },
        { gridSize: 48, weight: 0.2 },
      ];
      const noise = multiOctaveNoise(u, v, octaves, rng);
      const value = Math.max(0, Math.min(255,
        palette.roughnessBase + (noise - 0.5) * palette.roughnessVar * 2
      ));

      const idx = (y * size + x) * 4;
      data[idx + 0] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }

  return png;
}

function generateAO(size, palette, propSeed) {
  const png = createPNG(size);
  const data = png.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // Edge darkening
      const edgeX = Math.min(u, 1 - u) * 3;
      const edgeY = Math.min(v, 1 - v) * 3;
      const edgeFactor = Math.min(1, Math.min(edgeX, edgeY));

      // Noise variation
      const rng = mulberry32(propSeed + 30000 + y * size + x);
      const octaves = [
        { gridSize: 6, weight: 0.6 },
        { gridSize: 16, weight: 0.4 },
      ];
      const noise = multiOctaveNoise(u, v, octaves, rng);

      // AO = white (fully lit) with edge darkening and noise cavity
      const ao = 1.0 - palette.aoStrength * (1 - edgeFactor) - (1 - noise) * 0.15;
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
  console.log('Generating hero prop PBR textures...\n');

  for (const prop of HERO_PROPS) {
    const palette = PALETTES[prop.category];
    const propDir = path.join(OUTPUT_DIR, prop.name);
    fs.mkdirSync(propDir, { recursive: true });

    const seed = hashString(prop.name);
    const { size } = prop;

    console.log(`  ${prop.name} (${size}x${size}, ${prop.category})`);

    // Generate all 4 PBR maps
    const diffuse = generateDiffuse(size, palette, seed);
    const normal = generateNormal(size, seed);
    const roughness = generateRoughness(size, palette, seed);
    const ao = generateAO(size, palette, seed);

    // Convert PNG → JPEG via sharp and write
    const [diffuseBuf, normalBuf, roughnessBuf, aoBuf] = await Promise.all([
      pngToJpeg(diffuse, 85),
      pngToJpeg(normal, 90),
      pngToJpeg(roughness, 85),
      pngToJpeg(ao, 85),
    ]);

    fs.writeFileSync(path.join(propDir, 'diffuse.jpg'), diffuseBuf);
    fs.writeFileSync(path.join(propDir, 'normal.jpg'), normalBuf);
    fs.writeFileSync(path.join(propDir, 'roughness.jpg'), roughnessBuf);
    fs.writeFileSync(path.join(propDir, 'ao.jpg'), aoBuf);

    const totalBytes = ['diffuse.jpg', 'normal.jpg', 'roughness.jpg', 'ao.jpg']
      .reduce((sum, f) => sum + fs.statSync(path.join(propDir, f)).size, 0);
    console.log(`    -> ${(totalBytes / 1024).toFixed(0)}KB total\n`);
  }

  console.log('Done! Hero prop textures generated.');
}

/** Simple string hash for reproducible seed per prop name */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

main().catch(console.error);

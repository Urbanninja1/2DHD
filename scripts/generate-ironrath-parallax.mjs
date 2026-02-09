#!/usr/bin/env node

/**
 * Wolfswood Parallax Background Generation
 *
 * Generates 4 layered parallax background PNGs for the Ironrath Great Hall.
 *
 * Layers (back to front):
 *   0. layer-sky.png      — 1920x540, northern grey sky with low clouds
 *   1. layer-mountains.png — 2560x540, misty mountain silhouettes
 *   2. layer-canopy.png   — 3200x540, dense dark wolfswood canopy
 *   3. layer-trees.png    — 3840x540, individual ironwood trunks
 *
 * Usage:
 *   node scripts/generate-ironrath-parallax.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { hex as rgb, setPixel, fillRect, createPNG } from './lib/png-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const BG_DIR = join(PROJECT_ROOT, 'public', 'assets', 'backgrounds', 'ironrath');

// --- Color helpers ---

function lerpColor(c1, c2, t) {
  t = Math.max(0, Math.min(1, t));
  return rgb(
    Math.round(c1.r + (c2.r - c1.r) * t),
    Math.round(c1.g + (c2.g - c1.g) * t),
    Math.round(c1.b + (c2.b - c1.b) * t),
    Math.round(c1.a + (c2.a - c1.a) * t),
  );
}

function darken(c, amount) {
  return rgb(
    Math.max(0, Math.round(c.r * (1 - amount))),
    Math.max(0, Math.round(c.g * (1 - amount))),
    Math.max(0, Math.round(c.b * (1 - amount))),
    c.a,
  );
}

function fillColumn(png, x, yStart, yEnd, color) {
  for (let y = yStart; y <= yEnd && y < png.height; y++) {
    setPixel(png, x, y, color);
  }
}

// --- Pseudo-random for deterministic generation ---
let seed = 42;
function rand() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

// --- Layer 0: Northern Sky ---

function generateSky(w, h) {
  const png = createPNG(w, h);
  const top = rgb(80, 88, 100);       // cold steel grey
  const mid = rgb(120, 128, 140);     // lighter grey
  const horizon = rgb(160, 155, 150); // warm haze at horizon

  // Gradient sky
  for (let y = 0; y < h; y++) {
    const t = y / h;
    let color;
    if (t < 0.6) {
      color = lerpColor(top, mid, t / 0.6);
    } else {
      color = lerpColor(mid, horizon, (t - 0.6) / 0.4);
    }
    for (let x = 0; x < w; x++) {
      setPixel(png, x, y, color);
    }
  }

  // Low wispy clouds
  seed = 101;
  for (let i = 0; i < 12; i++) {
    const cx = Math.floor(rand() * w);
    const cy = Math.floor(100 + rand() * 200);
    const cloudW = Math.floor(60 + rand() * 120);
    const cloudH = Math.floor(8 + rand() * 16);
    const cloudColor = rgb(140, 145, 150, Math.floor(60 + rand() * 40));

    for (let dy = 0; dy < cloudH; dy++) {
      for (let dx = 0; dx < cloudW; dx++) {
        const nx = (dx / cloudW - 0.5) * 2;
        const ny = (dy / cloudH - 0.5) * 2;
        if (nx * nx + ny * ny < 1) {
          setPixel(png, (cx + dx) % w, cy + dy, cloudColor);
        }
      }
    }
  }

  return png;
}

// --- Layer 1: Misty Mountains ---

function generateMountains(w, h) {
  const png = createPNG(w, h);

  // Far mountain range silhouette
  seed = 200;
  const baseY = Math.floor(h * 0.55);
  const mountainColor = rgb(60, 65, 75);
  const mistColor = rgb(100, 105, 115, 180);

  // Generate mountain ridge
  let peakY = baseY;
  for (let x = 0; x < w; x++) {
    // Slow undulation + medium peaks + small jaggedness
    peakY = baseY
      - Math.floor(Math.sin(x * 0.003) * 80)
      - Math.floor(Math.sin(x * 0.012 + 1.5) * 30)
      - Math.floor(Math.sin(x * 0.05 + 3.0) * 8);

    fillColumn(png, x, peakY, h - 1, mountainColor);

    // Mist at the base
    const mistTop = Math.floor(h * 0.75);
    for (let y = mistTop; y < h; y++) {
      const t = (y - mistTop) / (h - mistTop);
      setPixel(png, x, y, lerpColor(mountainColor, mistColor, t * 0.6));
    }
  }

  // Snow caps on highest peaks
  seed = 210;
  const snowColor = rgb(180, 185, 190, 120);
  for (let x = 0; x < w; x++) {
    const localPeak = baseY
      - Math.floor(Math.sin(x * 0.003) * 80)
      - Math.floor(Math.sin(x * 0.012 + 1.5) * 30)
      - Math.floor(Math.sin(x * 0.05 + 3.0) * 8);
    if (localPeak < baseY - 40) {
      for (let dy = 0; dy < 6; dy++) {
        setPixel(png, x, localPeak + dy, snowColor);
      }
    }
  }

  return png;
}

// --- Layer 2: Wolfswood Canopy ---

function generateCanopy(w, h) {
  const png = createPNG(w, h);
  const treeline = Math.floor(h * 0.35);

  // Dense forest canopy — overlapping rounded tree tops
  seed = 300;
  const darkGreen = rgb(20, 45, 25);
  const midGreen = rgb(30, 60, 35);
  const lightGreen = rgb(40, 75, 42);

  // Fill base forest floor
  for (let x = 0; x < w; x++) {
    fillColumn(png, x, treeline + 40, h - 1, darkGreen);
  }

  // Render ~80 overlapping tree crowns
  for (let i = 0; i < 80; i++) {
    const cx = Math.floor(rand() * w);
    const cy = treeline + Math.floor(rand() * 60);
    const radius = Math.floor(20 + rand() * 40);
    const color = [darkGreen, midGreen, lightGreen][Math.floor(rand() * 3)];

    for (let dy = -radius; dy <= radius; dy++) {
      const rowWidth = Math.floor(Math.sqrt(radius * radius - dy * dy));
      for (let dx = -rowWidth; dx <= rowWidth; dx++) {
        const px = (cx + dx + w) % w;
        const py = cy + dy;
        if (py >= 0 && py < h) {
          setPixel(png, px, py, color);
        }
      }
    }
  }

  // Canopy highlights (dappled light)
  for (let i = 0; i < 40; i++) {
    const hx = Math.floor(rand() * w);
    const hy = treeline + Math.floor(rand() * 30);
    const highlight = rgb(50, 85, 48, 100);
    fillRect(png, hx, hy, 3 + Math.floor(rand() * 4), 2, highlight);
  }

  return png;
}

// --- Layer 3: Near Trees (Individual Trunks) ---

function generateNearTrees(w, h) {
  const png = createPNG(w, h);
  seed = 400;

  const trunkDark = rgb(30, 22, 15);
  const trunkMid = rgb(42, 32, 22);
  const trunkLight = rgb(55, 42, 30);

  // Draw ~25 individual ironwood trunks with roots visible
  for (let i = 0; i < 25; i++) {
    const tx = Math.floor(rand() * w);
    const trunkW = Math.floor(6 + rand() * 10);
    const trunkTop = Math.floor(h * 0.05 + rand() * h * 0.15);
    const trunkBot = h - 1;
    const color = [trunkDark, trunkMid, trunkLight][Math.floor(rand() * 3)];

    // Main trunk
    for (let y = trunkTop; y <= trunkBot; y++) {
      // Slight taper: wider at base
      const taper = 1 + (y - trunkTop) / (trunkBot - trunkTop) * 0.3;
      const currentW = Math.floor(trunkW * taper);
      const left = tx - Math.floor(currentW / 2);
      fillRect(png, left, y, currentW, 1, color);

      // Bark texture — darker lines
      if (y % 8 < 2) {
        fillRect(png, left, y, currentW, 1, darken(color, 0.2));
      }
    }

    // A few branches near top
    for (let b = 0; b < 3; b++) {
      const by = trunkTop + Math.floor(rand() * 60);
      const bLen = Math.floor(15 + rand() * 25);
      const bDir = rand() > 0.5 ? 1 : -1;
      const branchColor = darken(color, 0.1);

      for (let dx = 0; dx < bLen; dx++) {
        const bx = tx + dx * bDir;
        const bdy = by - Math.floor(dx * 0.3);
        fillRect(png, bx, bdy, 2, 2, branchColor);
      }
    }

    // Foliage clusters at branch ends
    const foliageColor = rgb(25, 50, 28, 200);
    for (let f = 0; f < 4; f++) {
      const fx = tx + Math.floor((rand() - 0.5) * 50);
      const fy = trunkTop + Math.floor(rand() * 40);
      const fr = Math.floor(8 + rand() * 15);
      for (let dy = -fr; dy <= fr; dy++) {
        const rw = Math.floor(Math.sqrt(fr * fr - dy * dy));
        for (let dx = -rw; dx <= rw; dx++) {
          const px = (fx + dx + w) % w;
          const py = fy + dy;
          if (py >= 0 && py < h) setPixel(png, px, py, foliageColor);
        }
      }
    }
  }

  return png;
}

// --- Write helper ---

async function writePNG(png, filePath) {
  const buffer = PNG.sync.write(png, { colorType: 6 });
  await writeFile(filePath, buffer);
  const kb = (buffer.length / 1024).toFixed(1);
  console.log(`  ${filePath.split(/[/\\]/).pop()} (${png.width}x${png.height}, ${kb} KB)`);
}

// --- Main ---

async function main() {
  console.log('Generating Wolfswood parallax backgrounds...\n');
  await mkdir(BG_DIR, { recursive: true });

  const layers = [
    { name: 'layer-sky.png', w: 1920, h: 540, gen: generateSky },
    { name: 'layer-mountains.png', w: 2560, h: 540, gen: generateMountains },
    { name: 'layer-canopy.png', w: 3200, h: 540, gen: generateCanopy },
    { name: 'layer-trees.png', w: 3840, h: 540, gen: generateNearTrees },
  ];

  for (const { name, w, h, gen } of layers) {
    const png = gen(w, h);
    await writePNG(png, join(BG_DIR, name));
  }

  console.log(`\nDone! ${layers.length} parallax layers generated.`);
}

main().catch((err) => {
  console.error('Parallax generation failed:', err);
  process.exit(1);
});

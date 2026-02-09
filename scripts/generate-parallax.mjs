#!/usr/bin/env node

/**
 * Parallax Background Generation Script
 *
 * Generates 5 layered parallax background PNGs for the Battlements room.
 * Each layer has increasing width for horizontal scroll coverage with RepeatWrapping.
 *
 * Layers (back to front):
 *   0. layer-sky.png      — 1920x540, gradient sky (dawn/dusk), static
 *   1. layer-far.png      — 2560x540, distant Blackwater Bay & shoreline
 *   2. layer-mid-far.png  — 3200x540, King's Landing far rooftops
 *   3. layer-mid.png      — 3200x540, mid-distance buildings & Great Sept
 *   4. layer-near.png     — 3840x540, near Red Keep walls & towers
 *
 * Art style: Pixel-art inspired with limited palette, matching HD-2D aesthetic.
 *
 * Usage:
 *   node scripts/generate-parallax.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { hex as rgb, setPixel, fillRect, createPNG } from './lib/png-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const BG_DIR = join(PROJECT_ROOT, 'public', 'assets', 'backgrounds', 'battlements');

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

function lighten(c, amount) {
  return rgb(
    Math.min(255, Math.round(c.r + (255 - c.r) * amount)),
    Math.min(255, Math.round(c.g + (255 - c.g) * amount)),
    Math.min(255, Math.round(c.b + (255 - c.b) * amount)),
    c.a,
  );
}

// --- PNG helpers ---

function fillColumn(png, x, y1, y2, color) {
  for (let y = y1; y <= y2; y++) {
    setPixel(png, x, y, color);
  }
}

/** Simple seeded pseudo-random for reproducible output */
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

async function writePNG(png, filePath) {
  const buffer = PNG.sync.write(png, { colorType: 6 });
  await writeFile(filePath, buffer);
  const kb = (buffer.length / 1024).toFixed(1);
  console.log(`  ✓ ${filePath.split('battlements')[1]} (${png.width}x${png.height}, ${kb} KB)`);
}

// =============================================================================
// Layer 0: Sky gradient (dawn/dusk)
// =============================================================================

function generateSky(w, h) {
  const png = createPNG(w, h);
  // Dawn sky: deep blue-violet at top → warm orange-pink at horizon
  const topColor = rgb(25, 25, 80);       // deep blue-violet
  const midColor = rgb(80, 50, 100);      // purple haze
  const lowColor = rgb(180, 100, 60);     // warm orange
  const horizonColor = rgb(240, 170, 80); // golden horizon

  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    let color;
    if (t < 0.4) {
      color = lerpColor(topColor, midColor, t / 0.4);
    } else if (t < 0.75) {
      color = lerpColor(midColor, lowColor, (t - 0.4) / 0.35);
    } else {
      color = lerpColor(lowColor, horizonColor, (t - 0.75) / 0.25);
    }
    for (let x = 0; x < w; x++) {
      setPixel(png, x, y, color);
    }
  }

  // A few stars in the upper dark area
  const rng = makeRng(42);
  for (let i = 0; i < 40; i++) {
    const sx = Math.floor(rng() * w);
    const sy = Math.floor(rng() * h * 0.35);
    const brightness = 150 + Math.floor(rng() * 105);
    setPixel(png, sx, sy, rgb(brightness, brightness, brightness + 20));
  }

  // Thin clouds in mid-sky
  const cloudColor = rgb(120, 80, 90, 60);
  for (let i = 0; i < 8; i++) {
    const cx = Math.floor(rng() * w);
    const cy = Math.floor(h * 0.25 + rng() * h * 0.25);
    const cw = 40 + Math.floor(rng() * 120);
    const ch = 3 + Math.floor(rng() * 5);
    for (let dy = 0; dy < ch; dy++) {
      for (let dx = 0; dx < cw; dx++) {
        const edge = Math.min(dx, cw - dx, dy, ch - dy) / 3;
        const alpha = Math.min(1, edge) * 0.3;
        const c = rgb(cloudColor.r, cloudColor.g, cloudColor.b, Math.floor(alpha * 255));
        setPixel(png, (cx + dx) % w, cy + dy, c);
      }
    }
  }

  return png;
}

// =============================================================================
// Layer 1: Distant bay and shoreline
// =============================================================================

function generateFarBay(w, h) {
  const png = createPNG(w, h);

  // Water fills lower portion
  const waterTop = rgb(40, 55, 80, 200);
  const waterBottom = rgb(25, 35, 55, 230);
  const waterLine = Math.floor(h * 0.45);

  for (let y = waterLine; y < h; y++) {
    const t = (y - waterLine) / (h - waterLine);
    const color = lerpColor(waterTop, waterBottom, t);
    for (let x = 0; x < w; x++) {
      setPixel(png, x, y, color);
    }
  }

  // Water ripple highlights
  const rng = makeRng(100);
  const rippleColor = rgb(70, 90, 120, 100);
  for (let i = 0; i < 80; i++) {
    const rx = Math.floor(rng() * w);
    const ry = waterLine + 10 + Math.floor(rng() * (h - waterLine - 20));
    const rw = 8 + Math.floor(rng() * 30);
    for (let dx = 0; dx < rw; dx++) {
      setPixel(png, (rx + dx) % w, ry, rippleColor);
    }
  }

  // Distant shore / hills silhouette along the waterline
  const shoreColor = rgb(60, 50, 60, 200);
  const hillHeight = 25;
  for (let x = 0; x < w; x++) {
    // Gentle rolling hills using sine composite
    const hillY = waterLine - Math.floor(
      hillHeight * 0.3 * Math.sin(x * 0.008) +
      hillHeight * 0.2 * Math.sin(x * 0.015 + 1) +
      hillHeight * 0.1 * Math.sin(x * 0.04 + 3)
    );
    for (let y = hillY; y <= waterLine; y++) {
      setPixel(png, x, y, shoreColor);
    }
  }

  // Tiny distant ship silhouettes
  const shipColor = rgb(50, 40, 50, 180);
  for (let i = 0; i < 3; i++) {
    const sx = Math.floor(200 + rng() * (w - 400));
    const sy = waterLine + 20 + Math.floor(rng() * 30);
    // Hull
    fillRect(png, sx, sy, 12, 3, shipColor);
    // Mast
    fillColumn(png, sx + 6, sy - 10, sy, shipColor);
    // Sail
    fillRect(png, sx + 4, sy - 9, 5, 6, rgb(80, 75, 70, 150));
  }

  return png;
}

// =============================================================================
// Layer 2: Far rooftops of King's Landing
// =============================================================================

function generateFarRooftops(w, h) {
  const png = createPNG(w, h);
  const rng = makeRng(200);

  // Skyline starts from the bottom of the image
  const baseY = Math.floor(h * 0.65);

  // Building palette (muted, distant)
  const wallColors = [
    rgb(75, 65, 60, 210),
    rgb(80, 70, 65, 210),
    rgb(70, 60, 55, 210),
    rgb(85, 75, 65, 210),
  ];
  const roofColors = [
    rgb(90, 50, 40, 220),
    rgb(80, 45, 35, 220),
    rgb(70, 55, 45, 220),
  ];

  // Generate a skyline of small distant buildings
  let x = 0;
  while (x < w) {
    const bw = 12 + Math.floor(rng() * 25);
    const bh = 15 + Math.floor(rng() * 45);
    const wallC = wallColors[Math.floor(rng() * wallColors.length)];
    const roofC = roofColors[Math.floor(rng() * roofColors.length)];

    const buildingTop = baseY - bh;

    // Wall
    fillRect(png, x, buildingTop, bw, bh, wallC);

    // Roof (pointed)
    const roofH = 5 + Math.floor(rng() * 8);
    for (let ry = 0; ry < roofH; ry++) {
      const indent = Math.floor((ry / roofH) * (bw / 2));
      fillRect(png, x + indent, buildingTop - roofH + ry, bw - indent * 2, 1, roofC);
    }

    // Tiny windows (1-2 pixel dots)
    const windowColor = rgb(160, 140, 90, 150);
    for (let wy = buildingTop + 4; wy < baseY - 3; wy += 6 + Math.floor(rng() * 4)) {
      for (let wx = x + 3; wx < x + bw - 3; wx += 5 + Math.floor(rng() * 3)) {
        setPixel(png, wx, wy, windowColor);
        setPixel(png, wx + 1, wy, windowColor);
      }
    }

    // Occasional tower (taller spire)
    if (rng() < 0.15) {
      const tw = 4 + Math.floor(rng() * 4);
      const th = 20 + Math.floor(rng() * 30);
      const tx = x + Math.floor(bw / 2) - Math.floor(tw / 2);
      fillRect(png, tx, buildingTop - th, tw, th, darken(wallC, 0.15));
      // Spire point
      for (let sy = 0; sy < 6; sy++) {
        const indent = Math.floor((sy / 6) * (tw / 2));
        fillRect(png, tx + indent, buildingTop - th - 6 + sy, tw - indent * 2, 1, roofC);
      }
    }

    x += bw + Math.floor(rng() * 6);
  }

  // Fill below the baseline to ensure coverage
  const groundColor = rgb(55, 50, 45, 220);
  fillRect(png, 0, baseY, w, h - baseY, groundColor);

  return png;
}

// =============================================================================
// Layer 3: Mid-distance buildings and Great Sept
// =============================================================================

function generateMidBuildings(w, h) {
  const png = createPNG(w, h);
  const rng = makeRng(300);

  const baseY = Math.floor(h * 0.55);

  // Slightly warmer, more saturated colors than far layer
  const wallColors = [
    rgb(100, 85, 70, 230),
    rgb(110, 90, 75, 230),
    rgb(95, 80, 65, 230),
    rgb(105, 95, 80, 230),
  ];
  const roofColors = [
    rgb(120, 60, 45, 240),
    rgb(100, 55, 40, 240),
    rgb(90, 65, 50, 240),
    rgb(130, 70, 50, 240),
  ];
  const windowColor = rgb(200, 170, 100, 180);

  // Place a prominent Great Sept dome near center
  const septX = Math.floor(w * 0.4);
  const septW = 80;
  const septH = 90;
  const septTop = baseY - septH;
  const septWall = rgb(130, 120, 105, 240);
  const septRoof = rgb(90, 95, 80, 240);

  // Sept body
  fillRect(png, septX, septTop + 30, septW, septH - 30, septWall);

  // Sept dome (semicircle approximation)
  const domeR = 35;
  const domeCenterX = septX + Math.floor(septW / 2);
  const domeCenterY = septTop + 30;
  for (let dy = -domeR; dy <= 0; dy++) {
    const halfW = Math.floor(Math.sqrt(domeR * domeR - dy * dy));
    fillRect(png, domeCenterX - halfW, domeCenterY + dy, halfW * 2, 1, septRoof);
  }

  // Sept windows (arched)
  for (let wx = septX + 10; wx < septX + septW - 10; wx += 14) {
    fillRect(png, wx, septTop + 50, 4, 10, windowColor);
    setPixel(png, wx + 1, septTop + 49, windowColor);
    setPixel(png, wx + 2, septTop + 49, windowColor);
  }

  // Sept spire on top of dome
  const spireX = domeCenterX - 1;
  fillColumn(png, spireX, septTop - 5, septTop + 2, septWall);
  fillColumn(png, spireX + 1, septTop - 5, septTop + 2, septWall);
  setPixel(png, spireX, septTop - 6, rgb(200, 180, 100, 240)); // gold tip

  // Generate buildings around the sept
  let x = 0;
  while (x < w) {
    // Skip the sept area
    if (x > septX - 10 && x < septX + septW + 10) {
      x = septX + septW + 10;
      continue;
    }

    const bw = 18 + Math.floor(rng() * 35);
    const bh = 25 + Math.floor(rng() * 55);
    const wallC = wallColors[Math.floor(rng() * wallColors.length)];
    const roofC = roofColors[Math.floor(rng() * roofColors.length)];

    const buildingTop = baseY - bh;

    // Wall
    fillRect(png, x, buildingTop, bw, bh, wallC);

    // Shadow on right side
    fillRect(png, x + bw - 2, buildingTop, 2, bh, darken(wallC, 0.2));

    // Roof
    const roofH = 6 + Math.floor(rng() * 10);
    for (let ry = 0; ry < roofH; ry++) {
      const indent = Math.floor((ry / roofH) * (bw / 2));
      fillRect(png, x + indent, buildingTop - roofH + ry, bw - indent * 2, 1, roofC);
    }

    // Windows
    for (let wy = buildingTop + 5; wy < baseY - 4; wy += 8 + Math.floor(rng() * 3)) {
      for (let wx = x + 3; wx < x + bw - 4; wx += 6 + Math.floor(rng() * 3)) {
        fillRect(png, wx, wy, 2, 3, windowColor);
      }
    }

    x += bw + Math.floor(rng() * 8);
  }

  // Ground fill
  const groundColor = rgb(70, 60, 50, 235);
  fillRect(png, 0, baseY, w, h - baseY, groundColor);

  return png;
}

// =============================================================================
// Layer 4: Near Red Keep walls and towers
// =============================================================================

function generateNearTowers(w, h) {
  const png = createPNG(w, h);
  const rng = makeRng(400);

  const baseY = Math.floor(h * 0.45);

  // More detail and saturation for near layer
  const stoneLight = rgb(140, 120, 95, 245);
  const stoneMid = rgb(120, 100, 80, 245);
  const stoneDark = rgb(90, 75, 60, 245);
  const roofColor = rgb(150, 70, 50, 250);
  const bannerRed = rgb(160, 30, 30, 240);
  const bannerGold = rgb(200, 170, 60, 240);
  const windowDark = rgb(30, 25, 35, 240);
  const windowGlow = rgb(220, 180, 100, 200);

  // Continuous wall running across the bottom portion
  const wallTop = baseY;
  const wallHeight = h - baseY;
  fillRect(png, 0, wallTop, w, wallHeight, stoneMid);

  // Wall texture — horizontal stone lines
  for (let wy = wallTop; wy < h; wy += 8) {
    for (let x = 0; x < w; x++) {
      setPixel(png, x, wy, stoneDark);
    }
    // Vertical mortar lines (offset per row for brick pattern)
    const offset = ((wy - wallTop) / 8) % 2 === 0 ? 0 : 12;
    for (let x = offset; x < w; x += 24) {
      fillColumn(png, x, wy, Math.min(wy + 7, h - 1), stoneDark);
    }
  }

  // Crenellations along the wall top
  const crenW = 10;
  const crenH = 12;
  const crenGap = 8;
  for (let cx = 0; cx < w; cx += crenW + crenGap) {
    fillRect(png, cx, wallTop - crenH, crenW, crenH, stoneMid);
    // Merlon shadow
    fillRect(png, cx + crenW - 2, wallTop - crenH, 2, crenH, stoneDark);
  }

  // Place towers at intervals
  const towerPositions = [];
  for (let i = 0; i < 6; i++) {
    towerPositions.push(Math.floor(w * (i / 6) + rng() * w * 0.08));
  }

  for (const tx of towerPositions) {
    const tw = 35 + Math.floor(rng() * 20);
    const th = 80 + Math.floor(rng() * 60);
    const towerTop = wallTop - th;

    // Tower body
    fillRect(png, tx, towerTop, tw, th, stoneLight);
    // Right shadow
    fillRect(png, tx + tw - 4, towerTop, 4, th, stoneDark);
    // Left edge highlight
    fillRect(png, tx, towerTop, 2, th, lighten(stoneLight, 0.1));

    // Stone pattern on tower
    for (let sy = towerTop; sy < wallTop; sy += 6) {
      for (let sx = tx; sx < tx + tw; sx++) {
        if (rng() < 0.05) {
          setPixel(png, sx, sy, darken(stoneLight, 0.1));
        }
      }
    }

    // Tower roof (conical)
    const roofH = 15 + Math.floor(rng() * 10);
    for (let ry = 0; ry < roofH; ry++) {
      const indent = Math.floor((ry / roofH) * (tw / 2));
      fillRect(png, tx + indent, towerTop - roofH + ry, tw - indent * 2, 1, roofColor);
    }

    // Tower windows
    const numWindows = 2 + Math.floor(rng() * 2);
    for (let wi = 0; wi < numWindows; wi++) {
      const wx = tx + 8 + Math.floor(rng() * (tw - 16));
      const wy = towerTop + 15 + wi * 20;
      // Window recess
      fillRect(png, wx, wy, 5, 8, windowDark);
      // Warm glow
      fillRect(png, wx + 1, wy + 1, 3, 5, windowGlow);
    }

    // Banner on some towers
    if (rng() < 0.5) {
      const bx = tx + Math.floor(tw / 2);
      const by = towerTop - roofH + 3;
      // Pole
      fillColumn(png, bx, by - 15, by, stoneDark);
      // Banner cloth
      fillRect(png, bx + 1, by - 14, 8, 12, bannerRed);
      // Gold trim on banner
      fillRect(png, bx + 1, by - 14, 8, 1, bannerGold);
      fillRect(png, bx + 1, by - 3, 8, 1, bannerGold);
    }
  }

  // Arrow slits along the wall
  for (let ax = 20; ax < w; ax += 30 + Math.floor(rng() * 20)) {
    const ay = wallTop + 8 + Math.floor(rng() * 15);
    fillRect(png, ax, ay, 2, 8, windowDark);
  }

  return png;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('Generating parallax background layers...\n');

  await mkdir(BG_DIR, { recursive: true });

  const layers = [
    { name: 'layer-sky.png', w: 1920, h: 540, generate: generateSky },
    { name: 'layer-far.png', w: 2560, h: 540, generate: generateFarBay },
    { name: 'layer-mid-far.png', w: 3200, h: 540, generate: generateFarRooftops },
    { name: 'layer-mid.png', w: 3200, h: 540, generate: generateMidBuildings },
    { name: 'layer-near.png', w: 3840, h: 540, generate: generateNearTowers },
  ];

  for (const layer of layers) {
    const png = layer.generate(layer.w, layer.h);
    await writePNG(png, join(BG_DIR, layer.name));
  }

  console.log('\nDone! 5 parallax layers generated.');
}

main().catch((err) => {
  console.error('Failed to generate parallax backgrounds:', err);
  process.exit(1);
});

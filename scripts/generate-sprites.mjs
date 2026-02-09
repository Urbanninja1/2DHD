#!/usr/bin/env node

/**
 * Sprite Generation Script
 *
 * Generates pixel-art character spritesheets for the HD-2D engine.
 * Each spritesheet is 128x96 (4 columns x 2 rows of 32x48 frames).
 *   Row 0: idle animation (4 frames at 4 FPS)
 *   Row 1: walk animation (4 frames at 8 FPS)
 *
 * Character types:
 *   Player: knight
 *   NPCs: guard, kingsguard, noble-male, noble-female, servant, council-member, musician
 *
 * Usage:
 *   node scripts/generate-sprites.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { hex, setPixel, fillRect, createPNG } from './lib/png-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const SPRITES_DIR = join(PROJECT_ROOT, 'public', 'assets', 'sprites');

// Frame dimensions
const FW = 32; // frame width
const FH = 48; // frame height
const COLS = 4; // frames per animation row
const ROWS = 2; // animation rows (idle, walk)
const SW = FW * COLS; // sheet width: 128
const SH = FH * ROWS; // sheet height: 96

const TRANSPARENT = hex(0, 0, 0, 0);

// --- Pixel drawing helpers ---

function createSheet() {
  return createPNG(SW, SH);
}

function drawOutline(png, x, y, w, h, color) {
  for (let dx = 0; dx < w; dx++) {
    setPixel(png, x + dx, y, color);
    setPixel(png, x + dx, y + h - 1, color);
  }
  for (let dy = 0; dy < h; dy++) {
    setPixel(png, x, y + dy, color);
    setPixel(png, x + w - 1, y + dy, color);
  }
}

// Draw a character frame at position (fx, fy) within the sheet
// fx/fy = top-left pixel of the frame
function drawCharacter(png, fx, fy, palette, pose) {
  const {
    skin, hair, eyeColor, outlineColor,
    torsoColor, torsoHighlight, torsoShadow,
    legColor, legShadow, bootColor, bootHighlight,
    accentColor, accessory
  } = palette;

  const { legOffset = 0, armSwing = 0, breathOffset = 0 } = pose;

  const cx = fx + 16; // center x of frame
  const by = fy + breathOffset; // breath offset shifts upper body

  // --- Boots (bottom, y=42..47) ---
  const bootY = fy + 42;
  // Left boot
  fillRect(png, cx - 6 + legOffset, bootY, 5, 5, bootColor);
  setPixel(png, cx - 6 + legOffset, bootY, bootHighlight);
  setPixel(png, cx - 5 + legOffset, bootY, bootHighlight);
  // Right boot
  fillRect(png, cx + 1 - legOffset, bootY, 5, 5, bootColor);
  setPixel(png, cx + 1 - legOffset, bootY, bootHighlight);
  setPixel(png, cx + 2 - legOffset, bootY, bootHighlight);

  // --- Legs (y=36..42) ---
  const legY = fy + 36;
  // Left leg
  fillRect(png, cx - 5 + legOffset, legY, 4, 6, legColor);
  setPixel(png, cx - 5 + legOffset, legY, legShadow);
  // Right leg
  fillRect(png, cx + 1 - legOffset, legY, 4, 6, legColor);
  setPixel(png, cx + 4 - legOffset, legY, legShadow);

  // --- Torso (y=22..36) ---
  const torsoY = by + 22;
  fillRect(png, cx - 7, torsoY, 14, 14, torsoColor);
  // Highlight stripe
  fillRect(png, cx - 2, torsoY + 1, 4, 12, torsoHighlight);
  // Shadow edges
  fillRect(png, cx - 7, torsoY, 1, 14, torsoShadow);
  fillRect(png, cx + 6, torsoY, 1, 14, torsoShadow);
  // Belt
  fillRect(png, cx - 7, torsoY + 11, 14, 2, outlineColor);
  if (accentColor) {
    setPixel(png, cx, torsoY + 11, accentColor);
    setPixel(png, cx, torsoY + 12, accentColor);
  }

  // --- Arms (y=23..34) ---
  const armY = by + 23;
  // Left arm
  fillRect(png, cx - 9 - armSwing, armY, 2, 10, torsoColor);
  setPixel(png, cx - 9 - armSwing, armY, torsoShadow);
  // Hand
  fillRect(png, cx - 9 - armSwing, armY + 10, 2, 2, skin);
  // Right arm
  fillRect(png, cx + 7 + armSwing, armY, 2, 10, torsoColor);
  setPixel(png, cx + 8 + armSwing, armY, torsoShadow);
  // Hand
  fillRect(png, cx + 7 + armSwing, armY + 10, 2, 2, skin);

  // --- Neck ---
  fillRect(png, cx - 2, by + 20, 4, 3, skin);

  // --- Head (y=6..20) ---
  const headY = by + 6;
  // Hair back (slightly larger)
  fillRect(png, cx - 6, headY - 1, 12, 6, hair);
  // Face
  fillRect(png, cx - 5, headY + 2, 10, 12, skin);
  // Hair top/fringe
  fillRect(png, cx - 6, headY, 12, 4, hair);
  // Hair sides
  fillRect(png, cx - 6, headY + 3, 2, 6, hair);
  fillRect(png, cx + 4, headY + 3, 2, 6, hair);
  // Eyes
  setPixel(png, cx - 3, headY + 7, eyeColor);
  setPixel(png, cx - 2, headY + 7, eyeColor);
  setPixel(png, cx + 1, headY + 7, eyeColor);
  setPixel(png, cx + 2, headY + 7, eyeColor);
  // Eye highlights
  setPixel(png, cx - 2, headY + 6, hex(255, 255, 255));
  setPixel(png, cx + 2, headY + 6, hex(255, 255, 255));
  // Mouth
  setPixel(png, cx - 1, headY + 11, hex(180, 120, 100));
  setPixel(png, cx, headY + 11, hex(180, 120, 100));

  // --- Accessories ---
  if (accessory === 'helmet') {
    // Full helmet over hair
    fillRect(png, cx - 6, headY - 2, 12, 5, accentColor || torsoColor);
    fillRect(png, cx - 7, headY + 2, 14, 2, accentColor || torsoColor);
    // Visor slit
    fillRect(png, cx - 4, headY + 3, 8, 1, outlineColor);
  } else if (accessory === 'crown') {
    fillRect(png, cx - 5, headY - 2, 10, 2, accentColor);
    // Crown points
    setPixel(png, cx - 4, headY - 3, accentColor);
    setPixel(png, cx, headY - 3, accentColor);
    setPixel(png, cx + 4, headY - 3, accentColor);
  } else if (accessory === 'hood') {
    fillRect(png, cx - 7, headY - 1, 14, 5, torsoColor);
    fillRect(png, cx - 7, headY + 3, 2, 4, torsoColor);
    fillRect(png, cx + 5, headY + 3, 2, 4, torsoColor);
  } else if (accessory === 'chain') {
    // Maester chain across chest
    for (let i = 0; i < 8; i++) {
      setPixel(png, cx - 4 + i, by + 22 + (i % 2), hex(180, 180, 180));
    }
    for (let i = 0; i < 8; i++) {
      setPixel(png, cx - 4 + i, by + 24 - (i % 2), hex(160, 160, 160));
    }
  } else if (accessory === 'lute') {
    // Lute held across body
    fillRect(png, cx + 5, by + 26, 4, 8, hex(139, 90, 43));
    fillRect(png, cx + 6, by + 24, 2, 2, hex(139, 90, 43));
    // Lute body (oval-ish)
    fillRect(png, cx + 4, by + 29, 6, 5, hex(180, 120, 60));
    setPixel(png, cx + 7, by + 31, hex(80, 50, 20)); // sound hole
    // Strings
    setPixel(png, cx + 6, by + 26, hex(220, 220, 200));
    setPixel(png, cx + 7, by + 27, hex(220, 220, 200));
  } else if (accessory === 'spear') {
    // Spear held upright on right side
    fillRect(png, cx + 9, by + 8, 1, 30, hex(120, 80, 40)); // shaft
    fillRect(png, cx + 8, by + 6, 3, 4, hex(180, 180, 190)); // head
    setPixel(png, cx + 9, by + 5, hex(200, 200, 210)); // tip
  } else if (accessory === 'sword') {
    // Sword on left hip
    fillRect(png, cx - 10, by + 28, 1, 10, hex(160, 160, 170)); // blade
    fillRect(png, cx - 10, by + 26, 1, 2, hex(180, 140, 50)); // cross-guard
    fillRect(png, cx - 11, by + 26, 3, 1, hex(180, 140, 50));
    setPixel(png, cx - 10, by + 38, hex(200, 200, 210)); // tip
  } else if (accessory === 'cape-white') {
    // White cape behind character
    fillRect(png, cx - 6, by + 20, 12, 18, hex(230, 230, 235));
    fillRect(png, cx - 5, by + 20, 10, 18, hex(240, 240, 245));
    // Cape shadow on edges
    fillRect(png, cx - 6, by + 20, 1, 18, hex(200, 200, 210));
    fillRect(png, cx + 5, by + 20, 1, 18, hex(200, 200, 210));
  } else if (accessory === 'dress-skirt') {
    // Long skirt replacing legs
    fillRect(png, cx - 7, fy + 33, 14, 10, torsoColor);
    fillRect(png, cx - 6, fy + 33, 12, 10, torsoHighlight);
    fillRect(png, cx - 7, fy + 33, 1, 10, torsoShadow);
    fillRect(png, cx + 6, fy + 33, 1, 10, torsoShadow);
    // Hem detail
    for (let i = 0; i < 14; i++) {
      if (i % 2 === 0) setPixel(png, cx - 7 + i, fy + 42, accentColor || torsoShadow);
    }
  }

  // --- Outline pass (optional dark outline on body) ---
  // Bottom torso outline
  setPixel(png, cx - 7, torsoY + 13, outlineColor);
  setPixel(png, cx + 6, torsoY + 13, outlineColor);
}

// --- Character palette definitions ---

const PALETTES = {
  knight: {
    skin: hex(232, 200, 160),
    hair: hex(100, 80, 60),
    eyeColor: hex(50, 60, 80),
    outlineColor: hex(30, 30, 40),
    torsoColor: hex(136, 153, 170),
    torsoHighlight: hex(170, 185, 200),
    torsoShadow: hex(90, 100, 115),
    legColor: hex(100, 110, 125),
    legShadow: hex(70, 80, 95),
    bootColor: hex(68, 51, 34),
    bootHighlight: hex(90, 70, 50),
    accentColor: hex(180, 200, 220),
    accessory: 'sword',
  },
  guard: {
    skin: hex(220, 185, 150),
    hair: hex(60, 50, 40),
    eyeColor: hex(50, 50, 50),
    outlineColor: hex(25, 25, 30),
    torsoColor: hex(74, 74, 74),
    torsoHighlight: hex(100, 100, 100),
    torsoShadow: hex(50, 50, 55),
    legColor: hex(60, 55, 50),
    legShadow: hex(40, 38, 35),
    bootColor: hex(50, 40, 30),
    bootHighlight: hex(70, 55, 40),
    accentColor: hex(140, 120, 80),
    accessory: 'spear',
  },
  kingsguard: {
    skin: hex(232, 200, 160),
    hair: hex(200, 180, 140),
    eyeColor: hex(50, 60, 80),
    outlineColor: hex(30, 30, 40),
    torsoColor: hex(220, 210, 190),
    torsoHighlight: hex(240, 235, 220),
    torsoShadow: hex(180, 170, 155),
    legColor: hex(200, 190, 170),
    legShadow: hex(170, 160, 145),
    bootColor: hex(180, 160, 120),
    bootHighlight: hex(210, 190, 150),
    accentColor: hex(255, 215, 0),
    accessory: 'cape-white',
  },
  'noble-male': {
    skin: hex(230, 195, 155),
    hair: hex(50, 35, 25),
    eyeColor: hex(60, 80, 50),
    outlineColor: hex(25, 20, 15),
    torsoColor: hex(140, 20, 30),
    torsoHighlight: hex(180, 40, 50),
    torsoShadow: hex(100, 10, 20),
    legColor: hex(50, 40, 30),
    legShadow: hex(35, 28, 20),
    bootColor: hex(60, 45, 30),
    bootHighlight: hex(85, 65, 45),
    accentColor: hex(255, 215, 0),
    accessory: 'crown',
  },
  'noble-female': {
    skin: hex(235, 205, 170),
    hair: hex(160, 100, 50),
    eyeColor: hex(60, 100, 60),
    outlineColor: hex(30, 20, 15),
    torsoColor: hex(120, 30, 80),
    torsoHighlight: hex(160, 50, 110),
    torsoShadow: hex(80, 20, 55),
    legColor: hex(120, 30, 80),
    legShadow: hex(80, 20, 55),
    bootColor: hex(100, 25, 65),
    bootHighlight: hex(130, 40, 85),
    accentColor: hex(255, 200, 80),
    accessory: 'dress-skirt',
  },
  servant: {
    skin: hex(215, 180, 145),
    hair: hex(80, 60, 40),
    eyeColor: hex(60, 50, 40),
    outlineColor: hex(30, 25, 20),
    torsoColor: hex(139, 115, 85),
    torsoHighlight: hex(165, 140, 110),
    torsoShadow: hex(110, 90, 65),
    legColor: hex(90, 75, 55),
    legShadow: hex(65, 55, 40),
    bootColor: hex(70, 55, 35),
    bootHighlight: hex(95, 75, 50),
    accentColor: null,
    accessory: null,
  },
  'council-member': {
    skin: hex(225, 190, 155),
    hair: hex(160, 160, 170),
    eyeColor: hex(70, 70, 80),
    outlineColor: hex(30, 30, 35),
    torsoColor: hex(80, 80, 90),
    torsoHighlight: hex(110, 110, 120),
    torsoShadow: hex(55, 55, 65),
    legColor: hex(60, 60, 70),
    legShadow: hex(42, 42, 50),
    bootColor: hex(50, 45, 40),
    bootHighlight: hex(70, 62, 55),
    accentColor: hex(180, 180, 180),
    accessory: 'chain',
  },
  musician: {
    skin: hex(225, 190, 150),
    hair: hex(140, 70, 30),
    eyeColor: hex(80, 60, 40),
    outlineColor: hex(25, 20, 15),
    torsoColor: hex(50, 120, 80),
    torsoHighlight: hex(70, 155, 105),
    torsoShadow: hex(35, 85, 55),
    legColor: hex(80, 65, 50),
    legShadow: hex(55, 45, 35),
    bootColor: hex(65, 50, 35),
    bootHighlight: hex(90, 70, 50),
    accentColor: hex(220, 180, 50),
    accessory: 'lute',
  },
};

// --- Animation pose generators ---

function idlePose(frame) {
  // Subtle breathing: frames 0,1 up 0px; frames 2,3 down 1px
  const breathOffset = frame < 2 ? 0 : 1;
  return { legOffset: 0, armSwing: 0, breathOffset };
}

function walkPose(frame) {
  // Frame 0: left forward, frame 1: neutral, frame 2: right forward, frame 3: neutral
  const legOffsets = [2, 0, -2, 0];
  const armSwings = [1, 0, -1, 0];
  return {
    legOffset: legOffsets[frame],
    armSwing: armSwings[frame],
    breathOffset: 0,
  };
}

// --- Main generation ---

async function generateSpritesheet(name, palette) {
  const png = createSheet();

  for (let col = 0; col < COLS; col++) {
    // Row 0: idle
    const idleFx = col * FW;
    const idleFy = 0;
    drawCharacter(png, idleFx, idleFy, palette, idlePose(col));

    // Row 1: walk
    const walkFx = col * FW;
    const walkFy = FH;
    drawCharacter(png, walkFx, walkFy, palette, walkPose(col));
  }

  return PNG.sync.write(png);
}

async function main() {
  console.log('Generating pixel-art spritesheets...\n');

  // Player sprite
  const playerDir = join(SPRITES_DIR, 'player');
  await mkdir(playerDir, { recursive: true });

  const knightBuf = await generateSpritesheet('knight', PALETTES.knight);
  await writeFile(join(playerDir, 'knight.png'), knightBuf);
  console.log('  Player: knight.png (128x96)');

  // NPC sprites
  const npcDir = join(SPRITES_DIR, 'npcs');
  await mkdir(npcDir, { recursive: true });

  const npcTypes = ['guard', 'kingsguard', 'noble-male', 'noble-female', 'servant', 'council-member', 'musician'];

  for (const type of npcTypes) {
    const buf = await generateSpritesheet(type, PALETTES[type]);
    await writeFile(join(npcDir, `${type}.png`), buf);
    console.log(`  NPC:    ${type}.png (128x96)`);
  }

  console.log(`\nGenerated ${1 + npcTypes.length} spritesheets.`);
}

main().catch((err) => {
  console.error('Sprite generation failed:', err);
  process.exit(1);
});

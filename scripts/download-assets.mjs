#!/usr/bin/env node

/**
 * Asset Download Script
 *
 * Downloads CC0-licensed PBR textures from Poly Haven (direct JPG URLs).
 * Models, sprites, and parallax backgrounds require manual sourcing.
 *
 * Usage:
 *   node scripts/download-assets.mjs
 *   node scripts/download-assets.mjs --only textures
 *   node scripts/download-assets.mjs --only models
 *   node scripts/download-assets.mjs --dry-run
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PUBLIC_ASSETS = join(PROJECT_ROOT, 'public', 'assets');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

// --- Utility Helpers ---

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url, destPath) {
  if (await fileExists(destPath)) {
    console.log(`  [skip] already exists: ${destPath.split('public')[1]}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] Would download: ${url}`);
    return;
  }

  console.log(`  [download] ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await ensureDir(dirname(destPath));
  await writeFile(destPath, buffer);
  console.log(`  [saved] ${(buffer.length / 1024).toFixed(1)} KB → ${destPath.split('public')[1]}`);
}

// --- All Poly Haven Textures ---
// URL pattern: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/{res}/{id}/{id}_{map}_{res}.jpg
// Maps: diff (diffuse/color), nor_gl (OpenGL normal), rough (roughness)

const POLY_HAVEN_BASE = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k';

const TEXTURE_SETS = [
  // Stone textures
  { id: 'castle_wall_slates', dest: 'stone/castle-wall-slates' },
  { id: 'stone_wall',         dest: 'stone/stone-wall' },
  { id: 'rock_wall_08',       dest: 'stone/rough-stone' },
  { id: 'stone_tiles',        dest: 'stone/worn-stone' },
  // Wood textures
  { id: 'dark_wooden_planks', dest: 'wood/dark-wood-floor' },
  { id: 'wood_planks',        dest: 'wood/wood-planks' },
  // Ceiling
  { id: 'rustic_stone_wall_02', dest: 'ceiling/dark-stone' },
];

const MAP_TYPES = [
  { suffix: 'diff',   filename: 'diffuse.jpg' },
  { suffix: 'nor_gl', filename: 'normal.jpg' },
  { suffix: 'rough',  filename: 'roughness.jpg' },
];

async function downloadTextures() {
  console.log('\n=== Poly Haven PBR Textures (CC0) ===\n');

  for (const tex of TEXTURE_SETS) {
    console.log(`\n  ${tex.id} → textures/${tex.dest}/`);
    const destDir = join(PUBLIC_ASSETS, 'textures', tex.dest);

    for (const map of MAP_TYPES) {
      const url = `${POLY_HAVEN_BASE}/${tex.id}/${tex.id}_${map.suffix}_1k.jpg`;
      const destPath = join(destDir, map.filename);
      try {
        await downloadFile(url, destPath);
      } catch (err) {
        console.warn(`    [warn] ${map.filename}: ${err.message}`);
      }
    }
  }
}

// --- Models ---

const EXPECTED_MODELS = [
  'column-stone', 'sconce-iron', 'throne', 'table-long', 'chair-high',
  'bookshelf', 'desk', 'weapon-rack', 'armor-stand', 'brazier',
  'chandelier', 'bench', 'banner', 'crenellation',
];

async function checkModels() {
  console.log('\n=== GLTF Models (manual download required) ===\n');
  console.log('  Sources:');
  console.log('    Quaternius Fantasy Props: https://quaternius.com/packs/fantasyprops.html');
  console.log('    Kenney Assets:           https://kenney.nl/assets');
  console.log('    Kay Lousberg:            https://kaylousberg.com/game-assets\n');

  const modelsDir = join(PUBLIC_ASSETS, 'models', 'props');
  await ensureDir(modelsDir);

  for (const model of EXPECTED_MODELS) {
    const destPath = join(modelsDir, `${model}.glb`);
    const exists = await fileExists(destPath);
    console.log(`  ${exists ? '[ok]    ' : '[missing]'} models/props/${model}.glb`);
  }
}

// --- Sprites ---

const EXPECTED_SPRITES = [
  'sprites/player/knight-idle.png',
  'sprites/npcs/guard.png',
  'sprites/npcs/kingsguard.png',
  'sprites/npcs/noble-male.png',
  'sprites/npcs/noble-female.png',
  'sprites/npcs/servant.png',
  'sprites/npcs/musician.png',
  'sprites/npcs/council-member.png',
];

async function checkSprites() {
  console.log('\n=== Pixel Art Sprites (manual download required) ===\n');
  console.log('  Sources:');
  console.log('    OpenGameArt: https://opengameart.org (search "16x16 RPG character")');
  console.log('    itch.io:     https://itch.io/game-assets/free/tag-pixel-art');
  console.log('    Kenney:      https://kenney.nl/assets/category:2D\n');

  await ensureDir(join(PUBLIC_ASSETS, 'sprites', 'player'));
  await ensureDir(join(PUBLIC_ASSETS, 'sprites', 'npcs'));

  for (const sprite of EXPECTED_SPRITES) {
    const destPath = join(PUBLIC_ASSETS, sprite);
    const exists = await fileExists(destPath);
    console.log(`  ${exists ? '[ok]    ' : '[missing]'} ${sprite}`);
  }
}

// --- Backgrounds ---

const EXPECTED_BACKGROUNDS = [
  'backgrounds/battlements/layer-sky.png',
  'backgrounds/battlements/layer-far.png',
  'backgrounds/battlements/layer-mid.png',
  'backgrounds/battlements/layer-near.png',
];

async function checkBackgrounds() {
  console.log('\n=== Parallax Backgrounds (manual download required) ===\n');
  console.log('  Sources:');
  console.log('    OpenGameArt: https://opengameart.org (search "parallax medieval")');
  console.log('    itch.io:     https://itch.io/game-assets/free/tag-parallax-scrolling\n');

  await ensureDir(join(PUBLIC_ASSETS, 'backgrounds', 'battlements'));

  for (const bg of EXPECTED_BACKGROUNDS) {
    const destPath = join(PUBLIC_ASSETS, bg);
    const exists = await fileExists(destPath);
    console.log(`  ${exists ? '[ok]    ' : '[missing]'} ${bg}`);
  }
}

// --- Main ---

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  HD-2D Red Keep — Asset Download Script          ║');
  console.log('╚══════════════════════════════════════════════════╝');

  if (DRY_RUN) console.log('\n  [DRY RUN — no files will be written]');

  await ensureDir(PUBLIC_ASSETS);

  if (!ONLY || ONLY === 'textures')    await downloadTextures();
  if (!ONLY || ONLY === 'models')      await checkModels();
  if (!ONLY || ONLY === 'sprites')     await checkSprites();
  if (!ONLY || ONLY === 'backgrounds') await checkBackgrounds();

  console.log('\n══════════════════════════════════════════════════');
  console.log('  Run `npm run dev` — rooms fall back to procedural if assets missing.');
  console.log('══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Asset download failed:', err);
  process.exit(1);
});

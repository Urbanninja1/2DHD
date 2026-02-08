#!/usr/bin/env node

/**
 * Asset Download Script
 *
 * Downloads CC0-licensed PBR textures from Poly Haven and ambientCG.
 * Models, sprites, and parallax backgrounds require manual sourcing.
 *
 * Usage:
 *   node scripts/download-assets.mjs
 *   node scripts/download-assets.mjs --only textures
 *   node scripts/download-assets.mjs --only models
 *   node scripts/download-assets.mjs --dry-run
 */

import { mkdir, writeFile, access, readdir, copyFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tmpdir, platform } from 'node:os';

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

// --- Poly Haven Textures ---
// URL pattern: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/{res}/{id}/{id}_{map}_{res}.jpg
// Maps: diff (diffuse/color), nor_gl (OpenGL normal), rough (roughness)

const POLY_HAVEN_BASE = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k';

const POLY_HAVEN_SETS = [
  // Stone textures (existing)
  { id: 'castle_wall_slates', dest: 'stone/castle-wall-slates' },
  { id: 'stone_wall',         dest: 'stone/stone-wall' },
  { id: 'rock_wall_08',       dest: 'stone/rough-stone' },
  { id: 'stone_tiles',        dest: 'stone/worn-stone' },
  // Wood textures (existing)
  { id: 'dark_wooden_planks', dest: 'wood/dark-wood-floor' },
  { id: 'wood_planks',        dest: 'wood/wood-planks' },
  // Ceiling (existing)
  { id: 'rustic_stone_wall_02', dest: 'ceiling/dark-stone' },
  // --- Phase 2: New textures ---
  // Marble (Poly Haven ID: marble_01)
  { id: 'marble_01',          dest: 'marble/polished-marble' },
  // Fabric (accent textures for Phase 3 props — use col_1/col_01 for diffuse)
  { id: 'fabric_pattern_07',  dest: 'fabric/red-carpet',    diffuseSuffix: 'col_1' },
  { id: 'fabric_pattern_05',  dest: 'fabric/green-fabric',  diffuseSuffix: 'col_01' },
  // Metal (accent textures for Phase 3 props)
  { id: 'rusty_metal_03',     dest: 'metal/dark-iron' },
  // Weathered stone variant (accent for Phase 3 — same Poly Haven source as rough-stone, different dest)
  { id: 'rock_wall_08',       dest: 'stone/weathered-stone' },
];

const POLY_HAVEN_MAPS = [
  { suffix: 'diff',   filename: 'diffuse.jpg' },
  { suffix: 'nor_gl', filename: 'normal.jpg' },
  { suffix: 'rough',  filename: 'roughness.jpg' },
];

async function downloadPolyHavenTextures() {
  console.log('\n=== Poly Haven PBR Textures (CC0) ===\n');

  for (const tex of POLY_HAVEN_SETS) {
    console.log(`\n  ${tex.id} → textures/${tex.dest}/`);
    const destDir = join(PUBLIC_ASSETS, 'textures', tex.dest);

    for (const map of POLY_HAVEN_MAPS) {
      // Some Poly Haven textures use 'col_1' or 'col_01' instead of 'diff' for diffuse
      const suffix = (map.suffix === 'diff' && tex.diffuseSuffix) ? tex.diffuseSuffix : map.suffix;
      const url = `${POLY_HAVEN_BASE}/${tex.id}/${tex.id}_${suffix}_1k.jpg`;
      const destPath = join(destDir, map.filename);
      try {
        await downloadFile(url, destPath);
      } catch (err) {
        console.warn(`    [warn] ${map.filename}: ${err.message}`);
      }
    }
  }
}

// --- ambientCG Textures ---
// Downloads ZIP archives and extracts PBR maps.
// ZIP contains: {id}_{res}-JPG_Color.jpg, _NormalGL.jpg, _Roughness.jpg, _AmbientOcclusion.jpg

const AMBIENTCG_SETS = [
  { id: 'Wood049',    dest: 'wood/ornate-wood-panel' },
  { id: 'Plaster003', dest: 'plaster/plaster-wall' },
  { id: 'Leather025', dest: 'leather/leather-bound' },
  { id: 'Rock035',    dest: 'stone/vaulted-stone' },
  { id: 'Ground037',  dest: 'stone/mossy-stone' },
  { id: 'Bricks066',  dest: 'stone/brick-arch' },
];

// Map ambientCG file suffixes to our standard names
const AMBIENTCG_FILE_MAP = {
  'Color':             'diffuse.jpg',
  'NormalGL':          'normal.jpg',
  'Roughness':         'roughness.jpg',
  'AmbientOcclusion':  'ao.jpg',
};

function extractZip(zipPath, destDir) {
  if (platform() === 'win32') {
    // PowerShell's Expand-Archive is the most reliable ZIP extraction on Windows
    execSync(
      `PowerShell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: 'ignore' },
    );
  } else {
    execSync(`unzip -o -q "${zipPath}" -d "${destDir}"`, { stdio: 'ignore' });
  }
}

async function downloadAmbientCGTextures() {
  console.log('\n=== ambientCG PBR Textures (CC0) ===\n');

  for (const tex of AMBIENTCG_SETS) {
    const destDir = join(PUBLIC_ASSETS, 'textures', tex.dest);
    const diffusePath = join(destDir, 'diffuse.jpg');

    // Skip if already downloaded (check for diffuse as sentinel)
    if (await fileExists(diffusePath)) {
      console.log(`  [skip] ${tex.id} → textures/${tex.dest}/ (already exists)`);
      continue;
    }

    const url = `https://ambientcg.com/get?file=${tex.id}_1K-JPG.zip`;

    if (DRY_RUN) {
      console.log(`  [dry-run] Would download: ${url}`);
      continue;
    }

    console.log(`\n  ${tex.id} → textures/${tex.dest}/`);
    console.log(`  [download] ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

      // Save ZIP to temp directory
      const zipBuffer = Buffer.from(await response.arrayBuffer());
      const tempDir = join(tmpdir(), `ambientcg-${tex.id}-${Date.now()}`);
      await ensureDir(tempDir);
      const zipPath = join(tempDir, `${tex.id}.zip`);
      await writeFile(zipPath, zipBuffer);
      console.log(`  [saved zip] ${(zipBuffer.length / 1024).toFixed(1)} KB`);

      // Extract ZIP
      extractZip(zipPath, tempDir);

      // Copy and rename extracted files (copyFile handles cross-drive moves)
      await ensureDir(destDir);
      const extracted = await readdir(tempDir);
      for (const file of extracted) {
        for (const [suffix, destName] of Object.entries(AMBIENTCG_FILE_MAP)) {
          if (file.includes(`_${suffix}.jpg`) || file.includes(`_${suffix}.png`)) {
            await copyFile(join(tempDir, file), join(destDir, destName));
            console.log(`  [saved] ${destName}`);
            break;
          }
        }
      }

      // Cleanup temp
      await rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`  [warn] ${tex.id}: ${err.message}`);
    }
  }
}

// --- AI-Generated / Manual Textures ---

const MANUAL_TEXTURE_SETS = [
  { dest: 'metal/gold-trim',          source: 'AI-generated (CHORD) — gold decorative trim' },
  { dest: 'ceiling/painted-ceiling',   source: 'AI-generated (CHORD) — medieval fresco ceiling' },
  { dest: 'fabric/silk-tapestry',      source: 'AI-generated (CHORD) — silk tapestry pattern' },
];

async function checkManualTextures() {
  console.log('\n=== Manual / AI-Generated Textures ===\n');
  console.log('  These texture sets require manual creation or AI generation.');
  console.log('  Recommended: Ubisoft CHORD (https://github.com/ubisoft/ubisoft-laforge-chord)\n');

  for (const tex of MANUAL_TEXTURE_SETS) {
    const destDir = join(PUBLIC_ASSETS, 'textures', tex.dest);
    const diffusePath = join(destDir, 'diffuse.jpg');
    const exists = await fileExists(diffusePath);
    console.log(`  ${exists ? '[ok]    ' : '[missing]'} textures/${tex.dest}/ — ${tex.source}`);
  }
}

// --- All texture downloads combined ---

async function downloadTextures() {
  await downloadPolyHavenTextures();
  await downloadAmbientCGTextures();
  await checkManualTextures();
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

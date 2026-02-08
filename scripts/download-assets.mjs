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

// --- Models (Poly Pizza CC0) ---
// Static download URL: https://static.poly.pizza/{uuid}.glb
// All models are CC0 1.0 licensed. UUIDs resolved from poly.pizza/m/{slug}.

const POLY_PIZZA_MODELS = [
  // Architecture
  { uuid: '5239f88f-e30b-452b-a19e-89745d580b1e', dest: 'column-stone',  author: 'Quaternius',   desc: 'Stone column' },
  { uuid: '105dfd4b-6af3-4732-8c29-a89b15135b07', dest: 'column-round',  author: 'Quaternius',   desc: 'Round column variant' },
  { uuid: '0dcdbabb-629d-4eee-af16-7c49f6ba6e5e', dest: 'sconce-iron',   author: 'Quaternius',   desc: 'Wall torch/sconce' },
  { uuid: 'f82fb8a2-974a-43b6-8aa1-4a57da5dd7ca', dest: 'torch-wall',    author: 'CircuitZ',     desc: 'Wall torch variant' },
  // Furniture
  { uuid: 'b92206cb-3715-4d6e-9cef-c682b93a2018', dest: 'throne',        author: 'Quaternius',   desc: 'Large ornate chair/throne' },
  { uuid: '0286d99a-fc62-411f-ac94-fcb006a210d9', dest: 'table-long',    author: 'Quaternius',   desc: 'Large table' },
  { uuid: '0f319f3b-b0d6-4691-bae5-c6c6e612df99', dest: 'table-small',   author: 'Quaternius',   desc: 'Small table' },
  { uuid: '84ecc6a3-2751-4f50-912a-b9f4ff033d7a', dest: 'chair-high',    author: 'Quaternius',   desc: 'High-back chair' },
  { uuid: '91c2bf8d-0876-4801-abd3-8dd5d017ecbd', dest: 'desk',          author: 'Quaternius',   desc: 'Writing desk' },
  { uuid: '7d59d0aa-6447-4bbb-afc7-0452e9a34353', dest: 'bookshelf',     author: 'Quaternius',   desc: 'Bookcase with books' },
  { uuid: '1361c268-20f7-4e73-a931-ce434c6b503e', dest: 'bench',         author: 'Quaternius',   desc: 'Wooden bench' },
  // Weapons & Armor
  { uuid: '035c4897-22f3-4e9c-b29f-ebafe2b566da', dest: 'weapon-rack',   author: 'Quaternius',   desc: 'Torch stand (weapon rack)' },
  { uuid: 'cc5afa7b-86ed-44d0-9521-709ade03fda3', dest: 'armor-stand',   author: 'Quaternius',   desc: 'Pedestal (armor stand)' },
  // Lighting
  { uuid: '6e5a83ce-6631-4ba3-aff6-990c830a06df', dest: 'chandelier',    author: 'CreativeTrio', desc: 'Hanging chandelier' },
  { uuid: '95b40dfb-ff6c-446b-a348-725d9b9846f8', dest: 'brazier',       author: 'CircuitZ',     desc: 'Fire pit / brazier' },
  { uuid: 'ecbc7b04-09ca-4068-bb3c-4e5ce1163c9a', dest: 'lantern',       author: 'Kay Lousberg', desc: 'Hanging lantern' },
  // Decoration
  { uuid: '0c1ba162-9d94-4fc7-9a35-23653aacc7ac', dest: 'banner',        author: 'Quaternius',   desc: 'Wall-mounted banner' },
  { uuid: '02708091-4dee-4da7-b965-dd20a82b5fdb', dest: 'wall-flag',     author: 'Quaternius',   desc: 'Wall flag variant' },
  // Misc
  { uuid: 'e96d5573-fa3a-47ad-bae0-0ef9640026fa', dest: 'bonfire',       author: 'Quaternius',   desc: 'Bonfire / large fire' },
  { uuid: '44d13b75-c154-4f11-8c4e-4e57ac3093f7', dest: 'crenellation',  author: 'Kenney',       desc: 'Bookcase closed wide (merlon)' },
];

async function downloadModels() {
  console.log('\n=== 3D Props from Poly Pizza (CC0) ===\n');

  const modelsDir = join(PUBLIC_ASSETS, 'models', 'props');
  await ensureDir(modelsDir);

  for (const model of POLY_PIZZA_MODELS) {
    const destPath = join(modelsDir, `${model.dest}.glb`);

    if (await fileExists(destPath)) {
      console.log(`  [skip] ${model.dest}.glb (already exists)`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] Would download: ${model.dest}.glb (${model.desc} by ${model.author})`);
      continue;
    }

    const url = `https://static.poly.pizza/${model.uuid}.glb`;
    console.log(`  [download] ${model.dest}.glb — ${model.desc} by ${model.author}`);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(destPath, buffer);
      console.log(`  [saved] ${(buffer.length / 1024).toFixed(1)} KB → models/props/${model.dest}.glb`);
    } catch (err) {
      console.warn(`  [warn] ${model.dest}.glb: ${err.message}`);
    }
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
  if (!ONLY || ONLY === 'models')      await downloadModels();
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

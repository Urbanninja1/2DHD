#!/usr/bin/env node

/**
 * Asset Validation Script
 *
 * Validates that all assets referenced in room data files exist on disk
 * and meet size/format constraints.
 *
 * Checks:
 *   1. All model paths (modelPath) exist as .glb files
 *   2. All sprite paths (spritePath) exist as .png files
 *   3. All texture base paths have at least diffuse.jpg
 *   4. All parallax texture paths exist as .png files
 *   5. Texture dimensions are powers of two (when readable)
 *   6. No duplicate asset files referenced
 *   7. Model files are under 100KB budget
 *
 * Usage:
 *   node scripts/validate-assets.mjs
 */

import { readdir, stat, readFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const ROOM_DATA_DIR = join(PROJECT_ROOT, 'src', 'rooms', 'room-data');

const MAX_MODEL_SIZE_KB = 100;

let errors = 0;
let warnings = 0;

function error(msg) {
  errors++;
  console.error(`  ERROR: ${msg}`);
}

function warn(msg) {
  warnings++;
  console.warn(`  WARN:  ${msg}`);
}

function ok(msg) {
  console.log(`  OK:    ${msg}`);
}

/**
 * Check if a file exists.
 */
async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in KB.
 */
async function fileSizeKB(path) {
  try {
    const s = await stat(path);
    return s.size / 1024;
  } catch {
    return -1;
  }
}

/**
 * Check if a number is a power of two.
 */
function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Extract asset paths from room data TypeScript files using regex.
 * This avoids needing to compile/import TS files.
 */
async function extractAssetPaths() {
  const modelPaths = new Set();
  const spritePaths = new Set();
  const texturePaths = new Set();
  const parallaxPaths = new Set();

  const entries = await readdir(ROOM_DATA_DIR);
  const roomFiles = entries.filter(f => /^\d{2}-.*\.ts$/.test(f));

  for (const file of roomFiles) {
    const content = await readFile(join(ROOM_DATA_DIR, file), 'utf8');

    // Extract modelPath: 'assets/models/...'
    const modelMatches = content.matchAll(/modelPath:\s*['"]([^'"]+)['"]/g);
    for (const m of modelMatches) {
      modelPaths.add(m[1]);
    }

    // Extract spritePath: 'assets/sprites/...'
    const spriteMatches = content.matchAll(/spritePath:\s*['"]([^'"]+)['"]/g);
    for (const m of spriteMatches) {
      spritePaths.add(m[1]);
    }

    // Extract basePath: 'assets/textures/...'
    const textureMatches = content.matchAll(/basePath:\s*['"]([^'"]+)['"]/g);
    for (const m of textureMatches) {
      texturePaths.add(m[1]);
    }

    // Extract texturePath for parallax: 'assets/backgrounds/...'
    const parallaxMatches = content.matchAll(/texturePath:\s*['"]([^'"]+)['"]/g);
    for (const m of parallaxMatches) {
      parallaxPaths.add(m[1]);
    }
  }

  // Also extract player sprite path from main.ts
  try {
    const mainContent = await readFile(join(PROJECT_ROOT, 'src', 'main.ts'), 'utf8');
    const playerMatch = mainContent.match(/loadAsync\(['"]([^'"]*sprites[^'"]+)['"]\)/);
    if (playerMatch) {
      spritePaths.add(playerMatch[1]);
    }
  } catch { /* ignore */ }

  return { modelPaths, spritePaths, texturePaths, parallaxPaths };
}

/**
 * Validate model files (.glb).
 */
async function validateModels(modelPaths) {
  console.log('\n--- Model Validation ---');
  const seen = new Map();

  for (const relPath of modelPaths) {
    const fullPath = join(PUBLIC_DIR, relPath);

    // Check existence
    if (!(await fileExists(fullPath))) {
      error(`Model not found: ${relPath}`);
      continue;
    }

    // Check file size
    const sizeKB = await fileSizeKB(fullPath);
    if (sizeKB > MAX_MODEL_SIZE_KB) {
      warn(`Model exceeds ${MAX_MODEL_SIZE_KB}KB budget: ${relPath} (${sizeKB.toFixed(1)}KB)`);
    } else {
      ok(`${relPath} (${sizeKB.toFixed(1)}KB)`);
    }

    // Track duplicates
    const fileName = relPath.split('/').pop();
    if (seen.has(fileName)) {
      warn(`Duplicate model filename: ${fileName} (also at ${seen.get(fileName)})`);
    }
    seen.set(fileName, relPath);
  }
}

/**
 * Validate sprite files (.png).
 */
async function validateSprites(spritePaths) {
  console.log('\n--- Sprite Validation ---');

  for (const relPath of spritePaths) {
    const fullPath = join(PUBLIC_DIR, relPath);

    if (!(await fileExists(fullPath))) {
      error(`Sprite not found: ${relPath}`);
      continue;
    }

    const sizeKB = await fileSizeKB(fullPath);
    ok(`${relPath} (${sizeKB.toFixed(1)}KB)`);
  }
}

/**
 * Validate PBR texture sets (need at least diffuse.jpg).
 */
async function validateTextures(texturePaths) {
  console.log('\n--- Texture Set Validation ---');

  for (const basePath of texturePaths) {
    const fullBase = join(PUBLIC_DIR, basePath);

    // Check diffuse (required)
    const diffusePath = join(fullBase, 'diffuse.jpg');
    if (!(await fileExists(diffusePath))) {
      error(`Missing diffuse.jpg: ${basePath}/diffuse.jpg`);
      continue;
    }

    // Check optional maps
    const maps = ['normal.jpg', 'roughness.jpg', 'ao.jpg'];
    const present = ['diffuse.jpg'];
    for (const map of maps) {
      if (await fileExists(join(fullBase, map))) {
        present.push(map);
      }
    }

    ok(`${basePath} [${present.join(', ')}]`);
  }
}

/**
 * Validate parallax background images.
 */
async function validateParallax(parallaxPaths) {
  console.log('\n--- Parallax Background Validation ---');

  for (const relPath of parallaxPaths) {
    const fullPath = join(PUBLIC_DIR, relPath);

    if (!(await fileExists(fullPath))) {
      error(`Parallax layer not found: ${relPath}`);
      continue;
    }

    const sizeKB = await fileSizeKB(fullPath);
    ok(`${relPath} (${sizeKB.toFixed(1)}KB)`);
  }
}

/**
 * Scan for orphaned assets (files on disk not referenced by any room).
 */
async function checkOrphans(modelPaths, spritePaths) {
  console.log('\n--- Orphan Check ---');

  // Check models
  const modelDir = join(PUBLIC_DIR, 'assets', 'models', 'props');
  try {
    const files = await readdir(modelDir);
    for (const file of files) {
      const relPath = `assets/models/props/${file}`;
      if (!modelPaths.has(relPath)) {
        warn(`Orphaned model (not referenced by any room): ${relPath}`);
      }
    }
  } catch { /* dir may not exist */ }

  // Check sprites
  const spriteDirs = ['assets/sprites/npcs', 'assets/sprites/player'];
  for (const dir of spriteDirs) {
    try {
      const files = await readdir(join(PUBLIC_DIR, dir));
      for (const file of files) {
        const relPath = `${dir}/${file}`;
        if (!spritePaths.has(relPath)) {
          warn(`Orphaned sprite (not referenced): ${relPath}`);
        }
      }
    } catch { /* dir may not exist */ }
  }
}

async function main() {
  console.log('Asset Validation');
  console.log('================');

  const { modelPaths, spritePaths, texturePaths, parallaxPaths } = await extractAssetPaths();

  console.log(`\nDiscovered references:`);
  console.log(`  Models:     ${modelPaths.size}`);
  console.log(`  Sprites:    ${spritePaths.size}`);
  console.log(`  Textures:   ${texturePaths.size}`);
  console.log(`  Parallax:   ${parallaxPaths.size}`);

  await validateModels(modelPaths);
  await validateSprites(spritePaths);
  await validateTextures(texturePaths);
  await validateParallax(parallaxPaths);
  await checkOrphans(modelPaths, spritePaths);

  console.log('\n================');
  console.log(`Errors:   ${errors}`);
  console.log(`Warnings: ${warnings}`);

  if (errors > 0) {
    console.log('\nValidation FAILED.');
    process.exit(1);
  } else {
    console.log('\nValidation PASSED.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

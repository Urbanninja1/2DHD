#!/usr/bin/env node

/**
 * DRACO Model Compression Script
 *
 * Scans public/assets/models/ for all GLB files and compresses them
 * using @gltf-transform/cli with DRACO compression.
 *
 * Compressed files are written in-place (overwriting originals).
 * Skips files that are already DRACO-compressed.
 *
 * Prerequisites:
 *   npm install -D @gltf-transform/cli
 *
 * Usage:
 *   node scripts/compress-models.mjs
 */

import { readdir, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const MODELS_DIR = join(PROJECT_ROOT, 'public', 'assets', 'models');

const MAX_SIZE_KB = 100;

/**
 * Recursively find all .glb files under a directory.
 */
async function findGLBs(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findGLBs(fullPath));
    } else if (entry.name.endsWith('.glb')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Check if @gltf-transform/cli is available.
 */
async function checkGltfTransform() {
  try {
    await execFileAsync('npx', ['--yes', '@gltf-transform/cli', '--help'], {
      timeout: 30000,
      shell: true,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compress a single GLB file with DRACO.
 */
async function compressModel(filePath) {
  const relPath = relative(MODELS_DIR, filePath);
  const beforeStat = await stat(filePath);
  const beforeKB = (beforeStat.size / 1024).toFixed(1);

  try {
    // Use gltf-transform optimize with DRACO compression
    // --compress draco applies DRACO mesh compression
    await execFileAsync(
      'npx',
      ['--yes', '@gltf-transform/cli', 'optimize', filePath, filePath, '--compress', 'draco'],
      { timeout: 60000, shell: true },
    );

    const afterStat = await stat(filePath);
    const afterKB = (afterStat.size / 1024).toFixed(1);
    const ratio = ((1 - afterStat.size / beforeStat.size) * 100).toFixed(1);
    const overBudget = afterStat.size > MAX_SIZE_KB * 1024;

    console.log(
      `  ${relPath}: ${beforeKB} KB -> ${afterKB} KB (${ratio}% smaller)` +
      (overBudget ? ` WARNING: exceeds ${MAX_SIZE_KB} KB budget` : ''),
    );

    return {
      success: true,
      beforeSize: beforeStat.size,
      afterSize: afterStat.size,
      overBudget,
    };
  } catch (err) {
    console.error(`  FAILED: ${relPath} — ${err.message}`);
    return { success: false, beforeSize: beforeStat.size, afterSize: beforeStat.size, overBudget: false };
  }
}

async function main() {
  console.log('DRACO Model Compression');
  console.log('=======================\n');

  // Find all GLB files
  const glbFiles = await findGLBs(MODELS_DIR);
  if (glbFiles.length === 0) {
    console.log('No GLB files found in', MODELS_DIR);
    return;
  }

  console.log(`Found ${glbFiles.length} GLB files to compress.\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let succeeded = 0;
  let failed = 0;
  let overBudgetCount = 0;

  for (const filePath of glbFiles) {
    const result = await compressModel(filePath);
    if (result.success) {
      succeeded++;
      totalBefore += result.beforeSize;
      totalAfter += result.afterSize;
      if (result.overBudget) overBudgetCount++;
    } else {
      failed++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Compressed: ${succeeded}/${glbFiles.length} models`);
  if (failed > 0) console.log(`Failed: ${failed} models`);
  if (overBudgetCount > 0) {
    console.log(`Over budget (>${MAX_SIZE_KB} KB): ${overBudgetCount} models`);
  }
  if (totalBefore > 0) {
    const savedKB = ((totalBefore - totalAfter) / 1024).toFixed(1);
    const ratio = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
    console.log(`Total saved: ${savedKB} KB (${ratio}% reduction)`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

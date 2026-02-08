#!/usr/bin/env node

/**
 * KTX2 Texture Compression Script
 *
 * Scans public/assets/textures/ for JPG files and compresses them to KTX2 format
 * using the toktx CLI from KTX-Software.
 *
 * Compression strategy:
 *   - Diffuse maps:    ETC1S (lossy, high compression ratio, good for color)
 *   - Normal/Roughness/AO: UASTC (near-lossless, better for data textures)
 *
 * Output goes to public/assets/textures-ktx2/ (preserving directory structure).
 * Original JPGs are preserved — the runtime loader tries .ktx2 first, falls back to .jpg.
 *
 * Prerequisites:
 *   Install toktx from https://github.com/KhronosGroup/KTX-Software/releases
 *   Ensure `toktx` is on your PATH.
 *
 * Usage:
 *   node scripts/compress-textures.mjs
 */

import { readdir, stat, mkdir } from 'node:fs/promises';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const TEXTURES_SRC = join(PROJECT_ROOT, 'public', 'assets', 'textures');
const TEXTURES_DST = join(PROJECT_ROOT, 'public', 'assets', 'textures-ktx2');

/** Map types that use UASTC encoding (data textures, not color) */
const UASTC_MAPS = new Set(['normal', 'roughness', 'ao']);

/**
 * Recursively find all .jpg files under a directory.
 */
async function findJPGs(dir) {
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
      results.push(...await findJPGs(fullPath));
    } else if (entry.name.endsWith('.jpg') || entry.name.endsWith('.jpeg')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Check if toktx is available on the system.
 */
async function checkToktx() {
  try {
    await execFileAsync('toktx', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determine if a texture file is a data map (UASTC) or color map (ETC1S).
 */
function isDataMap(filePath) {
  const name = basename(filePath, '.jpg').replace('.jpeg', '');
  return UASTC_MAPS.has(name);
}

/**
 * Compress a single JPG to KTX2 using toktx.
 */
async function compressTexture(srcPath, dstPath) {
  const dstDir = dirname(dstPath);
  await mkdir(dstDir, { recursive: true });

  // toktx outputs with .ktx2 extension
  const outputPath = dstPath.replace(/\.jpe?g$/i, '.ktx2');

  const args = [];

  if (isDataMap(srcPath)) {
    // UASTC for data textures (normal, roughness, AO)
    args.push(
      '--encode', 'uastc',
      '--uastc_quality', '4',
      '--zcmp', '22',
      '--genmipmap',
      '--assign_oetf', 'linear',
    );
  } else {
    // ETC1S for diffuse/color textures
    args.push(
      '--encode', 'etc1s',
      '--clevel', '4',
      '--qlevel', '255',
      '--genmipmap',
    );
  }

  args.push(outputPath, srcPath);

  try {
    await execFileAsync('toktx', args);
    const srcStat = await stat(srcPath);
    const dstStat = await stat(outputPath);
    const ratio = ((1 - dstStat.size / srcStat.size) * 100).toFixed(1);
    const mapType = isDataMap(srcPath) ? 'UASTC' : 'ETC1S';
    console.log(
      `  [${mapType}] ${relative(TEXTURES_SRC, srcPath)} -> ` +
      `${(dstStat.size / 1024).toFixed(1)} KB (${ratio}% smaller)`,
    );
    return { success: true, srcSize: srcStat.size, dstSize: dstStat.size };
  } catch (err) {
    console.error(`  FAILED: ${relative(TEXTURES_SRC, srcPath)} — ${err.message}`);
    return { success: false, srcSize: 0, dstSize: 0 };
  }
}

async function main() {
  console.log('KTX2 Texture Compression');
  console.log('========================\n');

  // Check toktx availability
  const hasToktx = await checkToktx();
  if (!hasToktx) {
    console.error(
      'ERROR: toktx not found on PATH.\n\n' +
      'Install KTX-Software from:\n' +
      '  https://github.com/KhronosGroup/KTX-Software/releases\n\n' +
      'Then ensure the `toktx` binary is in your system PATH.\n',
    );
    process.exit(1);
  }

  // Find all JPG textures
  const jpgFiles = await findJPGs(TEXTURES_SRC);
  if (jpgFiles.length === 0) {
    console.log('No JPG textures found in', TEXTURES_SRC);
    console.log('(Textures may be procedurally generated — nothing to compress.)');
    return;
  }

  console.log(`Found ${jpgFiles.length} JPG files to compress.\n`);

  let totalSrc = 0;
  let totalDst = 0;
  let succeeded = 0;
  let failed = 0;

  for (const srcPath of jpgFiles) {
    const relPath = relative(TEXTURES_SRC, srcPath);
    const dstPath = join(TEXTURES_DST, relPath);
    const result = await compressTexture(srcPath, dstPath);
    if (result.success) {
      succeeded++;
      totalSrc += result.srcSize;
      totalDst += result.dstSize;
    } else {
      failed++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Compressed: ${succeeded}/${jpgFiles.length} files`);
  if (failed > 0) console.log(`Failed: ${failed} files`);
  if (totalSrc > 0) {
    const savedMB = ((totalSrc - totalDst) / (1024 * 1024)).toFixed(2);
    const ratio = ((1 - totalDst / totalSrc) * 100).toFixed(1);
    console.log(`Total saved: ${savedMB} MB (${ratio}% reduction)`);
  }
  console.log(`\nOutput: ${relative(PROJECT_ROOT, TEXTURES_DST)}/`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

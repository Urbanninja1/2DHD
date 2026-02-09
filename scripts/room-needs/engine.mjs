#!/usr/bin/env node
/**
 * Room Needs Engine — CLI Entry Point
 *
 * A Claude-powered furnishing intelligence system that generates
 * historically/lore-accurate manifests of objects for game rooms.
 *
 * Usage:
 *   node scripts/room-needs/engine.mjs generate <room-input.json>     # Full pipeline
 *   node scripts/room-needs/engine.mjs analyze <manifest.json>         # Gap analysis only
 *   node scripts/room-needs/engine.mjs resolve <manifest.json>         # Resolve placement only
 *   node scripts/room-needs/engine.mjs write <resolved-manifest.json>  # Write TS only
 */
import { readFile } from 'fs/promises';
import { join } from 'path';

import { RoomInputSchema } from './schemas/room-input.mjs';
import { FurnishingManifestSchema } from './schemas/manifest.mjs';
import { generateManifest, saveManifest } from './generate-manifest.mjs';
import { analyzeGaps, formatGapReport } from './analyze-gaps.mjs';
import { resolvePlacements } from './resolve-placement.mjs';
import { writeRoomData } from './write-room-data.mjs';
import { validateManifest, formatValidation } from './validate.mjs';

const PROJECT_ROOT = process.cwd();

/**
 * Load and parse a JSON file, validating with optional Zod schema.
 */
async function loadJSON(filePath, schema) {
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (schema) return schema.parse(parsed);
  return parsed;
}

/**
 * Load features for a room input.
 */
async function loadFeatures(roomInput) {
  if (roomInput.featuresFile) {
    try {
      const raw = await readFile(join(PROJECT_ROOT, roomInput.featuresFile), 'utf-8');
      return JSON.parse(raw);
    } catch {
      console.warn(`Warning: Could not load features file: ${roomInput.featuresFile}`);
    }
  }
  return {};
}

// ─── Commands ─────────────────────────────────────────────────────────

/**
 * Full pipeline: generate → analyze → resolve → validate → write
 */
async function cmdGenerate(inputPath) {
  console.log('=== ROOM NEEDS ENGINE: FULL PIPELINE ===\n');

  // 1. Load room input
  console.log('Stage 0: Loading room input...');
  const roomInput = await loadJSON(inputPath, RoomInputSchema);
  console.log(`  Room: ${roomInput.name} (${roomInput.type})`);
  console.log(`  Dimensions: ${roomInput.dimensions.width}×${roomInput.dimensions.depth}×${roomInput.dimensions.height}m`);

  // 2. Generate manifest via Claude
  console.log('\nStage 1: Generating furnishing manifest...');
  const manifest = await generateManifest(roomInput);
  const manifestPath = await saveManifest(manifest, roomInput.type);

  // 3. Analyze gaps
  console.log('\nStage 2: Analyzing asset gaps...');
  const gapReport = await analyzeGaps(manifest);
  console.log(formatGapReport(gapReport));

  // 4. Resolve placements
  console.log('\nStage 3: Resolving placements...');
  const resolved = resolvePlacements(manifest, roomInput.dimensions, roomInput.doors || []);

  // 5. Validate
  console.log('\nStage 4: Validating...');
  const validation = validateManifest(resolved, roomInput.dimensions);
  console.log(formatValidation(validation));

  if (!validation.valid) {
    console.error('\nValidation FAILED — fix errors before writing RoomData.');
    console.log(`Manifest saved at: ${manifestPath}`);
    process.exit(1);
  }

  // 6. Write TypeScript
  console.log('\nStage 5: Writing RoomData TypeScript...');
  const castle = roomInput.castle || 'ironrath';
  const outputPath = join(
    PROJECT_ROOT,
    'src/rooms/room-data',
    castle,
    `${roomInput.type}.generated.ts`,
  );
  await writeRoomData(resolved, roomInput, outputPath);

  console.log('\n=== PIPELINE COMPLETE ===');
  console.log(`  Manifest: ${manifestPath}`);
  console.log(`  RoomData: ${outputPath}`);
  if (gapReport.totalGaps > 0) {
    console.log(`\n  ${gapReport.totalGaps} assets need to be built (see gap report above).`);
    console.log('  Run blender pipeline for missing assets before using the generated room.');
  }
}

/**
 * Gap analysis only — analyze an existing manifest.
 */
async function cmdAnalyze(manifestPath) {
  console.log('=== GAP ANALYSIS ===\n');
  const manifest = await loadJSON(manifestPath, FurnishingManifestSchema);
  const report = await analyzeGaps(manifest);
  console.log(formatGapReport(report));
}

/**
 * Resolve placements only — needs manifest + room input.
 */
async function cmdResolve(manifestPath, inputPath) {
  if (!inputPath) {
    console.error('Usage: resolve <manifest.json> <room-input.json>');
    process.exit(1);
  }

  console.log('=== PLACEMENT RESOLUTION ===\n');
  const manifest = await loadJSON(manifestPath, FurnishingManifestSchema);
  const roomInput = await loadJSON(inputPath, RoomInputSchema);

  const resolved = resolvePlacements(manifest, roomInput.dimensions, roomInput.doors || []);

  // Count resolved positions
  const layerNames = ['architecture', 'essentialFurnishing', 'functionalObjects', 'lifeLayer'];
  let totalPositions = 0;
  for (const layerName of layerNames) {
    for (const item of resolved.layers[layerName] || []) {
      totalPositions += (item.resolvedPositions || []).length;
    }
  }
  console.log(`Resolved ${totalPositions} positions.`);

  // Save resolved manifest
  const { writeFile: wf, mkdir } = await import('fs/promises');
  const { dirname } = await import('path');
  const outputPath = manifestPath.replace('.json', '-resolved.json');
  await wf(outputPath, JSON.stringify(resolved, null, 2));
  console.log(`Resolved manifest saved to ${outputPath}`);
}

/**
 * Write TypeScript only — needs resolved manifest + room input.
 */
async function cmdWrite(manifestPath, inputPath) {
  if (!inputPath) {
    console.error('Usage: write <resolved-manifest.json> <room-input.json>');
    process.exit(1);
  }

  console.log('=== ROOMDATA WRITER ===\n');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  const roomInput = await loadJSON(inputPath, RoomInputSchema);

  const castle = roomInput.castle || 'ironrath';
  const outputPath = join(
    PROJECT_ROOT,
    'src/rooms/room-data',
    castle,
    `${roomInput.type}.generated.ts`,
  );
  await writeRoomData(manifest, roomInput, outputPath);
}

// ─── Main ─────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv;

if (!command) {
  console.log(`Room Needs Engine — Claude-powered furnishing intelligence

Usage:
  node scripts/room-needs/engine.mjs generate <room-input.json>
    Full pipeline: Claude API → gap analysis → placement → TypeScript

  node scripts/room-needs/engine.mjs analyze <manifest.json>
    Gap analysis only: check which assets exist/missing

  node scripts/room-needs/engine.mjs resolve <manifest.json> <room-input.json>
    Resolve placement coordinates from a manifest

  node scripts/room-needs/engine.mjs write <resolved-manifest.json> <room-input.json>
    Write TypeScript RoomData from a resolved manifest

Example:
  node scripts/room-needs/engine.mjs generate scripts/room-needs/data/great-hall-input.json
`);
  process.exit(0);
}

try {
  switch (command) {
    case 'generate':
      await cmdGenerate(args[0]);
      break;
    case 'analyze':
      await cmdAnalyze(args[0]);
      break;
    case 'resolve':
      await cmdResolve(args[0], args[1]);
      break;
    case 'write':
      await cmdWrite(args[0], args[1]);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
} catch (err) {
  console.error(`\nError: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
}

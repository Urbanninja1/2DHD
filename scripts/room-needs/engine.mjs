#!/usr/bin/env node
/**
 * Room Needs Engine — CLI Entry Point
 *
 * A Claude Code workflow tool that generates historically/lore-accurate
 * furnishing manifests for game rooms. Stage 1 (manifest generation)
 * is done interactively with Claude Code. Stages 2-5 are automated.
 *
 * Usage:
 *   node scripts/room-needs/engine.mjs prompt <room-input.json>        # Build context prompt
 *   node scripts/room-needs/engine.mjs pipeline <room-input.json>      # Run stages 2-5 on existing manifest
 *   node scripts/room-needs/engine.mjs analyze <manifest.json>          # Gap analysis only
 *   node scripts/room-needs/engine.mjs resolve <manifest.json> <input>  # Resolve placement only
 *   node scripts/room-needs/engine.mjs write <resolved.json> <input>    # Write TS only
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

import { RoomInputSchema } from './schemas/room-input.mjs';
import { FurnishingManifestSchema } from './schemas/manifest.mjs';
import { buildRoomPrompt, saveManifest } from './generate-manifest.mjs';
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

// ─── Commands ─────────────────────────────────────────────────────────

/**
 * Build the context prompt for Claude Code to generate a manifest.
 */
async function cmdPrompt(inputPath) {
  console.log('=== ROOM NEEDS ENGINE: BUILD PROMPT ===\n');
  const roomInput = await loadJSON(inputPath, RoomInputSchema);
  console.log(`Room: ${roomInput.name} (${roomInput.type})`);
  console.log(`Dimensions: ${roomInput.dimensions.width}×${roomInput.dimensions.depth}×${roomInput.dimensions.height}m\n`);
  await buildRoomPrompt(roomInput);
}

/**
 * Pipeline: analyze → resolve → validate → write
 * Expects a manifest already exists at output/{room-type}-manifest.json
 */
async function cmdPipeline(inputPath) {
  console.log('=== ROOM NEEDS ENGINE: PIPELINE ===\n');

  // 1. Load room input
  const roomInput = await loadJSON(inputPath, RoomInputSchema);
  console.log(`Room: ${roomInput.name} (${roomInput.type})`);
  console.log(`Density tier: ${roomInput.densityTier || 'moderate'}`);

  // 2. Load existing manifest
  const manifestPath = join(PROJECT_ROOT, 'scripts/room-needs/output', `${roomInput.type}-manifest.json`);
  let manifest;
  try {
    manifest = await loadJSON(manifestPath, FurnishingManifestSchema);
  } catch (err) {
    console.error(`Could not load manifest at: ${manifestPath}`);
    console.error(`Run 'prompt' first, generate the manifest with Claude Code, then save it there.`);
    console.error(`\nDetails: ${err.message}`);
    process.exit(1);
  }
  console.log(`Manifest loaded: ${manifestPath}`);

  // 3. Analyze gaps
  console.log('\nStage 2: Analyzing asset gaps...');
  const gapReport = await analyzeGaps(manifest);
  console.log(formatGapReport(gapReport));

  // 4. Resolve placements
  console.log('\nStage 3: Resolving placements...');
  const resolved = resolvePlacements(manifest, roomInput.dimensions, roomInput.doors || []);

  // 5. Validate
  console.log('\nStage 4: Validating...');
  const validation = validateManifest(resolved, roomInput.dimensions, roomInput.densityTier);
  console.log(formatValidation(validation));

  if (!validation.valid) {
    console.error('\nValidation FAILED — fix errors in manifest before writing RoomData.');
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
  const outputPath = manifestPath.replace('.json', '-resolved.json');
  await writeFile(outputPath, JSON.stringify(resolved, null, 2));
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
  console.log(`Room Needs Engine — Claude Code furnishing workflow

Usage:
  node scripts/room-needs/engine.mjs prompt <room-input.json>
    Build context prompt for Claude Code manifest generation.
    Saves the assembled prompt to output/{room-type}-prompt.md

  node scripts/room-needs/engine.mjs pipeline <room-input.json>
    Run stages 2-5 on an existing manifest (from output/{room-type}-manifest.json).
    Gap analysis → placement → validation → TypeScript

  node scripts/room-needs/engine.mjs analyze <manifest.json>
    Gap analysis only: check which assets exist/missing

  node scripts/room-needs/engine.mjs resolve <manifest.json> <room-input.json>
    Resolve placement coordinates from a manifest

  node scripts/room-needs/engine.mjs write <resolved-manifest.json> <room-input.json>
    Write TypeScript RoomData from a resolved manifest

Workflow:
  1. prompt  → builds the context prompt with room data + asset list
  2. You + Claude Code → generate the manifest JSON interactively
  3. Save manifest to scripts/room-needs/output/{room-type}-manifest.json
  4. pipeline → runs gap analysis, placement, validation, TypeScript output
`);
  process.exit(0);
}

try {
  switch (command) {
    case 'prompt':
      await cmdPrompt(args[0]);
      break;
    case 'pipeline':
      await cmdPipeline(args[0]);
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

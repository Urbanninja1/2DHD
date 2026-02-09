/**
 * Stage 1: Prompt Builder + Manifest Validator
 *
 * Assembles the full context prompt from room input + asset list + schema,
 * saves it to a file for use in a Claude Code session.
 * Also validates and saves manifests produced during the session.
 */
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { FurnishingManifestSchema } from './schemas/manifest.mjs';

const PROJECT_ROOT = process.cwd();

/** Density tier configurations */
const DENSITY_CONFIGS = {
  'sparse':       { propsPerSqM: 1.5, lifeRatio: 0.35, triBudgetK: 50 },
  'moderate':     { propsPerSqM: 2.5, lifeRatio: 0.40, triBudgetK: 75 },
  'dense':        { propsPerSqM: 5.0, lifeRatio: 0.45, triBudgetK: 150 },
  'aaa-showcase': { propsPerSqM: 8.0, lifeRatio: 0.50, triBudgetK: 200 },
};
const IRONRATH_PROPS_DIR = join(PROJECT_ROOT, 'public/assets/models/props/ironrath');
const GENERIC_PROPS_DIR = join(PROJECT_ROOT, 'public/assets/models/props');
const PROMPTS_DIR = join(PROJECT_ROOT, 'scripts/room-needs/prompts');
const OUTPUT_DIR = join(PROJECT_ROOT, 'scripts/room-needs/output');

/**
 * Collect all existing GLB asset names from the props directories.
 */
async function getAssetList() {
  const assets = [];

  try {
    const ironrathFiles = await readdir(IRONRATH_PROPS_DIR);
    for (const f of ironrathFiles) {
      if (f.endsWith('.glb')) assets.push(basename(f, '.glb'));
    }
  } catch { /* dir may not exist */ }

  try {
    const genericFiles = await readdir(GENERIC_PROPS_DIR);
    for (const f of genericFiles) {
      if (f.endsWith('.glb')) assets.push(basename(f, '.glb'));
    }
  } catch { /* dir may not exist */ }

  return [...new Set(assets)].sort();
}

/**
 * Build the full prompt from template + dynamic data.
 */
async function buildPrompt(roomInput, assetList) {
  const template = await readFile(join(PROMPTS_DIR, 'system-prompt.md'), 'utf-8');
  const materials = await readFile(
    join(PROJECT_ROOT, 'scripts/room-needs/data/materials.json'), 'utf-8',
  );

  // Load example manifest if available
  let exampleSection = '';
  try {
    const examplePath = join(PROMPTS_DIR, 'examples', `${roomInput.type}.json`);
    const example = await readFile(examplePath, 'utf-8');
    exampleSection = `## EXAMPLE OUTPUT (${roomInput.type})\n\nThis is a gold-standard example. Match this style and structure.\n\n\`\`\`json\n${example}\n\`\`\``;
  } catch {
    // No example available for this room type — that's fine
  }

  const halfWidth = roomInput.dimensions.width / 2;
  const halfDepth = roomInput.dimensions.depth / 2;
  const height = roomInput.dimensions.height;

  // Build room input summary
  const roomSummary = [
    `Type: ${roomInput.type}`,
    `Name: ${roomInput.name}`,
    `Dimensions: ${roomInput.dimensions.width}m × ${roomInput.dimensions.depth}m × ${height}m`,
    `Culture: ${roomInput.culture}`,
    `Wealth: ${roomInput.wealth}`,
    `Era: ${roomInput.era}`,
    `Purpose: ${roomInput.purpose}`,
    `Castle: ${roomInput.castle || 'ironrath'}`,
    `Lore: ${roomInput.lore}`,
  ].join('\n');

  // Format materials as a readable list
  const materialData = JSON.parse(materials);
  const materialList = Object.entries(materialData)
    .map(([name, info]) => `- **${name}**: ${info.description}`)
    .join('\n');

  // --- Density calculations ---
  const densityTier = roomInput.densityTier || 'moderate';
  const densityCfg = DENSITY_CONFIGS[densityTier];
  const roomArea = roomInput.dimensions.width * roomInput.dimensions.depth;
  const targetTotal = Math.round(roomArea * densityCfg.propsPerSqM);
  const lifeTarget = Math.round(targetTotal * densityCfg.lifeRatio);
  const remaining = targetTotal - lifeTarget;
  // Architecture ~15%, Essential ~25%, Functional ~20% of non-life
  const archTarget = Math.round(remaining * 0.25);
  const essentialTarget = Math.round(remaining * 0.40);
  const functionalTarget = remaining - archTarget - essentialTarget;

  // Life layer sub-category breakdowns
  const lifeFloorClutter = Math.round(lifeTarget * 0.30);
  const lifeSurfaceDetail = Math.round(lifeTarget * 0.25);
  const lifeWallDetail = Math.round(lifeTarget * 0.20);
  const lifeAtmospheric = Math.round(lifeTarget * 0.15);
  const lifeAsymmetric = lifeTarget - lifeFloorClutter - lifeSurfaceDetail - lifeWallDetail - lifeAtmospheric;

  // Apply template substitutions
  let prompt = template
    .replace('{{ROOM_INPUT}}', roomSummary)
    .replace(/\{\{HALF_WIDTH\}\}/g, String(halfWidth))
    .replace(/\{\{HALF_DEPTH\}\}/g, String(halfDepth))
    .replace(/\{\{HEIGHT\}\}/g, String(height))
    .replace('{{ASSET_LIST}}', assetList.join('\n'))
    .replace('{{MATERIALS}}', materialList)
    .replace('{{EXAMPLE_SECTION}}', exampleSection)
    // Density substitutions
    .replace(/\{\{DENSITY_TIER\}\}/g, densityTier)
    .replace(/\{\{ROOM_AREA\}\}/g, String(roomArea))
    .replace(/\{\{PROPS_PER_SQM\}\}/g, String(densityCfg.propsPerSqM))
    .replace(/\{\{TOTAL_TARGET\}\}/g, String(targetTotal))
    .replace(/\{\{ARCH_TARGET\}\}/g, String(archTarget))
    .replace(/\{\{ESSENTIAL_TARGET\}\}/g, String(essentialTarget))
    .replace(/\{\{FUNCTIONAL_TARGET\}\}/g, String(functionalTarget))
    .replace(/\{\{LIFE_TARGET\}\}/g, String(lifeTarget))
    .replace(/\{\{TRI_BUDGET\}\}/g, String(densityCfg.triBudgetK))
    .replace(/\{\{LIFE_FLOOR_CLUTTER\}\}/g, String(lifeFloorClutter))
    .replace(/\{\{LIFE_SURFACE_DETAIL\}\}/g, String(lifeSurfaceDetail))
    .replace(/\{\{LIFE_WALL_DETAIL\}\}/g, String(lifeWallDetail))
    .replace(/\{\{LIFE_ATMOSPHERIC\}\}/g, String(lifeAtmospheric))
    .replace(/\{\{LIFE_ASYMMETRIC\}\}/g, String(lifeAsymmetric));

  return prompt;
}

/**
 * Build the full context prompt for a room and save it to a file.
 * This is used in a Claude Code workflow — you read the prompt file,
 * then work with Claude Code to produce the manifest JSON.
 *
 * @param {object} roomInput - Parsed room input data
 * @returns {{ promptPath: string, assetCount: number }}
 */
export async function buildRoomPrompt(roomInput) {
  const assetList = await getAssetList();
  const prompt = await buildPrompt(roomInput, assetList);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const promptPath = join(OUTPUT_DIR, `${roomInput.type}-prompt.md`);
  await writeFile(promptPath, prompt);

  const tier = roomInput.densityTier || 'moderate';
  const cfg = DENSITY_CONFIGS[tier];
  const area = roomInput.dimensions.width * roomInput.dimensions.depth;
  console.log(`Prompt built for ${roomInput.type}`);
  console.log(`  Assets available: ${assetList.length}`);
  console.log(`  Density tier: ${tier} (${cfg.propsPerSqM} props/sq m)`);
  console.log(`  Room area: ${area} sq m → target ~${Math.round(area * cfg.propsPerSqM)} instances`);
  console.log(`  Tri budget: ${cfg.triBudgetK}K`);
  console.log(`  Prompt saved to: ${promptPath}`);
  console.log(`\nWorkflow:`);
  console.log(`  1. Read the prompt: ${promptPath}`);
  console.log(`  2. Ask Claude Code to generate the manifest JSON`);
  console.log(`  3. Save result to: scripts/room-needs/output/${roomInput.type}-manifest.json`);
  console.log(`  4. Run: node scripts/room-needs/engine.mjs pipeline scripts/room-needs/data/${roomInput.type}-input.json`);

  return { promptPath, assetCount: assetList.length };
}

/**
 * Validate a manifest JSON string or object against the Zod schema.
 * Returns the validated manifest or throws on failure.
 */
export function validateManifestJSON(jsonInput) {
  const parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
  return FurnishingManifestSchema.parse(parsed);
}

/**
 * Save a validated manifest to the output directory.
 */
export async function saveManifest(manifest, roomName) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = join(OUTPUT_DIR, `${roomName}-manifest.json`);
  await writeFile(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest saved to ${outputPath}`);
  return outputPath;
}

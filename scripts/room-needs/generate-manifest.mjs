/**
 * Stage 1: Manifest Generator
 *
 * Calls Claude API with room description + existing asset list + schema
 * to produce a structured FurnishingManifest JSON.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { FurnishingManifestSchema } from './schemas/manifest.mjs';

const PROJECT_ROOT = process.cwd();
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
 * Build the system prompt from template + dynamic data.
 */
async function buildSystemPrompt(roomInput, assetList) {
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

  // Apply template substitutions
  let prompt = template
    .replace('{{ROOM_INPUT}}', roomSummary)
    .replace('{{HALF_WIDTH}}', String(halfWidth))
    .replace(/\{\{HALF_WIDTH\}\}/g, String(halfWidth))
    .replace('{{HALF_DEPTH}}', String(halfDepth))
    .replace(/\{\{HALF_DEPTH\}\}/g, String(halfDepth))
    .replace('{{HEIGHT}}', String(height))
    .replace(/\{\{HEIGHT\}\}/g, String(height))
    .replace('{{ASSET_LIST}}', assetList.join('\n'))
    .replace('{{MATERIALS}}', materialList)
    .replace('{{EXAMPLE_SECTION}}', exampleSection);

  return prompt;
}

/**
 * Load features for the room (from features file or manifest features).
 */
async function loadFeatures(roomInput) {
  if (roomInput.featuresFile) {
    try {
      const featuresPath = join(PROJECT_ROOT, roomInput.featuresFile);
      const raw = await readFile(featuresPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      // Fall through to empty features
    }
  }
  return {};
}

/**
 * Generate a furnishing manifest using Claude API.
 *
 * @param {object} roomInput - Parsed room input data
 * @returns {object} Validated FurnishingManifest
 */
export async function generateManifest(roomInput) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Set it in your environment:\n' +
      '  export ANTHROPIC_API_KEY=sk-ant-...\n' +
      '  set ANTHROPIC_API_KEY=sk-ant-...  (Windows cmd)\n' +
      '  $env:ANTHROPIC_API_KEY="sk-ant-..."  (PowerShell)',
    );
  }

  const client = new Anthropic();
  const assetList = await getAssetList();
  const systemPrompt = await buildSystemPrompt(roomInput, assetList);

  const userMessage = `Generate the complete furnishing manifest for this ${roomInput.type} room. Return ONLY valid JSON — no markdown fences, no commentary.`;

  console.log(`Calling Claude API for ${roomInput.type} manifest...`);
  console.log(`  Assets available: ${assetList.length}`);

  let lastError = null;

  // Up to 2 attempts: initial + 1 retry with error context
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = [{ role: 'user', content: userMessage }];

    if (attempt > 0 && lastError) {
      messages.push({
        role: 'assistant',
        content: 'I apologize for the invalid JSON. Let me fix the errors and try again.',
      });
      messages.push({
        role: 'user',
        content: `The previous response failed validation:\n${lastError}\n\nPlease fix ALL errors and return valid JSON only.`,
      });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 16000,
      system: systemPrompt,
      messages,
    });

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Extract JSON from response (handle markdown fences)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const manifest = FurnishingManifestSchema.parse(parsed);

      // Merge in loaded features if manifest doesn't have them
      if (!manifest.features || Object.keys(manifest.features).length === 0) {
        const features = await loadFeatures(roomInput);
        manifest.features = features;
      }

      console.log(`  Manifest generated successfully (attempt ${attempt + 1})`);
      console.log(`  Architecture: ${manifest.layers.architecture.length} items`);
      console.log(`  Furnishing: ${manifest.layers.essentialFurnishing.length} items`);
      console.log(`  Functional: ${manifest.layers.functionalObjects.length} items`);
      console.log(`  Life layer: ${manifest.layers.lifeLayer.length} items`);
      console.log(`  Lights: ${manifest.layers.atmosphere.lights.length}`);

      // Track token usage
      if (response.usage) {
        console.log(`  Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);
      }

      return manifest;
    } catch (err) {
      lastError = err.message;
      console.warn(`  Attempt ${attempt + 1} failed: ${err.message.slice(0, 200)}`);
      if (attempt === 1) {
        throw new Error(`Manifest generation failed after 2 attempts:\n${err.message}`);
      }
    }
  }
}

/**
 * Save manifest to output directory.
 */
export async function saveManifest(manifest, roomName) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = join(OUTPUT_DIR, `${roomName}-manifest.json`);
  await writeFile(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest saved to ${outputPath}`);
  return outputPath;
}

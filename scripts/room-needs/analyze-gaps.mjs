/**
 * Stage 2: Gap Analyzer
 *
 * Diffs a FurnishingManifest against existing GLB assets.
 * Reports what exists, what's missing, estimated tri budget, and build priority.
 */
import { readdir } from 'fs/promises';
import { join, basename } from 'path';

const PROJECT_ROOT = process.cwd();
const IRONRATH_PROPS_DIR = join(PROJECT_ROOT, 'public/assets/models/props/ironrath');
const GENERIC_PROPS_DIR = join(PROJECT_ROOT, 'public/assets/models/props');

// Tri budget estimates by category
const TRI_ESTIMATES = {
  'structural': 2500,
  'furniture': 1200,
  'lighting-fixture': 1200,
  'tableware': 300,
  'wall-decor': 600,
  'floor-cover': 300,
  'surface-detail': 200,
};
const DEFAULT_TRI = 600;
const ROOM_TRI_BUDGET = 75000;

/**
 * Scan disk for all existing GLB asset names (without extension).
 */
async function getExistingAssets() {
  const assets = new Set();

  try {
    const ironrathFiles = await readdir(IRONRATH_PROPS_DIR);
    for (const f of ironrathFiles) {
      if (f.endsWith('.glb')) assets.add(basename(f, '.glb'));
    }
  } catch { /* dir may not exist */ }

  try {
    const genericFiles = await readdir(GENERIC_PROPS_DIR);
    for (const f of genericFiles) {
      if (f.endsWith('.glb')) assets.add(basename(f, '.glb'));
    }
  } catch { /* dir may not exist */ }

  return assets;
}

/**
 * Count total instances for a FurnishingItem based on placement strategy.
 */
function countInstances(item) {
  const p = item.placement;
  if (p.positions) return p.positions.length;
  if (p.count) return p.count;
  if (p.density) return Math.max(1, Math.round(p.density * 3)); // rough estimate
  return 1;
}

/**
 * Analyze a manifest against existing assets.
 */
export async function analyzeGaps(manifest) {
  const existingAssets = await getExistingAssets();

  const layerNames = ['architecture', 'essentialFurnishing', 'functionalObjects', 'lifeLayer'];
  const layerLabels = {
    architecture: 'Layer 1 — Architecture',
    essentialFurnishing: 'Layer 2 — Essential Furnishing',
    functionalObjects: 'Layer 3 — Functional Objects',
    lifeLayer: 'Layer 4 — Life Layer',
  };

  let totalExists = 0;
  let totalGaps = 0;
  let totalTris = 0;
  const gaps = [];
  const layerReports = [];

  for (const layerName of layerNames) {
    const items = manifest.layers[layerName] || [];
    let layerExists = 0;
    let layerGaps = 0;
    const layerItems = [];

    for (const item of items) {
      const exists = existingAssets.has(item.name);
      const instances = countInstances(item);
      const trisPerItem = TRI_ESTIMATES[item.category] || DEFAULT_TRI;
      const totalItemTris = trisPerItem * instances;
      totalTris += totalItemTris;

      if (exists) {
        layerExists++;
        totalExists++;
        layerItems.push({
          status: 'OK',
          name: item.name,
          instances,
          tris: totalItemTris,
        });
      } else {
        layerGaps++;
        totalGaps++;
        layerItems.push({
          status: 'GAP',
          name: item.name,
          description: item.description,
          instances,
          tris: totalItemTris,
          category: item.category,
          material: item.material,
        });
        gaps.push({
          name: item.name,
          layer: layerName,
          description: item.description,
          category: item.category,
          material: item.material,
          instances,
          tris: trisPerItem,
        });
      }
    }

    layerReports.push({
      label: layerLabels[layerName],
      exists: layerExists,
      gaps: layerGaps,
      items: layerItems,
    });
  }

  // Sort gaps by priority: architecture first, then by estimated visual impact
  const layerPriority = { architecture: 0, essentialFurnishing: 1, functionalObjects: 2, lifeLayer: 3 };
  gaps.sort((a, b) => {
    const lp = (layerPriority[a.layer] ?? 9) - (layerPriority[b.layer] ?? 9);
    if (lp !== 0) return lp;
    return b.instances - a.instances; // more instances = higher priority
  });

  return {
    roomName: manifest.room.type,
    totalItems: totalExists + totalGaps,
    totalExists,
    totalGaps,
    estimatedTris: totalTris,
    triBudget: ROOM_TRI_BUDGET,
    overBudget: totalTris > ROOM_TRI_BUDGET,
    layerReports,
    gaps,
    buildPriority: gaps.map((g, i) => ({
      rank: i + 1,
      name: g.name,
      layer: g.layer,
      description: g.description,
      material: g.material,
    })),
  };
}

/**
 * Format gap report as human-readable text.
 */
export function formatGapReport(report) {
  const lines = [];
  lines.push(`=== FURNISHING GAP ANALYSIS: ${report.roomName} ===`);
  lines.push('');
  lines.push(`EXISTING ASSETS MATCHED: ${report.totalExists}/${report.totalItems}`);
  lines.push(`NEW ASSETS NEEDED: ${report.totalGaps}`);
  lines.push('');
  const pct = Math.round((report.estimatedTris / report.triBudget) * 100);
  const warn = report.overBudget ? ' ⚠️ OVER BUDGET' : '';
  lines.push(`Estimated triangle budget: ${report.estimatedTris.toLocaleString()} / ${report.triBudget.toLocaleString()} (${pct}%)${warn}`);
  lines.push('');

  for (const layer of report.layerReports) {
    lines.push(`--- ${layer.label} (${layer.exists} exist, ${layer.gaps} gaps) ---`);
    for (const item of layer.items) {
      if (item.status === 'OK') {
        const inst = item.instances > 1 ? ` (x${item.instances})` : '';
        lines.push(`  [OK]  ${item.name}${inst}`);
      } else {
        const inst = item.instances > 1 ? ` (x${item.instances})` : '';
        lines.push(`  [GAP] ${item.name}${inst} — ${item.description} (~${item.tris} tris)`);
      }
    }
    lines.push('');
  }

  if (report.buildPriority.length > 0) {
    lines.push('BUILD PRIORITY (by layer importance × instance count):');
    for (const p of report.buildPriority.slice(0, 20)) {
      lines.push(`  ${p.rank}. ${p.name} (${p.layer}, material: ${p.material})`);
    }
  }

  return lines.join('\n');
}

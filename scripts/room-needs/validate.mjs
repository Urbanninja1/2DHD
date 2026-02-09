/**
 * Cross-cutting Validation
 *
 * Enforces lighting guardrails, bounds checks, and budget constraints
 * on a FurnishingManifest or resolved manifest.
 */

// Lighting guardrails (from docs/fixes/LIGHTING_BUG_PREVENTION.md)
const GUARDRAILS = {
  ambientIntensityMin: 0.45,
  pointIntensityMin: 2.0,
  pointDistanceMin: 10,
  maxLights: 11,
  vignetteDarknessMax: 0.55,
  brightnessMin: 0,
  triBudget: 75000,  // default, overridden by density tier
};

/** Density-aware tri budgets and targets */
const DENSITY_TRI_BUDGETS = {
  'sparse':       50000,
  'moderate':     75000,
  'dense':        150000,
  'aaa-showcase': 200000,
};

const DENSITY_PROPS_PER_SQM = {
  'sparse':       1.5,
  'moderate':     2.5,
  'dense':        5.0,
  'aaa-showcase': 8.0,
};

// Tri estimates by category
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

/**
 * Validate a manifest against all constraints.
 * @param {object} manifest
 * @param {object} roomDims - { width, depth, height }
 * @param {string} [densityTier='moderate'] - density tier for budget/target validation
 * Returns { valid, errors[], warnings[] }.
 */
export function validateManifest(manifest, roomDims, densityTier = 'moderate') {
  const errors = [];
  const warnings = [];
  const triBudget = DENSITY_TRI_BUDGETS[densityTier] || GUARDRAILS.triBudget;

  // --- Atmosphere validation ---
  const atm = manifest.layers.atmosphere;

  // Ambient light
  if (atm.ambientLight.intensity < GUARDRAILS.ambientIntensityMin) {
    errors.push(`Ambient intensity ${atm.ambientLight.intensity} below minimum ${GUARDRAILS.ambientIntensityMin}`);
  }

  // Light count
  const totalLights = atm.lights.length;
  if (totalLights > GUARDRAILS.maxLights) {
    errors.push(`${totalLights} lights exceeds maximum ${GUARDRAILS.maxLights}`);
  }

  // Individual lights
  for (let i = 0; i < atm.lights.length; i++) {
    const light = atm.lights[i];
    if (light.type === 'point') {
      if (light.intensity < GUARDRAILS.pointIntensityMin) {
        warnings.push(`Light[${i}] point intensity ${light.intensity} below ${GUARDRAILS.pointIntensityMin}`);
      }
      if (light.distance !== undefined && light.distance < GUARDRAILS.pointDistanceMin) {
        warnings.push(`Light[${i}] distance ${light.distance} below ${GUARDRAILS.pointDistanceMin}`);
      }
    }
  }

  // Post-processing
  if (atm.postProcess) {
    if (atm.postProcess.vignette?.darkness > GUARDRAILS.vignetteDarknessMax) {
      errors.push(`Vignette darkness ${atm.postProcess.vignette.darkness} above ${GUARDRAILS.vignetteDarknessMax}`);
    }
    if (atm.postProcess.colorGrading?.brightness < GUARDRAILS.brightnessMin) {
      errors.push(`Brightness ${atm.postProcess.colorGrading.brightness} below ${GUARDRAILS.brightnessMin}`);
    }
  }

  // --- Triangle budget ---
  let totalTris = 0;
  const layerNames = ['architecture', 'essentialFurnishing', 'functionalObjects', 'lifeLayer'];
  for (const layerName of layerNames) {
    const items = manifest.layers[layerName] || [];
    for (const item of items) {
      const count = item.resolvedPositions?.length
        || item.placement?.positions?.length
        || item.placement?.count
        || 1;
      const trisPerItem = TRI_ESTIMATES[item.category] || DEFAULT_TRI;
      totalTris += trisPerItem * count;
    }
  }

  if (totalTris > triBudget) {
    warnings.push(`Estimated ${totalTris.toLocaleString()} tris exceeds budget of ${triBudget.toLocaleString()} (${densityTier})`);
  }

  // --- Bounds validation (if roomDims provided) ---
  if (roomDims) {
    const halfW = roomDims.width / 2;
    const halfD = roomDims.depth / 2;

    for (const layerName of layerNames) {
      const items = manifest.layers[layerName] || [];
      for (const item of items) {
        const positions = item.resolvedPositions || [];
        for (const pos of positions) {
          if (Math.abs(pos.x) > halfW + 0.5) {
            warnings.push(`${item.name} at x=${pos.x} outside room width ±${halfW}`);
          }
          if (Math.abs(pos.z) > halfD + 0.5) {
            warnings.push(`${item.name} at z=${pos.z} outside room depth ±${halfD}`);
          }
          if (pos.y < -0.1 || pos.y > roomDims.height + 0.5) {
            warnings.push(`${item.name} at y=${pos.y} outside room height [0, ${roomDims.height}]`);
          }
        }
      }
    }
  }

  // --- Wall-decor at floor level check ---
  for (const layerName of layerNames) {
    const items = manifest.layers[layerName] || [];
    for (const item of items) {
      if (item.category === 'wall-decor') {
        const positions = item.resolvedPositions || item.placement?.positions || [];
        for (const pos of positions) {
          if (pos.y < 1.0) {
            warnings.push(`${item.name} is wall-decor but at y=${pos.y} (floor level) — should be y=2.5-5.0`);
          }
        }
      }
    }
  }

  // --- Life layer minimum ---
  const lifeCount = (manifest.layers.lifeLayer || []).length;
  if (lifeCount < 5) {
    warnings.push(`Life layer has only ${lifeCount} items (minimum 5 recommended)`);
  }

  // --- Density validation ---
  let totalInstances = 0;
  for (const layerName of layerNames) {
    const items = manifest.layers[layerName] || [];
    for (const item of items) {
      totalInstances += item.resolvedPositions?.length
        || item.placement?.positions?.length
        || item.placement?.count
        || 1;
    }
  }

  const propsPerSqM = roomDims
    ? totalInstances / (roomDims.width * roomDims.depth)
    : 0;
  const targetPpsm = DENSITY_PROPS_PER_SQM[densityTier] || 2.5;

  if (roomDims && propsPerSqM < targetPpsm * 0.5) {
    warnings.push(
      `Density ${propsPerSqM.toFixed(2)} props/sq m is well below ` +
      `${densityTier} target of ${targetPpsm} props/sq m (${totalInstances} instances in ` +
      `${(roomDims.width * roomDims.depth).toFixed(0)} sq m)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalTris,
      triBudget,
      lightCount: totalLights,
      lifeLayerItems: lifeCount,
      totalInstances,
      propsPerSqM: roomDims ? propsPerSqM : null,
      densityTier,
    },
  };
}

/**
 * Format validation results as human-readable text.
 */
export function formatValidation(result) {
  const lines = [];

  if (result.valid) {
    lines.push('VALIDATION: PASSED');
  } else {
    lines.push('VALIDATION: FAILED');
  }

  lines.push(`  Density tier: ${result.stats.densityTier || 'moderate'}`);
  lines.push(`  Estimated tris: ${result.stats.totalTris.toLocaleString()} / ${(result.stats.triBudget || GUARDRAILS.triBudget).toLocaleString()}`);
  lines.push(`  Lights: ${result.stats.lightCount} / ${GUARDRAILS.maxLights}`);
  lines.push(`  Life layer items: ${result.stats.lifeLayerItems}`);
  if (result.stats.totalInstances != null) {
    lines.push(`  Total instances: ${result.stats.totalInstances}`);
  }
  if (result.stats.propsPerSqM != null) {
    lines.push(`  Density: ${result.stats.propsPerSqM.toFixed(2)} props/sq m`);
  }

  if (result.errors.length > 0) {
    lines.push('\nERRORS:');
    for (const e of result.errors) {
      lines.push(`  ✗ ${e}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('\nWARNINGS:');
    for (const w of result.warnings) {
      lines.push(`  ⚠ ${w}`);
    }
  }

  return lines.join('\n');
}

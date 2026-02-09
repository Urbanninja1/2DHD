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
  triBudget: 75000,
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
 * Returns { valid, errors[], warnings[] }.
 */
export function validateManifest(manifest, roomDims) {
  const errors = [];
  const warnings = [];

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

  if (totalTris > GUARDRAILS.triBudget) {
    warnings.push(`Estimated ${totalTris.toLocaleString()} tris exceeds budget of ${GUARDRAILS.triBudget.toLocaleString()}`);
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

  // --- Life layer minimum ---
  const lifeCount = (manifest.layers.lifeLayer || []).length;
  if (lifeCount < 5) {
    warnings.push(`Life layer has only ${lifeCount} items (minimum 5 recommended)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalTris,
      lightCount: totalLights,
      lifeLayerItems: lifeCount,
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

  lines.push(`  Estimated tris: ${result.stats.totalTris.toLocaleString()} / ${GUARDRAILS.triBudget.toLocaleString()}`);
  lines.push(`  Lights: ${result.stats.lightCount} / ${GUARDRAILS.maxLights}`);
  lines.push(`  Life layer items: ${result.stats.lifeLayerItems}`);

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

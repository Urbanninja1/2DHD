/**
 * Stage 4: RoomData TypeScript Writer
 *
 * Transforms a resolved FurnishingManifest into a valid TypeScript
 * RoomData file following the existing Great Hall pattern.
 */
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

const PROJECT_ROOT = process.cwd();

// Section ordering for props (matches Great Hall pattern)
const CATEGORY_ORDER = [
  'structural',
  'furniture',
  'lighting-fixture',
  'wall-decor',
  'floor-cover',
  'tableware',
  'surface-detail',
];

const SECTION_LABELS = {
  'structural': 'STRUCTURAL',
  'furniture': 'FURNITURE',
  'lighting-fixture': 'LIGHTING FIXTURES',
  'wall-decor': 'WALL DECOR',
  'floor-cover': 'FLOOR COVERING',
  'tableware': 'TABLEWARE & FUNCTIONAL',
  'surface-detail': 'SURFACE DETAIL',
};

/**
 * Convert a decimal color integer to hex literal string.
 * e.g., 16764006 → '0xFFCC66'
 */
function toHex(n) {
  return '0x' + n.toString(16).toUpperCase().padStart(6, '0');
}

/**
 * Format a position object as TypeScript.
 */
function formatPos(pos) {
  const parts = [`x: ${pos.x}, y: ${pos.y}, z: ${pos.z}`];
  if (pos.rotationY !== undefined && pos.rotationY !== 0) {
    parts.push(`rotationY: ${roundNum(pos.rotationY)}`);
  }
  return `{ ${parts.join(', ')} }`;
}

/**
 * Round a number to reasonable precision.
 */
function roundNum(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

/**
 * Group resolved items by asset name and category, collecting all positions.
 */
function groupProps(resolvedManifest, castle) {
  const groups = new Map(); // name → { category, scale, positions[], materialCategory? }

  const layerNames = ['architecture', 'essentialFurnishing', 'functionalObjects', 'lifeLayer'];
  for (const layerName of layerNames) {
    const items = resolvedManifest.layers[layerName] || [];
    for (const item of items) {
      if (!item.resolvedPositions || item.resolvedPositions.length === 0) continue;

      const key = item.name;
      if (!groups.has(key)) {
        groups.set(key, {
          name: item.name,
          category: item.category,
          materialCategory: item.materialCategory,
          scale: item.scale,
          description: item.description,
          positions: [],
        });
      }
      const group = groups.get(key);
      group.positions.push(...item.resolvedPositions);
    }
  }

  return groups;
}

/**
 * Extract compound lights from resolved manifest items.
 * Returns light definitions matching the LightDef interface.
 */
function extractCompoundLights(resolvedManifest) {
  const lights = [];
  const layerNames = ['architecture', 'essentialFurnishing', 'functionalObjects', 'lifeLayer'];

  for (const layerName of layerNames) {
    const items = resolvedManifest.layers[layerName] || [];
    for (const item of items) {
      if (!item.compound?.light || !item.resolvedPositions) continue;
      const lightDef = item.compound.light;

      for (const pos of item.resolvedPositions) {
        lights.push({
          type: 'point',
          position: { x: pos.x, y: pos.y, z: pos.z },
          color: lightDef.color,
          intensity: Math.max(lightDef.intensity, 2.0), // guardrail
          distance: Math.max(lightDef.distance, 10),     // guardrail
          decay: lightDef.decay ?? 1,
          flicker: lightDef.flicker,
          _source: item.name,
        });
      }
    }
  }

  return lights;
}

/**
 * Extract compound particles from resolved manifest items.
 */
function extractCompoundParticles(resolvedManifest) {
  const particles = [];
  const layerNames = ['architecture', 'essentialFurnishing', 'functionalObjects', 'lifeLayer'];

  for (const layerName of layerNames) {
    const items = resolvedManifest.layers[layerName] || [];
    for (const item of items) {
      if (!item.compound?.particles || !item.resolvedPositions) continue;
      const particleDef = item.compound.particles;

      for (const pos of item.resolvedPositions) {
        particles.push({
          type: particleDef.type,
          position: { x: pos.x, y: pos.y, z: pos.z },
          count: particleDef.count,
          _source: item.name,
        });
      }
    }
  }

  return particles;
}

/**
 * Convert atmosphere particles from manifest format to RoomData format.
 * Manifest uses center+size, RoomData uses min/max.
 */
function convertAtmosphereParticles(atmosphereParticles) {
  return atmosphereParticles.map(p => {
    if (p.region) {
      // Convert center+size to min/max (SpawnRegion format)
      const c = p.region.center;
      const s = p.region.size;
      return {
        type: p.type,
        region: {
          minX: c.x - s.x / 2,
          maxX: c.x + s.x / 2,
          minY: c.y - s.y / 2,
          maxY: c.y + s.y / 2,
          minZ: c.z - s.z / 2,
          maxZ: c.z + s.z / 2,
        },
        count: p.count,
      };
    }
    // Point-based particles (embers, smoke)
    return {
      type: p.type,
      position: p.position,
      count: p.count,
    };
  });
}

/**
 * Validate and clamp lighting values to guardrails.
 */
function validateLighting(atmosphere, warnings) {
  const a = { ...atmosphere };

  // Ambient light guardrails
  if (a.ambientLight.intensity < 0.45) {
    warnings.push(`Ambient intensity ${a.ambientLight.intensity} → clamped to 0.45`);
    a.ambientLight = { ...a.ambientLight, intensity: 0.45 };
  }

  // Light count cap
  if (a.lights.length > 11) {
    warnings.push(`${a.lights.length} lights → trimmed to 11`);
    a.lights = a.lights.slice(0, 11);
  }

  // Point light guardrails
  a.lights = a.lights.map(l => {
    const fixed = { ...l };
    if (l.type === 'point') {
      if (l.intensity < 2.0) {
        warnings.push(`Point light intensity ${l.intensity} → clamped to 2.0`);
        fixed.intensity = 2.0;
      }
      if (l.distance !== undefined && l.distance < 10) {
        warnings.push(`Point light distance ${l.distance} → clamped to 10`);
        fixed.distance = 10;
      }
    }
    return fixed;
  });

  // PostProcess guardrails
  if (a.postProcess) {
    if (a.postProcess.vignette && a.postProcess.vignette.darkness > 0.55) {
      warnings.push(`Vignette darkness ${a.postProcess.vignette.darkness} → clamped to 0.55`);
      a.postProcess = {
        ...a.postProcess,
        vignette: { darkness: 0.55 },
      };
    }
    if (a.postProcess.colorGrading && a.postProcess.colorGrading.brightness < 0) {
      warnings.push(`Brightness ${a.postProcess.colorGrading.brightness} → clamped to 0`);
      a.postProcess = {
        ...a.postProcess,
        colorGrading: { ...a.postProcess.colorGrading, brightness: 0 },
      };
    }
  }

  return a;
}

/**
 * Generate the TypeScript source code for a RoomData file.
 */
function generateTypeScript(resolvedManifest, roomInput, warnings) {
  const castle = roomInput.castle || 'ironrath';
  const propGroups = groupProps(resolvedManifest, castle);
  const compoundLights = extractCompoundLights(resolvedManifest);
  const compoundParticles = extractCompoundParticles(resolvedManifest);
  const atmosphere = validateLighting(resolvedManifest.layers.atmosphere, warnings);

  // Combine atmosphere lights + compound lights, respecting the 11-light cap
  const atmosphereLights = atmosphere.lights || [];
  const allLights = [...atmosphereLights, ...compoundLights];
  if (allLights.length > 11) {
    warnings.push(`Total lights ${allLights.length} exceeds 11 — trimming compound lights`);
  }
  const finalLights = allLights.slice(0, 11);

  // Combine atmosphere particles + compound particles
  const atmosphereParticles = convertAtmosphereParticles(atmosphere.particles || []);
  const extraParticles = (roomInput.extraParticles || []).map(p => {
    // Convert atmosphere-style regions to flat format
    if (p.region && p.region.center) {
      const c = p.region.center, s = p.region.size;
      return { ...p, region: { minX: c.x - s.x/2, maxX: c.x + s.x/2, minY: c.y - s.y/2, maxY: c.y + s.y/2, minZ: c.z - s.z/2, maxZ: c.z + s.z/2 } };
    }
    return p;
  });
  const allParticles = [...atmosphereParticles, ...compoundParticles, ...extraParticles];

  // Build props sorted by category
  const sortedGroups = [...propGroups.values()].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Group by category for section comments
  const byCategory = new Map();
  for (const group of sortedGroups) {
    const cat = group.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(group);
  }

  // Generate TypeScript
  const lines = [];

  // Imports
  lines.push(`import { RoomId } from '../../../ecs/components/singletons.js';`);
  lines.push(`import type { RoomData } from '../types.js';`);
  lines.push('');

  // Path helper
  lines.push(`/** Shorthand for ${castle} prop model path */`);
  lines.push(`const P = (name: string) => \`assets/models/props/${castle}/\${name}.glb\`;`);
  lines.push('');

  // Room data object
  const roomId = roomInput.id;
  const varName = toCamelCase(roomInput.type);

  lines.push(`/**`);
  lines.push(` * ${roomInput.castle ? capitalize(roomInput.castle) + ' Castle' : 'Room'} — ${roomInput.name}`);
  lines.push(` *`);
  lines.push(` * Generated by Room Needs Engine.`);
  const totalInstances = sortedGroups.reduce((sum, g) => sum + g.positions.length, 0);
  lines.push(` * ${totalInstances} prop instances, ${finalLights.length} lights, ${allParticles.length} particle emitters.`);
  lines.push(` */`);
  lines.push(`const ${varName}: RoomData = {`);
  lines.push(`  id: RoomId.${roomId},`);
  lines.push(`  name: '${roomInput.name}',`);
  lines.push(`  dimensions: { width: ${roomInput.dimensions.width}, depth: ${roomInput.dimensions.depth}, height: ${roomInput.dimensions.height} },`);
  lines.push(`  mood: '${resolvedManifest.room.mood}',`);
  lines.push('');

  // Textures
  if (roomInput.floorTexture) {
    lines.push(`  floorTexture: { basePath: '${roomInput.floorTexture}' },`);
  }
  if (roomInput.wallTexture) {
    lines.push(`  wallTexture: { basePath: '${roomInput.wallTexture}' },`);
  }
  if (roomInput.ceilingTexture) {
    lines.push(`  ceilingTexture: { basePath: '${roomInput.ceilingTexture}' },`);
  }
  if (roomInput.floorTexture || roomInput.wallTexture || roomInput.ceilingTexture) {
    lines.push('');
  }

  // Fallback colors (when PBR textures aren't loaded)
  if (roomInput.floorColor) {
    lines.push(`  floorColor: ${roomInput.floorColor},`);
  }
  if (roomInput.wallColor) {
    lines.push(`  wallColor: ${roomInput.wallColor},`);
  }
  if (roomInput.ceilingColor) {
    lines.push(`  ceilingColor: ${roomInput.ceilingColor},`);
  }
  if (roomInput.floorColor || roomInput.wallColor || roomInput.ceilingColor) {
    lines.push('');
  }

  // Ambient light
  lines.push(`  ambientLight: { color: ${toHex(atmosphere.ambientLight.color)}, intensity: ${atmosphere.ambientLight.intensity} },`);
  lines.push('');

  // Lights
  lines.push(`  lights: [`);
  for (const light of finalLights) {
    const parts = [];
    parts.push(`type: '${light.type}'`);
    parts.push(`position: { x: ${light.position.x}, y: ${light.position.y}, z: ${light.position.z} }`);
    parts.push(`color: ${toHex(light.color)}`);
    parts.push(`intensity: ${light.intensity}`);
    if (light.castShadow) parts.push(`castShadow: true`);
    if (light.distance !== undefined) parts.push(`distance: ${light.distance}`);
    if (light.decay !== undefined) parts.push(`decay: ${light.decay}`);
    if (light.flicker) parts.push(`flicker: true`);
    const comment = light._source ? ` // ${light._source}` : '';
    lines.push(`    { ${parts.join(', ')} },${comment}`);
  }
  lines.push(`  ],`);
  lines.push('');

  // Doors
  lines.push(`  doors: [`);
  if (roomInput.doors) {
    for (const door of roomInput.doors) {
      lines.push(`    {`);
      lines.push(`      position: { x: ${door.position.x}, y: ${door.position.y}, z: ${door.position.z} },`);
      lines.push(`      halfExtents: { x: ${door.halfExtents.x}, z: ${door.halfExtents.z} },`);
      lines.push(`      targetRoomId: RoomId.${roomId}, // placeholder — update with actual target`);
      lines.push(`      spawnPoint: { x: 0, y: 0, z: 0 },`);
      lines.push(`      wall: '${door.wall}',`);
      lines.push(`    },`);
    }
  }
  lines.push(`  ],`);
  lines.push('');

  // NPCs
  if (roomInput.npcs && roomInput.npcs.length > 0) {
    lines.push(`  npcs: [`);
    for (const npc of roomInput.npcs) {
      lines.push(`    { label: '${npc.label}', spriteColor: '${npc.spriteColor}', spritePath: '${npc.spritePath}', position: { x: ${npc.position.x}, y: ${npc.position.y}, z: ${npc.position.z} } },`);
    }
    lines.push(`  ],`);
  } else {
    lines.push(`  npcs: [],`);
  }
  lines.push('');

  // Particles
  lines.push(`  particles: [`);
  for (const p of allParticles) {
    const parts = [`type: '${p.type}'`];
    if (p.region) {
      const r = p.region;
      parts.push(`region: { minX: ${r.minX}, maxX: ${r.maxX}, minY: ${r.minY}, maxY: ${r.maxY}, minZ: ${r.minZ}, maxZ: ${r.maxZ} }`);
    } else if (p.position) {
      parts.push(`position: { x: ${p.position.x}, y: ${p.position.y}, z: ${p.position.z} }`);
    }
    parts.push(`count: ${p.count}`);
    if (p.lightDirection) {
      parts.push(`lightDirection: { x: ${p.lightDirection.x}, y: ${p.lightDirection.y}, z: ${p.lightDirection.z} }`);
    }
    if (p.driftDirection) {
      parts.push(`driftDirection: { x: ${p.driftDirection.x}, y: ${p.driftDirection.y}, z: ${p.driftDirection.z} }`);
    }
    if (p.spread) {
      parts.push(`spread: ${p.spread}`);
    }
    if (p.region || p.position) {
      const comment = p._source ? ` // ${p._source}` : '';
      lines.push(`    { ${parts.join(', ')} },${comment}`);
    }
  }
  lines.push(`  ],`);
  lines.push('');

  // Props — grouped by category with section comments
  lines.push(`  props: [`);
  for (const [category, groups] of byCategory) {
    const label = SECTION_LABELS[category] || category.toUpperCase();
    lines.push(`    // ─── ${label} ${'─'.repeat(Math.max(1, 55 - label.length))}`);
    for (const group of groups) {
      const comment = group.description ? ` // ${truncate(group.description, 60)}` : '';
      const matOverride = group.materialCategory ? `, materialOverride: '${group.materialCategory}'` : '';
      if (group.positions.length === 1) {
        const pos = formatPos(group.positions[0]);
        lines.push(`    { type: 'model', modelPath: P('${group.name}'), positions: [${pos}], scale: ${group.scale}${matOverride} },${comment}`);
      } else {
        lines.push(`    {${comment}`);
        lines.push(`      type: 'model', modelPath: P('${group.name}'), scale: ${group.scale},${matOverride ? ` ${matOverride.slice(2)},` : ''}`);
        lines.push(`      positions: [`);
        // Format positions — multiple per line if compact enough
        const posStrings = group.positions.map(formatPos);
        if (posStrings.every(s => s.length < 45) && posStrings.length <= 8) {
          // Compact: 2-3 per line
          for (let i = 0; i < posStrings.length; i += 3) {
            const chunk = posStrings.slice(i, i + 3);
            lines.push(`        ${chunk.join(', ')},`);
          }
        } else {
          for (const ps of posStrings) {
            lines.push(`        ${ps},`);
          }
        }
        lines.push(`      ],`);
        lines.push(`    },`);
      }
    }
  }
  lines.push(`  ],`);
  lines.push('');

  // Parallax background
  if (roomInput.parallaxBackground && roomInput.parallaxBackground.length > 0) {
    lines.push(`  parallaxBackground: [`);
    for (const layer of roomInput.parallaxBackground) {
      lines.push(`    { texturePath: '${layer.texturePath}', depth: ${layer.depth}, scrollFactor: ${layer.scrollFactor}, height: ${layer.height}, yOffset: ${layer.yOffset} },`);
    }
    lines.push(`  ],`);
    lines.push('');
  }

  // Post-process overrides
  if (atmosphere.postProcess) {
    lines.push(`  postProcessOverrides: {`);
    const pp = atmosphere.postProcess;
    if (pp.bloom) {
      lines.push(`    bloom: { intensity: ${pp.bloom.intensity}, luminanceThreshold: ${pp.bloom.luminanceThreshold} },`);
    }
    if (pp.tiltShift) {
      lines.push(`    tiltShift: { focusArea: ${pp.tiltShift.focusArea}, feather: ${pp.tiltShift.feather} },`);
    }
    if (pp.vignette) {
      lines.push(`    vignette: { darkness: ${pp.vignette.darkness} },`);
    }
    if (pp.colorGrading) {
      const cg = pp.colorGrading;
      lines.push(`    colorGrading: { hue: ${cg.hue}, saturation: ${cg.saturation}, brightness: ${cg.brightness}, contrast: ${cg.contrast} },`);
    }
    if (pp.ssao) {
      lines.push(`    ssao: { aoRadius: ${pp.ssao.aoRadius}, intensity: ${pp.ssao.intensity}, distanceFalloff: ${pp.ssao.distanceFalloff} },`);
    }
    lines.push(`  },`);
    lines.push('');
  }

  // God rays
  if (atmosphere.godRays) {
    const gr = atmosphere.godRays;
    lines.push(`  godRays: { color: ${toHex(gr.color)}, density: ${gr.density}, maxDensity: ${gr.maxDensity} },`);
    lines.push('');
  }

  // Texture engine template
  if (roomInput.textureTemplate) {
    lines.push(`  textureTemplate: '${roomInput.textureTemplate}',`);
  }

  lines.push(`};`);
  lines.push('');
  lines.push(`export default ${varName};`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Write the resolved manifest as a TypeScript RoomData file.
 */
export async function writeRoomData(resolvedManifest, roomInput, outputPath) {
  const warnings = [];
  const tsSource = generateTypeScript(resolvedManifest, roomInput, warnings);

  if (warnings.length > 0) {
    console.log('\nLighting/validation warnings:');
    for (const w of warnings) {
      console.log(`  ⚠ ${w}`);
    }
  }

  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, tsSource);
  console.log(`\nRoomData written to ${outputPath}`);

  return { outputPath, warnings };
}

// --- Helpers ---

function toCamelCase(kebab) {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s, maxLen) {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}

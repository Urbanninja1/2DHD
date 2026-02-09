import * as THREE from 'three';
import { loadPBRTexture, type PBRTextureSet } from '../loaders/texture-loaders.js';
import { assetManager } from '../loaders/asset-manager.js';
import { injectSurfaceDetail, type SurfaceDetailConfig, type SurfaceDetailHandle } from './hd2d-surface/surface-injector.js';

/**
 * Prop PBR Material System
 *
 * Replaces toy-quality baked GLB textures with proper PBR materials.
 * Three tiers:
 *   Hero props  → dedicated PBR texture sets (512-1024px)
 *   Category props → shared surface PBR textures (already loaded for floors/walls)
 *   Micro props → correct PBR params only (no textures needed at camera distance)
 */

// --- Material Categories ---

export type PropMaterialCategory =
  | 'stone'
  | 'ironwood'
  | 'dark-wood'
  | 'iron'
  | 'fabric'
  | 'leather'
  | 'organic'
  | 'micro';

/** Category → existing PBR texture base path (reuses surface textures — zero additional VRAM) */
const CATEGORY_TEXTURE_MAP: Record<Exclude<PropMaterialCategory, 'micro'>, string> = {
  stone: 'assets/textures/stone/worn-stone',
  ironwood: 'assets/textures/wood/dark-wood-floor',
  'dark-wood': 'assets/textures/wood/wood-planks',
  iron: 'assets/textures/metal/dark-iron',
  fabric: 'assets/textures/fabric/green-fabric',
  leather: 'assets/textures/leather/leather-bound',
  organic: 'assets/textures/stone/mossy-stone',
};

/** PBR parameter defaults per category — physically correct values */
const CATEGORY_PBR_DEFAULTS: Record<PropMaterialCategory, { roughness: number; metalness: number; color?: number }> = {
  stone: { roughness: 0.85, metalness: 0.0 },
  ironwood: { roughness: 0.7, metalness: 0.0, color: 0x3a2a1a },
  'dark-wood': { roughness: 0.75, metalness: 0.0 },
  iron: { roughness: 0.5, metalness: 0.8 },
  fabric: { roughness: 0.9, metalness: 0.0 },
  leather: { roughness: 0.6, metalness: 0.0 },
  organic: { roughness: 0.95, metalness: 0.0 },
  micro: { roughness: 0.8, metalness: 0.0 },
};

// --- Prop → Category Mapping ---

const PROP_CATEGORY_MAP: Record<string, PropMaterialCategory> = {
  // Structural stone
  'stone-hearth': 'stone',
  'raised-dais': 'stone',
  'stone-arch': 'stone',
  'stone-pilaster': 'stone',
  'corbel-bracket': 'stone',
  'stone-window-frame': 'stone',
  'door-frame': 'stone',
  'floor-crack': 'stone',
  'hearth-scorch': 'stone',
  'worn-path': 'stone',

  // Ironwood
  'ironwood-column': 'ironwood',
  'ironwood-throne': 'ironwood',

  // Dark wood furniture
  'long-table': 'dark-wood',
  'bench': 'dark-wood',
  'chair': 'dark-wood',
  'high-seat': 'dark-wood',
  'stool': 'dark-wood',
  'sideboard': 'dark-wood',
  'wooden-chest': 'dark-wood',
  'wooden-chest-large': 'dark-wood',
  'weapon-rack': 'dark-wood',
  'plate': 'dark-wood',
  'goblet': 'dark-wood',
  'wine-jug': 'dark-wood',
  'food-platter': 'dark-wood',

  // Roof/ceiling wood
  'roof-beam': 'ironwood',
  'roof-joist': 'ironwood',
  'rafter-set': 'ironwood',

  // Iron/metal
  'iron-chandelier': 'iron',
  'iron-brazier': 'iron',
  'iron-torch-holder': 'iron',
  'iron-candle-tree': 'iron',
  'wall-sconce': 'iron',
  'candelabra': 'iron',

  // Fabric
  'banner': 'fabric',
  'tapestry': 'fabric',
  'fur-rug': 'fabric',

  // Decorative
  'dire-wolf-shield': 'iron',
  'heraldic-crest': 'iron',
  'mounted-antlers': 'organic',
  'hound-sleeping': 'organic',
  'wall-moss': 'organic',
  'rushes': 'organic',

  // Micro (no texture replacement — correct PBR params only)
  'wax-drip': 'micro',
  'bone-scrap': 'micro',
  'cobweb': 'micro',
  'ale-puddle': 'micro',
  'table-stain': 'micro',
  'candle-stub': 'micro',
};

// --- Hero Props ---

const HERO_PROPS: Set<string> = new Set([
  'ironwood-throne', 'long-table', 'stone-hearth', 'iron-chandelier',
  'ironwood-column', 'raised-dais', 'weapon-rack', 'wooden-chest-large',
  'high-seat', 'stone-arch',
]);

// --- Fire Source Props (get emissive glow) ---

const FIRE_SOURCE_PROPS: Set<string> = new Set([
  'iron-brazier', 'candle-stub', 'iron-candle-tree', 'candelabra',
]);

// --- Public API ---

/** Extract prop name from model path */
function propNameFromPath(modelPath: string): string {
  return modelPath.split('/').pop()?.replace('.glb', '') ?? '';
}

/** Look up the material category for a prop by its model path */
export function getPropCategory(modelPath: string): PropMaterialCategory {
  const name = propNameFromPath(modelPath);
  return PROP_CATEGORY_MAP[name] ?? 'micro';
}

/** Check if a prop is a hero prop (gets dedicated textures) */
export function isHeroProp(modelPath: string): boolean {
  return HERO_PROPS.has(propNameFromPath(modelPath));
}

/**
 * Load the shared PBR texture set for a material category.
 * Returns null for 'micro' category (no textures needed).
 * Uses assetManager for ref-counted caching — same texture set shared across all props of same category.
 */
export async function loadCategoryPBR(category: PropMaterialCategory): Promise<PBRTextureSet | null> {
  if (category === 'micro') return null;
  const basePath = CATEGORY_TEXTURE_MAP[category];
  return assetManager.loadPBRSetAsync(`prop-pbr-${category}`, () =>
    loadPBRTexture(basePath, `prop-${category}`),
  );
}

/**
 * Load a dedicated PBR texture set for a hero prop.
 * Falls back to null if textures don't exist (caller should fall back to category).
 */
export async function loadHeroPBR(modelPath: string): Promise<PBRTextureSet | null> {
  const name = propNameFromPath(modelPath);
  const basePath = `assets/textures/props/${name}`;
  try {
    return await assetManager.loadPBRSetAsync(`hero-pbr-${name}`, () =>
      loadPBRTexture(basePath, `hero-${name}`),
    );
  } catch {
    return null;
  }
}

/**
 * Apply proper PBR material to a loaded prop mesh.
 * Replaces the baked GLB material with a high-quality PBR material
 * using shared texture sets from the surface material library.
 */
export function applyPropMaterial(
  mesh: THREE.Mesh,
  category: PropMaterialCategory,
  pbrSet: PBRTextureSet | null,
  modelPath: string,
): void {
  const defaults = CATEGORY_PBR_DEFAULTS[category];
  const name = propNameFromPath(modelPath);

  if (!pbrSet) {
    // Micro prop: correct PBR params, keep existing material
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.roughness = defaults.roughness;
      mesh.material.metalness = defaults.metalness;
      mesh.material.needsUpdate = true;
    }
    return;
  }

  // Replace with proper PBR material
  const mat = new THREE.MeshStandardMaterial({
    map: pbrSet.diffuse,
    normalMap: pbrSet.normal ?? undefined,
    roughnessMap: pbrSet.roughness ?? undefined,
    aoMap: pbrSet.ao ?? undefined,
    roughness: pbrSet.roughness ? 1.0 : defaults.roughness,
    metalness: defaults.metalness,
    color: defaults.color ?? 0xffffff,
  });

  // Fire source props get warm emissive glow
  if (FIRE_SOURCE_PROPS.has(name)) {
    mat.emissive = new THREE.Color(0xFF6B35);
    mat.emissiveIntensity = 0.3;
  }

  // Dispose old baked material
  const old = mesh.material;
  if (old instanceof THREE.Material) {
    old.dispose();
  }

  mesh.material = mat;
}

/**
 * Apply surface detail (triplanar detail normal + grunge overlay) to a prop mesh.
 * Uses prop-tuned parameters: higher detail frequency, lower intensity, no stochastic tiling.
 * Skips micro props (too small to benefit from detail injection).
 */
export function applyPropSurfaceDetail(
  mesh: THREE.Mesh,
  category: PropMaterialCategory,
  surfaceConfig: SurfaceDetailConfig | null,
): SurfaceDetailHandle | null {
  if (category === 'micro' || !surfaceConfig) return null;
  if (!(mesh.material instanceof THREE.MeshStandardMaterial)) return null;

  return injectSurfaceDetail(mesh.material, {
    ...surfaceConfig,
    detailScale: 8.0,         // Higher frequency for small objects
    detailIntensity: 0.2,     // Subtle — don't overwhelm prop textures
    grungeIntensity: 0.2,     // Light grunge variation
    enableStochastic: false,  // Props use their own UVs, not tiled
  });
}

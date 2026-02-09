---
title: "feat: AAA Prop PBR Texture Overhaul"
type: feat
date: 2026-02-09
---

# feat: AAA Prop PBR Texture Overhaul

## Overview

Upgrade every prop in the game from toy-quality baked GLB textures (5-105KB total including geometry) to proper PBR materials with shared texture atlases and hero-prop dedicated texture sets. Additionally, clean up the dead `detail-overlay.ts` system that is silently overwritten by the surface-injector, and fix the placeholder ceiling textures.

This is the **#1 visual quality gap** identified by three independent reviewers: surfaces look decent, but 49 props with embedded 32x32 textures dominate the screen and look terrible. No amount of surface shader wizardry fixes cardboard furniture.

## Problem Statement

### The Arithmetic of Failure

| Asset | File Size | Contains | Quality |
|-------|-----------|----------|---------|
| Single PBR diffuse (512x512) | ~300KB | One texture channel | Good |
| ironwood-throne.glb | 80KB | Geometry + ALL textures + metadata | Placeholder |
| long-table.glb | 105KB | Geometry + ALL textures + metadata | Placeholder |
| bone-scrap.glb | 5KB | Geometry + ALL textures + metadata | Non-existent |
| wax-drip.glb | 4KB | Geometry + ALL textures + metadata | Non-existent |

The props CANNOT contain usable PBR textures at these file sizes. They render with baked vertex colors or tiny embedded diffuse-only textures — no normal maps, no roughness maps, no ambient occlusion. Under the PBR lighting system, they look flat and lifeless.

Meanwhile, the project already owns **18 high-quality PBR texture sets** across 8 categories (stone, wood, metal, fabric, leather, marble, plaster, ceiling) — all sitting unused by props. The VRAM cost is already paid for surface materials. Sharing them with props is nearly free.

### The Camera Sees Props, Not Floors

The HD-2D camera (elevated 3/4 view, ~30-45 degrees) shows approximately:
- 30-40% floor/wall/ceiling surfaces (already good quality with surface-injector)
- **60-70% props** (columns, throne, table, benches, chandeliers, chests, decorations)

Adding surface shader effects to the floor while the throne is an 80KB blob is "repainting the walls while the tables are made of cardboard."

### Dead Code: `detail-overlay.ts`

Both `detail-overlay.ts` and `surface-injector.ts` set `material.onBeforeCompile`. Only one callback can exist per material — the second silently overwrites the first. When a texture template is active, `detail-overlay.ts` is dead code. When no template is active, it's the only grunge system. This fragile dual-system should be consolidated.

## Proposed Solution

### Three-Tier Material Strategy

```
Tier 1: Hero Props (8-10 props)
  → Dedicated PBR texture sets (512x512 or 1024x1024)
  → Individual diffuse + normal + roughness + AO per prop
  → Applied via external texture override after GLB load
  → ~3-8MB additional VRAM per hero prop

Tier 2: Category Props (30+ props)
  → Shared PBR material atlases grouped by material class
  → 5-6 material categories: stone, wood, iron, fabric, organic, leather
  → Reuse existing surface PBR textures (already loaded for floors/walls)
  → Post-load material replacement in buildModelProp()
  → ~0 additional VRAM (textures already in GPU memory)

Tier 3: Micro Props (10+ props)
  → Tiny environmental details (wax-drip, bone-scrap, cobweb, ale-puddle)
  → Viewed from 10+ meters at HD-2D camera angle
  → Simple MeshStandardMaterial with color + roughness (no textures needed)
  → Correct PBR parameters (metalness, roughness) for material type
  → ~0 additional VRAM
```

### Architecture

```
src/rendering/
├── prop-materials.ts         — NEW: Material category registry + post-load replacement
├── hd2d-surface/
│   └── surface-injector.ts   — EXISTING: Apply to Tier 1+2 prop materials too
└── detail-overlay.ts         — DELETE: Consolidated into surface-injector

src/rooms/
├── RoomBuilder.ts            — MODIFY: Wire up prop material system in buildModelProp()
└── room-data/types.ts        — MODIFY: Add materialOverride to ModelPropDef

public/assets/textures/
├── props/                    — NEW: Hero prop dedicated PBR sets
│   ├── ironwood-throne/      — diffuse.jpg, normal.jpg, roughness.jpg, ao.jpg
│   ├── long-table/
│   ├── stone-hearth/
│   ├── iron-chandelier/
│   ├── ironwood-column/
│   ├── raised-dais/
│   ├── weapon-rack/
│   └── wooden-chest-large/
└── (existing categories used by Tier 2)
```

### Data Flow

```
ModelPropDef (with materialOverride)
        │
        ▼
buildModelProp() — loads GLB via GLTFLoader
        │
        ▼
applyPropMaterials() — NEW function
  ├── Hero prop? → Load dedicated PBR set, replace all mesh materials
  ├── Category prop? → Look up shared PBR set by category, replace materials
  └── Micro prop? → Apply simple MeshStandardMaterial with correct PBR params
        │
        ▼
(optional) injectSurfaceDetail() — apply triplanar detail normal to Tier 1+2
        │
        ▼
InstancedMesh or Group returned with AAA materials
```

---

## Implementation Phases

### Phase 1: Prop Material System Foundation

**Goal:** Build the material category registry and post-load replacement function. Delete dead `detail-overlay.ts`.

#### Files to Create

##### `src/rendering/prop-materials.ts`

```typescript
import * as THREE from 'three';
import { loadPBRTexture, type PBRTextureSet } from '../loaders/texture-loaders.js';
import { assetManager } from '../loaders/asset-manager.js';

/**
 * Material category for prop classification.
 * Each category maps to a shared PBR texture set.
 */
export type PropMaterialCategory =
  | 'stone'        // Columns, hearth, dais, pilasters, arches
  | 'ironwood'     // Throne, columns, table, benches, chests
  | 'dark-wood'    // Furniture, racks, stools
  | 'iron'         // Chandelier, brazier, sconces, torch holders
  | 'fabric'       // Banners, tapestries, rugs
  | 'leather'      // Chairs, chest bindings
  | 'organic'      // Rushes, moss, hound, food
  | 'micro';       // Wax-drip, bone-scrap, cobweb, ale-puddle — no texture needed

/** Category → PBR texture base path mapping */
const CATEGORY_TEXTURE_MAP: Record<Exclude<PropMaterialCategory, 'micro'>, string> = {
  stone: 'assets/textures/stone/worn-stone',
  ironwood: 'assets/textures/wood/dark-wood-floor',
  'dark-wood': 'assets/textures/wood/wood-planks',
  iron: 'assets/textures/metal/dark-iron',
  fabric: 'assets/textures/fabric/green-fabric',
  leather: 'assets/textures/leather/leather-bound',
  organic: 'assets/textures/stone/mossy-stone',
};

/** PBR parameter defaults per category */
const CATEGORY_PBR_DEFAULTS: Record<PropMaterialCategory, { roughness: number; metalness: number; color?: number }> = {
  stone:      { roughness: 0.85, metalness: 0.0 },
  ironwood:   { roughness: 0.7,  metalness: 0.0, color: 0x3a2a1a },
  'dark-wood': { roughness: 0.75, metalness: 0.0 },
  iron:       { roughness: 0.5,  metalness: 0.8 },
  fabric:     { roughness: 0.9,  metalness: 0.0 },
  leather:    { roughness: 0.6,  metalness: 0.0 },
  organic:    { roughness: 0.95, metalness: 0.0 },
  micro:      { roughness: 0.8,  metalness: 0.0 },
};

/** Prop name → material category mapping (from Room Needs Engine manifest) */
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

  // Micro (no texture replacement needed)
  'wax-drip': 'micro',
  'bone-scrap': 'micro',
  'cobweb': 'micro',
  'ale-puddle': 'micro',
  'table-stain': 'micro',
  'wall-moss': 'organic',
  'rushes': 'organic',
  'worn-path': 'stone',
  'candle-stub': 'micro',
};

/**
 * Look up the material category for a prop by its model path.
 */
export function getPropCategory(modelPath: string): PropMaterialCategory {
  const name = modelPath.split('/').pop()?.replace('.glb', '') ?? '';
  return PROP_CATEGORY_MAP[name] ?? 'micro';
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
 * Apply proper PBR material to a loaded prop mesh.
 * Replaces the baked GLB material with a high-quality PBR material
 * using shared texture sets from the surface material library.
 */
export function applyPropMaterial(
  mesh: THREE.Mesh,
  category: PropMaterialCategory,
  pbrSet: PBRTextureSet | null,
): void {
  const defaults = CATEGORY_PBR_DEFAULTS[category];

  if (!pbrSet) {
    // Micro prop: correct PBR params, keep existing diffuse or use plain color
    const existing = mesh.material as THREE.MeshStandardMaterial;
    existing.roughness = defaults.roughness;
    existing.metalness = defaults.metalness;
    existing.needsUpdate = true;
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

  // Dispose old material
  const old = mesh.material as THREE.Material;
  old.dispose();

  mesh.material = mat;
}
```

#### Files to Modify

##### `src/rooms/RoomBuilder.ts`

In `buildModelProp()` (~line 457), after loading the GLB and before creating instances, apply material replacement:

```typescript
import { getPropCategory, loadCategoryPBR, applyPropMaterial } from '../rendering/prop-materials.js';
import { injectSurfaceDetail } from '../rendering/hd2d-surface/surface-injector.js';

// Inside buildModelProp(), after line 482 (sourceMeshes collected):
const category = getPropCategory(modelPath);
const pbrSet = await loadCategoryPBR(category);

for (const mesh of sourceMeshes) {
  applyPropMaterial(mesh, category, pbrSet);
}
```

Also remove the `import { applyDetailOverlay }` and its two call sites at lines 436 and 720.

##### `src/rooms/room-data/types.ts`

Add optional `materialOverride` to `ModelPropDef` for hero props:

```typescript
export interface ModelPropDef {
  type: 'model';
  modelPath: string;
  positions: (Vec3 | PropInstance)[];
  scale?: number;
  rotationY?: number;
  /** Override the auto-detected material category for this prop */
  materialOverride?: string;
  /** Path to dedicated PBR texture set (for hero props) */
  pbrTexturePath?: string;
}
```

#### Files to Delete

##### `src/rendering/detail-overlay.ts`

This file is dead code when the surface-injector is active (which it is for any room with a texture template). Both set `onBeforeCompile` — the second overwrites the first. Remove entirely and consolidate into `surface-injector.ts` which handles grunge overlay already via triplanar projection.

#### Acceptance Criteria

- [ ] `prop-materials.ts` created with category registry, PBR loading, and material replacement
- [ ] `buildModelProp()` calls `applyPropMaterial()` after GLB load
- [ ] All 49 ironrath props render with proper PBR materials (not baked GLB textures)
- [ ] Shared PBR textures are ref-counted via `assetManager` (no VRAM duplication)
- [ ] `detail-overlay.ts` deleted, its import and two call sites removed from `RoomBuilder.ts`
- [ ] TypeScript compiles with no new errors
- [ ] Vite dev server starts without errors

---

### Phase 2: Hero Prop Dedicated Textures

**Goal:** Generate dedicated PBR texture sets for the 8-10 most prominent props. These props are close to camera and deserve individual textures rather than shared category textures.

#### Hero Props (by screen prominence)

| Prop | Current Size | Material | Dedicated Texture Resolution |
|------|-------------|----------|------------------------------|
| ironwood-throne | 80KB | ironwood | 1024x1024 |
| long-table | 105KB | dark-wood | 1024x1024 |
| stone-hearth | 69KB | stone | 1024x1024 |
| iron-chandelier | 72KB | iron | 512x512 |
| ironwood-column | 51KB | ironwood | 512x512 |
| raised-dais | 50KB | stone | 512x512 |
| weapon-rack | 71KB | dark-wood | 512x512 |
| wooden-chest-large | 50KB | dark-wood | 512x512 |
| high-seat | 77KB | dark-wood | 512x512 |
| stone-arch | 73KB | stone | 512x512 |

#### Asset Generation

Create `scripts/generate-hero-prop-textures.mjs` — a Node.js canvas script that generates PBR texture sets for hero props using procedural techniques:

1. **Diffuse:** Base color from category + Perlin noise variation + edge darkening + wear patterns
2. **Normal:** Multi-octave noise → Sobel filter height-to-normal conversion + detail scratches/grain
3. **Roughness:** Base roughness + variation (edges more worn/smoother, recesses rougher)
4. **AO:** Edge darkening via distance field from geometry silhouette + cavity maps

Output to `public/assets/textures/props/{prop-name}/diffuse.jpg`, etc.

#### Files to Modify

##### `src/rendering/prop-materials.ts`

Add hero prop detection and dedicated texture loading:

```typescript
const HERO_PROPS: Set<string> = new Set([
  'ironwood-throne', 'long-table', 'stone-hearth', 'iron-chandelier',
  'ironwood-column', 'raised-dais', 'weapon-rack', 'wooden-chest-large',
  'high-seat', 'stone-arch',
]);

export function isHeroProp(modelPath: string): boolean {
  const name = modelPath.split('/').pop()?.replace('.glb', '') ?? '';
  return HERO_PROPS.has(name);
}

export async function loadHeroPBR(modelPath: string): Promise<PBRTextureSet | null> {
  const name = modelPath.split('/').pop()?.replace('.glb', '') ?? '';
  const basePath = `assets/textures/props/${name}`;
  try {
    return await assetManager.loadPBRSetAsync(`hero-pbr-${name}`, () =>
      loadPBRTexture(basePath, `hero-${name}`),
    );
  } catch {
    return null; // Fall back to category texture
  }
}
```

##### `src/rooms/RoomBuilder.ts`

Update `buildModelProp()` to prefer hero textures:

```typescript
const category = getPropCategory(modelPath);
const pbrSet = isHeroProp(modelPath)
  ? (await loadHeroPBR(modelPath)) ?? (await loadCategoryPBR(category))
  : await loadCategoryPBR(category);
```

#### Acceptance Criteria

- [ ] `generate-hero-prop-textures.mjs` produces PBR sets for all 10 hero props
- [ ] Hero props render with dedicated textures (visually distinct from category props)
- [ ] Dedicated textures load via `assetManager` with ref-counting
- [ ] Hero prop materials respond correctly to PBR lighting (specular highlights, normal mapping visible)
- [ ] Fallback works: if hero texture missing, falls back to category texture
- [ ] Total VRAM for hero prop textures < 20MB (10 props × ~2MB each)

---

### Phase 3: Surface Detail on Props

**Goal:** Apply the existing `injectSurfaceDetail()` system to Tier 1 and Tier 2 props, giving them the same triplanar detail normal + grunge variation that surfaces already have. This adds visible micro-surface quality under point lights.

#### Files to Modify

##### `src/rendering/prop-materials.ts`

Add surface detail injection after material replacement:

```typescript
import { injectSurfaceDetail, type SurfaceDetailConfig } from './hd2d-surface/surface-injector.js';

/** Default surface detail config for props — lighter than surfaces */
const PROP_SURFACE_CONFIG: SurfaceDetailConfig = {
  detailNormalTex: null,  // Loaded from template
  grungeTex: null,        // Loaded from template
  detailScale: 8.0,       // Higher frequency for small objects
  detailIntensity: 0.2,   // Subtle — don't overwhelm prop textures
  grungeScale: 0.15,
  grungeIntensity: 0.2,
  enableStochastic: false, // Props use their own UVs, not tiled
};

export function applyPropSurfaceDetail(
  mesh: THREE.Mesh,
  category: PropMaterialCategory,
  surfaceConfig: SurfaceDetailConfig | null,
): void {
  if (category === 'micro' || !surfaceConfig) return;
  const mat = mesh.material as THREE.MeshStandardMaterial;

  injectSurfaceDetail(mat, {
    ...surfaceConfig,
    detailScale: PROP_SURFACE_CONFIG.detailScale,
    detailIntensity: PROP_SURFACE_CONFIG.detailIntensity,
    grungeIntensity: PROP_SURFACE_CONFIG.grungeIntensity,
    enableStochastic: false,
  });
}
```

##### `src/rooms/RoomBuilder.ts`

Pass the surface config through to prop material application:

```typescript
// In buildModelProp, after material replacement:
if (surfaceConfig) {
  for (const mesh of sourceMeshes) {
    applyPropSurfaceDetail(mesh, category, surfaceConfig);
  }
}
```

#### Acceptance Criteria

- [x] Tier 1+2 props receive surface detail injection (triplanar normal + grunge)
- [x] Detail intensity is tuned for props (subtle, not overwhelming)
- [x] Stochastic tiling is disabled for props (they use their own UVs)
- [x] Micro props are excluded from injection (performance)
- [x] Surface detail on props responds to quality scaler degradation
- [x] Props show visible micro-surface variation under point lights

---

### Phase 4: Fix Placeholder Ceiling + Emissive Fire Sources

**Goal:** Replace the ironwood ceiling placeholder textures (20KB normal, 20KB AO = noise data) and add emissive materials to fire sources (braziers, hearth, candles).

#### Ceiling Fix

The `ironwood-ceiling` PBR set has:
- `diffuse.jpg`: 268KB — real texture, OK
- `normal.jpg`: 20KB — placeholder noise (confirmed by visual inspection)
- `ao.jpg`: 20KB — placeholder noise
- `roughness.jpg`: 125KB — real texture, OK

**Fix:** Generate proper normal and AO maps from the diffuse using height-to-normal conversion (same technique as hero prop generation). Or, replace the ceiling texture set entirely with `dark-wood-floor` (which has proper 3-channel PBR at ~2MB total).

#### Emissive Materials

Fire sources (braziers, hearth, candle-stubs, torches) should have emissive materials for glow effect even without bloom. Add emissive channel to iron-category props that are fire sources:

```typescript
const FIRE_SOURCE_PROPS = new Set([
  'iron-brazier', 'candle-stub', 'iron-candle-tree', 'candelabra',
]);

// In applyPropMaterial, for fire sources:
if (FIRE_SOURCE_PROPS.has(propName)) {
  mat.emissive = new THREE.Color(0xFF6B35);
  mat.emissiveIntensity = 0.3;
}
```

#### Acceptance Criteria

- [x] Ceiling renders with proper normal mapping (visible wood grain depth)
- [x] Ceiling AO provides subtle darkening at beam junctions
- [x] Fire source props emit warm orange glow (visible even with bloom disabled)
- [x] Emissive intensity is subtle (0.2-0.4) — enhancement, not overpowering

---

### Phase 5: Prop Material Configuration in Room Needs Engine

**Goal:** Update the Room Needs Engine pipeline to emit `materialOverride` and `pbrTexturePath` in generated TypeScript, allowing per-prop material control from the manifest.

#### Files to Modify

##### `scripts/room-needs/schemas/manifest.mjs`

Add optional material fields to the prop item schema:

```javascript
materialCategory: z.enum(['stone', 'ironwood', 'dark-wood', 'iron', 'fabric', 'leather', 'organic', 'micro']).optional(),
pbrTexturePath: z.string().optional(),
```

##### `scripts/room-needs/write-room-data.mjs`

Emit `materialOverride` when manifest specifies non-default category:

```javascript
if (item.materialCategory) {
  propLine += `, materialOverride: '${item.materialCategory}'`;
}
if (item.pbrTexturePath) {
  propLine += `, pbrTexturePath: '${item.pbrTexturePath}'`;
}
```

##### `scripts/room-needs/prompts/system-prompt.md`

Add material category guidance to the Room Needs Engine prompt so Claude assigns categories to new props.

#### Acceptance Criteria

- [x] Manifest schema accepts `materialCategory` and `pbrTexturePath` per item
- [x] Generated TypeScript emits `materialOverride` when non-default category specified
- [x] Room Needs Engine prompt includes material category guidance
- [ ] Re-running pipeline produces valid output with material annotations

---

## Acceptance Criteria

### Functional Requirements

- [ ] All 49 ironrath props render with PBR materials (not baked GLB textures)
- [ ] 10 hero props have dedicated high-quality PBR textures (512-1024px)
- [ ] 30+ category props share existing surface PBR textures (zero additional VRAM)
- [ ] 10+ micro props have correct PBR parameters (roughness, metalness)
- [ ] Props show normal mapping under point lights (visible surface detail)
- [ ] Props show roughness variation (specular response varies across surface)
- [ ] Fire source props emit warm glow
- [ ] Ceiling has proper normal + AO maps
- [ ] `detail-overlay.ts` is deleted, no `onBeforeCompile` collision

### Non-Functional Requirements

- [ ] Category prop VRAM cost: ~0 additional (shared with surface materials)
- [ ] Hero prop VRAM cost: < 20MB total (10 × ~2MB)
- [ ] No increase in draw calls (materials shared via InstancedMesh)
- [ ] Prop material loading adds < 100ms to room load time
- [ ] All textures disposed correctly on room unload (no GPU memory leaks)

### Quality Gates

- [ ] TypeScript compiles with no new errors (`tsc --noEmit`)
- [ ] Vite dev server starts without errors
- [ ] Vite production build succeeds (`npx vite build`)
- [ ] Great Hall room loads and renders at 60fps with all prop materials active
- [ ] Screenshot comparison shows dramatic improvement vs baseline

---

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Shared UV mapping doesn't fit prop geometry | Medium | Medium | Triplanar projection via surface-injector handles arbitrary geometry without UV dependency |
| Hero prop texture generation looks procedural | Medium | Medium | Multi-technique layering (noise + edge detection + cavity maps); iterate with screenshots |
| Material replacement breaks InstancedMesh | Low | High | Test with multi-instance props (columns have 8 instances); material is shared across instances by design |
| VRAM budget exceeded on integrated GPUs | Low | Medium | Quality scaler can disable prop surface detail; category textures are already loaded |
| Old material disposal causes visual flash | Low | Low | Material replacement happens before first render frame (during buildRoom async) |

---

## References

### Internal References

- Prop loading: `src/rooms/RoomBuilder.ts:457-539` (buildModelProp)
- PBR loading: `src/loaders/texture-loaders.ts:87-131` (loadPBRTexture)
- Surface injection: `src/rendering/hd2d-surface/surface-injector.ts:43-165` (injectSurfaceDetail)
- Dead overlay: `src/rendering/detail-overlay.ts` (entire file — to delete)
- Room types: `src/rooms/room-data/types.ts:134-144` (ModelPropDef)
- Asset manager: `src/loaders/asset-manager.ts` (ref-counted cache)
- Quality scaler: `src/rendering/quality-scaler.ts:64-117` (degradation levels)
- Great Hall data: `src/rooms/room-data/ironrath/great-hall.generated.ts:80-256` (prop definitions)
- Placement learnings: `docs/solutions/rendering/great-hall-placement-bugs-and-model-aware-prevention.md`
- Pipeline learnings: `docs/solutions/architecture/hd2d-deferred-effects-pipeline.md`

### External References

- Three.js MeshStandardMaterial: [three.js docs](https://threejs.org/docs/#api/en/materials/MeshStandardMaterial)
- Three.js InstancedMesh material sharing: InstancedMesh uses shared material by design
- PBR metalness/roughness values: dielectrics (stone, wood) = metalness 0.0; metals (iron) = metalness 0.8+
- Triplanar projection for arbitrary meshes: [Ben Golus article](https://bgolus.medium.com/normal-mapping-for-a-triplanar-shader-10bf39dca05a)

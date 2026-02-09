---
title: "feat: Scalable Texture Engine"
type: feat
date: 2026-02-09
---

# feat: Scalable Texture Engine

## Overview

Build a hybrid texture engine that adds AAA surface density to every room through three systems:
1. **Shader detail layers** — `onBeforeCompile` injection for triplanar detail normals, stochastic tiling breakup, and grunge overlay (zero draw calls)
2. **Instanced decal atlas** — `InstancedMesh`-based decal renderer for placed surface storytelling (+3 draw calls for ~1,400 decals)
3. **Culture/mood templates** — JSON configs that auto-populate rooms with density targets, decal palettes, and zone rules

**Brainstorm:** `docs/brainstorms/2026-02-09-scalable-texture-engine-brainstorm.md`

## Problem Statement

The Great Hall has 256 prop instances but zero surface detail between them. Every square meter of floor, wall, and ceiling looks identical because PBR textures tile uniformly across large areas. HD-2D benchmarks (Octopath 2, Triangle Strategy) achieve density through layered detail normals, grunge overlays, and hundreds of surface decals (cracks, stains, moss, wear patterns). The current engine has no system for any of this.

## Proposed Solution

### Architecture

```
src/rendering/hd2d-surface/
├── surface-injector.ts    — onBeforeCompile wrapper for MeshStandardMaterial
├── surface-shaders.ts     — GLSL helper functions (triplanar, stochastic, grunge)
├── decal-system.ts        — InstancedMesh decal renderer + atlas UV remapping
├── decal-placer.ts        — Template-driven placement with zone rules
└── texture-template.ts    — Template loader + Zod schema

scripts/room-needs/
├── templates/
│   └── northern-grand.json
└── schemas/
    └── texture-template.mjs

public/assets/textures/
├── detail/
│   ├── stone-micro-normal.png
│   └── northern-grunge.png
└── decals/
    └── northern-atlas.png
```

### Data Flow

```
Template JSON → texture-template.ts → {shaderConfig, decalConfig}
                                           │              │
                                           ▼              ▼
buildPBRMaterial() → surface-injector.ts   decal-placer.ts → decal-system.ts
(existing)          (wraps material)       (generates positions)  (InstancedMesh)
                                           │              │
                                           ▼              ▼
                                    RoomBuilder returns BuiltRoom
                                    with injected materials + decal meshes
```

---

## Implementation Phases

### Phase 1: Shader Detail Injection

**Goal:** All floor/wall/ceiling surfaces get triplanar detail normal + stochastic tiling breakup + grunge overlay via `onBeforeCompile`. Zero new draw calls.

#### Files to Create

##### `src/rendering/hd2d-surface/surface-shaders.ts`

GLSL helper functions as template literal strings:

```typescript
// Triplanar detail normal (Ben Golus whiteout technique)
export const TRIPLANAR_DETAIL_NORMAL = /* glsl */`
vec3 triplanarDetailNormal(vec3 wPos, vec3 wNrm, sampler2D detMap, float scale) {
    vec3 blend = pow(abs(wNrm), vec3(4.0));
    blend /= (blend.x + blend.y + blend.z + 0.0001);
    vec3 tnX = texture(detMap, wPos.zy * scale).rgb * 2.0 - 1.0;
    vec3 tnY = texture(detMap, wPos.xz * scale).rgb * 2.0 - 1.0;
    vec3 tnZ = texture(detMap, wPos.xy * scale).rgb * 2.0 - 1.0;
    vec3 nX = vec3(tnX.z * sign(wNrm.x), tnX.y, tnX.x);
    vec3 nY = vec3(tnY.x, tnY.z * sign(wNrm.y), tnY.y);
    vec3 nZ = vec3(tnZ.x, tnZ.y, tnZ.z * sign(wNrm.z));
    return normalize(nX * blend.x + nY * blend.y + nZ * blend.z) - wNrm;
}`;

// Stochastic tiling (Inigo Quilez hash technique)
export const STOCHASTIC_TILING = /* glsl */`
vec4 hash4(vec2 p) { ... }
vec4 textureNoTile(sampler2D samp, vec2 uv) { ... }`;

// Grunge overlay (triplanar multiply blend)
export const GRUNGE_OVERLAY = /* glsl */`
float triplanarGrunge(vec3 wPos, vec3 wNrm, sampler2D grungeMap, float scale) { ... }`;
```

##### `src/rendering/hd2d-surface/surface-injector.ts`

```typescript
export interface SurfaceDetailConfig {
  detailNormalTex: THREE.Texture | null;
  grungeTex: THREE.Texture | null;
  detailScale: number;       // default 6.0
  detailIntensity: number;   // default 0.3
  grungeScale: number;       // default 0.1
  grungeIntensity: number;   // default 0.35
  enableStochastic: boolean; // default true
}

export function injectSurfaceDetail(
  material: THREE.MeshStandardMaterial,
  config: SurfaceDetailConfig,
): void { ... }
```

**Injection points:**
1. Vertex: add `vWorldPos`, `vWorldNrm` varyings after `#include <common>`, compute after `#include <worldpos_vertex>`
2. Fragment: declare uniforms + helpers after `#define STANDARD`
3. Replace `#include <map_fragment>` with stochastic version (when enabled)
4. Append detail normal blend after `#include <normal_fragment_maps>`
5. Append grunge multiply after the stochastic map_fragment replacement
6. Set `customProgramCacheKey` based on config flags

**Failure handling:** Wrap the `onBeforeCompile` callback in try/catch. On shader compilation failure, log warning and material falls back to unmodified PBR (existing behavior). Test for `WebGL2RenderingContext` support at init — if not available, skip injection entirely.

#### Files to Modify

##### `src/rooms/RoomBuilder.ts`

After `buildPBRMaterial()` returns, call `injectSurfaceDetail()`:

```typescript
// ~line 84, after floor material creation
const floorMat = data.floorTexture
  ? await buildPBRMaterial(...)
  : buildProceduralFloorMaterial(...);

if (surfaceConfig) {
  injectSurfaceDetail(floorMat, surfaceConfig);
}
```

Same pattern for wall materials (~line 100) and ceiling material (~line 130).

**Where does `surfaceConfig` come from?** From the template loaded by `texture-template.ts`, resolved from `data.textureTemplate`. See Phase 3.

##### `src/rooms/room-data/types.ts`

Add new fields to `RoomData`:

```typescript
export interface RoomData {
  // ... existing fields ...
  textureTemplate?: string;          // Template ID, e.g. 'northern-grand'
  decalOverrides?: DecalOverrideDef[];
}

export interface DecalOverrideDef {
  tile: [number, number];  // Atlas grid [col, row]
  position: Vec3;
  rotation?: number;
  scale?: number;
}
```

#### Assets to Create

- `public/assets/textures/detail/stone-micro-normal.png` — 512x512 detail normal map (high-frequency stone grain). Generate procedurally via canvas at build time if no hand-painted version exists.
- `public/assets/textures/detail/northern-grunge.png` — 512x512 grunge overlay (low-frequency dirt/wear). Generate procedurally.

#### Acceptance Criteria

- [x] `injectSurfaceDetail()` wraps MeshStandardMaterial with triplanar detail normal, stochastic tiling, and grunge overlay
- [x] Floor, wall, and ceiling materials all receive injection when template is present
- [ ] No visible tile repetition on floor from default camera angle
- [ ] Detail normal adds visible micro-surface variation under point lights
- [ ] Grunge darkens corners and edges subtly
- [x] When `detailNormalTex` or `grungeTex` is null, those layers are skipped (no errors)
- [x] Shader compilation failure falls back silently to base PBR material
- [x] `customProgramCacheKey` set correctly — different configs produce different programs
- [ ] Zero additional draw calls (verified via `renderer.info.render.calls`)
- [ ] Playwright screenshot shows visible difference vs baseline

---

### Phase 2: Instanced Decal Atlas System

**Goal:** Render hundreds of surface decals (cracks, stains, moss, wear) using 3 InstancedMesh draw calls with per-instance atlas UV remapping.

#### Files to Create

##### `src/rendering/hd2d-surface/decal-system.ts`

```typescript
export interface DecalInstance {
  position: THREE.Vector3;
  rotation: number;       // Y-axis rotation in radians
  scale: THREE.Vector2;   // Width, depth in world units
  atlasRegion: AtlasRegion;
  surfaceType: 'floor' | 'wall-n' | 'wall-s' | 'wall-e' | 'wall-w' | 'ceiling';
}

export interface AtlasRegion {
  u: number; v: number;   // UV offset
  w: number; h: number;   // UV scale
}

export class DecalSystem {
  private floorMesh: THREE.InstancedMesh;
  private wallMeshes: Map<string, THREE.InstancedMesh>;
  private ceilingMesh: THREE.InstancedMesh;

  constructor(atlas: THREE.Texture, maxFloor: number, maxWall: number, maxCeiling: number);
  addDecal(instance: DecalInstance): void;
  finalize(): THREE.Group;  // Returns group containing all meshes
  dispose(): void;
}
```

**Material:** `MeshStandardMaterial` with:
- `map: atlas` (sRGB)
- `transparent: true`, `alphaTest: 0.01`
- `depthWrite: false`
- `polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4`
- `roughness: 0.95, metalness: 0.0`
- `receiveShadow: true, castShadow: false`
- `onBeforeCompile` to remap UVs per-instance via `aUvRegion` attribute

**Quad geometry:**
- Floor: `PlaneGeometry(1,1)` rotated -90° on X (lies flat)
- Wall: `PlaneGeometry(1,1)` not rotated (vertical), offset 0.005 along wall normal
- Ceiling: `PlaneGeometry(1,1)` rotated +90° on X (faces down)

##### `src/rendering/hd2d-surface/decal-placer.ts`

```typescript
export interface DecalPaletteEntry {
  tile: [number, number];     // Atlas grid position
  weight: number;             // Relative spawn probability
  scaleRange: [number, number]; // Min/max world-unit size
  name?: string;              // For zone rule matching
}

export interface ZoneRule {
  trigger: 'fire-source' | 'door' | 'water-source' | 'high-traffic';
  radius: number;
  effects: {
    decalBoost?: Record<string, number>;
    excludeDecals?: string[];
    grungeBoost?: number;
  };
}

export function placeDecals(
  roomDimensions: { width: number; depth: number; height: number },
  palette: { floor: DecalPaletteEntry[]; wall: DecalPaletteEntry[]; ceiling: DecalPaletteEntry[] },
  density: { floor: number; wall: number; ceiling: number },
  zones: { rule: ZoneRule; position: Vec3 }[],
  seed?: number,
): DecalInstance[];
```

**Placement algorithm:**
1. Calculate target counts: `floor: area * density.floor`, etc.
2. Scatter positions using seeded PRNG across surface area
3. For each position, select decal tile via weighted random from palette
4. Apply zone rules: boost weights within radius, exclude incompatible types
5. Random rotation (0-2pi) and random scale within scaleRange
6. Budget cap: max 2000 total decals per room to bound computation

**Zone interaction precedence:** Boosts are additive (fire-source soot + door wear can both apply). Exclusions are authoritative (if any zone excludes a type, it's removed).

#### Files to Modify

##### `src/rooms/RoomBuilder.ts`

After props are built, create decal system:

```typescript
// After props section (~line 275)
let decalGroup: THREE.Group | undefined;
if (template?.decals) {
  const atlas = await assetManager.loadTextureAsync(
    `decal-atlas-${data.textureTemplate}`,
    () => textureLoader.loadAsync(template.decals.atlas)
  );
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.wrapS = THREE.ClampToEdgeWrapping;
  atlas.wrapT = THREE.ClampToEdgeWrapping;

  const zoneTriggers = resolveZoneTriggers(data, template.zones);
  const instances = placeDecals(data.dimensions, template.decals.palette, template.decals.density, zoneTriggers);

  // Add room-specific overrides
  if (data.decalOverrides) {
    for (const override of data.decalOverrides) {
      instances.push(overrideToInstance(override, atlasConfig));
    }
  }

  const system = new DecalSystem(atlas, 1000, 500, 200);
  for (const inst of instances) system.addDecal(inst);
  decalGroup = system.finalize();
  group.add(decalGroup);
}
```

##### `src/rooms/RoomManager.ts`

Add decal disposal to `unloadCurrentRoom()`:

```typescript
// In unloadCurrentRoom(), after particle disposal
if (this.currentDecalSystem) {
  this.currentDecalSystem.dispose();
  this.currentDecalSystem = null;
}
if (roomData.textureTemplate) {
  assetManager.releaseTexture(`decal-atlas-${roomData.textureTemplate}`);
}
```

##### `src/loaders/asset-manager.ts`

No structural changes needed — existing `loadTextureAsync` / `releaseTexture` handles atlas textures. The atlas is just another ref-counted texture entry.

#### Assets to Create

- `public/assets/textures/decals/northern-atlas.png` — 2048x2048 decal atlas with 8x8 grid. Start with 16-24 procedurally generated decals (cracks, stains, moss, wear patterns). Remaining slots left transparent for future additions.

**Procedural atlas generation script:** `scripts/generate-decal-atlas.mjs` — Node.js canvas script that renders noise-based decals into atlas grid positions. Run once at build time.

#### Acceptance Criteria

- [x] `DecalSystem` creates InstancedMesh per surface orientation with per-instance `aUvRegion` attribute
- [ ] `DecalPlacer` generates 500+ floor decals for the Great Hall (24x14m at 2.5/sq m)
- [ ] Decals render with correct atlas sub-regions (no bleeding between tiles)
- [ ] No Z-fighting between decals and underlying surfaces
- [ ] Zone rules correctly boost soot near fire sources and wear near doors
- [x] `dispose()` releases all geometry, materials, and releases atlas texture ref
- [ ] Total draw call increase is exactly +3 (floor + wall + ceiling InstancedMesh)
- [ ] Decal placer completes in < 50ms for 1,400 decals
- [x] Seeded PRNG produces deterministic results (same seed = same layout)
- [ ] Playwright screenshot shows decals on floor and walls

---

### Phase 3: Template System & Integration

**Goal:** Culture/mood templates drive both shader parameters and decal placement. Templates are JSON files loaded at room build time and referenced by `textureTemplate` in RoomData.

#### Files to Create

##### `src/rendering/hd2d-surface/texture-template.ts`

```typescript
export interface TextureTemplate {
  id: string;
  shaderLayers: {
    detailNormal: { texture: string; scale: number; intensity: number };
    grunge: { texture: string; scale: number; intensity: number; tint?: [number, number, number] };
    tilingBreakup: { enabled: boolean; appliesTo: ('floor' | 'wall' | 'ceiling')[] };
  };
  decals: {
    atlas: string;
    density: { floor: number; wall: number; ceiling: number };
    palette: {
      floor: DecalPaletteEntry[];
      wall: DecalPaletteEntry[];
      ceiling: DecalPaletteEntry[];
    };
  };
  zones: ZoneRule[];
}

export async function loadTemplate(templateId: string): Promise<TextureTemplate | null>;
```

**Loading:** Fetch from `/assets/templates/{templateId}.json`. On failure, return `null` (room renders without texture engine — graceful degradation).

**Caching:** Templates are small JSON (~2KB). Cache in a module-level `Map<string, TextureTemplate>`. No ref-counting needed — templates are shared data.

##### `scripts/room-needs/templates/northern-grand.json`

First template — defines the northern castle aesthetic for grand halls. See brainstorm for full JSON structure.

##### `scripts/room-needs/schemas/texture-template.mjs`

Zod schema for template validation. Used by Room Needs Engine pipeline to validate templates.

#### Files to Modify

##### `src/rooms/RoomBuilder.ts`

Full integration — load template, inject shaders, create decals:

```typescript
export async function buildRoom(data: RoomData, loaderSet?: LoaderSet): Promise<BuiltRoom> {
  // Load texture template (if specified)
  const template = data.textureTemplate
    ? await loadTemplate(data.textureTemplate)
    : null;

  const surfaceConfig = template
    ? await buildSurfaceConfig(template)
    : null;

  // ... existing floor/wall/ceiling creation ...
  // After each material creation, inject if config exists:
  if (surfaceConfig) injectSurfaceDetail(floorMat, surfaceConfig);

  // ... existing lights, props, particles ...

  // Decal system (after props)
  const decalSystem = template?.decals
    ? await buildDecalSystem(data, template, group)
    : null;

  return { group, ..., decalSystem };
}
```

##### `scripts/room-needs/write-room-data.mjs`

Emit `textureTemplate` field in generated TypeScript when manifest has a `textureLayer` section:

```javascript
if (manifest.textureLayer?.template) {
  lines.push(`  textureTemplate: '${manifest.textureLayer.template}',`);
}
if (manifest.textureLayer?.overrides?.decals?.length) {
  lines.push(`  decalOverrides: ${JSON.stringify(manifest.textureLayer.overrides.decals)},`);
}
```

##### `src/rooms/room-data/ironrath/great-hall.generated.ts`

Re-run pipeline to regenerate with `textureTemplate: 'northern-grand'`.

#### Acceptance Criteria

- [x] `loadTemplate('northern-grand')` returns valid template with shader layers and decal config
- [x] Template loading failure returns null and room renders normally without texture engine
- [x] Template textures (detail normal, grunge, atlas) are loaded via assetManager and properly ref-counted
- [x] Great Hall generated TypeScript includes `textureTemplate: 'northern-grand'`
- [x] Room Needs Engine validates template schema before pipeline run
- [x] Template is cached — loading same template twice returns cached version
- [x] Zod schema catches malformed template JSON with clear error messages

---

### Phase 4: Quality Scaler Extension

**Goal:** Extend the quality scaler to progressively disable texture engine features when frame budget is exceeded.

#### Files to Modify

##### `src/rendering/quality-scaler.ts`

Extend `MAX_LEVEL` from 6 to 11. Add new degradation levels:

| Level | Action | Implementation | Savings |
|-------|--------|----------------|---------|
| 7 | Disable ceiling decals | `ceilingMesh.visible = false` | ~0.05ms |
| 8 | Reduce floor decal count 50% | `floorMesh.count = floorMesh.count / 2` | ~0.1ms |
| 9 | Disable grunge overlay | Set `uGrungeIntensity` uniform to 0 | ~0.2ms |
| 10 | Disable detail normal + tiling | Set `uDetailIntensity` uniform to 0, swap stochastic back to standard | ~0.5ms |
| 11 | Disable all decals | Set all decal mesh `visible = false` | ~0.15ms |

**Key design decision:** Levels 9-10 modify shader uniforms (no recompilation needed). `uGrungeIntensity = 0` causes the grunge multiply to be `mix(1.0, grunge, 0.0) = 1.0` — a no-op. `uDetailIntensity = 0` causes `normal + 0 * detailNormal = normal` — also a no-op. The shader is still "running" but the texture samples are effectively free when the uniform multiplier is zero (GPU can optimize constant zero multiplies).

**Stochastic tiling disable at level 10:** This requires a flag uniform `uEnableStochastic` checked in the shader: `if (uEnableStochastic > 0.5) { use textureNoTile } else { use texture }`. Branch is per-fragment but uniform-driven — GPU handles this efficiently.

##### `src/rendering/hd2d-surface/surface-injector.ts`

Expose uniform references for quality scaler:

```typescript
export interface SurfaceDetailHandle {
  setGrungeIntensity(v: number): void;
  setDetailIntensity(v: number): void;
  setStochasticEnabled(v: boolean): void;
}
```

Store these on `material.userData.surfaceDetail` for the quality scaler to access.

#### Acceptance Criteria

- [x] Quality scaler levels 7-11 progressively disable texture engine features
- [ ] Level 9 (grunge off) and 10 (detail off) modify uniforms without shader recompilation
- [ ] Level 11 disables all decal meshes via `.visible = false`
- [ ] Quality scaler re-enables features when frame time drops below 10ms
- [x] Hysteresis prevents rapid toggling between levels (existing 60-frame cooldown applies)
- [ ] `qualitySettings` object exposes current texture engine state for debug overlay

---

### Phase 5: Procedural Texture Generation

**Goal:** Generate the detail normal map, grunge map, and decal atlas programmatically so no external art assets are needed for the MVP.

#### Files to Create

##### `scripts/generate-detail-textures.mjs`

Node.js canvas script that generates:
1. `stone-micro-normal.png` — 512x512 detail normal map using fractal noise + Sobel filter for height-to-normal conversion
2. `northern-grunge.png` — 512x512 grunge overlay using Perlin noise with octave layering

##### `scripts/generate-decal-atlas.mjs`

Node.js canvas script that generates `northern-atlas.png` — 2048x2048 atlas with:
- Row 0: Floor cracks (hairline noise lines, branching patterns)
- Row 1: Floor stains (circular noise blobs with alpha falloff)
- Row 2: Floor organic (moss = green noise patches, rushes = linear strokes)
- Row 3: Floor wear (gradient patches, scuff marks)
- Row 4-5: Wall damage + organic (similar patterns, vertical bias)
- Row 6: Ceiling (large circular smoke stains, radial cobwebs)
- Row 7: Reserved for culture-specific

Each tile: 256x256 with 2px edge-padded gutter.

#### Acceptance Criteria

- [x] `generate-detail-textures.mjs` produces valid PNG files at correct dimensions
- [x] `generate-decal-atlas.mjs` produces 2048x2048 atlas with 8x8 grid, 2px gutters, edge padding
- [ ] Generated textures are visually plausible from the HD-2D camera angle
- [ ] Scripts are idempotent — running twice produces identical output
- [x] Atlas tiles have proper alpha channels (transparent background, visible content)
- [x] Normal map is in tangent-space convention (blue-dominant, XY perturbation in RG)

---

### Phase 6: Visual Regression Testing

**Goal:** Add Playwright tests that verify the texture engine renders correctly from standard camera angles.

#### Files to Modify

##### `tests/visual/great-hall.spec.ts`

Add new camera angles or extend existing tests to capture texture detail:

```typescript
const TEXTURE_ANGLES: CameraAngle[] = [
  {
    name: 'floor-detail',
    position: [0, 5, 3],      // Low angle, close to floor
    target: [0, 0, 0],
  },
  {
    name: 'wall-decals',
    position: [-10, 5, 0],    // Side view, wall in focus
    target: [-12, 5, 0],
  },
];
```

#### Acceptance Criteria

- [ ] New baselines generated showing texture engine effects
- [ ] Floor-detail angle shows visible stochastic tiling, detail normal, and floor decals
- [ ] Wall-decals angle shows wall decals with no Z-fighting
- [ ] All 5 camera angles pass (3 existing + 2 new)
- [ ] Screenshots are deterministic (seeded decal placement)

---

## Acceptance Criteria

### Functional Requirements

- [ ] Surfaces show visible triplanar detail normal variation under point lights
- [ ] No visible tile repetition on floor or walls from default camera angle
- [ ] Grunge overlay subtly darkens corners and areas near walls
- [ ] Floor decals (cracks, stains, moss) visible at density ~2.5/sq m
- [ ] Wall decals (damage, moss, water stains) visible at density ~1.0/sq m
- [ ] Zone rules work: more soot near hearth, more wear near doors
- [ ] Template system loads and applies without errors
- [ ] Room loads correctly when template is missing (graceful degradation)
- [ ] Room loads correctly when texture assets are missing (shader layers skip individually)

### Non-Functional Requirements

- [ ] +3 draw calls maximum (verified via `renderer.info.render.calls`)
- [ ] < 1.0ms total additional frame time at 1080p
- [ ] < 50ms decal placement computation per room
- [ ] < 2MB total texture memory for texture engine (detail + grunge + atlas)
- [ ] Quality scaler degrades texture features at levels 7-11
- [ ] All texture assets disposed correctly on room unload (no GPU memory leaks)

### Quality Gates

- [x] TypeScript compiles with no errors
- [ ] Vite dev server starts without errors
- [ ] Playwright visual regression tests pass with new baselines
- [x] `tsc --noEmit` passes
- [ ] Great Hall room loads and renders at 60fps with texture engine active

---

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Shader compilation failure on some GPUs | Low | High | Try/catch in onBeforeCompile, silent fallback to base PBR |
| Stochastic tiling introduces visual artifacts | Medium | Medium | Can disable per-surface via config flag, test at multiple angles |
| Decal Z-fighting despite triple defense | Low | Medium | Adjustable polygonOffset factors, position offset |
| Atlas texture bleeding at tile edges | Low | Medium | 2px gutter with edge padding, ClampToEdge wrapping |
| Template JSON schema changes break existing rooms | Low | Low | Zod schema validation with clear errors, additive-only changes |
| Performance exceeds budget on integrated GPUs | Medium | Medium | Quality scaler levels 7-11 designed for this exact case |

---

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-02-09-scalable-texture-engine-brainstorm.md`
- Material creation: `src/rooms/RoomBuilder.ts:309-339` (buildPBRMaterial)
- InstancedMesh pattern: `src/rooms/RoomBuilder.ts:405-432` (model prop instancing)
- Quality scaler: `src/rendering/quality-scaler.ts` (levels 0-6)
- Asset manager: `src/loaders/asset-manager.ts` (ref-counted cache)
- Shader patterns: `src/rendering/particles/dust-in-light.ts` (ShaderMaterial exemplar)
- Room types: `src/rooms/room-data/types.ts` (RoomData interface)
- Placement bugs: `docs/solutions/rendering/great-hall-placement-bugs-and-model-aware-prevention.md`
- Pipeline architecture: `docs/solutions/architecture/hd2d-deferred-effects-pipeline.md`

### External References
- Three.js onBeforeCompile: [three.js ShaderLib meshphysical.glsl.js](https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib/meshphysical.glsl.js)
- Triplanar normals: [Ben Golus — Normal Mapping for Triplanar Shader](https://bgolus.medium.com/normal-mapping-for-a-triplanar-shader-10bf39dca05a)
- Stochastic tiling: [Inigo Quilez — Texture Repetition](https://iquilezles.org/articles/texturerepetition/)
- Three.js migration: [Three.js Migration Guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)

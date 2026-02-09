---
title: Scalable Texture Engine for AAA Room Density
date: 2026-02-09
status: decided
chosen_approach: hybrid-shader-decal
---

# Scalable Texture Engine for AAA Room Density

## What We're Building

A hybrid texture engine that combines **shader-based detail layers** (global surface quality) with an **instanced decal atlas system** (placed storytelling details), driven by **culture/mood templates** with Room Needs Engine overrides.

The goal: every surface in every room has unique character — cracks, stains, moss, wear patterns, soot, water damage — at HD-2D benchmark density (Octopath 2 / Triangle Strategy level) with zero manual per-room texture work.

## Why This Approach

### The Problem

The Great Hall currently has:
- PBR surfaces (floor/wall/ceiling) that tile uniformly across 24x14m
- 256 prop instances but **zero surface detail** between them
- No weathering, no decals, no surface storytelling
- Every square meter of floor looks identical

HD-2D benchmarks achieve density through:
1. **Layered detail** — grunge/dirt/wear overlaid on base PBR
2. **Decal saturation** — cracks, stains, moss scattered everywhere
3. **Material variation** — blend masks break tiling patterns
4. **Surface storytelling** — wear around doors, soot near hearths, water stains under windows

### Why Hybrid (Shader + Decals)

| System | What It Solves | Cost |
|--------|---------------|------|
| Shader detail layers | Global tiling breakup, subtle normal variation, grunge overlay on ALL surfaces | Zero draw calls — shader injection |
| Instanced decal atlas | Placed storytelling (cracks near columns, soot at hearth, wear at doorways) | Batched instancing — minimal draw calls |
| Templates | Scalability — every room auto-populated without manual work | Data only |

Neither system alone achieves the target. Shader layers eliminate tiling but can't tell stories. Decals tell stories but don't fix the underlying surface repetition. Together they're complete.

---

## Refined Technical Design

### 1. Shader Detail Injection — Exact Technique

**Hook point:** `MeshStandardMaterial.onBeforeCompile` with `customProgramCacheKey`.

All room surfaces are created via `buildPBRMaterial()` in `RoomBuilder.ts:309-339` (PBR path) or procedural builders (lines 341-353, 556-586). The injection wraps these materials after creation.

**Three.js r182 specifics:**
- All shaders are GLSL 300 es (WebGL1 removed in r163). Use `texture()` not `texture2D()`, `in`/`out` not `varying`.
- Chunk names to know: `map_fragment` (diffuse), `normal_fragment_maps` (normal perturbation), `roughnessmap_fragment` (roughness), `colorspace_fragment` (was `encodings_fragment`), `opaque_fragment` (was `output_fragment`).
- Must set `customProgramCacheKey` to unique string or Three.js may share compiled programs between injected and non-injected materials.
- Store `userData.shader = shader` in the callback for runtime uniform updates.

**Injection pattern (proven in Three.js r182):**

```typescript
material.onBeforeCompile = (shader) => {
  // 1. Merge custom uniforms
  Object.assign(shader.uniforms, {
    uDetailNormal: { value: detailNormalTex },
    uGrungeMap: { value: grungeTex },
    uDetailScale: { value: 6.0 },
    uGrungeIntensity: { value: 0.4 },
  });

  // 2. Vertex: add world-space varyings
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>
    out vec3 vWorldPos;
    out vec3 vWorldNrm;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    `#include <worldpos_vertex>
    vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vWorldNrm = normalize(mat3(modelMatrix) * objectNormal);`
  );

  // 3. Fragment: declare uniforms + varyings + helper functions
  shader.fragmentShader = shader.fragmentShader.replace(
    '#define STANDARD',
    `#define STANDARD
    uniform sampler2D uDetailNormal;
    uniform sampler2D uGrungeMap;
    uniform float uDetailScale;
    uniform float uGrungeIntensity;
    in vec3 vWorldPos;
    in vec3 vWorldNrm;
    // ... triplanar + stochastic helper functions ...`
  );

  // 4. Hook normal: blend detail normal after normal_fragment_maps
  // 5. Hook diffuse: multiply grunge after map_fragment
  // 6. Hook roughness: modulate after roughnessmap_fragment

  shader.userData = shader; // Store for runtime updates
};
material.customProgramCacheKey = () => 'hd2d-surface-v1';
```

**Three layers injected per surface:**

#### Layer A: Triplanar Detail Normal

High-frequency normal map (stone grain, wood fiber, micro-cracks) sampled via triplanar projection in world space. Blended into the surface normal after `normal_fragment_maps`.

```glsl
vec3 triplanarDetailNormal(vec3 wPos, vec3 wNrm, sampler2D detMap, float scale) {
    // Blend weights from world normal (sharpness=4 for HD-2D)
    vec3 blend = pow(abs(wNrm), vec3(4.0));
    blend /= (blend.x + blend.y + blend.z + 0.0001);

    // Sample 3 projections
    vec3 tnX = texture(detMap, wPos.zy * scale).rgb * 2.0 - 1.0;
    vec3 tnY = texture(detMap, wPos.xz * scale).rgb * 2.0 - 1.0;
    vec3 tnZ = texture(detMap, wPos.xy * scale).rgb * 2.0 - 1.0;

    // Whiteout blend into world space (Ben Golus technique)
    vec3 nX = vec3(tnX.z * sign(wNrm.x), tnX.y, tnX.x);
    vec3 nY = vec3(tnY.x, tnY.z * sign(wNrm.y), tnY.y);
    vec3 nZ = vec3(tnZ.x, tnZ.y, tnZ.z * sign(wNrm.z));

    return normalize(nX * blend.x + nY * blend.y + nZ * blend.z) - wNrm;
}

// Injection after #include <normal_fragment_maps>:
normal = normalize(normal + triplanarDetailNormal(vWorldPos, vWorldNrm, uDetailNormal, uDetailScale) * 0.3);
```

Cost: 3 texture samples. For floors (dominant in HD-2D view), could reduce to biplanar (2 samples) since the Y-projection dominates.

#### Layer B: Stochastic Tiling Breakup

Eliminates visible tile repetition on the base PBR texture using Inigo Quilez's hash-based UV rotation technique. Replaces the standard `texture()` call in `map_fragment` with a 4-sample anti-tiling version.

```glsl
vec4 hash4(vec2 p) {
    return fract(sin(vec4(
        1.0+dot(p,vec2(37.0,17.0)), 2.0+dot(p,vec2(11.0,47.0)),
        3.0+dot(p,vec2(41.0,29.0)), 4.0+dot(p,vec2(23.0,31.0))
    )) * 103.0);
}

vec4 textureNoTile(sampler2D samp, vec2 uv) {
    ivec2 iuv = ivec2(floor(uv));
    vec2 fuv = fract(uv);
    vec4 ofa = hash4(vec2(iuv));
    vec4 ofb = hash4(vec2(iuv + ivec2(1,0)));
    vec4 ofc = hash4(vec2(iuv + ivec2(0,1)));
    vec4 ofd = hash4(vec2(iuv + ivec2(1,1)));
    vec2 ddx = dFdx(uv), ddy = dFdy(uv);
    ofa.zw = sign(ofa.zw-0.5); ofb.zw = sign(ofb.zw-0.5);
    ofc.zw = sign(ofc.zw-0.5); ofd.zw = sign(ofd.zw-0.5);
    vec2 b = smoothstep(0.25, 0.75, fuv);
    return mix(
        mix(textureGrad(samp, uv*ofa.zw+ofa.xy, ddx*ofa.zw, ddy*ofa.zw),
            textureGrad(samp, uv*ofb.zw+ofb.xy, ddx*ofb.zw, ddy*ofb.zw), b.x),
        mix(textureGrad(samp, uv*ofc.zw+ofc.xy, ddx*ofc.zw, ddy*ofc.zw),
            textureGrad(samp, uv*ofd.zw+ofd.xy, ddx*ofd.zw, ddy*ofd.zw), b.x),
        b.y
    );
}
```

Cost: 4 `textureGrad()` calls replacing 1 `texture()` call. `textureGrad()` is available in WebGL2/GLSL 300 es.

**Applied to:** `map_fragment` (diffuse), and optionally `normalmap_fragment`, `roughnessmap_fragment`. For normal maps, the XY components must be flipped when the UV mirror flag is set.

#### Layer C: Grunge Overlay

Low-frequency dirt/wear map multiply-blended onto the diffuse color. Triplanar-projected like the detail normal but at a larger scale (1-2x room dimensions). Tinted by template parameters.

```glsl
// After map_fragment:
vec3 grungeBlend = pow(abs(vWorldNrm), vec3(4.0));
grungeBlend /= (grungeBlend.x + grungeBlend.y + grungeBlend.z + 0.0001);
float gX = texture(uGrungeMap, vWorldPos.zy * 0.1).r;
float gY = texture(uGrungeMap, vWorldPos.xz * 0.1).r;
float gZ = texture(uGrungeMap, vWorldPos.xy * 0.1).r;
float grunge = gX * grungeBlend.x + gY * grungeBlend.y + gZ * grungeBlend.z;
diffuseColor.rgb *= mix(1.0, grunge, uGrungeIntensity);
```

Cost: 3 texture samples. Could be combined with detail normal into a single RGBA texture (RGB=normal, A=grunge) to reduce to 3 total samples for both layers.

**Total shader cost:** ~10 extra texture samples/pixel, ~0.5-0.8ms at 1080p. Well within budget given the existing post-processing stack already costs 3-4ms.

---

### 2. Instanced Decal Atlas System — Architecture

#### Atlas Layout

```
2048x2048 atlas, 8x8 grid = 64 decal slots
Each slot: 256x256 pixels (252x252 content + 2px gutter per side)
Separate atlases for diffuse (sRGB) and optional normal (linear)
```

**Decal categories in the atlas grid:**

| Row | Category | Slots | Examples |
|-----|----------|-------|---------|
| 0 | Floor cracks | 8 | hairline, wide, branching, corner, cobble-crack, flagstone-gap, etc. |
| 1 | Floor stains | 8 | water, wine, oil, blood, soot-circle, ale-ring, grease, rust |
| 2 | Floor organic | 8 | moss-patch, rushes-scatter, leaf-litter, dust-pile, root-crack, hay, etc. |
| 3 | Floor wear | 8 | path-wear, scuff-mark, drag-mark, boot-print-cluster, etc. |
| 4 | Wall damage | 8 | plaster-chip, mortar-wear, stone-crack, weathering-streak, etc. |
| 5 | Wall organic | 8 | wall-moss, water-stain, soot-deposit, lichen, damp-patch, etc. |
| 6 | Ceiling | 8 | smoke-stain, water-ring, cobweb, plaster-peel, beam-shadow, etc. |
| 7 | Special | 8 | culture-specific decals (ironwood-grain, hearth-scorch, etc.) |

#### Rendering — InstancedMesh with Per-Instance Atlas UV

```typescript
// One InstancedMesh per surface orientation (floor, walls, ceiling)
const floorDecals = new THREE.InstancedMesh(quadGeo, decalMat, MAX_FLOOR_DECALS);

// Per-instance attribute: atlas UV sub-region (vec4: offsetU, offsetV, scaleU, scaleV)
const uvRegions = new Float32Array(MAX_FLOOR_DECALS * 4);
const uvAttr = new THREE.InstancedBufferAttribute(uvRegions, 4);
floorDecals.geometry.setAttribute('aUvRegion', uvAttr);
```

**Material:** `MeshStandardMaterial` with `onBeforeCompile` to remap UVs per-instance:

```glsl
// Vertex: pass per-instance UV region to fragment
attribute vec4 aUvRegion;  // (offsetU, offsetV, scaleU, scaleV)
out vec4 vUvRegion;
// ...
vUvRegion = aUvRegion;

// Fragment: remap base UV to atlas sub-region
vec2 atlasUV = vUvRegion.xy + vMapUv * vUvRegion.zw;
vec4 sampledDiffuseColor = texture(map, atlasUV);
```

**Z-fighting prevention (three defenses):**
1. `depthWrite: false` — decals don't write depth
2. `polygonOffset: true, polygonOffsetFactor: -4` — GPU biases toward camera
3. Position offset: 0.005 units above surface along surface normal

**Wall decals:** Same system but the quad geometry is oriented vertically (no `rotateX`). Each wall decal instance encodes which wall it belongs to and gets positioned with the appropriate normal offset.

#### Performance

500 floor decals = 1 draw call. 200 wall decals = 1 draw call. 100 ceiling decals = 1 draw call.
Total: **3 extra draw calls** for the entire decal system, regardless of decal count.

---

### 3. Template Design & Data Model

#### Template JSON Structure

```jsonc
// scripts/room-needs/templates/northern-grand.json
{
  "id": "northern-grand",
  "name": "Northern Grand Hall",
  "description": "Ironwood halls with stone floors — sturdy, ancient, well-used",

  // Shader layer parameters
  "shaderLayers": {
    "detailNormal": {
      "texture": "assets/textures/detail/stone-micro-normal.jpg",
      "scale": 6.0,          // Tiles at 6x base frequency
      "intensity": 0.3       // Normal blend strength
    },
    "grunge": {
      "texture": "assets/textures/detail/northern-grunge.jpg",
      "scale": 0.1,          // Large-scale (10m period)
      "intensity": 0.35,     // Moderate dirt
      "tint": [0.85, 0.80, 0.72]  // Warm brown tint
    },
    "tilingBreakup": {
      "enabled": true,
      "appliesTo": ["floor", "wall", "ceiling"]
    }
  },

  // Decal atlas configuration
  "decals": {
    "atlas": "assets/textures/decals/northern-atlas.png",
    "normalAtlas": "assets/textures/decals/northern-atlas-normal.png",

    // Per-surface density targets (decals per sq meter)
    "density": {
      "floor": 2.5,
      "wall": 1.0,
      "ceiling": 0.5
    },

    // Palette: which atlas tiles to use and their relative weights
    "palette": {
      "floor": [
        { "tile": [0,0], "weight": 3, "scaleRange": [0.3, 0.8] },  // hairline crack
        { "tile": [1,0], "weight": 2, "scaleRange": [0.5, 1.2] },  // wide crack
        { "tile": [0,1], "weight": 2, "scaleRange": [0.4, 0.7] },  // water stain
        { "tile": [3,1], "weight": 1, "scaleRange": [0.3, 0.5] },  // soot circle
        { "tile": [0,2], "weight": 3, "scaleRange": [0.5, 1.5] },  // moss patch
        { "tile": [1,2], "weight": 2, "scaleRange": [0.3, 0.8] },  // rushes scatter
        { "tile": [0,3], "weight": 4, "scaleRange": [0.6, 1.0] },  // path wear
        { "tile": [1,3], "weight": 2, "scaleRange": [0.3, 0.6] }   // scuff mark
      ],
      "wall": [
        { "tile": [0,4], "weight": 2, "scaleRange": [0.3, 0.6] },  // plaster chip
        { "tile": [2,4], "weight": 1, "scaleRange": [0.4, 0.8] },  // stone crack
        { "tile": [0,5], "weight": 3, "scaleRange": [0.5, 1.2] },  // wall moss
        { "tile": [1,5], "weight": 2, "scaleRange": [0.3, 0.7] }   // water stain
      ],
      "ceiling": [
        { "tile": [0,6], "weight": 3, "scaleRange": [0.8, 2.0] },  // smoke stain
        { "tile": [2,6], "weight": 1, "scaleRange": [0.3, 0.6] }   // cobweb
      ]
    }
  },

  // Zone rules — modify density near specific features
  "zones": [
    {
      "trigger": "fire-source",      // Hearths, braziers, torches
      "radius": 3.0,                 // meters
      "effects": {
        "decalBoost": { "soot-circle": 3.0, "smoke-stain": 2.0 },
        "grungeBoost": 0.15,
        "excludeDecals": ["moss-patch", "water-stain"]
      }
    },
    {
      "trigger": "door",
      "radius": 2.0,
      "effects": {
        "decalBoost": { "path-wear": 4.0, "scuff-mark": 2.0 },
        "grungeBoost": 0.1
      }
    },
    {
      "trigger": "water-source",     // Windows (rain), fountains
      "radius": 2.5,
      "effects": {
        "decalBoost": { "water-stain": 3.0, "moss-patch": 2.0 },
        "excludeDecals": ["soot-circle"]
      }
    },
    {
      "trigger": "high-traffic",     // Between doors, around throne, at table
      "radius": 1.5,
      "effects": {
        "decalBoost": { "path-wear": 5.0, "scuff-mark": 3.0 },
        "excludeDecals": ["moss-patch", "rushes-scatter"]
      }
    }
  ]
}
```

#### Density Calculation

For the Great Hall (24x14m = 336 sq m):
- Floor decals: `336 * 2.5 = 840` decals
- Wall decals: `(24+14)*2 * 10 * 1.0 = 760` (perimeter * height * density) — realistically ~400 visible
- Ceiling decals: `336 * 0.5 = 168` decals
- **Total: ~1,400 decals** across 3 draw calls

#### Zone Rule Execution

The `DecalPlacer` resolves zones at placement time (build step, not runtime):

1. Scatter base decals using weighted random from palette at density target
2. For each zone trigger in the room (fire sources from lights, doors from DoorDef, etc.):
   - Find all decals within `radius` of the trigger position
   - Boost specified decal type weights (spawn more of those types)
   - Exclude specified types (remove any that landed in the zone)
3. Apply grunge intensity boost to shader uniforms per zone (baked into a per-room grunge modulation map, or handled via a simple proximity uniform array)

---

### 4. Integration with Existing Systems

#### RoomBuilder.ts Integration

```
buildRoom(data: RoomData)
  ├── Create floor/wall/ceiling materials (existing)
  ├── NEW: Wrap materials with ShaderDetailInjector
  │   └── injectSurfaceDetail(material, template.shaderLayers)
  ├── Create lights, props, particles (existing)
  ├── NEW: Create DecalSystem
  │   ├── Load atlas from template.decals.atlas
  │   ├── Run DecalPlacer with template + room dimensions + zone triggers
  │   └── Create InstancedMesh for floor/wall/ceiling decals
  └── Return BuiltRoom (add decalMeshes to group)
```

**Exact hook in RoomBuilder.ts:**

After `buildPBRMaterial()` returns (line ~339), wrap the result:
```typescript
const floorMat = await buildPBRMaterial(...);
injectSurfaceDetail(floorMat, template.shaderLayers, 'floor');
```

After all props are built (~line 275), create decals:
```typescript
const decalSystem = await buildDecalSystem(data, template, group);
```

#### RoomData types.ts Extension

```typescript
// New field on RoomData
interface RoomData {
  // ... existing fields ...
  textureTemplate?: string;  // Template ID, e.g. 'northern-grand'
  decalOverrides?: DecalOverride[];  // Room-specific decal placements
}

interface DecalOverride {
  tile: [number, number];  // Atlas grid position
  position: Vec3;
  rotation?: number;
  scale?: number;
}
```

#### RoomManager.ts — Disposal

Add to `unloadCurrentRoom()`:
```typescript
// Dispose decal InstancedMesh
for (const decalMesh of this.currentRoom.decalMeshes) {
  decalMesh.geometry.dispose();
  (decalMesh.material as THREE.Material).dispose();
}
// Release atlas textures
assetManager.releaseTexture(`decal-atlas-${roomData.textureTemplate}`);
assetManager.releaseTexture(`detail-normal-${roomData.textureTemplate}`);
assetManager.releaseTexture(`grunge-${roomData.textureTemplate}`);
```

#### Quality Scaler Extension

Add new levels to `quality-scaler.ts`:

| Level | Action | Savings |
|-------|--------|---------|
| Existing 0-6 | (unchanged) | — |
| New 7 | Disable ceiling decals | ~0.05ms |
| New 8 | Reduce floor decal count by 50% | ~0.1ms |
| New 9 | Disable grunge overlay | ~0.2ms |
| New 10 | Disable detail normal + tiling breakup | ~0.5ms |
| New 11 | Disable all decals | ~0.15ms |

Decals and shader layers are the cheapest effects, so they degrade last (after bloom, SSAO, tilt-shift, god rays).

#### Asset Manager

New cache entries:
- `loadTexture('decal-atlas-{templateId}', ...)` — ref-counted atlas
- `loadTexture('detail-normal-{templateId}', ...)` — ref-counted detail normal
- `loadTexture('grunge-{templateId}', ...)` — ref-counted grunge map

Shared across rooms that use the same template (e.g., all northern rooms share `northern-grand` textures).

#### Room Needs Engine — Manifest Extension

Add optional `textureLayer` section to manifest schema:

```jsonc
{
  "layers": { /* existing prop layers */ },
  "textureLayer": {
    "template": "northern-grand",
    "overrides": {
      "shaderLayers": {
        "grungeIntensity": 0.5  // Override: dirtier than template default
      },
      "decals": [
        // Room-specific placed decals
        { "tile": [3,1], "position": {"x": 0, "y": 0.005, "z": -2}, "scale": 1.5 }
      ],
      "zoneHints": [
        // Additional zone triggers beyond auto-detected ones
        { "type": "high-traffic", "position": {"x": 0, "z": 0}, "radius": 3.0 }
      ]
    }
  }
}
```

The `write-room-data.mjs` script would emit the template reference and any overrides into the generated TypeScript.

---

## File Structure

```
src/rendering/
  hd2d-surface/
    surface-injector.ts    — onBeforeCompile wrapper for MeshStandardMaterial
    surface-shader.glsl.ts — GLSL helper functions (triplanar, stochastic, grunge)
    decal-system.ts        — InstancedMesh decal renderer + placer
    decal-atlas.ts         — Atlas region math, texture loading
    texture-template.ts    — Template loader + zone rule resolver

scripts/room-needs/
  templates/
    northern-grand.json
    northern-intimate.json
    dungeon-damp.json
  schemas/
    texture-template.mjs   — Zod schema for template validation

public/assets/textures/
  detail/
    stone-micro-normal.jpg    — 512x512 detail normal (stone grain)
    wood-micro-normal.jpg     — 512x512 detail normal (wood fiber)
    northern-grunge.jpg       — 512x512 grunge overlay
  decals/
    northern-atlas.png        — 2048x2048 decal atlas (sRGB)
    northern-atlas-normal.png — 2048x2048 decal normal atlas (linear)
```

## Open Questions

1. **Decal atlas authoring** — Generate procedurally at build time (noise-based), hand-paint, or AI-generate? A mix is likely best: procedural for generic (cracks, stains), hand-painted for cultural specifics (ironwood grain patterns).

2. **Dynamic decals** — Should decals respond to game state? (Blood splatter after combat, scorch marks from spells.) Not needed for MVP but the instanced system supports it trivially — just increment `mesh.count` and set new instance data.

3. **Grunge zone modulation** — Should zone-based grunge boost be done via a baked 2D modulation texture per room, or via a uniform array of zone positions sampled in the shader? Baked texture is simpler and cheaper; uniform array is more flexible.

4. **Props shader injection** — Should GLB prop materials also get detail normal injection? Would add micro-detail to props but requires traversing all meshes and patching their materials. Could be a phase 2 enhancement.

## Performance Budget

| Component | Draw Calls | Texture Samples/Pixel | Est. Cost |
|-----------|-----------|----------------------|-----------|
| Stochastic tiling | 0 (same material) | +12 (4 samples x 3 PBR maps) | ~0.3ms |
| Triplanar detail normal | 0 (same material) | +3 (3 projections) | ~0.2ms |
| Grunge overlay | 0 (same material) | +3 (3 projections) | ~0.1ms |
| Floor decals (840 instances) | +1 | 1 per decal pixel | ~0.05ms |
| Wall decals (400 instances) | +1 | 1 per decal pixel | ~0.05ms |
| Ceiling decals (168 instances) | +1 | 1 per decal pixel | ~0.02ms |
| **Total additional** | **+3** | **+19 peak** | **~0.72ms** |

Current frame budget: ~16.6ms (60fps). Current usage: ~8-10ms. This leaves 6-8ms headroom. The texture engine adds ~0.72ms — well within budget.

## Next Steps

Run `/workflows:plan` to create the implementation plan with phases, file changes, and acceptance criteria.

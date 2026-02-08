---
title: "feat: Comprehensive HD-2D Asset Overhaul — Props, Textures, Sprites & Parallax"
type: feat
date: 2026-02-06
---

# Comprehensive HD-2D Asset Overhaul — Props, Textures, Sprites & Parallax

## Overview

The HD-2D Red Keep engine is complete — 10 rooms, 6-pass post-processing pipeline, ECS architecture, async asset pipeline — but the scene is visually empty. Rooms render with 6 PBR texture sets, placeholder colored rectangles for sprites, zero 3D props, and no parallax backgrounds. This plan transforms the engine from a technical demo into a visually convincing HD-2D experience faithful to the Octopath Traveler / Dragon Quest III HD-2D aesthetic.

## Problem Statement

The current scene falls far short of realism because:

1. **No 3D props** — `assets/models/props/` is empty. Room data references model paths (`column-stone.glb`, `throne.glb`) that don't exist. All prop definitions silently fall back to procedural cylinders/boxes.
2. **Only 6 PBR texture sets** — All 10 rooms share variations of stone and wood. No metal, fabric, marble, carpet, or decorative surfaces exist.
3. **Placeholder sprites** — Player and NPCs render as solid-colored rectangles. No pixel art, no animation, no billboard rotation.
4. **No parallax backgrounds** — Only the Battlements room defines parallax layers, and even those have no image files. The UV scrolling system isn't fully wired up.
5. **Critical bugs** — Diffuse texture load failures crash entire rooms, DRACO-compressed models can't load through RoomBuilder, PBR textures are double-loaded and leaked, FlickerLight ECS entities accumulate across room transitions.

## Proposed Solution

A 6-phase overhaul that first fixes infrastructure bugs, then systematically populates all asset categories, and finally optimizes for production delivery.

**Art style target:** HD-2D faithful — detailed 3D environments with pixel-art 2D character sprites, heavy cinematic post-processing.

**Asset sourcing:** Mix of CC0 assets (Poly Haven, ambientCG, Sketchfab), procedural generation, and AI-assisted creation (CHORD for PBR map generation).

## Technical Approach

### Architecture

```
Asset Pipeline (enhanced)
├── Texture Pipeline
│   ├── Source: CC0 (Poly Haven, ambientCG) + AI (CHORD/PBRify)
│   ├── Process: toktx → KTX2 (ETC1S diffuse, UASTC normal/roughness)
│   ├── Load: KTX2Loader with JPG fallback
│   └── Cache: AssetManager ref-counted (fix: include normal+roughness)
├── Model Pipeline
│   ├── Source: CC0 (Sketchfab, Quaternius, KayKit)
│   ├── Process: gltf-transform optimize --compress draco --texture-compress ktx2
│   ├── Load: GLTFLoader + DRACOLoader (fix: wire through RoomBuilder)
│   └── Render: InstancedMesh (single mesh) or Group (multi-mesh)
├── Sprite Pipeline
│   ├── Source: itch.io/OpenGameArt + Aseprite creation
│   ├── Format: 32x48 pixel-art PNG spritesheets, NearestFilter
│   ├── Animation: New SpriteAnimator system (UV offset per frame)
│   └── Billboard: Y-axis-only rotation (computed once per frame)
└── Parallax Pipeline
    ├── Source: itch.io/CraftPix + custom Aseprite layers
    ├── Format: Wide PNG with alpha, RepeatWrapping on S
    ├── Scroll: UV offset driven by camera X position
    └── Layers: 4-5 per outdoor room, varying scrollFactor
```

### Implementation Phases

---

#### Phase 1: Technical Foundation (Bug Fixes & Infrastructure)

Fix critical bugs and build missing infrastructure before adding any assets. Every subsequent phase depends on this.

**1.1 Fix DRACO Loader Wiring in RoomBuilder**
- File: `src/rooms/RoomBuilder.ts:333`
- Bug: `buildModelProp()` creates a bare `GLTFLoader` without DRACO or KTX2 support
- Fix: Accept `LoaderSet` from `createLoaders()` as a parameter to `buildRoom()`. Pass through `RoomManagerDeps`. Use `loaderSet.gltfLoader` instead of creating a new one.
- Verification: Place a DRACO-compressed `.glb` in `public/assets/models/props/` and confirm it loads

**1.2 Fix Diffuse Texture Load Crash**
- File: `src/loaders/texture-loaders.ts:88`
- Bug: `loadPBRTexture()` wraps normal and roughness loads in `.catch(() => null)` but leaves diffuse unwrapped — a missing diffuse.jpg crashes the entire room load
- Fix: Wrap diffuse load in `.catch(() => null)` and fall back to a procedural white texture. Add try/catch around `buildPBRMaterial()` in `buildRoom()`.
- Verification: Reference a nonexistent texture path in room data; room loads with procedural fallback and console warning

**1.3 Fix PBR Texture Double-Load and Leak**
- File: `src/rooms/RoomBuilder.ts:272-279`
- Bug: `loadPBRTextureSet()` calls `assetManager.loadTextureAsync()` (caches diffuse only), then calls `loadPBRTexture()` again (loads normal+roughness a second time, uncached)
- Fix: Extend `AssetManager` to cache the full `PBRTextureSet` (diffuse + normal + roughness + ao) as a unit. Single load path, single cache entry.
- Verification: Load/unload a room 10 times; `renderer.info.memory.textures` returns to baseline each time

**1.4 Fix FlickerLight Entity Leak**
- File: `src/ecs/systems/room-transition.ts`
- Bug: `FlickerLight` ECS entities are created per room load but never destroyed on room unload. After 10 transitions, 70+ orphaned entities exist referencing disposed Three.js lights.
- Fix: Track created FlickerLight entity handles in `BuiltRoom`. On room unload, destroy all associated entities.
- Verification: Profile ECS entity count across 20 room transitions; count returns to baseline

**1.5 Add Billboard Rotation System**
- File: `src/rendering/sprite-factory.ts`
- Gap: `createSpriteMesh()` creates a PlaneGeometry but applies no rotation. Sprites appear edge-on from most camera angles.
- Fix: Add Y-axis-only cylindrical billboard. Since the camera angle is fixed (35° FOV, only translates to follow player), compute the billboard rotation once per frame and apply to all sprite meshes. Store sprite meshes in a registry for batch updates.
- Implementation:
  ```typescript
  // In render loop or a new BillboardSystem:
  const yRot = Math.atan2(camera.position.x - sprite.position.x,
                           camera.position.z - sprite.position.z);
  sprite.rotation.y = yRot;
  ```
- Verification: Walk player east/west; NPC sprites always face the camera without tilting

**1.6 Wire Parallax UV Scrolling**
- File: `src/rooms/RoomManager.ts:252-260`
- Gap: Parallax scrolling exists but uses a magic number (`0.01`) and only scrolls horizontally. No documentation of expected behavior.
- Fix: Normalize scroll offset to room width. Use `scrollFactor` from `ParallaxLayerDef` directly. Document the formula:
  ```typescript
  mat.map.offset.x = (cameraX / roomWidth) * scrollFactor;
  ```
- Verification: Enter Battlements room with placeholder parallax textures; layers scroll at different speeds

**1.7 Add aoMap Support to PBR Materials**
- File: `src/loaders/texture-loaders.ts` (PBRTextureSet interface), `src/rooms/RoomBuilder.ts` (buildPBRMaterial)
- Gap: `PBRTextureSet` only has diffuse/normal/roughness. No ambient occlusion map.
- Fix: Add optional `ao` field to `PBRTextureSet`. Load `ao.jpg` when present. Apply as `aoMap` on `MeshStandardMaterial`. Add `uv2` attribute to room geometry if missing.
- Verification: Add an AO map to one texture set; darker crevices visible in render

**1.8 Fix Multi-Mesh Model Support**
- File: `src/rooms/RoomBuilder.ts:342-349`
- Bug: `buildModelProp()` traverses the loaded GLTF scene and grabs only the first `THREE.Mesh`. Multi-mesh models (throne with cushion, table with plates) lose all secondary meshes.
- Fix: When instance count is 1, use the entire GLTF scene group. When count > 1, create an `InstancedMesh` per sub-mesh, grouped together.
- Verification: Load a multi-mesh GLB model; all sub-meshes render

**1.9 Add Per-Instance Rotation to ModelPropDef**
- File: `src/rooms/room-data/types.ts:104`
- Gap: `rotationY` is per-definition, not per-instance. Can't rotate individual chairs around a table.
- Fix: Change `positions` from `Vec3[]` to `Array<{ x: number; y: number; z: number; rotationY?: number }>`. Fall back to definition-level `rotationY` when per-instance is undefined.
- Verification: Small Council room chairs face inward around the table

**1.10 Self-Host WASM Decoders**
- File: `src/loaders/texture-loaders.ts:33,38`
- Risk: DRACO and KTX2 WASM decoders load from external CDNs (`gstatic.com`, `jsdelivr.net`). Fails behind firewalls or offline.
- Fix: Copy decoder files from `node_modules/three/examples/jsm/libs/draco/gltf/` and `node_modules/three/examples/jsm/libs/basis/` to `public/lib/`. Update paths.
- Verification: Block CDN domains in DevTools Network; decoders still load

**1.11 Add Sprite Animation System**
- New file: `src/rendering/sprite-animator.ts`
- Gap: No infrastructure exists for sprite animation. Phase 4 requires idle+walk animations but there's no UV offset animation, no state machine, no frame timing.
- Implementation:
  - `SpriteAnimator` class: Takes spritesheet dimensions (cols, rows), FPS, and a `THREE.Texture`
  - `update(dt)`: Advances frame counter, updates `texture.offset.x/y` for current frame
  - `play(animation)`: Switches animation row (idle = row 0, walkDown = row 1, etc.)
  - Integrate with render loop (not ECS — same pattern as particles)
- Verification: Create a test spritesheet with numbered frames; animation plays at correct FPS

**1.12 Fix Sprite Aspect Ratio**
- File: `src/rendering/sprite-factory.ts:26`
- Bug: Default mesh is 1.5x1.5 (square) but target sprites are 32x48 (2:3 ratio).
- Fix: Change default to `width = 1.0, height = 1.5` to match the 2:3 aspect ratio.
- Verification: Sprites render without stretching

---

#### Phase 2: PBR Textures (Expand Material Library)

Source and integrate 10+ new PBR texture sets to give each room a distinct visual identity.

**2.1 Texture Assignment Table**

| Room | Floor | Walls | Ceiling | Accent |
|------|-------|-------|---------|--------|
| 1. Throne Room | dark-stone (existing) | castle-wall-slates (existing) | dark-stone (existing) | **red-carpet** (new) |
| 2. Antechamber | rough-stone (existing) | stone-wall (existing) | dark-stone (existing) | — |
| 3. Small Council | **ornate-wood-panel** (new) | stone-wall (existing) | dark-stone (existing) | **green-fabric** (new) |
| 4. Hand's Solar | wood-planks (existing) | **plaster-wall** (new) | dark-stone (existing) | **leather-bound** (new) |
| 5. Grand Gallery | **polished-marble** (new) | castle-wall-slates (existing) | **vaulted-stone** (new) | **gold-trim** (new) |
| 6. Guard Post | rough-stone (existing) | worn-stone (existing) | dark-stone (existing) | **dark-iron** (new) |
| 7. Maegor's Holdfast | **mossy-stone** (new) | worn-stone (existing) | dark-stone (existing) | — |
| 8. Queen's Ballroom | **polished-marble** (shared) | **plaster-wall** (shared) | **painted-ceiling** (new) | **silk-tapestry** (new) |
| 9. Tower Stairwell | rough-stone (existing) | worn-stone (existing) | **brick-arch** (new) | — |
| 10. Battlements | rough-stone (existing) | castle-wall-slates (existing) | — (outdoor) | **weathered-stone** (new) |

**New texture sets needed: 12**

**2.2 Sourcing Strategy**

| Texture | Source | URL |
|---------|--------|-----|
| red-carpet | Poly Haven | `polyhaven.com/a/fabric_pattern_07` (recolor) |
| ornate-wood-panel | ambientCG | `ambientcg.com/view/Wood049` |
| green-fabric | Poly Haven | `polyhaven.com/a/fabric_pattern_05` (recolor) |
| plaster-wall | ambientCG | `ambientcg.com/view/Plaster003` |
| leather-bound | ambientCG | `ambientcg.com/view/Leather025` |
| polished-marble | Poly Haven | `polyhaven.com/a/white_marble_03` |
| vaulted-stone | ambientCG | `ambientcg.com/view/Rock035` |
| gold-trim | AI-generated (CHORD) | Generate from gold diffuse reference |
| dark-iron | Poly Haven | `polyhaven.com/a/rusty_metal_03` |
| mossy-stone | ambientCG | `ambientcg.com/view/Ground037` |
| painted-ceiling | AI-generated (CHORD) | Generate from medieval fresco reference |
| silk-tapestry | AI-generated (CHORD) | Generate from tapestry reference |
| brick-arch | ambientCG | `ambientcg.com/view/Bricks076` |
| weathered-stone | Poly Haven | `polyhaven.com/a/rock_wall_08` |

**2.3 Texture Processing Pipeline**

1. Download at 2K resolution from source
2. Resize to **1024x1024** for floors/walls, **512x512** for ceilings/accents
3. Ensure all images are 8-bit PNG (convert from JPG to avoid double-lossy)
4. Place at `public/assets/textures/{category}/{name}/diffuse.jpg`, `normal.jpg`, `roughness.jpg`, `ao.jpg`

**2.4 Update download-assets Script**

- File: `scripts/download-assets.mjs`
- Add new Poly Haven texture IDs and ambientCG URLs to the download list
- Add AO map downloads alongside existing diffuse/normal/roughness

**2.5 Update Room Data Files**

Update each room's `floorTexture`, `wallTexture`, `ceilingTexture` references to use the new texture sets per the assignment table above.

**2.6 Add Texture Color Tints**

For rooms sharing a base texture (e.g., polished-marble in both Grand Gallery and Queen's Ballroom), use the existing `colorTint` field in `TextureDef` to differentiate:
- Grand Gallery marble: slight warm gold tint `0xFFF8E7`
- Queen's Ballroom marble: cool blue-white tint `0xF0F0FF`

---

#### Phase 3: 3D Props (Furnish All Rooms)

Source, process, and place medieval castle props across all 10 rooms.

**3.1 Prop Inventory Per Room**

| Room | Required Props | Priority |
|------|---------------|----------|
| 1. Throne Room | Iron throne, stone columns (16), wall sconces (7), red carpet runner, throne steps, braziers (2), banners (4) | HIGH |
| 2. Antechamber | Wooden benches (4), coat rack, wall sconces (4), small table, rug | MED |
| 3. Small Council | Oval table, high-back chairs (7), map table, candelabra, bookshelf, wall sconces (4) | HIGH |
| 4. Hand's Solar | Writing desk, chair, bookshelf (2), candelabra, bed, wardrobe, rug, wall sconces (3) | MED |
| 5. Grand Gallery | Stone columns (12), display pedestals (6), armor stands (4), tapestries (8), wall sconces (8) | HIGH |
| 6. Guard Post | Weapon rack (3), table, stools (2), barrel (4), crate (6), torch holders (4) | MED |
| 7. Maegor's Holdfast | Heavy door frame, portcullis, murder holes, wall sconces (6), guard stations (2) | LOW |
| 8. Queen's Ballroom | Chandelier, columns (8), musician gallery, long tables (2), chairs (16), flower vases (4) | MED |
| 9. Tower Stairwell | Spiral stair section, wall sconces (4), small window frame, railing | LOW |
| 10. Battlements | Crenellations, watchtower, brazier (2), flag poles (3), catapult/ballista | LOW |

**Total unique prop models needed: ~30-35**

**3.2 Sourcing Strategy**

| Category | Models | Recommended Source |
|----------|--------|-------------------|
| Columns, archways | 3 variants | Quaternius "Medieval Dungeon Pack" |
| Tables, chairs, benches | 5 variants | KayKit "Medieval Interior Kit" |
| Barrels, crates, sacks | 4 variants | Kenney "Furniture Kit" or Poly Pizza |
| Candelabras, sconces, braziers | 3 variants | Sketchfab CC0 "medieval lighting" |
| Weapon racks, armor stands | 3 variants | Sketchfab CC0 "medieval weapons" |
| Bookshelves, desks, wardrobes | 4 variants | Quaternius "Fantasy Interior" |
| Thrones, pedestals, altars | 2 variants | Sketchfab CC0 "throne" |
| Carpet/rug meshes | 2 variants | Simple quad geometry with PBR material |
| Banners, tapestries | 3 variants | Simple plane geometry with texture |
| Structural (stairs, doors, crenellations) | 5 variants | Custom in Blender or Sketchfab |

**3.3 Model Processing Pipeline**

1. Download/export as GLB
2. Open in Blender: verify Y-up orientation, scale to world units (1 unit = 1 meter), center pivot
3. Validate polygon count:
   - Simple props (barrel, crate): 100-500 tris
   - Medium props (table, chair): 500-2,000 tris
   - Complex props (throne, chandelier): 2,000-5,000 tris
4. Export as GLB from Blender
5. Compress: `npx @gltf-transform/cli optimize input.glb output.glb --compress draco`
6. Verify file size < 100KB per model
7. Place at `public/assets/models/props/{name}.glb`

**3.4 Performance Budget Per Room**

| Metric | Budget |
|--------|--------|
| Total triangles | < 50,000 |
| Draw calls (props) | < 20 (using InstancedMesh for repeated props) |
| Total draw calls (room) | < 60 |
| Model file sizes (sum) | < 1MB per room |

**3.5 Update Room Data Files**

For each room, update the `props` array with correct model paths, positions, scales, and per-instance rotations (using the new per-instance rotation from Phase 1.9).

---

#### Phase 4: Character Sprites (Player & NPCs)

Create or source pixel-art sprites for the player character and 8 NPC types with idle and walk animations.

**4.1 Sprite Specifications**

| Parameter | Value |
|-----------|-------|
| Frame size | 32x48 pixels |
| Color palette | 12-20 colors per character (SNES-era limited palette) |
| Idle animation | 4 frames at 4 FPS |
| Walk animation | 4 frames at 8 FPS |
| Directions | 1 (facing camera — HD-2D convention with fixed camera) |
| Spritesheet layout | 4 columns x 2 rows (row 0: idle, row 1: walk) = 128x96 PNG |
| Rendering | `NearestFilter`, no mipmaps, `alphaTest: 0.5` |
| Mesh size | 1.0 x 1.5 world units (2:3 aspect ratio) |

**4.2 Character Types**

| Type | Sprite Path | Description | Rooms |
|------|------------|-------------|-------|
| Player Knight | `assets/sprites/player/knight.png` | Armored knight, silver/blue palette | All |
| Kingsguard | `assets/sprites/npcs/kingsguard.png` | White-cloaked guard, gold armor | Throne Room, Grand Gallery, Maegor's |
| Courtier | `assets/sprites/npcs/courtier.png` | Noble in fine robes, varies per room | Throne Room, Antechamber, Ballroom |
| Servant | `assets/sprites/npcs/servant.png` | Simple brown/grey clothing | Antechamber, Ballroom, Solar |
| Maester | `assets/sprites/npcs/maester.png` | Grey robes, chain necklace | Small Council, Solar |
| Lord/Lady | `assets/sprites/npcs/noble.png` | Rich embroidered clothing | Throne Room, Ballroom |
| Soldier | `assets/sprites/npcs/soldier.png` | Leather armor, spear | Guard Post, Battlements |
| Bard | `assets/sprites/npcs/bard.png` | Colorful clothing, lute | Ballroom |
| Prisoner | `assets/sprites/npcs/prisoner.png` | Tattered rags | Maegor's Holdfast |

**4.3 Sourcing Strategy**

1. **Primary:** Search itch.io for CC0/CC-BY medieval pixel-art character packs at 32x48 resolution
   - Recommended: [Pixel Frog "Kings and Pigs"](https://pixelfrog-assets.itch.io/kings-and-pigs), [GrafxKid "RPG Characters"](https://grafxkid.itch.io/)
2. **Secondary:** Commission via PixelLab AI, then manual cleanup in Aseprite
3. **Fallback:** Create custom sprites in Aseprite following the limited palette guide

**4.4 Integration**

1. Place spritesheets at paths referenced in room data NPC definitions
2. Wire `SpriteAnimator` (from Phase 1.11) to each NPC sprite mesh
3. Player sprite gets walk animation driven by `MovementIntent` component
4. NPCs play idle animation continuously
5. Update room data files: change `spritePath` from `knight-idle.png` to `knight.png` (full spritesheet)

---

#### Phase 5: Parallax Backgrounds

Create layered parallax backgrounds for outdoor rooms and rooms with significant window openings.

**5.1 Rooms with Parallax**

| Room | Parallax Type | Layers | Description |
|------|--------------|--------|-------------|
| 10. Battlements | Full outdoor | 5 | Sky, distant bay, city rooftops, mid buildings, near walls |

All other rooms are fully enclosed interior spaces — god rays through directional lights serve the "window" effect without needing parallax.

**5.2 Battlements Parallax Specification**

| Layer | Content | Dimensions | scrollFactor | depth |
|-------|---------|-----------|--------------|-------|
| 0 | Gradient sky (dawn/dusk) | 1920x540 | 0.0 (static) | 25 |
| 1 | Blackwater Bay, distant shore | 2560x540 | 0.05 | 20 |
| 2 | King's Landing far rooftops | 3200x540 | 0.12 | 15 |
| 3 | Mid-distance buildings, sept | 3200x540 | 0.22 | 10 |
| 4 | Near buildings, Red Keep walls | 3840x540 | 0.35 | 5 |

**5.3 Sourcing Strategy**

1. **Primary:** Search itch.io for medieval city parallax backgrounds
   - Recommended: [CraftPix "Free Castle Pixel Game Backgrounds"](https://craftpix.net/freebies/free-castle-interior-pixel-game-backgrounds/), [Arludus "Medieval Backgrounds Pack"](https://arludus.itch.io/2d-pixel-art-medieval-backgrounds-pack)
2. **Secondary:** Create custom layers in Aseprite/Krita matching the sprite pixel density
3. Ensure horizontal tileability (seamless wrap for `RepeatWrapping`)

**5.4 Integration**

1. Place layer PNGs at `public/assets/backgrounds/battlements/layer-{0-4}.png`
2. Update `10-battlements.ts` parallax definitions with actual texture paths (currently placeholder)
3. Verify UV scrolling works correctly with the Phase 1.6 fix

---

#### Phase 6: Polish & Optimization

Optimize the full asset pipeline for production delivery.

**6.1 KTX2 Compression Build Script**

- New file: `scripts/compress-textures.mjs`
- Requires: `toktx` CLI (install from [KTX-Software releases](https://github.com/KhronosGroup/KTX-Software/releases))
- Process:
  1. Scan `public/assets/textures/` for all JPG files
  2. Compress diffuse maps with ETC1S: `toktx --encode etc1s --clevel 4 --qlevel 255 --genmipmap`
  3. Compress normal/roughness/ao maps with UASTC: `toktx --encode uastc --uastc_quality 4 --zcmp 22 --genmipmap --assign_oetf linear`
  4. Output to `public/assets/textures-ktx2/` (separate directory to preserve originals)
- Add `npm run compress-textures` to `package.json`
- Update `loadPBRTexture()` to try `.ktx2` first, fall back to `.jpg`

**6.2 DRACO Compression Build Script**

- New file: `scripts/compress-models.mjs`
- Process:
  1. Scan `public/assets/models/` for all GLB files
  2. Compress: `npx @gltf-transform/cli optimize input.glb output.glb --compress draco`
  3. Verify output size is < 100KB per model
- Add `npm run compress-models` to `package.json`

**6.3 VRAM Budget Monitoring**

- File: `src/debug/room-profiler.ts`
- Enhancement: Calculate estimated VRAM bytes (not just texture/geometry count):
  - Textures: `width * height * 4` bytes (uncompressed) or `width * height * bpp` (compressed)
  - Geometries: `vertexCount * attributeStride * 4` bytes
- Log warning when estimated VRAM exceeds budget
- Budget targets:
  - Desktop: < 200MB total VRAM
  - Mobile: < 100MB total VRAM

**6.4 Extended Quality Scaler**

- File: `src/rendering/quality-scaler.ts`
- Add additional degradation steps beyond post-processing:
  - Level 4: Reduce shadow map from 2048 to 1024
  - Level 5: Reduce particle count by 50%
  - Level 6: Reduce texture resolution (use mipmap bias)

**6.5 Asset Validation Script**

- New file: `scripts/validate-assets.mjs`
- Checks:
  - All model paths referenced in room data exist on disk
  - All sprite paths referenced in room data exist on disk
  - All texture base paths have diffuse.jpg (minimum)
  - Model polygon counts are within budget
  - Texture dimensions are powers of two
  - No duplicate model/texture files
- Run as part of CI or `npm run validate`

**6.6 License Tracking**

- New file: `assets/LICENSES.md`
- Track source URL, license type (CC0, CC-BY), and attribution for every external asset
- Validation: Script checks all asset files are listed in LICENSES.md

**6.7 GPU Resource Leak Testing**

- Automated test: Load/unload all 10 rooms in sequence, 3 full cycles
- Assert `renderer.info.memory.textures` and `renderer.info.memory.geometries` return to baseline after each unload
- Verify no FlickerLight entity accumulation (ECS entity count stable)

## Alternative Approaches Considered

**1. Full procedural generation** — Generate all textures and geometry at runtime using GLSL noise functions. Rejected because: impressive technically but doesn't match HD-2D aesthetic which relies on hand-crafted detail. Procedural reserved for fallbacks only.

**2. Purchased asset packs** — Buy premium medieval asset packs from Unity Asset Store / Sketchfab Store. Rejected because: CC0 sources provide sufficient quality for this scope, and purchased assets may have license restrictions on web distribution.

**3. Custom modeling all props** — Model every prop from scratch in Blender. Rejected because: 30+ models is a massive time investment. Sourcing CC0 models and adapting them is far more efficient.

**4. Sprite rendering via THREE.Sprite** — Use Three.js built-in Sprite class. Rejected because: THREE.Sprite applies full spherical billboard rotation which causes sprites to tilt backward at the 3/4 camera angle. PlaneGeometry with Y-axis-only billboard is correct.

## Acceptance Criteria

### Functional Requirements

- [ ] All 10 rooms render with distinct, room-appropriate PBR textures (no two adjacent rooms share identical materials)
- [ ] At least 3 unique 3D prop models visible per room (average 5+)
- [ ] Player character renders as a 32x48 pixel-art sprite with idle animation
- [ ] At least 8 NPC sprite types render with idle animations
- [ ] Battlements room has 4+ scrolling parallax background layers
- [ ] All sprites billboard correctly (Y-axis rotation, always face camera)
- [ ] Room transitions load/unload all assets without crashes or visual glitches

### Non-Functional Requirements

- [ ] No room takes longer than 2 seconds to load on first visit (desktop, broadband)
- [ ] 60 FPS maintained at quality level 0 on mid-range desktop GPU
- [ ] Total VRAM usage < 200MB with all rooms visited
- [ ] Total asset download size < 50MB (all textures + models + sprites + backgrounds)
- [ ] No GPU resource leaks after 20 consecutive room transitions
- [ ] All external assets are CC0 licensed and tracked in `assets/LICENSES.md`

### Quality Gates

- [ ] `npm run validate` passes (all referenced assets exist, within budgets)
- [ ] Room profiler shows draw calls < 60 per room
- [ ] No console errors or unhandled promise rejections during normal gameplay
- [ ] Visual comparison: scene feels "alive" and detailed compared to current placeholder state

## Success Metrics

1. **Visual density**: Average of 15+ visible objects per room (props + NPCs + particles)
2. **Material variety**: 15+ distinct PBR texture sets in use across all rooms
3. **Animation**: All character sprites animate (no static rectangles)
4. **Depth**: Battlements parallax creates convincing sense of distance
5. **Performance**: Maintains 60 FPS budget across all rooms on target hardware

## Dependencies & Prerequisites

| Dependency | Phase | Status |
|-----------|-------|--------|
| Three.js r182 | All | Installed |
| Becsy ECS v0.16 | Phase 1 | Installed |
| `toktx` CLI | Phase 6.1 | NOT installed — requires download from KTX-Software |
| `@gltf-transform/cli` | Phase 3.3, 6.2 | NOT installed — `npm install -D @gltf-transform/cli` |
| Blender (model processing) | Phase 3 | External tool, manual install |
| Aseprite (sprite creation) | Phase 4 | External tool, $20 or compile from source |

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CC0 model quality insufficient | Medium | Medium | Fall back to procedural geometry + PBR materials (textured boxes/cylinders) for low-priority rooms |
| Sprite art inconsistency across sources | Medium | High | Use limited color palette constraint; manual Aseprite cleanup pass on all sprites |
| VRAM budget exceeded | Medium | High | KTX2 compression (4x reduction), texture resolution scaling in quality scaler |
| CDN decoder failure | Low | Critical | Self-host WASM decoders (Phase 1.10) |
| Asset licensing issues | Low | Critical | Use ONLY CC0/public domain sources, track in LICENSES.md |
| Performance regression from asset volume | Medium | Medium | Phase 6 optimization pass, room profiler budgets, InstancedMesh for repeated props |

## Future Considerations

- **Animated props**: Swaying banners, flickering candle flames (ShaderMaterial animation)
- **Interactive props**: Openable chests, readable books (requires interaction system)
- **Weather effects**: Rain on Battlements, dust storms (particle system expansion)
- **Day/night cycle**: Timed lighting changes, parallax sky color shifting
- **Level of Detail (LOD)**: Swap high-poly props for low-poly at distance (not needed at current room scale)
- **Texture streaming**: Load textures progressively for rooms not yet visited (preload system)

## Documentation Plan

- Update `scripts/download-assets.mjs` with all new asset URLs
- Create `assets/LICENSES.md` tracking all external assets
- Update room data files with correct asset paths
- Add inline comments in `RoomBuilder.ts` for the new multi-mesh and per-instance rotation patterns

## References & Research

### Internal References

- Asset Manager: `src/loaders/asset-manager.ts` (ref-counted cache)
- Texture Loaders: `src/loaders/texture-loaders.ts` (KTX2/DRACO/GLTF setup)
- Room Builder: `src/rooms/RoomBuilder.ts` (PBR materials, instancing, parallax)
- Sprite Factory: `src/rendering/sprite-factory.ts` (billboard sprite creation)
- Room Data Types: `src/rooms/room-data/types.ts` (all type definitions)
- Quality Scaler: `src/rendering/quality-scaler.ts` (adaptive quality)
- Room Profiler: `src/debug/room-profiler.ts` (performance monitoring)
- HD-2D Visual Analysis: `docs/research/hd2d-visual-analysis-deep-dive.md`
- Medieval Architecture Reference: `docs/research/medieval-castle-architecture-red-keep.md`

### External References

- Poly Haven (CC0 textures): https://polyhaven.com/textures
- ambientCG (CC0 textures): https://ambientcg.com
- Sketchfab CC0 models: https://sketchfab.com/search?type=models&licenses=7c23a1ba438d4306920229c12afcb5f9
- Quaternius free packs: https://quaternius.com
- KayKit medieval assets: https://kaylousberg.com/game-assets
- KTX-Software (toktx): https://github.com/KhronosGroup/KTX-Software
- gltf-transform CLI: https://gltf-transform.dev/cli
- Ubisoft CHORD (AI PBR): https://github.com/ubisoft/ubisoft-laforge-chord

### Institutional Learnings Applied

- GPU resource disposal order: clear refs → remove from scene → dispose (from `docs/solutions/code-review/pre-commit-review-hd2d-mvp.md`)
- Convolution effects need separate EffectPass (from `docs/solutions/architecture/hd2d-deferred-effects-pipeline.md`)
- Non-ECS particle/sprite pattern (from `docs/solutions/architecture/non-ecs-particle-integration-pattern.md`)
- Data-driven room architecture (from `docs/solutions/architecture/data-driven-room-system-pattern.md`)
- Becsy ECS entity handle constraints (from `docs/solutions/runtime-errors/becsy-ecs-api-runtime-crashes.md`)

### Related Work

- Original brainstorm: `docs/brainstorms/2026-02-05-red-keep-hd2d-mvp-brainstorm.md`
- Original plan: `docs/plans/2026-02-05-feat-hd2d-red-keep-mvp-plan.md`

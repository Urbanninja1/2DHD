---
title: "Ironrath Great Hall AAA Vertical Slice"
type: feat
date: 2026-02-08
deepened: 2026-02-08
reviewed: 2026-02-08
second-review: 2026-02-08
brainstorm: docs/brainstorms/2026-02-08-ironrath-aaa-vertical-slice-brainstorm.md
---

# Ironrath Great Hall AAA Vertical Slice

## Enhancement Summary

**Deepened on:** 2026-02-08 | **Reviewed on:** 2026-02-08 | **Second review on:** 2026-02-08
**Research agents (deepening):** architecture-strategist, performance-oracle, kieran-typescript-reviewer, code-simplicity-reviewer, pattern-recognition-specialist, best-practices-researcher, framework-docs-researcher, learnings-analyzer, codebase-explorer, Context7 (Three.js docs), web research (HD-2D techniques, GLTFExporter Node.js, three-bvh-csg, procedural PBR)
**Review agents (first validation):** architecture-strategist, performance-oracle, kieran-typescript-reviewer, code-simplicity-reviewer, pattern-recognition-specialist, HD-2D lighting researcher, Three.js particle systems researcher, procedural prop generation researcher
**Review agents (second validation):** dhh-rails-reviewer (philosophy review), kieran-typescript-reviewer (TypeScript architecture), code-simplicity-reviewer (minimalism review)

### Key Improvements from Research (First Review)

1. **Consolidate 25 prop scripts → 1 catalog-driven script** — matches existing `generate-sprites.mjs` pattern, eliminates ~24 files (5/5 reviewers agree)
2. **Extract `ParticleSystem` interface** — replaces growing union type, uses `object3d: THREE.Object3D` to support both Points and InstancedMesh (4/5 reviewers)
3. **Extract `SpawnRegion` type** — eliminates 5x duplication of the same 6-field inline object (3/5 reviewers)
4. ~~**Extract particle factory**~~ — **CUT in second review** (see below)
5. **Reduce particle types from 6 → 4** — cut falling ash (use dust-motes with `driftDirection`) and ground mist (contradictory in heated room)
6. **Replace DecalGeometry → flat textured quads** — walls/floors are flat planes, DecalGeometry is overkill (3/5 reviewers)
7. **Defer day/night cycle** — no visible impact until environment is complete (YAGNI)
8. **Defer in-room parallax** — 0.02 scroll factor is imperceptible; use vertex shader sway if needed later
9. **Cap lights at 10 point + 1 shadow directional** — performance oracle estimates 15 lights pushes to 13-24ms; 11 lights validated by HD-2D lighting research
10. ~~**Add `lightRole` field to LightDef**~~ — **CUT in second review** (see below)
11. **Add GLTFExporter spike as first step** — de-risk the entire prop pipeline before committing to it
12. **Use `node-three-gltf` package** — proven Node.js GLB export without DOM polyfills
13. **Set `StreamDrawUsage` on particle buffers** — documented 10x improvement in one case study
14. **Use `Promise.all` for model loading** — prevents sequential 25-fetch stall during room transitions (P0 must-fix per performance review)
15. **Add per-instance color/scale jitter to InstancedMesh** — prevents "copy-paste" look on repeated props
16. **Use `InstancedBufferGeometry` for smoke** — not `InstancedMesh.setMatrixAt()`. Only 5 floats/instance (center + scale + alpha) vs 16 for full matrix. Billboarding in vertex shader.
17. **Use `MeshBasicMaterial` for surface detail quads** — decals don't need 11-light PBR shading, saves ~0.5-1ms
18. **Reduce point light `distance` from 22→10-12 units** — limits per-fragment light evaluation to nearby meshes only
19. **Rename `updateParticles()` → `updateVisuals()`** in RoomManager — method already handles parallax scrolling
20. **Extract `buildParticleSystems()` helper** from `buildRoom()` — currently 283 lines heading toward 350+
21. **Merge day/night tinting into flicker system** — avoids double-writing light uniforms per frame
22. **Download PBR textures first** from Poly Haven — project already uses `download-assets.mjs` for CC0 textures; only generate procedurally what can't be downloaded

### Key Improvements from Second Review (3/3 reviewers)

23. **Restructure from 6 phases → 4 phases** — merge Phase 0 (spike) into Phase 1, merge Phase 4 (depth/surface) into Phase 2. Fewer context switches, same incremental verification. (3/3 reviewers)
24. **Cut `lightRole` from vertical slice entirely** — no consumer until day/night exists. Add when per-light tinting is built. (3/3 reviewers)
25. **Defer `PropBuilder` class + `BuildResourceTracker` extraction** — write Great Hall props inline first, extract shared framework after patterns emerge. Eliminates 2 premature files. (3/3 reviewers)
26. **Eliminate `particle-factory.ts`** — 4-branch switch statement is simpler than a factory file with `Record` types. Extract when 6+ types exist. (3/3 reviewers)
27. **Simplify day/night to color grading** — for ONE room, shifting post-processing hue/saturation by time-of-day achieves 90% visual impact. Cut `DayNightLightingSystem` and per-light tinting. (2/3 reviewers)
28. **Defer 64x96 sprite upgrade to post-vertical-slice** — environment is what makes the room look AAA, not sprite resolution. Use 32x48 sprites for vertical slice. Lower body is in tilt-shift blur anyway. (2/3 reviewers — DHH + simplicity)
29. **Merge `generate-textures.mjs` into prop generation** — textures serve props. One command, not two. (1/3 reviewers, accepted for simplicity)
30. **Eliminate `ironrath/index.ts` barrel file** — barrel re-export for 1 file is unnecessary. Import `great-hall.ts` directly. (1/3 reviewers, accepted for simplicity)
31. **Download PBR textures as primary path** — commit to downloading from Poly Haven/ambientCG via existing `download-assets.mjs`. Only generate procedurally for Ironrath-specific materials that don't exist online. (3/3 reviewers)
32. **Add A/B screenshot discipline at EVERY phase** — take screenshot after each phase, compare to Octopath references. Not just at the end. (3/3 reviewers)
33. **Add subjective quality gate** — "show to people who've played Octopath" is the real acceptance criteria, not a checklist. (2/3 reviewers)
34. **Add camera adjustment verification for double-height room** — camera at Y=18, Z=22 may need adjusting for height=10. (1/3 reviewers)
35. **Add draw call budget verification** — check `renderer.info.render.calls` at runtime after room load. (1/3 reviewers)
36. **Add fallback for procedural prop quality** — CSG furniture may not meet AAA bar; simpler geometry + better textures or flat billboard props as escape hatch. (2/3 reviewers)
37. **Add room connectivity build-time validation** — bidirectional doors need automated check, not just a checklist item. (1/3 reviewers)

### TypeScript-Specific Findings (Second Review — Kieran)

38. **Particle factory type safety gap** — the proposed `Record<type, (def: ParticleDef) => ...>` with `as` casts is not type-safe. Use `switch` with discriminated union narrowing instead (zero casts, exhaustiveness via `never`). **Resolved: factory file eliminated, switch inlined in `buildRoom()`.**
39. **`ParticleSystem` type migration explicit steps** — must delete `export type ParticleSystem = DustMoteSystem | EmberSystem` from `RoomBuilder.ts:18` AND update import in `RoomManager.ts:6`. Both changes required or build breaks.
40. **`gameClockInit` pattern inconsistency** — align with existing `transformInit()` return-object pattern, not imperative `entity.write()` style.
41. **`SpawnRegion`/`Vec3` shared types location** — currently buried in `room-data/types.ts`. At 36-room scale with many consumers, consider moving to shared `src/types/geometry.ts`. Acceptable for vertical slice.
42. **Remove `'ambient'` from `lightRole` union** (when lightRole is eventually added) — ambient light is a separate `RoomData` field, not in the `lights` array. The `'ambient'` role value is confusing.
43. **`FlickerLight` / day-night data flow gap** — `lightRole` lives on `LightDef` (room data) but ECS systems don't have access. When per-light tinting is built, either add `lightRole` to `FlickerLight` component or use a bridge object.
44. **`DustConfig` is not exported** — plan extends it with `driftDirection` but the factory will need access. Export it or handle extension internally.
45. **Room data subdirectory pattern** — `ironrath/great-hall.ts` introduces a nested pattern while Red Keep uses flat files (`01-throne-room.ts`). Acceptable inconsistency; migrate Red Keep later if desired.
46. **`mood` union too small** — current `'grand' | 'intimate' | 'dark' | 'open'` won't cover 36 rooms. Extend when needed or change to `string`.
47. **Normalize `lightDirection`** — `DustInLightParticleDef.lightDirection` is typed as `Vec3` but shader uses it as normalized direction. Normalize in constructor or add runtime assertion.

### New Considerations Discovered

- **Bidirectional door requirement**: Ironrath must define a door back from any connected room, or the player gets trapped
- **Becsy `.create` entitlements**: New systems creating entities at runtime must declare `.create` access or crash
- **Becsy `world.build()` single-call**: GameClock entity must be created inside the existing build call
- **Particle shader scale factor**: Must use `80.0` (not the original `300.0` that caused the snowstorm bug)
- **Point light distance**: Must be ≥1.5x room's largest dimension to reach walls
- **ECS system ordering**: GameClockSystem has a specific insertion point in execution order
- **Decal textures must go through AssetManager** or they leak GPU memory on room unload
- **`disposeRoom()` already catches InstancedMesh** via `instanceof THREE.Mesh` — no changes needed
- **Color grading `hue` is in radians**, not degrees
- **Three.js per-material light limit**: `MeshStandardMaterial` evaluates all in-range lights per fragment. Reducing `distance` is as important as reducing count.
- **Quality scaler has no light-count degradation level** — should add one (defer to post-vertical-slice)
- **Quality scaler `reduceParticles` flag is exposed but not wired** — new particle systems should accept a `qualityMultiplier` parameter (defer to post-vertical-slice)
- **RoomId 101 gap undocumented** — add `// 1-99: Red Keep, 100-199: Ironrath Castle` comment to singletons.ts
- **`GameClock.paused` may be redundant with `timeScale: 0`** — document that `paused` is a convenience flag; `timeScale = 0` stops the clock but `paused` allows UI to distinguish "paused" from "time-stopped"
- **Shadow map `autoUpdate = false`** in renderer config; shadow re-render triggered per room load. Day/night should NOT trigger per-frame shadow updates — only on major time-of-day transitions (dawn/dusk)
- **Flicker system handles 15+ lights trivially** — pre-computed 1024-sample noise table, ~0.01ms per light per frame
- **God rays constraint**: Only 1 GodraysPass per room (single light source per `three-good-godrays` architecture)
- **`node-three-gltf` on Windows**: May have native compilation issues. Test spike on Windows first. Fallback to `@gltf-transform/core` (programmatic GLB assembly, no Three.js DOM deps) if it fails.
- **Only 3-5 props need CSG** (hearth, throne, chandelier, weapon rack). Rest are simple primitive compositions. Don't over-invest in CSG pipeline.
- **`disposeRoom()` wall texture release is brittle** — hardcodes 4 wall texture releases. At 36 rooms with varying geometry, this will break. (Non-blocking for vertical slice)
- **`RoomManager.currentRoomId` init uses `1 as RoomIdValue`** cast — should be `RoomId.ThroneRoom` instead

---

## Overview

Transform the proof-of-concept HD-2D dungeon crawler into an AAA-quality vertical slice of **Ironrath Castle's Great Hall** (House Forrester). This plan covers 4 implementation phases that build on top of each other: prop generation + room shell, environmental density + depth, lighting & atmosphere, and NPCs + parallax + polish.

The existing 10-room Red Keep codebase is preserved on `main` — all Ironrath work happens on a `feat/ironrath-vertical-slice` branch. The current architecture (data-driven rooms, Becsy ECS, 6-pass post-processing pipeline, ref-counted AssetManager) is extended, not replaced.

**Quality target**: Visually comparable to Octopath Traveler / Triangle Strategy at screenshot resolution.

**Vertical slice "done" definition**: A single screenshot of the Great Hall at late-afternoon lighting that passes subjective human review against Octopath Traveler reference frames.

**Brainstorm reference**: All design decisions are documented in `docs/brainstorms/2026-02-08-ironrath-aaa-vertical-slice-brainstorm.md`.

### Research Insights: HD-2D Visual Technique

The HD-2D aesthetic (coined by Square Enix) combines pixel art sprites/billboards placed in a 3D scene with modern rendering effects. The core visual pillars are:

- **Tilt-shift depth of field**: Creates the diorama/miniature look. Top and bottom of frame are blurred, center stays sharp.
- **Dynamic point lighting with shadows**: A point light placed per scene creates character shadows on the environment.
- **Bloom on light sources**: Warm bloom on torches/candles sells the atmosphere.
- **Volumetric light shafts (god rays)**: Used selectively through windows for dramatic effect.
- **High-contrast warm/cool lighting**: Warm interior fires vs cool exterior daylight creates visual depth.

Sources:
- [Octopath Traveler HD-2D Style Analysis](https://samppy.com/octopath-travelers-hd-2d/)
- [Unreal Engine Spotlight: Octopath Traveler](https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true)
- [HD-2D Wikipedia](https://en.wikipedia.org/wiki/HD-2D)

---

## Problem Statement

The current rooms have 10-15 props, 3-7 lights, 2 particle types, and 32x48 sprites. AAA HD-2D rooms have 50-100+ props, 10-20 light sources with warm/cool contrast, 6-8 particle types, and high-resolution sprites. The gap is quantifiable:

| Element | Current PoC | AAA Target | Gap Factor |
|---------|------------|-----------|-----------|
| Props per room | 10-15 | 50-100+ | 5-10x |
| Light sources | 3-7 | 10-20+ | 3x |
| Particle types | 2 | 6-8 | 3-4x |
| Sprite resolution | 32x48 | 64x96 | 4x area |
| Depth planes | 1 (flat box) | 4+ (foreground, mid, far, parallax) | 4x |
| Surface detail | Flat PBR | Decals, splatting, normal overlays | New system |
| Time of day | None | Full day/night cycle | New system |

---

## Proposed Solution

4 sequential phases, each producing a testable, **screenshot-verifiable** increment. Take an A/B screenshot against Octopath Traveler references at the end of every phase. Each phase builds on the previous — no phase can be skipped.

---

## Technical Approach

### Existing Architecture (Preserved)

These systems are extended but NOT rewritten:

| System | File(s) | Role |
|--------|---------|------|
| Room data | `src/rooms/room-data/types.ts` | `RoomData` interface, prop/light/particle defs |
| Room builder | `src/rooms/RoomBuilder.ts` | `buildRoom()` → THREE.Group |
| Room manager | `src/rooms/RoomManager.ts` | Load/transition/unload lifecycle |
| Post-processing | `src/rendering/hd2d-pipeline.ts` | 6-pass EffectComposer |
| Asset manager | `src/loaders/asset-manager.ts` | Ref-counted texture/model/PBR cache |
| Particles | `src/rendering/particles/*.ts` | Dust motes + torch embers |
| Sprites | `src/rendering/sprite-factory.ts` | Billboard mesh creation |
| Camera | `src/ecs/systems/camera-follow.ts` | HD-2D angle (Y=18, Z=22), pixel-snap |
| ECS | `src/ecs/world.ts` | Becsy world with 8 systems |
| Registry | `src/rooms/room-data/registry.ts` | Room lookup map |
| Singletons | `src/ecs/components/singletons.ts` | RoomId enum, GameState |

### Key Documented Learnings (Must Follow)

From `docs/solutions/`:

1. **Never use negative brightness** in colorGrading — ambient light minimum 0.45, vignette max 0.50, floor color channels >= 0x30 (`invisible-floors-dark-room-lighting.md`)
2. **New particle types**: create in `src/rendering/particles/`, add variant to `ParticleDef` union, add case in `RoomBuilder.buildRoom()` — lifecycle is automatic (`non-ecs-particle-integration-pattern.md`)
3. **New post-processing effects**: determine if convolution (own pass) or non-convolution (merge into cheap pass), add to `HD2DSettings` interface (`hd2d-deferred-effects-pipeline.md`)
4. **New rooms**: add RoomId, create data file, register in registry, bidirectional doors (`data-driven-room-system-pattern.md`)
5. **Point light shadows**: NEVER enable — performance catastrophe. Only directional lights get shadows.
6. **Disposal order**: clear particle refs → remove from scene → dispose GPU resources.
7. **Particle shader scale factor**: Must use `80.0` — the original `300.0` caused particles to render as massive snowstorm blobs (`particle-scale-and-room-lighting-overhaul.md`)
8. **Becsy query API**: Use `.current`, never `.all` (does not exist in 0.16.0). Only one `world.build()` call allowed. Runtime entity creation requires `.create` entitlements (`becsy-ecs-api-runtime-crashes.md`)
9. **Particle ShaderMaterial**: Must set `depthWrite: false` and `frustumCulled = false` on Points, or z-fighting and disappearing particles result (`non-ecs-particle-integration-pattern.md`)
10. **Point light distance**: Must be ≥1.5x room's largest dimension to reach walls. Start brighter, let quality scaler handle low-end devices (`particle-scale-and-room-lighting-overhaul.md`)

### Research Insights: Architecture Principles

**From architecture review:**
- `buildRoom()` is growing toward a God Method (283 lines, will reach 350-400). Extract `buildParticleSystems()` helper in Phase 1 BEFORE adding new particle types.
- `RoomManager.updateParticles()` is misnamed — it already handles parallax scrolling. Rename to `updateVisuals()`.
- No circular dependencies are introduced. All new files are leaves in the dependency tree.
- SOLID principles are upheld. Room data extensions are additive (Open/Closed).

**From pattern analysis:**
- Consolidate prop generators into a single catalog-driven script matching the existing `generate-sprites.mjs` pattern.
- Extract shared PNG helpers (`hex()`, `setPixel()`, `fillRect()`, `createSheet()`) into `scripts/lib/png-helpers.mjs` — currently duplicated across `generate-sprites.mjs` and `generate-parallax.mjs`.
- ECS system files do NOT use a `-system` suffix. Name should be `game-clock.ts`, not `game-clock-system.ts`.
- Particle type discriminant convention: existing types use simple words (`'dust'`, `'embers'`). New multi-word types use kebab-case (`'dust-in-light'`). Document this convention.

**From second review (props-first, extract-after principle):**
- Write prop generation functions inline in `generate-ironrath-props.mjs` first.
- After Great Hall props are working, extract shared helpers into `scripts/lib/prop-builder.mjs` and `scripts/lib/procedural-textures.mjs` for the next 35 rooms.
- The right abstractions come from real code, not upfront framework design.

### Texture Strategy: Download First, Generate Second

**Decided (3/3 second-review agreement):** Download CC0 PBR textures from Poly Haven/ambientCG via existing `scripts/download-assets.mjs` for common materials (stone, wood, iron, leather). Only generate procedurally for Ironrath-specific materials that can't be found online (ironwood with its unusual sheen, Forrester banner fabric patterns).

### PBR Material Reference Values

**From best practices research (Physically Based database + Adobe PBR Guide):**

| Material | Metalness | Roughness | Albedo Base | Key Noise Pattern |
|----------|-----------|-----------|-------------|-------------------|
| Northern stone | 0.0 | 0.65-0.9 | `#4a4540` → `#5a5a5a` | Multi-octave simplex + Voronoi cells |
| Ironwood | 0.0 | 0.4-0.7 | `#1f1510` → `#2b1810` | Directional grain + growth rings + knot noise |
| Weathered iron | 0.7-1.0 (variable) | 0.25-0.8 | `#2a2a2a` → `#4a4a4a` | Base noise + rust patches + directional scratches |
| Aged leather | 0.0 | 0.5-0.8 | `#8b7355` → `#4b2413` | Base noise + cellular cracks + wear |
| Fabric/wool | 0.0 | 0.85-0.98 | `#1a1a1a` / `#2d5a27` | Sinusoidal warp/weft weave |
| Rushes/straw | 0.0 | 0.95 | `#8B7355` → `#A09060` | Random scattered fibers |

**Iron is the only material requiring a variable metalness map.** All others are dielectric (metalness = 0.0).
**glTF PBR packing**: metalness in B channel, roughness in G channel of a single `metallicRoughnessTexture`.
**Use `THREE.NoColorSpace`** for all maps except albedo, which uses `THREE.SRGBColorSpace`.
**Texture resolution: 256x256 is sufficient** for most props. Reserve 512x512 for hearth and throne only.

### Performance Budget (from performance oracle)

**Estimated frame time breakdown (proposed room at full quality):**

| Component | Estimated ms | Notes |
|-----------|-------------|-------|
| Forward render (11 lights, ~80 draw calls) | 4-6ms | Dominant cost — reduced from 17→11 lights |
| Shadow map (1x 2048 PCFSoft) | 1-2ms | Only on room load, NOT per-frame |
| N8AO SSAO | 2-3ms | Half-res helps |
| GodraysPass (60 raymarch steps) | 2-4ms | Heavy — first to degrade |
| BloomPass | 0.5-1ms | Medium kernel |
| TiltShiftPass | 0.5-1ms | Medium kernel |
| CheapPass (vignette+tone+color) | 0.2-0.5ms | Merged, cheap |
| Particle CPU update + upload | 0.3-0.8ms | ~300 particles, StreamDrawUsage |
| Light flicker | 0.1-0.2ms | 11 lights x noise table lookup |
| Parallax UV scroll | <0.1ms | Trivial |
| **Total** | **~11-18ms** | **Fits budget with quality scaler headroom** |

**Key performance mitigations (P0 = must-fix):**

| Priority | Mitigation | Savings |
|----------|-----------|---------|
| P0 | `Promise.all` for model loading in `buildRoom()` | 3-10s off room load |
| P0 | Cap at 11 lights (10 point + 1 shadow dir) | 2-4ms vs 17 lights |
| P0 | Reduce point light `distance` to 10-12 | 1-2ms fewer light evaluations |
| P1 | Move dust sine-drift to vertex shader (`uElapsed` uniform) | 0.3-0.5ms (eliminate CPU loop) |
| P1 | `MeshBasicMaterial` for surface detail quads | 0.5-1ms (skip PBR lighting) |
| P2 | Parallax layers: `side: THREE.FrontSide` only | Halve rasterized fragments |
| P2 | Merge 5 parallax layers into single-quad shader | 4 fewer draw calls |
| P2 | Switch PBR textures to KTX2/Basis Universal | ~50MB -> ~8-12MB VRAM |

---

## Implementation Phases

### Phase 1: GLB Spike + Prop Generation + Room Shell

**Goal**: Validate the GLB export pipeline, generate all Great Hall props, and create the empty room.

**Estimated quality lift**: 40% → 55% (props exist as GLB files, room shell renders)

#### 1.1 GLTFExporter Spike (De-Risk — Do First)

**New file**: `scripts/spike-glb-export.mjs`

A minimal test that:
1. Creates a `THREE.BoxGeometry` with a `MeshStandardMaterial`
2. Applies a procedural `DataTexture` (256x256, filled with simplex noise)
3. Exports to GLB using `GLTFExporter.parseAsync(scene, { binary: true })`
4. Writes to `public/assets/models/props/test-spike.glb`
5. Verifies file size > 0

**Critical: Use `DataTexture` exclusively** (not `CanvasTexture`) in build scripts. `DataTexture` follows the `image.data !== undefined` code path in GLTFExporter (line 1415), which avoids the `instanceof HTMLCanvasElement` check entirely.

**Research Insight**: GLTFExporter has 4 hard DOM dependencies that block headless Node.js usage:
1. `document.createElement('canvas')` — for texture processing (line 540)
2. `Blob` — for buffer merging in `writeAsync()` (line 676) — native in Node 18+
3. `FileReader` — for Blob→ArrayBuffer conversion (lines 692-741) — native in Node 18+
4. `canvas.toBlob()` / `OffscreenCanvas.convertToBlob()` — for texture encoding (lines 544-575)

The `node-three-gltf` npm package wraps these polyfills.

**Dependencies to test**: `three` (already installed), `simplex-noise`, `node-three-gltf` (or manual polyfills).

**If spike fails**: Fall back to `@gltf-transform/core` for programmatic GLB assembly (no Three.js DOM dependencies). This is the more reliable fallback on Windows and should be considered the primary approach if `node-three-gltf` has native compilation issues.

**CSG test**: After GLB export works, extend the spike to test `three-bvh-csg` (create two Brushes, subtract, export). This validates CSG in the same script, not a separate phase.

**Key three-bvh-csg constraints:**
- All brush geometry must be two-manifold (watertight, no self-intersections)
- Reuse one `Evaluator` instance across all operations
- Set `evaluator.useGroups = false` when not using multi-material results
- Always call `updateMatrixWorld()` on every Brush before evaluation
- Use 6-8 segment cylinders instead of 32-64 for CSG operands

#### 1.2 Install Dependencies

**File**: `package.json`

```bash
npm install three-bvh-csg simplex-noise
npm install -D node-three-gltf
```

#### 1.3 Shared PNG Helpers (Extract Before Adding Scripts)

**New file**: `scripts/lib/png-helpers.mjs`

Extract duplicated helpers from `generate-sprites.mjs` and `generate-parallax.mjs`:

```
Exported API:
  - hex(r, g, b, a?) -> { r, g, b, a }
  - setPixel(png, x, y, color) -> void
  - fillRect(png, x, y, w, h, color) -> void
  - createPNG(width, height) -> PNG
  - writePNG(png, outputPath) -> Promise<void>
```

**Refactor**: Update `generate-sprites.mjs` and `generate-parallax.mjs` to import from this shared module.

#### 1.4 Prop Generator (Single Catalog-Driven Script — Inline Helpers)

**New file**: `scripts/generate-ironrath-props.mjs`

**Second review decision**: Write prop generation functions and texture helpers INLINE in this file. Do NOT extract `prop-builder.mjs` or `procedural-textures.mjs` as separate files yet. Extract shared code into `scripts/lib/` after the Great Hall is complete and patterns are proven.

**Structure**:

```javascript
// scripts/generate-ironrath-props.mjs
// Inline helpers at top of file (CSG, GLB export, texture gen)
// Extract to scripts/lib/ AFTER Great Hall is done

import * as THREE from 'three';
import { Evaluator, Brush } from 'three-bvh-csg';
// ... GLTFExporter setup ...

// --- Inline helpers (extract to scripts/lib/ after Phase 2) ---
const evaluator = new Evaluator();  // Reuse single instance
evaluator.useGroups = false;

async function exportGLB(scene, outputPath) { /* ... */ }
function disposeScene(scene) { /* ... traverse and dispose ... */ }

// --- Prop catalog ---
const PROP_CATALOG = [
  { name: 'ironwood-column', generate: generateColumn },
  { name: 'stone-hearth', generate: generateHearth },
  { name: 'ironwood-throne', generate: generateThrone },
  { name: 'long-table', generate: generateTable },
  { name: 'bench', generate: generateBench },
  { name: 'iron-chandelier', generate: generateChandelier },
  { name: 'wall-sconce', generate: generateSconce },
  { name: 'banner', generate: generateBanner },
  { name: 'chair', generate: generateChair },
  { name: 'high-seat', generate: generateHighSeat },
  { name: 'raised-dais', generate: generateDais },
  { name: 'goblet', generate: generateGoblet },
  { name: 'plate', generate: generatePlate },
  { name: 'candelabra', generate: generateCandelabra },
  { name: 'food-platter', generate: generateFoodPlatter },
  { name: 'weapon-rack', generate: generateWeaponRack },
  { name: 'tapestry', generate: generateTapestry },
  { name: 'fur-rug', generate: generateFurRug },
  { name: 'rushes', generate: generateRushes },
  { name: 'wooden-chest', generate: generateChest },
  { name: 'hound-sleeping', generate: generateHound },
  // Surface detail quads (generated here alongside props)
  { name: 'floor-crack', generate: generateFloorCrack },
  { name: 'wall-moss', generate: generateWallMoss },
  { name: 'hearth-scorch', generate: generateHearthScorch },
  { name: 'table-stain', generate: generateTableStain },
];

for (const prop of PROP_CATALOG) {
  const scene = prop.generate();
  await exportGLB(scene, `public/assets/models/props/ironrath/${prop.name}.glb`);
  disposeScene(scene);
  global.gc?.(); // Optional: force GC between props
}
```

**Key best practices:**
- Reuse one `Evaluator` instance across all CSG operations
- Minimize triangle count on CSG operands: 6-8 segment cylinders, not 32-64
- Merge sub-meshes via `BufferGeometryUtils.mergeGeometries()` before export (single-draw-call props)
- Generate one prop at a time, export, then dispose. Keeps peak memory bounded.
- Call `tex.image = null` after `tex.dispose()` to release backing `Uint8Array` for GC
- **Not all props need CSG.** Only ~3-5 props benefit (hearth, throne, chandelier, weapon rack). The rest are simple primitive compositions with `MeshStandardMaterial` + color.

**Target GLB budgets:**

| Category | Triangles | Texture Size | Target GLB |
|----------|-----------|-------------|------------|
| Small (goblet, plate) | 50-200 | 128x128 | < 10 KB |
| Medium (chest, bench) | 200-800 | 256x256 | 10-50 KB |
| Large (table, throne) | 800-2000 | 512x512 | 50-100 KB |
| Architectural (column, hearth) | 400-1200 | 256x256 | 20-60 KB |

**Prop quality fallback**: If procedural CSG props don't meet the AAA bar, fall back to: (a) simpler geometry with better textures, or (b) flat billboard props (which the HD-2D style uses extensively). The vertical slice should be visually assessed after every 3-5 props to catch quality issues early.

**npm script**: `"generate-props": "node scripts/generate-ironrath-props.mjs"`

#### 1.5 Type System Refactoring (Before Adding New Types)

**1. Extract `SpawnRegion` interface** — the same 6-field object is defined inline in `DustParticleDef` and duplicated in `DustConfig`. Extract once:

```typescript
// src/rooms/room-data/types.ts
export interface SpawnRegion {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}
```

**2. Extract `ParticleSystem` interface** — the current `DustMoteSystem | EmberSystem` union type will not scale. The `SmokeSystem` uses `InstancedBufferGeometry` (not `THREE.Points`), which breaks `group.add(system.points)`.

```typescript
// src/rendering/particles/types.ts (new file)
export interface ParticleSystem {
  /** The Three.js object to add to the scene group */
  object3d: THREE.Object3D;
  update(dt: number): void;
  dispose(): void;
}
```

**Critical migration steps (from Kieran review):**
- DELETE `export type ParticleSystem = DustMoteSystem | EmberSystem;` from `RoomBuilder.ts:18`
- UPDATE import in `RoomManager.ts:6` to import from `src/rendering/particles/types.ts`
- Update `DustMoteSystem` and `EmberSystem` to expose `object3d` instead of `points`
- Update `RoomBuilder.ts` to use `group.add(system.object3d)` instead of `group.add(system.points)`

**3. Add new `ParticleDef` variants** (smoke and dust-in-light):

```typescript
// src/rooms/room-data/types.ts
export interface SmokeParticleDef {
  type: 'smoke';
  position: Vec3;
  count: number;
  spread?: number;
}

export interface DustInLightParticleDef {
  type: 'dust-in-light';
  region: SpawnRegion;
  count: number;
  /** Direction vector of the light beam (REQUIRED). Must be normalized — constructor
   *  will assert |length - 1.0| < 0.01 and warn if not. */
  lightDirection: Vec3;
}

export type ParticleDef = DustParticleDef | EmberParticleDef | SmokeParticleDef | DustInLightParticleDef;
```

**4. Handle new particle types via `switch` in `buildRoom()`** — NOT a separate factory file. Use TypeScript discriminated union narrowing with `never` exhaustiveness check (zero `as` casts):

```typescript
// In buildRoom() — extracted to buildParticleSystems() helper
function createParticleSystem(def: ParticleDef, ...deps): ParticleSystem {
  switch (def.type) {
    case 'dust':
      return createDustMotes({ count: def.count, region: def.region });
    case 'embers':
      return createTorchEmbers({ position: def.position, count: def.count });
    case 'smoke':
      return createSmoke(def);
    case 'dust-in-light':
      return createDustInLight(def);
    default: {
      const _exhaustive: never = def;
      throw new Error(`Unknown particle type: ${(_exhaustive as ParticleDef).type}`);
    }
  }
}
```

Extract the factory to `particle-factory.ts` when the 6th particle type is needed (dungeon dripping, courtyard rain, smithy sparks, etc.).

#### 1.6 Ironrath Room Data Files

**New file**: `src/rooms/room-data/ironrath/great-hall.ts`

Import directly in registry — no barrel `index.ts` file needed for one room. Add `ironrath/index.ts` when there are 3+ Ironrath rooms.

**Modifications**:

| File | Change |
|------|--------|
| `src/ecs/components/singletons.ts` | Add `IronrathGreatHall: 101` to `RoomId`. Add range comment: `// 1-99: Red Keep, 100-199: Ironrath Castle, 200-255: future locations`. |
| `src/rooms/room-data/registry.ts` | Import and register Ironrath Great Hall directly from `ironrath/great-hall.ts` |
| `src/debug/debug-overlay.ts` | Add key binding `KeyG` to teleport to Great Hall |

**Room creation checklist (from learnings):**
1. Create the room data file
2. Add a `RoomId` entry in `singletons.ts`
3. Register it in `registry.ts`
4. **Add bidirectional `DoorDef` entries in BOTH the new room AND the room it connects to**
5. Add a debug key mapping
6. **Run connectivity validation** (see Phase 1.7 below)

**Great Hall initial dimensions**: `{ width: 24, depth: 14, height: 10 }`
- Wider than deep (classic medieval great hall proportions — roughly 1.7:1)
- Height 10 for double-height feel
- Tunable — if room feels cramped with props, increase to 28x16x12

**Initial room data (skeleton — populated in Phase 2)**:
- `mood: 'grand'`
- `floorColor: 0x3A3530` (northern stone — channels all >= 0x30 per lighting prevention rules)
- `wallColor: 0x4A4540` (grey-brown granite)
- `ceilingColor: 0x1f1510` (ironwood ceiling)
- Floor/wall/ceiling textures: downloaded PBR textures (stone, ironwood)
- `ambientLight: { color: 0x665544, intensity: 0.55 }` (above 0.45 minimum)
- Placeholder lights (3-4 torches), no props yet, no NPCs yet
- One door west -> placeholder (will connect to kitchen eventually)
- `postProcessOverrides`: bloom 0.6, tiltShift 0.35/0.25, vignette 0.40, colorGrading neutral

#### 1.7 Verification

- [ ] `node scripts/spike-glb-export.mjs` produces a valid GLB (box + texture + CSG)
- [ ] `npm run generate-props` produces GLB files in `public/assets/models/props/ironrath/`
- [ ] GLB files open in glTF viewer (correct geometry + texture)
- [ ] GLB file sizes within budget (small < 10KB, large < 100KB)
- [ ] Great Hall loads via `KeyG` — renders empty room with correct dimensions/colors
- [ ] Floor is visible (not invisible-floor bug)
- [ ] **Camera framing check**: double-height room (h=10) renders properly at Y=18, Z=22, FOV=35
- [ ] `npm run build` succeeds with no type errors
- [ ] **A/B screenshot** against Octopath reference (even empty room — check proportions and lighting feel)

---

### Phase 2: Environmental Density + Depth

**Goal**: Populate the Great Hall with 50-100 props including foreground occlusion and surface detail. Create the dense, lived-in medieval hall.

**Estimated quality lift**: 55% → 80%

#### 2.1 Great Hall Prop Layout

Update `great-hall.ts` props array. Layout organized by zone:

```
NORTH WALL (back)
+-- Great Hearth (center of north wall, y=0)
+-- Mantel decorations (above hearth)
+-- Forrester banners (flanking hearth, 2x)
+-- Wall sconces (4x along north wall)

DAIS AREA (north end, in front of hearth)
+-- Raised dais platform (GLB prop on floor)
+-- Ironwood throne (center of dais)
+-- High seats (flanking throne, 2x)
+-- Fur rug on dais
+-- Standing braziers at dais edges (2x)

CENTRAL AREA
+-- Long feasting table (center)
+-- Benches along table (6-8x)
+-- Goblets, plates, candelabras ON table (20+ small items)
+-- Food platters on table (4-6x)
+-- Spilled wine near table edge (flat textured quad)

EAST & WEST WALLS
+-- Forrester banners (2x per wall)
+-- Weapon racks (1x per wall)
+-- Tapestries (1x per wall)
+-- Wall sconces (3x per wall)
+-- Iron chandeliers (hanging, 2-3x overhead)

FLOOR DETAIL
+-- Rushes/straw patches (scattered, 6-8x)
+-- Fur rug near hearth
+-- Environmental: sleeping hound near hearth

COLUMNS
+-- Ironwood columns (4-6x) defining central aisle

CEILING
+-- Exposed ironwood beams (3-4 spanning width)
+-- Iron chandeliers (already counted above)
```

**Instance counts (estimated)**: ~70-90 model prop instances total

#### 2.2 Foreground Occlusion Layer (Merged from old Phase 4)

Place props in the **foreground** (positive Z, closest to camera) that partially occlude the scene. These are blurred by tilt-shift, creating the classic HD-2D miniature effect.

- Move 2 columns to Z positions near camera (Z = 5-6)
- Position a chest at (X=10, Z=6)
- These props are in the tilt-shift blur zone, creating depth

No new geometry — just prop placement in room data.

#### 2.3 Surface Detail: Flat Textured Quads (Merged from old Phase 4)

Surface detail quads are generated in `generate-ironrath-props.mjs` alongside regular props:

- **Floor cracks**: 3-4 near high-traffic areas (doorway, dais edge) — flat quads with alpha-masked crack texture
- **Wall moss**: 2-3 patches in corners (northern castle = damp stone) — flat quads against walls
- **Hearth scorch marks**: Soot stain on wall above hearth — flat quad
- **Table stains**: Wine/food stains on table surface — flat quad at y=table_height+0.01

**Technical approach**:
- Use `polygonOffset: true` with `polygonOffsetFactor: -4` to prevent z-fighting
- **Use `MeshBasicMaterial`** (not `MeshStandardMaterial`) — decals don't need PBR lighting. Saves ~0.5-1ms.
- Set `transparent: true`, `depthWrite: false`
- Batch same-texture decals via `BufferGeometryUtils.mergeGeometries()`
- All decal textures must go through `AssetManager` for ref-counted disposal

#### 2.4 Tilt-Shift Tuning for Double-Height Room (Merged from old Phase 4)

The Great Hall has height 10 (double-height). Current tilt-shift is tuned for height 4-6 rooms:

- `focusArea: 0.30` (tighter focus — more blur at top/bottom for diorama effect)
- `feather: 0.20` (sharper focus-to-blur transition)

#### 2.5 Model Loading Performance (P0)

Switch to `Promise.all` for model loading:

```typescript
// In buildRoom() — load all models in parallel
const modelPromises = props.map(p => assetManager.loadModel(p.modelPath));
const models = await Promise.all(modelPromises);
```

**Note from Kieran review**: Verify `AssetManager.loadModelAsync` is concurrency-safe (two concurrent calls for the same model path should not trigger duplicate fetches).

#### 2.6 InstancedMesh Optimization

- Use `InstancedMesh` for any prop with 3+ copies (benches, sconces, goblets, plates, rushes)
- **Per-instance color variation**: 2-5% HSL jitter via `mesh.setColorAt()`
- **Slight scale/rotation jitter**: 3% scale, 0.05 radian rotation
- After setting all matrices, call `mesh.computeBoundingBox()` and `mesh.computeBoundingSphere()`
- Static props: default `StaticDrawUsage` for `instanceMatrix`

#### 2.7 Verification

- [ ] Great Hall loads with all ~70-90 props visible
- [ ] Screenshot shows dense, lived-in medieval hall
- [ ] Foreground objects create visible depth layering (blurred columns near camera)
- [ ] Floor cracks, wall moss, and surface details visible
- [ ] No z-fighting between props, surface details, and floor/walls
- [ ] Props correctly scaled relative to room dimensions
- [ ] Per-instance color jitter visible on repeated props
- [ ] Room load time < 2s (parallel model loading)
- [ ] **Draw call count**: check `renderer.info.render.calls` < 100
- [ ] Frame time < 16ms (check via stats-gl overlay)
- [ ] `npm run build` succeeds
- [ ] **A/B screenshot** against Phase 1 AND Octopath reference

---

### Phase 3: Lighting & Atmosphere

**Goal**: Cinematic lighting with warm/cool contrast and enhanced particles.

**Estimated quality lift**: 80% → 92%

#### 3.1 Great Hall Lighting Setup

**Budget: 10 point lights + 1 shadow directional (11 total)**

| Source | Type | Color | Intensity | Distance | Notes |
|--------|------|-------|-----------|----------|-------|
| Great Hearth | point | `0xFF6B35` | 6.0 | 12 | Dominant warm, flicker=true |
| Window slit | directional | `0xB0C4DE` | 1.2 | -- | Cool exterior, castShadow=true |
| Wall sconce x4 | point | `0xFFCC66` | 2.0 | 10 | Warm fill, flicker=true |
| Chandelier x3 | point | `0xFFCC66` | 2.5 | 12 | Warm overhead |
| Brazier L | point | `0xFF6B35` | 3.0 | 10 | Warm accent, flicker=true |
| Brazier R | point | `0xFF6B35` | 3.0 | 10 | Warm accent, flicker=true |

**God rays**: Configure for the directional window light:
```typescript
godRays: { color: 0xB0C4DE, density: 1 / 128, maxDensity: 0.4 }
```

**Constraint**: Only one GodraysPass active at a time per the pipeline architecture.

#### 3.2 New Particle Types

2 new particle systems + 1 extension to existing:

**New files**:

| File | Type | Technique |
|------|------|-----------|
| `src/rendering/particles/smoke.ts` | `SmokeSystem` | `InstancedBufferGeometry` + `THREE.Mesh`. 5 floats/instance (center + scale + alpha). PlaneGeometry(1,1) base quad. Billboarding in vertex shader (cylindrical). `StreamDrawUsage`. Lifecycle: spawn at source, rise with drag, grow scale (0.5x->2.5x), sinusoidal drift, fade. `NormalBlending`, `depthWrite:false`. |
| `src/rendering/particles/dust-in-light.ts` | `DustInLightSystem` | Points with ShaderMaterial. Vertex shader cone test on beam axis. `vInBeam` factor (0.0-1.0) modulates alpha. Warm color tint in beam. Scale factor 80.0. `AdditiveBlending`, `depthWrite:false`, `frustumCulled:false`. |

**Also**: Add `driftDirection` parameter to existing `DustMoteSystem` for downward ash-like drift:

```typescript
// src/rendering/particles/dust-motes.ts — extend DustConfig (export it)
export interface DustConfig {
  // ... existing fields ...
  /** Optional drift direction override (default: gentle upward sine wave) */
  driftDirection?: Vec3;
}
```

**P1 optimization**: Move dust sine-drift to vertex shader (uniform `uElapsed` + static `aSeed`/`aBasePosition` attributes). Eliminates CPU particle loop entirely.

#### 3.3 Great Hall Particle Configuration

Update `great-hall.ts` particles:
- Dust motes: full room region, count: 100 (existing system)
- Torch embers: 1 emitter per sconce + chandelier (~7 emitters, count: 8-12 each) (existing system)
- Hearth embers: 1 emitter, count: 30 (dense spark column) (existing system)
- Hearth smoke: 1 emitter above hearth, count: 25 (new)
- Dust in light beams: region matching window directional, count: 40, lightDirection from directional light (new)
- Falling ash near hearth: dust motes with `driftDirection: { x: 0, y: -0.3, z: 0 }`, warm orange tint, count: 15 (existing system, extended)

**Particle regions must overlap light positions** — particles in dark regions are invisible and waste GPU cycles.

#### 3.4 Post-Processing Tuning

```typescript
postProcessOverrides: {
  bloom: { intensity: 0.6, luminanceThreshold: 0.80 },
  tiltShift: { focusArea: 0.30, feather: 0.20 },
  vignette: { darkness: 0.38 },                         // Below 0.50 max
  colorGrading: { hue: 0.05, saturation: 0.1, brightness: 0, contrast: 0.08 },  // hue is RADIANS
  ssao: { aoRadius: 4, intensity: 2.5, distanceFalloff: 1.2 },
}
```

#### 3.5 Verification

- [ ] Great Hall has cinematic warm/cool lighting contrast
- [ ] Hearth is dominant warm light source with visible smoke + embers
- [ ] Window light casts cool-toned god rays across the room
- [ ] Dust-in-light particles visible in light beam, invisible outside
- [ ] Smoke rises from hearth with natural motion and alpha fade
- [ ] All particle shaders use scale factor 80.0 (not 300.0)
- [ ] All particle materials set depthWrite:false, frustumCulled:false
- [ ] Frame time < 16ms (with all particles + 11 lights)
- [ ] `npm run build` succeeds
- [ ] **A/B screenshot** against Phase 2 AND Octopath reference — this should be the most dramatic improvement

---

### Phase 4: NPCs, Parallax & Polish

**Goal**: Place NPCs, add Wolfswood background, day/night foundation, and final quality pass.

**Estimated quality lift**: 92% → 95%+

#### 4.1 Great Hall NPCs (32x48 Sprites)

Use existing 32x48 sprite system for the vertical slice. Add Forrester-themed palette entries to `generate-sprites.mjs`:

**New Forrester character palettes**:

| Type | Key Visual Features |
|------|-------------------|
| `forrester-lord` | Dark ironwood-toned clothing, fur mantle, green trim |
| `forrester-lady` | Green dress, ironwood jewelry, fur-lined cloak |
| `forrester-guard` | Dark leather armor, Forrester surcoat |
| `forrester-servant` | Brown/grey simple clothing, apron |
| `forrester-maester` | Grey robes, chain accessory |

Update `great-hall.ts` NPCs:

| NPC | Position | Sprite | Notes |
|-----|----------|--------|-------|
| Lord Forrester | Throne (on dais) | `forrester-lord` | Idle |
| Lady Forrester | High seat beside throne | `forrester-lady` | Idle |
| Guard at door | Near west door | `forrester-guard` | Standing guard |
| Guard at dais | Beside dais | `forrester-guard` | Standing guard |
| Servant 1 | Near table | `forrester-servant` | Serving |
| Servant 2 | Near hearth | `forrester-servant` | Tending fire |
| Maester | Near lord | `forrester-maester` | Advising |

#### 4.2 Wolfswood Parallax Background

**New file**: `scripts/generate-ironrath-parallax.mjs`

Generate parallax layers for the Great Hall windows:

| Layer | Content | Width | Scroll Factor |
|-------|---------|-------|---------------|
| 0. Sky | Northern grey sky, low clouds, cold | 1920 | 0 |
| 1. Far mountains | Misty mountain silhouettes | 2560 | 0.1 |
| 2. Wolfswood canopy | Dense dark green ironwood trees | 3200 | 0.2 |
| 3. Near trees | Individual ironwood trunks | 3840 | 0.3 |

Render parallax layers **single-sided** (`side: THREE.FrontSide`). Reduce geometry width to `roomWidth * 1.5`.

#### 4.3 GameClock Foundation (NPC Schedule Infrastructure)

**New file**: `src/ecs/components/game-clock.ts`

```typescript
@component
export class GameClock {
  /** Time of day in hours, range [0.0, 24.0). Wraps at 24.0 -> 0.0. */
  @field.float64 declare timeOfDay: number;
  /** Game minutes per real second. Default: 1.0 (set via init helper). */
  @field.float64 declare timeScale: number;
  /** Convenience pause flag. Distinct from timeScale=0 for UI purposes. */
  @field.boolean declare paused: boolean;
}
```

**Init helper** (following `transformInit()` return-object pattern per Kieran review):
```typescript
export function gameClockInit(overrides?: Partial<{ timeOfDay: number; timeScale: number; paused: boolean }>) {
  return { timeOfDay: 10.0, timeScale: 1.0, paused: false, ...overrides };
}
```

**Becsy constraints**: Create entity inside existing single `world.build()` call. Use `.current` in queries.

**New file**: `src/ecs/systems/game-clock.ts` (NOT `game-clock-system.ts` — matches naming convention)

ECS system that advances `timeOfDay` each frame.

**ECS system execution order:**
```
Input -> PlayerMovement -> Collision -> RoomTransition ->
GameClock ->
CameraFollow -> TransformSync -> LightFlicker -> ThreeRender
```

#### 4.4 Day/Night via Color Grading (Simplified)

**Second review decision**: For the vertical slice (one room), use existing `colorGrading` post-processing pass to shift overall scene hue/saturation based on time of day. Zero per-light uniform writes. This achieves ~90% of the visual impact.

Drive `colorGrading.hue` and `colorGrading.saturation` from `GameClock.timeOfDay`:

```
5-7:   Dawn    — warm pink-gold hue shift (+0.08 rad), saturation +0.15
7-17:  Day     — neutral (0 hue, 0 saturation)
17-19: Dusk    — warm orange hue shift (+0.12 rad), saturation +0.1
19-5:  Night   — cool blue hue shift (-0.08 rad), saturation -0.1, brightness -0.05
```

**NOT included in vertical slice** (deferred to full castle):
- Per-light `lightRole` tinting
- `DayNightLightingSystem` ECS system
- Per-light color/intensity changes
- Shadow map re-renders on time transitions

These will be needed when rooms have different window orientations (east vs west).

**Debug overlay**: Show current game time (HH:MM format). Number key shortcut to set time.

#### 4.5 Final Color Grading Pass

After all elements are in place, fine-tune `postProcessOverrides`:
- A/B screenshot comparison against Octopath Traveler reference frames
- Adjust bloom luminance threshold for chandelier glow
- Tune vignette to frame the Great Hall's width
- Subtle warm hue shift to reinforce the "warm despite the cold" mood

#### 4.6 Screenshot Automation Update

**File**: `scripts/screenshot-rooms.mjs`

Add Ironrath rooms:
```typescript
{ key: 'KeyG', name: 'ironrath-great-hall', label: "Ironrath Great Hall" },
```

#### 4.7 Verification

- [ ] 7 NPCs visible in correct positions with Forrester-themed sprites
- [ ] Parallax Wolfswood visible through windows
- [ ] GameClock advances time (verify via debug overlay)
- [ ] GameClock timeScale initialized to 1.0 (not default 0)
- [ ] Day/night color grading shifts are visible and smooth
- [ ] All original Red Keep rooms still work (no regression)
- [ ] Frame time < 16ms at all times of day
- [ ] `npm run build` succeeds with no type errors
- [ ] **Final A/B screenshot** against Octopath reference — this is the quality gate
- [ ] **Subjective quality gate**: Show screenshot to someone familiar with HD-2D games. Does it look comparable?

---

## Deferred to Post-Vertical-Slice

These features are cut from the vertical slice but documented for the full castle:

| Feature | Reason for Deferral | When to Build |
|---------|-------------------|---------------|
| **64x96 sprite upgrade** | Environment is what makes the room AAA, not sprite resolution. Lower body in tilt-shift blur. | After vertical slice ships, before full castle |
| **Per-NPC `spriteSize` on NPCDef** | Only needed if 64x96 sprites use different world-space size | With 64x96 upgrade |
| **`lightRole` field on LightDef** | No consumer until per-light day/night exists | When building DayNightLightingSystem |
| **`DayNightLightingSystem`** | Color grading achieves 90% for one room. Per-light tinting needed when rooms have different window orientations. | When 2nd room has windows |
| **`particle-factory.ts`** | 4-branch switch is simpler. Extract at 6+ types. | When dungeon/courtyard/smithy particles added |
| **`scripts/lib/prop-builder.mjs`** | Extract after Great Hall props are done, not before | After Phase 2, before 2nd room |
| **`scripts/lib/procedural-textures.mjs`** | Same reasoning | After Phase 2, before 2nd room |
| **Quality scaler light-count degradation** | P2 optimization, not vertical slice | Performance tuning pass |
| **Quality scaler particle `qualityMultiplier`** | P2 optimization | Performance tuning pass |
| **KTX2/Basis Universal texture compression** | VRAM optimization for multi-room | Full castle rendering |

---

## Acceptance Criteria

### Functional Requirements

- [ ] Prop generation script produces valid GLB files from Node.js
- [ ] Great Hall renders with 50-100 props, 11 light sources, 4 particle types
- [ ] Hearth is dominant warm light with smoke + embers
- [ ] Cool window light creates warm/cool contrast with god rays
- [ ] Foreground depth layering (tilt-shift blurred foreground objects)
- [ ] Surface detail (moss, cracks) visible on walls and floor
- [ ] 7 Forrester NPCs visible with themed 32x48 sprites
- [ ] Parallax Wolfswood background through windows
- [ ] GameClock infrastructure works (clock advances, debug controls)
- [ ] Day/night color grading shifts visible

### Non-Functional Requirements

- [ ] Frame time < 16ms (60fps) at full quality on a mid-range desktop GPU
- [ ] Room load time < 2s (with parallel model loading)
- [ ] Draw call count < 100 (`renderer.info.render.calls`)
- [ ] No GPU memory leaks (props, textures, particles all properly disposed)
- [ ] All generated assets under version control (GLB files in `public/assets/`)

### Quality Gates (Screenshot Discipline)

- [ ] **Phase 1**: A/B screenshot — empty room proportions and feel vs reference
- [ ] **Phase 2**: A/B screenshot — dense room vs Phase 1 AND Octopath reference
- [ ] **Phase 3**: A/B screenshot — cinematic lighting vs Phase 2 AND Octopath reference (biggest jump)
- [ ] **Phase 4**: A/B screenshot — final room vs Octopath reference
- [ ] **Subjective gate**: Show final screenshot to someone familiar with HD-2D games. "Does this look comparable to Octopath Traveler?"
- [ ] No regressions in existing 10 Red Keep rooms
- [ ] `npm run build` produces zero type errors and zero warnings

---

## Simplified File Change Summary

### New Files (~10 files, down from ~15)

| Path | Purpose | Phase |
|------|---------|-------|
| `scripts/spike-glb-export.mjs` | GLB export + CSG spike | 1 |
| `scripts/lib/png-helpers.mjs` | Shared PNG creation/manipulation helpers | 1 |
| `scripts/generate-ironrath-props.mjs` | **Single catalog-driven script for ALL props + surface detail quads** (inline helpers, extract to lib/ after Phase 2) | 1 |
| `scripts/generate-ironrath-parallax.mjs` | Wolfswood parallax backgrounds | 4 |
| `src/rooms/room-data/ironrath/great-hall.ts` | Great Hall room data | 1 |
| `src/rendering/particles/types.ts` | `ParticleSystem` interface | 1 |
| `src/rendering/particles/smoke.ts` | Smoke particle system | 3 |
| `src/rendering/particles/dust-in-light.ts` | Dust in light beams particle system | 3 |
| `src/ecs/components/game-clock.ts` | GameClock singleton component | 4 |
| `src/ecs/systems/game-clock.ts` | Clock advancement system | 4 |

### Modified Files (~10 files)

| Path | Change | Phase |
|------|--------|-------|
| `package.json` | Add `three-bvh-csg`, `simplex-noise`, `node-three-gltf` deps + new scripts | 1 |
| `src/ecs/components/singletons.ts` | Add `IronrathGreatHall: 101` to RoomId with range comment | 1 |
| `src/rooms/room-data/registry.ts` | Import + register Great Hall (direct import, no barrel) | 1 |
| `src/rooms/room-data/types.ts` | Extract `SpawnRegion`, add smoke/dust-in-light `ParticleDef` variants | 1 |
| `src/rooms/RoomBuilder.ts` | Delete old `ParticleSystem` type alias, `Promise.all` model loading, per-instance color jitter, extract `buildParticleSystems()` helper, particle switch statement | 1-3 |
| `src/rooms/RoomManager.ts` | Rename `updateParticles()` -> `updateVisuals()`, update `ParticleSystem` import | 1 |
| `src/rendering/particles/dust-motes.ts` | Export `DustConfig`, add `driftDirection` parameter, expose `object3d` instead of `points` | 3 |
| `src/rendering/particles/torch-embers.ts` | Expose `object3d` instead of `points` | 1 |
| `src/ecs/world.ts` | Register GameClockSystem in correct execution order | 4 |
| `src/debug/debug-overlay.ts` | Add KeyG for Great Hall, show game clock time | 1, 4 |
| `scripts/generate-sprites.mjs` | Add Forrester palettes, import from png-helpers | 4 |
| `scripts/generate-parallax.mjs` | Import from png-helpers (dedup refactor) | 1 |
| `scripts/screenshot-rooms.mjs` | Add Ironrath rooms to automation | 4 |

### Files Eliminated (from original plan)

| Original Planned File | Reason | When to Add |
|----------------------|--------|-------------|
| `scripts/lib/prop-builder.mjs` | Premature extraction — inline first, extract after Phase 2 | Before 2nd room |
| `scripts/lib/procedural-textures.mjs` | Same — download textures first, generate inline if needed | Before 2nd room |
| `scripts/generate-textures.mjs` | Merged into prop generation script | Never (merged) |
| `src/rooms/room-data/ironrath/index.ts` | Barrel file for 1 export is unnecessary | At 3+ Ironrath rooms |
| `src/rendering/particles/particle-factory.ts` | 4-branch switch is simpler than factory file | At 6+ particle types |
| `src/ecs/systems/day-night-lighting.ts` | Color grading approach for vertical slice | When rooms have different window orientations |

---

## Dependencies & Prerequisites

| Dependency | Type | Notes |
|-----------|------|-------|
| `three-bvh-csg` | npm package | CSG boolean operations for prop geometry |
| `simplex-noise` | npm package | Deterministic noise for procedural textures |
| `node-three-gltf` | npm devDependency | GLTFExporter for Node.js. **Test on Windows in Phase 1 spike.** |
| Existing PBR textures | Assets | Floor/wall/ceiling textures already exist in `public/assets/textures/` |
| CC0 PBR textures | Assets (download) | Download stone, wood, iron from Poly Haven/ambientCG via `download-assets.mjs` |
| Existing room system | Code | RoomBuilder, RoomManager, registry — all preserved |
| Existing post-processing | Code | 6-pass pipeline — extended, not replaced |

**Dependency notes:**
- **`canvas` npm package dropped** — use `pngjs` (already a dependency) for all pixel-level texture generation. Avoids native compilation issues on Windows.
- **`@gltf-transform/core`** (optional fallback) — if `node-three-gltf` fails on Windows, use this for programmatic GLB assembly without Three.js DOM dependencies.

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| GLTFExporter doesn't work in Node.js on Windows | Medium | High (blocks all prop gen) | **Phase 1.1 spike validates this first.** Use `DataTexture` (not `CanvasTexture`). Fallback: `@gltf-transform/core` for programmatic GLB assembly. |
| CSG operations produce non-manifold geometry | Medium | Medium | Only 3-5 props need CSG. Keep primitives low-poly (6-8 segment cylinders). Most props are simple primitive compositions — no CSG needed. |
| 11 lights + particles exceed frame budget | Low | Medium | Reduced from 15 to 11. Current 8-light rooms ~10ms. Quality scaler auto-degrades. Point light distance capped at 10-12. |
| **Procedural props don't meet AAA quality bar** | **Medium** | **High** | **Visual check after every 3-5 props.** Fallback: simpler geometry + better textures, or flat billboard props (valid in HD-2D style). For hero props (hearth, throne), if procedural fails, consider alternative approaches. |
| Downloaded PBR textures don't match Ironrath aesthetic | Low | Medium | Use CC0 textures as base, adjust programmatically (color shift, contrast). Ironwood-specific textures may need procedural generation. |
| Becsy ECS API misuse crashes | High | High | Follow documented constraints: single `world.build()`, `.create` entitlements, `.current` not `.all`, init helper for non-zero defaults. |
| Bidirectional door missing | Medium | High | Room creation checklist + build-time connectivity validation script. |
| Camera doesn't frame double-height room properly | Low | Medium | Test in Phase 1.7 before investing in props. Adjust camera Y/Z/FOV if needed. |

---

## Alternative Approaches Considered

### A. Rewrite room system from scratch
**Rejected**: The existing data-driven room system is well-architected. Extending is faster and safer.

### B. Use AI image generation APIs for textures
**Rejected** (per brainstorm): External APIs add cost, latency, non-determinism.

### C. Hand-model props in Blender
**Rejected**: Not scalable by Claude Code. Procedural generation via TypeScript is the only approach Claude Code can execute autonomously.

### D. Start with all 36 rooms instead of vertical slice
**Rejected** (per brainstorm): Mile-wide-inch-deep problem. Prove quality in one room first.

### E. 25 separate prop generator scripts
**Rejected** (per simplicity review): One file with a prop catalog eliminates ~24 files.

### F. Full DecalGeometry system for surface details
**Rejected** (per simplicity review): Flat textured quads with polygonOffset achieve the same result.

### G. 4 new particle systems
**Reduced to 2** (per simplicity review): Falling ash = dust motes with drift direction. Ground mist contradicts heated room.

### H. Build PropBuilder framework before writing props (first review plan)
**Rejected** (per second review, 3/3): Write props inline first, extract shared framework after patterns emerge. The right abstractions come from real code.

### I. Particle factory file at 4 types
**Rejected** (per second review, 3/3): 4-branch switch is simpler. Extract at 6+ types.

### J. Per-light day/night tinting (DayNightLightingSystem)
**Deferred** (per second review, 2/3): Color grading post-processing achieves 90% for one room. Per-light tinting needed when rooms have different window orientations.

### K. 64x96 sprites in vertical slice
**Deferred** (per second review, 2/3): Environment is what makes the room AAA. Sprites are in tilt-shift blur zone. Ship vertical slice with 32x48, upgrade after.

---

## Open Questions (Resolve During Implementation)

1. **~~GLTFExporter in Node.js~~**: Resolved — spike validates. Use `DataTexture` + `node-three-gltf`. Fallback: `@gltf-transform/core`.
2. **~~Canvas npm package on Windows~~**: Resolved — use `pngjs` instead.
3. **Great Hall exact dimensions**: 24x14x10 is the starting point. May need tuning once props are placed — if cramped, increase to 28x16x12.
4. **Ironwood column count**: 4 or 6? Depends on room width and gameplay space. Decide during Phase 2 layout.
5. **Camera adjustment**: Does height=10 need camera Y/Z/FOV changes? Test in Phase 1 with empty room.
6. **Which PBR textures to download vs generate**: Start with Poly Haven downloads. Only generate if Ironrath-specific materials aren't available.
7. **`@gltf-transform/core` as primary approach**: If `node-three-gltf` has Windows issues, should `@gltf-transform/core` be the primary GLB export path? Spike will determine.

---

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-08-ironrath-aaa-vertical-slice-brainstorm.md`
- Room data types: `src/rooms/room-data/types.ts`
- Room builder: `src/rooms/RoomBuilder.ts`
- Post-processing: `src/rendering/hd2d-pipeline.ts`
- Particle pattern: `docs/solutions/architecture/non-ecs-particle-integration-pattern.md`
- Room system pattern: `docs/solutions/architecture/data-driven-room-system-pattern.md`
- Pipeline architecture: `docs/solutions/architecture/hd2d-deferred-effects-pipeline.md`
- Lighting bug prevention: `docs/solutions/ui-bugs/invisible-floors-dark-room-lighting.md`
- Particle scale fix: `docs/solutions/ui-bugs/particle-scale-and-room-lighting-overhaul.md`
- Becsy crashes prevention: `docs/solutions/runtime-errors/becsy-ecs-api-runtime-crashes.md`
- Code review findings: `docs/solutions/code-review/pre-commit-review-hd2d-mvp.md`
- Existing sprite gen: `scripts/generate-sprites.mjs`
- Existing parallax gen: `scripts/generate-parallax.mjs`

### External References

- [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) — 100x faster CSG than BSP alternatives
- [simplex-noise](https://github.com/jwagner/simplex-noise.js) — Deterministic noise
- [node-three-gltf](https://www.npmjs.com/package/node-three-gltf) — Node.js GLB export
- [Three.js GLTFExporter docs](https://threejs.org/docs/#examples/en/exporters/GLTFExporter)
- [Three.js Forum: GLTFExporter Node.js](https://discourse.threejs.org/t/nodejs-threejs-gltfexporter-server-side-blob-issue/4040)
- [Node.js glTF conversion gist](https://gist.github.com/donmccurdy/9f094575c1f1a48a2ddda513898f6496)
- [Octopath Traveler HD-2D Style Analysis](https://samppy.com/octopath-travelers-hd-2d/)
- [Unreal Engine Spotlight: Octopath Traveler](https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true)
- [HD-2D Wikipedia](https://en.wikipedia.org/wiki/HD-2D)
- [Three.js Forum: three-bvh-csg](https://discourse.threejs.org/t/three-bvh-csg-a-library-for-performing-fast-csg-operations/42713)

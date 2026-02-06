---
title: "HD-2D Red Keep MVP"
type: feat
date: 2026-02-05
deepened: 2026-02-05
brainstorm: docs/brainstorms/2026-02-05-red-keep-hd2d-mvp-brainstorm.md
---

# HD-2D Red Keep MVP

## Enhancement Summary

**Deepened on:** 2026-02-05
**Sections enhanced:** All 6 phases + architecture + risk analysis
**Research agents used:** 12 (frontend design, architecture, performance, simplicity, TypeScript, race conditions, security, Three.js patterns, Becsy/postprocessing docs, HD-2D visual techniques, medieval castle architecture, pattern recognition)

### Key Improvements
1. **Serialized game loop** — prevents overlapping `world.execute()` calls that corrupt ECS state
2. **Transition state machine** — prevents 8 identified race conditions during room transitions
3. **Reference-counted asset cache** — prevents double-loading and use-after-dispose
4. **Simplified ECS** — NPCs and particles as plain Three.js objects (not ECS entities) for MVP
5. **Calibrated HD-2D parameters** — specific post-processing values based on Octopath/DQ3 analysis
6. **Realistic room dimensions** — based on actual medieval castle proportions and Red Keep descriptions
7. **Shadow budget** — disable shadow maps on point lights (huge perf win), use only directional shadows
8. **Visual art direction** — "Illuminated Manuscript Come Alive" concept with per-room color palettes, signature moments, and cinematic feel
9. **YAGNI deferments** — SSAO and god rays marked as optional Phase 6 polish (minimum HD-2D = TiltShift + Bloom + Vignette + ToneMapping)

### New Considerations Discovered
- `await world.execute()` inside `requestAnimationFrame` can cause overlapping frames — must serialize
- Becsy coroutine yields invalidate entity handles — copy data before yielding
- Point light shadow maps are extremely expensive (~6 draw calls each) — use baked AO instead
- `THREE.Sprite` auto-rotates on all axes — must use `PlaneGeometry` billboards for HD-2D 3/4 angle
- Browser tab visibility changes pause rAF but not promises — need visibility change handler
- God rays via `three-good-godrays` require `castShadow: true` on all occluders

---

## Overview

Build a visually stunning HD-2D top-down RPG MVP set in the Throne Room wing of a fictional Red Keep (Game of Thrones). The player walks through 10 architecturally coherent, life-size rooms rendered with a cinematic HD-2D presentation: 3D environments with pixel-art character sprites, tilt-shift depth-of-field, volumetric lighting, bloom, particles, and per-room color grading.

No combat, no dialogue, no inventory. Just a breathtaking scene you can explore.

**Tech Stack:** Three.js + Becsy ECS + TypeScript + Vite

## Problem Statement / Motivation

HD-2D is one of the most visually compelling styles in modern gaming, but it's locked to proprietary engines (Unreal, Unity). There's no open, web-native HD-2D framework. This MVP proves the style is achievable in the browser with Three.js, and establishes the architectural foundation for a full RPG.

## Proposed Solution

A custom HD-2D rendering pipeline built on Three.js with Becsy ECS for entity management. The project is structured in 6 phases, each delivering a playable increment.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Serialized Game Loop                    │
│  ┌───────────┐  ┌───────────┐  ┌─────────────────────┐ │
│  │   Input    │→│  Becsy    │→│  Three.js Renderer   │ │
│  │  Manager   │  │   ECS     │  │                     │ │
│  └───────────┘  │           │  │ Post-Processing:     │ │
│                  │ Systems:  │  │ Pass 1: Bloom       │ │
│                  │ • Input   │  │ Pass 2: TiltShift   │ │
│                  │ • Movement│  │ Pass 3: Vignette +  │ │
│  ┌───────────┐  │ • Collisn │  │   ToneMapping       │ │
│  │Transition │  │ • Camera  │  │ Polish (Phase 6):    │ │
│  │  State    │  │ • TfmSync │  │ + N8AO, GodRays,    │ │
│  │ Machine   │  │ • Flicker │  │   ColorGrading      │ │
│  └───────────┘  │ • Render  │  └─────────────────────┘ │
│                  └───────────┘                           │
│                  └───────────┘                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Non-ECS Layer (plain Three.js objects):          │   │
│  │  • Static NPC sprites • Particle systems          │   │
│  │  • Room scene graphs  • Asset cache               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Research Insights: Architecture

**Simplicity recommendations (YAGNI):**
- Static NPCs don't need ECS. They never move, never interact — they're visual props. Add them as plain Three.js objects in the room scene graph. Promote to ECS entities later when behavior is needed.
- Particle systems are similarly room-level visual effects. Use `THREE.Points` directly in the room scene, not as ECS entities with `ParticleEmitter` components.
- This reduces the ECS to what actually benefits from it: the player entity (movement + transform sync) and flickering lights (per-frame updates).

**Source of truth:** ECS `Transform` is authoritative for entities that move (player). Three.js `Object3D.position` is authoritative for static objects (NPCs, props). `TransformSyncSystem` is one-way: ECS → Three.js, never the reverse.

### ECS Component Map (Simplified)

| Component | Fields | Purpose |
|---|---|---|
| `Transform` | px, py, pz, sx, sy, sz (float64) | Position + scale (rotation unused for top-down) |
| `Object3DRef` | object3d (object) | Reference to Three.js Object3D |
| `SpriteData` | texture (object), frameCol, frameRow (uint8) | Sprite atlas frame selection |
| `PlayerTag` | (tag, no fields) | Marks the player entity |
| `MovementIntent` | dx (float32), dz (float32) | Desired movement delta this frame (clamped by collision before applying to Transform) |
| `FlickerLight` | baseIntensity (float32), baseColor (uint32), noiseOffset (float32) | Flickering light source |
| `GameState` | currentRoomId (uint8), transitionState (uint8), teleported (boolean) | Singleton: game + transition state |

> **Note:** Three.js framework objects (`scene`, `camera`, `renderer`, `composer`) live in a plain `RenderContext` module singleton — NOT in ECS. No system ever "queries for entities with a renderer." Storing them in a Becsy component adds overhead with no benefit.

### Research Insights: ECS Simplification

**Removed from original plan:**
- `NPCTag` — NPCs are static Three.js objects, not ECS entities
- `RoomMember` — Room cleanup is handled by the RoomManager clearing the room scene graph, not by ECS queries
- `PointLightDef` — Merged into `FlickerLight` (only flickering lights need ECS; static lights are plain Three.js)
- `ParticleEmitter` — Particles are room-level Three.js objects
- `CameraState` — Camera config is a plain TypeScript object (it doesn't change per-frame from external sources)

**Why keep `FlickerLight` in ECS?** Because it requires per-frame updates with noise sampling. The `LightFlickerSystem` reads `FlickerLight` data and writes to the Three.js `PointLight` via `Object3DRef`. This is a genuine ECS use case (system iterating over a query).

### ECS System Execution Order

```
── gameplay domain (operates on ECS components) ──
1. InputSystem              (reads keyboard state)
2. PlayerMovementSystem     (reads input, writes MovementIntent)
3. CollisionSystem          (reads MovementIntent + room walls, clamps, writes Transform)
4. RoomTransitionSystem     (reads Transform, detects door proximity, triggers state machine)
5. CameraFollowSystem       (lerps camera toward player Transform; snaps if GameState.teleported)
── render domain (operates on Three.js objects directly) ──
6. TransformSyncSystem      (syncs ECS Transform → Three.js Object3D)
7. LightFlickerSystem       (directly modulates Three.js PointLight intensity/color)
8. ThreeRenderSystem        (calls composer.render(delta))
```

### Research Insights: System Order

**Two-zone execution pattern:** Systems 1-5 are the gameplay domain — they operate on ECS components only. Systems 6-8 are the render domain — they directly mutate Three.js objects. `TransformSyncSystem` is the bridge. `LightFlickerSystem` runs AFTER sync because it directly modulates `PointLight` objects (a pragmatic exception to keep the component map simple).

**`MovementIntent` decouples input from physics.** `PlayerMovementSystem` writes desired movement to `MovementIntent`. `CollisionSystem` reads `MovementIntent` + wall data, clamps, then writes the final result to `Transform`. This prevents wall-clipping and makes collision swappable (AABB now, more complex later).

**`GameState.teleported` flag:** When a room transition completes and the player spawns at a new position, `RoomTransitionSystem` sets `teleported = true`. `CameraFollowSystem` reads this flag and hard-snaps the camera (skips lerp for one frame) to avoid a visible camera slide from the old room's position. Cleared after use.

### Game Loop: Serialized Execution (Critical)

```typescript
// CORRECT: rAF scheduled AFTER execute completes
class GameLoop {
  private running = false;
  private executing = false;
  private lastTimestamp = 0;
  private readonly MAX_DELTA_MS = 33.33; // Cap at 30fps minimum

  start() {
    this.running = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (timestamp: number) => {
    if (!this.running || this.executing) return;

    let delta = timestamp - this.lastTimestamp;
    delta = Math.min(delta, this.MAX_DELTA_MS); // Prevent physics explosion
    this.lastTimestamp = timestamp;

    this.executing = true;
    this.world.execute(timestamp, delta)
      .then(() => {
        this.executing = false;
        if (this.running) requestAnimationFrame(this.tick);
      })
      .catch((err) => {
        console.error('World execution failed:', err);
        this.executing = false;
      });
  };
}
```

**Why this matters:** `await world.execute()` inside a naive rAF loop causes overlapping frames when execute takes >16ms. Two concurrent `world.execute()` calls corrupt Becsy component data. The serialized pattern ensures frames never overlap.

### Transition State Machine (Critical)

```
           ┌─────────┐
    ┌──────│  IDLE   │◄──────────────────────┐
    │      └────┬────┘                        │
    │  door     │                              │
    │  trigger  ▼                              │
    │      ┌─────────────┐                    │
    │      │ FADING_OUT  │ (input disabled)   │
    │      └──────┬──────┘                    │
    │             ▼                            │
    │      ┌─────────────┐                    │
    │      │  UNLOADING  │ (dispose old room) │
    │      └──────┬──────┘                    │
    │             ▼                            │
    │      ┌─────────────┐                    │
    │      │  LOADING    │ (build new room)   │
    │      └──────┬──────┘                    │
    │             ▼                            │
    │      ┌─────────────┐                    │
    └──────│ FADING_IN   │ (input re-enabled) │
           └──────┬──────┘                    │
                  └───────────────────────────┘
```

**Rules:**
- Door triggers are ONLY checked in `IDLE` state
- Player input is disabled during `FADING_OUT`, `UNLOADING`, `LOADING`
- Entity deletion + creation happens atomically in one `world.execute()` cycle (during `UNLOADING`→`LOADING`)
- All event listeners use `AbortController` for guaranteed cleanup
- Browser visibility change: pause loop on hidden, clamp delta on resume

### Project Structure

```
src/
├── main.ts                          # Entry: init world, start loop
├── game-loop.ts                     # Serialized rAF + world.execute()
│
├── ecs/
│   ├── world.ts                     # Becsy World creation (maxEntities: 1000)
│   ├── components/
│   │   ├── transform.ts             # Transform (position + scale)
│   │   ├── rendering.ts             # Object3DRef, SpriteData, FlickerLight
│   │   ├── tags.ts                  # PlayerTag
│   │   └── singletons.ts           # GameState (singleton ECS component)
│   └── systems/
│       ├── input.ts                 # Keyboard state tracking
│       ├── player-movement.ts       # WASD → MovementIntent
│       ├── collision.ts             # AABB wall/prop collision → Transform
│       ├── room-transition.ts       # Door detection + state machine
│       ├── camera-follow.ts         # Smooth camera interpolation
│       ├── light-flicker.ts         # Noise-driven light animation
│       ├── transform-sync.ts        # ECS Transform → Object3D (reactive)
│       └── three-render.ts          # EffectComposer.render()
│
├── rooms/
│   ├── RoomManager.ts               # Load/unload rooms, transition state machine
│   ├── RoomBuilder.ts               # Build 3D room scene from RoomData
│   ├── room-data/
│   │   ├── types.ts                 # RoomData, DoorDef, PropDef, LightDef, NPCDef
│   │   ├── 01-throne-room.ts        # through 10-battlements.ts
│   │   └── ...
│   └── room-presets/
│       └── lighting-presets.ts      # Per-room post-processing parameter overrides
│
├── rendering/
│   ├── render-context.ts            # Plain module singleton: scene, camera, renderer, composer
│   ├── renderer-setup.ts            # WebGLRenderer init
│   ├── hd2d-pipeline.ts             # PostProcessing EffectComposer
│   ├── sprite-factory.ts            # Pixel-art PlaneGeometry billboard
│   └── shaders/
│       └── dust-particle.vert       # GPU particle vertex shader
│
├── assets/                          # Textures, models, sprites, LUTs
├── loaders/
│   └── asset-manager.ts             # Ref-counted cache with in-flight dedup
├── input/
│   └── keyboard.ts                  # Raw keyboard state
└── types/
    └── assets.d.ts                  # Module declarations
```

---

## Visual Art Direction: "Illuminated Manuscript Come Alive"

The visual identity draws from medieval illuminated manuscripts — rich gold leaf, deep jewel tones, dramatic light against darkness. Every room should feel like stepping into a lavishly illustrated page that has come to life in three dimensions.

### Design Principles

1. **Light is the protagonist.** Every room is defined by how light enters and interacts with the space. The player is drawn through spaces by following light.
2. **Color tells the story.** Grand rooms use warm golds and deep reds. Dangerous rooms use cold blues and muted greens. The palette shifts emotionally as the player moves through the wing.
3. **Restraint creates impact.** A single god ray through a stained glass window is more powerful than flooding every room with effects. Save spectacle for signature moments.
4. **Texture over geometry.** Rich PBR textures on simple geometry looks better than complex models with flat materials. Spend the budget on texture quality.

### Per-Room Color Palettes

| # | Room | Dominant | Accent | Shadow | Mood Feeling |
|---|---|---|---|---|---|
| 1 | Iron Throne Room | `#C9A84C` warm gold | `#8B0000` deep crimson | `#1A1428` royal purple-black | Power, awe |
| 2 | Antechamber | `#8B7355` weathered oak | `#B8860B` dark goldenrod | `#2C2416` earth-dark | Anticipation, formality |
| 3 | Small Council | `#D4A017` candlelight amber | `#2F1B0E` dark mahogany | `#0F0A05` near-black | Conspiracy, intimacy |
| 4 | Hand's Solar | `#E8C87A` parchment gold | `#5C3317` leather brown | `#1C140E` warm dark | Knowledge, warmth |
| 5 | Grand Gallery | `#F5E6CA` natural daylight | `#704214` tapestry brown | `#2A2A3A` soft blue-shadow | Grandeur, openness |
| 6 | Guard Post | `#FF6B35` brazier orange | `#4A4A4A` cold iron | `#0D0D0D` charcoal | Tension, utility |
| 7 | Maegor's Entry | `#3D3D5C` bruise purple-gray | `#8B4513` rusted iron | `#0A0A14` midnight blue | Dread, weight |
| 8 | Queen's Ballroom | `#FFD700` pure gold | `#800020` burgundy | `#1A0F1E` deep plum | Elegance, luxury |
| 9 | Tower Stairwell | `#A0522D` torch sienna | `#696969` wet stone | `#050508` abyss | Claustrophobia, mystery |
| 10 | Battlements | `#87CEEB` sky blue | `#D2691E` sun-warmed stone | `#2F4F4F` distant haze | Freedom, drama |

### Per-Room Post-Processing Parameters

| Room | TiltShift Focus | TiltShift Feather | Bloom Intensity | Bloom Threshold | Vignette | Notes |
|---|---|---|---|---|---|---|
| Throne Room | 0.40 | 0.30 | 0.7 | 0.80 | 0.40 | Wide focus for massive space, strong bloom on stained glass |
| Antechamber | 0.35 | 0.30 | 0.5 | 0.85 | 0.45 | Standard HD-2D defaults |
| Small Council | 0.25 | 0.25 | 0.6 | 0.80 | 0.55 | Tight focus, heavy vignette — candlelit intimacy |
| Hand's Solar | 0.30 | 0.30 | 0.5 | 0.85 | 0.50 | Moderate — cozy study feel |
| Grand Gallery | 0.45 | 0.35 | 0.6 | 0.82 | 0.35 | Widest focus — long corridor needs visibility |
| Guard Post | 0.30 | 0.25 | 0.4 | 0.90 | 0.60 | Low bloom, heavy vignette — sparse lighting |
| Maegor's Entry | 0.25 | 0.20 | 0.3 | 0.90 | 0.65 | Tightest vignette — oppressive narrow passage |
| Ballroom | 0.40 | 0.30 | 0.8 | 0.78 | 0.40 | Highest bloom — chandeliers + gilded surfaces |
| Stairwell | 0.20 | 0.20 | 0.4 | 0.88 | 0.70 | Tightest focus + heaviest vignette — enclosed spiral |
| Battlements | 0.50 | 0.40 | 0.5 | 0.85 | 0.25 | Widest focus + lightest vignette — open sky |

### Signature Moments (One Per Room)

Each room has a single visual "wow" moment that the player discovers naturally:

1. **Throne Room:** God rays through stained glass casting colored light patterns on the floor, dust motes swirling in the beams
2. **Antechamber:** Torchlight reflecting off polished armor stands — warm orange glints against cool steel
3. **Small Council:** A pool of warm candlelight on the painted table surrounded by deep darkness — faces barely visible beyond the table
4. **Hand's Solar:** A single shaft of afternoon sunlight through the window catching floating dust, illuminating an open book
5. **Grand Gallery:** Rhythmic columns creating alternating bands of light and shadow — a corridor of repeating golden arches
6. **Guard Post:** Brazier embers spiraling upward in a column, casting deep dancing shadows on weapon racks
7. **Maegor's Entry:** Torchlight visible through murder holes casting geometric light patterns on the floor from above
8. **Ballroom:** Chandelier light reflected in the polished dark stone floor — a mirror-world effect below
9. **Stairwell:** Torch shadows stretching and bending along curved walls — the geometry itself becomes the effect
10. **Battlements:** Parallax cityscape of King's Landing bathed in golden hour light — the only room with a horizon

### Camera, Movement & Transition Feel

**Camera:** Slow, weighted follow with `lerpFactor: 0.06`. The camera should feel like a cinematographer tracking a subject, not a rigid follow-cam. Slight easing at rest — when the player stops, the camera drifts a fraction further before settling.

**Player movement:** 4.5 units/second walk speed (not run — this is a contemplative space). Movement should feel deliberate, like walking through a cathedral. No acceleration — immediate response but slow speed.

**Room transitions:** 800ms fade-out, 200ms hold black, 800ms fade-in (1.8s total). The black hold creates a breath — a moment of anticipation between spaces. Avoid instant transitions or fast fades which break the meditative pace.

### Anti-Patterns to Avoid

- **Uniform lighting** — Every room having the same ambient+directional setup kills variety. Some rooms should be DARK.
- **Centered everything** — Break symmetry. Offset the throne, angle the desks, stagger the torch placement.
- **Clean floors** — Add subtle texture variation, wear patterns, scuff marks. Perfect geometry looks artificial.
- **Over-processing** — If you can't tell which room you're in with postprocessing disabled, you haven't done enough with base lighting and color.
- **Synchronized flicker** — All torches flickering in unison looks mechanical. Offset noise seeds per light.

---

### Implementation Phases

### YAGNI Simplification Notes

The minimum viable HD-2D post-processing stack is: **TiltShift + Bloom + Vignette + ToneMapping**. This alone creates a convincing HD-2D look.

The following effects are marked as **optional polish** (Phase 6 or post-MVP):
- **SSAO (N8AO):** Adds depth to stone corners but is not necessary for the HD-2D identity. The base lighting + vignette already creates depth contrast. Add if performance allows.
- **God Rays:** Beautiful but expensive (~1-2ms/frame) and complex to set up (requires shadow-casting occluders). Build rooms first, add god rays to windowed rooms as a polish pass.
- **Color grading (Hue/Saturation/Brightness/Contrast):** Per-room color differentiation can initially be achieved through ambient light color alone. Add fine-grained grading in polish.

This means Phase 1 post-processing setup starts with just 4 effects, not 7. Simpler to debug, faster to iterate.

---

#### Phase 1: Project Foundation

**Goal:** Renderer boots, camera is positioned at HD-2D angle, a textured test room is visible with post-processing.

**Tasks:**

- [x] Initialize Vite + TypeScript project (`src/main.ts`)
  - `npm init -y`
  - `npm install three @lastolivegames/becsy postprocessing n8ao three-good-godrays`
  - `npm install -D vite vite-plugin-glsl typescript @types/three`
- [x] Create `tsconfig.json`:
  ```jsonc
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ES2022",
      "moduleResolution": "bundler",
      "experimentalDecorators": true,  // Required by Becsy (NOT TC39 decorators)
      "emitDecoratorMetadata": false,  // Becsy does NOT use reflect-metadata
      "strict": true,
      "noEmit": true,
      "esModuleInterop": true,
      "isolatedModules": true,         // REQUIRED by Vite (each file transpiled independently)
      "verbatimModuleSyntax": true,    // Forces explicit `import type` — prevents Becsy decorators from being erased
      "noUncheckedIndexedAccess": true, // room-data lookups return T | undefined
      "skipLibCheck": true,            // Faster builds; Three.js types are massive
      "resolveJsonModule": true,
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "baseUrl": ".",
      "paths": {
        "@ecs/*": ["src/ecs/*"],
        "@rooms/*": ["src/rooms/*"],
        "@rendering/*": ["src/rendering/*"],
        "@loaders/*": ["src/loaders/*"],
        "@input/*": ["src/input/*"]
      },
      "types": ["vite/client"]
    },
    "include": ["src/**/*.ts", "src/**/*.d.ts"],
    "exclude": ["node_modules", "dist"]
  }
  ```
- [x] Create `vite.config.ts` with `vite-plugin-glsl`, asset includes for `.glb`, `.hdr`, `.ktx2`
  - **Mirror tsconfig paths** as Vite `resolve.alias` entries (`@ecs`, `@rooms`, `@rendering`, etc.)
- [x] Create `src/types/assets.d.ts` — module declarations for `.glb`, `.glsl`, `.vert`, `.frag`, `.cube`
- [x] Create `src/rendering/renderer-setup.ts`:
  - `WebGLRenderer` with `antialias: false, stencil: false, depth: false` (composer manages these)
  - `toneMapping: THREE.NoToneMapping` (postprocessing handles it)
  - `outputColorSpace: THREE.SRGBColorSpace`
  - `powerPreference: 'high-performance'` (hints browser to use discrete GPU on laptops)
  - `shadowMap.enabled: true`, `shadowMap.type: THREE.PCFSoftShadowMap` (NOT `PCFShadowMap` — godrays require direct shadow map sampling, and `PCFShadowMap` enables hardware comparison mode that forces per-frame depth texture copies)
  - `shadowMap.autoUpdate: false` — manually set `needsUpdate = true` only on room load (static scenes don't need per-frame shadow updates)
  - **Only enable shadows on DirectionalLight** — no point light shadows (saves ~6 draw calls per light)
- [x] Create `src/rendering/hd2d-pipeline.ts` — the HD-2D post-processing stack:
  ```
  EffectComposer (HalfFloatType framebuffers, stencil: false, depth: false)
  ├── RenderPass              → Scene render (ALWAYS required as first pass)
  ├── EffectPass #1 (bloom):  → BloomEffect (CONVOLUTION — needs own pass)
  ├── EffectPass #2 (DoF):    → TiltShiftEffect (CONVOLUTION — needs own pass)
  ├── EffectPass #3 (cheap):  → VignetteEffect + ToneMappingEffect (non-convolution, merge free)
  │
  │ (Added in Phase 6 polish — optional):
  │ ├── N8AOPostPass          → SSAO (goes AFTER RenderPass, not replaces it)
  │ ├── GodraysPass           → per-room, windowed rooms only (gammaCorrection: false)
  │ ├── Per-room EffectPass   → pre-created per room with HueSaturation + BrightnessContrast
  ```
  **CONVOLUTION CONSTRAINT:** Only one convolution effect per `EffectPass`. Bloom and TiltShift are BOTH convolution effects — they CANNOT share a pass. Non-convolution effects (Vignette, ToneMapping, HueSaturation, BrightnessContrast) can ride along in any pass for free. So the core pipeline is 4 passes total: RenderPass + Bloom pass + TiltShift pass + cheap effects pass.

  **Per-room color grading strategy:** Toggling/modifying effects inside an EffectPass triggers a full shader recompile (visible freeze). Instead, **pre-create one EffectPass per room** at startup with room-specific HueSaturation/BrightnessContrast values. Swap rooms by setting `pass.enabled = true/false` (instant, no recompile). Share BloomEffect and TiltShiftEffect instances across passes.

  **Gamma correction chain:** RenderPass(linear) → N8AOPostPass(gammaCorrection auto=false) → GodraysPass(gammaCorrection=false) → final EffectPass(encodeOutput=true, handles single sRGB conversion). Only the LAST pass does gamma.
- [x] Create Becsy world setup (`src/ecs/world.ts`) — `World.create({ maxEntities: 1000 })`
  - **Vite HMR guard:** Use `import.meta.hot.dispose()` to terminate and re-create world on HMR (prevents "component already registered" errors)
- [x] Create `RenderContext` module singleton (`src/rendering/render-context.ts`) — plain TypeScript object holding `scene`, `camera`, `renderer`, `composer` (NOT an ECS component)
- [x] Create `GameState` singleton ECS component (`src/ecs/components/singletons.ts`) — `currentRoomId`, `transitionState`, `teleported`
- [x] Create serialized game loop (`src/game-loop.ts`) — rAF scheduled only after `world.execute()` resolves
- [x] Set up camera:
  ```
  PerspectiveCamera(35, aspect, 0.1, 500)
  Position: [0, 18, 22]  → ~39° from horizontal (HD-2D sweet spot)
  LookAt: [0, 0, 0]
  ```
- [x] Create a test room: textured floor + 4 walls + 1 directional light + 2 point lights (flickering)
- [ ] Set up `KTX2Loader` with Basis transcoder + `DRACOLoader` for compressed assets from day one (not Phase 6 — uncompressed 2K PBR textures across 10 rooms will exceed 100MB without KTX2)
  - Default texture resolution: 1024x1024 for most surfaces (2K only for hero surfaces like Iron Throne)
  - ETC1S for diffuse/albedo, UASTC for normal maps
- [x] Add window resize handler in Phase 1 (not deferred):
  - `renderer.setSize()`, `camera.aspect` + `.updateProjectionMatrix()`, `composer.setSize()`
- [x] Add `stats-gl` in dev mode for real-time performance monitoring
- [x] Log `renderer.info` every 60 frames in dev mode (draw calls, triangles, textures, geometries)
- [x] Add dev-mode debug overlay (compile out via `import.meta.env.DEV`):
  - Keyboard shortcuts to toggle each post-processing effect on/off
  - Number keys 1-0 to teleport to any room (skips transitions for fast testing)
  - FPS, draw calls, entity count display
  - **Note:** Consider keeping DoF toggle in production too. Octopath Traveler I received significant fan backlash for excessive DoF blur — a "Visual Clarity Patch" (disabling DoF) was extremely popular. Let players choose.
- [x] Add WebGL context loss handler: `webglcontextlost` → pause loop, `webglcontextrestored` → rebuild renderer
- [x] Verify: post-processing stack renders correctly
- [x] **Test `outputColorSpace: SRGBColorSpace` against pmndrs/postprocessing** — verified: HalfFloat framebuffers keep intermediates linear, final EffectPass encodes to sRGB. No double-gamma.

### Research Insights: Phase 1

**HD-2D Camera Calibration:**
- FoV 30-40° (35° recommended). Narrower than typical 3D games — creates the HD-2D "miniature/diorama" feel.
- Camera elevation ~35-40° from horizontal. Lower = more wall visibility. Higher = more floor visibility. 38° is the Octopath sweet spot.
- Camera distance from player: ~25-30 world units. Close enough for detail, far enough for room context.
- **Do NOT use OrthographicCamera** — depth-of-field requires perspective projection's depth gradient.

**Post-Processing Calibration (from HD-2D analysis):**
- **Tilt-shift DoF is THE signature effect.** Without it, it doesn't look HD-2D. Focus area 0.3-0.5 of screen height; blur feather 0.2-0.4. Start at `focusArea: 0.35, feather: 0.3`.
- **Bloom must be subtle.** Over-bloom is the #1 mistake in HD-2D recreation. Threshold 0.8-0.9, intensity 0.4-0.7. Only light sources should bloom — use `luminanceThreshold` to filter.
- **SSAO adds the most "depth" per cost.** N8AO is the best option — `aoRadius: 5, intensity: 2, distanceFalloff: 1`.
- **Vignette is cheap.** Darkness 0.4-0.5 draws focus to center without feeling heavy.
- **Color grading is per-room.** Use `HueSaturationEffect` + `BrightnessContrastEffect` (simpler than LUT files for MVP). Swap parameter values during room fade.
- **ToneMapping goes LAST** in the chain, always.

**Performance note:** pmndrs `postprocessing` auto-merges non-convolution effects into one shader, but **convolution effects need their own pass** (Bloom and TiltShift are both convolution). Core pipeline = 4 passes: RenderPass + BloomPass + TiltShiftPass + CheapEffectsPass (Vignette + ToneMapping merged). When Phase 6 adds N8AO (after RenderPass) + GodraysPass + per-room ColorGradingPass, total becomes ~7 passes in windowed rooms. Still within budget.

**Performance Budget (enforce from Phase 1):**

| Metric | Budget | Red Line | Measurement |
|---|---|---|---|
| Frame time | < 16.67ms | > 20ms | stats-gl |
| Draw calls | < 100 | > 150 | `renderer.info.render.calls` |
| Triangles | < 100K | > 250K | `renderer.info.render.triangles` |
| GPU memory (textures) | < 40MB | > 60MB | `renderer.info.memory.textures` × avg size |
| Post-processing time | < 8ms | > 10ms | `performance.mark()` around `composer.render()` |
| JS frame time (ECS) | < 4ms | > 8ms | `performance.mark()` around `world.execute()` |
| Particle count | < 2000 | > 5000 | Manual tracking |
| Shadow-casting lights | <= 2 | > 3 | Manual tracking |
| Loaded textures | < 30 | > 50 | `renderer.info.memory.textures` |

**Shadow budget:**
- DirectionalLight shadows: 1 shadow map, ~2048x2048 — affordable.
- PointLight shadows: 6 shadow maps EACH (cubemap). With 4-8 torches per room = 24-48 shadow maps per frame. **Do NOT enable point light shadows.** Use SSAO (N8AO) for corner/contact shadows instead. This alone saves 50-100 draw calls.

**Acceptance Criteria:**
- [ ] `npm run dev` opens browser with a lit, textured test room
- [ ] HD-2D post-processing is visibly active (tilt-shift blur, bloom glow, vignette, tone mapping)
- [ ] Camera is at ~38° angle with ~35° FoV
- [ ] Becsy world executes systems each frame without errors
- [ ] stats-gl shows < 30 draw calls for the test room
- [ ] No overlapping `world.execute()` calls (verified via console.log guard)

---

#### Phase 2: Player Character & Input

**Goal:** A pixel-art sprite walks around the test room with smooth camera follow.

**Tasks:**

- [x] Create `src/input/keyboard.ts` — tracks key down/up state for WASD + arrow keys
  - Register listeners with `AbortController` for guaranteed cleanup
- [x] Create `InputSystem` (`src/ecs/systems/input.ts`) — reads keyboard state, exposes via `this.attach()`
  - **Respects transition state:** returns no input when `GameState.transitionState !== IDLE`
- [x] Create `Transform` component (`src/ecs/components/transform.ts`):
  ```typescript
  @component class Transform {
    @field.float64 declare px: number;
    @field.float64 declare py: number;
    @field.float64 declare pz: number;
    @field.float64 declare sx: number; // default 1
    @field.float64 declare sy: number; // default 1
    @field.float64 declare sz: number; // default 1
  }
  ```
- [x] Create `SpriteData` component — stores texture ref, current frame column/row
- [x] Create `src/rendering/sprite-factory.ts`:
  - Uses `PlaneGeometry` (NOT `THREE.Sprite` — Sprite auto-rotates wrong at 3/4 angle)
  - `MeshBasicMaterial` with `NearestFilter`, `alphaTest: 0.5`, `transparent: true`, `depthWrite: true`
  - `texture.generateMipmaps = false`
  - Sprite plane is Y-axis-only billboarded (or fixed upright, since camera is fixed)
  - **Offset geometry origin to bottom-center:** `geometry.translate(0, height/2, 0)` — prevents z-fighting at foot level
  - Sprite size: scale to ~1.5-2x a floor tile to feel proportionally correct in the 3D scene
- [x] Create `MovementIntent` component (`src/ecs/components/transform.ts`):
  ```typescript
  @component class MovementIntent {
    @field.float32 declare dx: number;
    @field.float32 declare dz: number;
  }
  ```
- [x] Create `PlayerMovementSystem`:
  - Reads input, writes `MovementIntent` (NOT directly to Transform) at constant speed (~4.5 units/second — deliberate, cathedral-walking pace)
  - 8-directional movement with diagonal normalization (`/ Math.SQRT2`)
  - Updates `SpriteData.frameCol` for facing direction
  - **Destructure component reads immediately** (Becsy gotcha: handles invalidate on next read)
- [x] Create `CollisionSystem`:
  - Reads `MovementIntent` + room wall boundaries (from RoomManager)
  - Clamps intent against AABB walls, then applies clamped result to `Transform`
  - Runs AFTER PlayerMovement, BEFORE RoomTransition
- [x] Create `TransformSyncSystem` — syncs ECS Transform to Object3DRef.object3d
- [x] Create `CameraFollowSystem`:
  - Lerp camera position toward player with smoothing factor `0.06` (slow, cinematic follow — like a tracking shot)
  - **Use frame-rate-independent lerp:** `lerp(current, target, 1 - Math.pow(1 - 0.06, delta * 60))` — a constant `lerp(a, b, 0.06)` runs differently at 30fps vs 144fps
  - Maintain fixed offset vector (e.g., `[0, 18, 22]` relative to player)
  - **Snap camera to pixel grid** to prevent sub-pixel jitter on sprites:
    ```typescript
    // After lerp, snap to texel grid
    const pixelSize = 1 / screenPixelsPerUnit;
    camera.position.x = Math.round(camera.position.x / pixelSize) * pixelSize;
    ```
- [x] Source placeholder 16x16 pixel-art character sprite (8 directions, idle)
  - Recommended: OpenGameArt "16x16 RPG character" or itch.io CC0

### Research Insights: Phase 2

**Pixel art sprite rendering in 3D — getting it right:**
- `texture.minFilter = THREE.NearestFilter` and `texture.magFilter = THREE.NearestFilter` — CRITICAL. Bilinear filtering destroys pixel art.
- `texture.generateMipmaps = false` — mipmaps cause blurring at distance.
- `texture.colorSpace = THREE.SRGBColorSpace` — ensure correct color.
- Use `alphaTest: 0.5` instead of `transparent: true` + `blending` — alphaTest gives correct depth writing. With transparency, sprites behind other sprites show-through incorrectly.
- Sprite scale: if your pixel art is 16x16 and one game tile is 1 world unit, a character sprite should be ~1.0-1.5 units wide. Experiment for the right proportions.

**Sprite shadow trick:** Place a small, dark, semi-transparent elliptical `PlaneGeometry` at the sprite's feet, flat on the ground. This gives a fake "blob shadow" without any shadow map cost. Simple and effective for HD-2D.

**Becsy gotcha reminder — destructure immediately:**
```typescript
// WRONG: pos handle invalidated by vel read
const pos = entity.read(Transform);
const vel = entity.read(Velocity);
pos.px; // BOOM — stale handle

// RIGHT: destructure before next read
const { px, py, pz } = entity.read(Transform);
```

**Acceptance Criteria:**
- [ ] Player sprite renders as a crisp pixel-art billboard in the 3D scene
- [ ] WASD/arrow keys move the player smoothly in 8 directions
- [ ] Camera follows the player with smooth interpolation
- [ ] Sprite faces the correct direction when moving
- [ ] No sub-pixel jitter on the sprite
- [ ] Player cannot walk through test room walls (CollisionSystem works)
- [ ] Blob shadow is visible under the player sprite

---

#### Phase 3: Room System & Transitions

**Goal:** Multiple rooms load/unload with fade-to-black transitions. Doorways connect rooms per the connectivity map.

**Tasks:**

- [x] Define `RoomData` interface (`src/rooms/room-data/types.ts`):
  ```typescript
  interface RoomData {
    id: number;
    name: string;
    dimensions: { width: number; depth: number; height: number }; // world units
    mood: 'grand' | 'intimate' | 'dark' | 'open';
    textures: { floor: string; walls: string; ceiling: string };
    doors: DoorDef[];       // { position, size, targetRoomId, spawnPoint }
    lights: LightDef[];     // { type, position, color, intensity, flicker?, shadowEnabled? }
    props: PropDef[];       // { modelPath, position, rotation, scale }
    npcs: NPCDef[];         // { spritePath, position, facing, label }
    particles: ParticleDef[]; // { type: 'dust'|'embers'|'wind', region, density }
    colorGrading: { hue: number; saturation: number; brightness: number; contrast: number };
    ambientLight: { color: number; intensity: number };
    postProcessOverrides?: Partial<HD2DSettings>; // per-room DoF, bloom, vignette tweaks
  }
  ```
- [x] Create `RoomManager` (`src/rooms/RoomManager.ts`) with **transition state machine**:
  - States: `IDLE`, `FADING_OUT`, `UNLOADING`, `LOADING`, `FADING_IN`
  - Door triggers ONLY checked in `IDLE` state
  - Input disabled during transition (checked by InputSystem via GameState)
  - `AbortController` per transition for guaranteed cleanup
  - Fade overlay: full-screen CSS `<div>` with opacity transition (cheaper than WebGL overlay)
  - **Timing:** 800ms fade-out, 200ms hold-black, 800ms fade-in (1.8s total). The hold creates a breath of anticipation between spaces.
  - **Adjacent room preloading:** When player enters door proximity zone (before triggering transition), start async preload of target room's textures. Actual room build should be near-instant if preloaded.
  - **Memory strategy:** Current room fully loaded + adjacent rooms' textures preloaded into cache. Non-adjacent rooms fully unloaded. Peak memory = 2-3 rooms, not 10.
- [x] Create `RoomBuilder` (`src/rooms/RoomBuilder.ts`):
  - Returns a dedicated `THREE.Group` per room (`roomGroup.name = 'room-{id}'`). ALL room objects are children of this group. On unload, `scene.remove(roomGroup)` + traverse and dispose. This prevents leaked references.
  - **Use `InstancedMesh` from the start** for repeated props (columns, torch sconces, armor stands). 1 draw call per instanced group regardless of count.
  - Consider `BufferGeometryUtils.mergeGeometries()` for static room shell (floor + walls + ceiling → 1-2 draw calls if same material)
  - Constructs floor, walls, ceiling from `PlaneGeometry` with PBR textures
  - Places props via `GLTFLoader` at specified positions
  - Creates `PointLight` instances (with `FlickerLight` ECS entities for flickering ones)
  - Places NPC sprites as plain Three.js billboard meshes (NOT ECS entities)
  - Creates particle `THREE.Points` systems (NOT ECS entities)
  - Applies per-room color grading by updating `HueSaturationEffect` / `BrightnessContrastEffect` uniforms
- [x] Create `src/loaders/asset-manager.ts` with **reference-counted cache**:
  ```typescript
  // Key patterns:
  // 1. Cache entry inserted BEFORE fetch starts (prevents double-load)
  // 2. Concurrent load() calls for same URL share the same Promise
  // 3. release() decrements refCount; dispose only when refCount === 0
  // 4. release() defers dispose if loadPromise is still pending
  // 5. Material cache: same texture+shader combo = shared Material instance (prevents draw call explosion)
  // 6. On load failure: return placeholder geometry/texture + log warning (do NOT crash)
  // 7. Call renderer.initTexture(tex) after loading to force GPU upload immediately
  //    (prevents frame spikes when texture is first rendered during gameplay)
  ```
- [x] Create `RoomTransitionSystem` (`src/ecs/systems/room-transition.ts`):
  - Checks player proximity to door trigger AABBs (only in IDLE state)
  - Delegates to RoomManager state machine
  - Sets `GameState.teleported = true` after spawn so `CameraFollowSystem` snaps (not lerps)
  - **Copy door data before yielding** in Becsy coroutines (handles invalidate across yields)
  - **Fallback if coroutines are buggy:** implement as a state machine with `transitionState` + `transitionProgress` fields in `GameState`
- [x] Build 2 connected test rooms (Throne Room + Antechamber) with a door between them

### Research Insights: Phase 3

**Race condition prevention (8 identified risks):**

| Risk | Prevention |
|---|---|
| Double door trigger during fade | State machine: only check doors in `IDLE` state |
| Overlapping `world.execute()` | Serialized game loop (Phase 1) |
| Asset double-load | Ref-counted cache with in-flight dedup |
| Entity create/delete timing | Batch all entity ops in single `world.execute()` cycle |
| Event listener leaks | `AbortController` per room lifecycle |
| Tab visibility change | Pause loop on hidden, clamp delta on resume |
| Progress tracking across cancelled loads | Per-session load tracker with unique ID |
| Stale entity refs across coroutine yields | Copy data before yield, never hold refs across yields |

**Visibility change handler (add in Phase 1):**
```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    gameLoop.pause();
  } else {
    gameLoop.resetDeltaTime(); // Prevent delta spike
    gameLoop.resume();
  }
});
```

**GPU resource disposal checklist (on room unload):**
- Remove room Group from scene: `scene.remove(roomGroup)`
- Traverse and dispose: `roomGroup.traverse(obj => { if (obj.isMesh) { obj.geometry.dispose(); obj.material.dispose(); } })`
- Release textures via AssetManager (refCount-based — only dispose when no room uses them)
- Delete FlickerLight ECS entities for the old room
- Verify via `renderer.info.memory.textures` and `renderer.info.memory.geometries`

**Acceptance Criteria:**
- [ ] Two rooms exist with different textures, lighting, and props
- [ ] Walking into a doorway triggers a fade-to-black transition
- [ ] Player appears at the correct spawn point in the new room
- [ ] Double-triggering a door during transition is prevented
- [ ] GPU resource counts decrease after room unload (verified via renderer.info)
- [ ] Per-room color grading changes are visible
- [ ] Player cannot walk through walls
- [ ] Tab hide/show doesn't break the game

---

#### Phase 4: Lighting, Particles & Visual Polish

**Goal:** The HD-2D visual identity is fully realized — torches flicker, dust floats, god rays stream through windows, rooms feel alive.

**Tasks:**

- [x] Create `LightFlickerSystem` (`src/ecs/systems/light-flicker.ts`):
  - Uses `SimplexNoise` from Three.js addons
  - Layers 3 noise frequencies for natural flicker:
    - Slow sway: `noise(time * 0.5 + offset) * 0.15` — gradual intensity drift
    - Medium flutter: `noise(time * 1.5 + offset) * 0.10` — gentle pulsing
    - Fast crackle: `noise(time * 4.0 + offset) * 0.05` — subtle rapid variation
  - Total variation: `baseIntensity * (1.0 + slowNoise + medNoise + fastNoise)`
  - Color temperature shift: when intensity is higher, shift color toward `0xFFE0B0` (warm); when lower, toward `0xFFA050` (amber)
  - Each light gets a unique `noiseOffset` so they don't flicker in sync
  - **Performance tip:** Pre-compute a 1024-sample noise table at world creation, then index into it with `(time * freq) & 1023`. Cheaper than live `SimplexNoise` at 60fps × 8 lights × 3 frequencies.
- [x] Create room-level particle systems (plain Three.js, not ECS):
  - **Dust motes:** `THREE.Points` + `ShaderMaterial`
    - Soft circle via `gl_PointCoord` distance check in fragment shader
    - `blending: THREE.AdditiveBlending`, `depthWrite: false`
    - 50-100 particles per room, gentle sine-wave drift
    - Concentrated near windows/light shafts (not uniformly distributed)
    - Size: 2-4 pixels on screen
  - **Torch embers:** Same technique, but:
    - Spawn at torch Y position, float upward with `vy: 0.5-1.5`
    - Add horizontal turbulence: `vx += noise(time) * 0.3`
    - Color: start `#FFD700`, fade through `#FF8C00` to `#FF4500`, then alpha-out
    - Lifetime: 1-3 seconds, then respawn
    - 10-20 particles per torch
  - **Wind (Battlements only):** Horizontal streaks with alpha fade, faster speed
- [ ] **[DEFERRED TO PHASE 6]** Integrate `three-good-godrays`:
  - Create bright emissive `PlaneGeometry` behind each window (the "light source" for god rays)
  - Set `castShadow: true` on all wall/column meshes (required for occlusion)
  - Add `GodRaysEffect` to the EffectPass (per-room enable/disable)
  - Rooms with god rays: Throne Room (stained glass), Hand's Solar (window), Grand Gallery (arched windows), Battlements (sun)
  - Rooms without: Small Council, Guard Post, Maegor's Entry, Stairwell (no/minimal windows)
  - **Note:** God rays are ~1-2ms/frame. Build rooms with strong directional + ambient light first. Add god rays as visual polish once rooms are proven stable at 60fps.
- [x] Create per-room lighting presets (`src/rooms/room-presets/lighting-presets.ts`):

  | Mood | Ambient Color | Ambient Intensity | Direct Color | Direct Intensity | Point Lights | Color Grading |
  |---|---|---|---|---|---|---|
  | **Grand** | `0x4466AA` | 0.3 | `0xFFE8C0` | 1.2 | 6-8 warm torches | hue: 0, sat: +0.1, bright: 0, contrast: +0.1 |
  | **Intimate** | `0x443322` | 0.2 | none | 0 | 4-6 candles | hue: +10, sat: +0.15, bright: -0.05, contrast: +0.05 |
  | **Dark** | `0x1A1A2E` | 0.1 | none | 0 | 2-3 sparse torches | hue: -5, sat: -0.1, bright: -0.1, contrast: +0.15 |
  | **Open** | `0x6688BB` | 0.5 | `0xFFF5E0` | 1.5 | 0-1 | hue: -10, sat: 0, bright: +0.05, contrast: +0.2 |

- [x] Per-room post-processing overrides:
  - Grand rooms: `bloom.intensity: 0.7, tiltShift.focusArea: 0.4` (wider focus for big spaces)
  - Dark rooms: `bloom.intensity: 0.4, tiltShift.focusArea: 0.25, vignette.darkness: 0.6` (tighter, moodier)
  - Open rooms: `bloom.intensity: 0.5, vignette.darkness: 0.3, tiltShift.focusArea: 0.5` (wider, airier)

### Research Insights: Phase 4

**What makes HD-2D look good vs bad:**
- **Good:** Subtle bloom on ONLY light sources. Tilt-shift that creates a gentle "shelf" of focus across the center 30-40% of screen. SSAO that deepens stone corners. Warm color grading in interiors.
- **Bad:** Bloom on everything (turns scene into a glowing mess). Too-strong DoF blur (feels like a toy camera, not a miniature). Over-saturated colors. Vignette so strong the edges go black.
- **The #1 rule:** Restraint. Each effect should be subtle enough that removing it feels like something is "missing" rather than that adding it feels "flashy."

**God rays performance note:** `three-good-godrays` uses screen-space raymarching and requires shadow maps on occluding meshes. Since we're only using DirectionalLight shadows (not point light), the cost is manageable. Expect ~1-2ms per frame for god rays. Make them optional — disable in rooms without windows.

**Acceptance Criteria:**
- [ ] Torches visibly flicker with natural, non-synchronized variation
- [ ] Dust motes float in light shafts near windows
- [ ] Ember particles rise from torches with turbulence and color fade
- [ ] God rays stream through windows in applicable rooms
- [ ] Each room has a distinct color mood visible immediately on entry
- [ ] No effect feels "over-processed" — restraint over spectacle
- [ ] Performance: < 50 draw calls per room, 60fps maintained

---

#### Phase 5: The Throne Room Wing — 10 Rooms

**Goal:** All 10 rooms fully built with assets, props, NPCs, lighting, and atmosphere.

**Connectivity Map:**

```
                    [10. Battlements]
                          |
                    [9. Tower Stairwell]
                          |
[4. Hand's Solar] -- [5. Grand Gallery] -- [6. Guard Post]
                          |
[3. Small Council] -- [1. THRONE ROOM] -- [7. Maegor's Entry]
                          |
                    [2. Antechamber]
                          |
                    [8. Queen's Ballroom]
```

**Room Specifications (with realistic medieval proportions):**

Real medieval great halls ranged from 20m-70m long. The Red Keep's throne room in the books is described as cavernous. Using 1 world unit = 1 meter:

| # | Room | Dimensions (m) | Ceiling (m) | Lights | Props | NPCs | Mood |
|---|---|---|---|---|---|---|---|
| 1 | Iron Throne Room | 50w x 25d | 15 | 1 directional + 8 torches | Throne, columns (x16), banners (x8) | 6 | Grand |
| 2 | Antechamber | 15w x 12d | 6 | 4 torches | Armor stands (x4), bench, doors | 2 | Intimate |
| 3 | Small Council | 10w x 8d | 5 | 6 candles | Table, chairs (x8), maps, candelabras | 3 | Intimate |
| 4 | Hand's Solar | 8w x 8d | 5 | 2 candles + hearth | Desk, bookshelf, chair, rug | 1 | Intimate |
| 5 | Grand Gallery | 30w x 6d | 8 | 1 directional + 4 torches | Columns (x12), tapestries (x6) | 3 | Grand |
| 6 | Guard Post | 10w x 8d | 4 | 1 brazier | Weapon racks (x3), armor stands (x2) | 3 | Dark |
| 7 | Maegor's Entry | 20w x 5d | 6 | 3 torches | Drawbridge mechanism, iron gates | 2 | Dark |
| 8 | Queen's Ballroom | 18w x 18d | 8 | 2 chandeliers + 6 sconces | Columns (x8), musician gallery, drapes | 6 | Grand |
| 9 | Tower Stairwell | 5w x 5d | 12 (spiral) | 2 torches | Spiral stairs, arrow slits | 0 | Dark |
| 10 | Battlements | 25w x 4d | open sky | 1 directional (sun) | Crenellations, flagpoles | 2 | Open |

**Estimated draw calls per room:**

| Room | Geometry draws | Sprite draws | Total | Notes |
|---|---|---|---|---|
| Throne Room | ~30 (floor+walls+ceiling+columns+throne+banners) | 6 NPCs | ~36 | Use InstancedMesh for 16 columns |
| Grand Gallery | ~20 (floor+walls+columns+tapestries) | 3 NPCs | ~23 | Use InstancedMesh for 12 columns |
| Queen's Ballroom | ~22 (floor+walls+columns+chandeliers+drapes) | 6 NPCs | ~28 | |
| Smaller rooms | ~10-15 each | 1-3 NPCs | ~13-18 | |

All rooms well under the 100 draw call budget. InstancedMesh for repeated columns/torch sconces is the key optimization.

**Tasks per room:**

- [x] **Room 1 — Iron Throne Room** (Grand / Imposing)
  - 50m x 25m x 15m ceiling — truly massive
  - Iron Throne on raised stone dais (center-back wall)
  - 2 rows of 8 stone columns (InstancedMesh) along the length
  - 4 tall stained-glass windows per side wall → god rays + colored light
  - Red/gold banners hanging between columns (textured PlaneGeometry)
  - 8 iron torch sconces along columns (FlickerLight entities)
  - 1 directional light (sun through windows, warm gold)
  - Floor: large polished stone tiles (seamless PBR texture, tiled)
  - NPCs: 2 Kingsguard (white armor sprites) flanking throne, 4 courtiers scattered
  - Doors: N→Grand Gallery, S→Antechamber, E→Maegor's Entry, W→Small Council
  - Particles: dust motes in god ray shafts, torch embers

- [x] **Room 2 — Throne Room Antechamber** (Formal / Tense)
  - 15m x 12m x 6m ceiling
  - Heavy oak double doors (north wall, decorative model)
  - 4 Kingsguard armor display stands along walls
  - Stone bench against east wall, 2 banners
  - 4 wall-mounted torches (FlickerLight)
  - Floor: rough-cut stone (different texture than Throne Room — less polished)
  - NPCs: 2 guards flanking the north door

- [x] **Room 3 — Small Council Chamber** (Intimate / Political)
  - 10m x 8m x 5m ceiling — deliberately small, intimate
  - Long rectangular table (center) with 8 high-backed chairs
  - Painted map on west wall (textured plane)
  - 2 candelabras on table + 4 individual candles on wall sconces
  - No windows — entirely candlelit (warm amber glow)
  - Floor: dark polished wood
  - NPCs: 3 council members seated at table

- [x] **Room 4 — Hand's Solar** (Studious / Warm)
  - 8m x 8m x 5m ceiling (slightly round tower room)
  - Large desk with scrolls/books/inkwell props
  - Floor-to-ceiling bookshelf on one wall
  - Stone hearth/fireplace (emissive material + FlickerLight)
  - 1 arched window (east wall) → god rays
  - Floor: wooden planks with a woven rug
  - NPCs: 1 Hand of the King seated at desk

- [x] **Room 5 — Grand Gallery** (Majestic / Airy)
  - 30m x 6m x 8m ceiling — long, narrow corridor
  - 6 columns per side (InstancedMesh) with arched windows between them
  - 6 Targaryen conquest tapestries between windows (textured planes)
  - Natural daylight through windows → god rays
  - 4 torch sconces
  - Floor: polished stone (same as Throne Room)
  - NPCs: 2 servants, 1 noble strolling

- [x] **Room 6 — Royal Guard Post** (Martial / Stark)
  - 10m x 8m x 4m — low ceiling, utilitarian
  - 3 weapon racks (swords, spears), 2 armor stands
  - 1 iron brazier (center) with hot coals (emissive + FlickerLight + embers)
  - No decoration — raw function
  - Floor: bare stone with scattered straw (particle or texture)
  - NPCs: 3 guards (1 warming at brazier, 2 at weapon racks)

- [x] **Room 7 — Maegor's Holdfast Entry** (Foreboding / Heavy)
  - 20m x 5m x 6m — narrow, oppressive passage
  - Thick double-layered stone walls
  - Visible murder holes in ceiling (modeled recesses)
  - Decorative drawbridge mechanism (iron wheels, chains)
  - 3 sparse torches — deep shadows between them
  - Floor: rough stone with iron drainage grate
  - NPCs: 2 guards at passage ends

- [x] **Room 8 — Queen's Ballroom** (Elegant / Intimate)
  - 18m x 18m x 8m ceiling
  - 2 hanging chandeliers (emissive + FlickerLight, multiple candle points)
  - 6 ornate wall sconces
  - Raised musician's gallery platform along south wall
  - 8 gilded columns, fabric drapes between them
  - Floor: polished dark stone (slightly reflective — use `MeshStandardMaterial.roughness: 0.3`)
  - NPCs: 4 nobles, 2 musicians on gallery

- [x] **Room 9 — Tower Stairwell** (Claustrophobic / Mysterious)
  - 5m x 5m x 12m (vertical) — represented as a spiral in top-down
  - Curved stone walls (could be a custom geometry or pre-made model)
  - 2 arrow-slit windows (thin bright lines)
  - 2 torches, 180° apart
  - Floor: worn stone steps (texture or stepped geometry)
  - NPCs: none — just atmosphere
  - Particles: minimal dust

- [x] **Room 10 — Battlements Overlook** (Open / Dramatic)
  - 25m x 4m x open sky
  - Crenellated parapet walls (box geometry with merlons)
  - **Parallax background:** 3-4 layered planes at increasing depth:
    - Layer 1 (near): Red Keep tower silhouettes
    - Layer 2 (mid): King's Landing rooftops
    - Layer 3 (far): Blackwater Bay + distant hills
    - Layer 4 (sky): Gradient sky with clouds
    - Layers scroll at different speeds based on camera position for parallax effect
  - Strong directional sunlight from side
  - Floor: stone walkway
  - NPCs: 2 guards at posts
  - Particles: wind streaks (horizontal), distant birds (small sprites)

**Asset Sourcing Tasks:**

- [ ] **Stone textures:** Poly Haven "Castle Wall Slates", "Stone Wall", ambientCG stone/brick — download at 2K resolution
- [ ] **Wood textures:** Poly Haven "Wood Floor" variants, ambientCG dark wood
- [ ] **Metal textures:** ambientCG "Metal Plates", "Rusted Iron"
- [ ] **Fabric textures:** Poly Haven "Fabric" variants for banners/tapestries/drapes
- [ ] **Medieval prop models:** Quaternius Fantasy Props MegaKit (CC0, 200+ models including thrones, tables, bookshelves, weapon racks, chandeliers)
- [ ] **Additional props:** Kenney Furniture Kit (140 CC0 assets)
- [ ] **16x16 pixel art sprites:** OpenGameArt "16x16 RPG character" sets or itch.io CC0 collections
  - Need: player (8-dir), guard (x3 variants), noble (x2), servant, musician, council member
- [ ] **Parallax background:** Hand-create or source medieval city skyline layers
- [ ] **Color grading presets:** Define 4 preset configs (grand, intimate, dark, open) as TypeScript objects

**Acceptance Criteria:**
- [ ] All 10 rooms are explorable with correct connectivity
- [ ] Each room has distinct atmosphere, lighting, and color grading
- [ ] NPCs are placed as pixel-art sprites at appropriate positions
- [ ] Props and furniture match each room's purpose and are proportionally correct
- [ ] Room transitions work correctly between all connected rooms
- [ ] The Battlements have a convincing parallax background
- [ ] InstancedMesh is used for columns and repeated props

---

#### Phase 6: Performance, Polish & Deferred Effects

**Goal:** Stable 60fps on desktop, visual consistency, no rough edges. Add SSAO, god rays, and per-room color grading if performance allows.

**Tasks:**

**Deferred effects (add if performance budget allows):**

- [x] Add N8AO (SSAO):
  - Replace `RenderPass` with `N8AOPostPass` (it renders the scene AND computes SSAO in one pass)
  - Start with: `aoRadius: 5, intensity: 2, distanceFalloff: 1`
  - Profile before/after — expect ~2-3ms cost. Keep only if still hitting 60fps.
- [x] Implement dynamic quality scaling (if frame budget exceeded):
  - Step 1: Disable god rays (saves ~2-4ms)
  - Step 2: Set N8AO `halfRes: true` or lower quality mode (saves ~1-2ms)
  - Step 3: Disable tilt-shift (saves ~1-1.5ms)
  - Monitor rolling-average frame time; progressively downgrade when > 14ms
- [x] Add god rays to windowed rooms (Throne Room, Hand's Solar, Grand Gallery, Battlements):
  - Use `three-good-godrays` — requires `castShadow: true` on occluding meshes
  - Create bright emissive planes behind windows as light sources
  - Per-room enable/disable flag in `RoomData.postProcessOverrides`
  - Profile: expect ~1-2ms per room. Disable in rooms where it drops below 50fps.
- [x] Add per-room color grading via `HueSaturationEffect` + `BrightnessContrastEffect`:
  - Use the per-room palette values from the Visual Art Direction section
  - Swap parameters during room fade transitions (animate during FADING_IN)

**Performance profiling:**

- [x] Profile every room with `stats-gl` and `renderer.info`:
  - Target: < 60 draw calls per room (InstancedMesh should keep us under)
  - Target: < 100MB total GPU memory (textures + geometry)
  - Target: 60fps sustained on GTX 1060 / equivalent
  - Log `renderer.info.render.calls` and `renderer.info.memory` per room
- [x] Optimize textures:
  - Compress with KTX2 via `gltf-transform optimize` (ETC1S for diffuse, UASTC for normals)
  - Max texture resolution: 2048x2048 (most can be 1024x1024)
  - Set up `DRACOLoader` for compressed GLB meshes
  - Set up `KTX2Loader` with Basis transcoder
- [x] Use `InstancedMesh` for all repeated objects:
  - Throne Room columns (16 instances), Grand Gallery columns (12), Ballroom columns (8)
  - Torch sconces (shared across rooms)
  - Floor tiles if using modular geometry
- [x] Verify GPU resource disposal:
  - After each room unload, check `renderer.info.memory.textures` decreases
  - Run GC-stress test: transition through all 10 rooms 3x and verify no memory growth
- [x] Texture sharing across rooms:
  - Stone wall texture: shared by Rooms 1, 2, 5, 6, 7, 9, 10
  - Wood texture: shared by Rooms 3, 4
  - Metal texture: shared by Rooms 6, 7
  - AssetManager ref-counting ensures shared textures aren't duplicated or prematurely disposed
- [x] Pixel-art rendering QA:
  - `NearestFilter` on ALL sprite textures (verify no bilinear bleeding)
  - Test at 1080p, 1440p, 4K — sprites should remain crisp
  - Snap sprite positions to prevent sub-pixel shimmer
- [x] Cross-browser testing: Chrome, Firefox, Edge on desktop
  - Verify WebGL2 context obtained in all browsers
  - Verify shader compilation (no GLSL errors)
  - Verify postprocessing effects render identically
- [x] Add loading screen:
  - Full-screen overlay with progress bar
  - Shown during initial load AND room transitions (if loading takes > 500ms)
  - Uses AssetManager's per-session progress tracking
- [x] Final visual polish pass per room:
  - Fine-tune bloom, DoF, vignette per room (use the room presets system)
  - Verify lighting transitions feel smooth during fade
  - Check particle density (not too sparse, not too noisy)
  - Ensure no z-fighting between overlapping geometry
  - Verify shadows are soft and not pixelated (PCFSoftShadowMap, 2048 map size)

### Research Insights: Phase 6

**Performance budget breakdown (per room, per frame):**
| Component | Estimated Cost | Notes |
|---|---|---|
| Scene render (via N8AO) | 3-5ms | Includes SSAO |
| Bloom | 0.5-1ms | Single merged pass |
| TiltShift DoF | 0.5-1ms | KernelSize.MEDIUM |
| God Rays | 1-2ms | Only in windowed rooms |
| Vignette + ColorGrading + ToneMapping | 0.3ms | All merged into one EffectPass |
| Light flicker system | <0.1ms | Noise sampling for 8 lights |
| Particles (CPU) | 0.2-0.5ms | ~200 particles max |
| **Total** | **~6-10ms** | Well within 16.67ms budget |

**Key optimization: effect merging.** pmndrs `postprocessing` auto-merges non-convolution effects in the same `EffectPass` into a single shader. However, Bloom and TiltShift are BOTH convolution effects and need separate passes. Vignette, ColorGrading, and ToneMapping are non-convolution and merge free. N8AO and GodRays also need their own passes. Core: 4 passes. Full pipeline with all optional effects: ~7 passes in windowed rooms, ~6 in torch-lit rooms.

**Acceptance Criteria:**
- [ ] Consistent 60fps across all 10 rooms on a mid-range desktop (GTX 1060)
- [ ] < 60 draw calls per room (verified via stats-gl)
- [ ] No visible asset loading hitches during room transitions
- [ ] No GPU memory leaks across 30 consecutive room transitions
- [ ] All rooms are visually cohesive and cinematic
- [ ] No console errors or warnings in production build
- [ ] Works in Chrome, Firefox, and Edge

---

## Alternative Approaches Considered

| Approach | Why Rejected |
|---|---|
| React Three Fiber + Miniplex | Extra React abstraction layer reduces control over HD-2D render pipeline. Larger bundle. |
| bitECS instead of Becsy | Faster raw performance but less ergonomic API. Becsy's coroutines, reactive queries, and system ordering are valuable for game logic. |
| WebGPU renderer | Production-ready in 2026 but WebGL2 has broader compatibility and Three.js's WebGPU path is still maturing for post-processing. |
| Pixi.js or Phaser | 2D-first engines. The 3D environment rendering (lighting, DoF, god rays) is the core of HD-2D and requires a 3D renderer. |
| Pre-baked lighting | Would look good but removes the dynamic flicker/atmosphere that makes rooms feel alive. |
| Point light shadows | 6 shadow maps per PointLight (cubemap). With 8 torches = 48 shadow maps per frame. Catastrophic for performance. Use SSAO instead. |
| Full ECS for everything | NPCs and particles don't benefit from ECS in this MVP (no behavior, no per-frame updates beyond particle motion). Plain Three.js objects reduce complexity. |

## Acceptance Criteria

### Functional Requirements

- [ ] Player can explore all 10 rooms of the Throne Room wing
- [ ] Rooms connect per the connectivity map with fade-to-black transitions
- [ ] Player character moves in 8 directions with smooth camera follow
- [ ] NPCs are visible as static pixel-art sprites in appropriate positions
- [ ] Each room has distinct props, lighting, and atmosphere

### Non-Functional Requirements

- [ ] 60fps on mid-range desktop browser (Chrome/Firefox/Edge)
- [ ] HD-2D visual pipeline: tilt-shift DoF, bloom, vignette, SSAO, color grading
- [ ] Dynamic lighting: flickering torches, god rays through windows
- [ ] Particle effects: dust motes, torch embers, wind on battlements
- [ ] Sub-3-second room transition (fade out + load + fade in)
- [ ] Total asset bundle < 100MB
- [ ] < 60 draw calls per room

### Quality Gates

- [ ] All post-processing effects are visibly working and tuned
- [ ] No GPU resource leaks (verified via renderer.info.memory across 30 transitions)
- [ ] No console errors in production build
- [ ] Pixel-art sprites render crisp at 1080p, 1440p, and 4K
- [ ] No race conditions during room transitions (double-trigger, overlapping frames, stale entity refs)
- [ ] Game survives tab-hide/tab-show without breaking

## Dependencies & Prerequisites

| Dependency | Version | Purpose |
|---|---|---|
| `three` | ^0.170.0 | 3D rendering |
| `@lastolivegames/becsy` | 0.16.0 (pinned) | ECS framework |
| `postprocessing` | latest | Post-processing effects (auto-merging) |
| `n8ao` | latest | SSAO (replaces RenderPass) |
| `three-good-godrays` | latest | Volumetric god rays |
| `vite` | ^7.0 | Bundler |
| `vite-plugin-glsl` | ^1.5 | GLSL shader imports |
| `typescript` | ^5.x | Language |
| `stats-gl` | latest | Dev-mode performance monitoring |

**Note:** Pin Becsy to exact version (0.16.0, not ^0.16.0) due to pre-1.0 API instability.

## Risk Analysis & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Becsy breaking API changes (pre-1.0) | Medium | Medium | Pin exact version. Limit ECS surface area (only player + lights). Wrap component access in helpers. |
| Post-processing performance (7 effects) | High | Low | N8AO replaces RenderPass (net 0 extra). pmndrs auto-merges 5 effects into ~2 passes. Profile in Phase 1. |
| Free asset quality inconsistency | Medium | High | Establish visual style guide early. Poly Haven + ambientCG for textures (consistent PBR quality). Quaternius for props (consistent low-poly style). |
| God rays performance cost | Medium | Medium | Optional per-room. Only 4 rooms have windows. Disable if < 50fps. |
| Pixel-art sprites looking out of place | High | Low | Test sprite rendering in Phase 2 before building all rooms. Add blob shadow for grounding. |
| Race conditions during transitions | High | High (without mitigation) | Transition state machine + serialized game loop + ref-counted assets + AbortControllers. |
| 10 rooms worth of unique assets | High | Medium | 7/10 rooms share stone textures. InstancedMesh for columns. Material sharing via AssetManager. |

## Key Technical Notes

### Architectural Boundaries
- **ECS Systems** = per-frame logic only. Read/write components. No asset loading, no scene graph mutation beyond TransformSync.
- **Managers/Builders** (`RoomManager`, `RoomBuilder`, `AssetManager`) = event-driven orchestration. Entity creation/destruction. Asset loading. Scene graph setup.
- **RenderContext** = plain module singleton for Three.js framework objects (`scene`, `camera`, `renderer`, `composer`). Systems import it directly.
- **Room data files** = pure serializable data (no functions, no class instances, no Three.js objects). Use `as const satisfies RoomData`. Use dynamic `import()` for code splitting.

### Becsy Gotchas
- **Do NOT hold component handles.** Destructure immediately: `const { px, py } = entity.read(Transform);`
- **`.write()` marks changed even without modification.** Use `.read()` when only inspecting.
- **`World.create()` and `world.execute()` are both async.** Must `await`.
- **`maxEntities` is fixed at world creation.** Set to 1000 (player + ~50 lights across all rooms is well within).
- **Coroutine yields invalidate entity handles.** Copy all data before yield points.
- **Singleton `.write()` as a class field marks changed every frame.** Call `.write()` conditionally in `execute()`.
- **Entity references across frames require `.hold()`.** Entity objects become invalid after system execution ends. Use `entity.hold()` to retain, check `.alive` each frame.
- **Coroutine scoping for room transitions:** Use `co.scope(entity)` to auto-cancel if room entity is deleted mid-transition. Use `co.cancelIfCoroutineStarted()` to prevent double door triggers.
- **System ordering is declarative**, not index-based. Use `s.before(SystemB)`, `s.after(SystemB)`, `s.afterWritersOf(Component)` in the static `schedule` builder. Becsy auto-orders systems based on read/write entitlements.
- **`field.object` blocks multithreading.** Any component with `Type.object` fields (Three.js refs) prevents Becsy's SharedArrayBuffer parallelism. Single-threaded mode is required when storing Three.js objects.

### Three.js HD-2D Notes
- **Camera must be `PerspectiveCamera`** (not Orthographic) for DoF to work.
- **Use `PlaneGeometry` not `THREE.Sprite`** for character billboards — Sprite auto-rotates on all axes which looks wrong at 3/4 angle.
- **Set `renderer.toneMapping = THREE.NoToneMapping`** — let postprocessing handle it via `ToneMappingEffect`.
- **Disable `renderer.antialias`** — postprocessing EffectComposer handles AA.
- **No point light shadows.** Use SSAO (N8AO) for ambient shadow. Only `DirectionalLight` gets shadow maps.
- **Merge effects into minimal EffectPass instances** — pmndrs postprocessing auto-combines them into fewer GPU passes.

### TypeScript Gotchas
- **`isolatedModules: true` is mandatory for Vite.** Without it, `const enum` and certain re-export patterns silently break at runtime.
- **`verbatimModuleSyntax: true` prevents Becsy decorator erasure.** Forces `import type` for type-only imports, so Vite's esbuild step doesn't accidentally erase Becsy component class imports.
- **Avoid `const enum`** — with `isolatedModules`, const enums are NOT inlined across files. Use `as const` objects + `typeof` instead:
  ```typescript
  export const RoomId = { ThroneRoom: 1, Antechamber: 2, ... } as const;
  export type RoomIdValue = (typeof RoomId)[keyof typeof RoomId];
  ```
- **Type `field.object` declarations with concrete types** — Becsy stores `any` at runtime, but TypeScript's `declare` lets us annotate with the real type:
  ```typescript
  @field.object declare object3d: Object3D;  // typed, not `any`
  @field.object declare scene: Scene;
  ```
- **All `@field` properties must use `declare`** — without it, TypeScript emits an initializer that conflicts with Becsy's internal storage.
- **Use `satisfies` on room data files** for literal type preservation:
  ```typescript
  export default { id: RoomId.ThroneRoom, mood: 'grand', ... } as const satisfies RoomData;
  ```
- **Use discriminated unions** for `LightDef` (`type: 'point' | 'directional'`) and `ParticleDef` (`type: 'dust' | 'ember' | 'wind'`) — enables exhaustive `switch` with TypeScript narrowing.
- **Vite HMR + Becsy:** Module re-execution causes "component already registered" errors. Guard with `import.meta.hot.dispose()` to terminate world before re-creation.

### HD-2D Visual Rules
- **Restraint over spectacle.** Each effect should be subtle enough that removing it feels like something is "missing" rather than adding it feeling "flashy."
- **Tilt-shift is THE signature effect.** Get this right first — everything else is secondary.
- **Bloom only on light sources.** `luminanceThreshold: 0.85` ensures only bright emissive surfaces glow.
- **Color grading is per-room atmosphere.** It's the cheapest way to make rooms feel dramatically different.
- **Light is the protagonist.** Rooms are defined by how light enters — not by how many objects fill them.
- **Break symmetry.** Offset props, stagger torch placement, angle furniture. Perfect symmetry looks artificial.
- **Some rooms should be DARK.** Resist the urge to make everything visible. Darkness is atmosphere.
- **Test without postprocessing.** If rooms look same-y with effects off, base lighting needs more work.

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-02-05-red-keep-hd2d-mvp-brainstorm.md`

### External References
- [Becsy ECS Documentation](https://lastolivegames.github.io/becsy/)
- [Becsy Coroutines Guide](https://lastolivegames.github.io/becsy/guide/architecture/systems#coroutines)
- [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)
- [N8AO — Performant SSAO](https://github.com/N8python/n8ao)
- [three-good-godrays](https://github.com/Ameobea/three-good-godrays)
- [Poly Haven Textures (CC0)](https://polyhaven.com/textures)
- [ambientCG (CC0)](https://ambientcg.com/)
- [Quaternius Free Game Assets (CC0)](https://quaternius.com/)
- [Kenney Assets (CC0)](https://kenney.nl/assets)
- [OpenGameArt](https://opengameart.org/)
- [vite-plugin-glsl](https://github.com/UstymUkhman/vite-plugin-glsl)
- [100 Three.js Best Practices (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)

### Project Research Documents
- `docs/research/hd2d-visual-analysis-deep-dive.md` — Octopath/DQ3 HD-2D analysis, camera/lighting/sprite specifics
- `docs/research/threejs-game-architecture-patterns.md` — Room management, ECS sync, postprocessing performance
- `docs/research/medieval-castle-architecture-red-keep.md` — Historical room proportions, furniture, lighting, materials
- `docs/research/threejs-hd2d-visual-effects.md` — HD-2D rendering techniques in Three.js

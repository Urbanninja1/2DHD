---
title: "HD-2D Deferred Effects Pipeline: SSAO, God Rays, Color Grading & Dynamic Quality Scaling"
category: architecture
tags: [post-processing, ssao, n8ao, god-rays, color-grading, quality-scaling, three-js, hd2d-pipeline, per-room-effects]
module: rendering
date: 2026-02-06
updated: 2026-02-06
status: resolved
severity: P2
symptoms:
  - Rooms lack ambient shadow depth despite complex geometry
  - No volumetric light effects in windowed rooms
  - All rooms share identical color temperature regardless of mood
  - No automatic performance fallback when frame budget exceeded
---

# HD-2D Deferred Effects Pipeline: SSAO, God Rays, Color Grading & Dynamic Quality Scaling

## Problem Statement

The HD-2D pipeline had 4 passes (RenderPass, Bloom, TiltShift, Vignette+ToneMapping) — enough for the core HD-2D look, but missing three effects that dramatically improve visual depth: ambient occlusion for stone corner shadows, volumetric god rays for windowed rooms, and per-room color grading to shift mood between spaces. Additionally, there was no mechanism to gracefully degrade when the frame budget was exceeded on lower-end hardware.

---

## Solution: Layered Pass Architecture with Dynamic Insertion

### Pass Ordering

The pipeline follows a strict dependency-driven order:

```
Pass 0: RenderPass          ← Scene render (always required, baseline)
Pass 1: N8AOPostPass        ← SSAO (reads depth buffer from Pass 0)
Pass 2: GodraysPass         ← Volumetric rays (per-room, dynamically inserted/removed)
Pass 3: BloomPass           ← Convolution (needs own EffectPass)
Pass 4: TiltShiftPass       ← Convolution (needs own EffectPass)
Pass 5: CheapPass           ← Vignette + ToneMapping + HueSaturation + BrightnessContrast
                               (all non-convolution, merged into ONE shader for free)
```

**Why this order matters:**
- SSAO must read the depth buffer from the rendered scene — it goes right after RenderPass
- God rays trace through the scene from a directional light — must come before bloom to avoid raymarching bloom halos
- Bloom and TiltShift are both convolution effects — they CANNOT share a pass (pmndrs/postprocessing constraint)
- Color grading (HueSaturation + BrightnessContrast) is non-convolution — it rides in the cheap pass for zero extra render target cost

### N8AO SSAO Integration

N8AOPostPass goes after RenderPass (not replacing it — that's `N8AOPass` for Three.js's built-in composer, not pmndrs):

```typescript
import { N8AOPostPass } from 'n8ao';

const n8aoPass = new N8AOPostPass(scene, camera, width, height);
n8aoPass.configuration.aoRadius = 5;
n8aoPass.configuration.intensity = 2;
n8aoPass.configuration.distanceFalloff = 1;
n8aoPass.configuration.color = new THREE.Color(0, 0, 0);
composer.addPass(n8aoPass); // After RenderPass
```

N8AO lacks TypeScript declarations — a `src/types/n8ao.d.ts` ambient module declaration is required:

```typescript
declare module 'n8ao' {
  import type { Pass } from 'postprocessing';
  import type { Scene, PerspectiveCamera, Color } from 'three';

  export interface N8AOConfiguration {
    aoRadius: number;
    intensity: number;
    distanceFalloff: number;
    color: Color;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
  }

  export class N8AOPostPass extends Pass {
    configuration: N8AOConfiguration;
    constructor(scene: Scene, camera: PerspectiveCamera, width?: number, height?: number);
  }
}
```

### God Rays: Dynamic Pass Insertion/Removal

God rays are per-room — only rooms with directional lights and a `godRays` config get them. The pass is dynamically spliced into the composer's passes array:

```typescript
import { GodraysPass } from 'three-good-godrays';

// Insert before bloom pass
const passes = pipeline.composer.passes;
const bloomIdx = passes.indexOf(pipeline.bloomPass);
passes.splice(bloomIdx, 0, godraysPass);
pipeline.godraysPass = godraysPass;

// Remove when transitioning to a room without god rays
passes.splice(passes.indexOf(pipeline.godraysPass), 1);
pipeline.godraysPass.dispose();
pipeline.godraysPass = null;
```

**Key insight:** The EffectComposer's `passes` array is just a regular JS array iterated during rendering. Splicing before the next frame works perfectly — no rebuild needed.

RoomBuilder tracks the first shadow-casting `DirectionalLight` per room:

```typescript
let directionalLight: THREE.DirectionalLight | null = null;
// ... in the light loop:
if (!directionalLight) directionalLight = dirLight;
// ... returned in BuiltRoom
return { group, flickerLights, directionalLight, doorTriggers, bounds, particleSystems };
```

RoomManager sets up god rays during `loadRoom()` and `transitionTo()`:

```typescript
if (data.godRays && built.directionalLight) {
  setGodraysLight(pipeline, built.directionalLight, camera, {
    color: new THREE.Color(data.godRays.color ?? 0xffffff),
    density: data.godRays.density ?? 1 / 128,
    maxDensity: data.godRays.maxDensity ?? 0.5,
  });
} else {
  removeGodrays(pipeline);
}
```

### Color Grading: Zero-Cost Merging

HueSaturationEffect and BrightnessContrastEffect are non-convolution effects. The pmndrs/postprocessing library auto-merges them into a single shader when placed in the same EffectPass:

```typescript
const cheapPass = new EffectPass(
  camera,
  vignetteEffect,            // Non-convolution
  toneMappingEffect,         // Non-convolution
  hueSaturationEffect,       // Non-convolution — merged free
  brightnessContrastEffect,  // Non-convolution — merged free
);
```

This means adding per-room color grading costs **zero extra GPU passes**. The 4 effects compile into one fragment shader.

**Important:** HueSaturationEffect takes hue in **radians**, not degrees. The plan's degree values must be converted:

| Mood | Hue (plan) | Hue (radians) | Saturation | Brightness | Contrast |
|------|-----------|---------------|------------|------------|----------|
| Grand | 0° | 0 | +0.1 | 0 | +0.1 |
| Intimate | +10° | +0.175 | +0.15 | -0.05 | +0.05 |
| Dark | -5° | -0.087 | -0.1 | -0.1 | +0.15 |
| Open | -10° | -0.175 | 0 | +0.05 | +0.2 |

### Dynamic Quality Scaling

A rolling-window frame time monitor with 3-level progressive degradation:

```typescript
const WINDOW_SIZE = 60;             // ~1s at 60fps
const DOWNGRADE_THRESHOLD_MS = 14;  // Degrade above 14ms
const UPGRADE_THRESHOLD_MS = 10;    // Re-enable below 10ms
```

**Degradation order** (cheapest to disable first):

| Level | Disabled Effects | Estimated Savings | Visual Impact |
|-------|-----------------|-------------------|---------------|
| 0 | None (full quality) | — | Best |
| 1 | God rays | 2-4ms | Minimal — atmospheric only |
| 2 | + SSAO | 2-3ms | Moderate — loses corner shadows |
| 3 | + Tilt-shift DoF | 1-1.5ms | Significant — loses depth-of-field |

**Hysteresis prevents thrashing:** The 4ms dead zone between thresholds (14ms down, 10ms up) plus a 60-frame cooldown after each level change prevents the scaler from oscillating when performance hovers near a threshold.

The scaler hooks into `GameLoop.onAfterExecute(deltaMs)` — the game loop now passes frame delta to the callback:

```typescript
const qualityScaler = createQualityScaler(pipeline);
loop.onAfterExecute = (deltaMs) => {
  stats.end();
  stats.update();
  qualityScaler.update(deltaMs);
};
```

---

## Data Flow: Room Load → Effect Application

```
RoomData (pure data)
  ├── postProcessOverrides: { bloom, tiltShift, vignette, colorGrading, ssao }
  └── godRays?: { color, density, maxDensity }
         │
         ▼
RoomManager.loadRoom(id)
  ├── buildRoom(data) → BuiltRoom { ..., directionalLight }
  ├── updatePipelineSettings(pipeline, data.postProcessOverrides)
  │     └── Sets bloom intensity, tiltShift focus, vignette darkness,
  │         hue/saturation, brightness/contrast, SSAO radius/intensity
  └── setGodraysLight(pipeline, directionalLight, camera, godRaysParams)
        └── Splices GodraysPass into composer before bloom
            OR removeGodrays() if room has none
         │
         ▼
Next frame: EffectComposer renders with new settings
```

---

## Per-Room God Rays Configuration

| Room | God Rays | Color | Density | Max Density | Source |
|------|----------|-------|---------|-------------|--------|
| 1. Throne Room | Yes | 0xFFE8C0 (warm gold) | 1/100 | 0.6 | Stained glass windows |
| 5. Grand Gallery | Yes | 0xFFF5E0 (daylight) | 1/128 | 0.5 | Arched windows |
| 10. Battlements | Yes | 0xFFF5E0 (strong sun) | 1/80 | 0.7 | Open sky |
| All others | No | — | — | — | No directional light |

---

## Prevention / Best Practices

### Adding a New Visual Effect to the Pipeline

1. Determine if it's **convolution** (needs own EffectPass) or **non-convolution** (can merge into cheap pass)
2. If convolution: create a new EffectPass and insert at the correct position in the pass chain
3. If non-convolution: add it to the existing cheap EffectPass constructor
4. Add settings to `HD2DSettings` interface and `DEFAULT_SETTINGS`
5. Add update logic in `updatePipelineSettings()`
6. Add toggle in `debug-overlay.ts` for dev testing
7. Add to quality scaler's degradation order if it costs >1ms

### Common Mistakes

| Mistake | Result | Fix |
|---|---|---|
| Putting two convolution effects in one EffectPass | Shader compilation error or visual artifacts | Each convolution effect needs its own EffectPass |
| Forgetting `gammaCorrection: false` on GodraysPass | Double gamma correction (washed out) | Only the last pass handles gamma |
| Using N8AOPass instead of N8AOPostPass | Replaces RenderPass entirely, breaks pass chain | N8AOPostPass works alongside RenderPass |
| Applying color grading hue in degrees | Extreme hue shifts (1 radian = 57°) | HueSaturationEffect takes radians |
| Missing `removeGodrays()` on room transition | Previous room's god rays persist into non-windowed room | Always call removeGodrays before setting new ones |
| Quality scaler without hysteresis | Effects flicker on/off when near threshold | Use separate up/down thresholds with dead zone |

### Debug Overlay Keys

| Key | Effect | Default |
|-----|--------|---------|
| F1 | Bloom | ON |
| F2 | TiltShift DoF | ON |
| F3 | Vignette | ON |
| F4 | ToneMapping | ON |
| F5 | SSAO (N8AO) | ON |
| F6 | God Rays | ON |

---

## Performance Budget (Updated)

| Pass | Estimated Cost | Notes |
|------|---------------|-------|
| Scene render (RenderPass) | 3-5ms | Baseline |
| N8AO SSAO | 2-3ms | Quality scaler level 2 disables |
| God rays | 2-4ms | Per-room, quality scaler level 1 disables |
| Bloom | 1-2ms | Always on |
| TiltShift DoF | 1-1.5ms | Quality scaler level 3 disables |
| Cheap pass (4 effects merged) | 0.1-0.2ms | Vignette + ToneMapping + ColorGrading |
| **Total (full quality)** | **~9-16ms** | Within 16.67ms budget for 60fps |

---

## Related Resources

- `docs/solutions/architecture/data-driven-room-system-pattern.md` — How RoomData drives per-room post-processing overrides
- `docs/solutions/architecture/non-ecs-particle-integration-pattern.md` — GameLoop callback pattern (same hook used by quality scaler)
- `docs/solutions/code-review/pre-commit-review-hd2d-mvp.md` — GPU disposal patterns and HMR cleanup
- `docs/plans/2026-02-05-feat-hd2d-red-keep-mvp-plan.md` — Phase 6 specifications and per-room color palette values

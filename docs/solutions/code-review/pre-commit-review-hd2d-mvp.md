---
title: "Pre-Commit Code Review: HD-2D Red Keep MVP"
category: code-review
tags: [code-review, three-js, becsy-ecs, game-loop, webgl, performance, architecture]
module: core
date: 2026-02-06
status: resolved
severity: mixed (P1-P3)
symptoms:
  - Game loop silently dies on world.execute() rejection
  - Camera never hard-snaps on room teleport (flag ordering bug)
  - Accidental Windows NUL device file in repo root
  - GPU memory leaks on HMR reload
  - Sticky keyboard keys after tab switch
  - Duplicate texture uploads wasting VRAM
  - Zero-scale Transform entities invisible by default
---

# Pre-Commit Code Review: HD-2D Red Keep MVP

## Problem Statement

Full pre-commit review of the HD-2D Three.js game project (~25 TypeScript files, ~1300 lines) before initial commit. Six parallel review agents identified 19 findings across security, performance, architecture, patterns, TypeScript quality, and code simplicity.

## Review Agents Used

| Agent | Focus |
|---|---|
| kieran-typescript-reviewer | Type safety, naming, TS best practices |
| architecture-strategist | ECS design, system ordering, lifecycle |
| security-sentinel | XSS, resource leaks, info exposure, deps |
| performance-oracle | Frame budget, memory, GPU resources |
| pattern-recognition-specialist | Patterns, anti-patterns, duplication |
| code-simplicity-reviewer | YAGNI, dead code, premature abstractions |

## Findings Summary

- **Total:** 19 unique findings (deduplicated across 6 agents)
- **P1 Critical:** 3 (all fixed)
- **P2 Important:** 9 (all fixed)
- **P3 Nice-to-have:** 7 (tracked)

---

## P1 Fixes (Critical)

### 1. Game loop silently dies on error

**File:** `src/game-loop.ts:56-58`

**Root cause:** When `world.execute()` rejected, the `.catch()` handler reset `this.executing = false` but never re-scheduled `requestAnimationFrame`. The loop permanently stopped with no recovery path. `resume()` couldn't help because `this.running` was still `true` (so `resume()` early-returned).

**Fix:** Added `if (this.running) requestAnimationFrame(this.tick)` in the catch handler.

```typescript
// BEFORE
.catch((err: unknown) => {
  console.error('World execution failed:', err);
  this.executing = false;
});

// AFTER
.catch((err: unknown) => {
  console.error('World execution failed:', err);
  this.executing = false;
  if (this.running) requestAnimationFrame(this.tick);
});
```

### 2. Teleported flag ordering bug

**Files:** `src/ecs/systems/room-transition.ts`, `src/ecs/systems/camera-follow.ts`

**Root cause:** System execution order is RoomTransition -> CameraFollow. RoomTransitionSystem cleared `teleported = false` *before* CameraFollowSystem read it. The camera would never see `teleported === true` and would never hard-snap on room transitions.

**Fix:** Moved flag consumption from RoomTransitionSystem to CameraFollowSystem. Changed singleton access from `.read` to `.write` on CameraFollowSystem so it can clear the flag after reading it.

### 3. Accidental `nul` file

**Root cause:** Windows NUL device redirect artifact containing local filesystem path and username.

**Fix:** Deleted file, added `nul` to `.gitignore`.

---

## P2 Fixes (Important)

### 4. WebGL context restore doesn't rebuild GPU resources

**File:** `src/main.ts`

**Root cause:** The `webglcontextrestored` handler resumed the game loop but didn't re-upload textures, materials, or recreate EffectComposer render targets. All GPU resources are invalidated after context loss.

**Fix:** Added scene traversal to set `texture.needsUpdate = true` and `material.needsUpdate = true` on all meshes, plus `composer.setSize()` to recreate framebuffers, plus `shadowMap.needsUpdate = true`.

### 5. Transform scale defaults to 0

**File:** `src/ecs/components/transform.ts`

**Root cause:** Becsy initializes numeric fields to 0. Any entity created without explicit `{sx: 1, sy: 1, sz: 1}` would have zero scale and be invisible.

**Fix:** Added `transformInit()` helper that defaults scale to `(1,1,1)`:

```typescript
export function transformInit(overrides?: Partial<Record<'px' | 'py' | 'pz' | 'sx' | 'sy' | 'sz', number>>) {
  return { px: 0, py: 0, pz: 0, sx: 1, sy: 1, sz: 1, ...overrides };
}
```

### 6. Canvas textures regenerated, never cached

**File:** `src/rendering/placeholder-textures.ts`

**Root cause:** `createStoneWallTexture()` called 3 times in `buildTestRoom()`, each creating a new 256x256 canvas, drawing procedural patterns, and uploading to GPU. ~512KB wasted VRAM.

**Fix:** Added module-level texture cache. First call creates and stores the original, subsequent calls return `.clone()` (shares the underlying image data, only UV transform differs).

### 7. New PlaneGeometry per sprite

**File:** `src/rendering/sprite-factory.ts`

**Root cause:** Every `createSpriteMesh` call allocated a separate `PlaneGeometry` even when dimensions matched, creating duplicate VBOs.

**Fix:** Added `spriteGeoCache` Map keyed by `"widthxheight"`. Identical sprites now share one geometry buffer.

### 8. HMR dispose leaks scene graph

**File:** `src/main.ts`

**Root cause:** HMR dispose only called `renderer.dispose()`, not disposing scene graph textures, geometries, materials, or EffectComposer. GPU memory leaked across each hot reload.

**Fix:** Added scene traversal in HMR dispose that calls `.dispose()` on all geometries, materials, and texture maps, plus `composer.dispose()`.

### 9. Dead variables in dev block

**File:** `src/main.ts:120-121`

**Root cause:** `frameCount` and `origExecute` declared but never used — leftover debug scaffolding.

**Fix:** Removed both declarations.

### 10. GameState fields typed as plain `number`

**File:** `src/ecs/components/singletons.ts`

**Root cause:** `currentRoomId` and `transitionState` typed as `number` despite having `RoomIdValue` and `TransitionStateValue` union types defined in the same file.

**Fix:** Changed field types to use their union types.

### 11. Event listeners not cleaned up on HMR

**File:** `src/main.ts`

**Root cause:** Window `resize`, `visibilitychange`, and WebGL context listeners were never removed. Duplicates accumulated across HMR reloads.

**Fix:** Added `AbortController` for all global listeners, aborted in HMR dispose handler (matching the existing pattern in `keyboard.ts`).

### 12. Sticky keys on tab switch

**File:** `src/input/keyboard.ts`, `src/main.ts`

**Root cause:** Keyboard `Set` not cleared on tab/window blur. `visibilitychange` handler paused the loop but didn't clear key state, causing ghost movement when returning.

**Fix:** Added `clearAll()` method to `KeyboardState`, called on `visibilitychange` when `document.hidden` becomes true.

---

## P3 Findings (Tracked, Not Fixed)

| # | Finding | File |
|---|---|---|
| 13 | Duplicate import in light-flicker.ts | `src/ecs/systems/light-flicker.ts:2-3` |
| 14 | `as unknown as PointLight` double cast | `src/ecs/systems/light-flicker.ts:51` |
| 15 | Unused exports: `getWorld()`, `updatePipelineSettings()`, `SpriteData`, `isDown()` | Multiple |
| 16 | Unused path aliases and asset includes | `tsconfig.json`, `vite.config.ts` |
| 17 | `#fade-overlay` div unused | `index.html` |
| 18 | Magic number `16.667` in camera lerp | `src/ecs/systems/camera-follow.ts:40` |
| 19 | `.gitignore` missing common exclusions | `.gitignore` |

---

## Prevention Strategies

### Game Loop Error Recovery
- Always re-schedule rAF in both `.then()` and `.catch()` paths when using async game loops.
- Consider adding a max-consecutive-error counter that eventually stops the loop to prevent infinite error spam.

### ECS Flag Ordering
- The system that *consumes* a flag should be the one that clears it, not the system that sets it.
- Document flag ownership in JSDoc: which system sets it, which system reads/clears it.

### Transform Defaults
- Always use factory helpers for ECS component initialization when fields have non-zero defaults.
- Becsy fields initialize to 0/false/null — this is a common footgun for scale, opacity, etc.

### GPU Resource Management
- Cache procedural textures at module level; clone for different UV settings.
- Share geometry instances for identical dimensions.
- Always dispose textures, geometries, and materials when removing objects from scene.
- On HMR dispose, traverse the full scene graph.

### Event Listener Lifecycle
- Use `AbortController` for all global event listeners (matches the pattern already used in `keyboard.ts`).
- Keep one controller per lifecycle scope, abort it on teardown.

---

## Positive Patterns Worth Preserving

These were explicitly called out by reviewers as well-done:

- **Serialized game loop** with `executing` guard preventing overlapping Becsy frames
- **Frame-rate-independent camera lerp** using `Math.pow(1 - factor, dt/targetDt)` exponential decay
- **AbortController for keyboard cleanup** (modern best practice)
- **Static shadow maps** (`autoUpdate = false`) for static scenes
- **PlaneGeometry instead of THREE.Sprite** for correct 3/4 angle billboards
- **Pre-computed noise table** with bitwise modulo for light flicker
- **Merging cheap postprocessing effects** (vignette + tone mapping) into one pass
- **`noUncheckedIndexedAccess: true`** in tsconfig
- **`setPixelRatio(1)`** preventing high-DPI fill rate explosion

## Related Resources

- `docs/plans/2026-02-05-feat-hd2d-red-keep-mvp-plan.md` - Implementation plan
- `docs/research/threejs-game-architecture-patterns.md` - Architecture patterns research
- `docs/research/threejs-hd2d-visual-effects.md` - Visual effects research

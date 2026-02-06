---
title: "Becsy ECS Runtime Crashes: Query API and world.build() Constraints"
category: runtime-errors
tags: [becsy-ecs, runtime-error, query-api, world-build, entity-creation, ecs]
module: ecs
date: 2026-02-06
status: resolved
severity: P1
becsy_version: 0.16.0
symptoms:
  - Black screen on game launch
  - "Cannot read properties of undefined (reading 'with')" in system query builder
  - "This method cannot be called after the world has started executing" on second world.build()
---

# Becsy ECS Runtime Crashes: Query API and world.build() Constraints

## Problem Statement

Game launched to a black screen with no visible rendering. Two separate Becsy 0.16.0 API misuse errors prevented the ECS world from initializing.

---

## Bug 1: QueryBuilder `.all` Does Not Exist

### Symptom

```
Failed to initialize: TypeError: Failed to build query in system PlayerMovementSystem:
Cannot read properties of undefined (reading 'with')
```

### Root Cause

All ECS system queries used `.all` on the QueryBuilder, which does not exist in Becsy 0.16.0. The valid properties are `.current`, `.added`, `.removed`, and `.changed`. Since `.all` is `undefined`, chaining `.with()` on it throws a TypeError.

### Files Affected

| File | Occurrences |
|---|---|
| `src/ecs/systems/player-movement.ts` | 2 (query builder + iteration) |
| `src/ecs/systems/collision.ts` | 2 |
| `src/ecs/systems/room-transition.ts` | 1 |
| `src/ecs/systems/camera-follow.ts` | 2 |
| `src/ecs/systems/transform-sync.ts` | 2 |
| `src/ecs/systems/light-flicker.ts` | 2 |
| **Total** | **11** |

### Fix

Replace `.all` with `.current` in both query definition and iteration:

```typescript
// BEFORE — crashes at runtime
private players = this.query(
  q => q.all.with(PlayerTag).and.with(Transform).read,
);
execute(): void {
  for (const entity of this.players.all) { ... }
}

// AFTER — correct Becsy 0.16.0 API
private players = this.query(
  q => q.current.with(PlayerTag).and.with(Transform).read,
);
execute(): void {
  for (const entity of this.players.current) { ... }
}
```

### Why `.current`?

In Becsy's query model:
- `.current` — all entities currently matching the query (most common)
- `.added` — entities that started matching this frame
- `.removed` — entities that stopped matching this frame
- `.changed` — entities whose tracked components were written this frame

There is no `.all` — it was never part of the Becsy API.

---

## Bug 2: `world.build()` Can Only Be Called Once

### Symptom

```
Failed to initialize: CheckError: This method cannot be called after
the world has started executing
```

### Root Cause

The code called `world.build()` twice — once for the player entity, once for torch FlickerLight entities. In Becsy 0.16.0, the first `world.build()` transitions the world into an executing state. Any subsequent `world.build()` call throws a `CheckError`.

### File Affected

`src/main.ts`

### Fix

Merge all entity creation into a single `world.build()` call:

```typescript
// BEFORE — second build() throws CheckError
world.build((sys) => {
  sys.createEntity(PlayerTag, Transform, ...);
});

const torches = getTestRoomTorches(roomGroup);
world.build((sys) => {               // <-- CRASH
  for (const torch of torches) {
    sys.createEntity(FlickerLight, ...);
  }
});

// AFTER — single build() with all entities
const torches = getTestRoomTorches(roomGroup);
world.build((sys) => {
  sys.createEntity(PlayerTag, Transform, ...);

  for (let i = 0; i < torches.length; i++) {
    sys.createEntity(FlickerLight, {
      baseIntensity: torches[i]!.intensity,
      baseColor: torches[i]!.color.getHex(),
      noiseOffset: i * 37.5,
    }, Object3DRef, { object3d: torches[i]! });
  }
});
```

### Runtime Entity Creation

If you need to create entities *after* the world is executing, use `world.createEntity()` directly (outside a `build()` block) or create entities inside a system's `execute()` method. `world.build()` is specifically a pre-execution bulk setup API.

---

## Prevention Strategies

### Becsy Query API

- **Always check the type definitions** before using query builder methods. In Becsy 0.16.0, the QueryBuilder type clearly shows `.current`, `.added`, `.removed`, `.changed` — no `.all`.
- **TypeScript strict mode catches this** — `q.all` produces a type error. The original code had pre-existing TS errors that were masked by not running `tsc --noEmit` before testing.
- **Run `tsc --noEmit` as a pre-test gate** to catch API misuse before runtime.

### world.build() Constraints

- **Consolidate all initial entity creation** into one `world.build()` call.
- **Prepare all data before calling build** — gather torches, textures, meshes, etc. first, then pass everything into the single build callback.
- **For runtime spawning**, use system-internal entity creation or `world.createEntity()` instead of `world.build()`.

### General Becsy Gotchas (v0.16.0)

| Gotcha | Correct Approach |
|---|---|
| `.all` on queries | Use `.current` |
| Multiple `world.build()` | Single call, all entities inside |
| Numeric field defaults | Fields init to `0` — use helpers for non-zero defaults (scale, opacity) |
| Holding component handles | Destructure immediately — handles invalidate between frames |
| Singleton `.read` vs `.write` | Use `.write` if the system needs to mutate the singleton |

---

## Related Resources

- `docs/solutions/code-review/pre-commit-review-hd2d-mvp.md` — Full pre-commit review (19 findings)
- `docs/plans/2026-02-05-feat-hd2d-red-keep-mvp-plan.md` — MVP implementation plan with Becsy gotchas section
- `docs/research/threejs-game-architecture-patterns.md` — ECS + Three.js sync patterns and common pitfalls

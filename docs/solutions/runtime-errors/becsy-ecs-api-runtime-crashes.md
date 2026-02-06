---
title: "Becsy ECS Runtime Crashes: Query API, world.build(), and Entity Creation"
category: runtime-errors
tags: [becsy-ecs, runtime-error, query-api, world-build, entity-creation, createable, ecs]
module: ecs
date: 2026-02-06
updated: 2026-02-06
status: resolved
severity: P1
becsy_version: 0.16.0
symptoms:
  - Black screen on game launch
  - "Cannot read properties of undefined (reading 'with')" in system query builder
  - "This method cannot be called after the world has started executing" on second world.build()
  - "System X didn't mark component Y as createable" when creating entities inside execute()
  - "Frame already executing" cascade after a createEntity error
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

## Bug 3: `this.createEntity()` Requires `.create` Entitlement

### Symptom

```
CheckError: System RoomTransitionSystem didn't mark component FlickerLight as createable
```

Followed by a cascade of:

```
CheckError: Frame already executing
```

The first error corrupts the world state, and every subsequent `world.execute()` fails with "Frame already executing" because the `executing` flag was never cleared.

### Root Cause

When a system calls `this.createEntity(ComponentA, data, ComponentB, data)` inside `execute()`, Becsy checks that the system declared each component with `.create` entitlement via a query. Without this declaration, the system doesn't have permission to create entities with those components.

This is a **bitmask check** in Becsy's entity registry — the system's `accessMasks.create` must include each component type used in `createEntity()`.

### Context

During Phase 3, room transitions needed to create FlickerLight entities for torches in newly loaded rooms. Since `world.build()` can't be called after execution starts (Bug 2), the entity creation was moved inside `RoomTransitionSystem.execute()`. But the system didn't declare create access.

### File Affected

`src/ecs/systems/room-transition.ts`

### Fix

Declare a query with `.create` entitlement for each component used in `createEntity()`:

```typescript
// BEFORE — crashes at runtime
@system(s => s.after(CollisionSystem))
export class RoomTransitionSystem extends System {
  execute(): void {
    // ERROR: didn't mark FlickerLight as createable
    this.createEntity(
      FlickerLight, { baseIntensity: 2.0, ... },
      Object3DRef, { object3d: light },
    );
  }
}

// AFTER — declare .create entitlement via query
@system(s => s.after(CollisionSystem))
export class RoomTransitionSystem extends System {
  // Declare create access (required for this.createEntity())
  private _flickerAccess = this.query(
    q => q.using(FlickerLight).create.and.using(Object3DRef).create,
  );

  execute(): void {
    // OK: FlickerLight and Object3DRef are marked createable
    this.createEntity(
      FlickerLight, { baseIntensity: 2.0, ... },
      Object3DRef, { object3d: light },
    );
  }
}
```

### Key Details

| Entitlement | Meaning | Use case |
|---|---|---|
| `.read` | Read component data | Querying state |
| `.write` | Read + write component data | Mutating state |
| `.create` | Create entities with this component | Runtime entity spawning |

- `.create` is **more restrictive** than `.write` — you can only use the component in `createEntity()`, not read or write it directly
- `.create` entitlements can run **concurrently** with other `.create` systems (safe parallelism)
- Use `q.using(Component).create` (not `q.with(Component).create`) because `using` doesn't require matched entities
- The query variable (`_flickerAccess`) is never iterated — it exists solely to declare the entitlement

### The Cascade Problem

When `createEntity()` throws, the system's `execute()` aborts mid-frame. Becsy's internal `executing` flag stays `true`. Every subsequent `requestAnimationFrame` tick calls `world.execute()` which immediately throws "Frame already executing". The game loop enters an infinite error cycle.

**Prevention:** Always declare `.create` entitlements before testing entity creation paths. There's no recovery from a corrupted world state — the page must be refreshed.

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

### Runtime Entity Creation (Post-Build)

When entities must be created after the game loop starts (e.g., room transitions loading new lights):

1. **Queue the data** outside ECS (e.g., `RoomManager.pendingFlickerLights = [...]`)
2. **Consume it inside a system's `execute()`** using `this.createEntity()`
3. **Declare `.create` entitlements** via `this.query(q => q.using(Component).create)`

This pattern bridges the gap between non-ECS managers and Becsy's strict access control.

### General Becsy Gotchas (v0.16.0)

| Gotcha | Correct Approach |
|---|---|
| `.all` on queries | Use `.current` |
| Multiple `world.build()` | Single call, all entities inside |
| `this.createEntity()` in system | Declare `q.using(Component).create` in a query |
| Numeric field defaults | Fields init to `0` — use helpers for non-zero defaults (scale, opacity) |
| Holding component handles | Destructure immediately — handles invalidate between frames |
| Singleton `.read` vs `.write` | Use `.write` if the system needs to mutate the singleton |
| Error during `execute()` | Corrupts world state permanently — must refresh page |

---

## Related Resources

- `docs/solutions/code-review/pre-commit-review-hd2d-mvp.md` — Full pre-commit review (19 findings)
- `docs/plans/2026-02-05-feat-hd2d-red-keep-mvp-plan.md` — MVP implementation plan with Becsy gotchas section
- `docs/research/threejs-game-architecture-patterns.md` — ECS + Three.js sync patterns and common pitfalls

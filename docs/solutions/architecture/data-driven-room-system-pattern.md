---
title: "Data-Driven Room System with Mood-Based Lighting & Post-Processing"
category: architecture
tags: [room-system, data-driven, three-js, mood-lighting, post-processing, door-connectivity, room-lifecycle]
module: rooms
date: 2026-02-06
updated: 2026-02-06
status: resolved
severity: P3
symptoms:
  - Need 10+ rooms with distinct atmosphere but consistent architecture
  - Per-room post-processing tuning without shader recompilation
  - Bidirectional door connectivity with correct spawn points
---

# Data-Driven Room System with Mood-Based Lighting & Post-Processing

## Problem Statement

The game needed 10 architecturally distinct rooms — each with unique lighting, atmosphere, particle effects, NPC placement, and post-processing — without duplicating construction logic or hardcoding per-room behavior. The challenge: how to define rooms as pure data, transform them into 3D scenes deterministically, and manage their lifecycle (load, transition, dispose) through a single code path.

---

## Solution: RoomData → buildRoom() → RoomManager Pipeline

### Architecture

```
RoomData (pure data)
  ├── mood: 'grand' | 'intimate' | 'dark' | 'open'
  ├── dimensions, colors, lights[], doors[], npcs[], particles[]
  └── postProcessOverrides?: { bloom, tiltShift, vignette }
         │
         ▼
buildRoom(data) → BuiltRoom
  ├── group: THREE.Group          ← All room objects as children
  ├── flickerLights: PointLight[] ← For ECS FlickerLight entity creation
  ├── doorTriggers: DoorTrigger[] ← AABB collision zones
  ├── bounds: { min/max X/Z }    ← Player collision walls
  └── particleSystems: []         ← Per-frame update targets
         │
         ▼
RoomManager
  ├── loadRoom(id)         ← Initial load (instant)
  ├── transitionTo(id)     ← Fade-to-black transition (1.8s)
  ├── updateParticles(dt)  ← Per-frame particle updates
  └── unloadCurrentRoom()  ← Dispose GPU resources
```

### RoomData: The Single Source of Truth

Every room is a plain TypeScript object implementing `RoomData`. No classes, no functions, no Three.js objects — just serializable configuration:

```typescript
const guardPost: RoomData = {
  id: RoomId.GuardPost,
  name: 'Royal Guard Post',
  dimensions: { width: 10, depth: 8, height: 4 },
  mood: 'dark',

  floorColor: 0x2A2A2A,
  wallColor: 0x3A3A3A,
  ceilingColor: 0x1A1A1A,

  ambientLight: { color: 0x1A1A2E, intensity: 0.1 },

  lights: [
    { type: 'point', position: { x: 0, y: 2, z: 0 }, color: 0xFF6B35,
      intensity: 3.0, distance: 12, decay: 1, flicker: true },
  ],

  doors: [
    { position: { x: -5, y: 0, z: 0 }, halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.GrandGallery, spawnPoint: { x: 13, y: 0, z: 0 },
      wall: 'west' },
  ],

  npcs: [
    { spriteColor: '#4A4A4A', position: { x: -1, y: 0, z: 0.5 }, label: 'Guard' },
  ],

  particles: [
    { type: 'embers', position: { x: 0, y: 2, z: 0 }, count: 25 },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.4, luminanceThreshold: 0.90 },
    tiltShift: { focusArea: 0.30, feather: 0.25 },
    vignette: { darkness: 0.60 },
  },
};
```

### Room Registry

All rooms are eagerly imported and stored in a `Map<RoomIdValue, RoomData>`:

```typescript
const roomRegistry = new Map<RoomIdValue, RoomData>([
  [RoomId.ThroneRoom, throneRoom],
  [RoomId.Antechamber, antechamber],
  // ... all 10 rooms
]);

export function getRoomData(id: RoomIdValue): RoomData | undefined {
  return roomRegistry.get(id);
}
```

Eager loading is fine for 10 rooms (~12KB total). Switch to dynamic `import()` if room count grows significantly.

---

## Mood System: Lighting + Post-Processing Presets

The `mood` field drives the aesthetic philosophy of each room. While moods don't auto-configure anything (each room still declares explicit values), they provide a coherent design language:

| Mood | Ambient Color | Ambient Intensity | Directional? | Point Lights | Bloom | Vignette | Design Intent |
|---|---|---|---|---|---|---|---|
| **Grand** | Blue-ish (0x4466AA) | 0.2–0.35 | Yes, with shadows | 6–8 warm torches/chandeliers | 0.6–0.8 | 0.35–0.40 | Theatrical grandeur |
| **Intimate** | Brown-ish (0x443322) | 0.15–0.2 | No | 3–6 candles/torches | 0.5–0.6 | 0.45–0.55 | Cozy, enclosed firelight |
| **Dark** | Deep blue (0x1A1A2E) | 0.08–0.1 | No | 1–3 sparse sources | 0.3–0.4 | 0.60–0.70 | Oppressive, shadowy |
| **Open** | Sky blue (0x6688BB) | 0.5 | Yes, strong sun | 0 | 0.5 | 0.25 | Outdoor, wind-swept |

### Post-Processing Scaling Pattern

```
                Grand    Intimate  Dark     Open
Bloom intensity 0.6–0.8  0.5–0.6   0.3–0.4  0.5
TiltShift focus 0.40–0.45 0.25–0.35 0.20–0.30 0.50
Vignette dark   0.35–0.40 0.45–0.55 0.60–0.70 0.25
```

Dark rooms maximize vignette and minimize bloom. Open rooms maximize focus area and minimize vignette. Grand rooms maximize bloom for chandelier glow.

---

## Door Connectivity System

### Bidirectional Links via Explicit Definitions

Each room declares its own doors. A connection from Room A → Room B requires a `DoorDef` in A's data AND a corresponding `DoorDef` in B's data:

```typescript
// In Throne Room (room 1):
{ targetRoomId: RoomId.SmallCouncil, spawnPoint: { x: 4, y: 0, z: 0 }, wall: 'west' }

// In Small Council (room 3):
{ targetRoomId: RoomId.ThroneRoom, spawnPoint: { x: -13, y: 0, z: 0 }, wall: 'east' }
```

### Spawn Point Calculation

Spawn points are in the **target room's** coordinate space. They should place the player just inside the target room, near the door they entered through:

- For a **north** wall door, spawn at positive Z (away from the north wall)
- For a **south** wall door, spawn at negative Z
- For **east/west** doors, spawn offset on the X axis

### Connectivity Map (10 Rooms)

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

The Throne Room is the hub with 4 exits. The Grand Gallery is a secondary hub with 4 exits. Dead-end rooms (Small Council, Hand's Solar, Guard Post, Maegor's Entry, Queen's Ballroom) each have 1 exit.

---

## buildRoom(): Data → 3D Scene

The builder follows a fixed construction order:

1. **Floor** — `PlaneGeometry(width, depth)`, tiled stone texture, color tint, `receiveShadow: true`
2. **Walls** — 4 walls with dark rectangles at door positions
3. **Ceiling** — `PlaneGeometry` at `y: height`
4. **Ambient light** — from `data.ambientLight`
5. **Point/Directional lights** — from `data.lights[]`, flickering ones collected separately
6. **Door trigger markers** — subtle yellow floor rectangles (debug aid)
7. **NPCs** — `createSpriteMesh()` billboards with blob shadows
8. **Particle systems** — dust motes and torch embers from `data.particles[]`
9. **Collision bounds** — room extents with 0.5 margin

All objects are children of a single `THREE.Group`, enabling atomic scene add/remove.

---

## Room Lifecycle

### Load (Initial)

```typescript
async loadRoom(roomId: RoomIdValue): Promise<void> {
  const data = getRoomData(roomId)!;
  const built = buildRoom(data);
  this.deps.scene.add(built.group);
  CollisionSystem.roomBounds = built.bounds;
  updatePipelineSettings(this.deps.pipeline, data.postProcessOverrides);
  this.pendingFlickerLights = built.flickerLights;
  this.activeParticles = built.particleSystems;
}
```

### Transition (Door Trigger)

```
IDLE → FADING_OUT (800ms) → UNLOADING → LOADING → HOLD_BLACK (200ms) → FADING_IN (800ms) → IDLE
```

- Input disabled during non-IDLE states
- `AbortController` per transition for guaranteed cleanup
- Fade overlay is a CSS `<div>` (not WebGL — cheaper)

### Unload

```typescript
private unloadCurrentRoom(): void {
  this.activeParticles = [];           // Stop updates first
  this.deps.scene.remove(group);       // Remove from scene graph
  disposeRoom(group);                  // Dispose GPU resources
}
```

Order matters: clear particle references BEFORE disposal to prevent `update()` on freed buffers.

---

## Prevention / Best Practices

### Adding a New Room

1. Create `src/rooms/room-data/NN-room-name.ts` implementing `RoomData`
2. Add a `RoomId` entry in `src/ecs/components/singletons.ts`
3. Import and register in `src/rooms/room-data/registry.ts`
4. Add bidirectional `DoorDef` entries in both the new room AND the room it connects to
5. Add a debug key mapping in `src/debug/debug-overlay.ts`
6. Everything else (building, lifecycle, particles, post-processing) is automatic

### Common Mistakes

| Mistake | Result | Fix |
|---|---|---|
| Missing reverse door definition | Can enter room but can't exit back | Always add DoorDef in BOTH rooms |
| Spawn point inside wall | Player stuck after transition | Spawn 1–2 units away from the wall edge |
| Forgetting registry entry | Room loads as blank, console warning | Add to `roomRegistry` Map in registry.ts |
| Same `noiseOffset` on all lights | Torches flicker in unison | Each FlickerLight gets unique offset (auto-assigned) |
| Post-processing not overridden | Room uses previous room's settings | Always declare `postProcessOverrides` |
| Particles in dark rooms with no light | Invisible particles wasting GPU | Match particle regions to light source positions |

### Mood Selection Guide

| If the room feels... | Use mood | Key characteristics |
|---|---|---|
| Important, ceremonial, large | `grand` | Directional sun + many warm lights, high bloom |
| Cozy, small, firelit | `intimate` | Candles/torches only, warm ambient, tight focus |
| Threatening, sparse, oppressive | `dark` | Near-black ambient, 1–3 harsh lights, heavy vignette |
| Outdoor, exposed, natural | `open` | Strong directional, high ambient, wide focus, no vignette |

---

## Related Resources

- `docs/solutions/architecture/non-ecs-particle-integration-pattern.md` — How particle systems integrate with the game loop
- `docs/solutions/runtime-errors/becsy-ecs-api-runtime-crashes.md` — Becsy entity creation for FlickerLight
- `docs/solutions/code-review/pre-commit-review-hd2d-mvp.md` — GPU disposal and game loop patterns
- `docs/plans/2026-02-05-feat-hd2d-red-keep-mvp-plan.md` — Phase 5 room specifications and connectivity map

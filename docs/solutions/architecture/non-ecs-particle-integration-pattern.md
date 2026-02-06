---
title: "Non-ECS Particle Systems in a Becsy ECS Game Loop"
category: architecture
tags: [particles, three-js, becsy-ecs, game-loop, shader-material, gpu-disposal, room-lifecycle]
module: rendering
date: 2026-02-06
updated: 2026-02-06
status: resolved
severity: P3
symptoms:
  - Need per-frame particle updates but particles don't belong in ECS
  - THREE.Points GPU resources leaking on room unload
  - Particle updates not synced with game loop timing
---

# Non-ECS Particle Systems in a Becsy ECS Game Loop

## Problem Statement

The game needed dust mote and torch ember particle systems that update every frame, but the Becsy ECS architecture is reserved for entities with gameplay logic (player, flickering lights). Particles are purely visual — hundreds of particle "entities" would waste ECS memory and add query overhead. The challenge: how to integrate non-ECS per-frame updates into a serialized Becsy game loop while respecting the room lifecycle (creation, per-frame update, disposal on room unload).

---

## Solution: GameLoop Callback + RoomManager Bridge

### Architecture

```
GameLoop.tick()
  ├── onBeforeExecute()        ← stats-gl begin
  ├── onFrameTick(dt)          ← RoomManager.updateParticles(dt)
  │     └── for each ParticleSystem → ps.update(dt)
  ├── world.execute()          ← Becsy ECS systems run
  │     └── ThreeRenderSystem  ← composer.render()
  └── onAfterExecute()         ← stats-gl end
```

Particles update BEFORE `world.execute()` so that buffer uploads (`needsUpdate = true`) are ready when Three.js renders in `ThreeRenderSystem`.

### GameLoop: The `onFrameTick` Callback

Added a simple callback to the existing serialized game loop:

```typescript
// game-loop.ts
export class GameLoop {
  /** Per-frame callback for non-ECS updates. Receives delta in seconds. */
  onFrameTick: ((dt: number) => void) | null = null;

  private tick = (timestamp: number): void => {
    // ... delta calculation ...
    this.executing = true;
    this.onBeforeExecute?.();
    this.onFrameTick?.(delta / 1000); // seconds, not ms
    this.world.execute(timestamp, delta) // Becsy expects ms
      .then(() => { /* ... */ });
  };
}
```

### RoomManager: Particle Lifecycle Owner

```typescript
// RoomManager.ts
private activeParticles: ParticleSystem[] = [];

// On room load — store particle references
async loadRoom(roomId: RoomIdValue): Promise<void> {
  const built = buildRoom(data);
  this.activeParticles = built.particleSystems;
  // ...
}

// Per-frame — update all active particles
updateParticles(dt: number): void {
  for (const ps of this.activeParticles) {
    ps.update(dt);
  }
}

// On room unload — clear references BEFORE disposal
private unloadCurrentRoom(): void {
  this.activeParticles = [];          // Stop updates first
  this.deps.scene.remove(group);      // Remove from scene graph
  disposeRoom(group);                 // Dispose GPU resources
}
```

### Wiring in main.ts

```typescript
const loop = new GameLoop(world);
loop.onFrameTick = (dt) => roomManager.updateParticles(dt);
loop.start();
```

---

## Particle System Interface

Both dust motes and torch embers implement the same shape:

```typescript
interface ParticleSystemLike {
  points: THREE.Points;     // Add to room group for scene graph membership
  update(dt: number): void; // Called every frame with delta in seconds
  dispose(): void;          // Releases geometry + material
}
```

### Data-Driven Creation via RoomData

Particle definitions use a discriminated union in room data:

```typescript
// types.ts
export interface DustParticleDef {
  type: 'dust';
  region: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  count: number;
}

export interface EmberParticleDef {
  type: 'embers';
  position: Vec3;
  count: number;
}

export type ParticleDef = DustParticleDef | EmberParticleDef;
```

RoomBuilder creates them based on room data:

```typescript
// RoomBuilder.ts
if (data.particles) {
  for (const pDef of data.particles) {
    if (pDef.type === 'dust') {
      const dust = createDustMotes({ count: pDef.count, region: pDef.region });
      group.add(dust.points);
      particleSystems.push(dust);
    } else if (pDef.type === 'embers') {
      const embers = createTorchEmbers({ position: pDef.position, count: pDef.count });
      group.add(embers.points);
      particleSystems.push(embers);
    }
  }
}
```

---

## ShaderMaterial Pattern for Custom Particles

### Soft Circle via gl_PointCoord

All particles use `THREE.Points` with custom `ShaderMaterial` — no texture lookups needed:

```glsl
// Fragment shader — procedural soft circle
float d = length(gl_PointCoord - vec2(0.5));
if (d > 0.5) discard;                          // Hard circle cutoff
float alpha = smoothstep(0.5, 0.15, d) * vAlpha; // Soft glow edge
```

### Material Configuration

```typescript
const material = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: FRAG,
  transparent: true,
  blending: THREE.AdditiveBlending, // Overlapping particles brighten
  depthWrite: false,                // Don't block other geometry
});
```

- **AdditiveBlending** — particles add color together, natural for fire/light
- **depthWrite: false** — prevents z-fighting and sorting issues with transparent objects
- **frustumCulled = false** — skip bounding box checks for always-visible room particles

### CPU-Side Buffer Updates

Direct Float32Array manipulation for performance — no object allocation:

```typescript
update(dt: number) {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const pos = posAttr.array as Float32Array;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    pos[i3] = basePositions[i3]! + Math.sin(elapsed * fx + phase) * 0.3;
    // ...
  }

  posAttr.needsUpdate = true; // Mark buffer for GPU upload
}
```

---

## GPU Resource Disposal

### The `disposeRoom` Traversal

The existing `disposeRoom()` was updated to handle `THREE.Points` in addition to `THREE.Mesh`:

```typescript
export function disposeRoom(group: THREE.Group): void {
  group.traverse((obj) => {
    // Handle both Mesh and Points (particles)
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
      if (!obj.geometry.userData.shared) {
        obj.geometry.dispose();
      }
      const mat = obj.material;
      if (mat instanceof THREE.Material) {
        if ('map' in mat && mat.map) {
          (mat.map as THREE.Texture).dispose();
        }
        mat.dispose();
      }
    }
  });
}
```

### Disposal Order Matters

```
1. activeParticles = []        ← Stop per-frame updates
2. scene.remove(group)         ← Remove from render tree
3. disposeRoom(group)          ← Release GPU resources (geometry, material)
```

Clearing `activeParticles` first prevents `update()` calls on disposed buffers.

---

## Why Not ECS for Particles?

| Concern | ECS Approach | Plain Three.js Approach |
|---|---|---|
| Memory | ~200 entities × component overhead | 1 BufferGeometry per system |
| Per-frame cost | Query + iterate + component reads | Direct Float32Array writes |
| Creation/destruction | `this.createEntity()` + `.create` entitlements | Array respawn (no entity churn) |
| Complexity | System + component + entitlements | Self-contained module |

Particles are purely visual with no gameplay queries — ECS adds overhead with no benefit. The `onFrameTick` callback keeps them in the frame update cycle without polluting the ECS.

---

## Prevention / Best Practices

### Adding New Particle Types

1. Create `src/rendering/particles/new-type.ts` implementing `{ points, update(dt), dispose() }`
2. Add a new variant to the `ParticleDef` discriminated union in `types.ts`
3. Add a case to the `if/else` chain in `RoomBuilder.buildRoom()`
4. Everything else (per-frame update, disposal, room lifecycle) is automatic

### Common Mistakes

| Mistake | Result | Fix |
|---|---|---|
| Forgetting `disposeRoom` for `THREE.Points` | GPU memory leak (geometry + shader) | Check `instanceof THREE.Points` in traversal |
| Updating particles AFTER render | One frame of stale buffer data | Use `onFrameTick` (runs before `world.execute`) |
| Not clearing `activeParticles` before dispose | `update()` called on disposed buffers | Clear array first in `unloadCurrentRoom()` |
| Using `depthWrite: true` on additive particles | Z-fighting, incorrect draw order | Always `depthWrite: false` for transparent/additive |
| Not setting `frustumCulled = false` | Particles disappear when bounding box is off-screen | Room particles are always visible — disable culling |

---

## Related Resources

- `docs/solutions/runtime-errors/becsy-ecs-api-runtime-crashes.md` — Becsy entity creation patterns (why particles avoid ECS)
- `docs/solutions/code-review/pre-commit-review-hd2d-mvp.md` — Game loop error recovery and GPU disposal patterns
- `docs/plans/2026-02-05-feat-hd2d-red-keep-mvp-plan.md` — Phase 4 particle specifications

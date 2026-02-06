# Three.js Game Architecture Patterns — Research Findings

**Date:** 2026-02-05
**Purpose:** Technical research on game architecture patterns for the HD-2D Red Keep MVP. Covers room/scene management, ECS sync, post-processing performance, pixel art in 3D, asset preloading, and game loop architecture.

---

## Table of Contents

1. [Room/Scene Management Patterns](#1-roomscene-management-patterns)
2. [ECS + Three.js Sync Patterns](#2-ecs--threejs-sync-patterns)
3. [Post-Processing Performance](#3-post-processing-performance)
4. [Pixel Art in 3D (HD-2D Rendering)](#4-pixel-art-in-3d-hd-2d-rendering)
5. [Asset Preloading Patterns](#5-asset-preloading-patterns)
6. [Game Loop Architecture](#6-game-loop-architecture)
7. [Sources](#7-sources)

---

## 1. Room/Scene Management Patterns

### The Core Pattern: Scene-as-Container

Production Three.js games handle room-based levels by treating each room as a **container Group** within a single persistent `THREE.Scene`. Rather than creating/destroying `Scene` objects, rooms are loaded as `THREE.Group` hierarchies that are added to and removed from the main scene.

```typescript
class RoomManager {
  private scene: THREE.Scene;
  private currentRoom: THREE.Group | null = null;
  private roomCache: Map<string, THREE.Group> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async loadRoom(roomId: string): Promise<THREE.Group> {
    // Check cache first
    if (this.roomCache.has(roomId)) {
      return this.roomCache.get(roomId)!;
    }

    // Build room geometry/load assets into a Group
    const roomGroup = new THREE.Group();
    roomGroup.name = `room-${roomId}`;

    // ... populate roomGroup with meshes, lights, sprites ...

    this.roomCache.set(roomId, roomGroup);
    return roomGroup;
  }

  async transitionTo(roomId: string, spawnPoint: THREE.Vector3): Promise<void> {
    // 1. Fade out (via overlay or post-processing)
    await this.fadeOut(0.5);

    // 2. Remove current room from scene (but keep in cache or dispose)
    if (this.currentRoom) {
      this.scene.remove(this.currentRoom);
    }

    // 3. Load and add new room
    const newRoom = await this.loadRoom(roomId);
    this.scene.add(newRoom);
    this.currentRoom = newRoom;

    // 4. Reposition player
    // ... move player entity to spawnPoint ...

    // 5. Fade in
    await this.fadeIn(0.5);
  }
}
```

**Why not multiple `THREE.Scene` objects?** The `EffectComposer` from pmndrs/postprocessing binds to a single scene+camera pair in the `RenderPass`. Swapping scenes would require reconfiguring the composer. Keeping one scene and swapping room groups is simpler and avoids re-initialization overhead.

### Disposal: The Hard Part

Three.js does NOT garbage-collect GPU resources automatically. When unloading a room, you must manually dispose every geometry, material, and texture, or the GPU memory will leak. This is the most commonly reported pain point in Three.js game development.

```typescript
function disposeRoom(roomGroup: THREE.Group): void {
  roomGroup.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      // Dispose geometry
      object.geometry.dispose();

      // Dispose material(s)
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      for (const material of materials) {
        // Dispose all texture maps on the material
        for (const key of Object.keys(material)) {
          const value = (material as any)[key];
          if (value instanceof THREE.Texture) {
            value.dispose();
          }
        }
        material.dispose();
      }
    }

    // Dispose lights' shadow maps
    if (object instanceof THREE.Light && object.shadow?.map) {
      object.shadow.map.dispose();
    }
  });

  // Remove from parent
  roomGroup.removeFromParent();
}
```

**Verification:** After disposal, check `renderer.info.memory` to confirm geometry/texture counts decreased:

```typescript
console.log('Geometries:', renderer.info.memory.geometries);
console.log('Textures:', renderer.info.memory.textures);
```

### Cache vs. Dispose Strategy

For a 10-room game like this MVP, there are two viable strategies:

| Strategy | Approach | Pros | Cons |
|---|---|---|---|
| **Dispose on exit** | Destroy room GPU resources on transition | Low memory footprint | Reload cost on re-entry |
| **Cache neighbors** | Keep adjacent rooms in memory, dispose distant rooms | Instant re-entry to neighbors | Higher memory use |

**Recommendation for this project:** Cache the current room plus its immediate neighbors (per the connectivity map). Dispose rooms that are 2+ transitions away. With 10 rooms averaging ~5-15MB each in GPU memory, caching 3 rooms simultaneously stays well within the 50MB GPU memory budget.

```typescript
// After transitioning to a new room:
const neighborsToKeep = getAdjacentRoomIds(currentRoomId); // From connectivity map
for (const [id, group] of this.roomCache) {
  if (id !== currentRoomId && !neighborsToKeep.includes(id)) {
    disposeRoom(group);
    this.roomCache.delete(id);
  }
}
```

### Fade Transition Implementation

For the fade-to-black transition, use a full-screen overlay rather than a post-processing effect, since it is cheaper and does not interact with the effect pipeline:

```typescript
class FadeOverlay {
  private mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;

  constructor(camera: THREE.PerspectiveCamera) {
    // Place a black plane right in front of the camera
    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.material
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9999; // Render last

    // Alternatively, use an HTML overlay div for simplicity
  }

  async fadeOut(duration: number): Promise<void> {
    return this.animate(0, 1, duration);
  }

  async fadeIn(duration: number): Promise<void> {
    return this.animate(1, 0, duration);
  }

  private animate(from: number, to: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const t = Math.min((performance.now() - start) / (duration * 1000), 1);
        this.material.opacity = from + (to - from) * t;
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      tick();
    });
  }
}
```

---

## 2. ECS + Three.js Sync Patterns

### The Two Sources of Truth Problem

The fundamental tension: ECS components store game state (position, rotation, scale) as flat data optimized for cache-friendly iteration. Three.js stores visual state in Object3D hierarchies with matrix math. These two representations must stay in sync.

**The golden rule: ECS is the single source of truth. Three.js objects are "views" that reflect ECS state.**

Never modify `object3d.position` directly in gameplay code. Always write to the ECS component, then let a sync system propagate the change.

### Recommended Architecture for Becsy + Three.js

```
[Input] -> [Game Logic Systems] -> [Transform Sync System] -> [Three.js Render System]
              writes ECS                reads ECS,              calls composer.render()
              components                writes Three.js
```

#### Component Design

```typescript
import { component, field } from '@lastolivegames/becsy';

// Pure data - no Three.js objects here
@component class Transform {
  @field.float64 declare px: number;
  @field.float64 declare py: number;
  @field.float64 declare pz: number;
  @field.float64 declare rx: number;
  @field.float64 declare ry: number;
  @field.float64 declare rz: number;
  @field.float64 declare sx: number;
  @field.float64 declare sy: number;
  @field.float64 declare sz: number;
}

// Bridge component: holds a reference to the Three.js object
@component class Object3DRef {
  @field.object declare object3d: THREE.Object3D;
}
```

**Key insight:** Keep the `Object3DRef` as a separate component from `Transform`. This lets you have entities with Transform but no visual representation (e.g., trigger zones, audio emitters), and makes queries cleaner.

#### The TransformSyncSystem

This system runs after all game logic, right before rendering. It reads ECS Transform data and writes it to Three.js Object3D instances.

```typescript
import { system, System } from '@lastolivegames/becsy';

@system class TransformSyncSystem extends System {
  // Query: entities that have both Transform and Object3DRef
  private entities = this.query(
    (q) => q.current.with(Transform).and.with(Object3DRef).read
  );

  // Reactive query: only process entities whose Transform changed this frame
  private changed = this.query(
    (q) => q.changed.with(Transform).and.with(Object3DRef).read
  );

  execute() {
    // Option A: sync ALL entities every frame (simpler, fine for < 1000 entities)
    for (const entity of this.entities.current) {
      const t = entity.read(Transform);
      const ref = entity.read(Object3DRef);
      const obj = ref.object3d;

      obj.position.set(t.px, t.py, t.pz);
      obj.rotation.set(t.rx, t.ry, t.rz);
      obj.scale.set(t.sx, t.sy, t.sz);
    }

    // Option B: sync only CHANGED entities (more efficient for many entities)
    // for (const entity of this.changed.changed) {
    //   ... same sync logic ...
    // }
  }
}
```

**Reactive vs. brute-force sync:** Becsy's `.changed` queries use mutation tracking. When you call `entity.write(Transform)`, Becsy marks that component as changed. The reactive query only returns entities that were actually modified. For this MVP with ~50-100 entities, brute-force sync every frame is fine. For larger games (1000+ entities), reactive queries provide meaningful savings.

#### System Execution Order

Becsy lets you declare ordering constraints between systems:

```typescript
@system class InputSystem extends System {
  // Runs first - no dependencies
  execute() { /* read keyboard state */ }
}

@system class PlayerMovementSystem extends System {
  // Runs after InputSystem
  readonly __deps = [InputSystem];
  execute() { /* read input, write Transform */ }
}

@system class RoomTransitionSystem extends System {
  readonly __deps = [PlayerMovementSystem];
  execute() { /* check door triggers */ }
}

@system class CameraFollowSystem extends System {
  readonly __deps = [PlayerMovementSystem];
  execute() { /* lerp camera toward player */ }
}

@system class LightFlickerSystem extends System {
  // Can run in parallel with Camera - no shared writes
  readonly __deps = [InputSystem];
  execute() { /* animate light intensities */ }
}

@system class TransformSyncSystem extends System {
  // Must run after ALL game logic that writes Transform
  readonly __deps = [PlayerMovementSystem, CameraFollowSystem];
  execute() { /* ECS Transform -> Three.js Object3D */ }
}

@system class ThreeRenderSystem extends System {
  // Always last
  readonly __deps = [TransformSyncSystem];
  execute() { /* composer.render() */ }
}
```

### Common Pitfalls

1. **Mutating Three.js objects directly.** If you set `mesh.position.x = 5` instead of writing the ECS component, the sync system will overwrite your change on the next frame. Always write ECS first.

2. **Forgetting `.write()` when modifying components.** In Becsy, you must call `entity.write(Transform)` to get a writable handle. Using `.read()` and modifying the result will silently fail to trigger change tracking.

3. **Holding component handles across frames.** Becsy documentation warns: "Do NOT hold component handles. Destructure immediately." Handles become invalid after the frame they were obtained.

   ```typescript
   // BAD: holding a handle
   const transform = entity.write(Transform);
   // ... later, possibly next frame ...
   transform.px = 5; // May be invalid!

   // GOOD: destructure immediately or use within the same frame
   const t = entity.write(Transform);
   t.px = 5;
   t.py = 0;
   // Done with it this frame
   ```

4. **Creating Three.js objects in ECS systems.** Systems should operate on data. Create Three.js objects in your RoomBuilder/factory code, assign them to `Object3DRef`, then let systems read/write the data components.

5. **Missing cleanup on entity deletion.** When destroying an ECS entity that has an Object3DRef, you must also remove the Object3D from the scene and dispose its resources. Use a reactive "removed" query:

   ```typescript
   private removed = this.query(
     (q) => q.removed.with(Object3DRef).read
   );

   execute() {
     for (const entity of this.removed.removed) {
       const ref = entity.read(Object3DRef);
       ref.object3d.removeFromParent();
       // Dispose geometry/material if owned by this entity
     }
   }
   ```

### Alternative: Meta's Immersive Web SDK Pattern

Meta's IWSDK (for Horizon Worlds) uses a similar pattern with a dedicated TransformSystem at priority 1 that syncs ECS Transform to Three.js. Key differences from our approach:

- They auto-create Three.js Object3D when an entity gains a Transform component
- Parent-child hierarchies in ECS automatically create matching Three.js parent-child relationships
- They explicitly forbid direct modification of Three.js objects

This validates our architecture: ECS-authoritative, one-way sync, dedicated sync system running just before render.

---

## 3. Post-Processing Performance

### Effect Merging: Why pmndrs/postprocessing Wins

The critical performance difference between Three.js's built-in `EffectComposer` and pmndrs `postprocessing`:

| Approach | 5 effects = | GPU passes |
|---|---|---|
| **Three.js built-in** | 5 separate ShaderPasses | 5 fullscreen draws (1 per effect) |
| **pmndrs EffectPass** | Effects merged into 1-2 compound shaders | 1-2 fullscreen draws |

**How merging works:** The `EffectPass` gathers all effect fragment shaders, prefixes their functions/uniforms/varyings to avoid naming collisions, and concatenates them into a single compound fragment shader. Texels pass through the effect function chain sequentially within one draw call.

**The CONVOLUTION constraint:** Effects that sample additional texels from the input buffer (like blur-based effects) are flagged with the `CONVOLUTION` attribute. Only ONE convolution effect is allowed per `EffectPass`. If you have multiple convolution effects, they must be split into separate passes.

For the HD-2D pipeline:

```typescript
// Pass 1: N8AOPass (renders scene + SSAO) - this is a standalone Pass, not an Effect
const n8aoPass = new N8AOPass(scene, camera, w, h);

// Pass 2: Bloom (CONVOLUTION - samples neighbors for blur)
//         + non-convolution effects can ride along
const bloomPass = new EffectPass(camera, new BloomEffect({...}));

// Pass 3: TiltShift (CONVOLUTION - Gaussian blur based)
//         + Vignette (simple, non-convolution)
//         + Color grading (LUT lookup, non-convolution)
const finalPass = new EffectPass(
  camera,
  new TiltShiftEffect({...}),
  new VignetteEffect({...}),
  new LUT3DEffect(lutTexture)
);
```

This gives us: **3 fullscreen passes** for 6 effects (SSAO, bloom, tilt-shift DoF, vignette, color grading, tone mapping). Without merging, this would be 6+ passes.

### Relative Cost of Common Effects

While exact millisecond costs depend on GPU, resolution, and parameters, here is the general cost ranking based on community reports, forum discussions, and the nature of each effect's shader work:

| Effect | Relative Cost | Why | Mergeable? |
|---|---|---|---|
| **Vignette** | Very cheap | Simple distance-from-center math, no texture reads | Yes |
| **Color Grading (LUT)** | Very cheap | Single 3D texture lookup per pixel | Yes |
| **Brightness/Contrast/HueSat** | Very cheap | Per-pixel arithmetic only | Yes |
| **Tone Mapping** | Very cheap | Per-pixel math (ACES curve) | Yes |
| **Chromatic Aberration** | Cheap | 3 offset texture reads | Yes (non-convolution) |
| **Bloom** | Moderate | Multi-pass mipmap blur chain + combine | No (CONVOLUTION) |
| **Tilt-Shift DoF** | Moderate | Gaussian blur kernel per pixel, scaled by position | No (CONVOLUTION) |
| **SSAO (N8AO)** | Moderate-Expensive | 16+ samples per pixel in screen space, + denoise pass | Standalone pass |
| **God Rays** | Expensive | 60+ raymarch steps per pixel through shadow map | Standalone pass |
| **BokehPass (true DoF)** | Expensive | Many texture samples per pixel scaled by CoC | Standalone pass |

**Practical guidance for desktop-only targets:**

- Stacking vignette + LUT color grading + tone mapping + brightness/contrast costs almost nothing because they merge into a single pass with simple per-pixel operations.
- Bloom + tilt-shift are the moderate-cost pair. With pmndrs merging, they require 2 additional passes. At 1080p on a mid-range GPU, budget ~2-3ms total.
- N8AO at half-resolution is the most cost-effective SSAO. Budget ~1-2ms. It exposes `lastTime` for self-profiling via `EXT_disjoint_timer_query_webgl2` in Chrome.
- God rays (three-good-godrays) with 60 raymarch steps can cost 2-4ms. Consider reducing `raymarchSteps` to 30-40 for rooms where rays are subtle.

**Total pipeline budget estimate at 1080p on a GTX 1060-class GPU:**

```
Scene render:           ~4-6ms
N8AO (half-res):        ~1-2ms
Bloom (mipmap):         ~1-1.5ms
Tilt-shift:             ~1-1.5ms
Vignette+LUT+Tone:     ~0.3ms (merged)
God rays (if enabled):  ~2-4ms
---
Total:                  ~9-15ms (66-111 fps)
```

This leaves headroom for 60fps. For rooms without god rays (6 of 10 rooms), the budget is ~7-11ms, comfortably 60fps.

### Profiling in Practice

```typescript
// Enable GPU timer for N8AO
n8aoPass.configuration.screenSpaceRadius = false;
// After a few frames:
console.log('SSAO GPU time:', n8aoPass.lastTime, 'ms');

// General renderer stats
console.log(renderer.info.render.calls);    // draw calls per frame
console.log(renderer.info.render.triangles); // triangles per frame
console.log(renderer.info.memory.geometries);
console.log(renderer.info.memory.textures);

// For full pipeline timing, use Chrome DevTools > Performance tab
// or the EXT_disjoint_timer_query_webgl2 extension
```

### Renderer Configuration for Post-Processing

```typescript
const renderer = new THREE.WebGLRenderer({
  powerPreference: 'high-performance', // Request discrete GPU
  alpha: false,        // No transparency needed on canvas
  antialias: false,    // SMAA via postprocessing is better
  stencil: false,      // Not needed for this pipeline
  depth: false,        // Depth buffer managed by postprocessing
});

renderer.toneMapping = THREE.NoToneMapping; // Let ToneMappingEffect handle it
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

### WebGPU + TSL: The Future (But Not Yet)

Three.js r166+ introduced TSL (Three.js Shading Language), a node-based material system that works with both WebGL and WebGPU renderers. TSL provides renderer-agnostic shaders and hooks like `colorNode`, `normalNode`, `positionNode` for easy material customization.

However, for post-processing in 2025-2026:
- The pmndrs/postprocessing library does not yet support WebGPU
- Three.js's own WebGPU post-processing pipeline is still maturing
- WebGPU browser support is not universal

**Recommendation:** Stick with WebGL2 + pmndrs/postprocessing for this MVP. The pipeline is proven and performant. Migration to WebGPU can happen when the ecosystem catches up.

---

## 4. Pixel Art in 3D (HD-2D Rendering)

### How HD-2D Works

HD-2D, pioneered by Square Enix in Octopath Traveler (Unreal Engine 4), combines:
- **3D environments** with full PBR materials and dynamic lighting
- **2D pixel-art sprites** rendered as billboard planes in the 3D scene
- **Heavy post-processing**: tilt-shift DoF, bloom, vignette, color grading
- The result is a "diorama" or "miniature" aesthetic

The core challenge is making flat pixel-art sprites look natural alongside high-fidelity 3D geometry.

### Crisp Pixel Art Textures

The single most important setting:

```typescript
const texture = textureLoader.load('sprites/knight.png');

// CRITICAL: Nearest-neighbor filtering preserves hard pixel edges
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;

// Disable mipmaps (they blur pixel art at distance)
texture.generateMipmaps = false;

// Prevent edge bleeding from adjacent atlas frames
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;

// Correct color space
texture.colorSpace = THREE.SRGBColorSpace;
```

**Without `NearestFilter`:** Three.js defaults to `LinearFilter`, which bilinearly interpolates between texels. This makes pixel art look blurry and "fat" — a commonly reported issue on the Three.js forums.

### Billboarding: PlaneGeometry vs THREE.Sprite

| Approach | Behavior | HD-2D Suitability |
|---|---|---|
| `THREE.Sprite` | Auto-faces camera on ALL axes | Bad — sprite tilts backward at 3/4 camera angle |
| `PlaneGeometry` + Y-axis billboard | Faces camera only on Y axis, stays upright | Good — sprite looks like a paper cutout standing in the scene |
| `PlaneGeometry` + fixed orientation | Set once to face camera direction, never update | Best for fixed camera — zero per-frame cost |

**For a fixed 3/4 camera (our case):** Orient all sprite planes once during room setup to face the camera direction. Since the camera angle never changes within a room, no per-frame billboarding update is needed:

```typescript
function createSpriteBillboard(
  texture: THREE.Texture,
  width: number,
  height: number,
  cameraDirection: THREE.Vector3
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.5,     // Hard cutoff for pixel art (no semi-transparency)
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Orient to face opposite the camera direction (Y-axis only)
  const dir = cameraDirection.clone();
  dir.y = 0;
  dir.normalize();
  mesh.lookAt(
    mesh.position.x - dir.x,
    mesh.position.y,
    mesh.position.z - dir.z
  );

  return mesh;
}
```

### Depth Sorting and Z-Fighting Prevention

Pixel art sprites in a 3D scene face three depth-related problems:

#### Problem 1: Transparent sprite edges writing to depth buffer

When `depthWrite: true`, transparent pixels (alpha < alphaTest threshold) can still write to the depth buffer in some configurations, causing objects behind to be clipped.

**Solution:** Use `alphaTest: 0.5` on the material. This discards fragments below 0.5 alpha before depth writing. For pixel art with hard edges (no semi-transparency), this is clean.

```typescript
const material = new THREE.MeshBasicMaterial({
  map: spriteTexture,
  transparent: true,
  alphaTest: 0.5,  // Hard cutout
  depthWrite: true,
  depthTest: true,
});
```

#### Problem 2: Sprites at the same depth z-fighting

When two sprites (or a sprite and a floor plane) occupy nearly the same depth, z-fighting produces flickering artifacts.

**Solution: Use `polygonOffset` for coplanar geometry:**

```typescript
// For sprites that sit ON the floor (like shadows or ground markers):
const groundSpriteMaterial = new THREE.MeshBasicMaterial({
  map: shadowTexture,
  transparent: true,
  polygonOffset: true,
  polygonOffsetFactor: -1,  // Bias toward camera
  polygonOffsetUnits: -1,
});
```

**Solution: Use `renderOrder` for explicit draw ordering:**

```typescript
// For a fixed camera angle, sort sprites by their Z position
// (further from camera renders first)
function updateSpriteRenderOrder(sprites: THREE.Mesh[], camera: THREE.Camera) {
  const cameraDir = new THREE.Vector3();
  camera.getWorldDirection(cameraDir);

  for (const sprite of sprites) {
    // Project position onto camera forward axis
    const depth = sprite.position.dot(cameraDir);
    sprite.renderOrder = Math.round(-depth * 100);
  }
}
```

#### Problem 3: Sprite "sinking" into the ground plane

At a 3/4 camera angle, the bottom edge of a sprite plane can intersect the floor due to perspective.

**Solution:** Offset the sprite origin to the bottom edge:

```typescript
// Move geometry origin to bottom-center
const geometry = new THREE.PlaneGeometry(width, height);
geometry.translate(0, height / 2, 0); // Shift up by half height

// Now position.y = 0 places the sprite's feet on the ground
sprite.position.y = 0;
```

### Sprite Scaling at Different Camera Distances

In HD-2D, sprites should maintain a consistent "pixel density" — each sprite pixel should map to approximately the same number of screen pixels regardless of the sprite's distance from the camera.

For a fixed overhead camera, this is less of an issue since all sprites are at roughly the same distance. But for sprites at different depths in the scene:

**Approach: Fixed world-space size (recommended for HD-2D)**

Let sprites scale naturally with perspective. The tilt-shift DoF effect will blur distant sprites anyway, so the slight size variation from perspective adds depth to the diorama aesthetic.

```typescript
// All sprites at the same world-space scale
// A 16x16 pixel sprite at 2x world scale = 2 units wide
const SPRITE_SCALE = 2; // world units per sprite width
sprite.scale.set(SPRITE_SCALE, SPRITE_SCALE * (spriteHeight / spriteWidth), 1);
```

**Approach: Screen-space consistent size (for UI-like sprites)**

If you need sprites to always appear the same pixel-size on screen (like damage numbers), scale inversely with distance:

```typescript
function updateScreenSpaceScale(sprite: THREE.Mesh, camera: THREE.Camera, targetPixelHeight: number) {
  const distance = sprite.position.distanceTo(camera.position);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const worldHeightAtDistance = 2 * Math.tan(vFov / 2) * distance;
  const scale = (targetPixelHeight / window.innerHeight) * worldHeightAtDistance;
  sprite.scale.set(scale, scale, 1);
}
```

### Camera Snapping for Pixel-Perfect Rendering

Sub-pixel camera movement causes pixel art to "swim" — individual pixels appear to shift and shimmer as the camera moves fractionally between texel boundaries.

**Solution:** Snap the camera position to the texel grid at the focal plane:

```typescript
function snapCameraToPixelGrid(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  renderHeight: number
): void {
  // Calculate world-space size of one pixel at the focal plane
  const focalDistance = camera.position.distanceTo(target);
  const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * focalDistance;
  const texelSize = frustumHeight / renderHeight;

  // Snap camera XZ to texel grid
  camera.position.x = Math.round(camera.position.x / texelSize) * texelSize;
  camera.position.z = Math.round(camera.position.z / texelSize) * texelSize;
}
```

**When to snap:** After camera follow interpolation, before rendering. This adds a tiny positional quantization that is invisible at normal play speeds but prevents pixel swimming.

---

## 5. Asset Preloading Patterns

### The Problem

Room transitions in a 10-room game can cause hitches if the next room's assets (textures, GLB models) are loaded during the transition. Even with a fade-to-black, asset loading can take 100ms-2000ms depending on asset size, causing a noticeable pause.

### Pattern 1: Preload Adjacent Rooms During Gameplay

The most effective pattern for room-based games: while the player explores the current room, silently preload assets for all adjacent rooms.

```typescript
class AssetPreloader {
  private loadingManager: THREE.LoadingManager;
  private gltfLoader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private cache: Map<string, any> = new Map();
  private loading: Map<string, Promise<any>> = new Map();

  constructor() {
    this.loadingManager = new THREE.LoadingManager();
    this.gltfLoader = new GLTFLoader(this.loadingManager);
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
  }

  // Load a single asset, with deduplication
  async loadAsset(url: string, type: 'gltf' | 'texture'): Promise<any> {
    // Already cached
    if (this.cache.has(url)) return this.cache.get(url);

    // Already loading (dedup concurrent requests)
    if (this.loading.has(url)) return this.loading.get(url);

    const promise = (async () => {
      let result: any;
      if (type === 'gltf') {
        result = await this.gltfLoader.loadAsync(url);
      } else {
        result = await this.textureLoader.loadAsync(url);
      }
      this.cache.set(url, result);
      this.loading.delete(url);
      return result;
    })();

    this.loading.set(url, promise);
    return promise;
  }

  // Preload all assets for a room (non-blocking)
  preloadRoom(roomData: RoomData): void {
    const assets: Array<{ url: string; type: 'gltf' | 'texture' }> = [];

    // Gather all asset URLs from room definition
    assets.push({ url: roomData.floorTexture, type: 'texture' });
    assets.push({ url: roomData.wallTexture, type: 'texture' });
    for (const prop of roomData.props) {
      assets.push({ url: prop.modelPath, type: 'gltf' });
    }
    for (const npc of roomData.npcs) {
      assets.push({ url: npc.spriteSheet, type: 'texture' });
    }

    // Fire-and-forget: load all in parallel
    Promise.all(
      assets
        .filter((a) => !this.cache.has(a.url))
        .map((a) => this.loadAsset(a.url, a.type))
    ).catch((err) => console.warn('Preload error:', err));
  }

  // After a room transition, preload its neighbors
  onRoomEnter(currentRoomId: number, roomGraph: Map<number, number[]>): void {
    const neighbors = roomGraph.get(currentRoomId) ?? [];
    for (const neighborId of neighbors) {
      const roomData = getRoomData(neighborId);
      this.preloadRoom(roomData);
    }
  }

  // Evict distant rooms from cache to free memory
  evictDistant(currentRoomId: number, roomGraph: Map<number, number[]>): void {
    const neighbors = new Set(roomGraph.get(currentRoomId) ?? []);
    neighbors.add(currentRoomId);

    // Find all assets used by current + neighbor rooms
    const keepUrls = new Set<string>();
    for (const id of neighbors) {
      const data = getRoomData(id);
      keepUrls.add(data.floorTexture);
      keepUrls.add(data.wallTexture);
      // ... gather all asset URLs ...
    }

    // Evict assets not used by nearby rooms
    for (const [url, asset] of this.cache) {
      if (!keepUrls.has(url)) {
        if (asset instanceof THREE.Texture) asset.dispose();
        if (asset.scene) {
          // GLTF - dispose scene hierarchy
          asset.scene.traverse((obj: THREE.Object3D) => {
            if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
          });
        }
        this.cache.delete(url);
      }
    }
  }
}
```

### Pattern 2: Idle-Time Loading with requestIdleCallback

For lower-priority preloading (e.g., rooms 2 hops away), use `requestIdleCallback` to load assets only when the browser has spare time:

```typescript
function preloadDuringIdle(urls: string[], loader: AssetPreloader): void {
  let index = 0;

  function loadNext(deadline: IdleDeadline): void {
    // Load assets while we have idle time (> 5ms remaining)
    while (index < urls.length && deadline.timeRemaining() > 5) {
      loader.loadAsset(urls[index], 'texture'); // Fire and forget
      index++;
    }

    if (index < urls.length) {
      requestIdleCallback(loadNext);
    }
  }

  requestIdleCallback(loadNext);
}
```

**Caveat:** `requestIdleCallback` is not called during `requestAnimationFrame` loops if the CPU is busy. It works best for truly low-priority background work.

### Pattern 3: Chunked Loading to Avoid Frame Spikes

Loading large textures can cause a single-frame spike when the GPU uploads the texture. To spread this cost:

```typescript
async function loadTexturesChunked(
  urls: string[],
  loader: THREE.TextureLoader,
  renderer: THREE.WebGLRenderer,
  chunkSize: number = 2
): Promise<THREE.Texture[]> {
  const textures: THREE.Texture[] = [];

  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    const loaded = await Promise.all(
      chunk.map((url) => loader.loadAsync(url))
    );

    // Force GPU upload now (during controlled loading, not during gameplay)
    for (const tex of loaded) {
      renderer.initTexture(tex);
    }

    textures.push(...loaded);

    // Yield to the browser to prevent blocking the main thread
    await new Promise((r) => setTimeout(r, 0));
  }

  return textures;
}
```

**`renderer.initTexture(tex)`** forces the texture to be uploaded to the GPU immediately. Without this, the upload happens lazily on first render, which can cause a frame spike.

### Pattern 4: Asset Manifest Per Room

Define each room's asset dependencies in a manifest for clean preloading:

```typescript
interface RoomAssetManifest {
  roomId: number;
  textures: string[];
  models: string[];
  sprites: string[];
  luts: string[];
}

const ROOM_MANIFESTS: RoomAssetManifest[] = [
  {
    roomId: 1, // Iron Throne Room
    textures: [
      'textures/stone-floor-polished.ktx2',
      'textures/stone-wall-castle.ktx2',
      'textures/stained-glass.ktx2',
    ],
    models: [
      'models/iron-throne.glb',
      'models/stone-column.glb',
      'models/torch-sconce.glb',
    ],
    sprites: [
      'sprites/kingsguard-idle.png',
      'sprites/noble-idle.png',
    ],
    luts: [
      'luts/warm-gold.cube',
    ],
  },
  // ... other rooms
];
```

### Texture Compression: KTX2

For faster loading and lower GPU memory, compress textures to KTX2 format (ETC1S or UASTC basis):

```typescript
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const ktx2Loader = new KTX2Loader()
  .setTranscoderPath('libs/basis/') // Path to basis_transcoder.wasm
  .detectSupport(renderer);

// KTX2 textures are ~4-6x smaller than PNG, load faster, use less GPU memory
const texture = await ktx2Loader.loadAsync('textures/stone-wall.ktx2');
texture.minFilter = THREE.NearestFilter; // For pixel art
texture.magFilter = THREE.NearestFilter;
```

**Build pipeline:** Use `gltf-transform` or `basisu` CLI to convert PNG textures to KTX2 during the build step.

---

## 6. Game Loop Architecture

### The Becsy Integration Challenge

Becsy's `world.execute()` is async (returns a Promise). This means the game loop must handle the await while still producing smooth animation via `requestAnimationFrame`.

### Recommended Pattern: Async rAF with Becsy

```typescript
class GameLoop {
  private world: World;
  private running = false;
  private lastTime = 0;

  constructor(world: World) {
    this.world = world;
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    this.running = false;
  }

  private async tick(time: number): Promise<void> {
    if (!this.running) return;

    // Schedule next frame FIRST (ensures consistent rAF cadence)
    requestAnimationFrame((t) => this.tick(t));

    // Calculate delta time in seconds
    const delta = Math.min((time - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = time;

    // Execute all ECS systems for this frame
    // Becsy distributes delta to systems via this.delta
    await this.world.execute(delta);
  }
}
```

**Important:** Schedule the next `requestAnimationFrame` BEFORE awaiting `world.execute()`. If the ECS execution takes longer than a frame, you still want the browser to call you on the next vsync. The await will resolve before or during the next frame.

### Fixed Timestep vs. Variable Timestep

| Aspect | Variable Timestep | Fixed Timestep |
|---|---|---|
| **Simplicity** | Simpler (multiply by delta) | More complex (accumulator loop) |
| **Determinism** | Non-deterministic | Deterministic |
| **Physics** | Can be unstable at low FPS | Stable regardless of FPS |
| **Networking/Replay** | Difficult | Easy |
| **Rendering smoothness** | Smooth by default | Requires interpolation |

**For this MVP (no physics, no networking):** Variable timestep is fine. The player moves with `position += speed * delta`, camera lerps by `t = 1 - Math.pow(1 - smoothing, delta * 60)`, and particle systems update with delta. There is no physics simulation that requires determinism.

**If you add physics later:** Switch to fixed timestep with interpolation:

```typescript
class FixedTimestepLoop {
  private readonly FIXED_DT = 1 / 60; // 60 Hz simulation
  private readonly MAX_SUBSTEPS = 5;   // Prevent spiral of death
  private accumulator = 0;
  private previousState: Map<number, Transform> = new Map();
  private currentState: Map<number, Transform> = new Map();

  async tick(time: number): Promise<void> {
    requestAnimationFrame((t) => this.tick(t));

    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= this.FIXED_DT && steps < this.MAX_SUBSTEPS) {
      // Save previous state for interpolation
      this.savePreviousState();

      // Run game logic at fixed timestep
      await this.world.execute(this.FIXED_DT);

      this.accumulator -= this.FIXED_DT;
      steps++;
    }

    // Interpolation factor: how far between previous and current state
    const alpha = this.accumulator / this.FIXED_DT;

    // Interpolate visual positions for smooth rendering
    this.interpolateRenderState(alpha);

    // Render (Three.js render system runs separately)
    this.composer.render();
  }

  private interpolateRenderState(alpha: number): void {
    // For each entity with Transform + Object3DRef:
    // object3d.position = lerp(previousTransform.position, currentTransform.position, alpha)
  }
}
```

**Key concepts:**
- **Accumulator:** Collects real elapsed time. Fixed-step updates consume `FIXED_DT` from the accumulator.
- **MAX_SUBSTEPS:** Prevents the "spiral of death" where the simulation falls behind and tries to catch up with more and more substeps, which takes more time, making it fall further behind.
- **Alpha/Interpolation:** The leftover time in the accumulator (0 to FIXED_DT) is the fraction between the last two simulation states. Interpolating visual positions by this fraction produces smooth rendering even when the simulation rate differs from the display refresh rate.

### Frame Budget Management

At 60fps, each frame has a budget of **16.67ms**. Here is how to distribute it:

```
┌─────────────────────────────────────────────────────┐
│ 16.67ms frame budget                                │
├─────────┬──────────┬───────────┬───────────┬────────┤
│ Input   │ ECS      │ Transform │ GPU       │ Idle   │
│ 0.1ms   │ Logic    │ Sync      │ Render    │        │
│         │ 1-3ms    │ 0.2ms     │ 8-14ms    │        │
└─────────┴──────────┴───────────┴───────────┴────────┘
```

**Monitoring:**

```typescript
// Simple frame time monitor
class FrameTimer {
  private times: number[] = [];
  private readonly SAMPLE_SIZE = 60;

  measure(fn: () => void): number {
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    this.times.push(elapsed);
    if (this.times.length > this.SAMPLE_SIZE) this.times.shift();
    return elapsed;
  }

  get average(): number {
    return this.times.reduce((a, b) => a + b, 0) / this.times.length;
  }

  get fps(): number {
    return 1000 / this.average;
  }

  // Check if we're in danger of missing frames
  get isOverBudget(): boolean {
    return this.average > 16;
  }
}
```

**Dynamic quality scaling:** If frame times consistently exceed budget, disable the most expensive optional effects:

```typescript
function adjustQuality(frameTimer: FrameTimer, effects: {
  godrays: GodraysPass;
  n8ao: N8AOPass;
  bloom: BloomEffect;
  tiltShift: TiltShiftEffect;
}): void {
  const avg = frameTimer.average;

  if (avg > 18) {
    // First: disable god rays (most expensive optional effect)
    effects.godrays.enabled = false;
  }
  if (avg > 20) {
    // Second: reduce SSAO quality
    effects.n8ao.configuration.halfRes = true;
    effects.n8ao.configuration.aoSamples = 8;
  }
  if (avg > 22) {
    // Third: disable tilt-shift (saves a full pass)
    effects.tiltShift.blendMode.opacity.value = 0;
  }
  // Re-enable if we have headroom
  if (avg < 12) {
    effects.godrays.enabled = true;
    effects.n8ao.configuration.halfRes = false;
  }
}
```

### Becsy Coroutines for Multi-Frame Operations

Room transitions are inherently multi-frame (fade out, load, fade in). Instead of tracking state machine variables in components, use Becsy coroutines:

```typescript
import { system, System, co } from '@lastolivegames/becsy';

@system class RoomTransitionSystem extends System {
  // ... queries ...

  @co *transitionToRoom(targetRoomId: number, spawnPoint: Vector3) {
    // Frame 1-30: Fade out (0.5 seconds at 60fps)
    for (let i = 0; i < 30; i++) {
      this.fadeOverlay.opacity = i / 30;
      yield; // Yield to next frame
    }

    // Frame 31: Unload current room, load new room
    this.roomManager.unloadCurrent();
    yield; // Let disposal happen

    yield* this.waitForRoomLoad(targetRoomId); // May take multiple frames

    this.roomManager.activateRoom(targetRoomId);
    this.movePlayerToSpawn(spawnPoint);

    // Frame N to N+30: Fade in
    for (let i = 30; i >= 0; i--) {
      this.fadeOverlay.opacity = i / 30;
      yield;
    }
  }

  @co *waitForRoomLoad(roomId: number) {
    this.roomManager.startLoading(roomId);
    while (!this.roomManager.isLoaded(roomId)) {
      yield; // Wait for loading to complete
    }
  }
}
```

Coroutines maintain their own call stack across frames, making sequential multi-frame operations read like synchronous code. This is far cleaner than maintaining state machine flags in components.

---

## 7. Sources

### Room/Scene Management
- [Three.js Cleanup Guide](https://threejsfundamentals.org/threejs/lessons/threejs-cleanup.html)
- [When to dispose: How to completely clean up a Three.js scene (Three.js Forum)](https://discourse.threejs.org/t/when-to-dispose-how-to-completely-clean-up-a-three-js-scene/1549)
- [Tips on preventing memory leak in Three.js scene (Roger Chi)](https://roger-chi.vercel.app/blog/tips-on-preventing-memory-leak-in-threejs-scene)
- [Dispose things correctly in Three.js (Three.js Forum)](https://discourse.threejs.org/t/dispose-things-correctly-in-three-js/6534)
- [three.gf Game Framework (GitHub)](https://github.com/freddykrunn/three.gf)
- [Three.js Game Engine (Three.js Forum)](https://discourse.threejs.org/t/three-js-game-engine-three-game-engine/88758)

### ECS + Three.js Sync
- [ECS Three.js Interop (Meta IWSDK)](https://developers.meta.com/horizon/documentation/web/iwsdk-concept-three-basics-interop/)
- [Simplifying React Three Fiber with ECS (douges.dev)](https://douges.dev/blog/simplifying-r3f-with-ecs)
- [Optimizing Three.js with ECSY (Three.js Forum)](https://discourse.threejs.org/t/optimizing-three-js-with-ecsy-best-practices-and-challenges/76240)
- [Becsy Documentation — Systems](https://lastolivegames.github.io/becsy/guide/architecture/systems)
- [Becsy Documentation — Overview](https://lastolivegames.github.io/becsy/guide/architecture/overview)
- [bitECS Three.js PoC (GitHub)](https://github.com/NateTheGreatt/bitECS-threejs-poc)
- [Miniplex ECS (GitHub)](https://github.com/hmans/miniplex)
- [ECS Architecture — Web Game Dev](https://www.webgamedev.com/code-architecture/ecs)

### Post-Processing Performance
- [pmndrs/postprocessing (GitHub)](https://github.com/pmndrs/postprocessing)
- [Effect Merging (pmndrs Wiki)](https://github.com/pmndrs/postprocessing/wiki/Effect-Merging)
- [Custom Effects (pmndrs Wiki)](https://github.com/pmndrs/postprocessing/wiki/Custom-Effects)
- [Building Efficient Three.js Scenes (Codrops, 2025)](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)
- [Post-processing Performance (Three.js Forum)](https://discourse.threejs.org/t/postprocessing-performance/35776)
- [Post-processing with Three.js (sangillee.com, 2025)](https://sangillee.com/2025-01-15-post-processing/)
- [Three.js + WebGPU Post-Processing (Three.js Forum)](https://discourse.threejs.org/t/three-js-webgpu-post-processing-effects/87390)
- [Field Guide to TSL and WebGPU (Maxime Heckel)](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)
- [Three.js Shading Language (TSL) Wiki](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [Render Pipeline Redesign (pmndrs Issue #419)](https://github.com/pmndrs/postprocessing/issues/419)

### Pixel Art in 3D / HD-2D
- [HD-2D (Wikipedia)](https://en.wikipedia.org/wiki/HD-2D)
- [Octopath Traveler II HD-2D Style (Unreal Engine)](https://www.unrealengine.com/en-US/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style)
- [Spritesheet Animation with Aseprite and Three.js (fundamental.sh)](https://fundamental.sh/p/sprite-sheet-animation-aseprite-react-threejs)
- [Crisp Pixel Art with image-rendering (MDN)](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look)
- [3D Pixel Art Rendering (David Holland)](https://www.davidhol.land/articles/3d-pixel-art-rendering/)
- [Pixel-Perfect Orthographic Camera (Three.js Forum)](https://discourse.threejs.org/t/pixelperfect-orthographic-camera-with-blocks-for-a-pixelart-2d-look/46637)
- [Three.js Pixelated Lo-Fi (Medium)](https://eriksachse.medium.com/three-js-pixelated-lo-fi-energy-look-298b8dc3eaad)
- [polygonOffset for Z-Fighting (Three.js Forum)](https://discourse.threejs.org/t/shapes-z-order-renderorder-polygonoffset/7970)
- [Depth Sorting with Sprites (Three.js Forum)](https://discourse.threejs.org/t/compound-of-sprites-without-depth-sorting/5234)

### Asset Preloading
- [Best Practices for Loading Assets in Three.js (MoldStud)](https://moldstud.com/articles/p-best-practices-for-loading-assets-in-threejs)
- [Preloading Screen in Three.js Application (Medium)](https://medium.com/javascript-alliance/optimizing-user-experience-preloading-screen-in-our-three-js-application-d29f9c81f29c)
- [Preload/prefetch in examples (Three.js Issue #19336)](https://github.com/mrdoob/three.js/issues/19336)
- [Non-blocking asset loaders (Three.js Issue #11746)](https://github.com/mrdoob/three.js/issues/11746)
- [requestIdleCallback Spec (W3C)](https://w3c.github.io/requestidlecallback/)
- [GLTFLoader Documentation (Three.js)](https://threejs.org/docs/pages/GLTFLoader.html)
- [@asset-manager/three (npm)](https://www.npmjs.com/package/@asset-manager/three)

### Game Loop Architecture
- [Fix Your Timestep! (Gaffer on Games)](https://gafferongames.com/post/fix_your_timestep/)
- [JS Game Loop: Fixed time-step, variable rendering (GitHub Gist)](https://gist.github.com/godwhoa/e6225ae99853aac1f633)
- [The Animation Loop (Discover Three.js)](https://discoverthreejs.com/book/first-steps/animation-loop/)
- [Becsy — Simple Moving Box Example](https://lastolivegames.github.io/becsy/guide/examples/simple)
- [Becsy — World Documentation](https://lastolivegames.github.io/becsy/guide/architecture/world)
- [Game Design Patterns (Generalist Programmer)](https://generalistprogrammer.com/game-design-patterns)
- [Meep Game Engine with Three.js (Three.js Forum)](https://discourse.threejs.org/t/meep-a-game-engine/10098)
- [TypeScript ECS Game: From 20 NPCs to 10,000](https://www.josephodowd.com/blog/8)

# Three.js Rendering Fixes

## Fix 1: Particle Size Scaling

### Root Cause
Particles (dust motes and torch embers) were rendering at excessively large sizes relative to the scene scale. The point size calculation used a scale factor (300.0) that was too aggressive, combined with oversized particle size values. This resulted in particles appearing disproportionately large and obscuring scene visibility.

### Solution
Reduced the vertex shader point size scale factor and decreased particle base sizes and alpha ranges proportionally across all particle systems.

#### dust-motes.ts

**Before:**
```glsl
// Vertex shader
gl_PointSize = aSize * (300.0 / -mvPosition.z);
```

```typescript
// Particle generation
const size = 2.0 + Math.random() * 2.0;  // 2.0 to 4.0
const alpha = 0.2 + Math.random() * 0.4; // 0.2 to 0.6
```

**After:**
```glsl
// Vertex shader
gl_PointSize = aSize * (80.0 / -mvPosition.z);
```

```typescript
// Particle generation
const size = 0.4 + Math.random() * 0.6;  // 0.4 to 1.0
const alpha = 0.08 + Math.random() * 0.15; // 0.08 to 0.23
```

#### torch-embers.ts

**Before:**
```glsl
// Vertex shader
gl_PointSize = aSize * (300.0 / -mvPosition.z);
```

```typescript
// Particle generation
const size = 1.5 + Math.random() * 2.0;  // 1.5 to 3.5
```

**After:**
```glsl
// Vertex shader
gl_PointSize = aSize * (80.0 / -mvPosition.z);
```

```typescript
// Particle generation
const size = 0.3 + Math.random() * 0.5;  // 0.3 to 0.8
```

### Impact
- Particle systems now render at appropriate scale relative to environment
- Improved visibility of background elements
- More subtle, atmospheric particle effects
- Consistent scaling applied across all particle types

---

## Fix 2: Room Lighting Intensity

### Root Cause
Lighting across all 10 rooms was insufficiently bright, resulting in scenes that were too dark and lacked sufficient illumination for proper visibility and atmospheric design. Ambient light intensity (0.08-0.25) and point/directional light intensities were too conservative, failing to create the intended mood hierarchy while maintaining playability.

### Solution
Systematically increased ambient, point, and directional light intensities across all rooms while maintaining the intended mood hierarchy. Preserved brightest ambiance for grand spaces (throne room, gallery, ballroom) and moodier but still visible lighting for darker rooms (guard post, Maegor's holdfast, stairwell).

#### Ambient Light

**Before:**
```typescript
// Dark rooms (guard post, Maegor's holdfast, stairwell)
ambientLight = new THREE.AmbientLight(0x1A1A2E, 0.08);

// Medium rooms (library, sept, dungeon)
ambientLight = new THREE.AmbientLight(0x1A2A3E, 0.15);

// Grand rooms (throne room, gallery, ballroom)
ambientLight = new THREE.AmbientLight(0x2A3A4E, 0.25);
```

**After:**
```typescript
// Dark rooms (guard post, Maegor's holdfast, stairwell)
ambientLight = new THREE.AmbientLight(0x2A2A3E, 0.3);

// Medium rooms (library, sept, dungeon)
ambientLight = new THREE.AmbientLight(0x2A3A4E, 0.5);

// Grand rooms (throne room, gallery, ballroom)
ambientLight = new THREE.AmbientLight(0x3A4A5E, 0.7);
```

#### Point Lights

**Before:**
```typescript
// Typical configuration across rooms
pointLight = new THREE.PointLight(color, 0.8 - 2.5, 6 - 15);
//                                        ^^^^^^^^  ^^^^^^
//                                    intensity   distance
```

**After:**
```typescript
// Typical configuration across rooms
pointLight = new THREE.PointLight(color, 2.0 - 5.0, 10 - 25);
//                                        ^^^^^^^^^^  ^^^^^^^
//                                       intensity  distance
```

#### Directional Lights

**Before:**
```typescript
directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.0 - 1.8);
```

**After:**
```typescript
directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.8 - 2.5);
```

### Mood Hierarchy Preservation

The lighting adjustments maintain the intended visual hierarchy:

| Room Type | Visual Intention | Ambient Intensity | Point Light Intensity |
|-----------|------------------|-------------------|-----------------------|
| Grand (Throne, Gallery, Ballroom) | Bright, majestic | 0.7 | 4.5-5.0 |
| Medium (Library, Sept) | Well-lit, welcoming | 0.5 | 3.0-4.0 |
| Dark (Guard Post, Stairwell, Maegor's) | Moody but visible | 0.3 | 2.0-3.0 |

### Ambient Color Adjustments

Colors were subtly lightened to support increased brightness while maintaining atmosphere:

**Examples:**
- Dark rooms: `0x1A1A2E` → `0x2A2A3E` (slightly brighter purplish tone)
- Medium rooms: `0x1A2A3E` → `0x2A3A4E` (warmer, lighter blue)
- Grand rooms: `0x2A3A4E` → `0x3A4A5E` (elevated brightness maintaining cool tone)

### Impact
- Significantly improved scene visibility while maintaining atmospheric mood
- Grand rooms now feel appropriately majestic and luminous
- Dark rooms remain moody without sacrificing visibility
- Point light falloff (distance increase 6-15 → 10-25) creates more natural light spread
- Overall scene becomes more playable and visually appealing

---

## Summary

Both fixes address fundamental rendering quality issues:

1. **Particle Size** — Corrects scale calculation and particle dimensions for more appropriate atmospheric effects
2. **Room Lighting** — Increases ambient, point, and directional light intensities while preserving mood hierarchy

These changes work together to improve the overall visual presentation of the 3D scene, creating a more balanced, visible, and immersive environment.

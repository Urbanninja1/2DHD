# Three.js HD-2D Visual Effects — Research Findings

**Date:** 2026-02-05
**Purpose:** Technical research for implementing HD-2D visual effects (Octopath Traveler / Dragon Quest 3 Remake style) in Three.js.

---

## Table of Contents

1. [Post-Processing Pipeline](#1-post-processing-pipeline)
2. [Camera Setup](#2-camera-setup)
3. [2D Sprites in 3D Scenes](#3-2d-sprites-in-3d-scenes)
4. [Lighting](#4-lighting)
5. [Particle Systems](#5-particle-systems)
6. [Recommended Libraries](#6-recommended-libraries)
7. [Sources](#7-sources)

---

## 1. Post-Processing Pipeline

### Library Choice: pmndrs/postprocessing vs Three.js Built-in

There are two options for post-processing in Three.js:

| Library | Pros | Cons |
|---------|------|------|
| **Three.js built-in** (`three/addons/postprocessing/`) | Ships with Three.js, no extra dependency | Each pass = separate draw call, less efficient |
| **pmndrs/postprocessing** (`postprocessing` npm) | Auto-merges effects into fewer passes, better performance, richer effect library | Extra dependency |

**Recommendation:** Use **pmndrs/postprocessing** for the HD-2D pipeline. It automatically merges multiple effects into a single EffectPass, minimizing render operations. This matters when stacking 5+ effects (DoF, bloom, vignette, color grading, SSAO).

### EffectComposer Setup (pmndrs/postprocessing)

```javascript
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  TiltShiftEffect,
  LUT3DEffect,
} from 'postprocessing';
import { HalfFloatType } from 'three';

// Use HalfFloatType for precision (important for SSAO and DoF)
const composer = new EffectComposer(renderer, {
  frameBufferType: HalfFloatType,
});

// 1. RenderPass always comes first
composer.addPass(new RenderPass(scene, camera));

// 2. Add effects via EffectPass (auto-merged for performance)
composer.addPass(new EffectPass(
  camera,
  new BloomEffect({ /* ... */ }),
  new VignetteEffect({ /* ... */ }),
  // ... more effects
));

// In the animation loop, replace renderer.render() with:
composer.render();
```

### 1A. Tilt-Shift Depth of Field (Diorama Effect)

This is the **signature** HD-2D effect. It creates a sharp focus band (where the player is) with blur above and below, making the scene look like a miniature diorama.

#### Option A: Built-in Three.js Tilt-Shift Shaders (simpler, less control)

Three.js ships with `HorizontalTiltShiftShader` and `VerticalTiltShiftShader`. They create a separable Gaussian blur modulated by vertical position:

```javascript
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

const hTiltPass = new ShaderPass(HorizontalTiltShiftShader);
hTiltPass.uniforms.h.value = 4 / window.innerHeight;  // blur amount
hTiltPass.uniforms.r.value = 0.5;  // focus position (0-1, 0.5 = center)

const vTiltPass = new ShaderPass(VerticalTiltShiftShader);
vTiltPass.uniforms.v.value = 4 / window.innerWidth;
vTiltPass.uniforms.r.value = 0.5;

composer.addPass(hTiltPass);
composer.addPass(vTiltPass);
```

**Uniforms:**
- `h` / `v` — blur intensity (scale by 1/resolution)
- `r` — focus position along the axis (0.0 to 1.0, default 0.5 = center of screen)

#### Option B: BokehPass (depth-buffer-based DoF, more realistic)

Uses the actual depth buffer for distance-based blur:

```javascript
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

const bokehPass = new BokehPass(scene, camera, {
  focus: 10.0,     // focal distance in world units
  aperture: 0.002, // lens aperture (smaller = more blur range)
  maxblur: 0.01,   // maximum blur amount
});

// Runtime adjustment:
bokehPass.uniforms.focus.value = 12.0;
bokehPass.uniforms.aperture.value = 0.003;
```

#### Option C: pmndrs TiltShiftEffect (recommended for HD-2D)

The pmndrs library has a dedicated TiltShiftEffect that combines the diorama look with proper bokeh quality:

```javascript
import { TiltShiftEffect } from 'postprocessing';

const tiltShift = new TiltShiftEffect({
  focusArea: 0.4,   // size of the sharp focus band (0-1)
  feather: 0.3,     // how gradually blur transitions in
  offset: 0.0,      // vertical offset of the focus band
  kernelSize: 3,    // blur quality
});
```

**For HD-2D:** Use a `focusArea` of approximately 0.3-0.5 and a `feather` of 0.2-0.4 to get the characteristic Octopath Traveler diorama feel. The focus band should cover the player character's vertical screen position.

#### Option D: Custom Depth-Based Tilt-Shift (maximum control)

For the most authentic HD-2D look, use a custom shader that reads the depth buffer and applies blur based on distance from a focal plane:

```glsl
// Fragment shader concept for depth-based tilt-shift
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float focusDistance;   // world-space focal distance
uniform float focusRange;      // depth range that stays sharp
uniform float maxBlur;
uniform float cameraNear;
uniform float cameraFar;

float linearizeDepth(float d) {
  return cameraNear * cameraFar / (cameraFar - d * (cameraFar - cameraNear));
}

void main() {
  float depth = linearizeDepth(texture2D(tDepth, vUv).r);
  float blur = smoothstep(0.0, 1.0,
    abs(depth - focusDistance) / focusRange) * maxBlur;
  // Apply blur kernel scaled by 'blur' ...
}
```

### 1B. Bloom

Bloom adds a soft glow around bright areas (torch fire, sunbeams through windows, magical effects).

#### Three.js Built-in: UnrealBloomPass

```javascript
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8,   // strength — overall bloom intensity
  0.4,   // radius — how far the glow spreads (0-1)
  0.85   // threshold — luminance cutoff (only pixels brighter than this bloom)
);
composer.addPass(bloomPass);
```

**HD-2D tuning:**
- `threshold: 0.7-0.9` — only the brightest light sources should bloom
- `strength: 0.5-1.2` — subtle warmth, not overwhelming
- `radius: 0.3-0.6` — medium spread for soft glow

#### Selective Bloom (bloom only specific objects)

Critical for HD-2D where you want torches and windows to glow but not every surface:

```javascript
// Setup: two EffectComposers
const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);
const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const materials = {};

// Mark objects that should bloom
torchFlame.layers.enable(BLOOM_LAYER);
windowLight.layers.enable(BLOOM_LAYER);

// Bloom composer (renders only bloom objects)
const bloomComposer = new EffectComposer(renderer);
bloomComposer.addPass(new RenderPass(scene, camera));
bloomComposer.addPass(bloomPass);
bloomComposer.renderToScreen = false;

// Final composer (combines scene + bloom)
const mixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: /* passthrough vertex shader */,
    fragmentShader: `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
      }
    `,
  }),
  'baseTexture'
);

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(scene, camera));
finalComposer.addPass(mixPass);
finalComposer.addPass(new OutputPass());

// Render loop: darken non-bloom objects, render bloom, restore, render final
function animate() {
  scene.traverse(obj => {
    if (obj.isMesh && !bloomLayer.test(obj.layers)) {
      materials[obj.uuid] = obj.material;
      obj.material = darkMaterial;
    }
  });
  bloomComposer.render();
  scene.traverse(obj => {
    if (materials[obj.uuid]) {
      obj.material = materials[obj.uuid];
      delete materials[obj.uuid];
    }
  });
  finalComposer.render();
}
```

#### pmndrs BloomEffect (simpler selective bloom)

```javascript
import { BloomEffect, SelectiveBloomEffect, Selection } from 'postprocessing';

// Simple bloom (everything)
const bloom = new BloomEffect({
  intensity: 1.0,
  luminanceThreshold: 0.8,
  luminanceSmoothing: 0.075,
  mipmapBlur: true,
});

// OR selective bloom (only specific objects)
const selection = new Selection();
selection.add(torchFlame);
selection.add(windowGlow);

const selectiveBloom = new SelectiveBloomEffect(scene, camera, {
  intensity: 1.5,
  luminanceThreshold: 0.4,
});
selectiveBloom.selection = selection;
```

### 1C. Vignette

Subtle darkening at screen edges. Draws focus inward.

```javascript
import { VignetteEffect } from 'postprocessing';

const vignette = new VignetteEffect({
  offset: 0.3,    // how far from center before darkening begins
  darkness: 0.7,  // how dark the edges get
});
```

**HD-2D tuning:** Keep it subtle. `offset: 0.25-0.4`, `darkness: 0.5-0.8`. Too much looks like a filter, too little is invisible.

Using Three.js built-in:

```javascript
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms.offset.value = 0.95;
vignettePass.uniforms.darkness.value = 1.2;
```

### 1D. Color Grading / LUT

Per-room color palettes are essential for HD-2D atmosphere. The Throne Room should feel golden and warm; the Tower Stairwell should feel cold and blue.

#### Approach 1: 3D LUT Files (.cube)

Create LUTs in Photoshop/DaVinci Resolve, export as .cube files, load and apply.

```javascript
// Using Three.js built-in LUTPass
import { LUTPass } from 'three/addons/postprocessing/LUTPass.js';
import { LUTCubeLoader } from 'three/addons/loaders/LUTCubeLoader.js';

const lutLoader = new LUTCubeLoader();
const lutTexture = await lutLoader.loadAsync('luts/throne-room-warm.cube');

const lutPass = new LUTPass({
  lut: lutTexture.texture3D,  // use texture3D for WebGL2
  intensity: 1.0,             // 0=no effect, 1=full LUT
});
composer.addPass(lutPass);

// Switch LUT when changing rooms:
function onRoomChange(roomName) {
  const lut = await lutLoader.loadAsync(`luts/${roomName}.cube`);
  lutPass.lut = lut.texture3D;
}
```

#### Approach 2: pmndrs LUT3DEffect

```javascript
import { LUT3DEffect } from 'postprocessing';
import { LUTCubeLoader } from 'three/addons/loaders/LUTCubeLoader.js';

const lutData = await new LUTCubeLoader().loadAsync('luts/warm-gold.cube');
const lutEffect = new LUT3DEffect(lutData.texture3D);
// Add to EffectPass alongside other effects
```

#### Approach 3: Shader-Based Color Grading (no external files)

For simpler per-room adjustments without LUT files:

```javascript
import { BrightnessContrastEffect, HueSaturationEffect } from 'postprocessing';

// Per-room presets
const roomPresets = {
  throneRoom:    { hue: 0.05, saturation: 0.2,  brightness: 0.05, contrast: 0.1 },
  stairwell:     { hue: -0.1, saturation: -0.1, brightness: -0.1, contrast: 0.15 },
  battlements:   { hue: -0.15, saturation: 0.1, brightness: 0.1,  contrast: 0.05 },
  smallCouncil:  { hue: 0.08, saturation: 0.15, brightness: -0.05, contrast: 0.08 },
};

const hueSat = new HueSaturationEffect();
const brightContrast = new BrightnessContrastEffect();

function applyRoomGrading(roomName) {
  const preset = roomPresets[roomName];
  hueSat.hue = preset.hue;
  hueSat.saturation = preset.saturation;
  brightContrast.brightness = preset.brightness;
  brightContrast.contrast = preset.contrast;
}
```

#### Tone Mapping (global)

```javascript
renderer.toneMapping = THREE.ACESFilmicToneMapping;  // cinematic response curve
renderer.toneMappingExposure = 1.0;                   // adjust per room
```

**HD-2D tuning:** ACES filmic tone mapping gives a cinematic look. Adjust `toneMappingExposure` per room (0.6 for dark dungeons, 1.2 for sunlit halls).

### 1E. SSAO (Ambient Occlusion)

Deepens shadows in corners, under furniture, around columns. Essential for making 3D environments feel grounded and detailed.

#### Option A: Built-in SSAOPass

```javascript
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

const ssaoPass = new SSAOPass(scene, camera, width, height);
ssaoPass.kernelRadius = 8;     // how wide the AO samples spread
ssaoPass.minDistance = 0.005;   // minimum depth difference for AO
ssaoPass.maxDistance = 0.1;     // maximum depth difference for AO
ssaoPass.output = SSAOPass.OUTPUT.Default;

composer.addPass(ssaoPass);
```

#### Option B: N8AO (recommended, better quality and performance)

N8AO is a newer SSAO implementation that is faster, has better temporal stability, and more artist-friendly controls:

```javascript
import { N8AOPass } from 'n8ao';

const composer = new EffectComposer(renderer);

// N8AOPass replaces RenderPass (it renders the scene internally)
const n8aoPass = new N8AOPass(scene, camera, width, height);

// Key parameters:
n8aoPass.configuration.aoRadius = 2.0;         // world-space AO spread
n8aoPass.configuration.distanceFalloff = 1.0;   // how quickly AO fades
n8aoPass.configuration.intensity = 3.0;          // artistic intensity multiplier
n8aoPass.configuration.color = new THREE.Color(0, 0, 0);  // AO tint

// Performance: half-resolution mode (2-4x faster, slight quality loss)
n8aoPass.configuration.halfRes = true;

// Quality tuning (set once, triggers shader recompile):
n8aoPass.configuration.aoSamples = 16;
n8aoPass.configuration.denoiseSamples = 8;
n8aoPass.configuration.denoiseRadius = 12;

// Disable built-in gamma correction if another pass handles it
n8aoPass.configuration.gammaCorrection = false;

composer.addPass(n8aoPass);
```

**HD-2D tuning:**
- `aoRadius`: Keep 1-2 magnitudes smaller than scene scale (e.g., 0.5-2.0 for a ~20 unit room)
- `intensity`: 2.0-4.0 for subtle-to-pronounced contact shadows
- `halfRes: true` for acceptable performance with the full effect stack

### Complete Pipeline Order

The recommended ordering for the HD-2D post-processing chain:

```javascript
const composer = new EffectComposer(renderer, {
  frameBufferType: HalfFloatType,
});

// 1. Scene render (or N8AOPass which includes scene render)
const n8aoPass = new N8AOPass(scene, camera, w, h);
composer.addPass(n8aoPass);

// 2. Bloom (before color grading so bloom colors are natural)
const bloomEffect = new BloomEffect({
  intensity: 0.8,
  luminanceThreshold: 0.8,
  luminanceSmoothing: 0.075,
  mipmapBlur: true,
});

// 3. Tilt-shift DoF
const tiltShift = new TiltShiftEffect({
  focusArea: 0.4,
  feather: 0.3,
});

// 4. Color grading (after bloom, before vignette)
const lutEffect = new LUT3DEffect(lutTexture);

// 5. Vignette (last artistic effect)
const vignette = new VignetteEffect({
  offset: 0.3,
  darkness: 0.6,
});

// Merge effects into minimal passes
composer.addPass(new EffectPass(camera, bloomEffect, tiltShift));
composer.addPass(new EffectPass(camera, lutEffect, vignette));
```

---

## 2. Camera Setup

### The HD-2D Camera Angle

HD-2D games use a **3/4 overhead angle** — not true isometric, but a tilted perspective that looks down at approximately 30-45 degrees. The key is that it uses a **PerspectiveCamera** (not orthographic) to enable depth-of-field effects, but with a relatively narrow field of view to reduce perspective distortion.

#### Basic Setup

```javascript
// PerspectiveCamera with narrow FoV for near-orthographic look
const camera = new THREE.PerspectiveCamera(
  35,                                         // narrow FoV (30-40 for HD-2D)
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Position: elevated, looking down at ~30-35 degree angle
const cameraHeight = 15;
const cameraDistance = 20;  // distance behind/above the player

// Place camera using spherical coordinates
// theta = 0 means looking from the south; adjust for desired viewing angle
const theta = 0;  // rotation around Y axis
const phi = Math.PI / 5;  // ~36 degrees from vertical (54 degrees from horizontal)

camera.position.set(
  Math.sin(theta) * cameraDistance,
  cameraHeight,
  Math.cos(theta) * cameraDistance
);
camera.lookAt(0, 0, 0);  // look at scene center / player position
```

#### Camera Following the Player

```javascript
const cameraOffset = new THREE.Vector3(0, 15, 20);  // relative to player
const cameraLookOffset = new THREE.Vector3(0, 0, 0); // look slightly ahead of player
const cameraSmoothing = 0.05;  // lower = smoother/laggier, higher = snappier

function updateCamera(playerPosition, delta) {
  const targetPosition = playerPosition.clone().add(cameraOffset);
  const targetLookAt = playerPosition.clone().add(cameraLookOffset);

  // Smooth interpolation (lerp)
  camera.position.lerp(targetPosition, cameraSmoothing);
  // Note: for lookAt, you may want to track a separate target object
}
```

#### True Isometric Setup (alternative)

If you want a stricter isometric look (less common in HD-2D but possible):

```javascript
// Isometric rotation: YXZ order, 45-degree rotation, specific X tilt
camera.rotation.order = 'YXZ';
camera.rotation.y = -Math.PI / 4;           // 45-degree Y rotation
camera.rotation.x = Math.atan(-1 / Math.sqrt(2));  // ~35.26 degrees (true isometric)

// OrthographicCamera for no perspective distortion
const d = 20;  // frustum half-size
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -d * aspect, d * aspect, d, -d, 1, 2000
);
camera.position.set(10, 10, 10);
camera.lookAt(scene.position);
```

**Note:** OrthographicCamera does not work with BokehPass / depth-based DoF since it has no perspective depth gradient. Use PerspectiveCamera with narrow FoV for HD-2D.

#### Camera Snapping for Pixel Art

To prevent pixel "swimming" (sub-pixel jittering when the camera moves smoothly), snap the camera to a texel-aligned grid:

```javascript
function snapCameraToPixelGrid(camera, renderTargetHeight) {
  // Calculate the world-space size of one texel at the focus plane
  const frustumHeight = 2.0 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    * camera.position.distanceTo(focusTarget);
  const texelSize = frustumHeight / renderTargetHeight;

  // Snap camera position to texel grid
  camera.position.x = Math.round(camera.position.x / texelSize) * texelSize;
  camera.position.z = Math.round(camera.position.z / texelSize) * texelSize;
}
```

---

## 3. 2D Sprites in 3D Scenes

### Pixel Art Texture Setup

The most critical setting: use `NearestFilter` to prevent texture interpolation from blurring pixel art.

```javascript
const textureLoader = new THREE.TextureLoader();
const spriteTexture = textureLoader.load('sprites/knight-idle.png');

// CRITICAL: Nearest-neighbor filtering for crisp pixel art
spriteTexture.minFilter = THREE.NearestFilter;
spriteTexture.magFilter = THREE.NearestFilter;

// Prevent edge bleeding
spriteTexture.wrapS = THREE.ClampToEdgeWrapping;
spriteTexture.wrapT = THREE.ClampToEdgeWrapping;

// Ensure correct color space
spriteTexture.colorSpace = THREE.SRGBColorSpace;

// Disable mipmaps (not needed for nearest-filter pixel art)
spriteTexture.generateMipmaps = false;
```

### Billboard Approach 1: THREE.Sprite (auto-faces camera)

```javascript
const spriteMaterial = new THREE.SpriteMaterial({
  map: spriteTexture,
  transparent: true,
  alphaTest: 0.5,      // discard pixels below this alpha (prevents depth sorting issues)
  depthWrite: true,     // enable for proper depth sorting
  depthTest: true,
});

const sprite = new THREE.Sprite(spriteMaterial);
sprite.scale.set(2, 3, 1);  // width, height (in world units)
sprite.position.set(5, 1.5, 3);  // place in world (Y = half height to sit on ground)
scene.add(sprite);
```

**Drawback of THREE.Sprite:** It rotates to face the camera on all axes, which can look wrong when the camera is at a 3/4 angle (the sprite tilts backward). For HD-2D, you usually want sprites to only rotate around the Y axis.

### Billboard Approach 2: PlaneGeometry with Custom Billboarding (recommended)

```javascript
const spriteGeometry = new THREE.PlaneGeometry(2, 3);  // width, height in world units
const spriteMaterial = new THREE.MeshBasicMaterial({
  map: spriteTexture,
  transparent: true,
  alphaTest: 0.5,
  side: THREE.DoubleSide,
  depthWrite: true,
});

const spriteMesh = new THREE.Mesh(spriteGeometry, spriteMaterial);
spriteMesh.position.set(5, 1.5, 3);
scene.add(spriteMesh);

// Y-axis-only billboarding (in the animation loop):
function updateBillboard(spriteMesh, camera) {
  // Get camera direction projected onto XZ plane
  const cameraDir = new THREE.Vector3();
  camera.getWorldDirection(cameraDir);
  cameraDir.y = 0;  // ignore vertical component
  cameraDir.normalize();

  // Make sprite face opposite to camera direction
  spriteMesh.lookAt(
    spriteMesh.position.x - cameraDir.x,
    spriteMesh.position.y,  // keep Y fixed
    spriteMesh.position.z - cameraDir.z
  );
}
```

**Why PlaneGeometry over Sprite:** For a fixed 3/4 camera, you can skip billboarding entirely and just orient all sprite planes to face the camera direction once. This gives you full control and avoids the tilt issue.

### Spritesheet Animation

For animated characters with multiple frames in a single spritesheet:

```javascript
class SpriteAnimator {
  constructor(texture, framesX, framesY, totalFrames, fps) {
    this.texture = texture;
    this.framesX = framesX;  // columns in spritesheet
    this.framesY = framesY;  // rows in spritesheet
    this.totalFrames = totalFrames;
    this.frameTime = 1000 / fps;
    this.currentFrame = 0;
    this.elapsed = 0;

    // Set up texture tiling
    texture.repeat.set(1 / framesX, 1 / framesY);
    this.updateUV();
  }

  updateUV() {
    const col = this.currentFrame % this.framesX;
    const row = Math.floor(this.currentFrame / this.framesX);
    this.texture.offset.x = col / this.framesX;
    // UV Y is inverted (0 = bottom)
    this.texture.offset.y = 1 - (row + 1) / this.framesY;
  }

  update(deltaMs) {
    this.elapsed += deltaMs;
    if (this.elapsed >= this.frameTime) {
      this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
      this.updateUV();
      this.elapsed = 0;
    }
  }
}

// Usage:
const walkSheet = textureLoader.load('sprites/knight-walk-8dir.png');
walkSheet.minFilter = THREE.NearestFilter;
walkSheet.magFilter = THREE.NearestFilter;
walkSheet.generateMipmaps = false;

const animator = new SpriteAnimator(walkSheet, 4, 2, 8, 10);  // 4x2 grid, 8 frames, 10fps

// In animation loop:
animator.update(delta * 1000);
```

### Depth Sorting

Transparent sprites can cause depth-sorting issues. Strategies:

1. **`alphaTest: 0.5`** — Discard fully transparent pixels so they do not write to the depth buffer. This is the simplest fix and works for pixel art with hard edges.

2. **`depthWrite: false` + render order** — For semi-transparent sprites, disable depth writing and sort manually:
   ```javascript
   spriteMaterial.depthWrite = false;
   spriteMesh.renderOrder = calculateRenderOrder(spriteMesh.position);
   ```

3. **Sort by distance to camera:**
   ```javascript
   // Set renderer to sort transparent objects back-to-front
   renderer.sortObjects = true;
   // Three.js does this by default for transparent objects
   ```

4. **For a fixed camera angle:** Sort by world Z position (or Y, depending on your coordinate system):
   ```javascript
   function updateRenderOrder(sprites) {
     sprites.forEach(sprite => {
       // Higher Z = further from camera = render first
       sprite.renderOrder = -sprite.position.z * 100;
     });
   }
   ```

### Render Resolution for Pixel Art

To maintain pixel-art crispness while allowing 3D post-processing, consider rendering sprites to a low-resolution render target and compositing:

```javascript
// Low-res render target for pixel art sprites
const pixelScale = 4;  // each "pixel" is 4x4 screen pixels
const lowResTarget = new THREE.WebGLRenderTarget(
  window.innerWidth / pixelScale,
  window.innerHeight / pixelScale,
  {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  }
);
```

---

## 4. Lighting

### Dynamic Point Lights (Torches/Candles)

#### Basic Flickering Torch

```javascript
const torchLight = new THREE.PointLight(0xff6622, 2.0, 15);  // warm orange
torchLight.position.set(5, 3, 2);
torchLight.castShadow = true;
torchLight.shadow.mapSize.width = 512;
torchLight.shadow.mapSize.height = 512;
torchLight.shadow.camera.near = 0.1;
torchLight.shadow.camera.far = 15;
scene.add(torchLight);
```

#### Noise-Based Flicker (realistic)

```javascript
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

const simplex = new SimplexNoise();

class TorchFlicker {
  constructor(light, baseIntensity = 2.0, baseColor = new THREE.Color(0xff6622)) {
    this.light = light;
    this.baseIntensity = baseIntensity;
    this.baseColor = baseColor;
    this.time = Math.random() * 1000;  // random start offset
  }

  update(delta) {
    this.time += delta;

    // Layer multiple noise frequencies for natural flicker
    const flicker1 = simplex.noise(this.time * 3.0, 0) * 0.3;   // slow wave
    const flicker2 = simplex.noise(this.time * 8.0, 1) * 0.15;  // medium flutter
    const flicker3 = simplex.noise(this.time * 15.0, 2) * 0.08; // fast crackle

    const intensityMod = 1.0 + flicker1 + flicker2 + flicker3;
    this.light.intensity = this.baseIntensity * Math.max(0.3, intensityMod);

    // Subtle color shift (warmer when brighter)
    const colorShift = flicker1 * 0.1;
    this.light.color.setRGB(
      this.baseColor.r + colorShift,
      this.baseColor.g + colorShift * 0.3,
      this.baseColor.b
    );
  }
}

// Usage:
const torchFlicker = new TorchFlicker(torchLight);
// In animation loop:
torchFlicker.update(delta);
```

#### Sine-Wave Flicker (simpler)

```javascript
function updateTorchSimple(light, time) {
  const base = 1.5;
  const flicker = Math.sin(time * 10) * 0.2
                + Math.sin(time * 23) * 0.1
                + Math.sin(time * 57) * 0.05;
  light.intensity = base + flicker;
}
```

### Directional Lighting (Windows/Sunlight)

```javascript
const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.5);
sunLight.position.set(10, 20, 5);
sunLight.castShadow = true;

// Shadow quality settings
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;

// Tighten shadow frustum to scene bounds for better resolution
sunLight.shadow.camera.left = -15;
sunLight.shadow.camera.right = 15;
sunLight.shadow.camera.top = 15;
sunLight.shadow.camera.bottom = -15;

// Bias to prevent shadow acne
sunLight.shadow.bias = -0.0005;

scene.add(sunLight);

// Ambient fill (so shadows are not pitch black)
const ambientLight = new THREE.AmbientLight(0x404060, 0.3);
scene.add(ambientLight);
```

### Volumetric God Rays / Light Shafts

#### Option A: three-good-godrays (recommended, pmndrs-compatible)

Screen-space raymarched godrays that integrate with the pmndrs postprocessing pipeline:

```javascript
import { EffectComposer, RenderPass } from 'postprocessing';
import { GodraysPass } from 'three-good-godrays';

// Prerequisite: enable shadow maps
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// All meshes that should occlude light must cast/receive shadows
scene.traverse(obj => {
  if (obj.isMesh) {
    obj.castShadow = true;
    obj.receiveShadow = true;
  }
});

// Light source
const sunLight = new THREE.DirectionalLight(0xfff4e0, 2);
sunLight.position.set(10, 20, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 0.1;
sunLight.shadow.camera.far = 1000;
scene.add(sunLight);

// Godrays pass
const godraysPass = new GodraysPass(sunLight, camera, {
  density: 1 / 128,         // ray density
  maxDensity: 0.5,          // max opacity of rays
  edgeStrength: 2,          // how sharply rays are cut by geometry
  edgeRadius: 2,            // edge detection radius
  distanceAttenuation: 2,   // how rays fade with distance
  color: new THREE.Color(0xffffff),
  raymarchSteps: 60,        // quality (higher = better but slower)
  blur: true,               // smooth ray edges
  gammaCorrection: true,
});

const composer = new EffectComposer(renderer, {
  frameBufferType: THREE.HalfFloatType,
});
composer.addPass(new RenderPass(scene, camera));
composer.addPass(godraysPass);
```

#### Option B: Geometry-Based Fake God Rays (cheaper)

Use a translucent cone mesh for light shaft visuals without post-processing:

```javascript
// Create a light shaft cone
const shaftGeo = new THREE.ConeGeometry(3, 12, 16, 1, true);  // open-ended cone
const shaftMat = new THREE.MeshBasicMaterial({
  color: 0xffffcc,
  transparent: true,
  opacity: 0.08,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const lightShaft = new THREE.Mesh(shaftGeo, shaftMat);
lightShaft.position.copy(windowPosition);
lightShaft.rotation.x = Math.PI / 6;  // angle the shaft
scene.add(lightShaft);

// Animate opacity for subtle variation
function updateLightShaft(mesh, time) {
  mesh.material.opacity = 0.06 + Math.sin(time * 0.5) * 0.02;
}
```

#### Option C: Post-Processing Radial Blur God Rays

Based on GPU Gems 3 volumetric light scattering:

```javascript
// Shader uniforms
const godraysUniforms = {
  tDiffuse: { value: null },
  lightPositionOnScreen: { value: new THREE.Vector2(0.5, 0.7) },
  exposure: { value: 0.34 },
  decay: { value: 0.97 },
  density: { value: 0.84 },
  weight: { value: 0.45 },
  samples: { value: 100 },
};
```

---

## 5. Particle Systems

### Approach: BufferGeometry + Points

The most performant way to handle many particles in Three.js.

### Dust Motes in Light Shafts

```javascript
class DustParticleSystem {
  constructor(count = 200, bounds = { x: 10, y: 8, z: 10 }) {
    this.count = count;
    this.bounds = bounds;

    // Create geometry with position and velocity attributes
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random initial positions within bounds
      positions[i * 3]     = (Math.random() - 0.5) * bounds.x;
      positions[i * 3 + 1] = Math.random() * bounds.y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * bounds.z;

      // Slow drifting velocities
      velocities[i * 3]     = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

      sizes[i] = Math.random() * 2 + 1;
      opacities[i] = Math.random() * 0.5 + 0.1;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    this.velocities = velocities;

    // Custom shader for soft circular particles with varying opacity
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xffffee) },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        varying float vOpacity;
        void main() {
          vOpacity = aOpacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;
        void main() {
          // Soft circular particle
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = vOpacity * smoothstep(0.5, 0.2, dist);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
  }

  update(delta) {
    const positions = this.geometry.attributes.position.array;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      // Update positions
      positions[i3]     += this.velocities[i3] * delta;
      positions[i3 + 1] += this.velocities[i3 + 1] * delta;
      positions[i3 + 2] += this.velocities[i3 + 2] * delta;

      // Add gentle sine wave drift
      positions[i3]     += Math.sin(performance.now() * 0.001 + i) * 0.001;
      positions[i3 + 1] += Math.cos(performance.now() * 0.0008 + i * 0.5) * 0.0005;

      // Wrap around bounds
      if (positions[i3] > this.bounds.x / 2) positions[i3] = -this.bounds.x / 2;
      if (positions[i3] < -this.bounds.x / 2) positions[i3] = this.bounds.x / 2;
      if (positions[i3 + 1] > this.bounds.y) positions[i3 + 1] = 0;
      if (positions[i3 + 1] < 0) positions[i3 + 1] = this.bounds.y;
      if (positions[i3 + 2] > this.bounds.z / 2) positions[i3 + 2] = -this.bounds.z / 2;
      if (positions[i3 + 2] < -this.bounds.z / 2) positions[i3 + 2] = this.bounds.z / 2;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.material.uniforms.uTime.value += delta;
  }
}

// Usage:
const dustSystem = new DustParticleSystem(200, { x: 12, y: 6, z: 12 });
dustSystem.points.position.copy(roomCenter);
scene.add(dustSystem.points);

// In animation loop:
dustSystem.update(delta);
```

### Torch Embers / Sparks

```javascript
class EmberParticleSystem {
  constructor(origin, count = 50) {
    this.origin = origin;
    this.count = count;
    this.particles = [];

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Initialize particles
    for (let i = 0; i < count; i++) {
      this.particles.push({
        life: 0,
        maxLife: 0,
        velocity: new THREE.Vector3(),
        active: false,
      });
    }

    this.material = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, dist);
          gl_FragColor = vec4(vColor * glow, glow);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
  }

  emit(index) {
    const p = this.particles[index];
    p.active = true;
    p.life = 0;
    p.maxLife = 1.0 + Math.random() * 2.0;  // 1-3 seconds
    p.velocity.set(
      (Math.random() - 0.5) * 0.5,
      1.0 + Math.random() * 2.0,   // upward bias
      (Math.random() - 0.5) * 0.5
    );

    // Reset position to origin
    const pos = this.geometry.attributes.position.array;
    pos[index * 3]     = this.origin.x;
    pos[index * 3 + 1] = this.origin.y;
    pos[index * 3 + 2] = this.origin.z;
  }

  update(delta) {
    const pos = this.geometry.attributes.position.array;
    const col = this.geometry.attributes.color.array;
    const sizes = this.geometry.attributes.size.array;

    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];

      if (!p.active) {
        // Random chance to spawn
        if (Math.random() < 0.02) this.emit(i);
        sizes[i] = 0;
        continue;
      }

      p.life += delta;
      const lifeRatio = p.life / p.maxLife;

      if (lifeRatio >= 1.0) {
        p.active = false;
        sizes[i] = 0;
        continue;
      }

      // Update position (velocity + gravity + wind)
      pos[i * 3]     += p.velocity.x * delta;
      pos[i * 3 + 1] += p.velocity.y * delta;
      pos[i * 3 + 2] += p.velocity.z * delta;

      // Slow down, add slight drift
      p.velocity.y -= 0.3 * delta;  // gentle gravity
      p.velocity.x += (Math.random() - 0.5) * 2.0 * delta;  // turbulence
      p.velocity.z += (Math.random() - 0.5) * 2.0 * delta;

      // Color: bright yellow -> orange -> red -> fade
      const r = 1.0;
      const g = Math.max(0, 0.8 - lifeRatio * 0.8);
      const b = Math.max(0, 0.3 - lifeRatio * 0.5);
      col[i * 3]     = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;

      // Size: start small, grow slightly, then shrink
      sizes[i] = (1.0 - lifeRatio) * (2.0 + Math.sin(lifeRatio * Math.PI) * 2.0);
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }
}

// Usage:
const torchEmbers = new EmberParticleSystem(new THREE.Vector3(5, 3, 2), 30);
scene.add(torchEmbers.points);

// In animation loop:
torchEmbers.update(delta);
```

### Simple Approach: THREE.PointsMaterial (quick prototyping)

For simpler particle effects during prototyping:

```javascript
const particleCount = 100;
const positions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 10;
  positions[i * 3 + 1] = Math.random() * 5;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  color: 0xffffee,
  size: 0.1,
  transparent: true,
  opacity: 0.4,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true,  // particles shrink with distance
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);
```

### GPU-Accelerated Particles (for thousands of particles)

For performance with large particle counts, move simulation to the GPU via vertex shader:

```javascript
const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uOrigin: { value: new THREE.Vector3() },
  },
  vertexShader: `
    attribute float aLifeOffset;
    attribute vec3 aVelocity;
    uniform float uTime;
    uniform vec3 uOrigin;
    varying float vLife;

    void main() {
      float life = mod(uTime + aLifeOffset, 3.0);  // 3-second cycle
      vLife = life / 3.0;

      vec3 pos = uOrigin + aVelocity * life;
      pos.y += life * 1.5;        // float upward
      pos.y -= life * life * 0.5; // gravity curve

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = (1.0 - vLife) * 4.0 * (200.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying float vLife;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = (1.0 - vLife) * smoothstep(0.5, 0.1, dist);
      vec3 color = mix(vec3(1.0, 0.6, 0.1), vec3(1.0, 0.1, 0.0), vLife);
      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
```

---

## 6. Recommended Libraries

| Library | Purpose | npm Package |
|---------|---------|-------------|
| **pmndrs/postprocessing** | Post-processing pipeline (bloom, DoF, vignette, color grading) | `postprocessing` |
| **N8AO** | High-quality SSAO with temporal stability | `n8ao` |
| **three-good-godrays** | Screen-space volumetric light scattering | `three-good-godrays` |
| **three-particle-fire** | Fire particle effects | `three-particle-fire` |
| **SimplexNoise** | Built into Three.js addons, for flicker/noise | `three/addons/math/SimplexNoise.js` |

### Import Map for the HD-2D Pipeline

```javascript
// Core Three.js
import * as THREE from 'three';

// Post-processing (pmndrs)
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  TiltShiftEffect,
  LUT3DEffect,
  HueSaturationEffect,
  BrightnessContrastEffect,
} from 'postprocessing';

// SSAO
import { N8AOPass } from 'n8ao';

// God rays
import { GodraysPass } from 'three-good-godrays';

// Built-in addons
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { LUTCubeLoader } from 'three/addons/loaders/LUTCubeLoader.js';

// Alternatively, for built-in tilt-shift shaders:
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
```

---

## 7. Sources

### Official Documentation
- [Three.js EffectComposer](https://threejs.org/docs/examples/en/postprocessing/EffectComposer.html)
- [Three.js BokehPass](https://threejs.org/docs/pages/BokehPass.html)
- [Three.js SSAOPass](https://threejs.org/docs/pages/SSAOPass.html)
- [Three.js UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html)
- [Three.js HorizontalTiltShiftShader](https://threejs.org/docs/pages/module-HorizontalTiltShiftShader.html)
- [Three.js OrthographicCamera](https://threejs.org/docs/api/en/cameras/OrthographicCamera.html)
- [Three.js Billboards Manual](https://threejs.org/manual/en/billboards.html)
- [Three.js SimplexNoise](https://threejs.org/docs/pages/SimplexNoise.html)
- [Three.js Depth-of-Field Example](https://threejs.org/examples/webgl_postprocessing_dof2.html)
- [Three.js Selective Bloom Example](https://threejs.org/examples/webgl_postprocessing_unreal_bloom_selective.html)
- [Three.js Pixelation Example](https://threejs.org/examples/webgl_postprocessing_pixel.html)

### Libraries
- [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) - Post-processing library for Three.js
- [N8AO](https://github.com/N8python/n8ao) - High-performance SSAO
- [three-good-godrays](https://github.com/Ameobea/three-good-godrays) - Volumetric light scattering
- [three-particle-fire](https://github.com/yomotsu/three-particle-fire) - Fire particle effects
- [three-dust](https://github.com/mattstyles/three-dust) - Particle emitter

### Tutorials and Articles
- [Volumetric Light Rays with Three.js (Codrops)](https://tympanus.net/codrops/2022/06/27/volumetric-light-rays-with-three-js/)
- [Volumetric Light Scattering in Three.js (Medium)](https://medium.com/@andrew_b_berg/volumetric-light-scattering-in-three-js-6e1850680a41)
- [Three.js Pixelated Lo-Fi Energy Look (Medium)](https://eriksachse.medium.com/three-js-pixelated-lo-fi-energy-look-298b8dc3eaad)
- [3D Pixel Art Rendering (David Holland)](https://www.davidhol.land/articles/3d-pixel-art-rendering/)
- [Spritesheet Animation with Aseprite and Three.js](https://fundamental.sh/p/sprite-sheet-animation-aseprite-react-threejs)
- [Color Grading Techniques in Three.js](https://moldstud.com/articles/p-an-in-depth-look-at-color-grading-techniques-in-threejs-post-processing)
- [Unreal Bloom Selective (Wael Yasmina)](https://waelyasmina.net/articles/unreal-bloom-selective-threejs-post-processing/)
- [Three.js Post Processing 3DLUT](https://threejs.org/manual/#en/post-processing-3dlut)

### Community Discussions
- [Tilt-Shift Effect on 3D Scene (Three.js Forum)](https://discourse.threejs.org/t/how-to-have-a-tilt-shift-effect-on-a-3d-scene/40606)
- [Isometric View Using PerspectiveCamera (Three.js Forum)](https://discourse.threejs.org/t/isometric-view-using-perspectivecamera/3519)
- [Pixel-Perfect Orthographic Camera (Three.js Forum)](https://discourse.threejs.org/t/pixelperfect-orthographic-camera-with-blocks-for-a-pixelart-2d-look/46637)
- [SSAO with EffectComposer NormalPass (Three.js Forum)](https://discourse.threejs.org/t/ssao-used-with-effectcomposer-how-to-enable-normalpass/62423)
- [Billboard Depth Support (Three.js Forum)](https://discourse.threejs.org/t/is-billboard-depth-supported/6504)
- [Volumetric Light for Cave Scene (Three.js Forum)](https://discourse.threejs.org/t/help-with-persistent-volumetric-light-god-rays-light-shafts-sunbeam-sunburst-for-underground-cave-scene/79085)
- [Three-Good-Godrays Forum Announcement](https://discourse.threejs.org/t/three-good-godrays-screen-space-godrays-for-three-js/43422)

### HD-2D Reference
- [Octopath Traveler HD-2D Art Style (Unreal Engine)](https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true)
- [Octopath Traveler II HD-2D Style (Unreal Engine)](https://www.unrealengine.com/en-US/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style)
- [HD-2D (HandWiki)](https://handwiki.org/wiki/HD-2D)
- [Three.js Isometric Camera Gist](https://gist.github.com/nitaku/032c1724a0433ae0f85f)

### Code Examples and Demos
- [Animal Crossing Camera & Tilt Shift (CodePen)](https://codepen.io/mjurczyk/pen/LYNqzxa)
- [Isometric Camera and Colors (CodePen)](https://codepen.io/puritanner/pen/LbgMwo)
- [Volumetric Light Scattering (CodePen)](https://codepen.io/abberg/pen/pbWZjg)
- [Three.js Flickering Torch Demo](https://threejsdemos.com/demos/lighting/torch)
- [Three.js Volumetric Light Shafts Demo](https://threejsdemos.com/demos/lighting/godrays)
- [Interactive Tilt Shift (TroisJS)](https://troisjs.github.io/examples/demos/5)

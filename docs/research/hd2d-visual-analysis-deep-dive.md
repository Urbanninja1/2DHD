# HD-2D Visual Effects Deep Dive -- Design Principles & Technical Analysis

**Date:** 2026-02-05
**Purpose:** Comprehensive analysis of the HD-2D visual style as implemented in Octopath Traveler (I & II), Triangle Strategy, Dragon Quest III HD-2D Remake, and Live A Live Remake. Focused on extracting specific visual parameters, design principles, and common pitfalls for recreation in Three.js.

---

## Table of Contents

1. [What Is HD-2D? The Core Visual Identity](#1-what-is-hd-2d)
2. [Visual Effect Breakdown (Layer by Layer)](#2-visual-effect-breakdown)
3. [Camera Specifics](#3-camera-specifics)
4. [Sprite Rendering in HD-2D](#4-sprite-rendering-in-hd-2d)
5. [Lighting Design Principles](#5-lighting-design-principles)
6. [Color Palette Analysis by Mood](#6-color-palette-analysis-by-mood)
7. [What Makes HD-2D Look Good vs Bad](#7-what-makes-hd-2d-look-good-vs-bad)
8. [Evolution Across Titles](#8-evolution-across-titles)
9. [Key Developer Insights](#9-key-developer-insights)
10. [Actionable Parameters for Our Pipeline](#10-actionable-parameters-for-our-pipeline)
11. [Sources](#11-sources)

---

## 1. What Is HD-2D?

HD-2D is a proprietary art style coined by Square Enix, first debuted in Octopath Traveler (2018). It combines:

- **2D pixel-art character sprites** rendered as billboard quads
- **Fully 3D environments** with modern PBR materials and texturing
- **Heavy post-processing** (tilt-shift DoF, bloom, vignette, color grading, SSAO)
- **Dynamic real-time lighting** with shadow casting
- **Particle effects** (dust motes, embers, rain, volumetric fog)

The result is a **diorama effect** -- the scene looks like a beautifully lit miniature model being viewed through a macro lens. The style evokes nostalgia for SNES-era pixel art RPGs while wrapping them in cinematic modern rendering.

### The "Diorama" Metaphor

The defining quality of HD-2D is that it feels like you are peering into a handcrafted miniature world. This comes from three converging techniques:

1. **Tilt-shift blur** makes the scene feel small/miniature (like tilt-shift photography of real cities)
2. **Low camera angle** looking slightly downward lets you "peek into" the world rather than looking down on it
3. **Vignette** frames the scene like a photograph or a peephole into the diorama

### Engine Foundation

All Square Enix HD-2D titles are built on **Unreal Engine 4**. The team at Acquire (developer of Octopath Traveler) leveraged UE4's built-in PBR renderer, shadow mapping, post-processing pipeline, and Sequencer for camera work. Notably, the team was small -- only **6 programmers at peak** for the original Octopath Traveler -- relying heavily on the engine's built-in capabilities.

---

## 2. Visual Effect Breakdown

### 2A. Tilt-Shift Depth of Field -- THE Signature Effect

This is the single most important effect in the HD-2D look. Without it, the scene looks like a standard 2.5D game.

**What it does:** Creates a horizontal band of sharp focus (where the player character is), with progressive blur above (background/ceiling) and below (foreground floor). This mimics the optical phenomenon of tilt-shift photography, which makes real-world scenes look like miniature models.

**Parameters (estimated from visual analysis):**

| Parameter | Octopath Traveler I | Octopath Traveler II | DQ3 HD-2D | Triangle Strategy |
|---|---|---|---|---|
| Focus band position | ~40-50% from bottom | ~40-50% from bottom | ~45-55% from bottom | ~35-45% from bottom |
| Focus band width | Narrow (~20-30% of screen height) | Slightly wider (~25-35%) | Wider (~30-40%) | Medium (~25-30%) |
| Blur intensity (max) | Very strong (4-6px at 720p) | Strong (3-5px) | Moderate (2-4px) | Strong (3-5px) |
| Blur falloff | Fairly sharp gradient | Smoother gradient | Smooth gradient | Medium gradient |
| Blur kernel | Gaussian-like | Improved bokeh-like | Clean gaussian | Gaussian |

**Key observations:**

- The focus band is NOT centered vertically. It sits in the lower-middle of the screen because the camera looks downward, and the player character occupies that region.
- The **top of the screen** (far background, ceilings, distant walls) gets the strongest blur.
- The **bottom of the screen** (near foreground, closest floor tiles) also blurs, but typically less than the top.
- The blur is applied as a **screen-space post-process**, not a true lens simulation. It reads depth from the depth buffer and applies a gaussian kernel scaled by distance from the focal plane.

**UE4 implementation:** The games use UE4's cinematic depth of field system. The relevant console variables include:
- `r.DepthOfFieldQuality` (0 = off, higher = better quality)
- Focus distance and aperture are set per-camera via the Post Process Volume

**For our Three.js pipeline:**
```
TiltShiftEffect:
  focusArea: 0.35      (sharp band = 35% of screen height)
  feather: 0.25        (gradual falloff)
  offset: -0.05        (slightly below center to match player position)
  kernelSize: 3        (medium quality blur)
```

### 2B. Bloom

Bloom adds a soft luminous glow around bright light sources. In HD-2D, it serves to make torches, candles, sunbeams, stained-glass windows, and magical effects feel warm and radiant.

**How HD-2D uses bloom:**

- **Selective, threshold-based:** Only bright pixels bloom. This means torches and windows glow but stone walls do not.
- **Warm color bias:** Bloom color inherits the light source color, so torch bloom is warm orange/gold and window bloom is warm white/yellow.
- **Moderate intensity:** The goal is a soft "cinematic warmth" not a blinding haze. When Octopath Traveler overdid it, players complained about washed-out visuals.
- **Mipmap-chain bloom** (UE4's standard approach): The bright pixels are progressively downsampled and blurred, then composited back, creating a natural multi-scale glow.

**Parameters (estimated):**

| Parameter | Recommended HD-2D Range | Too Little | Too Much |
|---|---|---|---|
| Luminance threshold | 0.7 - 0.9 | >0.95 (no visible bloom) | <0.5 (everything blooms) |
| Intensity | 0.5 - 1.2 | <0.3 (barely noticeable) | >2.0 (washed out) |
| Radius/spread | 0.3 - 0.6 | <0.2 (too tight, halo-like) | >0.8 (foggy soup) |
| Smoothing | 0.05 - 0.1 | - | - |

**Critical mistake to avoid:** Bloom on the entire scene instead of just bright sources. The original Octopath Traveler was criticized for excessive bloom that made daytime scenes "blindingly bright" and caused eye strain. Dragon Quest III HD-2D Remake also received community feedback about "too much Bloom/post processing."

**For our Three.js pipeline:**
```
BloomEffect:
  intensity: 0.8
  luminanceThreshold: 0.8
  luminanceSmoothing: 0.075
  mipmapBlur: true        (essential for natural multi-scale glow)
```

### 2C. Ambient Occlusion

AO deepens the shadows in corners, crevices, under objects, and where surfaces meet. In HD-2D, it is critical for making 3D environments feel grounded and volumetric.

**Technique used:** The games use **SSAO** (Screen-Space Ambient Occlusion), which is UE4's built-in approach. Dragon Quest III HD-2D Remake explicitly exposes "ambient occlusion" as a graphics setting with 3 quality levels (1-3).

**Not HBAO+** -- while UE4 supports various AO methods, the HD-2D games are primarily targeting Switch hardware (low-end), so they use the standard SSAO implementation rather than more expensive techniques like HBAO+ or GTAO.

**UE4 console variables:**
- `r.AmbientOcclusionLevels` (controls quality)
- `r.AmbientOcclusionFadeRadiusScale` (controls falloff)

**Visual role in HD-2D:**
- Adds depth to stone architecture (columns, arches, recesses)
- Grounds furniture and props on floors
- Creates subtle shadow pooling in corners
- Makes the 3D environment feel physically "real" even alongside flat pixel sprites

**For our Three.js pipeline (N8AO):**
```
N8AOPass:
  aoRadius: 2.0
  distanceFalloff: 1.0
  intensity: 3.0
  halfRes: true          (performance on web)
  aoSamples: 16
  denoiseSamples: 8
```

### 2D. Color Grading

Per-scene color grading is how HD-2D games create distinct emotional atmospheres. Each environment type has its own color temperature, saturation profile, and contrast curve.

**Implementation:** UE4's Post Process Volume per level/sublevel, using either:
- LUT (Look-Up Table) textures for precise artistic control
- Color grading parameters (white balance, saturation, contrast, gain, gamma)

**The games use ACES Filmic tone mapping** (UE4's default for cinematic content), which compresses highlights naturally and gives a film-like response curve.

**General palette principles observed:**

| Environment Type | Color Temperature | Saturation | Contrast | Examples |
|---|---|---|---|---|
| Indoor torch-lit | Warm (amber/gold, ~3000K) | Medium-high | High (deep shadows vs bright flames) | Throne rooms, taverns, council chambers |
| Indoor candlelit | Very warm (orange/amber) | Medium | Medium-high | Private chambers, small rooms |
| Outdoor sunny | Neutral-warm (~5500K) | High | Medium | Fields, towns in daylight |
| Outdoor overcast | Cool-neutral (~6500K) | Low-medium | Low | Coastal areas, overcast villages |
| Dungeon/cave | Cool-desaturated | Low | Very high (near-black shadows) | Caves, underground passages |
| Night exterior | Cool blue (~8000K) | Low-medium | High | Towns at night, moonlit areas |
| Snow/ice | Very cool (blue-white) | Low | Medium | Frostlands in Octopath |
| Desert | Warm-hot (amber-orange) | Medium-high | Medium | Sunshade in Octopath |
| Forest | Cool-green with warm highlights | Medium | Medium | Woodlands, S'warkii in Octopath |

### 2E. Vignette

A subtle darkening at the screen edges that draws the eye toward the center and reinforces the "peering into a diorama" feeling.

**Parameters:**

- **Offset (how far from center before darkening starts):** 0.25 - 0.4
- **Darkness (how dark the edges get):** 0.5 - 0.8

**Observations:**
- HD-2D vignette is **subtle**. You should barely notice it consciously, but it shapes your visual focus.
- Octopath Traveler I uses a slightly stronger vignette than the sequels.
- Triangle Strategy's tactical view uses a lighter vignette to let players see the wider battlefield.
- Dark rooms (dungeons, stairwells) can afford a slightly stronger vignette. Bright outdoor areas should use less.

**For our pipeline:**
```
VignetteEffect:
  offset: 0.3
  darkness: 0.6
```

### 2F. Light Shafts / God Rays

Volumetric light shafts are used in scenes where strong directional light enters through windows, doorways, or breaks in architecture. This is one of the most visually dramatic effects in HD-2D.

**Where they appear:**
- Sunlight through stained-glass windows (Octopath Traveler throne rooms, churches)
- Light through tree canopies (forest areas)
- Light entering dungeon entrances from outside
- Window openings in towers and galleries

**Implementation in UE4:** The games use UE4's built-in light shaft effects combined with particle-based volumetric fog. In some scenes, particularly in Octopath Traveler II, the team added point lights simultaneously with visual effects so that "the light could create shadows of the characters on the environment."

**For our pipeline:** The `three-good-godrays` library provides screen-space raymarched god rays:
```
GodraysPass:
  density: 1/128
  maxDensity: 0.5
  edgeStrength: 2
  distanceAttenuation: 2
  raymarchSteps: 60
  blur: true
```

### 2G. Particle Effects

Particles add life and atmosphere to otherwise static scenes. HD-2D uses several distinct particle types:

| Particle Type | Where Used | Behavior | Visual |
|---|---|---|---|
| **Dust motes** | Indoor rooms with light shafts | Slow drift, gentle sine-wave motion, visible only in lit areas | Tiny warm-white dots, additive blending |
| **Torch embers** | Near torches, braziers, fireplaces | Rise upward with turbulence, fade from yellow to orange to red | Small glowing points, 1-3s lifetime |
| **Rain** | Outdoor rainy scenes | Fast diagonal streaks | Semi-transparent white lines |
| **Snow** | Cold outdoor areas | Slow drifting descent | White dots with slight wobble |
| **Wind streaks** | Battlements, open areas | Horizontal alpha-faded streaks | Subtle white horizontal lines |
| **Fog/mist** | Dungeons, swamps, night scenes | Slow-moving semi-transparent planes | Layered additive planes |
| **Water sparkle** | Rivers, lakes, fountains | Bright point flashes on water surface | White flicker points |
| **Magical effects** | Combat, spell effects | Various (spirals, bursts, trails) | Colored additive particles |

**Key design principle:** Particles should be **sparse and subtle** in exploration. Too many particles make the scene noisy and compete with the tilt-shift effect. Dust motes should be barely visible -- you notice them subconsciously rather than consciously counting them.

---

## 3. Camera Specifics

### Camera Type

HD-2D uses a **perspective camera** (not orthographic). This is essential because:

1. Depth-of-field post-processing requires a perspective depth gradient
2. The slight perspective distortion adds to the "looking into a real miniature" feeling
3. Distant objects appear slightly smaller, reinforcing depth

However, the field of view is **narrow** (30-40 degrees) to minimize perspective distortion and give a near-orthographic appearance. This is a deliberate compromise: enough perspective for DoF to work, but not so much that the scene looks like a standard 3D game.

### Camera Angle

The camera looks **into** the scene at a downward angle, not directly **onto** it from above.

**Estimated camera parameters:**

| Parameter | Value | Notes |
|---|---|---|
| **Pitch angle (from horizontal)** | ~30-40 degrees downward | Looking into the scene, not straight down |
| **Equivalent angle from vertical** | ~50-60 degrees from straight-down | Much less overhead than true isometric (35.26 deg) |
| **Field of view** | ~30-40 degrees vertical | Narrow to reduce perspective distortion |
| **Camera height** | ~12-18 world units above ground | Depends on scene scale |
| **Camera distance** | ~18-25 world units from player | Close enough for detail, far enough for context |
| **Horizontal rotation** | Fixed (no rotation around Y for standard exploration) | May rotate for cutscenes/battles in OT2 |

**The low angle is critical.** Early prototypes of Octopath Traveler used a more overhead angle, but the team deliberately lowered the camera so players "look into the scenery rather than onto it." This reveals how the 3D environments are proportioned relative to the 2D character sprites, creating a sense of physical presence.

### Camera Following Behavior

- The camera follows the player with **smooth interpolation (lerp)**, not instant snapping.
- The smoothing factor is moderate (~0.05-0.10 per frame) -- responsive enough that the player does not feel disconnected, but smooth enough to feel cinematic.
- There is **no camera rotation** during normal exploration in Octopath Traveler I. The camera is fixed in orientation.
- In **Octopath Traveler II**, the team added more dynamic camerawork using UE4's Sequencer, including camera rotations of up to 90 degrees in battle effects and 180 degrees in story events. However, normal exploration still uses a largely fixed camera.
- **Triangle Strategy** has a rotatable camera (tactical requirement), but the same fundamental angle and DoF apply at each rotation stop.

### Camera Snapping for Pixel Art

To prevent pixel "swimming" (sub-pixel jittering that makes pixel art look wobbly during camera movement), the camera position should be snapped to a texel-aligned grid. Tim Soret (developer of The Last Night) publicly criticized Octopath Traveler for not doing this properly, noting "sprites have this horrible wave effect on them during camera movement" caused by "pixel crawling artifacts introduced by scaling unfiltered sprites by non-power-of-two values or rotating them."

**Solution:** Calculate the world-space size of one screen pixel at the focal plane, and snap camera position to multiples of that size.

---

## 4. Sprite Rendering in HD-2D

### Billboard Technique

Characters, NPCs, and certain decorative elements (plants, small props) are rendered as **2D pixel-art textures on flat quad polygons** placed in the 3D scene. This is the classic "billboard" technique.

**Key technical details:**

| Aspect | Implementation | Notes |
|---|---|---|
| **Geometry** | Single quad (PlaneGeometry equivalent) | Not UE4's Paper2D; raw quads in 3D space |
| **Orientation** | Y-axis billboard (rotates around vertical axis to face camera) | Does NOT tilt backward/forward with camera pitch |
| **Texture filtering** | Nearest-neighbor (point sampling) | Preserves crisp pixel edges |
| **Alpha handling** | Alpha test (hard cutoff) rather than alpha blend | Prevents depth-sorting issues with transparent edges |
| **Sprite resolution** | ~16-32px per character height (base resolution before scaling) | Scaled up via nearest-filter to appear at correct world size |
| **Mipmaps** | Disabled | Mipmaps would blur the pixel art |

### Why Y-Axis-Only Billboarding

Full billboard rotation (facing camera on all axes) would cause sprites to **tilt backward** when viewed from the HD-2D's downward angle, making characters look like they are leaning away. Y-axis-only billboarding keeps the sprite upright and vertical, rotating only horizontally to face the camera. Since the HD-2D camera angle is fixed during exploration, the sprites always appear naturally upright.

### Sprite Shadows

This is one of the most important integration details -- sprites must cast shadows onto the 3D environment to feel grounded.

**Implementation approach (from developer interviews):**

1. **Point lights placed alongside visual effects** cause sprites to cast real-time shadows via the engine's shadow mapping system. The developers explicitly described adding "a point light simultaneously with visual effects" so that "the light could create shadows of the characters on the environment."

2. For the main directional light (sun/ambient), sprites cast **shadow map shadows** just like any other geometry. Since the sprite is a flat quad, its shadow on the ground appears as a flattened rectangular silhouette, which at the HD-2D camera angle actually looks like a natural character shadow.

3. Some implementations supplement this with a **circular "blob shadow"** directly beneath the sprite -- a small, dark, semi-transparent circle projected onto the ground plane. This guarantees a visible grounding shadow even when shadow mapping resolution is low or the lighting angle is unfavorable.

### Sprite-to-Environment Integration Challenges

The developers acknowledged that "because characters are drawn using 2D pixel art, they resemble flat sheets of paper, while the backgrounds are almost entirely rendered in 3D," creating a challenge to "make them look natural alongside the characters." The team "had to play tricks with the lighting" to make the characters and background look cohesive.

**Tricks used:**
- Ambient light on sprites matches the room's ambient color
- Bloom and post-processing apply uniformly to both sprites and 3D elements, unifying them under the same "lens"
- The tilt-shift blur applies equally to sprites and 3D geometry based on depth, which naturally integrates them
- Shadow casting from sprites grounds them in the environment

### Texture Filtering Controversy

Tim Soret (The Last Night developer) publicly analyzed Octopath Traveler's sprite rendering and identified a significant technical issue: the game uses nearest-neighbor filtering for sprites but does not properly handle sub-pixel positioning, causing visible "swimming" artifacts when the camera moves. His recommended solution was to use a custom shader that keeps pixel art sharp but smoothly interpolates during panning, preventing wobble regardless of distance and rotation.

The Octopath Traveler team later used **temporal anti-aliasing (TAA)** techniques to mitigate these artifacts from scaling/rotating nearest-neighbor filtered textures, though opinions vary on whether this was sufficient.

---

## 5. Lighting Design Principles

### The Lighting Philosophy

HD-2D lighting follows a principle of **contrast and drama**. The style takes cues from cinematic photography and theatrical stage lighting:

- **Never flat.** Every scene has a dominant light direction that creates visible shadow patterns.
- **Motivated light sources.** Every visible light (torch, window, candle) has a corresponding 3D light casting real shadows.
- **Warm key, cool fill.** Primary light sources tend warm (fire, sunlight), while ambient/fill light leans cool (blue-grey), creating pleasant color contrast.
- **Deep shadows are acceptable.** Unlike many modern games that fill every shadow, HD-2D embraces dark areas as atmospheric.

### Light Source Types Used

| Light Type | Role | Color Range | Shadow | Examples |
|---|---|---|---|---|
| **Directional** | Sunlight through windows, outdoor sun | Warm white (0xFFF4E0 to 0xFFE8C0) | Hard, high-res shadow map (2048px) | Grand halls, outdoor areas |
| **Point lights** | Torches, candles, braziers, lanterns | Warm orange (0xFF6622 to 0xFF8844) | Soft shadow, 512px map | Most indoor scenes |
| **Spot lights** | Focused window beams, chandeliers | Varies | Medium shadow | Specific dramatic moments |
| **Ambient** | General room fill | Cool-neutral (0x404060 to 0x606080) | None | All scenes (very low intensity) |

### Torch/Candle Flicker Design

The flickering of fire-based lights is a critical atmospheric detail. The HD-2D games use **noise-based flicker** (not simple sine waves), layering multiple frequencies:

- **Slow wave** (~3 Hz): Large, gentle intensity variation. Creates the overall "breathing" of the flame.
- **Medium flutter** (~8 Hz): Mid-frequency wobble. Makes the light feel organic.
- **Fast crackle** (~15 Hz): Tiny rapid variations. Adds the "live fire" quality.

The intensity modulation is typically +/- 30% of the base intensity, never going below ~30% of base (a completely dark torch looks broken, not atmospheric).

Additionally, the light **color shifts slightly** with intensity: brighter = slightly more orange/yellow, dimmer = slightly more red. This mimics real fire behavior.

### Shadow Quality and Behavior

**Shadow maps:** HD-2D games use standard shadow mapping (not ray-traced shadows). On the Switch, shadow resolution is modest (512px-1024px per light), resulting in slightly soft shadow edges that actually complement the artistic style.

Dragon Quest III HD-2D Remake exposes shadow settings:
- **Shadow Quality:** 1-3 (resolution of shadow maps)
- **Shadow Area:** 1-3 (extent of shadow coverage / cascade distance)

**Shadow behavior with sprites:** Sprite shadows appear as flat rectangular projections of the quad geometry. At the HD-2D camera angle, these shadows are foreshortened into convincing "character on ground" shadows. The shadow is darkest near the sprite's feet and fades with distance.

### Day/Night Lighting Transitions

Octopath Traveler II introduced a full day/night cycle, implemented via UE4's Sequencer. The transition changes:

- **Directional light color:** Warm gold (day) to cool blue-white (moonlight at night)
- **Directional light intensity:** Full (day) to dim (night)
- **Ambient light color:** Neutral (day) to deep blue (night)
- **Point light prominence:** Barely noticeable in daylight, becomes the dominant light source at night
- **Post-processing color grade:** Shifts from neutral/warm to cool blue tones

The developer described the result: "the sun's rays dance across the water of a seaside fishing village" by day, while at night "streetlights and windows illuminate a city that never sleeps" and "the glow of braziers bathe a cathedral courtyard in flickering light."

---

## 6. Color Palette Analysis by Mood

### Throne Room / Grand Hall
- **Temperature:** Warm gold
- **Key colors:** Deep red (banners), gold (ornaments), warm stone tan, rich brown (wood)
- **Shadows:** Deep amber to near-black
- **Highlights:** Bright warm white from windows, orange from torches
- **Saturation:** Medium-high
- **Contrast:** High (dramatic)
- **Color grade:** Slight push toward orange/gold in midtones, shadows tinted warm brown
- **Reference:** Octopath Traveler's Hornburg Castle, Victor's Hollow arena

### Candlelit Chamber / Council Room
- **Temperature:** Very warm, amber
- **Key colors:** Rich wood brown, parchment cream, candle yellow, shadow brown
- **Shadows:** Warm brown (not cool)
- **Highlights:** Concentrated candle spots of warm yellow
- **Saturation:** Medium
- **Contrast:** Medium-high (pools of light in surrounding darkness)
- **Color grade:** Strong amber push, slightly desaturated shadows
- **Reference:** Octopath Traveler's tavern interiors

### Outdoor Daylight (Town/Field)
- **Temperature:** Neutral-warm
- **Key colors:** Green (vegetation), brown (paths), blue (sky reflections on surfaces), warm grey (stone)
- **Shadows:** Cool blue-grey
- **Highlights:** Warm sunlight white
- **Saturation:** High (colors feel alive and vivid)
- **Contrast:** Medium (natural, not dramatic)
- **Color grade:** Slight warm lift in highlights, cool shadows (orange-teal split)
- **Reference:** Octopath Traveler's Atlasdam, Flamesgrace

### Dungeon / Underground
- **Temperature:** Cool, desaturated
- **Key colors:** Dark grey stone, damp green-black, occasional warm torch orange
- **Shadows:** Near-black (very deep)
- **Highlights:** Only from sparse torch/crystal sources
- **Saturation:** Low (washed-out, oppressive)
- **Contrast:** Very high (nearly all shadow with isolated bright spots)
- **Color grade:** Heavy desaturation, cool blue-green push in shadows
- **Reference:** Octopath Traveler's cave dungeons, DQ3's cave systems

### Night Exterior
- **Temperature:** Cool blue
- **Key colors:** Deep blue sky, silver moonlight, warm orange window/lamp light, dark silhouettes
- **Shadows:** Blue-black
- **Highlights:** Cool white (moonlight) and warm orange (artificial light -- this contrast is key)
- **Saturation:** Low-medium
- **Contrast:** High
- **Color grade:** Strong blue push in ambient, warm exceptions for fire sources
- **Reference:** Octopath Traveler II's nighttime towns

### Battlements / Elevated Outdoor
- **Temperature:** Cool to neutral
- **Key colors:** Grey stone, blue sky, distant warm cityscape, wind-washed pale tones
- **Shadows:** Cool grey
- **Highlights:** Strong directional sun
- **Saturation:** Medium
- **Contrast:** Medium-high (open sky creates strong directional shadows)
- **Color grade:** Slightly desaturated, cool-leaning, high clarity
- **Reference:** Triangle Strategy's castle battlements

### Castle / Tower Stairwell
- **Temperature:** Cool with warm punctuation
- **Key colors:** Dark grey stone, occasional warm torch spot, blue-grey ambient
- **Shadows:** Very deep, cool
- **Highlights:** Only from torches (warm) and arrow slits (cool daylight)
- **Saturation:** Low
- **Contrast:** Extreme (mostly shadow, tiny light sources)
- **Color grade:** Heavy desaturation, blue-grey dominant, warm only in torch radius
- **Reference:** Octopath Traveler's dungeon stairwells

---

## 7. What Makes HD-2D Look Good vs Bad

### The Good: What Square Enix Gets Right

1. **Restrained post-processing.** The best HD-2D scenes (particularly in Octopath Traveler II and Live A Live) use post-processing to enhance, not overwhelm. You should feel the effects subconsciously, not be distracted by them.

2. **Motivated bloom.** Bloom only appears around actual light sources (torches, windows, magic). It is never applied uniformly to the entire scene.

3. **Consistent pixel density.** Sprites are all rendered at the same pixel resolution (approximately 16-32px characters), maintaining visual coherence.

4. **Lighting tells the story.** Each room's lighting is hand-tuned to create a specific emotional response. The lighting is not procedural or generic -- it is art-directed.

5. **The tilt-shift supports the diorama metaphor.** The blur band is carefully positioned to keep the action area sharp while pushing non-essential regions out of focus.

6. **Atmosphere through restraint.** Particle effects are sparse. Dust motes are barely visible. The best HD-2D scenes feel atmospheric without feeling busy.

### The Bad: Common Mistakes (Including Square Enix's Own)

Based on player criticism, developer retrospectives, and technical analysis:

**1. Excessive Depth of Field / Blur**
- The #1 fan complaint about Octopath Traveler I. Players reported "edges of the screen blurring out and hiding paths" and "the constant focus changes are distracting."
- The blur was too strong at 720p (Switch handheld), turning pixel art into a "blurry mess."
- Fix: Lower blur intensity on low resolutions. Make blur proportional to render resolution. Provide a toggle.
- The OT Visual Clarity Patch (community mod) disables DoF entirely and is extremely popular, suggesting Square overshot.

**2. Too Much Bloom**
- "Blooming and contrast set excessively high, making daytime scenes blindingly bright and nighttime scenes too dark."
- When bloom threshold is too low, everything glows -- stone walls, floor tiles, character sprites. This creates a hazy, washed-out look reminiscent of the "early 2000s bloom epidemic."
- Dragon Quest III HD-2D Remake received specific criticism: "too much Bloom/post processing imo."
- Fix: Set luminance threshold high (0.7-0.9). Only actual light sources should bloom.

**3. Low Render Resolution + Heavy Post-Processing**
- On Switch, HD-2D games often render at 720p (docked) or 576p (handheld), then apply DoF, bloom, and AA on top. The low base resolution combined with blur makes pixel art muddy.
- Fix: Render at the highest resolution possible before applying post-processing. Super-sampling (rendering higher than display resolution) dramatically improves the look.

**4. Sprites Looking Disconnected from Environment**
- If sprites do not cast shadows, receive ambient light, or participate in post-processing, they look "pasted on" rather than "in" the world.
- Fix: Ensure sprites cast shadow map shadows, are affected by ambient/directional light tint, and are processed through the same DoF/bloom pipeline as the environment.

**5. Wrong Camera Angle**
- Too high (looking straight down) loses the "peering in" feeling and becomes a generic top-down game.
- Too low (near-horizontal) makes the environment look like a normal 3D game with flat sprites.
- Fix: 30-40 degrees below horizontal. The camera should feel like it is at the edge of a table, looking across a miniature diorama.

**6. Inconsistent Pixel Scale**
- Mixing sprites at different pixel densities (e.g., 16px characters next to 32px objects) breaks the retro illusion.
- Fix: Establish one "virtual pixel size" and maintain it across all sprites.

**7. Bilinear Filtering on Pixel Art**
- Using bilinear or trilinear filtering on pixel-art textures blurs the crisp edges that define the aesthetic.
- Fix: Always use nearest-neighbor (point) filtering for pixel-art textures. Disable mipmaps.

**8. Over-Layering Effects**
- Stacking SSAO + bloom + DoF + vignette + god rays + particles + color grading without careful tuning creates "a visual cacophony."
- Each effect individually is fine. The danger is the cumulative impact.
- Fix: Add effects one at a time. Compare with and without each effect. If you cannot clearly articulate what an effect adds, remove it.

---

## 8. Evolution Across Titles

| Aspect | Octopath Traveler (2018) | Triangle Strategy (2022) | Live A Live (2022) | Octopath Traveler II (2023) | Dragon Quest III HD-2D (2024) |
|---|---|---|---|---|---|
| **DoF intensity** | Very strong | Strong | Moderate | Strong (improved) | Moderate (option to disable) |
| **Bloom** | Heavy (often criticized) | Moderate | Moderate | Moderate-heavy | Moderate (criticized by some) |
| **Camera** | Fixed top-down | Rotatable (tactical) | Fixed top-down | Fixed + dynamic cutscene cameras | Fixed top-down |
| **Color grading** | Strong warm bias | Balanced | Varies by era | More nuanced, day/night | Bright, crisp |
| **Overall look** | Pioneering but over-processed | Refined, tactical clarity | Well-balanced | "Picture-perfect" per devs | Brightest, crispest |
| **Fan reception** | Mixed (love style, hate blur) | Positive | Very positive | Positive | Mixed (bloom complaints) |

**Key trend:** Each successive title has **pulled back on post-processing intensity** while **improving the quality** of individual effects. The style is converging toward subtlety.

Director Keisuke Miyauchi described Octopath Traveler II's goal as making visuals that "would be picture-perfect no matter when you screenshotted it," drawing inspiration from the high-fidelity pixel art of the 1990s (specifically citing the trial scene in Chrono Trigger).

---

## 9. Key Developer Insights

### From the Unreal Engine Spotlight (Octopath Traveler)

- The HD-2D concept emerged from fusing "3D art with 2D pixels" to make the game "look new and fresh."
- Art Lead Morimoto began incorporating 3D elements for depth, while Producer Asano emphasized lighting and shadow to highlight "how light interacts with pixel-based environments."
- UE4 was essential for making "the pixels of a sprite not only look but feel part of a world with volume, fog, rain, and light filtering through the trees."
- The team "had to play tricks with the lighting" to make 2D characters and 3D backgrounds look cohesive.
- Point lights were "added simultaneously with visual effects" so light could "create shadows of the characters on the environment."

### From Unreal Fest Europe 2019

- Acquire presented "The Fusion of Nostalgia and Novelty in the Development of Octopath Traveler," walking through how art and assets were created.
- The presentation showed early look development (using Final Fantasy VI sprite assets as placeholders), sprite sheets, and what the game looked like before post-processing, after a lighting pass, and after the full post-processing pass.

### From Developer Interviews (Octopath Traveler II)

- Producer Takahashi noted people have "rose-tinted glasses" for pixel art and described the development as "a battle against nostalgia for the previous game."
- The day/night cycle was implemented using UE4's Sequencer for precise artistic control over lighting transitions.
- The team made "particularly heavy use of 3D camerawork" in OT2, with camera rotations of nearly 90 degrees in some battle effects and 180 degrees in some events.

### From Triangle Strategy Producers

- The HD-2D maps "required significant resources to make the maps observable from all angles."
- They described HD-2D as "a blending of the real and surreal, striking a terrific balance between the two styles" with "realistic lighting shining on deformed characters."

### From Live A Live Director (Takashi Tokita)

- Tokita chose HD-2D because "a full 3D remake would have changed the look of the game too much, but an HD-2D remake fuses the beauty of pixel art with the unique effects possible with 3D."
- HD-2D "allows for a lot of variety" which was important for Live A Live's multiple time periods.

---

## 10. Actionable Parameters for Our Pipeline

Based on all research, here are the recommended starting parameters for the Three.js HD-2D pipeline:

### Camera
```
Type: PerspectiveCamera
FOV: 35 degrees
Position: (0, 15, 20) relative to player
LookAt: player position
Pitch: ~37 degrees below horizontal (natural from position/lookAt)
Follow smoothing: 0.08 lerp factor per frame
Pixel snap: enabled (snap to texel grid at focal plane)
```

### Post-Processing Stack (in order)

```
1. N8AOPass (SSAO)
   aoRadius: 2.0
   distanceFalloff: 1.0
   intensity: 3.0
   halfRes: true
   aoSamples: 16

2. GodraysPass (only for rooms with windows)
   density: 1/128
   maxDensity: 0.5
   edgeStrength: 2
   raymarchSteps: 60

3. BloomEffect
   intensity: 0.8
   luminanceThreshold: 0.8
   luminanceSmoothing: 0.075
   mipmapBlur: true

4. TiltShiftEffect
   focusArea: 0.35
   feather: 0.25
   offset: -0.05
   kernelSize: 3

5. LUT3DEffect OR HueSaturation + BrightnessContrast
   (per-room presets -- see color palette section)

6. VignetteEffect
   offset: 0.3
   darkness: 0.6

7. ToneMappingEffect
   mode: ACESFilmic
   exposure: 1.0 (adjust per room: 0.6 dark, 1.2 bright)
```

### Per-Room Grading Presets

```javascript
const roomPresets = {
  throneRoom:     { hue: 0.05,  sat: 0.2,  bright: 0.05,  contrast: 0.1,  exposure: 1.0 },
  antechamber:    { hue: 0.02,  sat: 0.1,  bright: -0.02, contrast: 0.08, exposure: 0.95 },
  smallCouncil:   { hue: 0.08,  sat: 0.15, bright: -0.05, contrast: 0.08, exposure: 0.85 },
  handsSolar:     { hue: 0.06,  sat: 0.15, bright: 0.0,   contrast: 0.05, exposure: 0.9 },
  grandGallery:   { hue: -0.02, sat: 0.1,  bright: 0.08,  contrast: 0.05, exposure: 1.1 },
  guardPost:      { hue: -0.08, sat: -0.1, bright: -0.05, contrast: 0.15, exposure: 0.8 },
  maegorsEntry:   { hue: -0.05, sat: -0.15,bright: -0.1,  contrast: 0.2,  exposure: 0.7 },
  queensBallroom: { hue: 0.06,  sat: 0.2,  bright: 0.0,   contrast: 0.08, exposure: 1.0 },
  towerStairwell: { hue: -0.1,  sat: -0.1, bright: -0.15, contrast: 0.18, exposure: 0.65 },
  battlements:    { hue: -0.05, sat: 0.05, bright: 0.1,   contrast: 0.1,  exposure: 1.15 },
};
```

### Lighting Setup Per Room Type

```
GRAND ROOMS (Throne Room, Ballroom, Gallery):
  Directional: color 0xFFF4E0, intensity 1.5, shadow 2048px
  Ambient: color 0x404060, intensity 0.3
  Point lights (torches): color 0xFF6622, intensity 2.0, range 15, flicker ON
  God rays: ENABLED

INTIMATE ROOMS (Council, Solar):
  Directional: NONE (no windows) or dim
  Ambient: color 0x302020, intensity 0.2
  Point lights (candles): color 0xFF8844, intensity 1.5, range 10, flicker ON
  God rays: DISABLED

DARK ROOMS (Guard Post, Maegor's, Stairwell):
  Directional: NONE or very dim
  Ambient: color 0x202030, intensity 0.15
  Point lights (sparse torches): color 0xFF5500, intensity 2.5, range 12, flicker ON
  God rays: DISABLED

OPEN ROOMS (Battlements):
  Directional: color 0xFFFFEE, intensity 2.0, shadow 2048px
  Ambient: color 0x606080, intensity 0.4
  Point lights: minimal
  God rays: ENABLED (sun through crenellations)
```

### Sprite Rendering
```
Geometry: PlaneGeometry (not THREE.Sprite)
Billboard: Y-axis only (rotate around vertical to face camera)
Texture filter: NearestFilter (min and mag)
Mipmaps: disabled
Alpha: alphaTest 0.5
Depth: depthWrite true, depthTest true
Shadow: castShadow true (for shadow mapping)
Supplemental: circular blob shadow on ground (0.3 opacity, 1.5x character width)
Color space: SRGBColorSpace
```

---

## 11. Sources

### Official Developer Resources
- [Octopath Traveler HD-2D Art Style Spotlight (Unreal Engine)](https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true)
- [Octopath Traveler II HD-2D Style Interview (Unreal Engine)](https://www.unrealengine.com/en-US/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style)
- [The Fusion of Nostalgia and Novelty -- Unreal Fest Europe 2019 Presentation](https://www.unrealengine.com/en-US/events/unreal-fest-europe-2019/the-fusion-of-nostalgia-and-novelty-in-the-development-of-octopath-traveler)
- [Unreal Fest Europe 2019 Talk Recording (Epic Developer Community)](https://dev.epicgames.com/community/learning/talks-and-demos/8E3/the-fusion-of-nostalgia-and-novelty-in-octopath-traveler-unreal-fest-europe-2019-unreal-engine)

### Developer Interviews
- [Octopath Traveler II Devs on "Picture-Perfect" Visuals (Nintendo Life)](https://www.nintendolife.com/news/2022/10/octopath-traveler-ii-devs-aimed-to-make-its-hd-2d-visuals-picture-perfect)
- [Octopath Traveler Devs on Character Origins, Visual Style (Nintendo Everything)](https://nintendoeverything.com/octopath-traveler-devs-on-character-origins-visual-style-initial-hd-rumble-plans-much-more/)
- [Octopath Traveler II Evolved HD-2D (Nintendo Everything)](https://nintendoeverything.com/octopath-traveler-ii-devs-on-the-games-evolved-use-of-hd-2d-and-more/)
- [Octopath Traveler II Interview on HD-2D Art Style (GamerBraves)](https://www.gamerbraves.com/octopath-traveler-ii-interview-producer-talks-on-character-interaction-and-further-evolving-the-hd-2d-art-style/)
- [Untold Stories of Octopath Traveler Development (Apartment 507)](https://www.apartment507.com/blogs/japan-gaming/untold-stories-of-octopath-traveler-development-surpassing-the-deified-pixel-art)
- [Triangle Strategy Producers on HD-2D (Nintendo Life)](https://www.nintendolife.com/news/2022/05/triangle-strategy-producers-talk-hd-2d-and-why-other-devs-havent-used-it)
- [Live A Live Dev on HD-2D Choice (Nintendo Everything)](https://nintendoeverything.com/live-a-live-dev-on-remakes-origins-why-its-hd-2d/)
- [Live A Live Director on HD-2D Style (Nintendo Wire)](https://nintendowire.com/news/2022/04/11/live-a-live-director-takashi-tokita-discusses-remake-reveals-reason-behind-hd-2d-style/)
- [Octopath Traveler II Presentation and Nostalgia (Nintendo Wire)](https://nintendowire.com/news/2022/10/31/octopath-traveler-ii-devs-on-presentation-and-not-succumbing-to-pure-pixel-art-nostalgia/)

### Technical Analysis & Modding
- [Octopath Traveler Visual Clarity Patch (GBAtemp)](https://gbatemp.net/threads/octopath-traveler-visual-clarity-patch.584489/)
- [Octopath Traveler PC Settings and Config (PCGamingWiki)](https://www.pcgamingwiki.com/wiki/Octopath_Traveler)
- [Octopath Traveler II PC Settings (PCGamingWiki)](https://www.pcgamingwiki.com/wiki/Octopath_Traveler_II)
- [Dragon Quest III HD-2D Remake PC Settings (PCGamingWiki)](https://www.pcgamingwiki.com/wiki/Dragon_Quest_III_HD-2D_Remake)
- [Tim Soret on Pixel Art Filtering and Octopath Traveler (Twitter thread)](https://x.com/timsoret/status/1017673147590561793)
- [Octopath Traveler Disable DoF Guide (Steam Community)](https://steamcommunity.com/app/921570/discussions/0/1640913421077220954/)
- [Dragon Quest III HD-2D Steam Deck Performance (SteamDeckHQ)](https://steamdeckhq.com/game-reviews/dragon-quest-3-hd-2d-remake/)

### Community Analysis & Discussion
- [HD-2D Wikipedia Article](https://en.wikipedia.org/wiki/HD-2D)
- [Are HD-2D Graphics Improving or Holding Back Pixel Art? (CBR)](https://www.cbr.com/hd2d-graphics-holding-pixel-art-back/)
- [Is It Time For HD-2D To Take A Break? (Nintendo Life)](https://www.nintendolife.com/features/talking-point-is-it-time-for-hd-2d-to-take-a-break)
- [HD-2D Graphics Discussion (ResetEra)](https://www.resetera.com/threads/so-am-i-the-only-one-who-hates-the-new-2d-hd-graphics.560125/)
- [How Live A Live Changed Opinion of HD-2D (Noisy Pixel)](https://noisypixel.net/live-a-live-changed-my-opinion-hd-2d/)
- [Octopath Traveler Camera and Asset Positioning (Unity Discussions)](https://discussions.unity.com/t/id-like-to-recreate-the-same-camera-and-asset-positioning-of-octopath-traveler/798781)
- [Octopath Traveler Shadow Handling (Unity Discussions)](https://discussions.unity.com/t/how-do-games-like-octopath-traveler-handle-the-angle-of-shadows-and-is-this-even-possible-in-unity-urp/246459)

### HD-2D Recreation Tutorials
- [How to Make HD-2D Style Games with Unreal Engine 5 (Epic Developer Community)](https://dev.epicgames.com/community/learning/tutorials/3X56/how-to-make-hd-2d-style-games-with-unreal-engine-5)
- [Mixing 2D Billboards and 3D Environments (80.lv)](https://80.lv/articles/mixing-2d-billboards-and-3d-environments-in-a-game)
- [Billboard Sprites Technique (Tim Wheeler)](https://timallanwheeler.com/blog/2023/05/29/billboard-sprites/)
- [3D Pixel Art Rendering (David Holland)](https://www.davidhol.land/articles/3d-pixel-art-rendering/)

### UE4 Console Variables (from modding community)
- `r.DepthOfFieldQuality=0` -- disables depth of field
- `r.BloomQuality=0` -- disables bloom
- `r.MotionBlurQuality=0` -- disables motion blur
- `r.AmbientOcclusionLevels` -- controls AO quality
- `r.AmbientOcclusionFadeRadiusScale` -- controls AO fade
- `r.ScreenPercentage=150` -- supersampling for clarity
- `r.PostProcessAAQuality` -- anti-aliasing quality

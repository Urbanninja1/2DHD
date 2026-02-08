# HD-2D Asset Pipeline Best Practices -- Comprehensive Research

**Date:** 2026-02-06
**Purpose:** Actionable guide for building a complete asset base for an HD-2D medieval castle game (Three.js / WebGL). Covers sourcing, creation, compression, and optimization of PBR textures, 3D models, pixel-art sprites, and parallax backgrounds.

**Project context:** The game uses Three.js with `MeshStandardMaterial` PBR, GLTF/GLB models, billboard pixel-art sprites on `PlaneGeometry`, parallax layers, and a full post-processing stack (SSAO, bloom, tilt-shift, god rays, color grading). Setting is a medieval castle (Red Keep). Desktop browsers only.

---

## Table of Contents

1. [Free CC0 PBR Texture Sources](#1-free-cc0-pbr-texture-sources)
2. [Free 3D Model Sources](#2-free-3d-model-sources)
3. [Procedural Texture Generation](#3-procedural-texture-generation)
4. [AI Texture Generation](#4-ai-texture-generation)
5. [HD-2D Sprite Creation](#5-hd-2d-sprite-creation)
6. [Parallax Background Creation](#6-parallax-background-creation)
7. [KTX2 Texture Compression](#7-ktx2-texture-compression)
8. [Asset Optimization for WebGL](#8-asset-optimization-for-webgl)
9. [Recommended Asset Manifest for Red Keep](#9-recommended-asset-manifest-for-red-keep)

---

## 1. Free CC0 PBR Texture Sources

### Tier 1 -- Primary Sources (Best Quality, Fully CC0)

| Site | URL | Texture Count | Max Resolution | Maps Included | Notes |
|------|-----|---------------|----------------|---------------|-------|
| **Poly Haven** | https://polyhaven.com/textures | 800+ | 8K | Diffuse, Normal, Roughness, AO, Displacement | Gold standard. Photogrammetry-based. Fully CC0. No registration. |
| **ambientCG** | https://ambientcg.com | 2,000+ | 8K | Diffuse, Normal, Roughness, AO, Displacement, Metalness | Largest free CC0 library. Includes procedural and photoscanned. |
| **LotPixel** | https://www.lotpixel.com | 1,500+ | 8K | Diffuse, Normal, Roughness, AO, Metalness, Displacement (EXR) | Scan-level realism. Free for commercial use. Includes stone, wood, metal, fabric. |

### Tier 2 -- Good Supplementary Sources

| Site | URL | Notes |
|------|-----|-------|
| **Share Textures** | https://www.sharetextures.com | CC0 PBR sets including wood, stone, wall, ground, metal. |
| **3D Textures** | https://3dtextures.me | No registration. Organized categories. Full PBR map sets. |
| **TextureCan** | https://www.texturecan.com | Photogrammetry-based. Includes medieval-specific textures like "Brick Wall of Medieval Forts." |
| **cgbookcase** | https://www.cgbookcase.com | CC0. Smaller library but high quality. |

### Medieval Castle-Specific Textures to Download

For the Red Keep project, prioritize these material categories:

**Stone (floors, walls, columns):**
- `castle_wall_slates` -- rough-cut stone blocks (Poly Haven: "castle_brick" or ambientCG: "PavingStones")
- `stone_floor_tiles` -- large flagstones (ambientCG: "Tiles" category)
- `rough_stone` -- hewn stone for stairwells and holdfast (ambientCG: "Rock" category)
- `worn_stone` -- weathered stone for battlements (Poly Haven: "brown_rock")

**Wood (doors, furniture, ceiling beams):**
- `dark_wood_floor` -- polished dark wood for ballroom (ambientCG: "WoodFloor" sets)
- `wood_planks` -- rough-hewn planks for Guard Post (ambientCG: "WoodPlanks" sets)
- `ornate_wood_panel` -- carved wood for Solar, Council (Poly Haven: "wood_cabinet")

**Metal (armor, weapons, sconces, throne):**
- `dark_iron` -- for Iron Throne, weapon racks, braziers (ambientCG: "Metal" category)
- `polished_metal` -- for armor stands, fixtures (Poly Haven: "metal_plate")

**Fabric (tapestries, banners, carpets):**
- `red_fabric` -- Targaryen/Lannister banners (ambientCG: "Fabric" category)
- `woven_carpet` -- for throne room runner (Poly Haven: "fabric" sets)

**Decorative:**
- `stained_glass` -- for throne room windows (may need custom creation)
- `marble` -- for dais/raised platforms (ambientCG: "Marble" sets)

### Ideal Resolution and Format for WebGL

**Resolution recommendation for this project:**

| Use Case | Source Resolution | Delivery Resolution | Rationale |
|-----------|-------------------|---------------------|-----------|
| Floor textures (large tiling surfaces) | Download 2K | Deliver 1K (1024x1024) | Floors tile across the room; 1K with good tiling is plenty |
| Wall textures | Download 2K | Deliver 1K | Walls are visible but not close-up |
| Prop textures (throne, tables) | Download 1K | Deliver 512x512 | Props are small; 512 is sufficient |
| Ceiling textures | Download 1K | Deliver 512x512 | Ceiling is blurred by tilt-shift DoF |
| Detail textures (close-up) | Download 4K | Deliver 2K (2048x2048) | Only for hero surfaces like the Iron Throne |

**Format:**
- **Source files:** Download as PNG (lossless) for archival
- **Development:** Use JPEG at source resolution (current approach works)
- **Production:** Convert to KTX2 with Basis Universal compression (see Section 7)
- **Color space:** Diffuse/albedo maps must be `SRGBColorSpace`; normal/roughness/AO maps must be `NoColorSpace` (linear data)

**Current project status:** 7 PBR texture sets already exist at `D:\Projects\2DHD\public\assets\textures\` in JPEG format at roughly 1K resolution. Textures range from 300KB to 1.2MB each. This is a good foundation -- these are already in the correct directory structure (`basePath/diffuse.jpg`, `basePath/normal.jpg`, `basePath/roughness.jpg`) matching the `loadPBRTexture()` function in `D:\Projects\2DHD\src\loaders\texture-loaders.ts`.

---

## 2. Free 3D Model Sources

### Primary Sources for Medieval Props

| Site | URL | Format | License | Best For |
|------|-----|--------|---------|----------|
| **Poly Haven** | https://polyhaven.com/models | GLTF/GLB, FBX, Blend | CC0 | Architectural elements, basic props |
| **Sketchfab** (CC0 filter) | https://sketchfab.com/tags/medieval-props | GLTF download | CC0, CC-BY | Huge variety. Filter by "Downloadable" + "CC0" |
| **Poly Pizza** | https://poly.pizza | GLTF | CC0 | Low-poly stylized props (good for HD-2D) |
| **Quaternius** | https://quaternius.com | GLTF, FBX | CC0 | Game-ready low-poly packs |
| **KayKit** | https://kaylousberg.com/game-assets | GLTF, FBX, OBJ | CC0 | Medieval dungeon and castle themed packs |
| **OpenGameArt** | https://opengameart.org | Various | CC0, CC-BY, GPL | Broad community collection |
| **itch.io** | https://itch.io/game-assets/tag-medieval | Various | Mixed | Free packs: "Free Medieval Props 3D Low Poly Models" |
| **CraftPix** | https://craftpix.net/freebies/ | Various | Free license | "Free Medieval Props 3D Low Poly Pack" (28 models) |

### Key Sketchfab Collections for Medieval Castle

Search Sketchfab with these queries (filter by "Downloadable" and "Free"):

- **"Low Poly Medieval Environment Pack (35+ Props)"** by anastasita.3d -- barrels, crates, tables, chairs, shields
- **"Low poly Pack Medieval/fantasy"** by JhonPoly -- barrels, buckets, crates, lamps, fences
- **"Medieval Props Pack"** by Ruslan Malovsky -- thrones, tables, weapon racks

### Props Needed for Red Keep Rooms

| Room | Required Props | Where to Find |
|------|---------------|---------------|
| **Throne Room** | Iron Throne, columns, banners, sconces | Throne: custom or Sketchfab "throne medieval"; Columns: Quaternius "dungeon pack" |
| **Antechamber** | Kingsguard statues, oak doors, benches | Sketchfab "medieval statue", "wooden door" |
| **Small Council** | Painted table, chairs, candelabras, maps | Sketchfab "medieval table", Poly Pizza "candelabra" |
| **Hand's Solar** | Desk, bookshelves, scrolls, hearth | Sketchfab "medieval desk", KayKit dungeon pack |
| **Grand Gallery** | Columns, tapestries, arched windows | Quaternius architectural pack, custom tapestry planes |
| **Guard Post** | Armor stands, weapon racks, brazier | KayKit "medieval dungeon", Sketchfab "weapon rack" |
| **Maegor's Entry** | Portcullis, torch brackets, murder holes | Sketchfab "portcullis", "medieval gate" |
| **Queen's Ballroom** | Gilded fixtures, musician gallery, chandelier | Sketchfab "chandelier medieval", custom planes |
| **Tower Stairwell** | Spiral stairs geometry, arrow slits | Custom geometry or Sketchfab "spiral staircase" |
| **Battlements** | Crenellations, flagpoles, braziers | KayKit castle pack, Quaternius |

### Format Considerations

**Prefer GLTF/GLB format.** If models are in OBJ or FBX:

1. **Blender** (free) -- Import FBX/OBJ, export as GLB with "Apply Modifiers" and embedded textures
2. **gltf-transform** CLI -- Post-process: `gltf-transform optimize input.glb output.glb`
3. **Online converter** -- https://products.aspose.app/3d/conversion/fbx-to-glb

**Polygon budget per prop:**
- Simple props (barrels, crates): 100-500 triangles
- Medium props (tables, chairs): 500-2,000 triangles
- Complex props (throne, chandelier): 2,000-5,000 triangles
- Architectural (columns, arches): 500-1,500 triangles
- **Total per room target:** Under 50,000 triangles (including room geometry)

---

## 3. Procedural Texture Generation

### Approach 1: Canvas-Based (Current Implementation)

The project already uses canvas-based procedural textures in `D:\Projects\2DHD\src\rendering\placeholder-textures.ts`. This approach creates `CanvasTexture` objects via the HTML5 Canvas 2D API.

**Strengths:** Zero network requests, instant loading, small bundle size.
**Weaknesses:** Limited to 2D painting operations; no true PBR normal/roughness generation; looks flat.

**Improving the current canvas approach:**

```javascript
// Generate a pseudo-normal map from a heightmap canvas
function canvasToNormalMap(heightCanvas, strength = 2.0) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const ctx = heightCanvas.getContext('2d');
  const heightData = ctx.getImageData(0, 0, w, h).data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const nCtx = normalCanvas.getContext('2d');
  const normalData = nCtx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const left   = heightData[((y * w + ((x - 1 + w) % w)) * 4)];
      const right  = heightData[((y * w + ((x + 1) % w)) * 4)];
      const top    = heightData[((((y - 1 + h) % h) * w + x) * 4)];
      const bottom = heightData[((((y + 1) % h) * w + x) * 4)];

      const dx = (left - right) * strength / 255;
      const dy = (top - bottom) * strength / 255;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

      normalData.data[idx + 0] = ((dx / len) * 0.5 + 0.5) * 255;
      normalData.data[idx + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      normalData.data[idx + 2] = ((dz / len) * 0.5 + 0.5) * 255;
      normalData.data[idx + 3] = 255;
    }
  }

  nCtx.putImageData(normalData, 0, 0);
  return normalCanvas;
}
```

### Approach 2: GLSL Shader-Based Procedural Textures

For higher quality procedural textures, render to a `WebGLRenderTarget` using custom GLSL shaders:

```javascript
// Render a noise-based texture to an offscreen target
const rtSize = 512;
const renderTarget = new THREE.WebGLRenderTarget(rtSize, rtSize);
const noiseMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uScale: { value: 8.0 },
    uColor1: { value: new THREE.Color(0x3a3a3a) },
    uColor2: { value: new THREE.Color(0x4a4540) },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float uScale;
    uniform vec3 uColor1, uColor2;
    varying vec2 vUv;

    // Classic Perlin noise (abbreviated)
    float noise(vec2 p) { /* ... simplex noise implementation ... */ }

    void main() {
      float n = noise(vUv * uScale);
      vec3 color = mix(uColor1, uColor2, n);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});

// Render offscreen, then read the texture
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), noiseMaterial);
const scene = new THREE.Scene();
scene.add(quad);
renderer.setRenderTarget(renderTarget);
renderer.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
renderer.setRenderTarget(null);

// renderTarget.texture is now a GPU texture you can use as a map
material.map = renderTarget.texture;
```

**The vite-plugin-glsl package** (already in the project's dependencies) supports importing `.glsl` files directly, making shader-based procedural textures clean to implement.

### Approach 3: Noise Libraries for JavaScript

- **simplex-noise** (npm) -- Fast 2D/3D/4D simplex noise. Use to generate heightmaps on canvas, then derive normal maps.
- **noisejs** (npm) -- Perlin and Simplex noise.
- Use Voronoi noise for stone block patterns, FBM (Fractal Brownian Motion) for natural stone variation.

### When to Use Procedural vs. Downloaded Textures

| Scenario | Recommendation |
|----------|---------------|
| Prototyping / development | Canvas procedural (current approach) |
| Final production surfaces | Downloaded CC0 PBR from Poly Haven / ambientCG |
| Unique surfaces (stained glass) | Shader-based procedural or AI-generated |
| Variation (10 slightly different stones) | Base downloaded texture + shader-based color/noise variation |

---

## 4. AI Texture Generation

### Tool Comparison

| Tool | Type | Cost | PBR Maps | Quality | Best For |
|------|------|------|----------|---------|----------|
| **Ubisoft CHORD** | Open-source (ComfyUI node) | Free (research license) | Full svBRDF: BaseColor, Normal, Height, Roughness, Metalness | AAA quality | Best open-source option. From diffuse image to full PBR. |
| **GenPBR** | Web app | Free tier | Normal, Metallic, Roughness, AO, Height | Good | Quick single-image to PBR conversion |
| **3D AI Studio** | Web app | Free tier | Normal, Roughness, Height | Good | Simple browser-based workflow |
| **Scenario** | SaaS | Paid (free trial) | Full PBR set | Excellent | Production game studios |
| **ArmorLab** | Desktop app | Free (open source) | BaseColor, Normal, Height, Roughness, AO | Good | Text-to-material and photo-to-PBR |
| **PBRify Remix** | Open-source AI models | Free (CC0 trained) | Upscale + generate Normal, PBR maps | Very good | Ethically trained on CC0 data only (ambientCG + Poly Haven) |
| **Texxary Lamron** | Web app | Free tier | Albedo, Normal, Roughness, Height | Good | Single-photo instant PBR |
| **D5 Material Snap** | Desktop (D5 Render) | Free in D5 | Normal, Roughness | Good | For D5 Render users |

### Recommended Workflow for This Project

**Primary: Download CC0 textures** from Poly Haven / ambientCG (fastest, highest quality, no licensing concerns).

**Secondary: Use CHORD for custom textures** when you need something specific (e.g., a Red Keep-specific stone pattern):

1. Generate a base diffuse image using Stable Diffusion / DALL-E with a prompt like: "seamless tileable medieval castle stone wall texture, dark grey, mortar lines, weathered"
2. Run through CHORD (via ComfyUI) to generate Normal, Height, Roughness, and Metalness maps
3. Use PBRify Remix to upscale to 2K if needed
4. Save as JPEG, drop into `public/assets/textures/` in the project structure

**CHORD setup:**
- GitHub: https://github.com/ubisoft/ubisoft-laforge-chord
- Hugging Face model: https://huggingface.co/Ubisoft/ubisoft-laforge-chord
- ComfyUI custom nodes available for drag-and-drop workflows
- License: Research-only (verify terms for your use case)

**PBRify Remix setup:**
- GitHub: https://github.com/Kim2091/PBRify_Remix
- Trained exclusively on CC0 content from ambientCG and Poly Haven
- Works with chaiNNer (node-based image processing tool)
- Models: 4x upscaler (SPAN or SwinIR) + Normal map generator + PBR map generator

### Quick Single-Image PBR Generation (Browser-Based)

For fast iteration without installing anything:

1. Go to https://genpbr.com
2. Upload your diffuse/color texture image
3. Download generated Normal, Roughness, AO, and Height maps
4. Place in your project's texture directory

---

## 5. HD-2D Sprite Creation

### Sprite Specifications for HD-2D

Based on analysis of Octopath Traveler sprites (extracted from The Spriters Resource) and the existing project code:

| Property | Recommended Value | Rationale |
|----------|-------------------|-----------|
| **Canvas size** | 32x48 pixels (per frame) | Characters need enough height for proportional bodies. 32 wide gives good detail. |
| **Character height** | ~40 pixels (within the 48px frame) | Leaves headroom and ground padding |
| **Pixel scale** | 1 sprite pixel = 10-12 screen pixels | At 1080p with the HD-2D camera distance, this gives the classic "chunky pixel" look |
| **Color palette** | 12-20 colors per character | HD-2D sprites use limited palettes like SNES-era art. More than 24 colors looks wrong. |
| **Outline** | 1px dark outline (not pure black) | Use a darkened version of the adjacent color. Pure black looks harsh. |
| **Texture filtering** | `NearestFilter` (both min and mag) | Preserves crisp pixel edges -- essential |
| **Mipmaps** | Disabled | Mipmaps would blur the pixel art at distance |
| **Alpha** | `alphaTest: 0.5` (hard cutoff) | Avoids depth-sorting issues with transparent edges |

### Animation Frame Counts

| Animation | Frames | Frame Rate | Notes |
|-----------|--------|------------|-------|
| **Idle** | 2-4 frames | 4 FPS (250ms per frame) | Subtle breathing motion. Most HD-2D NPCs use 2-frame idle. |
| **Walk (per direction)** | 4 frames | 8 FPS (125ms per frame) | Classic 4-frame walk cycle: stand, step-left, stand, step-right |
| **Walk (8-directional)** | 4 frames x 4 directions = 16 total | 8 FPS | Only need 4 directions; flip horizontally for the other 4 |
| **Stand (per direction)** | 1 frame x 4 directions = 4 total | N/A | Static facing sprites |

**Sprite sheet layout (recommended):**

```
Row 0: Walk Down  (4 frames, 32x48 each)
Row 1: Walk Left  (4 frames) -- mirror for Walk Right
Row 2: Walk Up    (4 frames)
Row 3: Idle Down  (2-4 frames)
```

Total sprite sheet size: 128 x 192 pixels (4 columns x 4 rows at 32x48 per cell).

### Tools for Creating HD-2D Sprites

**Manual Creation (Highest Quality):**

| Tool | URL | Cost | Platform |
|------|-----|------|----------|
| **Aseprite** | https://www.aseprite.org | $20 (or compile free from source) | Windows/Mac/Linux |
| **Piskel** | https://www.piskelapp.com | Free (web) | Browser |
| **Lospec Pixel Editor** | https://lospec.com/pixel-editor | Free (web) | Browser |
| **GIMP** | https://www.gimp.org | Free | Windows/Mac/Linux |
| **GraphicsGale** | https://graphicsgale.com | Free | Windows |

**Aseprite is the strongly recommended choice.** It has:
- Built-in animation timeline with onion skinning
- Sprite sheet export (JSON + PNG)
- Palette management and color cycling
- Frame tagging (tag "walk_down", "idle", etc.)
- Tilemap support
- Active community with HD-2D pixel art tutorials

**AI-Assisted Sprite Generation:**

| Tool | URL | Notes |
|------|-----|-------|
| **PixelLab** | https://www.pixellab.ai | Text-prompt and skeleton-based sprite generation. Outputs walk/run/attack animations. |
| **Perchance AI Pixel Art** | https://perchance.org/ai-pixel-art-generator | Free, no sign-up. Text-to-pixel-art. Good for concept art. |
| **Pixelcut RPG Maker** | https://www.pixelcut.ai/create/rpg-pixel-character-maker | Describe character appearance in text, get sprite output. |

**Workflow recommendation:**
1. Use AI tools to generate initial concepts and poses
2. Refine manually in Aseprite (AI sprites rarely have correct pixel density or animation consistency)
3. Export as sprite sheet PNG
4. Place in `public/assets/sprites/`

### Free Existing Sprite Resources

| Source | URL | Notes |
|--------|-----|-------|
| **OpenGameArt** | https://opengameart.org | Search "medieval RPG character sprite" -- many CC0 sets |
| **The Spriters Resource** | https://www.spriters-resource.com | Reference for sprite dimensions and animation frame structure (do not use copyrighted sprites) |
| **itch.io** | https://itch.io/game-assets/tag-pixel-art/tag-medieval | Many free medieval sprite packs |
| **Kenney** | https://kenney.nl/assets | CC0 game assets including character sprites |

### Sprite Integration in Three.js (Current Implementation)

The project already has the correct sprite rendering setup in `D:\Projects\2DHD\src\rendering\sprite-factory.ts`:
- Y-axis-only billboard rotation
- NearestFilter texture filtering
- alphaTest cutoff
- castShadow enabled

The current sprites are 16x16 procedural placeholders. Upgrading to 32x48 real sprites requires:
1. Creating/sourcing the sprite sheet images
2. Updating the PlaneGeometry dimensions to match the new aspect ratio (32:48 = 2:3)
3. Implementing sprite sheet UV animation for walk cycles

---

## 6. Parallax Background Creation

### HD-2D Parallax Design Principles

In HD-2D games, parallax backgrounds are used for:
- **Outdoor rooms** (Battlements Overlook): Distant cityscape, mountains, sky
- **Rooms with large windows**: Visible exterior through window openings
- **Deep rooms**: Distant walls or passages seen through doorways

The project already defines a `ParallaxLayerDef` interface in `D:\Projects\2DHD\src\rooms\room-data\types.ts` with `texturePath`, `depth`, `scrollFactor`, `height`, and `yOffset`.

### Layer Structure for the Battlements Overlook

The Battlements Overlook (Room 10) needs a panoramic view of King's Landing:

```
Layer 0 (furthest):  Sky gradient with clouds        scrollFactor: 0.0  (static)
Layer 1:             Distant mountains / Blackwater   scrollFactor: 0.05
Layer 2:             Far city rooftops                scrollFactor: 0.10
Layer 3:             Mid-distance buildings            scrollFactor: 0.20
Layer 4:             Near buildings / Red Keep walls   scrollFactor: 0.35
Layer 5 (closest):   Foreground battlement details     scrollFactor: 0.60
```

Each layer is a wide PNG with transparency, rendered on a `PlaneGeometry` positioned behind the room at varying Z depths.

### Creating Parallax Layers

**Option A: Download Pre-Made Packs**

| Source | URL | Notes |
|--------|-----|-------|
| **itch.io** | https://itch.io/game-assets/tag-medieval/tag-parallax | Free medieval parallax backgrounds with separate layers |
| **CraftPix** | https://craftpix.net/freebies/free-castle-interior-pixel-game-backgrounds/ | Free Castle Interior Pixel Game Backgrounds (pre-layered) |
| **Arludus** | https://arludus.itch.io/2d-pixel-art-medieval-backgrounds-pack | 2D Pixel Art Medieval Backgrounds Pack -- layers separate for parallax |

**Option B: Create Custom Layers in Pixel Art Tools**

Recommended workflow:

1. **Sketch the full panorama** in Aseprite or Krita at the target resolution
2. **Separate into layers** by depth (sky, far, mid, near, foreground)
3. **Each layer** should be wider than the viewport (2x-3x) to allow scrolling
4. **Export each layer** as a separate PNG with transparency
5. **Use consistent pixel density** across all layers (same "pixel size" as sprites)

**Resolution recommendations:**

| Layer | Width | Height | Format |
|-------|-------|--------|--------|
| Sky (static) | 1920px | 540px | PNG (no alpha needed) |
| Far layers | 2560px | 540px | PNG with alpha |
| Mid layers | 3200px | 540px | PNG with alpha |
| Near layers | 3840px | 540px | PNG with alpha |

**Option C: Hybrid Approach (3D Rendered Background + 2D Layer Overlay)**

For a more HD-2D-authentic look:
1. Model the distant cityscape as simple 3D geometry (block shapes)
2. Render a high-resolution panoramic screenshot from the Three.js scene
3. Paint pixel-art details over it in Aseprite
4. Separate into parallax layers

### Tools for Creating Parallax Backgrounds

| Tool | Use For | Notes |
|------|---------|-------|
| **Aseprite** | Pixel-art backgrounds | Best for maintaining consistent pixel density with sprites |
| **Krita** | Painted backgrounds | Free, powerful brush engine, layer management |
| **Photoshop** | Photo-manipulation | Industry standard but paid |
| **GIMP** | Free alternative to Photoshop | Layer management, transparency |
| **Parallax Maker** (Photoshop plugin) | Automated layer separation | Splits a single image into depth layers |

### Implementation Notes

The parallax layers should scroll relative to camera movement using the `scrollFactor`:

```javascript
// In the render loop, for each parallax layer:
layer.position.x = cameraOffset.x * layer.scrollFactor;
layer.position.y = layer.yOffset; // fixed vertical position
layer.position.z = -roomDepth - layer.depth; // behind the room
```

Lower `scrollFactor` = further away (moves slower). `scrollFactor: 0` = completely static (sky).

---

## 7. KTX2 Texture Compression

### Why KTX2 for This Project

The project already has KTX2 infrastructure set up in `D:\Projects\2DHD\src\loaders\texture-loaders.ts`:
- `KTX2Loader` configured with Basis Universal transcoder
- `GLTFLoader` with KTX2 support
- Texture validation function

**Benefits of KTX2 over JPEG for WebGL games:**

| Metric | JPEG (current) | KTX2 (UASTC) | KTX2 (ETC1S) |
|--------|---------------|---------------|---------------|
| File size (1K texture) | ~500KB | ~700KB | ~200KB |
| GPU memory (1K, with mipmaps) | 5.6 MB (uncompressed RGBA) | 1.4 MB (BC7/ASTC) | 700 KB |
| GPU upload time | Slow (must decompress) | Fast (stays compressed) | Fast |
| Visual quality | Good | Very good (near-lossless) | Good (some artifacts) |
| Mipmap generation | At runtime (expensive) | Pre-generated in file | Pre-generated in file |

A 4096x4096 JPEG with mipmaps consumes ~90 MB of GPU VRAM when decoded. The same texture as UASTC/BC7 uses only ~22 MB. For a game loading 10+ rooms with 3+ textures each, this difference is massive.

### Codec Selection: UASTC vs ETC1S

| Texture Type | Recommended Codec | Rationale |
|-------------|-------------------|-----------|
| **Diffuse / Albedo / Color** | ETC1S | High compression ratio (8:1). Minor quality loss is acceptable for color data. |
| **Normal maps** | UASTC | Normal maps demand precision. ETC1S causes visible banding and incorrect lighting. |
| **Roughness maps** | UASTC | Surface detail matters for PBR accuracy. |
| **Metalness maps** | ETC1S | Usually low-frequency data; ETC1S is fine. |
| **AO maps** | ETC1S | Low-frequency; compression artifacts not noticeable. |
| **Combined ORM (Occlusion/Roughness/Metalness)** | UASTC | Mixed data channels need higher fidelity. |

### Compression Commands

**Using `gltf-transform` CLI (recommended for project pipeline):**

```bash
# Install gltf-transform
npm install -g @gltf-transform/cli

# Compress diffuse textures with ETC1S (smaller, good enough for color)
gltf-transform etc1s input.glb output.glb \
  --slots "baseColorTexture,emissiveTexture" \
  --quality 255 \
  --verbose

# Compress normal/roughness with UASTC (higher quality)
gltf-transform uastc input.glb output.glb \
  --slots "normalTexture,occlusionTexture,metallicRoughnessTexture" \
  --level 4 \
  --rdo false \
  --zstd 18 \
  --verbose
```

**Using `toktx` (Khronos reference tool) for standalone textures:**

```bash
# Install KTX-Software: https://github.com/KhronosGroup/KTX-Software/releases

# Diffuse (ETC1S) -- good compression, acceptable quality
toktx --encode etc1s --clevel 4 --qlevel 255 --genmipmap \
  diffuse.ktx2 diffuse.jpg

# Normal map (UASTC) -- high quality, essential for normals
toktx --encode uastc --uastc_quality 4 --zcmp 22 --genmipmap \
  --assign_oetf linear --assign_primaries none \
  normal.ktx2 normal.jpg

# Roughness (UASTC)
toktx --encode uastc --uastc_quality 4 --zcmp 22 --genmipmap \
  --assign_oetf linear --assign_primaries none \
  roughness.ktx2 roughness.jpg
```

**Key flags:**
- `--genmipmap` -- Pre-generate mipmaps (avoids expensive runtime generation)
- `--zcmp 22` -- Zstandard supercompression (reduces UASTC file size by ~50%)
- `--uastc_quality 4` -- Highest UASTC quality level
- `--rdo false` -- Disable Rate-Distortion Optimization for maximum quality (use `--rdo true` with `--rdo-lambda 1-4` to trade quality for file size)
- `--assign_oetf linear` -- Mark non-color data as linear (for normal/roughness)
- `--clevel 4` -- ETC1S compression level (0-6, higher = slower but better)
- `--qlevel 255` -- ETC1S quality (1-255, higher = better)

### Build Pipeline Integration

Add a script to `package.json` to compress textures:

```json
{
  "scripts": {
    "compress-textures": "node scripts/compress-textures.mjs"
  }
}
```

The script would iterate over `public/assets/textures/*/`, compress each JPEG to KTX2, and output to a `public/assets/textures-ktx2/` directory. In production, the `loadPBRTexture()` function would load `.ktx2` files instead of `.jpg`.

### Loading KTX2 in Three.js (Already Configured)

The existing `createLoaders()` in `D:\Projects\2DHD\src\loaders\texture-loaders.ts` is already set up correctly. To use KTX2 textures:

```javascript
// Using the already-configured ktx2Loader
const texture = await ktx2Loader.loadAsync('assets/textures/stone/castle-wall-slates/diffuse.ktx2');
texture.colorSpace = THREE.SRGBColorSpace; // for diffuse
```

---

## 8. Asset Optimization for WebGL

### Draw Call Budget

**Target: Under 100 draw calls per room** for smooth 60fps on desktop.

Monitor with: `renderer.info.render.calls` (already accessible via the debug overlay at `D:\Projects\2DHD\src\debug\debug-overlay.ts`).

| Technique | Draw Call Reduction | Use Case |
|-----------|---------------------|----------|
| **InstancedMesh** | N objects -> 1 draw call | Repeated props (columns, sconces, torches) |
| **BatchedMesh** | N objects -> 1 draw call | Different geometries, same material |
| **Merged geometry** | N objects -> 1 draw call | Static room geometry (walls, floor, ceiling) |
| **Material sharing** | Enables batching | Share `MeshStandardMaterial` instances across meshes |
| **Texture atlas** | Reduces material count | Combine prop textures into one atlas |

### InstancedMesh for Repeated Props

The Throne Room has 16 columns at various positions. Instead of 16 separate meshes (16 draw calls):

```javascript
import * as THREE from 'three';

// Load column model once
const gltf = await gltfLoader.loadAsync('assets/models/props/column-stone.glb');
const columnGeometry = gltf.scene.children[0].geometry;
const columnMaterial = gltf.scene.children[0].material;

// Create InstancedMesh with all positions
const instancedColumns = new THREE.InstancedMesh(columnGeometry, columnMaterial, 16);
instancedColumns.castShadow = true;
instancedColumns.receiveShadow = true;

const matrix = new THREE.Matrix4();
const positions = [
  { x: 10, y: 0, z: -7 }, { x: 10, y: 0, z: -4 }, /* ...etc */
];

positions.forEach((pos, i) => {
  matrix.setPosition(pos.x, pos.y, pos.z);
  instancedColumns.setMatrixAt(i, matrix);
});

instancedColumns.instanceMatrix.needsUpdate = true;
scene.add(instancedColumns);
// Result: 1 draw call instead of 16
```

The project's room data already groups props by `modelPath` in the `ModelPropDef` type, which maps perfectly to InstancedMesh.

### Texture Atlas Strategy

**For PBR surface textures (floors, walls):** Do NOT atlas these. Each surface type tiles independently with different repeat values, which requires separate texture objects.

**For prop textures:** Atlas is beneficial when many small props share similar material properties.

**TexturePacker approach:**

1. Use TexturePacker (https://www.codeandweb.com/texturepacker) or free alternatives (https://free-tex-packer.com)
2. Pack all prop diffuse textures into one 2048x2048 atlas
3. Do the same for normal and roughness maps
4. Adjust UVs on models to reference atlas coordinates
5. All props can share one material with one texture bind

**Array Texture alternative (modern WebGL2):**

Instead of UV remapping, use `THREE.DataArrayTexture`:

```javascript
// Stack textures into an array texture (indexed by instance)
const arrayTexture = new THREE.DataArrayTexture(data, width, height, layerCount);
arrayTexture.format = THREE.RGBAFormat;
arrayTexture.type = THREE.UnsignedByteType;
arrayTexture.needsUpdate = true;

// In shader, access by layer index:
// texture(uTextureArray, vec3(vUv, float(textureIndex)))
```

This avoids UV remapping entirely and eliminates edge bleeding between atlas entries.

### DRACO Mesh Compression

**When to use DRACO:**
- Models with 1,000+ vertices
- Any model delivered over the network
- NOT for simple procedural geometry (the compression overhead is not worth it)

**Compression with gltf-transform:**

```bash
# Compress geometry with DRACO (typically 90-95% size reduction)
gltf-transform draco input.glb output.glb --method edgebreaker

# Full optimization pipeline: DRACO + dedup + flatten
gltf-transform optimize input.glb output.glb
```

**The project already has DRACO decoding set up** in `D:\Projects\2DHD\src\loaders\texture-loaders.ts`, using the WASM decoder from Google's CDN.

**Self-hosting recommendation:** For production, copy the DRACO decoder files locally instead of using CDN:

```bash
# Copy DRACO decoder from node_modules to public/
cp node_modules/three/examples/jsm/libs/draco/gltf/* public/draco/
```

Then update the path:
```javascript
dracoLoader.setDecoderPath('/draco/');
```

### LOD (Levels of Detail)

For this project's fixed camera angle and limited room sizes, full LOD systems are likely overkill. However, a simplified approach works well:

**Two-tier LOD for props:**
- **Close/visible props:** Full geometry + full PBR textures
- **Distant/background props:** Simplified geometry or flat sprite replacements

**In Three.js:**

```javascript
const lod = new THREE.LOD();
lod.addLevel(highPolyMesh, 0);    // Full detail when close
lod.addLevel(lowPolyMesh, 15);    // Simplified when >15 units away
lod.addLevel(spriteMesh, 30);     // Billboard sprite when >30 units away
scene.add(lod);
```

For the HD-2D camera angle, most props are at roughly the same distance from camera, so LOD provides less benefit than in a free-camera game.

### Memory Management

The project's `AssetManager` (`D:\Projects\2DHD\src\loaders\asset-manager.ts`) already implements reference counting for textures and models. Key best practices:

1. **Always release textures when unloading a room** -- the room transition system should call `releaseTexture()` and `releaseModel()` for all assets in the departing room.

2. **Monitor for leaks:** Check `renderer.info.memory.textures` and `renderer.info.memory.geometries` in the debug overlay. These should stay stable as rooms are loaded/unloaded.

3. **Object pooling for particles:** The dust mote and torch ember systems should reuse particle objects rather than creating/destroying them. (The current implementation in `D:\Projects\2DHD\src\rendering\particles\` should be reviewed for this.)

4. **Dispose ImageBitmaps explicitly:**
   ```javascript
   texture.source.data.close?.(); // for ImageBitmap-based textures
   texture.dispose();
   ```

### Complete Optimization Pipeline (Build Script)

For production asset preparation:

```bash
# 1. Optimize all GLTF/GLB models
for f in public/assets/models/**/*.glb; do
  gltf-transform optimize "$f" "$f.tmp" \
    --texture-compress ktx2 \
    --compress draco
  mv "$f.tmp" "$f"
done

# 2. Compress standalone textures to KTX2
for dir in public/assets/textures/*/; do
  # Diffuse -> ETC1S (smaller)
  toktx --encode etc1s --clevel 4 --qlevel 255 --genmipmap \
    "${dir}diffuse.ktx2" "${dir}diffuse.jpg"

  # Normal -> UASTC (higher quality)
  toktx --encode uastc --uastc_quality 4 --zcmp 22 --genmipmap \
    --assign_oetf linear --assign_primaries none \
    "${dir}normal.ktx2" "${dir}normal.jpg"

  # Roughness -> UASTC
  toktx --encode uastc --uastc_quality 4 --zcmp 22 --genmipmap \
    --assign_oetf linear --assign_primaries none \
    "${dir}roughness.ktx2" "${dir}roughness.jpg"
done

# 3. Validate sizes
find public/assets -name "*.ktx2" -exec ls -lh {} \;
```

---

## 9. Recommended Asset Manifest for Red Keep

### Phase 1: Minimum Viable Assets (Replace Placeholders)

This is what to source first, matching the 10 rooms defined in the room data files.

**Textures (7 sets needed minimum -- 5 already exist):**

| Texture Set | Source Recommendation | Status |
|------------|----------------------|--------|
| `stone/castle-wall-slates` | ambientCG "PavingStones082" or similar | DONE (exists) |
| `stone/stone-wall` | ambientCG "Bricks076" or Poly Haven "castle_brick" | DONE (exists) |
| `stone/rough-stone` | ambientCG "Rock037" | DONE (exists) |
| `stone/worn-stone` | Poly Haven "brown_rock_02" | DONE (exists) |
| `wood/dark-wood-floor` | ambientCG "WoodFloor041" | DONE (exists) |
| `wood/wood-planks` | ambientCG "WoodPlanks050" | DONE (exists) |
| `ceiling/dark-stone` | ambientCG "PavingStones" (darkened) | DONE (exists) |
| `metal/dark-iron` | ambientCG "Metal032" or Poly Haven "rusty_metal" | NEEDED |
| `fabric/red-tapestry` | ambientCG "Fabric038" (tinted) | NEEDED |
| `marble/polished` | ambientCG "Marble012" | NEEDED |
| `wood/ornate-panel` | Poly Haven "wood_cabinet_worn" | NEEDED |

**3D Models (minimum set):**

| Model | Priority | Source Suggestion |
|-------|----------|-------------------|
| `column-stone.glb` | HIGH | Quaternius "Fantasy Medieval" pack or Sketchfab |
| `sconce-iron.glb` | HIGH | KayKit dungeon pack or Sketchfab "wall sconce" |
| `throne.glb` | HIGH | Sketchfab "medieval throne" (CC0) |
| `banner.glb` | HIGH | Simple plane geometry with fabric texture |
| `barrel.glb` | MEDIUM | Poly Pizza or Quaternius |
| `table-large.glb` | MEDIUM | Sketchfab "medieval table" |
| `candelabra.glb` | MEDIUM | Sketchfab "candelabra" |
| `bookshelf.glb` | MEDIUM | KayKit dungeon pack |
| `armor-stand.glb` | MEDIUM | Sketchfab "armor stand medieval" |
| `weapon-rack.glb` | MEDIUM | KayKit "medieval dungeon" pack |
| `brazier.glb` | MEDIUM | Quaternius or Sketchfab |
| `chair.glb` | LOW | Any medieval furniture pack |
| `chest.glb` | LOW | Poly Pizza, Quaternius |
| `portcullis.glb` | LOW | Sketchfab "portcullis" |

**Sprites (minimum set):**

| Sprite | Size | Frames | Source |
|--------|------|--------|--------|
| Player character | 32x48 | 16 (4 dirs x 4 walk) + 4 idle | Create in Aseprite or source from itch.io |
| Kingsguard NPC | 32x48 | 2 (idle) | Create or source |
| Noble male NPC | 32x48 | 2 (idle) | Create or source |
| Noble female NPC | 32x48 | 2 (idle) | Create or source |
| Servant NPC | 32x48 | 2 (idle) | Create or source |
| Guard NPC | 32x48 | 2 (idle) | Create or source |

**Parallax (Battlements only):**

| Layer | Dimensions | Content |
|-------|-----------|---------|
| Sky | 1920x540 | Blue-to-warm gradient with clouds |
| Far mountains | 2560x540 | Distant hills, Blackwater Bay |
| Mid city | 3200x540 | King's Landing rooftops |
| Near buildings | 3840x540 | Closer Red Keep structures |

### Phase 2: Polish Assets

- Add stained glass window textures for the Throne Room
- Add carpet/runner texture for Grand Gallery
- Add scroll/map textures for Small Council
- Add chandelier model for Queen's Ballroom
- Add spiral stair custom geometry for Tower Stairwell
- Replace all placeholder NPC sprites with animated versions
- Add KTX2 compression build pipeline
- Add DRACO compression for all models

---

## Sources

### PBR Texture Libraries
- [Poly Haven Textures](https://polyhaven.com/textures)
- [ambientCG](https://ambientcg.com)
- [LotPixel](https://www.lotpixel.com)
- [Share Textures](https://www.sharetextures.com)
- [3D Textures](https://3dtextures.me)
- [TextureCan](https://www.texturecan.com)

### 3D Model Sources
- [Poly Haven Models](https://polyhaven.com/models)
- [Sketchfab Medieval Props](https://sketchfab.com/tags/medieval-props)
- [Poly Pizza](https://poly.pizza)
- [Quaternius](https://quaternius.com)
- [KayKit](https://kaylousberg.com/game-assets)
- [OpenGameArt](https://opengameart.org)
- [itch.io Medieval Assets](https://itch.io/game-assets/tag-medieval)
- [CraftPix Free Medieval Props](https://craftpix.net/freebies/free-medieval-props-3d-low-poly-pack/)

### AI Texture Tools
- [Ubisoft CHORD (GitHub)](https://github.com/ubisoft/ubisoft-laforge-chord)
- [Ubisoft CHORD (Hugging Face)](https://huggingface.co/Ubisoft/ubisoft-laforge-chord)
- [PBRify Remix (GitHub)](https://github.com/Kim2091/PBRify_Remix)
- [GenPBR](https://genpbr.com)
- [3D AI Studio PBR Generator](https://www.3daistudio.com/Tools/PBRMapGenerator)
- [ArmorLab](https://armory3d.org/lab/)
- [Scenario AI Textures](https://www.scenario.com/blog/ai-texture-generation)
- [Texxary Lamron](https://lamron.texxary.com/)

### Sprite Creation
- [Aseprite](https://www.aseprite.org)
- [PixelLab AI Sprites](https://www.pixellab.ai)
- [Lospec Pixel Editor](https://lospec.com/pixel-editor)
- [The Spriters Resource (reference only)](https://www.spriters-resource.com/nintendo_switch/octopathtraveler/)
- [Perchance AI Pixel Art Generator](https://perchance.org/ai-pixel-art-generator)

### Parallax Backgrounds
- [itch.io Medieval Parallax](https://itch.io/game-assets/tag-medieval/tag-parallax)
- [CraftPix Castle Interior Backgrounds](https://craftpix.net/freebies/free-castle-interior-pixel-game-backgrounds/)
- [Arludus Medieval Backgrounds](https://arludus.itch.io/2d-pixel-art-medieval-backgrounds-pack)

### KTX2 / Compression
- [Khronos KTX Artist Guide](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md)
- [Don McCurdy: Choosing Texture Formats for WebGL](https://www.donmccurdy.com/2024/02/11/web-texture-formats/)
- [glTF-Transform](https://gltf-transform.dev/)
- [KTX-Software (toktx)](https://github.com/KhronosGroup/KTX-Software)

### Three.js Optimization
- [100 Three.js Best Practices (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Draw Calls: The Silent Killer (Three.js Roadmap)](https://threejsroadmap.com/blog/draw-calls-the-silent-killer)
- [Three.js InstancedMesh Docs](https://threejs.org/docs/pages/InstancedMesh.html)
- [Building Efficient Three.js Scenes (Codrops)](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)
- [DRACO Compression Codelab (Google)](https://codelabs.developers.google.com/codelabs/draco-3d)

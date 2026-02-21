---
title: Replace canvas package with pngjs + sharp for PBR texture generation
category: integration-issues
tags:
  - pngjs
  - sharp
  - procedural-textures
  - pbr
  - three.js
  - texture-generation
  - canvas-replacement
module: scripts/, src/rendering/
symptom: "Script crashes on import { createCanvas } from 'canvas' - module not found. Flat/missing normal maps produce no surface detail. Missing AO maps result in no ambient occlusion darkening."
root_cause: "Original script required uninstalled 'canvas' package instead of project convention (pngjs). pngjs outputs PNG but texture loader expects JPG. Ceiling textures had placeholder data (flat purple normal/AO maps for ironwood-ceiling, missing AO map for dark-stone ceiling)."
date: 2026-02-09
severity: high
---

# Replace canvas with pngjs + sharp for PBR Texture Generation

## Problem

The procedural PBR texture generation script (`generate-hero-prop-textures.mjs`) crashed on startup:

```
Error: Cannot find module 'canvas'
```

The script used `import { createCanvas } from 'canvas'` but `canvas` was never installed. The project convention for pixel manipulation is `pngjs` (used by `scripts/lib/png-helpers.mjs`, `generate-sprites.mjs`, `generate-parallax.mjs`).

However, `pngjs` only outputs PNG format while `loadPBRTexture()` in `src/loaders/texture-loaders.ts` expects `.jpg` files.

Secondary issue: Two ceiling textures had placeholder/missing maps that went undetected:
- `ironwood-ceiling/normal.jpg` — 20KB flat purple (128, 128, 255), no surface detail
- `ironwood-ceiling/ao.jpg` — 20KB flat white, no occlusion
- `dark-stone/ao.jpg` — missing entirely

## Investigation

1. Checked `package.json` — `canvas` not in dependencies or devDependencies
2. Confirmed project convention: `scripts/lib/png-helpers.mjs` uses `pngjs` (PNG class)
3. Discovered `pngjs` can only output PNG format (no JPEG encoder)
4. Checked if `sharp` was available — yes, already a devDependency
5. Designed pipeline: pngjs for pixel manipulation, sharp for PNG-to-JPEG conversion
6. For ceiling textures: compared file sizes (20KB vs 600KB+ for proper textures) and visually confirmed flat purple pixels

## Solution

### Core Pattern: pngjs + sharp pipeline

```javascript
import { PNG } from 'pngjs';
import sharp from 'sharp';

function createPNG(size) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 255;
  }
  return png;
}

async function pngToJpeg(png, quality = 85) {
  const pngBuffer = PNG.sync.write(png, { colorType: 6 });
  return sharp(pngBuffer).jpeg({ quality }).toBuffer();
}
```

### Texture generation pattern

Each generator (diffuse, normal, roughness, AO) manipulates PNG pixel data directly:

```javascript
function generateDiffuse(size, palette, propSeed) {
  const png = createPNG(size);
  const data = png.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      data[idx + 0] = r;     // Red
      data[idx + 1] = g;     // Green
      data[idx + 2] = b;     // Blue
      data[idx + 3] = 255;   // Alpha
    }
  }
  return png;
}
```

### Batch JPEG export with parallel conversion

```javascript
const [diffuseBuf, normalBuf, roughnessBuf, aoBuf] = await Promise.all([
  pngToJpeg(diffuse, 85),
  pngToJpeg(normal, 90),    // Higher quality for normal maps
  pngToJpeg(roughness, 85),
  pngToJpeg(ao, 85),
]);

fs.writeFileSync(path.join(propDir, 'diffuse.jpg'), diffuseBuf);
fs.writeFileSync(path.join(propDir, 'normal.jpg'), normalBuf);
fs.writeFileSync(path.join(propDir, 'roughness.jpg'), roughnessBuf);
fs.writeFileSync(path.join(propDir, 'ao.jpg'), aoBuf);
```

## Results

- 10 hero props x 4 PBR maps = 40 textures generated
- ironwood-ceiling normal: 20KB flat -> 647KB wood-grain detail
- ironwood-ceiling AO: 20KB flat -> 137KB with plank-gap darkening
- dark-stone AO: 0 -> 118KB with mortar-line darkening
- Build verified: TypeScript compiles, Vite build succeeds

## Prevention

### Dependency convention

All procedural texture scripts must use `pngjs` for pixel manipulation and `sharp` for format conversion. Never use `canvas`, `jimp`, or `gm`. Add this header to new scripts:

```javascript
/**
 * Dependencies:
 *   - pngjs: pixel manipulation (project convention - do NOT use canvas)
 *   - sharp: format conversion (pngjs outputs PNG, textures need JPG)
 */
```

### Placeholder texture detection

Identify placeholder textures by file size comparison:
- Proper normal maps: 200KB+ (depending on resolution)
- Flat placeholders: ~20KB (uniform color, no detail)
- Missing maps: 0 bytes (file doesn't exist)

A flat purple normal map (128, 128, 255 everywhere) means "no surface perturbation" — visually produces flat, unrealistic surfaces.

### Quality guidelines

| Map Type | JPEG Quality | Notes |
|----------|-------------|-------|
| Diffuse | 85 | Standard quality |
| Normal | 90 | Higher quality preserves gradient precision |
| Roughness | 85 | Standard quality |
| AO | 85 | Standard quality |

## Related Files

- `scripts/generate-hero-prop-textures.mjs` — Main hero prop generator (rewritten)
- `scripts/fix-ceiling-textures.mjs` — Ceiling texture fix (one-shot)
- `scripts/lib/png-helpers.mjs` — Shared pngjs utilities
- `src/rendering/prop-materials.ts` — Prop material system (consumes generated textures)
- `src/loaders/texture-loaders.ts` — `loadPBRTexture()` that expects .jpg format
- `docs/plans/2026-02-09-feat-aaa-prop-pbr-texture-overhaul-plan.md` — Parent plan

## References

- PR #16: https://github.com/Urbanninja1/2DHD/pull/16
- Commit `fa3d564`: hero prop textures + ceiling fixes

---
title: "Great Hall Placement Bugs: Floating Table Items, Mechanical Chandeliers, and Model-Aware Prevention"
category: rendering
tags: [placement, model-bounds, glb-parsing, validation, visual-regression, playwright, room-needs-engine]
module: Room Needs Engine
symptom: "Table items (goblets, plates, candelabras) floating in mid-air beside the table; chandeliers in mechanical straight line"
root_cause: "Table item Z positions overflowed model's physical footprint; Y_TABLE constant wrong for long-table model; no model-aware validation existed"
status: resolved
date: 2026-02-09
severity: high
related:
  - docs/solutions/rendering/room-needs-engine-visual-quality-overhaul.md
  - docs/solutions/architecture/data-driven-room-system-pattern.md
  - docs/fixes/LIGHTING_BUG_PREVENTION.md
---

# Great Hall Placement Bugs: Floating Table Items & Model-Aware Prevention

## Problem

Two visible bugs in the Great Hall plus a systemic gap in the pipeline:

### Bug 1: Floating Table Items

37 tableware items (goblets, plates, platters, candelabras, tankards) floated in mid-air beside the feasting table.

**Root cause (Z overflow):** The `long-table.glb` model is 6.0 x 1.06 x 1.4 units (X x Y x Z). Its long axis runs along X. Table items were placed at z = +/-2.0 to +/-2.3, but the table only extends +/-0.7 in Z. Items overflowed by 1.3+ units.

**Root cause (wrong Y):** `Y_TABLE = 0.85` in `resolve-placement.mjs` was wrong. The actual table surface is at y = 1.06. Items were 0.21 units below the tabletop.

### Bug 2: Mechanical Chandelier Layout

Three chandeliers all at x=0, evenly spaced along Z. The straight center-line looked generated, not hand-placed.

### Systemic Issue: No Model-Aware Validation

The pipeline validated room-level bounds (`validate.mjs:114-136`) but had no check that items placed "on" a surface fell within that surface's physical footprint. The manifest coordinates were trusted blindly.

## Investigation

### Model Measurement

Parsed GLB binary files directly to extract POSITION accessor min/max values:

```
long-table.glb:
  X: -3.000 to 3.000 (6.0 units, long axis)
  Y:  0.000 to 1.060 (surface at 1.06)
  Z: -0.700 to 0.700 (1.4 units, short axis)

iron-chandelier.glb:
  X: -0.660 to 0.660 (1.32 diameter)
  Y: -0.052 to 1.500 (1.55 tall)
  Z: -0.660 to 0.660 (1.32 diameter)
```

### Multi-Angle Screenshot Analysis

Captured 7 diagnostic screenshots from different camera angles to confirm the bugs visually. The table-closeup angle clearly showed items hovering beside the table at the wrong height.

## Solution

### Phase 1: Fix Manifest Data

**Culled table items from 37 to 20** — more readable at camera distance:
- 6 goblets (from 10)
- 4 plates (from 10)
- 4 food-platters (kept all)
- 3 candelabras (from 4)
- 3 tankards (from 6)
- Removed 2 on-table candle-stubs (invisible at camera distance)

**Re-placed within model bounds:**
- X: constrained to +/-2.5 (within table's +/-3.0)
- Z: constrained to +/-0.5 (within table's +/-0.7, with margin)
- Y: changed from 0.85 to 1.07 (surface 1.06 + 0.01 anti-z-fighting offset)

**Staggered chandeliers diagonally:**
```
Before: (0, 8.5, -3), (0, 8.5, 0), (0, 8.5, 3)
After:  (-3, 8.5, -3), (0, 8.5, 0), (3, 8.5, 3)
```

Compound lights and particles auto-followed since they're extracted from prop compound data by `write-room-data.mjs`.

### Phase 2: Fix Y_TABLE Constant

Updated `Y_TABLE` from 0.85 to 1.07 in `scripts/room-needs/resolve-placement.mjs`. This is the default for `yPlacement: "table-height"`.

### Phase 3: Model-Aware Validation

Created `scripts/room-needs/read-model-bounds.mjs`:
- Reads GLB binary, parses JSON chunk, finds VEC3 POSITION accessors
- Returns `{ min: {x,y,z}, max: {x,y,z} }` bounding box
- No Three.js or GPU required — runs in Node.js pipeline

Added surface overflow validation to `validate.mjs`:
- For items anchored to a model prop, reads the anchor's GLB bounding box
- Checks that items near the anchor's surface height (within 0.5 units) fall within its XZ footprint
- Floor-level items (benches, chairs) are excluded — they sit beside the anchor
- Configurable 0.3 unit margin

The resolver now passes `anchorName` through to resolved items so the validator can look up the corresponding GLB.

### Phase 4: Visual Regression Testing

Created Playwright screenshot suite:
- `playwright.config.ts` with `--use-gl=angle` for WebGL support
- `tests/visual/great-hall.spec.ts` with 3 camera angles (default, table-closeup, ceiling-lights)
- Baseline snapshots stored in `tests/visual/snapshots/`
- `npm run test:visual` script
- `?room=` URL param support for loading specific rooms during testing

## Key Files

| File | Role |
|------|------|
| `scripts/room-needs/output/great-hall-manifest.json` | Fixed table item positions and chandelier layout |
| `scripts/room-needs/resolve-placement.mjs` | Y_TABLE constant, anchorName passthrough |
| `scripts/room-needs/read-model-bounds.mjs` | GLB bounding box reader (new) |
| `scripts/room-needs/validate.mjs` | Surface overflow validation (new section) |
| `scripts/room-needs/engine.mjs` | Passes castle to validator for model path resolution |
| `playwright.config.ts` | Visual regression config (new) |
| `tests/visual/great-hall.spec.ts` | Screenshot test suite (new) |

## Prevention Strategies

### 1. Pipeline-Time Validation (Automated)

The validator now catches surface overflow at pipeline time. Any future room that places items on a model surface will be checked against the actual model geometry.

**How it works:** When running `node scripts/room-needs/engine.mjs pipeline`, items anchored to furniture models are validated against the model's GLB bounding box. Items near the surface height that overflow the XZ footprint generate warnings.

### 2. Visual Regression (Automated)

Playwright screenshots from 3 standard angles capture the visual state. Any placement regression will be visible in the snapshots.

**Usage:** Start dev server, then `npm run test:visual`. Screenshots saved to `tests/visual/snapshots/`.

### 3. Model Measurement Before Placement (Manual)

When adding items to a new surface, measure the model first:

```javascript
import { readModelBounds } from './scripts/room-needs/read-model-bounds.mjs';
const bounds = readModelBounds('public/assets/models/props/ironrath/long-table.glb');
// Use bounds.min/max to constrain item positions
```

### 4. Y_TABLE Is a Default, Not Gospel

Different table models have different surface heights. Always use explicit Y values in array positions for specific models rather than relying on the `Y_TABLE` constant. The constant is only used when `yPlacement: "table-height"` is specified.

## Lessons Learned

1. **Always measure the model before placing items on it.** The manifest had no knowledge of the actual model geometry — coordinates were generated by Claude without physical constraints.

2. **Surface overflow is invisible in top-down views.** The default camera angle (0, 18, 22) makes floating items hard to spot. Multi-angle screenshots are essential for catching placement bugs.

3. **GLB bounding boxes are cheap to read.** Parsing the binary JSON chunk for accessor min/max is fast and requires no GPU. This should run on every pipeline execution.

4. **Floor-level items near furniture are not "on" the furniture.** Benches and chairs anchored to the table for organizational purposes sit at y=0, not y=1.07. The validator must distinguish surface-level items from floor-level items by checking proximity to the anchor's surface height.

5. **Culling improves readability.** 37 tableware items was excessive at the camera's 28-unit distance. 20 items reads better and is faster to render.

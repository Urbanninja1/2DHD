---
title: "fix: Great Hall Placement Bugs + Model-Aware Prevention System"
type: fix
date: 2026-02-09
brainstorm: docs/brainstorms/2026-02-09-great-hall-placement-bugs-and-prevention-brainstorm.md
---

# fix: Great Hall Placement Bugs + Model-Aware Prevention System

## Overview

The Great Hall has two visible placement bugs: tableware items floating in mid-air beside the table (model bounds mismatch), and chandeliers lined up mechanically on the center axis. Beyond fixing these, we need a prevention system that catches placement errors at pipeline time for all future rooms.

## Problem Statement

### Bug 1: Floating Table Items

The `long-table.glb` model is **6.0 x 1.06 x 1.4** units (X x Y x Z). Its long axis runs along X.

Table items are placed at:
- **z = ±2.0 to ±2.3** — overflows the table's Z extent (±0.7) by 1.3+ units
- **y = 0.85** — below the actual table surface at y=1.06

Result: goblets, plates, tankards hover in mid-air beside the table.

### Bug 2: Mechanical Chandelier Layout

Three chandeliers all at x=0, z=-3/0/3. Straight line looks generated, not hand-placed.

### Systemic Issue: No Model-Aware Validation

The pipeline has room-level bounds checking (`validate.mjs:114-136`) but no validation that items placed "on" a surface actually fall within that surface's physical footprint.

## Proposed Solution

### Phase 1: Fix Great Hall Data (Manifest + Regenerate)

**Files:** `great-hall-manifest.json`, `great-hall.generated.ts`

#### 1.1 Fix table items

Cull tableware from 37 to ~20 items and re-place within actual model bounds:
- X range: constrain to ±2.5 (within table's ±3.0, with margin)
- Z range: constrain to ±0.5 (within table's ±0.7, with margin)
- Y: change from 0.85 to **1.07** (table surface 1.06 + 0.01 offset to prevent z-fighting)

Items to keep (~20):
- 6 goblets (from 10) — 3 per side of table center
- 4 plates (from 10) — 2 per side
- 4 food-platters (keep all 4) — down the center
- 3 candelabras on table (from 4) — evenly spaced center
- 3 tankards (from 6) — scattered between plates

Items to remove:
- 4 goblets, 6 plates, 1 candelabra on table, 3 tankards
- Keep all sideboard items (y=0.88) — separate surface, separate fix if needed
- Keep floor-placed "knocked over" items (y=0.005) — intentional detail

Also remove the 2 on-table candle-stubs (scale 0.5, invisible at camera distance).

- [x] **1.1** Cull table items in manifest from 37 to ~20
- [x] **1.2** Re-place remaining items within table bounds (x: ±2.5, z: ±0.5, y: 1.07)

#### 1.2 Stagger chandeliers

Move from center-line to diagonal pattern:
```
Before: (0, 8.5, -3), (0, 8.5, 0), (0, 8.5, 3)
After:  (-3, 8.5, -3), (0, 8.5, 0), (3, 8.5, 3)
```

The compound lights and particles are already co-located with props (verified in brainstorm). When we move the prop positions in the manifest, the `write-room-data.mjs` pipeline will automatically move the lights and particles too since they're extracted from the compound data on each prop.

- [x] **1.3** Update 3 iron-chandelier positions in manifest to diagonal pattern
- [x] **1.4** Run pipeline: `node scripts/room-needs/engine.mjs pipeline scripts/room-needs/data/great-hall-input.json`
- [x] **1.5** Verify generated TS has correct chandelier positions and co-located lights
- [x] **1.6** Take screenshot, confirm no floating items and chandeliers look natural

---

### Phase 2: Fix Y_TABLE Constant

**File:** `scripts/room-needs/resolve-placement.mjs`

The `Y_TABLE = 0.85` constant at line 10 is wrong for the long-table model (surface at 1.06). But different table models could have different surface heights.

**Approach:** Make Y_TABLE a **sensible default** and document that "array" strategy items should use measured values. The constant is only used when `yPlacement: "table-height"` is specified (which the Great Hall tableware doesn't use — it uses "array" with explicit Y values).

- [x] **2.1** Update `Y_TABLE` from 0.85 to 1.07 in `resolve-placement.mjs:10`
- [x] **2.2** Add comment: `// Default table surface height. Override with explicit Y in array positions for specific models.`

---

### Phase 3: Model-Aware Bounds Validation

**New file:** `scripts/room-needs/read-model-bounds.mjs`
**Modified file:** `scripts/room-needs/validate.mjs`

#### 3.1 GLB Bounding Box Reader

Create a lightweight utility that reads GLB files and extracts bounding boxes without Three.js runtime (parse the GLB binary directly for accessor min/max values — same approach used in the brainstorm's `measure-model.mjs` script).

```javascript
// scripts/room-needs/read-model-bounds.mjs
export function readModelBounds(glbPath) {
  // Read GLB binary → parse JSON chunk → find VEC3 accessors → return bounds
  return { min: { x, y, z }, max: { x, y, z } };
}
```

This is fast (no GPU needed) and works in the pipeline.

- [x] **3.1** Create `scripts/room-needs/read-model-bounds.mjs` with `readModelBounds(glbPath)` function
- [x] **3.2** Test against known models: long-table (6.0 x 1.06 x 1.4), iron-chandelier (1.32 x 1.55 x 1.32)

#### 3.2 Surface Overflow Validation

Add a new validation pass in `validate.mjs` that checks items placed on surfaces:

For each item in the manifest:
1. If the item has an anchor that's a model prop (table, sideboard, etc.)
2. Read the anchor model's bounding box via `readModelBounds()`
3. Check that all item positions fall within the anchor's XZ footprint (with configurable margin, default 0.3 units)
4. Check that item Y is within 0.1 of the anchor's max Y (surface height)
5. Warn if overflow detected

```javascript
// In validate.mjs, new section after bounds validation
// --- Surface overflow validation ---
for (const item of surfaceItems) {
  const anchorBounds = readModelBounds(anchorModelPath);
  for (const pos of item.resolvedPositions) {
    if (pos.x < anchorBounds.min.x - margin || pos.x > anchorBounds.max.x + margin) {
      warnings.push(`${item.name} at x=${pos.x} overflows anchor ${anchor} (x: ${anchorBounds.min.x} to ${anchorBounds.max.x})`);
    }
    // Same for Z...
  }
}
```

**Challenge:** The validator currently works on resolved manifests, not raw manifests with anchor references. We need to either:
- (a) Pass anchor model paths through to the validator, or
- (b) Add a separate validation step that runs on the raw manifest before placement resolution

Option (a) is simpler — add `anchorModelPath` to resolved items when the placement strategy is "on-surface" or "array" with an anchor.

- [x] **3.3** Add `anchorModelPath` passthrough in `resolve-placement.mjs` for items with surface anchors
- [x] **3.4** Add surface overflow validation in `validate.mjs` using `readModelBounds()`
- [x] **3.5** Run pipeline on Great Hall — should produce zero surface overflow warnings (since Phase 1 fixed the data)
- [x] **3.6** Test with intentionally bad data to verify warnings fire

---

### Phase 4: Visual Regression Testing

**New files:** `playwright.config.ts`, `tests/visual/great-hall.spec.ts`

#### 4.1 Playwright Config

Minimal config for visual screenshot testing:
- Headless Chromium with `--use-gl=angle` (WebGL support)
- 1920x1080 viewport
- Base URL: `http://localhost:5173/` (Vite dev server)

#### 4.2 Screenshot Test Suite

A test that:
1. Starts the dev server (or expects it running)
2. Loads a room by temporarily switching `main.ts` initial room (or adding URL param support)
3. Waits for Three.js render (6-8 seconds for asset loading)
4. Takes screenshots from standard angles
5. Compares against stored baselines with pixel tolerance

Standard angles (from brainstorm):
- `default` — (0, 18, 22) looking at origin
- `table-closeup` — (0, 8, 6) looking at (0, 1, -1)
- `ceiling-lights` — (0, 12, 0) looking at (0, 8, -2)

**Simplification:** For now, just capture and store baselines. Pixel-diff comparison can be added as a follow-up. The immediate value is having the screenshots auto-generated so they can be visually inspected.

- [x] **4.1** Create `playwright.config.ts` with WebGL-compatible settings
- [x] **4.2** Add `__debugCamera` exposure in dev mode (behind `import.meta.env.DEV`)
- [x] **4.3** Create `tests/visual/great-hall.spec.ts` with 3-angle screenshot capture
- [x] **4.4** Add `"test:visual": "playwright test"` script to `package.json`
- [x] **4.5** Generate baseline snapshots and store in `tests/visual/snapshots/`
- [x] **4.6** Verify test runs and produces screenshots matching current state

---

## Acceptance Criteria

### Functional
- [x] No table items floating in mid-air (all within model bounds)
- [x] Table items at correct surface height (y ≈ 1.07)
- [x] Chandeliers in staggered diagonal pattern, not center line
- [x] Chandelier lights co-located with props (no orphaned lights)
- [x] Pipeline validation catches surface overflow with warnings
- [x] GLB bounding box reader returns correct dimensions for test models

### Visual
- [x] Table closeup screenshot shows items sitting ON the table surface
- [x] Default view shows chandeliers distributed across the room
- [x] No visual regressions vs. current state (lighting, banners, NPCs still correct)

### Infrastructure
- [x] `readModelBounds()` utility works on any GLB file
- [x] Validator warns when items overflow anchor model bounds
- [x] Playwright visual test suite runs and captures screenshots
- [x] `npm run test:visual` produces screenshots in `tests/visual/snapshots/`

## Implementation Order

1. **Phase 1** (data fix) — Fix manifest, regenerate TS, take screenshots
2. **Phase 2** (Y_TABLE) — One-line constant change
3. **Phase 3** (model-aware validation) — New utility + validator enhancement
4. **Phase 4** (visual regression) — Playwright setup + test suite

Phases 1-2 are immediate bug fixes. Phases 3-4 are prevention infrastructure.

## References

### Source Files
- Manifest: `scripts/room-needs/output/great-hall-manifest.json`
- Generated room: `src/rooms/room-data/ironrath/great-hall.generated.ts`
- Placement resolver: `scripts/room-needs/resolve-placement.mjs:10` (Y_TABLE)
- Validator: `scripts/room-needs/validate.mjs:114-136` (bounds checking)
- Pipeline: `scripts/room-needs/engine.mjs`
- Writer: `scripts/room-needs/write-room-data.mjs`

### Institutional Learnings
- `docs/solutions/rendering/room-needs-engine-visual-quality-overhaul.md` — Previous partial fix, prevention strategies
- `docs/fixes/LIGHTING_BUG_PREVENTION.md:126-238` — Example Playwright visual test code
- `docs/solutions/architecture/data-driven-room-system-pattern.md` — Room validation patterns

### Model Measurements (from brainstorm)
- `long-table.glb`: X ±3.0, Y 0-1.06, Z ±0.7
- `iron-chandelier.glb`: 1.32 diameter, 1.55 tall

### Diagnostic Screenshots
- `screenshots/debug-default.png` through `screenshots/debug-south-entry.png` (7 angles)

---
title: "Great Hall Placement Bugs & Future Room Prevention"
date: 2026-02-09
type: fix + infrastructure
status: ready-for-plan
---

# Great Hall Placement Bugs & Future Room Prevention

## What We're Fixing

Three issues identified from multi-angle screenshot analysis:

### 1. Table Items Floating in Mid-Air

**Root cause:** The `long-table.glb` model is **6.0 x 1.06 x 1.4** (X x Y x Z). Its long axis runs along X (east-west), and the table surface is at **y=1.06**.

But table items are placed at:
- **z = ±2.0 to ±2.3** — the table only extends ±0.7 in Z. Items overflow 1.3+ units off each side.
- **y = 0.85** — the `Y_TABLE` constant is wrong. Actual surface is y=1.06. Items are 0.21 units below the tabletop, clipping through the geometry.

37 tableware items (goblets, plates, platters, candelabras, tankards) are affected.

**Decision:** Cull to ~20 items, re-place within actual model bounds (x: ±2.8, z: ±0.6), and fix surface Y to 1.06.

### 2. Chandeliers All on Center Line

Three iron chandeliers at `(0, 8.5, -3)`, `(0, 8.5, 0)`, `(0, 8.5, 3)` — all at x=0. Looks mechanical/generated. Real halls have staggered or multi-row arrangements.

**Decision:** Stagger across room width in a diagonal pattern:
- z=-3 → x=-3 (offset west)
- z=0 → x=0 (center)
- z=3 → x=3 (offset east)

Compound lights and particles must move with props (already co-located).

### 3. Prevention System for Future Rooms

No validation currently exists between item placement and actual model geometry. The pipeline trusts manifest coordinates blindly.

**Decision:** Build both:
- **Model-aware placement validation** — reads GLB bounding boxes at pipeline time, validates that "on-surface" items fall within the anchor model's physical footprint
- **Visual regression tests** — Playwright screenshots from standard angles, compared against known-good baselines

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Table fix strategy | Re-place items within model bounds | Keep table orientation, fix the data |
| Item count | Cull from 37 to ~20 | More readable at 28-unit camera distance |
| Surface Y | Fix to 1.06 (measured) | Y_TABLE=0.85 is wrong for this model |
| Chandelier layout | Stagger diagonally | More natural, breaks "generated" feel |
| Prevention level | Model-aware + visual tests | Belt and suspenders — catch at pipeline AND verify visually |

## Scope

### In Scope
- Fix Great Hall table item positions and count
- Fix Y_TABLE or make it model-aware
- Stagger chandelier positions
- Build GLB bounding box reader for validation
- Add "on-surface" placement validation against anchor model bounds
- Add Playwright visual regression screenshot framework

### Out of Scope (future work)
- Re-generating the entire manifest with Claude
- Fixing other rooms (this establishes the pattern)
- Emissive materials, fog, or other AAA polish items
- Prop scale validation (documented in partial-fix learning, separate work)

## Technical Notes

### Table Model Measurements
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

### Files to Touch
- `scripts/room-needs/output/great-hall-manifest.json` — table items, chandelier positions
- `src/rooms/room-data/ironrath/great-hall.generated.ts` — regenerate after manifest fix
- `scripts/room-needs/resolve-placement.mjs` — update Y_TABLE or make configurable
- `scripts/room-needs/validate.mjs` — add model-bounds validation
- New: `scripts/room-needs/read-model-bounds.mjs` — GLB bounding box reader
- New: `tests/visual/` — Playwright visual regression framework

### Prevention System Design

**Model-Aware Validation (pipeline-time):**
1. New utility: `readModelBounds(glbPath)` → returns `{ min: {x,y,z}, max: {x,y,z} }`
2. In validator: for any item with `strategy: "on-surface"` or `yPlacement: "table-height"`:
   - Read anchor model's bounding box
   - Check all item positions fall within anchor's XZ footprint (with small margin)
   - Check Y matches anchor's max Y (surface height)
   - Warn if items overflow

**Visual Regression (post-deploy):**
1. Playwright script that loads each room from standard camera angles
2. Takes screenshots and saves to `tests/visual/snapshots/`
3. On subsequent runs, compares pixel-by-pixel with tolerance
4. Fails CI if significant visual changes detected
5. Standard angles: default (0,18,22), bird-eye, table-closeup, ceiling

## Screenshots (Diagnostic)

Captured from 7 angles during analysis:
- `screenshots/debug-default.png` — default camera view
- `screenshots/debug-table-closeup.png` — table area (floating items visible)
- `screenshots/debug-throne-view.png` — toward hearth/throne
- `screenshots/debug-ceiling-lights.png` — chandelier placement
- `screenshots/debug-east-wall.png` — side view showing depth
- `screenshots/debug-bird-eye.png` — top-down layout view
- `screenshots/debug-south-entry.png` — entry perspective

## Open Questions

1. Should `Y_TABLE` become a per-model value read from the GLB, or stay as a constant that's updated per-room?
2. For visual regression, what pixel tolerance is reasonable for Three.js rendering (which can vary slightly per GPU)?
3. Should the chandelier stagger be symmetric (±3) or asymmetric for more natural feel?

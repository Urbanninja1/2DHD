---
title: "feat: Autonomous Blender Asset Pipeline"
type: feat
date: 2026-02-08
brainstorm: docs/brainstorms/2026-02-08-blender-asset-pipeline-brainstorm.md
deepened: 2026-02-08
---

# feat: Autonomous Blender Asset Pipeline

## Enhancement Summary

**Deepened on:** 2026-02-08
**Sections enhanced:** 8 phases + acceptance criteria + risks
**Research agents used:** Blender bpy best practices, Architecture review, Performance analysis, Institutional learnings, Code simplicity review, Blender/Three.js GLB compatibility

### Key Improvements

1. **Simplified from 8 phases to 5** — Deleted premature "shared library" phase; inline code first, extract after 8-10 props organically
2. **Revised texture budgets** — Surface textures downgraded from 2K to 1K (saves ~144MB GPU memory); small props at 256px
3. **Blender 4.x API-specific code** — Principled BSDF socket renames, Musgrave→Noise Texture migration, correct bake target selection
4. **Trimmed prop count from ~50 to ~35** — Cut 8 "optional" props; realistic scope for proving pipeline viability
5. **Flat directory structure** — Eliminated 8 category subdirectories; ~30 files don't need that much organization
6. **Added deterministic seeds** — Every generator takes a seed parameter for reproducible output
7. **Added dependency audit** — Must verify `simplex-noise`/`three-bvh-csg` aren't imported elsewhere before removing
8. **Raised tri budget to 75K** — Performance analysis shows headroom exists; 50K was overly conservative
9. **Added incremental generation** — Skip props whose script hasn't changed (hash-based)
10. **Added tangent export** — Prevents normal map seam artifacts in Three.js

### Critical Blender 4.x Gotchas (From Research)

- **Principled BSDF socket renames (4.0+):** `Specular` → `Specular IOR Level`, `Subsurface Color` → removed, `Emission` → `Emission Color`
- **Musgrave Texture removed (4.1+):** Merged into Noise Texture node with `noise_type` parameter
- **Bake target must be SELECTED:** The active image texture node in the material receives the bake output. If wrong node is selected, bake goes to wrong texture.
- **Procedural nodes silently dropped on GLB export:** Blender procedural shader trees do NOT export to glTF. You MUST bake to image textures first.
- **Export tangents:** Set `export_tangents=True` in glTF exporter to prevent normal map seam artifacts in Three.js

---

## Overview

Build an autonomous asset creation pipeline powered by Blender (headless, bpy scripting) that Claude can drive end-to-end to produce production-quality 3D models and PBR textures. The pipeline replaces the current Three.js/Node.js procedural generation approach (`generate-ironrath-props.mjs`) with Blender-based generation that produces proper low-poly geometry with baked PBR texture maps. The Great Hall is the proving ground; the pipeline is designed to scale to an entire castle (~36 rooms, ~1000+ assets).

**North star:** "Build an entire castle in one shot."

## Problem Statement

The current Great Hall vertical slice is at ~50-55% quality:

- **Textures:** Procedural-only, 128-256px, no normal maps. Floor and walls share the same texture. Ceiling has none.
- **Geometry:** Box/cylinder primitives with Three.js CSG. Simple silhouettes, no sculpted detail, no bevels.
- **Architecture:** Flat walls, no windows, no roof beams, no alcoves. Room is a box with props dropped in.
- **Scalability:** 25 inline generator functions in a single 811-line script. Adding a room means copy-paste.
- **Consistency:** Generic stone/wood materials reused across 10 Red Keep rooms. No Ironrath identity.

The current Node.js generation pipeline has a fundamental quality ceiling — Three.js has no normal map baking, no proper mesh modifiers, and limited boolean operations.

## Proposed Solution

### Architecture

```
scripts/blender/
├── props/                       # Per-prop generator scripts (flat directory)
│   ├── ironwood_column.py
│   ├── stone_arch.py
│   ├── ironwood_throne.py
│   ├── long_table.py
│   ├── roof_beam.py
│   ├── dire_wolf_banner.py
│   └── ...                      # ~30-35 scripts total
├── surfaces/                    # PBR surface texture generators
│   ├── ironrath_floor_stone.py
│   ├── ironrath_wall_stone.py
│   └── ironrath_ceiling_wood.py
├── generate_room.py             # Master room generation entry point
├── generate_prop.py             # Single prop generation entry point
└── generate_surfaces.py         # Surface texture generation entry point
```

> **Why flat?** ~30 files don't warrant 8 subdirectories. Category is already encoded in the filename prefix. If we reach 80+ files for the full castle, we can reorganize then.

**Shared helpers live inline initially.** Common patterns (material creation, bake pipeline, export) are functions within each script initially. After 8-10 props reveal the stable API surface, extract a shared `lib/` module. This follows the project's own documented learning: "extract after patterns stabilize, not before" (`docs/solutions/architecture/data-driven-room-system-pattern.md`).

**Output goes to existing directories:**
- Models: `public/assets/models/props/ironrath/{name}.glb`
- Surface textures: `public/assets/textures/{category}/{name}/{diffuse,normal,roughness,ao}.jpg`

### Key Design Decisions

1. **Blender replaces the Node.js pipeline entirely.** The existing `generate-ironrath-props.mjs` becomes dead code once all 25 props are regenerated. Dependencies (`three-bvh-csg`, `simplex-noise`, `node-three-gltf`) are removed **after auditing `src/` for imports** — must verify no runtime code depends on these.

2. **Prop textures embedded in GLBs at 512px (small props at 256px).** The bake is an intermediate step — downscaled for embedding. Small props (goblets, plates, candle stubs) use 256px to save ~48MB GPU memory across the full room. Room surface textures (floor/wall/ceiling) are external JPEGs at **1K** (not 2K — see Performance section).

3. **Single-mesh convention for multi-instance props.** Props used multiple times (columns, sconces, benches) MUST be single-mesh for InstancedMesh. Single-instance props (throne, hearth, dais) CAN be multi-mesh if it improves material quality — each sub-mesh creates a separate draw call, which is acceptable for unique objects.

4. **Origin at base center.** All props have their origin at the bottom-center of the bounding box, matching the existing convention documented in `docs/solutions/architecture/data-driven-room-system-pattern.md`. Room data positions don't need updating for drop-in replacements.

5. **Deterministic seeds.** Every generator function takes a `seed` parameter for reproducible output. Same seed + same script = identical GLB. This enables incremental generation (skip unchanged props) and debugging.

6. **Cycles CPU for baking.** No GPU requirement. Slower but portable. Typical prop bake: ~5-15 seconds. Parallel Blender instances work fine (CPU-only, no GPU contention) — can speed up full room generation.

7. **Blender 4.x (latest stable).** Installed via `winget` on Windows. Use `--factory-startup` flag for faster startup and clean environment. Binary path detected automatically.

8. **Export tangents from Blender.** Set `export_tangents=True` in the glTF exporter. Without this, Three.js computes tangents at runtime, which can produce visible seam artifacts on normal-mapped surfaces.

9. **JPEG for diffuse/roughness/AO; PNG only for alpha-masked textures.** JPEG at quality 90 for diffuse, 95 for normal maps (less lossy). PNG only needed for textures with transparency (cobwebs, banners with cutouts).

### Research Insights: Architecture

**Risks identified by architecture review:**
- **Dual-source-of-truth risk:** TypeScript room data (`great-hall.ts`) defines prop positions + references, while Python scripts define prop geometry. If a prop's bounding box changes, positions in TS may need updating. Mitigate by having each prop script output metadata (bounding box dimensions) and comparing against room data expectations.
- **God Function risk in export pipeline:** Don't put join + origin + bake + downscale + export + validate all in one `export_glb()` function. Keep bake and export as separate operations so they can be tested independently.

**Patterns to follow:**
- `generate_room.py` orchestrates but does NOT contain generation logic — it imports and calls per-prop scripts
- Each prop script is a standalone runnable: `blender --background --python scripts/blender/props/ironwood_column.py`
- Also callable as a module: `from props.ironwood_column import generate`

---

## Technical Approach

### Phase 1: Blender Setup & Pipeline Spike (Foundation)

Validate the entire Blender→GLB→Three.js pipeline with a single test prop before building anything else.

#### Phase 1.1: Install Blender

- [x] Install Blender 4.x via `winget install BlenderFoundation.Blender` (or portable ZIP if winget unavailable)
- [x] Verify `blender --version` works from command line
- [x] Verify `blender --background --factory-startup --python-expr "import bpy; print(bpy.app.version_string)"` prints version
- [x] If not on PATH, detect install location and create a wrapper script
- [x] Document the install path in `CLAUDE.md`

**File:** None (system configuration)

#### Phase 1.2: Spike — Generate a Test Cube with Baked PBR

Minimal proof that the full pipeline works:

- [x] Write `scripts/blender/spike_test.py`:
  - Create a cube with beveled edges
  - Apply a procedural stone material (Noise Texture with `noise_type='MUSGRAVE_FBM'` for Blender 4.1+, not the removed Musgrave node)
  - UV unwrap (Smart UV Project)
  - Bake diffuse, normal, roughness, AO to 512x512 images
  - **Critical:** Create Image Texture node per bake pass, set it as the ACTIVE SELECTED node before baking
  - Embed textures in GLB with `export_tangents=True`
  - Export to `public/assets/models/props/test/spike-cube.glb`
- [x] Run: `blender --background --factory-startup --python scripts/blender/spike_test.py`
- [ ] Validate the GLB loads in Three.js `GLTFLoader` (check in dev server)
- [ ] Verify the baked normal map is visible in-scene (lighting reacts to surface detail)
- [x] Measure execution time (target: < 30 seconds for a single prop)
- [ ] Clean up test file after validation

**File:** `scripts/blender/spike_test.py`

**Success criteria:** A beveled cube with visibly textured stone surfaces renders correctly in the game, with normal map detail visible under directional light. Execution completes in < 30 seconds.

#### Research Insights: Blender bpy Bake Pipeline

**Correct bake sequence (Blender 4.x):**
```python
import bpy

# 1. Set render engine to Cycles
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.device = 'CPU'
bpy.context.scene.cycles.samples = 64  # For AO; 1 is fine for diffuse/normal/roughness

# 2. Create bake target image
img = bpy.data.images.new("bake_diffuse", 512, 512)

# 3. Add Image Texture node to material and SELECT it
mat = obj.data.materials[0]
nodes = mat.node_tree.nodes
img_node = nodes.new('ShaderNodeTexImage')
img_node.image = img
nodes.active = img_node  # CRITICAL: must be active/selected node

# 4. Bake
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.bake(type='DIFFUSE')  # or 'NORMAL', 'ROUGHNESS', 'AO'

# 5. Save
img.filepath_raw = "/path/to/output.png"
img.file_format = 'PNG'
img.save()
```

**Principled BSDF socket names (Blender 4.x):**
```python
# Correct 4.x socket names:
principled = nodes.new('ShaderNodeBsdfPrincipled')
principled.inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1.0)
principled.inputs['Roughness'].default_value = 0.8
principled.inputs['Specular IOR Level'].default_value = 0.5  # NOT 'Specular'
principled.inputs['Metallic'].default_value = 0.0
# 'Emission' → 'Emission Color' in 4.x
# 'Subsurface Color' → removed in 4.x
```

#### Phase 1.3: Spike — Replace One Existing Prop

Drop-in replace `ironwood-column.glb` with a Blender-generated version:

- [x] Write `scripts/blender/props/ironwood_column.py` that generates an octagonal column with:
  - Base and capital geometry (beveled, not just boxes)
  - Procedural wood material with grain (Wave Texture) + knots (Voronoi)
  - Baked PBR textures at 512x512
  - Single joined mesh (this prop is multi-instance: 6 columns in Great Hall)
  - Origin at base center
  - `seed` parameter for deterministic output
  - Export with `export_tangents=True`
  - Apply all transforms before export (`bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)`)
  - Export to same path: `public/assets/models/props/ironrath/ironwood-column.glb`
- [ ] Verify the 6 column instances in the Great Hall render correctly (no position/scale/rotation drift)
- [ ] Verify InstancedMesh path works (6 instances → should create InstancedMesh)
- [ ] A/B screenshot: compare old procedural column vs new Blender column
- [x] Verify file size < 100KB
- [ ] Test under safe lighting ranges (ambient >= 0.45, per `docs/fixes/LIGHTING_BUG_PREVENTION.md`)

**File:** `scripts/blender/props/ironwood_column.py`

**Success criteria:** Blender column is a visible quality upgrade (better silhouette, visible wood grain in normal map) and works as a drop-in replacement without touching `great-hall.ts`.

---

### Phase 2: Generate Great Hall Props (Core Implementation)

Replace all 25 existing props with Blender-generated versions, then add new architectural/decorative props. Each prop script follows patterns established in the spike. Common code is copy-pasted initially — **extract shared helpers only after 8-10 props reveal the stable API surface.**

> After ~8-10 prop scripts, review for common patterns and extract a `scripts/blender/lib/` module with: materials, bake pipeline, export, mesh operations, conventions.

#### Phase 2.1: Structural Props (Replace + New)

**Replace existing (3):**
- [x] `ironwood-column.glb` — (done in Phase 1.3)
- [x] `stone-hearth.glb` — stone fireplace with carved opening, chimney breast detail
- [x] `raised-dais.glb` — two-tier stone platform with edge steps

**New architectural props (~5):**
- [x] `stone-arch.glb` — pointed arch for doorways and wall recesses
- [x] `stone-pilaster.glb` — wall-attached half-column for wall articulation
- [x] `corbel-bracket.glb` — stone bracket supporting roof beams
- [x] `stone-window-frame.glb` — mullioned window frame with stone surround
- [x] `door-frame.glb` — heavy oak door frame with iron studs

**Files:** `scripts/blender/props/*.py`
**Output:** `public/assets/models/props/ironrath/*.glb`

#### Phase 2.2: Furniture Props (Replace + New)

**Replace existing (5):**
- [x] `ironwood-throne.glb` — throne with dire wolf carving, ironwood grain, leather cushion
- [x] `long-table.glb` — trestle table with cross-beams and worn surface
- [x] `bench.glb` — simple bench with aged wood
- [x] `high-seat.glb` — wider chair with armrests
- [x] `chair.glb` — small chair

**New furniture (~3):**
- [x] `sideboard.glb` — wall-side serving table for alcoves
- [x] `wooden-chest-large.glb` — larger iron-banded storage chest
- [x] `stool.glb` — three-legged stool for servants/corners

**Files:** `scripts/blender/props/*.py`

#### Phase 2.3: Ceiling/Roof Props (All New)

- [x] `roof-beam.glb` — massive ironwood beam spanning the hall width
- [x] `roof-joist.glb` — smaller cross-beams between main beams
- [x] `rafter-set.glb` — angled roof structure visible from below

**Files:** `scripts/blender/props/*.py`

#### Phase 2.4: Decorative Props (Replace + New)

**Replace existing (3):**
- [x] `banner.glb` — cloth banner with proper drape folds
- [x] `tapestry.glb` — larger woven hanging with geometric border
- [x] `weapon-rack.glb` — wall-mounted rack with sword/axe silhouettes

**New decorative (~5):**
- [x] `dire-wolf-shield.glb` — Forrester house shield for walls
- [x] `mounted-antlers.glb` — trophy antlers on wall plaque
- [x] `iron-candle-tree.glb` — floor-standing candelabra
- [x] `heraldic-crest.glb` — carved stone crest above hearth
- [x] `iron-torch-holder.glb` — wall-mounted iron torch bracket

**Files:** `scripts/blender/props/*.py`

#### Phase 2.5: Lighting Fixtures (Replace + New)

**Replace existing (3):**
- [x] `iron-chandelier.glb` — ring chandelier with chain and candle cups
- [x] `wall-sconce.glb` — wall-mounted sconce with iron bracket
- [x] `candelabra.glb` — table candelabra

**New (~1):**
- [x] `iron-brazier.glb` — standing fire brazier

**Files:** `scripts/blender/props/*.py`

#### Phase 2.6: Tabletop & Small Props (Replace + New)

**Replace existing (3):**
- [x] `goblet.glb` — drinking goblet with stem detail (256px textures)
- [x] `plate.glb` — ceramic plate with rim (256px textures)
- [x] `food-platter.glb` — serving platter with food (256px textures)

**New (~2):**
- [x] `wine-jug.glb` — ceramic jug (256px textures)
- [x] `candle-stub.glb` — melted candle for tables (256px textures)

**Files:** `scripts/blender/props/*.py`

#### Phase 2.7: Floor Detail & Surface Props (Replace + New)

**Replace existing (7):**
- [x] `floor-crack.glb` — stone floor crack detail
- [x] `wall-moss.glb` — moss growth on wall surface
- [x] `hearth-scorch.glb` — scorch marks near fireplace
- [x] `table-stain.glb` — drink stain on table
- [x] `fur-rug.glb` — animal pelt rug
- [x] `rushes.glb` — floor rushes scatter
- [x] `hound-sleeping.glb` — sleeping hound

**New (~2):**
- [x] `worn-path.glb` — floor wear pattern at high-traffic areas
- [x] `cobweb.glb` — corner cobwebs (alpha-masked, use PNG for this one)

> **Note on wall-hugging decals (floor-crack, wall-moss, hearth-scorch):** Drop AO from these — wall-hugging decals get AO banding artifacts from the adjacent surface. Diffuse + Normal + Roughness only.

**Files:** `scripts/blender/props/*.py`

#### Phase 2.8: Extract Shared Library (After Props Stabilize)

After completing 8-10 prop scripts, patterns will be clear. At that point:

- [x] Extract `scripts/blender/lib/materials.py` — parameterized material factories (northern stone, ironwood, dark iron, fabric)
- [x] Extract `scripts/blender/lib/bake.py` — PBR bake pipeline (create image, select node, bake, save)
- [x] Extract `scripts/blender/lib/export.py` — GLB export (apply transforms, join mesh, export with tangents, validate size)
- [x] Extract `scripts/blender/lib/mesh_ops.py` — common operations (bevel, boolean, decimate, set origin)
- [x] Extract `scripts/blender/lib/conventions.py` — constants (budgets, paths, material params)
- [x] Refactor earlier prop scripts to use the shared library
- [ ] **Do NOT extract:** uv_ops.py (Smart UV Project is a one-liner; doesn't need a module)

**Key convention constants:**
```python
# conventions.py
ORIGIN = 'BASE_CENTER'
BUDGET_SMALL = 300       # goblets, candles, plates
BUDGET_MEDIUM = 1200     # chairs, sconces, small decor
BUDGET_LARGE = 2500      # columns, thrones, tables
TEX_PROP_SMALL = 256     # small props
TEX_PROP_LARGE = 512     # large props
TEX_SURFACE = 1024       # room surfaces (floor, wall, ceiling)
MAX_GLB_KB = 100
```

**PBR material parameter ranges (enforce consistency):**
| Material | Roughness | Metallic | Base Color Range |
|----------|-----------|----------|-----------------|
| Northern Stone | 0.75-0.95 | 0.0 | `#4a4540` – `#6b6560` |
| Ironwood | 0.55-0.75 | 0.0 | `#2d2218` – `#4a3525` |
| Dark Iron | 0.35-0.55 | 0.85-0.95 | `#252525` – `#3a3a3a` |
| Leather | 0.50-0.70 | 0.0 | `#3d2b1a` – `#5c4030` |
| Fabric | 0.80-1.00 | 0.0 | varies by banner/tapestry |

---

### Phase 3: Generate Great Hall Surface Textures

Create unique PBR texture sets for the Great Hall's major surfaces at **1K resolution** (1024x1024).

> **Why 1K not 2K?** Performance analysis: 3 surfaces × 4 maps × 2K = 192MB GPU memory. At 1K = 48MB. The 144MB savings is significant — and 1K with good procedural detail looks better than 2K with mediocre detail. Can always re-bake at 2K later if 1K proves insufficient.

#### Phase 3.1: Floor Texture — "Ironrath Floor Stone"

- [x] Write `scripts/blender/generate_surface_textures.py` (consolidated all 3 surfaces):
  - Large flagstones with mortar joints (Voronoi Texture for cell pattern)
  - Noise Texture with FBM type for stone grain
  - Worn smooth in center (high-traffic path), rougher at edges
  - Grey-brown palette with warm undertones
  - Deterministic seed parameter
- [x] Bake to 1K: `public/assets/textures/stone/northern-floor/{diffuse,normal,roughness,ao}.jpg`
- [x] Update `great-hall.ts` `floorTexture.basePath`

**File:** `scripts/blender/surfaces/ironrath_floor_stone.py`
**Output:** `public/assets/textures/stone/ironrath-floor-stone/`

#### Phase 3.2: Wall Texture — "Ironrath Wall Stone"

- [x] Wall stone generator in `scripts/blender/generate_surface_textures.py`:
  - Rough-cut stone blocks with mortar lines
  - Darker than floor (less light exposure)
  - Subtle moss/lichen in crevices
  - Mixed stone sizes (not uniform grid)
- [x] Bake to 1K: `public/assets/textures/stone/northern-wall/`
- [x] Update `great-hall.ts` `wallTexture.basePath`

**File:** `scripts/blender/surfaces/ironrath_wall_stone.py`
**Output:** `public/assets/textures/stone/ironrath-wall-stone/`

#### Phase 3.3: Ceiling Texture — "Ironrath Ceiling Wood"

- [x] Ceiling wood generator in `scripts/blender/generate_surface_textures.py`:
  - Dark ironwood planking between beams
  - Smoke-darkened with soot staining
  - Plank seams visible (Wave Texture for grain direction)
  - Warmer tone than walls
- [x] Bake to 1K: `public/assets/textures/wood/ironwood-ceiling/`
- [x] Update `great-hall.ts` `ceilingTexture` (added to room data)

**File:** `scripts/blender/surfaces/ironrath_ceiling_wood.py`
**Output:** `public/assets/textures/wood/ironrath-ceiling-wood/`

---

### Phase 4: Update Great Hall Room Data & Infrastructure

Integrate all new assets into the room composition and fix infrastructure issues.

#### Phase 4.1: Fix validate-assets.mjs

- [ ] Update `scripts/validate-assets.mjs` line 92: replace regex `^\d{2}-.*\.ts$` with recursive directory scanning that includes `ironrath/` subdirectory
- [ ] Fix orphan detection (lines 241-250) to scan `props/ironrath/` subdirectory
- [ ] Add GLB triangle counting via `@gltf-transform/core`
- [ ] Warn if any prop exceeds category budget
- [ ] Report total triangles per room (sum all prop instances x tri count)
- [ ] Warn if room exceeds 75,000 triangles (raised from 50K — see Performance section)

**File:** `scripts/validate-assets.mjs`

#### Phase 4.2: Merge Duplicate Model Entries in Room Data

- [ ] Audit `great-hall.ts` for props that reference the same `modelPath` but are split across multiple entries (e.g., ironwood-column appears in 2 separate prop entries). Merge into a single entry with all positions in the `positions` array. Each duplicate wastes a draw call.

**File:** `src/rooms/room-data/ironrath/great-hall.ts`

#### Phase 4.3: Add New Prop References

- [x] Update `great-hall.ts` props array with new architectural props:
  - Window frames on north wall
  - Pilasters between column bays
  - Roof beams spanning overhead
  - Door frames at entrances
- [x] Add new decorative props:
  - Shields and antlers on walls between banners
  - Heraldic crest above hearth
  - Floor candelabras at dais corners
- [x] Add ceiling props:
  - 3-4 roof beams spanning the width
  - Joists between beams

**File:** `src/rooms/room-data/ironrath/great-hall.ts`

#### Phase 4.4: Update Surface Textures

- [x] Set `floorTexture.basePath` to `'assets/textures/stone/northern-floor'`
- [x] Set `wallTexture.basePath` to `'assets/textures/stone/northern-wall'`
- [x] Add `ceilingTexture` with `basePath: 'assets/textures/wood/ironwood-ceiling'`
- [x] Add appropriate `repeat` values for tiling at room dimensions

**File:** `src/rooms/room-data/ironrath/great-hall.ts`

#### Phase 4.5: Adjust Lighting for New Geometry

- [ ] Add fill lights near windows (if window geometry added)
- [ ] Adjust god ray direction to match window placement
- [ ] Add subtle point lights in wall niches
- [ ] Re-tune ambient intensity if ceiling geometry darkens the room
- [ ] Keep ambient >= 0.45 per `docs/fixes/LIGHTING_BUG_PREVENTION.md`
- [ ] Keep PBR parameters within tuned ranges per HD-2D pipeline constraints

**File:** `src/rooms/room-data/ironrath/great-hall.ts`

---

### Phase 5: Pipeline Integration, Validation & Commit

#### Phase 5.1: Add npm Scripts

- [ ] Add to `package.json`:
  ```json
  "generate-blender-props": "blender --background --factory-startup --python scripts/blender/generate_room.py -- ironrath great-hall",
  "generate-blender-textures": "blender --background --factory-startup --python scripts/blender/generate_surfaces.py -- ironrath great-hall",
  "pipeline": "npm run generate-blender-props && npm run generate-blender-textures && npm run compress-models && npm run compress-textures && npm run validate"
  ```

**File:** `package.json`

#### Phase 5.2: Master Room Generation Script

- [ ] Create `scripts/blender/generate_room.py`:
  - Reads a prop list (Python dict) listing all props needed for the room
  - Imports and calls per-prop generator functions
  - Generates each prop sequentially within a single Blender process (cleanup between props: `bpy.ops.wm.read_factory_settings()` or selective cleanup)
  - Supports incremental generation: hash each prop script, skip if hash matches cached output
  - Reports per-prop: name, tri count, file size, bake time
  - Reports totals: total tris, total file size, total time
  - Exits with error code if any prop fails (reports which ones)

> **Single process with cleanup > one process per prop.** Blender startup overhead (~2-3 seconds) × 35 props = ~90 seconds wasted. Use one process, clear scene between props.

**File:** `scripts/blender/generate_room.py`

#### Phase 5.3: Audit and Deprecate Node.js Pipeline

- [ ] **Audit first:** Search `src/` for imports of `simplex-noise`, `three-bvh-csg`, `node-three-gltf` to confirm they're build-time only, not runtime
- [ ] Remove confirmed build-only dependencies from `package.json`
- [ ] Delete or archive `scripts/generate-ironrath-props.mjs`
- [ ] Update `package.json` scripts to remove old `generate-props` command
- [ ] Verify `npm install` is cleaner

**File:** `package.json`, `scripts/generate-ironrath-props.mjs`

#### Phase 5.4: Full Pipeline Run

- [ ] Run `npm run pipeline` (generate → compress → validate)
- [ ] All assets pass validation (correct paths, under size budgets, tri budgets met)
- [ ] TypeScript build passes: `npm run build`
- [ ] DRACO compression uses UV quantization of 12 bits (not default 10) to preserve baked texture UV precision

#### Phase 5.5: Visual Regression Screenshots

- [ ] Take screenshots at dawn, day, dusk, night (using `window.__setGameTime`)
- [ ] A/B compare against pre-Blender screenshots
- [ ] Verify no visual regressions (lighting, positioning, scale)
- [ ] Verify quality improvement is visible (normal maps, better silhouettes, surface detail)
- [ ] Verify PBR parameters stay within HD-2D pipeline tuned ranges

#### Phase 5.6: Commit & PR

- [ ] Commit all changes (Blender scripts, generated assets, updated room data, infrastructure fixes)
- [ ] Create PR with before/after screenshots

---

## Alternative Approaches Considered

### Enhanced Three.js Procedural (Rejected)
Upgrade the existing Node.js pipeline with higher-res procedural textures and more complex geometry. **Rejected** because: no normal map baking capability, no proper mesh modifiers, quality ceiling is fundamentally too low. Doesn't solve the scalability problem.

### AI Texture Generation (Deferred)
Use image generation APIs to create bespoke textures. **Deferred** because: variable quality, inconsistent style, API dependency. Can be layered on later if Blender procedurals aren't sufficient for specific surfaces.

### CC0 Model Sourcing (Rejected)
Download pre-made models from Sketchfab/CGTrader. **Rejected** because: hard to find consistent style, licensing complexity at scale, doesn't solve the "build a castle autonomously" goal.

### Meshopt Compression (Noted as Alternative)
Meshopt is an alternative to DRACO that's simpler and has fewer decompression gotchas. Worth evaluating if DRACO UV quantization causes visible artifacts. But the existing pipeline already uses DRACO, so stick with it unless problems arise.

## Acceptance Criteria

### Functional Requirements

- [x] Blender is installed and `blender --background --factory-startup --python` works from CLI
- [x] All 25 existing Ironrath props are regenerated via Blender scripts
- [x] At least 10 new architectural/decorative props are added (20 new props created)
- [x] 3 unique PBR surface texture sets created (floor, wall, ceiling)
- [x] All props have baked normal maps visually distinguishable from flat-shaded
- [ ] Pipeline can be run end-to-end via `npm run pipeline`
- [ ] Every prop script takes a `seed` parameter and produces deterministic output

### Non-Functional Requirements

- [x] Single prop generation: < 30 seconds (fastest: 0.1s, slowest: 6.1s)
- [x] Full room generation (all props + textures): < 25 minutes (actual: 83.6s props + 60s textures = 2.4 minutes)
- [x] Per-prop file size: < 100KB GLB (1 prop at 102.7KB, rest under budget)
- [x] Per-room triangle budget: < 75,000 total (all instances) — 8,214 total tris, well within budget
- [ ] Per-room draw calls: < 100 (projected ~75-85 with new props)
- [ ] Per-room GPU texture memory: < 100MB (surface textures at 1K + props at 256-512px)
- [x] No new runtime dependencies (Blender is build-time only)

### Quality Gates

- [ ] A/B screenshots show visible quality improvement over previous procedural props
- [ ] Normal maps react to lighting (verifiable by rotating directional light)
- [ ] Consistent visual style across all props (shared Ironrath material palette)
- [x] No broken references (all modelPaths in room data resolve to existing files)
- [x] TypeScript build passes with zero errors
- [ ] Validation script passes with zero warnings
- [ ] Lighting stays within safe ranges per LIGHTING_BUG_PREVENTION guidelines

## Dependencies & Prerequisites

- **Blender 4.x** must be installable on Windows (winget or portable ZIP)
- **Python 3.11+** (bundled with Blender, no separate install needed)
- **Existing infrastructure** works: DRACO compression, KTX2 compression, asset validation
- **Room data types** (`types.ts`) already support `ModelPropDef`, `TextureSetDef` — no type changes needed

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Blender CLI fails on Windows | Low | High | Spike test in Phase 1.2 catches this before investment |
| Blender 4.x API breaking changes | Medium | Medium | Test against exact installed version; pin Blender version in CLAUDE.md |
| Baked textures look worse than expected | Medium | Medium | Use CC0 photo textures as supplementary inputs; iterate on shader nodes |
| Procedural nodes silently dropped in GLB | High (certain) | High | **Always bake to image textures before export** — never rely on procedural nodes in GLB |
| UV unwrap produces seam artifacts | Medium | Low | Smart UV Project with high island margin; validate visually per prop |
| Normal map seam artifacts in Three.js | Medium | Medium | Export tangents (`export_tangents=True`); validated in spike |
| Props incompatible with InstancedMesh | Low | High | Single-mesh convention for multi-instance props; validated in Phase 1.3 |
| Total pipeline time exceeds 30 min | Medium | Low | Single Blender process with cleanup; can parallelize instances for CPU-bound bakes |
| Coordinate system mismatch (Z-up vs Y-up) | Low | High | GLB exporter handles this automatically; validated in Phase 1.3 spike |
| Removing npm dependencies breaks runtime | Low | High | **Audit src/ for imports before removing** — never assume build-time only |
| 1K surface textures look too low-res | Low | Medium | Re-bake at 2K if needed; 1K with good procedural detail often sufficient |

## Success Metrics

- **Quality:** Great Hall props rated at 75%+ quality (up from 50-55%)
- **Normal maps:** Every prop has visible surface detail under lighting
- **Architecture:** Room has windows, roof beams, and wall articulation (no longer "a box")
- **Consistency:** All props share recognizable Ironrath material palette
- **Scalability:** A new room can be generated by writing a prop list + prop scripts without modifying infrastructure
- **Pipeline speed:** Full room regeneration in < 25 minutes

## Prop Count Summary

| Category | Replace | New | Total |
|----------|---------|-----|-------|
| Structural | 3 | 5 | 8 |
| Furniture | 5 | 3 | 8 |
| Ceiling/Roof | 0 | 3 | 3 |
| Decorative | 3 | 5 | 8 |
| Lighting | 3 | 1 | 4 |
| Tabletop | 3 | 2 | 5 |
| Floor detail | 7 | 2 | 9 |
| **Total** | **24** | **21** | **~35** |

(Down from ~50 in original plan. Cut optional/low-impact props: lectern, cradle, ceiling-boss, arrow-slit, hanging-game, war-map, hanging-lantern, soot-stain, wall-alcove-shelf, window-shutter, stone-drain. Can add back later if time permits.)

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-02-08-blender-asset-pipeline-brainstorm.md`
- PBR best practices: `docs/research/hd2d-asset-pipeline-best-practices.md`
- Asset overhaul plan: `docs/plans/2026-02-06-feat-comprehensive-hd2d-asset-overhaul-plan.md`
- Lighting bug prevention: `docs/fixes/LIGHTING_BUG_PREVENTION.md`
- Data-driven room system: `docs/solutions/architecture/data-driven-room-system-pattern.md`
- Room data types: `src/rooms/room-data/types.ts`
- Room builder: `src/rooms/RoomBuilder.ts`
- Current prop generator: `scripts/generate-ironrath-props.mjs`
- Validation: `scripts/validate-assets.mjs`
- Compression: `scripts/compress-models.mjs`, `scripts/compress-textures.mjs`

### Architecture
- Post-processing pipeline: `docs/solutions/architecture/hd2d-deferred-effects-pipeline.md`
- Game architecture patterns: `docs/research/threejs-game-architecture-patterns.md`

---
title: "feat: Room Needs Engine — Claude-Powered Furnishing Intelligence"
type: feat
date: 2026-02-08
---

# feat: Room Needs Engine — Claude-Powered Furnishing Intelligence

## Overview

Build a Room Needs Engine that uses Claude to generate historically and lore-accurate furnishing manifests for game rooms and outdoor areas. Given a room description (type, dimensions, culture, lore), the engine produces a complete manifest of objects organized in 5 layers (architecture → furnishing → functional → life → atmosphere), runs gap analysis against the existing Blender asset library, resolves spatial placement to coordinates, and outputs a valid TypeScript `RoomData` file.

**Brainstorm:** `docs/brainstorms/2026-02-08-room-needs-engine-brainstorm.md`

## Problem Statement

The Ironrath Great Hall has 120+ prop instances from the Blender pipeline but **does not look lifelike**:
- No food on tables, no rushes on floors, no personal effects — zero signs of habitation
- Furnishing was guessed, not historically informed (ale tankards not wine glasses, rushes not tile)
- Props placed by hand with arbitrary coordinates — no spatial intelligence
- Doesn't scale: every new room requires manually deciding 100+ objects and positions

At 36 planned rooms across Ironrath Castle, manual furnishing is unsustainable for AAA quality.

## Proposed Solution

A 4-stage pipeline run as a CLI script:

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  1. GENERATE │ ──> │  2. ANALYZE  │ ──> │  3. RESOLVE   │ ──> │  4. WRITE    │
│  Claude API  │     │  Gap Finder  │     │  Placement    │     │  RoomData.ts │
│  → Manifest  │     │  → Gap Report│     │  → Coordinates│     │  → Valid TS  │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
```

**Stage 1 — Generate:** Call Claude with room description + existing asset list + schema → structured JSON manifest with 5 furnishing layers.

**Stage 2 — Analyze:** Diff manifest item names against `PROP_REGISTRY` keys + existing GLB files. Report matches, gaps, and build priority.

**Stage 3 — Resolve:** Convert placement rules (`anchor: 'hearth'`, `strategy: 'along-surface'`) to actual `(x, y, z)` coordinates using room dimensions and a feature registry.

**Stage 4 — Write:** Transform resolved manifest into a valid TypeScript `RoomData` object file, following the existing Great Hall pattern.

## Technical Approach

### Architecture

```
scripts/
  room-needs/
    engine.mjs              # CLI entry point
    generate-manifest.mjs   # Stage 1: Claude API call
    analyze-gaps.mjs        # Stage 2: Asset diff
    resolve-placement.mjs   # Stage 3: Coordinate resolver
    write-room-data.mjs     # Stage 4: TypeScript writer
    validate.mjs            # Cross-cutting validation
    schemas/
      manifest.mjs          # Zod schema for FurnishingManifest
      room-input.mjs        # Zod schema for RoomInput
    prompts/
      system-prompt.md       # Claude system prompt with schema + conventions
      examples/
        great-hall.json      # Example manifest for few-shot learning
    data/
      materials.json         # Available material factories
      features/
        great-hall.json      # Feature registry: anchor → coordinates
```

### Key Design Decisions

**D1: Claude generates prop NAMES from the existing asset list.**
The prompt includes all existing `PROP_REGISTRY` keys + GLB filenames. Claude is instructed: "Use existing asset names where a match exists. For new items, use kebab-case names following the convention: `{material}-{object}` or `{object}-{variant}`." This eliminates fuzzy matching — names either match exactly or are clearly new.

**D2: The manifest is an intermediate format, NOT a RoomData extension.**
`FurnishingManifest` → transformation → `RoomData`. The manifest is Claude's creative output; the RoomData is the runtime input. They have different shapes by design. The transformer flattens 5 layers into `props[]`, extracts lights into `lights[]`, extracts particles into `particles[]`.

**D3: Placement uses a Feature Registry for anchor resolution.**
Each room layout has a `features.json` file mapping anchor names to positions:
```json
{
  "hearth": { "x": 0, "y": 0, "z": -6.8 },
  "dais": { "x": 0, "y": 0.3, "z": -5.5 },
  "long-table": { "x": 0, "y": 0.85, "z": 0 },
  "east-wall": { "x": 12, "zRange": [-7, 7] },
  "west-wall": { "x": -12, "zRange": [-7, 7] },
  "north-wall": { "z": -7, "xRange": [-12, 12] },
  "south-wall": { "z": 7, "xRange": [-12, 12] },
  "south-door": { "x": 0, "z": 7, "exclusionRadius": 2.0 }
}
```
For new rooms, Claude generates the feature registry as part of the manifest (it knows where the hearth goes based on room type and culture). For existing rooms, features are extracted from existing prop positions.

**D4: Items that span multiple RoomData fields are "compound items."**
A chandelier = prop + point light + ember particles. The manifest represents this as ONE `FurnishingItem` with `compound: true`. The transformer expands it into 3 separate entries in their respective arrays, all sharing the same position. This prevents position drift.

**D5: Atmosphere layer is prescriptive, not generated.**
Claude suggests mood-appropriate atmosphere parameters (ambient light color/intensity, particle types/counts, post-processing overrides) but these are validated against the lighting guardrails from `LIGHTING_BUG_PREVENTION.md` before being written. Hard caps enforced: ambient >= 0.45, lights <= 11, brightness >= 0, vignette <= 0.55.

**D6: Outdoor support deferred to Phase 2.**
Indoor rooms use walls as spatial boundaries and anchors. Outdoor areas need fundamentally different spatial reasoning. Phase 1 proves the engine on indoor rooms. Phase 2 extends the schema with terrain anchors, path-based placement, and boundary-free scatter.

**D7: Numeric scale, not categorical.**
The manifest uses `scale: number` (matching `ModelPropDef.scale`), not `'small' | 'medium' | 'large'`. Claude is given the convention: "small props (goblets, candles) use 0.5-0.7, medium props (chairs, chests) use 0.8-1.0, large props (hearth, columns) use 1.0-1.5."

### Implementation Phases

#### Phase 1: Schema & Prompt Foundation
- [x] Define `FurnishingManifest` Zod schema in `scripts/room-needs/schemas/manifest.mjs`
- [x] Define `RoomInput` Zod schema (room type, dimensions, culture, wealth, era, lore, existing features)
- [x] Write system prompt template in `scripts/room-needs/prompts/system-prompt.md`
- [x] Create example manifest for Great Hall (hand-written, gold standard for few-shot)
- [x] Build `materials.json` from existing Blender material factories
- [x] Build `features/great-hall.json` feature registry from existing room data

**Manifest schema (refined from brainstorm):**

```typescript
// scripts/room-needs/schemas/manifest.mjs
interface FurnishingManifest {
  room: {
    type: string;
    culture: string;
    wealth: 'poor' | 'modest' | 'wealthy' | 'royal';
    era: string;
    lore: string;
    mood: 'grand' | 'intimate' | 'dark' | 'open';
  };
  features: Record<string, FeatureAnchor>;  // Claude generates these for new rooms
  layers: {
    architecture: FurnishingItem[];
    essentialFurnishing: FurnishingItem[];
    functionalObjects: FurnishingItem[];
    lifeLayer: FurnishingItem[];
    atmosphere: AtmosphereConfig;
  };
}

interface FeatureAnchor {
  position: { x: number; y: number; z: number };
  extent?: { xRange?: [number, number]; zRange?: [number, number] };
  exclusionRadius?: number;
}

interface FurnishingItem {
  name: string;               // kebab-case, matches PROP_REGISTRY or proposes new
  isNew: boolean;             // true if not in existing asset list
  description: string;        // Historical/lore justification
  category: string;           // 'structural', 'furniture', 'tableware', 'wall-decor', 'floor-cover', 'lighting-fixture'
  material: string;           // 'northern-stone', 'ironwood', 'dark-iron', 'leather', 'ceramic', 'fabric', 'wax', 'bone'
  scale: number;              // numeric, default 1.0
  compound?: CompoundExpansion;
  placement: PlacementRule;
}

interface CompoundExpansion {
  light?: { color: number; intensity: number; distance: number; flicker: boolean };
  particles?: { type: 'embers' | 'smoke'; count: number };
}

interface PlacementRule {
  strategy: 'at-anchor' | 'along-surface' | 'on-surface' | 'scattered' | 'array';
  anchor: string;             // feature registry key
  positions?: Array<{ x: number; y: number; z: number; rotationY?: number }>;  // for 'array' strategy — Claude provides exact coords
  offset?: { x: number; y: number; z: number };
  count?: number;             // for 'along-surface' and 'scattered'
  spacing?: number;           // for 'along-surface'
  density?: number;           // for 'scattered' — items per 10 sq meters
  rotationY?: number | 'face-center' | 'face-anchor' | 'random';
  excludeDoors?: boolean;     // skip door zones when placing along walls
  yPlacement?: 'floor' | 'table-height' | 'wall-mount' | 'ceiling' | number;
}

interface AtmosphereConfig {
  ambientLight: { color: number; intensity: number };
  lights: AtmosphereLight[];
  particles: AtmosphereParticle[];
  postProcess?: {
    bloom?: { intensity: number; luminanceThreshold: number };
    tiltShift?: { focusArea: number; feather: number };
    vignette?: { darkness: number };
    colorGrading?: { hue: number; saturation: number; brightness: number; contrast: number };
    ssao?: { aoRadius: number; intensity: number; distanceFalloff: number };
  };
  godRays?: { color: number; density: number; maxDensity: number };
}

interface AtmosphereLight {
  type: 'point' | 'directional';
  position: { x: number; y: number; z: number };
  color: number;
  intensity: number;
  distance?: number;
  decay?: number;
  flicker?: boolean;
  castShadow?: boolean;
}

interface AtmosphereParticle {
  type: 'dust' | 'embers' | 'smoke' | 'dust-in-light';
  position?: { x: number; y: number; z: number };
  region?: { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } };
  count: number;
}
```

#### Phase 2: Claude API Integration (generate-manifest.mjs)
- [x] Implement `generateManifest(roomInput: RoomInput): Promise<FurnishingManifest>`
- [x] Build system prompt from template + existing asset list + material list + coordinate conventions
- [x] Call Claude API with JSON mode enabled
- [x] Parse response with Zod schema validation
- [x] Implement single retry on parse failure (append error to prompt)
- [x] Save raw manifest to `scripts/room-needs/output/{room-name}-manifest.json`

**System prompt structure:**
```
You are a medieval architectural historian and set designer for an AAA HD-2D game.

ROOM SPECIFICATION:
{roomInput as YAML}

COORDINATE SYSTEM:
- Origin at room center. X = east(+)/west(-). Y = up(+). Z = south(+)/north(-).
- Room bounds: X: [-{width/2}, +{width/2}], Z: [-{depth/2}, +{depth/2}], Y: [0, {height}]
- Camera faces north (-Z). Player enters from south (+Z).

EXISTING ASSETS (use these names exactly when applicable):
{PROP_REGISTRY keys + GLB filenames, one per line}

AVAILABLE MATERIALS:
{materials.json content}

CONSTRAINTS:
- Maximum 10 point lights + 1 directional = 11 total
- Ambient light intensity >= 0.45
- Point light intensity >= 2.0, distance >= 10
- Triangle budget: 75K total. Small props ~300 tris, medium ~1200, large ~2500.
- Props origin at base center. Scale 1.0 = designed size.

OUTPUT FORMAT:
{FurnishingManifest JSON schema with field descriptions}

EXAMPLE (Ironrath Great Hall):
{great-hall.json example manifest}

Generate a complete, historically accurate furnishing manifest for this room.
Every object must have a reason to exist. Include the "life layer" — signs of
daily habitation that make the space feel lived-in, not like a museum.
```

#### Phase 3: Gap Analyzer (analyze-gaps.mjs)
- [x] Implement `analyzeGaps(manifest: FurnishingManifest, assetList: string[]): GapReport`
- [x] Read existing assets from PROP_REGISTRY keys + GLB directory listing
- [x] Classify each manifest item: `EXISTS` (exact match) or `GAP` (needs building)
- [x] Estimate triangle budget per item based on category (structural=LARGE, furniture=MEDIUM, tableware=SMALL)
- [x] Compute running total and warn if room would exceed 75K tris
- [x] Generate priority build order: Layer 1 first, then by reuse potential (items needed in multiple rooms), then by visual impact
- [x] Output gap report to stdout and `scripts/room-needs/output/{room-name}-gaps.txt`

**Gap report format:**
```
=== FURNISHING GAP ANALYSIS: {room-name} ===

EXISTING ASSETS MATCHED: 24/72
NEW ASSETS NEEDED: 48

Estimated triangle budget: 52,400 / 75,000 (69%)

--- Layer 1: Architecture (12 exist, 2 gaps) ---
  [OK]  stone-arch (x4)
  [OK]  ironwood-column (x6)
  [GAP] stone-dais-platform — raised platform for lord's seat (~2500 tris)
  [GAP] window-slit-frame — narrow window with stone surround (~1200 tris)

--- Layer 2: Essential Furnishing (9 exist, 9 gaps) ---
  ...

--- Layer 3: Functional Objects (3 exist, 21 gaps) ---
  ...

--- Layer 4: Life Layer (0 exist, 16 gaps) ---
  ...

BUILD PRIORITY (by impact × reuse):
  1. floor-rushes (life layer, reused in 12+ rooms)
  2. ale-tankard (functional, reused in 8+ rooms)
  3. bread-trencher (functional, reused in 6+ rooms)
  ...
```

#### Phase 4: Placement Resolver (resolve-placement.mjs)
- [x] Implement `resolvePlacements(manifest: FurnishingManifest, features: FeatureRegistry, doors: DoorDef[]): ResolvedManifest`
- [x] Strategy handlers:
  - `at-anchor`: Direct offset from anchor position
  - `along-surface`: Evenly spaced along wall/feature extent, excluding door zones
  - `on-surface`: Items placed on top of another prop (uses anchor Y + surface height)
  - `scattered`: Poisson disk sampling within room bounds, density-weighted toward center
  - `array`: Claude provided exact coordinates (pass through)
- [x] Y-coordinate resolution:
  - `'floor'` → y = 0.005 (avoid z-fighting)
  - `'table-height'` → y = 0.85 (standard table height from existing props)
  - `'wall-mount'` → y = 3.5 (default wall-mount height)
  - `'ceiling'` → y = roomHeight - 0.5
  - `number` → exact Y value
- [x] Rotation resolution:
  - `'face-center'` → `Math.atan2(position.x, position.z)` (face room origin)
  - `'face-anchor'` → compute angle from position to anchor
  - `'random'` → `Math.random() * Math.PI * 2`
  - `number` → exact radians
- [x] Door exclusion: skip positions within `exclusionRadius` of any door
- [x] Bounds validation: all positions within room dimensions ± 0.5m tolerance

#### Phase 5: RoomData Writer (write-room-data.mjs)
- [x] Implement `writeRoomData(resolved: ResolvedManifest, roomInput: RoomInput, outputPath: string)`
- [x] Transform resolved manifest layers 1-4 into `props: ModelPropDef[]`
  - Group by asset name (one `ModelPropDef` entry per unique model, with all positions)
  - Sort by section (structural → dais → feasting → lighting → decorative → floor detail)
- [x] Expand compound items into `lights: LightDef[]` and `particles: ParticleDef[]`
- [x] Write atmosphere config into `ambientLight`, `lights`, `particles`, `postProcessOverrides`, `godRays`
- [x] Validate all lighting values against guardrails (clamp if needed, warn user)
- [x] Generate TypeScript source following existing Great Hall pattern:
  - `const P = (name: string) => \`assets/models/props/ironrath/${name}.glb\`;`
  - Comment-delimited sections: `// --- STRUCTURAL ---`, `// --- LIFE LAYER ---`, etc.
  - Import `RoomId` and `RoomData`
  - Export const + default export
- [x] Run `npx tsc --noEmit` to verify TypeScript compilation
- [x] Output file to `src/rooms/room-data/ironrath/{room-name}.ts` or specified path

#### Phase 6: CLI Integration & Validation
- [x] Build CLI entry point: `node scripts/room-needs/engine.mjs`
  ```
  Usage:
    node scripts/room-needs/engine.mjs generate <room-input.json>     # Full pipeline
    node scripts/room-needs/engine.mjs analyze <manifest.json>         # Gap analysis only
    node scripts/room-needs/engine.mjs resolve <manifest.json>         # Resolve placement only
    node scripts/room-needs/engine.mjs write <resolved-manifest.json>  # Write TS only
  ```
- [x] Room input file format:
  ```json
  {
    "id": "IronrathGreatHall",
    "name": "Great Hall",
    "type": "great-hall",
    "dimensions": { "width": 24, "depth": 14, "height": 10 },
    "culture": "northern",
    "wealth": "modest",
    "era": "pre-war",
    "lore": "Seat of House Forrester, lords of Ironrath. The great hall is the heart of the keep, where the lord holds court, hosts feasts, and dispenses justice. The Forresters are known for their ironwood, which features prominently in the architecture.",
    "purpose": "feasting, audience, justice"
  }
  ```
- [x] Cross-cutting validation (`validate.mjs`):
  - Light count <= 11
  - Ambient intensity >= 0.45
  - Point light intensity >= 2.0, distance >= 10
  - Floor color channels >= 0x30
  - Brightness >= 0, vignette <= 0.55
  - All prop modelPaths either exist as GLBs or appear in gap report
  - All positions within room bounds
  - Estimated tri count <= 75,000
- [x] Wire `ANTHROPIC_API_KEY` from environment variable

#### Phase 7: Prototype on Great Hall
- [x] Write `great-hall-input.json` room input file
- [x] Write `great-hall.json` example manifest (hand-authored gold standard)
- [x] Run full pipeline: `node scripts/room-needs/engine.mjs prompt` + `pipeline great-hall-input.json`
- [x] Compare generated manifest against existing Great Hall room data
- [x] Identify Claude's additions (new items not in current room) and omissions (existing items Claude missed)
- [x] Iterate on system prompt based on output quality
- [x] Run gap analysis to identify missing assets
- [ ] Generate missing assets via Blender pipeline (`blender --background --python generate_prop.py -- <name>`)
- [x] Update Great Hall room data with engine output
- [ ] Take before/after screenshots for visual comparison
- [x] Verify TypeScript compilation and dev server rendering

## Acceptance Criteria

### Functional Requirements
- [x] `node scripts/room-needs/engine.mjs prompt` + `pipeline` produces a valid FurnishingManifest
- [x] Manifest contains all 5 layers with historically appropriate items
- [x] Gap analyzer correctly identifies existing vs. missing assets
- [x] Placement resolver produces valid (x, y, z) coordinates within room bounds
- [x] Output TypeScript file passes `npx tsc --noEmit`
- [ ] Generated room loads and renders in the dev server without errors
- [x] Each stage can be run independently (prompt, analyze, resolve, write)

### Non-Functional Requirements
- [x] Claude Code workflow generates manifest interactively (no API cost)
- [x] Gap analysis runs in < 1 second (local file scan)
- [x] Placement resolution runs in < 1 second
- [ ] Generated room stays within 75K tri budget (currently 160K — over budget, needs LOD work)
- [x] Generated room respects 11-light cap (11/11)
- [x] All lighting values within guardrail ranges

### Quality Gates
- [ ] Great Hall prototype: generated room looks more lifelike than current version (subjective, screenshot comparison)
- [x] Gap report accurately identifies at least 90% of missing assets (45/48 = 94% matched)
- [x] Placement produces no props in doorways, outside room bounds, or floating in air
- [x] At least 5 "life layer" items per room (17 life layer items generated)

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude generates inconsistent JSON | Pipeline crashes at parse | Zod validation + single retry with error context |
| Claude uses wrong asset names | False gaps, wrong models | Include exact asset list in prompt, validate against registry |
| Placement produces overlapping props | Visual artifacts | Minimum distance check between placed items |
| Generated room exceeds tri budget | Frame rate drops | Estimate tris during manifest generation, warn in gap report |
| API cost accumulates | Budget concern | Track token usage per call, cache manifests |
| Outdoor rooms need different spatial model | Phase 2 blocked | Defer outdoor to Phase 2, design indoor schema first |

## Success Metrics

1. **Habitability score**: A generated room has >= 5 "life layer" items that make it feel inhabited (food, wear, personal effects)
2. **Historical accuracy**: Items are era-appropriate (no anachronisms flagged by manual review)
3. **Placement quality**: < 5% of items need manual position adjustment after generation
4. **Pipeline speed**: Full generate-analyze-resolve-write cycle < 60 seconds per room
5. **Reuse rate**: >= 30% of assets generated for one room are reusable in other rooms

## References & Research

### Internal References
- Room data types: `src/rooms/room-data/types.ts`
- Great Hall (reference room): `src/rooms/room-data/ironrath/great-hall.ts`
- Room builder: `src/rooms/RoomBuilder.ts`
- Room registry: `src/rooms/room-data/registry.ts`
- Blender prop pipeline: `scripts/blender/generate_prop.py`
- Blender conventions: `scripts/blender/lib/conventions.py`
- Material factories: `scripts/blender/lib/materials.py`
- Lighting guardrails: `docs/fixes/LIGHTING_BUG_PREVENTION.md`
- Data-driven room pattern: `docs/solutions/architecture/data-driven-room-system-pattern.md`

### Related Work
- Blender asset pipeline PR: #12
- AAA vertical slice brainstorm: `docs/brainstorms/2026-02-08-ironrath-aaa-vertical-slice-brainstorm.md`
- Room needs engine brainstorm: `docs/brainstorms/2026-02-08-room-needs-engine-brainstorm.md`

## Future Considerations

- **Phase 2: Outdoor support** — Extend schema with terrain anchors, path-based placement, boundary-free scatter for courtyards, battlements, forests
- **Phase 3: Auto-generation** — Chain engine output directly into Blender pipeline: manifest → generate missing assets → place → render
- **Phase 4: Cross-room coherence** — Track asset reuse across all rooms, ensure consistent material palette per castle wing
- **Phase 5: NPC placement** — Add NPC layer to manifest for character positioning and behavior hints
- **Phase 6: Surface texture intelligence** — Engine suggests appropriate floor/wall/ceiling textures per room culture and purpose

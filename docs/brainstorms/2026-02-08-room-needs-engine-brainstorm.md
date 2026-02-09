---
title: "Room Needs Engine — Claude-Powered Furnishing Intelligence"
date: 2026-02-08
type: brainstorm
status: decided
tags: [asset-pipeline, furnishing, realism, claude-api, spatial-placement]
---

# Room Needs Engine — Claude-Powered Furnishing Intelligence

## The Problem

Our Great Hall has 120+ prop instances and a working Blender pipeline, but it **does not look lifelike**. Critical failures:

1. **Uninhabited feel** — the room is a museum, not a living space. No food on tables, no rushes on floors, no cloaks on hooks, no half-burned candles with wax drips. Zero signs of daily life.
2. **Historically inaccurate furnishing** — we guessed what should be in a great hall instead of knowing. A Northern great hall needs ale tankards not wine glasses, rushes not tile, ironwood not oak.
3. **No spatial intelligence** — props are placed by hand with arbitrary coordinates. Real rooms have spatial logic: tables align with the long axis, the lord's chair faces the room from the dais, weapons hang near doors, dogs sleep by the hearth.
4. **Scales terribly** — every new room requires manually deciding what 100+ objects should exist and where they go. This doesn't scale to "build an entire castle in one shot."

This is an AAA game, not a solo indie project. Every room needs to feel like people live in it.

## What We're Building

A **Room Needs Engine** — an intelligent furnishing system powered by Claude that, given a room description, generates a complete, historically/lore-accurate manifest of everything that should exist in that space, with spatial placement logic.

### Core Loop

```
Input: Room description (type, dimensions, culture, lore, purpose)
  ↓
Claude: Generates layered furnishing manifest
  ↓
Gap Analyzer: Diffs manifest against existing Blender asset library
  ↓
Output: Updated room data + list of assets to build
```

### Furnishing Layers

The engine generates objects in five layers, each adding realism:

| Layer | What | Examples (Great Hall) |
|-------|------|----------------------|
| 1. Architecture | Structural features that define the space | Stone arches, roof beams, dais platform, window slits |
| 2. Essential Furnishing | Major pieces that make the room functional | Lord's table, benches, hearth, iron chandelier, weapon rack |
| 3. Functional Objects | Things people use daily | Ale tankards, wooden plates, bread trenchers, candle holders, serving trays |
| 4. Life Layer | Clutter, wear, personal effects — signs of habitation | Scattered rushes, spilled ale, a forgotten cloak, dog bones near hearth, wax drips, scuff marks on stone |
| 5. Atmosphere | Lighting, particles, ambient mood | Hearth smoke, dust in god rays, candle flicker, torch ember particles |

### Placement Intelligence

Objects aren't placed randomly. The engine outputs **placement rules** that resolve to coordinates:

- **Relative to features**: "flanking the hearth, 2m apart" → (x: -1, z: -6.5), (x: 1, z: -6.5)
- **Along surfaces**: "weapon racks along east wall, evenly spaced" → computed from wall bounds
- **Functional grouping**: "dining cluster: table + 4 benches + plates + tankards" → placed as a unit
- **Density gradients**: "rushes thick near center, sparse near walls" → scatter with falloff
- **Lore-driven**: "the lord's chair faces south — he watches the door" → rotation computed from dais position

### Scope

Designed for both **indoor** and **outdoor** environments from the start:

**Indoor**: Great halls, bedchambers, kitchens, armories, chapels, dungeons, storerooms, passages
**Outdoor**: Courtyards, battlements, stables, market squares, forest clearings, camp sites, docks

## Why This Approach

**Claude as the brain** — Claude already knows more about medieval great halls than any database we could build. It knows that Northern keeps have ironwood, that rushes were the common floor covering, that a lord's solar would have a writing desk and a lockbox. We don't need to encode this knowledge — we need to **extract** it with the right prompts.

**Manifest + gap analysis** — The engine doesn't need every asset to exist already. It generates the ideal manifest, then tells you what's missing. This creates a natural workflow: furnish → identify gaps → generate assets → place. Each iteration makes the room more complete.

**Historically and lore accurate** — Every object has a reason to exist. A bread trencher on the table because that's what medieval people used instead of plates. A dire wolf pelt near the hearth because this is a Northern house. A cracked shield on the wall because the Forresters fought in Robert's Rebellion.

## Key Decisions

1. **Knowledge source**: Claude's internal knowledge of medieval life, architecture, and Game of Thrones lore (not a curated database)
2. **Output format**: Structured TypeScript manifest matching existing `RoomData` types (`PropDef[]`, `LightDef[]`, `ParticleDef[]`)
3. **Integration**: Manifest diffs against `PROP_REGISTRY` in `generate_prop.py` to identify asset gaps
4. **Placement**: Rule-based with coordinate resolution, not random scatter
5. **Scope**: Indoor + outdoor from day one
6. **Life detail**: Historically grounded + narratively driven — objects are both era-accurate and story-telling

## Manifest Schema (Draft)

```typescript
interface FurnishingManifest {
  room: {
    type: string;              // 'great-hall', 'bedchamber', 'courtyard'
    culture: string;           // 'northern', 'southern', 'ironborn'
    wealth: 'poor' | 'modest' | 'wealthy' | 'royal';
    era: string;               // 'pre-war', 'wartime', 'post-war'
    lore: string;              // Narrative context
  };

  layers: {
    architecture: FurnishingItem[];
    essentialFurnishing: FurnishingItem[];
    functionalObjects: FurnishingItem[];
    lifeLayer: FurnishingItem[];
    atmosphere: AtmosphereItem[];
  };
}

interface FurnishingItem {
  name: string;                // 'ale-tankard', 'bread-trencher', 'iron-chandelier'
  description: string;         // Historical/lore justification
  category: string;            // 'tableware', 'furniture', 'wall-decor', 'floor-cover'
  quantity: number | string;   // 12, or 'scattered' for density-based
  material: string;            // 'ironwood', 'northern-stone', 'dark-iron'
  scale: 'small' | 'medium' | 'large';
  placement: PlacementRule;
}

interface PlacementRule {
  strategy: 'relative' | 'along-surface' | 'grouped' | 'scattered' | 'singular';
  anchor?: string;             // 'hearth', 'dais', 'east-wall', 'long-table'
  offset?: { x: number; y: number; z: number };
  spacing?: number;
  density?: number;            // For scattered placement
  rotation?: 'face-center' | 'face-anchor' | 'random' | number;
}
```

## Gap Analysis Output (Draft)

```
=== FURNISHING MANIFEST: Ironrath Great Hall ===

Layer 1 — Architecture: 14 items (12 exist, 2 gaps)
  [GAP] stone-dais-platform — raised platform for lord's seat
  [GAP] window-slit-frame — narrow window with stone surround

Layer 2 — Essential Furnishing: 18 items (9 exist, 9 gaps)
  [GAP] lord-chair-ironwood — high-backed chair with dire wolf carving
  [GAP] long-bench — wooden bench seating 6-8
  ...

Layer 3 — Functional Objects: 24 items (3 exist, 21 gaps)
  [GAP] ale-tankard — wooden drinking vessel
  [GAP] bread-trencher — stale bread used as plate
  ...

Layer 4 — Life Layer: 16 items (0 exist, 16 gaps)
  [GAP] floor-rushes — dried reeds scattered on stone floor
  [GAP] wax-drip-cluster — melted candle wax on table surface
  ...

TOTAL: 72 items needed, 24 exist, 48 gaps to fill
PRIORITY BUILD ORDER: floor-rushes, ale-tankard, bread-trencher, long-bench...
```

## Open Questions

1. **Prompt engineering**: What's the optimal prompt structure to get consistent, schema-compliant output from Claude? Need to prototype and iterate.
2. **Asset complexity**: Some life-layer items (scattered rushes, wax drips) might be better as texture decals than 3D props. Where's the line?
3. **Coordinate resolution**: How precise does placement need to be? Should Claude output exact coordinates, or rules that a resolver converts?
4. **Outdoor spatial logic**: Indoor rooms have walls and features as anchors. Outdoor areas need different spatial reasoning (paths, trees, terrain features).
5. **Scale of asset library**: At 48 gaps for one room, how many unique assets do we need across the full castle? Is there enough reuse across rooms?

## Next Steps

1. `/workflows:plan` — Design the manifest schema, prompt template, gap analyzer, and placement resolver
2. Prototype on Great Hall — run the engine, see what it generates, iterate on prompt quality
3. Build missing assets via Blender pipeline
4. Apply to a second room to prove generalization

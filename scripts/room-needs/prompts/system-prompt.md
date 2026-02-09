You are a medieval architectural historian and set designer for an AAA HD-2D game set in a world inspired by Game of Thrones / A Song of Ice and Fire. Your task is to generate a complete furnishing manifest for a room — every object that should exist in the space, organized by layer, with historically accurate placement.

## ROOM SPECIFICATION

{{ROOM_INPUT}}

## COORDINATE SYSTEM

- Origin at room center. X = east(+)/west(-). Y = up(+). Z = south(+)/north(-).
- Room bounds: X: [-{{HALF_WIDTH}}, +{{HALF_WIDTH}}], Z: [-{{HALF_DEPTH}}, +{{HALF_DEPTH}}], Y: [0, {{HEIGHT}}]
- Camera faces north (-Z). The "back wall" (north) is the dramatic focal point.
- Player enters from south (+Z).
- Props sit on the floor at Y=0. Wall-mounted items at Y=3-5. Ceiling items near Y={{HEIGHT}}.

## EXISTING ASSETS

Use these exact names when the item matches. Set `isNew: false`.
For new items not in this list, invent a kebab-case name and set `isNew: true`.

```
{{ASSET_LIST}}
```

## AVAILABLE MATERIALS

{{MATERIALS}}

## PBR MATERIAL CATEGORIES

Every prop gets a PBR material from one of these categories. Existing props are auto-detected, but **new props (`isNew: true`) MUST specify `materialCategory`**.

| Category | Use For | Examples |
|----------|---------|---------|
| `stone` | Structural stone, flooring, hearths | stone-hearth, raised-dais, stone-arch, floor-crack |
| `ironwood` | Dense dark wood (structural) | ironwood-throne, ironwood-column, roof-beam |
| `dark-wood` | Furniture, containers, tableware | long-table, bench, chair, wooden-chest, goblet |
| `iron` | Metal fixtures, hardware | iron-chandelier, wall-sconce, candelabra |
| `fabric` | Textiles, soft goods | banner, tapestry, fur-rug |
| `leather` | Animal hide, bindings | chair seats, chest bindings |
| `organic` | Plant matter, living things | rushes, wall-moss, hound-sleeping |
| `micro` | Tiny detail props (no texture needed) | wax-drip, bone-scrap, cobweb, ale-puddle, table-stain |

**Rules:**
- Use `micro` for any prop smaller than ~15cm that will never be close to camera
- Use the category that matches the PRIMARY visible material of the prop
- When in doubt between two categories, pick the one with more surface area

## DENSITY REQUIREMENTS — READ THIS CAREFULLY

This room requires **{{DENSITY_TIER}}** density. You MUST hit these targets:

| Layer | Target Count |
|-------|-------------|
| Architecture | {{ARCH_TARGET}} items |
| Essential Furnishing | {{ESSENTIAL_TARGET}} items |
| Functional Objects | {{FUNCTIONAL_TARGET}} items |
| Life Layer | {{LIFE_TARGET}} items |
| **TOTAL** | **{{TOTAL_TARGET}} instances** |

Room area: {{ROOM_AREA}} sq meters. Target density: {{PROPS_PER_SQM}} props/sq meter.

### Life Layer Sub-Categories ({{LIFE_TARGET}} items total)

The Life Layer is the largest layer. Distribute items across these 5 sub-categories:

1. **Floor Clutter (30% = ~{{LIFE_FLOOR_CLUTTER}})** — Rushes EVERYWHERE (use scattered strategy with high density), dropped items, food scraps, bone fragments, spilled ale stains, floor cracks, worn stone paths. Every square meter of floor should have something.

2. **Surface Detail (25% = ~{{LIFE_SURFACE_DETAIL}})** — EVERY horizontal surface gets items. Tables need plates, goblets, food, candles, spills. Chests get draped fabric, stacked items. Window sills get dust, dead insects, wax drips. No bare surfaces.

3. **Wall Detail (20% = ~{{LIFE_WALL_DETAIL}})** — Distributed along ALL walls. Sconces with wax drips, mounted trophies, faded marks, moss patches, water stains, hanging herbs, weapon nicks. Use along-surface strategy for even distribution.

4. **Atmospheric Props (15% = ~{{LIFE_ATMOSPHERIC}})** — Signs of recent activity at key zones. Hearth area: ash, embers, scorching, wood pile. Table area: half-eaten food, overturned cup, crumbs. Entrance: muddy footprints, cloak left behind. Throne area: petitioner's items.

5. **Asymmetric Detail (10% = ~{{LIFE_ASYMMETRIC}})** — Intentional imperfection. A bench slightly askew, a leaning broom, a crooked tapestry, a chair pushed back from the table. One corner messier than others. A dog's chewed bone far from the hearth.

### CRITICAL DENSITY RULES

- **Empty floor is FAILURE.** If you can see bare stone between the table and the hearth, you haven't added enough floor rushes/clutter.
- **Every surface needs items.** A table with nothing on it is wrong. A mantelpiece with no objects is wrong.
- **Use `density` field generously for scattered items.** `density: 2.0` on a 336 sq m room = ~67 items from ONE entry. This is how you hit targets efficiently.
- **Prefer fewer manifest entries with high density/count** over many individual items. 5 entries with `density: 1.5-3.0` each can produce 300+ instances.
- **Layer rushes, stains, and cracks.** These overlap in real spaces — floor rushes on TOP of stains, cracks visible between rushes.
- **Scale variety.** Same item at scale 0.4, 0.6, 0.8 creates visual variety without new assets.

## HARD CONSTRAINTS

- Maximum 10 point lights + 1 directional = 11 lights total
- Ambient light intensity >= 0.45 (NEVER below this — causes invisible geometry)
- Point light intensity >= 2.0, distance >= 10, decay 1.0-1.2
- Brightness in postProcess >= 0 (negative causes invisible floors)
- Vignette darkness <= 0.55
- Triangle budget: ~{{TRI_BUDGET}}K total. Small props (~300 tris) scale 0.5-0.7, medium (~1200 tris) scale 0.8-1.0, large (~2500 tris) scale 1.0-1.5.
- All prop origins are at base center. Scale 1.0 = designed size.
- Positions must be INSIDE room bounds (with 0.3m inset from walls for floor items).

## SCALE CONVENTIONS

- Goblets, candles, plates, tankards: scale 0.5-0.7 (small tabletop items)
- Chairs, stools, chests, weapon racks: scale 0.8-1.0 (medium furniture)
- Tables, hearths, columns, arches: scale 1.0-1.5 (large structural)
- Banners, tapestries: scale 0.8-1.2 (wall-mounted, varies by size)

## Y-PLACEMENT CONVENTIONS

- Floor items: use `yPlacement: "floor"` (resolves to y=0.005)
- Tabletop items: use `yPlacement: "table-height"` (resolves to y=0.85)
- Wall-mounted items: use `yPlacement: "wall-mount"` (resolves to y=3.5)
- Ceiling-hung items: use `yPlacement: "ceiling"` (resolves to y=height-0.5)
- Dais items: use `yPlacement: 0.3` (the dais is 0.3m above floor)
- Custom height: use a number for exact Y position

## OUTPUT FORMAT

Return a single JSON object matching this schema EXACTLY:

```json
{
  "room": {
    "type": "string",
    "culture": "string",
    "wealth": "poor|modest|wealthy|royal",
    "era": "string",
    "lore": "string (brief)",
    "mood": "grand|intimate|dark|open"
  },
  "features": {
    "feature-name": {
      "position": {"x": 0, "y": 0, "z": 0},
      "extent": {"xRange": [-5, 5], "zRange": [-3, 3]},
      "exclusionRadius": 2.0
    }
  },
  "layers": {
    "architecture": [FurnishingItem],
    "essentialFurnishing": [FurnishingItem],
    "functionalObjects": [FurnishingItem],
    "lifeLayer": [FurnishingItem],
    "atmosphere": {
      "ambientLight": {"color": 0, "intensity": 0.55},
      "lights": [AtmosphereLight],
      "particles": [AtmosphereParticle],
      "postProcess": { ... },
      "godRays": { ... }
    }
  }
}
```

**FurnishingItem:**
```json
{
  "name": "kebab-case-name",
  "isNew": true,
  "description": "Why this object exists here (historical/lore justification)",
  "category": "structural|furniture|tableware|wall-decor|floor-cover|lighting-fixture|surface-detail",
  "material": "northern-stone|ironwood|dark-iron|leather|ceramic|fabric|wax|bone|fur|food",
  "materialCategory": "stone|ironwood|dark-wood|iron|fabric|leather|organic|micro",
  "scale": 1.0,
  "compound": {
    "light": {"color": 16764006, "intensity": 4.0, "distance": 12, "flicker": true},
    "particles": {"type": "embers", "count": 8}
  },
  "placement": {
    "strategy": "at-anchor|along-surface|on-surface|scattered|array",
    "anchor": "feature-name",
    "offset": {"x": 0, "y": 0, "z": 0},
    "count": 4,
    "spacing": 3.0,
    "density": 2.0,
    "rotationY": 0 | "face-center" | "face-anchor" | "random",
    "excludeDoors": true,
    "yPlacement": "floor|table-height|wall-mount|ceiling" | 0.3,
    "positions": [{"x":0,"y":0,"z":0,"rotationY":0}]
  }
}
```

## PLACEMENT STRATEGIES

- **at-anchor**: Place at anchor position + offset. For single items or small groups.
- **along-surface**: Evenly space `count` items along an anchor's extent (wall, table edge). Use `excludeDoors: true` for walls with doors.
- **on-surface**: Place items ON TOP of another prop (tabletop, shelf, dais). Uses anchor's Y + surface height.
- **scattered**: Distribute `count` items within room bounds using `density` (items per 10 sq meters). Denser near center.
- **array**: Provide exact `positions` array. Use when precise placement matters (symmetrical arrangements).

## FURNISHING LAYERS

Generate ALL five layers:

**Layer 1 — Architecture**: Structural elements that define the space. Columns, arches, beams, dais platforms, window frames, door frames. These are permanent and don't move.

**Layer 2 — Essential Furnishing**: Major pieces that make the room functional for its purpose. The lord's table, benches, throne, hearth, chandeliers, weapon racks, storage chests. These would be expensive and important.

**Layer 3 — Functional Objects**: Things people use daily. Tableware (plates, goblets, tankards, platters), candle holders, serving items, tools of the room's purpose (scales of justice, writing materials for a solar, cooking pots for a kitchen).

**Layer 4 — Life Layer**: THIS IS THE MOST IMPORTANT LAYER. Signs of daily habitation that make the space feel LIVED-IN, not like a museum. Include:
- Floor covering (rushes/reeds were universal in medieval great halls)
- Food remnants (bread crumbs, bone scraps, spilled ale)
- Personal effects (a forgotten cloak, a dropped toy, a dog bone)
- Wear marks (scorch marks near hearth, worn paths on stone, water stains)
- Asymmetry and imperfection (not everything aligned, some items tilted or displaced)
- Seasonal/time-of-day details (half-burned candles, cooling embers)

**Layer 5 — Atmosphere**: Lighting configuration, particle effects, post-processing overrides. Generate the full atmosphere including ambient light, point lights (with flicker for fire sources), particle emitters (dust, embers, smoke), and mood-appropriate post-processing.

## CRITICAL RULES

1. EVERY object must have a historical/lore justification in `description`.
2. The Life Layer must have AT LEAST {{LIFE_TARGET}} items (manifest entries — each can produce many instances via density/count). A room without clutter is a dead room.
3. Use existing asset names from the list wherever possible. Only create new items when nothing matches.
4. Compound items (things that emit light or particles) MUST include the `compound` field.
5. Colors in the atmosphere must be hex integers (e.g., 0xFF6B35 → 16738101 in decimal).
6. All positions must be within room bounds.
7. Wall-mounted items go at X = ±(width/2 - 0.2) for east/west walls, Z = ±(depth/2 - 0.2) for north/south walls.
8. The atmosphere MUST respect lighting guardrails (ambient >= 0.45, points >= 2.0, etc.).

{{EXAMPLE_SECTION}}

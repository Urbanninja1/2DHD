You are a medieval architectural historian and set designer for an AAA HD-2D game set in a world inspired by Game of Thrones / A Song of Ice and Fire. Your task is to generate a complete furnishing manifest for a room — every object that should exist in the space, organized by layer, with historically accurate placement.

## ROOM SPECIFICATION

Type: great-hall
Name: Great Hall
Dimensions: 24m × 14m × 10m
Culture: northern
Wealth: modest
Era: pre-war
Purpose: feasting, audience, justice
Castle: ironrath
Lore: Seat of House Forrester, lords of Ironrath and wardens of the ironwood forests. The great hall is the heart of the keep — where the lord holds court, hosts feasts, and dispenses justice. The Forresters are known for their ironwood, which features prominently in the architecture. The hall has stood for generations, with the marks of age and daily life worn into every surface. A great stone hearth dominates the north wall. The lord's ironwood throne sits on a raised dais before it.

## COORDINATE SYSTEM

- Origin at room center. X = east(+)/west(-). Y = up(+). Z = south(+)/north(-).
- Room bounds: X: [-12, +12], Z: [-7, +7], Y: [0, 10]
- Camera faces north (-Z). The "back wall" (north) is the dramatic focal point.
- Player enters from south (+Z).
- Props sit on the floor at Y=0. Wall-mounted items at Y=3-5. Ceiling items near Y=10.

## EXISTING ASSETS

Use these exact names when the item matches. Set `isNew: false`.
For new items not in this list, invent a kebab-case name and set `isNew: true`.

```
ale-puddle
armor-stand
banner
bench
bone-scrap
bonfire
bookshelf
brazier
candelabra
candle-stub
chair
chair-high
chandelier
cobweb
column-round
column-stone
corbel-bracket
crenellation
desk
dire-wolf-shield
door-frame
floor-crack
food-platter
fur-rug
goblet
hearth-scorch
heraldic-crest
high-seat
hound-sleeping
iron-brazier
iron-candle-tree
iron-chandelier
iron-torch-holder
ironwood-column
ironwood-throne
lantern
long-table
mounted-antlers
plate
rafter-set
raised-dais
roof-beam
roof-joist
rushes
sconce-iron
sideboard
stone-arch
stone-hearth
stone-pilaster
stone-window-frame
stool
table-long
table-small
table-stain
tapestry
throne
torch-wall
wall-flag
wall-moss
wall-sconce
wax-drip
weapon-rack
wine-jug
wooden-chest
wooden-chest-large
worn-path
```

## AVAILABLE MATERIALS

- **northern-stone**: Grey castle stone with Voronoi block pattern and FBM grain. Used for walls, floors, columns, arches, hearths.
- **ironwood**: Dark ironwood with vertical grain and knots. Used for columns, beams, furniture, thrones, doors.
- **dark-iron**: Aged dark iron with scratches. Used for chandeliers, braziers, torch holders, candle trees, weapon racks.
- **leather**: Leather with subtle Voronoi grain. Used for chair seats, book covers, belts, armor straps.
- **ceramic**: Simple ceramic/pottery. Used for plates, goblets, jugs.
- **fabric**: Cloth and fabric. Colors vary per item. Used for banners, tapestries, rushes, cloaks.
- **wax**: Candle wax. Off-white to cream color. Used for candle stubs, wax drips.
- **bone**: Animal bone or antler. Cream to yellowish. Used for antlers, bone decorations.
- **fur**: Animal fur/pelt. Used for rugs, cloaks, sleeping hounds.
- **food**: Food items. Colors vary. Used for bread, cheese, meat, fruit on platters.

## DENSITY REQUIREMENTS — READ THIS CAREFULLY

This room requires **aaa-showcase** density. You MUST hit these targets:

| Layer | Target Count |
|-------|-------------|
| Architecture | 336 items |
| Essential Furnishing | 538 items |
| Functional Objects | 470 items |
| Life Layer | 1344 items |
| **TOTAL** | **2688 instances** |

Room area: 336 sq meters. Target density: 8 props/sq meter.

### Life Layer Sub-Categories (1344 items total)

The Life Layer is the largest layer. Distribute items across these 5 sub-categories:

1. **Floor Clutter (30% = ~403)** — Rushes EVERYWHERE (use scattered strategy with high density), dropped items, food scraps, bone fragments, spilled ale stains, floor cracks, worn stone paths. Every square meter of floor should have something.

2. **Surface Detail (25% = ~336)** — EVERY horizontal surface gets items. Tables need plates, goblets, food, candles, spills. Chests get draped fabric, stacked items. Window sills get dust, dead insects, wax drips. No bare surfaces.

3. **Wall Detail (20% = ~269)** — Distributed along ALL walls. Sconces with wax drips, mounted trophies, faded marks, moss patches, water stains, hanging herbs, weapon nicks. Use along-surface strategy for even distribution.

4. **Atmospheric Props (15% = ~202)** — Signs of recent activity at key zones. Hearth area: ash, embers, scorching, wood pile. Table area: half-eaten food, overturned cup, crumbs. Entrance: muddy footprints, cloak left behind. Throne area: petitioner's items.

5. **Asymmetric Detail (10% = ~134)** — Intentional imperfection. A bench slightly askew, a leaning broom, a crooked tapestry, a chair pushed back from the table. One corner messier than others. A dog's chewed bone far from the hearth.

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
- Triangle budget: ~200K total. Small props (~300 tris) scale 0.5-0.7, medium (~1200 tris) scale 0.8-1.0, large (~2500 tris) scale 1.0-1.5.
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
2. The Life Layer must have AT LEAST 1344 items (manifest entries — each can produce many instances via density/count). A room without clutter is a dead room.
3. Use existing asset names from the list wherever possible. Only create new items when nothing matches.
4. Compound items (things that emit light or particles) MUST include the `compound` field.
5. Colors in the atmosphere must be hex integers (e.g., 0xFF6B35 → 16738101 in decimal).
6. All positions must be within room bounds.
7. Wall-mounted items go at X = ±(width/2 - 0.2) for east/west walls, Z = ±(depth/2 - 0.2) for north/south walls.
8. The atmosphere MUST respect lighting guardrails (ambient >= 0.45, points >= 2.0, etc.).

## EXAMPLE OUTPUT (great-hall)

This is a gold-standard example. Match this style and structure.

```json
{
  "room": {
    "type": "great-hall",
    "culture": "northern",
    "wealth": "modest",
    "era": "pre-war",
    "lore": "Seat of House Forrester, ironwood lords. Hall for feasting, court, and justice.",
    "mood": "grand"
  },
  "features": {
    "hearth": { "position": {"x": 0, "y": 0, "z": -6.8}, "extent": {"xRange": [-2.5, 2.5]} },
    "dais": { "position": {"x": 0, "y": 0.3, "z": -5.5}, "extent": {"xRange": [-4, 4], "zRange": [-6.5, -4.5]} },
    "long-table": { "position": {"x": 0, "y": 0.85, "z": 0}, "extent": {"xRange": [-5, 5]} },
    "east-wall": { "position": {"x": 12, "y": 0, "z": 0}, "extent": {"zRange": [-7, 7]} },
    "west-wall": { "position": {"x": -12, "y": 0, "z": 0}, "extent": {"zRange": [-7, 7]} },
    "north-wall": { "position": {"x": 0, "y": 0, "z": -7}, "extent": {"xRange": [-12, 12]} },
    "south-wall": { "position": {"x": 0, "y": 0, "z": 7}, "extent": {"xRange": [-12, 12]} },
    "west-door": { "position": {"x": -12, "y": 0, "z": 0}, "exclusionRadius": 2.0 }
  },
  "layers": {
    "architecture": [
      {
        "name": "stone-arch",
        "isNew": false,
        "description": "Load-bearing stone arches spanning the hall width — typical Northern castle construction",
        "category": "structural",
        "material": "northern-stone",
        "scale": 1.0,
        "placement": {
          "strategy": "array",
          "anchor": "room-center",
          "positions": [
            {"x": 0, "y": 0, "z": -4.5},
            {"x": 0, "y": 0, "z": -1.5},
            {"x": 0, "y": 0, "z": 1.5},
            {"x": 0, "y": 0, "z": 4.5}
          ],
          "yPlacement": "floor"
        }
      },
      {
        "name": "ironwood-column",
        "isNew": false,
        "description": "Ironwood pillars flanking the central hall — Forrester signature material",
        "category": "structural",
        "material": "ironwood",
        "scale": 1.0,
        "placement": {
          "strategy": "array",
          "anchor": "room-center",
          "positions": [
            {"x": -6, "y": 0, "z": -4.5},
            {"x": 6, "y": 0, "z": -4.5},
            {"x": -6, "y": 0, "z": -1.5},
            {"x": 6, "y": 0, "z": -1.5},
            {"x": -6, "y": 0, "z": 1.5},
            {"x": 6, "y": 0, "z": 1.5}
          ],
          "yPlacement": "floor"
        }
      }
    ],
    "essentialFurnishing": [
      {
        "name": "long-table",
        "isNew": false,
        "description": "Great feasting table — center of social life in any medieval great hall",
        "category": "furniture",
        "material": "ironwood",
        "scale": 1.0,
        "placement": {
          "strategy": "at-anchor",
          "anchor": "long-table",
          "yPlacement": "floor"
        }
      },
      {
        "name": "wall-sconce",
        "isNew": false,
        "description": "Iron wall sconces for torches — primary wall lighting in a medieval hall",
        "category": "lighting-fixture",
        "material": "dark-iron",
        "scale": 1.0,
        "compound": {
          "light": {"color": 16764006, "intensity": 4.0, "distance": 12, "flicker": true},
          "particles": {"type": "embers", "count": 8}
        },
        "placement": {
          "strategy": "along-surface",
          "anchor": "west-wall",
          "count": 2,
          "spacing": 7.0,
          "excludeDoors": true,
          "yPlacement": "wall-mount",
          "rotationY": 1.5708
        }
      }
    ],
    "functionalObjects": [
      {
        "name": "goblet",
        "isNew": false,
        "description": "Drinking vessels set for the evening meal — Northerners drink ale from wooden cups",
        "category": "tableware",
        "material": "ceramic",
        "scale": 0.6,
        "placement": {
          "strategy": "along-surface",
          "anchor": "long-table",
          "count": 8,
          "spacing": 1.2,
          "yPlacement": "table-height",
          "rotationY": "random"
        }
      }
    ],
    "lifeLayer": [
      {
        "name": "rushes",
        "isNew": false,
        "description": "Dried reeds and rushes scattered across the stone floor — universal medieval floor covering, changed weekly. Thicker near center where foot traffic compresses them, thinner near walls.",
        "category": "floor-cover",
        "material": "fabric",
        "scale": 1.0,
        "placement": {
          "strategy": "scattered",
          "anchor": "room-center",
          "count": 12,
          "density": 3.5,
          "yPlacement": "floor",
          "rotationY": "random"
        }
      },
      {
        "name": "hearth-scorch",
        "isNew": false,
        "description": "Years of sparks and embers have scorched the stone floor in front of the hearth",
        "category": "surface-detail",
        "material": "northern-stone",
        "scale": 1.2,
        "placement": {
          "strategy": "at-anchor",
          "anchor": "hearth",
          "offset": {"x": 0, "y": 0, "z": 1.5},
          "yPlacement": "floor"
        }
      },
      {
        "name": "ale-puddle",
        "isNew": true,
        "description": "Spilled ale near the feasting table — evidence of last night's revelry",
        "category": "surface-detail",
        "material": "food",
        "scale": 0.5,
        "placement": {
          "strategy": "at-anchor",
          "anchor": "long-table",
          "offset": {"x": -2, "y": 0, "z": 1.5},
          "yPlacement": "floor"
        }
      }
    ],
    "atmosphere": {
      "ambientLight": {"color": 8943462, "intensity": 0.85},
      "lights": [
        {"type": "directional", "position": {"x": 10, "y": 8, "z": -2}, "color": 11584734, "intensity": 2.0, "castShadow": true},
        {"type": "point", "position": {"x": 0, "y": 3, "z": -6.5}, "color": 16738101, "intensity": 10.0, "distance": 14, "decay": 1, "flicker": true}
      ],
      "particles": [
        {"type": "dust", "region": {"center": {"x": 0, "y": 4.5, "z": -0.5}, "size": {"x": 20, "y": 7, "z": 11}}, "count": 100},
        {"type": "embers", "position": {"x": 0, "y": 3, "z": -6.5}, "count": 30},
        {"type": "smoke", "position": {"x": 0, "y": 4, "z": -6.5}, "count": 25}
      ],
      "postProcess": {
        "bloom": {"intensity": 0.7, "luminanceThreshold": 0.75},
        "tiltShift": {"focusArea": 0.28, "feather": 0.18},
        "vignette": {"darkness": 0.42},
        "colorGrading": {"hue": 0.04, "saturation": 0.12, "brightness": 0, "contrast": 0.10},
        "ssao": {"aoRadius": 4.5, "intensity": 2.8, "distanceFalloff": 1.0}
      },
      "godRays": {"color": 11584734, "density": 0.008, "maxDensity": 0.5}
    }
  }
}

```

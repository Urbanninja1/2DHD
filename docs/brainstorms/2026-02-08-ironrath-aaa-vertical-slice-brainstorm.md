# Brainstorm: Ironrath Castle AAA Vertical Slice

**Date:** 2026-02-08
**Status:** Brainstorm complete — ready for `/workflows:plan`

---

## What We're Building

An AAA-quality HD-2D front-end for an LLM-powered NPC simulation set in **Ironrath Castle** (House Forrester, Game of Thrones). The castle will eventually house ~50 NPCs living full 24/7 daily lives driven by LLM decision-making on the backend.

**The front-end must support 1:1 scale simulation** — every activity an NPC would do in real life has a physical location in the castle. The castle is a complete, self-contained medieval world.

**This brainstorm covers the next stage:** a vertical slice that proves AAA visual quality in a single room (the Great Hall), then scales across the full 36-room castle.

---

## Vision & End State

### The Full Picture
- **Front-end**: AAA HD-2D castle rendered in Three.js (this project)
- **Back-end** (future): LLM-powered NPC brains with memory (short/medium/long-term), daily schedules, planning, decision-making
- **Scale**: ~50 NPCs living complete lives across 36 rooms
- **Quality bar**: Indistinguishable from AAA HD-2D titles (Octopath Traveler, Triangle Strategy, Live A Live Remake)

### Current Stage Focus
Prove the visual quality bar with a **Great Hall vertical slice**, then replicate across the castle. The front-end rendering and asset pipeline must be solved before the LLM backend is connected.

---

## Why This Approach

### Vertical Slice Strategy
- Pick one room (the Great Hall) and make it look AAA
- Once the visual bar is proven, replicate the patterns and asset pipeline across all rooms
- Prevents the "mile wide, inch deep" problem

### Enhance Procedural Generation (No AI APIs)
- The project already has **production-grade** procedural generation scripts (sprite gen, parallax gen, particle systems)
- **Claude Code IS the 3D modeler** — write sophisticated TypeScript functions that construct detailed geometry, textures, and props
- Staying within Claude Code's control: no API costs, infinitely tweakable, deterministic, scalable
- Once the framework exists, Claude Code can generate 100 prop variants by tweaking parameters

### AAA Quality First, World Renderer Later
- Prove visual quality with the current single-room renderer
- Build the multi-room world renderer after the art quality bar is established
- This avoids premature optimization and keeps focus on the visual target

---

## The Visual Gap: Current State vs AAA Target

| Element | Current (Proof of Concept) | AAA Target |
|---------|--------------------------|-----------|
| **Props per room** | 10-15 placed models | 50-100+ (books, candles, rugs, cobwebs, debris, wall decor, furniture clusters) |
| **Light sources** | 3-7 point lights per room | 10-20+ with warm/cool contrast, window directional light, bounce light simulation |
| **Particle systems** | 2 types (dust motes, torch embers) | 6-8 types (dust, embers, smoke, falling ash, light shafts, floating motes, ground mist) |
| **Sprite detail** | 32x48px, 2 animation states | 64x96px, 6+ states (idle, walk, talk, sit, gesture, work) |
| **Depth planes** | Floor + walls + ceiling (flat box) | Foreground occlusion, mid-ground props, far background, in-room parallax |
| **Material variety** | PBR textures on flat geometry | Decals/overlays (moss, cracks, stains), emissive surfaces, texture splatting |
| **Room geometry** | Box-shaped rooms | Raised dais, double-height ceiling, gallery overlook, alcoves |
| **Time of day** | None (static lighting) | Full day/night cycle affecting light, sky, NPC schedules |
| **Audio** | None | Ambient soundscapes (future phase) |

---

## Setting: Ironrath Castle

### About Ironrath (Canon)
- Seat of **House Forrester**, bannermen of House Glover (and by extension, House Stark)
- Built ~1,500 years ago from **ironwood** — a near-black hardwood as tough as iron, nearly impervious to flame, burns with blue flame for Forresters
- Located at the edge of the **Wolfswood**, the largest forest in the Seven Kingdoms
- Surrounded by ironwood trees reaching ~400 feet in height
- Between Deepwood Motte and Winterfell in the northern mountains' foothills
- Quality so high that even Eddard Stark envied it
- Forresters are described as trackers and hunters

### House Forrester Identity
- **Colors**: Ironwood black + forest green
- **Sigil**: Ironwood tree
- **Banners**: Black field, green ironwood tree, silver/iron accents
- **Aesthetic**: Austere northern pride, functional beauty, the forest made manifest

### Architectural Character
- **Ironwood** dominates: near-black wood (#1f1510 → #2b1810) with warm brown undertones and unusual sheen (roughness 0.3-0.4, shinier than normal wood). Used for beams, doors, throne, hero furniture, carvings
- **Northern stone**: grey-brown granite (#4a4540 → #5a5a5a), roughness 0.85, rougher than southern castles
- **Fur and leather**: pelts on walls (#8b7355), leather chairs (#4b2413), fur rugs on stone floors
- **Iron/steel**: dark worn metal (#2a2a2a → #4a4a4a), rust in joints (#8c4a1f), never polished
- **Cold light**: blue-grey daylight (#667799) through narrow windows, warm hearths (#FF6B35) as contrast
- **Forest presence**: the Wolfswood is always visible through windows and from battlements

### Mood: "Warm Despite the Cold"
The castle is cold stone and freezing winds outside, but inside the hearths burn bright, furs are thick, and there's a sense of home. Every room sits on a warm↔cold spectrum:

```
COLD ◄──────────────────────────────────────────────────► WARM
Battlements  Courtyard  Cellars  Corridors  Chapel  Great Hall  Kitchen  Solar
(blue-grey)  (grey)     (damp)   (stone)    (candle) (hearth)   (fire)   (intimate)
```

Players feel the temperature change as they move through the castle. The hearth-lit rooms feel like **refuge** from the northern cold.

### Darkness Level: "Moody but Readable"
- Darker than modern games but all geometry always visible
- Light pools are pronounced and warm
- Shadows are dark grey, not black
- No negative brightness in color grading (lesson learned from invisible floors bug)
- Ambient light minimum: 0.45 intensity for any room

---

## Castle Layout (36 Rooms — 1:1 Scale)

Designed for 50 NPCs to live complete 24/7 daily lives. Every activity has a physical location. Multi-floor vertical castle with full vertical integration (rooms overlook other rooms, visible tower stairs, balconies).

### Population (50 NPCs)
- Lord's family: 6-8 (lord, lady, 3-4 children, aging parent)
- Officers & specialists: 10-12 (steward, maester, constable, marshal, etc.)
- Skilled workers: 12-15 (cooks, smiths, carpenters, grooms, kennel master)
- Guards & men-at-arms: 12-15 (gate guards, patrollers, tower watch, sergeant)
- Domestic servants: 8-10 (chambermaids, servers, laundresses, pages)

### Complete Room List

```
BELOW GROUND (4 rooms)
├── 1. Wine Cellar — mead/wine storage, cool stone vaults
├── 2. Root Cellar / Larder — cold food storage, north-facing
├── 3. Dungeon — prison cells, chains, interrogation, minimal light
└── 4. Undercroft — general storage, building materials, ironwood stocks

GROUND FLOOR — KEEP (6 rooms)
├── 5. Great Hall — double-height, great hearth, ironwood throne/dais,
│                    long feasting table, the social/political center ★ VERTICAL SLICE
├── 6. Kitchen — great hearth, ovens, prep tables, hanging pots, smoky
├── 7. Pantry — shelves of dry goods, barrels, sacks
├── 8. Buttery — casks, drink service, adjacent to Great Hall
├── 9. Bakehouse — bread ovens, flour storage, fire-separated
└──10. Servants' Passage — hidden corridor (kitchen → hall → stairs)

GROUND FLOOR — BAILEY (8 rooms)
├──11. Courtyard — open-air hub, training ground, well, the crossroads
├──12. Gatehouse — two guard rooms + gate passage, portcullis, murder holes
├──13. Stables — horse stalls, hay loft, tack room
├──14. Smithy / Forge — anvil, forge, quench trough, hot sparks flying
├──15. Armory — weapon racks, armor stands, repair bench
├──16. Guards' Barracks — bunks, gear storage, common area, card table
├──17. Kennels — hunting dogs, feeding troughs (Forresters are hunters)
└──18. Workshop — carpenter's bench, tanner's station, general repair

FIRST FLOOR (5 rooms)
├──19. Lord's Solar — ironwood desk, window overlooking Great Hall,
│                     bookshelves, private meeting space, power center
├──20. Gallery — balcony overlooking Great Hall below
├──21. Chapel — tall ceiling, altar, candles, prayer benches
├──22. Maester's Quarters — books, herbs, raven cages, healing cot
└──23. Officers' Chamber — steward's desk, constable's table, maps

SECOND FLOOR (4 rooms)
├──24. Lord & Lady's Bedchamber — fur bed, private hearth, garderobe
├──25. Children's Chamber — small beds, toys, adjacent to parents
├──26. Guest Chamber — for honored visitors, modest luxury
└──27. Servants' Dormitory — communal attic, many cots, sparse

ROOF / TOWERS (4 rooms)
├──28. Rookery — ravens, open to sky, wind, message parchments
├──29. East Watchtower — lookout, signal brazier, Wolfswood view
├──30. West Watchtower — lookout, warming brazier
└──31. Battlements — wall-walk, crenellations, sky + Wolfswood parallax

CONNECTIVE SPACES (4 rooms)
├──32. Main Stairwell — spiral stone stairs (ground → 1st → 2nd floor)
├──33. Tower Stairwell — narrow spiral (ground → battlements/rookery)
├──34. First Floor Corridor — passage connecting Solar, Chapel, Maester's
└──35. Courtyard Colonnade — covered walkway around inner courtyard

EXTERIOR (1 room)
└──36. Ironwood Grove — sacred ironwood trees, Old Gods prayer, children's play
```

### Vertical Organization

```
  [28. Rookery] ←── Tower top (ravens, open sky)
      │
  [31. Battlements / Wall-Walk] ←── Connects towers 29 + 30
      │
  ════╤══════════════════════════════════════════════
  2F  │  24. Bedchamber │ 25. Children │ 26. Guest
      │  27. Servants' Dormitory (attic wing)
  ════╤══════════════════════════════════════════════
  1F  │  19. Solar (window → Great Hall) │ 21. Chapel
      │  20. Gallery (overlooks Great Hall)
      │  22. Maester │ 23. Officers │ 34. Corridor
  ════╤══════════════════════════════════════════════
  GF  │  ┌─5. GREAT HALL──────┐  6. Kitchen  7. Pantry
      │  │ (double height)     │  8. Buttery  9. Bakehouse
      │  └────────────────────┘  10. Servants' Passage
      ├──────────────────────────────────────────────
      │  11. COURTYARD (open-air hub) + 35. Colonnade
      │  12. Gatehouse │ 13. Stables │ 14. Smithy
      │  15. Armory │ 16. Barracks │ 17. Kennels │ 18. Workshop
  ════╤══════════════════════════════════════════════
  B1  │  1. Wine Cellar │ 2. Root Cellar │ 3. Dungeon │ 4. Undercroft
  ════╧══════════════════════════════════════════════
```

### Two-Tier Circulation (Authentic Medieval)
- **Lord's routes**: Great Hall → Solar (private stair) → Bedchamber → Chapel
- **Servant routes**: Hidden passages behind walls, back stairs connecting kitchen to all floors
- **Guard routes**: Barracks → Armory → Gatehouse/Battlements (patrol loop)
- **Crossroads**: Courtyard (everyone passes through) and Great Hall (social center)

### NPC Activity Coverage

Every 24-hour life activity maps to a physical location:

| Activity | Locations | Who |
|----------|-----------|-----|
| Sleep | 16, 24-27 | All NPCs |
| Eat (formal) | 5 (Great Hall, different table positions by rank) | All |
| Eat (informal) | 6, 16 | Cooks, guards |
| Cook / bake | 6, 9 | Kitchen staff |
| Store food | 1, 2, 7, 8 | Servants, cooks |
| Forge / repair | 14, 15, 18 | Smiths, carpenters |
| Patrol | 11, 12, 31, 32-35 | Guards |
| Guard duty | 12, 5 (entrance), 24 (lord's door) | Guards |
| Train / spar | 11 | Guards, soldiers |
| Tend horses | 13 | Grooms |
| Tend dogs | 17 | Kennel master |
| Pray | 21, 36 | Anyone |
| Send ravens | 28 | Maester |
| Heal / study | 22 | Maester |
| Hold court | 5 (dais/throne) | Lord + all |
| Private counsel | 19 | Lord + advisors |
| Clean rooms | All rooms | Servants |
| Light/douse torches | All rooms | Servants (dusk/dawn) |
| Laundry | 11 | Servants |
| Fetch water | 11 (well) | Servants |
| Use privy | Garderobes in 5, 16, 24 | All |
| Socialize | 5, 11, 16, 19, 36 | All |
| Walk between places | 32-35 | All |
| Keep watch | 29, 30, 31 | Guards |

---

## The Four Pillars (Priority Order)

### Pillar 1: Environmental Density (First)
The single biggest difference between our rooms and Octopath. Their rooms are **packed** with detail.

**Great Hall density targets:**
- **Centerpieces**: Massive stone hearth (back wall), ironwood throne on raised dais (north end), long ironwood feasting table (center)
- **Seating**: Benches along table, lord's high seat, lesser chairs
- **Wall detail**: Forrester banners (black + green), mounted weapons, ironwood carvings, sconces, tapestries
- **Floor detail**: Stone flags with rushes/straw, fur rugs near dais, stone cracks
- **Ceiling detail**: Exposed ironwood beams (double-height), hanging iron chandeliers
- **Table detail**: Goblets, plates, candelabras, food platters, scattered bread
- **Foreground**: Column bases and furniture edges providing camera occlusion
- **Environmental storytelling**: Spilled wine, a hound sleeping by the hearth, a discarded cloak

### Pillar 2: Lighting & Atmosphere (Second)
Create cinematic mood through light, shadow, and particles.

**Great Hall lighting:**
- **Great hearth**: Dominant warm light (#FF6B35, intensity 4.5-5.0, flickering)
- **Window slits**: Cool exterior light (#E0EFF5, directional, casting god ray shafts)
- **Wall sconces**: Warm amber fill (#FFCC66, intensity 2.0, pools of light)
- **Chandeliers**: Overhead warm light, multiple point sources
- **Warm/cool contrast**: Hearth-lit center vs cold stone walls
- **Particles**: Hearth smoke rising, dust catching light shafts, ember sparks, floating motes
- **Day/night cycle**: Window light shifts dawn→day→dusk→night, interior torches increase at evening

### Pillar 3: Depth & Parallax (Third)
Create the HD-2D diorama/miniature feel.

**Great Hall depth:**
- **Foreground layer**: Column bases, furniture edges, blurred by tilt-shift
- **Mid-ground**: Gameplay area, sharp focus (table, NPCs, dais)
- **Background**: Far wall with parallax, Wolfswood visible through windows
- **Gallery above**: Visible from below, NPCs can be on the gallery
- **Raised dais**: Physical depth variation in the floor plane
- **In-room parallax**: Banners and tapestries at different scroll rates
- **Tilt-shift tuning**: Emphasize diorama effect for the room's double-height proportions

### Pillar 4: Sprite Art Quality (Fourth)
High-resolution pixel art at 64x96 — near-illustration quality.

**Great Hall sprites:**
- **64x96px resolution**: 4x area of current sprites, room for face features, equipment detail, fur textures
- **Northern/Forrester style**: Dark leather, thick furs, ironwood accessories, greens and blacks
- **NPC types for Great Hall**: Lord, Lady, guards, servants, maester, children
- **Animation states** (vertical slice): idle, walk (enough for simple pathfinding)
- **Future states**: talk, sit, eat, gesture, work, sleep
- **Proper billboard shadows**: Blob shadows that respond to nearest light source

---

## Art Direction

### Color Palettes by Room Temperature

**Cold rooms** (Battlements, Courtyard, Watchtowers):
- Ambient: #667799 → #7799CC, intensity 0.6-0.7
- Stone: #5a5a5a, frost accents #b8c5d6
- Minimal warm light (distant braziers only)
- Post-process: desaturated, slight blue hue shift, low contrast

**Cool rooms** (Corridors, Cellars, Chapel):
- Ambient: #556688, intensity 0.5
- Stone: #4a4540, candle warmth in small pools
- Single warm source (altar candles, corridor torch)

**Warm rooms** (Great Hall, Solar, Bedchamber):
- Ambient: #665544 → #8B7355, intensity 0.5-0.6
- Stone: #4a4540 lit by warm sources
- Dominant hearth (#FF6B35) or fireplace light
- Ironwood furniture catches warm light with sheen
- Furs and fabrics add color (burgundy, gold, deep green)

**Hot rooms** (Kitchen, Smithy, Bakehouse):
- Ambient: #8B4513, intensity 0.5
- Dominant fire (#FF4500 → #FF6B35, intensity 5.0-6.0)
- Heavy bloom (0.8-0.9), smoke particles
- Everything has orange cast

### Material Palette

| Material | Albedo Range | Roughness | Notes |
|----------|-------------|-----------|-------|
| Ironwood | #1f1510 → #2b1810 | 0.3-0.4 | Unusually shiny for wood, fine grain, near-metallic |
| Northern stone | #4a4540 → #5a5a5a | 0.85 | Grey-brown, rough, cold |
| Iron/steel | #2a2a2a → #4a4a4a | 0.4-0.6 | Dark, worn, rust in joints |
| Fur/leather | #8b7355 → #4b2413 | 0.8-0.95 | Tawny to deep brown |
| Fabric (banners) | #1a1a1a (black), #2d5a27 (green) | 0.9+ | House Forrester colors |
| Fabric (trim) | #C9A84C (gold), #8B0000 (burgundy) | 0.9+ | Accent colors |
| Rushes/straw | #8B7355 → #A09060 | 0.95 | Floor covering |

### Day/Night Cycle

Full 24-hour cycle affecting the entire castle:
- **Dawn** (5-7): Warm pink-gold light through east windows, servants light morning fires
- **Day** (7-17): Cool blue-white daylight, brightest period, full activity
- **Dusk** (17-19): Orange sunset through west windows, servants light torches/candles
- **Night** (19-5): Moonlight (cool blue, dim), interior lit only by torches and hearths
- Exterior rooms change dramatically; deep interior rooms (cellars) barely affected
- NPCs on torch-lighting duty create visible change as evening falls

---

## Technical Architecture

### Prop Generation Framework
**Claude Code IS the 3D modeler.** Build a framework where each prop is a TypeScript function that constructs detailed geometry:

```
Claude Code writes prop code → Three.js geometry + CSG + procedural textures
                              → export as GLB during build step
                              → load at runtime via existing AssetManager
```

**Framework components:**
1. **Procedural materials** — Canvas2D + noise functions → PBR texture sets (albedo, normal, roughness, AO) at 512x512
2. **Geometry construction** — ExtrudeGeometry, LatheGeometry, CSG (three-bvh-csg) for complex shapes
3. **Prop templates** — Parameterized functions: `generateTable({ style, wood, seats })`, `generateChair({ type, material })`
4. **GLB export** — Build-time script that runs prop generators and writes .glb files
5. **Texture generators** — Algorithms for wood grain, stone tiles, metal patina, fabric weave

**Quality approach:**
- Props aren't `BoxGeometry + legs` — they're beveled, detailed, properly UV-mapped
- Procedural textures use Perlin/Simplex/Voronoi noise for organic realism
- Normal maps derived from heightmaps via Sobel filter
- The quality ceiling is the sophistication of the code, and code is what Claude excels at

### Enhanced Particle Systems
Expand from 2 to 6-8 particle types:
- **Smoke** — InstancedMesh with noise-driven rise/spread, alpha fade
- **Ground mist** — Screen-space fog pass in post-processing pipeline (height-based density)
- **Light shafts** — God rays through windows (existing three-good-godrays)
- **Falling ash** — Slow downward drift near hearths
- **Dust in light** — Particles that only render in directional light beams
- **Fire core** — Animated shader mesh for hearth/torch flames (beyond just embers)

### Surface Detail System
- **Decals** — THREE.DecalGeometry for moss, cracks, stains, blood on surfaces
- **Texture splatting** — Blend stone + moss + dirt via splat maps in custom shaders
- **Normal map overlays** — Layer fine detail normals on base materials (cracks, wood grain variation)
- **Procedural splat maps** — Generated via Voronoi noise (moss grows in patches)

### Rendering Architecture
**Current (vertical slice):** Single-room loading with fade transitions — proven and performant
**Future (full castle):** Simultaneous multi-room rendering for NPC simulation
- Frustum culling — only render visible rooms
- LOD — distant rooms as simplified geometry
- Instanced rendering — shared prop meshes across rooms
- Occlusion culling — rooms behind walls don't render
- This architectural evolution happens AFTER the visual quality bar is proven

### Performance Budget (Comfortable)
- Current draw calls per room: ~20-30 (well under 500-1000 desktop limit)
- Even with 100 props + 50 NPCs: ~150 draw calls with instancing
- Post-processing pipeline: ~4-6ms (within 16.67ms frame budget)
- Texture memory: KTX2 compression keeps VRAM manageable

### Key Libraries to Add
- `three-bvh-csg` — Fast CSG boolean operations for complex prop geometry
- `simplex-noise` — Procedural texture generation

---

## Quality Progression (5 Phases)

Applied to the Great Hall vertical slice:

| Phase | Focus | Expected Quality |
|-------|-------|-----------------|
| **1. Prop Framework + Textures** | Build generation framework, procedural PBR textures (stone, ironwood, metal, fabric) | 40% → 70% |
| **2. Great Hall Props** | Use framework to populate: throne, table, hearth, benches, sconces, banners, goblets, etc. | 70% → 80% |
| **3. Lighting + Particles** | Multi-source lighting, warm/cool contrast, smoke, dust, god rays, day/night foundation | 80% → 88% |
| **4. Depth + Surface Detail** | Foreground occlusion, in-room parallax, decals (moss, cracks), texture splatting | 88% → 92% |
| **5. Sprites + Polish** | 64x96 sprite generation, enhanced animations, tilt-shift tuning, final color grading | 92% → 95% |

---

## Key Decisions Made

1. **Vertical slice** — Prove AAA quality in the Great Hall first, then replicate
2. **Density first** sequencing → lighting → depth → sprites
3. **Enhance procedural generation** — Claude Code IS the 3D modeler, no external AI APIs
4. **Prop framework first** — Build the generation system before individual props
5. **Ironrath Castle** (House Forrester) — ironwood black + forest green identity
6. **36 rooms at 1:1 scale** — Complete simulation of every NPC life activity
7. **Historical accuracy** — Realistic multi-floor layout with authentic medieval organization
8. **Full vertical integration** — Rooms overlook other rooms (Solar → Great Hall, Gallery)
9. **"Warm despite the cold"** mood — Cold stone outside, warm hearths inside
10. **"Moody but readable"** darkness — All geometry visible, pronounced light pools
11. **64x96px sprites** — High-res pixel art, near-illustration quality
12. **Full day/night cycle** — Affects lighting, sky, NPC schedules, torch-lighting
13. **Simple NPC behavior for now** — Walk + idle, visual quality is the priority
14. **AAA quality first, world renderer later** — Prove the visual bar before multi-room architecture
15. **Great Hall centerpieces** — Massive hearth + ironwood throne on dais + long feasting table

---

## Open Questions (for Planning Phase)

1. **Existing code**: Do we keep the current 10 Red Keep rooms as-is (separate branch/mode) or replace them with Ironrath?
2. **Great Hall dimensions**: Current Throne Room is 30x18x12. Should the Great Hall match, or adjust for Ironrath's more intimate northern aesthetic?
3. **Game clock implementation**: How does the day/night cycle integrate with the ECS? New system? Singleton component?
4. **Camera for double-height rooms**: The Great Hall's double height + gallery above may need camera adjustments for the HD-2D angle
5. **NPC pathfinding foundation**: Even simple walk+idle needs waypoints and obstacle avoidance. Build this during vertical slice or defer?
6. **Sound**: No audio system exists. Add ambient sound in vertical slice or defer?

---

## Next Step

Run `/workflows:plan` to create a detailed implementation plan for the Great Hall vertical slice, covering:
1. Prop generation framework (materials, textures, CSG, export pipeline)
2. Great Hall environmental density (50-100 props)
3. Lighting and atmosphere overhaul (multi-source, day/night, particles)
4. Depth and parallax system (foreground occlusion, in-room parallax)
5. 64x96 sprite art generation
6. Setting transition from Red Keep → Ironrath

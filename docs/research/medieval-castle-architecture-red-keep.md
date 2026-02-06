# Medieval Castle Architecture & Red Keep Reference for Game Level Design

**Date:** 2026-02-05
**Purpose:** Architectural reference for the HD-2D Red Keep MVP room design. All dimensions, materials, furniture, and lighting details sourced from historical records, ASOIAF books, and the HBO production.

---

## 1. Red Keep Layout (Books + Show)

### Construction & Materials

The Red Keep sits atop Aegon's High Hill in King's Landing. It was begun by Aegon the Conqueror (who tore down the original wooden Aegonfort) and completed by his son Maegor the Cruel, who added the inner fortification (Maegor's Holdfast) and a network of secret passages, false walls, and trapdoors throughout the castle and the tunnels beneath the hill. After construction, Maegor executed every stonemason, woodworker, and builder who had labored on it to keep the secrets buried.

The castle is built from **pale red stone** (hence the name). Its exterior features:
- **Seven massive drum-towers** crowned with iron ramparts
- A powerfully built **barbican** in front of a cobbled square
- **Immense curtain walls** with iron-crowned battlements
- Vaulted ceilings throughout the halls
- Covered bridges connecting structures
- Barracks, granaries, and storerooms

### Major Structures & Rooms

**The Great Hall (Throne Room)**
- The second-largest hall in Westeros (only Harrenhal's Hall of a Hundred Hearths is larger)
- Can feast a thousand people
- Oriented north to south
- High, narrow windows on the eastern and western walls
- Great oak-and-bronze doors at one end
- The Iron Throne on a raised iron dais at the opposite end
- A long carpet runs the full length from doors to throne
- Cavernous interior with vaulted ceiling

**Maegor's Holdfast**
- A massive square fortress *within* the Red Keep (a castle-within-a-castle)
- Walls are **12 feet (3.7m) thick**
- Surrounded by a **dry moat lined with iron spikes**
- Accessed by a drawbridge
- Contains the royal apartments:
  - King's bedchamber with canopied bed and twin hearths
  - Queen's Ballroom (seats ~100)
  - Royal nursery
  - Other private chambers
- The Queen's Ballroom has beaten silver mirrors behind wall sconces (doubling the torchlight), richly carved wood-paneled walls, a gallery above the main floor, and high arched windows along the south wall

**Tower of the Hand**
- Contains the Hand of the King's personal chambers
- Features: a solar (study/office), a garderobe, tall windows, a bedchamber with canopied bed, wall sconces, and rushes on the floor
- Also contains the **Small Hall** (a long room with high vaulted ceiling, bench space for 200)
- A hearth with a small door opening onto a secret passageway (230 rungs down to the chamber of the dragon mosaic)

**Small Council Chamber**
- Contains a long table at which the king sits at the head
- Richly furnished with Myrish carpet, a carved screen from the Summer Isles
- Tapestries from Lys, Norvos, and Qohor on the walls
- The chamber door is flanked by two Valyrian sphinxes

**White Sword Tower (Kingsguard)**
- A slender four-story structure built into an angle of the castle wall overlooking Blackwater Bay
- Winding interior steps
- **First floor:** The Round Room -- a circular white room with whitewashed stone walls, white wool hangings, a white shield and two crossed longswords over the hearth. Contains a large weirwood table carved in the shape of a shield, supported by three white stallion legs. Three knights sit on each side.
- **Undercroft:** Arms and armor storage
- **Second and third floors:** Small, sparse sleeping cells for the six brothers

**The Godswood**
- An acre of elm, alder, and black cottonwood trees overlooking the Blackwater Rush
- Heart tree is a great oak overgrown with smokeberry vines (not a weirwood)

**Dungeons (Four Levels)**
- **First level (Traitor's Walk):** Cells in a squat half-round tower; upper floor holds comfortable cells for highborn prisoners who might be ransomed
- **Second level:** Smaller cells
- **Third level (Black Cells):** Tiny cells with solid wooden doors so no light enters
- **Fourth level:** Used for torture; described as unsafe to traverse with light because "there are things one would not wish to see"

**Other Notable Locations**
- Serpentine steps (the main stairway connecting upper and lower areas)
- The royal sept
- The Maidenvault
- Lower bailey and inner bailey
- A small sunken courtyard
- Pig yard, small kitchen
- River walk
- Multiple covered bridges

### Connectivity for Game Design

The book descriptions establish this spatial logic:

**Below the Serpentine Steps:** Maegor's Holdfast, Small Council chambers, Tower of the Hand, lower bailey, black cells, small sunken courtyard.

**Above the Serpentine Steps:** Great Hall / Throne Room, godswood, river walk, small kitchen, pig yard, royal sept, Maidenvault.

---

## 2. The Iron Throne Room -- Detailed Description

### Book Description (George R.R. Martin's Vision)

**Scale:** Martin has compared the throne room to **St. Peter's Basilica in the Vatican** in scale. St. Peter's interior is approximately 187m (614ft) long and 46m (150ft) wide at its widest, with a ceiling height of 46m (150ft). While the Red Keep's Great Hall is not literally that size, this comparison establishes that Martin envisions a *cathedral-scale* space -- far larger than any real medieval hall.

**Layout:**
- Oriented north-south
- Great oak-and-bronze double doors at one end
- The Iron Throne at the opposite end, on a raised iron dais
- A long carpet runs the full length between them
- High, narrow windows pierce the eastern and western walls
- The space is described as "cavernous"

**The Iron Throne (Book Version):**
- Towers over **40 feet (12m)** in height
- Made from approximately **a thousand swords** taken from Aegon the Conqueror's fallen enemies
- Hammered together by blacksmiths, not sculptors -- it is **asymmetrical, sprawling, and twisted**
- A massive tangle of jagged and twisted blades welded into a vague throne shape
- Has steep, uneven steps leading up to the seat
- The chair is cold, hard, and full of jagged edges (it is said to have cut many kings)
- From the top, the seated king dominates the entire hall, looking down on everyone

**Key Visual Impression:** The book throne is monstrous and inhuman -- a brutal sculpture of melted, bent, and broken swords rising 4 stories high. It is meant to be uncomfortable and dangerous, a symbol of conquest, not governance.

### HBO Show Representation

The show version is dramatically scaled down for practical filming:
- **Show Iron Throne dimensions:** approximately 7'2" (2.18m) tall, 5'5" (1.65m) wide, 5'11" (1.80m) deep
- Much more symmetrical and structured than the book version
- The throne room set was built at the **Paint Hall studios in Belfast** (originally part of the Harland and Wolff shipyard, now the largest film studio in Europe)
- The show throne room appears roughly 30-40m long and 15-20m wide based on production shots
- Features tall pointed windows, stone columns, and a long approach to the throne

**House of the Dragon** adjusted the Iron Throne to be closer to Martin's vision -- significantly larger with more swords cascading outward.

### Making It Feel "Life-Size" in a Game

For the HD-2D MVP, the challenge is communicating *scale* in a top-down 3/4 perspective:

**Architectural Scale Cues:**
- Use **two rows of massive columns** along the hall's length -- these give the player reference points for the room's size as they walk past them
- Make the hall at least **5-6 screen widths long** so the player must walk a meaningful distance from door to throne
- Place the Iron Throne on a visibly **elevated dais** at the far end
- Use **repeating floor tile patterns** to emphasize the distance

**Lighting Scale Cues:**
- Light shafts from the high, narrow windows should be visibly **angled** (suggesting great height)
- Multiple torches along the columns, each casting its own pool of light, emphasize the room's length
- The throne itself should have its own dramatic lighting (a shaft of light from above, or backlit glow)

**Suggested Game Dimensions (World Units):**
- Width: 40 units (~40m game-scale for grandeur)
- Depth: 60 units (~60m game-scale)
- Ceiling height: implied through tall walls and window placement (since top-down, this is communicated via shadow length and wall texture height)

---

## 3. Medieval Castle Room Proportions -- Realistic Dimensions

### Great Hall / Throne Room

**Historical Range:**
| Castle | Length | Width | Height | Ratio (L:W) |
|---|---|---|---|---|
| Westminster Hall | 73.2m (240ft) | 20.7m (68ft) | 28m (92ft) | 3.5:1 |
| Winchester Castle | 33.8m (111ft) | 16.8m (55ft) | ~15m est. | 2:1 |
| Durham Castle | 30m (100ft) | 14m (46ft) | 14m (46ft) | 2.1:1 |
| Nevern Castle | 22.2m (73ft) | 6.2m (20ft) | ~8m est. | 3.6:1 |
| Yeavering (Anglo-Saxon) | 37m (120ft) | ~12m est. | -- | ~3:1 |

**Design Rule:** A great hall is rectangular, between **1.5x and 3.5x as long as it is wide**, and the **ceiling height equals or exceeds the width**.

**For the Game (Throne Room):**
- Recommended: 20-25m wide x 50-60m long (ratio ~2.5:1)
- Ceiling implied at 20-25m+ (communicated through tall walls and window placement)
- This produces a space that feels cathedral-like when traversed at character walking speed

### Small Council Chamber

**Historical Basis:** Private meeting rooms (often a solar or withdrawing room repurposed) were typically:
- **6m x 6m (20ft x 20ft)** to **10m x 10m (33ft x 33ft)**
- Ceiling height: 3-5m (10-16ft)
- Could seat 8-15 people around a table

**ASOIAF Description:** The Small Council chamber is richly furnished with carpet, tapestries, and a long table. It is clearly an intimate space, not a grand one.

**For the Game:**
- Recommended: 10-12m x 10-12m (roughly square)
- Lower ceiling feel (communicated through wall proportions and warm, close lighting)
- Dominated by the central table

### Solar / Study

**Historical Basis:** The solar was the lord's private room, typically:
- **5m x 5m (16ft x 16ft)** to **8m x 8m (26ft x 26ft)**
- Often on an upper floor of a tower (thus sometimes slightly circular or with curved walls)
- Ceiling height: 3-4m (10-13ft)
- Featured large windows to maximize sunlight (hence the name "solar")
- Always had a fireplace

**ASOIAF (Hand's Solar):** Described as having a desk, tall windows, a hearth, and rushes on the floor. It is in the Tower of the Hand, suggesting a tower room.

**For the Game:**
- Recommended: 8-10m x 8-10m
- Possibly with one curved wall (tower room feel)
- Window on one wall providing the primary light source

### Gallery / Corridor

**Historical Basis:** Long galleries became common in later medieval and Tudor periods:
- **3-5m (10-16ft) wide** x **20-40m+ (65-130ft+) long**
- Ceiling height: 4-6m (13-20ft)
- Usually lined with windows on one side and a wall (with tapestries/portraits) on the other
- Sometimes an arcade of arched openings rather than a solid wall

**For the Game (Grand Gallery):**
- Recommended: 6-8m wide x 35-40m long
- Arched windows along one or both sides
- Columns or pilasters creating a rhythm along the length
- Tapestries between windows

### Guard Post / Barracks

**Historical Basis:** Guard rooms were typically:
- **4m x 4m (13ft x 13ft)** to **8m x 6m (26ft x 20ft)** for a gatehouse guard room
- Often within tower rooms or gatehouse chambers
- Ceiling height: 2.5-3.5m (8-11ft) -- utilitarian, not grand
- Barracks in the bailey could be longer but were simple rectangular buildings

**For the Game:**
- Recommended: 10-12m x 8-10m (slightly larger than historical for gameplay)
- Low, functional ceiling feel
- Stone walls with no decoration

### Ballroom

**Historical Basis:** Dedicated ballrooms were not common in early medieval castles (the great hall served this purpose). In later periods:
- **12m x 12m (40ft x 40ft)** to **20m x 15m (65ft x 50ft)**
- Ceiling height: 5-7m (16-23ft) with potential minstrel gallery
- Polished or tiled floors

**ASOIAF (Queen's Ballroom):** Seats 100, has carved wood-paneled walls, silver mirrors behind sconces, a gallery above the main floor, and high arched windows on the south wall. Described as "much smaller" than the Great Hall.

**For the Game:**
- Recommended: 18-20m x 18-20m (roughly square)
- Raised musician's gallery along one wall (elevated platform/balcony)
- High arched windows on one wall

### Stairwell

**Historical Basis:** Spiral (newel) staircases in towers:
- Diameter: as narrow as **0.7m (2.3ft)** to about **3m (10ft)** for grander stairs
- Typical castle stairwell: **1.5-2.5m (5-8ft) diameter**
- Built into thick walls or corner towers
- Steps are wedge-shaped (pie-slice), wider at the outer wall
- Central newel post (column) around which stairs wind
- Direction: typically clockwise ascending (though this varies; the "defensive advantage" theory is debated)

**For the Game:**
- Recommended: 5-6m x 5-6m room footprint (the stairwell itself is ~2-3m diameter within)
- Show the curved wall, narrow arrow-slit windows at intervals
- In top-down HD-2D, render as a circular/spiral floor pattern with curved walls

### Battlements / Wall Walk

**Historical Basis:**
- **Wall thickness (walkway width):** 2.5-6m (8-20ft), typical ~3m (10ft)
- **Wall height:** 9-12m (30-40ft) typical, up to 13.4m (44ft) at Framlingham, up to 24m (80ft) at Krak des Chevaliers
- **Merlon height:** ~1.5-2m (5-6.5ft) -- tall enough to shield a standing man
- **Crenel (gap) width:** 0.9-1.5m (3-5ft)
- **Crenel comprises approximately 1/3 the width of each merlon**
- **Wall walk is the passageway behind the battlements** -- sometimes roofed (hoarding), usually open

**For the Game:**
- Recommended: 6-8m wide x 25-30m long walkway
- Crenellated parapet wall on the outer edge
- Inner wall or railing on the castle side
- Open to the sky (parallax background layers for the city/bay view)

---

## 4. Furniture and Props Per Room Type

### Iron Throne Room / Great Hall

**Signature Items (instantly communicate "throne room"):**
- The Iron Throne itself on a raised dais with steps
- Long carpet/runner from doors to throne
- Two rows of stone columns lining the approach

**Supporting Props:**
- Heavy oak-and-bronze double doors
- Iron torch sconces on columns and walls (every 3-4m)
- Banners/heraldic standards hanging from columns or walls (Baratheon stag, Lannister lion)
- Stained-glass or tall narrow windows (colored light)
- Optional: petitioner's railing, gallery above

**Floor:** Polished stone tiles or flagstones
**Walls:** Pale red stone, largely unadorned (the room's grandeur comes from scale, not decoration)

### Antechamber / Waiting Hall

**Signature Items:**
- Heavy doors (reinforcing that the Throne Room is behind them)
- Kingsguard guards flanking the doors

**Supporting Props:**
- Stone or wooden benches along the walls (for waiting petitioners)
- Armor stands / decorative suits of armor
- Banners or shields on walls
- A few torch sconces
- Possibly a small table for a guard captain

**Floor:** Rough stone flagstones
**Walls:** Stone with occasional tapestry

### Small Council Chamber

**Signature Items:**
- Long rectangular table (center of room) with high-backed chairs
- Map/document spread on the table
- Candelabras on the table (multiple)

**Supporting Props:**
- Myrish carpet on the floor
- Carved screen (decorative room divider)
- Tapestries on walls (from exotic locations -- rich, colorful)
- Wine pitcher and goblets on a sideboard
- Two Valyrian sphinx statues flanking the door
- Bookshelves or scroll racks
- A hearth/fireplace

**Floor:** Dark wood or stone covered with a large carpet
**Walls:** Stone with rich tapestries, possibly some plaster/paint

### Solar / Study (Hand's Solar)

**Signature Items:**
- Large wooden desk with scrolls, books, inkwell, quill
- A prominent hearth/fireplace with fire burning

**Supporting Props:**
- Bookshelf against one wall (leather-bound volumes, scroll cases)
- High-backed chair at the desk
- A smaller chair or two for visitors
- Rushes on the floor (or a rug over wooden planks)
- One or more tall windows (arched)
- A personal chest or trunk
- Wall-mounted candle sconces
- Wine or ale flagon on the desk
- A map pinned to the wall

**Floor:** Wooden planks with a rug
**Walls:** Stone with some wood paneling, possibly plastered

### Grand Gallery / Corridor

**Signature Items:**
- Rows of arched windows along the length
- Stone columns or pilasters creating a rhythmic arcade

**Supporting Props:**
- Tapestries depicting historical/conquest scenes between windows
- Occasional stone or wooden benches beneath windows
- Iron torch sconces between windows/on columns
- Suits of armor at intervals (decorative)
- Potted plants or small decorative elements on windowsills
- Possibly shields or weapons mounted on walls

**Floor:** Polished stone
**Walls:** Stone with tapestries; window-side wall is mostly glass/openings

### Guard Post / Barracks

**Signature Items:**
- Weapon racks (swords, spears, shields displayed/stored)
- A brazier or fire pit (the only heat/light source)

**Supporting Props:**
- Armor stands (some with armor, some empty)
- Simple wooden bunks or straw pallets along walls
- Wooden chests (personal storage for each guard)
- A rough wooden table with benches (for eating/dice games)
- Water barrel
- Straw scattered on the floor
- A notice board or duty roster pinned to the wall
- Cloaks hanging on pegs
- A whetstone and oiling kit

**Floor:** Bare stone with scattered straw
**Walls:** Bare stone, unfinished -- no decoration

### Queen's Ballroom

**Signature Items:**
- A raised musician's gallery (elevated platform/balcony along one wall)
- Beaten silver mirrors behind wall sconces (light-doubling effect)
- Richly carved wood-paneled walls

**Supporting Props:**
- Ornate iron or silver chandeliers suspended from ceiling
- High arched windows along one wall
- Polished stone floor (possibly with decorative inlay)
- Gilded fixtures (door handles, sconce mounts)
- Fabric drapes around windows
- Small tables and chairs along the walls (pushed aside for dancing)
- A sideboard with goblets and wine
- Flower arrangements (for events)

**Floor:** Polished stone (potentially reflecting light)
**Walls:** Carved wood paneling over stone

### Tower Stairwell

**Signature Items:**
- Curved stone walls (the defining visual)
- Narrow arrow-slit windows at intervals (providing thin beams of light)

**Supporting Props:**
- Iron torch brackets (one every ~180 degrees of the spiral)
- Worn stone steps (showing foot traffic over centuries)
- Possibly a rope or iron chain along the wall as a handhold
- A small niche or alcove for a guard

**Floor:** Worn stone steps
**Walls:** Curved stone (tighter radius than a normal room wall)

### Battlements / Wall Walk

**Signature Items:**
- Crenellated parapet (merlons and crenels -- the instantly recognizable "castle wall" profile)
- Open sky above

**Supporting Props:**
- Stone machicolations or murder holes (overhanging defensive positions)
- A guard brazier for night watch
- A rack of spare spears or arrows
- A signal horn or bell
- Banner/standard on a pole
- Wooden hoarding sections (defensive overhangs)
- A lookout telescope (anachronistic but communicates purpose)

**Floor:** Stone walkway
**Walls:** Crenellated parapet on outer edge, castle wall on inner edge with occasional doorway

---

## 5. Lighting in Medieval Castles

### Light Source Types (Historical Accuracy)

**Natural Light (Primary Source):**
- Windows were the most important light source in any medieval castle
- Glass was expensive; many windows used oiled cloth, thin horn sheets, or were simply open (with wooden shutters)
- Stained glass in wealthy/royal castles (like the Red Keep) was a display of enormous wealth
- Window placement was strategic -- higher windows let in more light and were more defensible
- Arrow-slit windows provided minimal but atmospheric light shafts

**Candles (Most Common Artificial Light):**
- **Tallow candles:** Made from animal fat. Smoky, smelly, dim yellowish light. Used by servants and in utilitarian spaces.
- **Beeswax candles:** Far more expensive. Burned cleaner, brighter, and with less odor. Used in grand rooms, chapels, and private chambers of nobility.
- Carried in holders (candlesticks) or mounted in wall sconces
- A single candle produces approximately 12 lumens -- a room would need many candles to be well-lit

**Chandeliers and Candelabras:**
- **Chandeliers:** Wrought iron rings or frames suspended from the ceiling on chains, holding multiple candles. Common in great halls and ballrooms.
- **Candelabras:** Branching floor-standing or table-standing holders. Used in council chambers, private rooms.
- A large iron chandelier might hold 20-50 candles

**Rushlights:**
- Peeled rushes dipped in animal fat
- Very cheap, dim, short-lived (~20-30 minutes)
- Used in servants' quarters and storage areas

**Oil Lamps:**
- Vessels filled with vegetable or animal oil with a wick
- Slightly more reliable than candles in drafty areas
- Used in enclosed spaces (cells, passages)

**Torches:**
- Bundles of cloth or tow on wooden sticks soaked in pitch or resin
- **Important historical note:** Torches were largely impractical indoors. They produce heavy, noxious smoke that is dangerous in poorly ventilated spaces. Games and films dramatically over-use torches.
- Actual indoor use: primarily by guards moving through corridors, placed temporarily in wall brackets. Removed or replaced frequently.
- More appropriate for: outdoor courtyards, wall walks, gate passages (well-ventilated areas)

**Hearths and Fireplaces:**
- The single most important combined heat/light source in any room
- A large hearth in a great hall could be big enough to stand inside
- Fireplaces provided a warm, flickering orange glow
- Placed on exterior walls (for chimney/flue) or as central fire pits in earlier halls

**Cresset Lamps:**
- Stone or iron cups mounted on walls, filled with oil and fitted with a wick
- Used in corridors, stairwells, and passages
- More permanent than torches, less smoky

### Light Placement by Room Type

**Throne Room / Great Hall:**
- PRIMARY: Tall narrow windows (east and west walls) providing natural daylight -- this was the main light source during the day
- SECONDARY: Large wrought iron chandeliers suspended from the ceiling (beeswax candles)
- ACCENT: Wall-mounted torch sconces on columns and walls (in games, these can be torches for visual drama even if historically they would have been candle sconces)
- WARMTH: One or two massive hearths (typically at the dais end or side walls)
- Overall: a mix of cool daylight from windows and warm firelight from below

**Small Council Chamber:**
- PRIMARY: Candelabras on the table (clusters of beeswax candles creating pools of warm light)
- SECONDARY: Wall sconces with candles
- ACCENT: Hearth/fireplace
- No windows (or small ones) -- this is an interior, private room
- Overall: intimate, warm, focused on the table

**Solar / Study:**
- PRIMARY: Large window(s) -- the room is literally named for sunlight
- SECONDARY: Hearth fire (always burning for warmth)
- ACCENT: Desk candles (for reading/writing after dark)
- Overall: bright during the day (warmest, most naturally lit room), cozy firelit at night

**Gallery / Corridor:**
- PRIMARY: Arched windows along one or both walls
- SECONDARY: Wall-mounted sconces between windows (candle or cresset)
- Overall: bright and airy during the day, dramatically shadowed at night

**Guard Post / Barracks:**
- PRIMARY: A central brazier (provides both light and heat)
- SECONDARY: One or two wall-mounted cressets or candles
- Minimal natural light (small windows or none)
- Overall: dim, warm-centered glow from the brazier with dark edges

**Ballroom:**
- PRIMARY: Chandeliers (the defining light source for a grand event)
- SECONDARY: Wall sconces with beaten silver mirrors behind them (the Queen's Ballroom specifically uses this to double the light)
- ACCENT: High arched windows (natural light during daytime events)
- Overall: brilliantly lit by medieval standards -- the mirrors are a luxury feature

**Tower Stairwell:**
- PRIMARY: Arrow-slit windows (thin shafts of natural light cutting through darkness)
- SECONDARY: A single torch or cresset every half-turn of the spiral (~4-5m vertical interval)
- Overall: mostly dark with dramatic slashes of light

**Battlements / Wall Walk:**
- PRIMARY: Open sky (full natural light)
- SECONDARY: Guard braziers at watch posts (night time)
- ACCENT: Torches in brackets near doors/stairs (this is where torches are historically appropriate -- outdoor, well-ventilated)
- Overall: bright and exposed during the day, dramatic fire-points at night

### Design Note for HD-2D

The reflective surfaces mentioned in historical accounts (polished wood, pale plaster, silver mirrors, bright tapestries) all served to amplify and diffuse scarce candlelight. In game, this can be represented through:
- Higher ambient light values near reflective surfaces
- Bloom effects on sconces that have mirrors behind them
- Lighter wall material colors in grand rooms vs. dark stone in utilitarian rooms

---

## 6. Materials and Textures

### Stone Types

**Pale Red Stone (Red Keep Specific):**
- The Red Keep's defining material -- a pale red/rose-colored stone
- Real-world equivalent: red sandstone (like Agra Fort or Heidelberg Castle)
- Texture: slightly warm-toned, with visible grain and subtle color variation
- Tooling marks may be visible on interior surfaces

**Limestone (Common Castle Stone):**
- Cream to pale grey
- Softer, easier to carve -- used for decorative elements, window surrounds, column capitals
- Weathers to a rough, pitted surface over time

**Granite (Foundations and Fortifications):**
- Grey, dark grey, sometimes with pink/white flecks
- Very hard, rough surface
- Used for foundations, dungeon walls, and heavily fortified areas
- Communicates strength and permanence

**Sandstone (General Construction):**
- Range from pale yellow to deep red-brown
- Visible layered grain
- Common for walls, floors, and general construction

### Stone Usage by Room Type

| Room Type | Stone Treatment | Visual Character |
|---|---|---|
| Throne Room | Finely dressed pale red stone, possibly plastered and painted in places | Grand, smooth, warm-toned |
| Antechamber | Same stone but less finished | Slightly rougher, transitional |
| Council Chamber | Plastered walls with tapestry covering | Refined, warm |
| Solar | Plastered or wood-paneled over stone | Domestic, comfortable |
| Gallery | Finely dressed stone with carved details | Elegant, rhythmic |
| Guard Post | Rough-cut stone, unfinished | Raw, utilitarian, cold |
| Maegor's Entry | Massive dressed stone blocks (12ft thick walls) | Oppressive, monumental |
| Ballroom | Finely dressed stone, carved wood paneling | Ornate, polished |
| Stairwell | Worn, slightly irregular stone | Ancient, heavily used |
| Battlements | Weathered, rough exterior stone | Exposed, martial |

### Wood Types and Uses

**Oak:**
- The primary structural and furniture wood
- Used for: doors (the great oak-and-bronze doors of the throne room), roof beams (hammerbeam roofs), trestle tables, high-backed chairs, chests, floor planks
- Texture: heavy grain, dark to medium brown
- Often oiled or waxed in grand rooms, left raw in utilitarian spaces

**Weirwood (ASOIAF Specific):**
- The Kingsguard table in the White Sword Tower is carved from weirwood
- Pale white wood with a bone-like quality
- Used sparingly as a luxury/symbolic material

**Pine/Softwood:**
- Cheaper, used for scaffolding, barracks furniture, simple floors
- Lighter color, visible knots
- Often covered with rushes in lower-status rooms

### Iron and Metal

**Wrought Iron:**
- Used for: chandeliers, sconces, torch brackets, door hinges, portcullis, gate bars, window grilles, armor, weapons
- Texture: dark grey to black, slightly rough, with visible hammer marks in hand-forged pieces
- Sometimes rust-spotted or patinated
- The Iron Throne is melted/forged iron (the swords fused by dragonfire)

**Bronze:**
- Used for: door fittings (the oak-and-bronze doors), decorative fixtures, candlesticks, bells
- Texture: warm golden-brown, sometimes with green patina (verdigris)

**Steel:**
- Weapons and armor
- Brighter, more polished than iron

**Gold/Gilt:**
- Used for: crown moldings, picture frames, chandelier details in the most grand rooms
- Thin gold leaf over wood or base metal
- Present in the Queen's Ballroom, possibly the Throne Room

### Fabric and Textiles

**Tapestries:**
- **Grand rooms:** Elaborate woven scenes (Targaryen conquest, hunting scenes, heraldic designs). Colors: rich reds, golds, blues, greens. Materials: wool warp with silk or metallic thread highlights.
- **Council chamber:** Exotic tapestries from Lys, Norvos, and Qohor (in ASOIAF)
- **Utilitarian rooms:** None
- **Purpose:** Decoration, insulation (blocking drafts), and amplifying candlelight through their lighter-colored sections

**Banners and Standards:**
- Heavy fabric (wool or silk) with heraldic devices
- Hung from poles, draped from ceiling beams, or mounted on walls
- In the Throne Room: Baratheon crowned stag (gold on black) and Lannister lion (gold on crimson)

**Carpet and Rugs:**
- **Myrish carpet** (ASOIAF luxury item) in the Small Council chamber
- Rugs in the solar and private chambers (wool or imported)
- The long runner carpet in the Throne Room (red or dark)
- Floor rushes (dried grass/herbs) in less formal rooms -- scattered loose, replaced regularly

**Bed Hangings and Drapes:**
- Heavy curtains around four-poster beds (warmth and privacy)
- Window drapes in grand rooms
- Silk and velvet in royal chambers, wool in lesser rooms

### Glass

- **Stained glass:** In the Throne Room's tall narrow windows -- colored panels depicting religious or heraldic scenes. Casts colored light shafts.
- **Clear glass:** Expensive but available for nobility. Small panes set in lead cames (diamond or rectangular patterns). Slightly imperfect, with bubbles and waviness.
- **No glass:** Many windows in practical areas used wooden shutters, oiled linen, or thin horn sheets.

### Floor Materials by Room

| Room | Floor Material | Details |
|---|---|---|
| Throne Room | Polished stone tiles | Large flagstones, possibly with a pattern. Long carpet runner down center. |
| Antechamber | Rough stone flagstones | Simpler, functional |
| Council Chamber | Stone covered with carpet | Myrish carpet covers most of the floor |
| Solar | Wooden planks with rug | Oak boards, partially covered with a woven rug |
| Gallery | Polished stone | Clean, reflective surface |
| Guard Post | Bare stone with straw | Functional, dirty |
| Maegor's Entry | Rough stone with iron grate | Drainage, fortified passage |
| Ballroom | Polished stone (possibly marble) | Smooth for dancing, reflects chandelier light |
| Stairwell | Worn stone steps | Centuries of foot traffic visible in the wear |
| Battlements | Stone walkway | Weathered, exposed to elements |

---

## Summary: Quick Reference for Room Data Files

| Room | Dimensions (m) | Game Units (approx) | Ceiling Feel | Primary Light | Key Mood |
|---|---|---|---|---|---|
| 1. Throne Room | 25w x 55d | 40w x 60d | Cathedral-high | Windows + chandeliers | Grand, imposing |
| 2. Antechamber | 15w x 12d | 20w x 15d | Moderate | Torches/sconces | Formal, tense |
| 3. Small Council | 10w x 10d | 12w x 12d | Low-moderate | Candelabras + hearth | Intimate, warm |
| 4. Hand's Solar | 8w x 8d | 10w x 10d | Moderate (tower) | Window + hearth | Studious, cozy |
| 5. Grand Gallery | 6w x 35d | 8w x 40d | Moderate-high | Arched windows | Airy, majestic |
| 6. Guard Post | 10w x 8d | 12w x 10d | Low | Brazier | Stark, cold |
| 7. Maegor's Entry | 6w x 16d | 8w x 20d | Low, oppressive | Sparse torches | Foreboding |
| 8. Queen's Ballroom | 16w x 16d | 20w x 20d | High | Chandeliers + mirrors | Elegant, golden |
| 9. Stairwell | 5w x 5d | 6w x 6d | Tight/vertical | Arrow slits + 1 torch | Claustrophobic |
| 10. Battlements | 6w x 25d | 30w x 8d | Open sky | Sunlight | Dramatic, exposed |

---

## Sources

### ASOIAF / Red Keep
- [Red Keep - A Wiki of Ice and Fire](https://awoiaf.westeros.org/index.php/Red_Keep)
- [Great Hall (Red Keep) - A Wiki of Ice and Fire](https://awoiaf.westeros.org/index.php/Great_Hall_(Red_Keep))
- [Maegor's Holdfast - A Wiki of Ice and Fire](https://awoiaf.westeros.org/index.php/Maegor%27s_Holdfast)
- [Tower of the Hand - A Wiki of Ice and Fire](https://awoiaf.westeros.org/index.php/Tower_of_the_Hand)
- [White Sword Tower - A Wiki of Ice and Fire](https://awoiaf.westeros.org/index.php/White_Sword_Tower)
- [Godswood of the Red Keep - A Wiki of Ice and Fire](https://awoiaf.westeros.org/index.php/Godswood_of_the_Red_Keep)
- [Iron Throne - A Wiki of Ice and Fire](https://awoiaf.westeros.org/index.php/Iron_Throne)
- [The Real Iron Throne - George R.R. Martin's Not a Blog](https://georgerrmartin.com/notablog/2013/07/08/the-real-iron-throne/)
- [Iron Throne Dimensions - Dimensions.com](https://www.dimensions.com/element/game-of-thrones-iron-throne)
- [Red Keep (Game of Thrones Wiki)](https://gameofthrones.fandom.com/wiki/Red_Keep)
- [Throne Room (Game of Thrones Wiki)](https://gameofthrones.fandom.com/wiki/Throne_room)
- [Iron Throne (Game of Thrones Wiki)](https://gameofthrones.fandom.com/wiki/Iron_Throne)
- [Paint Hall Studios (Game of Thrones Wiki)](https://gameofthrones.fandom.com/wiki/Paint_Hall)

### Medieval Castle Architecture
- [Westminster Hall - Wikipedia](https://en.wikipedia.org/wiki/Westminster_Hall)
- [Great Hall - Wikipedia](https://en.wikipedia.org/wiki/Great_hall)
- [Great Hall - World History Encyclopedia](https://www.worldhistory.org/Great_Hall/)
- [Solar (room) - Wikipedia](https://en.wikipedia.org/wiki/Solar_(room))
- [Battlement - Wikipedia](https://en.wikipedia.org/wiki/Battlement)
- [Castle Curtain Walls - Medieval Chronicles](https://www.medievalchronicles.com/medieval-castles/medieval-castle-parts/medieval-castle-walls/)
- [Medieval Castle Walls - Revisiting History](https://www.revisitinghistory.com/medieval/castle-walls/)
- [Castles of England/Domestic Area Design - Wikibooks](https://en.wikibooks.org/wiki/Castles_of_England/Domestic_Area_Design)
- [Castle Life: Rooms in a Medieval Castle](https://www.castlesandmanorhouses.com/life_01_rooms.htm)
- [Rooms in a Medieval Castle - Historic European Castles](https://historiceuropeancastles.com/rooms-in-a-medieval-castle/)
- [Medieval Castle Layout - Historic European Castles](https://historiceuropeancastles.com/medieval-castle-layout/)
- [Spiral Stairs - Newcastle Castle](https://www.newcastlecastle.co.uk/castle-blog/spiral-stairs)

### Lighting
- [Horrible History: Lighting the Way](https://www.tastesofhistory.co.uk/post/horrible-history-lighting-the-way)
- [Light in the Middle Ages - Battle Merchant](https://www.battlemerchant.com/en/blog/light-in-the-middle-ages-lighting-in-historical-camps-from-lanterns-and-torches-to-candlesticks)
- [History of Lighting Through the Ages](https://www.bespokelights.co.uk/lighting-through-the-ages-i37)
- [Sconce (light fixture) - Wikipedia](https://en.wikipedia.org/wiki/Sconce_(light_fixture))

### Materials and Furniture
- [Guide to Medieval Castles: Culture, Design, Materials](https://letsbuildacastle.ca/guide-to-medieval-castles)
- [What Materials Were Used To Build Medieval Castles - Medieval Chronicles](https://www.medievalchronicles.com/medieval-castles/medieval-q-a/what-materials-were-used-to-build-medieval-castles/)
- [Medieval Castle Furniture - Ancient Fortresses](http://www.ancientfortresses.org/medieval-castle-furniture.htm)
- [Anatomy of a Castle: Furniture](https://aprilmunday.wordpress.com/2018/11/11/anatomy-of-a-castle-furniture/)
- [Castle Interior Design - Modenese Furniture](https://www.modenesefurniture.com/blog/a-comprehensive-guide-to-castle-interior)

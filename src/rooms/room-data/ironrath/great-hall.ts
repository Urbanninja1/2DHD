import { RoomId } from '../../../ecs/components/singletons.js';
import type { RoomData } from '../types.js';

/** Shorthand for Ironrath prop model path */
const P = (name: string) => `assets/models/props/ironrath/${name}.glb`;

/**
 * Ironrath Castle — Great Hall (House Forrester)
 *
 * Dense medieval great hall: ~120+ prop instances across structural,
 * furniture, lighting, decorative, roof, and surface-detail categories.
 * All props Blender-generated with PBR baked textures.
 * 11 lights (10 point + 1 shadow directional). 4 particle emitter groups.
 */
const greatHall: RoomData = {
  id: RoomId.IronrathGreatHall,
  name: 'Ironrath Great Hall',
  dimensions: { width: 24, depth: 14, height: 10 },
  mood: 'grand',

  // Northern stone — brightened base colors for denser scene
  floorColor: 0x5A5550,
  wallColor: 0x6A6560,
  ceilingColor: 0x3a2a1a, // ironwood ceiling

  // PBR textures — Blender-generated northern stone + ironwood ceiling
  floorTexture: { basePath: 'assets/textures/stone/northern-floor' },
  wallTexture: { basePath: 'assets/textures/stone/northern-wall' },
  ceilingTexture: { basePath: 'assets/textures/wood/ironwood-ceiling' },

  // Ambient light — boosted for denser scene with more geometry absorbing light
  ambientLight: { color: 0x887766, intensity: 0.85 },

  // 11 lights: 1 directional + 10 point (budget cap)
  lights: [
    // Cool exterior light through east-wall window slit (shadow caster, god rays source)
    { type: 'directional', position: { x: 10, y: 8, z: -2 }, color: 0xB0C4DE, intensity: 2.0, castShadow: true },
    // Great hearth — dominant warm source, center of north wall
    { type: 'point', position: { x: 0, y: 3, z: -6.5 }, color: 0xFF6B35, intensity: 10.0, distance: 14, decay: 1, flicker: true },
    // Wall sconces (4x — west and east walls)
    { type: 'point', position: { x: -11, y: 4, z: -4 }, color: 0xFFCC66, intensity: 4.0, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: -11, y: 4, z: 3 }, color: 0xFFCC66, intensity: 4.0, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: 11, y: 4, z: -4 }, color: 0xFFCC66, intensity: 4.0, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: 11, y: 4, z: 3 }, color: 0xFFCC66, intensity: 4.0, distance: 12, decay: 1, flicker: true },
    // Iron chandeliers (3x — overhead along central axis)
    { type: 'point', position: { x: 0, y: 8.5, z: -3 }, color: 0xFFCC66, intensity: 5.0, distance: 14, decay: 1, flicker: true },
    { type: 'point', position: { x: 0, y: 8.5, z: 0 }, color: 0xFFCC66, intensity: 5.0, distance: 14, decay: 1, flicker: true },
    { type: 'point', position: { x: 0, y: 8.5, z: 3 }, color: 0xFFCC66, intensity: 5.0, distance: 14, decay: 1, flicker: true },
    // Braziers flanking dais (2x — warm accent)
    { type: 'point', position: { x: -4, y: 2, z: -5 }, color: 0xFF6B35, intensity: 5.0, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: 4, y: 2, z: -5 }, color: 0xFF6B35, intensity: 5.0, distance: 12, decay: 1, flicker: true },
  ],

  doors: [
    // West door → placeholder (will connect to kitchen eventually)
    {
      position: { x: -12, y: 0, z: 0 },
      halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.ThroneRoom, // placeholder — redirect to Red Keep for now
      spawnPoint: { x: 0, y: 0, z: 0 },
      wall: 'west',
    },
  ],

  npcs: [
    // Lord Forrester — on throne
    { label: 'Lord Forrester', spriteColor: '#2d2318', spritePath: 'assets/sprites/npcs/forrester-lord.png', position: { x: 0, y: 0.3, z: -5.8 } },
    // Lady Forrester — high seat beside throne
    { label: 'Lady Forrester', spriteColor: '#2d5a27', spritePath: 'assets/sprites/npcs/forrester-lady.png', position: { x: -2.5, y: 0.3, z: -5.5 } },
    // Guard at west door
    { label: 'Guard (door)', spriteColor: '#3c3228', spritePath: 'assets/sprites/npcs/forrester-guard.png', position: { x: -10, y: 0, z: 0 } },
    // Guard beside dais
    { label: 'Guard (dais)', spriteColor: '#3c3228', spritePath: 'assets/sprites/npcs/forrester-guard.png', position: { x: 4, y: 0, z: -4.5 } },
    // Servant near table
    { label: 'Servant (table)', spriteColor: '#6e5f4b', spritePath: 'assets/sprites/npcs/forrester-servant.png', position: { x: -3, y: 0, z: 1 } },
    // Servant near hearth
    { label: 'Servant (hearth)', spriteColor: '#6e5f4b', spritePath: 'assets/sprites/npcs/forrester-servant.png', position: { x: 1.5, y: 0, z: -6 } },
    // Maester near lord
    { label: 'Maester', spriteColor: '#5f5c58', spritePath: 'assets/sprites/npcs/forrester-maester.png', position: { x: 2.5, y: 0.3, z: -5.5 } },
  ],

  particles: [
    // Dust motes — full room, 100 count for dense atmosphere
    { type: 'dust', region: { minX: -10, maxX: 10, minY: 1, maxY: 8, minZ: -6, maxZ: 5 }, count: 100 },
    // Hearth embers (dense spark column)
    { type: 'embers', position: { x: 0, y: 3, z: -6.5 }, count: 30 },
    // Wall sconce embers (4x)
    { type: 'embers', position: { x: -11, y: 4, z: -4 }, count: 8 },
    { type: 'embers', position: { x: -11, y: 4, z: 3 }, count: 8 },
    { type: 'embers', position: { x: 11, y: 4, z: -4 }, count: 8 },
    { type: 'embers', position: { x: 11, y: 4, z: 3 }, count: 8 },
    // Chandelier embers (3x)
    { type: 'embers', position: { x: 0, y: 8.5, z: -3 }, count: 10 },
    { type: 'embers', position: { x: 0, y: 8.5, z: 0 }, count: 10 },
    { type: 'embers', position: { x: 0, y: 8.5, z: 3 }, count: 10 },
    // Brazier embers (2x)
    { type: 'embers', position: { x: -4, y: 2, z: -5 }, count: 12 },
    { type: 'embers', position: { x: 4, y: 2, z: -5 }, count: 12 },
    // Hearth smoke — rises from hearth opening
    { type: 'smoke', position: { x: 0, y: 4, z: -6.5 }, count: 25, spread: 0.8 },
    // Dust in light beams — region matching east-wall window directional
    {
      type: 'dust-in-light',
      region: { minX: 2, maxX: 10, minY: 2, maxY: 8, minZ: -5, maxZ: 1 },
      count: 40,
      lightDirection: { x: -0.7, y: -0.5, z: 0.5 }, // angled from east wall downward
    },
    // Falling ash near hearth — dust motes with downward drift, warm tint
    {
      type: 'dust',
      region: { minX: -3, maxX: 3, minY: 1, maxY: 7, minZ: -7, maxZ: -4 },
      count: 15,
      driftDirection: { x: 0, y: -0.3, z: 0 },
    },
  ],

  props: [
    // ─── STRUCTURAL ───────────────────────────────────────────────
    // Ironwood columns (6x) — central aisle, 3 per side
    {
      type: 'model', modelPath: P('ironwood-column'), scale: 1.0,
      positions: [
        { x: -5, y: 0, z: -4 }, { x: -5, y: 0, z: 0 }, { x: -5, y: 0, z: 4 },
        { x: 5, y: 0, z: -4 }, { x: 5, y: 0, z: 0 }, { x: 5, y: 0, z: 4 },
      ],
    },
    // Great stone hearth — center of north wall
    { type: 'model', modelPath: P('stone-hearth'), positions: [{ x: 0, y: 0, z: -6.8 }], scale: 1.2 },
    // Raised dais platform — in front of hearth
    { type: 'model', modelPath: P('raised-dais'), positions: [{ x: 0, y: 0, z: -5.5 }], scale: 1.0 },
    // Stone arches — north wall flanking hearth, south wall entry
    {
      type: 'model', modelPath: P('stone-arch'), scale: 1.0,
      positions: [
        { x: -4.5, y: 0, z: -6.9 }, { x: 4.5, y: 0, z: -6.9 },  // flanking hearth
        { x: 0, y: 0, z: 6.9, rotationY: Math.PI },                // south entry
      ],
    },
    // Stone pilasters — wall articulation (8x along east/west walls)
    {
      type: 'model', modelPath: P('stone-pilaster'), scale: 1.0,
      positions: [
        { x: -11.9, y: 0, z: -5 }, { x: -11.9, y: 0, z: -1 }, { x: -11.9, y: 0, z: 3 },
        { x: 11.9, y: 0, z: -5, rotationY: Math.PI }, { x: 11.9, y: 0, z: -1, rotationY: Math.PI }, { x: 11.9, y: 0, z: 3, rotationY: Math.PI },
      ],
    },
    // Corbel brackets — support roof beams at wall junction (6x per side)
    {
      type: 'model', modelPath: P('corbel-bracket'), scale: 0.8,
      positions: [
        { x: -11.8, y: 8.5, z: -4 }, { x: -11.8, y: 8.5, z: 0 }, { x: -11.8, y: 8.5, z: 4 },
        { x: 11.8, y: 8.5, z: -4 }, { x: 11.8, y: 8.5, z: 0 }, { x: 11.8, y: 8.5, z: 4 },
      ],
    },
    // Stone window frame — east wall
    { type: 'model', modelPath: P('stone-window-frame'), positions: [{ x: 11.9, y: 3, z: -2, rotationY: -Math.PI / 2 }], scale: 1.0 },
    // Door frame — west wall entry
    { type: 'model', modelPath: P('door-frame'), positions: [{ x: -11.9, y: 0, z: 0, rotationY: Math.PI / 2 }], scale: 1.0 },

    // ─── DAIS AREA ────────────────────────────────────────────────
    // Ironwood throne — center of dais
    { type: 'model', modelPath: P('ironwood-throne'), positions: [{ x: 0, y: 0.3, z: -5.8 }], scale: 1.0 },
    // High seats flanking throne
    {
      type: 'model', modelPath: P('high-seat'), scale: 0.9,
      positions: [
        { x: -2.5, y: 0.3, z: -5.5, rotationY: 0.15 },
        { x: 2.5, y: 0.3, z: -5.5, rotationY: -0.15 },
      ],
    },
    // Fur rug on dais
    { type: 'model', modelPath: P('fur-rug'), positions: [{ x: 0, y: 0.32, z: -5 }], scale: 1.5 },

    // ─── CENTRAL FEASTING AREA ────────────────────────────────────
    // Long feasting table — center of room
    { type: 'model', modelPath: P('long-table'), positions: [{ x: 0, y: 0, z: 0 }], scale: 1.0 },
    // Benches along both sides of table (6x)
    {
      type: 'model', modelPath: P('bench'), scale: 1.0,
      positions: [
        { x: -2.5, y: 0, z: -1.5 }, { x: -2.5, y: 0, z: 0 }, { x: -2.5, y: 0, z: 1.5 },
        { x: 2.5, y: 0, z: -1.5, rotationY: Math.PI }, { x: 2.5, y: 0, z: 0, rotationY: Math.PI }, { x: 2.5, y: 0, z: 1.5, rotationY: Math.PI },
      ],
    },
    // Chairs at table ends
    {
      type: 'model', modelPath: P('chair'), scale: 0.9,
      positions: [
        { x: 0, y: 0, z: -2.5, rotationY: Math.PI },
        { x: 0, y: 0, z: 2.5 },
      ],
    },
    // Table items — goblets (8x scattered along table)
    {
      type: 'model', modelPath: P('goblet'), scale: 0.7,
      positions: [
        { x: -1.2, y: 0.85, z: -1.2 }, { x: 1.0, y: 0.85, z: -1.0 },
        { x: -0.8, y: 0.85, z: 0.3 }, { x: 1.3, y: 0.85, z: 0.5 },
        { x: -1.5, y: 0.85, z: 1.0 }, { x: 0.7, y: 0.85, z: 1.3 },
        { x: -0.3, y: 0.85, z: -0.5 }, { x: 0.2, y: 0.85, z: 0.8 },
      ],
    },
    // Plates (8x)
    {
      type: 'model', modelPath: P('plate'), scale: 0.7,
      positions: [
        { x: -1.5, y: 0.85, z: -1.5 }, { x: 1.5, y: 0.85, z: -1.3 },
        { x: -1.0, y: 0.85, z: -0.2 }, { x: 1.0, y: 0.85, z: 0.0 },
        { x: -1.3, y: 0.85, z: 0.8 }, { x: 1.2, y: 0.85, z: 1.0 },
        { x: -0.5, y: 0.85, z: 1.5 }, { x: 0.5, y: 0.85, z: -0.8 },
      ],
    },
    // Food platters (4x center of table)
    {
      type: 'model', modelPath: P('food-platter'), scale: 0.8,
      positions: [
        { x: 0, y: 0.85, z: -1.0 }, { x: 0, y: 0.85, z: 0.5 },
        { x: 0, y: 0.85, z: -0.2 }, { x: 0, y: 0.85, z: 1.2 },
      ],
    },
    // Candelabras on table (3x)
    {
      type: 'model', modelPath: P('candelabra'), scale: 0.6,
      positions: [
        { x: 0, y: 0.85, z: -1.5 },
        { x: 0, y: 0.85, z: 0 },
        { x: 0, y: 0.85, z: 1.5 },
      ],
    },

    // ─── LIGHTING FIXTURES ────────────────────────────────────────
    // Iron chandeliers (3x overhead along central axis)
    {
      type: 'model', modelPath: P('iron-chandelier'), scale: 1.0,
      positions: [
        { x: 0, y: 8.5, z: -3 },
        { x: 0, y: 8.5, z: 0 },
        { x: 0, y: 8.5, z: 3 },
      ],
    },
    // Wall sconces (4x — matching light positions)
    {
      type: 'model', modelPath: P('wall-sconce'), scale: 0.5,
      positions: [
        { x: -11.8, y: 4, z: -4 }, { x: -11.8, y: 4, z: 3 },
        { x: 11.8, y: 4, z: -4 }, { x: 11.8, y: 4, z: 3 },
      ],
    },

    // Iron torch holders (4x — matching sconce light positions)
    {
      type: 'model', modelPath: P('iron-torch-holder'), scale: 0.6,
      positions: [
        { x: -11.8, y: 3.8, z: -4 }, { x: -11.8, y: 3.8, z: 3 },
        { x: 11.8, y: 3.8, z: -4, rotationY: Math.PI }, { x: 11.8, y: 3.8, z: 3, rotationY: Math.PI },
      ],
    },
    // Iron braziers flanking dais (2x)
    {
      type: 'model', modelPath: P('iron-brazier'), scale: 0.9,
      positions: [
        { x: -4, y: 0, z: -5 },
        { x: 4, y: 0, z: -5 },
      ],
    },
    // Iron candle trees — flanking throne (2x)
    {
      type: 'model', modelPath: P('iron-candle-tree'), scale: 0.8,
      positions: [
        { x: -1.2, y: 0.3, z: -5.8 },
        { x: 1.2, y: 0.3, z: -5.8 },
      ],
    },

    // ─── ROOF STRUCTURE ─────────────────────────────────────────────
    // Main roof beams (3x spanning width)
    {
      type: 'model', modelPath: P('roof-beam'), scale: 1.0,
      positions: [
        { x: 0, y: 9.2, z: -4 },
        { x: 0, y: 9.2, z: 0 },
        { x: 0, y: 9.2, z: 4 },
      ],
    },
    // Cross joists between beams (6x)
    {
      type: 'model', modelPath: P('roof-joist'), scale: 1.0,
      positions: [
        { x: -4, y: 9.5, z: -2, rotationY: Math.PI / 2 }, { x: 4, y: 9.5, z: -2, rotationY: Math.PI / 2 },
        { x: -4, y: 9.5, z: 2, rotationY: Math.PI / 2 }, { x: 4, y: 9.5, z: 2, rotationY: Math.PI / 2 },
      ],
    },
    // Rafter set visible above
    {
      type: 'model', modelPath: P('rafter-set'), scale: 0.8,
      positions: [
        { x: 0, y: 9.0, z: -6 }, { x: 0, y: 9.0, z: 6 },
      ],
    },

    // ─── DECORATIVE — WALLS ───────────────────────────────────────
    // Forrester banners flanking hearth (2x) + east/west walls (4x)
    {
      type: 'model', modelPath: P('banner'), scale: 1.2,
      positions: [
        { x: -3, y: 0, z: -6.8 }, { x: 3, y: 0, z: -6.8 },     // flanking hearth
        { x: -11.8, y: 0, z: -2 }, { x: -11.8, y: 0, z: 2 },   // west wall
        { x: 11.8, y: 0, z: -2 }, { x: 11.8, y: 0, z: 2 },     // east wall
      ],
    },
    // Tapestries (2x — west and east walls)
    {
      type: 'model', modelPath: P('tapestry'), scale: 1.0,
      positions: [
        { x: -11.8, y: 0, z: 0 },
        { x: 11.8, y: 0, z: 0 },
      ],
    },
    // Weapon racks (2x — west and east walls)
    {
      type: 'model', modelPath: P('weapon-rack'), scale: 0.9,
      positions: [
        { x: -11.5, y: 0, z: 5 },
        { x: 11.5, y: 0, z: 5 },
      ],
    },
    // Dire wolf shields (2x — flanking hearth above arches)
    {
      type: 'model', modelPath: P('dire-wolf-shield'), scale: 1.2,
      positions: [
        { x: -4.5, y: 5.5, z: -6.9 },
        { x: 4.5, y: 5.5, z: -6.9 },
      ],
    },
    // Mounted antlers (3x — east wall trophies)
    {
      type: 'model', modelPath: P('mounted-antlers'), scale: 0.8,
      positions: [
        { x: 11.8, y: 5, z: -4 },
        { x: 11.8, y: 5.5, z: 0 },
        { x: 11.8, y: 5, z: 4 },
      ],
    },
    // Heraldic crest — above hearth mantel
    { type: 'model', modelPath: P('heraldic-crest'), positions: [{ x: 0, y: 5.5, z: -6.85 }], scale: 1.5 },

    // ─── SIDE FURNITURE ────────────────────────────────────────────
    // Sideboards along walls (2x — serving tables)
    {
      type: 'model', modelPath: P('sideboard'), scale: 0.9,
      positions: [
        { x: -10, y: 0, z: -5 },
        { x: 10, y: 0, z: -5, rotationY: Math.PI },
      ],
    },
    // Stools scattered near walls (4x)
    {
      type: 'model', modelPath: P('stool'), scale: 0.8,
      positions: [
        { x: -9, y: 0, z: -3 }, { x: 9, y: 0, z: -3 },
        { x: -8, y: 0, z: 2 }, { x: 8, y: 0, z: 2 },
      ],
    },
    // Wine jugs on sideboard (3x)
    {
      type: 'model', modelPath: P('wine-jug'), scale: 0.7,
      positions: [
        { x: -9.8, y: 0.88, z: -5 },
        { x: -10.2, y: 0.88, z: -4.8 },
        { x: 10, y: 0.88, z: -5 },
      ],
    },
    // Candle stubs on sideboards + windowsill (5x)
    {
      type: 'model', modelPath: P('candle-stub'), scale: 0.5,
      positions: [
        { x: -10.3, y: 0.88, z: -5.2 }, { x: 10.2, y: 0.88, z: -4.7 },
        { x: 11.6, y: 4.0, z: -2 },  // window sill
        { x: -9.5, y: 0.88, z: -4.6 }, { x: 9.8, y: 0.88, z: -5.3 },
      ],
    },

    // ─── DECORATIVE — FLOOR ───────────────────────────────────────
    // Fur rug near hearth (in front of dais)
    { type: 'model', modelPath: P('fur-rug'), positions: [{ x: 0, y: 0.01, z: -3.5 }], scale: 2.0 },
    // Rushes/straw scattered on floor (6x)
    {
      type: 'model', modelPath: P('rushes'), scale: 1.0,
      positions: [
        { x: -3, y: 0.01, z: -2 }, { x: 4, y: 0.01, z: -1 },
        { x: -6, y: 0.01, z: 2 }, { x: 7, y: 0.01, z: 3 },
        { x: -2, y: 0.01, z: 4 }, { x: 3, y: 0.01, z: 5 },
      ],
    },
    // Sleeping hound near hearth
    { type: 'model', modelPath: P('hound-sleeping'), positions: [{ x: 2, y: 0, z: -4 }], scale: 0.8 },
    // Wooden chests (2x)
    {
      type: 'model', modelPath: P('wooden-chest-large'), scale: 0.9,
      positions: [
        { x: 9, y: 0, z: -5, rotationY: -0.3 },
      ],
    },

    // ─── FOREGROUND OCCLUSION (positive Z, near camera — blurred by tilt-shift) ──
    // Columns placed near camera for depth layering
    {
      type: 'model', modelPath: P('ironwood-column'), scale: 1.0,
      positions: [
        { x: -8, y: 0, z: 5.5 },
        { x: 8, y: 0, z: 5.5 },
      ],
    },
    // Chest in foreground
    { type: 'model', modelPath: P('wooden-chest-large'), positions: [{ x: 10, y: 0, z: 6, rotationY: 0.5 }], scale: 0.9 },

    // ─── SURFACE DETAIL QUADS ─────────────────────────────────────
    // Floor cracks near high-traffic areas (3x)
    {
      type: 'model', modelPath: P('floor-crack'), scale: 1.0,
      positions: [
        { x: -1, y: 0.005, z: -4.5 },  // dais edge
        { x: -10, y: 0.005, z: 0 },      // near west door
        { x: 3, y: 0.005, z: 3 },        // central aisle
      ],
    },
    // Wall moss patches (3x — damp corners)
    {
      type: 'model', modelPath: P('wall-moss'), scale: 0.8,
      positions: [
        { x: -11.7, y: 0.5, z: -6 },
        { x: 11.7, y: 0.5, z: -6 },
        { x: -11.7, y: 0.3, z: 6 },
      ],
    },
    // Hearth scorch mark on wall above hearth
    { type: 'model', modelPath: P('hearth-scorch'), positions: [{ x: 0, y: 5, z: -6.95 }], scale: 1.2 },
    // Table stain
    { type: 'model', modelPath: P('table-stain'), positions: [{ x: -0.5, y: 0.86, z: 0.3 }], scale: 0.6 },
    // Worn paths at high-traffic areas (2x)
    {
      type: 'model', modelPath: P('worn-path'), scale: 1.0,
      positions: [
        { x: -5, y: 0.003, z: 0 },  // west aisle between columns
        { x: 5, y: 0.003, z: 0 },    // east aisle between columns
      ],
    },
    // Cobwebs in upper corners (4x)
    {
      type: 'model', modelPath: P('cobweb'), scale: 0.6,
      positions: [
        { x: -11.7, y: 9.5, z: -6.8 },
        { x: 11.7, y: 9.5, z: -6.8 },
        { x: -11.7, y: 9.5, z: 6.8 },
        { x: 11.7, y: 9.5, z: 6.8 },
      ],
    },
  ],

  // Wolfswood parallax visible through north-wall windows
  parallaxBackground: [
    { texturePath: 'assets/backgrounds/ironrath/layer-sky.png', depth: 20, scrollFactor: 0, height: 10, yOffset: 6 },
    { texturePath: 'assets/backgrounds/ironrath/layer-mountains.png', depth: 15, scrollFactor: 0.1, height: 10, yOffset: 5 },
    { texturePath: 'assets/backgrounds/ironrath/layer-canopy.png', depth: 10, scrollFactor: 0.2, height: 10, yOffset: 4 },
    { texturePath: 'assets/backgrounds/ironrath/layer-trees.png', depth: 5, scrollFactor: 0.3, height: 10, yOffset: 3 },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.7, luminanceThreshold: 0.75 },     // richer bloom on torch/chandelier glow
    tiltShift: { focusArea: 0.28, feather: 0.18 },           // tighter focus for stronger diorama effect
    vignette: { darkness: 0.42 },                             // deeper framing (still below 0.50 max)
    colorGrading: { hue: 0.04, saturation: 0.12, brightness: 0, contrast: 0.10 },  // warm base tint
    ssao: { aoRadius: 4.5, intensity: 2.8, distanceFalloff: 1.0 },  // stronger contact shadows
  },

  godRays: { color: 0xB0C4DE, density: 1 / 128, maxDensity: 0.45 },  // slightly stronger god rays
};

export default greatHall;

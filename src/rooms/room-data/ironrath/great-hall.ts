import { RoomId } from '../../../ecs/components/singletons.js';
import type { RoomData } from '../types.js';

/** Shorthand for Ironrath prop model path */
const P = (name: string) => `assets/models/props/ironrath/${name}.glb`;

/**
 * Ironrath Castle — Great Hall (House Forrester)
 *
 * Dense medieval great hall: ~80 prop instances across structural,
 * furniture, lighting, decorative, and surface-detail categories.
 * 11 lights (10 point + 1 shadow directional). 4 particle emitter groups.
 */
const greatHall: RoomData = {
  id: RoomId.IronrathGreatHall,
  name: 'Ironrath Great Hall',
  dimensions: { width: 24, depth: 14, height: 10 },
  mood: 'grand',

  // Northern stone — all channels >= 0x30 per lighting prevention rules
  floorColor: 0x3A3530,
  wallColor: 0x4A4540,
  ceilingColor: 0x1f1510, // ironwood ceiling (dark)

  // PBR textures — reuse existing stone/wood sets for now
  floorTexture: { basePath: 'assets/textures/stone/castle-wall-slates' },
  wallTexture: { basePath: 'assets/textures/stone/castle-wall-slates' },

  // Ambient light — above 0.45 minimum per lighting prevention rules
  ambientLight: { color: 0x665544, intensity: 0.55 },

  // 11 lights: 1 directional + 10 point (budget cap)
  lights: [
    // Cool exterior light through east-wall window slit (shadow caster, god rays source)
    { type: 'directional', position: { x: 10, y: 8, z: -2 }, color: 0xB0C4DE, intensity: 1.2, castShadow: true },
    // Great hearth — dominant warm source, center of north wall
    { type: 'point', position: { x: 0, y: 3, z: -6.5 }, color: 0xFF6B35, intensity: 6.0, distance: 12, decay: 1, flicker: true },
    // Wall sconces (4x — west and east walls)
    { type: 'point', position: { x: -11, y: 4, z: -4 }, color: 0xFFCC66, intensity: 2.0, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: -11, y: 4, z: 3 }, color: 0xFFCC66, intensity: 2.0, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: 11, y: 4, z: -4 }, color: 0xFFCC66, intensity: 2.0, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: 11, y: 4, z: 3 }, color: 0xFFCC66, intensity: 2.0, distance: 10, decay: 1, flicker: true },
    // Iron chandeliers (3x — overhead along central axis)
    { type: 'point', position: { x: 0, y: 8.5, z: -3 }, color: 0xFFCC66, intensity: 2.5, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: 0, y: 8.5, z: 0 }, color: 0xFFCC66, intensity: 2.5, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: 0, y: 8.5, z: 3 }, color: 0xFFCC66, intensity: 2.5, distance: 12, decay: 1, flicker: true },
    // Braziers flanking dais (2x — warm accent)
    { type: 'point', position: { x: -4, y: 2, z: -5 }, color: 0xFF6B35, intensity: 3.0, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: 4, y: 2, z: -5 }, color: 0xFF6B35, intensity: 3.0, distance: 10, decay: 1, flicker: true },
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

  npcs: [],      // Populated in Phase 4

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
    // Wooden chest near east wall
    { type: 'model', modelPath: P('wooden-chest'), positions: [{ x: 9, y: 0, z: -5, rotationY: -0.3 }], scale: 0.9 },

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
    { type: 'model', modelPath: P('wooden-chest'), positions: [{ x: 10, y: 0, z: 6, rotationY: 0.5 }], scale: 0.9 },

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
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.6, luminanceThreshold: 0.80 },
    tiltShift: { focusArea: 0.30, feather: 0.20 },
    vignette: { darkness: 0.38 },
    colorGrading: { hue: 0.05, saturation: 0.1, brightness: 0, contrast: 0.08 },
  },

  godRays: { color: 0xB0C4DE, density: 1 / 128, maxDensity: 0.4 },
};

export default greatHall;

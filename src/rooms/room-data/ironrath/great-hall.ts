import { RoomId } from '../../../ecs/components/singletons.js';
import type { RoomData } from '../types.js';

/**
 * Ironrath Castle — Great Hall (House Forrester)
 *
 * Phase 1 skeleton: dimensions, colors, placeholder lights, one door.
 * Props, NPCs, and full lighting populated in later phases.
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

  lights: [
    // Directional (cool exterior light through window slit on east wall)
    {
      type: 'directional',
      position: { x: 10, y: 8, z: -2 },
      color: 0xB0C4DE,
      intensity: 1.2,
      castShadow: true,
    },
    // Great hearth (dominant warm source, center of north wall)
    { type: 'point', position: { x: 0, y: 3, z: -6.5 }, color: 0xFF6B35, intensity: 5.0, distance: 12, decay: 1, flicker: true },
    // Wall sconces (4x along walls)
    { type: 'point', position: { x: -11, y: 4, z: -4 }, color: 0xFFCC66, intensity: 2.0, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: -11, y: 4, z: 3 }, color: 0xFFCC66, intensity: 2.0, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: 11, y: 4, z: -4 }, color: 0xFFCC66, intensity: 2.0, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: 11, y: 4, z: 3 }, color: 0xFFCC66, intensity: 2.0, distance: 10, decay: 1, flicker: true },
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
    // Dust motes — full room region
    {
      type: 'dust',
      region: { minX: -10, maxX: 10, minY: 1, maxY: 8, minZ: -6, maxZ: 5 },
      count: 80,
    },
    // Torch embers for hearth
    { type: 'embers', position: { x: 0, y: 3, z: -6.5 }, count: 15 },
    // Torch embers for wall sconces
    { type: 'embers', position: { x: -11, y: 4, z: -4 }, count: 10 },
    { type: 'embers', position: { x: -11, y: 4, z: 3 }, count: 10 },
    { type: 'embers', position: { x: 11, y: 4, z: -4 }, count: 10 },
    { type: 'embers', position: { x: 11, y: 4, z: 3 }, count: 10 },
  ],
  props: [],     // Populated in Phase 2

  postProcessOverrides: {
    bloom: { intensity: 0.6, luminanceThreshold: 0.80 },
    tiltShift: { focusArea: 0.30, feather: 0.20 },
    vignette: { darkness: 0.38 },
    colorGrading: { hue: 0.05, saturation: 0.1, brightness: 0, contrast: 0.08 },
  },

  godRays: { color: 0xB0C4DE, density: 1 / 128, maxDensity: 0.4 },
};

export default greatHall;

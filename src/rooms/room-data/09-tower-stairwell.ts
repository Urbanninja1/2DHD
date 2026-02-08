import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const towerStairwell: RoomData = {
  id: RoomId.TowerStairwell,
  name: 'Tower Stairwell',
  dimensions: { width: 5, depth: 5, height: 12 },
  mood: 'dark',

  floorColor: 0x2A2520,
  wallColor: 0x3A3530,
  ceilingColor: 0x1A1510,

  floorTexture: { basePath: 'assets/textures/stone/rough-stone' },
  wallTexture: { basePath: 'assets/textures/stone/worn-stone' },
  ceilingTexture: { basePath: 'assets/textures/stone/brick-arch' },

  ambientLight: { color: 0x2A2A3E, intensity: 0.3 },

  lights: [
    // 2 torches, 180° apart on curved walls
    { type: 'point', position: { x: -2, y: 3, z: -2 }, color: 0xFFAA44, intensity: 3.5, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: 2, y: 3, z: 2 }, color: 0xFFAA44, intensity: 3.5, distance: 12, decay: 1, flicker: true },
  ],

  doors: [
    // South door → Grand Gallery
    {
      position: { x: 0, y: 0, z: 2.5 },
      halfExtents: { x: 1, z: 0.6 },
      targetRoomId: RoomId.GrandGallery,
      spawnPoint: { x: 0, y: 0, z: -2 },
      wall: 'south',
    },
    // North door → Battlements
    {
      position: { x: 0, y: 0, z: -2.5 },
      halfExtents: { x: 1, z: 0.6 },
      targetRoomId: RoomId.Battlements,
      spawnPoint: { x: 0, y: 0, z: 1.5 },
      wall: 'north',
    },
  ],

  npcs: [],

  particles: [
    // Minimal dust in the tight space
    {
      type: 'dust',
      region: { minX: -2, maxX: 2, minY: 1, maxY: 8, minZ: -2, maxZ: 2 },
      count: 15,
    },
    // Torch embers
    { type: 'embers', position: { x: -2, y: 3, z: -2 }, count: 8 },
    { type: 'embers', position: { x: 2, y: 3, z: 2 }, count: 8 },
  ],

  props: [
    // Wall-mounted torches on the curved walls
    {
      type: 'model',
      modelPath: 'assets/models/props/sconce-iron.glb',
      positions: [
        { x: -2, y: 2.8, z: -2 },
        { x: 2, y: 2.8, z: 2 },
      ],
      scale: 0.4,
    },
    // Lantern hanging in the stairwell
    {
      type: 'model',
      modelPath: 'assets/models/props/lantern.glb',
      positions: [{ x: 0, y: 5, z: 0 }],
      scale: 0.4,
    },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.4, luminanceThreshold: 0.88 },
    tiltShift: { focusArea: 0.20, feather: 0.20 },
    vignette: { darkness: 0.70 },
    colorGrading: { hue: -0.087, saturation: -0.1, brightness: -0.1, contrast: 0.15 },
  },
};

export default towerStairwell;

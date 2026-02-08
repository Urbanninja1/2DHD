import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const grandGallery: RoomData = {
  id: RoomId.GrandGallery,
  name: 'Grand Gallery',
  dimensions: { width: 30, depth: 6, height: 8 },
  mood: 'grand',

  floorColor: 0x3a3a3a,
  wallColor: 0x504840,
  ceilingColor: 0x2a2a2a,

  floorTexture: { basePath: 'assets/textures/marble/polished-marble', tint: 0xFFF8E7 },
  wallTexture: { basePath: 'assets/textures/stone/castle-wall-slates' },
  ceilingTexture: { basePath: 'assets/textures/stone/vaulted-stone' },

  ambientLight: { color: 0x6688BB, intensity: 0.35 },

  lights: [
    // Directional — natural daylight through arched windows
    {
      type: 'directional',
      position: { x: 5, y: 10, z: -2 },
      color: 0xFFF5E0,
      intensity: 1.2,
      castShadow: true,
    },
    // 4 torch sconces along the gallery
    { type: 'point', position: { x: -10, y: 4, z: -2.5 }, color: 0xFFCC66, intensity: 1.5, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: -3, y: 4, z: -2.5 }, color: 0xFFCC66, intensity: 1.5, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: 3, y: 4, z: -2.5 }, color: 0xFFCC66, intensity: 1.5, distance: 10, decay: 1, flicker: true },
    { type: 'point', position: { x: 10, y: 4, z: -2.5 }, color: 0xFFCC66, intensity: 1.5, distance: 10, decay: 1, flicker: true },
  ],

  doors: [
    // South door → Throne Room
    {
      position: { x: 0, y: 0, z: 3 },
      halfExtents: { x: 1.5, z: 0.8 },
      targetRoomId: RoomId.ThroneRoom,
      spawnPoint: { x: 0, y: 0, z: -7.5 },
      wall: 'south',
    },
    // West door → Hand's Solar
    {
      position: { x: -15, y: 0, z: 0 },
      halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.HandsSolar,
      spawnPoint: { x: 2.5, y: 0, z: 0 },
      wall: 'west',
    },
    // East door → Guard Post
    {
      position: { x: 15, y: 0, z: 0 },
      halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.GuardPost,
      spawnPoint: { x: -4, y: 0, z: 0 },
      wall: 'east',
    },
    // North door → Tower Stairwell
    {
      position: { x: 0, y: 0, z: -3 },
      halfExtents: { x: 1.5, z: 0.8 },
      targetRoomId: RoomId.TowerStairwell,
      spawnPoint: { x: 0, y: 0, z: 2 },
      wall: 'north',
    },
  ],

  npcs: [
    // Servants and a noble strolling
    { spriteColor: '#8B7355', position: { x: -7, y: 0, z: 0 }, label: 'Servant 1', spritePath: 'assets/sprites/npcs/servant.png' },
    { spriteColor: '#8B7355', position: { x: 5, y: 0, z: -1 }, label: 'Servant 2', spritePath: 'assets/sprites/npcs/servant.png' },
    { spriteColor: '#C9A84C', position: { x: -2, y: 0, z: 1 }, label: 'Noble', spritePath: 'assets/sprites/npcs/noble-male.png' },
  ],

  particles: [
    // Dust motes in natural daylight
    {
      type: 'dust',
      region: { minX: -12, maxX: 12, minY: 1, maxY: 6, minZ: -2.5, maxZ: 2.5 },
      count: 60,
    },
    // Torch embers
    { type: 'embers', position: { x: -10, y: 4, z: -2.5 }, count: 10 },
    { type: 'embers', position: { x: -3, y: 4, z: -2.5 }, count: 10 },
    { type: 'embers', position: { x: 3, y: 4, z: -2.5 }, count: 10 },
    { type: 'embers', position: { x: 10, y: 4, z: -2.5 }, count: 10 },
  ],

  props: [
    // 12 columns — 6 per side along the gallery length
    {
      type: 'model',
      modelPath: 'assets/models/props/column-stone.glb',
      positions: [
        // North wall colonnade
        { x: -12, y: 0, z: -2 }, { x: -8, y: 0, z: -2 }, { x: -4, y: 0, z: -2 },
        { x: 0, y: 0, z: -2 }, { x: 4, y: 0, z: -2 }, { x: 8, y: 0, z: -2 },
        // South wall colonnade
        { x: -12, y: 0, z: 2 }, { x: -8, y: 0, z: 2 }, { x: -4, y: 0, z: 2 },
        { x: 0, y: 0, z: 2 }, { x: 4, y: 0, z: 2 }, { x: 8, y: 0, z: 2 },
      ],
      scale: 1.0,
    },
    // Sconces at torch positions
    {
      type: 'model',
      modelPath: 'assets/models/props/sconce-iron.glb',
      positions: [
        { x: -10, y: 3.8, z: -2.5 }, { x: -3, y: 3.8, z: -2.5 },
        { x: 3, y: 3.8, z: -2.5 }, { x: 10, y: 3.8, z: -2.5 },
      ],
      scale: 0.5,
    },
    // Armor stands along the south wall
    {
      type: 'model',
      modelPath: 'assets/models/props/armor-stand.glb',
      positions: [
        { x: -10, y: 0, z: 2.2 },
        { x: -4, y: 0, z: 2.2 },
        { x: 4, y: 0, z: 2.2 },
        { x: 10, y: 0, z: 2.2 },
      ],
      scale: 0.7,
    },
    // Banners between columns on the north wall
    {
      type: 'model',
      modelPath: 'assets/models/props/banner.glb',
      positions: [
        { x: -10, y: 0, z: -2.5 },
        { x: -2, y: 0, z: -2.5 },
        { x: 6, y: 0, z: -2.5 },
      ],
      scale: 1.0,
    },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.6, luminanceThreshold: 0.82 },
    tiltShift: { focusArea: 0.45, feather: 0.35 },
    vignette: { darkness: 0.35 },
    colorGrading: { hue: 0, saturation: 0.1, brightness: 0, contrast: 0.1 },
  },

  godRays: { color: 0xFFF5E0, density: 1 / 128, maxDensity: 0.5 },
};

export default grandGallery;

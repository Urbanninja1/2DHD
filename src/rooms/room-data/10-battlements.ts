import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const battlements: RoomData = {
  id: RoomId.Battlements,
  name: 'Battlements Overlook',
  dimensions: { width: 25, depth: 4, height: 8 },
  mood: 'open',

  floorColor: 0x6B5B4A,
  wallColor: 0x8B7B6A,
  ceilingColor: 0x87CEEB,

  floorTexture: { basePath: 'assets/textures/stone/rough-stone' },
  wallTexture: { basePath: 'assets/textures/stone/castle-wall-slates' },

  ambientLight: { color: 0x6688BB, intensity: 0.5 },

  lights: [
    // Strong directional sunlight from the side
    {
      type: 'directional',
      position: { x: 10, y: 15, z: -5 },
      color: 0xFFF5E0,
      intensity: 1.8,
      castShadow: true,
    },
  ],

  doors: [
    // South door → Tower Stairwell
    {
      position: { x: 0, y: 0, z: 2 },
      halfExtents: { x: 1, z: 0.6 },
      targetRoomId: RoomId.TowerStairwell,
      spawnPoint: { x: 0, y: 0, z: -2 },
      wall: 'south',
    },
  ],

  npcs: [
    // 2 guards at posts
    { spriteColor: '#667788', position: { x: -8, y: 0, z: 0 }, label: 'Battlement Guard West', spritePath: 'assets/sprites/npcs/guard.png' },
    { spriteColor: '#667788', position: { x: 8, y: 0, z: 0 }, label: 'Battlement Guard East', spritePath: 'assets/sprites/npcs/guard.png' },
  ],

  particles: [
    // Dust / wind particles across the open space
    {
      type: 'dust',
      region: { minX: -12, maxX: 12, minY: 0.5, maxY: 5, minZ: -1.5, maxZ: 1.5 },
      count: 50,
    },
  ],

  props: [
    // Crenellations along the north wall (overlooking)
    {
      type: 'model',
      modelPath: 'assets/models/props/crenellation.glb',
      positions: [
        { x: -10, y: 0, z: -1.5 }, { x: -7, y: 0, z: -1.5 }, { x: -4, y: 0, z: -1.5 },
        { x: -1, y: 0, z: -1.5 }, { x: 2, y: 0, z: -1.5 }, { x: 5, y: 0, z: -1.5 },
        { x: 8, y: 0, z: -1.5 }, { x: 11, y: 0, z: -1.5 },
      ],
      scale: 1.0,
    },
    // Braziers for warmth
    {
      type: 'model',
      modelPath: 'assets/models/props/brazier.glb',
      positions: [
        { x: -5, y: 0, z: 0.5 },
        { x: 5, y: 0, z: 0.5 },
      ],
      scale: 0.6,
    },
    // Banner poles along the battlements
    {
      type: 'model',
      modelPath: 'assets/models/props/banner.glb',
      positions: [
        { x: -8, y: 0, z: 0.8 },
        { x: 0, y: 0, z: 0.8 },
        { x: 8, y: 0, z: 0.8 },
      ],
      scale: 1.0,
    },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.5, luminanceThreshold: 0.85 },
    tiltShift: { focusArea: 0.50, feather: 0.40 },
    vignette: { darkness: 0.25 },
    colorGrading: { hue: -0.175, saturation: 0, brightness: 0.05, contrast: 0.2 },
  },

  godRays: { color: 0xFFF5E0, density: 1 / 80, maxDensity: 0.7 },

  parallaxBackground: [
    // Layer 0: Gradient sky (dawn/dusk) — static background
    {
      texturePath: 'assets/backgrounds/battlements/layer-sky.png',
      depth: 25,
      scrollFactor: 0,
      height: 16,
      yOffset: 6,
    },
    // Layer 1: Blackwater Bay, distant shore — very slow parallax
    {
      texturePath: 'assets/backgrounds/battlements/layer-far.png',
      depth: 20,
      scrollFactor: 0.05,
      height: 12,
      yOffset: 3,
    },
    // Layer 2: King's Landing far rooftops — slow parallax
    {
      texturePath: 'assets/backgrounds/battlements/layer-mid-far.png',
      depth: 15,
      scrollFactor: 0.12,
      height: 10,
      yOffset: 2,
    },
    // Layer 3: Mid-distance buildings, Great Sept — medium parallax
    {
      texturePath: 'assets/backgrounds/battlements/layer-mid.png',
      depth: 10,
      scrollFactor: 0.22,
      height: 10,
      yOffset: 1.5,
    },
    // Layer 4: Near Red Keep walls and towers — faster parallax
    {
      texturePath: 'assets/backgrounds/battlements/layer-near.png',
      depth: 5,
      scrollFactor: 0.35,
      height: 10,
      yOffset: 0.5,
    },
  ],
};

export default battlements;

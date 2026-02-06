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
    { spriteColor: '#667788', position: { x: -8, y: 0, z: 0 }, label: 'Battlement Guard West' },
    { spriteColor: '#667788', position: { x: 8, y: 0, z: 0 }, label: 'Battlement Guard East' },
  ],

  particles: [
    // Dust / wind particles across the open space
    {
      type: 'dust',
      region: { minX: -12, maxX: 12, minY: 0.5, maxY: 5, minZ: -1.5, maxZ: 1.5 },
      count: 50,
    },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.5, luminanceThreshold: 0.85 },
    tiltShift: { focusArea: 0.50, feather: 0.40 },
    vignette: { darkness: 0.25 },
    colorGrading: { hue: -0.175, saturation: 0, brightness: 0.05, contrast: 0.2 },
  },

  godRays: { color: 0xFFF5E0, density: 1 / 80, maxDensity: 0.7 },
};

export default battlements;

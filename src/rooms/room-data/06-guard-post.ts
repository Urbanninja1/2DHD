import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const guardPost: RoomData = {
  id: RoomId.GuardPost,
  name: 'Royal Guard Post',
  dimensions: { width: 10, depth: 8, height: 4 },
  mood: 'dark',

  floorColor: 0x2A2A2A,
  wallColor: 0x3A3A3A,
  ceilingColor: 0x1A1A1A,

  ambientLight: { color: 0x1A1A2E, intensity: 0.1 },

  lights: [
    // Central brazier — strong warm glow
    { type: 'point', position: { x: 0, y: 2, z: 0 }, color: 0xFF6B35, intensity: 3.0, distance: 12, decay: 1, flicker: true },
    // 2 sparse wall torches
    { type: 'point', position: { x: -4.5, y: 2.5, z: -3.5 }, color: 0xFFCC66, intensity: 1.0, distance: 8, decay: 1.5, flicker: true },
    { type: 'point', position: { x: 4.5, y: 2.5, z: -3.5 }, color: 0xFFCC66, intensity: 1.0, distance: 8, decay: 1.5, flicker: true },
  ],

  doors: [
    // West door → Grand Gallery
    {
      position: { x: -5, y: 0, z: 0 },
      halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.GrandGallery,
      spawnPoint: { x: 13, y: 0, z: 0 },
      wall: 'west',
    },
  ],

  npcs: [
    // Guards — 1 at brazier, 2 at weapon racks
    { spriteColor: '#4A4A4A', position: { x: -1, y: 0, z: 0.5 }, label: 'Guard at Brazier' },
    { spriteColor: '#4A4A4A', position: { x: -3.5, y: 0, z: -2.5 }, label: 'Guard at Weapons' },
    { spriteColor: '#4A4A4A', position: { x: 3.5, y: 0, z: -2.5 }, label: 'Guard at Armor' },
  ],

  particles: [
    // Brazier embers — strong column of sparks
    { type: 'embers', position: { x: 0, y: 2, z: 0 }, count: 25 },
    // Wall torch embers
    { type: 'embers', position: { x: -4.5, y: 2.5, z: -3.5 }, count: 8 },
    { type: 'embers', position: { x: 4.5, y: 2.5, z: -3.5 }, count: 8 },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.4, luminanceThreshold: 0.90 },
    tiltShift: { focusArea: 0.30, feather: 0.25 },
    vignette: { darkness: 0.60 },
    colorGrading: { hue: -0.087, saturation: -0.1, brightness: -0.1, contrast: 0.15 },
  },
};

export default guardPost;

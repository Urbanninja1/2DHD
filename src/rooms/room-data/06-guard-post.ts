import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const guardPost: RoomData = {
  id: RoomId.GuardPost,
  name: 'Royal Guard Post',
  dimensions: { width: 10, depth: 8, height: 4 },
  mood: 'dark',

  floorColor: 0x3A3530,
  wallColor: 0x4A4540,
  ceilingColor: 0x1A1A1A,

  floorTexture: { basePath: 'assets/textures/stone/rough-stone' },
  wallTexture: { basePath: 'assets/textures/stone/worn-stone' },
  ceilingTexture: { basePath: 'assets/textures/ceiling/dark-stone' },

  ambientLight: { color: 0x2A2A3E, intensity: 0.55 },

  lights: [
    // Central brazier — strong warm glow
    { type: 'point', position: { x: 0, y: 2, z: 0 }, color: 0xFF6B35, intensity: 5.0, distance: 16, decay: 1, flicker: true },
    // 2 sparse wall torches
    { type: 'point', position: { x: -4.5, y: 2.5, z: -3.5 }, color: 0xFFCC66, intensity: 2.0, distance: 12, decay: 1.2, flicker: true },
    { type: 'point', position: { x: 4.5, y: 2.5, z: -3.5 }, color: 0xFFCC66, intensity: 2.0, distance: 12, decay: 1.2, flicker: true },
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
    { spriteColor: '#4A4A4A', position: { x: -1, y: 0, z: 0.5 }, label: 'Guard at Brazier', spritePath: 'assets/sprites/npcs/guard.png' },
    { spriteColor: '#4A4A4A', position: { x: -3.5, y: 0, z: -2.5 }, label: 'Guard at Weapons', spritePath: 'assets/sprites/npcs/guard.png' },
    { spriteColor: '#4A4A4A', position: { x: 3.5, y: 0, z: -2.5 }, label: 'Guard at Armor', spritePath: 'assets/sprites/npcs/guard.png' },
  ],

  particles: [
    // Brazier embers — strong column of sparks
    { type: 'embers', position: { x: 0, y: 2, z: 0 }, count: 25 },
    // Wall torch embers
    { type: 'embers', position: { x: -4.5, y: 2.5, z: -3.5 }, count: 8 },
    { type: 'embers', position: { x: 4.5, y: 2.5, z: -3.5 }, count: 8 },
  ],

  props: [
    // Central brazier
    {
      type: 'model',
      modelPath: 'assets/models/props/brazier.glb',
      positions: [{ x: 0, y: 0, z: 0 }],
      scale: 0.8,
    },
    // Weapon racks along north wall
    {
      type: 'model',
      modelPath: 'assets/models/props/weapon-rack.glb',
      positions: [
        { x: -3.5, y: 0, z: -3.5 },
        { x: -1.5, y: 0, z: -3.5 },
      ],
      scale: 0.7,
    },
    // Armor stands along east wall
    {
      type: 'model',
      modelPath: 'assets/models/props/armor-stand.glb',
      positions: [
        { x: 3.5, y: 0, z: -3.5 },
        { x: 3.5, y: 0, z: -1.5 },
      ],
      scale: 0.7,
    },
    // Table and bench for guards on break
    {
      type: 'model',
      modelPath: 'assets/models/props/table-small.glb',
      positions: [{ x: -2, y: 0, z: 2.5 }],
      scale: 0.5,
    },
    {
      type: 'model',
      modelPath: 'assets/models/props/bench.glb',
      positions: [
        { x: -3.5, y: 0, z: 2.5 },
        { x: -0.5, y: 0, z: 2.5 },
      ],
      scale: 0.5,
    },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.4, luminanceThreshold: 0.90 },
    tiltShift: { focusArea: 0.30, feather: 0.25 },
    vignette: { darkness: 0.40 },
    colorGrading: { hue: -0.087, saturation: -0.05, brightness: 0, contrast: 0.1 },
  },
};

export default guardPost;

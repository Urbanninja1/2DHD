import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const maegorsEntry: RoomData = {
  id: RoomId.MaegorsEntry,
  name: "Maegor's Holdfast Entry",
  dimensions: { width: 20, depth: 5, height: 6 },
  mood: 'dark',

  floorColor: 0x252525,
  wallColor: 0x3D3D5C,
  ceilingColor: 0x1A1A28,

  floorTexture: { basePath: 'assets/textures/stone/mossy-stone' },
  wallTexture: { basePath: 'assets/textures/stone/worn-stone' },
  ceilingTexture: { basePath: 'assets/textures/ceiling/dark-stone' },

  ambientLight: { color: 0x1A1A2E, intensity: 0.08 },

  lights: [
    // 3 sparse torches — deep shadows between them
    { type: 'point', position: { x: -7, y: 3.5, z: -2 }, color: 0xFFAA44, intensity: 1.5, distance: 10, decay: 1.2, flicker: true },
    { type: 'point', position: { x: 0, y: 3.5, z: -2 }, color: 0xFFAA44, intensity: 1.5, distance: 10, decay: 1.2, flicker: true },
    { type: 'point', position: { x: 7, y: 3.5, z: -2 }, color: 0xFFAA44, intensity: 1.5, distance: 10, decay: 1.2, flicker: true },
  ],

  doors: [
    // West door → Throne Room
    {
      position: { x: -10, y: 0, z: 0 },
      halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.ThroneRoom,
      spawnPoint: { x: 13, y: 0, z: 0 },
      wall: 'west',
    },
  ],

  npcs: [
    // Guards at passage ends
    { spriteColor: '#555555', position: { x: -8, y: 0, z: 1 }, label: 'Guard West', spritePath: 'assets/sprites/npcs/guard.png' },
    { spriteColor: '#555555', position: { x: 8, y: 0, z: 1 }, label: 'Guard East', spritePath: 'assets/sprites/npcs/guard.png' },
  ],

  particles: [
    // Torch embers
    { type: 'embers', position: { x: -7, y: 3.5, z: -2 }, count: 10 },
    { type: 'embers', position: { x: 0, y: 3.5, z: -2 }, count: 10 },
    { type: 'embers', position: { x: 7, y: 3.5, z: -2 }, count: 10 },
  ],

  props: [
    // Sconces at torch positions
    {
      type: 'model',
      modelPath: 'assets/models/props/sconce-iron.glb',
      positions: [
        { x: -7, y: 3.3, z: -2 },
        { x: 0, y: 3.3, z: -2 },
        { x: 7, y: 3.3, z: -2 },
      ],
      scale: 0.5,
    },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.3, luminanceThreshold: 0.90 },
    tiltShift: { focusArea: 0.25, feather: 0.20 },
    vignette: { darkness: 0.65 },
    colorGrading: { hue: -0.087, saturation: -0.1, brightness: -0.1, contrast: 0.15 },
  },
};

export default maegorsEntry;

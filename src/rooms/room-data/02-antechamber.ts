import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const antechamber: RoomData = {
  id: RoomId.Antechamber,
  name: 'Throne Room Antechamber',
  dimensions: { width: 15, depth: 12, height: 6 },
  mood: 'intimate',

  floorColor: 0x333030,
  wallColor: 0x504840,
  ceilingColor: 0x2a2a2a,

  floorTexture: { basePath: 'assets/textures/stone/rough-stone' },
  wallTexture: { basePath: 'assets/textures/stone/stone-wall' },
  ceilingTexture: { basePath: 'assets/textures/ceiling/dark-stone' },

  ambientLight: { color: 0x443322, intensity: 0.2 },

  lights: [
    // 4 wall-mounted torches
    { type: 'point', position: { x: -6, y: 3.5, z: -5.5 }, color: 0xFFCC66, intensity: 1.8, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: 6, y: 3.5, z: -5.5 }, color: 0xFFCC66, intensity: 1.8, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: -6, y: 3.5, z: 5.5 }, color: 0xFFCC66, intensity: 1.8, distance: 12, decay: 1, flicker: true },
    { type: 'point', position: { x: 6, y: 3.5, z: 5.5 }, color: 0xFFCC66, intensity: 1.8, distance: 12, decay: 1, flicker: true },
  ],

  doors: [
    // North door → Throne Room
    {
      position: { x: 0, y: 0, z: -6 },
      halfExtents: { x: 1.5, z: 0.8 },
      targetRoomId: RoomId.ThroneRoom,
      spawnPoint: { x: 0, y: 0, z: 7.5 },
      wall: 'north',
    },
    // South door → Queen's Ballroom
    {
      position: { x: 0, y: 0, z: 6 },
      halfExtents: { x: 1.5, z: 0.8 },
      targetRoomId: RoomId.QueensBallroom,
      spawnPoint: { x: 0, y: 0, z: -8 },
      wall: 'south',
    },
  ],

  npcs: [
    // Guards flanking the north door
    { spriteColor: '#667788', position: { x: -2.5, y: 0, z: -4 }, label: 'Guard Left', spritePath: 'assets/sprites/npcs/guard.png' },
    { spriteColor: '#667788', position: { x: 2.5, y: 0, z: -4 }, label: 'Guard Right', spritePath: 'assets/sprites/npcs/guard.png' },
  ],

  particles: [
    // Torch embers — one emitter per flickering torch
    { type: 'embers', position: { x: -6, y: 3.5, z: -5.5 }, count: 10 },
    { type: 'embers', position: { x: 6, y: 3.5, z: -5.5 }, count: 10 },
    { type: 'embers', position: { x: -6, y: 3.5, z: 5.5 }, count: 10 },
    { type: 'embers', position: { x: 6, y: 3.5, z: 5.5 }, count: 10 },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.5, luminanceThreshold: 0.85 },
    tiltShift: { focusArea: 0.35, feather: 0.30 },
    vignette: { darkness: 0.45 },
    colorGrading: { hue: 0.175, saturation: 0.15, brightness: -0.05, contrast: 0.05 },
  },
};

export default antechamber;

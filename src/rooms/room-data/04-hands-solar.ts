import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const handsSolar: RoomData = {
  id: RoomId.HandsSolar,
  name: "Hand's Solar",
  dimensions: { width: 8, depth: 8, height: 5 },
  mood: 'intimate',

  floorColor: 0x4A3520,
  wallColor: 0x5C3317,
  ceilingColor: 0x2A1A0E,

  ambientLight: { color: 0x443322, intensity: 0.2 },

  lights: [
    // Hearth — warm glow from west wall
    { type: 'point', position: { x: -3.5, y: 1.5, z: 0 }, color: 0xFF9944, intensity: 2.5, distance: 10, decay: 1, flicker: true },
    // Desk candles
    { type: 'point', position: { x: 1, y: 2.5, z: -1 }, color: 0xFFCC66, intensity: 1.0, distance: 6, decay: 1.5, flicker: true },
    { type: 'point', position: { x: 1, y: 2.5, z: 1 }, color: 0xFFCC66, intensity: 1.0, distance: 6, decay: 1.5, flicker: true },
  ],

  doors: [
    // East door → Grand Gallery
    {
      position: { x: 4, y: 0, z: 0 },
      halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.GrandGallery,
      spawnPoint: { x: -14, y: 0, z: 0 },
      wall: 'east',
    },
  ],

  npcs: [
    // The Hand of the King seated at his desk
    { spriteColor: '#E8C87A', position: { x: 1.5, y: 0, z: 0 }, label: 'Hand of the King' },
  ],

  particles: [
    // Dust motes in window light shaft (east wall window)
    {
      type: 'dust',
      region: { minX: 0, maxX: 3.5, minY: 1, maxY: 4, minZ: -2, maxZ: 2 },
      count: 40,
    },
    // Hearth embers
    { type: 'embers', position: { x: -3.5, y: 1.5, z: 0 }, count: 15 },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.5, luminanceThreshold: 0.85 },
    tiltShift: { focusArea: 0.30, feather: 0.30 },
    vignette: { darkness: 0.50 },
  },
};

export default handsSolar;

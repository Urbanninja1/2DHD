import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const throneRoom: RoomData = {
  id: RoomId.ThroneRoom,
  name: 'Iron Throne Room',
  dimensions: { width: 30, depth: 18, height: 12 },
  mood: 'grand',

  floorColor: 0x3a3a3a,
  wallColor: 0x4a4540,
  ceilingColor: 0x2a2a2a,

  ambientLight: { color: 0x4466AA, intensity: 0.2 },

  lights: [
    // Directional (sun through stained glass windows)
    {
      type: 'directional',
      position: { x: 8, y: 12, z: -4 },
      color: 0xFFE8C0,
      intensity: 1.0,
      castShadow: true,
    },
    // Torches along east wall
    { type: 'point', position: { x: 14, y: 4, z: -7 }, color: 0xFFCC66, intensity: 2.0, distance: 15, decay: 1, flicker: true },
    { type: 'point', position: { x: 14, y: 4, z: 0 }, color: 0xFFCC66, intensity: 2.0, distance: 15, decay: 1, flicker: true },
    { type: 'point', position: { x: 14, y: 4, z: 7 }, color: 0xFFCC66, intensity: 2.0, distance: 15, decay: 1, flicker: true },
    // Torches along west wall
    { type: 'point', position: { x: -14, y: 4, z: -7 }, color: 0xFFCC66, intensity: 2.0, distance: 15, decay: 1, flicker: true },
    { type: 'point', position: { x: -14, y: 4, z: 0 }, color: 0xFFCC66, intensity: 2.0, distance: 15, decay: 1, flicker: true },
    { type: 'point', position: { x: -14, y: 4, z: 7 }, color: 0xFFCC66, intensity: 2.0, distance: 15, decay: 1, flicker: true },
    // Torch behind throne
    { type: 'point', position: { x: 0, y: 5, z: -8.5 }, color: 0xFFCC66, intensity: 2.5, distance: 18, decay: 1, flicker: true },
  ],

  doors: [
    // South door → Antechamber
    {
      position: { x: 0, y: 0, z: 9 },
      halfExtents: { x: 1.5, z: 0.8 },
      targetRoomId: RoomId.Antechamber,
      spawnPoint: { x: 0, y: 0, z: -5 },
      wall: 'south',
    },
  ],

  npcs: [
    // Kingsguard flanking throne
    { spriteColor: '#CCCCDD', position: { x: -3, y: 0, z: -6 }, label: 'Kingsguard Left' },
    { spriteColor: '#CCCCDD', position: { x: 3, y: 0, z: -6 }, label: 'Kingsguard Right' },
    // Courtiers
    { spriteColor: '#8B0000', position: { x: -8, y: 0, z: 2 }, label: 'Courtier 1' },
    { spriteColor: '#2F1B0E', position: { x: 6, y: 0, z: 4 }, label: 'Courtier 2' },
    { spriteColor: '#C9A84C', position: { x: -5, y: 0, z: -2 }, label: 'Noble' },
    { spriteColor: '#4A4A4A', position: { x: 10, y: 0, z: -3 }, label: 'Petitioner' },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.7, luminanceThreshold: 0.80 },
    tiltShift: { focusArea: 0.40, feather: 0.30 },
    vignette: { darkness: 0.40 },
  },
};

export default throneRoom;

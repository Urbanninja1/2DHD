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

  floorTexture: { basePath: 'assets/textures/stone/castle-wall-slates' },
  wallTexture: { basePath: 'assets/textures/stone/stone-wall' },
  ceilingTexture: { basePath: 'assets/textures/ceiling/dark-stone' },

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
    // North door → Grand Gallery
    {
      position: { x: 0, y: 0, z: -9 },
      halfExtents: { x: 1.5, z: 0.8 },
      targetRoomId: RoomId.GrandGallery,
      spawnPoint: { x: 0, y: 0, z: 2.5 },
      wall: 'north',
    },
    // West door → Small Council Chamber
    {
      position: { x: -15, y: 0, z: 0 },
      halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.SmallCouncil,
      spawnPoint: { x: 4, y: 0, z: 0 },
      wall: 'west',
    },
    // East door → Maegor's Holdfast Entry
    {
      position: { x: 15, y: 0, z: 0 },
      halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.MaegorsEntry,
      spawnPoint: { x: -9, y: 0, z: 0 },
      wall: 'east',
    },
  ],

  npcs: [
    // Kingsguard flanking throne
    { spriteColor: '#CCCCDD', position: { x: -3, y: 0, z: -6 }, label: 'Kingsguard Left', spritePath: 'assets/sprites/npcs/kingsguard.png' },
    { spriteColor: '#CCCCDD', position: { x: 3, y: 0, z: -6 }, label: 'Kingsguard Right', spritePath: 'assets/sprites/npcs/kingsguard.png' },
    // Courtiers
    { spriteColor: '#8B0000', position: { x: -8, y: 0, z: 2 }, label: 'Courtier 1', spritePath: 'assets/sprites/npcs/noble-male.png' },
    { spriteColor: '#2F1B0E', position: { x: 6, y: 0, z: 4 }, label: 'Courtier 2', spritePath: 'assets/sprites/npcs/noble-female.png' },
    { spriteColor: '#C9A84C', position: { x: -5, y: 0, z: -2 }, label: 'Noble', spritePath: 'assets/sprites/npcs/noble-male.png' },
    { spriteColor: '#4A4A4A', position: { x: 10, y: 0, z: -3 }, label: 'Petitioner', spritePath: 'assets/sprites/npcs/servant.png' },
  ],

  particles: [
    // Dust motes floating in the directional light from stained glass windows
    {
      type: 'dust',
      region: { minX: -10, maxX: 10, minY: 1, maxY: 8, minZ: -7, maxZ: 5 },
      count: 80,
    },
    // Torch embers — one emitter per flickering torch
    { type: 'embers', position: { x: 14, y: 4, z: -7 }, count: 12 },
    { type: 'embers', position: { x: 14, y: 4, z: 0 }, count: 12 },
    { type: 'embers', position: { x: 14, y: 4, z: 7 }, count: 12 },
    { type: 'embers', position: { x: -14, y: 4, z: -7 }, count: 12 },
    { type: 'embers', position: { x: -14, y: 4, z: 0 }, count: 12 },
    { type: 'embers', position: { x: -14, y: 4, z: 7 }, count: 12 },
    { type: 'embers', position: { x: 0, y: 5, z: -8.5 }, count: 15 },
  ],

  props: [
    // 16 columns — 8 per side, flanking the central aisle
    {
      type: 'model',
      modelPath: 'assets/models/props/column-stone.glb',
      positions: [
        // East colonnade
        { x: 10, y: 0, z: -7 }, { x: 10, y: 0, z: -4 }, { x: 10, y: 0, z: -1 }, { x: 10, y: 0, z: 2 },
        { x: 10, y: 0, z: 5 }, { x: 10, y: 0, z: 8 },
        // West colonnade
        { x: -10, y: 0, z: -7 }, { x: -10, y: 0, z: -4 }, { x: -10, y: 0, z: -1 }, { x: -10, y: 0, z: 2 },
        { x: -10, y: 0, z: 5 }, { x: -10, y: 0, z: 8 },
        // Near-throne columns
        { x: -5, y: 0, z: -7 }, { x: 5, y: 0, z: -7 },
        { x: -5, y: 0, z: -4 }, { x: 5, y: 0, z: -4 },
      ],
      scale: 1.0,
    },
    // Sconces at each torch position
    {
      type: 'model',
      modelPath: 'assets/models/props/sconce-iron.glb',
      positions: [
        { x: 14, y: 3.8, z: -7 }, { x: 14, y: 3.8, z: 0 }, { x: 14, y: 3.8, z: 7 },
        { x: -14, y: 3.8, z: -7 }, { x: -14, y: 3.8, z: 0 }, { x: -14, y: 3.8, z: 7 },
        { x: 0, y: 4.8, z: -8.5 },
      ],
      scale: 0.5,
    },
    // Iron Throne
    {
      type: 'model',
      modelPath: 'assets/models/props/throne.glb',
      positions: [{ x: 0, y: 0, z: -7.5 }],
      scale: 1.5,
    },
    // Banners flanking the throne
    {
      type: 'model',
      modelPath: 'assets/models/props/banner.glb',
      positions: [
        { x: -3, y: 0, z: -8 },
        { x: 3, y: 0, z: -8 },
      ],
      scale: 1.2,
    },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.7, luminanceThreshold: 0.80 },
    tiltShift: { focusArea: 0.40, feather: 0.30 },
    vignette: { darkness: 0.40 },
    colorGrading: { hue: 0, saturation: 0.1, brightness: 0, contrast: 0.1 },
  },

  godRays: { color: 0xFFE8C0, density: 1 / 100, maxDensity: 0.6 },
};

export default throneRoom;

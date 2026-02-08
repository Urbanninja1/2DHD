import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const queensBallroom: RoomData = {
  id: RoomId.QueensBallroom,
  name: "Queen's Ballroom",
  dimensions: { width: 18, depth: 18, height: 8 },
  mood: 'grand',

  floorColor: 0x1A1018,
  wallColor: 0x504040,
  ceilingColor: 0x2A2028,

  floorTexture: { basePath: 'assets/textures/marble/polished-marble', tint: 0xF0F0FF },
  wallTexture: { basePath: 'assets/textures/plaster/plaster-wall' },
  ceilingTexture: { basePath: 'assets/textures/ceiling/painted-ceiling' },

  ambientLight: { color: 0x665566, intensity: 0.55 },

  lights: [
    // 2 hanging chandeliers — bright, warm, multi-point
    { type: 'point', position: { x: -4, y: 6, z: 0 }, color: 0xFFD700, intensity: 5.0, distance: 22, decay: 1, flicker: true },
    { type: 'point', position: { x: 4, y: 6, z: 0 }, color: 0xFFD700, intensity: 5.0, distance: 22, decay: 1, flicker: true },
    // 6 ornate wall sconces
    { type: 'point', position: { x: -8.5, y: 3.5, z: -6 }, color: 0xFFCC66, intensity: 2.5, distance: 15, decay: 1, flicker: true },
    { type: 'point', position: { x: -8.5, y: 3.5, z: 6 }, color: 0xFFCC66, intensity: 2.5, distance: 15, decay: 1, flicker: true },
    { type: 'point', position: { x: 8.5, y: 3.5, z: -6 }, color: 0xFFCC66, intensity: 2.5, distance: 15, decay: 1, flicker: true },
    { type: 'point', position: { x: 8.5, y: 3.5, z: 6 }, color: 0xFFCC66, intensity: 2.5, distance: 15, decay: 1, flicker: true },
    { type: 'point', position: { x: 0, y: 3.5, z: -8.5 }, color: 0xFFCC66, intensity: 2.5, distance: 15, decay: 1, flicker: true },
    { type: 'point', position: { x: 0, y: 3.5, z: 8.5 }, color: 0xFFCC66, intensity: 2.5, distance: 15, decay: 1, flicker: true },
  ],

  doors: [
    // North door → Antechamber
    {
      position: { x: 0, y: 0, z: -9 },
      halfExtents: { x: 1.5, z: 0.8 },
      targetRoomId: RoomId.Antechamber,
      spawnPoint: { x: 0, y: 0, z: 5 },
      wall: 'north',
    },
  ],

  npcs: [
    // 4 nobles scattered
    { spriteColor: '#800020', position: { x: -5, y: 0, z: -3 }, label: 'Noble Lady 1', spritePath: 'assets/sprites/npcs/noble-female.png' },
    { spriteColor: '#FFD700', position: { x: 3, y: 0, z: -4 }, label: 'Noble Lord 1', spritePath: 'assets/sprites/npcs/noble-male.png' },
    { spriteColor: '#800020', position: { x: -3, y: 0, z: 3 }, label: 'Noble Lady 2', spritePath: 'assets/sprites/npcs/noble-female.png' },
    { spriteColor: '#FFD700', position: { x: 6, y: 0, z: 2 }, label: 'Noble Lord 2', spritePath: 'assets/sprites/npcs/noble-male.png' },
    // 2 musicians on south gallery
    { spriteColor: '#4A3520', position: { x: -3, y: 0, z: 7 }, label: 'Musician 1', spritePath: 'assets/sprites/npcs/musician.png' },
    { spriteColor: '#4A3520', position: { x: 3, y: 0, z: 7 }, label: 'Musician 2', spritePath: 'assets/sprites/npcs/musician.png' },
  ],

  particles: [
    // Dust motes in chandelier light
    {
      type: 'dust',
      region: { minX: -7, maxX: 7, minY: 2, maxY: 7, minZ: -7, maxZ: 7 },
      count: 60,
    },
    // Chandelier embers (subtle candle sparks)
    { type: 'embers', position: { x: -4, y: 6, z: 0 }, count: 12 },
    { type: 'embers', position: { x: 4, y: 6, z: 0 }, count: 12 },
    // Wall sconce embers
    { type: 'embers', position: { x: -8.5, y: 3.5, z: -6 }, count: 6 },
    { type: 'embers', position: { x: -8.5, y: 3.5, z: 6 }, count: 6 },
    { type: 'embers', position: { x: 8.5, y: 3.5, z: -6 }, count: 6 },
    { type: 'embers', position: { x: 8.5, y: 3.5, z: 6 }, count: 6 },
  ],

  props: [
    // 8 columns around the perimeter defining the dance floor
    {
      type: 'model',
      modelPath: 'assets/models/props/column-stone.glb',
      positions: [
        { x: -6, y: 0, z: -6 }, { x: 6, y: 0, z: -6 },
        { x: -6, y: 0, z: 6 }, { x: 6, y: 0, z: 6 },
        { x: -6, y: 0, z: 0 }, { x: 6, y: 0, z: 0 },
        { x: 0, y: 0, z: -6 }, { x: 0, y: 0, z: 6 },
      ],
      scale: 1.0,
    },
    // Sconces at wall sconce positions
    {
      type: 'model',
      modelPath: 'assets/models/props/sconce-iron.glb',
      positions: [
        { x: -8.5, y: 3.3, z: -6 }, { x: -8.5, y: 3.3, z: 6 },
        { x: 8.5, y: 3.3, z: -6 }, { x: 8.5, y: 3.3, z: 6 },
        { x: 0, y: 3.3, z: -8.5 }, { x: 0, y: 3.3, z: 8.5 },
      ],
      scale: 0.5,
    },
    // Chandeliers
    {
      type: 'model',
      modelPath: 'assets/models/props/chandelier.glb',
      positions: [
        { x: -4, y: 6, z: 0 },
        { x: 4, y: 6, z: 0 },
      ],
      scale: 0.8,
    },
    // Benches along the walls
    {
      type: 'model',
      modelPath: 'assets/models/props/bench.glb',
      positions: [
        { x: -7.5, y: 0, z: -3 },
        { x: -7.5, y: 0, z: 3 },
        { x: 7.5, y: 0, z: -3 },
        { x: 7.5, y: 0, z: 3 },
      ],
      scale: 0.6,
    },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.8, luminanceThreshold: 0.78 },
    tiltShift: { focusArea: 0.40, feather: 0.30 },
    vignette: { darkness: 0.40 },
    colorGrading: { hue: 0, saturation: 0.1, brightness: 0, contrast: 0.1 },
  },
};

export default queensBallroom;

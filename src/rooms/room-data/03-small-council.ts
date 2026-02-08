import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';

const smallCouncil: RoomData = {
  id: RoomId.SmallCouncil,
  name: 'Small Council Chamber',
  dimensions: { width: 10, depth: 8, height: 5 },
  mood: 'intimate',

  floorColor: 0x2F1B0E,
  wallColor: 0x3A2A1A,
  ceilingColor: 0x1A1008,

  floorTexture: { basePath: 'assets/textures/wood/ornate-wood-panel' },
  wallTexture: { basePath: 'assets/textures/stone/stone-wall' },
  ceilingTexture: { basePath: 'assets/textures/ceiling/dark-stone' },

  ambientLight: { color: 0x554433, intensity: 0.45 },

  lights: [
    // 6 candle-style point lights around the council table
    { type: 'point', position: { x: -1.5, y: 2.5, z: -1 }, color: 0xFFCC66, intensity: 2.5, distance: 12, decay: 1.2, flicker: true },
    { type: 'point', position: { x: 1.5, y: 2.5, z: -1 }, color: 0xFFCC66, intensity: 2.5, distance: 12, decay: 1.2, flicker: true },
    { type: 'point', position: { x: -1.5, y: 2.5, z: 1 }, color: 0xFFCC66, intensity: 2.5, distance: 12, decay: 1.2, flicker: true },
    { type: 'point', position: { x: 1.5, y: 2.5, z: 1 }, color: 0xFFCC66, intensity: 2.5, distance: 12, decay: 1.2, flicker: true },
    // Wall sconces
    { type: 'point', position: { x: -4.5, y: 3, z: 0 }, color: 0xFFBB44, intensity: 1.8, distance: 10, decay: 1.2, flicker: true },
    { type: 'point', position: { x: 4.5, y: 3, z: 0 }, color: 0xFFBB44, intensity: 1.8, distance: 10, decay: 1.2, flicker: true },
  ],

  doors: [
    // East door → Throne Room
    {
      position: { x: 5, y: 0, z: 0 },
      halfExtents: { x: 0.8, z: 1.5 },
      targetRoomId: RoomId.ThroneRoom,
      spawnPoint: { x: -13, y: 0, z: 0 },
      wall: 'east',
    },
  ],

  npcs: [
    // Council members seated around the table
    { spriteColor: '#8B4513', position: { x: -2, y: 0, z: -1.5 }, label: 'Master of Coin', spritePath: 'assets/sprites/npcs/council-member.png' },
    { spriteColor: '#2F4F4F', position: { x: 2, y: 0, z: -1.5 }, label: 'Master of Whispers', spritePath: 'assets/sprites/npcs/council-member.png' },
    { spriteColor: '#4A0E0E', position: { x: 0, y: 0, z: 1.5 }, label: 'Master of Laws', spritePath: 'assets/sprites/npcs/council-member.png' },
  ],

  particles: [
    // Subtle dust in candlelight
    {
      type: 'dust',
      region: { minX: -3, maxX: 3, minY: 1, maxY: 4, minZ: -2, maxZ: 2 },
      count: 30,
    },
    // Candle embers (very subtle)
    { type: 'embers', position: { x: -1.5, y: 2.5, z: -1 }, count: 5 },
    { type: 'embers', position: { x: 1.5, y: 2.5, z: -1 }, count: 5 },
    { type: 'embers', position: { x: -1.5, y: 2.5, z: 1 }, count: 5 },
    { type: 'embers', position: { x: 1.5, y: 2.5, z: 1 }, count: 5 },
  ],

  props: [
    // Council table
    {
      type: 'model',
      modelPath: 'assets/models/props/table-long.glb',
      positions: [{ x: 0, y: 0, z: 0 }],
      scale: 0.8,
    },
    // Chairs around the table
    {
      type: 'model',
      modelPath: 'assets/models/props/chair-high.glb',
      positions: [
        { x: -2, y: 0, z: -1.5 },
        { x: 2, y: 0, z: -1.5 },
        { x: 0, y: 0, z: 1.5 },
        { x: -2, y: 0, z: 1.5 },
        { x: 2, y: 0, z: 1.5 },
      ],
      scale: 0.6,
    },
    // Bookshelf against the west wall
    {
      type: 'model',
      modelPath: 'assets/models/props/bookshelf.glb',
      positions: [{ x: -4.2, y: 0, z: 0 }],
      scale: 0.7,
    },
    // Wall sconces
    {
      type: 'model',
      modelPath: 'assets/models/props/sconce-iron.glb',
      positions: [
        { x: -4.5, y: 2.8, z: 0 },
        { x: 4.5, y: 2.8, z: 0 },
      ],
      scale: 0.4,
    },
  ],

  postProcessOverrides: {
    bloom: { intensity: 0.6, luminanceThreshold: 0.80 },
    tiltShift: { focusArea: 0.25, feather: 0.25 },
    vignette: { darkness: 0.55 },
    colorGrading: { hue: 0.175, saturation: 0.15, brightness: -0.05, contrast: 0.05 },
  },
};

export default smallCouncil;

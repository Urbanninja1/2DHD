import type { HD2DSettings } from '../../rendering/hd2d-pipeline.js';
import type { RoomIdValue } from '../../ecs/components/singletons.js';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DoorDef {
  /** Door trigger AABB center position in room-local coordinates */
  position: Vec3;
  /** Door trigger AABB half-extents */
  halfExtents: { x: number; z: number };
  /** Target room to transition to */
  targetRoomId: RoomIdValue;
  /** Player spawn position in target room after transition */
  spawnPoint: Vec3;
  /** Which wall the door is on (for visual placement) */
  wall: 'north' | 'south' | 'east' | 'west';
}

export interface LightDef {
  type: 'point' | 'directional' | 'ambient';
  position: Vec3;
  color: number;
  intensity: number;
  /** Only point lights can flicker (creates FlickerLight ECS entity) */
  flicker?: boolean;
  /** Only directional lights should cast shadows */
  castShadow?: boolean;
  /** Point light range/distance */
  distance?: number;
  /** Point light decay */
  decay?: number;
}

export interface NPCDef {
  /** Color for placeholder sprite (will be replaced with real sprite paths later) */
  spriteColor: string;
  position: Vec3;
  /** Label for debugging */
  label: string;
}

export interface DustParticleDef {
  type: 'dust';
  /** Region bounds where dust spawns (room-local coords) */
  region: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  /** Number of dust motes */
  count: number;
}

export interface EmberParticleDef {
  type: 'embers';
  /** Position of the torch emitting embers */
  position: Vec3;
  /** Number of ember particles */
  count: number;
}

export type ParticleDef = DustParticleDef | EmberParticleDef;

export interface GodRaysDef {
  /** Color tint of the god rays */
  color?: number;
  /** Density multiplier (default 1/128) */
  density?: number;
  /** Max brightness cap (default 0.5) */
  maxDensity?: number;
}

export interface RoomData {
  id: RoomIdValue;
  name: string;
  dimensions: { width: number; depth: number; height: number };
  mood: 'grand' | 'intimate' | 'dark' | 'open';
  doors: DoorDef[];
  lights: LightDef[];
  npcs: NPCDef[];
  /** Ambient light settings */
  ambientLight: { color: number; intensity: number };
  /** Per-room post-processing overrides */
  postProcessOverrides?: Partial<HD2DSettings>;
  /** Floor color tint (used with placeholder textures) */
  floorColor?: number;
  /** Wall color tint (used with placeholder textures) */
  wallColor?: number;
  /** Ceiling color */
  ceilingColor?: number;
  /** Particle system definitions */
  particles?: ParticleDef[];
  /** God rays configuration — enabled for rooms with windows/directional light */
  godRays?: GodRaysDef;
}

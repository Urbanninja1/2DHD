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
  /** Color for placeholder sprite (used when spritePath is not set) */
  spriteColor: string;
  position: Vec3;
  /** Label for debugging */
  label: string;
  /** Path to sprite image — takes priority over spriteColor when present */
  spritePath?: string;
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

// --- Texture Set Definition ---

export interface TextureSetDef {
  /** Base path to the texture directory (e.g. 'assets/textures/stone/castle-wall-slates') */
  basePath: string;
  /** Optional color tint applied to the PBR material */
  tint?: number;
  /** Texture repeat — defaults to auto-calculated from room dimensions */
  repeat?: { x: number; y: number };
}

// --- Prop Definitions ---

/** Procedural prop — uses built-in geometry (columns, sconces) */
export interface ProceduralPropDef {
  type: 'column' | 'sconce';
  positions: Vec3[];
}

/** Model-based prop — loads a GLTF/GLB file */
export interface ModelPropDef {
  type: 'model';
  /** Path to the .glb model file (relative to public/) */
  modelPath: string;
  /** Positions for each instance of this prop */
  positions: Vec3[];
  /** Uniform scale factor (default 1.0) */
  scale?: number;
  /** Y-axis rotation in radians (default 0) */
  rotationY?: number;
}

export type PropDef = ProceduralPropDef | ModelPropDef;

// --- Parallax Background ---

export interface ParallaxLayerDef {
  /** Path to the layer image (relative to public/) */
  texturePath: string;
  /** Z depth behind the room (higher = further away) */
  depth: number;
  /** Scroll speed multiplier relative to camera movement (0 = static, 1 = full speed) */
  scrollFactor: number;
  /** Display height of this layer in world units */
  height: number;
  /** Y offset for layer positioning */
  yOffset: number;
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
  /** Floor color tint (used with placeholder textures, also tints PBR materials) */
  floorColor?: number;
  /** Wall color tint (used with placeholder textures, also tints PBR materials) */
  wallColor?: number;
  /** Ceiling color */
  ceilingColor?: number;
  /** Particle system definitions */
  particles?: ParticleDef[];
  /** God rays configuration — enabled for rooms with windows/directional light */
  godRays?: GodRaysDef;
  /** Instanced prop definitions (columns, sconces, models) */
  props?: PropDef[];
  /** PBR floor texture set — falls back to procedural if not set */
  floorTexture?: TextureSetDef;
  /** PBR wall texture set — falls back to procedural if not set */
  wallTexture?: TextureSetDef;
  /** PBR ceiling texture set — falls back to procedural if not set */
  ceilingTexture?: TextureSetDef;
  /** Parallax background layers — rendered behind the north wall */
  parallaxBackground?: ParallaxLayerDef[];
}

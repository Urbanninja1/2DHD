/**
 * Template-driven decal placement algorithm.
 * Scatters decals across room surfaces using seeded PRNG,
 * weighted random palette selection, and zone rule modifiers.
 */
import type { DecalPaletteEntry, ZoneRule } from './texture-template.js';

export type SurfaceType = 'floor' | 'wall-n' | 'wall-s' | 'wall-e' | 'wall-w' | 'ceiling';

export interface DecalInstance {
  position: { x: number; y: number; z: number };
  rotation: number;       // Y-axis rotation in radians (floor/ceiling) or surface-aligned
  scale: number;          // World-unit size
  atlasRegion: AtlasRegion;
  surfaceType: SurfaceType;
}

export interface AtlasRegion {
  u: number; v: number;   // UV offset
  w: number; h: number;   // UV scale
}

export interface PlacerConfig {
  roomDimensions: { width: number; depth: number; height: number };
  palette: {
    floor: DecalPaletteEntry[];
    wall: DecalPaletteEntry[];
    ceiling: DecalPaletteEntry[];
  };
  density: { floor: number; wall: number; ceiling: number };
  zones: { rule: ZoneRule; position: { x: number; y: number; z: number } }[];
  gridSize: number;  // Atlas grid dimension (8 = 8x8)
  seed?: number;
}

/** Max total decals per room to bound computation */
const MAX_DECALS = 2000;

/**
 * Generate decal instances for all room surfaces.
 * Uses seeded PRNG for deterministic placement.
 */
export function placeDecals(config: PlacerConfig): DecalInstance[] {
  const { roomDimensions, palette, density, zones, gridSize, seed = 42 } = config;
  const rng = createSeededRNG(seed);
  const instances: DecalInstance[] = [];

  const { width, depth, height } = roomDimensions;
  const halfW = width / 2;
  const halfD = depth / 2;

  // --- Floor decals ---
  const floorArea = width * depth;
  const floorCount = Math.min(Math.round(floorArea * density.floor), MAX_DECALS * 0.6);

  for (let i = 0; i < floorCount && instances.length < MAX_DECALS; i++) {
    const x = (rng() - 0.5) * width;
    const z = (rng() - 0.5) * depth;
    const pos = { x, y: 0.005, z };  // 5mm above floor

    const entry = pickWeightedEntry(palette.floor, rng, zones, pos);
    if (!entry) continue;

    instances.push({
      position: pos,
      rotation: rng() * Math.PI * 2,
      scale: entry.scaleRange[0] + rng() * (entry.scaleRange[1] - entry.scaleRange[0]),
      atlasRegion: tileToRegion(entry.tile, gridSize),
      surfaceType: 'floor',
    });
  }

  // --- Wall decals ---
  const wallSurfaces: { type: SurfaceType; wallW: number; pos: (u: number, v: number) => { x: number; y: number; z: number } }[] = [
    { type: 'wall-n', wallW: width, pos: (u, v) => ({ x: (u - 0.5) * width, y: v * height, z: -halfD + 0.005 }) },
    { type: 'wall-s', wallW: width, pos: (u, v) => ({ x: (u - 0.5) * width, y: v * height, z: halfD - 0.005 }) },
    { type: 'wall-w', wallW: depth, pos: (u, v) => ({ x: -halfW + 0.005, y: v * height, z: (u - 0.5) * depth }) },
    { type: 'wall-e', wallW: depth, pos: (u, v) => ({ x: halfW - 0.005, y: v * height, z: (u - 0.5) * depth }) },
  ];

  for (const wall of wallSurfaces) {
    const wallArea = wall.wallW * height;
    const wallCount = Math.min(Math.round(wallArea * density.wall / 4), MAX_DECALS * 0.1);

    for (let i = 0; i < wallCount && instances.length < MAX_DECALS; i++) {
      const u = rng();
      const v = 0.05 + rng() * 0.9;  // Avoid exact top/bottom
      const pos = wall.pos(u, v);

      const entry = pickWeightedEntry(palette.wall, rng, zones, pos);
      if (!entry) continue;

      instances.push({
        position: pos,
        rotation: (rng() - 0.5) * 0.3,  // Slight random tilt for walls
        scale: entry.scaleRange[0] + rng() * (entry.scaleRange[1] - entry.scaleRange[0]),
        atlasRegion: tileToRegion(entry.tile, gridSize),
        surfaceType: wall.type,
      });
    }
  }

  // --- Ceiling decals ---
  const ceilingArea = width * depth;
  const ceilingCount = Math.min(Math.round(ceilingArea * density.ceiling), MAX_DECALS * 0.15);

  for (let i = 0; i < ceilingCount && instances.length < MAX_DECALS; i++) {
    const x = (rng() - 0.5) * width;
    const z = (rng() - 0.5) * depth;
    const pos = { x, y: height - 0.005, z };  // 5mm below ceiling

    const entry = pickWeightedEntry(palette.ceiling, rng, zones, pos);
    if (!entry) continue;

    instances.push({
      position: pos,
      rotation: rng() * Math.PI * 2,
      scale: entry.scaleRange[0] + rng() * (entry.scaleRange[1] - entry.scaleRange[0]),
      atlasRegion: tileToRegion(entry.tile, gridSize),
      surfaceType: 'ceiling',
    });
  }

  return instances;
}

// --- Helpers ---

/** Convert atlas grid [col, row] to UV region, accounting for 2px gutter */
function tileToRegion(tile: [number, number], gridSize: number): AtlasRegion {
  const cellSize = 1.0 / gridSize;
  // 2px gutter on a 2048 atlas = ~0.001 in UV space
  const gutterUV = 2.0 / (gridSize * 256);

  return {
    u: tile[0] * cellSize + gutterUV,
    v: tile[1] * cellSize + gutterUV,
    w: cellSize - gutterUV * 2,
    h: cellSize - gutterUV * 2,
  };
}

/**
 * Pick a palette entry using weighted random selection.
 * Zone rules boost/exclude certain decal types based on proximity.
 */
function pickWeightedEntry(
  palette: DecalPaletteEntry[],
  rng: () => number,
  zones: { rule: ZoneRule; position: { x: number; y: number; z: number } }[],
  pos: { x: number; y: number; z: number },
): DecalPaletteEntry | null {
  if (palette.length === 0) return null;

  // Build effective weights with zone modifications
  const weights = palette.map(e => e.weight);
  const excluded = new Set<string>();

  for (const zone of zones) {
    const dx = pos.x - zone.position.x;
    const dz = pos.z - zone.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > zone.rule.radius) continue;

    // Apply exclusions
    if (zone.rule.effects.excludeDecals) {
      for (const name of zone.rule.effects.excludeDecals) {
        excluded.add(name);
      }
    }

    // Apply boosts
    if (zone.rule.effects.decalBoost) {
      for (let i = 0; i < palette.length; i++) {
        const name = palette[i]!.name;
        if (name && zone.rule.effects.decalBoost[name]) {
          weights[i] = weights[i]! * zone.rule.effects.decalBoost[name]!;
        }
      }
    }
  }

  // Zero out excluded entries
  for (let i = 0; i < palette.length; i++) {
    if (palette[i]!.name && excluded.has(palette[i]!.name!)) {
      weights[i] = 0;
    }
  }

  // Weighted random selection
  let totalWeight = 0;
  for (let i = 0; i < weights.length; i++) totalWeight += weights[i]!;
  if (totalWeight === 0) return palette[0]!;  // Fallback if all excluded

  let r = rng() * totalWeight;
  for (let i = 0; i < palette.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return palette[i]!;
  }

  return palette[palette.length - 1]!;
}

/** Simple seeded PRNG (mulberry32) for deterministic placement */
function createSeededRNG(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

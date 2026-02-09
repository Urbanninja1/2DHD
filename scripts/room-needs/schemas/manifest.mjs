import { z } from 'zod';

// --- Placement Rules ---

export const PlacementRuleSchema = z.object({
  strategy: z.enum(['at-anchor', 'along-surface', 'on-surface', 'scattered', 'array']),
  anchor: z.string(),
  positions: z.array(z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    rotationY: z.number().optional(),
  })).optional(),
  offset: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }).optional(),
  count: z.number().int().positive().optional(),
  spacing: z.number().positive().optional(),
  density: z.number().positive().optional(),
  rotationY: z.union([
    z.number(),
    z.enum(['face-center', 'face-anchor', 'random']),
  ]).optional(),
  excludeDoors: z.boolean().optional(),
  yPlacement: z.union([
    z.enum(['floor', 'table-height', 'wall-mount', 'ceiling']),
    z.number(),
  ]).optional(),
});

// --- Compound Expansion (prop + light + particles) ---

export const CompoundExpansionSchema = z.object({
  light: z.object({
    color: z.number().int(),
    intensity: z.number().positive(),
    distance: z.number().positive(),
    flicker: z.boolean(),
  }).optional(),
  particles: z.object({
    type: z.enum(['embers', 'smoke']),
    count: z.number().int().positive(),
  }).optional(),
});

// --- Furnishing Item ---

export const FurnishingItemSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Must be kebab-case'),
  isNew: z.boolean(),
  description: z.string(),
  category: z.string(),
  material: z.string(),
  /** PBR material category — overrides auto-detection from prop name (required for isNew props) */
  materialCategory: z.enum(['stone', 'ironwood', 'dark-wood', 'iron', 'fabric', 'leather', 'organic', 'micro']).optional(),
  scale: z.number().positive().default(1.0),
  compound: CompoundExpansionSchema.optional(),
  placement: PlacementRuleSchema,
});

// --- Feature Anchor ---

export const FeatureAnchorSchema = z.object({
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  extent: z.object({
    xRange: z.tuple([z.number(), z.number()]).optional(),
    zRange: z.tuple([z.number(), z.number()]).optional(),
  }).optional(),
  exclusionRadius: z.number().positive().optional(),
});

// --- Atmosphere ---

export const AtmosphereLightSchema = z.object({
  type: z.enum(['point', 'directional']),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  color: z.number().int(),
  intensity: z.number().positive(),
  distance: z.number().positive().optional(),
  decay: z.number().optional(),
  flicker: z.boolean().optional(),
  castShadow: z.boolean().optional(),
});

export const AtmosphereParticleSchema = z.object({
  type: z.enum(['dust', 'embers', 'smoke', 'dust-in-light']),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
  region: z.object({
    center: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    size: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  }).optional(),
  count: z.number().int().positive(),
});

export const AtmosphereConfigSchema = z.object({
  ambientLight: z.object({
    color: z.number().int(),
    intensity: z.number().min(0.45),
  }),
  lights: z.array(AtmosphereLightSchema).max(11),
  particles: z.array(AtmosphereParticleSchema),
  postProcess: z.object({
    bloom: z.object({
      intensity: z.number().min(0).max(2),
      luminanceThreshold: z.number().min(0).max(1),
    }).optional(),
    tiltShift: z.object({
      focusArea: z.number().min(0).max(1),
      feather: z.number().min(0).max(1),
    }).optional(),
    vignette: z.object({
      darkness: z.number().min(0).max(0.55),
    }).optional(),
    colorGrading: z.object({
      hue: z.number(),
      saturation: z.number(),
      brightness: z.number().min(0),
      contrast: z.number(),
    }).optional(),
    ssao: z.object({
      aoRadius: z.number().positive(),
      intensity: z.number().positive(),
      distanceFalloff: z.number().positive(),
    }).optional(),
  }).optional(),
  godRays: z.object({
    color: z.number().int(),
    density: z.number(),
    maxDensity: z.number(),
  }).optional(),
});

// --- Full Manifest ---

export const FurnishingManifestSchema = z.object({
  room: z.object({
    type: z.string(),
    culture: z.string(),
    wealth: z.enum(['poor', 'modest', 'wealthy', 'royal']),
    era: z.string(),
    lore: z.string(),
    mood: z.enum(['grand', 'intimate', 'dark', 'open']),
    textureTemplate: z.string().optional(),
  }),
  features: z.record(z.string(), FeatureAnchorSchema),
  layers: z.object({
    architecture: z.array(FurnishingItemSchema),
    essentialFurnishing: z.array(FurnishingItemSchema),
    functionalObjects: z.array(FurnishingItemSchema),
    lifeLayer: z.array(FurnishingItemSchema),
    atmosphere: AtmosphereConfigSchema,
  }),
});

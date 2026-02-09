import { z } from 'zod';

const DecalPaletteEntrySchema = z.object({
  tile: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  weight: z.number().positive(),
  scaleRange: z.tuple([z.number().positive(), z.number().positive()]),
  name: z.string().optional(),
});

const ZoneRuleSchema = z.object({
  trigger: z.enum(['fire-source', 'door', 'water-source', 'high-traffic']),
  radius: z.number().positive(),
  effects: z.object({
    decalBoost: z.record(z.number()).optional(),
    excludeDecals: z.array(z.string()).optional(),
    grungeBoost: z.number().optional(),
  }),
});

export const TextureTemplateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),

  shaderLayers: z.object({
    detailNormal: z.object({
      texture: z.string(),
      scale: z.number().positive().default(6.0),
      intensity: z.number().min(0).max(1).default(0.3),
    }),
    grunge: z.object({
      texture: z.string(),
      scale: z.number().positive().default(0.1),
      intensity: z.number().min(0).max(1).default(0.35),
      tint: z.tuple([z.number(), z.number(), z.number()]).optional(),
    }),
    tilingBreakup: z.object({
      enabled: z.boolean().default(true),
      appliesTo: z.array(z.enum(['floor', 'wall', 'ceiling'])).default(['floor', 'wall', 'ceiling']),
    }),
  }),

  decals: z.object({
    atlas: z.string(),
    normalAtlas: z.string().optional(),
    gridSize: z.number().int().positive().default(8),
    density: z.object({
      floor: z.number().min(0).default(2.5),
      wall: z.number().min(0).default(1.0),
      ceiling: z.number().min(0).default(0.5),
    }),
    palette: z.object({
      floor: z.array(DecalPaletteEntrySchema).default([]),
      wall: z.array(DecalPaletteEntrySchema).default([]),
      ceiling: z.array(DecalPaletteEntrySchema).default([]),
    }),
  }),

  zones: z.array(ZoneRuleSchema).default([]),
});

export { DecalPaletteEntrySchema, ZoneRuleSchema };

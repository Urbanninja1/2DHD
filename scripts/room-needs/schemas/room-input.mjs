import { z } from 'zod';

export const RoomInputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  dimensions: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
  }),
  culture: z.string(),
  wealth: z.enum(['poor', 'modest', 'wealthy', 'royal']),
  era: z.string(),
  lore: z.string(),
  purpose: z.string(),
  castle: z.string().default('ironrath'),
  /** Optional pre-existing features file path */
  featuresFile: z.string().optional(),
  /** Optional doors to define exclusion zones */
  doors: z.array(z.object({
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    halfExtents: z.object({ x: z.number(), z: z.number() }),
    wall: z.enum(['north', 'south', 'east', 'west']),
  })).optional(),
  /** Density tier controlling how many props to generate per sq meter */
  densityTier: z.enum(['sparse', 'moderate', 'dense', 'aaa-showcase']).default('moderate'),
  /** Optional surface textures */
  floorTexture: z.string().optional(),
  wallTexture: z.string().optional(),
  ceilingTexture: z.string().optional(),
});

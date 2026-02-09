/**
 * Texture template loader and types.
 * Templates are JSON configs that define shader parameters, decal palettes,
 * density targets, and zone rules for a culture/mood aesthetic.
 *
 * Loaded from /assets/templates/{templateId}.json at room build time.
 * Cached in a module-level Map — no ref-counting needed (shared data).
 */

export interface DecalPaletteEntry {
  tile: [number, number];     // Atlas grid position [col, row]
  weight: number;             // Relative spawn probability
  scaleRange: [number, number]; // Min/max world-unit size
  name?: string;              // For zone rule matching
}

export interface ZoneRule {
  trigger: 'fire-source' | 'door' | 'water-source' | 'high-traffic';
  radius: number;
  effects: {
    decalBoost?: Record<string, number>;
    excludeDecals?: string[];
    grungeBoost?: number;
  };
}

export interface TextureTemplate {
  id: string;
  name?: string;
  description?: string;

  shaderLayers: {
    detailNormal: {
      texture: string;
      scale: number;
      intensity: number;
    };
    grunge: {
      texture: string;
      scale: number;
      intensity: number;
      tint?: [number, number, number];
    };
    tilingBreakup: {
      enabled: boolean;
      appliesTo: ('floor' | 'wall' | 'ceiling')[];
    };
  };

  decals: {
    atlas: string;
    normalAtlas?: string;
    gridSize: number;         // Atlas grid dimension (default 8 = 8x8)
    density: {
      floor: number;
      wall: number;
      ceiling: number;
    };
    palette: {
      floor: DecalPaletteEntry[];
      wall: DecalPaletteEntry[];
      ceiling: DecalPaletteEntry[];
    };
  };

  zones: ZoneRule[];
}

/** Module-level cache — templates are small JSON (~2KB), no ref-counting needed */
const templateCache = new Map<string, TextureTemplate>();

/**
 * Load a texture template by ID.
 * Fetches from /assets/templates/{templateId}.json.
 * Returns null on failure (room renders without texture engine — graceful degradation).
 */
export async function loadTemplate(templateId: string): Promise<TextureTemplate | null> {
  const cached = templateCache.get(templateId);
  if (cached) return cached;

  try {
    const resp = await fetch(`/assets/templates/${templateId}.json`);
    if (!resp.ok) {
      if (import.meta.env.DEV) {
        console.warn(`[texture-template] Failed to load template "${templateId}": ${resp.status}`);
      }
      return null;
    }

    const data = await resp.json() as TextureTemplate;
    templateCache.set(templateId, data);
    return data;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`[texture-template] Error loading template "${templateId}":`, e);
    }
    return null;
  }
}

/** Clear template cache (used for HMR/testing) */
export function clearTemplateCache(): void {
  templateCache.clear();
}

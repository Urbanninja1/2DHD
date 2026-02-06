import * as THREE from 'three';

interface CacheEntry<T> {
  resource: T | null;
  loadPromise: Promise<T>;
  refCount: number;
}

/**
 * Reference-counted asset cache.
 * - Cache entry inserted BEFORE fetch starts (prevents double-load)
 * - Concurrent load() calls for same URL share the same Promise
 * - release() decrements refCount; dispose only when refCount === 0
 */
class AssetManager {
  private textures = new Map<string, CacheEntry<THREE.Texture>>();

  /**
   * Load a texture by key. If already loading/loaded, returns cached result.
   * For MVP, textures are created procedurally — this mainly serves as
   * a deduplication and lifecycle management layer.
   */
  loadTexture(key: string, factory: () => THREE.Texture): THREE.Texture {
    const existing = this.textures.get(key);
    if (existing) {
      existing.refCount++;
      return existing.resource!;
    }

    const texture = factory();
    const entry: CacheEntry<THREE.Texture> = {
      resource: texture,
      loadPromise: Promise.resolve(texture),
      refCount: 1,
    };
    this.textures.set(key, entry);
    return texture;
  }

  /**
   * Release a texture reference. Disposes when refCount reaches 0.
   */
  releaseTexture(key: string): void {
    const entry = this.textures.get(key);
    if (!entry) return;

    entry.refCount--;
    if (entry.refCount <= 0) {
      entry.resource?.dispose();
      this.textures.delete(key);
    }
  }

  /**
   * Force-dispose all cached resources.
   */
  dispose(): void {
    for (const entry of this.textures.values()) {
      entry.resource?.dispose();
    }
    this.textures.clear();
  }
}

/** Singleton asset manager instance */
export const assetManager = new AssetManager();

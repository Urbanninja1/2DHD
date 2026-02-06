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
  private models = new Map<string, CacheEntry<THREE.Group>>();

  /**
   * Load a texture synchronously by key (procedural factory).
   * If already loading/loaded, returns cached result.
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
   * Load a texture asynchronously by key.
   * Cache entry inserted BEFORE load starts to deduplicate concurrent requests.
   */
  async loadTextureAsync(key: string, loader: () => Promise<THREE.Texture>): Promise<THREE.Texture> {
    const existing = this.textures.get(key);
    if (existing) {
      existing.refCount++;
      if (existing.resource) return existing.resource;
      return existing.loadPromise;
    }

    // Insert placeholder entry immediately to prevent double-load
    const entry: CacheEntry<THREE.Texture> = {
      resource: null,
      loadPromise: null!,
      refCount: 1,
    };

    entry.loadPromise = loader().then((texture) => {
      entry.resource = texture;
      return texture;
    });

    this.textures.set(key, entry);
    return entry.loadPromise;
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
   * Load a GLTF model group asynchronously by key.
   * Cache entry inserted BEFORE load starts to deduplicate concurrent requests.
   */
  async loadModelAsync(key: string, loader: () => Promise<THREE.Group>): Promise<THREE.Group> {
    const existing = this.models.get(key);
    if (existing) {
      existing.refCount++;
      if (existing.resource) return existing.resource;
      return existing.loadPromise;
    }

    const entry: CacheEntry<THREE.Group> = {
      resource: null,
      loadPromise: null!,
      refCount: 1,
    };

    entry.loadPromise = loader().then((group) => {
      entry.resource = group;
      return group;
    });

    this.models.set(key, entry);
    return entry.loadPromise;
  }

  /**
   * Release a model reference. Disposes geometry/materials when refCount reaches 0.
   */
  releaseModel(key: string): void {
    const entry = this.models.get(key);
    if (!entry) return;

    entry.refCount--;
    if (entry.refCount <= 0) {
      if (entry.resource) {
        entry.resource.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            const mat = obj.material;
            if (Array.isArray(mat)) {
              for (const m of mat) m.dispose();
            } else if (mat) {
              mat.dispose();
            }
          }
        });
      }
      this.models.delete(key);
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

    for (const entry of this.models.values()) {
      if (entry.resource) {
        entry.resource.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            const mat = obj.material;
            if (Array.isArray(mat)) {
              for (const m of mat) m.dispose();
            } else if (mat) {
              mat.dispose();
            }
          }
        });
      }
    }
    this.models.clear();
  }
}

/** Singleton asset manager instance */
export const assetManager = new AssetManager();

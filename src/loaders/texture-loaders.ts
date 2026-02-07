import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Texture & model loader infrastructure.
 * Sets up KTX2 (Basis Universal compressed textures), DRACO (compressed mesh),
 * and GLTF loaders for when real assets replace procedural placeholders.
 *
 * Usage:
 *   const { gltfLoader, ktx2Loader } = createLoaders(renderer);
 *   const gltf = await gltfLoader.loadAsync('model.glb');
 *   const texture = await ktx2Loader.loadAsync('texture.ktx2');
 */

export interface LoaderSet {
  gltfLoader: GLTFLoader;
  ktx2Loader: KTX2Loader;
  dracoLoader: DRACOLoader;
  dispose(): void;
}

/** Max texture resolution — textures above this are warned about in DEV */
export const MAX_TEXTURE_SIZE = 2048;

/** Module-level TextureLoader instance — reused across all PBR loads */
export const textureLoader = new THREE.TextureLoader();

export function createLoaders(renderer: THREE.WebGLRenderer): LoaderSet {
  // DRACO decoder — self-hosted WASM (copied from node_modules/three)
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/lib/draco/gltf/');
  dracoLoader.preload();

  // KTX2 transcoder — self-hosted Basis Universal WASM (copied from node_modules/three)
  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath('/lib/basis/');
  ktx2Loader.detectSupport(renderer);

  // GLTF loader with DRACO + KTX2 support
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setKTX2Loader(ktx2Loader);

  return {
    gltfLoader,
    ktx2Loader,
    dracoLoader,
    dispose() {
      dracoLoader.dispose();
      ktx2Loader.dispose();
    },
  };
}

/**
 * Validate texture dimensions in development mode.
 * Warns if any texture exceeds MAX_TEXTURE_SIZE.
 */
export function validateTexture(texture: THREE.Texture, name: string): void {
  if (import.meta.env.DEV) {
    const img = texture.image as { width?: number; height?: number } | null;
    if (img && ((img.width ?? 0) > MAX_TEXTURE_SIZE || (img.height ?? 0) > MAX_TEXTURE_SIZE)) {
      console.warn(
        `[texture] "${name}" is ${img.width}x${img.height} — exceeds max ${MAX_TEXTURE_SIZE}. ` +
        `Consider downscaling or using KTX2 compression.`,
      );
    }
  }
}

export interface PBRTextureSet {
  diffuse: THREE.Texture;
  normal: THREE.Texture | null;
  roughness: THREE.Texture | null;
  ao: THREE.Texture | null;
}

/**
 * Load a PBR texture set (diffuse + normal + roughness) in parallel.
 * Applies correct colorSpace per map type. Validates sizes in DEV.
 *
 * @param basePath - Directory containing diffuse.jpg, normal.jpg, roughness.jpg
 * @param key - Cache key prefix for AssetManager
 */
export async function loadPBRTexture(basePath: string, key: string): Promise<PBRTextureSet> {
  const [diffuseOrNull, normal, roughness, ao] = await Promise.all([
    textureLoader.loadAsync(`${basePath}/diffuse.jpg`).catch(() => null),
    textureLoader.loadAsync(`${basePath}/normal.jpg`).catch(() => null),
    textureLoader.loadAsync(`${basePath}/roughness.jpg`).catch(() => null),
    textureLoader.loadAsync(`${basePath}/ao.jpg`).catch(() => null),
  ]);

  // Fall back to a 1x1 white texture if diffuse is missing
  let diffuse: THREE.Texture;
  if (diffuseOrNull) {
    diffuse = diffuseOrNull;
  } else {
    if (import.meta.env.DEV) {
      console.warn(`[texture] "${key}" diffuse not found at "${basePath}/diffuse.jpg" — using white fallback`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 4, 4);
    diffuse = new THREE.CanvasTexture(canvas);
  }

  // Diffuse uses sRGB
  diffuse.colorSpace = THREE.SRGBColorSpace;
  validateTexture(diffuse, `${key}/diffuse`);

  // Normal + roughness are linear data
  if (normal) {
    normal.colorSpace = THREE.NoColorSpace;
    validateTexture(normal, `${key}/normal`);
  }
  if (roughness) {
    roughness.colorSpace = THREE.NoColorSpace;
    validateTexture(roughness, `${key}/roughness`);
  }
  if (ao) {
    ao.colorSpace = THREE.NoColorSpace;
    validateTexture(ao, `${key}/ao`);
  }

  return { diffuse, normal, roughness, ao };
}

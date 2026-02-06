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

export function createLoaders(renderer: THREE.WebGLRenderer): LoaderSet {
  // DRACO decoder — uses WASM from CDN (Vite can self-host these later)
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  dracoLoader.preload();

  // KTX2 transcoder — Basis Universal texture decompression
  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/basis/');
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

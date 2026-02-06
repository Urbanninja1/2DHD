import type { Scene, PerspectiveCamera, WebGLRenderer } from 'three';
import type { EffectComposer } from 'postprocessing';

/**
 * Module singleton holding Three.js framework objects.
 * NOT an ECS component — systems import this directly.
 */
export const renderContext = {
  scene: null as Scene | null,
  camera: null as PerspectiveCamera | null,
  renderer: null as WebGLRenderer | null,
  composer: null as EffectComposer | null,
};

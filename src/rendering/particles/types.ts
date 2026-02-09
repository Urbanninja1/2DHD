import type * as THREE from 'three';

/**
 * Common interface for all particle systems.
 * Abstracts over both THREE.Points-based and InstancedBufferGeometry-based systems.
 */
export interface ParticleSystem {
  /** The Three.js object to add to the scene group */
  object3d: THREE.Object3D;
  update(dt: number): void;
  dispose(): void;
}

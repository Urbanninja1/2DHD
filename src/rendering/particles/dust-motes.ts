import * as THREE from 'three';

/**
 * Dust mote particle system — plain Three.js Points with ShaderMaterial.
 * Soft circle via gl_PointCoord distance check, additive blending, no depth write.
 * Gentle sine-wave drift for a floating, peaceful feel.
 */
import type { ParticleSystem } from './types.js';

export interface DustMoteSystem extends ParticleSystem {
  /** @deprecated Use object3d instead */
  points: THREE.Points;
  object3d: THREE.Points;
}

export interface DustConfig {
  count: number;
  region: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  /** Optional drift direction override (default: gentle sine wave, no net drift) */
  driftDirection?: { x: number; y: number; z: number };
}

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (80.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAG = /* glsl */`
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, d) * vAlpha;
    gl_FragColor = vec4(1.0, 0.95, 0.85, alpha);
  }
`;

export function createDustMotes(config: DustConfig): DustMoteSystem {
  const { count, region, driftDirection } = config;

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  // Per-particle animation seeds
  const seeds = new Float32Array(count * 4); // phase, freqX, freqY, freqZ

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = region.minX + Math.random() * (region.maxX - region.minX);
    positions[i3 + 1] = region.minY + Math.random() * (region.maxY - region.minY);
    positions[i3 + 2] = region.minZ + Math.random() * (region.maxZ - region.minZ);

    sizes[i] = 0.4 + Math.random() * 0.6; // 0.4-1.0 — tiny specks
    alphas[i] = 0.08 + Math.random() * 0.15; // very subtle

    const i4 = i * 4;
    seeds[i4] = Math.random() * Math.PI * 2;
    seeds[i4 + 1] = 0.2 + Math.random() * 0.3; // freqX
    seeds[i4 + 2] = 0.1 + Math.random() * 0.2; // freqY
    seeds[i4 + 3] = 0.15 + Math.random() * 0.25; // freqZ
  }

  // Keep a copy of initial positions for oscillation base
  const basePositions = new Float32Array(positions);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  let elapsed = 0;

  return {
    points,
    object3d: points,
    update(dt: number) {
      elapsed += dt;
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const pos = posAttr.array as Float32Array;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        const phase = seeds[i4]!;
        const fx = seeds[i4 + 1]!;
        const fy = seeds[i4 + 2]!;
        const fz = seeds[i4 + 3]!;

        // Gentle sine-wave drift around base position
        pos[i3] = basePositions[i3]! + Math.sin(elapsed * fx + phase) * 0.3;
        pos[i3 + 1] = basePositions[i3 + 1]! + Math.sin(elapsed * fy + phase * 1.3) * 0.15;
        pos[i3 + 2] = basePositions[i3 + 2]! + Math.sin(elapsed * fz + phase * 0.7) * 0.25;

        // Apply linear drift (e.g. falling ash) and wrap within region
        if (driftDirection) {
          basePositions[i3] = basePositions[i3]! + driftDirection.x * dt;
          basePositions[i3 + 1] = basePositions[i3 + 1]! + driftDirection.y * dt;
          basePositions[i3 + 2] = basePositions[i3 + 2]! + driftDirection.z * dt;
          // Wrap Y when below region min (falling ash respawns at top)
          if (basePositions[i3 + 1]! < region.minY) {
            basePositions[i3 + 1] = region.maxY;
            basePositions[i3] = region.minX + Math.random() * (region.maxX - region.minX);
            basePositions[i3 + 2] = region.minZ + Math.random() * (region.maxZ - region.minZ);
          }
        }
      }

      posAttr.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

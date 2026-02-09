import * as THREE from 'three';
import type { ParticleSystem } from './types.js';

/**
 * Smoke particle system — InstancedBufferGeometry + Mesh.
 * Cylindrical billboarding in vertex shader. Particles rise from source,
 * grow in scale, drift with turbulence, and fade out.
 * NormalBlending for soft, opaque-looking smoke puffs.
 */

interface SmokeConfig {
  position: { x: number; y: number; z: number };
  count: number;
  spread?: number;
}

const VERT = /* glsl */`
  attribute vec3 aCenter;
  attribute float aScale;
  attribute float aAlpha;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    vAlpha = aAlpha;
    vUv = uv;

    // Cylindrical billboard: face camera in XZ, keep Y axis upright
    vec4 worldCenter = modelMatrix * vec4(aCenter, 1.0);
    vec4 viewCenter = viewMatrix * worldCenter;

    // Offset in view space by scaled quad position (XY of base plane)
    vec2 offset = position.xy * aScale;
    viewCenter.xy += offset;

    gl_Position = projectionMatrix * viewCenter;
  }
`;

const FRAG = /* glsl */`
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    // Soft circle from UV center
    float d = length(vUv - vec2(0.5));
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.1, d);

    // Warm grey smoke color
    vec3 color = vec3(0.45, 0.4, 0.35);
    gl_FragColor = vec4(color, soft * vAlpha);
  }
`;

export function createSmoke(config: SmokeConfig): ParticleSystem {
  const { position: spawnPos, count, spread = 0.5 } = config;

  // Base quad geometry (1x1 plane)
  const baseGeo = new THREE.PlaneGeometry(1, 1);

  const instancedGeo = new THREE.InstancedBufferGeometry();
  instancedGeo.index = baseGeo.index;
  instancedGeo.setAttribute('position', baseGeo.getAttribute('position')!);
  instancedGeo.setAttribute('uv', baseGeo.getAttribute('uv')!);
  instancedGeo.instanceCount = count;

  // Per-instance attributes: center(3) + scale(1) + alpha(1)
  const centers = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const alphas = new Float32Array(count);

  // CPU-side state
  const velocities = new Float32Array(count * 3);
  const ages = new Float32Array(count);
  const maxLifetimes = new Float32Array(count);
  const phaseOffsets = new Float32Array(count);

  function respawn(i: number): void {
    const i3 = i * 3;
    centers[i3] = spawnPos.x + (Math.random() - 0.5) * spread;
    centers[i3 + 1] = spawnPos.y + Math.random() * 0.3;
    centers[i3 + 2] = spawnPos.z + (Math.random() - 0.5) * spread;

    velocities[i3] = (Math.random() - 0.5) * 0.1;
    velocities[i3 + 1] = 0.4 + Math.random() * 0.4; // rise speed
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;

    scales[i] = 0.5;
    alphas[i] = 0.0;
    ages[i] = 0;
    maxLifetimes[i] = 3.0 + Math.random() * 3.0; // 3-6 seconds
    phaseOffsets[i] = Math.random() * Math.PI * 2;
  }

  // Initialize staggered
  for (let i = 0; i < count; i++) {
    respawn(i);
    ages[i] = Math.random() * maxLifetimes[i]!;
  }

  const centerAttr = new THREE.InstancedBufferAttribute(centers, 3);
  centerAttr.setUsage(THREE.StreamDrawUsage);
  const scaleAttr = new THREE.InstancedBufferAttribute(scales, 1);
  scaleAttr.setUsage(THREE.StreamDrawUsage);
  const alphaAttr = new THREE.InstancedBufferAttribute(alphas, 1);
  alphaAttr.setUsage(THREE.StreamDrawUsage);

  instancedGeo.setAttribute('aCenter', centerAttr);
  instancedGeo.setAttribute('aScale', scaleAttr);
  instancedGeo.setAttribute('aAlpha', alphaAttr);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(instancedGeo, material);
  mesh.frustumCulled = false;

  let elapsed = 0;

  return {
    object3d: mesh,
    update(dt: number) {
      elapsed += dt;

      for (let i = 0; i < count; i++) {
        const age = (ages[i] = ages[i]! + dt);

        if (age >= maxLifetimes[i]!) {
          respawn(i);
          continue;
        }

        const t = age / maxLifetimes[i]!; // 0..1 normalized life
        const i3 = i * 3;

        // Rise with drag
        velocities[i3 + 1] = velocities[i3 + 1]! * (1 - 0.15 * dt);

        // Sinusoidal horizontal drift
        const drift = Math.sin(elapsed * 0.8 + phaseOffsets[i]!) * 0.15;

        centers[i3] = centers[i3]! + (velocities[i3]! + drift) * dt;
        centers[i3 + 1] = centers[i3 + 1]! + velocities[i3 + 1]! * dt;
        centers[i3 + 2] = centers[i3 + 2]! + velocities[i3 + 2]! * dt;

        // Scale grows: 0.5 -> 2.5 over lifetime
        scales[i] = 0.5 + t * 2.0;

        // Alpha: fade in quickly, hold, fade out in last 30%
        if (t < 0.1) {
          alphas[i] = t / 0.1 * 0.35; // fade in
        } else if (t < 0.7) {
          alphas[i] = 0.35; // hold
        } else {
          alphas[i] = 0.35 * (1.0 - (t - 0.7) / 0.3); // fade out
        }
      }

      centerAttr.needsUpdate = true;
      scaleAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    },
    dispose() {
      instancedGeo.dispose();
      baseGeo.dispose();
      material.dispose();
    },
  };
}

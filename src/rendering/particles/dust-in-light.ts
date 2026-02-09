import * as THREE from 'three';
import type { ParticleSystem } from './types.js';

/**
 * Dust-in-light particle system — Points with ShaderMaterial.
 * Particles in the light beam glow brightly; outside the beam they're dim.
 * Vertex shader computes a cone/beam proximity factor that modulates alpha
 * and tints warm in the beam vs neutral outside.
 * Scale factor 80.0, AdditiveBlending, depthWrite:false, frustumCulled:false.
 */

interface DustInLightConfig {
  region: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  count: number;
  lightDirection: { x: number; y: number; z: number };
}

const VERT = /* glsl */`
  uniform vec3 uLightDir;
  uniform vec3 uLightOrigin;
  attribute float aSize;
  attribute float aSeed;
  varying float vInBeam;
  varying float vAlpha;

  void main() {
    // Compute beam proximity: project particle onto light axis
    vec3 toParticle = position - uLightOrigin;
    float proj = dot(toParticle, uLightDir);

    // Only particles "downstream" of the light origin count
    float downstream = smoothstep(-1.0, 1.0, proj);

    // Distance from beam axis
    vec3 onAxis = uLightOrigin + uLightDir * proj;
    float distFromAxis = length(position - onAxis);

    // Beam widens with distance (cone): radius = proj * 0.3
    float beamRadius = max(proj * 0.3, 0.5);
    float inBeam = smoothstep(beamRadius, beamRadius * 0.3, distFromAxis) * downstream;

    vInBeam = inBeam;
    vAlpha = 0.04 + inBeam * 0.25; // dim outside beam, bright inside

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (80.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAG = /* glsl */`
  varying float vInBeam;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.15, d);

    // Warm tint in beam, neutral outside
    vec3 neutral = vec3(0.9, 0.88, 0.82);
    vec3 warm = vec3(1.0, 0.92, 0.7);
    vec3 color = mix(neutral, warm, vInBeam);

    gl_FragColor = vec4(color, soft * vAlpha);
  }
`;

export function createDustInLight(config: DustInLightConfig): ParticleSystem {
  const { region, count, lightDirection } = config;

  // Normalize light direction
  const len = Math.sqrt(lightDirection.x ** 2 + lightDirection.y ** 2 + lightDirection.z ** 2);
  const dir = { x: lightDirection.x / len, y: lightDirection.y / len, z: lightDirection.z / len };

  // Light origin: center of the region face closest to where light enters
  const lightOrigin = new THREE.Vector3(
    (region.minX + region.maxX) / 2 - dir.x * 5,
    (region.minY + region.maxY) / 2 - dir.y * 5,
    (region.minZ + region.maxZ) / 2 - dir.z * 5,
  );

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seedsArr = new Float32Array(count);

  // Per-particle animation seeds
  const animSeeds = new Float32Array(count * 4); // phase, freqX, freqY, freqZ

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = region.minX + Math.random() * (region.maxX - region.minX);
    positions[i3 + 1] = region.minY + Math.random() * (region.maxY - region.minY);
    positions[i3 + 2] = region.minZ + Math.random() * (region.maxZ - region.minZ);

    sizes[i] = 0.3 + Math.random() * 0.5;
    seedsArr[i] = Math.random();

    const i4 = i * 4;
    animSeeds[i4] = Math.random() * Math.PI * 2;
    animSeeds[i4 + 1] = 0.15 + Math.random() * 0.2;
    animSeeds[i4 + 2] = 0.08 + Math.random() * 0.15;
    animSeeds[i4 + 3] = 0.1 + Math.random() * 0.2;
  }

  const basePositions = new Float32Array(positions);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seedsArr, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uLightDir: { value: new THREE.Vector3(dir.x, dir.y, dir.z) },
      uLightOrigin: { value: lightOrigin },
    },
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  let elapsed = 0;

  return {
    object3d: points,
    update(dt: number) {
      elapsed += dt;
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const pos = posAttr.array as Float32Array;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        const phase = animSeeds[i4]!;
        const fx = animSeeds[i4 + 1]!;
        const fy = animSeeds[i4 + 2]!;
        const fz = animSeeds[i4 + 3]!;

        // Gentle drift — slower than regular dust for ethereal feel
        pos[i3] = basePositions[i3]! + Math.sin(elapsed * fx + phase) * 0.2;
        pos[i3 + 1] = basePositions[i3 + 1]! + Math.sin(elapsed * fy + phase * 1.3) * 0.1;
        pos[i3 + 2] = basePositions[i3 + 2]! + Math.sin(elapsed * fz + phase * 0.7) * 0.15;
      }

      posAttr.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

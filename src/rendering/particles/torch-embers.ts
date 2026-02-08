import * as THREE from 'three';

/**
 * Torch ember particle system — plain Three.js Points with ShaderMaterial.
 * Embers spawn at torch position, float upward with turbulence, fade from
 * gold → orange → red → transparent, then respawn.
 */
export interface EmberSystem {
  points: THREE.Points;
  update(dt: number): void;
  dispose(): void;
}

interface EmberConfig {
  /** World-space spawn position of the torch */
  position: { x: number; y: number; z: number };
  /** Number of ember particles */
  count: number;
}

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aLife;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (80.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Color ramp: gold (1.0, 0.84, 0.0) → orange (1.0, 0.55, 0.0) → red (1.0, 0.27, 0.0) → fade out
const FRAG = /* glsl */`
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float edge = smoothstep(0.5, 0.2, d);

    // Color ramp based on life (1.0 = just born, 0.0 = dead)
    vec3 gold = vec3(1.0, 0.84, 0.0);
    vec3 orange = vec3(1.0, 0.55, 0.0);
    vec3 red = vec3(1.0, 0.27, 0.0);

    vec3 color;
    if (vLife > 0.5) {
      color = mix(orange, gold, (vLife - 0.5) * 2.0);
    } else {
      color = mix(red, orange, vLife * 2.0);
    }

    // Alpha: full at birth, fade out in last 20% of life
    float alpha = edge * smoothstep(0.0, 0.2, vLife);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createTorchEmbers(config: EmberConfig): EmberSystem {
  const { position: spawnPos, count } = config;

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const lifes = new Float32Array(count);

  // Per-particle state (not GPU attributes)
  const velocities = new Float32Array(count * 3); // vx, vy, vz
  const maxLifetimes = new Float32Array(count);
  const ages = new Float32Array(count);
  const phaseOffsets = new Float32Array(count);

  function respawn(i: number): void {
    const i3 = i * 3;
    // Small random offset from spawn position
    positions[i3] = spawnPos.x + (Math.random() - 0.5) * 0.3;
    positions[i3 + 1] = spawnPos.y + (Math.random() - 0.5) * 0.2;
    positions[i3 + 2] = spawnPos.z + (Math.random() - 0.5) * 0.3;

    velocities[i3] = (Math.random() - 0.5) * 0.2; // slight horizontal
    velocities[i3 + 1] = 0.5 + Math.random() * 1.0; // upward
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.2;

    sizes[i] = 0.3 + Math.random() * 0.5; // tiny sparks
    maxLifetimes[i] = 1.0 + Math.random() * 2.0; // 1-3 seconds
    ages[i] = 0;
    lifes[i] = 1.0;
    phaseOffsets[i] = Math.random() * Math.PI * 2;
  }

  // Initialize all particles with staggered ages so they don't all respawn at once
  for (let i = 0; i < count; i++) {
    respawn(i);
    ages[i] = Math.random() * maxLifetimes[i]!; // stagger initial ages
    lifes[i] = 1.0 - ages[i]! / maxLifetimes[i]!;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aLife', new THREE.BufferAttribute(lifes, 1));

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
    update(dt: number) {
      elapsed += dt;
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const pos = posAttr.array as Float32Array;
      const lifeAttr = geometry.getAttribute('aLife') as THREE.BufferAttribute;
      const life = lifeAttr.array as Float32Array;

      for (let i = 0; i < count; i++) {
        const age = (ages[i] = ages[i]! + dt);

        if (age >= maxLifetimes[i]!) {
          respawn(i);
          continue;
        }

        life[i] = 1.0 - age / maxLifetimes[i]!;

        const i3 = i * 3;
        // Horizontal turbulence
        const turbX = Math.sin(elapsed * 2.5 + phaseOffsets[i]!) * 0.3;
        const turbZ = Math.cos(elapsed * 1.8 + phaseOffsets[i]! * 1.4) * 0.2;

        pos[i3] = pos[i3]! + (velocities[i3]! + turbX) * dt;
        pos[i3 + 1] = pos[i3 + 1]! + velocities[i3 + 1]! * dt;
        pos[i3 + 2] = pos[i3 + 2]! + (velocities[i3 + 2]! + turbZ) * dt;

        // Slow down upward velocity over time (drag)
        velocities[i3 + 1] = velocities[i3 + 1]! * (1 - 0.3 * dt);
      }

      posAttr.needsUpdate = true;
      lifeAttr.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

import { system, System } from '@lastolivegames/becsy';
import { FlickerLight } from '../components/rendering.js';
import { Object3DRef } from '../components/rendering.js';
import { TransformSyncSystem } from './transform-sync.js';
import type { PointLight } from 'three';

const NOISE_TABLE_SIZE = 1024;

/**
 * Pre-computed noise table for cheap per-frame light animation.
 * Avoids running live SimplexNoise at 60fps × N lights × 3 frequencies.
 */
const noiseTable = new Float32Array(NOISE_TABLE_SIZE);
{
  // Simple pseudo-random noise (not Simplex, but smooth enough for flicker)
  // Using a sine-wave hash for cheapness
  for (let i = 0; i < NOISE_TABLE_SIZE; i++) {
    const t = i / NOISE_TABLE_SIZE;
    noiseTable[i] =
      Math.sin(t * 6.2831 * 1.0 + 0.0) * 0.4 +
      Math.sin(t * 6.2831 * 2.3 + 1.7) * 0.3 +
      Math.sin(t * 6.2831 * 5.7 + 3.1) * 0.2 +
      Math.sin(t * 6.2831 * 13.1 + 5.3) * 0.1;
  }
}

function sampleNoise(time: number, freq: number, offset: number): number {
  const idx = ((time * freq + offset) * 100) & (NOISE_TABLE_SIZE - 1);
  return noiseTable[idx]!;
}

/**
 * Noise-driven light animation.
 * Layers 3 frequencies for natural flicker: slow sway, medium flutter, fast crackle.
 * Runs AFTER TransformSync because it directly mutates Three.js PointLight objects.
 */
@system(s => s.after(TransformSyncSystem))
export class LightFlickerSystem extends System {
  private lights = this.query(
    q => q.current.with(FlickerLight).read.and.with(Object3DRef).read,
  );

  execute(): void {
    const time = this.time / 1000; // Convert ms to seconds

    for (const entity of this.lights.current) {
      const { baseIntensity, noiseOffset } = entity.read(FlickerLight);
      const { object3d } = entity.read(Object3DRef);

      if (!object3d) continue;
      const light = object3d as unknown as PointLight;
      if (!light.isLight) continue;

      // 3-layer noise
      const slow = sampleNoise(time, 0.5, noiseOffset) * 0.15;
      const medium = sampleNoise(time, 1.5, noiseOffset + 100) * 0.10;
      const fast = sampleNoise(time, 4.0, noiseOffset + 200) * 0.05;

      light.intensity = baseIntensity * (1.0 + slow + medium + fast);
    }
  }
}

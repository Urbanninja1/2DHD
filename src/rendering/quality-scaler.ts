import type { HD2DPipeline } from './hd2d-pipeline.js';

/**
 * Dynamic quality scaler.
 * Monitors rolling-average frame time and progressively disables effects
 * when the budget is exceeded. Re-enables when headroom returns.
 *
 * Degradation order (cheapest to disable first):
 *   Step 1: God rays (~2-4ms)
 *   Step 2: N8AO SSAO (~2-3ms)
 *   Step 3: Tilt-shift DoF (~1-1.5ms)
 */

const WINDOW_SIZE = 60; // ~1 second of samples at 60fps
const DOWNGRADE_THRESHOLD_MS = 14; // Start downgrading above 14ms (leaves 2.67ms headroom for 60fps)
const UPGRADE_THRESHOLD_MS = 10; // Re-enable effects when below 10ms (generous headroom)

export interface QualityScaler {
  /** Call once per frame with the frame's delta in ms */
  update(deltaMs: number): void;
  /** Current quality level (0 = full, 3 = minimum) */
  readonly level: number;
}

export function createQualityScaler(pipeline: HD2DPipeline): QualityScaler {
  const samples: number[] = [];
  let sampleIdx = 0;
  let level = 0;
  let cooldown = 0; // Frames to wait before next level change

  function getAverage(): number {
    if (samples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i]!;
    return sum / samples.length;
  }

  function applyLevel(newLevel: number): void {
    level = newLevel;
    cooldown = WINDOW_SIZE; // Wait one full window before next adjustment

    // Step 1: God rays
    if (pipeline.godraysPass) {
      pipeline.godraysPass.enabled = level < 1;
    }

    // Step 2: N8AO SSAO
    pipeline.n8aoPass.enabled = level < 2;

    // Step 3: Tilt-shift
    pipeline.tiltShiftPass.enabled = level < 3;
  }

  return {
    get level() {
      return level;
    },

    update(deltaMs: number): void {
      // Fill rolling window
      if (samples.length < WINDOW_SIZE) {
        samples.push(deltaMs);
      } else {
        samples[sampleIdx] = deltaMs;
        sampleIdx = (sampleIdx + 1) % WINDOW_SIZE;
      }

      // Don't adjust until we have a full window
      if (samples.length < WINDOW_SIZE) return;

      if (cooldown > 0) {
        cooldown--;
        return;
      }

      const avg = getAverage();

      if (avg > DOWNGRADE_THRESHOLD_MS && level < 3) {
        applyLevel(level + 1);
      } else if (avg < UPGRADE_THRESHOLD_MS && level > 0) {
        applyLevel(level - 1);
      }
    },
  };
}

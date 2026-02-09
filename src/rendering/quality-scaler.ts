import type { HD2DPipeline } from './hd2d-pipeline.js';
import type { SurfaceDetailHandle } from './hd2d-surface/surface-injector.js';
import type { DecalSystem } from './hd2d-surface/decal-system.js';

/**
 * Dynamic quality scaler.
 * Monitors rolling-average frame time and progressively disables effects
 * when the budget is exceeded. Re-enables when headroom returns.
 *
 * Degradation order (cheapest to disable first):
 *   Level 0:  Full quality (all effects enabled)
 *   Level 1:  Disable god rays (~2-4ms)
 *   Level 2:  Disable N8AO SSAO (~2-3ms)
 *   Level 3:  Disable tilt-shift DoF (~1-1.5ms)
 *   Level 4:  Reduce shadow map 2048 -> 1024
 *   Level 5:  Signal 50% particle count reduction
 *   Level 6:  Apply texture mipmap LOD bias (blurrier textures, less bandwidth)
 *   Level 7:  Disable grunge overlay (surface detail)
 *   Level 8:  Disable detail normals (surface detail)
 *   Level 9:  Disable stochastic tiling
 *   Level 10: Reduce floor decal count by 50%
 *   Level 11: Hide ceiling decals entirely
 */

const WINDOW_SIZE = 60; // ~1 second of samples at 60fps
const DOWNGRADE_THRESHOLD_MS = 14; // Start downgrading above 14ms (leaves 2.67ms headroom for 60fps)
const UPGRADE_THRESHOLD_MS = 10; // Re-enable effects when below 10ms (generous headroom)
const MAX_LEVEL = 11;

/** Exposed quality settings that other systems can read */
export const qualitySettings = {
  shadowMapSize: 2048,
  textureLodBias: 0,
};

export interface QualityScaler {
  /** Call once per frame with the frame's delta in ms */
  update(deltaMs: number): void;
  /** Current quality level (0 = full, MAX_LEVEL = minimum) */
  readonly level: number;
  /** Whether particle systems should run at reduced count (level >= 5) */
  readonly reduceParticles: boolean;
  /** Register texture engine handles from the current room (call after room load) */
  setTextureEngineHandles(handles: SurfaceDetailHandle[], decalSystem: DecalSystem | null): void;
}

export function createQualityScaler(pipeline: HD2DPipeline): QualityScaler {
  const samples: number[] = [];
  let sampleIdx = 0;
  let level = 0;
  let cooldown = 0; // Frames to wait before next level change

  // Texture engine handles — set per-room via setTextureEngineHandles()
  let surfaceHandles: SurfaceDetailHandle[] = [];
  let decalSys: DecalSystem | null = null;

  function getAverage(): number {
    if (samples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i]!;
    return sum / samples.length;
  }

  function applyLevel(newLevel: number): void {
    const prevLevel = level;
    level = newLevel;
    cooldown = WINDOW_SIZE; // Wait one full window before next adjustment

    if (import.meta.env.DEV) {
      console.log(`[quality] Level ${prevLevel} -> ${newLevel}`);
    }

    // Level 1: God rays
    if (pipeline.godraysPass) {
      pipeline.godraysPass.enabled = level < 1;
    }

    // Level 2: N8AO SSAO
    pipeline.n8aoPass.enabled = level < 2;

    // Level 3: Tilt-shift
    pipeline.tiltShiftPass.enabled = level < 3;

    // Level 4: Shadow map resolution — stored in qualitySettings for RoomBuilder to read
    qualitySettings.shadowMapSize = level >= 4 ? 1024 : 2048;

    // Level 5: Particle reduction — exposed via reduceParticles getter
    // (consumed by RoomManager.updateParticles)

    // Level 6: Texture LOD bias — stored in qualitySettings for texture loader to read
    qualitySettings.textureLodBias = level >= 6 ? 1.0 : 0.0;

    // Level 7: Disable grunge overlay
    for (const h of surfaceHandles) {
      h.setGrungeIntensity(level >= 7 ? 0 : 0.35);
    }

    // Level 8: Disable detail normals
    for (const h of surfaceHandles) {
      h.setDetailIntensity(level >= 8 ? 0 : 0.3);
    }

    // Level 9: Disable stochastic tiling
    for (const h of surfaceHandles) {
      h.setStochasticEnabled(level < 9);
    }

    // Level 10: Reduce floor decal count by 50%
    if (decalSys) {
      const floorMesh = decalSys.getFloorMesh();
      if (floorMesh) {
        floorMesh.count = level >= 10
          ? Math.ceil(decalSys.totalFloorCount * 0.5)
          : decalSys.totalFloorCount;
      }
    }

    // Level 11: Hide ceiling decals entirely
    if (decalSys) {
      const ceilingMesh = decalSys.getCeilingMesh();
      if (ceilingMesh) {
        ceilingMesh.visible = level < 11;
      }
    }
  }

  return {
    get level() {
      return level;
    },

    get reduceParticles() {
      return level >= 5;
    },

    setTextureEngineHandles(handles: SurfaceDetailHandle[], decalSystem: DecalSystem | null): void {
      surfaceHandles = handles;
      decalSys = decalSystem;
      // Re-apply current level to new handles
      if (level >= 7) applyLevel(level);
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

      if (avg > DOWNGRADE_THRESHOLD_MS && level < MAX_LEVEL) {
        applyLevel(level + 1);
      } else if (avg < UPGRADE_THRESHOLD_MS && level > 0) {
        applyLevel(level - 1);
      }
    },
  };
}

import type { ColorGradingSettings, HD2DPipeline } from './hd2d-pipeline.js';

/**
 * Day/night color grading driven by GameClock.timeOfDay.
 *
 * Computes smooth hue/saturation/brightness offsets for 4 time periods:
 *   5-7   Dawn  — warm pink-gold
 *   7-17  Day   — neutral
 *   17-19 Dusk  — warm orange
 *   19-5  Night — cool blue, slightly darker
 *
 * Offsets are added to the room's base colorGrading each frame.
 */

interface GradingKeyframe {
  hue: number;
  saturation: number;
  brightness: number;
  contrast: number;
}

// Time-of-day keyframes (hours → offset from neutral)
const DAWN: GradingKeyframe    = { hue:  0.08, saturation:  0.15, brightness:  0.02, contrast: 0 };
const DAY: GradingKeyframe     = { hue:  0,    saturation:  0,    brightness:  0,    contrast: 0 };
const DUSK: GradingKeyframe    = { hue:  0.12, saturation:  0.10, brightness: -0.02, contrast: 0.03 };
const NIGHT: GradingKeyframe   = { hue: -0.08, saturation: -0.10, brightness: -0.06, contrast: 0.02 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpGrading(a: GradingKeyframe, b: GradingKeyframe, t: number): GradingKeyframe {
  return {
    hue:        lerp(a.hue, b.hue, t),
    saturation: lerp(a.saturation, b.saturation, t),
    brightness: lerp(a.brightness, b.brightness, t),
    contrast:   lerp(a.contrast, b.contrast, t),
  };
}

/**
 * Compute day/night color grading offset for a given time of day.
 * Returns offsets that should be ADDED to the room's base color grading.
 */
export function getDayNightOffset(timeOfDay: number): GradingKeyframe {
  const t = ((timeOfDay % 24) + 24) % 24; // normalize to [0, 24)

  if (t >= 7 && t < 17) {
    // Full day — neutral
    return DAY;
  } else if (t >= 5 && t < 7) {
    // Dawn transition: 5→7 (night → dawn → day)
    const progress = (t - 5) / 2;
    if (progress < 0.5) {
      // 5-6: night → dawn peak
      return lerpGrading(NIGHT, DAWN, progress * 2);
    }
    // 6-7: dawn peak → day
    return lerpGrading(DAWN, DAY, (progress - 0.5) * 2);
  } else if (t >= 17 && t < 19) {
    // Dusk transition: 17→19 (day → dusk → night)
    const progress = (t - 17) / 2;
    if (progress < 0.5) {
      // 17-18: day → dusk peak
      return lerpGrading(DAY, DUSK, progress * 2);
    }
    // 18-19: dusk peak → night
    return lerpGrading(DUSK, NIGHT, (progress - 0.5) * 2);
  } else {
    // Night (19-5)
    return NIGHT;
  }
}

/**
 * Apply day/night color grading to the pipeline.
 * Adds time-of-day offsets to the room's base color grading values.
 */
export function applyDayNightGrading(
  pipeline: HD2DPipeline,
  timeOfDay: number,
  base: ColorGradingSettings,
): void {
  const offset = getDayNightOffset(timeOfDay);
  pipeline.hueSaturationEffect.hue = base.hue + offset.hue;
  pipeline.hueSaturationEffect.saturation = base.saturation + offset.saturation;
  pipeline.brightnessContrastEffect.brightness = base.brightness + offset.brightness;
  pipeline.brightnessContrastEffect.contrast = base.contrast + offset.contrast;
}

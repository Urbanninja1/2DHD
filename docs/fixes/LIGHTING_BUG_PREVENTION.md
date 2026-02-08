# Invisible Floor Bug: Prevention Strategies

## Root Cause Analysis
The invisible floor bug resulted from a combination of three post-processing and lighting misconfiguration issues:
1. **Negative brightness in color grading** (`brightness: -0.5` or lower)
2. **Excessively low ambient light intensity** (below 0.45)
3. **Heavy vignette darkness** (0.55+) combined with aggressive color grading

These settings cumulatively reduced the floor visibility to unplayable levels, making the floor geometry invisible or imperceptible during gameplay.

---

## Prevention Checklist

### Ambient Light Minimums
Ensure every room maintains safe baseline lighting:

- [ ] **Minimum ambient light intensity: 0.45**
  - Tested safe range: 0.45–0.65
  - Dark rooms: 0.45 (Maegor's Entry: `0.5`)
  - Grand/open rooms: 0.6–0.65 (Throne Room: `0.6`)
  - If you go below 0.45, point lights must compensate heavily

- [ ] **Ambient color hue is neutral-to-warm**
  - Safe range: `0x554433` (brown) to `0x7799CC` (cool blue)
  - Avoid extremely desaturated grays or pure black-tinted colors
  - Test: The color picker should feel like "shadowed stonework," not "pitch black"

### Point Light Intensity Minimums
At least one point light per 50m³ of room volume:

- [ ] **Small rooms (intimate mood): 2.0–2.5 intensity minimum per torch**
- [ ] **Medium rooms (grand mood): 2.5–3.0 intensity minimum per torch**
- [ ] **Large rooms (open mood): 3.0+ intensity minimum**
- [ ] **Distance range**: 12–22 units (don't go below 10)
- [ ] **Decay**: 1.0–1.2 (never negative or zero)

### Post-Processing Guardrails

#### Color Grading
- [ ] **Brightness: Never negative (danger zone -0.2 and below)**
  - Safe range: `-0.05` to `+0.2`
  - Default: `0` (no change)
  - Rule: If you need darkness, use vignette or low ambient light instead
  - Current usage: All rooms use `0` or `+0.05` ✓

- [ ] **Saturation: Between -1.0 and +1.0**
  - Safe range: `-0.2` to `+0.2` for subtle mood effects
  - Current usage: `-0.05` to `+0.15` ✓

- [ ] **Contrast: Between -1.0 and +1.0**
  - Safe range: `0` to `+0.15` (avoid negatives)
  - Current usage: `0.05` to `0.1` ✓

- [ ] **Hue: Small shifts only**
  - Safe range: `-0.2` to `+0.2` radians
  - Current usage: `-0.087` to `+0.175` ✓

#### Vignette
- [ ] **Darkness: Maximum 0.55**
  - Danger zone: 0.6+
  - Recommended range: 0.35–0.50
  - Current usage: 0.35–0.55 ✓
  - Note: Heavy vignette (>0.55) + negative brightness = invisible floors

#### Bloom
- [ ] **Intensity: 0.3–0.7 (higher for bright rooms)**
- [ ] **Luminance Threshold: 0.80–0.90**
  - Higher threshold = fewer bloom highlights
  - Current usage: 0.80–0.90 ✓

#### SSAO (Ambient Occlusion)
- [ ] **Intensity: 1.5–2.5** (not too aggressive)
- [ ] **AO Radius: 4–6 units**
- [ ] **Distance Falloff: 0.8–1.2**
  - Avoid going below 0.5 (can darken large areas too much)

---

## Post-Processing Guidelines

### What's Safe
- **Vignette darkness ≤ 0.50**: Subtle frame darkening is fine
- **Brightness in range [-0.05, +0.2]**: Barely perceptible adjustments
- **Saturation ±0.15**: Subtle color mood shifts
- **Contrast +0.05 to +0.15**: Adds punch without darkening
- **Bloom intensity 0.4–0.7**: Enhances luminous surfaces

### What's Dangerous
- **Brightness < -0.1**: Noticeable darkening; avoid entirely
- **Brightness < -0.2**: Critical danger; floors become invisible
- **Vignette darkness > 0.55**: Edges become too dark; combines badly with other effects
- **Saturation < -0.3**: Desaturated grays lose definition
- **Bloom intensity > 0.8**: Washing out the scene
- **Multiple aggressive effects stacked**: Bright + heavy vignette + high SSAO = cumulative darkness

### Safe Combinations for Dark Moods
**Instead of negative brightness, use:**
1. Lower ambient light intensity (0.45–0.50)
2. Warm, desaturated colors in floorColor/wallColor
3. Moderate vignette (0.40–0.50)
4. Strong point light placement to guide player vision
5. Higher contrast (+0.05 to +0.10) to restore definition

**Example: Dark room safe configuration**
```typescript
ambientLight: { color: 0x2A2A3E, intensity: 0.50 },  // Low but safe
lights: [
  { type: 'point', ..., intensity: 3.5, distance: 18 },  // Stronger torch
  { type: 'point', ..., intensity: 3.5, distance: 18 },
],
postProcessOverrides: {
  colorGrading: {
    hue: 0,
    saturation: -0.1,
    brightness: 0,        // NOT negative!
    contrast: 0.1         // Restore detail instead
  },
  vignette: { darkness: 0.45 },  // Moderate edge darkening
  bloom: { intensity: 0.4, luminanceThreshold: 0.90 }
}
```

---

## Automated Visual Testing

### Playwright Screenshot Testing
Add a visual regression test suite to catch lighting bugs before deployment:

```typescript
// tests/visual-lighting.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Room Lighting Visibility', () => {
  // Each room must have visibly lit floor (brightness > threshold)
  const rooms = [
    { id: '01-throne-room', name: 'Throne Room' },
    { id: '02-antechamber', name: 'Antechamber' },
    // ... all 10 rooms
  ];

  for (const room of rooms) {
    test(`${room.name}: floor is visible`, async ({ page }) => {
      await page.goto(`http://localhost:5173/?room=${room.id}`);
      await page.waitForLoadState('networkidle');

      // Capture screenshot
      await expect(page).toHaveScreenshot(`room-${room.id}.png`, {
        mask: [page.locator('#ui-overlay')],  // Ignore UI elements
      });

      // Analyze floor region (center-bottom of viewport)
      const canvas = page.locator('canvas');
      const floorPixels = await analyzeFloorLuminance(page, canvas);

      // Fail if average floor luminance < threshold
      expect(floorPixels.averageLuminance).toBeGreaterThan(50);  // 0–255 scale
      expect(floorPixels.darkPixelRatio).toBeLessThan(0.3);      // <30% black pixels
    });

    test(`${room.name}: walls have contrast`, async ({ page }) => {
      await page.goto(`http://localhost:5173/?room=${room.id}`);
      await page.waitForLoadState('networkidle');

      const canvas = page.locator('canvas');
      const wallPixels = await analyzeWallContrast(page, canvas);

      // Wall contrast ratio should be visible (not flat dark)
      expect(wallPixels.contrastRatio).toBeGreaterThan(1.5);
      expect(wallPixels.brightnessRange).toBeGreaterThan(30);  // Pixel value spread
    });
  }
});

// Helper: Analyze floor luminance from screenshot
async function analyzeFloorLuminance(page, canvasLocator) {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    // Sample floor region (center-bottom, where player looks)
    const floorTop = Math.floor(canvas.height * 0.6);
    const floorRegion = ctx.getImageData(
      0, floorTop, canvas.width, canvas.height - floorTop
    );

    let totalLuminance = 0;
    let darkPixels = 0;

    for (let i = 0; i < floorRegion.data.length; i += 4) {
      const r = floorRegion.data[i];
      const g = floorRegion.data[i + 1];
      const b = floorRegion.data[i + 2];

      // Luminance formula: 0.299R + 0.587G + 0.114B
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += luminance;

      if (luminance < 30) darkPixels++;
    }

    const pixelCount = floorRegion.data.length / 4;
    return {
      averageLuminance: totalLuminance / pixelCount,
      darkPixelRatio: darkPixels / pixelCount,
    };
  });
}

// Helper: Analyze wall contrast
async function analyzeWallContrast(page, canvasLocator) {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    // Sample wall region (top 60% of screen)
    const wallRegion = ctx.getImageData(0, 0, canvas.width, Math.floor(canvas.height * 0.6));

    let min = 255, max = 0, minPixel = 255, maxPixel = 0;

    for (let i = 0; i < wallRegion.data.length; i += 4) {
      const r = wallRegion.data[i];
      const g = wallRegion.data[i + 1];
      const b = wallRegion.data[i + 2];

      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
    }

    return {
      contrastRatio: (max + 1) / (min + 1),  // Avoid division by zero
      brightnessRange: max - min,
    };
  });
}
```

### Quick Manual Testing Checklist
Before committing room config changes:

- [ ] **Visual sweep**: Load room, walk across floor. Can you see the floor geometry clearly?
- [ ] **Edge test**: Walk to vignette edges. Are edges too dark (hard to see what's beyond)?
- [ ] **NPC visibility**: Can you see NPC faces and details? No excessive shadowing?
- [ ] **Contrast test**: Squint at the screen. Does the scene still have visible depth/structure?
- [ ] **Phone test**: (Optional) Load on phone at different brightness levels. Still playable?

---

## Code Guardrails

### 1. Validation in RoomData Builder

Add input validation when loading room configs:

```typescript
// src/rooms/RoomBuilder.ts - Add at start of buildRoom()

function validateRoomLighting(data: RoomData): void {
  const issues: string[] = [];

  // --- Ambient Light Validation ---
  if (data.ambientLight.intensity < 0.45) {
    issues.push(
      `LIGHTING_ERROR: Ambient intensity too low (${data.ambientLight.intensity} < 0.45). ` +
      `Floor may be invisible. Minimum safe value: 0.45`
    );
  }
  if (data.ambientLight.intensity > 1.0) {
    issues.push(
      `LIGHTING_WARN: Ambient intensity very high (${data.ambientLight.intensity} > 1.0). ` +
      `Room may look washed out.`
    );
  }

  // --- Color Grading Validation ---
  const cg = data.postProcessOverrides?.colorGrading;
  if (cg) {
    if (cg.brightness < -0.1) {
      issues.push(
        `LIGHTING_ERROR: Color grading brightness dangerously negative ` +
        `(${cg.brightness} < -0.1). This darkens the entire scene and causes ` +
        `floor invisibility. Use ambient light or vignette instead.`
      );
    }
    if (cg.brightness < 0 && cg.brightness > -0.1) {
      issues.push(
        `LIGHTING_WARN: Color grading brightness slightly negative (${cg.brightness}). ` +
        `Avoid negative brightness; use vignette or low ambient light instead.`
      );
    }
    if (Math.abs(cg.saturation) > 1.0) {
      issues.push(
        `LIGHTING_WARN: Saturation out of range (${cg.saturation}). ` +
        `Should be between -1.0 and 1.0.`
      );
    }
    if (Math.abs(cg.hue) > Math.PI) {
      issues.push(
        `LIGHTING_WARN: Hue out of range (${cg.hue}). ` +
        `Should be between -π and π radians.`
      );
    }
  }

  // --- Vignette Validation ---
  const vig = data.postProcessOverrides?.vignette;
  if (vig && vig.darkness > 0.55) {
    issues.push(
      `LIGHTING_WARN: Vignette darkness high (${vig.darkness} > 0.55). ` +
      `May cause edge invisibility when combined with low ambient light.`
    );
  }

  // --- Point Light Validation ---
  const pointLights = data.lights.filter(l => l.type === 'point');
  if (pointLights.length === 0) {
    issues.push(
      `LIGHTING_WARN: Room has no point lights. Ensure ambient light is ≥ 0.5 ` +
      `to maintain visibility.`
    );
  }
  for (const light of pointLights) {
    if (light.intensity < 2.0) {
      issues.push(
        `LIGHTING_WARN: Point light intensity low (${light.intensity} < 2.0). ` +
        `May not illuminate floor adequately.`
      );
    }
    if ((light.distance ?? 15) < 10) {
      issues.push(
        `LIGHTING_WARN: Point light distance very short (${light.distance} < 10). ` +
        `Limited coverage.`
      );
    }
  }

  // --- Report Issues ---
  if (issues.length > 0) {
    const errors = issues.filter(i => i.includes('_ERROR'));
    const warnings = issues.filter(i => i.includes('_WARN'));

    if (errors.length > 0) {
      console.error(`[RoomBuilder] Lighting configuration errors for room ${data.id}:`);
      errors.forEach(e => console.error(`  ${e}`));
    }
    if (warnings.length > 0) {
      console.warn(`[RoomBuilder] Lighting configuration warnings for room ${data.id}:`);
      warnings.forEach(w => console.warn(`  ${w}`));
    }

    // In dev mode, throw on errors; in production, log and continue
    if (import.meta.env.DEV && errors.length > 0) {
      throw new Error(
        `Lighting configuration errors in room ${data.id}. ` +
        `Fix errors above before proceeding.`
      );
    }
  }
}

// Call during room build
export async function buildRoom(data: RoomData, loaderSet?: LoaderSet): Promise<BuiltRoom> {
  validateRoomLighting(data);  // Add this line at start
  // ... rest of buildRoom()
}
```

### 2. Type-Safe Ranges with Branded Types

```typescript
// src/rendering/hd2d-pipeline.ts

/** Brightness value: -1 to 1, with -0.1 as practical danger threshold */
type SafeBrightness = number & { readonly __safeBrightness: true };
type SafeVignetteDarkness = number & { readonly __safeVignette: true };

function asSafeBrightness(value: number): SafeBrightness {
  if (value < -0.1) {
    throw new Error(
      `Brightness ${value} is dangerously negative. ` +
      `Use values between -0.05 and 0.2 instead.`
    );
  }
  return value as SafeBrightness;
}

function asSafeVignetteDarkness(value: number): SafeVignetteDarkness {
  if (value > 0.55) {
    console.warn(
      `Vignette darkness ${value} is high. ` +
      `Recommended max: 0.55. May cause visibility issues.`
    );
  }
  return value as SafeVignetteDarkness;
}

// Usage in room configs:
colorGrading: {
  brightness: asSafeBrightness(0),  // Compile-time guarantee
  // ...
},
vignette: {
  darkness: asSafeVignetteDarkness(0.45),
}
```

### 3. Safe Defaults in HD2DSettings

```typescript
// src/rendering/hd2d-pipeline.ts

const DEFAULT_SETTINGS: HD2DSettings = {
  bloom: { intensity: 0.5, luminanceThreshold: 0.85 },
  tiltShift: { focusArea: 0.35, feather: 0.3 },
  vignette: { darkness: 0.45 },  // Safe default (not too high)
  colorGrading: {
    hue: 0,
    saturation: 0,
    brightness: 0,  // ALWAYS zero, never negative
    contrast: 0.1
  },
  ssao: { aoRadius: 5, intensity: 2, distanceFalloff: 1 },
};
```

### 4. Clamp Function for Runtime Safety

```typescript
// src/rendering/hd2d-pipeline.ts

function clampPostProcessSettings(settings: Partial<HD2DSettings>): HD2DSettings {
  const cg = settings.colorGrading || {};

  return {
    bloom: {
      intensity: clamp(settings.bloom?.intensity ?? 0.5, 0, 1),
      luminanceThreshold: clamp(settings.bloom?.luminanceThreshold ?? 0.85, 0.7, 0.95),
    },
    vignette: {
      darkness: clamp(settings.vignette?.darkness ?? 0.45, 0.2, 0.55),  // Hard cap at 0.55
    },
    colorGrading: {
      hue: clamp(cg.hue ?? 0, -Math.PI, Math.PI),
      saturation: clamp(cg.saturation ?? 0, -1, 1),
      brightness: Math.max(cg.brightness ?? 0, -0.05),  // Never go below -0.05
      contrast: clamp(cg.contrast ?? 0, -1, 1),
    },
    tiltShift: {
      focusArea: clamp(settings.tiltShift?.focusArea ?? 0.35, 0.1, 0.8),
      feather: clamp(settings.tiltShift?.feather ?? 0.3, 0.1, 0.8),
    },
    ssao: {
      aoRadius: clamp(settings.ssao?.aoRadius ?? 5, 2, 10),
      intensity: clamp(settings.ssao?.intensity ?? 2, 1, 4),
      distanceFalloff: clamp(settings.ssao?.distanceFalloff ?? 1, 0.5, 2),
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Apply clamps when updating settings
export function updatePipelineSettings(
  pipeline: HD2DPipeline,
  settings: Partial<HD2DSettings>,
): void {
  const safe = clampPostProcessSettings(settings);
  // ... apply safe settings
}
```

---

## Summary

| Issue | Cause | Prevention |
|-------|-------|-----------|
| Invisible floor | Negative brightness + low ambient + high vignette | Keep brightness ≥ 0, ambient ≥ 0.45, vignette ≤ 0.55 |
| Poor NPC visibility | Oversaturated color grading + darkness | Use moderate saturation (±0.15), add contrast instead of reducing brightness |
| Washed-out scene | Excessive bloom + brightness | Cap bloom at 0.7, keep brightness at 0 |
| Vignette over-darkening | Darkness > 0.55 + heavy SSAO | Clamp vignette darkness to 0.55, keep SSAO intensity ≤ 2.5 |

**Rule of thumb**: If you want darkness, use structured lighting (low ambient + strong point lights) and moderate vignette. Never use negative brightness.

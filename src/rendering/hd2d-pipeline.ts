import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  TiltShiftEffect,
  VignetteEffect,
  ToneMappingEffect,
  HueSaturationEffect,
  BrightnessContrastEffect,
  KernelSize,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { GodraysPass, type GodraysPassParams } from 'three-good-godrays';

export interface ColorGradingSettings {
  /** Hue shift in radians (0 = no change) */
  hue: number;
  /** Saturation factor, -1 to 1 (0 = no change) */
  saturation: number;
  /** Brightness factor, -1 to 1 (0 = no change) */
  brightness: number;
  /** Contrast factor, -1 to 1 (0 = no change) */
  contrast: number;
}

export interface SSAOSettings {
  aoRadius: number;
  intensity: number;
  distanceFalloff: number;
}

export interface HD2DSettings {
  bloom: { intensity: number; luminanceThreshold: number };
  tiltShift: { focusArea: number; feather: number };
  vignette: { darkness: number };
  colorGrading?: ColorGradingSettings;
  ssao?: Partial<SSAOSettings>;
}

const DEFAULT_SETTINGS: HD2DSettings = {
  bloom: { intensity: 0.5, luminanceThreshold: 0.85 },
  tiltShift: { focusArea: 0.35, feather: 0.3 },
  vignette: { darkness: 0.45 },
  colorGrading: { hue: 0, saturation: 0, brightness: 0, contrast: 0 },
  ssao: { aoRadius: 5, intensity: 2, distanceFalloff: 1 },
};

export interface HD2DPipeline {
  composer: EffectComposer;
  bloomEffect: BloomEffect;
  bloomPass: EffectPass;
  tiltShiftEffect: TiltShiftEffect;
  tiltShiftPass: EffectPass;
  vignetteEffect: VignetteEffect;
  toneMappingEffect: ToneMappingEffect;
  hueSaturationEffect: HueSaturationEffect;
  brightnessContrastEffect: BrightnessContrastEffect;
  n8aoPass: N8AOPostPass;
  /** Active god rays pass — swapped per room. null when room has no god rays. */
  godraysPass: GodraysPass | null;
}

export function createHD2DPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  settings: HD2DSettings = DEFAULT_SETTINGS,
): HD2DPipeline {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    stencilBuffer: false,
    depthBuffer: true,
  });

  // Pass 1: Scene render
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Pass 2: N8AO SSAO (goes after RenderPass — needs the rendered scene)
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  const n8aoPass = new N8AOPostPass(scene, camera, w, h);
  const ssao = settings.ssao ?? DEFAULT_SETTINGS.ssao!;
  n8aoPass.configuration.aoRadius = ssao.aoRadius ?? 5;
  n8aoPass.configuration.intensity = ssao.intensity ?? 2;
  n8aoPass.configuration.distanceFalloff = ssao.distanceFalloff ?? 1;
  n8aoPass.configuration.color = new THREE.Color(0, 0, 0);
  composer.addPass(n8aoPass);

  // Pass 3: Bloom (CONVOLUTION — needs own pass)
  const bloomEffect = new BloomEffect({
    intensity: settings.bloom.intensity,
    luminanceThreshold: settings.bloom.luminanceThreshold,
    luminanceSmoothing: 0.3,
    kernelSize: KernelSize.MEDIUM,
  });
  const bloomPass = new EffectPass(camera, bloomEffect);
  composer.addPass(bloomPass);

  // Pass 4: TiltShift DoF (CONVOLUTION — needs own pass)
  const tiltShiftEffect = new TiltShiftEffect({
    focusArea: settings.tiltShift.focusArea,
    feather: settings.tiltShift.feather,
    kernelSize: KernelSize.MEDIUM,
  });
  const tiltShiftPass = new EffectPass(camera, tiltShiftEffect);
  composer.addPass(tiltShiftPass);

  // Pass 5: Cheap effects (non-convolution — merge into one pass)
  // Vignette + ToneMapping + HueSaturation + BrightnessContrast all merge free
  const vignetteEffect = new VignetteEffect({
    darkness: settings.vignette.darkness,
  });
  const toneMappingEffect = new ToneMappingEffect({
    mode: THREE.ACESFilmicToneMapping,
  });
  const cg = settings.colorGrading ?? DEFAULT_SETTINGS.colorGrading!;
  const hueSaturationEffect = new HueSaturationEffect({
    hue: cg.hue,
    saturation: cg.saturation,
  });
  const brightnessContrastEffect = new BrightnessContrastEffect({
    brightness: cg.brightness,
    contrast: cg.contrast,
  });
  const cheapPass = new EffectPass(
    camera,
    vignetteEffect,
    toneMappingEffect,
    hueSaturationEffect,
    brightnessContrastEffect,
  );
  composer.addPass(cheapPass);

  return {
    composer,
    bloomEffect,
    bloomPass,
    tiltShiftEffect,
    tiltShiftPass,
    vignetteEffect,
    toneMappingEffect,
    hueSaturationEffect,
    brightnessContrastEffect,
    n8aoPass,
    godraysPass: null,
  };
}

/**
 * Set up a GodraysPass for a room's directional light.
 * Call this during room load; the pass is inserted before the bloom pass.
 * Returns the created pass (stored on pipeline.godraysPass).
 */
export function setGodraysLight(
  pipeline: HD2DPipeline,
  light: THREE.DirectionalLight | THREE.PointLight,
  camera: THREE.PerspectiveCamera,
  params?: Partial<GodraysPassParams>,
): GodraysPass {
  // Remove existing godrays pass if any
  removeGodrays(pipeline);

  const pass = new GodraysPass(light, camera, {
    density: 1 / 128,
    maxDensity: 0.5,
    distanceAttenuation: 2,
    color: new THREE.Color(0xffffff),
    raymarchSteps: 60,
    blur: true,
    gammaCorrection: false,
    ...params,
  });

  // Insert godrays pass after N8AO, before bloom
  // Pass order: RenderPass(0), N8AO(1), [GodraysPass here], Bloom, TiltShift, Cheap
  const passes = pipeline.composer.passes;
  const bloomIdx = passes.indexOf(pipeline.bloomPass);
  if (bloomIdx >= 0) {
    // Insert before bloom
    passes.splice(bloomIdx, 0, pass);
  } else {
    pipeline.composer.addPass(pass);
  }

  pipeline.godraysPass = pass;
  return pass;
}

/**
 * Remove the current god rays pass from the pipeline.
 */
export function removeGodrays(pipeline: HD2DPipeline): void {
  if (!pipeline.godraysPass) return;

  const passes = pipeline.composer.passes;
  const idx = passes.indexOf(pipeline.godraysPass);
  if (idx >= 0) {
    passes.splice(idx, 1);
  }
  pipeline.godraysPass.dispose();
  pipeline.godraysPass = null;
}

export function updatePipelineSettings(
  pipeline: HD2DPipeline,
  settings: Partial<HD2DSettings>,
): void {
  if (settings.bloom) {
    pipeline.bloomEffect.intensity = settings.bloom.intensity;
    pipeline.bloomEffect.luminanceMaterial.threshold = settings.bloom.luminanceThreshold;
  }
  if (settings.tiltShift) {
    pipeline.tiltShiftEffect.focusArea = settings.tiltShift.focusArea;
    pipeline.tiltShiftEffect.feather = settings.tiltShift.feather;
  }
  if (settings.vignette) {
    pipeline.vignetteEffect.darkness = settings.vignette.darkness;
  }
  if (settings.colorGrading) {
    pipeline.hueSaturationEffect.hue = settings.colorGrading.hue;
    pipeline.hueSaturationEffect.saturation = settings.colorGrading.saturation;
    pipeline.brightnessContrastEffect.brightness = settings.colorGrading.brightness;
    pipeline.brightnessContrastEffect.contrast = settings.colorGrading.contrast;
  }
  if (settings.ssao) {
    if (settings.ssao.aoRadius !== undefined) {
      pipeline.n8aoPass.configuration.aoRadius = settings.ssao.aoRadius;
    }
    if (settings.ssao.intensity !== undefined) {
      pipeline.n8aoPass.configuration.intensity = settings.ssao.intensity;
    }
    if (settings.ssao.distanceFalloff !== undefined) {
      pipeline.n8aoPass.configuration.distanceFalloff = settings.ssao.distanceFalloff;
    }
  }
}

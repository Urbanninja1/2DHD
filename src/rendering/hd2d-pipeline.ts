import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  TiltShiftEffect,
  VignetteEffect,
  ToneMappingEffect,
  KernelSize,
} from 'postprocessing';

export interface HD2DSettings {
  bloom: { intensity: number; luminanceThreshold: number };
  tiltShift: { focusArea: number; feather: number };
  vignette: { darkness: number };
}

const DEFAULT_SETTINGS: HD2DSettings = {
  bloom: { intensity: 0.5, luminanceThreshold: 0.85 },
  tiltShift: { focusArea: 0.35, feather: 0.3 },
  vignette: { darkness: 0.45 },
};

export interface HD2DPipeline {
  composer: EffectComposer;
  bloomEffect: BloomEffect;
  bloomPass: EffectPass;
  tiltShiftEffect: TiltShiftEffect;
  tiltShiftPass: EffectPass;
  vignetteEffect: VignetteEffect;
  toneMappingEffect: ToneMappingEffect;
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

  // Pass 2: Bloom (CONVOLUTION — needs own pass)
  const bloomEffect = new BloomEffect({
    intensity: settings.bloom.intensity,
    luminanceThreshold: settings.bloom.luminanceThreshold,
    luminanceSmoothing: 0.3,
    kernelSize: KernelSize.MEDIUM,
  });
  const bloomPass = new EffectPass(camera, bloomEffect);
  composer.addPass(bloomPass);

  // Pass 3: TiltShift DoF (CONVOLUTION — needs own pass)
  const tiltShiftEffect = new TiltShiftEffect({
    focusArea: settings.tiltShift.focusArea,
    feather: settings.tiltShift.feather,
    kernelSize: KernelSize.MEDIUM,
  });
  const tiltShiftPass = new EffectPass(camera, tiltShiftEffect);
  composer.addPass(tiltShiftPass);

  // Pass 4: Cheap effects (non-convolution — merge into one pass)
  const vignetteEffect = new VignetteEffect({
    darkness: settings.vignette.darkness,
  });
  const toneMappingEffect = new ToneMappingEffect({
    mode: THREE.ACESFilmicToneMapping,
  });
  const cheapPass = new EffectPass(camera, vignetteEffect, toneMappingEffect);
  composer.addPass(cheapPass);

  return {
    composer,
    bloomEffect,
    bloomPass,
    tiltShiftEffect,
    tiltShiftPass,
    vignetteEffect,
    toneMappingEffect,
  };
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
}

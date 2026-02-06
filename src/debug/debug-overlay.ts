import type { HD2DPipeline } from '../rendering/hd2d-pipeline.js';

/**
 * Dev-mode debug overlay.
 * Keyboard shortcuts to toggle post-processing effects.
 * Compiled out via import.meta.env.DEV guard in main.ts.
 */
export interface DebugOverlay {
  dispose: () => void;
}

export function createDebugOverlay(pipeline: HD2DPipeline): DebugOverlay {
  const controller = new AbortController();
  const opts: AddEventListenerOptions = { signal: controller.signal };

  // On-screen info panel
  const panel = document.createElement('div');
  panel.id = 'debug-overlay';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '60px',
    right: '8px',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: '12px',
    background: 'rgba(0,0,0,0.6)',
    padding: '6px 10px',
    borderRadius: '4px',
    zIndex: '100',
    pointerEvents: 'none',
    lineHeight: '1.5',
    whiteSpace: 'pre',
  });
  document.body.appendChild(panel);

  const effects = {
    bloom: true,
    tiltShift: true,
    vignette: true,
    toneMapping: true,
  };

  function updatePanel(): void {
    const lines = [
      '[Debug Controls]',
      `F1: Bloom      ${effects.bloom ? 'ON' : 'OFF'}`,
      `F2: TiltShift  ${effects.tiltShift ? 'ON' : 'OFF'}`,
      `F3: Vignette   ${effects.vignette ? 'ON' : 'OFF'}`,
      `F4: ToneMap    ${effects.toneMapping ? 'ON' : 'OFF'}`,
    ];
    panel.textContent = lines.join('\n');
  }
  updatePanel();

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    switch (e.code) {
      case 'F1':
        e.preventDefault();
        effects.bloom = !effects.bloom;
        // Convolution effect — toggle entire pass for perf savings
        pipeline.bloomPass.enabled = effects.bloom;
        updatePanel();
        break;
      case 'F2':
        e.preventDefault();
        effects.tiltShift = !effects.tiltShift;
        // Convolution effect — toggle entire pass for perf savings
        pipeline.tiltShiftPass.enabled = effects.tiltShift;
        updatePanel();
        break;
      case 'F3':
        e.preventDefault();
        effects.vignette = !effects.vignette;
        // Non-convolution — toggle via blend opacity (avoids shader recompile)
        pipeline.vignetteEffect.blendMode.opacity.value = effects.vignette ? 1 : 0;
        updatePanel();
        break;
      case 'F4':
        e.preventDefault();
        effects.toneMapping = !effects.toneMapping;
        // Non-convolution — toggle via blend opacity
        pipeline.toneMappingEffect.blendMode.opacity.value = effects.toneMapping ? 1 : 0;
        updatePanel();
        break;
    }
  }, opts);

  return {
    dispose(): void {
      controller.abort();
      panel.remove();
    },
  };
}

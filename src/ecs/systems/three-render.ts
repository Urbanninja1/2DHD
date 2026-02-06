import { system, System } from '@lastolivegames/becsy';
import { renderContext } from '../../rendering/render-context.js';
import { LightFlickerSystem } from './light-flicker.js';

/**
 * Final system in the pipeline — calls EffectComposer.render().
 * Runs AFTER all other systems.
 */
@system(s => s.after(LightFlickerSystem))
export class ThreeRenderSystem extends System {
  execute(): void {
    const { composer } = renderContext;
    if (!composer) return;

    composer.render(this.delta / 1000);
  }
}

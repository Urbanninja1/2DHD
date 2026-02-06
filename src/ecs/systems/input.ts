import { system, System } from '@lastolivegames/becsy';
import { GameState, TransitionState } from '../components/singletons.js';
import { getKeyboard } from '../../input/keyboard.js';

/**
 * Reads keyboard state and exposes directional input.
 * Returns zero input when transition is in progress.
 */
@system
export class InputSystem extends System {
  private gameState = this.singleton.read(GameState);

  // Exposed input state for other systems via attach
  dirX = 0;
  dirZ = 0;

  execute(): void {
    const { transitionState } = this.gameState;

    if (transitionState !== TransitionState.IDLE) {
      this.dirX = 0;
      this.dirZ = 0;
      return;
    }

    const kb = getKeyboard();
    let dx = 0;
    let dz = 0;

    if (kb.up) dz -= 1;
    if (kb.down) dz += 1;
    if (kb.left) dx -= 1;
    if (kb.right) dx += 1;

    // Normalize diagonal
    if (dx !== 0 && dz !== 0) {
      dx *= Math.SQRT1_2;
      dz *= Math.SQRT1_2;
    }

    this.dirX = dx;
    this.dirZ = dz;
  }
}

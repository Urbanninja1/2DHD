import { system, System } from '@lastolivegames/becsy';
import { Transform, MovementIntent } from '../components/transform.js';
import { PlayerTag } from '../components/tags.js';
import { InputSystem } from './input.js';

const PLAYER_SPEED = 4.5; // units/second — deliberate, cathedral-walking pace

/**
 * Reads input, writes MovementIntent (NOT directly to Transform).
 * CollisionSystem will clamp MovementIntent before applying to Transform.
 */
@system(s => s.after(InputSystem))
export class PlayerMovementSystem extends System {
  private input = this.attach(InputSystem);
  private players = this.query(
    q => q.current.with(PlayerTag).and.with(Transform).read.and.with(MovementIntent).write,
  );

  execute(): void {
    const { dirX, dirZ } = this.input;
    const speed = PLAYER_SPEED * (this.delta / 1000);

    for (const entity of this.players.current) {
      const intent = entity.write(MovementIntent);
      intent.dx = dirX * speed;
      intent.dz = dirZ * speed;
    }
  }
}

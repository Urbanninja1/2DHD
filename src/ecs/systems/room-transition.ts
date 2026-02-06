import { system, System } from '@lastolivegames/becsy';
import { GameState, TransitionState } from '../components/singletons.js';
import { Transform } from '../components/transform.js';
import { PlayerTag } from '../components/tags.js';
import { CollisionSystem } from './collision.js';

/**
 * Checks player proximity to door trigger AABBs (only in IDLE state).
 * Delegates actual transitions to RoomManager.
 *
 * For Phase 1-2, this is a stub — door logic will be added in Phase 3.
 */
@system(s => s.after(CollisionSystem))
export class RoomTransitionSystem extends System {
  private gameState = this.singleton.write(GameState, {
    currentRoomId: 1,
    transitionState: TransitionState.IDLE,
    teleported: false,
  });

  private players = this.query(
    q => q.current.with(PlayerTag).and.with(Transform).read,
  );

  execute(): void {
    // Phase 3 will implement door trigger checks here
    // Note: teleported flag is consumed by CameraFollowSystem (runs after this)
  }
}

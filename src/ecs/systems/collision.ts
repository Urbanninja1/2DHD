import { system, System } from '@lastolivegames/becsy';
import { Transform, MovementIntent } from '../components/transform.js';
import { PlayerTag } from '../components/tags.js';
import { PlayerMovementSystem } from './player-movement.js';

/**
 * Reads MovementIntent + room wall boundaries, clamps, then writes to Transform.
 * Currently uses simple AABB bounds — the room boundary is configurable.
 */
@system(s => s.after(PlayerMovementSystem))
export class CollisionSystem extends System {
  private players = this.query(
    q => q.current.with(PlayerTag).and.with(Transform).write.and.with(MovementIntent).read,
  );

  execute(): void {
    for (const entity of this.players.current) {
      const { dx, dz } = entity.read(MovementIntent);
      const transform = entity.write(Transform);

      let newX = transform.px + dx;
      let newZ = transform.pz + dz;

      // Clamp to room bounds (will be set dynamically by RoomManager)
      const bounds = CollisionSystem.roomBounds;
      newX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
      newZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, newZ));

      transform.px = newX;
      transform.pz = newZ;
    }
  }

  /** Room bounds, updated by RoomManager on room load */
  static roomBounds = {
    minX: -12,
    maxX: 12,
    minZ: -6,
    maxZ: 6,
  };
}

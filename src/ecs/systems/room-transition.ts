import { system, System } from '@lastolivegames/becsy';
import { GameState, TransitionState } from '../components/singletons.js';
import { Transform } from '../components/transform.js';
import { Object3DRef, FlickerLight } from '../components/rendering.js';
import { PlayerTag } from '../components/tags.js';
import { CollisionSystem } from './collision.js';
import type { RoomManager } from '../../rooms/RoomManager.js';
import type { DoorTrigger } from '../../rooms/RoomBuilder.js';

/**
 * Syncs RoomManager state into ECS GameState singleton.
 * Checks player proximity to door trigger AABBs (only in IDLE state).
 * Applies pending player spawn positions from room transitions.
 * Creates FlickerLight entities for newly loaded rooms.
 */
@system(s => s.after(CollisionSystem))
export class RoomTransitionSystem extends System {
  private gameState = this.singleton.write(GameState, {
    currentRoomId: 1,
    transitionState: TransitionState.IDLE,
    teleported: false,
  });

  private players = this.query(
    q => q.current.with(PlayerTag).and.with(Transform).write,
  );

  // Declare create access — required by Becsy for this.createEntity() with these components
  private _flickerAccess = this.query(
    q => q.using(FlickerLight).create.and.using(Object3DRef).create,
  );

  /** Set by main.ts after RoomManager is created */
  static roomManager: RoomManager | null = null;

  execute(): void {
    const rm = RoomTransitionSystem.roomManager;
    if (!rm) return;

    // Sync RoomManager state → ECS GameState
    this.gameState.currentRoomId = rm.currentRoomId;
    this.gameState.transitionState = rm.transitionState;
    this.gameState.teleported = rm.teleported;

    // Consume teleported flag after syncing (CameraFollowSystem will read it this frame)
    if (rm.teleported) {
      rm.teleported = false;
    }

    // Create FlickerLight entities for pending lights from room load
    if (rm.pendingFlickerLights.length > 0) {
      const lights = rm.pendingFlickerLights;
      rm.pendingFlickerLights = [];

      for (let i = 0; i < lights.length; i++) {
        const light = lights[i]!;
        this.createEntity(
          FlickerLight, {
            baseIntensity: light.intensity,
            baseColor: light.color.getHex(),
            noiseOffset: i * 37.5,
          },
          Object3DRef, { object3d: light },
        );
      }
    }

    // Apply pending spawn position
    if (rm.pendingSpawn) {
      const { x, y, z } = rm.pendingSpawn;
      rm.pendingSpawn = null;

      for (const entity of this.players.current) {
        const transform = entity.write(Transform);
        transform.px = x;
        transform.py = y;
        transform.pz = z;
      }
    }

    // Only check doors in IDLE state
    if (rm.transitionState !== TransitionState.IDLE) return;
    if (rm.isTransitioning) return;

    for (const entity of this.players.current) {
      const { px, pz } = entity.read(Transform);

      for (const trigger of rm.doorTriggers) {
        if (isInsideTrigger(px, pz, trigger)) {
          // Copy door data before async operation
          const targetRoomId = trigger.door.targetRoomId;
          const spawnX = trigger.door.spawnPoint.x;
          const spawnY = trigger.door.spawnPoint.y;
          const spawnZ = trigger.door.spawnPoint.z;

          rm.transitionTo(targetRoomId, spawnX, spawnY, spawnZ);
          return;
        }
      }
    }
  }
}

function isInsideTrigger(px: number, pz: number, trigger: DoorTrigger): boolean {
  return px >= trigger.minX && px <= trigger.maxX &&
         pz >= trigger.minZ && pz <= trigger.maxZ;
}

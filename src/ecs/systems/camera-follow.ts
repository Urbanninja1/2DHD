import { system, System } from '@lastolivegames/becsy';
import { Transform } from '../components/transform.js';
import { PlayerTag } from '../components/tags.js';
import { GameState } from '../components/singletons.js';
import { renderContext } from '../../rendering/render-context.js';
import { RoomTransitionSystem } from './room-transition.js';

const CAMERA_OFFSET_X = 0;
const CAMERA_OFFSET_Y = 18;
const CAMERA_OFFSET_Z = 22;
const LERP_FACTOR = 0.06;
const PIXEL_SNAP_SIZE = 1 / 64; // Snap to a 64-pixel-per-unit grid

/**
 * Lerps camera toward player Transform with frame-rate-independent smoothing.
 * Snaps immediately if GameState.teleported is set.
 */
@system(s => s.after(RoomTransitionSystem))
export class CameraFollowSystem extends System {
  private gameState = this.singleton.write(GameState);
  private players = this.query(
    q => q.current.with(PlayerTag).and.with(Transform).read,
  );

  execute(): void {
    const camera = renderContext.camera;
    if (!camera) return;

    for (const entity of this.players.current) {
      const { px, py, pz } = entity.read(Transform);

      const targetX = px + CAMERA_OFFSET_X;
      const targetY = py + CAMERA_OFFSET_Y;
      const targetZ = pz + CAMERA_OFFSET_Z;

      if (this.gameState.teleported) {
        // Hard snap — no lerp on room transition
        camera.position.set(targetX, targetY, targetZ);
      } else {
        // Frame-rate-independent lerp
        const t = 1 - Math.pow(1 - LERP_FACTOR, this.delta / 16.667);
        camera.position.x += (targetX - camera.position.x) * t;
        camera.position.y += (targetY - camera.position.y) * t;
        camera.position.z += (targetZ - camera.position.z) * t;
      }

      // Snap to pixel grid to prevent sub-pixel jitter on sprites
      camera.position.x = Math.round(camera.position.x / PIXEL_SNAP_SIZE) * PIXEL_SNAP_SIZE;
      camera.position.z = Math.round(camera.position.z / PIXEL_SNAP_SIZE) * PIXEL_SNAP_SIZE;

      camera.lookAt(px, py, pz);

      // Consume the teleported flag after reading it (must happen in this system,
      // not RoomTransitionSystem, because this system runs after it)
      if (this.gameState.teleported) {
        this.gameState.teleported = false;
      }
    }
  }
}

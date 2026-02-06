import { system, System } from '@lastolivegames/becsy';
import { Transform } from '../components/transform.js';
import { Object3DRef } from '../components/rendering.js';
import { CameraFollowSystem } from './camera-follow.js';

/**
 * Snap a value to a 1/16 grid to prevent sub-pixel shimmer on pixel-art sprites.
 * 1/16 unit matches the 16px sprite resolution for crisp rendering.
 */
const SNAP_GRID = 1 / 16;
function snap(v: number): number {
  return Math.round(v / SNAP_GRID) * SNAP_GRID;
}

/**
 * One-way sync: ECS Transform → Three.js Object3D position/scale.
 * Only runs for entities that have both Transform and Object3DRef.
 * Positions are snapped to a 1/16 unit grid to prevent sub-pixel shimmer.
 */
@system(s => s.after(CameraFollowSystem))
export class TransformSyncSystem extends System {
  private entities = this.query(
    q => q.current.with(Transform).read.and.with(Object3DRef).read,
  );

  execute(): void {
    for (const entity of this.entities.current) {
      const { px, py, pz, sx, sy, sz } = entity.read(Transform);
      const { object3d } = entity.read(Object3DRef);

      if (object3d) {
        object3d.position.set(snap(px), py, snap(pz));
        object3d.scale.set(sx, sy, sz);
      }
    }
  }
}

import { system, System } from '@lastolivegames/becsy';
import { Transform } from '../components/transform.js';
import { Object3DRef } from '../components/rendering.js';
import { CameraFollowSystem } from './camera-follow.js';

/**
 * One-way sync: ECS Transform → Three.js Object3D position/scale.
 * Only runs for entities that have both Transform and Object3DRef.
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
        object3d.position.set(px, py, pz);
        object3d.scale.set(sx, sy, sz);
      }
    }
  }
}

import { World } from '@lastolivegames/becsy';
import { Transform, MovementIntent } from './components/transform.js';
import { Object3DRef, SpriteData, FlickerLight } from './components/rendering.js';
import { PlayerTag } from './components/tags.js';
import { GameState } from './components/singletons.js';
import { InputSystem } from './systems/input.js';
import { PlayerMovementSystem } from './systems/player-movement.js';
import { CollisionSystem } from './systems/collision.js';
import { RoomTransitionSystem } from './systems/room-transition.js';
import { CameraFollowSystem } from './systems/camera-follow.js';
import { TransformSyncSystem } from './systems/transform-sync.js';
import { LightFlickerSystem } from './systems/light-flicker.js';
import { ThreeRenderSystem } from './systems/three-render.js';

let world: World | null = null;

export async function createWorld(): Promise<World> {
  if (world) {
    await world.terminate();
    world = null;
  }

  world = await World.create({
    maxEntities: 1000,
    defs: [
      // Components
      Transform,
      MovementIntent,
      Object3DRef,
      SpriteData,
      FlickerLight,
      PlayerTag,
      GameState,
      // Systems (order is declarative via schedule, not by position here)
      InputSystem,
      PlayerMovementSystem,
      CollisionSystem,
      RoomTransitionSystem,
      CameraFollowSystem,
      TransformSyncSystem,
      LightFlickerSystem,
      ThreeRenderSystem,
    ],
  });

  return world;
}

export function getWorld(): World | null {
  return world;
}

// Vite HMR guard — prevent "component already registered" errors
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    if (world) {
      await world.terminate();
      world = null;
    }
  });
}

import { system, System } from '@lastolivegames/becsy';
import { GameClock } from '../components/game-clock.js';
import { RoomTransitionSystem } from './room-transition.js';

/**
 * Advances GameClock.timeOfDay each frame based on timeScale.
 * Runs after RoomTransition, before CameraFollow.
 * Exposes current time via static property for debug overlay.
 */
@system(s => s.after(RoomTransitionSystem))
export class GameClockSystem extends System {
  /** Current time of day — readable from outside ECS (debug overlay) */
  static timeOfDay = 10.0;

  private clock = this.singleton.write(GameClock);

  initialize(): void {
    // Set initial values on the auto-created singleton
    const clock = this.clock;
    clock.timeOfDay = 10.0;   // 10:00 AM (late morning)
    clock.timeScale = 1.0;    // 1 game-minute per real second
    clock.paused = false;
  }

  execute(): void {
    const clock = this.clock;
    if (clock.paused) return;

    // dt in seconds, timeScale = game-minutes per real second
    const dt = this.delta / 1000;
    const minutesElapsed = clock.timeScale * dt;
    const hoursElapsed = minutesElapsed / 60;

    let tod = clock.timeOfDay + hoursElapsed;
    // Wrap at 24
    if (tod >= 24) tod -= 24;
    if (tod < 0) tod += 24;
    clock.timeOfDay = tod;

    // Expose for debug overlay
    GameClockSystem.timeOfDay = tod;
  }
}

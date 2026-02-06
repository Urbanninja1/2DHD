import type { World } from '@lastolivegames/becsy';

/**
 * Serialized game loop.
 * rAF is scheduled ONLY after world.execute() resolves — prevents overlapping frames
 * that would corrupt Becsy ECS state.
 */
export class GameLoop {
  private running = false;
  private executing = false;
  private lastTimestamp = 0;
  private readonly MAX_DELTA_MS = 33.33; // Cap at 30fps minimum

  /** Optional hooks for stats-gl profiling */
  onBeforeExecute: (() => void) | null = null;
  /** Called after world.execute(). Receives the frame delta in ms. */
  onAfterExecute: ((deltaMs: number) => void) | null = null;
  /** Per-frame callback for non-ECS updates (e.g. particles). Receives delta in seconds. */
  onFrameTick: ((dt: number) => void) | null = null;

  constructor(private readonly world: World) {}

  start(): void {
    this.running = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
  }

  pause(): void {
    this.running = false;
  }

  resume(): void {
    if (!this.running) {
      this.running = true;
      this.lastTimestamp = performance.now();
      requestAnimationFrame(this.tick);
    }
  }

  resetDeltaTime(): void {
    this.lastTimestamp = performance.now();
  }

  private tick = (timestamp: number): void => {
    if (!this.running || this.executing) return;

    let delta = timestamp - this.lastTimestamp;
    delta = Math.min(delta, this.MAX_DELTA_MS);
    this.lastTimestamp = timestamp;

    this.executing = true;
    this.onBeforeExecute?.();
    this.onFrameTick?.(delta / 1000);
    this.world
      .execute(timestamp, delta)
      .then(() => {
        this.onAfterExecute?.(delta);
        this.executing = false;
        if (this.running) requestAnimationFrame(this.tick);
      })
      .catch((err: unknown) => {
        console.error('World execution failed:', err);
        this.onAfterExecute?.(delta);
        this.executing = false;
        if (this.running) requestAnimationFrame(this.tick);
      });
  };
}

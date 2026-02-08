import * as THREE from 'three';

/**
 * Spritesheet animator using UV offset.
 *
 * Layout convention: columns = frames per animation, rows = animation states.
 *   Row 0: idle
 *   Row 1: walkDown (or walk towards camera)
 *   Additional rows for future directions/actions.
 *
 * Call update(dt) each frame. Call play(row) to switch animation.
 */
export class SpriteAnimator {
  private texture: THREE.Texture;
  private cols: number;
  private rows: number;
  private fps: number;
  private currentRow: number;
  private currentFrame: number;
  private elapsed: number;

  constructor(texture: THREE.Texture, cols: number, rows: number, fps = 4) {
    this.texture = texture;
    this.cols = cols;
    this.rows = rows;
    this.fps = fps;
    this.currentRow = 0;
    this.currentFrame = 0;
    this.elapsed = 0;

    // Configure texture for spritesheet UV tiling
    texture.repeat.set(1 / cols, 1 / rows);
    texture.offset.set(0, (rows - 1) / rows); // Start at row 0 (top row in UV space)
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }

  /**
   * Switch to a different animation row.
   * Resets frame counter to 0.
   */
  play(row: number): void {
    if (row === this.currentRow) return;
    this.currentRow = Math.min(row, this.rows - 1);
    this.currentFrame = 0;
    this.elapsed = 0;
    this.applyFrame();
  }

  /**
   * Advance animation by dt seconds.
   */
  update(dt: number): void {
    this.elapsed += dt;
    const frameDuration = 1 / this.fps;
    if (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration;
      this.currentFrame = (this.currentFrame + 1) % this.cols;
      this.applyFrame();
    }
  }

  /** Set FPS for current animation */
  setFPS(fps: number): void {
    this.fps = fps;
  }

  private applyFrame(): void {
    this.texture.offset.set(
      this.currentFrame / this.cols,
      (this.rows - 1 - this.currentRow) / this.rows,
    );
  }
}

/**
 * Registry of active sprite animators — updated each frame.
 */
const activeAnimators: SpriteAnimator[] = [];

export function registerAnimator(animator: SpriteAnimator): void {
  activeAnimators.push(animator);
}

export function unregisterAnimator(animator: SpriteAnimator): void {
  const idx = activeAnimators.indexOf(animator);
  if (idx !== -1) activeAnimators.splice(idx, 1);
}

/**
 * Update all registered sprite animators. Call once per frame.
 */
export function updateAnimators(dt: number): void {
  for (const anim of activeAnimators) {
    anim.update(dt);
  }
}

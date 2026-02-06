/**
 * Raw keyboard state tracking with AbortController for cleanup.
 */
export class KeyboardState {
  private readonly keys = new Set<string>();
  private readonly controller = new AbortController();

  constructor() {
    const opts: AddEventListenerOptions = { signal: this.controller.signal };
    window.addEventListener('keydown', this.onKeyDown, opts);
    window.addEventListener('keyup', this.onKeyUp, opts);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  get up(): boolean {
    return this.keys.has('KeyW') || this.keys.has('ArrowUp');
  }

  get down(): boolean {
    return this.keys.has('KeyS') || this.keys.has('ArrowDown');
  }

  get left(): boolean {
    return this.keys.has('KeyA') || this.keys.has('ArrowLeft');
  }

  get right(): boolean {
    return this.keys.has('KeyD') || this.keys.has('ArrowRight');
  }

  clearAll(): void {
    this.keys.clear();
  }

  dispose(): void {
    this.controller.abort();
    this.keys.clear();
  }
}

// Module singleton
let instance: KeyboardState | null = null;

export function getKeyboard(): KeyboardState {
  if (!instance) {
    instance = new KeyboardState();
  }
  return instance;
}

export function disposeKeyboard(): void {
  instance?.dispose();
  instance = null;
}

import * as THREE from 'three';
import type { RoomIdValue } from '../ecs/components/singletons.js';
import { TransitionState, type TransitionStateValue } from '../ecs/components/singletons.js';
import { getRoomData, hasRoomData } from './room-data/registry.js';
import { buildRoom, disposeRoom, type BuiltRoom, type DoorTrigger, type ParticleSystem } from './RoomBuilder.js';
import { CollisionSystem } from '../ecs/systems/collision.js';
import { updatePipelineSettings, setGodraysLight, removeGodrays, type HD2DPipeline } from '../rendering/hd2d-pipeline.js';

const FADE_OUT_MS = 800;
const HOLD_BLACK_MS = 200;
const FADE_IN_MS = 800;

export interface RoomManagerDeps {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  pipeline: HD2DPipeline;
}

/**
 * Manages room loading/unloading with a transition state machine.
 * Fade overlay is a CSS div (cheaper than WebGL overlay).
 *
 * Exposes state properties that RoomTransitionSystem reads each frame
 * and syncs into the ECS GameState singleton.
 */
export class RoomManager {
  private deps: RoomManagerDeps;
  private currentRoom: BuiltRoom | null = null;
  private transitioning = false;
  private fadeOverlay: HTMLDivElement;
  private abortController: AbortController | null = null;

  /** Current door triggers — read by RoomTransitionSystem */
  doorTriggers: DoorTrigger[] = [];

  /** Exposed state — synced to ECS GameState by RoomTransitionSystem each frame */
  currentRoomId: RoomIdValue = 1 as RoomIdValue;
  transitionState: TransitionStateValue = TransitionState.IDLE;
  teleported = false;

  /** Pending player spawn — consumed by RoomTransitionSystem */
  pendingSpawn: { x: number; y: number; z: number } | null = null;

  /** Pending flicker lights — consumed by RoomTransitionSystem to create ECS entities */
  pendingFlickerLights: THREE.PointLight[] = [];

  /** Active particle systems for the current room — updated each frame */
  private activeParticles: ParticleSystem[] = [];

  constructor(deps: RoomManagerDeps) {
    this.deps = deps;

    // Create fade overlay
    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.id = 'room-fade-overlay';
    Object.assign(this.fadeOverlay.style, {
      position: 'fixed',
      inset: '0',
      background: '#000',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '50',
      transition: 'none',
    });
    document.body.appendChild(this.fadeOverlay);
  }

  get isTransitioning(): boolean {
    return this.transitioning;
  }

  /**
   * Load a room immediately (no transition animation). Used for initial room load.
   */
  async loadRoom(roomId: RoomIdValue): Promise<void> {
    if (!hasRoomData(roomId)) {
      console.warn(`[RoomManager] No room data for room ${roomId}`);
      return;
    }

    // Unload current room if any
    if (this.currentRoom) {
      this.unloadCurrentRoom();
    }

    const data = getRoomData(roomId)!;
    const built = buildRoom(data);

    // Add room to scene
    this.deps.scene.add(built.group);
    this.currentRoom = built;
    this.currentRoomId = roomId;
    this.doorTriggers = built.doorTriggers;

    // Update collision bounds
    CollisionSystem.roomBounds = built.bounds;

    // Apply per-room post-processing overrides
    if (data.postProcessOverrides) {
      updatePipelineSettings(this.deps.pipeline, data.postProcessOverrides);
    }

    // Set up god rays if room has them and a directional light
    if (data.godRays && built.directionalLight) {
      setGodraysLight(this.deps.pipeline, built.directionalLight, this.deps.camera, {
        color: new THREE.Color(data.godRays.color ?? 0xffffff),
        density: data.godRays.density ?? 1 / 128,
        maxDensity: data.godRays.maxDensity ?? 0.5,
      });
    } else {
      removeGodrays(this.deps.pipeline);
    }

    // Queue flicker lights for ECS entity creation (consumed by RoomTransitionSystem)
    this.pendingFlickerLights = built.flickerLights;

    // Store particle systems for per-frame updates
    this.activeParticles = built.particleSystems;

    // Force shadow map update for static scene
    this.deps.renderer.shadowMap.needsUpdate = true;

    // Update exposed state
    this.transitionState = TransitionState.IDLE;
    this.teleported = false;
  }

  /**
   * Transition to a new room with fade-to-black animation.
   */
  async transitionTo(roomId: RoomIdValue, spawnX: number, spawnY: number, spawnZ: number): Promise<void> {
    if (this.transitioning) return;
    if (!hasRoomData(roomId)) {
      console.warn(`[RoomManager] No room data for room ${roomId}, skipping transition`);
      return;
    }

    this.transitioning = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      // --- FADING_OUT ---
      this.transitionState = TransitionState.FADING_OUT;
      await this.fade(1, FADE_OUT_MS, signal);

      if (signal.aborted) return;

      // --- UNLOADING ---
      this.transitionState = TransitionState.UNLOADING;
      this.unloadCurrentRoom();

      // --- LOADING ---
      this.transitionState = TransitionState.LOADING;
      this.currentRoomId = roomId;

      const data = getRoomData(roomId)!;
      const built = buildRoom(data);

      this.deps.scene.add(built.group);
      this.currentRoom = built;
      this.doorTriggers = built.doorTriggers;

      // Update collision bounds
      CollisionSystem.roomBounds = built.bounds;

      // Apply per-room post-processing
      if (data.postProcessOverrides) {
        updatePipelineSettings(this.deps.pipeline, data.postProcessOverrides);
      }

      // Set up god rays if room has them and a directional light
      if (data.godRays && built.directionalLight) {
        setGodraysLight(this.deps.pipeline, built.directionalLight, this.deps.camera, {
          color: new THREE.Color(data.godRays.color ?? 0xffffff),
          density: data.godRays.density ?? 1 / 128,
          maxDensity: data.godRays.maxDensity ?? 0.5,
        });
      } else {
        removeGodrays(this.deps.pipeline);
      }

      // Queue flicker lights for ECS entity creation
      this.pendingFlickerLights = built.flickerLights;

      // Store particle systems for per-frame updates
      this.activeParticles = built.particleSystems;

      // Queue player spawn (consumed by RoomTransitionSystem)
      this.pendingSpawn = { x: spawnX, y: spawnY, z: spawnZ };

      // Force shadow map update
      this.deps.renderer.shadowMap.needsUpdate = true;

      // Hold black
      await this.delay(HOLD_BLACK_MS, signal);
      if (signal.aborted) return;

      // --- FADING_IN ---
      this.transitionState = TransitionState.FADING_IN;
      this.teleported = true;
      await this.fade(0, FADE_IN_MS, signal);

      // Back to IDLE
      this.transitionState = TransitionState.IDLE;
    } finally {
      this.transitioning = false;
      this.abortController = null;
    }
  }

  /**
   * Update all active particle systems. Called once per frame from the game loop.
   */
  updateParticles(dt: number): void {
    for (const ps of this.activeParticles) {
      ps.update(dt);
    }
  }

  /**
   * Dispose the RoomManager and all its resources.
   */
  dispose(): void {
    this.abortController?.abort();
    this.unloadCurrentRoom();
    this.fadeOverlay.remove();
  }

  private unloadCurrentRoom(): void {
    if (!this.currentRoom) return;

    this.activeParticles = [];
    this.deps.scene.remove(this.currentRoom.group);
    disposeRoom(this.currentRoom.group);
    this.currentRoom = null;
    this.doorTriggers = [];
  }

  private fade(targetOpacity: number, durationMs: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal.aborted) { resolve(); return; }

      this.fadeOverlay.style.transition = `opacity ${durationMs}ms ease-in-out`;
      this.fadeOverlay.style.opacity = String(targetOpacity);

      const onEnd = () => {
        this.fadeOverlay.removeEventListener('transitionend', onEnd);
        resolve();
      };
      this.fadeOverlay.addEventListener('transitionend', onEnd);

      // Safety timeout in case transitionend doesn't fire
      setTimeout(() => {
        this.fadeOverlay.removeEventListener('transitionend', onEnd);
        resolve();
      }, durationMs + 100);
    });
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal.aborted) { resolve(); return; }
      setTimeout(resolve, ms);
    });
  }
}

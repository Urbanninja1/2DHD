import type { HD2DPipeline } from '../rendering/hd2d-pipeline.js';
import { RoomTransitionSystem } from '../ecs/systems/room-transition.js';
import { RoomId, type RoomIdValue } from '../ecs/components/singletons.js';

/**
 * Dev-mode debug overlay.
 * Keyboard shortcuts to toggle post-processing effects.
 * Number keys 1-0 to teleport to rooms (skips transitions).
 * Compiled out via import.meta.env.DEV guard in main.ts.
 */
export interface DebugOverlay {
  dispose: () => void;
}

const ROOM_NAMES: Record<number, string> = {
  [RoomId.ThroneRoom]: 'Throne Room',
  [RoomId.Antechamber]: 'Antechamber',
  [RoomId.SmallCouncil]: 'Small Council',
  [RoomId.HandsSolar]: "Hand's Solar",
  [RoomId.GrandGallery]: 'Grand Gallery',
  [RoomId.GuardPost]: 'Guard Post',
  [RoomId.MaegorsEntry]: "Maegor's Entry",
  [RoomId.QueensBallroom]: "Queen's Ballroom",
  [RoomId.TowerStairwell]: 'Tower Stairwell',
  [RoomId.Battlements]: 'Battlements',
};

export function createDebugOverlay(pipeline: HD2DPipeline): DebugOverlay {
  const controller = new AbortController();
  const opts: AddEventListenerOptions = { signal: controller.signal };

  // On-screen info panel
  const panel = document.createElement('div');
  panel.id = 'debug-overlay';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '60px',
    right: '8px',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: '12px',
    background: 'rgba(0,0,0,0.6)',
    padding: '6px 10px',
    borderRadius: '4px',
    zIndex: '100',
    pointerEvents: 'none',
    lineHeight: '1.5',
    whiteSpace: 'pre',
  });
  document.body.appendChild(panel);

  const effects = {
    bloom: true,
    tiltShift: true,
    vignette: true,
    toneMapping: true,
    ssao: true,
    godrays: true,
  };

  function updatePanel(): void {
    const rm = RoomTransitionSystem.roomManager;
    const roomName = rm ? (ROOM_NAMES[rm.currentRoomId] ?? `Room ${rm.currentRoomId}`) : '---';

    const lines = [
      `[Room: ${roomName}]`,
      '',
      '[Debug Controls]',
      `F1: Bloom      ${effects.bloom ? 'ON' : 'OFF'}`,
      `F2: TiltShift  ${effects.tiltShift ? 'ON' : 'OFF'}`,
      `F3: Vignette   ${effects.vignette ? 'ON' : 'OFF'}`,
      `F4: ToneMap    ${effects.toneMapping ? 'ON' : 'OFF'}`,
      `F5: SSAO       ${effects.ssao ? 'ON' : 'OFF'}`,
      `F6: GodRays    ${effects.godrays ? 'ON' : 'OFF'}`,
      '',
      '1-9,0: Teleport to room',
    ];
    panel.textContent = lines.join('\n');
  }
  updatePanel();

  // Update panel periodically to show current room
  const panelInterval = setInterval(updatePanel, 500);

  // Number key → room ID mapping (1-9 for rooms 1-9, 0 for room 10)
  const keyToRoom: Record<string, RoomIdValue> = {
    'Digit1': RoomId.ThroneRoom,
    'Digit2': RoomId.Antechamber,
    'Digit3': RoomId.SmallCouncil,
    'Digit4': RoomId.HandsSolar,
    'Digit5': RoomId.GrandGallery,
    'Digit6': RoomId.GuardPost,
    'Digit7': RoomId.MaegorsEntry,
    'Digit8': RoomId.QueensBallroom,
    'Digit9': RoomId.TowerStairwell,
    'Digit0': RoomId.Battlements,
  };

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    switch (e.code) {
      case 'F1':
        e.preventDefault();
        effects.bloom = !effects.bloom;
        pipeline.bloomPass.enabled = effects.bloom;
        updatePanel();
        break;
      case 'F2':
        e.preventDefault();
        effects.tiltShift = !effects.tiltShift;
        pipeline.tiltShiftPass.enabled = effects.tiltShift;
        updatePanel();
        break;
      case 'F3':
        e.preventDefault();
        effects.vignette = !effects.vignette;
        pipeline.vignetteEffect.blendMode.opacity.value = effects.vignette ? 1 : 0;
        updatePanel();
        break;
      case 'F4':
        e.preventDefault();
        effects.toneMapping = !effects.toneMapping;
        pipeline.toneMappingEffect.blendMode.opacity.value = effects.toneMapping ? 1 : 0;
        updatePanel();
        break;
      case 'F5':
        e.preventDefault();
        effects.ssao = !effects.ssao;
        pipeline.n8aoPass.enabled = effects.ssao;
        updatePanel();
        break;
      case 'F6':
        e.preventDefault();
        effects.godrays = !effects.godrays;
        if (pipeline.godraysPass) {
          pipeline.godraysPass.enabled = effects.godrays;
        }
        updatePanel();
        break;
      default: {
        // Number key teleport
        const roomId = keyToRoom[e.code];
        if (roomId !== undefined) {
          const rm = RoomTransitionSystem.roomManager;
          if (rm && !rm.isTransitioning && rm.currentRoomId !== roomId) {
            // Direct load (skip fade transition for fast testing)
            rm.loadRoom(roomId);
            // Queue spawn at room center
            rm.pendingSpawn = { x: 0, y: 0, z: 0 };
            rm.teleported = true;
          }
        }
        break;
      }
    }
  }, opts);

  return {
    dispose(): void {
      controller.abort();
      clearInterval(panelInterval);
      panel.remove();
    },
  };
}

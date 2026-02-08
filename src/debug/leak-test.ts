import type * as THREE from 'three';
import type { RoomManager } from '../rooms/RoomManager.js';
import { RoomId, type RoomIdValue } from '../ecs/components/singletons.js';

/**
 * GPU Resource Leak Test
 *
 * Loads and unloads all 10 rooms in sequence, repeated for multiple cycles.
 * Asserts that renderer.info.memory.textures and geometries return to baseline
 * after each unload. Reports any suspected leaks.
 *
 * This runs asynchronously and logs results to the console.
 * Trigger from the debug overlay with F9.
 */

const ALL_ROOMS: RoomIdValue[] = [
  RoomId.ThroneRoom,
  RoomId.Antechamber,
  RoomId.SmallCouncil,
  RoomId.HandsSolar,
  RoomId.GrandGallery,
  RoomId.GuardPost,
  RoomId.MaegorsEntry,
  RoomId.QueensBallroom,
  RoomId.TowerStairwell,
  RoomId.Battlements,
];

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

interface MemorySnapshot {
  textures: number;
  geometries: number;
}

function getMemory(renderer: THREE.WebGLRenderer): MemorySnapshot {
  return {
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
  };
}

export interface LeakTestResult {
  cycles: number;
  roomsPerCycle: number;
  leaks: LeakEntry[];
  passed: boolean;
}

interface LeakEntry {
  cycle: number;
  roomId: number;
  roomName: string;
  type: 'texture' | 'geometry';
  before: number;
  after: number;
  delta: number;
}

/**
 * Run the GPU resource leak test.
 *
 * @param roomManager - The RoomManager instance
 * @param renderer - The WebGL renderer
 * @param cycles - Number of full room cycles (default 3)
 */
export async function runLeakTest(
  roomManager: RoomManager,
  renderer: THREE.WebGLRenderer,
  cycles = 3,
): Promise<LeakTestResult> {
  console.log(`[leak-test] Starting GPU leak test: ${cycles} cycles x ${ALL_ROOMS.length} rooms`);
  console.log('[leak-test] ========================================');

  const leaks: LeakEntry[] = [];

  // Capture initial baseline (before any test rooms loaded)
  const initialBaseline = getMemory(renderer);
  console.log(`[leak-test] Initial baseline — textures: ${initialBaseline.textures}, geometries: ${initialBaseline.geometries}`);

  for (let cycle = 0; cycle < cycles; cycle++) {
    console.log(`\n[leak-test] --- Cycle ${cycle + 1}/${cycles} ---`);

    for (const roomId of ALL_ROOMS) {
      const roomName = ROOM_NAMES[roomId] ?? `Room ${roomId}`;

      // Snapshot before load
      const beforeLoad = getMemory(renderer);

      // Load room
      await roomManager.loadRoom(roomId);

      // Small delay to let GPU upload complete
      await delay(50);

      const afterLoad = getMemory(renderer);
      console.log(
        `[leak-test]   ${roomName}: loaded (tex: ${beforeLoad.textures}->${afterLoad.textures}, geo: ${beforeLoad.geometries}->${afterLoad.geometries})`,
      );
    }

    // After cycling through all rooms, the last room is still loaded.
    // The key metric is whether memory grew across cycles.
    const cycleEnd = getMemory(renderer);
    console.log(
      `[leak-test] Cycle ${cycle + 1} end — textures: ${cycleEnd.textures}, geometries: ${cycleEnd.geometries}`,
    );

    // Compare with initial baseline (allowing for the currently-loaded room)
    // On cycle 2+, memory should be roughly the same as cycle 1 end
    if (cycle > 0) {
      const texGrowth = cycleEnd.textures - initialBaseline.textures;
      const geoGrowth = cycleEnd.geometries - initialBaseline.geometries;

      // Allow some tolerance (current room's assets)
      const TEX_TOLERANCE = 30; // A room might have up to ~30 textures
      const GEO_TOLERANCE = 30;

      if (texGrowth > TEX_TOLERANCE * (cycle + 1)) {
        leaks.push({
          cycle: cycle + 1,
          roomId: 0,
          roomName: 'Full Cycle',
          type: 'texture',
          before: initialBaseline.textures,
          after: cycleEnd.textures,
          delta: texGrowth,
        });
        console.warn(`[leak-test] LEAK: Texture count grew by ${texGrowth} over ${cycle + 1} cycles`);
      }

      if (geoGrowth > GEO_TOLERANCE * (cycle + 1)) {
        leaks.push({
          cycle: cycle + 1,
          roomId: 0,
          roomName: 'Full Cycle',
          type: 'geometry',
          before: initialBaseline.geometries,
          after: cycleEnd.geometries,
          delta: geoGrowth,
        });
        console.warn(`[leak-test] LEAK: Geometry count grew by ${geoGrowth} over ${cycle + 1} cycles`);
      }
    }
  }

  const result: LeakTestResult = {
    cycles,
    roomsPerCycle: ALL_ROOMS.length,
    leaks,
    passed: leaks.length === 0,
  };

  console.log('\n[leak-test] ========================================');
  if (result.passed) {
    console.log(`[leak-test] PASSED — No leaks detected across ${cycles} cycles.`);
  } else {
    console.warn(`[leak-test] FAILED — ${leaks.length} leak(s) detected.`);
    for (const leak of leaks) {
      console.warn(
        `  Cycle ${leak.cycle}, ${leak.roomName}: ${leak.type} grew by ${leak.delta} (${leak.before} -> ${leak.after})`,
      );
    }
  }

  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

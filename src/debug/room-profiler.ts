import type * as THREE from 'three';

/**
 * Per-room performance profiler.
 * Logs renderer.info metrics on room load and tracks delta to detect leaks.
 *
 * Budget targets (from plan):
 * - < 60 draw calls per room
 * - < 100MB total GPU memory
 * - 60fps sustained
 */

interface RoomSnapshot {
  roomId: number;
  roomName: string;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  timestamp: number;
}

const history: RoomSnapshot[] = [];

/**
 * Capture and log renderer.info for the current room.
 * Call after a room is fully loaded and one frame has rendered.
 */
export function profileRoom(
  renderer: THREE.WebGLRenderer,
  roomId: number,
  roomName: string,
): RoomSnapshot {
  const info = renderer.info;
  const snapshot: RoomSnapshot = {
    roomId,
    roomName,
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    textures: info.memory.textures,
    geometries: info.memory.geometries,
    timestamp: performance.now(),
  };

  const prev = history.length > 0 ? history[history.length - 1]! : null;
  const texDelta = prev ? snapshot.textures - prev.textures : 0;
  const geoDelta = prev ? snapshot.geometries - prev.geometries : 0;

  const warn = snapshot.drawCalls > 60 ? ' ⚠ OVER BUDGET' : '';

  console.log(
    `[profiler] Room ${roomId} "${roomName}"${warn}\n` +
    `  draw calls: ${snapshot.drawCalls}, triangles: ${snapshot.triangles}\n` +
    `  textures: ${snapshot.textures} (${texDelta >= 0 ? '+' : ''}${texDelta}), ` +
    `geometries: ${snapshot.geometries} (${geoDelta >= 0 ? '+' : ''}${geoDelta})`,
  );

  if (texDelta > 20) {
    console.warn(`[profiler] ⚠ Texture count jumped by ${texDelta} — possible leak`);
  }
  if (geoDelta > 20) {
    console.warn(`[profiler] ⚠ Geometry count jumped by ${geoDelta} — possible leak`);
  }

  history.push(snapshot);
  return snapshot;
}

/**
 * Log a disposal summary (call after unloading a room).
 */
export function profileDisposal(
  renderer: THREE.WebGLRenderer,
  roomId: number,
  roomName: string,
): void {
  const info = renderer.info;
  const prev = history.length > 0 ? history[history.length - 1]! : null;
  const textures = info.memory.textures;
  const geometries = info.memory.geometries;

  if (prev) {
    const texDelta = textures - prev.textures;
    const geoDelta = geometries - prev.geometries;
    console.log(
      `[profiler] Unloaded Room ${roomId} "${roomName}"\n` +
      `  textures: ${textures} (${texDelta >= 0 ? '+' : ''}${texDelta}), ` +
      `geometries: ${geometries} (${geoDelta >= 0 ? '+' : ''}${geoDelta})`,
    );

    if (texDelta >= 0) {
      console.warn(`[profiler] ⚠ Textures did not decrease after unload — leak likely`);
    }
  }
}

/**
 * Get the full profiling history (for advanced analysis).
 */
export function getProfilingHistory(): readonly RoomSnapshot[] {
  return history;
}

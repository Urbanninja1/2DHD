import type { RoomIdValue } from '../../ecs/components/singletons.js';
import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';
import throneRoom from './01-throne-room.js';
import antechamber from './02-antechamber.js';

const roomRegistry = new Map<RoomIdValue, RoomData>([
  [RoomId.ThroneRoom, throneRoom],
  [RoomId.Antechamber, antechamber],
]);

export function getRoomData(id: RoomIdValue): RoomData | undefined {
  return roomRegistry.get(id);
}

export function hasRoomData(id: RoomIdValue): boolean {
  return roomRegistry.has(id);
}

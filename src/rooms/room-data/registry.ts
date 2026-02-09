import type { RoomIdValue } from '../../ecs/components/singletons.js';
import { RoomId } from '../../ecs/components/singletons.js';
import type { RoomData } from './types.js';
import throneRoom from './01-throne-room.js';
import antechamber from './02-antechamber.js';
import smallCouncil from './03-small-council.js';
import handsSolar from './04-hands-solar.js';
import grandGallery from './05-grand-gallery.js';
import guardPost from './06-guard-post.js';
import maegorsEntry from './07-maegor-entry.js';
import queensBallroom from './08-queens-ballroom.js';
import towerStairwell from './09-tower-stairwell.js';
import battlements from './10-battlements.js';
import ironrathGreatHall from './ironrath/great-hall.generated.js';

const roomRegistry = new Map<RoomIdValue, RoomData>([
  [RoomId.ThroneRoom, throneRoom],
  [RoomId.Antechamber, antechamber],
  [RoomId.SmallCouncil, smallCouncil],
  [RoomId.HandsSolar, handsSolar],
  [RoomId.GrandGallery, grandGallery],
  [RoomId.GuardPost, guardPost],
  [RoomId.MaegorsEntry, maegorsEntry],
  [RoomId.QueensBallroom, queensBallroom],
  [RoomId.TowerStairwell, towerStairwell],
  [RoomId.Battlements, battlements],
  // Ironrath Castle
  [RoomId.IronrathGreatHall, ironrathGreatHall],
]);

export function getRoomData(id: RoomIdValue): RoomData | undefined {
  return roomRegistry.get(id);
}

export function hasRoomData(id: RoomIdValue): boolean {
  return roomRegistry.has(id);
}

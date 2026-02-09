import { component, field } from '@lastolivegames/becsy';

export const TransitionState = {
  IDLE: 0,
  FADING_OUT: 1,
  UNLOADING: 2,
  LOADING: 3,
  FADING_IN: 4,
} as const;

export type TransitionStateValue = (typeof TransitionState)[keyof typeof TransitionState];

// 1-99: Red Keep, 100-199: Ironrath Castle, 200-255: future locations
export const RoomId = {
  ThroneRoom: 1,
  Antechamber: 2,
  SmallCouncil: 3,
  HandsSolar: 4,
  GrandGallery: 5,
  GuardPost: 6,
  MaegorsEntry: 7,
  QueensBallroom: 8,
  TowerStairwell: 9,
  Battlements: 10,
  // Ironrath Castle
  IronrathGreatHall: 101,
} as const;

export type RoomIdValue = (typeof RoomId)[keyof typeof RoomId];

@component
export class GameState {
  @field.uint8 declare currentRoomId: RoomIdValue;
  @field.uint8 declare transitionState: TransitionStateValue;
  @field.boolean declare teleported: boolean;
}

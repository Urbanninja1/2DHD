import { component, field } from '@lastolivegames/becsy';

/**
 * GameClock singleton — tracks in-game time of day.
 * Used for day/night color grading and future NPC schedules.
 */
@component
export class GameClock {
  /** Time of day in hours, range [0.0, 24.0). Wraps at 24.0 -> 0.0. */
  @field.float64 declare timeOfDay: number;
  /** Game minutes per real second. Default: 1.0 */
  @field.float64 declare timeScale: number;
  /** Convenience pause flag. Distinct from timeScale=0 for UI purposes. */
  @field.boolean declare paused: boolean;
}

/** Init helper following transformInit() return-object pattern. */
export function gameClockInit(overrides?: Partial<{ timeOfDay: number; timeScale: number; paused: boolean }>) {
  return { timeOfDay: 10.0, timeScale: 1.0, paused: false, ...overrides };
}

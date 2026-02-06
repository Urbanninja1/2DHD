import { component, field } from '@lastolivegames/becsy';

@component
export class Transform {
  @field.float64 declare px: number;
  @field.float64 declare py: number;
  @field.float64 declare pz: number;
  @field.float64 declare sx: number;
  @field.float64 declare sy: number;
  @field.float64 declare sz: number;
}

/** Default Transform init data — scale 1 prevents invisible entities */
export function transformInit(overrides?: Partial<Record<'px' | 'py' | 'pz' | 'sx' | 'sy' | 'sz', number>>) {
  return { px: 0, py: 0, pz: 0, sx: 1, sy: 1, sz: 1, ...overrides };
}

@component
export class MovementIntent {
  @field.float32 declare dx: number;
  @field.float32 declare dz: number;
}

import { component, field } from '@lastolivegames/becsy';
import type { Object3D, Texture } from 'three';

@component
export class Object3DRef {
  @field.object declare object3d: Object3D;
}

@component
export class SpriteData {
  @field.object declare texture: Texture;
  @field.uint8 declare frameCol: number;
  @field.uint8 declare frameRow: number;
}

@component
export class FlickerLight {
  @field.float32 declare baseIntensity: number;
  @field.uint32 declare baseColor: number;
  @field.float32 declare noiseOffset: number;
}

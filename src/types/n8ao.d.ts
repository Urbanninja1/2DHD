declare module 'n8ao' {
  import type { Pass } from 'postprocessing';
  import type { Scene, PerspectiveCamera, Color } from 'three';

  export interface N8AOConfiguration {
    aoRadius: number;
    intensity: number;
    distanceFalloff: number;
    color: Color;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
  }

  export class N8AOPostPass extends Pass {
    configuration: N8AOConfiguration;
    constructor(scene: Scene, camera: PerspectiveCamera, width?: number, height?: number);
  }

  export class N8AOPass {
    configuration: N8AOConfiguration;
    constructor(scene: Scene, camera: PerspectiveCamera, width?: number, height?: number);
  }
}

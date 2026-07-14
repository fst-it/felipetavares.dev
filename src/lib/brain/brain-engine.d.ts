/**
 * TypeScript declarations for the vendored brain-engine.js (src/lib/brain/brain-engine.js).
 * The JS file is byte-identical to the design handoff — types live here per the tooling-level fix.
 */

export interface BrainConfig {
  /** Trace routing style. Default: 'angular' */
  trace?: 'angular' | 'angular45' | 'straight';
  /** Number of neurons to sample. Default: 300 */
  nodes?: number;
  /** Max connection distance in brain-space (0..1). Default: 0.11 */
  linkDist?: number;
  /** Trace color as [r, g, b]. Default: [255, 150, 70] */
  edgeCol?: [number, number, number];
  /** Base trace alpha (0..1). Default: 0.16 */
  edgeA?: number;
  /** Neuron glow colors (weighted by repetition). */
  nodeCols?: Array<[number, number, number]>;
  /** Signal pulse colors. */
  sigCols?: Array<[number, number, number]>;
  /** Motion intensity 1–10. Default: 7 */
  intensity?: number;
  /** Glow strength 0.4–2. Default: 1.8 */
  glow?: number;
  /** Show skill-label tooltips on hover. Default: true */
  labels?: boolean;
  /** Custom label strings for the 12 labelled neurons. */
  labelTexts?: string[];
}

export interface BrainInstance {
  /** Tears down the animation, removes event listeners, disconnects ResizeObserver. */
  destroy(): void;
  /** Live-tunes config without recreating the mesh. */
  set(opts: Partial<BrainConfig>): void;
}

/** Creates and starts the brain animation on the given canvas element. */
export declare function createBrainMesh(
  canvas: HTMLCanvasElement,
  config: BrainConfig
): BrainInstance;

/**
 * TypeScript declarations for the vendored brain-config-1b.js.
 * The JS file is byte-identical to the design handoff — types live here per the tooling-level fix.
 */
import type { BrainConfig } from './brain-engine.js';

/** Option 1b "Deep Signal" config — blue-led, straight synapse lines. */
export declare const BRAIN_CONFIG_1B: Required<Pick<BrainConfig,
  'trace' | 'nodes' | 'linkDist' | 'edgeCol' | 'edgeA' |
  'nodeCols' | 'sigCols' | 'intensity' | 'glow' | 'labels'
>>;

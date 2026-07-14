/**
 * Option 1b "Deep Signal" — blue-led, straight synapse lines.
 * Pass to createBrainMesh(canvas, BRAIN_CONFIG_1B).
 */
const BRAIN_CONFIG_1B = {
  trace: 'straight',
  nodes: 320,
  linkDist: 0.105,
  edgeCol: [100, 175, 255],    // blue lines
  edgeA: 0.15,
  nodeCols: [                  // blue dominant, orange + green accents
    [93, 182, 255], [93, 182, 255],
    [140, 203, 255],
    [255, 140, 60],
    [47, 191, 143],
  ],
  sigCols: [
    [120, 195, 255], [120, 195, 255],
    [255, 150, 60], [90, 225, 175],
  ],
  intensity: 7,
  glow: 1.8,
  labels: true,
};
if (typeof module !== 'undefined' && module.exports) module.exports = { BRAIN_CONFIG_1B };

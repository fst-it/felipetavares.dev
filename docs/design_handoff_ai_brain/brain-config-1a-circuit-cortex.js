/**
 * Option 1a "Circuit Cortex" — orange-led, right-angle circuit traces.
 * Pass to createBrainMesh(canvas, BRAIN_CONFIG_1A).
 */
const BRAIN_CONFIG_1A = {
  trace: 'angular',            // single right-angle elbow per trace
  nodes: 300,
  linkDist: 0.11,
  edgeCol: [255, 150, 70],     // orange traces
  edgeA: 0.16,
  nodeCols: [                  // weighted: orange dominant, blue + green accents
    [255, 140, 60], [255, 140, 60],
    [93, 182, 255], [63, 169, 255],
    [47, 191, 143],
  ],
  sigCols: [
    [255, 160, 70], [255, 160, 70],
    [110, 190, 255], [80, 220, 170],
  ],
  intensity: 7,
  glow: 1.8,
  labels: true,
};
if (typeof module !== 'undefined' && module.exports) module.exports = { BRAIN_CONFIG_1A };

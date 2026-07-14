/**
 * Option 1c "Emerald Grid" — green-led, 45° chamfered circuit traces.
 * Pass to createBrainMesh(canvas, BRAIN_CONFIG_1C).
 */
const BRAIN_CONFIG_1C = {
  trace: 'angular45',          // diagonal-then-axis traces (PCB style)
  nodes: 290,
  linkDist: 0.11,
  edgeCol: [90, 210, 160],     // green traces
  edgeA: 0.15,
  nodeCols: [                  // green dominant, orange + blue accents
    [80, 215, 165], [80, 215, 165],
    [255, 140, 60],
    [93, 182, 255],
    [255, 170, 90],
  ],
  sigCols: [
    [255, 160, 70],
    [120, 230, 180], [120, 230, 180],
    [110, 190, 255],
  ],
  intensity: 7,
  glow: 1.8,
  labels: true,
};
if (typeof module !== 'undefined' && module.exports) module.exports = { BRAIN_CONFIG_1C };

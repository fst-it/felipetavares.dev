/**
 * Brand mark geometry — V5d dual-hemisphere brain, single source of truth.
 *
 * TWO drawings exported:
 *
 * (a) MICRO_BRAIN — for size < 48 (header 28px, chat pill, footer 22px, favicon).
 *     viewBox 24×24. Two solid hemisphere blobs (left fill var(--brand-warm), right fill
 *     var(--accent)), organic rounded-brain silhouettes, separated by a ~2-unit vertical gap,
 *     plus ONE bridge stroke (stroke-width 2.5, orange→blue linearGradient) crossing the gap
 *     at mid-height. 3 visual elements total. Legible at 16px.
 *
 * (b) FULL_CONSTELLATION — for size ≥ 48 (OG image, and HeroBlueprint's art-directed brain).
 *     viewBox 100×84. 12 domain nodes, 4 satellites per hemisphere, curved quadratic edges,
 *     left hemisphere orange family, right hemisphere blue family, AI node bridges centre.
 *     Art-directed coordinates (hand-crafted, not force-simulated).
 *
 * Consumed by:
 *   - `BrandMark.astro` — renders micro at size<48, full at size≥48.
 *   - `ChatWidget.tsx` (React island) — always micro (22px).
 *   - `BaseLayout.astro` pre-hydration shell — always micro (22px).
 *   - `HeroBlueprint.tsx` — full constellation (replaces the generative graph).
 *   - `src/lib/og-image.tsx` — imports module at build-time for coords, hardcodes hex (satori
 *     can't resolve CSS vars). This is the documented structural exception — coordinates still
 *     come from a single source.
 *
 * `public/favicon.svg` stays a static file (can't import TS); it mirrors MICRO_BRAIN
 * coordinates and carries a comment pointing here.
 */

/* ─────────────────────────── MICRO-BRAIN (viewBox 24×24) ─────────────────────────── */

/** Left blob — organic rounded-brain silhouette, warm hemisphere. */
export const MICRO_LEFT_PATH =
  'M11.5 4 C5 4 2 8 2 12 C2 16 5 20 11.5 20 L11.5 4Z';

/** Right blob — organic rounded-brain silhouette, cool hemisphere. */
export const MICRO_RIGHT_PATH =
  'M12.5 4 C19 4 22 8 22 12 C22 16 19 20 12.5 20 L12.5 4Z';

/** Bridge stroke crossing the gap at mid-height (orange→blue gradient). */
export const MICRO_BRIDGE_PATH = 'M11 12 Q12 11.2 13 12';
export const MICRO_BRIDGE_X1 = 11;
export const MICRO_BRIDGE_Y1 = 12;
export const MICRO_BRIDGE_X2 = 13;
export const MICRO_BRIDGE_Y2 = 12;

/* ─────────── FULL CONSTELLATION (viewBox "0 0 100 84") — art-directed ─────────── */

/**
 * 12 domain nodes, mapped by slug from the site singleton skillDomains.
 * Positions are hand-placed — top-view brain: LEFT hemisphere = warm orange family
 * (strategy/leadership), RIGHT = blue family (architecture/engineering).
 * Midline gap x∈[44,56] empty except the AI node.
 *
 * Each node carries:
 *   id        — matches slugifyDomain(name)
 *   cx, cy    — position in viewBox 0 0 100 84
 *   r         — radius
 *   isAiNode  — true for the AI bridge node
 *   side      — 'left' | 'right' | 'center'
 *   colorVar  — CSS custom property for fill/stroke
 *   href      — deep-link target
 *   labelAnchor — where to place the text label ('left'|'right'|'above'|'below')
 */
export interface ConstellationNode {
  id: string;
  cx: number;
  cy: number;
  r: number;
  isAiNode: boolean;
  side: 'left' | 'right' | 'center';
  colorVar: string;
  href: string;
  labelAnchor: 'left' | 'right' | 'above' | 'below';
  /** Optional y-nudge (in viewBox units) applied to the computed label position — positive
   *  moves the label down, negative up. Used to resolve geometric overlaps without changing
   *  anchor semantics or node coordinates (short-label overlap-fix pass). */
  labelYOffset?: number;
}

export const CONSTELLATION_NODES: ConstellationNode[] = [
  // ── LEFT hemisphere — orange family (strategy/leadership)
  // Digital & IT Strategy  (37,13) r4
  {
    id: 'digital-strategy-and-it-strategy',
    cx: 37, cy: 13, r: 4,
    isAiNode: false, side: 'left',
    colorVar: '--brand-warm',
    href: '/experience/dossier',
    labelAnchor: 'left',
  },
  // Technology Leadership & Org Design  (22,21) r4.5
  {
    id: 'technology-leadership-and-org-design',
    cx: 22, cy: 21, r: 4.5,
    isAiNode: false, side: 'left',
    colorVar: '--brand-warm',
    href: '/experience/dossier',
    labelAnchor: 'left',
  },
  // Portfolio & Program Management  (14,37) r4
  {
    id: 'portfolio-and-program-management',
    cx: 14, cy: 37, r: 4,
    isAiNode: false, side: 'left',
    colorVar: '--brand-warm',
    href: '/experience/dossier',
    labelAnchor: 'left',
  },
  // Product Management & Agile Delivery  (17,54) r4.5
  {
    id: 'product-management-and-agile-delivery',
    cx: 17, cy: 54, r: 4.5,
    isAiNode: false, side: 'left',
    colorVar: '--brand-warm',
    href: '/experience/dossier',
    labelAnchor: 'left',
  },
  // Data Management & Analytics  (30,66) r4
  {
    id: 'data-management-and-analytics',
    cx: 30, cy: 66, r: 4,
    isAiNode: false, side: 'left',
    colorVar: '--brand-warm',
    href: '/experience',
    labelAnchor: 'below',
  },
  // ── RIGHT hemisphere — blue family (architecture/engineering)
  // Enterprise & Business Architecture  (63,13) r4.5
  {
    id: 'enterprise-and-business-architecture',
    cx: 63, cy: 13, r: 4.5,
    isAiNode: false, side: 'right',
    colorVar: '--accent',
    href: '/experience/dossier',
    labelAnchor: 'above',
  },
  // Data Architecture & Engineering  (78,24) r4  — nudged cy 21→24 to separate its label row
  // from Technology Leadership & Org Design (also cy=21), which share the same viewport y-band.
  {
    id: 'data-architecture-and-engineering',
    cx: 78, cy: 24, r: 4,
    isAiNode: false, side: 'right',
    colorVar: '--accent',
    href: '/experience',
    labelAnchor: 'left',
  },
  // Cloud & Platform Architecture  (86,37) r4.5  — labelYOffset:-5 (short-label overlap-fix pass)
  // nudges the label up from the default y:[35,39] to y:[30,34], clearing the AI node top rim at
  // y≈35.5; without the offset the 'left'-anchored label's y-band clips the AI bridge node circle.
  {
    id: 'cloud-and-platform-architecture',
    cx: 86, cy: 37, r: 4.5,
    isAiNode: false, side: 'right',
    colorVar: '--accent',
    href: '/experience',
    labelAnchor: 'left',
    labelYOffset: -5,
  },
  // Integration Architecture  (83,54) r4
  {
    id: 'integration-architecture',
    cx: 83, cy: 54, r: 4,
    isAiNode: false, side: 'right',
    colorVar: '--accent',
    href: '/experience',
    labelAnchor: 'left',
  },
  // SAP Delivery, Strategy & Architecture  (70,66) r4  — anchor changed left→below (short-label
  // overlap-fix pass) so "SAP Delivery" label sits below the node (y≈75–79) and clears the
  // "Software Eng" node at (60,70); the previous 'left' anchor caused the full label to clip
  // the Software node.
  {
    id: 'sap-delivery-strategy-and-architecture',
    cx: 70, cy: 66, r: 4,
    isAiNode: false, side: 'right',
    colorVar: '--accent',
    href: '/experience',
    labelAnchor: 'below',
  },
  // Software & Agentic Engineering  (60,70) r4  — moved cx 57→60 so left edge (56) clears the
  // midline gap x∈[44,56] which must contain only the AI bridge node; anchor changed above→below
  // (short-label overlap-fix pass) so "Software Eng" label sits below at y≈79–83, clearing the
  // SAP node at (70,66) — the previous 'above' anchor caused the label to clip that node.
  {
    id: 'software-and-agentic-engineering',
    cx: 60, cy: 70, r: 4,
    isAiNode: false, side: 'right',
    colorVar: '--accent',
    href: '/experience',
    labelAnchor: 'below',
  },
  // ── CENTER BRIDGE — AI & Agentic Engineering  (50,41) r5.5
  {
    id: 'ai-and-agentic-engineering',
    cx: 50, cy: 41, r: 5.5,
    isAiNode: true, side: 'center',
    colorVar: '--accent-2',
    href: '#chat',
    labelAnchor: 'above',
  },
];

/**
 * Satellites — 4 per hemisphere (not the AI node), r 1–1.5, 60% opacity,
 * placed between main nodes along the outline.
 * id: `${parentId}-sat-${k}`
 */
export interface ConstellationSatellite {
  id: string;
  cx: number;
  cy: number;
  r: number;
  colorVar: string;
  side: 'left' | 'right';
}

export const CONSTELLATION_SATELLITES: ConstellationSatellite[] = [
  // LEFT satellites — orange family
  { id: 'digital-strategy-and-it-strategy-sat-0',          cx: 29, cy:  7, r: 1.2, colorVar: '--brand-warm', side: 'left' },
  { id: 'technology-leadership-and-org-design-sat-0',       cx: 11, cy: 28, r: 1.4, colorVar: '--brand-warm', side: 'left' },
  { id: 'portfolio-and-program-management-sat-0',           cx:  9, cy: 47, r: 1.2, colorVar: '--brand-warm', side: 'left' },
  { id: 'data-management-and-analytics-sat-0',              cx: 22, cy: 73, r: 1.3, colorVar: '--brand-warm', side: 'left' },
  // RIGHT satellites — blue family
  { id: 'enterprise-and-business-architecture-sat-0',       cx: 71, cy:  7, r: 1.2, colorVar: '--accent',    side: 'right' },
  { id: 'data-architecture-and-engineering-sat-0',          cx: 89, cy: 28, r: 1.4, colorVar: '--accent',    side: 'right' },
  { id: 'cloud-and-platform-architecture-sat-0',            cx: 91, cy: 47, r: 1.2, colorVar: '--accent',    side: 'right' },
  { id: 'sap-delivery-strategy-and-architecture-sat-0',     cx: 78, cy: 73, r: 1.3, colorVar: '--accent',    side: 'right' },
];

/**
 * Curved quadratic edges — per hemisphere, chain mains along the outline + 2–3 interior chords.
 * AI bridge connects to the 3 geometrically nearest nodes per side with gradient strokes.
 * Format: SVG path `d` attribute (quadratic Bézier 'M x y Q cx cy x2 y2').
 * strokeWidth: 0.9 normal, 1.2 for bridge edges.
 * isBridge: true for edges touching the AI node.
 */
export interface ConstellationEdge {
  d: string;
  isBridge: boolean;
  side: 'left' | 'right' | 'bridge';
  strokeWidth: number;
}

export const CONSTELLATION_EDGES: ConstellationEdge[] = [
  // ── LEFT hemisphere edges — orange, fold-like curves bowing toward hemisphere center (~25,40)
  // Outline chain: Digital Strategy → Tech Leadership → Portfolio → Product Mgmt → Data Mgmt
  { d: 'M37 13 Q30 16 22 21',  isBridge: false, side: 'left', strokeWidth: 0.9 }, // DS→TL
  { d: 'M22 21 Q17 29 14 37',  isBridge: false, side: 'left', strokeWidth: 0.9 }, // TL→Portf
  { d: 'M14 37 Q14 46 17 54',  isBridge: false, side: 'left', strokeWidth: 0.9 }, // Portf→Prod
  { d: 'M17 54 Q22 61 30 66',  isBridge: false, side: 'left', strokeWidth: 0.9 }, // Prod→Data
  // Interior chords (bowing toward center)
  { d: 'M37 13 Q28 25 17 54',  isBridge: false, side: 'left', strokeWidth: 0.9 }, // DS→Prod (long interior)
  { d: 'M22 21 Q22 44 30 66',  isBridge: false, side: 'left', strokeWidth: 0.9 }, // TL→Data

  // ── RIGHT hemisphere edges — blue, fold-like curves bowing toward hemisphere center (~75,40)
  // Outline chain: Enterprise → Data Arch → Cloud → Integration → SAP → Software
  { d: 'M63 13 Q71 17 78 24',  isBridge: false, side: 'right', strokeWidth: 0.9 }, // Ent→DataArch
  { d: 'M78 24 Q83 31 86 37',  isBridge: false, side: 'right', strokeWidth: 0.9 }, // DataArch→Cloud
  { d: 'M86 37 Q85 46 83 54',  isBridge: false, side: 'right', strokeWidth: 0.9 }, // Cloud→Int
  { d: 'M83 54 Q78 61 70 66',  isBridge: false, side: 'right', strokeWidth: 0.9 }, // Int→SAP
  { d: 'M70 66 Q63 68 57 70',  isBridge: false, side: 'right', strokeWidth: 0.9 }, // SAP→Software
  // Interior chords
  { d: 'M63 13 Q72 25 83 54',  isBridge: false, side: 'right', strokeWidth: 0.9 }, // Ent→Int (long interior)
  { d: 'M78 24 Q78 45 70 66',  isBridge: false, side: 'right', strokeWidth: 0.9 }, // DataArch→SAP

  // ── AI BRIDGE edges — gradient orange→blue, slightly thicker (1.2)
  // AI node (50,41) connects to 3 nearest per side:
  //   Left: Portfolio (14,37), Product (17,54), Tech Leadership (22,21)
  { d: 'M50 41 Q32 38 14 37',  isBridge: true,  side: 'bridge', strokeWidth: 1.2 }, // AI→Portfolio
  { d: 'M50 41 Q33 48 17 54',  isBridge: true,  side: 'bridge', strokeWidth: 1.2 }, // AI→Product
  { d: 'M50 41 Q36 30 22 21',  isBridge: true,  side: 'bridge', strokeWidth: 1.2 }, // AI→TechLeadership
  //   Right: Cloud (86,37), Integration (83,54), Data Arch (78,21)
  { d: 'M50 41 Q68 38 86 37',  isBridge: true,  side: 'bridge', strokeWidth: 1.2 }, // AI→Cloud
  { d: 'M50 41 Q67 48 83 54',  isBridge: true,  side: 'bridge', strokeWidth: 1.2 }, // AI→Integration
  { d: 'M50 41 Q64 32 78 24',  isBridge: true,  side: 'bridge', strokeWidth: 1.2 }, // AI→DataArch
];

/** Gradient id for the AI bridge stroke: orange→blue, horizontal from x=14 to x=86. */
export const CONSTELLATION_BRIDGE_GRADIENT = {
  id: 'const-bridge',
  x1: 14, y1: 41, x2: 86, y2: 41,
};

/* ─────────── LEGACY SMALL-MARK EXPORTS (preserved for ChatWidget.tsx / BaseLayout.astro) ─────────── */
/**
 * These are re-exported so existing consumers that reference the old geometry names continue to
 * compile unchanged. Commit 1 updates BrandMark.astro to the new micro-brain; ChatWidget.tsx and
 * BaseLayout.astro will be updated in Commit 1 as well to use the micro-brain exports.
 */

export interface HemisphereNode {
  cx: number;
  cy: number;
  r: number;
}

/** @deprecated — use MICRO_* exports. Kept for BaseLayout/ChatWidget migration in Commit 1. */
export const LEFT_NODES: HemisphereNode[] = [
  { cx: 6, cy: 22, r: 5.5 },
  { cx: 18, cy: 11, r: 4.5 },
  { cx: 28, cy: 24, r: 5 },
  { cx: 34, cy: 44, r: 4.5 },
  { cx: 42, cy: 20, r: 4 },
];

/** @deprecated — use MICRO_* exports. */
export const RIGHT_NODES: HemisphereNode[] = [
  { cx: 94, cy: 22, r: 5.5 },
  { cx: 82, cy: 11, r: 4.5 },
  { cx: 72, cy: 24, r: 5 },
  { cx: 66, cy: 44, r: 4.5 },
  { cx: 58, cy: 21, r: 4 },
];

/** @deprecated — use MICRO_* exports. */
export const LEFT_EDGES: string[] = [
  'M18 11 Q10 12 6 22',
  'M42 20 Q32 14 18 11',
  'M42 20 Q38 21 28 24',
  'M28 24 Q32 34 34 44',
  'M34 44 Q38 38 42 20',
];

/** @deprecated — use MICRO_* exports. */
export const RIGHT_EDGES: string[] = [
  'M82 11 Q90 12 94 22',
  'M58 21 Q68 14 82 11',
  'M58 21 Q64 21 72 24',
  'M72 24 Q68 34 66 44',
  'M66 44 Q62 38 58 21',
];

/** @deprecated — use MICRO_* exports. */
export const BRIDGE_PATH = 'M42 20 Q50 28 58 21';
export const BRIDGE_X1 = 42;
export const BRIDGE_Y1 = 20;
export const BRIDGE_X2 = 58;
export const BRIDGE_Y2 = 21;

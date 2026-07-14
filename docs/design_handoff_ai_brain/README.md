# Handoff: AI Brain Circuit Hero (3 options)

## Overview
Hero section for a personal portfolio site of a digital leader (digital architecture × applied AI). Structure inspired by santifer.io/en. The centerpiece is a "living brain": an organic brain silhouette built from ~300 glowing neurons connected by circuit-style traces, with dozens of concurrent signal pulses hopping between neurons. Three visual directions are provided; implement **one** (or A/B them).

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (React, Next.js, Vue, etc.) using its established patterns. Exception: `brain-engine.js` is deliberately written as framework-agnostic, dependency-free vanilla JS and CAN be used as-is (see "Integrating the engine" below).

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and animation behavior are final intent. Recreate pixel-perfectly; the copy is fictional placeholder ("Alex Kern") — replace with real content.

## Files
Each option is COMPLETELY SELF-CONTAINED — to implement one option you only need its 3 files. Ignore the others; nothing else in this bundle is required.

| File | What it is |
|---|---|
| `brain-engine.js` | Shared canvas animation engine (vanilla JS, zero deps). Required by all options. |
| `brain-config-1a-circuit-cortex.js` | Colors/trace-style config for Option 1a |
| `brain-config-1b-deep-signal.js` | Config for Option 1b |
| `brain-config-1c-emerald-grid.js` | Config for Option 1c |
| `option-1a-circuit-cortex.html` | Full hero, Option 1a only — open directly in a browser |
| `option-1b-deep-signal.html` | Full hero, Option 1b only |
| `option-1c-emerald-grid.html` | Full hero, Option 1c only |

## The three options

### Option 1a — "Circuit Cortex"
- Mood: orange-led, warm, energetic. Background `#0b0e12` with faint orange (78% 45%) and blue (15% 90%) radial glows.
- Traces: `angular` — single right-angle elbow per connection (circuit-board look).
- Layout: split. Text column left (48px inset, 560px wide, top 150px); brain right (740×700, right 20px, top 80px).
- Nav: logo "ak." (mono, orange dot) left; links Experience / Projects / Writing / Contact (Contact in `#ff9a4d`).
- H1: Space Grotesk 600, 58px/1.08, `#f2ede6`, "AI systems" in `#ff7a1a`.
- Skill chips: IBM Plex Mono 12px, 1px borders in orange/blue/green at 40% alpha, 4px radius, 6px 12px padding.
- CTAs: primary filled `#ff7a1a` on dark text, 6px radius, glow `0 0 24px rgba(255,122,26,.35)`; secondary outlined. Status dot `#2fbf8f` blinking (1.6s).
- Footer caption bottom-right: "live neural mesh · 300 neurons · hover to probe · click to fire".

### Option 1b — "Deep Signal"
- Mood: blue-led terminal/CLI. Background `#070b14`, blue radial glow, horizontal scanlines (`repeating-linear-gradient`, 80px pitch, `rgba(93,182,255,.035)`).
- Traces: `straight` lines.
- Layout: brain is LARGE (900×780) bleeding off the right edge (right −60px), z-index 1 so the headline overlaps it.
- Nav: terminal prompt `~/alex-kern --digital-architect`; links as `[1] path` … `[4] contact`.
- H1: Space Grotesk 500, 64px/1.05, `#eaf2fb`, "intelligence" in `#5db6ff`, blinking `_` cursor in `#ff7a1a` (1.1s step-end).
- Sub-copy in IBM Plex Mono. CTAs styled as shell commands: filled `#5db6ff` / outlined orange.
- Stats row: `15y shipping / 40+ systems live / 7 agents in prod` with colored numerals.

### Option 1c — "Emerald Grid"
- Mood: green-black PCB, bold editorial type. Background `#090e0b`, green radial glow, 120px square grid lines (`rgba(47,191,143,.05)`).
- Traces: `angular45` — diagonal-then-axis segments (chamfered PCB routing).
- Layout: brain 880×880 bleeding off top-right (right −140px, top −20px); text block bottom-left.
- Nav: square "K" monogram (2px `#2fbf8f` border) + "ALEX KERN" letterspaced; links PATH / BUILDS / SIGNAL / TALK.
- Kicker: `— DIGITAL ARCHITECTURE × APPLIED AI` in green mono, .2em tracking.
- H1: Space Grotesk 700, 84px/.98, uppercase, "think." in `#ff7a1a` with `text-shadow: 0 0 30px rgba(255,122,26,.4)`.
- CTAs: sharp 2px radius; primary gradient `#ff7a1a → #ff9a4d`, letterspaced uppercase.

## The brain animation (all options)

### Behavior
- ~300 neurons sampled inside a left-facing brain-profile silhouette (union of 4 ellipses + brain stem rect; see `inside()` in engine).
- Edges: each neuron connects to up to 3 nearest neighbours within `linkDist` → several hundred synapses, fully connected mesh.
- Ambient: neurons drift sinusoidally and pulse; signals spawn continuously (~26 concurrent at intensity 7, hard cap 60), each hops 2–5 edges then dies. Arriving at a node heats it (bright flash) and glows the edge.
- Mouse move: neurons within 95px repel from cursor and heat up; signals preferentially fire near the cursor.
- Click/tap: 14 signals burst from nearest neuron + expanding ripple ring.
- Hover within 70px of a labelled neuron: dark tooltip with skill name (12 labels: Agentic AI, LLMOps, Enterprise Arch, …), its edges glow. Labelled neurons show a small square outline marker.
- Tab hidden: rendering pauses (`document.hidden` check).

### Tuning
`intensity` 1–10 (default 7) scales drift, pulse rate, spawn rate, signal speed. `glow` 0.4–2 (default 1.8) scales sprite sizes and trace alpha. `labels` toggles tooltips.

### Integrating the engine
`brain-engine.js` is production-usable as-is. React example:
```jsx
useEffect(() => {
  const brain = createBrainMesh(canvasRef.current, BRAIN_CONFIG_1A);
  return () => brain.destroy();
}, []);
```
It handles ResizeObserver + devicePixelRatio (capped 1.5) itself; just size the canvas with CSS.

### ⚠ Two subtle bugs already fixed — do not reintroduce
1. **Elbow orientation must be locked per edge at build time** (`edge.horiz`), never derived per-frame from live positions — nodes jiggle, and near-45° edges would flip between horizontal-first/vertical-first elbows every few frames (lines visibly jumping).
2. **Signals must travel the canonical a→b polyline** (the one that is drawn), inverting `t` for b→a travel — rebuilding the path from swapped endpoints yields a different elbow and dots float through empty space.

## Design Tokens
Colors:
- Backgrounds: `#0b0e12` (1a), `#070b14` (1b), `#090e0b` (1c)
- Orange: `#ff7a1a` primary, `#ff9a4d` light, `#ffb26e` chip text
- Blue: `#5db6ff` primary, `#8ecbff` light, `#3fa9ff` accent
- Green: `#2fbf8f` primary, `#7fe0b8` chip text
- Text: `#f2ede6` (1a), `#eaf2fb` (1b), `#e9f5ee` (1c); secondary at ~60% alpha
- Links: default `#5db6ff`, hover `#ff9a4d`

Typography (Google Fonts):
- Space Grotesk 400–700 — headings, body, buttons
- IBM Plex Mono 400–600 — kickers, chips, nav, captions, tooltips

Spacing/radii: 48px page inset; 24–28px vertical rhythm in text stack; radii 6px (1a), 4px (1b), 2px (1c); hero reference frame 1440×820.

## State Management
None beyond the engine's internal animation state. No data fetching. Engine exposes `destroy()` and `set(opts)` only.

## Assets
No external assets. Everything is code-drawn (canvas gradients, CSS gradients). Fonts from Google Fonts.

## Responsive note
The references are fixed 1440×820. Suggested adaptation: text column full-width on mobile, brain as a dimmed background layer or hidden below ~768px; the engine adapts to any canvas size automatically.

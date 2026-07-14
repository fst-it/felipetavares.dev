/**
 * brain-engine.js — "Living AI-circuit brain" canvas animation.
 * Framework-agnostic vanilla JavaScript. Zero dependencies.
 *
 * WHAT IT DOES
 *   Renders an organic brain silhouette built from ~300 glowing neurons,
 *   connected by circuit-style traces, with dozens of concurrent signal
 *   pulses hopping between neurons. Interactions:
 *     - pointer move: neurons repel from the cursor, nearby signals fire
 *     - pointer down:  burst of 14 signals + expanding ripple
 *     - hover near a labelled neuron: skill label tooltip + its edges glow
 *
 * USAGE
 *   <canvas id="brain"></canvas>  (position/size via CSS; engine observes size + DPR)
 *   <script src="brain-engine.js"></script>
 *   <script>
 *     const brain = createBrainMesh(document.getElementById('brain'), CONFIG);
 *     // later, e.g. on unmount:
 *     brain.destroy();
 *     // live-tune:
 *     brain.set({ intensity: 4, glow: 1.2, labels: false });
 *   </script>
 *
 *   In React: create in useEffect, return () => brain.destroy().
 *
 * CONFIG (see brain-config-*.js for the three shipped variants)
 *   trace      'angular' | 'angular45' | 'straight'  — trace routing style
 *   nodes      number of neurons (e.g. 300)
 *   linkDist   max connection distance in brain-space (0..1), e.g. 0.11
 *   edgeCol    [r,g,b] trace color
 *   edgeA      base trace alpha (0..1), e.g. 0.16
 *   nodeCols   array of [r,g,b] — neuron glow colors (weighted by repetition)
 *   sigCols    array of [r,g,b] — signal pulse colors
 *   intensity  1..10 motion intensity (default 7)
 *   glow       0.4..2 glow strength (default 1.8)
 *   labels     boolean — show skill labels on hover (default true)
 *   labelTexts array of strings for labelled neurons
 *
 * IMPLEMENTATION NOTES (read before modifying)
 *   - Edge elbow orientation (`horiz`) is computed ONCE at build time from
 *     base coords. Do NOT derive it per-frame from live positions: nodes
 *     jiggle, and edges near the 45° diagonal would flip orientation every
 *     few frames (lines visibly jumping/disappearing).
 *   - Signals are positioned along the CANONICAL a->b polyline (the same
 *     one drawn for the edge), inverting t when traveling b->a. Do NOT
 *     rebuild the path from swapped endpoints — for elbow traces that
 *     produces a different polyline and dots float through empty space.
 *   - Rendering uses 'lighter' composite + pre-rendered radial-gradient
 *     sprites for glow (fast). DPR capped at 1.5 for perf.
 */
(function (global) {
  'use strict';

  function createBrainMesh(canvas, userCfg) {
    const cfg = Object.assign({
      trace: 'angular',
      nodes: 300,
      linkDist: 0.11,
      edgeCol: [255, 150, 70],
      edgeA: 0.16,
      nodeCols: [[255, 140, 60]],
      sigCols: [[255, 160, 70]],
      intensity: 7,
      glow: 1.8,
      labels: true,
      labelTexts: ['Agentic AI', 'LLMOps', 'Enterprise Arch', 'Data Platforms', 'Cloud Native', 'AI Governance', 'GenAI', 'Integration', 'Security', 'Strategy', 'Observability', 'MLOps'],
    }, userCfg || {});

    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, dead = false, raf = 0, t = 0;
    const mouse = { x: -9999, y: -9999 };
    const nodes = [], edges = [], signals = [], ripples = [];

    // --- brain silhouette (left-facing profile), coords in -0.5..0.5 ---
    const inside = (x, y) => {
      const inEl = (cx, cy, rx, ry) => { const a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b < 1; };
      if (inEl(0.02, -0.04, 0.40, 0.30)) return true;      // main lobe
      if (inEl(-0.30, 0.00, 0.17, 0.19)) return true;      // frontal
      if (inEl(0.27, 0.17, 0.145, 0.115)) return true;     // cerebellum
      if (inEl(0.05, 0.20, 0.22, 0.10)) return true;       // temporal
      if (x > 0.30 && x < 0.40 && y > 0.24 && y < 0.36) return true; // stem
      return false;
    };

    // --- pre-rendered glow sprites ---
    const sprite = (rgb) => {
      const s = document.createElement('canvas'); s.width = s.height = 64;
      const c = s.getContext('2d');
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',1)');
      g.addColorStop(0.25, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.5)');
      g.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      return s;
    };
    const nodeSprites = cfg.nodeCols.map(sprite);
    const sigSprites = cfg.sigCols.map(sprite);

    // --- sample neurons inside the silhouette (min spacing via rejection) ---
    let guard = 0;
    while (nodes.length < cfg.nodes && guard++ < 30000) {
      const x = Math.random() - 0.5, y = Math.random() - 0.5;
      if (!inside(x, y)) continue;
      if (nodes.some((n) => (n.bx - x) ** 2 + (n.by - y) ** 2 < 0.0009)) continue;
      nodes.push({
        bx: x, by: y, x, y,
        ph: Math.random() * Math.PI * 2, ph2: Math.random() * Math.PI * 2,
        sp: nodeSprites[(Math.random() * nodeSprites.length) | 0],
        r: 1.4 + Math.random() * 1.8, label: null, heat: 0,
      });
    }

    // --- edges: up to 3 nearest neighbours within linkDist ---
    const seen = new Set();
    nodes.forEach((n, i) => {
      const near = nodes.map((m, j) => ({ j, d: (m.bx - n.bx) ** 2 + (m.by - n.by) ** 2 }))
        .filter((o) => o.j !== i && o.d < cfg.linkDist * cfg.linkDist)
        .sort((a, b) => a.d - b.d).slice(0, 3);
      near.forEach((o) => {
        const key = i < o.j ? i + '_' + o.j : o.j + '_' + i;
        if (!seen.has(key)) {
          seen.add(key);
          const NA = nodes[i], NB = nodes[o.j];
          // lock elbow orientation ONCE so traces never flip while nodes jiggle
          edges.push({ a: i, b: o.j, glow: 0, horiz: Math.abs(NB.bx - NA.bx) >= Math.abs(NB.by - NA.by) });
        }
      });
    });

    // adjacency list for signal routing
    const adj = nodes.map(() => []);
    edges.forEach((e, ei) => { adj[e.a].push(ei); adj[e.b].push(ei); });

    // --- assign labels to well-spread neurons ---
    const labeled = [];
    for (const txt of cfg.labelTexts) {
      let best = null, bestScore = -1;
      for (let i = 0; i < nodes.length; i += 3) {
        if (nodes[i].label) continue;
        const dMin = labeled.length ? Math.min.apply(null, labeled.map((li) => (nodes[li].bx - nodes[i].bx) ** 2 + (nodes[li].by - nodes[i].by) ** 2)) : 1;
        if (dMin > bestScore) { bestScore = dMin; best = i; }
      }
      if (best != null) { nodes[best].label = txt; labeled.push(best); }
    }

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const px = (n) => ((n.x + 0.5) * 0.92 + 0.04) * W;
    const py = (n) => ((n.y + 0.5) * 0.92 + 0.04) * H;

    // trace polyline between two projected points
    const path = (ax, ay, bx, by, horiz) => {
      if (cfg.trace === 'straight') return [ax, ay, bx, by];
      const dx = bx - ax, dy = by - ay;
      if (cfg.trace === 'angular45') {
        const d = Math.min(Math.abs(dx), Math.abs(dy));
        const mx = ax + Math.sign(dx) * d, my = ay + Math.sign(dy) * d;
        return [ax, ay, mx, my, bx, by];
      }
      // 'angular': single elbow, orientation fixed per edge
      return horiz ? [ax, ay, bx, ay, bx, by] : [ax, ay, ax, by, bx, by];
    };

    const pointOn = (pl, tt) => {
      let total = 0; const segs = [];
      for (let i = 0; i < pl.length - 2; i += 2) {
        const l = Math.hypot(pl[i + 2] - pl[i], pl[i + 3] - pl[i + 1]); segs.push(l); total += l;
      }
      let d = tt * total;
      for (let i = 0; i < segs.length; i++) {
        if (d <= segs[i] || i === segs.length - 1) {
          const f = segs[i] ? d / segs[i] : 0, k = i * 2;
          return [pl[k] + (pl[k + 2] - pl[k]) * f, pl[k + 1] + (pl[k + 3] - pl[k + 1]) * f];
        }
        d -= segs[i];
      }
      return [pl[0], pl[1]];
    };

    const spawnSignal = (nodeIdx, col) => {
      const opts = adj[nodeIdx]; if (!opts.length) return;
      const ei = opts[(Math.random() * opts.length) | 0];
      const e = edges[ei];
      signals.push({
        ei, t: 0, from: e.a === nodeIdx ? 'a' : 'b',
        speed: 0.010 + Math.random() * 0.016, hops: 2 + ((Math.random() * 4) | 0),
        sp: col != null ? col : sigSprites[(Math.random() * sigSprites.length) | 0],
        trail: [],
      });
    };

    const onMove = (ev) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ev.clientX - r.left; mouse.y = ev.clientY - r.top;
    };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onDown = (ev) => {
      const r = canvas.getBoundingClientRect();
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;
      let best = 0, bd = 1e9;
      nodes.forEach((n, i) => { const d = (px(n) - mx) ** 2 + (py(n) - my) ** 2; if (d < bd) { bd = d; best = i; } });
      for (let k = 0; k < 14; k++) spawnSignal(best);
      nodes[best].heat = 1;
      ripples.push({ x: px(nodes[best]), y: py(nodes[best]), r: 4, a: 0.7 });
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown);

    const tick = () => {
      if (dead) return;
      raf = requestAnimationFrame(tick);
      if (!W || document.hidden) return;
      const glow = cfg.glow, labels = cfg.labels;
      const I = cfg.intensity / 7;
      t += 0.016;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      // physics: ambient drift + mouse repulsion
      const mR = 95;
      for (const n of nodes) {
        n.x = n.bx + Math.sin(t * 0.6 * I + n.ph) * 0.004 * I;
        n.y = n.by + Math.cos(t * 0.5 * I + n.ph2) * 0.004 * I;
        const sx = px(n), sy = py(n);
        const dx = sx - mouse.x, dy = sy - mouse.y, d = Math.hypot(dx, dy);
        if (d < mR && d > 0.1) {
          const f = (1 - d / mR) * 14;
          n.x += (dx / d) * f / W; n.y += (dy / d) * f / H;
          n.heat = Math.max(n.heat, (1 - d / mR) * 0.8);
        }
        n.heat *= 0.94;
      }

      // ambient + near-mouse signal spawning
      const target = 26 * I;
      if (signals.length < 60 && Math.random() < 0.14 * I * (1 - signals.length / (target * 2.2))) {
        spawnSignal((Math.random() * nodes.length) | 0);
      }
      if (mouse.x > -100 && Math.random() < 0.10 * I) {
        let best = 0, bd = 1e9;
        for (let i = 0; i < nodes.length; i += 2) { const d = (px(nodes[i]) - mouse.x) ** 2 + (py(nodes[i]) - mouse.y) ** 2; if (d < bd) { bd = d; best = i; } }
        if (bd < mR * mR * 4) spawnSignal(best);
      }

      // edges (circuit traces)
      const er = cfg.edgeCol[0], eg = cfg.edgeCol[1], eb = cfg.edgeCol[2];
      ctx.lineWidth = 1;
      for (const e of edges) {
        const A = nodes[e.a], B = nodes[e.b];
        const ax = px(A), ay = py(A), bx = px(B), by = py(B);
        const heat = Math.max(A.heat, B.heat, e.glow);
        e.glow *= 0.93;
        const alpha = cfg.edgeA * glow + heat * 0.45;
        ctx.strokeStyle = 'rgba(' + er + ',' + eg + ',' + eb + ',' + Math.min(alpha, 0.85) + ')';
        const pl = path(ax, ay, bx, by, e.horiz);
        ctx.beginPath(); ctx.moveTo(pl[0], pl[1]);
        for (let i = 2; i < pl.length; i += 2) ctx.lineTo(pl[i], pl[i + 1]);
        ctx.stroke();
      }

      // signals (pulses hopping node to node)
      for (let i = signals.length - 1; i >= 0; i--) {
        const s = signals[i]; const e = edges[s.ei];
        s.t += s.speed * I;
        if (s.t >= 1) {
          e.glow = 0.8;
          const arriveAt = s.from === 'a' ? e.b : e.a;
          nodes[arriveAt].heat = Math.max(nodes[arriveAt].heat, 0.7);
          s.hops--;
          if (s.hops <= 0) { signals.splice(i, 1); continue; }
          const opts = adj[arriveAt].filter((x) => x !== s.ei);
          if (!opts.length) { signals.splice(i, 1); continue; }
          s.ei = opts[(Math.random() * opts.length) | 0];
          s.from = edges[s.ei].a === arriveAt ? 'a' : 'b';
          s.t = 0;
        }
        const ed = edges[s.ei];
        // always route along the canonical a->b polyline (the drawn one),
        // inverting t for b->a travel — keeps dots exactly on visible traces
        const A = nodes[ed.a], B = nodes[ed.b];
        const pl = path(px(A), py(A), px(B), py(B), ed.horiz);
        const tt = Math.min(s.t, 1);
        const pt = pointOn(pl, s.from === 'a' ? tt : 1 - tt);
        const sx2 = pt[0], sy2 = pt[1];
        s.trail.push(sx2, sy2); if (s.trail.length > 12) s.trail.splice(0, 2);
        for (let k = 0; k < s.trail.length; k += 2) {
          const f = k / s.trail.length;
          const sz = (3 + f * 9) * glow;
          ctx.globalAlpha = f * 0.55;
          ctx.drawImage(s.sp, s.trail[k] - sz / 2, s.trail[k + 1] - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
        const gs = 16 * glow;
        ctx.drawImage(s.sp, sx2 - gs / 2, sy2 - gs / 2, gs, gs);
      }

      // neurons
      for (const n of nodes) {
        const sx = px(n), sy = py(n);
        const pulse = 0.55 + 0.45 * Math.sin(t * 1.5 * I + n.ph);
        const g = (n.r * 3.2 + n.heat * 14) * glow * (0.7 + 0.3 * pulse);
        ctx.globalAlpha = 0.5 + n.heat * 0.5;
        ctx.drawImage(n.sp, sx - g / 2, sy - g / 2, g, g);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(240,244,250,' + (0.5 + n.heat * 0.5) + ')';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }

      // click ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += 3.2; rp.a *= 0.94;
        if (rp.a < 0.02) { ripples.splice(i, 1); continue; }
        ctx.strokeStyle = 'rgba(' + er + ',' + eg + ',' + eb + ',' + rp.a + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2); ctx.stroke();
      }

      // hover labels
      if (labels && mouse.x > -100) {
        ctx.globalCompositeOperation = 'source-over';
        for (const li of labeled) {
          const n = nodes[li];
          const sx = px(n), sy = py(n);
          const d = Math.hypot(sx - mouse.x, sy - mouse.y);
          if (d < 70) {
            const a = 1 - d / 70;
            ctx.font = '600 11px "IBM Plex Mono", monospace';
            const w = ctx.measureText(n.label).width;
            ctx.fillStyle = 'rgba(8,12,16,' + (0.85 * a) + ')';
            ctx.fillRect(sx + 10, sy - 20, w + 14, 20);
            ctx.strokeStyle = 'rgba(' + er + ',' + eg + ',' + eb + ',' + (0.7 * a) + ')';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx + 10, sy - 20, w + 14, 20);
            ctx.fillStyle = 'rgba(240,244,250,' + a + ')';
            ctx.fillText(n.label, sx + 17, sy - 6);
            for (const ei of adj[li]) edges[ei].glow = Math.max(edges[ei].glow, 0.5 * a);
          } else {
            ctx.strokeStyle = 'rgba(' + er + ',' + eg + ',' + eb + ',.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - 3.5, sy - 3.5, 7, 7);
          }
          ctx.globalCompositeOperation = 'lighter';
        }
      }
    };
    raf = requestAnimationFrame(tick);

    return {
      destroy() {
        dead = true; cancelAnimationFrame(raf); ro.disconnect();
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointerdown', onDown);
      },
      set(opts) { Object.assign(cfg, opts); },
    };
  }

  global.createBrainMesh = createBrainMesh;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createBrainMesh };
})(typeof window !== 'undefined' ? window : this);

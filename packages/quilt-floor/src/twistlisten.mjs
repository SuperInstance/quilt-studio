// The Twist Listener — one instrument where the iceberg's three voices are
// heard resolving to the same φ:
//
//   1. the comb's teeth:  |F_{n+1}/F_n − φ|  → 0   (the 1D ladder, Diophantine)
//   2. the crystal's gaps: L/S measured from the multigrid dual  = φ  (the 2D
//      Ammann-carrier law, structural — exact at any reach)
//   3. their difference, which the listener binds as a live kernel cell and
//      which a render view (L2 subscribe) watches shrink as the comb's
//      reach extends: the crystal doesn't converge, it IS φ; the ladder
//      climbs toward it. "The comb sings against a crystal that hums."
//
// Anti-vacuity is structural: a detuned multigrid feeds a gap ratio ≠ φ and
// the listener flags it (`twist.detuned`), exactly as the multigrid suite
// demands the law discriminate (tests/multigrid.test.mjs).

import { convergentGaps, PHI } from './golden.mjs';

export class TwistListener {
  // kernel: a QuiltKernel; multigrid: a Multigrid (any γ — detuned works too,
  // the listener reports what it measures, that's the point).
  constructor(kernel, multigrid = null, comb = null) {
    this.k = kernel;
    this.mg = multigrid;
    this.comb = comb;                       // optional Comb tenant to drive
    this.k.bind('twist.phi', PHI, { what: 'the limit all three voices resolve to' });
    this.k.bind('twist.gapRatio', null, { what: 'measured L/S from the crystal' });
    this.k.bind('twist.teeth', [], { what: 'comb ladder: per-tooth |F_{n+1}/F_n − φ|' });
    this.k.bind('twist.delta', null, { what: '|gapRatio − best tooth| — ladder vs crystal' });
    this.k.bind('twist.detuned', false, { what: 'true when the crystal no longer sings φ' });
  }

  // Measure the ratio of the two smallest distinct CORE intercept gaps
  // straight off the crystal, so a detuned grid is caught. Per the
  // adjudicated law (docs/THE-FLOOR.md §7) the core pair is {L, S+L}
  // with ratio exactly φ; S is their difference, seen only as a clipped
  // residual in finite patches.
  #measureCrystal() {
    // goldenGaps() returns the law's closed forms for the TRUE pentagrid;
    // for a detuned grid those don't apply, so measure from intercepts.
    const { L, S } = this.#gapsFromEdges();
    const ratio = L / S;
    return { ratio, detuned: Math.abs(ratio - PHI) > 1e-6 };
  }

  #gapsFromEdges() {
    const m = this.mg;
    const k = 0;
    const n = m.normals[k];
    const perp = [-n[1], n[0]];
    const d = perp;
    // Interior only — fringe intercepts spawn non-law near-degenerates. Same
    // core discipline as the locked suite (tests/multigrid.test.mjs).
    const core = m.reach * 0.35;
    const lineC = new Map();
    for (const s of m.arrangementSegments()) {
      if (s.k !== k) continue;
      const a = [(s.j + m.gamma[k]) * m.normals[k][0], (s.j + m.gamma[k]) * m.normals[k][1]];
      const tm = (s.t1 + s.t2) / 2;
      const midR = Math.hypot(a[0] + tm * d[0], a[1] + tm * d[1]);
      if (midR >= core) continue;
      for (const f of [s.above, s.below]) {
        let cx = 0, cy = 0;
        for (let i = 0; i < m.N; i++) { const w = f[i] + m.gamma[i] + 0.5; cx += w * m.normals[i][0]; cy += w * m.normals[i][1]; }
        cx *= 2 / m.N; cy *= 2 / m.N;
        const c = perp[0] * cx + perp[1] * cy;
        lineC.set(Math.round(c * 1e9), c);
      }
    }
    const vals = [...lineC.values()].sort((a, b) => a - b);
    const gapVals = [];
    for (let i = 0; i + 1 < vals.length; i++) gapVals.push(vals[i + 1] - vals[i]);
    // cluster to 1e-7 but keep FULL-precision representatives — rounding
    // the values to the cluster grid itself cost 6e-6 of ratio precision
    gapVals.sort((a, b) => a - b);
    const distinct = [];
    for (const g of gapVals) {
      if (distinct.length && Math.abs(g - distinct[distinct.length - 1]) < 1e-7) continue;
      distinct.push(g);
    }
    return { S: distinct[0], L: distinct[1] }; // two smallest distinct core gaps (L, S+L per the law)
  }

  // The sample action: recompute teeth from the comb's current reach, take
  // the best (smallest-error) tooth, measure the crystal, bind everything.
  sample() {
    const reach = this.comb ? Math.max(2, this.comb.teeth().length) : 8;
    const teeth = convergentGaps(reach).map(t => {
      const ratio = (t.degrees + 360 * PHI) / 360;   // invert degrees = ratio·360 − 360φ
      return { n: t.n, ratio, err: Math.abs(ratio - PHI) };
    });
    const g = this.mg ? this.#measureCrystal() : { ratio: null, detuned: null };
    const best = teeth.length ? teeth[teeth.length - 1] : null;
    const delta = (g.ratio !== null && best) ? Math.abs(g.ratio - best.ratio) : null;
    this.k.bind('twist.teeth', teeth);
    this.k.bind('twist.gapRatio', g.ratio);
    this.k.bind('twist.delta', delta);
    this.k.bind('twist.detuned', g.detuned);
    return { teeth, gapRatio: g.ratio, delta, detuned: g.detuned };
  }

  // The L2 render surface: subscribe a view to the teeth cell. Contract v5
  // guarantees each listener its own deep copy — a view that mutates what it
  // draws cannot corrupt the kernel or its siblings (guarded by tests).
  listen(fn) {
    return this.k.subscribe(fn, { cell: 'twist.teeth' });
  }

  // Extend the comb (if attached) and re-sample: the full "as it computes"
  // beat — n grows, teeth sharpen, delta shrinks toward the crystal's hum.
  extend() {
    if (this.comb) this.comb.extend();
    return this.sample();
  }
}

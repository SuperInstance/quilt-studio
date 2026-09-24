// EXP-A1 — ADVERSARY AXIS: degenerate substrates and float-zoom identity eating.
// Round-2 prior art (Julia OTAs, NTT kernels, twin-beam, Δ0 tilt) never fed the
// sim pathological inputs and never asked where its FLOAT substrate stops
// representing the exact-integer (k,s) identity model. Axes differing:
//   ADVERSARY (degenerate/near-singular inputs) × SUBSTRATE (N ≠ 5) × SCALE
//   (spacing/reach zoom sweeping float representation).
// Meta-rule: every measurement run twice; both runs printed; determinism check.
import { Multigrid } from '../src/multigrid.mjs';
import { PHI } from '../src/golden.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];
const GENERIC_N = (N) => Array.from({ length: N }, (_, k) => (0.13 + 0.171 * k) % 1);

// ---------- probe 1: N-varying substrate (adversary: break the N=5 assumption)
// Hypothesis: the construction is N-robust for generic γ (the Σ n_k n_kᵀ = N/2·I
// identity holds ∀N>2), but tile-angle inventory and concurrence behavior differ
// structurally per N; even N may hide extra symmetries. Wall expected only at
// degenerate N (N=2: one family? N=1: no crossings).
function nSubstrate() {
  const out = [];
  for (const N of [2, 3, 4, 5, 6, 7, 8]) {
    const m = new Multigrid({ N, gamma: GENERIC_N(N), reach: 3 });
    const { faces, edges } = m.dualEdges();
    let maxLenErr = 0;
    for (const e of edges) {
      const len = Math.hypot(faces[e.b].x - faces[e.a].x, faces[e.b].y - faces[e.a].y);
      maxLenErr = Math.max(maxLenErr, Math.abs(len - 2 / N));
    }
    const { tiles } = m.dualTiles();
    const angles = new Set(tiles.map(t => Math.round(t.angle * 180 / Math.PI)));
    let triple = 0;
    for (const v of m.arrangementVertices()) if (v.lines.length > 2) triple++;
    out.push({ N, faces: faces.length, edges: edges.length, maxLenErr, tileAngles: [...angles].sort((a, b) => a - b), tripleConcurrences: triple });
  }
  return out;
}

// ---------- probe 2: near-singular gamma (adversary: approach γ=0 arbitrarily close)
// Hypothesis: as ε→0 in γ=ε·(1,1,1,1,1), TRUE concurrences vanish smoothly, but the
// arrangementVertices dedup key (round(x·1e9)) manufactures FAKE concurrences
// once true vertex separation approaches the key quantum 1e-9. Two walls to map:
//   (a) where do fake merges appear (count vertices with >2 lines at tiny ε);
//   (b) where does the FLOAT pipeline still agree with the exact-integer model
//       (lifts stay integral & consistent).
function nearSingular() {
  const epsilons = [0, 1e-15, 1e-12, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6, 1e-4, 1e-3, 1e-2, 0.1];
  const out = [];
  for (const eps of epsilons) {
    const gamma = GENERIC.map(g => eps);   // all-equal shift: the resonant direction
    const m = new Multigrid({ N: 5, gamma, reach: 3 });
    const vs = m.arrangementVertices();
    let triple = 0;
    for (const v of vs) if (v.lines.length > 2) triple++;
    // separateness check: min distance between "distinct" vertices sharing a key
    // (fake merge ⇒ reported as one vertex carrying >2 lines).
    const { faces, edges } = m.dualEdges();
    let maxLenErr = 0;
    for (const e of edges) {
      const len = Math.hypot(faces[e.b].x - faces[e.a].x, faces[e.b].y - faces[e.a].y);
      maxLenErr = Math.max(maxLenErr, Math.abs(len - 2 / 5));
    }
    // lift integrality: every face lift must be exact integers
    let nonInteger = 0;
    for (const f of faces) for (const j of f.lift) if (!Number.isInteger(j)) nonInteger++;
    out.push({ eps, vertices: vs.length, tripleConcurrences: triple, faces: faces.length, edges: edges.length, maxLenErr, nonIntegerLifts: nonInteger });
  }
  return out;
}

// ---------- probe 3: extreme zoom (scale adversary: where float eats identity)
// Hypothesis: structure is scale-invariant in exact arithmetic, so face/edge
// counts must be IDENTICAL across spacing. The dedup key quantum is absolute
// (1e-9 in position units), so:
//   spacing → 0: all keys collapse to 0 ⇒ catastrophic fake concurrence ⇒
//                faces/tiles annihilate below spacing ≈ 1e-10.
//   spacing → ∞: x·1e9 exceeds 2^53 ⇒ round() snaps keys to even integers —
//                merges only if spacing < ~1e-9 in position units, i.e. never;
//                so NO wall upward at any sane spacing. Verify, don't assume.
function zoom() {
  const out = [];
  const baseline = new Multigrid({ N: 5, gamma: GENERIC, reach: 3, spacing: 1 });
  const baseFaces = baseline.dualEdges().faces.length;
  for (const spacing of [1e-14, 1e-12, 1e-10, 1e-9, 1e-8, 1e-6, 1e-3, 1, 1e3, 1e6, 1e9, 1e12]) {
    const m = new Multigrid({ N: 5, gamma: GENERIC, reach: 3, spacing });
    const vs = m.arrangementVertices();
    let triple = 0;
    for (const v of vs) if (v.lines.length > 2) triple++;
    const { faces, edges } = m.dualEdges();
    // SPACING-BLINDNESS (the finding): the dual derives positions from lifts
    // via the strip-center formula, which the source implements WITHOUT the
    // spacing factor — the dual lives in lattice units ∀s while the
    // arrangement scales with s. Empirical proof: faces matched by lift key
    // across spacings have BIT-IDENTICAL positions (maxAbsPosDiffAcrossSpacing),
    // and edge length is exactly 2/5 in these units ∀s.
    let maxLenErr = 0;
    for (const e of edges) {
      const len = Math.hypot(faces[e.b].x - faces[e.a].x, faces[e.b].y - faces[e.a].y);
      maxLenErr = Math.max(maxLenErr, Math.abs(len - 2 / 5));
    }
    let maxPosDiff = 0;
    if (spacing !== 1) {
      const baseByLift = new Map(baseline.dualEdges().faces.map(f => [f.lift.join(','), f]));
      for (const f of faces) {
        const b = baseByLift.get(f.lift.join(','));
        if (b) maxPosDiff = Math.max(maxPosDiff, Math.hypot(f.x - b.x, f.y - b.y));
      }
    }
    out.push({ spacing, vertices: vs.length, tripleConcurrences: triple, faces: faces.length, edges: edges.length, maxLenErrLattice: maxLenErr, maxAbsPosDiffAcrossSpacing: maxPosDiff, faceCountDrift: faces.length - baseFaces });
  }
  return out;
}

// ---------- probe 4: reach zoom (same wall, approached through cell count)
// arrangementVertices keys scale as reach·spacing; find where 2^53 bites.
function reachZoom() {
  const out = [];
  for (const reach of [3, 10, 100]) {
    const m = new Multigrid({ N: 5, gamma: GENERIC, reach });
    const t0 = Date.now();
    const vs = m.arrangementVertices();
    const ms = Date.now() - t0;
    let triple = 0, maxLines = 2;
    for (const v of vs) { if (v.lines.length > 2) triple++; maxLines = Math.max(maxLines, v.lines.length); }
    const keyTop = reach * 1e9;      // worst-case key magnitude
    out.push({ reach, vertices: vs.length, tripleConcurrences: triple, maxLinesAtVertex: maxLines, keyTop, exceeds2p53: keyTop > Number.MAX_SAFE_INTEGER, buildMs: ms });
  }
  return out;
}

// ---------- meta-rule: run everything twice, compare
const run = () => ({
  A1_N: nSubstrate(),
  A1_singular: nearSingular(),
  A1_zoom: zoom(),
  A1_reach: reachZoom(),
});
const stripTiming = (r) => {
  const clone = JSON.parse(JSON.stringify(r));
  for (const row of clone.A1_reach) delete row.buildMs;
  return clone;
};
const r1 = run();
const r2 = run();
const stable = JSON.stringify(stripTiming(r1)) === JSON.stringify(stripTiming(r2));
console.log(JSON.stringify({ run1: r1, run2: r2, determinismStableExcludingTiming: stable }, null, 1));

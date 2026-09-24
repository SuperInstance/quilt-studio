// THE CORRUPTION AQUARIUM — pins for the live boundary exhibit.
// Parent probes: EXP-A1 (band map + integrality invisibility), EXP-B3
// (park-at-band-edge migration, answered here), EXP-B1 (detect the band
// from dual structure alone — the spread detector, answered here).
// The aquarium keeps a Multigrid resident INSIDE the silent corruption
// band ε∈(1e-9,1e-6) and ticks it; a monitor samples two channels:
//   IDENTITY (lift integrality — flatlines "healthy" throughout) and
//   GEOMETRY (dual edge-length error vs the exact 2/5 — screams).
// The wall being welded: verification channels see their own channel,
// not the world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Multigrid } from '../src/multigrid.mjs';
import { aquariumVitals, detectFromDual, runResidency } from '../src/aquarium.mjs';

const ONES = (eps) => new Array(5).fill(eps);

// ---------- PIN 1: integrality invisibility ----------
// Mid-band: the identity channel reads PERFECT (every lift an exact
// integer) while geometry is catastrophically wrong (0.83–0.89 vs 0.4).
// This is the A1 finding pinned as a living invariant of the residency.
test('invisibility: mid-band identity flatlines while geometry screams', () => {
  const v = aquariumVitals(new Multigrid({ N: 5, gamma: ONES(3e-8), reach: 3 }));
  assert.equal(v.nonIntLifts, 0, 'identity channel: perfect integrality');
  assert.ok(v.maxEdgeErr > 0.5, `geometry channel: screaming (${v.maxEdgeErr})`);
  assert.ok(v.spread > 0.5, 'dual edge lengths no longer a delta at 2/5');
});

// ---------- PIN 2: the dual-only detector ----------
// detectFromDual receives ONLY {faces, edges} — no ε, no gamma, no
// multigrid. The edge-length spread separates healthy (~3e-15) from
// corrupt (≥0.36) across nine orders of magnitude with 1e-6 threshold.
test('detector: dual-structure-only verdict separates all nine eps regimes', () => {
  const cases = [
    [0, false], [1e-11, false], [1e-10, false],
    [1e-9, true], [3e-9, true], [3e-8, true], [1e-7, true], [5e-7, true],
    [1e-6, false], [1e-3, false], [1e-2, false],
  ];
  for (const [eps, expectCorrupt] of cases) {
    const m = new Multigrid({ N: 5, gamma: ONES(eps), reach: 3 });
    const { faces, edges } = m.dualEdges();
    const d = detectFromDual({ faces, edges });
    assert.equal(d.corrupted, expectCorrupt, `ε=${eps}: verdict ${d.corrupted}, spread ${d.spread}`);
  }
});

// ---------- PIN 3: freeze zone, refined ----------
// A1 claimed "output bit-identical to ε=0" below 5e-10. Refined by the
// aquarium: the COMBINATORICS freeze (face/edge counts identical) while
// positions legitimately drift (positions are γ-views, not identity —
// frames.mjs honest law). Both halves pinned so the refinement is itself
// a boundary segment, not a quiet correction.
test('freeze: combinatorics frozen below the quantum, positions honest', () => {
  const base = aquariumVitals(new Multigrid({ N: 5, gamma: ONES(0), reach: 3 }));
  for (const eps of [1e-12, 1e-11, 1e-10]) {
    const v = aquariumVitals(new Multigrid({ N: 5, gamma: ONES(eps), reach: 3 }));
    assert.equal(v.faces, base.faces, `ε=${eps}: face count frozen at ε=0's`);
    assert.equal(v.edges, base.edges, `ε=${eps}: edge count frozen at ε=0's`);
    assert.equal(v.nonIntLifts, 0, `ε=${eps}: identity still exact`);
    assert.ok(v.maxEdgeErr < 1e-12, `ε=${eps}: geometry still exact`);
    assert.notStrictEqual(v.positionDigest, base.positionDigest,
      `ε=${eps}: positions are views — they MUST move with γ`);
  }
});

// ---------- PIN 4: the fuzzy band edge ----------
// Corruption onset is BELOW the 1e-9 dedup-key quantum: at 5e-10 the
// dual is already melting (half-quantum fuzz — round() splits at x·1e9
// fractions ≥ 0.5). The wall is not sharp; the aquarium pins where it
// actually starts.
test('fuzzy edge: onset below the 1e-9 key quantum', () => {
  const lo = aquariumVitals(new Multigrid({ N: 5, gamma: ONES(1e-10), reach: 3 }));
  const hi = aquariumVitals(new Multigrid({ N: 5, gamma: ONES(5e-10), reach: 3 }));
  assert.ok(lo.maxEdgeErr < 1e-12, `ε=1e-10 still frozen (${lo.maxEdgeErr})`);
  assert.ok(hi.maxEdgeErr > 0.1, `ε=5e-10 already melting (${hi.maxEdgeErr})`);
});

// ---------- PIN 5: the residency is a phase transition, not static rot ----------
// Drifting ε through the band 1e-9→1e-6: corruption MIGRATES — face counts
// pass through ≥6 distinct plateaus (measured: 908,920,922,924,933,935,
// 980,988,985,1006…) before healing to exact. B3 answered: the rot is
// alive, then it anneals. The end state must be exact (t=40 ⇒ healed).
test('residency: melting region migrates through ≥6 plateaus, then heals exact', () => {
  const { trace } = runResidency({ from: 1e-9, to: 1e-6, steps: 40, reach: 3 });
  assert.equal(trace.length, 41);
  const plateaus = new Set(trace.map(s => s.faces));
  assert.ok(plateaus.size >= 6, `migration plateaus: ${plateaus.size} (${[...plateaus].join(',')})`);
  const last = trace[trace.length - 1];
  assert.ok(last.maxEdgeErr < 1e-12, `healed at ε=${last.eps}: ${last.maxEdgeErr}`);
  const anyCorrupt = trace.some(s => s.corrupted);
  assert.ok(anyCorrupt, 'the residency actually passed through corruption');
  assert.ok(trace[0].corrupted, 'residency STARTS inside the melt (ε=1e-9)');
  assert.ok(!trace[0].identityOk === false, 'identity flatlines from the very first tick');
});

// ---------- PIN 6: monitor determinism ----------
// The exhibit's own meta-rule (A1 lineage): two residencies are
// step-for-step identical — the EKG is a reproducible artifact.
test('determinism: two residencies produce identical traces', () => {
  const a = runResidency({ from: 1e-9, to: 1e-6, steps: 24, reach: 3 });
  const b = runResidency({ from: 1e-9, to: 1e-6, steps: 24, reach: 3 });
  assert.deepStrictEqual(a.trace, b.trace);
  assert.equal(a.summary.healed, true);
  assert.ok(a.summary.maxEdgeErrSeen > 0.5);
});

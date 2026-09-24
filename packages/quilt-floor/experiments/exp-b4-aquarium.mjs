// EXP-B4 — THE CORRUPTION AQUARIUM: a living exhibit of the floor's
// silent corruption band. Parents: EXP-A1 (band map + integrality
// invisibility), EXP-B3 (park at the band edge and tick — does the rot
// migrate?), EXP-B1 (detect the band from dual structure alone).
// The composition that demos itself: the floor runs wrong-on-purpose
// inside ε∈(1e-9,1e-6) while a two-channel EKG renders the wall live —
// IDENTITY flatlines "healthy" (lifts always integral) as GEOMETRY melts
// and anneals (edge error 0.89 → exact through quantized plateaus).
// Meta-rule (A1 lineage): every measurement twice; determinism checked.
import { Multigrid } from '../src/multigrid.mjs';
import { aquariumVitals, detectFromDual, runResidency, renderEkg } from '../src/aquarium.mjs';

// ---------- exhibit 1: the EKG, rendered live ----------
// One residency, printed as two channels that should co-move and don't.
const { trace, summary } = runResidency({ from: 1e-10, to: 1e-5, steps: 44, reach: 3 });
console.log(renderEkg(trace));
console.log(JSON.stringify({ summary }, null, 1));

// ---------- exhibit 2: the detector on a stranger's dual ----------
// B1 closure demo: hand the detector a dual with NO provenance — it must
// still call the verdict. Healthy stranger vs aquarium melt.
const strangerHealthy = new Multigrid({ N: 5, gamma: [0.1, 0.7, 0.3, 0.9, 0.4], reach: 3 }).dualEdges();
const strangerMelt = new Multigrid({ N: 5, gamma: new Array(5).fill(3e-8), reach: 3 }).dualEdges();
console.log('stranger healthy:', JSON.stringify(detectFromDual(strangerHealthy)));
console.log('stranger melt   :', JSON.stringify(detectFromDual(strangerMelt)));

// ---------- exhibit 3: the freeze refinement, live ----------
// Below the quantum: combinatorics frozen at ε=0, positions honest.
const v0 = aquariumVitals(new Multigrid({ N: 5, gamma: [0, 0, 0, 0, 0], reach: 3 }));
const vFrozen = aquariumVitals(new Multigrid({ N: 5, gamma: new Array(5).fill(1e-11), reach: 3 }));
console.log('freeze check:', JSON.stringify({
  eps0: { faces: v0.faces, edges: v0.edges, digest: v0.positionDigest, err: v0.maxEdgeErr },
  eps1e_11: { faces: vFrozen.faces, edges: vFrozen.edges, digest: vFrozen.positionDigest, err: vFrozen.maxEdgeErr },
  combinatoricsFrozen: v0.faces === vFrozen.faces && v0.edges === vFrozen.edges,
  positionsHonest: v0.positionDigest !== vFrozen.positionDigest,
}));

// ---------- meta-rule: run everything twice, compare ----------
const a = runResidency({ from: 1e-9, to: 1e-6, steps: 24, reach: 3 });
const b = runResidency({ from: 1e-9, to: 1e-6, steps: 24, reach: 3 });
console.log('determinism:', JSON.stringify({ identical: JSON.stringify(a.trace) === JSON.stringify(b.trace) }));

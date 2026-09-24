// EXP-A2 — TIMEBASE × SCALE AXIS: long-horizon ticking of a floor.
// Round-2 prior art was all STATIC construction (Julia OTAs, NTT, twin-beam,
// Δ0 tilt — build once, measure). This probe makes the floor a DYNAMICAL
// SYSTEM and ticks it 100,000+ steps, tracking identity (the exact ℤ⁵ lift)
// through time. Axes differing: TIMEBASE (evolution) × DIRECTION (adiabatic
// sweep vs fixed γ) × SCALE (reach as discrete horizon).
// Doctrine (frames.mjs THE HONEST LAW): lifts are identity; positions are
// exact views derived from (lift, γ); never mint identity from a view.
import { Multigrid } from '../src/multigrid.mjs';
import { PHI } from '../src/golden.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];
const { S, L, SL } = (() => {
  const a = (2 / 5) * Math.sin(2 * Math.PI / 5);
  return { S: a * Math.pow(PHI, -3), L: a * Math.pow(PHI, -2), SL: a * Math.pow(PHI, -1) };
})();

const facePos = (lift, gamma, normals) => {
  let x = 0, y = 0;
  for (let k = 0; k < 5; k++) { const w = lift[k] + gamma[k] + 0.5; x += w * normals[k][0]; y += w * normals[k][1]; }
  return [x * 2 / 5, y * 2 / 5];
};

// ---------- phase 1: 100k-tick γ-sweep with lift-identity tracking ----------
// Hypothesis: the sweep is a RIGID+RELATIVE motion. Under all-equal δ every face
// translates identically (geometry exactly conserved); under a mixed δ vector
// faces shear relative to each other and the fixed window churns at its edge.
// Conserved candidates: golden gap law (structural), window radius, pairwise
// invariants. Leak candidates: face births/deaths at the window boundary.
function sweep(totalTicks = 100000, checkpointEvery = 200) {
  const normals = Array.from({ length: 5 }, (_, k) => { const a = Math.PI * k / 5; return [Math.cos(a), Math.sin(a)]; });
  const delta = [0.31, -0.17, 0.53, 0.11, -0.29].map(v => v * 1e-6);  // mixed: internal shear
  const m0 = new Multigrid({ N: 5, gamma: GENERIC, reach: 4 });
  const gamma = GENERIC.slice();
  let faces = m0.dualEdges().faces;              // identity set at t=0
  const R = 1.5;                                  // fixed observation window
  const series = [];
  let birthsTotal = 0, deathsTotal = 0;
  const persistent0 = faces.filter(f => Math.hypot(f.x, f.y) < R);
  const pers0Keys = new Set(persistent0.map(f => f.lift.join(',')));
  // pairwise distances among t=0 persistent faces — the rigidity baseline
  const pairSample = [];
  for (let i = 0; i < persistent0.length && pairSample.length < 400; i += 3)
    for (let j = i + 1; j < persistent0.length && pairSample.length < 400; j += 7)
      pairSample.push([persistent0[i].lift.join(','), persistent0[j].lift.join(','), Math.hypot(persistent0[i].x - persistent0[j].x, persistent0[i].y - persistent0[j].y)]);

  for (let t = 1; t <= totalTicks; t++) {
    for (let k = 0; k < 5; k++) gamma[k] += delta[k];
    // exact per-tick position of every tracked lift (strip formula — a VIEW)
    for (const f of faces) { const p = facePos(f.lift, gamma, normals); f.x = p[0]; f.y = p[1]; }
    if (t % checkpointEvery === 0) {
      // reconcile existence against a full rebuild (geometry is the arbiter)
      const m = new Multigrid({ N: 5, gamma: gamma.slice(), reach: 4 });
      const rebuilt = m.dualEdges().faces;
      const nowKeys = new Set(rebuilt.map(f => f.lift.join(',')));
      const beforeKeys = new Set(faces.map(f => f.lift.join(',')));
      const born = [...nowKeys].filter(k => !beforeKeys.has(k)).length;
      const died = [...beforeKeys].filter(k => !nowKeys.has(k)).length;
      birthsTotal += born; deathsTotal += died;
      // adopt the rebuilt set as the new identity (positions from geometry)
      faces = rebuilt;
      const inWin = faces.filter(f => Math.hypot(f.x, f.y) < R);
      const keyNow = new Map(faces.map(f => [f.lift.join(','), f]));
      // pairwise-drift audit on the sampled pairs (rigidity across the sweep)
      let pairDriftMax = 0, pairChecked = 0;
      for (const [ka, kb, dref] of pairSample) {
        const a = keyNow.get(ka), b = keyNow.get(kb);
        if (!a || !b) continue;
        pairDriftMax = Math.max(pairDriftMax, Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - dref));
        pairChecked++;
      }
      const pers = inWin.filter(f => pers0Keys.has(f.lift.join(',')));
      // golden word freq on family 0 (cheap, structural): intercept gaps
      const m2 = new Multigrid({ N: 5, gamma: gamma.slice(), reach: 4 });
      const gaps = m2.interceptGaps(0).gaps;
      let nL = 0, nC = 0, nBad = 0;
      for (const g of gaps) {
        if (Math.abs(g - L) < 2e-6) nL++;
        else if (Math.abs(g - SL) < 2e-6) nC++;
        else nBad++;
      }
      series.push({ t, windowFaces: inWin.length, born, died, pers0InWin: pers.length, pairDriftMax, pairChecked, freqL: nL / Math.max(1, nL + nC), badGaps: nBad });
    }
  }
  // final rigidity audit: positions of t=0 persistent faces vs their t=0 self
  const finalKeys = new Map(faces.map(f => [f.lift.join(','), f]));
  let driftMax = 0;
  for (const p of persistent0) {
    const q = finalKeys.get(p.lift.join(','));
    if (q) driftMax = Math.max(driftMax, Math.hypot(q.x - p.x, q.y - p.y));
  }
  return { series: series.filter((_, i) => i % 5 === 0 || i === series.length - 1), birthsTotal, deathsTotal, persistent0Count: persistent0.length, finalPersistentDriftMax: driftMax, finalGamma: gamma };
}

// ---------- phase 2: the per-tick stability wall (knife-edge?) ----------
// Lift-position is AFFINE in γ (strip formula): per-tick displacement of ANY
// face = |(2/5)·Σ δ_k n_k| — identical for all faces, no accumulation.
// Predict: identity tracking breaks instantly when per-tick step > 0.2
// (half an edge), i.e. |δ|_eff > 0.1546 — a knife-edge, not a gradual leak.
function stabilityWall() {
  const normals = Array.from({ length: 5 }, (_, k) => { const a = Math.PI * k / 5; return [Math.cos(a), Math.sin(a)]; });
  const sumN = [0, 0];
  for (const n of normals) { sumN[0] += n[0]; sumN[1] += n[1]; }
  const gStar = 0.2 / (2 / 5 * Math.hypot(...sumN));   // analytic knife-edge for all-equal δ
  const out = { analyticGStar: gStar, steps: [] };
  for (const g of [1e-6, 1e-4, 1e-3, 1e-2, 0.05, 0.1, 0.14, 0.1546, 0.17, 0.25, 0.5]) {
    // empirical: track one deep lift for 500 ticks, all-equal step g;
    // break = per-tick position jump > 0.2 OR lift ceases to exist.
    const delta = [1, 1, 1, 1, 1].map(() => g);
    const m = new Multigrid({ N: 5, gamma: GENERIC, reach: 4 });
    const faces = m.dualEdges().faces;
    const L0 = faces.reduce((a, b) => Math.hypot(a.x, a.y) < Math.hypot(b.x, b.y) ? a : b).lift;
    const gamma = GENERIC.slice();
    let prev = facePos(L0, gamma, normals), maxJump = 0, diedAt = null;
    for (let t = 1; t <= 500; t++) {
      for (let k = 0; k < 5; k++) gamma[k] += delta[k];
      const p = facePos(L0, gamma, normals);
      maxJump = Math.max(maxJump, Math.hypot(p[0] - prev[0], p[1] - prev[1]));
      prev = p;
      if (t % 100 === 0) {
        const mm = new Multigrid({ N: 5, gamma: gamma.slice(), reach: 4 });
        if (!mm.dualEdges().faces.some(f => f.lift.join(',') === L0.join(','))) { diedAt = t; break; }
      }
    }
    out.steps.push({ g, maxJumpPerTick: maxJump, tracked500: diedAt === null, diedAt });
  }
  return out;
}

// ---------- phase 3: reach as discrete horizon (does the core conserve?) ----------
function reachHorizon() {
  const base = new Multigrid({ N: 5, gamma: GENERIC, reach: 4 });
  const baseFaces = base.dualEdges().faces;
  const baseByLift = new Map(baseFaces.map(f => [f.lift.join(','), f]));
  const out = [];
  for (let reach = 4; reach <= 24; reach += 2) {
    const m = new Multigrid({ N: 5, gamma: GENERIC, reach });
    const faces = m.dualEdges().faces;
    let maxPosDiff = 0, shared = 0;
    for (const f of faces) {
      const b = baseByLift.get(f.lift.join(','));
      if (b) { shared++; maxPosDiff = Math.max(maxPosDiff, Math.hypot(f.x - b.x, f.y - b.y)); }
    }
    const gaps = m.interceptGaps(0).gaps;
    let nL = 0, nC = 0, nBad = 0;
    for (const g of gaps) {
      if (Math.abs(g - L) < 2e-6) nL++;
      else if (Math.abs(g - SL) < 2e-6) nC++;
      else nBad++;
    }
    out.push({ reach, faces: faces.length, sharedWithReach4: shared, corePosMaxDiff: maxPosDiff, freqL: nL / Math.max(1, nL + nC), badGaps: nBad });
  }
  return out;
}

const run = () => ({ A2_sweep: sweep(), A2_wall: stabilityWall(), A2_reach: reachHorizon() });
const t0 = Date.now();
const r1 = run();
const r2 = run();
const ms = Date.now() - t0;
const stable = JSON.stringify(r1) === JSON.stringify(r2);
console.log(JSON.stringify({ elapsedMsForTwoRuns: ms, run1: r1, run2: r2, determinismStable: stable }, null, 1));

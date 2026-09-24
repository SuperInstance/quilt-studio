// EXP-A3 — DOMAIN AXIS (maximally far from physics): the floor as a computer.
// Treat the dual graph as a computation graph: faces = values, dual edges =
// typed dataflow links (family = op type), lift potentials = scheduling.
// Questions: can a floor EVALUATE a small program? does order matter? where
// does it NO-GO? Axes differing from round-2 prior art (Julia/NTT/twin-beam/
// tilt = all physics/algebra substrates): DOMAIN (dataflow compilation) ×
// DIRECTION (program-onto-floor embedding, top-down).
import { Multigrid } from '../src/multigrid.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];
const SING = [0, 0, 0, 0, 0];

// seeded PRNG — the twice-run meta-rule requires determinism
let _s = 0xC0CA5EED;
const rand = () => (_s = (_s * 1664525 + 1013904223) >>> 0) / 2 ** 32;

// ---------- phase A: graph structure ----------
// Degree of a dual vertex = number of arrangement segments bordering its cell
// = the cell's side count. P3 vertex figures (star/ace/deuce/jack/queen/king)
// predict degrees 3..7. Δ_max bounds fan-in for ANY schedule.
function structure(gamma) {
  const m = new Multigrid({ N: 5, gamma, reach: 5 });
  const { faces, edges } = m.dualEdges();
  const deg = new Array(faces.length).fill(0);
  for (const e of edges) { deg[e.a]++; deg[e.b]++; }
  const hist = {}, histInterior = {};
  let maxDeg = 0, maxDegInterior = 0;
  for (let i = 0; i < deg.length; i++) {
    hist[deg[i]] = (hist[deg[i]] ?? 0) + 1;
    maxDeg = Math.max(maxDeg, deg[i]);
    if (Math.hypot(faces[i].x, faces[i].y) < 5 * 0.4) {   // interior: clear of the reach-5 fringe
      histInterior[deg[i]] = (histInterior[deg[i]] ?? 0) + 1;
      maxDegInterior = Math.max(maxDegInterior, deg[i]);
    }
  }
  return { faces: faces.length, edges: edges.length, degreeHist: hist, maxDegree: maxDeg, interiorDegreeHist: histInterior, interiorMaxDegree: maxDegInterior };
}

// ---------- orientation: lift potentials make the dual a DAG ----------
// p_λ(j) = Σ λ_k·j_k. A dual edge changes exactly one lift component by ±1,
// so Δp = ±λ_k. With every λ_k ≠ 0 every edge is strictly oriented, and any
// directed cycle would sum strictly-positive steps to 0 — impossible.
// Kahn's algorithm verifies acyclicity; random tie-breaking samples the
// space of valid schedules (linear extensions).
function buildGraph(gamma, lambda) {
  const m = new Multigrid({ N: 5, gamma, reach: 5 });
  const { faces, edges } = m.dualEdges();
  const p = f => f.lift.reduce((a, j, k) => a + lambda[k] * j, 0);
  const adj = faces.map((_, i) => []);
  const indeg = new Array(faces.length).fill(0);
  for (const e of edges) {
    const pa = p(faces[e.a]), pb = p(faces[e.b]);
    const [u, v] = pa < pb ? [e.a, e.b] : [e.b, e.a];   // strict: λ_k ≠ 0 ∀k
    adj[u].push(v); indeg[v]++;
  }
  return { faces, adj, indeg };
}

function orient(gamma, lambda) {
  const { faces, adj, indeg } = buildGraph(gamma, lambda);
  const ind = indeg.slice();
  const queue = [];
  for (let i = 0; i < ind.length; i++) if (ind[i] === 0) queue.push(i);
  let seen = 0;
  while (queue.length) {
    const u = queue.pop(); seen++;
    for (const v of adj[u]) if (--ind[v] === 0) queue.push(v);
  }
  let samples = 0;
  if (seen === faces.length) {
    for (let s = 0; s < 300; s++) {
      const ind2 = indeg.slice();
      const ready = [];
      for (let i = 0; i < ind2.length; i++) if (ind2[i] === 0) ready.push(i);
      let cnt = 0;
      while (ready.length) {
        const pick = Math.floor(rand() * ready.length);
        const u = ready.splice(pick, 1)[0]; cnt++;
        for (const v of adj[u]) if (--ind2[v] === 0) ready.push(v);
      }
      if (cnt === faces.length) samples++;
    }
  }
  return { acyclic: seen === faces.length, topoSeen: seen, totalFaces: faces.length, randomExtensionsValid: samples };
}

// ---------- phase B: embedding limits (the NO-GOs) ----------
function embeddingLimits(genStruct, singStruct) {
  return {
    opTypesAvailable: 5,                     // hard: one op type per grid family
    opTypesHardLimit: true,                  // only 5 link types exist in the substrate
    fanInBoundGeneric: genStruct.interiorMaxDegree,  // interior cells only: fringe degrees are clipping artifacts
    fanInBoundSingular: singStruct.interiorMaxDegree,
    noGoFanIn: `in-degree > ${genStruct.interiorMaxDegree} cannot embed (max interior dual degree at generic γ)`,  // fringe degrees 1-2 are reach-clipping artifacts, not tile structure
    noGoTypes: '>5 op types cannot embed (only 5 families; multiplexing two ops on one family breaks the typed-link invariant)',
    noGoCycle: 'feedback (dataflow cycle) cannot be scheduled: every p-orientation is acyclic by construction — the floor computes exactly the straight-line (DAG) fragment',
  };
}

// ---------- phase C: evaluation — does order matter? ----------
// Fix λ=(1,2,3,4,5), take the sub-DAG within graph-distance 2 of the central
// face. Input nodes (in-degree 0) receive seeded values. Two modes:
//   INTEGER: node op over the SET of in-values, all ops exact in ℤ.
//   FLOAT-ARRIVAL: node accumulates inputs in SCHEDULE arrival order with
//     non-representable weights (×/3) — association order now = schedule.
// 400 randomized valid schedules on the SAME DAG:
// integer sinks must be invariant; float-arrival sinks spread by rounding.
function evaluate() {
  const lambda = [1, 2, 3, 4, 5];
  const { faces, adj, indeg } = buildGraph(GENERIC, lambda);
  const uadj = faces.map((_, i) => []);
  for (let u = 0; u < faces.length; u++) for (const v of adj[u]) { uadj[u].push(v); uadj[v].push(u); }
  const cid = faces.reduce((bi, f, i, arr) => Math.hypot(f.x, f.y) < Math.hypot(arr[bi].x, arr[bi].y) ? i : bi, 0);
  const dist = new Array(faces.length).fill(Infinity);
  dist[cid] = 0;
  const q = [cid];
  while (q.length) {
    const u = q.shift();
    if (dist[u] >= 3) continue;
    for (const v of uadj[u]) if (dist[v] === Infinity) { dist[v] = dist[u] + 1; q.push(v); }
  }
  const ball = faces.map((_, i) => i).filter(i => dist[i] <= 3);
  const inBall = new Set(ball);
  const lin = new Map(ball.map(i => [i, []]));
  const lout = new Map(ball.map(i => [i, []]));
  const lindeg = new Map(ball.map(i => [i, 0]));
  for (let u = 0; u < faces.length; u++) {
    if (!inBall.has(u)) continue;
    for (const v of adj[u]) {
      if (!inBall.has(v)) continue;
      lout.get(u).push(v); lin.get(v).push(u); lindeg.set(v, lindeg.get(v) + 1);
    }
  }
  const OPS = [
    a => a.reduce((x, y) => x + y, 0),   // fam0: +
    a => a.reduce((x, y) => x * y, 1),   // fam1: ×
    a => a.reduce((x, y) => x - y),      // fam2: −
    a => Math.max(...a),                 // fam3: max
    a => a.reduce((x, y) => x + y, 0),   // fam4: Σ (mean = Σ/n applied outside)
  ];
  const hostFam = i => Math.abs(faces[i].lift.reduce((a, j) => a * 31 + j, 7)) % 5;
  const seed = i => Math.abs(faces[i].lift.reduce((a, j) => a * 131 + j * 17, 3)) % 97 + 1;

  const schedule = () => {
    const ind = new Map(lindeg);
    const ready = ball.filter(i => ind.get(i) === 0);
    const order = [];
    while (ready.length) {
      const pick = Math.floor(rand() * ready.length);
      const u = ready.splice(pick, 1)[0];
      order.push(u);
      for (const v of lout.get(u)) { ind.set(v, ind.get(v) - 1); if (ind.get(v) === 0) ready.push(v); }
    }
    return order;
  };
  const orderIndex = order => new Map(order.map((u, i) => [u, i]));

  const exec = (order, mode) => {
    const oi = orderIndex(order);
    const value = new Map();
    for (const u of order) {
      const fam = hostFam(u);
      if (lindeg.get(u) === 0) { value.set(u, mode === 'int' ? seed(u) : seed(u) / 3); continue; }
      const ins = lin.get(u).map(v => value.get(v));
      if (mode === 'int') {
        const r = Math.trunc(OPS[fam](ins));
        value.set(u, fam === 4 ? Math.trunc(r / ins.length) : r);
      } else {
        // arrival accumulation: combine in schedule order (association = schedule)
        const arr = lin.get(u).slice().sort((a, b) => oi.get(a) - oi.get(b));
        let acc = value.get(arr[0]);
        for (let i = 1; i < arr.length; i++) {
          const y = value.get(arr[i]);
          acc = fam === 1 ? acc * y : fam === 2 ? acc - y : fam === 3 ? Math.max(acc, y) : acc + y;
        }
        if (fam === 4) acc = acc / arr.length;
        value.set(u, acc);
      }
    }
    const sinks = ball.filter(i => lout.get(i).length === 0);
    return sinks.map(s => value.get(s));
  };

  let maxInDegreeInBall = 0;
  for (const i of ball) maxInDegreeInBall = Math.max(maxInDegreeInBall, lindeg.get(i));
  const intSinks = new Set(), floatSinks = new Set();
  let floatSamples = 0;
  for (let r = 0; r < 400; r++) {
    const order = schedule();
    intSinks.add(JSON.stringify(exec(order, 'int')));
    const fs = exec(order, 'float');
    floatSinks.add(JSON.stringify(fs));
    floatSamples++;
  }
  return { ballSize: ball.length, maxInDegreeInBall, schedulesRun: floatSamples, distinctIntegerSinkVectors: intSinks.size, distinctFloatSinkVectors: floatSinks.size };
}

const run = () => {
  const gen = structure(GENERIC);
  const sing = structure(SING);
  return {
    A3_structureGeneric: gen,
    A3_structureSingular: sing,
    A3_orientations: [
      { lambda: [1, 2, 3, 4, 5], gamma: 'generic', ...orient(GENERIC, [1, 2, 3, 4, 5]) },
      { lambda: [5, 4, 3, 2, 1], gamma: 'generic', ...orient(GENERIC, [5, 4, 3, 2, 1]) },
      { lambda: [1, -2, 3, -4, 5], gamma: 'generic', ...orient(GENERIC, [1, -2, 3, -4, 5]) },
      { lambda: [-3, 1, 4, -1, 2], gamma: 'singular', ...orient(SING, [-3, 1, 4, -1, 2]) },
    ],
    A3_limits: embeddingLimits(gen, sing),
    A3_eval: evaluate(),
  };
};
const r1 = run();
_s = 0xC0CA5EED;   // reseed so run 2 follows the identical stochastic path
const r2 = run();
const stable = JSON.stringify(r1) === JSON.stringify(r2);
console.log(JSON.stringify({ run1: r1, run2: r2, determinismStable: stable }, null, 1));

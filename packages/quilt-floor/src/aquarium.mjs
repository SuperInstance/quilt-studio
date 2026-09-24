// THE CORRUPTION AQUARIUM — a live monitor instrument for the floor's
// silent corruption band (parents: EXP-A1 band map + integrality
// invisibility; EXP-B3 migration-under-ticking; EXP-B1 dual-only
// detection). The aquarium keeps a Multigrid resident INSIDE the band
// ε∈(1e-9,1e-6) at the resonant all-equal shift and samples two channels
// per tick:
//
//   IDENTITY — lift integrality. Always reads PERFECT inside the band:
//   tieFloor floors whatever it sees, so every lift is an exact integer
//   while WHICH integer gets assigned is silently wrong. A flatline.
//   GEOMETRY — dual edge-length error vs the exact 2/N theorem (γ-
//   independent). Screams: 0.83–0.89 vs 0.4 mid-band.
//
// The dual-only detector closes EXP-B1: edge-length SPREAD (max−min)
// separates healthy (~3e-15 across nine orders of ε) from corrupt
// (≥0.36) with a 1e-6 threshold — ten orders of measured margin — and
// receives only {faces, edges}: no ε, no γ, no multigrid. The wall the
// aquarium welds into an exhibit: verification channels see their own
// channel, not the world (the same silhouette as the ocean cache's
// .9520 injection-clustering hole — two substrates, one shape).
//
// A1 refinement pinned by the freeze probe: below the 1e-9 key quantum
// the COMBINATORICS freeze (counts bit-equal to ε=0) while POSITIONS
// still move — positions are γ-views, not identity (frames.mjs honest
// law). "Bit-identical" was half the truth; both halves are instruments
// here (positionDigest exists to prove the honest half).

import { Multigrid } from './multigrid.mjs';

const FNV = 16777619;
const digest = (parts) => {
  let h = 0x811c9dc5;
  for (const p of parts) for (const c of p) { h ^= c.charCodeAt(0); h = Math.imul(h, FNV) >>> 0; }
  return h.toString(16).padStart(8, '0');
};

// ---------- dual-only detection (EXP-B1 closure) ----------
// Only {faces, edges} in — the detector may not know ε exists.
export function detectFromDual({ faces, edges }) {
  let minLen = Infinity, maxLen = 0;
  for (const e of edges) {
    const len = Math.hypot(faces[e.b].x - faces[e.a].x, faces[e.b].y - faces[e.a].y);
    if (len < minLen) minLen = len;
    if (len > maxLen) maxLen = len;
  }
  const spread = maxLen - minLen;
  // Measured separation (41-point residency + 9-regime sweep, twice-run):
  // healthy spread ≤ 3.9e-15, corrupt spread ≥ 0.3608. Threshold sits
  // ten orders below the corrupt floor and nine above the healthy ceil.
  return { spread, minLen, maxLen, corrupted: spread > 1e-6 };
}

// ---------- per-tick vitals ----------
export function aquariumVitals(m) {
  const { faces, edges } = m.dualEdges();
  const expected = 2 / m.N;                       // the exact law, γ-free
  let maxEdgeErr = 0;
  for (const e of edges) {
    const len = Math.hypot(faces[e.b].x - faces[e.a].x, faces[e.b].y - faces[e.a].y);
    const err = Math.abs(len - expected);
    if (err > maxEdgeErr) maxEdgeErr = err;
  }
  let nonIntLifts = 0;
  for (const f of faces) for (const j of f.lift) if (!Number.isInteger(j)) nonIntLifts++;
  // Positions are views (honest law): digest proves they track γ even
  // when the combinatorics freeze. toFixed(17) keeps float honesty.
  const positionDigest = digest(faces.flatMap(f =>
    [`${f.lift.join(',')}@${f.x.toFixed(17)},${f.y.toFixed(17)}`]));
  const det = detectFromDual({ faces, edges });
  return {
    faces: faces.length, edges: edges.length,
    maxEdgeErr, spread: det.spread, nonIntLifts,
    positionDigest, identityOk: nonIntLifts === 0, corrupted: det.corrupted,
  };
}

// ---------- the residency ----------
// Park the floor at the resonant shift γ=ε·(1,…,1) and drift ε from→to
// on a log ramp. Per tick: rebuild (geometry is the arbiter, A2 lineage)
// and sample. The drift through the band is the exhibit: face counts
// migrate through quantized plateaus (measured 908→920→…→1006) while
// the identity channel flatlines — a topology phase transition between
// two exact regimes (frozen 900/1010 at ε=0; refrozen 1006/1225 above
// 1e-6), with the melt between them.
export function runResidency({ from = 1e-9, to = 1e-6, steps = 40, reach = 3 } = {}) {
  const trace = [];
  for (let i = 0; i <= steps; i++) {
    const eps = from * Math.pow(to / from, i / steps);
    const m = new Multigrid({ N: 5, gamma: new Array(5).fill(eps), reach });
    const v = aquariumVitals(m);
    trace.push({
      i, eps, faces: v.faces, edges: v.edges,
      maxEdgeErr: v.maxEdgeErr, spread: v.spread,
      nonIntLifts: v.nonIntLifts, identityOk: v.identityOk,
      corrupted: v.corrupted,
      phase: v.corrupted ? 'MELTING' : (eps < 1e-8 ? 'FROZEN' : 'HEALED'),
    });
  }
  const last = trace[trace.length - 1];
  const plateaus = new Set(trace.map(s => s.faces)).size;
  return {
    trace,
    summary: {
      healed: last.maxEdgeErr < 1e-12,
      maxEdgeErrSeen: Math.max(...trace.map(s => s.maxEdgeErr)),
      corruptedSteps: trace.filter(s => s.corrupted).length,
      plateaus,
      from, to, steps, reach,
    },
  };
}

// ---------- the EKG render ----------
// Two channels that should co-move and don't — that IS the boundary.
//   IDENTITY — a flat line (the lie the wall tells).
//   GEOMETRY — a bar that melts and anneals (the truth).
export function renderEkg(trace, { width = 40 } = {}) {
  const lines = [];
  lines.push('CORRUPTION AQUARIUM — identity vs geometry, live');
  lines.push('  ε : shift · GEO : edge-length err (theorem: 2/5 exactly, any γ)');
  lines.push('─── IDENTITY ───·─── GEOMETRY ───────────────────────────');
  for (const s of trace) {
    const geo = Math.round(Math.min(1, s.maxEdgeErr / 0.9) * width);
    const geoBar = s.corrupted
      ? '█'.repeat(geo).padEnd(width, '·')
      : '·'.repeat(width);
    const idBar = s.identityOk ? '──────── flatline ── ok ──' : '!! IDENTITY BREAK !!';
    lines.push(`${s.eps.toExponential(1)} ${s.phase.padEnd(7)} |${idBar}| ${geoBar} ${s.maxEdgeErr.toExponential(2)} f${s.faces}`);
  }
  return lines.join('\n');
}

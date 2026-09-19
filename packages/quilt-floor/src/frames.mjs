// frames.mjs — temporal super-resolution for ℚ¹⁶ breed trajectories.
//
// Concept-adapted CLEAN-ROOM from Merserk/dlss5-visual-enhancer's DLSS 5
// architecture (NO code taken — the Merserk Source License 1.0 forbids
// redistribution/modified builds; ideas are not copyrightable, and every
// line here is original fleet code on the floor's exact machinery):
//
//   DLSS Frame Generation → genFrames: exact ℚ quadratic-Hermite legs
//     between observed ticks; the "motion vectors" are q16's exact
//     velocities — DLSS needs optical flow, we get it for free.
//   Shimmer Suppression   → smoothFrames: LEG-LOCAL DIFFUSION — generated
//     frames relax by exact ℚ neighbor averaging with observed endpoints
//     pinned (the naive global EMA was tried and REJECTED: hard constraints
//     and recursive filters do not commute — see THE-FLOOR.md §16)
//   Detail-Only preset    → detailOnly: pinned global dials are exact-copied
//     (tone/color preserved), structural dials take the mutation.
//   Cascade mode          → the hermit P1 pattern by name: coarse D1 ticks
//     + local WAL replay substeps. Not rebuilt here — it already exists.
//
// THE HONEST LAW (floor doctrine): generated frames are a VIEW. Identity
// states are the observed ticks and nothing else; a generated frame is a
// float sample with a ℚ lift, never a new identity. Interpolation never
// mints breed history.

import { makeRat, ratAdd, ratSub, ratMul, ratDiv, ratEq, ratIsZero, ratToNumber, ratToString, floatToRat } from './commensurate.mjs';

const ZERO = makeRat(0n);
const ONE = makeRat(1n);
const TWO = makeRat(2n);
const FOUR = makeRat(4n);

const vAdd = (a, b) => a.map((x, i) => ratAdd(x, b[i]));
const vSub = (a, b) => a.map((x, i) => ratSub(x, b[i]));
const vScale = (a, s) => a.map(x => ratMul(x, s));
const vMid = (a, b) => vScale(vAdd(a, b), ratDiv(ONE, TWO));

// hermiteLegs(traj) — per-leg exact quadratic: from state P_i to P_{i+1}
// with knot velocity d_i = (P_{i+1} − P_{i−1})/2 (central; one-sided at the
// ends). Bezier control C_i = P_i + d_i/2. The leg passes through BOTH
// endpoints exactly; in-between is the generated view. Velocity kinks at
// interior knots (C¹ breaks where the record turns) are reported, not
// hidden — they are the shimmer the suppressor targets.
export function hermiteLegs(traj) {
  const V = traj.vectors;
  const n = V.length;
  if (n < 2) throw new Error('frames: need ≥2 states to interpolate');
  const d = i => {
    if (i === 0) return vScale(vSub(V[1], V[0]), ONE); // forward
    if (i === n - 1) return vScale(vSub(V[n - 1], V[n - 2]), ONE); // backward
    return vMid(vSub(V[i + 1], V[i]), vSub(V[i], V[i - 1])); // central
  };
  const legs = [];
  for (let i = 0; i < n - 1; i++) {
    const di = d(i), di1 = d(i + 1);
    const C = vAdd(V[i], vScale(di, ratDiv(ONE, TWO)));
    legs.push({ from: V[i], to: V[i + 1], d0: di, d1: di1, ctrl: C, index: i });
  }
  // velocity kink at interior knot i: end-velocity of leg i−1 vs start of leg i
  const kinks = [];
  for (let i = 1; i < n - 1; i++) {
    const endPrev = vScale(vSub(V[i], legs[i - 1].ctrl), TWO); // 2(P_i − C_{i−1})
    const startNext = vScale(vSub(legs[i].ctrl, V[i]), TWO); // 2(C_i − P_i)
    const gap = vSub(endPrev, startNext);
    const mag = gap.reduce((s, r) => ratAdd(s, ratMul(r, r)), ZERO);
    kinks.push({ knot: i, gapSq: mag });
  }
  return { legs, kinks };
}

// evalLeg(leg, tau) — the leg's ℚ state at τ∈[0,1]: B(τ) =
// (1−τ)²·P + 2τ(1−τ)·C + τ²·Q, exact rationals throughout.
export function evalLeg(leg, tau) {
  const t = typeof tau === 'number' ? floatToRat(tau) : tau;
  const om = ratSub(ONE, t);
  const w0 = ratMul(om, om);
  const w1 = ratMul(ratMul(TWO, t), om);
  const w2 = ratMul(t, t);
  return leg.from.map((p, i) =>
    ratAdd(ratAdd(ratMul(w0, p), ratMul(w1, leg.ctrl[i])), ratMul(w2, leg.to[i])));
}

// genFrames(traj, {factor}) — the frame generator. factor f puts f−1
// generated frames between each observed pair and returns f·(n−1)+1
// frames; frames at observed ticks are the states EXACTLY (ratEq),
// generated frames carry exact: false — the view flag.
export function genFrames(traj, { factor = 2 } = {}) {
  if (!Number.isInteger(factor) || factor < 1) throw new Error('frames: factor must be a positive integer');
  const { legs } = hermiteLegs(traj);
  const frames = [];
  for (let i = 0; i < legs.length; i++) {
    for (let s = 0; s < factor; s++) {
      const tau = makeRat(BigInt(s), BigInt(factor));
      const state = evalLeg(legs[i], tau);
      frames.push({
        t: i + Number(s) / factor,
        leg: i,
        observed: s === 0,
        exact: s === 0,
        state,
        view: state.map(ratToNumber),
        lift: state.map(ratToString),
      });
    }
  }
  const last = traj.vectors[traj.vectors.length - 1];
  frames.push({ t: traj.vectors.length - 1, leg: legs.length - 1, observed: true, exact: true, state: last, view: last.map(ratToNumber), lift: last.map(ratToString) });
  return frames;
}

// smoothFrames(frames, {passes}) — shimmer suppression as LEG-LOCAL
// DIFFUSION (curve fairing): within each leg, generated interior frames
// relax by exact ℚ neighbor averaging, x ← (prev + next)/2, with the
// OBSERVED endpoints pinned as hard constraints (the record is the record).
// A straight leg is a fixed point — smoothing a smooth path changes nothing
// (anti-vacuity). The naive global-EMA alternative was tried and REJECTED:
// routing velocity through pinned observed ticks dumps accumulated error
// into the next view and raises energy — hard constraints and recursive
// filters do not commute. (Lesson pinned in THE-FLOOR.md §16.)
export function smoothFrames(frames, { passes = 1 } = {}) {
  const out = frames.map(f => ({ ...f, state: f.state.slice(), view: f.view.slice(), lift: f.lift.slice(), smoothed: false }));
  // windows are the runs BETWEEN CONSECUTIVE OBSERVED frames (the pinned
  // endpoints), not the generator's leg field — every generated view lives
  // inside exactly one window, observed ticks are shared hard boundaries
  const windows = [];
  let start = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i].observed) {
      if (start !== null) windows.push([start, i]);
      start = i;
    }
  }
  for (const [lo, hi] of windows) {
    if (hi - lo < 2) continue; // adjacent observed frames: nothing generated
    for (let p = 0; p < passes; p++) {
      for (let j = lo + 1; j < hi; j++) {
        const prev = out[j - 1].state, next = out[j + 1].state;
        const cur = out[j].state;
        const relaxed = cur.map((x, d) => ratDiv(ratAdd(prev[d], next[d]), TWO));
        out[j].state = relaxed;
        out[j].view = relaxed.map(ratToNumber);
        out[j].lift = relaxed.map(ratToString);
        out[j].smoothed = true;
        out[j].exact = false;
      }
    }
  }
  return out;
}

// detailOnly(prev, next, {pin}) — the preset: global dials (tone/color) are
// exact-copied from prev; structural dials take the proposed mutation. The
// pinned dials' deltas are BigInt zeros — preservation is exact, not tuned.
export function detailOnly(prev, next, { pin = [] } = {}) {
  const pinned = new Set(pin);
  return prev.map((p, i) => pinned.has(i) ? p : next[i]);
}

// hostFrames(kernel, frames, {name}) — tenancy: every frame is a cell (the
// float view; lift in meta), chained by 'follows'; observed frames carry
// what: 'observed tick', generated frames what: 'generated view'.
export function hostFrames(kernel, frames, { name = 'frames' } = {}) {
  frames.forEach((f, i) => {
    kernel.bind(`${name}.f${i}`, f.view, {
      what: f.observed ? `observed tick t=${f.t}` : `generated view t=${f.t} (never identity)`,
      lift: f.lift, leg: f.leg,
    });
    if (i > 0) kernel.link(`${name}.f${i - 1}`, `${name}.f${i}`, 'follows');
  });
  return { cells: frames.length, links: frames.length - 1 };
}

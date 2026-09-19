// q16.mjs — ℚ¹⁶ breed trajectories: agent/genome state as exact rational
// vectors over time. The four fleet anchors converge here:
//
//   • quilt-cell's "16-dial Q1.15" — fixed-point cell vectors, byte-exact
//     across SIX languages. Q1.15 IS dyadic (n/2¹⁵), so liftQ15 lands every
//     language's bytes on the identical ℚ — one identity, six tongues.
//   • tidepool — the memory ocean that STORES the trajectory; a breed run
//     is a path through it, and this module is its differential geometry.
//   • duke-lab's 16-feature ruler — the measurement function that maps a
//     live system to a ℚ¹⁶ observation (floats lifted, honestly).
//   • musician-soul's AbstractionSpline (f32, Catmull-Rom) — the SECOND
//     backend of the same trait: arc_length, curvature, tangent. This file
//     is the exact one.
//
// Doctrine per THE-FLOOR: the vector components are ℚ identity; norms and
// arc lengths are float MEASURES (√ leaves ℚ — said out loud, once, here);
// commensuration verdicts are exact BigInt zeros or exact rational errors.

import {
  makeRat, ratAdd, ratSub, ratMul, ratDiv, ratEq, ratIsZero, ratAbs,
  ratToNumber, ratToString, floatToRat, nearestRational,
} from './commensurate.mjs';

export const DIM = 16;
export const Q15_SCALE = 32768n; // 2^15

// liftQ15(n) / liftQ15Vector — Q1.15 int16 dial → exact ℚ. The six-language
// substrate guarantees every implementation lifts to the same rational.
export const liftQ15 = n => makeRat(BigInt(n), Q15_SCALE);
export const liftQ15Vector = arr => {
  if (arr.length !== DIM) throw new Error(`q16: vector has ${arr.length} dials, need ${DIM}`);
  return arr.map(liftQ15);
};
// liftMeasured — duke-lab style float measurement → dyadic shadow (honest)
export const liftMeasured = arr => {
  if (arr.length !== DIM) throw new Error(`q16: vector has ${arr.length} dials, need ${DIM}`);
  return arr.map(floatToRat);
};

export function makeTraj(vectors) {
  if (!Array.isArray(vectors) || vectors.length < 1) throw new Error('q16: empty trajectory');
  for (const v of vectors) {
    if (!Array.isArray(v) || v.length !== DIM) throw new Error(`q16: vector has ${v?.length} dials, need ${DIM}`);
  }
  return { vectors: vectors.map(v => v.slice()) };
}

// displacement(a, b) — componentwise b − a, exact ℚ¹⁶
export const displacement = (a, b) => a.map((x, i) => ratSub(b[i], x));
// velocity(traj, i) — the tick-i step, i ≥ 1
export const velocity = (traj, i) => {
  if (i < 1 || i >= traj.vectors.length) throw new RangeError('q16: velocity index out of range');
  return displacement(traj.vectors[i - 1], traj.vectors[i]);
};

// norm(v) — float MEASURE (√ leaves ℚ; the sum of squares is exact, the
// root is measured)
export function norm(v) {
  const sq = v.reduce((s, r) => ratAdd(s, ratMul(r, r)), makeRat(0n));
  return Math.sqrt(ratToNumber(sq));
}

// arcLen(traj) — total path length as a float measure: the exact sum of
// float-measured leg norms. (musician-soul's arc_length, exact backend.)
export function arcLen(traj) {
  let L = 0;
  for (let i = 1; i < traj.vectors.length; i++) L += norm(velocity(traj, i));
  return L;
}

// commensurateStep(traj, i, {maxDen}) — per-dial TWO exact laws:
//   1. lattice-exact: the velocity is an integral number of Q1.15 quanta
//      (BigInt-zero remainder — the six-language substrate guarantee);
//   2. self-ratio: where the dial was nonzero, r_i/r_{i-1} is EXACTLY a
//      small-denominator rational (error == 0, never a tolerance) — the
//      breed signature: dials that move by musical ratios (3/2, 4/3, 5/4)
//      sing; wild dials report their exact rational error.
export function commensurateStep(traj, i, { maxDen = 20, quantum = Q15_SCALE } = {}) {
  if (i < 1 || i >= traj.vectors.length) throw new RangeError('q16: velocity index out of range');
  const prev = traj.vectors[i - 1];
  const v = velocity(traj, i);
  const QB = BigInt(quantum);
  return v.map((r, d) => {
    const still = ratIsZero(r);
    const onLattice = still || (r.num * QB) % r.den === 0n;
    const quanta = onLattice ? (r.num * QB) / r.den : null;
    let ratio = null;
    if (!ratIsZero(prev[d])) {
      const { rat, error } = nearestRational(ratDiv(ratAdd(prev[d], r), prev[d]), maxDen);
      ratio = { commensurate: ratIsZero(error), rat, error };
    }
    return { dial: d, still, onLattice, quanta, ratio };
  });
}

// breedSignature(traj, {maxDen}) — the whole run: which dials moved by
// exact small rationals, every tick. A breed that respects the lattice
// sings small denominators; a wild one sings exact errors.
export function breedSignature(traj, { maxDen = 20 } = {}) {
  const sig = [];
  for (let i = 1; i < traj.vectors.length; i++) sig.push(commensurateStep(traj, i, { maxDen }));
  return sig;
}

// hostTraj(kernel, traj, {name}) — tenancy: each tick is a cell whose value
// is the float VIEW and whose meta.lift is the exact ℚ identity (16 "n/d"
// strings); ticks chain by 'evolves' links. Both kernels hold it identically.
export function hostTraj(kernel, traj, { name = 'traj' } = {}) {
  traj.vectors.forEach((v, i) => {
    kernel.bind(`${name}.t${i}`, v.map(ratToNumber), {
      what: `ℚ¹⁶ breed tick ${i} (floats are the view)`,
      lift: v.map(ratToString),
    });
    if (i > 0) kernel.link(`${name}.t${i - 1}`, `${name}.t${i}`, 'evolves');
  });
  return { cells: traj.vectors.length, links: traj.vectors.length - 1 };
}

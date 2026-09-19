// ph.mjs — Pythagorean-hodograph cubics: the evolution beyond pythagoreanArc.
//
// spline.mjs's pythagoreanArc pins an exact CIRCLE (rational quadratic,
// |p−c|² = r² as BigInt zero) but pays for it with π in the arc length. The
// PH cubic pays the other way and wins bigger: the hodograph is a perfect
// complex square, c′(t) = (a + b·t)² with a, b ∈ ℚ[i], so the speed is a
// real QUADRATIC POLYNOMIAL σ(t) = |a + b·t|² — and then:
//
//   • arc length s(t) = ∫₀ᵗ σ  is a cubic with ℚ coefficients. Exact.
//     No integral, no Simpson, no π — one Horner pass in BigInt.
//   • curvature κ(t) = 2·Im(b·conj(a + b·t)) / σ(t)² — a rational function,
//     exact ℚ at every station. The kill-veto reads truth, not samples.
//   • position c(t) = c₀ + a²t + ab·t² + (b²/3)·t³ — exact ℚ points.
//
// Doctrine unchanged: a, b, c₀ are ℚ (designer-chosen lifts); t ∈ [0,1] ℚ;
// floats appear only when a renderer asks for numbers to draw.
//
// Reference: R. T. Farouki, "Pythagorean-Hodograph Curves" (2008) — the
// field Casey pointed at with "get to the metal": exact geometry where the
// measure is a closed form, not a quadrature.

import { makeRat, ratAdd, ratSub, ratMul, ratDiv, ratNeg, ratEq, ratSign, ratIsZero, ratToNumber, ratToString, floatToRat, ratSqrt } from './commensurate.mjs';

const ZERO = makeRat(0n);
const ONE = makeRat(1n);
const TWO = makeRat(2n);
const THREE = makeRat(3n);

// complex ℚ pair helpers: z = [x, y]
const zAdd = (u, v) => [ratAdd(u[0], v[0]), ratAdd(u[1], v[1])];
const zSub = (u, v) => [ratSub(u[0], v[0]), ratSub(u[1], v[1])];
const zMul = (u, v) => [ratSub(ratMul(u[0], v[0]), ratMul(u[1], v[1])), ratAdd(ratMul(u[0], v[1]), ratMul(u[1], v[0]))];
const zScale = (u, s) => [ratMul(u[0], s), ratMul(u[1], s)];
const zAbs2 = u => ratAdd(ratMul(u[0], u[0]), ratMul(u[1], u[1]));

// makePH({a, b, c0}) — the designer's knobs, all ℚ. The hodograph square.
export function makePH({ a, b, c0 = [ZERO, ZERO] }) {
  // σ(t) = |a + b·t|² = s2·t² + s1·t + s0  (speed, real quadratic)
  const s2 = zAbs2(b);
  const s1 = ratMul(TWO, ratAdd(ratMul(a[0], b[0]), ratMul(a[1], b[1])));
  const s0 = zAbs2(a);

  // c(t) = c0 + a²·t + a·b·t² + (b²/3)·t³   (position, complex cubic)
  const a2 = zMul(a, a);
  const ab = zMul(a, b);
  const b2_3 = zScale(zMul(b, b), ratDiv(ONE, THREE));

  const evalPH = t => zAdd(c0, zAdd(zScale(a2, t), zAdd(zScale(ab, ratMul(t, t)), zScale(b2_3, ratMul(t, ratMul(t, t))))));
  const speed = t => ratAdd(ratAdd(ratMul(s2, ratMul(t, t)), ratMul(s1, t)), s0);
  // exact arc length from 0 to t: s2·t³/3 + s1·t²/2 + s0·t
  const lengthTo = t => {
    const t2 = ratMul(t, t), t3 = ratMul(t2, t);
    return ratAdd(ratAdd(ratMul(ratDiv(s2, THREE), t3), ratMul(ratDiv(s1, TWO), t2)), ratMul(s0, t));
  };
  // exact curvature: 2·(by·(ax+bx·t) − bx·(ay+by·t)) / σ(t)²
  const kappaAt = t => {
    const num = ratMul(TWO, ratSub(ratMul(b[1], ratAdd(a[0], ratMul(b[0], t))), ratMul(b[0], ratAdd(a[1], ratMul(b[1], t)))));
    const sg = speed(t);
    return ratDiv(num, ratMul(sg, sg));
  };

  return {
    a, b, c0, s0, s1, s2,
    eval: evalPH, speed, lengthTo, length: () => lengthTo(ONE), kappaAt,
  };
}

// exact complex sqrt of a ℚ pair [u, v]: returns [p, q] with (p+iq)² = Δ,
// or null when Δ has no ℚ[i] root. v = 0 branch: real or imaginary axis.
function csqrtRat(u, v) {
  if (ratIsZero(v)) {
    if (ratSign(u) >= 0) { const p = ratSqrt(u); return p ? [p, ZERO] : null; }
    const p = ratSqrt(ratNeg(u)); return p ? [ZERO, p] : null;
  }
  // general: p² = (r + u)/2, q = v/(2p), r = |Δ| — ℚ only in luckier cases;
  // the fabric's perpendicular bow keeps Δ on the real axis, so this branch
  // is an honest NOT-YET rather than a hidden gap.
  return null;
}

// solveHodograph(d, b) — the PH Hermite step: find a with
// a² + a·b + b²/3 = d (endpoint interpolation). Quadratic in a:
// a = (−b + √(4d − b²/3)) / 2. Exact in ℚ[i] when the discriminant is a
// ℚ square; null otherwise (the caller shadows honestly).
export function solveHodograph(d, b) {
  const disc = zSub(zScale(d, makeRat(4n)), zScale(zMul(b, b), ratDiv(ONE, THREE)));
  const s = csqrtRat(disc[0], disc[1]);
  if (!s) return null;
  return zScale(zAdd([ratNeg(b[0]), ratNeg(b[1])], s), ratDiv(ONE, TWO));
}

// phFromChord(A, B, {side}) — the fabric bow, evolved: a PH cubic through
// the measured endpoints A→B, bowed by b ⟂ chord with |b| = side·|chord|.
// HONEST LIMIT, pinned by modular arithmetic: for an axis chord L and a
// dyadic bow q, disc = 4L + q²/3 = (12L·4^k + m²)/(3·4^k) carries an ODD
// power of 3 in its denominator unless 3 | m — so the perpendicular-bow PH
// through ℚ endpoints is generically NOT ℚ-exact (side 0.1 on chord 8:
// disc = 2416/75). When solveHodograph returns null the coefficients become
// f64 shadows of the same law (exact = false) — the length stays a closed
// form OF THOSE coefficients, exactness flagged per the floor doctrine.
export function phFromChord(A, B, { side = 0.1 } = {}) {
  const a0 = floatToRat(A.x), a1 = floatToRat(A.y);
  const b0 = floatToRat(B.x), b1 = floatToRat(B.y);
  const d = [ratSub(b0, a0), ratSub(b1, a1)];
  const s = floatToRat(side);
  const b = [ratNeg(ratMul(d[1], s)), ratMul(d[0], s)]; // b ⟂ chord
  let a = solveHodograph(d, b);
  const exact = a !== null;
  if (!exact) {
    // f64 shadow of the same formula: √(4d − b²/3) as complex doubles
    const du = 4 * ratToNumber(d[0]) - (ratToNumber(b[0]) ** 2 - ratToNumber(b[1]) ** 2) / 3;
    const dv = 4 * ratToNumber(d[1]) - 2 * ratToNumber(b[0]) * ratToNumber(b[1]) / 3;
    const r = Math.hypot(du, dv);
    const p = Math.sqrt((r + du) / 2), q = Math.sign(dv) * Math.sqrt(Math.max(0, (r - du) / 2));
    a = [floatToRat((-ratToNumber(b[0]) + p) / 2), floatToRat((-ratToNumber(b[1]) + q) / 2)];
  }
  const ph = makePH({ a, b, c0: [a0, a1] });
  return { ...ph, chord: Math.hypot(B.x - A.x, B.y - A.y), exact };
}

// hostPH(kernel, ph, {name}) — tenancy: the four ℚ coefficients and the
// exact length are the identity; floats only in the view.
export function hostPH(kernel, ph, { name = 'ph' } = {}) {
  kernel.bind(`${name}.a`, ph.a.map(ratToNumber), { lift: ph.a.map(ratToString) });
  kernel.bind(`${name}.b`, ph.b.map(ratToNumber), { lift: ph.b.map(ratToString) });
  kernel.bind(`${name}.c0`, ph.c0.map(ratToNumber), { lift: ph.c0.map(ratToString) });
  kernel.bind(`${name}.length`, { value: ratToNumber(ph.length()) }, {
    what: 'exact PH arc length (ℚ closed form)', lift: { s: ratToString(ph.length()) },
  });
  return { cells: 4 };
}

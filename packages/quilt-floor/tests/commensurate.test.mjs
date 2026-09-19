// Exact commensuration — the twist instrument's rationals, no tolerance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRat, floatToRat, ratToNumber, ratToString, ratSub, ratAbs, ratCmp,
  continuedFraction, nearestRational, ratAdd, ratMul, ratDiv, ratNeg, ratEq, ratIsZero,
} from '../src/commensurate.mjs';
import { PHI } from '../src/golden.mjs';

test('floatToRat is honest: 0.1 is the dyadic 3602879701896397/2^55, not 1/10', () => {
  const r = floatToRat(0.1);
  assert.equal(ratToString(r), '3602879701896397/36028797018963968');
  assert.equal(ratToNumber(r), 0.1); // round-trips exactly
});

test('floatToRat: integers, negatives, zero, subnormals; non-finite → null', () => {
  assert.deepEqual(floatToRat(3), { num: 3n, den: 1n });
  assert.deepEqual(floatToRat(-2.5), { num: -5n, den: 2n });
  assert.deepEqual(floatToRat(0), { num: 0n, den: 1n });
  assert.ok(floatToRat(5e-324).den > 0n); // smallest subnormal is exact
  assert.equal(floatToRat(Infinity), null);
  assert.equal(floatToRat(NaN), null);
});

test('exact arithmetic: 1/φ is NOT 8/13, but 8/13 is its best shadow at den ≤ 13', () => {
  const invPhi = (PHI - 1);
  const exact = floatToRat(invPhi);
  assert.equal(exact.num * 13n !== exact.den * 8n, true, '1/φ ≠ 8/13 exactly');
  const { rat, error } = nearestRational(invPhi, 13);
  assert.equal(ratToString(rat), '8/13');
  assert.ok(ratCmp(error, makeRat(1, 300)) < 0, `err ${ratToString(error)}`);
  // and at den ≤ 21 the Fibonacci walk continues: 13/21
  assert.equal(ratToString(nearestRational(invPhi, 21).rat), '13/21');
});

test('continuedFraction: 1/φ is all-ones forever (the golden CF)', () => {
  const terms = continuedFraction(floatToRat(PHI - 1), 12);
  assert.equal(terms[0], 0n);
  for (let i = 1; i < 12; i++) assert.equal(terms[i], 1n, `term ${i} must be 1`);
});

test('π/(2φ) commensurates to 4/13 — sharper than the old float answer 3/10', () => {
  const ratio = 1 / (2 * PHI); // d/π when d = π/(2φ)
  const { rat } = nearestRational(ratio, 20);
  assert.equal(ratToString(rat), '4/13');
  // old float method found 3/10 with err 0.0090; exact method: 4/13, err 0.00133
  const err = Math.abs(ratToNumber(rat) - ratio);
  assert.ok(err < 0.002, `error ${err}`);
});

test('exact comparisons: ties are decided, not tolerated', () => {
  // 1/3 vs dyadic shadow of 0.3333333333333333: exact difference is positive
  const d = ratSub(floatToRat(1 / 3), makeRat(1, 3));
  assert.ok(ratCmp(d, makeRat(0)) < 0, 'f64(1/3) is strictly BELOW 1/3');
  // |x − x| is exactly 0 (no tolerance imports)
  assert.equal(ratCmp(ratSub(floatToRat(0.75), makeRat(3, 4)), makeRat(0)), 0);
  assert.equal(ratToString(ratAbs(makeRat(-7, 9))), '7/9');
});

test('nearestRational degenerate cases: integers, zero, and 355/113 at den ≤ 20 → 22/7', () => {
  assert.equal(ratToString(nearestRational(2, 20).rat), '2/1');
  assert.equal(ratToString(nearestRational(0, 20).rat), '0/1');
  // π's famous shadow: 355/113 needs den 113; at maxDen 20 the king is 22/7
  assert.equal(ratToString(nearestRational(makeRat(355, 113), 20).rat), '22/7');
});

test('the spline algebra: ratAdd/ratMul/ratDiv/ratNeg/ratEq/ratIsZero — exact field operations', () => {
  const third = makeRat(1n, 3n), sixth = makeRat(1n, 6n), half = makeRat(1n, 2n);
  assert.ok(ratEq(ratAdd(third, sixth), half), '1/3 + 1/6 = 1/2 exactly');
  assert.ok(ratEq(ratMul(makeRat(2n, 3n), makeRat(3n, 4n)), half), '(2/3)(3/4) = 1/2 exactly');
  assert.ok(ratEq(ratDiv(half, third), makeRat(3n, 2n)), '(1/2)/(1/3) = 3/2 exactly');
  assert.ok(ratEq(ratNeg(third), makeRat(-1n, 3n)), '−(1/3)');
  assert.ok(ratEq(makeRat(2n, 4n), half), 'ratEq crosses representation');
  assert.ok(ratIsZero(ratSub(third, third)), 'x − x = 0 exactly');
  assert.throws(() => ratDiv(half, makeRat(0n)), /division by zero/);
});

// ratSqrt — the exact ℚ gate for PH hodograph solving (ph.mjs)
test('ratSqrt: perfect squares exact, non-squares null — no tolerance, no pretense', async () => {
  const { ratSqrt } = await import('../src/commensurate.mjs');
  const r = (n, d) => makeRat(BigInt(n), BigInt(d));
  assert.equal(ratToString(ratSqrt(r(36, 1))), '6/1');
  assert.equal(ratToString(ratSqrt(r(4, 9))), '2/3');
  assert.equal(ratToString(ratSqrt(r(0, 5))), '0/1');
  assert.equal(ratSqrt(r(2416, 75)), null, 'the fabric discriminant — not a rational square, flagged');
  assert.equal(ratSqrt(r(-4, 1)), null, 'negative has no real ℚ root');
});

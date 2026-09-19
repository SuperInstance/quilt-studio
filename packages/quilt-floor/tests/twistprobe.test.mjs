// twistprobe.test.mjs — the comb re-probe's honesty contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Multigrid } from '../src/multigrid.mjs';
import { twistFieldFrom } from '../src/twistfield.mjs';
import { residualCurve, combTeeth, bestRational, radiusStability, claimCheck } from '../src/twistprobe.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];
const UNIFORM = [0.5, 0.5, 0.5, 0.5, 0.5];
const mk = (gamma) => (r) => twistFieldFrom(new Multigrid({ N: 5, gamma, reach: 8 }), r);

test('residual identity: residual(0) = 1 exactly', () => {
  const tf = mk(GENERIC)(2.1);
  const R = tf.registration(0), cloud = tf.cloudLaw(0);
  assert.equal(R, 1);
  assert.equal(cloud, 1);
  assert.equal(R / cloud, 1);
});

test('small-angle residue: cloud law absorbs the falloff (≤1% to 1°)', () => {
  const tf = mk(GENERIC)(2.1);
  const curve = residualCurve(tf, { fromDeg: 0.15, toDeg: 1.0, stepDeg: 0.05 });
  for (const row of curve) {
    assert.ok(Math.abs(row.residual - 1) < 0.01,
      `residual ${row.residual.toFixed(5)} at ${row.theta}° deviates >1% — fine-tooth structure or cloud-law drift`);
  }
});

test('EXACT ANCHOR (uniform γ): R(36°) = 1 — the vertex set maps onto itself', () => {
  const tf = mk(UNIFORM)(2.1);
  const R36 = tf.registration(36);
  assert.ok(Math.abs(R36 - 1) < 1e-9, `R(36°) = ${R36}, expected exactly 1 (36° line-arrangement symmetry)`);
});

test('EXACT ANCHOR: the residual tooth at 36° is enormous (1/cloud)', () => {
  const tf = mk(UNIFORM)(2.1);
  const tooth = tf.registration(36) / tf.cloudLaw(36);
  assert.ok(tooth > 100, `residual(36°) = ${tooth}, expected ≫ 100`);
});

test('EXACT ANCHOR: combTeeth finds the 36° tooth — scan brackets it (30–42°)', () => {
  const tf = mk(UNIFORM)(2.1);
  const curve = residualCurve(tf, { fromDeg: 30, toDeg: 42, stepDeg: 0.1 });
  const teeth = combTeeth(curve);
  assert.ok(teeth.some(t => Math.abs(t.theta - 36) < 0.15), `no tooth near 36°: ${JSON.stringify(teeth)}`);
});

test('PROBE FINDING: at 36° the ratio is background-starved — the contrast lives in R', () => {
  // The cloud law underflows to ~1e-32 at 36°, so the residual reads ~e+31
  // for BOTH floors and discriminates nothing. R is the honest quantity:
  // exactly 1.0 where the symmetry is exact, ~0.2 where it is not.
  const uni = mk(UNIFORM)(2.1), gen = mk(GENERIC)(2.1);
  assert.ok(Math.abs(uni.registration(36) - 1) < 1e-9);
  assert.ok(gen.registration(36) < 0.5, `generic R(36°) = ${gen.registration(36).toFixed(4)}, expected < 0.5`);
});

test('generic γ small-angle: the killed fine-tooth claim STAYS killed at 0.02°', () => {
  const tf = mk(GENERIC)(2.1);
  const curve = residualCurve(tf, { fromDeg: 0.15, toDeg: 1.0, stepDeg: 0.02 });
  const teeth = combTeeth(curve, { column: 'residual', minValue: 1.0001 });
  assert.equal(teeth.length, 0);
});

test('bestRational: the 16/57 claim matches mechanically at 10.105°', () => {
  const m = bestRational(36 * 16 / 57, { period: 36 });
  assert.equal(m[0].p, 16);
  assert.equal(m[0].q, 57);
  assert.ok(m[0].errDeg < 1e-9);
});

test('claimCheck: the 16/57 claim is NOT a tooth (isLocalMax false) — stays dead', () => {
  const tf = mk(GENERIC)(2.1);
  const curve = residualCurve(tf, { fromDeg: 8, toDeg: 12.5, stepDeg: 0.05 });
  const chk = claimCheck(curve, 16, 57);
  assert.ok(chk.measured.theta > 8 && chk.measured.theta < 12.5);
  // measured 2026-09-20: residual 59.1 mid-slope, NOT a local max — the
  // "16/57 ≈ 1/φ comb" was a numerological match to the smooth large-θ
  // rise. (Also 16/57 = 0.281 ≠ 1/φ = 0.618 arithmetically.)
  assert.equal(chk.isLocalMax, false);
  assert.equal(chk.rationals[0].p, 16);
  assert.equal(chk.rationals[0].q, 57);
});

test('radius stability: the 36° anchor tooth survives across radii', () => {
  const stab = radiusStability(mk(UNIFORM), [1.5, 2.1, 2.7], { fromDeg: 30, toDeg: 42, stepDeg: 0.1 });
  const a36 = stab.stable.find(g => Math.abs(g.theta - 36) < 0.2);
  assert.ok(a36, `36° tooth not stable across radii: ${JSON.stringify(stab.coverage)}`);
  const vals = a36.heights.map(h => h.value);
  const spread = (Math.max(...vals) - Math.min(...vals)) / Math.max(...vals);
  assert.ok(spread < 0.5, `anchor tooth height spreads ${(spread * 100).toFixed(0)}% across radii — rim-sensitive?`);
});

test('the re-probe runs clean on the full twist regime (0.15–6°, coarse)', () => {
  const tf = mk(GENERIC)(2.1);
  const curve = residualCurve(tf, { fromDeg: 0.15, toDeg: 6, stepDeg: 0.05 });
  assert.equal(curve.length, 118);
  const teeth = combTeeth(curve);
  // whatever the teeth are, every one is a real local max above unity
  for (const t of teeth) {
    assert.ok(t.value > 1.0001 && t.prominence >= 0.006);
  }
});

// TwistField — twist-engine's instrument on the floor, probe-pinned laws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Multigrid } from '../src/multigrid.mjs';
import { TwistField, twistFieldFrom } from '../src/twistfield.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];
const OTHER_GAMMA = [0.2, 0.5, 0.8, 0.15, 0.65];

test('instrument identity: R(0) = 1 exactly', () => {
  const tf = twistFieldFrom(new Multigrid({ N: 5, gamma: GENERIC, reach: 8 }), 2.1);
  assert.ok(tf.points.length > 50, `points: ${tf.points.length}`);
  const R0 = tf.registration(0);
  assert.ok(Math.abs(R0 - 1) < 1e-12, `R(0) = ${R0}`);
});

test('the cloud law holds in the twist regime: R(θ) ≈ exp(−⟨r²⟩θ²/2σ²) for θ ≤ 2°', () => {
  const tf = twistFieldFrom(new Multigrid({ N: 5, gamma: GENERIC, reach: 8 }), 2.1);
  for (let a = 0.25; a <= 2.0001; a += 0.25) {
    const R = tf.registration(a);
    const pred = tf.cloudLaw(a);
    const dev = Math.abs(R - pred) / pred;
    assert.ok(dev < 0.01, `θ=${a}° dev ${(dev * 100).toFixed(2)}% (probe: 0.06% @1°, 0.89% @2°)`);
  }
});

test('R is strictly decreasing through 6° — no fine teeth (killed at 0.02° resolution)', () => {
  const tf = twistFieldFrom(new Multigrid({ N: 5, gamma: GENERIC, reach: 8 }), 2.1);
  let prev = tf.registration(0);
  for (let a = 0.1; a <= 6.0001; a += 0.1) {
    const R = tf.registration(a);
    assert.ok(R < prev, `non-monotone at θ=${a.toFixed(1)}°`);
    prev = R;
  }
});

test('the fingerprint rises: cross-alignment deviates UP from the cloud law, growing 3°→6°', () => {
  const tf = twistFieldFrom(new Multigrid({ N: 5, gamma: GENERIC, reach: 8 }), 2.1);
  const devs = [3, 4, 5, 6].map(a => tf.registration(a) - tf.cloudLaw(a));
  for (let i = 1; i < devs.length; i++) {
    assert.ok(devs[i] > devs[i - 1], `deviation not growing: ${devs}`);
  }
  assert.ok(devs[0] > 0, 'cross-alignment must be positive beyond the twist regime');
});

test('the fingerprint is universal: γ-independent for generic floors', () => {
  const a = twistFieldFrom(new Multigrid({ N: 5, gamma: GENERIC, reach: 8 }), 2.1);
  const b = twistFieldFrom(new Multigrid({ N: 5, gamma: OTHER_GAMMA, reach: 8 }), 2.1);
  const dA = a.registration(4) - a.cloudLaw(4);
  const dB = b.registration(4) - b.cloudLaw(4);
  const rel = Math.abs(dA - dB) / Math.min(dA, dB);
  assert.ok(rel < 0.10, `γ-dependence ${(rel * 100).toFixed(1)}% at 4°`);
});

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];
for (const [label, K] of kernels) {
  test(`${label}: the twist curve hosts in the kernel — same law, second substrate`, () => {
    const k = new K();
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 8 });
    const tf = twistFieldFrom(mg, 2.1);
    const curve = tf.curve(0, 6, 1);
    assert.equal(curve.length, 7);
    for (let i = 1; i < curve.length; i++) {
      assert.ok(curve[i].R < curve[i - 1].R, 'curve decreasing');
    }
    // host the evidence: the kernel holds the curve, both substrates
    k.bind('twist.curve', curve.map(({ theta, R }) => ({ theta, R })),
         { what: 'twist registrations on the floor, twist-engine instrument' });
    const ledger = k.view('twist.curve');
    assert.equal(ledger.length, 7);
    assert.deepEqual(ledger.map(r => r.theta), [0, 1, 2, 3, 4, 5, 6]);
    assert.ok(ledger.every((r, i) => Math.abs(r.R - curve[i].R) < 1e-15));
    assert.deepEqual(k.cells('twist.'), ['twist.curve']);
  });
}

test('the instrument is twist-engine verbatim: same constants reproduce its scale', () => {
  // σ = 0.24·s and cell 0.6·s are twist-engine's (app.js). The floor's
  // mean spacing s ≈ 0.3185 at reach 8 (probe) — assert the derived
  // quantities are internally consistent rather than hand-copied.
  const tf = twistFieldFrom(new Multigrid({ N: 5, gamma: GENERIC, reach: 8 }), 2.1);
  assert.ok(Math.abs(tf.sigma - 0.24 * tf.s) < 1e-15);
  assert.ok(Math.abs(tf.grid - 0.6 * tf.s) < 1e-15);
  assert.ok(tf.s > 0.25 && tf.s < 0.45, `mean spacing ${tf.s}`);
});

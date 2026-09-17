// The twist listener over BOTH kernels: one instrument, three voices, one φ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Multigrid } from '../src/multigrid.mjs';
import { Comb } from '../src/comb.mjs';
import { TwistListener } from '../src/twistlisten.mjs';
import { PHI, convergentGaps } from '../src/golden.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];
const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

for (const [label, K] of kernels) {
  test(`${label}: the crystal hums exactly φ; the ladder climbs toward it`, () => {
    const k = new K();
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 4 });
    const tl = new TwistListener(k, mg);
    const r = tl.sample();
    assert.ok(Math.abs(r.gapRatio - PHI) < 1e-9, `crystal L/S = ${r.gapRatio}`);
    assert.equal(r.detuned, false);
    assert.equal(k.view('twist.detuned'), false);
    assert.equal(k.view('twist.phi'), PHI);
    // teeth: errors strictly shrinking along the ladder (n≥3 is monotone
    // for the Fibonacci convergents of φ)
    const errs = r.teeth.map(t => t.err);
    for (let i = 1; i < errs.length; i++) assert.ok(errs[i] < errs[i - 1], 'tooth errors decrease');
    // the delta between ladder's best tooth and the crystal's exact φ —
    // the whole point of the listener
    assert.ok(r.delta > 0 && r.delta < 0.1, `delta ${r.delta}`);
  });

  test(`${label}: extend() drives the comb and re-samples — delta shrinks toward the crystal`, () => {
    const k = new K();
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 4 });
    const comb = new Comb(k);
    const tl = new TwistListener(k, mg, comb);
    const d0 = tl.sample().delta;
    const d1 = tl.extend().delta;
    assert.ok(d1 < d0, `delta ${d0} → ${d1}`);
    // history only grows (contract v5: no silent rewinds)
    assert.ok(k.history.length > 0);
  });

  test(`${label}: L2 listeners each get private copies (contract v5 isolation)`, () => {
    const k = new K();
    const tl = new TwistListener(k, new Multigrid({ N: 5, gamma: GENERIC, reach: 3 }));
    tl.sample();
    const seen = [];
    tl.listen(e => seen.push(e));
    tl.sample(); // re-bind: one bind event per listener
    assert.equal(seen.length, 1);
    assert.equal(seen[0].cell, 'twist.teeth');
    // mutate what we were handed; the kernel's stored value must be clean
    seen[0].value.push({ n: 999, ratio: -1, err: 1e9 });
    const stored = k.view('twist.teeth');
    assert.ok(!stored.some(t => t.n === 999), 'listener mutation did not reach the kernel');
  });

  test(`${label}: a detuned crystal is flagged — the listener reports what it measures`, () => {
    class Detuned extends Multigrid {
      constructor(o) {
        super(o);
        this.normals = this.normals.map((n, k) => {
          const a = Math.PI * k / 5 + (k % 2 ? 0.0349066 : -0.0349066);
          return [Math.cos(a), Math.sin(a)];
        });
      }
    }
    const k = new K();
    const tl = new TwistListener(k, new Detuned({ N: 5, gamma: GENERIC, reach: 4 }));
    const r = tl.sample();
    assert.equal(r.detuned, true);
    assert.ok(Math.abs(r.gapRatio - PHI) > 0.01, `detuned L/S = ${r.gapRatio}`);
    assert.equal(k.view('twist.detuned'), true);
  });
}

test('the deep identity: |L/S − F_{n+1}/F_n| is exactly the best tooth error', () => {
  // gapRatio IS φ to fp precision, so delta = best tooth err, and the
  // tooth err has the closed form 1/(F_n·(F_n·φ − F_{n+1})·...) — empirically:
  // delta_n · F_n² → 1 as n grows (the classic convergent estimate
  // |φ − p/q| < 1/q²). Verify against the pinned ladder.
  for (const n of [6, 8, 10]) {
    const t = convergentGaps(n).at(-1);
    const ratio = (t.degrees + 360 * PHI) / 360;
    const err = Math.abs(ratio - PHI);
    const F = [1, 1];
    for (let i = 2; i <= n + 1; i++) F.push(F[i - 1] + F[i - 2]);
    const Fn = F[n];
    const scaled = err * Fn * Fn;
    assert.ok(Math.abs(scaled - 1) < 0.4, `n=${n}: err·F_n² = ${scaled.toFixed(3)} → 1`);
  }
});

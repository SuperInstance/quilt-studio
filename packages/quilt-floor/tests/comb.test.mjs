// The Comb — TWIST's instrument as a live tenant; the L2 surface is the stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Comb } from '../src/comb.mjs';
import { convergentGaps } from '../src/golden.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

for (const [label, K] of kernels) {
  test(`${label}: the comb recomputes on the kernel clock — teeth sharpen monotonically`, () => {
    const comb = new Comb(new K());
    const seen = [];
    for (let i = 0; i < 6; i++) {
      comb.extend();
      seen.push(comb.resolution());
    }
    for (let i = 1; i < seen.length; i++)
      assert.ok(seen[i] >= seen[i - 1], 'more reach never blurs the comb');
    assert.ok(seen[seen.length - 1] >= 7, 'the classic seven teeth resolve');
    // every tooth the cell reports matches the pure computation
    const want = convergentGaps(comb.k.view('comb.n'));
    const got = comb.teeth();
    assert.equal(got.length, want.length);
    for (let i = 0; i < want.length; i++)
      assert.ok(Math.abs(got[i].degrees - want[i].degrees) < 1e-12, `tooth ${i} exact`);
  });

  test(`${label}: subscribe watches the comb sing (L2 surface, no polling)`, () => {
    const k = new K();
    const comb = new Comb(k);
    const events = [];
    const unsub = k.subscribe(e => events.push(e), { cell: 'comb.teeth' });
    comb.extend();
    comb.extend();
    unsub();
    comb.extend();
    assert.equal(events.length, 2, 'listener fired per recompute, and stops on unsub');
    assert.ok(events.every(e => e.kind === 'bind' && Array.isArray(e.value)));
    assert.equal(k.now(), 2 + 1, 'two extends + the priming apply = three ticks');
  });
}

test('the comb and the ladder agree on the seven-tooth window', () => {
  const k = new QuiltKernel();
  const comb = new Comb(k);
  while (k.view('comb.n') < 14) comb.extend();
  const window = comb.teeth().filter(t => t.belowHalfDegree).map(t => t.n);
  assert.deepEqual(window, [8, 9, 10, 11, 12, 13, 14]);
});

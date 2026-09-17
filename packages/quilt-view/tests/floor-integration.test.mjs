// Floor → view integration: the Penrose field emits into the kernel, the
// render model turns emissions into frames. The view layer sees exactly
// what the floor does, on both substrates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Multigrid } from '../../quilt-floor/src/multigrid.mjs';
import { PenField } from '../../quilt-floor/src/penfield.mjs';
import { RenderModel } from '../src/render-model.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];
const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

for (const [label, K] of kernels) {
  test(`${label}: penfield ticks become a live orbit frame stream`, () => {
    const k = new K();
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 8 });
    const f = new PenField(k, mg);
    const m = new RenderModel(k);
    const seats = f.vertices().length;

    m.drain(); // settle: seating arrives as the model's initial sync
    f.step();
    const frame = m.drain();
    const moved = frame.changed.find(x => x.name === 'penfield.z');
    assert.ok(moved, `penfield.z must re-arrive per step; changed: ${frame.changed.map(x => x.name)}`);
    assert.equal(moved.value.length, seats);
    assert.ok(frame.t > 0);
    // the moved state is fresh-copied — mutating a frame can't touch the kernel
    if (frame.changed.length) {
      const v = frame.changed[0].value;
      if (Array.isArray(v)) v.push(999);
      assert.ok(!JSON.stringify(k.view(frame.changed[0].name)).includes('999'));
    }
    m.dispose();
  });

  test(`${label}: the twist curve binds once and the scene holds it whole`, () => {
    const k = new K();
    const m = new RenderModel(k);
    const curve = [
      { theta: 0, R: 1 }, { theta: 1, R: 0.945 }, { theta: 2, R: 0.803 },
    ];
    k.bind('twist.curve', curve, { what: 'registrations on the floor' });
    const frame = m.drain();
    assert.equal(frame.added.length, 1);
    assert.equal(frame.added[0].value.length, 3);
    // a chart view can read the retained scene at any later tick
    assert.deepEqual(m.scene().nodes.find(n => n.name === 'twist.curve').value, curve);
    m.dispose();
  });
}

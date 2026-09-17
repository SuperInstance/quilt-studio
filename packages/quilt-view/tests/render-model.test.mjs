// RenderModel — the view engine the skeleton was waiting for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { RenderModel } from '../src/render-model.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

for (const [label, K] of kernels) {
  test(`${label}: bind → added frame; re-bind → changed; unbind → removed`, () => {
    const k = new K();
    const m = new RenderModel(k);
    k.bind('a', 1);
    let f = m.drain();
    assert.equal(f.added.length, 1);
    assert.equal(f.added[0].name, 'a');
    assert.equal(f.added[0].value, 1);
    assert.equal(m.drain().added.length, 0, 'drained frames are empty');

    k.bind('a', 2);
    f = m.drain();
    assert.equal(f.changed.length, 1);
    assert.equal(f.changed[0].value, 2);

    k.unbind('a');
    f = m.drain();
    assert.equal(f.removed.length, 1);
    assert.equal(f.removed[0].name, 'a');
    m.dispose();
  });

  test(`${label}: links appear in the scene and in edge frames`, () => {
    const k = new K();
    const m = new RenderModel(k);
    k.bind('x', 1); k.bind('y', 2);
    m.drain();
    const id = k.link('x', 'y', 'feeds');
    let f = m.drain();
    assert.equal(f.edgeAdded.length, 1);
    assert.deepEqual(f.edgeAdded[0], { from: 'x', to: 'y', type: 'feeds' });
    assert.equal(m.scene().edges.length, 1);

    k.unlink(id);
    f = m.drain();
    assert.equal(f.edgeRemoved.length, 1);
    assert.equal(m.scene().edges.length, 0);
    m.dispose();
  });

  test(`${label}: apply and undo fold back into node frames`, () => {
    const k = new K();
    const m = new RenderModel(k);
    k.bind('counter', 0);
    k.effect('counter', 'inc', v => v + 1, v => v - 1);
    m.drain();
    k.apply('counter', 'inc');
    let f = m.drain();
    assert.equal(f.changed.length, 1);
    assert.equal(f.changed[0].value, 1);
    k.undo();
    f = m.drain();
    assert.equal(f.changed[0].value, 0);
    m.dispose();
  });

  test(`${label}: tick advances model time; load re-syncs the scene`, () => {
    const k = new K();
    const m = new RenderModel(k);
    k.bind('t0', 'alpha');
    k.tick(5);
    assert.equal(m.t, 5);
    m.drain();
    k.load({ cells: { ghost: 99 } });
    const f = m.drain();
    assert.ok(f.added.some(x => x.name === 'ghost' && x.value === 99),
      `added: ${JSON.stringify(f.added)}`);
    assert.ok(f.removed.some(x => x.name === 't0'),
      'cells absent from the loaded snapshot depart the scene');
    assert.ok(m.scene().nodes.every(n => n.name === 'ghost'));
    m.dispose();
  });

  test(`${label}: aliasing is a bug — frames and scene hand out fresh copies`, () => {
    const k = new K();
    const m = new RenderModel(k);
    k.bind('arr', [1, 2]);
    const f = m.drain();
    f.added[0].value.push(3);
    assert.deepEqual(k.view('arr'), [1, 2]);
    const s = m.scene();
    s.nodes[0].value.push(4);
    assert.deepEqual(k.view('arr'), [1, 2]);
    m.dispose();
  });
}

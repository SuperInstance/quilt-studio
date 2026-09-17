// Field, clock, and room — one turn of the kernel, three faces of φ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Phyllomandel } from '../src/phyllomandel.mjs';
import { FibClock } from '../src/fibclock.mjs';
import { hostRoom, admit, setTide } from '../src/room.mjs';
import { GOLDEN_ANGLE } from '../src/address.mjs';
import { zeckendorf } from '../src/golden.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

// Independent naive Mandelbrot — test hygiene: never share the implementation
// under test.
function naiveEscape(cx, cy, maxIter) {
  let x = 0, y = 0;
  for (let i = 0; i < maxIter; i++) {
    const x2 = x * x - y * y + cx, y2 = 2 * x * y + cy;
    if (x2 * x2 + y2 * y2 > 4) return i + 1;
    x = x2; y = y2;
  }
  return null;
}

for (const [label, K] of kernels) {
  test(`${label}: phyllomandel — c=0 is a fixed point; c=−1 is period-2; neither escapes`, () => {
    const k = new K();
    const field = new Phyllomandel(k, { n: 4, center: [0, 0], radius: 0 });
    // radius 0 → every cell sits at c=0 … rebind two cells to the known orbits
    k.bind('field.0', { c: [0, 0], z: [0, 0], iter: 0, escaped: null });
    k.bind('field.1', { c: [-1, 0], z: [0, 0], iter: 0, escaped: null });
    for (let t = 0; t < 12; t++) field.stepAll();
    assert.equal(k.view('field.0').escaped, null);
    assert.equal(k.view('field.1').escaped, null);
    assert.equal(k.view('field.0').z[0], 0, 'z stays pinned at 0');
    assert.ok(Math.abs(Math.abs(k.view('field.1').z[0]) - 1) < 1e-12 || Math.abs(k.view('field.1').z[0]) < 1e-12, 'z ∈ {0, −1} period-2 orbit');
  });

  test(`${label}: phyllomandel — escape counts match an independent reference`, () => {
    const k = new K();
    const field = new Phyllomandel(k, { n: 40, center: [-0.6, 0.4], radius: 0.5 });
    for (let t = 0; t < 60; t++) field.stepAll();
    for (const c of field.cells().slice(0, 20)) {
      const ref = naiveEscape(c.c[0], c.c[1], 60);
      assert.equal(c.escaped, ref, `cell ${iRef(c.i)}: escaped=${c.escaped} ref=${ref}`);
    }
  });

  test(`${label}: phyllomandel — one tick advances the whole field coherently`, () => {
    const k = new K();
    const field = new Phyllomandel(k, { n: 10, center: [0, 0], radius: 1 });
    field.stepAll(); field.stepAll();
    for (const c of field.cells()) {
      if (c.escaped === null || c.escaped > 2) assert.equal(c.iter, 2, `cell ${c.i} advanced exactly twice`);
      else assert.ok(c.iter <= 2, 'escaped cells froze at their escape step');
    }
    assert.equal(k.now(), 2, 'field time is kernel time');
  });

  test(`${label}: phyllomandel — terrace speaks Zeckendorf`, () => {
    const k = new K();
    const field = new Phyllomandel(k, { n: 12, center: [-0.6, 0.2], radius: 0.4 });
    for (let t = 0; t < 40; t++) field.stepAll();
    for (const row of field.terrace()) {
      assert.equal(row.zeck.length === 0 ? 0 : row.zeck.reduce((s, x) => s + zeckTerm(x), 0), row.iter);
      for (let i = 0; i + 1 < row.zeck.length; i++)
        assert.ok(row.zeck[i] - row.zeck[i + 1] >= 2, 'no adjacent Fibonacci indices');
    }
  });

  test(`${label}: the Fibonacci clock accumulates: one, one, two, three, five`, () => {
    const k = new K();
    const clock = new FibClock(k);
    clock.advance();
    assert.deepEqual(clock.now().zeck, zeckendorf(1));
    assert.equal(clock.now().words, 'one');
    for (let i = 0; i < 4; i++) clock.advance();
    assert.deepEqual(clock.now().zeck, zeckendorf(5));
    assert.equal(clock.now().words, 'five');
    // and the clock rides the same kernel clock as floor and field
    assert.equal(k.now(), 5, 'clock time is kernel time');
  });

  test(`${label}: the room takes its tile — address unique against the floor's`, () => {
    const k = new K();
    k.bind('floor.0', { kind: 'A', x0: 0, len: 1, gen: 0 }, { index: 0, ...addrXY(0) });
    const room = hostRoom(k, { name: 'room.tap', seat: 1 });
    const floorMeta = k.metaOf('floor.0');
    assert.notEqual(room.address.x, floorMeta.x, 'no two cells share a tile');
    admit(k, 'room.tap', { id: 'wesley', role: 'barman' });
    assert.equal(k.view('room.tap').presence.length, 1, 'presence is Z_in');
    setTide(k, 'room.tap', 0.7);
    assert.ok(Math.abs(k.view('room.tap').tide - 0.7) < 1e-12, 'the vibe moves');
  });
}

function iRef(i) { return i; }
function zeckTerm(k) { return k < 2 ? 1 : fibTerm(k); }
function fibTerm(k) { let a = 1, b = 1; for (let i = 3; i <= k; i++) [a, b] = [b, a + b]; return k === 1 ? 1 : b; }
function addrXY(i) { const a = GOLDEN_ANGLE * i, r = Math.sqrt(i); return { x: r * Math.cos(a), y: r * Math.sin(a) }; }

// The Strip — cut-and-projection reaches the same floor substitution grows.
// Every constant below was pinned by computation, then locked by test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Strip, SQ, GOLDEN_WINDOWS } from '../src/strip.mjs';
import { FibFloor } from '../src/fibfloor.mjs';
import { word, PHI } from '../src/golden.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

for (const [label, K] of kernels) {
  test(`${label}: golden window ⇒ exactly two spacings in ratio φ, order = the word`, () => {
    const strip = new Strip(new K(), { m: 900, width: 1 / PHI });
    const layout = strip.layout();
    assert.ok(layout.length > 300, 'enough intervals to mean something');
    // two-spacings law
    const lens = strip.intervals().map(t => t.len);
    const distinct = new Set(lens.map(l => l.toFixed(9)));
    assert.equal(distinct.size, 2, 'exactly two spacings');
    const L = Math.max(...lens), S = Math.min(...lens);
    assert.ok(Math.abs(L / S - PHI) < 1e-9, 'long/short = φ');
    // the order IS the Fibonacci word (phase convention: word reads from index 1)
    assert.equal(layout.slice(1, 1 + word(10).length), word(10), 'strip = σ^g(A), read from the seed');
    // matching rules of the line
    assert.ok(!layout.includes('BB'));
    assert.ok(!layout.includes('AAA'));
    // B-frequency → 1/φ²
    const bf = (layout.match(/B/g).length) / layout.length;
    assert.ok(Math.abs(bf - 1 / (PHI * PHI)) < 0.01, `B-freq ${bf} → 1/φ²`);
  });

  test(`${label}: all three golden windows sing; a mistuned window does not`, () => {
    for (const w of GOLDEN_WINDOWS) {
      const strip = new Strip(new K(), { m: 400, width: w });
      const lens = strip.intervals().map(t => t.len);
      assert.equal(new Set(lens.map(l => l.toFixed(9))).size, 2, `width ${w}: two spacings`);
      assert.ok(Math.abs(Math.max(...lens) / Math.min(...lens) - PHI) < 1e-9, `width ${w}: ratio φ`);
      assert.equal(strip.layout().slice(1, 1 + word(8).length), word(8), `width ${w}: the word`);
    }
    // anti-vacuity: a near-miss width is NOT the floor
    const off = new Strip(new K(), { m: 400, width: 1.25 });
    const offLens = off.intervals().map(t => t.len);
    assert.ok(Math.abs(Math.max(...offLens) / Math.min(...offLens) - PHI) > 0.1,
      'width 1.25 mistunes (ratio leaves φ) — the window is the tuning');
  });

  test(`${label}: the strip is one bi-infinite sequence — growing the reach reveals a prefix`, () => {
    const small = new Strip(new K(), { m: 400 }).layout();
    const large = new Strip(new K(), { m: 800 }).layout();
    assert.equal(large.slice(0, small.length - 8), small.slice(0, -8),
      'self-similarity without substitution: more reach, same sequence');
  });

  test(`${label}: projection ≡ substitution — strip and floor are one floor, affinely`, () => {
    // FibFloor at gen 8: 55 tiles with exact x0 in [0,1).
    const floor = new FibFloor(new K());
    for (let i = 0; i < 8; i++) floor.deflate();
    const ft = floor.intervals();
    // Strip covering the same word (55 tiles + phase margin).
    const strip = new Strip(new K(), { m: 120, width: 1 / PHI });
    const st = strip.intervals();
    const layout = strip.layout();
    const off = layout.indexOf(word(8));
    assert.ok(off >= 0, 'word(8) occurs in the strip');
    assert.equal(layout.slice(off, off + 55), word(8), 'same kind sequence');
    // per-tile affine scale must be CONSTANT — same lengths, same positions
    const scales = [];
    for (let i = 0; i < 55; i++) scales.push(ft[i].len / st[off + i].len);
    for (const s of scales) assert.ok(Math.abs(s - scales[0]) < 1e-9, 'one scale for all tiles');
    const base = st[off].par;
    for (let i = 0; i < 55; i++)
      assert.ok(Math.abs((st[off + i].par - base) * scales[0] - ft[i].x0) < 1e-9,
        `tile ${i}: same position, rescaled`);
  });

  test(`${label}: the strip is a kernel tenant — cells, links, addresses`, () => {
    const k = new K();
    const strip = new Strip(k, { m: 100 });
    const n = k.view('strip.n');
    assert.ok(n > 30, 'intervals bound');
    assert.equal(strip.intervals().length, n);
    assert.equal(k.links().filter(e => e.type === 'next').length, n - 1, 'eastward chain');
    const meta = k.metaOf('strip.3');
    assert.equal(typeof meta.x, 'number');
    assert.equal(meta.index, 3, 'live index = eastward position');
    // every interval knows its lattice origin
    const t = strip.intervals()[10];
    assert.equal(typeof t.a, 'number');
    assert.equal(typeof t.perp, 'number');
    assert.ok(Math.abs(t.perp) <= 2, 'perp offset inside the tuned window');
  });
}

test('SQ is the norm of (1, φ) — the geometry constant', () => {
  assert.ok(Math.abs(SQ - Math.sqrt(PHI * PHI + 1)) < 1e-15);
});

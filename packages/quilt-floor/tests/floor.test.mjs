// The floor over BOTH kernels — the polyformalism proof in miniature:
// the pattern survives translation across substrates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Relative imports — no npm install dance needed between workspace packages.
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { FibFloor, expectedWord, PHI } from '../src/fibfloor.mjs';
import { addressOf, GOLDEN_ANGLE } from '../src/address.mjs';
import { hostRoom, admit, setTide } from '../src/room.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

for (const [label, K] of kernels) {
  test(`${label}: layout at generation g is the Fibonacci word σ^g(A)`, () => {
    const floor = new FibFloor(new K());
    assert.equal(floor.layout(), 'A', 'seed: day one');
    for (let g = 1; g <= 8; g++) {
      floor.deflate();
      assert.equal(floor.layout(), expectedWord(g), `gen ${g} matches σ^g(A)`);
    }
  });

  test(`${label}: the floor is perfectly tiled at every generation (exact cover)`, () => {
    const floor = new FibFloor(new K());
    for (let g = 0; g <= 8; g++) {
      const tiles = floor.intervals();
      // contiguous: each tile starts where the previous ended
      for (let i = 0; i + 1 < tiles.length; i++)
        assert.ok(Math.abs(tiles[i].x0 + tiles[i].len - tiles[i + 1].x0) < 1e-9, `gen ${g}: tile ${i} abuts ${i + 1}`);
      // spans the unit seed exactly
      const last = tiles[tiles.length - 1];
      assert.ok(Math.abs(last.x0 + last.len - 1) < 1e-9, `gen ${g}: span is exactly 1`);
      // long/short ratio is φ, always
      const A = tiles.find(t => t.kind === 'A'), B = tiles.find(t => t.kind === 'B');
      if (A && B) assert.ok(Math.abs(A.len / B.len - PHI) < 1e-9, `gen ${g}: |A|/|B| = φ`);
    }
  });

  test(`${label}: matching rules hold on the floor at every generation`, () => {
    const floor = new FibFloor(new K());
    for (let g = 1; g <= 10; g++) {
      floor.deflate();
      assert.ok(!floor.layout().includes('BB'));
      assert.ok(!floor.layout().includes('AAA'));
    }
  });

  test(`${label}: kind lengths are uniform across lineages (the golden cut)`, () => {
    const floor = new FibFloor(new K());
    for (let g = 1; g <= 8; g++) {
      floor.deflate();
      const tiles = floor.intervals();
      const aLens = tiles.filter(t => t.kind === 'A').map(t => t.len);
      const bLens = tiles.filter(t => t.kind === 'B').map(t => t.len);
      for (const l of aLens) assert.ok(Math.abs(l - aLens[0]) < 1e-12, `gen ${g}: every A is one length`);
      for (const l of bLens) assert.ok(Math.abs(l - bLens[0]) < 1e-12, `gen ${g}: every B is one length`);
      assert.ok(Math.abs(aLens[0] / bLens[0] - PHI) < 1e-9, `gen ${g}: A/B = φ`);
      assert.ok(Math.abs(aLens[0] - Math.pow(1 / PHI, g)) < 1e-12, `gen ${g}: A = φ⁻ᵍ`);
    }
  });

  test(`${label}: the generational clock advances with the kernel clock`, () => {
    const k = new K();
    const floor = new FibFloor(k);
    floor.deflate();
    floor.deflate();
    assert.equal(floor.gen, 2);
    assert.equal(k.now(), 2, 'ts == gen — one clock, both meanings');
  });

  test(`${label}: reflation restores the lineage (the floor does not forget)`, () => {
    const floor = new FibFloor(new K());
    floor.deflate(); floor.deflate(); floor.deflate(); floor.deflate();
    assert.equal(floor.layout(), expectedWord(4));
    const { gen } = floor.reflate(2);
    assert.equal(gen, 2);
    assert.equal(floor.layout(), expectedWord(2));
    const full = floor.reflate(99); // past zero clamps
    assert.equal(full.gen, 0);
    assert.equal(floor.layout(), 'A');
  });

  test(`${label}: time travel is deterministic — the floor regrows identically`, () => {
    const floor = new FibFloor(new K());
    for (let i = 0; i < 4; i++) floor.deflate();
    const first = floor.intervals().map(t => JSON.stringify(t)).join('|');
    floor.reflate(2);
    floor.deflate(); floor.deflate();
    assert.equal(floor.layout(), expectedWord(4));
    const second = floor.intervals().map(t => JSON.stringify(t)).join('|');
    assert.equal(second, first, 'history IS future: sediment overwritten with the same values');
  });

  test(`${label}: reflation is geology, not vandalism — foreign tenants untouched`, () => {
    const k = new K();
    const floor = new FibFloor(k);
    for (let i = 0; i < 8; i++) floor.deflate();
    // a foreign tenant moves in and writes its own history
    k.bind('clock.n', 6);
    for (let i = 0; i < 4; i++) k.bind('clock.n', k.view('clock.n') + 1);
    const foreignBefore = JSON.stringify(k.view('clock.n'));
    const histBefore = k.history.length;
    const r = floor.reflate(5);
    assert.equal(r.gen, 3);
    assert.equal(JSON.stringify(k.view('clock.n')), foreignBefore, 'the clock never lost a tick');
    assert.ok(k.history.length > histBefore, 'reflation appends; it never eats foreign history');
    assert.equal(floor.layout(), expectedWord(3), 'and the floor really is gen 3 again');
  });

  test(`${label}: reflation lands on the exact plan, and regrowth returns home`, () => {
    const k = new K();
    const floor = new FibFloor(k);
    for (let i = 0; i < 8; i++) floor.deflate();
    const straight = new FibFloor(new K());
    for (let i = 0; i < 8; i++) straight.deflate();
    floor.reflate(5);
    const planTiles = FibFloor.plan(3);
    const got = floor.intervals();
    assert.equal(got.length, planTiles.length);
    for (let i = 0; i < got.length; i++) {
      assert.equal(got[i].name, planTiles[i].name, `tile ${i} hierarchical name`);
      assert.equal(got[i].kind, planTiles[i].kind);
      assert.ok(Math.abs(got[i].x0 - planTiles[i].x0) < 1e-12, `tile ${i} x0 on plan`);
      assert.equal(k.metaOf(got[i].name).index, planTiles[i].index, `tile ${i} address index`);
    }
    // regrowing the refolded floor 5 generations reaches gen 8 — identical
    // to a floor that walked straight there
    for (let i = 0; i < 5; i++) floor.deflate();
    const refolded = floor.intervals().map(t => JSON.stringify(t)).join('|');
    const direct = straight.intervals().map(t => JSON.stringify(t)).join('|');
    assert.equal(refolded, direct, 'time travel stays bit-exact');
  });

  test(`${label}: rooms degrade — admitting to an unhosted room returns false`, () => {
    const k = new K();
    assert.equal(admit(k, 'room.tap', 'crab'), false, 'no room, no throw');
    assert.equal(setTide(k, 'room.tap', 0.5), false);
    const { name } = hostRoom(k);
    assert.equal(admit(k, name, 'crab'), true);
    assert.equal(setTide(k, name, 0.5), true);
  });

  test(`${label}: the golden-direction walk composes addresses; adjacency is linked`, () => {
    const k = new K();
    const floor = new FibFloor(k);
    for (let i = 0; i < 5; i++) floor.deflate();
    const walk = floor.walk(0, 5);
    assert.equal(walk.visited.length, 5);
    assert.ok(Math.abs(walk.aggregate.x - walk.visited.reduce((a, t) => a + t.address.x, 0)) < 1e-9);
    // 'next' edges among LIVE tiles: one per consecutive pair (sediment edges
    // from earlier generations stay in the graph as the visible lineage)
    const tiles = floor.count();
    const liveNext = k.links().filter(e => e.type === 'next'
      && (k.view(e.from)?.gen ?? -1) === 5 && (k.view(e.to)?.gen ?? -1) === 5);
    assert.equal(liveNext.length, tiles - 1);
    // addresses are the phyllotaxis projection — the floor and the field share it
    assert.deepEqual({ ...walk.visited[1].address }, (() => { const a = addressOf(1); return { x: a.x, y: a.y }; })());
  });

  test(`${label}: every live interval carries its position + live index as metadata`, () => {
    const floor = new FibFloor(new K());
    floor.deflate(); floor.deflate();
    floor.intervals().forEach((t, idx) => {
      const meta = floor.k.metaOf(t.name);
      assert.equal(typeof meta.x, 'number');
      assert.equal(typeof meta.y, 'number');
      assert.equal(meta.index, idx, 'live index = west-to-east position, not name-derived');
    });
  });
}

test('the golden angle divides the circle in the golden proportion', () => {
  assert.ok(Math.abs(GOLDEN_ANGLE - 2.399963229728653) < 1e-9);
  assert.ok(Math.abs(GOLDEN_ANGLE * 360 / (2 * Math.PI) - 137.50776405003785) < 1e-9);
});

// The L1 contract suite — THE interface spec. Run against every kernel:
//   tests/kernel-contract.test.mjs  → reference JS kernel
//   tests/wasm-kernel.test.mjs      → real quilt-vm-wasm WASM via the adapter
// A kernel is quilt-compatible iff it passes this suite unmodified.
import { test } from 'node:test';
import assert from 'node:assert/strict';

export function runContractSuite(label, makeKernel) {
  const mk = async () => makeKernel();

  // ---------- BIND / VIEW ----------
  test(`${label}: bind + view roundtrip`, async () => {
    const k = await mk();
    k.bind('tempo', 120);
    assert.equal(k.view('tempo'), 120);
  });

  test(`${label}: bind overwrites`, async () => {
    const k = await mk();
    k.bind('tempo', 120); k.bind('tempo', 96);
    assert.equal(k.view('tempo'), 96);
  });

  test(`${label}: view of unknown cell returns null (degrade, never throw)`, async () => {
    const k = await mk();
    assert.equal(k.view('nope'), null);
  });

  test(`${label}: bind rejects empty name`, async () => {
    await assert.rejects(async () => (await mk()).bind('', 1), TypeError);
  });

  test(`${label}: bind rejects non-string name`, async () => {
    await assert.rejects(async () => (await mk()).bind(42, 1), TypeError);
  });

  test(`${label}: bind rejects name over 256 chars`, async () => {
    await assert.rejects(async () => (await mk()).bind('x'.repeat(257), 1), TypeError);
  });

  test(`${label}: bind accepts name at exactly 256 chars`, async () => {
    const k = await mk();
    const n = 'x'.repeat(256);
    k.bind(n, 1);
    assert.equal(k.view(n), 1);
  });

  test(`${label}: bind rejects non-JSON-serializable value (function)`, async () => {
    await assert.rejects(async () => (await mk()).bind('f', () => 1), TypeError);
  });

  test(`${label}: bind accepts nested JSON structures`, async () => {
    const k = await mk();
    k.bind('patch', { osc: { type: 'sine', freq: 440 }, nested: [1, { a: [2, 3] }] });
    assert.deepEqual(k.view('patch').osc, { type: 'sine', freq: 440 });
  });

  // ---------- LINK ----------
  test(`${label}: link creates a typed directed edge and returns stable id`, async () => {
    const k = await mk();
    k.bind('a', 1); k.bind('b', 2);
    const id = k.link('a', 'b', 'feeds');
    assert.equal(id, 'a->b:feeds');
    assert.deepEqual(k.links(), [{ from: 'a', to: 'b', type: 'feeds' }]);
  });

  test(`${label}: link is idempotent for duplicate (a,b,type)`, async () => {
    const k = await mk();
    k.bind('a', 1); k.bind('b', 2);
    k.link('a', 'b', 'feeds'); k.link('a', 'b', 'feeds');
    assert.equal(k.links().length, 1);
  });

  test(`${label}: link with same cells but different type is a distinct edge`, async () => {
    const k = await mk();
    k.bind('a', 1); k.bind('b', 2);
    k.link('a', 'b', 'feeds'); k.link('a', 'b', 'mutes');
    assert.equal(k.links().length, 2);
  });

  test(`${label}: link throws UnknownCell for unbound source`, async () => {
    const k = await mk(); k.bind('b', 2);
    assert.throws(() => k.link('ghost', 'b', 'x'), /UnknownCell: ghost/);
  });

  test(`${label}: link throws UnknownCell for unbound target`, async () => {
    const k = await mk(); k.bind('a', 1);
    assert.throws(() => k.link('a', 'ghost', 'x'), /UnknownCell: ghost/);
  });

  test(`${label}: links(from) filters by source cell`, async () => {
    const k = await mk();
    k.bind('a', 1); k.bind('b', 2); k.bind('c', 3);
    k.link('a', 'b', 'x'); k.link('a', 'c', 'y'); k.link('b', 'c', 'z');
    assert.equal(k.links('a').length, 2);
    assert.equal(k.links('b').length, 1);
    assert.equal(k.links().length, 3);
  });

  // ---------- EFFECT ----------
  test(`${label}: effect registers forward/inverse pair and apply transforms value`, async () => {
    const k = await mk();
    k.bind('counter', 0);
    k.effect('counter', 'inc', v => v + 1, v => v - 1);
    k.apply('counter', 'inc');
    k.apply('counter', 'inc');
    assert.equal(k.view('counter'), 2);
  });

  test(`${label}: apply throws UnknownOp for unregistered op`, async () => {
    const k = await mk(); k.bind('c', 0);
    assert.throws(() => k.apply('c', 'nope'), /UnknownOp: nope/);
  });

  test(`${label}: apply throws UnknownOp for op on cell with no effects`, async () => {
    const k = await mk(); k.bind('c', 0);
    assert.throws(() => k.apply('c', 'anything'), /UnknownOp/);
  });

  test(`${label}: effect throws on unknown cell`, async () => {
    const k = await mk();
    assert.throws(() => k.effect('ghost', 'op', v => v, v => v), /UnknownCell/);
  });

  test(`${label}: effect rejects non-function forward/inverse`, async () => {
    const k = await mk(); k.bind('c', 0);
    assert.throws(() => k.effect('c', 'op', 'not-fn', v => v), TypeError);
  });

  // ---------- undo ----------
  test(`${label}: undo restores prior value`, async () => {
    const k = await mk();
    k.bind('counter', 0);
    k.effect('counter', 'inc', v => v + 1, v => v - 1);
    k.apply('counter', 'inc');
    assert.equal(k.undo(), 0);
    assert.equal(k.view('counter'), 0);
  });

  // ---------- CONTRACT v4: bind is undoable (everything is reversible) ----------
  test(`${label}: undoing a fresh bind removes the cell (the address never existed)`, async () => {
    const k = await mk();
    k.bind('ghost', { room: 'attic' });
    assert.equal(k.view('ghost').room, 'attic');
    assert.equal(k.undo(), null);
    assert.equal(k.view('ghost'), null, 'cell is gone, not just emptied');
    assert.ok(!k.cells('').includes('ghost'), 'registry forgets the name');
  });

  test(`${label}: undoing an overwrite restores the prior value`, async () => {
    const k = await mk();
    k.bind('sediment', { gen: 1 });
    k.bind('sediment', { gen: 2 });
    assert.equal(k.view('sediment').gen, 2);
    assert.equal(k.undo().gen, 1, 'overwrite undone');
    assert.equal(k.undo(), null, 'fresh bind undone — cell removed');
    assert.equal(k.view('sediment'), null);
  });

  test(`${label}: undo is LIFO across multiple applies`, async () => {
    const k = await mk();
    k.bind('c', 0);
    k.effect('c', 'inc', v => v + 1, v => v - 1);
    k.apply('c', 'inc'); k.apply('c', 'inc'); k.apply('c', 'inc');
    k.undo(); k.undo();
    assert.equal(k.view('c'), 1);
  });

  test(`${label}: undo on empty history returns undefined (degrade, never throw)`, async () => {
    const k = await mk();
    assert.equal(k.undo(), undefined, 'empty history — distinct from a removed cell (null)');
  });

  // ---------- TICK ----------
  test(`${label}: tick advances the clock by dt`, async () => {
    const k = await mk();
    assert.equal(k.tick(5).ts, 5);
    assert.equal(k.tick(2.5).ts, 7.5);
    assert.equal(k.now(), 7.5);
  });

  test(`${label}: tick defaults to dt=1`, async () => {
    const k = await mk();
    assert.equal(k.tick().ts, 1);
  });

  test(`${label}: tick flushes queued effects in FIFO order`, async () => {
    const k = await mk();
    k.bind('a', 0); k.bind('b', 0);
    k.effect('a', 'inc', v => v + 1, v => v - 1);
    k.effect('b', 'inc', v => v + 1, v => v - 1);
    k.queueEffect('a', 'inc');
    k.queueEffect('b', 'inc');
    k.queueEffect('a', 'inc');
    const r = k.tick(0);
    assert.deepEqual(r.applied.map(x => x.cell), ['a', 'b', 'a']);
    assert.equal(k.view('a'), 2);
    assert.equal(k.view('b'), 1);
    assert.equal(k.queue.length, 0);
  });

  test(`${label}: queued effects flush once (queue empties on tick)`, async () => {
    const k = await mk();
    k.bind('a', 0);
    k.effect('a', 'inc', v => v + 1, v => v - 1);
    k.queueEffect('a', 'inc');
    k.tick(0);
    k.tick(0);
    assert.equal(k.view('a'), 1, 'second tick flushes nothing new');
  });

  // ---------- snapshot (Tide-Pool distillation hook) ----------
  test(`${label}: snapshot returns distillable state`, async () => {
    const k = await mk();
    k.bind('tempo', 120);
    k.bind('key', 'D minor');
    k.link('tempo', 'key', 'constrains');
    k.tick(4);
    const s = k.snapshot();
    assert.equal(s.cells.tempo, 120);
    assert.equal(s.links.length, 1);
    assert.equal(s.ts, 4);
    assert.equal(s.historyDepth, 2, 'binds are undoable since contract v4 — history covers everything');
    assert.equal(s.queued, 0);
  });

  // ---------- CONTRACT v2: value semantics ----------
  test(`${label}: bound values are snapshotted (mutating the original does not alias)`, async () => {
    const k = await mk();
    const patch = { level: 1 };
    k.bind('mixer', patch);
    patch.level = 99;
    assert.equal(k.view('mixer').level, 1);
  });

  test(`${label}: NaN and ±Infinity canonicalize to null (JSON semantics)`, async () => {
    const k = await mk();
    k.bind('nan', NaN);
    k.bind('inf', Infinity);
    k.bind('ninf', -Infinity);
    assert.equal(k.view('nan'), null);
    assert.equal(k.view('inf'), null);
    assert.equal(k.view('ninf'), null);
  });

  // ---------- CONTRACT v2: edge id escaping ----------
  test(`${label}: edge ids escape separator characters — no collisions on weird names`, async () => {
    const k = await mk();
    k.bind('a->b', 1); k.bind('c', 2); k.bind('a', 3); k.bind('b->c', 4);
    const id1 = k.link('a->b', 'c', 'x');
    const id2 = k.link('a', 'b->c', 'x');
    assert.notEqual(id1, id2);
    assert.equal(k.links().length, 2);
  });

  // ---------- CONTRACT v2: validated queue ----------
  test(`${label}: queueEffect throws UnknownCell at enqueue time`, async () => {
    const k = await mk();
    assert.throws(() => k.queueEffect('ghost', 'inc'), /UnknownCell: ghost/);
  });

  test(`${label}: queueEffect throws UnknownOp at enqueue time`, async () => {
    const k = await mk();
    k.bind('a', 0);
    assert.throws(() => k.queueEffect('a', 'nope'), /UnknownOp: nope/);
  });

  // ---------- CONTRACT v2: live inverse ----------
  test(`${label}: applyInverse runs the registered inverse`, async () => {
    const k = await mk();
    k.bind('counter', 5);
    k.effect('counter', 'inc', v => v + 1, v => v - 1);
    k.apply('counter', 'inc');
    k.applyInverse('counter', 'inc');
    assert.equal(k.view('counter'), 5);
  });

  // ---------- CONTRACT v2: undo returns the restored value ----------
  test(`${label}: undo returns the restored value`, async () => {
    const k = await mk();
    k.bind('c', 0);
    k.effect('c', 'inc', v => v + 1, v => v - 1);
    k.apply('c', 'inc');
    assert.equal(k.undo(), 0);
    assert.equal(k.view('c'), 0);
  });

  // ---------- CONTRACT v2: deletion ----------
  test(`${label}: unbind removes the cell and its incident edges and ops`, async () => {
    const k = await mk();
    k.bind('a', 1); k.bind('b', 2); k.bind('c', 3);
    k.link('a', 'b', 'x'); k.link('b', 'c', 'y');
    k.effect('a', 'op', v => v, v => v);
    assert.equal(k.unbind('b'), true);
    assert.equal(k.view('b'), null);
    assert.equal(k.links().length, 0, 'both edges touched b');
    k.apply('a', 'op');                    // a's own op survives
    assert.equal(k.view('a'), 1);
  });

  test(`${label}: unbind of unknown cell degrades to false`, async () => {
    const k = await mk();
    assert.equal(k.unbind('ghost'), false);
  });

  test(`${label}: unlink removes exactly one edge; unknown id degrades to false`, async () => {
    const k = await mk();
    k.bind('a', 1); k.bind('b', 2);
    const id = k.link('a', 'b', 'feeds');
    assert.equal(k.unlink('a->b:feeds'), true);
    assert.equal(k.links().length, 0);
    assert.equal(k.unlink('never-was'), false);
    assert.ok(id);
  });

  // ---------- CONTRACT v2: hydration ----------
  test(`${label}: cells named __proto__ survive snapshot and load`, async () => {
    const k = await mk();
    k.bind('__proto__', 42);
    k.bind('normal', 1);
    const s = k.snapshot();
    assert.equal(s.cells['__proto__'], 42);
    assert.ok(Object.keys(s.cells).includes('__proto__'));
    const k2 = await mk();
    k2.load(s);
    assert.equal(k2.view('__proto__'), 42);
  });

  test(`${label}: load(snapshot) round-trips cells and links; clock restarts at 0`, async () => {
    const k = await mk();
    k.bind('tempo', 120);
    k.bind('patch', { osc: 'sine' });
    k.link('tempo', 'patch', 'drives');
    k.tick(4);
    const snap = k.snapshot();
    const k2 = await mk();
    k2.load(snap);
    assert.equal(k2.view('tempo'), 120);
    assert.deepEqual(k2.view('patch'), { osc: 'sine' });
    assert.equal(k2.links().length, 1);
    assert.equal(k2.now(), 0, 'clock is provenance, not resurrected');
  });

  // ---------- CONTRACT v3: L2 surface ----------
  test(`${label}: view returns a fresh copy — mutating it cannot corrupt kernel state`, async () => {
    const k = await mk();
    k.bind('patch', { level: 1 });
    const seen = k.view('patch');
    seen.level = 999;
    assert.equal(k.view('patch').level, 1);
  });

  test(`${label}: subscribe receives bind/apply events with cell and value`, async () => {
    const k = await mk();
    const events = [];
    k.subscribe(e => events.push(e));
    k.bind('tempo', 120);
    k.effect('tempo', 'halve', v => v / 2, v => v * 2);
    k.apply('tempo', 'halve');
    assert.deepEqual(events.map(e => e.kind), ['bind', 'effect', 'apply']);
    assert.equal(events[2].cell, 'tempo');
    assert.equal(events[2].value, 60);
  });

  test(`${label}: subscribe filters by cell and kinds; unsubscribe stops delivery`, async () => {
    const k = await mk();
    const events = [];
    const unsub = k.subscribe(e => events.push(e), { cell: 'a', kinds: ['apply'] });
    k.bind('a', 0); k.bind('b', 0);
    k.effect('a', 'inc', v => v + 1, v => v - 1);
    k.effect('b', 'inc', v => v + 1, v => v - 1);
    k.apply('a', 'inc');
    k.apply('b', 'inc');
    assert.equal(events.length, 1, 'only a\'s apply passes the filter');
    unsub();
    k.apply('a', 'inc');
    assert.equal(events.length, 1, 'unsubscribed');
  });

  test(`${label}: undo event carries cell and value (render models listen, not poll)`, async () => {
    const k = await mk();
    const events = [];
    k.subscribe(e => events.push(e), { kinds: ['undo'] });
    k.bind('x', 5);
    k.effect('x', 'inc', v => v + 1, v => v - 1);
    k.apply('x', 'inc');
    k.undo();
    assert.equal(events.length, 1);
    assert.equal(events[0].cell, 'x');
    assert.equal(events[0].value, 5);
  });

  test(`${label}: viewMany reads in parallel; cells(prefix) lists names`, async () => {
    const k = await mk();
    k.bind('mixer.a', 1); k.bind('mixer.b', 2); k.bind('lfo.rate', 3);
    assert.deepEqual(k.viewMany(['mixer.a', 'lfo.rate', 'ghost']), [1, 3, null]);
    assert.deepEqual(k.cells('mixer.').sort(), ['mixer.a', 'mixer.b']);
    assert.equal(k.cells().length, 3);
  });

  test(`${label}: unlink accepts (a,b,type) triple; link id stays stable`, async () => {
    const k = await mk();
    k.bind('a', 1); k.bind('b', 2);
    const id = k.link('a', 'b', 'feeds');
    assert.equal(k.unlink('a', 'b', 'feeds'), true);
    assert.equal(k.links().length, 0);
    assert.equal(k.unlink('a', 'b', 'feeds'), false);
    assert.ok(id);
  });

  test(`${label}: bind accepts metadata; metaOf reads it; snapshot round-trips it`, async () => {
    const k = await mk();
    k.bind('tempo', 120, { units: 'bpm', min: 20, max: 300 });
    assert.deepEqual(k.metaOf('tempo'), { units: 'bpm', min: 20, max: 300 });
    const k2 = await mk();
    k2.load(k.snapshot());
    assert.equal(k2.view('tempo'), 120);
    assert.deepEqual(k2.metaOf('tempo'), { units: 'bpm', min: 20, max: 300 });
  });

  test(`${label}: bind rejects non-JSON metadata (circular)`, async () => {
    const k = await mk();
    const circular = {};
    circular.self = circular;
    assert.throws(() => k.bind('x', 1, circular), TypeError);
  });
}

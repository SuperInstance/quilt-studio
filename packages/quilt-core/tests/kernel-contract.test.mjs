// Kernel contract tests — the L1 compatibility gate.
// Run: node --test tests/  (or: node tests/kernel-contract.test.mjs)
// Every quilt-vm-compatible kernel (reference JS today, quilt-vm-wasm WASM next)
// must pass this suite unmodified. The suite IS the interface spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../src/reference-kernel.mjs';

// ---------- BIND / VIEW ----------
test('bind + view roundtrip', () => {
  const k = new QuiltKernel();
  k.bind('tempo', 120);
  assert.equal(k.view('tempo'), 120);
});

test('bind overwrites', () => {
  const k = new QuiltKernel();
  k.bind('tempo', 120); k.bind('tempo', 96);
  assert.equal(k.view('tempo'), 96);
});

test('view of unknown cell returns null (degrade, never throw)', () => {
  const k = new QuiltKernel();
  assert.equal(k.view('nope'), null);
});

test('bind rejects empty name', () => {
  assert.throws(() => new QuiltKernel().bind('', 1), TypeError);
});

test('bind rejects non-string name', () => {
  assert.throws(() => new QuiltKernel().bind(42, 1), TypeError);
});

test('bind rejects name over 256 chars', () => {
  assert.throws(() => new QuiltKernel().bind('x'.repeat(257), 1), TypeError);
});

test('bind accepts name at exactly 256 chars', () => {
  const k = new QuiltKernel();
  const n = 'x'.repeat(256);
  k.bind(n, 1);
  assert.equal(k.view(n), 1);
});

test('bind rejects non-JSON-serializable value (function)', () => {
  assert.throws(() => new QuiltKernel().bind('f', () => 1), TypeError);
});

test('bind accepts nested JSON structures', () => {
  const k = new QuiltKernel();
  k.bind('patch', { osc: { type: 'sine', freq: 440 }, nested: [1, { a: [2, 3] }] });
  assert.deepEqual(k.view('patch').osc, { type: 'sine', freq: 440 });
});

// ---------- LINK ----------
test('link creates a typed directed edge and returns stable id', () => {
  const k = new QuiltKernel();
  k.bind('a', 1); k.bind('b', 2);
  const id = k.link('a', 'b', 'feeds');
  assert.equal(id, 'a->b:feeds');
  assert.deepEqual(k.links(), [{ from: 'a', to: 'b', type: 'feeds' }]);
});

test('link is idempotent for duplicate (a,b,type)', () => {
  const k = new QuiltKernel();
  k.bind('a', 1); k.bind('b', 2);
  k.link('a', 'b', 'feeds'); k.link('a', 'b', 'feeds');
  assert.equal(k.links().length, 1);
});

test('link with same cells but different type is a distinct edge', () => {
  const k = new QuiltKernel();
  k.bind('a', 1); k.bind('b', 2);
  k.link('a', 'b', 'feeds'); k.link('a', 'b', 'mutes');
  assert.equal(k.links().length, 2);
});

test('link throws UnknownCell for unbound source', () => {
  const k = new QuiltKernel(); k.bind('b', 2);
  assert.throws(() => k.link('ghost', 'b', 'x'), /UnknownCell: ghost/);
});

test('link throws UnknownCell for unbound target', () => {
  const k = new QuiltKernel(); k.bind('a', 1);
  assert.throws(() => k.link('a', 'ghost', 'x'), /UnknownCell: ghost/);
});

test('links(from) filters by source cell', () => {
  const k = new QuiltKernel();
  k.bind('a', 1); k.bind('b', 2); k.bind('c', 3);
  k.link('a', 'b', 'x'); k.link('a', 'c', 'y'); k.link('b', 'c', 'z');
  assert.equal(k.links('a').length, 2);
  assert.equal(k.links('b').length, 1);
  assert.equal(k.links().length, 3);
});

// ---------- EFFECT ----------
test('effect registers forward/inverse pair and apply transforms value', () => {
  const k = new QuiltKernel();
  k.bind('counter', 0);
  k.effect('counter', 'inc', v => v + 1, v => v - 1);
  k.apply('counter', 'inc');
  k.apply('counter', 'inc');
  assert.equal(k.view('counter'), 2);
});

test('apply throws UnknownOp for unregistered op', () => {
  const k = new QuiltKernel(); k.bind('c', 0);
  assert.throws(() => k.apply('c', 'nope'), /UnknownOp: nope/);
});

test('apply throws UnknownOp for op on cell with no effects', () => {
  const k = new QuiltKernel(); k.bind('c', 0);
  assert.throws(() => k.apply('c', 'anything'), /UnknownOp/);
});

test('effect throws on unknown cell', () => {
  const k = new QuiltKernel();
  assert.throws(() => k.effect('ghost', 'op', v => v, v => v), /UnknownCell/);
});

test('effect rejects non-function forward/inverse', () => {
  const k = new QuiltKernel(); k.bind('c', 0);
  assert.throws(() => k.effect('c', 'op', 'not-fn', v => v), TypeError);
});

// ---------- undo ----------
test('undo restores prior value', () => {
  const k = new QuiltKernel();
  k.bind('counter', 0);
  k.effect('counter', 'inc', v => v + 1, v => v - 1);
  k.apply('counter', 'inc');
  assert.equal(k.undo(), true);
  assert.equal(k.view('counter'), 0);
});

test('undo is LIFO across multiple applies', () => {
  const k = new QuiltKernel();
  k.bind('c', 0);
  k.effect('c', 'inc', v => v + 1, v => v - 1);
  k.apply('c', 'inc'); k.apply('c', 'inc'); k.apply('c', 'inc');
  k.undo(); k.undo();
  assert.equal(k.view('c'), 1);
});

test('undo on empty history returns false (degrade, never throw)', () => {
  const k = new QuiltKernel();
  assert.equal(k.undo(), false);
});

// ---------- TICK ----------
test('tick advances the clock by dt', () => {
  const k = new QuiltKernel();
  assert.equal(k.tick(5).ts, 5);
  assert.equal(k.tick(2.5).ts, 7.5);
  assert.equal(k.now(), 7.5);
});

test('tick defaults to dt=1', () => {
  const k = new QuiltKernel();
  assert.equal(k.tick().ts, 1);
});

test('tick flushes queued effects in FIFO order', () => {
  const k = new QuiltKernel();
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

test('queued effects persist across ticks until flushed (queue is durable within kernel)', () => {
  const k = new QuiltKernel();
  k.bind('a', 0);
  k.effect('a', 'inc', v => v + 1, v => v - 1);
  k.queueEffect('a', 'inc');
  k.tick(0);
  k.tick(0);
  assert.equal(k.view('a'), 1, 'second tick flushes nothing new');
});

// ---------- snapshot (Tide-Pool distillation hook) ----------
test('snapshot returns distillable state', () => {
  const k = new QuiltKernel();
  k.bind('tempo', 120);
  k.bind('key', 'D minor');
  k.link('tempo', 'key', 'constrains');
  k.tick(4);
  const s = k.snapshot();
  assert.equal(s.cells.tempo, 120);
  assert.equal(s.links.length, 1);
  assert.equal(s.ts, 4);
  assert.equal(s.historyDepth, 0);
  assert.equal(s.queued, 0);
});

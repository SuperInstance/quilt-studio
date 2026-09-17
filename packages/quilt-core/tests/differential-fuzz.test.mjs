// Contract v5 — the differential fuzz, permanent.
// Born as the round-4 playtester's probe7/probe8: a seeded 400-op stream of
// bind/overwrite/apply/applyInverse/undo/link/unlink/unbind/queue/tick/meta
// run against BOTH kernels; every step's full observable state must match.
// The stream that found the WASM ghost (step 282: apply-on-missing re-created
// a cell in the reference's map but not the WASM registry) is preserved as
// seed 42. If the kernels ever diverge again, this test names the step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../src/wasm-kernel.mjs';

let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = a => a[Math.floor(rnd() * a.length)];

const OPS = ['bind', 'bind', 'bind', 'overwrite', 'apply', 'applyInverse', 'undo', 'link', 'unlink', 'unbind', 'tick', 'queue', 'meta'];
const NAMES = ['a', 'b', 'c', 'weird>name', 'x:y', 'back\\slash', 'floor.0', ''];

function run(K, steps) {
  seed = 42; // identical stream, always
  const k = new K();
  const values = [null, 0, -0, 1.5, 'str', true, [1, 2], { n: 1 }, { deep: { x: [null, NaN, Infinity] } }, 'null'];
  const cells = [];
  const trace = [];
  for (let step = 0; step < steps; step++) {
    const op = pick(OPS);
    let note = '';
    try {
      switch (op) {
        case 'bind': {
          const n = pick(NAMES.slice(0, 7)) + Math.floor(rnd() * 3);
          k.bind(n, structuredClone(pick(values)), rnd() < 0.3 ? { u: 'm' } : undefined);
          if (!cells.includes(n)) cells.push(n);
          note = n;
          break;
        }
        case 'overwrite': { const n = pick(cells); k.bind(n, structuredClone(pick(values))); note = n; break; }
        case 'apply': case 'applyInverse': {
          const n = pick(cells);
          k.effect(n, 'op1', v => (v && typeof v === 'object' && 'n' in v ? { n: v.n + 1 } : { n: 1 }),
                           v => (v && typeof v === 'object' && 'n' in v ? { n: v.n - 1 } : { n: -1 }));
          k[op](n, 'op1');
          note = n;
          break;
        }
        case 'undo': { note = JSON.stringify(k.undo()); break; }
        case 'link': { const a = pick(cells), b = pick(cells), t = pick(['t1', 't>2', 't:3']); k.link(a, b, t); note = `${a} ${b} ${t}`; break; }
        case 'unlink': { const l = k.links(); if (l.length) { k.unlink(l[0].id); note = l[0].id; } break; }
        case 'unbind': { const n = pick(cells); k.unbind(n); note = n; break; }
        case 'queue': {
          const n = pick(cells);
          k.effect(n, 'q', v => (v && typeof v === 'object' ? { ...v, q: 1 } : { q: 1 }), v => v);
          k.queueEffect(n, 'q');
          note = n;
          break;
        }
        case 'tick': { const dt = 1 + Math.floor(rnd() * 3); note = `${dt} applied=${k.tick(dt).applied.length}`; break; }
        case 'meta': { const n = pick(cells); note = JSON.stringify(k.metaOf(n)); break; }
      }
    } catch (e) { note = `THROW ${e.constructor.name} ${e.code ?? ''} ${e.message}`; }
    trace.push(`${op} ${note}`);
  }
  const snap = k.snapshot();
  return {
    trace,
    final: JSON.stringify({
      cells: Object.fromEntries(k.cells('').map(n => [n, k.view(n)]).sort()),
      links: k.links(),
      ts: snap.ts,
    }),
  };
}

test('differential fuzz: reference and WASM are observationally identical (seed 42, 400 ops)', () => {
  const a = run(QuiltKernel, 400);
  const b = run(WasmQuiltKernel, 400);
  for (let i = 0; i < 400; i++)
    assert.equal(a.trace[i], b.trace[i], `step ${i} diverged (the playtester's step-282 ghost class)`);
  assert.equal(a.final, b.final, 'final snapshots diverge');
});

test('differential fuzz: shorter prefixes agree too (guards against lucky sync)', () => {
  for (const steps of [50, 150, 283]) {
    const a = run(QuiltKernel, steps);
    const b = run(WasmQuiltKernel, steps);
    assert.equal(a.final, b.final, `prefix ${steps}`);
  }
});

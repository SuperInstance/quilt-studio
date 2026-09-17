// The field on the floor — orbiters at Penrose vertices, over BOTH kernels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Multigrid } from '../src/multigrid.mjs';
import { PenField } from '../src/penfield.mjs';
import { PHI } from '../src/golden.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];
const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

for (const [label, K] of kernels) {
  test(`${label}: orbiters sit exactly at the core Penrose vertices`, () => {
    const k = new K();
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 8 });
    const f = new PenField(k, mg);
    const seats = k.view('penfield.c');
    const want = f.vertices().map(p => [p.x, p.y]);
    assert.equal(seats.length, want.length);
    assert.ok(seats.length > 50, `core seats: ${seats.length}`);
    // every seat is a vertex, every vertex a seat (order-independent)
    const key = v => v.map(x => Math.round(x * 1e9)).join(',');
    const have = new Set(seats.map(key));
    for (const w of want) assert.ok(have.has(key(w)), `vertex ${key(w)} seated`);
    // and the state is primed at the origin of each orbit
    assert.equal(k.view('penfield.z').length, seats.length);
    assert.ok(k.view('penfield.z').every(z => z[0] === 0 && z[1] === 0));
  });

  test(`${label}: one kernel tick advances the whole vertex field coherently`, () => {
    const k = new K();
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 8 });
    const f = new PenField(k, mg);
    const n0 = f.vertices().length;
    f.step();
    const z = k.view('penfield.z');
    assert.equal(z.length, n0); // array shape preserved; nulls mark escapes
    const alive = z.filter(v => v !== null);
    // a step IS z → z² + c out of the origin: z₁ = c for the survivors
    const c = k.view('penfield.c');
    for (let i = 0; i < z.length; i++) {
      if (z[i] === null) continue;
      assert.ok(Math.abs(z[i][0] - c[i][0]) < 1e-12 && Math.abs(z[i][1] - c[i][1]) < 1e-12);
    }
    // escapes counted and monotone under stepping; the escaped stay escaped
    const e1 = f.escaped();
    f.step(); f.step();
    assert.ok(f.escaped() >= e1);
    assert.ok(f.escaped() < n0, 'not everything escapes');
    assert.ok(k.view('penfield.escaped') === f.escaped());
  });

  test(`${label}: the address module — projected vertex gaps live in Z[φ]·(p,q)`, () => {
    const k = new K();
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 8 });
    const f = new PenField(k, mg);
    const l = k.view('penfield.ladder');
    assert.ok(l.elements.length >= 3, `module elements: ${l.elements.length}`);
    assert.ok(f.singsPhi(), `module: atoms ${l.atoms}, elements ${JSON.stringify(l.elements)}`);
    // the two atoms sing φ
    const [p, q] = l.atoms;
    assert.ok(Math.abs(q / p - PHI) < 1e-9, `atom ratio ${q / p}`);
    // every gap is an exact integer combination of the atoms
    for (const e of l.elements) {
      assert.ok(e.m !== null, `gap ${e.value} outside the module`);
      assert.ok(Math.abs(e.m * p + e.n * q - e.value) < 1e-9,
        `${e.m}·p + ${e.n}·q = ${e.m * p + e.n * q} vs ${e.value}`);
    }
    // at least one element needs BOTH atoms (rank 2, not a 1D lattice)
    assert.ok(l.elements.some(e => e.m !== 0 && e.n !== 0), 'genuinely rank-2');
  });

  test(`${label}: a detuned crystal sings off-ladder — the law discriminates`, () => {
    class Detuned extends Multigrid {
      constructor(o) {
        super(o);
        this.normals = this.normals.map((n, i) => {
          const a = Math.PI * i / 5 + (i % 2 ? 0.0349066 : -0.0349066);
          return [Math.cos(a), Math.sin(a)];
        });
      }
    }
    const k = new K();
    const f = new PenField(k, new Detuned({ N: 5, gamma: GENERIC, reach: 8 }));
    assert.equal(f.singsPhi(), false, `detuned ladder rungs: ${JSON.stringify(k.view('penfield.ladder'))}`);
  });

  test(`${label}: the field is a kernel tenant — cells, effect, tick history`, () => {
    const k = new K();
    const f = new PenField(k, new Multigrid({ N: 5, gamma: GENERIC, reach: 6 }));
    const before = k.history.length;
    f.step();
    assert.ok(k.history.length > before, 'tick writes history');
    const snap = k.snapshot();
    assert.ok('penfield.c' in snap.cells && 'penfield.z' in snap.cells);
    assert.equal(snap.cells['penfield.escaped'], f.escaped());
  });
}

test('rank 2 where the floor had rank 1 — the vertex address alphabet', () => {
  // 1D floor: gaps are the word's two tiles, one ratio φ. 2D vertex
  // addresses: every gap is m·p + n·q with q/p = φ — the integer span of
  // two golden atoms. Growing the reach reveals more module elements, never
  // a gap outside the span.
  const k = new QuiltKernel();
  const f = new PenField(k, new Multigrid({ N: 5, gamma: GENERIC, reach: 12 }));
  const l = f.ladder();
  assert.ok(l.elements.length >= 5, `reach-12 module elements: ${l.elements.length}`);
  assert.ok(f.singsPhi(l));
});

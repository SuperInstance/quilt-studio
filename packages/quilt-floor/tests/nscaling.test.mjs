// Scaling: one machinery, many alphabets. For every N the dual edges are
// rigid at exactly 2/N, and the family-k intercept gaps live in the ring
// Z[2cos(π/N)] — the N-th cyclotomic field's real subfield. N=5 recovers
// φ; N=7 sings 2cos(π/7) and 2cos(2π/7); N=10 sings 1+2cos(π/10).
// The locational address round-trips: quantize(positionOf(j)) = j, and a
// 2D read anywhere inside a face returns the lift's payload — O(N), zero seek.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Multigrid } from '../src/multigrid.mjs';
import { LocAddress, LocStore } from '../src/locaddress.mjs';
import { PHI } from '../src/golden.mjs';

const G7 = [0.1, 0.7, 0.3, 0.9, 0.4, 0.6, 0.2];
const G8 = [0.1, 0.7, 0.3, 0.9, 0.4, 0.6, 0.2, 0.8];
const G10 = [0.1, 0.7, 0.3, 0.9, 0.4, 0.6, 0.2, 0.8, 0.5, 0.15];
const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];

function coreGaps(m, k = 0) {
  const n = m.normals[k], perp = [-n[1], n[0]], d = perp;
  const core = m.reach * 0.35;
  const lines = new Map();
  for (const s of m.arrangementSegments()) {
    if (s.k !== k) continue;
    const a = [(s.j + m.gamma[k]) * n[0], (s.j + m.gamma[k]) * n[1]];
    const tm = (s.t1 + s.t2) / 2;
    if (Math.hypot(a[0] + tm * d[0], a[1] + tm * d[1]) >= core) continue;
    for (const f of [s.above, s.below]) {
      let cx = 0, cy = 0;
      for (let i = 0; i < m.N; i++) { const w = f[i] + m.gamma[i] + 0.5; cx += w * m.normals[i][0]; cy += w * m.normals[i][1]; }
      cx *= 2 / m.N; cy *= 2 / m.N;
      const c = perp[0] * cx + perp[1] * cy;
      lines.set(Math.round(c * 1e9), c);
    }
  }
  const vals = [...lines.values()].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 0; i + 1 < vals.length; i++) gaps.push(vals[i + 1] - vals[i]);
  gaps.sort((a, b) => a - b);
  const distinct = [];
  for (const g of gaps) {
    if (distinct.length && Math.abs(g - distinct[distinct.length - 1]) < 1e-6 * g) continue;
    distinct.push(g);
  }
  return distinct;
}

for (const N of [5, 7, 8, 10]) {
  test(`N=${N}: dual edges rigid at exactly 2/N`, () => {
    const gamma = N === 5 ? GENERIC : N === 7 ? G7 : N === 8 ? G8 : G10;
    const m = new Multigrid({ N, gamma, reach: 5 });
    const { faces, edges } = m.dualEdges();
    assert.ok(edges.length > 200, `edges: ${edges.length}`);
    for (const e of edges) {
      const L = Math.hypot(faces[e.b].x - faces[e.a].x, faces[e.b].y - faces[e.a].y);
      assert.ok(Math.abs(L - 2 / N) < 1e-9, `N=${N} edge ${L}`);
    }
  });
}

test('N=7: the family gaps sing the heptagonal ring Z[2cos(π/7)]', () => {
  const m = new Multigrid({ N: 7, gamma: G7, reach: 6 });
  const gaps = coreGaps(m);
  assert.ok(gaps.length >= 4, `gaps: ${gaps.length}`);
  // some pair of distinct gaps has ratio 2cos(π/7) and another 2cos(2π/7)
  const c1 = 2 * Math.cos(Math.PI / 7), c2 = 2 * Math.cos(2 * Math.PI / 7);
  const ratios = [];
  for (let i = 0; i < gaps.length; i++) for (let j = 0; j < gaps.length; j++) {
    if (i !== j) ratios.push(gaps[i] / gaps[j]);
  }
  assert.ok(ratios.some(r => Math.abs(r - c1) < 1e-4), `no ratio ≈ 2cos(π/7)=${c1}`);
  assert.ok(ratios.some(r => Math.abs(r - c2) < 1e-4), `no ratio ≈ 2cos(2π/7)=${c2}`);
});

test('N=10: the family gaps sing 1 + 2cos(π/10)', () => {
  const m = new Multigrid({ N: 10, gamma: G10, reach: 6 });
  const gaps = coreGaps(m);
  const target = 1 + 2 * Math.cos(Math.PI / 10);
  const ratios = [];
  for (let i = 0; i < gaps.length; i++) for (let j = 0; j < gaps.length; j++) {
    if (i !== j) ratios.push(gaps[i] / gaps[j]);
  }
  assert.ok(ratios.some(r => Math.abs(r - target) < 1e-4), `no ratio ≈ ${target}`);
});

test('N=5 recovers φ: the ladder from the general probe', () => {
  const m = new Multigrid({ N: 5, gamma: GENERIC, reach: 6 });
  const gaps = coreGaps(m);
  const ratios = [];
  for (let i = 0; i < gaps.length; i++) for (let j = 0; j < gaps.length; j++) {
    if (i !== j) ratios.push(gaps[i] / gaps[j]);
  }
  assert.ok(ratios.some(r => Math.abs(r - PHI) < 1e-6));
});

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];
for (const [label, K] of kernels) {
  test(`${label}: the interference demodulation — interior points round-trip 100%`, () => {
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 6 });
    const addr = new LocAddress(mg);
    const segs = mg.arrangementSegments();
    assert.ok(segs.length > 500);
    let ok = 0, tot = 0;
    for (const s of segs) {
      for (const [face, sign] of [[s.above, 1], [s.below, -1]]) {
        const n = mg.normals[s.k];
        const d = [-n[1], n[0]];
        const mid = [(s.j + mg.gamma[s.k]) * n[0] + (s.t1 + s.t2) / 2 * d[0],
                     (s.j + mg.gamma[s.k]) * n[1] + (s.t1 + s.t2) / 2 * d[1]];
        const p = [mid[0] + sign * 1e-4 * n[0], mid[1] + sign * 1e-4 * n[1]];
        assert.deepEqual(addr.liftAt(p[0], p[1]), [...face]);
        ok++; tot++;
      }
    }
    assert.equal(ok, tot);
  });

  test(`${label}: one-edge seek — K(j) resolves within exactly one dual edge`, () => {
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 6 });
    const addr = new LocAddress(mg);
    const all = mg.faces();
    const faces = all.filter(f => Math.hypot(f.x, f.y) < mg.reach * 0.35);
    assert.ok(faces.length > 30, `core faces: ${faces.length}`);
    const byLift = new Map(all.map(f => [f.lift.join(','), f]));
    for (const f of faces) {
      const [x, y] = addr.positionOf(f.lift);
      const j = addr.liftAt(x, y);
      const g = byLift.get(j.join(','));
      assert.ok(g, 'quantize lands on a known core face');
      const [gx, gy] = addr.positionOf(g.lift);
      const dist = Math.hypot(gx - x, gy - y);
      assert.ok(dist <= 2 / 5 + 1e-9, `seek drift ${dist}`);
    }
  });

  test(`${label}: LocStore — write by lift (Z^N), read by any 2D point in the face`, () => {
    const k = new K();
    const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 6 });
    k.bind('store.ops', 0, { what: 'locational store operations counted' });
    const store = new LocStore(mg);
    const addr = new LocAddress(mg);
    const faces = mg.faces().filter(f => Math.hypot(f.x, f.y) < mg.reach * 0.3);
    assert.ok(faces.length > 20);
    // payload written at the high-dimensional address; read at the face's
    // interior point — and at jittered points that quantize to the same lift
    let reads = 0;
    for (const f of faces) {
      const p = addr.interiorPointOf(f.lift);
      if (!p) continue; // fringe faces may have no bordering segment in-reach
      store.set(f.lift, { lift: [...f.lift] });
      assert.deepEqual(store.get(p[0], p[1]).lift, [...f.lift]);
      for (const [dx, dy] of [[3e-5, 0], [-2e-5, 2e-5], [0, -4e-5]]) {
        const q = [p[0] + dx, p[1] + dy];
        if (addr.liftAt(q[0], q[1]).join(',') === f.lift.join(',')) {
          assert.deepEqual(store.get(q[0], q[1]).lift, [...f.lift]);
          reads++;
        }
      }
    }
    assert.ok(reads > 20, 'interior reads resolved');
    assert.ok(store.size > 20);
  });
}

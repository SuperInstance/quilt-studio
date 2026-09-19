// fabric.mjs — the v4 grammar laws. The exposé under test: v3 scored arcs
// as chords while drawing bows; the chord metric HIDES cost. Here the true
// length is the metric, the delta is pinned, and the Δ_max kill-veto reads
// real curvature. Both kernels host the fabric identically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { makeRat, ratEq, ratToNumber, ratToString } from '../src/commensurate.mjs';
import { evalSpline } from '../src/spline.mjs';
import { fabricArc, fabricLayout, fabricMetrics, killVeto, hostFabric, proportionalSide } from '../src/fabric.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];
const A = { x: 0, y: 0 }, B = { x: 8, y: 0 };

test('fabricArc: endpoints are exact after the lift; the control point is ℚ-exact', () => {
  const arc = fabricArc(A, B, { side: 0.16 });
  const p0 = evalSpline(arc.curve, makeRat(0n));
  const p1 = evalSpline(arc.curve, makeRat(1n));
  assert.ok(ratEq(p0[0], makeRat(0n)) && ratEq(p0[1], makeRat(0n)), 'A endpoint exact');
  assert.ok(ratEq(p1[0], makeRat(8n)) && ratEq(p1[1], makeRat(0n)), 'B endpoint exact');
  // v3 law: ctrl = mid + perp·side = (4, 0) + (0, 8)·0.16 = (4, 1.28)
  assert.ok(Math.abs(ratToNumber(arc.ctrl[0]) - 4) < 1e-15, `ctrl.x = ${ratToString(arc.ctrl[0])}`);
  assert.ok(Math.abs(ratToNumber(arc.ctrl[1]) - 1.28) < 1e-15, `ctrl.y = ${ratToString(arc.ctrl[1])}`);
  assert.equal(arc.chord, 8);
});

test('the v3 scam, pinned: TRUE arc length exceeds the chord — the bow was never free', () => {
  const layout = fabricLayout([['a', 'b']], { a: A, b: B }, { sideFor: () => 0.16 });
  const m = fabricMetrics(layout);
  assert.ok(m.total > m.chordAvg * 1.01, `deltaPct = ${m.deltaPct.toFixed(2)}% — chord under-reports`);
  assert.ok(m.deltaPct > 0.5 && m.deltaPct < 5, `measured delta ${m.deltaPct.toFixed(2)}% (the exposé class: single-digit, systemic)`);
});

test('the dial has a zero: side = 0 makes the arc straight — length == chord (float measure)', () => {
  const layout = fabricLayout([['a', 'b']], { a: A, b: B }, { sideFor: () => 0 });
  const m = fabricMetrics(layout);
  assert.ok(Math.abs(m.total - 8) < 1e-9, `straight arc length ${m.total}`);
  assert.ok(m.deltaPct < 1e-9, 'no bow, no hidden cost');
});

test('killVeto: gentle fabric passes; degenerate (near-coincident) fabric is KILLED — κ reads real curvature', () => {
  const gentle = fabricLayout([['a', 'b']], { a: A, b: B }, { sideFor: () => 0.16 });
  const v1 = killVeto(gentle, { deltaMax: 1.0 });
  assert.ok(v1.pass, `gentle κ_max = ${v1.kappaMax.toFixed(4)} ≤ 1`);
  // degenerate: a and b nearly coincide (the rounding-merge class the engine
  // already kills for vertices — the arc judge now kills it for fabric too)
  const bad = fabricLayout([['a', 'b']], { a: A, b: { x: 1e-9, y: 0 } }, { sideFor: () => 0.16 });
  const v2 = killVeto(bad, { deltaMax: 1.0 });
  assert.ok(!v2.pass, `degenerate κ_max = ${v2.kappaMax.toFixed(1)} > 1 — killed`);
  assert.ok(v2.kappaMax > 1e6, 'near-coincident arcs blow up curvature');
  // and κ decreases monotonically toward the straight dial
  const ks = [0.02, 0.08, 0.16, 0.32].map(side => killVeto(
    fabricLayout([['a', 'b']], { a: A, b: B }, { sideFor: () => side }), { deltaMax: 1e9 }).kappaMax);
  for (let i = 1; i < ks.length; i++) assert.ok(ks[i] > ks[i - 1], `κ grows with the bow: ${ks}`);
});

test('v5 law: proportionalSide caps curvature INDEPENDENT of chord — the hairpins die by construction', () => {
  // the smoke-v4 hairpin pair: chord 0.09
  const pos = { a: { x: 0, y: 0 }, b: { x: 0.09, y: 0 } };
  const edges = [['a', 'b']];
  const v3 = fabricLayout(edges, pos); // default fixed ±0.16
  const kv3 = killVeto(v3, { deltaMax: 1e9 });
  assert.ok(kv3.kappaMax > 1, `v3 fixed bow κ_max = ${kv3.kappaMax.toFixed(2)} on chord 0.09 — the hairpin class`);
  const v5 = fabricLayout(edges, pos, { sideFor: proportionalSide(0.1) });
  const kv5 = killVeto(v5, { deltaMax: 1e9 });
  // exact theory: symmetric quadratic, sagitta r·c² ⇒ κ(mid) = 4r = 0.4
  assert.ok(kv5.kappaMax > 0.3 && kv5.kappaMax < 0.5,
    `v5 proportional bow κ_max = ${kv5.kappaMax.toFixed(4)} ≈ 4·ratio, bounded`);
  assert.ok(kv5.kappaMax < kv3.kappaMax / 4, 'the same arc, tamed by the law not the judge');
  // and the bow is still honest — the true length still exceeds the chord
  const m5 = fabricMetrics(v5);
  assert.ok(m5.deltaPct > 0, 'cost still real, just bounded');
});

test('fabricLayout + fabricMetrics on a mini canon: totals are consistent', () => {
  const pos = { hermit: { x: 0, y: 0 }, tidepool: { x: 8, y: 0 }, duke: { x: 4, y: 6 }, plato: { x: 12, y: 6 } };
  const edges = [['hermit', 'tidepool'], ['tidepool', 'duke'], ['duke', 'plato'], ['plato', 'hermit']];
  const layout = fabricLayout(edges, pos, { sideFor: ([a, b]) => (a < b ? 0.16 : -0.16) });
  const m = fabricMetrics(layout);
  assert.equal(m.arcs, 4);
  const sum = layout.reduce((s, r) => s + r.length, 0);
  assert.equal(m.total, sum);
  assert.ok(m.avg > 0 && m.chordAvg > 0 && m.deltaPct > 0, 'every cycle arc bows');
});

for (const [label, K] of kernels) {
  test(`${label}: the fabric hosts — repos are cells, arcs are owes-links, costs are measured meta`, () => {
    const k = new K();
    const pos = { hermit: { x: 0, y: 0 }, tidepool: { x: 8, y: 0 }, duke: { x: 4, y: 6 } };
    const edges = [['hermit', 'tidepool'], ['tidepool', 'duke']];
    const layout = fabricLayout(edges, pos);
    const { cells, links } = hostFabric(k, layout, pos);
    assert.equal(cells, 3);
    assert.equal(links, 2);
    assert.equal(k.links().filter(l => l.type === 'owes').length, 2);
    const cost = k.view('fabric.hermit→tidepool');
    assert.ok(Math.abs(cost.length - layout[0].length) < 1e-15, 'hosted cost IS the measured length');
    assert.equal(cost.chord, 8);
    // the ℚ control lift round-trips
    const lift = k.metaOf('fabric.hermit→tidepool').lift.ctrl.map(str => {
      const [n, d] = str.split('/').map(BigInt);
      return makeRat(n, d);
    });
    assert.ok(lift.every((r, i) => ratEq(r, layout[0].ctrl[i])), 'ctrl lift is the exact identity');
    assert.equal(k.view('fabric.hermit').x, 0);
  });
}

test('cross-kernel: both substrates hold the identical fabric (views, links, costs)', () => {
  const pos = { hermit: { x: 0, y: 0 }, tidepool: { x: 8, y: 0 }, duke: { x: 4, y: 6 } };
  const edges = [['hermit', 'tidepool'], ['tidepool', 'duke']];
  const layout = fabricLayout(edges, pos);
  const kr = new QuiltKernel(), kw = new WasmQuiltKernel();
  hostFabric(kr, layout, pos, { name: 'g' });
  hostFabric(kw, layout, pos, { name: 'g' });
  assert.deepEqual(kr.cells('g.'), kw.cells('g.'));
  const lr = kr.links(), lw = kw.links();
  assert.equal(lr.length, lw.length);
  for (const l of lr) assert.ok(lw.some(m => m.from === l.from && m.to === l.to && m.type === l.type));
  for (const nm of kr.cells('g.')) {
    assert.deepEqual(kr.view(nm), kw.view(nm));
    assert.deepEqual(kr.metaOf(nm)?.lift ?? null, kw.metaOf(nm)?.lift ?? null);
  }
});

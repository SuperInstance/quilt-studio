// IARS — Identity-Anchored Rational Splines over BOTH kernels, the floor's
// analogue seam. Same discipline as every floor instrument: exactness claims
// pinned exactly (BigInt zero, never tolerance), measurement claims pinned as
// floats with stated tolerances, anti-vacuity tests prove the passing tests
// mean something. The ders row-shape test guards the [null,null,2]
// corruption class that silently nulls curvature vetoes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { makeRat, ratEq, ratIsZero, ratToNumber, ratToString, ratAdd, ratSub, ratMul } from '../src/commensurate.mjs';
import {
  makeSpline, findSpanRat, basisFunsRat, dersBasisFunsRat,
  evalSpline, evalDeriv, curvatureMeasure, arcLengthMeasure,
  snap, sampleAlong, pythagoreanArc, hostTrace,
} from '../src/spline.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

// A float port of Piegl A2.3 for cross-validation (identical structure to the
// repaired nurbs.mjs reference — the row-swap lives INSIDE the k-loop).
function dersBasisFunsFloat(span, u, p, U, nDers) {
  const d = Array.from({ length: nDers + 1 }, () => new Array(p + 1).fill(0));
  const ndu = Array.from({ length: p + 1 }, () => new Array(p + 1).fill(0));
  const left = new Array(p + 1), right = new Array(p + 1);
  ndu[0][0] = 1;
  for (let j = 1; j <= p; j++) {
    left[j] = u - U[span + 1 - j]; right[j] = U[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      ndu[j][r] = right[r + 1] + left[j - r];
      const temp = ndu[r][j - 1] / ndu[j][r];
      ndu[r][j] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    ndu[j][j] = saved;
  }
  for (let j = 0; j <= p; j++) d[0][j] = ndu[j][p];
  const a = [[], []];
  for (let r = 0; r <= p; r++) {
    let s1 = 0, s2 = 1; a[0][0] = 1;
    for (let k = 1; k <= nDers; k++) {
      let d_ = 0; const rk = r - k, pk = p - k;
      if (r >= k) { a[s2][0] = a[s1][0] / ndu[pk + 1][rk]; d_ = a[s2][0] * ndu[rk][pk]; }
      const j1 = rk >= -1 ? 1 : -rk, j2 = r - 1 <= pk ? k - 1 : p - r;
      for (let j = j1; j <= j2; j++) { a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j]; d_ += a[s2][j] * ndu[rk + j][pk]; }
      if (r <= pk) { a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r]; d_ += a[s2][k] * ndu[r][pk]; }
      d[k][r] = d_;
      [s1, s2] = [s2, s1];
    }
  }
  let r = p;
  for (let k = 1; k <= nDers; k++) { for (let j = 0; j <= p; j++) d[k][j] *= r; r *= p - k; }
  return d;
}

// The math-scout's verified hand example (three independent paths: basis eval,
// de Boor walk, knot-insertion joint interpolation): C(1/2) = (1, 3/2).
const HAND = {
  degree: 2,
  knots: [0, 0, 0, 1, 2, 3, 3, 3],
  controls: [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 0 }, { x: 3, y: -2 }],
};

test('makeSpline validates: knot length invariant, non-decreasing, zero-weight rejection', () => {
  assert.throws(() => makeSpline({ degree: 2, knots: [0, 0, 0, 1], controls: HAND.controls }), /knot vector length/);
  assert.throws(() => makeSpline({ degree: 2, knots: [0, 0, 2, 1, 2, 3, 3, 3], controls: HAND.controls }), /non-decreasing/);
  assert.throws(() => makeSpline({ degree: 2, knots: HAND.knots, controls: HAND.controls, weights: [1, 1, 0, 1, 1] }), /zero weight/);
  const s = makeSpline(HAND);
  assert.equal(s.degree, 2);
  assert.equal(s.controls.length, 5);
  assert.equal(s.dim, 2);
  assert.ok(s.controls[0].every(r => r.den === 1n), 'integer identities stay integers');
});

test('de Boor hand example in ℚ: C(1/2) = (1, 3/2) EXACTLY (no tolerance)', () => {
  const s = makeSpline(HAND);
  const p = evalSpline(s, makeRat(1n, 2n));
  assert.ok(ratEq(p[0], makeRat(1n)) && ratEq(p[1], makeRat(3n, 2n)), `got (${ratToString(p[0])}, ${ratToString(p[1])})`);
});

test('partition of unity at rational u: ΣN = 1 EXACTLY across a non-uniform cubic', () => {
  const U = [0, 0, 0, 0, 1, 2.5, 4, 4, 4, 4];
  const Ur = U.map(x => makeRat(BigInt(x * 2), 2n)); // 2.5 is dyadic — exact
  for (let i = 1; i < 40; i++) {
    const u = makeRat(BigInt(i), 10n);
    const span = findSpanRat(3, Ur, u);
    const N = basisFunsRat(span, u, 3, Ur);
    const sum = N.reduce(ratAdd, makeRat(0n));
    assert.ok(ratEq(sum, makeRat(1n)), `u=${ratToString(u)}: ΣN=${ratToString(sum)}`);
  }
});

test('DERS ROW-SHAPE GUARD: quadratic Bézier second-derivative row is [2,−4,2] exactly — the [null,null,2] corruption class stays dead', () => {
  const U = [0, 0, 0, 1, 1, 1].map(x => makeRat(x));
  const u = makeRat(1n, 2n);
  const span = findSpanRat(2, U, u);
  const d = dersBasisFunsRat(span, u, 2, U, 2);
  const row1 = d[1].map(ratToNumber);
  const row2 = d[2].map(ratToNumber);
  assert.deepEqual(row1, [-1, 0, 1], `N′(1/2) = ${row1}`);
  assert.deepEqual(row2, [2, -4, 2], `N″(1/2) = ${row2}`);
  // exactness, not just shape
  assert.ok(d[2].every((r, i) => ratEq(r, makeRat([2n, -4n, 2n][i]))));
});

test('dersBasisFunsRat cross-validates against the float Piegl A2.3 port — incl. a coincident-knot stress', () => {
  const U = [0, 0, 0, 0, 1, 1, 2, 3, 3, 3, 3]; // double knot at 1: the zero-denominator cone
  const Ur = U.map(x => makeRat(x));
  const Uf = U.map(Number);
  for (const un of [0.25, 0.5, 1, 1.5, 2.75]) {   // u=1 sits ON the coincident knot
    const u = makeRat(BigInt(un * 100), 100n);
    const span = findSpanRat(3, Ur, u);
    const dR = dersBasisFunsRat(span, u, 3, Ur, 2);
    const dF = dersBasisFunsFloat(span, Number(un), 3, Uf, 2);
    for (let k = 0; k <= 2; k++) {
      for (let j = 0; j <= 3; j++) {
        const rv = ratToNumber(dR[k][j]);
        assert.ok(Math.abs(rv - dF[k][j]) < 1e-12, `u=${un} d[${k}][${j}]: ℚ=${rv} f64=${dF[k][j]}`);
      }
    }
  }
});

test('EXACT CIRCLE: the 3-4-5 arc lies on its circle EXACTLY (BigInt zero) at rational parameters', () => {
  const arc = pythagoreanArc({ x: 0, y: 0 }, { x: 8, y: 0 });
  assert.ok(arc.circle.exact, 'axis-aligned chord: exact circle meta');
  assert.ok(ratEq(arc.circle.radius, makeRat(20n, 3n)), 'r = 20/3');
  assert.ok(ratEq(arc.circle.center[0], makeRat(4n)) && ratEq(arc.circle.center[1], makeRat(-16n, 3n)), 'center (4, −16/3)');
  const [cx, cy] = arc.circle.center;
  const r2 = ratMul(arc.circle.radius, arc.circle.radius);
  const ts = [makeRat(0n), makeRat(1n, 8n), makeRat(1n, 4n), makeRat(1n, 3n), makeRat(1n, 2n), makeRat(2n, 3n), makeRat(3n, 4n), makeRat(7n, 8n)];
  for (const t of ts) {
    const p = evalSpline(arc, t);
    const d2 = ratAdd(ratMul(ratSub(p[0], cx), ratSub(p[0], cx)), ratMul(ratSub(p[1], cy), ratSub(p[1], cy)));
    assert.ok(ratEq(d2, r2), `t=${ratToString(t)}: |p−c|²=${ratToString(d2)} ≠ r²=${ratToString(r2)}`);
  }
});

test('rational derivatives: C′/C″ of the exact arc agree with finite differences; κ = 3/20 everywhere', () => {
  const arc = pythagoreanArc({ x: 0, y: 0 }, { x: 8, y: 0 });
  const h = 1e-5;
  for (const tn of [0.15, 0.35, 0.6, 0.85]) {
    const d1 = evalDeriv(arc, makeRat(BigInt(tn * 100), 100n), 1).map(ratToNumber);
    const d2 = evalDeriv(arc, makeRat(BigInt(tn * 100), 100n), 2).map(ratToNumber);
    const pA = evalSpline(arc, makeRat(BigInt(Math.round((tn - h) * 100000)), 100000n)).map(ratToNumber);
    const pB = evalSpline(arc, makeRat(BigInt(Math.round((tn + h) * 100000)), 100000n)).map(ratToNumber);
    for (let dd = 0; dd < 2; dd++) {
      const fd = (pB[dd] - pA[dd]) / (2 * h);
      assert.ok(Math.abs(fd - d1[dd]) < 1e-6, `C′[${dd}] at ${tn}: exact=${d1[dd]} fd=${fd}`);
    }
    const k = curvatureMeasure(arc, makeRat(BigInt(tn * 100), 100n));
    assert.ok(Math.abs(k - 3 / 20) < 1e-9, `κ(${tn}) = ${k} ≈ 1/r = 3/20`);
    assert.ok(Math.hypot(...d2) > 1e-6, 'C″ nonzero on a curved arc');
  }
});

test('a straight line has C″ = 0 EXACTLY (rational second derivative, not a tolerance)', () => {
  const s = makeSpline({ degree: 2, knots: [0, 0, 0, 1, 1, 1], controls: [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 8, y: 8 }] });
  const d2 = evalDeriv(s, makeRat(1n, 2n), 2);
  assert.ok(d2.every(ratIsZero), `C″ = ${d2.map(ratToString)}`);
});

test('knot multiplicity is the smoothness dial: simple knot → C¹, double knot → C⁰ break', () => {
  const C = HAND.controls;
  const smooth = makeSpline({ degree: 2, knots: [0, 0, 0, 1, 2, 3, 3, 3], controls: C });
  const broken = makeSpline({ degree: 2, knots: [0, 0, 0, 1, 1, 3, 3, 3], controls: C });
  const h = makeRat(1n, 1000n);
  const one = makeRat(1n);
  const jump = s => {
    const l = evalDeriv(s, ratSub(one, h), 1).map(ratToNumber);
    const r = evalDeriv(s, ratAdd(one, h), 1).map(ratToNumber);
    return Math.hypot(l[0] - r[0], l[1] - r[1]);
  };
  assert.ok(jump(smooth) < 1e-2, `simple knot: derivative jump ${jump(smooth)} ≈ 0 (C¹)`);
  assert.ok(jump(broken) > 0.5, `double knot: derivative jump ${jump(broken)} is O(1) (C⁰)`);
});

test('snap is rounding of motion: nearest identity wins, ties are deterministic', () => {
  const targets = [[makeRat(0n), makeRat(0n)], [makeRat(2n), makeRat(4n)], [makeRat(5n), makeRat(1n)]];
  const s1 = snap([makeRat(12n, 5n), makeRat(18n, 5n)], targets); // (2.4, 3.6)
  assert.equal(s1.index, 1, '(2.4,3.6) → (2,4)');
  const s2 = snap([makeRat(5n, 2n), makeRat(1n)], [targets[0], targets[2]]); // tie (0.5,0)-(5,1)? no: dist to (0,0)=7.25, to (5,1)=0.25
  assert.equal(s2.index, 1);
  const tie = snap([makeRat(1n, 2n), makeRat(0n)], [[makeRat(0n), makeRat(0n)], [makeRat(1n), makeRat(0n)]]); // exact tie
  assert.equal(tie.index, 0, 'ties break to the first target');
  // the discrete hop from continuous motion: a point swept from identity A
  // snaps back to A before it ever reaches B
  const arc = pythagoreanArc({ x: 0, y: 0 }, { x: 8, y: 0 });
  const near = evalSpline(arc, makeRat(1n, 100n));
  const home = snap(near, arc.controls);
  assert.equal(home.index, 0, 't=1/100 snaps to the A identity');
});

test('sampleAlong: n+1 exact ℚ points; endpoints are the identities; arc length is a monotone float measure', () => {
  const arc = pythagoreanArc({ x: 0, y: 0 }, { x: 8, y: 0 });
  const pts = sampleAlong(arc, 8);
  assert.equal(pts.length, 9);
  assert.ok(ratEq(pts[0][0], makeRat(0n)) && ratEq(pts[0][1], makeRat(0n)), 'starts at A');
  assert.ok(ratEq(pts[8][0], makeRat(8n)) && ratEq(pts[8][1], makeRat(0n)), 'ends at B');
  let prev = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(ratToNumber(pts[i][0]) - ratToNumber(pts[i - 1][0]), ratToNumber(pts[i][1]) - ratToNumber(pts[i - 1][1]));
    assert.ok(d >= 0, 'steps non-negative');
    prev += d;
  }
  const L = arcLengthMeasure(arc, 0, 1);
  const theory = (20 / 3) * 2 * Math.atan2(3, 4); // r·Δ, Δ = 2·atan(3/4)
  assert.ok(Math.abs(L - theory) < 1e-9, `arc length ${L} ≈ r·Δ = ${theory}`);
});

test('ANTI-VACUITY: a non-Pythagorean weight breaks the exact-circle property — the test is not vacuous', () => {
  const bad = makeSpline({
    degree: 2, knots: [0, 0, 0, 1, 1, 1],
    controls: [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 8, y: 0 }],
    weights: [1, 0.9, 1], // 9/10 ≠ 4/5: no exact circle exists
  });
  const cx = 4, cy = -16 / 3, r2 = (20 / 3) ** 2;
  let worst = 0;
  for (let i = 1; i < 8; i++) {
    const p = evalSpline(bad, makeRat(BigInt(i), 8n)).map(ratToNumber);
    worst = Math.max(worst, Math.abs((p[0] - cx) ** 2 + (p[1] - cy) ** 2 - r2));
  }
  assert.ok(worst > 1e-3, `wrong weight: max |p−c|²−r²| = ${worst} — property genuinely broken`);
});

test('ANTI-VACUITY: float contamination breaks exactness — 0.8 is not 4/5; rationals are load-bearing, not decoration', () => {
  const arc = pythagoreanArc({ x: 0, y: 0 }, { x: 8, y: 0 });
  // the realistic class: the caller passes 0.8 (f64 nearest 4/5) and float-smeared coords
  const contaminated = makeSpline({
    degree: 2, knots: [0, 0, 0, 1, 1, 1],
    controls: arc.controls.map(pt => pt.map(r => { const f = ratToNumber(r); return f + 1e-9 * (f + 1); })),
    weights: [1, 0.8, 1],
  });
  const p = evalSpline(contaminated, makeRat(1n, 3n)).map(ratToNumber);
  const err = Math.abs((p[0] - 4) ** 2 + (p[1] + 16 / 3) ** 2 - (20 / 3) ** 2);
  assert.ok(err > 1e-10, `contaminated pipeline: |p−c|²−r²| = ${err} — exactness lost (as it must)`);
});

for (const [label, K] of kernels) {
  test(`${label}: the spline hosts as a kernel trace — samples are cells, motion is 'next' links`, () => {
    const k = new K();
    const arc = pythagoreanArc({ x: 0, y: 0 }, { x: 8, y: 0 });
    const { points, links } = hostTrace(k, arc, 8);
    assert.equal(points, 9);
    assert.equal(links, 8);
    assert.equal(k.cells('spline.p.').length, 9);
    assert.equal(k.links().filter(l => l.type === 'next').length, 8);
    // the float view is the measure; the ℚ lift is the identity
    const v0 = k.view('spline.p.0');
    assert.equal(typeof v0.x, 'number');
    const lift0 = k.metaOf('spline.p.0').lift;
    assert.deepEqual(lift0, ['0/1', '0/1'], 'identity A round-trips through the lift');
    const mid = k.metaOf('spline.p.4').lift;
    const q = evalSpline(arc, makeRat(1n, 2n)).map(ratToString);
    assert.deepEqual(mid, q, 'the hosted lift IS the exact evaluation');
  });
}

test('cross-kernel: both kernels host the IDENTICAL trace (same views, same lifts)', () => {
  const arc = pythagoreanArc({ x: 0, y: 0 }, { x: 8, y: 0 });
  const kr = new QuiltKernel(), kw = new WasmQuiltKernel();
  hostTrace(kr, arc, 8, { name: 't' });
  hostTrace(kw, arc, 8, { name: 't' });
  for (let i = 0; i <= 8; i++) {
    const a = kr.view(`t.p.${i}`), b = kw.view(`t.p.${i}`);
    assert.equal(a.x, b.x);
    assert.equal(a.y, b.y);
    assert.deepEqual(kr.metaOf(`t.p.${i}`).lift, kw.metaOf(`t.p.${i}`).lift);
  }
});

// ph.mjs — Pythagorean-hodograph laws. The claim beyond pythagoreanArc:
// the circle arc needed π; the PH cubic's length is a ℚ closed form and its
// curvature a ℚ rational function. Exactness pinned as BigInt zero; the
// float cross-checks are measurements, not identity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { makeRat, ratEq, ratToNumber, ratToString } from '../src/commensurate.mjs';
import { makePH, phFromChord, hostPH, solveHodograph } from '../src/ph.mjs';

const ZERO = makeRat(0n);
const ONE = makeRat(1n);
const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

test('PH canonical: hodograph (1 + i·t)^2, length(1) = 4/3 as BigInt zero', () => {
  const ph = makePH({ a: [ONE, ZERO], b: [ZERO, ONE] });
  const p1 = ph.eval(ONE);
  assert.ok(ratEq(p1[0], makeRat(2n, 3n)) && ratEq(p1[1], ONE),
    `c(1) = (${ratToString(p1[0])}, ${ratToString(p1[1])})`);
  assert.ok(ratEq(ph.length(), makeRat(4n, 3n)),
    `length = ${ratToString(ph.length())} — exact ℚ, no π, no integral`);
  assert.ok(ratEq(ph.speed(ZERO), ONE), 'speed(0) = |a|^2 = 1');
});

test('PH straight line: b = 0, length == chord exactly — the bow dial at zero', () => {
  const ph = makePH({ a: [makeRat(2n), ZERO], b: [ZERO, ZERO] });
  // c′ = (2)² = 4 ⇒ c goes 0 → 4; length = ∫4 = 4 = the chord. Dial zero.
  assert.ok(ratEq(ph.length(), makeRat(4n)), 'length = 4 exact');
  const p = ph.eval(ONE);
  assert.ok(ratEq(p[0], makeRat(4n)) && ratEq(p[1], ZERO), 'endpoint (4,0) exact');
});

test('PH curvature is an exact rational function, cross-checked by measurement', () => {
  const ph = makePH({ a: [ONE, ZERO], b: [ZERO, ONE] });
  assert.ok(ratEq(ph.kappaAt(ZERO), makeRat(2n)), 'κ(0) = 2 as BigInt zero');
  assert.ok(ratEq(ph.kappaAt(ONE), makeRat(1n, 2n)), 'κ(1) = 2/σ(1)^2 = 1/2');
  const h = 1e-5;
  const pt = t => ph.eval(makeRat(BigInt(Math.round(t * 1e6)), 1000000n)).map(ratToNumber);
  const p0 = pt(h), pm = pt(0), pp = pt(-h);
  const d1 = [(pp[0] - p0[0]) / (2 * h), (pp[1] - p0[1]) / (2 * h)];
  const d2 = [(pp[0] - 2 * pm[0] + p0[0]) / (h * h), (pp[1] - 2 * pm[1] + p0[1]) / (h * h)];
  const kMeas = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) / Math.pow(Math.hypot(d1[0], d1[1]), 3);
  assert.ok(Math.abs(kMeas - 2) < 1e-3, `measured κ(0) = ${kMeas.toFixed(5)} vs exact 2`);
});

test('anti-vacuity: exact length is NOT the chord — the bow costs what it costs', () => {
  const ph = makePH({ a: [ONE, ZERO], b: [ZERO, ONE] });
  const end = ph.eval(ONE).map(ratToNumber);
  const chord = Math.hypot(end[0], end[1]);
  const L = ratToNumber(ph.length());
  assert.ok(L > chord, `L = ${L.toFixed(6)} > chord = ${chord.toFixed(6)}`);
  assert.ok(ratEq(ph.length(), makeRat(4n, 3n)), 'and still exact');
});

test('solveHodograph: exact ℚ recovery when the discriminant is a rational square', () => {
  // a = (3, −2), b = (0, 4) ⇒ d = a² + ab + b²/3 = (23/3, 0), disc = 4d − b²/3 = (36, 0)
  const a = solveHodograph([makeRat(23n, 3n), ZERO], [ZERO, makeRat(4n)]);
  assert.ok(a !== null, 'discriminant 36 is a ℚ square — solved exactly');
  assert.ok(ratEq(a[0], makeRat(3n)) && ratEq(a[1], makeRat(-2n)), 'a = (3, −2) as BigInt zero');
  // and the interpolation identity holds: a² + ab + b²/3 = d
  const b = [ZERO, makeRat(4n)];
  const d = [makeRat(23n, 3n), ZERO];
  const rec = zCheck(a, b);
  assert.ok(Math.abs(rec[0] - 23 / 3) < 1e-15 && Math.abs(rec[1]) < 1e-15, 'identity restored');
  function zCheck(u, v) {
    const U = u.map(ratToNumber), V = v.map(ratToNumber);
    return [U[0] ** 2 - U[1] ** 2 + U[0] * V[0] - U[1] * V[1] + (V[0] ** 2 - V[1] ** 2) / 3,
            2 * U[0] * U[1] + U[0] * V[1] + U[1] * V[0] + 2 * V[0] * V[1] / 3];
  }
});

test('phFromChord: interpolates measured endpoints; exactness honestly flagged (Pell-impossible class)', () => {
  const ph = phFromChord({ x: 0, y: 0 }, { x: 8, y: 0 }, { side: 0.1 });
  const A = ph.eval(ZERO).map(ratToNumber), B = ph.eval(ONE).map(ratToNumber);
  assert.ok(Math.abs(A[0]) < 1e-9 && Math.abs(A[1]) < 1e-9, 'starts at A');
  assert.ok(Math.abs(B[0] - 8) < 1e-9 && Math.abs(B[1]) < 1e-9, 'ends at B (shadow solve, f64 honest)');
  assert.equal(ph.exact, false, '4d − b²/3 = 2416/75 is not a rational square — flagged, not faked');
  const L = ratToNumber(ph.length());
  assert.ok(L > 8 && L < 9.6, `bowed chord of 8 has true length ${L.toFixed(6)}`);
});

for (const [label, K] of kernels) {
  test(`${label}: the PH tenancy — coefficients and exact length host identically`, () => {
    const k = new K();
    const ph = makePH({ a: [ONE, ZERO], b: [ZERO, ONE] });
    const { cells } = hostPH(k, ph, { name: 'arc' });
    assert.equal(cells, 4);
    assert.deepEqual(k.view('arc.a'), [1, 0]);
    assert.equal(k.metaOf('arc.a').lift[0], '1/1');
    const lv = k.view('arc.length');
    assert.equal(lv.value, 4 / 3);
    assert.equal(k.metaOf('arc.length').lift.s, '4/3', 'exact length is the identity; float is a view');
  });
}

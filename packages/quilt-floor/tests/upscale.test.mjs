// upscale.mjs — view super-resolution laws. Identity is the control
// polygon; views are denser samples; reconstruction error is exact ℚ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { makeRat, ratEq, ratIsZero, ratToNumber, ratToString } from '../src/commensurate.mjs';
import { makeSpline, pythagoreanArc } from '../src/spline.mjs';
import { upscaleView, chordalEnergy, polylineLengthView, refinementError, convergenceReport, hostUpscale, identityUntouched } from '../src/upscale.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

// the exact 3-4-5 circular arc: identity endpoints (0,0)→(8,0), T=(4,3)
const arc = () => pythagoreanArc([makeRat(0n), makeRat(0n)], [makeRat(8n), makeRat(0n)]);

test('upscaleView: densities are views; identity (the spline object) is never mutated', () => {
  const s = arc();
  const before = s.controls;
  const v4 = upscaleView(s, 4);
  const v8 = upscaleView(s, 8);
  assert.equal(v4.length, 5);
  assert.equal(v8.length, 9);
  assert.ok(identityUntouched(before, s), 'controls untouched after upscaling');
  assert.ok(v4.every(pt => pt.every(r => typeof r.num === 'bigint')), 'samples are ℚ lifts, not floats');
  // the view at density d passes through the same endpoints exactly
  assert.ok(ratEq(v8[0][0], makeRat(0n)) && ratEq(v8[0][1], makeRat(0n)));
  assert.ok(ratEq(v8[8][0], makeRat(8n)) && ratEq(v8[8][1], makeRat(0n)));
});

test('the ladder converges: chordal energy descends, refinement errors shrink, the length view rises toward truth', () => {
  const s = arc();
  const rep = convergenceReport(s, [4, 8, 16, 32]);
  const energies = rep.views.map(v => v.energy);
  for (let i = 1; i < energies.length; i++)
    assert.ok(energies[i].num * energies[i - 1].den < energies[i - 1].num * energies[i].den, `energy descends ${ratToString(energies[i - 1])} → ${ratToString(energies[i])}`);
  const errs = rep.steps.map(st => st.error);
  for (let i = 1; i < errs.length; i++)
    assert.ok(errs[i - 1].num * errs[i].den > errs[i].num * errs[i - 1].den, `error ${ratToString(errs[i - 1])} → ${ratToString(errs[i])} strictly shrinks`);
  assert.ok(errs.every(e => e.num !== 0n), 'each step is a measurable rat — convergence you can watch digit by digit');
  // the true LENGTH is a declared view with an exact residue — never identity;
  // unlike the energy, the length view RISES toward the true arc length
  const l4 = polylineLengthView(upscaleView(s, 4));
  const l8 = polylineLengthView(upscaleView(s, 8));
  const l64 = polylineLengthView(upscaleView(s, 64));
  assert.ok(l4.approx < l8.approx && l8.approx < l64.approx, 'the length view climbs toward the true arc');
  assert.ok(l64.approx > 8 && l64.approx < 9.5, `arc length view ${l64.approx.toFixed(4)} in the sane band (chord 8, true ≈ 8.58)`);
  for (const lv of [l4, l8, l64]) {
    assert.equal(lv.exact, false, 'irrational pieces ⇒ the length has no exact rational identity');
    assert.ok(ratToNumber(lv.residue) > 0, 'residue is a positive exact rat: the view admits its own gap');
  }
});

test('refinementError: fine must exceed coarse; energy rises with density', () => {
  const s = arc();
  const r = refinementError(s, 8, 16);
  assert.ok(r.energyFalling, 'refining a gentle arc lowers chordal energy (−2·u·v per split)');
  assert.ok(r.error.num > 0n);
  assert.throws(() => refinementError(s, 16, 8), /fine density must exceed/);
  assert.throws(() => refinementError(s, 8, 8), /fine density must exceed/);
});

test('anti-vacuity: density 1 is the chord itself; the chord never pretends to be the arc', () => {
  const s = arc();
  const d1 = upscaleView(s, 1);
  assert.equal(d1.length, 2, 'density 1 = two endpoints = the chord');
  assert.ok(ratEq(chordalEnergy(d1), makeRat(64n)), 'chord² = 64 exactly — the lazy one-leap maximum');
  const e8 = chordalEnergy(upscaleView(s, 8));
  assert.ok(e8.num * 1n < 64n * e8.den, 'any real view spends LESS energy than the chord — refinement pays the arc in honest installments');
});

for (const [label, K] of kernels) {
  test(`${label}: hosted upscale — views carry lifts, link upscaleOf → identity, identity cell is singular`, () => {
    const k = new K();
    const s = arc();
    const { identity, views, links } = hostUpscale(k, s, { name: 'arc', densities: [4, 8] });
    assert.equal(identity, 1);
    assert.equal(views, 2);
    assert.equal(links, 2);
    const idMeta = k.metaOf('arc.identity');
    assert.match(idMeta.what, /never touches this cell/);
    assert.equal(k.view('arc.identity').length, 3, 'quadratic: 3 control points');
    assert.deepEqual(k.view('arc.identity')[1], [4, 3], 'T = (4,3) the exact 3-4-5 tangent point');
    assert.equal(idMeta.lift[1][0], '4/1', 'lift strings pinned');
    const v = k.metaOf('view.arc.d8');
    assert.match(v.what, /never identity/);
    assert.equal(v.density, 8);
    assert.equal(v.lift.length, 9);
    const l = k.links().find(x => x.type === 'upscaleOf' && x.from === 'view.arc.d8');
    assert.equal(l.to, 'arc.identity', 'view → identity direction is pinned');
    // the identity cell is the ONLY identity: views do not mint new ones
    const names = k.cells('');
    assert.ok(names.includes('arc.identity'));
    assert.ok(!names.includes('arc.identity.2'), 'no identity minted by views');
  });
}

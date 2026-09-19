// q16.mjs — ℚ¹⁶ breed trajectory laws. The four anchors pinned: quilt-cell
// Q1.15 lifts (six languages, one ℚ), velocity/displacement exact, norms
// honest float measures, commensuration verdicts BigInt-exact, both kernels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { makeRat, ratEq, ratToNumber, ratIsZero, floatToRat } from '../src/commensurate.mjs';
import {
  DIM, liftQ15, liftQ15Vector, makeTraj,
  displacement, velocity, norm, arcLen, commensurateStep, breedSignature, hostTraj,
} from '../src/q16.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];
const R = (n, d = 1) => makeRat(BigInt(n), BigInt(d));

// a Q1.15 dial value: dial 546 (year) = 546/32768
test('liftQ15: the six-language substrate lands on identical ℚ (dyadic exactness)', () => {
  const r = liftQ15(546);
  assert.ok(ratEq(r, R(546, 32768)), '546/32768 exact');
  const v = liftQ15Vector(Array(DIM).fill(0).map((_, i) => i * 218));
  assert.equal(v.length, DIM);
  assert.ok(ratEq(v[1], R(218, 32768)));
  assert.throws(() => liftQ15Vector([1, 2, 3]), /need 16/);
});

test('velocity and displacement are exact ℚ¹⁶; still dials are exact zeros', () => {
  const a = liftQ15Vector(Array(DIM).fill(100));
  const b = liftQ15Vector(Array(DIM).fill(100));
  b[3] = liftQ15(164); // dial 3 moved by 64/32768 = 1/512
  const traj = makeTraj([a, b]);
  const v = velocity(traj, 1);
  assert.ok(v.every((r, i) => i === 3 ? ratEq(r, R(1, 512)) : ratIsZero(r)),
    'one dial moved by exactly 1/512, rest still');
  assert.ok(displacement(a, a).every(ratIsZero), 'identical states: zero displacement');
});

test('norm and arcLen are float measures; a still trajectory measures zero', () => {
  const a = liftQ15Vector(Array(DIM).fill(0));
  const b = liftQ15Vector(Array(DIM).fill(0));
  b[0] = liftQ15(32768); // dial 0 at full scale = 1
  const traj = makeTraj([a, b]);
  assert.equal(norm(velocity(traj, 1)), 1, 'single unit dial ⇒ norm 1');
  assert.equal(arcLen(traj), 1);
  const still = makeTraj([a, a, a]);
  assert.equal(arcLen(still), 0, 'no motion, no length');
});

test('commensurateStep: lattice-exact quanta + the 3/2 breed ratio as BigInt zeros', () => {
  const a = liftQ15Vector(Array(DIM).fill(0));
  a[3] = liftQ15(16384); // dial 3 at 1/2 scale
  const b = a.slice();
  b[3] = liftQ15(24576); // moved to 3/4 scale — velocity 1/4, ratio 3/2
  b[4] = liftQ15(100);   // fresh dial from 0 — ratio undefined (no self to compare)
  const traj = makeTraj([a, b]);
  const step = commensurateStep(traj, 1, { maxDen: 20 });
  const d3 = step[3];
  assert.equal(d3.onLattice, true, 'velocity is an integral number of quanta');
  assert.equal(d3.quanta, 8192n, '1/4 scale = 8192 quanta exactly');
  assert.ok(d3.ratio && d3.ratio.commensurate, 'the dial moved by exactly 3/2 of itself');
  assert.ok(ratEq(d3.ratio.rat, R(3, 2)));
  assert.ok(ratIsZero(d3.ratio.error), 'BigInt zero — no tolerance anywhere');
  assert.equal(step[4].ratio, null, 'a fresh dial has no self-ratio — law stays silent, not wrong');
  assert.equal(step[0].still, true);
});

test('anti-vacuity: a wild dial move is flagged with EXACT nonzero error, not smoothed over', () => {
  const a = liftQ15Vector(Array(DIM).fill(0));
  a[5] = liftQ15(100); // dial 5 at 100/32768
  const b = a.slice();
  b[5] = liftQ15(173); // ratio 173/100 — incommensurate at maxDen 20
  const traj = makeTraj([a, b]);
  const step = commensurateStep(traj, 1, { maxDen: 20 });
  const d5 = step[5];
  assert.equal(d5.onLattice, true, 'still on the lattice — wildness is in the RATIO, not the bytes');
  assert.equal(d5.ratio.commensurate, false);
  assert.ok(!ratIsZero(d5.ratio.error), 'exact rational error reported, never rounded away');
  // but with the true denominator allowed, it IS exact
  const wide = commensurateStep(traj, 1, { maxDen: 100 });
  assert.equal(wide[5].ratio.commensurate, true, 'the dial is honest Q1.15 — the smallness bound was the question');
});

test('breedSignature: a run mixing lattice steps and one wild measured dial', () => {
  const t0 = liftQ15Vector(Array(DIM).fill(0));
  const t1 = liftQ15Vector(Array(DIM).fill(64)); // all dials +1/512 — a lattice breed tick
  const t2 = t1.slice();
  t2[7] = floatToRat(0.3); // one float-measured dial (dyadic shadow of a wild value)
  const sig = breedSignature(makeTraj([t0, t1, t2]), { maxDen: 20 });
  assert.equal(sig.length, 2);
  assert.ok(sig[0].every(s => s.still || (s.onLattice && (!s.ratio || s.ratio.commensurate))), 'tick 1 is fully lattice-commensurate');
  const dial7 = sig[1][7];
  assert.equal(dial7.onLattice, false, 'the measured dial is OFF the Q1.15 lattice — flagged, not faked');
});

for (const [label, K] of kernels) {
  test(`${label}: the trajectory hosts — ticks are cells with ℚ lift identity, chained by evolves`, () => {
    const k = new K();
    const t0 = liftQ15Vector(Array(DIM).fill(0));
    const t1 = liftQ15Vector(Array(DIM).fill(64));
    const traj = makeTraj([t0, t1]);
    const { cells, links } = hostTraj(k, traj, { name: 'breed' });
    assert.equal(cells, 2);
    assert.equal(links, 1);
    const view = k.view('breed.t1');
    assert.equal(view.length, DIM);
    assert.ok(Math.abs(view[0] - 64 / 32768) < 1e-18, 'float view of dial 0');
    const lift = k.metaOf('breed.t1').lift;
    assert.equal(lift.length, DIM);
    assert.equal(lift[0], '1/512', 'the ℚ identity is the meta, the float is the view');
    const l = k.links().find(x => x.type === 'evolves');
    assert.equal(l.from, 'breed.t0');
    assert.equal(l.to, 'breed.t1');
  });
}

// frames.mjs — temporal super-resolution laws. Clean-room from the DLSS 5
// concept map; every exactness claim pinned as BigInt zero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { makeRat, ratEq, ratIsZero, ratToNumber, ratToString } from '../src/commensurate.mjs';
import { liftQ15, liftQ15Vector, makeTraj } from '../src/q16.mjs';
import { hermiteLegs, evalLeg, genFrames, smoothFrames, detailOnly, hostFrames } from '../src/frames.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];
const DIM = 16;
const zeros = () => liftQ15Vector(Array(DIM).fill(0));

// three states, gentle motion: dial 0 walks 0 → 1/2 → 1 (Q1.15: 0 → 16384 → 32768)
const T3 = () => {
  const a = zeros(), b = zeros(), c = zeros();
  a[0] = liftQ15(0); b[0] = liftQ15(16384); c[0] = liftQ15(32768);
  b[1] = liftQ15(8192); c[1] = liftQ15(16384);
  return makeTraj([a, b, c]);
};

test('hermiteLegs: legs pass through both endpoints exactly; knot velocity is the central difference', () => {
  const traj = T3();
  const { legs, kinks } = hermiteLegs(traj);
  assert.equal(legs.length, 2);
  // leg 0 at τ=0 and τ=1
  assert.ok(evalLeg(legs[0], 0).every((r, i) => ratEq(r, traj.vectors[0][i])));
  assert.ok(evalLeg(legs[0], 1).every((r, i) => ratEq(r, traj.vectors[1][i])));
  // interior control: C_0 = P_0 + d_0/2, d_0 forward = (16384)/32768 = 1/2 on dial 0
  assert.ok(ratEq(legs[0].ctrl[0], makeRat(8192n, 32768n)), 'ctrl dial 0 = 1/4');
  // central knot velocity at b: (c−a)/2 = 1/2 on dial 0
  assert.ok(ratEq(legs[1].d0[0], makeRat(16384n, 32768n)), 'central velocity 1/2');
  // this gentle walk is quadratic ⇒ velocity continuous ⇒ zero kinks
  assert.ok(kinks.every(k => ratIsZero(k.gapSq)), 'quadratic record has no kinks — no shimmer to suppress');
});

test('genFrames: factor 2 → observed ticks exact (ratEq), generated frames flagged as views', () => {
  const frames = genFrames(T3(), { factor: 2 });
  assert.equal(frames.length, 2 * 2 + 1); // (n−1)·factor + 1
  const at = t => frames.find(f => f.t === t);
  assert.ok(at(0).observed && at(0).exact);
  assert.ok(at(1).observed && at(1).exact);
  assert.ok(at(2).observed && at(2).exact);
  assert.ok(at(0.5).observed === false && at(0.5).exact === false, 'generated frame is a view, never identity');
  // the observed frame at t=1 IS the record state — BigInt zero difference
  assert.ok(at(1).state.every((r, i) => ratEq(r, T3().vectors[1][i])));
  // leg 0: P=0, d=Q−P=(1/2,1/4), C=d/2 ⇒ B(1/2) = ½C + ¼Q = (1/4, 1/8)
  assert.ok(ratEq(at(0.5).state[0], makeRat(8192n, 32768n)), 'dial 0 midpoint = 1/4');
  assert.ok(ratEq(at(0.5).state[1], makeRat(4096n, 32768n)), 'dial 1 midpoint = 1/8');
});

test('anti-vacuity: factor 1 returns the record itself, no invented frames', () => {
  const frames = genFrames(T3(), { factor: 1 });
  assert.equal(frames.length, 3);
  assert.ok(frames.every(f => f.observed && f.exact));
});

test('smoothFrames: leg-local diffusion kills jitter energy; the record and straight legs are untouched', () => {
  // a jittery record: dial 0 alternates (big kinks = shimmer source)
  const a = zeros(), b = zeros(), c = zeros(), d = zeros();
  b[0] = liftQ15(8192);   // +1/4
  c[0] = liftQ15(0);      // −1/4 (jitter!)
  d[0] = liftQ15(8192);   // +1/4 (jitter!)
  const traj = makeTraj([a, b, c, d]);
  const { kinks } = hermiteLegs(traj);
  assert.ok(kinks.some(k => !ratIsZero(k.gapSq)), 'this record HAS shimmer (nonzero kinks)');
  const frames = genFrames(traj, { factor: 2 }); // 7 frames, 3 generated views
  const smoothed = smoothFrames(frames, { passes: 1 });
  // every observed tick exact against the record
  assert.ok(smoothed[0].state.every((r, i) => ratEq(r, a[i])), 'anchor pinned');
  assert.ok(smoothed[2].state.every((r, i) => ratEq(r, b[i])), 'observed tick is the record');
  assert.ok(smoothed[4].state.every((r, i) => ratEq(r, c[i])));
  assert.ok(smoothed[6].state.every((r, i) => ratEq(r, d[i])));
  // flags: only generated views smoothed
  assert.deepEqual(smoothed.map(f => f.smoothed), [false, true, false, true, false, true, false]);
  // total velocity energy strictly drops
  const vel = fs => fs.slice(1).map((f, i) => f.view[0] - fs[i].view[0]);
  const e0 = vel(frames).reduce((s, v) => s + v * v, 0);
  const e1 = vel(smoothed).reduce((s, v) => s + v * v, 0);
  assert.ok(e1 < e0, `shimmer energy ${e0} → ${e1}`);
  // anti-vacuity: a straight record is a FIXED POINT — smoothing changes nothing
  const gentle = genFrames(T3(), { factor: 2 });
  const gentleSmoothed = smoothFrames(gentle, { passes: 3 });
  assert.ok(gentleSmoothed.every((f, i) => f.state.every((r, d2) => ratEq(r, gentle[i].state[d2]))),
    'straight legs are diffusion fixed points');
});

test('detailOnly: pinned global dials exact-copied (BigInt zero delta), structural dials mutate', () => {
  const prev = zeros(); prev[0] = liftQ15(10000); prev[1] = liftQ15(5000);
  const next = prev.slice(); next[0] = liftQ15(9999); next[1] = liftQ15(9000);
  const out = detailOnly(prev, next, { pin: [0] });
  assert.ok(ratEq(out[0], prev[0]), 'pinned dial: exact copy (ratEq IS the BigInt cross-product)');
  assert.ok(ratEq(out[1], next[1]), 'structural dial takes the mutation');
});

for (const [label, K] of kernels) {
  test(`${label}: the frame sequence hosts — cells are views with ℚ lifts, chained by follows`, () => {
    const k = new K();
    const frames = genFrames(T3(), { factor: 2 });
    const { cells, links } = hostFrames(k, frames, { name: 'movie' });
    assert.equal(cells, 5);
    assert.equal(links, 4);
    assert.equal(k.metaOf('movie.f0').what, 'observed tick t=0');
    assert.match(k.metaOf('movie.f1').what, /generated view/, 'generated frames say what they are');
    assert.match(k.metaOf('movie.f1').what, /never identity/);
    const l = k.links().find(x => x.type === 'follows');
    assert.equal(l.from, 'movie.f0');
    assert.equal(l.to, 'movie.f1');
  });
}

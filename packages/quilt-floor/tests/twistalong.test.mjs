// B2 — twist along an arc: the seam where the analogue spline meets the
// twist instrument. The rotation center glides along the curve; the laws
// must carry. Tolerances are measured (probe run 2026-09-19), not invented:
//   • per-point cloud tracks R to ≤0.35% at EVERY station, θ ≤ 2°
//     (measured max 0.344% at the off-disk station);
//   • the naive ⟨r²⟩ moment form degrades to 15.7% at the same station —
//     pinned as an anti-vacuity proof that the per-point form is load-bearing;
//   • the fingerprint reproduces about a moving center (devs grow 3°→6°).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { Multigrid } from '../src/multigrid.mjs';
import { twistFieldFrom, twistAlongArc } from '../src/twistfield.mjs';
import { makeSpline, hostTrace, sampleAlong } from '../src/spline.mjs';
import { makeRat, ratToNumber } from '../src/commensurate.mjs';

const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];
const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];
const seat = () => twistFieldFrom(new Multigrid({ N: 5, gamma: GENERIC, reach: 8 }), 2.1);

// a gentle seam crossing the core disk: total tangent turn stays small,
// stations spread across the alignment field
const seam = () => makeSpline({
  degree: 2, knots: [0, 0, 0, 1, 1, 1],
  controls: [{ x: -1.5, y: -0.6 }, { x: 0, y: 0.3 }, { x: 1.5, y: 0.6 }],
});

test('center equivariance: rotation about the origin recovers registration(θ) bit-for-bit', () => {
  const tf = seat();
  for (const a of [0.5, 1, 2, 4]) {
    assert.equal(tf.registrationAbout([0, 0], a), tf.registration(a), `θ=${a}°`);
  }
});

test('the cloud law carries to ANY station: R about a moving center tracks the per-point cloud to 0.5% in the twist regime', () => {
  const tf = seat();
  for (const st of [[0, 0], [0.75, 0], [1.5, 0], [2.5, 0]]) {
    for (const th of [0.5, 1, 2]) {
      const R = tf.registrationAbout(st, th);
      const pred = tf.cloudAbout(st, th);
      const dev = Math.abs(R - pred) / pred;
      assert.ok(dev < 0.005, `c=(${st}) θ=${th}°: dev ${(dev * 100).toFixed(3)}% (probe max 0.344%)`);
    }
  }
});

test('ANTI-VACUITY: the naive ⟨r²⟩ moment form fails off-center (15.7% measured) — the per-point cloud is load-bearing', () => {
  const tf = seat();
  // near the centroid the moment form still works (0.89% at 2°)…
  const nearDev = Math.abs(tf.registrationAbout([0, 0], 2) - tf.cloudLawAbout([0, 0], 2)) / tf.cloudLawAbout([0, 0], 2);
  assert.ok(nearDev < 0.01, `near-center moment form dev ${(nearDev * 100).toFixed(2)}%`);
  // …but at the off-disk station it is catastrophically wrong, while the
  // per-point form still tracks (0.344%). The Jensen gap is geometry, and
  // it is exactly why the seam law must be per-point.
  const farMomentDev = Math.abs(tf.registrationAbout([2.5, 0], 2) - tf.cloudLawAbout([2.5, 0], 2)) / tf.cloudLawAbout([2.5, 0], 2);
  assert.ok(farMomentDev > 0.05, `off-center moment form dev ${(farMomentDev * 100).toFixed(1)}% — the naive law genuinely fails`);
  const farCloudDev = Math.abs(tf.registrationAbout([2.5, 0], 2) - tf.cloudAbout([2.5, 0], 2)) / tf.cloudAbout([2.5, 0], 2);
  assert.ok(farCloudDev < 0.005, `off-center per-point cloud dev ${(farCloudDev * 100).toFixed(3)}%`);
});

test('the alignment budget along a straight march: R decays strictly as the station leaves the cloud', () => {
  const tf = seat();
  let prev = Infinity;
  for (let x = 0; x <= 2.5001; x += 0.25) {
    const R = tf.registrationAbout([x, 0], 1);
    assert.ok(R < prev, `non-monotone at x=${x.toFixed(2)}`);
    prev = R;
  }
  assert.ok(tf.registrationAbout([2.5, 0], 1) < tf.registrationAbout([0, 0], 1) * 0.9, 'the budget shrinks off-center (ratio 0.86 measured at 1°)');
  assert.ok(tf.registrationAbout([2.5, 0], 2) < tf.registrationAbout([0, 0], 2) * 0.6, 'halved by the rim at 2° (ratio 0.60 measured)');
});

test('the fingerprint reproduces about a moving center: deviation UP from the cloud law, growing 3°→6°', () => {
  const tf = seat();
  for (const st of [[0, 0], [0.9, 0.3]]) {
    const devs = [3, 4, 5, 6].map(a => tf.registrationAbout(st, a) - tf.cloudAbout(st, a));
    assert.ok(devs[0] > 0, `cross-alignment must be positive beyond the twist regime (c=${st})`);
    for (let i = 1; i < devs.length; i++) assert.ok(devs[i] > devs[i - 1], `fingerprint not growing: ${devs}`);
  }
});

test('twistAlongArc: the seam pipeline — R(s) follows the per-point cloud at every station', () => {
  const mg = new Multigrid({ N: 5, gamma: GENERIC, reach: 8 });
  const { tf, samples } = twistAlongArc(mg, seam(), { n: 8, thetaDeg: 1 });
  assert.equal(samples.length, 9);
  for (const row of samples) {
    const dev = Math.abs(row.R - row.cloud) / row.cloud;
    assert.ok(dev < 0.005, `station ${row.i} (${row.x.toFixed(3)}, ${row.y.toFixed(3)}): dev ${(dev * 100).toFixed(3)}%`);
  }
  // arc-length indexing is monotone and ends near the chord length (sagitta small)
  const last = samples[samples.length - 1];
  assert.ok(last.len > 3.20 && last.len < 3.30, `measured seam length ${last.len} (chord √10.44 = 3.231, sagitta small)`);
  assert.ok(tf.points.length > 50, 'instrument seated on the floor');
});

for (const [label, K] of kernels) {
  test(`${label}: the FULL SEAM LOOP — spline hosts in the kernel, the instrument reads it back, and the ℚ lift is the identity`, () => {
    const k = new K();
    const C = seam();
    const { points, links } = hostTrace(k, C, 8, { name: 'seam' });
    assert.equal(points, 9);
    assert.equal(links, 8);
    const tf = seat();
    // stations read back from the hosted trace (floats only measure)…
    const fromHost = [];
    for (let i = 0; i <= 8; i++) {
      const v = k.view(`seam.p.${i}`);
      fromHost.push([v.x, v.y]);
    }
    // …and from the ℚ lift (the identity round-trips through the lift)
    const fromLift = [];
    for (let i = 0; i <= 8; i++) {
      const lift = k.metaOf(`seam.p.${i}`).lift;
      fromLift.push(lift.map(str => {
        const [n, d] = str.split('/').map(BigInt);
        return ratToNumber(makeRat(n, d));
      }));
    }
    const direct = sampleAlong(C, 8).map(pt => pt.map(ratToNumber));
    for (let i = 0; i <= 8; i++) {
      assert.equal(fromHost[i][0], direct[i][0], `station ${i} x identical (host vs ℚ sampling)`);
      assert.equal(fromHost[i][1], direct[i][1], `station ${i} y identical`);
      assert.equal(fromLift[i][0], direct[i][0], `station ${i} x identical (lift vs ℚ sampling)`);
      const R_host = tf.registrationAbout(fromHost[i], 1);
      const R_lift = tf.registrationAbout(fromLift[i], 1);
      const R_dir = tf.sampleAlong(C, { n: 8, thetaDeg: 1 })[i].R;
      assert.equal(R_host, R_dir, `station ${i}: instrument on the hosted trace == direct (bit-for-bit)`);
      assert.equal(R_lift, R_dir, `station ${i}: instrument on the lift == direct`);
    }
  });
}

test('cross-kernel: both substrates return the same R(s) along the seam', () => {
  const C = seam();
  const kr = new QuiltKernel(), kw = new WasmQuiltKernel();
  hostTrace(kr, C, 8, { name: 's' });
  hostTrace(kw, C, 8, { name: 's' });
  const tf = seat();
  for (let i = 0; i <= 8; i++) {
    const a = kr.view(`s.p.${i}`), b = kw.view(`s.p.${i}`);
    assert.equal(a.x, b.x);
    assert.equal(a.y, b.y);
    assert.equal(tf.registrationAbout([a.x, a.y], 1), tf.registrationAbout([b.x, b.y], 1));
  }
});

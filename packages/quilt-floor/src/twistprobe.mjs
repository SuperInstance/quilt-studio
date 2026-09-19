// TwistProbe — the honest comb re-probe.
//
// Standing question (2026-09-17 notes): two comb claims were killed by the
// first probe — fine magic-window teeth in 0–1° (smooth at 0.02°), and
// large-θ commensuration peaks (swamped by disk-rim artifacts beyond
// σ/r_max ≈ 2.2°). The re-probe weapon is the RESIDUAL instrument:
//
//   residual(θ) = R(θ) / cloudLaw(θ)
//
// The cloud law is the universal smooth background (rotated cloud's
// self-alignment, verified to 0.06% at 1°). Dividing it out leaves the
// lattice's own rotational fingerprint: residual ≈ 1 where only self-
// alignment operates; residual ≫ 1 where rotated vertices land near OTHER
// vertex species — cross-alignment, the commensuration tooth.
//
// Two honest anchors:
//   • UNIFORM γ (the multigrid default): the line arrangement is exactly
//     36°-symmetric about the origin — rotation by 36° maps the vertex set
//     onto ITSELF, so R(36°) = 1 exactly and residual(36°) = 1/cloud is
//     enormous. This is the verified exact tooth the probe must find.
//   • GENERIC γ: no exact symmetry; the probe reports what teeth survive,
//     their radius-stability (real lattice property vs rim artifact), and
//     their best rational matches θ ≈ p/q · 36°.
//
// Nothing here rewrites TwistField's pinned laws — it composes them.

// residual curve: R, the cloud prediction, and the quotient, over a range.
export function residualCurve(tf, { fromDeg = 0.15, toDeg = 36, stepDeg = 0.1 } = {}) {
  const out = [];
  for (let a = fromDeg; a <= toDeg + 1e-12; a += stepDeg) {
    const R = tf.registration(a);
    const cloud = tf.cloudLaw(a);
    out.push({ theta: +a.toFixed(6), R, cloud, residual: R / cloud });
  }
  return out;
}

// comb teeth on any curve column, twist's window discipline VERBATIM
// (app.js:219-231): local maxima, ABSOLUTE prominence ≥ minProminence vs the
// trough within ±troughSamples, merge-ascending within 5 samples.
//
// COLUMN HONESTY (re-probe finding, 2026-09-20):
//   • 'R' — the honest large-θ instrument. twist runs on R/S directly with
//     absolute prominence; the floor's commensuration comb lives here.
//   • 'residual' — ONLY honest in the twist regime (θ ≲ 2°), where the
//     cloud law is the verified smooth background. Beyond it the cloud's
//     exponential decay beats R's local structure — the ratio smears every
//     tooth into the background. Fine-structure questions divide; comb
//     questions read R.
// BOUNDARY DISCIPLINE: a peak at the scan's edge is invisible by design —
// scans must BRACKET the candidate.
export function combTeeth(curve, {
  column = 'R', minProminence = 0.006, troughSamples = 22,
  minValue = 0, // absolute floor — twist's rule has no relative minimum
} = {}) {
  const ys = curve.map(r => r[column]);
  const teeth = [];
  for (let i = 2; i < ys.length - 2; i++) {
    const v = ys[i];
    if (!(v > minValue && v > ys[i - 1] && v > ys[i + 1] && v > ys[i - 2] && v > ys[i + 2])) continue;
    let trough = Infinity;
    for (let j = Math.max(0, i - troughSamples); j <= Math.min(ys.length - 1, i + troughSamples); j++)
      if (ys[j] < trough) trough = ys[j];
    const prominence = v - trough;
    if (prominence < minProminence) continue;
    const last = teeth[teeth.length - 1];
    if (last && i - last.i <= 5) {
      if (v > last.value) { teeth[teeth.length - 1] = { i, theta: curve[i].theta, value: v, prominence }; }
    } else teeth.push({ i, theta: curve[i].theta, value: v, prominence });
  }
  return teeth;
}

// best rational matches θ ≈ (p/q) · period for q ≤ maxQ — the
// commensuration hypothesis checker. Reports error in degrees; a tooth is
// only "rational" if errDeg is within the probe's angular resolution.
export function bestRational(thetaDeg, { period = 36, maxQ = 60, top = 3 } = {}) {
  const cands = [];
  for (let q = 1; q <= maxQ; q++) {
    const p = Math.round(thetaDeg * q / period);
    if (p < 1) continue;
    const t = period * p / q;
    cands.push({ p, q, theta: t, errDeg: Math.abs(t - thetaDeg) });
  }
  cands.sort((a, b) => a.errDeg - b.errDeg);
  return cands.slice(0, top);
}

// radius stability: run the same probe at several viewport radii. A real
// lattice tooth survives (height within tolerance) across radii; a rim
// artifact scales with the rim and does not. Returns per-theta agreement.
export function radiusStability(mkField, radii, probeOpts = {}) {
  const perRadius = radii.map(r => {
    const tf = mkField(r);
    return { radius: r, teeth: combTeeth(residualCurve(tf, probeOpts), probeOpts) };
  });
  // group teeth by theta (± step) across radii
  const groups = [];
  for (const { radius, teeth } of perRadius) {
    for (const t of teeth) {
      const g = groups.find(g => Math.abs(g.theta - t.theta) <= (probeOpts.stepDeg ?? 0.1) * 1.5);
      if (g) { g.heights.push({ radius, value: t.value }); g.theta = (g.theta + t.theta) / 2; }
      else groups.push({ theta: t.theta, heights: [{ radius, value: t.value }] });
    }
  }
  return {
    perRadius,
    stable: groups.filter(g => g.heights.length >= Math.min(2, radii.length)),
    coverage: groups.map(g => ({ theta: g.theta, radii: g.heights.length })),
  };
}

// The historical-claim checker: the "16/57 ≈ 1/φ" comb from the earlier
// notes, re-probed mechanically. Given a curve, measure the residual at
// θ* = 36 · p/q and report tooth-or-not with the best rational matches —
// the number is recorded, whatever it says.
export function claimCheck(curve, p, q, { period = 36, windowSamples = 3 } = {}) {
  const thetaStar = period * p / q;
  let best = null;
  for (const row of curve) {
    if (!best || Math.abs(row.theta - thetaStar) < Math.abs(best.theta - thetaStar)) best = row;
  }
  const i = curve.indexOf(best);
  const near = curve.slice(Math.max(0, i - windowSamples), i + windowSamples + 1);
  const isLocalMax = near.every(r => r.residual <= best.residual);
  return {
    claim: `${p}/${q} of ${period}° = ${thetaStar.toFixed(4)}°`,
    measured: { theta: best.theta, residual: best.residual, R: best.R, cloud: best.cloud },
    isLocalMax,
    nearestSampledDeg: Math.abs(best.theta - thetaStar),
    rationals: bestRational(best.theta, { period }),
  };
}

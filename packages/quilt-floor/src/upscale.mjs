// upscale.mjs — view super-resolution, the VSR concept clean-room.
//
// DLSS upscales pixels; the game's identity (state) never changes. The
// floor version: a spline's IDENTITY is its control polygon (ℚ rats, the
// lift). Upscaling mints DENSER VIEWS of the same identity.
//
// The measurement law, stated honestly: most sampled chord distances are
// NOT exact square roots — so the module splits the metric in two:
//   chordalEnergy — Σ|Δ|², EXACT for every density, the ladder metric;
//   polylineLengthView — the true LENGTH as a declared float VIEW with its
//     RESIDUE (len² − Σd²) kept as an exact rat. The approximation is a
//     view; the residue is the truth. (The floor way: floats are views.)
//
// Honest law (twice pinned): upscaled views are cells; the identity cells
// (control points) are never touched by upscaling — never mutated, never
// re-created. 'upscaleOf' links point FROM view TO identity.

import { makeRat, ratAdd, ratSub, ratMul, ratToNumber, ratToString, floatToRat } from './commensurate.mjs';
import { sampleAlong } from './spline.mjs';

const ZERO = makeRat(0n);

const dSq = (a, b) => {
  let s = ZERO;
  for (let i = 0; i < a.length; i++) {
    const d = ratSub(a[i], b[i]);
    s = ratAdd(s, ratMul(d, d));
  }
  return s;
};

// chordalEnergy(samples) — Σ|Δᵢ|². EXACT at every density; the ladder
// metric. Refinement SPLITS each step u+v into u, v: the energy change is
// |u|²+|v|² − |u+v|² = −2·u·v, so on a gentle curve (turn < 90° per step)
// the ladder DESCENDS toward zero and its steps shrink — convergence you
// can watch digit by digit, with zero approximation anywhere. The chord
// (density 1) is the lazy maximum: it spends the whole budget in one leap.
export function chordalEnergy(samples) {
  let E = ZERO;
  for (let i = 1; i < samples.length; i++) E = ratAdd(E, dSq(samples[i - 1], samples[i]));
  return E;
}

// polylineLengthView(samples) — the honest length: a float approx of each
// √d², with residue = len² − d² as an EXACT rat per segment and in total.
// `exact: false` always — a length with irrational pieces has no exact
// rational identity. The residue is the measurable truth about the view.
export function polylineLengthView(samples) {
  let approx = 0;
  let residue = ZERO;
  for (let i = 1; i < samples.length; i++) {
    const s = dSq(samples[i - 1], samples[i]);
    const len = Math.sqrt(ratToNumber(s));
    approx += len;
    residue = ratAdd(residue, ratSub(ratMul(floatToRat(len), floatToRat(len)), s));
  }
  return { approx, residue, exact: false };
}

// upscaleView(spline, density) — one view: n+1 samples at rational
// parameters i/n. The spline object is NOT modified (identity untouched).
export function upscaleView(spline, density) {
  if (!Number.isInteger(density) || density < 1) throw new Error('upscale: density must be a positive integer');
  return sampleAlong(spline, density);
}

// refinementError(spline, coarse, fine) — the EXACT reconstruction error
// between two densities of the same identity: |E(fine) − E(coarse)| on the
// chordal-energy ladder. In pixel land this number is a neural-net guess.
// Here it is exact.
export function refinementError(spline, coarse, fine) {
  if (fine <= coarse) throw new Error('upscale: fine density must exceed coarse');
  const Ec = chordalEnergy(upscaleView(spline, coarse));
  const Ef = chordalEnergy(upscaleView(spline, fine));
  const e = ratSub(Ef, Ec);
  return { error: e.num < 0n ? makeRat(-e.num, e.den) : e, coarse: Ec, fine: Ef, energyFalling: e.num <= 0n };
}

// convergenceReport(spline, densities) — the ladder: successive views with
// exact energies and exact refinement errors. Monotonicity is asserted by
// the caller's test, not assumed.
export function convergenceReport(spline, densities) {
  const views = densities.map(d => ({ density: d, samples: upscaleView(spline, d), energy: chordalEnergy(upscaleView(spline, d)) }));
  const steps = [];
  for (let i = 1; i < views.length; i++) {
    const e = ratSub(views[i].energy, views[i - 1].energy);
    steps.push({ from: densities[i - 1], to: densities[i], error: e.num < 0n ? makeRat(-e.num, e.den) : e, errorStr: ratToString(e.num < 0n ? makeRat(-e.num, e.den) : e) });
  }
  return { views, steps };
}

// hostUpscale(kernel, spline, {name, densities}) — tenancy: each density
// is a view cell (float sample list + per-sample ℚ lifts in meta), linked
// 'upscaleOf' → `name.identity` (the control polygon cell, written once,
// never touched again).
export function hostUpscale(kernel, spline, { name = 'curve', densities = [4, 8, 16] } = {}) {
  kernel.bind(`${name}.identity`, spline.controls.map(pt => pt.map(ratToNumber)), {
    what: `control polygon — IDENTITY of ${name} (upscaling never touches this cell)`,
    lift: spline.controls.map(pt => pt.map(ratToString)),
  });
  let links = 0;
  for (const d of densities) {
    const samples = upscaleView(spline, d);
    kernel.bind(`view.${name}.d${d}`, samples.map(s => s.map(ratToNumber)), {
      what: `view of ${name} at density ${d} (a view, never identity)`,
      lift: samples.map(s => s.map(ratToString)),
      density: d,
    });
    kernel.link(`view.${name}.d${d}`, `${name}.identity`, 'upscaleOf');
    links++;
  }
  return { identity: 1, views: densities.length, links };
}

// identityUntouched(before, spline) — the law's audit: upscaling must not
// have mutated the spline's control polygon (same rat references).
export function identityUntouched(before, spline) {
  return before === spline.controls || (before.length === spline.controls.length &&
    before.every((pt, i) => pt === spline.controls[i] || pt.every((r, j) => r === spline.controls[i][j])));
}

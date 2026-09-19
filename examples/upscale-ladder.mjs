// upscale-ladder — view super-resolution, watched digit by digit. Run:
//   node examples/upscale-ladder.mjs
//
// What tests/upscale.test.mjs pins: a spline's identity is its control
// polygon; denser views never touch identity (identityUntouched), and the
// refinement ladder is exact ℚ arithmetic you can watch converge.
// Narrative hook: the first implementation claimed chordal energy "climbs"
// under refinement — the tests caught the inversion. Splitting u+v changes
// energy by −2·u·v, so the ladder DESCENDS. This demo shows the descent.
import { makeRat, ratToString, ratToNumber } from '../packages/quilt-floor/src/commensurate.mjs';
import { makeSpline, pythagoreanArc } from '../packages/quilt-floor/src/spline.mjs';
import { upscaleView, chordalEnergy, refinementError, convergenceReport, identityUntouched } from '../packages/quilt-floor/src/upscale.mjs';

// The exact 3-4-5 circular arc: identity endpoints (0,0)→(8,0), T=(4,3).
// Pythagorean because 4² + 3² = 5² — exact ℚ, no float dust.
const s = pythagoreanArc([makeRat(0n), makeRat(0n)], [makeRat(8n), makeRat(0n)]);
const before = s.controls;

console.log('=== View super-resolution on the exact 3-4-5 arc ===');
console.log(`identity: ${s.controls.length} control points (ℚ lifts, not floats)`);

const rep = convergenceReport(s, [4, 8, 16, 32]);
console.log('\n=== The ladder (chordalEnergy Σ|Δ|² is exact at every density) ===');
for (const v of rep.views) {
  console.log(`  density ${String(v.density).padStart(2)}: ${v.samples.length} samples,  energy = ${ratToString(v.energy)} ≈ ${ratToNumber(v.energy).toFixed(6)}`);
}
console.log('  energy DESCENDS under refinement — splitting u+v changes energy by −2·u·v;');
console.log('  the chord (density 1) is the lazy one-leap maximum. (The inversion the tests caught.)');

console.log('\n=== Refinement error between consecutive views ===');
for (const st of rep.steps) {
  console.log(`  ${st.from} → ${st.to}:  error = ${ratToString(st.error)} ≈ ${ratToNumber(st.error).toFixed(8)}`);
}
console.log('  each step is a measurable ℚ — strictly shrinking, never zero:');
console.log('  convergence you can watch digit by digit.');

console.log('\n=== Identity law ===');
const v16 = upscaleView(s, 16);
console.log(`  after minting a 17-sample view: identityUntouched = ${identityUntouched(before, s)}`);
console.log('  upscaling mints denser VIEWS; it never edits the control polygon.');

void v16;

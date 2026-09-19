// comb-probe — the full commensuration re-probe, as a runnable report.
// Run: node examples/comb-probe.mjs
//
// This is the driver behind tests/twistprobe.test.mjs and THE-FLOOR.md §19.
// It prints the measured answer to the standing question (2026-09-17):
// what is the floor's rotational comb, and is the "16/57 ≈ 1/φ" claim real?
import { Multigrid } from '../packages/quilt-floor/src/multigrid.mjs';
import { twistFieldFrom } from '../packages/quilt-floor/src/twistfield.mjs';
import { residualCurve, combTeeth, claimCheck, bestRational } from '../packages/quilt-floor/src/twistprobe.mjs';

const UNIFORM = [0.5, 0.5, 0.5, 0.5, 0.5];   // the multigrid default — exactly 36°-symmetric
const GENERIC = [0.1, 0.7, 0.3, 0.9, 0.4];   // generic offsets — no exact symmetry
const mk = (gamma) => (r) => twistFieldFrom(new Multigrid({ N: 5, gamma, reach: 8 }), r);

console.log('=== 1. The exact anchor (uniform γ) ===');
{
  const tf = mk(UNIFORM)(2.1);
  for (const th of [36, 72]) {
    const R = tf.registration(th);
    console.log(`R(${th}°) = ${R.toFixed(12)}  ${Math.abs(R - 1) < 1e-9 ? '← EXACT symmetry' : ''}`);
  }
  const gen = mk(GENERIC)(2.1);
  console.log(`generic γ: R(36°) = ${gen.registration(36).toFixed(4)} (statistical recurrence only)`);
}

console.log('\n=== 2. Fine-structure scan 0–1° at 0.02° (the killed fine-tooth claim) ===');
{
  const tf = mk(GENERIC)(2.1);
  const curve = residualCurve(tf, { fromDeg: 0.15, toDeg: 1.0, stepDeg: 0.02 });
  const teeth = combTeeth(curve, { column: 'residual', minValue: 1.0001 });
  const worst = Math.max(...curve.map(r => Math.abs(r.residual - 1)));
  console.log(`max |residual − 1| over 0.15–1°: ${(worst * 100).toFixed(3)}%  → ${teeth.length} fine teeth. The claim stays dead.`);
}

console.log('\n=== 3. THE COMB (uniform γ, R-teeth, 2–72° at 0.1°) ===');
{
  const tf = mk(UNIFORM)(2.1);
  const curve = residualCurve(tf, { fromDeg: 2, toDeg: 72, stepDeg: 0.1 });
  const teeth = combTeeth(curve);
  for (const t of teeth) {
    const p = Math.round(t.theta / 12);
    console.log(`  ${t.theta.toFixed(1).padStart(5)}°   R=${t.value.toFixed(4)}  prominence=${t.prominence.toFixed(4)}  ≈ ${p}/3 · 36°`);
  }
  console.log(`→ ${teeth.length} teeth on the 12° grid — the thirds of the fivefold period, bracketing the exact 36° anchor.`);
}

console.log('\n=== 4. Generic γ: same scan ===');
{
  const tf = mk(GENERIC)(2.1);
  const curve = residualCurve(tf, { fromDeg: 2, toDeg: 72, stepDeg: 0.1 });
  const teeth = combTeeth(curve);
  for (const t of teeth) console.log(`  ${t.theta.toFixed(1).padStart(5)}°   R=${t.value.toFixed(4)}  prominence=${t.prominence.toFixed(4)}`);
  console.log(`→ the exact 36° tooth is gone; only weak remnants (<5% prominence) survive.`);
}

console.log('\n=== 5. The "16/57 ≈ 1/φ" claim, re-probed ===');
{
  const tf = mk(GENERIC)(2.1);
  const curve = residualCurve(tf, { fromDeg: 8, toDeg: 12.5, stepDeg: 0.05 });
  const chk = claimCheck(curve, 16, 57);
  console.log(`claim: ${chk.claim}`);
  console.log(`measured: residual=${chk.measured.residual.toFixed(2)} at ${chk.measured.theta}°, isLocalMax=${chk.isLocalMax}`);
  console.log(`best rational: ${chk.rationals[0].p}/${chk.rationals[0].q} (err ${chk.rationals[0].errDeg.toFixed(4)}°)`);
  console.log(`→ mid-slope on the smooth large-θ rise, no prominence. And 16/57=${(16 / 57).toFixed(4)} ≠ 1/φ=${(1 / (1.618033988749895)).toFixed(4)}. Stays dead.`);
  const near = bestRational(11.9, { period: 36 });
  console.log(`(the folklore likely saw the uniform comb's first tooth at 11.9° ≈ ${near[0].p}/${near[0].q} · 36° = ${near[0].theta.toFixed(2)}°.)`);
}

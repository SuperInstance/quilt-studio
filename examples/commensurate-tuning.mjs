// commensurate-tuning — exact rationals for the comb. Run:
//   node examples/commensurate-tuning.mjs
//
// What tests/commensurate.test.mjs pins, as a hands-on demo:
// exact float→rational conversion for dyadics, continued-fraction
// nearest-rational search, and the headline commensuration d/π = 4/13
// where d = π/(2φ).
import { makeRat, ratToNumber, ratToString, floatToRat, nearestRational, continuedFraction } from '../packages/quilt-floor/src/commensurate.mjs';
import { PHI } from '../packages/quilt-floor/src/golden.mjs';

console.log('=== floatToRat: f64 is dyadic, so this is EXACT ===');
for (const x of [0.5, 1.25, 36 / 360, 0.1 + 0.2]) {
  const r = floatToRat(x);
  const back = ratToNumber(r);
  console.log(`  floatToRat(${x}) = ${ratToString(r)} = ${back.toFixed(17)}  ${back === x ? '✓ exact round-trip' : '(inexact input — honest about it)'}`);
}

console.log('\n=== The golden continued fraction ===');
console.log('  1/φ = ' + continuedFraction(floatToRat(PHI - 1), 10).join(' + 1/(') + ' ...)');
console.log('  — all ones forever. That is WHY Fibonacci shadows keep winning:');
for (const md of [13, 21]) {
  const { rat } = nearestRational(PHI - 1, md);
  const err = Math.abs(ratToNumber(rat) - (PHI - 1));
  console.log(`  nearestRational(1/φ, den ≤ ${md}) = ${ratToString(rat)}  (err ${err.toFixed(6)})`);
}
console.log('  1/φ ≠ 8/13 exactly — the shadow is honest about being a shadow.');

console.log('\n=== The comb\'s teeth are trivial rationals ===');
for (const deg of [11.9, 24.2, 36, 47.9, 60.2]) {
  const { rat } = nearestRational(deg / 36, 6);
  console.log(`  ${deg}°/36° → ${ratToString(rat)} = ${(ratToNumber(rat) * 36).toFixed(1)}°`);
}
console.log('  → thirds of the fivefold period. No 16/57 folklore needed.');

console.log('\n=== The headline commensuration: d = π/(2φ) ===');
const d = Math.PI / (2 * PHI);
const ratio = d / Math.PI;                    // = 1/(2φ), the exact target
const { rat } = nearestRational(ratio, 20);
const error = Math.abs(ratToNumber(rat) - ratio);
console.log(`  d        = π/(2φ) = ${d.toFixed(10)}`);
console.log(`  d/π      = 1/(2φ) = ${ratio.toFixed(10)}`);
console.log(`  4/13     = ${(4 / 13).toFixed(10)}   ← nearestRational(d/π, den ≤ 20)`);
console.log(`  exact-method error: ${error.toFixed(6)} — sharper than the old float answer 3/10 (err 0.0090)`);
console.log('  → the floor\'s exact-rational layer (commensurate.mjs) treats 4/13');
console.log('    as a first-class tuning citizen, with an exact error bound.');
void makeRat; // (exported constructor used by the layer; shown for completeness)

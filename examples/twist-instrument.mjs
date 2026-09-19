// twist-instrument — the anti-moiré instrument, end to end. Run:
//   node examples/twist-instrument.mjs
//
// Uses the real TwistField API (cloudLaw / registration / curve) that
// tests/twistfield.test.mjs pins. S = 1 − R is computed here, exactly as
// twist-engine defines it — one registration law for everything.
import { Multigrid } from '../packages/quilt-floor/src/multigrid.mjs';
import { twistFieldFrom } from '../packages/quilt-floor/src/twistfield.mjs';

const mg = new Multigrid({ N: 5, gamma: [0.1, 0.7, 0.3, 0.9, 0.4], reach: 8 });
const tf = twistFieldFrom(mg, 2.1);          // the twist law seated on the Penrose floor

console.log('=== The twist instrument on the Penrose floor ===');
console.log(`points: ${tf.points.length}`);
console.log(`mean spacing s = ${tf.s.toFixed(4)},  σ = 0.24·s = ${tf.sigma.toFixed(4)},  grid = 0.6·s = ${tf.grid.toFixed(4)}`);

console.log('\n=== Resonance curve 0–4° at 0.1° (S = 1 − R) ===');
const curve = tf.curve(0, 4, 0.1).map(({ theta, R }) => ({ theta, R, S: 1 - R }));
for (const p of curve.filter((_, i) => i % 4 === 0)) {
  console.log(`  ${p.theta.toFixed(1).padStart(4)}°   S=${p.S.toFixed(4)}`);
}

console.log('\n=== Magic windows (local minima of S, prominence ≥ 0.006) ===');
let found = 0;
for (let i = 2; i < curve.length - 2; i++) {
  const p = curve[i];
  if (p.S >= curve[i - 1].S || p.S >= curve[i + 1].S) continue;       // local min of S
  const left = Math.max(curve.slice(Math.max(0, i - 25), i).map(q => q.S));
  const right = Math.max(curve.slice(i + 1, i + 26).map(q => q.S));
  const prominence = Math.min(left, right) - p.S;
  if (prominence < 0.006) continue;
  found++;
  console.log(`  ${p.theta.toFixed(2).padStart(5)}°   S=${p.S.toFixed(4)}   prominence=${prominence.toFixed(4)}`);
}
if (!found) console.log('  (none at this radius — that is also an honest answer)');

console.log('\n=== Cloud-law check at 1° (the instrument\'s verified regime) ===');
const R1 = tf.registration(1), C1 = tf.cloudLaw(1);
console.log(`  R(1°) = ${R1.toFixed(6)},  cloudLaw(1°) = ${C1.toFixed(6)}`);
console.log(`  R/cloud − 1 = ${((R1 / C1 - 1) * 100).toFixed(4)}%  (verified to 0.06% in tests — the floor really does follow the gaussian background this closely)`);

console.log('\n=== Honest twist regime ===');
console.log('θ ≈ 0.15°–6° is home. Beyond ~2.2° = σ/r_max the cloud underflows and');
console.log('you measure the gaussian, not the lattice — for comb questions at');
console.log('large θ, read R directly (examples/comb-probe.mjs, THE-FLOOR.md §19).');

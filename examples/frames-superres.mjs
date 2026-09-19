// frames-superres — temporal super-resolution, the clean-room concept map. Run:
//   node examples/frames-superres.mjs
//
// What tests/frames.test.mjs pins (clean-room from the DLSS-5 concept map):
// Hermite legs through trajectory knots, generated in-between frames, the
// smooth/detail split — every exactness claim a BigInt zero.
import { makeRat, ratToNumber } from '../packages/quilt-floor/src/commensurate.mjs';
import { liftQ15, liftQ15Vector, makeTraj } from '../packages/quilt-floor/src/q16.mjs';
import { hermiteLegs, evalLeg, genFrames, detailOnly } from '../packages/quilt-floor/src/frames.mjs';

const DIM = 16;
const zeros = () => liftQ15Vector(Array(DIM).fill(0));

// three states, gentle motion: dial 0 walks 0 → 1/2 → 1 (Q1.15: 0 → 16384 → 32768)
const a = zeros(), b = zeros(), c = zeros();
a[0] = liftQ15(0); b[0] = liftQ15(16384); c[0] = liftQ15(32768);
b[1] = liftQ15(8192); c[1] = liftQ15(16384);
const traj = makeTraj([a, b, c]);

console.log('=== Temporal super-resolution on a 3-state ℚ¹⁶ trajectory ===');
const { legs } = hermiteLegs(traj);
console.log(`trajectory: ${traj.vectors.length} states × ${DIM} dims (Q1.15 ℚ lifts)`);
console.log(`hermite legs: ${legs.length} (knot velocity = central difference)`);

// legs pass through both endpoints EXACTLY (the tests pin BigInt equality)
const p0 = evalLeg(legs[0], 0), p1 = evalLeg(legs[0], 1);
const exact0 = p0.every((r, i) => r.num === traj.vectors[0][i].num && r.den === traj.vectors[0][i].den);
const exact1 = p1.every((r, i) => r.num === traj.vectors[1][i].num && r.den === traj.vectors[1][i].den);
console.log(`leg 0 at τ=0 reproduces state 0 exactly: ${exact0}`);
console.log(`leg 0 at τ=1 reproduces state 1 exactly: ${exact1}`);

console.log('\n=== Generated in-betweens (factor 4) ===');
const frames = genFrames(traj, { factor: 4 });
console.log(`frames: ${frames.length} (2 legs × 4 + 1 terminal knot)`);
for (let i = 0; i < frames.length; i++) {
  const f = frames[i];
  const tag = f.observed ? 'OBSERVED' : 'generated';
  console.log(`  frame ${String(i).padStart(2)}  t=${f.t.toFixed(2)}  ${tag.padEnd(9)}  dial0 = ${f.view[0].toFixed(4)}, dial1 = ${f.view[1].toFixed(4)}`);
}
console.log('  every frame carries t, leg, and observed/exact flags — the record');
console.log('  always knows which ticks were SEEN and which were GENERATED.');

console.log('\n=== The smooth/detail split ===');
const smooth = genFrames(traj, { factor: 1 });
const detail = detailOnly(smooth.map(f => f.state), frames.map(f => f.state));
console.log(`detail frames (generated − smooth): ${detail.length}, each ${DIM} dims`);
console.log('detail carries only what the upscaler ADDED — the pin list keeps');
console.log('authoritative knots from being overwritten by the in-between layer.');

console.log('\n=== Honesty law ===');
console.log('Every exactness claim above is a BigInt zero comparison, not a');
console.log('tolerance. Temporal SR here is a concept map — the laws that');
console.log('would have to hold for generated time to be auditable.');
void makeRat;

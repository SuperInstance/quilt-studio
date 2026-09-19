// Remember the floor into the ocean — run manually:
//   TIDEPOOL_URL=https://tidepool.<account>.workers.dev node examples/remember-the-floor.mjs
import { Multigrid } from '../../quilt-floor/src/multigrid.mjs';
import { twistFieldFrom } from '../../quilt-floor/src/twistfield.mjs';
import { TidepoolClient } from '../../quilt-floor/src/tidepool.mjs';

const url = process.env.TIDEPOOL_URL;
if (!url) {
  console.error('TIDEPOOL_URL not set — refusing to guess the ocean.');
  process.exit(1);
}

// Build the twist instrument on the floor, twice: generic offsets and the
// multigrid default. The API is the real one (registration/cloudLaw/curve)
// — this example is also a compile-check that the module still honors it.
const mgGen = new Multigrid({ N: 5, gamma: [0.1, 0.7, 0.3, 0.9, 0.4], reach: 8 });
const tfGen = twistFieldFrom(mgGen, 2.1);
const mgUni = new Multigrid({ N: 5, gamma: [0.5, 0.5, 0.5, 0.5, 0.5], reach: 8 });
const tfUni = twistFieldFrom(mgUni, 2.1);

// The universal fingerprint (THE-FLOOR.md §13): the cloud-law ratio at 1°
// is the same ~0.06% for BOTH floors — the exponential background beats
// local structure in the twist regime.
const ratio = (tf) => tf.registration(1) / tf.cloudLaw(1) - 1;
const rGen = ratio(tfGen), rUni = ratio(tfUni);

// The exact anchor (§19): uniform γ is 36°-symmetric about the origin.
const anchor36 = tfUni.registration(36);   // 1 to ~1e-9

// The comb (§19): uniform-γ R-teeth on the 12° grid — thirds of the
// fivefold period. Generic γ loses the exact 36° tooth.
const tooth = (tf, th) => tf.registration(th);
const comb = [11.9, 24.2, 36, 47.9, 60.2].map((th) => ({
  th,
  uni: tooth(tfUni, th),
  gen: tooth(tfGen, th),
}));

const body = [
  'Twist instrument seated on the Penrose floor (twistfield.mjs).',
  `Cloud-law ratio at 1°: generic ${(rGen * 100).toFixed(4)}%, uniform ${(rUni * 100).toFixed(4)}% — the universal fingerprint.`,
  `Exact anchor: uniform-γ R(36°) = ${anchor36.toFixed(12)} (symmetry to 1e-9).`,
  'Comb (uniform γ): ' + comb.map((c) => `${c.th}° R=${c.uni.toFixed(3)}`).join(', ') + '.',
  'Generic γ at 36°: R = ' + tfGen.registration(36).toFixed(3) + ' — the exact tooth is gone.',
  'Honest regime 0.15°–6°; fine magic windows and the 16/57≈1/φ claim killed by twistprobe.mjs (§19).',
].join(' ');

const tp = new TidepoolClient(url, { author: 'kimi1', repo: 'SuperInstance/quilt-studio' });
const r = await tp.remember({
  kind: 'instrument',
  title: 'twist on the floor — cloud law 0.06%, fingerprint universal',
  body,
  run: { task: 'examples/remember-the-floor.mjs', outcome: 'ok' },
});
console.log('remembered:', r);
const recent = await tp.recall({ author: 'kimi1', limit: 5 });
console.log('recent kimi1 artifacts:', JSON.stringify(recent).slice(0, 300));

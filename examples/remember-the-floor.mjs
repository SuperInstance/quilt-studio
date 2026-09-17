// Remember the floor into the ocean — run manually:
//   TIDEPOOL_URL=https://tidepool.<account>.workers.dev node examples/remember-the-floor.mjs
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { Multigrid } from '../../quilt-floor/src/multigrid.mjs';
import { TwistField, twistFieldFrom } from '../../quilt-floor/src/twistfield.mjs';
import { TidepoolClient } from '../../quilt-floor/src/tidepool.mjs';

const url = process.env.TIDEPOOL_URL;
if (!url) {
  console.error('TIDEPOOL_URL not set — refusing to guess the ocean.');
  process.exit(1);
}

const mg = new Multigrid({ N: 5, gamma: [0.1, 0.7, 0.3, 0.9, 0.4], reach: 8 });
const tf = twistFieldFrom(mg, 2.1);
const sweep = tf.sweep(0, 4, 0.25);
const c1 = sweep.find(s => Math.abs(s.deg - 1) < 0.2);

const body = [
  'Twist instrument seated on the Penrose floor (twistfield.mjs).',
  `Cloud law at 1°: measured ${c1.reg.toFixed(6)} vs predicted ${c1.cloud.toFixed(6)}.`,
  `Fingerprint peak: ${(tf.fingerprint() * 180 / Math.PI).toFixed(3)}°.`,
  'Honest regime 0.15°–6°; fine magic windows and large-θ commensuration killed by probes.',
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

// canon.mjs — the drift front's laws, with the 09:20 morning observation
// pinned as the baseline. Live poll skipped in tests (fetch is injected);
// one test hits the real endpoint marked as such.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuiltKernel } from '../../quilt-core/src/reference-kernel.mjs';
import { WasmQuiltKernel } from '../../quilt-core/src/wasm-kernel.mjs';
import { fetchCanonState, classifyDrift, DriftLog, hostCanon, CANON_ENDPOINT } from '../src/canon.mjs';

const kernels = [['reference', QuiltKernel], ['wasm', WasmQuiltKernel]];

// The 2026-09-19 09:20 (GMT+8) morning-sweep observation, pinned.
const BASELINE = {
  state_hash: '0x7d8d32cd7f8a9f26',
  paper_count: 14,
  test_cell_hash: '0xe435d91d6d92a1d8',
  canon_target: '0xbf27a3631cdee337',
  observed_at: 1789777200,
};
const stub = body => async () => ({ ok: true, json: async () => body });

test('fetchCanonState: parses the live payload shape, rejects malformed', async () => {
  const s = await fetchCanonState(CANON_ENDPOINT, stub(BASELINE));
  assert.equal(s.state_hash, '0x7d8d32cd7f8a9f26');
  assert.equal(s.paper_count, 14);
  await assert.rejects(() => fetchCanonState(CANON_ENDPOINT, stub({ state_hash: 'x' })), /missing/);
});

test('classifyDrift: baseline vs itself — no drift, target front unreached (anti-vacuity of the eye)', () => {
  const v = classifyDrift(BASELINE, BASELINE);
  assert.equal(v.drifted, false);
  assert.equal(v.converged, false);
  assert.equal(v.events.filter(e => e.type === 'hash-drift').length, 0);
  const front = v.events.find(e => e.type === 'target-front');
  assert.equal(front.reached, false);
  assert.equal(front.unchanged_since_baseline, true);
});

test('classifyDrift: hash change is drift with paper accounting; reaching target is converged', () => {
  const moved = { ...BASELINE, state_hash: '0xaaaa1111bbbb2222', paper_count: 71 };
  const v = classifyDrift(moved, BASELINE);
  assert.equal(v.drifted, true);
  assert.equal(v.converged, false);
  const ev = v.events.find(e => e.type === 'hash-drift');
  assert.deepEqual(ev.papers, { from: 14, to: 71 });
  const converged = classifyDrift({ ...BASELINE, state_hash: BASELINE.canon_target }, BASELINE);
  assert.equal(converged.converged, true, 'live == canon_target ⇒ the front is closed');
  assert.equal(converged.events.find(e => e.type === 'hash-drift').converged, true);
});

test('classifyDrift: same hash but different count is ANOMALY — the hash lies or the count does', () => {
  const v = classifyDrift({ ...BASELINE, paper_count: 15 }, BASELINE);
  const ev = v.events.find(e => e.type === 'count-drift-same-hash');
  assert.ok(ev && ev.anomaly, 'flagged, never silently merged');
});

test('DriftLog: append-only history derives transitions, nothing rewritten', () => {
  const log = DriftLog.memory();
  log.record(BASELINE, classifyDrift(BASELINE, BASELINE));
  log.record(BASELINE, classifyDrift(BASELINE, BASELINE));
  assert.equal(log.transitions().length, 0);
  const moved = { ...BASELINE, state_hash: '0xbf27a3631cdee337', paper_count: 71, observed_at: BASELINE.observed_at + 3600 };
  log.record(moved, classifyDrift(moved, BASELINE));
  const tr = log.transitions();
  assert.equal(tr.length, 1);
  assert.equal(tr[0].to, '0xbf27a3631cdee337');
  assert.equal(tr[0].papers[1], 71);
  assert.equal(log.rows.length, 3, 'history only grows');
});

for (const [label, K] of kernels) {
  test(`${label}: the canon hosts — live and target are identity cells, the front is a link`, () => {
    const k = new K();
    const { cells, links } = hostCanon(k, BASELINE);
    assert.equal(cells, 3);
    assert.equal(links, 1);
    assert.equal(k.view('canon.live').hash, '0x7d8d32cd7f8a9f26');
    assert.equal(k.view('canon.live').paper_count, 14);
    assert.equal(k.view('canon.target').hash, '0xbf27a3631cdee337');
    const l = k.links().find(x => x.type === 'drifts-toward');
    assert.equal(l.from, 'canon.live');
    assert.equal(l.to, 'canon.target');
  });
}

test('LIVE (marked): the real canon endpoint still matches the 5-hour-old baseline', async () => {
  const live = await fetchCanonState();
  const v = classifyDrift(live, BASELINE);
  // The point of the front: this assertion FAILS the day the canon moves.
  assert.equal(v.drifted, false, `canon DRIFTED: ${JSON.stringify(v.events)}`);
});

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
  // Deployment of quilt-live-canon branch `canon-71-full-corpus` re-pins
  // the baseline (71 papers, target 0x445185a3a99fd2e7) — that failure is
  // the front doing its job; the morning sweep performs the re-pin.
  assert.equal(v.drifted, false, `canon DRIFTED: ${JSON.stringify(v.events)}`);
});

// ===== Target provenance — the 2026-09-20 forensics, pinned AND computed =====
// These tests recompute the three load-bearing hashes from raw paper dicts.
// The strings are not trusted; they are verified. If the dial encoding or
// either algorithm changes, these fail — that is the point.

import { fnv1a64, cellToDials, serializeCell, canonicalStateHash, dialOnlyStateHash, classifyTargetProvenance } from '../src/canon.mjs';

// Minimal but real metadata — the fields the dial encoding reads.
const P = (number, title, f_number, phase, date, ref_papers = [], ref_f_numbers = []) =>
  ({ number, title, f_number, phase, date, ref_papers, ref_f_numbers });

// The 9-paper v0.2.0 bundle (F115-F123 + F129, F130 cascade).
const CORPUS_9 = {
  425: P(425, 'F115 — The Logical Routes: VHDL × Verilog × the QUF bit-exactness', 115, 237, '2026-09-03', [426, 427]),
  426: P(426, 'F116 — The 5+1+1+1+1+1+1+1+1+1+1 Opcodes in 5 Substrates: A Polyformalism Atlas', 116, 238, '2026-09-03', [], [115]),
  427: P(427, 'F117 — The 5-Substrate Polyformalism: Python × C × Rust × Verilog × VHDL, One Cell', 117, 239, '2026-09-03', [], [115, 116]),
  428: P(428, 'F118 — The Polyformalism in Production: A Play-Test + Benchmark', 118, 240, '2026-09-03', [], [115, 116, 117]),
  429: P(429, 'F119 — The 6-Substrate Polyformalism: cell-runtime Joins the Canon', 119, 241, '2026-09-03', [], [115, 116, 117, 118]),
  432: P(432, 'F122 — The Shape Store: 5 Indices on Cloudflare Vectorize', 122, 244, '2026-09-03', [], [120, 121]),
  433: P(433, 'F123 — The Composer Agent: 5 Cells, 80 Parameters', 123, 245, '2026-09-03', [], [120, 122]),
  439: P(439, 'F129 — The Live Canon: Papers as Cells, Reading as Navigation', 129, 251, '2026-09-03', [], [115, 120, 122, 125]),
  440: P(440, 'F130 — The Polyformal Live Canon: One Cell, Five Substrates', 130, 251, '2026-09-03', [], [115, 129]),
};
// The 14-paper live bundle (adds F131-F135).
const CORPUS_14 = {
  ...CORPUS_9,
  441: P(441, 'F131 — The 3-Package Polyformalism: One Cell, Three Registries', 131, 252, '2026-09-03', [], [115, 130]),
  442: P(442, 'F132 — Operational Fictions as Concrete System-Prompt Noun-Phrases', 132, 253, '2026-09-03'),
  443: P(443, 'F133 — Operational Fictions as Falsifiable Claims (avg divergence 0.861)', 133, 254, '2026-09-03', [], [132]),
  444: P(444, 'F134 — The Quilt Cowboy: Orchestrator Over 12 Cheap Voices', 134, 254, '2026-09-03', [], [132, 133]),
  445: P(445, 'F135 — The Wheelhouse Test: Scoring Fictions for 0300-in-a-Gale Tolerability', 135, 254, '2026-09-03', [], [132, 133]),
};

test('forensics: dial encoding + canonical serialization reproduce the pinned hashes', () => {
  // Test cell — the cross-substrate vector defined by the worker's
  // /api/cell/seed: id=1, dials=[1..16], neighbors=[2,3,4].
  const dials = Array.from({ length: 16 }, (_, i) => i + 1);
  assert.equal(hex(dnv(serializeCell(1, dials, [2, 3, 4]))), '0xe435d91d6d92a1d8');
  // The retired v0.2.0 dial-only hash over the 9-paper bundle.
  assert.equal(dialOnlyStateHash(CORPUS_9), '0xbf27a3631cdee337');
  // The current canonical hash over the 14-paper live bundle.
  assert.equal(canonicalStateHash(CORPUS_14), '0x7d8d32cd7f8a9f26');
});

const hex = h => '0x' + h.toString(16).padStart(16, '0');
const dnv = b => fnv1a64(b);

test('classifyTargetProvenance: the stranded target is NAMED, not shrugged at', () => {
  const known = [
    { name: '9-paper v0.2.0 bundle', papers: CORPUS_9 },
    { name: '14-paper live bundle', papers: CORPUS_14 },
  ];
  // The historical declaration — declared live, actually stranded.
  const v = classifyTargetProvenance('0xbf27a3631cdee337', { live: BASELINE, known });
  assert.equal(v.cls, 'stranded');
  assert.equal(v.algorithm, 'dial-only (retired)');
  assert.equal(v.reached_by, '9-paper v0.2.0 bundle');
  // A target equal to live state — front closed.
  assert.equal(classifyTargetProvenance('0x7d8d32cd7f8a9f26', { live: BASELINE, known }).cls, 'live');
  // A target equal to a current-algorithm corpus hash — real horizon.
  const r = classifyTargetProvenance('0x7d8d32cd7f8a9f26', { live: null, known });
  assert.equal(r.cls, 'reachable');
  assert.equal(r.algorithm, 'canonical');
  assert.equal(r.reached_by, '14-paper live bundle');
  // A number nothing explains — unknown, flagged for investigation.
  assert.equal(classifyTargetProvenance('0xdeadbeefcafe1234', { live: BASELINE, known }).cls, 'unknown');
});

test('classifyTargetProvenance: the 71-paper retarget is reachable under the canonical algorithm', async () => {
  // The full committed corpus from live-canon-gh data.json. Fetching keeps
  // this test honest against the real corpus rather than a local copy.
  const res = await fetch('https://raw.githubusercontent.com/SuperInstance/live-canon-gh/master/data.json');
  assert.ok(res.ok, 'live-canon-gh data.json reachable');
  const corpus = (await res.json()).canon;
  assert.equal(Object.keys(corpus).length, 71);
  const newTarget = canonicalStateHash(corpus);
  assert.equal(newTarget, '0x445185a3a99fd2e7', '71-paper canonical hash is the retarget value');
  const v = classifyTargetProvenance(newTarget, { known: [{ name: '71-paper committed corpus', papers: corpus }] });
  assert.equal(v.cls, 'reachable');
  assert.equal(v.algorithm, 'canonical');
});

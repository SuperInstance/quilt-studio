// canon.mjs — the canon drift front. The fleet's paper canon is a LIVE
// state (state_hash, paper_count, test_cell_hash, canon_target) served at
// /api/canon/hash; the morning sweep found it mid-drift: paper_count 14 @
// 0x7d8d32cd7f8a9f26 against an UNREACHED canon_target 0xbf27a3631cdee337,
// README claiming 71 papers, a worker copy claiming 230+. This module is
// the instrument that watches: hash-pinned baseline vs live, transitions
// as first-class events, drift classification as data — never a shrug.
//
// Doctrine: hashes are IDENTITY (strings the kernel binds); counts are
// measured state; drift is motion, classified exactly. The front never
// mutates the canon — it is an eye, not a hand.

export const CANON_ENDPOINT = 'https://live-canon.superinstance.dev/api/canon/hash';

// fetchCanonState(endpoint?) — one observation. Throws on transport failure;
// a missing observation is not a drift event, it is a BLIND event (caller
// records it as such — silence is not data either).
export async function fetchCanonState(endpoint = CANON_ENDPOINT, fetchFn = fetch) {
  const res = await fetchFn(endpoint);
  if (!res.ok) throw new Error(`canon: HTTP ${res.status}`);
  const body = await res.json();
  for (const k of ['state_hash', 'paper_count', 'test_cell_hash', 'canon_target']) {
    if (!(k in body)) throw new Error(`canon: payload missing ${k}`);
  }
  return {
    state_hash: body.state_hash,
    paper_count: body.paper_count,
    test_cell_hash: body.test_cell_hash,
    canon_target: body.canon_target,
    observed_at: body.observed_at ?? null, // epoch seconds, set by the caller if absent
  };
}

// classifyDrift(state, baseline) — the front's law. Compares one observation
// against a pinned baseline; every verdict is explicit, none is "probably".
export function classifyDrift(state, baseline) {
  const events = [];
  if (state.state_hash !== baseline.state_hash) {
    events.push({
      type: 'hash-drift',
      from: baseline.state_hash, to: state.state_hash,
      papers: { from: baseline.paper_count, to: state.paper_count },
      converged: state.state_hash === state.canon_target,
    });
  } else if (state.paper_count !== baseline.paper_count) {
    events.push({
      type: 'count-drift-same-hash',
      hash: state.state_hash,
      papers: { from: baseline.paper_count, to: state.paper_count },
      anomaly: true, // same hash, different count — the hash lies or the count does
    });
  }
  events.push({
    type: 'target-front',
    live: state.state_hash,
    target: state.canon_target,
    reached: state.state_hash === state.canon_target,
    unchanged_since_baseline: state.state_hash === baseline.state_hash,
  });
  return {
    state, baseline,
    drifted: state.state_hash !== baseline.state_hash,
    converged: state.state_hash === state.canon_target,
    events,
  };
}

// DriftLog — an append-only JSONL history (the WAL discipline the fleet
// keeps everywhere: observations in, verdicts derived, nothing rewritten).
export class DriftLog {
  constructor(readLine = null, writeLine = null) {
    this.rows = [];
    this._readLine = readLine; this._append = writeLine;
  }
  static memory() { return new DriftLog(); }
  record(state, verdict) {
    const row = { t: state.observed_at ?? Math.floor(Date.now() / 1000), state, verdict: verdict.events };
    this.rows.push(row);
    this._append?.(JSON.stringify(row));
    return row;
  }
  get last() { return this.rows[this.rows.length - 1] ?? null; }
  transitions() {
    const out = [];
    for (let i = 1; i < this.rows.length; i++) {
      const a = this.rows[i - 1].state, b = this.rows[i].state;
      if (a.state_hash !== b.state_hash) out.push({ at: this.rows[i].t, from: a.state_hash, to: b.state_hash, papers: [a.paper_count, b.paper_count] });
    }
    return out;
  }
}

// hostCanon(kernel, state, {name}) — tenancy: the live hash and the target
// hash are cells (identity); the front is the link between them.
export function hostCanon(kernel, state, { name = 'canon' } = {}) {
  kernel.bind(`${name}.live`, { hash: state.state_hash, paper_count: state.paper_count }, { what: 'live canon observation' });
  kernel.bind(`${name}.target`, { hash: state.canon_target }, { what: 'unreached canon target' });
  kernel.bind(`${name}.testcell`, { hash: state.test_cell_hash }, { what: 'test cell hash' });
  kernel.link(`${name}.live`, `${name}.target`, 'drifts-toward');
  return { cells: 3, links: 1 };
}

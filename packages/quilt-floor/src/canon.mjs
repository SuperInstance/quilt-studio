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

// ===== Target provenance — where did the target NUMBER come from? =====
// The 2026-09-20 forensics: the declared target 0xbf27a3631cdee337 was NOT
// a horizon the corpus was failing to reach. It was the FNV-1a over
// dial-vectors ONLY (the retired v0.2.0 algorithm) across a retired
// 9-paper bundle. A target can be wrong in two different ways and the
// front must name which: STRANDED (no corpus under the CURRENT algorithm
// can ever reach it — the bug is in the number) vs UNREACHED (a known
// corpus hashes to it under the current algorithm — the bug is in the
// corpus's lag). A stranded target is a lie about the future; an
// unreached target is a debt. The fleet pays debts and deletes lies.

const FNV_OFFSET = 0xCBF29CE484222325n;
const FNV_PRIME  = 0x100000001b3n;
const FNV_MASK   = 0xFFFFFFFFFFFFFFFFn;

export function fnv1a64(bytes) {
  let h = FNV_OFFSET;
  for (const b of bytes) h = (h ^ BigInt(b)) * FNV_PRIME & FNV_MASK;
  return h;
}

const hex16 = h => '0x' + h.toString(16).padStart(16, '0');

// cellToDials — the dial encoding shared by every substrate (Q1.15).
export function cellToDials(paper) {
  const year = parseInt(String(paper.date || '1970').slice(0, 4)) || 1970;
  const th = fnv1a64(new TextEncoder().encode(paper.title || ''));
  const nRefs = (paper.ref_papers?.length || 0) + (paper.ref_f_numbers?.length || 0);
  return [
    Math.min(paper.number, 500) * 131,
    Number(th & 0xFFFFn),           // title_lo
    paper.f_number * 218,
    paper.phase * 218,
    (year - 1970) * 546,
    Math.min(0x7FFF, nRefs * 256),
    Number((th >> 16n) & 0xFFFFn),   // title_hi
    0,                                 // dial 7
    0, 0, 0, 0, 0, 0, 0, 0,            // dials 8-15
  ];
}

// serializeCell — canonical Quilt serialization: type(1) ‖ id(8 LE) ‖
// dials(32 LE) ‖ neighbors(8*N LE). THE current identity contract.
export function serializeCell(cellId, dials, neighbors) {
  const out = new Uint8Array(1 + 8 + 32 + 8 * neighbors.length);
  out[0] = 0x01;
  const dv = new DataView(out.buffer);
  let id = BigInt(cellId);
  for (let i = 0; i < 8; i++) { dv.setUint8(1 + i, Number(id & 0xFFn)); id >>= 8n; }
  for (let i = 0; i < 16; i++) dv.setUint16(9 + i * 2, dials[i] & 0xFFFF, true); // JS wrap ≡ struct <H
  let off = 41;
  for (const n of neighbors) {
    let nn = BigInt(n);
    for (let i = 0; i < 8; i++) { dv.setUint8(off + i, Number(nn & 0xFFn)); nn >>= 8n; }
    off += 8;
  }
  return out;
}

// canonicalStateHash(papers) — the CURRENT algorithm: FNV-1a over the
// sorted-by-id canonical cell serializations. Binds id + dials + edges.
export function canonicalStateHash(papers) {
  const cells = Object.values(papers).map(p => ({
    id: p.number,
    dials: cellToDials(p),
    neighbors: (p.ref_papers || []).map(Number),
  })).sort((a, b) => a.id - b.id);
  let combined = new Uint8Array(0);
  for (const c of cells) {
    const enc = serializeCell(c.id, c.dials, c.neighbors);
    const next = new Uint8Array(combined.length + enc.length);
    next.set(combined, 0); next.set(enc, combined.length);
    combined = next;
  }
  return hex16(fnv1a64(combined));
}

// dialOnlyStateHash(papers) — the RETIRED v0.2.0 algorithm: FNV-1a over
// dial-vectors only, no ids, no edges. Kept for ONE reason: provenance.
// When a declared target matches this over some known corpus, the target
// is STRANDED — a number from a retired contract, not a horizon.
export function dialOnlyStateHash(papers) {
  const buf = [];
  for (const p of Object.values(papers)) {
    // identical to Python's b''.join(struct.pack('<H', d & 0xFFFF)):
    // little-endian, one FNV byte at a time
    for (const d of cellToDials(p)) buf.push(d & 0xFF, (d >> 8) & 0xFF);
  }
  return hex16(fnv1a64(buf));
}

// classifyTargetProvenance(target, {live, known}) — name the target's class.
//   known: [{ name, algorithm: 'canonical'|'dial-only', papers }]  — corpora
//          whose hashes we can compute on both algorithms.
// Returns one of:
//   live      — target === live.state_hash (front closed)
//   reachable — some known corpus hashes to target under the CURRENT
//               algorithm (a real horizon; the corpus lags the number)
//   stranded  — target matches only under a RETIRED algorithm (the number
//               lags the contract; no corpus can ever reach it — retarget)
//   unknown   — no candidate explains the number (investigate; never shrug)
export function classifyTargetProvenance(target, { live = null, known = [] } = {}) {
  if (live && live.state_hash === target) {
    return { cls: 'live', target, reached_by: 'live state' };
  }
  for (const k of known) {
    if (canonicalStateHash(k.papers) === target) {
      return { cls: 'reachable', target, reached_by: k.name, algorithm: 'canonical' };
    }
  }
  for (const k of known) {
    if (dialOnlyStateHash(k.papers) === target) {
      return { cls: 'stranded', target, reached_by: k.name, algorithm: 'dial-only (retired)' };
    }
  }
  return { cls: 'unknown', target };
}

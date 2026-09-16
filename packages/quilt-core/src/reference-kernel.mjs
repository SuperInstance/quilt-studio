// QuiltKernel — the L1 kernel contract in executable form (reference implementation).
//
// CONTRACT v2 — value semantics, deletion, hydration.
// Any kernel is quilt-compatible iff it passes tests/contract-suite.mjs unmodified.
//
// Design constraints (do not soften without a version bump):
//   - ESM only, zero dependencies, importable in Node and the browser.
//   - Pure JS; if the WASM adapter diverges from this file, THIS file is wrong.
//   - Degrade, never throw: view/undo of unknown → null / false-ish.
//   - Values are JSON-canonical (value semantics): bound objects are snapshotted;
//     NaN/±Infinity canonicalize to null, per JSON.stringify semantics.
//   - Errors carry greppable names: UnknownCell / UnknownOp.

export class QuiltKernel {
  constructor() {
    this.cells = new Map();   // name -> JSON-canonical value
    this.edges = new Map();   // edgeId -> {from, to, type}
    this.ops = new Map();     // `${cell}::${op}` -> {forward, inverse}
    this.history = [];        // {cell, before} — undo is global LIFO (L2 adds per-cell)
    this.queue = [];          // {cell, op} — FIFO, flushed on tick
    this._ts = 0;
  }

  // ---------- BIND / VIEW ----------
  bind(name, value) {
    assertName(name);
    if (!isJSON(value)) throw new TypeError('bind: value must be JSON-serializable');
    this.cells.set(name, canonicalize(value));
    return name;
  }

  view(name) {
    if (!this.cells.has(name)) return null;           // degrade, never throw
    return this.cells.get(name);
  }

  // ---------- LINK ----------
  link(a, b, type) {
    assertName(a); assertName(b);
    if (!this.cells.has(a)) throw new Error(`UnknownCell: ${a}`);
    if (!this.cells.has(b)) throw new Error(`UnknownCell: ${b}`);
    const id = edgeId(a, b, type);
    if (!this.edges.has(id)) this.edges.set(id, { from: a, to: b, type });
    return id;
  }

  unlink(id) {
    return this.edges.delete(id);                     // degrade: false if absent
  }

  links(from = null) {
    return [...this.edges.values()].filter(e => from === null || e.from === from);
  }

  // ---------- EFFECT ----------
  effect(name, opName, forward, inverse) {
    if (!this.cells.has(name)) throw new Error(`UnknownCell: ${name}`);
    if (typeof forward !== 'function' || typeof inverse !== 'function')
      throw new TypeError('effect: forward and inverse must be functions');
    this.ops.set(`${name}::${opName}`, { forward, inverse });
  }

  apply(name, opName) {
    const op = this.ops.get(`${name}::${opName}`);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.view(name);
    const after = canonicalize(op.forward(before));
    this.cells.set(name, after);
    this.history.push({ cell: name, before });
    return after;
  }

  applyInverse(name, opName) {
    const op = this.ops.get(`${name}::${opName}`);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.view(name);
    const after = canonicalize(op.inverse(before));
    this.cells.set(name, after);
    this.history.push({ cell: name, before });
    return after;
  }

  undo() {
    // Global LIFO. Returns the restored value; null when nothing left to undo
    // or only stale entries remain (cell was unbound after the entry).
    while (this.history.length) {
      const h = this.history.pop();
      if (!this.cells.has(h.cell)) continue;          // stale — skip
      this.cells.set(h.cell, h.before);
      return h.before;
    }
    return null;
  }

  // ---------- DELETE ----------
  unbind(name) {
    if (!this.cells.has(name)) return false;          // degrade, never throw
    this.cells.delete(name);
    for (const [id, e] of this.edges)
      if (e.from === name || e.to === name) this.edges.delete(id);
    for (const key of [...this.ops.keys()])
      if (key.startsWith(`${name}::`)) this.ops.delete(key);
    return true;
  }

  // ---------- TICK ----------
  queueEffect(name, opName) {
    if (!this.cells.has(name)) throw new Error(`UnknownCell: ${name}`);
    if (!this.ops.has(`${name}::${opName}`)) throw new Error(`UnknownOp: ${opName} on ${name}`);
    this.queue.push({ cell: name, op: opName });
  }

  tick(dt = 1) {
    this._ts += dt;
    const applied = [];
    while (this.queue.length) {
      const { cell, op } = this.queue.shift();
      applied.push({ cell, op, value: this.apply(cell, op) });
    }
    return { ts: this._ts, applied };
  }

  now() { return this._ts; }

  // ---------- HYDRATE ----------
  load(snapshot) {
    // Restores cells + links. Clock is NOT resurrected: ts is provenance, and
    // the WASM substrate has no time-setter. A loaded kernel starts at 0.
    this.cells = new Map();
    this.edges = new Map();
    this.ops = new Map();
    this.history = [];
    this.queue = [];
    this._ts = 0;
    for (const [n, v] of Object.entries(snapshot.cells ?? {})) this.bind(n, v);
    for (const e of snapshot.links ?? []) this.link(e.from, e.to, e.type);
    return this;
  }

  snapshot() {
    const cells = {};
    for (const [n, v] of this.cells) cells[n] = v;
    return {
      cells,
      links: this.links(),
      ts: this._ts,
      historyDepth: this.history.length,
      queued: this.queue.length,
    };
  }
}

// ---------- helpers ----------
export function assertName(n) {
  if (typeof n !== 'string' || n.length === 0) throw new TypeError('name must be a non-empty string');
  if (n.length > 256) throw new TypeError('name exceeds 256 chars');
}

export function isJSON(v) {
  try { JSON.stringify(v); return typeof v !== 'function' && typeof v !== 'undefined'; }
  catch { return false; }
}

// JSON-canonical snapshot: value semantics. NaN/±Infinity → null (JSON rules).
export function canonicalize(v) {
  return v === undefined ? null : JSON.parse(JSON.stringify(v));
}

// Edge IDs escape '->' and ':' inside components so arbitrary names can't
// collide: link('a->b','c','x') and link('a','b->c','x') get distinct ids.
// Simple names keep the classic 'a->b:feeds' form.
export function edgeId(a, b, type) {
  const esc = s => s.replace(/\\/g, '\\\\').replace(/>/g, '\\u003e').replace(/:/g, '\\u003a');
  return `${esc(a)}->${esc(b)}:${esc(type)}`;
}

// QuiltKernel — the L1 kernel contract in executable form (reference implementation).
//
// CONTRACT v3 — the L2 surface: subscriptions, batch reads, metadata.
// Any kernel is quilt-compatible iff it passes tests/contract-suite.mjs unmodified.
//
// Design constraints (do not soften without a version bump):
//   - ESM only, zero dependencies, importable in Node and the browser.
//   - Pure JS; if the WASM adapter diverges from this file, THIS file is wrong.
//   - Degrade, never throw: view/undo of unknown → null.
//   - Values are JSON-canonical (value semantics): bind snapshots; view returns
//     a FRESH copy (mutating a view result never touches kernel state);
//     NaN/±Infinity canonicalize to null, per JSON.stringify semantics.
// Errors carry greppable names: UnknownCell / UnknownOp.
//   - undo() is global LIFO over apply, applyInverse, AND bind: everything is
//     reversible. Undoing a fresh bind removes the cell (the address never
//     existed); undoing an overwrite restores the prior value. The floor's
//     time travel runs on this.
//   - Subscriptions are synchronous and best-effort: a throwing listener is
//     skipped, never propagated into the mutation that fired it.

const ABSENT = Symbol('absent'); // cell did not exist before this bind

export class QuiltKernel {
  constructor() {
    this._cells = new Map();   // name -> JSON-canonical value
    this.meta = new Map();    // name -> JSON-canonical metadata (units/min/max/...)
    this.edges = new Map();   // edgeId -> {from, to, type}
    this.ops = new Map();     // `${cell}::${op}` -> {forward, inverse}
    this.history = [];        // {cell, before} — undo is global LIFO
    this.queue = [];          // {cell, op} — FIFO, flushed on tick
    this.listeners = new Set(); // {fn, cell, kinds}
    this._ts = 0;
  }

  // ---------- SUBSCRIBE (L2) ----------
  // fn receives {kind, cell, value, ts}. kinds: bind, link, unlink, effect,
  // apply, applyInverse, undo, unbind, load, tick.
  subscribe(fn, { cell = null, kinds = null } = {}) {
    const entry = { fn, cell, kinds: kinds ? new Set(kinds) : null };
    this.listeners.add(entry);
    return () => this.listeners.delete(entry);
  }

  emit(kind, cell = null, value = undefined) {
    for (const l of this.listeners) {
      if (l.cell !== null && l.cell !== cell) continue;
      if (l.kinds !== null && !l.kinds.has(kind)) continue;
      try { l.fn({ kind, cell, value, ts: this._ts }); } catch { /* best-effort */ }
    }
  }

  // ---------- BIND / VIEW ----------
  bind(name, value, meta = undefined) {
    assertName(name);
    if (!isJSON(value)) throw new TypeError('bind: value must be JSON-serializable');
    const before = this._cells.has(name) ? this._cells.get(name) : ABSENT;
    this._cells.set(name, canonicalize(value));
    if (meta === undefined) this.meta.delete(name);
    else {
      if (!isJSON(meta)) throw new TypeError('bind: meta must be JSON-serializable');
      this.meta.set(name, canonicalize(meta));
    }
    this.history.push({ cell: name, before });
    this.emit('bind', name, this._cells.get(name));
    return name;
  }

  view(name) {
    if (!this._cells.has(name)) return null;           // degrade, never throw
    return canonicalize(this._cells.get(name));        // FRESH copy — aliasing is a bug
  }

  metaOf(name) {
    return this.meta.has(name) ? canonicalize(this.meta.get(name)) : null;
  }

  viewMany(names) {
    return names.map(n => this.view(n));
  }

  cells(prefix = '') {
    return [...this._cells.keys()].filter(n => n.startsWith(prefix));
  }

  // ---------- LINK ----------
  link(a, b, type) {
    assertName(a); assertName(b);
    if (!this._cells.has(a)) throw new Error(`UnknownCell: ${a}`);
    if (!this._cells.has(b)) throw new Error(`UnknownCell: ${b}`);
    const id = edgeId(a, b, type);
    if (!this.edges.has(id)) {
      this.edges.set(id, { from: a, to: b, type });
      this.emit('link', null, { id, from: a, to: b, type });
    }
    return id;
  }

  unlink(a, b = undefined, type = undefined) {
    const id = b === undefined ? a : edgeId(a, b, type);
    const edge = this.edges.get(id);
    if (!edge) return false;
    this.edges.delete(id);
    this.emit('unlink', null, { id, ...edge });
    return true;
  }

  links(from = null) {
    return [...this.edges.values()].filter(e => from === null || e.from === from);
  }

  // ---------- EFFECT ----------
  effect(name, opName, forward, inverse) {
    if (!this._cells.has(name)) throw new Error(`UnknownCell: ${name}`);
    if (typeof forward !== 'function' || typeof inverse !== 'function')
      throw new TypeError('effect: forward and inverse must be functions');
    this.ops.set(`${name}::${opName}`, { forward, inverse });
    this.emit('effect', name, opName);
  }

  apply(name, opName) {
    const op = this.ops.get(`${name}::${opName}`);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.view(name);
    const after = canonicalize(op.forward(before));
    this._cells.set(name, after);
    this.history.push({ cell: name, before });
    this.emit('apply', name, after);
    return after;
  }

  applyInverse(name, opName) {
    const op = this.ops.get(`${name}::${opName}`);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.view(name);
    const after = canonicalize(op.inverse(before));
    this._cells.set(name, after);
    this.history.push({ cell: name, before });
    this.emit('applyInverse', name, after);
    return after;
  }

  undo() {
    // Global LIFO over apply/applyInverse/bind. Return convention:
    //   restored value — a cell now holds this value
    //   null           — a fresh bind was undone; the cell is gone (view → null)
    //   undefined      — history is empty (degrade, never throw)
    while (this.history.length) {
      const h = this.history.pop();
      if (h.before === ABSENT) {
        if (!this._cells.has(h.cell)) continue;         // already gone — stale
        this._cells.delete(h.cell);
        this.emit('undo', h.cell, null);
        return null;
      }
      if (!this._cells.has(h.cell)) continue;           // stale — skip
      this._cells.set(h.cell, h.before);
      this.emit('undo', h.cell, h.before);
      return h.before;
    }
    return undefined;
  }

  // ---------- DELETE ----------
  unbind(name) {
    if (!this._cells.has(name)) return false;          // degrade, never throw
    this._cells.delete(name);
    this.meta.delete(name);
    for (const [id, e] of this.edges)
      if (e.from === name || e.to === name) this.edges.delete(id);
    for (const key of [...this.ops.keys()])
      if (key.startsWith(`${name}::`)) this.ops.delete(key);
    this.emit('unbind', name, null);
    return true;
  }

  // ---------- TICK ----------
  queueEffect(name, opName) {
    if (!this._cells.has(name)) throw new Error(`UnknownCell: ${name}`);
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
    this.emit('tick', null, { ts: this._ts, applied });
    return { ts: this._ts, applied };
  }

  now() { return this._ts; }

  // ---------- HYDRATE ----------
  load(snapshot) {
    // Restores cells + links + meta. Clock is NOT resurrected: ts is
    // provenance, and the WASM substrate has no time-setter. Loaded kernels
    // start at 0.
    this._cells = new Map();
    this.meta = new Map();
    this.edges = new Map();
    this.ops = new Map();
    this.history = [];
    this.queue = [];
    this._ts = 0;
    const metas = snapshot.meta ?? {};
    for (const [n, v] of Object.entries(snapshot.cells ?? {})) this.bind(n, v, metas[n]);
    for (const e of snapshot.links ?? []) this.link(e.from, e.to, e.type);
    this.emit('load', null, null);
    return this;
  }

  snapshot() {
    // Object.fromEntries, NOT `{}` then assign — a cell literally named
    // '__proto__' must survive as a data property.
    const cells = Object.fromEntries(this._cells);
    const snap = {
      cells,
      links: this.links(),
      ts: this._ts,
      historyDepth: this.history.length,
      queued: this.queue.length,
    };
    if (this.meta.size) snap.meta = Object.fromEntries(this.meta);
    return snap;
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

// Edge IDs escape '>' and ':' inside components so arbitrary names can't
// collide: link('a->b','c','x') and link('a','b->c','x') get distinct ids.
// Simple names keep the classic 'a->b:feeds' form. Exported — consumers must
// be able to compute ids portably (unlink accepts the triple form too).
export function edgeId(a, b, type) {
  const esc = s => s.replace(/\\/g, '\\\\').replace(/>/g, '\\u003e').replace(/:/g, '\\u003a');
  return `${esc(a)}->${esc(b)}:${esc(type)}`;
}

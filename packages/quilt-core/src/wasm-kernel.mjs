// WasmQuiltKernel — the L1 adapter over quilt-vm-wasm's real WASM exports.
//
// CONTRACT v3 — same surface and semantics as reference-kernel.mjs.
// The raw kernel (SuperInstance/quilt-vm-wasm, vendored in ../vendor) exposes
// the 5 opcodes as dumb storage: bind/link/effect/view/tick + stats/reachable.
// The adapter owns the boundary:
//
//   ADAPTER-EMULATED (JS side):            NATIVE (WASM side):
//   - name validation (≤256, non-empty)    - cell storage (as JSON text)
//   - JSON-canonical value semantics       - link storage (with duplicates)
//     (NaN/±Infinity → null, fresh copies  - view read (returns stored text)
//      out of view)                        - clock (time += dt, time() getter)
//   - cell registry, unbind, load          - stats, reachability
//   - edge registry: id escaping, dedup, unlink
//   - named op registry, apply/applyInverse
//   - undo history (global LIFO, skip stale)
//   - effect queue (FIFO, validated at enqueue)
//   - subscriptions (L2), metadata (L2)
//   - snapshot assembly
//
// Storage: cells are stored in the WASM kernel as canonical JSON TEXT, because
// serde-wasm-bindgen 0.6.5 mis-serializes serde_json::Value::Object to empty
// JS objects (upstream bug — see audit). Unbind/unlink leave harmless stale
// records inside the WASM store (no upstream deletion opcodes); the adapter
// registries are authoritative.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { WasmQuiltVM } = require(join(here, '../vendor/quilt_vm_wasm.cjs'));

export class WasmQuiltKernel {
  constructor() {
    this.vm = new WasmQuiltVM();
    this._cells = new Set();   // bound names — authoritative registry
    this.meta = new Map();    // name -> JSON-canonical metadata
    this.edges = new Map();   // edgeId -> {from, to, type}
    this.ops = new Map();     // `${cell}::${op}` -> {forward, inverse}
    this.history = [];        // {cell, before}
    this.queue = [];          // {cell, op}
    this.listeners = new Set();
  }

  // ---------- SUBSCRIBE (L2) ----------
  subscribe(fn, { cell = null, kinds = null } = {}) {
    const entry = { fn, cell, kinds: kinds ? new Set(kinds) : null };
    this.listeners.add(entry);
    return () => this.listeners.delete(entry);
  }

  emit(kind, cell = null, value = undefined) {
    for (const l of this.listeners) {
      if (l.cell !== null && l.cell !== cell) continue;
      if (l.kinds !== null && !l.kinds.has(kind)) continue;
      try { l.fn({ kind, cell, value, ts: this.now() }); } catch { /* best-effort */ }
    }
  }

  // ---------- BIND / VIEW ----------
  bind(name, value, meta = undefined) {
    assertName(name);
    if (!isJSON(value)) throw new TypeError('bind: value must be JSON-serializable');
    const text = JSON.stringify(canonicalize(value));
    this.vm.bind(name, text);
    this._cells.add(name);
    if (meta === undefined) this.meta.delete(name);
    else {
      if (!isJSON(meta)) throw new TypeError('bind: meta must be JSON-serializable');
      this.meta.set(name, canonicalize(meta));
    }
    this.emit('bind', name, this.view(name));
    return name;
  }

  view(name) {
    if (!this._cells.has(name)) return null;          // degrade, never throw
    const text = this.vm.view(name, '_kernel');
    return text === null || text === undefined ? null : JSON.parse(text);
  }

  metaOf(name) {
    return this.meta.has(name) ? canonicalize(this.meta.get(name)) : null;
  }

  viewMany(names) {
    return names.map(n => this.view(n));
  }

  cells(prefix = '') {
    return [...this._cells].filter(n => n.startsWith(prefix));
  }

  // ---------- LINK ----------
  link(a, b, type) {
    assertName(a); assertName(b);
    if (!this._cells.has(a)) throw new Error(`UnknownCell: ${a}`);
    if (!this._cells.has(b)) throw new Error(`UnknownCell: ${b}`);
    const id = edgeId(a, b, type);
    if (!this.edges.has(id)) {                        // idempotency: adapter-enforced
      this.edges.set(id, { from: a, to: b, type });
      this.vm.link(a, b, type);
      this.emit('link', null, { id, from: a, to: b, type });
    }
    return id;
  }

  unlink(a, b = undefined, type = undefined) {
    const id = b === undefined ? a : edgeId(a, b, type);
    const edge = this.edges.get(id);
    if (!edge) return false;
    this.edges.delete(id);                            // stale WASM link record is inert
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
    this.vm.effect(name, opName, `${opName}:inverse`);  // record-only on the kernel
    this.emit('effect', name, opName);
  }

  apply(name, opName) {
    const op = this.ops.get(`${name}::${opName}`);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.view(name);
    const after = canonicalize(op.forward(before));
    this.vm.bind(name, JSON.stringify(after));
    this.history.push({ cell: name, before });
    this.emit('apply', name, after);
    return after;
  }

  applyInverse(name, opName) {
    const op = this.ops.get(`${name}::${opName}`);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.view(name);
    const after = canonicalize(op.inverse(before));
    this.vm.bind(name, JSON.stringify(after));
    this.history.push({ cell: name, before });
    this.emit('applyInverse', name, after);
    return after;
  }

  undo() {
    while (this.history.length) {
      const h = this.history.pop();
      if (!this._cells.has(h.cell)) continue;          // stale — skip
      this.vm.bind(h.cell, JSON.stringify(h.before));
      this.emit('undo', h.cell, h.before);
      return h.before;
    }
    return null;
  }

  unbind(name) {
    if (!this._cells.has(name)) return false;
    this._cells.delete(name);
    this.meta.delete(name);
    for (const [id, e] of this.edges)
      if (e.from === name || e.to === name) this.edges.delete(id);
    for (const key of [...this.ops.keys()])
      if (key.startsWith(`${name}::`)) this.ops.delete(key);
    this.emit('unbind', name, null);
    return true;   // WASM cell text + links remain as inert records
  }

  queueEffect(name, opName) {
    if (!this._cells.has(name)) throw new Error(`UnknownCell: ${name}`);
    if (!this.ops.has(`${name}::${opName}`)) throw new Error(`UnknownOp: ${opName} on ${name}`);
    this.queue.push({ cell: name, op: opName });
  }

  tick(dt = 1) {
    this.vm.tick(dt);
    const applied = [];
    while (this.queue.length) {
      const { cell, op } = this.queue.shift();
      applied.push({ cell, op, value: this.apply(cell, op) });
    }
    this.emit('tick', null, { ts: this.now(), applied });
    return { ts: this.now(), applied };
  }

  now() {
    // Scalar getter — stats() can't carry time to JS yet (upstream
    // serde-wasm-bindgen object-serialization bug returns empty objects).
    return this.vm.time();
  }

  load(snapshot) {
    this.vm = new WasmQuiltVM();
    this._cells = new Set();
    this.meta = new Map();
    this.edges = new Map();
    this.ops = new Map();
    this.history = [];
    this.queue = [];
    const metas = snapshot.meta ?? {};
    for (const [n, v] of Object.entries(snapshot.cells ?? {})) this.bind(n, v, metas[n]);
    for (const e of snapshot.links ?? []) this.link(e.from, e.to, e.type);
    this.emit('load', null, null);
    return this;
  }

  snapshot() {
    // Object.fromEntries, NOT `{}` then assign — a cell literally named
    // '__proto__' must survive as a data property.
    const cells = Object.fromEntries([...this._cells].map(n => [n, this.view(n)]));
    const snap = {
      cells,
      links: this.links(),
      ts: this.now(),
      historyDepth: this.history.length,
      queued: this.queue.length,
    };
    if (this.meta.size) snap.meta = Object.fromEntries(this.meta);
    return snap;
  }
}

// ---------- helpers (identical to reference-kernel.mjs) ----------
export function assertName(n) {
  if (typeof n !== 'string' || n.length === 0) throw new TypeError('name must be a non-empty string');
  if (n.length > 256) throw new TypeError('name exceeds 256 chars');
}

export function isJSON(v) {
  try { JSON.stringify(v); return typeof v !== 'function' && typeof v !== 'undefined'; }
  catch { return false; }
}

function canonicalize(v) {
  return v === undefined ? null : JSON.parse(JSON.stringify(v));
}

export function edgeId(a, b, type) {
  const esc = s => s.replace(/\\/g, '\\\\').replace(/>/g, '\\u003e').replace(/:/g, '\\u003a');
  return `${esc(a)}->${esc(b)}:${esc(type)}`;
}

// WasmQuiltKernel — the L1 adapter over quilt-vm-wasm's real WASM exports.
//
// CONTRACT v2 — same surface and semantics as reference-kernel.mjs.
// The raw kernel (SuperInstance/quilt-vm-wasm, vendored in ../vendor) exposes
// the 5 opcodes as dumb storage: bind/link/effect/view/tick + stats/reachable.
// The adapter owns the boundary:
//
//   ADAPTER-EMULATED (JS side):            NATIVE (WASM side):
//   - name validation (≤256, non-empty)    - cell storage (as JSON text)
//   - JSON-canonical value semantics       - link storage (with duplicates)
//     (NaN/±Infinity → null, snapshot      - view read (returns stored text)
//      on bind — matches reference)        - clock (time += dt, time() getter)
//   - cell registry, unbind, load          - stats, reachability
//   - edge registry: id escaping, dedup,
//     unlink, links()
//   - named op registry, apply/applyInverse
//   - undo history (global LIFO, skip stale)
//   - effect queue (FIFO, validated at enqueue)
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
    this.cells = new Set();   // bound names — authoritative registry
    this.edges = new Map();   // edgeId -> {from, to, type}
    this.ops = new Map();     // `${cell}::${op}` -> {forward, inverse}
    this.history = [];        // {cell, before}
    this.queue = [];          // {cell, op}
  }

  bind(name, value) {
    assertName(name);
    if (!isJSON(value)) throw new TypeError('bind: value must be JSON-serializable');
    const text = JSON.stringify(canonicalize(value));
    this.vm.bind(name, text);
    this.cells.add(name);
    return name;
  }

  view(name) {
    if (!this.cells.has(name)) return null;          // degrade, never throw
    const text = this.vm.view(name, '_kernel');
    return text === null || text === undefined ? null : JSON.parse(text);
  }

  link(a, b, type) {
    assertName(a); assertName(b);
    if (!this.cells.has(a)) throw new Error(`UnknownCell: ${a}`);
    if (!this.cells.has(b)) throw new Error(`UnknownCell: ${b}`);
    const id = edgeId(a, b, type);
    if (!this.edges.has(id)) {                        // idempotency: adapter-enforced
      this.edges.set(id, { from: a, to: b, type });
      this.vm.link(a, b, type);
    }
    return id;
  }

  unlink(id) {
    return this.edges.delete(id);                     // stale WASM link record is inert
  }

  links(from = null) {
    return [...this.edges.values()].filter(e => from === null || e.from === from);
  }

  effect(name, opName, forward, inverse) {
    if (!this.cells.has(name)) throw new Error(`UnknownCell: ${name}`);
    if (typeof forward !== 'function' || typeof inverse !== 'function')
      throw new TypeError('effect: forward and inverse must be functions');
    this.ops.set(`${name}::${opName}`, { forward, inverse });
    this.vm.effect(name, opName, `${opName}:inverse`);  // record-only on the kernel
  }

  apply(name, opName) {
    const op = this.ops.get(`${name}::${opName}`);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.view(name);
    const after = canonicalize(op.forward(before));
    this.vm.bind(name, JSON.stringify(after));
    this.history.push({ cell: name, before });
    return after;
  }

  applyInverse(name, opName) {
    const op = this.ops.get(`${name}::${opName}`);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.view(name);
    const after = canonicalize(op.inverse(before));
    this.vm.bind(name, JSON.stringify(after));
    this.history.push({ cell: name, before });
    return after;
  }

  undo() {
    while (this.history.length) {
      const h = this.history.pop();
      if (!this.cells.has(h.cell)) continue;          // stale — skip
      this.vm.bind(h.cell, JSON.stringify(h.before));
      return h.before;
    }
    return null;
  }

  unbind(name) {
    if (!this.cells.has(name)) return false;
    this.cells.delete(name);
    for (const [id, e] of this.edges)
      if (e.from === name || e.to === name) this.edges.delete(id);
    for (const key of [...this.ops.keys()])
      if (key.startsWith(`${name}::`)) this.ops.delete(key);
    return true;   // WASM cell text + links remain as inert records
  }

  queueEffect(name, opName) {
    if (!this.cells.has(name)) throw new Error(`UnknownCell: ${name}`);
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
    return { ts: this.now(), applied };
  }

  now() {
    // Scalar getter — stats() can't carry time to JS yet (upstream
    // serde-wasm-bindgen object-serialization bug returns empty objects).
    return this.vm.time();
  }

  load(snapshot) {
    this.vm = new WasmQuiltVM();
    this.cells = new Set();
    this.edges = new Map();
    this.ops = new Map();
    this.history = [];
    this.queue = [];
    for (const [n, v] of Object.entries(snapshot.cells ?? {})) this.bind(n, v);
    for (const e of snapshot.links ?? []) this.link(e.from, e.to, e.type);
    return this;
  }

  snapshot() {
    const cells = {};
    for (const n of this.cells) cells[n] = this.view(n);
    return {
      cells,
      links: this.links(),
      ts: this.now(),
      historyDepth: this.history.length,
      queued: this.queue.length,
    };
  }
}

// ---------- helpers (identical to reference-kernel.mjs) ----------
function assertName(n) {
  if (typeof n !== 'string' || n.length === 0) throw new TypeError('name must be a non-empty string');
  if (n.length > 256) throw new TypeError('name exceeds 256 chars');
}

function isJSON(v) {
  try { JSON.stringify(v); return typeof v !== 'function' && typeof v !== 'undefined'; }
  catch { return false; }
}

function canonicalize(v) {
  return v === undefined ? null : JSON.parse(JSON.stringify(v));
}

function edgeId(a, b, type) {
  const esc = s => s.replace(/\\/g, '\\\\').replace(/>/g, '\\u003e').replace(/:/g, '\\u003a');
  return `${esc(a)}->${esc(b)}:${esc(type)}`;
}

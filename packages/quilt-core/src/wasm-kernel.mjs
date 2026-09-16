// WasmQuiltKernel — the L1 adapter over quilt-vm-wasm's real WASM exports.
//
// The raw kernel (SuperInstance/quilt-vm-wasm, vendored in ../vendor) exposes
// the 5 opcodes as dumb storage: bind/link/effect/view/tick + stats/reachable.
// The studio contract (tests/contract-suite.mjs, 28 tests) requires semantics
// the raw kernel does not provide. The adapter owns the boundary:
//
//   ADAPTER-EMULATED (JS side):      NATIVE (WASM side):
//   - name validation (≤256, non-empty)  - cell storage (as JSON text)
//   - JSON-only value guard              - link storage (with duplicates)
//   - cell name registry                 - view read (returns stored text)
//   - link idempotency + listing         - clock (time += dt)
//   - named op registry + dispatch       - stats, reachability
//   - undo history (LIFO)
//   - effect queue (FIFO, flushed on tick)
//   - snapshot assembly
//
// Storage representation: cells are stored in the WASM kernel as canonical
// JSON TEXT (strings), because serde-wasm-bindgen 0.6.5 mis-serializes
// serde_json::Value::Object to empty JS objects (upstream bug, filed in the
// adapter audit). The adapter is the type boundary: objects in, objects out.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { WasmQuiltVM } = require(join(here, '../vendor/quilt_vm_wasm.cjs'));

export class WasmQuiltKernel {
  constructor() {
    this.vm = new WasmQuiltVM();
    this.names = new Set();   // bound cell names (adapter registry)
    this.edges = new Map();   // edgeId -> {from, to, type}
    this.ops = new Map();     // `${cell}::${op}` -> {forward, inverse}
    this.history = [];        // {cell, before}
    this.queue = [];          // {cell, op}
  }

  bind(name, value) {
    assertName(name);
    if (!isJSON(value)) throw new TypeError('bind: value must be JSON-serializable');
    const text = JSON.stringify(value);
    this.vm.bind(name, text);
    this.names.add(name);
    return name;
  }

  view(name) {
    if (!this.names.has(name)) return null;          // adapter guard: degrade, never throw
    const text = this.vm.view(name, '_kernel');
    return text === null || text === undefined ? null : JSON.parse(text);
  }

  link(a, b, type) {
    assertName(a); assertName(b);
    if (!this.names.has(a)) throw new Error(`UnknownCell: ${a}`);
    if (!this.names.has(b)) throw new Error(`UnknownCell: ${b}`);
    const id = `${a}->${b}:${type}`;
    if (!this.edges.has(id)) {                        // idempotency: adapter-enforced
      this.edges.set(id, { from: a, to: b, type });
      this.vm.link(a, b, type);
    }
    return id;
  }

  links(from = null) {
    return [...this.edges.values()].filter(e => from === null || e.from === from);
  }

  effect(name, opName, forward, inverse) {
    if (!this.names.has(name)) throw new Error(`UnknownCell: ${name}`);
    if (typeof forward !== 'function' || typeof inverse !== 'function')
      throw new TypeError('effect: forward and inverse must be functions');
    this.ops.set(`${name}::${opName}`, { forward, inverse });
    this.vm.effect(name, opName, `${opName}:inverse`);  // record-only on the kernel
  }

  apply(name, opName) {
    const op = this.ops.get(`${name}::${opName}`);
    if (!op) throw new Error(`UnknownOp: ${opName} on ${name}`);
    const before = this.view(name);
    const after = op.forward(before);
    this.vm.bind(name, JSON.stringify(after));
    this.history.push({ cell: name, before });
    return after;
  }

  undo() {
    const h = this.history.pop();
    if (!h) return false;
    this.vm.bind(h.cell, JSON.stringify(h.before));
    return true;
  }

  queueEffect(name, opName) {
    assertName(name); assertName(opName);
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

  snapshot() {
    const cells = {};
    for (const n of this.names) cells[n] = this.view(n);
    return {
      cells,
      links: this.links(),
      ts: this.now(),
      historyDepth: this.history.length,
      queued: this.queue.length,
    };
  }
}

function assertName(n) {
  if (typeof n !== 'string' || n.length === 0) throw new TypeError('name must be a non-empty string');
  if (n.length > 256) throw new TypeError('name exceeds 256 chars');
}

function isJSON(v) {
  try { JSON.stringify(v); return typeof v !== 'function' && typeof v !== 'undefined'; }
  catch { return false; }
}
